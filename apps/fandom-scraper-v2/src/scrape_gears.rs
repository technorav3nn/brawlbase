use crate::{
    downloader::{Downloader, write_data},
    http::Http,
    index::{Config, catalog},
};
use anyhow::{Context, Result};
use futures::{StreamExt, stream};
use serde_json::{Map, Value, json};

fn js_string(value: &Value) -> String {
    value.as_str().map(str::to_owned).unwrap_or_else(|| {
        if value.is_null() {
            "undefined".into()
        } else {
            value.to_string()
        }
    })
}

pub fn gear_data(gear: &Value, texts: &Value, characters: &Value) -> Result<Value> {
    let mut modifier = gear["ModifierValue"].clone();
    if gear["ModifierType"] == "ticks" {
        modifier = crate::wiki::number(
            gear["ModifierValue"]
                .as_f64()
                .context("invalid tick modifier")?
                / 20.0,
        );
    }
    let name = texts[gear["TID"].as_str().context("missing gear TID")?]["EN"]
        .as_str()
        .context("missing gear name")?;
    let description = texts[gear["InfoTID"].as_str().context("missing gear InfoTID")?]["EN"]
        .as_str()
        .context("missing gear description")?;
    let substituted =
        re!(r"<c00cc00>([a-zA-Z0-9]+)</c>|NUM").replace_all(description, |c: &regex::Captures| {
            if c.get(1).is_some() { "" } else { "x" }
        });
    let description = substituted
        .replacen("<x>", &js_string(&modifier), 1)
        .replacen("<c00cc00>", "", 1)
        .replacen("</c>", "", 1);
    let available = &gear["ExtraHerosAvailableTo"];
    let ids = if available.is_null() || available == "" || available == false || available == 0 {
        Value::Null
    } else {
        let names = if let Some(names) = available.as_array() {
            names.clone()
        } else {
            vec![available.clone()]
        };
        Value::Array(
            names
                .iter()
                .map(|name| characters[js_string(name)]["id"].clone())
                .collect(),
        )
    };
    let mut data = Map::new();
    data.insert("name".into(), json!(name));
    data.insert("description".into(), json!(description));
    if let Some(rarity) = match gear["Rarity"].as_str() {
        Some("RareGear") => Some("Super Rare"),
        Some("SuperRareGear") => Some("Epic"),
        Some("EpicGear") => Some("Mythic"),
        _ => None,
    } {
        data.insert("rarity".into(), json!(rarity));
    }
    data.insert("modifierType".into(), gear["ModifierType"].clone());
    data.insert("modifierValue".into(), modifier);
    data.insert("brawlersAvaliableTo".into(), ids);
    Ok(Value::Object(data))
}

pub async fn gear_image_url(http: &Http, api: &str, name: &str) -> Result<String> {
    let url = format!(
        "{api}?controller=CuratedContent&method=getImage&title=File:{}Gear.png",
        urlencoding::encode(name)
    );
    let data = http.json(&url).await?;
    let url = data["url"]
        .as_str()
        .context("gear image response missing URL")?;
    // JS: /scale-to-.*?(?=\?)/g, preserving the query and preceding slash.
    Ok(re!(r"scale-to-[^?]*\?").replace_all(url, "?").into_owned())
}

/// /game/{path} returns CSV rows directly. Also accept an envelope for existing URL overrides.
pub async fn game_csv(http: &Http, base: &str, path: &str) -> Result<Value> {
    let url = format!("{}/{}", base.trim_end_matches('/'), path);
    let mut rows = http.json(&url).await?;
    if rows.get("metadata").is_some() && rows.get("data").is_some() {
        rows = rows["data"].take();
    }
    anyhow::ensure!(
        rows.is_object() || rows.is_array(),
        "CSV response from {url} must contain rows"
    );
    Ok(rows)
}

