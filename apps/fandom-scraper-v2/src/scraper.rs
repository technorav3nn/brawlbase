use crate::wiki::{self, Page, Section};
use anyhow::{Context, Result};
use chrono::NaiveDate;
use scraper::{ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

#[derive(Clone)]
pub struct FandomScraper {
    http: crate::http::Http,
    api: String,
}

impl FandomScraper {
    pub fn new(http: crate::http::Http, api: String) -> Self {
        Self { http, api }
    }

    pub async fn update(&self) {}

    async fn page(&self, name: &str) -> Result<Option<(String, String, String)>> {
        // One response supplies HTML and raw wikitext from the same revision.
        let url = format!(
            "{}?action=parse&page={}&prop=text%7Cwikitext&redirects=true&format=json",
            self.api,
            urlencoding::encode(name)
        );
        let response = self.http.json(&url).await?;
        if let Some(error) = response.get("error") {
            if matches!(
                error["code"].as_str(),
                Some("missingtitle" | "invalidtitle" | "pagecannotexist")
            ) {
                return Ok(None);
            }
            anyhow::bail!("MediaWiki error for {name}: {error}");
        }
        let page = &response["parse"];
        Ok(Some((
            page["title"]
                .as_str()
                .context("missing page title")?
                .to_owned(),
            page["wikitext"]["*"]
                .as_str()
                .context("missing page wikitext")?
                .to_owned(),
            page["text"]["*"]
                .as_str()
                .context("missing page HTML")?
                .to_owned(),
        )))
    }

    /// Missing wiki pages are skipped, matching the old CLI. Buzz Lightyear is excluded upstream.
    pub async fn get_brawler_data(
        &self,
        name: &str,
        starpowers: &[CatalogItem],
        gadgets: &[CatalogItem],
    ) -> Result<Option<Value>> {
        let Some((title, source, html)) = self.page(name).await? else {
            return Ok(None);
        };
        if name == "Buzz Lightyear" {
            return Ok(None);
        }
        let name = name.to_owned();
        let starpowers = starpowers.to_vec();
        let gadgets = gadgets.to_vec();
        tokio::task::spawn_blocking(move || {
            parse_brawler(&name, &title, &source, &html, &starpowers, &gadgets)
        })
        .await?
        .map(Some)
    }

    pub async fn get_mode_data(&self, name: &str) -> Result<Option<Value>> {
        Ok(self
            .page(name)
            .await?
            .map(|(title, source, _)| parse_mode(name, &title, &source)))
    }
}

pub use crate::output::Asset;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CatalogItem {
    pub id: i64,
    pub name: String,
}

fn sel(query: &str) -> Selector {
    Selector::parse(query).expect("valid selector")
}
fn text(element: ElementRef<'_>) -> String {
    element.text().collect::<String>()
}

fn asset_from_img(img: ElementRef<'_>) -> Option<Asset> {
    let filename = img.value().attr("data-image-name")?.to_owned();
    let src = img
        .value()
        .attr("data-src")
        .or_else(|| img.value().attr("src"))?;
    let query = src.split_once('?').map(|(_, query)| query);
    let mut source_url = src
        .split("/smart")
        .next()?
        .split("/scale")
        .next()?
        .to_owned();
    if let Some(query) = query {
        source_url.push('?');
        source_url.push_str(query);
    }
    Some(Asset {
        filename,
        source_url,
    })
}

fn find_asset(doc: &Html, value: &str, attr: &str) -> Option<Asset> {
    doc.select(&sel("img"))
        .find(|img| img.value().attr(attr).unwrap_or("").contains(value))
        .and_then(asset_from_img)
}

/// Ignore MediaWiki edit controls and support both direct and wrapped headings.
fn section_tables<'a>(doc: &'a Html, title: &str) -> Vec<ElementRef<'a>> {
    let mut tables = Vec::new();
    for heading in doc.select(&sel("h2,h3")) {
        let label = heading
            .select(&sel(".mw-headline"))
            .next()
            .map(text)
            .unwrap_or_else(|| text(heading));
        if label.trim() != title
            && heading.value().attr("id") != Some(title.replace(' ', "_").as_str())
        {
            continue;
        }
        let container = heading
            .parent()
            .and_then(ElementRef::wrap)
            .filter(|parent| parent.value().classes().any(|class| class == "mw-heading"))
            .unwrap_or(heading);
        for sibling in container.next_siblings().filter_map(ElementRef::wrap) {
            if matches!(
                sibling.value().name(),
                "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
            ) || sibling.value().classes().any(|class| class == "mw-heading")
            {
                break;
            }
            if sibling.value().name() == "table" {
                tables.push(sibling);
            } else {
                tables.extend(sibling.select(&sel("table")));
            }
        }
    }
    tables
}

fn profile_icons_table(doc: &Html) -> Option<ElementRef<'_>> {
    section_tables(doc, "Profile Icons").into_iter().next()
}

