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

fn first_table<'a>(doc: &'a Html, title: &str) -> Option<ElementRef<'a>> {
    for heading in doc.select(&sel("h2,h3")) {
        if text(heading) != title {
            continue;
        }
        for sibling in heading.next_siblings() {
            if let Some(element) = ElementRef::wrap(sibling)
                && element.value().name() == "table"
            {
                return Some(element);
            }
        }
    }
    None
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
    let Some(table) = first_table(doc, title) else {
        return Vec::new();
    };
    let mut results = Vec::new();
    let mut current_skin: Option<Asset> = None;
    for cell in table.select(&sel("td")) {
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
            if asset.filename.contains("Pin") {
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
    let _ = brawler;
    results
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
    skin.insert("voicelines".into(), json!([])); // The previous implementation leaves its voice line loop commented out.
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
            pop_matching(icons, |item| match_skin_name(
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
    let mut icons = table_assets(doc, "Profile Icons", brawler);
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