pub async fn scrape_gears(http: &Http, downloader: &Downloader, config: &Config) -> Result<()> {
    eprintln!(
        "[gears] Loading gear, localization, and character CSVs from {}",
        config.game_api
    );
    let (gears, texts, characters, brawlers) = tokio::try_join!(
        game_csv(http, &config.game_api, "csv_logic/gear_boosts"),
        game_csv(http, &config.game_api, "localization/texts"),
        game_csv(http, &config.game_api, "csv_logic/characters"),
        catalog(http, &config.catalog_url),
    )?;
    let common = [
        ("HEALTH", "Health"),
        ("DAMAGE", "Damage"),
        ("SPEED", "Speed"),
        ("SHIELD", "Shield"),
        ("VISION", "Vision"),
        ("GADGET COOLDOWN", "Gadget"),
        ("RELOAD SPEED", "Reload"),
        ("PET POWER", "PetPower"),
        ("SUPER CHARGE", "SuperCharge"),
    ];
    let urls: Vec<_> = stream::iter(common)
        .map(|(key, name)| async move {
            Ok::<_, anyhow::Error>((key, gear_image_url(http, &config.curated_api, name).await?))
        })
        .buffered(config.concurrency)
        .collect::<Vec<_>>()
        .await
        .into_iter()
        .collect::<Result<_>>()?;
    let mut all = Map::new();
    let rows: Vec<&Value> = match &gears {
        Value::Object(rows) => rows.values().collect(),
        Value::Array(rows) => rows.iter().collect(),
        _ => anyhow::bail!("gear CSV response missing rows"),
    };
    for row in rows {
        let mut gear = gear_data(row, &texts, &characters)?;
        let name = gear["name"].as_str().unwrap().to_owned();
        let ids = gear["brawlersAvaliableTo"].as_array();
        let url = if let Some(ids) = ids.filter(|ids| ids.len() == 1) {
            let brawler = brawlers
                .iter()
                .find(|b| ids[0].as_i64() == Some(b.id))
                .context("unknown brawler for gear")?;
            gear_image_url(http, &config.curated_api, &brawler.name).await?
        } else {
            urls.iter()
                .find(|(key, _)| *key == name)
                .with_context(|| format!("unknown gear image for {name}"))?
                .1
                .clone()
        };
        gear["url"] = json!(url);
        all.insert(name, gear);
    }
    // Mutate brawler JSON in source order. The original intentionally resets the array per gear;
    // the final applicable gear wins, even if multiple gears target the same brawler.
    for gear in all.values() {
        if let Some(ids) = gear["brawlersAvaliableTo"].as_array() {
            for id in ids {
                let path = config
                    .out
                    .join("brawlers")
                    .join(id.to_string())
                    .join("data.json");
                // A filtered development run only updates brawlers it generated.
                if !config.brawlers.is_empty() && tokio::fs::metadata(&path).await.is_err() {
                    continue;
                }
                let mut data: Value = serde_json::from_slice(
                    &tokio::fs::read(&path)
                        .await
                        .with_context(|| format!("reading {}", path.display()))?,
                )?;
                data["gears"] = json!([gear]);
                write_data(&data, &path).await?;
            }
        }
    }
    let out = config.out.join("gears");
    eprintln!(
        "[gears] Downloading {} gear images (up to {} at once)",
        all.len(),
        config.asset_concurrency
    );
    let mut downloads = stream::iter(all.values())
        .map(|gear| {
            let dir = out.join(
                gear["name"]
                    .as_str()
                    .unwrap()
                    .replace(['.', ' '], "_")
                    .to_lowercase(),
            );
            async move {
                downloader
                    .download_gear(gear["url"].as_str().unwrap(), &dir.join("icon.webp"))
                    .await?;
                write_data(gear, &dir.join("info.json")).await
            }
        })
        .buffer_unordered(config.asset_concurrency);
    while let Some(result) = downloads.next().await {
        result?;
    }
    eprintln!("[gears] Finished downloading {} gear images", all.len());
    write_data(&Value::Object(all.clone()), &out.join("all-info.json")).await
}