fn profile_name_key(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

pub(crate) fn is_base_profile_icon(filename: &str, brawler: &str) -> bool {
    profile_name_key(filename) == profile_name_key(&format!("{brawler}1-pfp.png"))
}

fn original_profile_url(src: &str) -> Option<String> {
    let mut url = reqwest::Url::parse(src).ok()?;
    let path = url.path().to_owned();
    let original_path = if let Some((file, revision)) = path.split_once("/revision/") {
        // Everything following the revision ID is a CDN image transformation.
        format!("{file}/revision/{}", revision.split('/').next()?)
    } else {
        path.split("/smart")
            .next()?
            .split("/scale")
            .next()?
            .to_owned()
    };
    let cache_buster = url
        .query_pairs()
        .find(|(key, _)| key == "cb")
        .map(|(_, value)| value.into_owned());
    url.set_path(&original_path);
    url.set_query(None);
    {
        let mut query = url.query_pairs_mut();
        if let Some(value) = cache_buster {
            query.append_pair("cb", &value);
        }
        // Removing resize suffixes alone still allows Fandom to return lossy WebP.
        query.append_pair("format", "original");
    }
    Some(url.into())
}

fn profile_icons(doc: &Html, brawler: &str) -> Vec<AttachedAsset> {
    let Some(table) = profile_icons_table(doc) else {
        return Vec::new();
    };
    table
        .select(&sel("td"))
        .filter_map(|cell| {
            let img = cell.select(&sel("img")).next()?;
            let src = img
                .value()
                .attr("data-src")
                .or_else(|| img.value().attr("src"))?;
            let asset = Asset {
                filename: img.value().attr("data-image-name")?.to_owned(),
                source_url: original_profile_url(src)?,
            };
            let label = text(cell).split_whitespace().collect::<Vec<_>>().join(" ");
            let filename = profile_name_key(&asset.filename);
            let brawler_key = profile_name_key(brawler);
            let is_brawler_icon = [
                "1pfppng",
                "2pfppng",
                "hyperchargepfppng",
                "prestigepfppng",
                "masterypfppng",
            ]
            .iter()
            .any(|suffix| filename == format!("{brawler_key}{suffix}"));
            Some(AttachedAsset {
                skin_name: if is_brawler_icon || label.eq_ignore_ascii_case(brawler) {
                    "Default".into()
                } else {
                    label
                },
                value: json!(asset),
            })
        })
        .collect()
}

fn match_profile_skin_name(expected: &str, actual: &str, brawler: &str) -> bool {
    match_skin_name(expected, actual, brawler)
        || profile_name_key(expected) == profile_name_key(actual)
        || profile_name_key(expected) == profile_name_key(&actual.replacen(brawler, "", 1))
}

fn parse_int(text: &str) -> Value {
    let leading = re!(r"^\s*([+-]?\d+)");
    leading
        .captures(text)
        .and_then(|capture| capture[1].parse::<i64>().ok())
        .map_or(Value::Null, |number| json!(number))
}

fn infobox_table(doc: &Html, section_name: &str) -> Option<(Value, Value)> {
    let heading = doc
        .select(&sel(".portable-infobox h2"))
        .find(|heading| text(*heading) == section_name)?;
    let section = heading.parent().and_then(ElementRef::wrap)?;
    let stats: Vec<Value> = section
        .select(&sel(".pi-data"))
        .map(|datum| {
            let label = datum
                .select(&sel(".pi-data-label"))
                .next()
                .map(text)
                .unwrap_or_default();
            let html = datum
                .select(&sel(".pi-data-value"))
                .next()
                .map(|value| value.inner_html())
                .unwrap_or_default();
            let linebreak = re!(r"(?i)<br\s*/?>");
            json!({ "label": label, "value": linebreak.replace_all(&html, "\n").to_string() })
        })
        .collect();
    let groups: Vec<_> = section.select(&sel(".pi-group")).collect();
    let names: Vec<String> = groups
        .first()
        .map(|group| group.select(&sel(".pi-data-value")).map(text).collect())
        .unwrap_or_default();
    let values: Vec<Vec<Value>> = groups
        .iter()
        .skip(1)
        .map(|group| {
            group
                .select(&sel(".pi-data-value"))
                .map(|value| parse_int(&text(value)))
                .collect()
        })
        .collect();
    let level_index = names.iter().position(|name| name == "Level");
    let levels: Vec<Value> = values
        .iter()
        .filter_map(|row| level_index.and_then(|index| row.get(index)).cloned())
        .collect();
    let by_level: Vec<Value> = names.iter().enumerate().filter(|(_, name)| *name != "Level")
        .map(|(index, name)| json!({
            "name": name,
            "levels": levels,
            "values": values.iter().filter_map(|row| row.get(index).cloned()).collect::<Vec<_>>()
        })).collect();
    Some((json!(stats), json!(by_level)))
}

fn named_description(section: Option<&Section>) -> (String, String) {
    let Some(section) = section else {
        return (String::new(), String::new());
    };
    let name = section
        .title
        .rsplit_once(": ")
        .map_or(section.title.as_str(), |(_, name)| name)
        .to_owned();
    let description = wiki::first_quote(&section.body).unwrap_or_default();
    (name, description)
}

fn attack(section: Option<&Section>, info: Option<(Value, Value)>) -> Value {
    let (name, description) = named_description(section);
    let (stats, stats_by_level) = info.unwrap_or_else(|| (json!([]), json!([])));
    json!({ "name": name, "description": description, "stats": stats, "statsByLevel": stats_by_level })
}

fn id_for(name: &str, catalog: &[CatalogItem]) -> Result<String> {
    crate::fuzzy_dict::get_id_from_name(name, catalog)
        .map(|item| item.id.to_string())
        .with_context(|| format!("no accessory matches {name:?}"))
}

fn accessories(
    page: &Page,
    doc: &Html,
    brawler_name: &str,
    catalog: &[CatalogItem],
    kind: &str,
) -> Result<Vec<Value>> {
    let sections = page.section_or_children(kind);
    let fixed_name = if brawler_name == "Mr. P" {
        "Mr.P"
    } else {
        brawler_name
    };
    let mut output = Vec::new();
    for (index, section) in sections.iter().enumerate() {
        let (name, description) = named_description(Some(section));
        let table_name = format!(
            "{}: {name}",
            if kind == "Gadget" {
                "Gadget"
            } else {
                "Star Power"
            }
        );
        let (stats, stats_by_level) =
            infobox_table(doc, &table_name).unwrap_or_else(|| (json!([]), json!([])));
        let image_name = format!(
            "{}-{fixed_name}{}",
            if kind == "Gadget" { "GD" } else { "SP" },
            index + 1
        );
        let mut item = Map::new();
        item.insert("name".into(), json!(name));
        item.insert("id".into(), json!(id_for(&name, catalog)?));
        item.insert("description".into(), json!(description));
        if let Some(asset) = find_asset(doc, &image_name, "data-image-name") {
            item.insert("asset".into(), json!(asset));
        }
        item.insert("statsByLevel".into(), stats_by_level);
        if kind == "Gadget"
            && let Some(value) = stats
                .as_array()
                .and_then(|stats| stats.first())
                .and_then(|stat| stat.get("value"))
        {
            item.insert("cooldown".into(), value.clone());
        }
        output.push(Value::Object(item));
    }
    Ok(output)
}

fn pop_matching<T, F: Fn(&T) -> bool>(items: &mut Vec<T>, predicate: F) -> Vec<T> {
    let mut output = Vec::new();
    let mut index = 0;
    while index < items.len() {
        if predicate(&items[index]) {
            output.push(items.remove(index));
        } else {
            index += 1;
        }
    }
    output
}

#[derive(Clone)]
struct AttachedAsset {
    skin_name: String,
    value: Value,
}

fn match_skin_name(expected: &str, actual: &str, brawler: &str) -> bool {
    if expected == actual {
        return true;
    }
    let cleaned = actual.replacen(brawler, "", 1).trim().to_owned();
    if expected == "Default" {
        actual == brawler || cleaned == "Hypercharge" || cleaned == "Mastery"
    } else {
        expected == cleaned
    }
}

fn table_assets(doc: &Html, title: &str, brawler: &str) -> Vec<AttachedAsset> {
    let tables = section_tables(doc, title);
    let mut results = Vec::new();
    let mut current_skin: Option<Asset> = Some(Asset {
        filename: format!("{brawler} Skin-Default.png"),
        source_url: String::new(),
    });
    let cell_selector = sel("td");
    for cell in tables.iter().flat_map(|table| table.select(&cell_selector)) {
        if !cell
            .children()
            .any(|child| ElementRef::wrap(child).is_some())
        {
            continue;
        }
        let Some(img) = cell.select(&sel("img")).next() else {
            continue;
        };
        let Some(asset) = asset_from_img(img) else {
            continue;
        };
        if title == "Pins" {
            if asset.filename.contains("Skin") {
                current_skin = Some(asset.clone());
            }
            let Some(skin_asset) = &current_skin else {
                continue;
            };
            if asset.filename.contains("Pin-") {
                let rarity = cell.select(&sel("i")).next().map(text).unwrap_or_default();
                let emote = cell.select(&sel("p")).next().map(text).unwrap_or_default();
                results.push(AttachedAsset {
                    skin_name: skin_asset.filename.clone(),
                    value: json!({ "asset": asset, "rarity": rarity, "emote": emote }),
                });
            }
        } else if title == "Sprays" {
            let skin_name = cell.select(&sel("p")).next().map(text).unwrap_or_default();
            let rarity = cell.select(&sel("i")).next().map(text).unwrap_or_default();
            results.push(AttachedAsset {
                skin_name,
                value: json!({ "asset": asset, "rarity": rarity }),
            });
        } else {
            results.push(AttachedAsset {
                skin_name: text(cell).trim().to_owned(),
                value: json!(asset),
            });
        }
    }
    let mut seen = std::collections::BTreeSet::new();
    results.retain(|item| {
        seen.insert(
            item.value["asset"]["filename"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
        )
    });
    results
}

// Audio is read from rendered HTML so expanded templates and translations survive.
fn voicelines(doc: &Html) -> Vec<Value> {
    section_tables(doc, "Voice Lines")
        .into_iter()
        .flat_map(table_voicelines)
        .collect()
}

fn table_voicelines(table: ElementRef<'_>) -> Vec<Value> {
    let header_selector = sel("th");
    let headers: Vec<_> = table
        .select(&sel("tr"))
        .next()
        .into_iter()
        .flat_map(|row| row.select(&header_selector))
        .map(|cell| text(cell).trim().to_owned())
        .collect();
    let mut lines = Vec::new();
    for row in table.select(&sel("tr")).skip(1) {
        for (column, cell) in row.select(&sel("td")).enumerate() {
            for audio in cell.select(&sel("audio")) {
                let Some(url) = audio.value().attr("src").or_else(|| {
                    audio
                        .select(&sel("source"))
                        .next()
                        .and_then(|source| source.value().attr("src"))
                }) else {
                    continue;
                };
                let Some(filename) = url
                    .split("/revision")
                    .next()
                    .and_then(|path| path.rsplit('/').next())
                else {
                    continue;
                };
                let description = audio
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .find_map(|parent| parent.select(&sel("i")).next().map(text))
                    .unwrap_or_default();
                let variant = audio
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .find(|element| element.value().name() == "div")
                    .and_then(|container| {
                        container
                            .prev_siblings()
                            .filter_map(ElementRef::wrap)
                            .find(|element| element.value().name() == "b")
                    })
                    .map(text);
                let mut line = json!({ "trigger": headers.get(column).cloned().unwrap_or_default(),
                    "description": description.trim(), "asset": { "filename": filename, "sourceUrl": url } });
                if let Some(variant) = variant {
                    line["variant"] = json!(variant.trim().trim_end_matches(':'));
                }
                lines.push(line);
            }
        }
    }
    lines
}

fn buffies(page: &Page, doc: &Html, brawler: &str) -> Vec<Value> {
    fn collect(section: &Section, result: &mut Vec<Value>) {
        for quote in re!(r"(?i)\{\{\s*Quote\s*\|").find_iter(&section.body) {
            // Parse balanced templates so a base ability's Quote cannot consume the
            // following explanation and Buffie Quote (including nested markup).
            let Some((content, end)) = wiki::template_at(&section.body, quote.start()) else {
                continue;
            };
            let following = section.body[end..].trim_start();
            if !following.starts_with("{{") {
                continue;
            }
            let Some((marker, _)) = wiki::template_at(following, 0) else {
                continue;
            };
            let marker = wiki::split_template(&marker);
            if !marker
                .first()
                .is_some_and(|name| name.eq_ignore_ascii_case("Buffie"))
            {
                continue;
            }
            let quote = wiki::split_template(&content);
            let (Some(description), Some(kind)) = (quote.get(1), marker.get(1)) else {
                continue;
            };
            result.push(json!({ "name": section.title, "kind": kind,
                "description": wiki::section_text(description) }));
        }
        for child in &section.children {
            collect(child, result);
        }
    }
    let mut result = Vec::new();
    for section in &page.sections {
        collect(section, &mut result);
    }
    for buffie in &mut result {
        if let Some(kind) = buffie["kind"].as_str()
            && let Some(asset) = doc
                .select(&sel("img"))
                .filter_map(asset_from_img)
                .find(|asset| asset.filename == format!("{brawler} Buffie-{kind}.png"))
        {
            buffie["asset"] = json!(asset);
        }
    }
    result
}

fn buffie_skins(doc: &Html, brawler: &str) -> Vec<Value> {
    let mut result = Vec::new();
    for img in doc.select(&sel("img")) {
        let Some(asset) = asset_from_img(img) else {
            continue;
        };
        let prefix = format!("{brawler} Buffie Skin-");
        let Some(name) = asset
            .filename
            .strip_prefix(&prefix)
            .and_then(|name| name.strip_suffix(".png"))
        else {
            continue;
        };
        if !result
            .iter()
            .any(|item: &Value| item["asset"]["filename"] == asset.filename)
        {
            result.push(json!({ "name": name, "asset": asset }));
        }
    }
    result
}

fn skin_property(
    entry: &std::collections::HashMap<String, Vec<String>>,
    key: &str,
) -> Option<String> {
    entry.get(key).map(|values| values.join(", "))
}

#[allow(clippy::too_many_arguments)] // Keep the legacy skin/template inputs explicit.
fn skin_data(
    name: &str,
    entry: Option<&std::collections::HashMap<String, Vec<String>>>,
    brawler: &str,
    for_pet: Option<&str>,
    doc: &Html,
    pins: &mut Vec<AttachedAsset>,
    sprays: &mut Vec<AttachedAsset>,
    icons: &mut Vec<AttachedAsset>,
    skins: &mut Vec<Value>,
) {
    let filename = format!("{brawler} {}-{name}.png", for_pet.map_or("Skin", |pet| pet));
    let Some(asset) = find_asset(doc, &filename, "title") else {
        return;
    };
    if let Some(pet) = for_pet {
        if let Some(skin) = skins
            .iter_mut()
            .find(|skin| skin.get("name").and_then(Value::as_str) == Some(name))
            && let Some(items) = skin.get_mut("petSkins").and_then(Value::as_array_mut)
        {
            items.push(json!({ "for": pet, "asset": asset }));
        }
        return;
    }
    let mut skin = Map::new();
    skin.insert("name".into(), json!(name));
    if let Some(entry) = entry {
        if let Some(rarity) = skin_property(entry, "rarity") {
            skin.insert("rarity".into(), json!(rarity));
        }
        if let Some(campaign) = skin_property(entry, "campaign") {
            skin.insert("campaign".into(), json!(campaign));
        }
        if let Some(cost) = entry.get("cost") {
            let joined = cost.join(", ");
            skin.insert(
                "cost".into(),
                json!(joined.replace(" • E", "").replace(" • S", "")),
            );
            skin.insert(
                "exclusive".into(),
                json!(cost.iter().any(|value| value.ends_with(" • E"))),
            );
            skin.insert(
                "seasonal".into(),
                json!(cost.iter().any(|value| value.ends_with(" • S"))),
            );
        } else {
            skin.insert("exclusive".into(), json!(false));
            skin.insert("seasonal".into(), json!(false));
        }
    } else {
        skin.insert("exclusive".into(), json!(false));
        skin.insert("seasonal".into(), json!(false));
    }
    skin.insert("asset".into(), json!(asset));
    skin.insert("petSkins".into(), json!([]));
    skin.insert(
        "pins".into(),
        json!(
            pop_matching(pins, |item| item.skin_name == asset.filename)
                .into_iter()
                .map(|item| item.value)
                .collect::<Vec<_>>()
        ),
    );
    skin.insert(
        "voicelines".into(),
        if name == "Default" {
            json!(
                voicelines(doc)
                    .into_iter()
                    .filter(|line| line
                        .get("variant")
                        .and_then(Value::as_str)
                        .is_none_or(|variant| variant == "Normal"))
                    .collect::<Vec<_>>()
            )
        } else {
            json!([])
        },
    );
    skin.insert(
        "sprays".into(),
        json!(
            pop_matching(sprays, |item| match_skin_name(
                name,
                &item.skin_name,
                brawler
            ))
            .into_iter()
            .map(|item| item.value)
            .collect::<Vec<_>>()
        ),
    );
    skin.insert(
        "profileIcons".into(),
        json!(
            pop_matching(icons, |item| match_profile_skin_name(
                name,
                &item.skin_name,
                brawler
            ))
            .into_iter()
            .map(|item| item.value)
            .collect::<Vec<_>>()
        ),
    );
    skins.push(Value::Object(skin));
}

fn skins(source: &str, doc: &Html, brawler: &str) -> Vec<Value> {
    let mut pins = table_assets(doc, "Pins", brawler);
    let mut sprays = table_assets(doc, "Sprays", brawler);
    let mut icons = profile_icons(doc, brawler);
    let mut skins = Vec::new();
    for template in wiki::templates(source, "Skin Gallery") {
        let fields = wiki::fields_from_template(&template);
        let for_pet = fields
            .iter()
            .find(|(key, _)| key == "for")
            .map(|(_, value)| value.as_str());
        skin_data(
            "Default",
            None,
            brawler,
            for_pet,
            doc,
            &mut pins,
            &mut sprays,
            &mut icons,
            &mut skins,
        );
        for entry in wiki::skin_entries(&format!("{{{{{template}}}}}")) {
            if let Some(name) = skin_property(&entry, "name") {
                skin_data(
                    &name,
                    Some(&entry),
                    brawler,
                    for_pet,
                    doc,
                    &mut pins,
                    &mut sprays,
                    &mut icons,
                    &mut skins,
                );
            }
        }
        if fields
            .iter()
            .any(|(key, value)| key == "trueskins" && !value.is_empty())
        {
            for (name, cost) in [("True Silver", "10000 Coins"), ("True Gold", "25000 Coins")] {
                let entry =
                    std::collections::HashMap::from([("cost".to_owned(), vec![cost.to_owned()])]);
                skin_data(
                    name,
                    Some(&entry),
                    brawler,
                    for_pet,
                    doc,
                    &mut pins,
                    &mut sprays,
                    &mut icons,
                    &mut skins,
                );
            }
        }
    }
    skins
}

fn history(page: &Page) -> Vec<Value> {
    let Some(section) = page.section("History") else {
        return Vec::new();
    };
    let fallback = !section
        .body
        .lines()
        .filter_map(|line| wiki::template(line, "Balance"))
        .any(|t| {
            wiki::split_template(&t)
                .iter()
                .skip(1)
                .any(|p| !p.contains('='))
        });
    let date_regex = re!(r"^\*\s*(\d{2})/(\d{2})/(\d{2}):$");
    let mut date = None;
    let mut history = Vec::new();
    let mut started = false;
    for line in section.body.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('*') {
            if started {
                break;
            }
            continue;
        }
        started = true;
        if let Some(capture) = date_regex.captures(trimmed) {
            date = NaiveDate::parse_from_str(
                &format!("{}/{}/20{}", &capture[1], &capture[2], &capture[3]),
                "%d/%m/%Y",
            )
            .ok();
        }
        if let (Some(date), Some(balance)) = (date, wiki::template(trimmed, "Balance")) {
            if !fallback && trimmed.trim_start_matches('*').trim() != format!("{{{{{balance}}}}}") {
                continue;
            }
            let parts = wiki::split_template(&balance);
            let mut value = Map::new();
            if fallback {
                let fields = wiki::fields_from_template(&balance);
                let Some((_, kind)) = fields.iter().find(|(k, _)| k == "change") else {
                    return Vec::new();
                };
                value.insert("kind".into(), json!(kind));
                let description = fields
                    .iter()
                    .find(|(k, _)| k == "content")
                    .map_or("", |(_, v)| v.as_str());
                value.insert("description".into(), json!(description));
            } else {
                let positional: Vec<_> = parts
                    .iter()
                    .skip(1)
                    .filter(|p| !re!(r"^[\p{L}0-9._/\- '()\t]+=").is_match(p))
                    .collect();
                if positional.is_empty() {
                    continue;
                }
                value.insert("kind".into(), json!(positional[0]));
                if let Some(description) = positional.get(1) {
                    value.insert("description".into(), json!(wiki::clean(description)));
                }
            }
            value.insert(
                "date".into(),
                json!(format!("{}T00:00:00.000Z", date.format("%Y-%m-%d"))),
            );
            history.push(Value::Object(value));
        }
    }
    history
}

pub fn parse_brawler(
    brawler_name: &str,
    title: &str,
    source: &str,
    html: &str,
    starpowers: &[CatalogItem],
    gadgets: &[CatalogItem],
) -> Result<Value> {
    let name = if brawler_name == "Jae-Yong" {
        "Jae-yong"
    } else {
        brawler_name
    };
    let page = Page::parse(source);
    let doc = Html::parse_document(html);
    let mut data = Map::new();
    data.insert(
        "attribution".into(),
        json!(format!(
            "https://brawlstars.fandom.com/wiki/{}",
            crate::wiki::url_title(title)
        )),
    );
    data.insert(
        "shortDescription".into(),
        json!(wiki::first_quote(&page.intro).unwrap_or_default()),
    );
    data.insert(
        "fullDescription".into(),
        json!(
            wiki::section_text(&page.intro)
                .lines()
                .skip(1)
                .collect::<Vec<_>>()
                .join("\n")
                .trim()
        ),
    );
    if let Some(trait_section) = page.section("Trait")
        && let Some(trait_description) = wiki::first_quote(&trait_section.body)
    {
        data.insert("trait".into(), json!(trait_description));
    }
    if let Some(traits) = page.section("Traits") {
        let trait_descriptions: Vec<_> = traits
            .children
            .iter()
            .filter_map(|section| wiki::first_quote(&section.body))
            .collect();
        data.insert("trait".into(), json!(trait_descriptions.join("\n")));
    }
    for (kind, main_key, alternate_key) in [
        ("Attack", "attack", "altAttack"),
        ("Super", "super", "altSuper"),
    ] {
        let sections = page.section_or_children(kind);
        if name == "Kaze" {
            for (index, section) in sections.iter().take(2).enumerate() {
                let title = if kind == "Super" {
                    section
                        .title
                        .replace("Fist of the Brawl Star", "Fist of the North Star")
                } else {
                    section.title.clone()
                };
                let info = infobox_table(&doc, &format!("{title} ({kind})"));
                data.insert(
                    if index == 0 { main_key } else { alternate_key }.into(),
                    attack(Some(section), info),
                );
            }
        } else {
            let info = infobox_table(&doc, kind);
            data.insert(
                main_key.into(),
                attack(sections.first().copied(), info.clone()),
            );
            if let Some(second) = sections.get(1) {
                data.insert(alternate_key.into(), attack(Some(second), info));
            }
        }
    }
    let hyper_sections = page.section_or_children("Hypercharge");
    if let Some(section) = hyper_sections.first() {
        let (name_hyper, description) = named_description(Some(section));
        let (stats, _) =
            infobox_table(&doc, "Hypercharge").unwrap_or_else(|| (json!([]), json!([])));
        let mut value = Map::new();
        value.insert("name".into(), json!(name_hyper));
        value.insert("description".into(), json!(description));
        value.insert("stats".into(), stats);
        if let Some(asset) = find_asset(&doc, &format!("{name}-Hypercharge"), "data-image-name") {
            value.insert("asset".into(), json!(asset));
        }
        data.insert("hypercharge".into(), Value::Object(value));
    }
    let info = wiki::template_fields(source, "Brawler Infobox")
        .or_else(|| wiki::template_fields(source, &format!("{name} Infobox")))
        .context("missing brawler infobox")?;
    let field = |key: &str| {
        info.iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.clone())
            .unwrap_or_default()
    };
    let base = field("health").replace(',', "").parse::<f64>().ok();
    let health: Vec<Value> = (0..11)
        .map(|level| {
            base.map_or(Value::Null, |base| {
                wiki::number(base + level as f64 * (base / 10.0))
            })
        })
        .collect();
    data.insert("healthByLevel".into(), json!(health));
    let format_stat = |key: &str| re!(r"\s(\d)").replace_all(&field(key), ", $1").to_string();
    let mut stats = Map::new();
    for (source, target) in [
        ("rarity", "rarity"),
        ("class", "class"),
        ("movementspeed", "movementspeed"),
        ("voiceactor", "voiceactor"),
    ] {
        let value = format_stat(source);
        if !value.is_empty() {
            stats.insert(target.into(), json!(value));
        }
    }
    data.insert("stats".into(), Value::Object(stats));
    let tips = page
        .section("Tips")
        .map(|section| {
            section
                .children
                .iter()
                .flat_map(|sub| wiki::list_lines(&sub.body))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    data.insert("tips".into(), json!(tips));
    if let Some(model) = find_asset(&doc, &format!("{name} Skin-Default"), "alt") {
        data.insert("model".into(), json!(model));
    }
    if let Some(avatar) = find_asset(&doc, &format!("{name} Portrait"), "data-image-name") {
        data.insert("avatar".into(), json!(avatar));
    }
    data.insert("skins".into(), json!(skins(source, &doc, name)));
    for (key, title) in [("pins", "Pins"), ("sprays", "Sprays")] {
        data.insert(
            key.into(),
            json!(
                table_assets(&doc, title, name)
                    .into_iter()
                    .map(|item| item.value)
                    .collect::<Vec<_>>()
            ),
        );
    }
    data.insert("voicelines".into(), json!(voicelines(&doc)));
    data.insert("buffies".into(), json!(buffies(&page, &doc, name)));
    data.insert("buffieSkins".into(), json!(buffie_skins(&doc, name)));

    data.insert("history".into(), json!(history(&page)));
    data.insert(
        "gadgets".into(),
        json!(accessories(&page, &doc, name, gadgets, "Gadget")?),
    );
    data.insert(
        "starpowers".into(),
        json!(accessories(&page, &doc, name, starpowers, "Star Power")?),
    );
    Ok(Value::Object(data))
}

pub fn parse_mode(name: &str, title: &str, source: &str) -> Value {
    let page = Page::parse(source);
    let description = wiki::section_text(&page.intro);
    let mut lines = description.lines();
    let short_description = lines.next().unwrap_or_default().replace('"', "");
    let mut full_description = lines.collect::<Vec<_>>().join("\n").trim().to_owned();
    if let Some(section) = page.section(&format!("{name} 5v5")) {
        let extra = wiki::section_text(&section.body);
        if !extra.is_empty() {
            full_description.push_str("\n\n");
            full_description.push_str(&extra);
        }
    }
    let tips = page
        .section("Tips")
        .map(|section| wiki::list_lines(&section.body))
        .unwrap_or_default();
    let brawler_tips = page.section("Useful Brawlers").map(|section| {
        wiki::list_lines(&section.body).into_iter().filter_map(|line| {
            let (brawler, description) = line.split_once(": ")?;
            if !brawler.chars().all(|character| character.is_alphanumeric() || character == '_') { return None; }
            Some(json!({ "brawlerId": brawler.replace(['.', ' ', '&'], "_").to_lowercase(), "description": description }))
        }).collect::<Vec<_>>()
    }).unwrap_or_default();
    let mode_history = page.section("History").map(|section| {
        let re = re!(r"^On (\d{2})/(\d{2})/(\d{2}), (.*)$");
        wiki::list_lines(&section.body).into_iter().filter_map(|line| {
            let groups = re.captures(&line)?;
            let date = NaiveDate::parse_from_str(&format!("{}/{}/20{}", &groups[1], &groups[2], &groups[3]), "%d/%m/%Y").ok()?;
            Some(json!({ "date": format!("{}T00:00:00.000Z", date.format("%Y-%m-%d")), "description": &groups[4] }))
        }).collect::<Vec<_>>()
    }).unwrap_or_default();
    json!({
        "attribution": format!("https://brawlstars.fandom.com/wiki/{}", crate::wiki::url_title(title)),
        "shortDescription": short_description,
        "fullDescription": full_description,
        "tips": tips,
        "brawlerTips": brawler_tips,
        "history": mode_history,
    })
}

#[cfg(test)]
mod buffie_tests {
    use super::*;

    #[test]
    fn extracts_only_the_quote_immediately_before_each_buffie() {
        let page = Page::parse(
            "== Gadgets ==\n=== Rocket Laces ===\n\
             {{Quote|Base ability. Cooldown: 16 seconds.}}\n\
             Detailed base ability jargon, including {{nowrap|extra stats}}.\n\
             {{Quote|Hitting an enemy Brawler gives +2 sec movement speed.}}\n\
             {{Buffie|Gadget}}\n\
             Further Buffie explanation should not appear.\n\
             === Second Gadget ===\n\
             {{Quote|Base ability.}}\n\
             {{Quote|Deal {{color|400}} damage to [[Brawler|enemies]].}} {{Buffie|Gadget|extra}}\n\
             == Hypercharge: Test ==\n\
             {{ quote | A stronger Super. }}\n{{ buffie | Hyper }}",
        );
        let result = buffies(&page, &Html::parse_fragment(""), "Brock");
        assert_eq!(
            result,
            vec![
                json!({"name": "Rocket Laces", "kind": "Gadget", "description": "Hitting an enemy Brawler gives +2 sec movement speed."}),
                json!({"name": "Second Gadget", "kind": "Gadget", "description": "Deal 400 damage to enemies."}),
                json!({"name": "Hypercharge: Test", "kind": "Hyper", "description": "A stronger Super."}),
            ]
        );
    }

    #[test]
    fn does_not_reuse_an_unrelated_or_unclosed_quote() {
        let page = Page::parse(
            "== Gadgets ==\n=== No Buffie Quote ===\n\
             {{Quote|Base ability.}}\nExplanation.\n{{Buffie|Gadget}}\n\
             === Missing Quote End ===\n{{Quote|Unclosed.\n{{Buffie|Star}}\n\
             === Different Marker ===\n{{Quote|Normal ability.}}{{NotBuffie|Gadget}}",
        );
        assert!(buffies(&page, &Html::parse_fragment(""), "Brock").is_empty());
    }
}

#[cfg(test)]
mod profile_icon_tests {
    use super::*;

    const CELL: &str = r#"<table><tr><td><img data-image-name="Shelly1-pfp.png" data-src="https://example.test/Shelly1-pfp.png/revision/latest/scale-to-width-down/65?cb=123"><p>Shelly</p></td></tr></table>"#;

    #[test]
    fn ignores_edit_controls_and_supports_wrapped_headings() {
        for heading in [
            r#"<h3><span class="mw-headline" id="Profile_Icons">Profile Icons</span><span class="mw-editsection">[edit]</span></h3>"#,
            r#"<div class="mw-heading mw-heading3"><h3 id="Profile_Icons">Profile Icons</h3><span class="mw-editsection">[edit]</span></div>"#,
        ] {
            let doc = Html::parse_document(&format!("{heading}<div>{CELL}</div>"));
            let icons = profile_icons(&doc, "Shelly");
            assert_eq!(icons.len(), 1);
            assert_eq!(icons[0].skin_name, "Default");
            assert_eq!(
                icons[0].value["sourceUrl"],
                "https://example.test/Shelly1-pfp.png/revision/latest?cb=123&format=original"
            );
        }
    }

    #[test]
    fn stops_at_the_next_section_and_keeps_unscaled_urls_intact() {
        let doc = Html::parse_document(&format!("<h3>Profile Icons</h3><h3>Other</h3>{CELL}"));
        assert!(profile_icons(&doc, "Shelly").is_empty());
        let doc = Html::parse_document(&format!(
            "<h3>Profile Icons</h3>{}",
            CELL.replace("/scale-to-width-down/65", "")
        ));
        let icons = profile_icons(&doc, "Shelly");
        assert_eq!(
            icons[0].value["sourceUrl"],
            "https://example.test/Shelly1-pfp.png/revision/latest?cb=123&format=original"
        );
    }

    #[test]
    fn requests_original_files_without_cdn_transformations() {
        let base = "https://static.wikia.nocookie.net/brawlstars/images/d/d0/Larry_%26_Lawrie1-pfp.png/revision/latest";
        for suffix in [
            "?cb=123",
            "/scale-to-width-down/65?cb=123",
            "/smart/width/65/height/65?cb=123",
            "/thumbnail/width/65/height/65?cb=123&format=webp&quality=10",
            "/zoom-crop/width/65/height/65?width=65&height=65&cb=123&format=png",
        ] {
            assert_eq!(
                original_profile_url(&format!("{base}{suffix}")).unwrap(),
                format!("{base}?cb=123&format=original")
            );
        }
        assert_eq!(
            original_profile_url(&format!("{base}/scale-to-width-down/65")).unwrap(),
            format!("{base}?format=original")
        );
    }
}
