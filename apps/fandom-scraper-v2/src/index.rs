use crate::{
    downloader::{AssetJob, Downloader, write_data},
    fuzzy_dict::get_id_from_name,
    http::Http,
    scrape_gears,
    scraper::{CatalogItem, FandomScraper},
};
use anyhow::{Context, Result, ensure};
use futures::{StreamExt, stream};
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Config {
    pub out: PathBuf,
    pub concurrency: usize,
    pub asset_concurrency: usize,
    pub brawlers: Vec<String>,
    pub skip_gears: bool,
    pub fandom_api: String,
    pub catalog_url: String,
    pub game_api: String,
    pub curated_api: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            out: PathBuf::from("./out"),
            concurrency: 4,
            asset_concurrency: 12,
            brawlers: Vec::new(),
            skip_gears: false,
            fandom_api: "https://brawlstars.fandom.com/api.php".into(),
            catalog_url: "https://api.brawlapi.com/v1/brawlers".into(),
            game_api: "https://api.brawlapi.com/game".into(),
            curated_api: "https://brawlstars.fandom.com/wikia.php".into(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Brawler {
    pub id: i64,
    pub name: String,
    pub star_powers: Vec<CatalogItem>,
    pub gadgets: Vec<CatalogItem>,
}

pub fn ordered_brawlers(mut list: Vec<Brawler>) -> Vec<Brawler> {
    list.retain(|b| b.name != "Buzz Lightyear");
    list.sort_by_key(|b| b.name != "Larry & Lawrie");
    list
}

pub async fn catalog(http: &Http, url: &str) -> Result<Vec<Brawler>> {
    let value = http.json(url).await?;
    serde_json::from_value(value.get("list").context("catalog missing list")?.clone())
        .context("invalid brawler catalog")
}

fn asset_job(asset: &Value, path: PathBuf, remove_white: bool) -> Result<AssetJob> {
    Ok(AssetJob {
        url: asset["sourceUrl"]
            .as_str()
            .context("asset missing sourceUrl")?
            .into(),
        path,
        remove_white,
    })
}

pub fn plan_assets(
    brawler: &Brawler,
    data: &Value,
    out: &Path,
    starpowers: &[CatalogItem],
    gadgets: &[CatalogItem],
) -> Result<Vec<AssetJob>> {
    let dir = out.join("brawlers").join(brawler.id.to_string());
    let mut jobs = vec![asset_job(&data["model"], dir.join("model.webp"), false)?];
    for (key, catalog, directory) in [
        ("gadgets", gadgets, "gadgets"),
        ("starpowers", starpowers, "star-powers"),
    ] {
        for item in data[key].as_array().context("missing accessory array")? {
            let name = item["name"].as_str().context("missing accessory name")?;
            let id = if key == "gadgets" && brawler.name == "Lumi" && name == "Internal Flames" {
                23000907
            } else {
                get_id_from_name(name, catalog)
                    .with_context(|| format!("no ID for {name}"))?
                    .id
            };
            jobs.push(asset_job(
                &item["asset"],
                out.join(directory).join(format!("{id}.webp")),
                true,
            )?);
        }
    }
    if let Some(hypercharge) = data.get("hypercharge") {
        jobs.push(asset_job(
            &hypercharge["asset"],
            out.join("hypercharges")
                .join(format!("{}.webp", brawler.id)),
            false,
        )?);
    }
    for skin in data["skins"].as_array().context("missing skins array")? {
        let skin_name = skin["name"].as_str().context("missing skin name")?;
        // Wiki names are used verbatim as directory names by the old downloader.
        let skin_dir = dir.join("skins").join(skin_name);
        jobs.push(asset_job(
            &skin["asset"],
            skin_dir.join("model.webp"),
            false,
        )?);
        for icon in skin["profileIcons"]
            .as_array()
            .context("missing profile icons")?
        {
            jobs.push(asset_job(icon, skin_dir.join("profile-icon.webp"), false)?);
        }
    }
    if let Some(avatar) = data.get("avatar") {
        jobs.push(asset_job(avatar, dir.join("portrait.webp"), false)?);
    }
    Ok(jobs)
}

/// Returns the count of asset failures. Data/API failures abort with context; asset failures continue.
pub async fn run(config: Config) -> Result<usize> {
    ensure!(
        config.concurrency > 0 && config.asset_concurrency > 0,
        "concurrency must be positive"
    );
    let http = Http::new(config.asset_concurrency.max(config.concurrency))?;
    let downloader = Downloader::new(http.clone(), config.asset_concurrency)?;
    for directory in ["", "brawlers", "hypercharges", "star-powers", "gadgets"] {
        tokio::fs::create_dir_all(config.out.join(directory)).await?;
    }
    let list = ordered_brawlers(catalog(&http, &config.catalog_url).await?);
    let starpowers: Vec<_> = list.iter().flat_map(|b| b.star_powers.clone()).collect();
    let gadgets: Vec<_> = list.iter().flat_map(|b| b.gadgets.clone()).collect();
    let selected: Vec<_> = list
        .iter()
        .filter(|b| config.brawlers.is_empty() || config.brawlers.contains(&b.name))
        .collect();
    ensure!(
        !selected.is_empty(),
        "no brawlers matched the requested names"
    );
    let scraper = FandomScraper::new(http.clone(), config.fandom_api.clone());
    let mut results = stream::iter(selected)
        .map(|brawler| {
            let (scraper, starpowers, gadgets) = (&scraper, &starpowers, &gadgets);
            async move {
                eprintln!("[brawler] Fetching data for {}", brawler.name);
                let data = scraper
                    .get_brawler_data(&brawler.name, starpowers, gadgets)
                    .await
                    .with_context(|| format!("scraping {}", brawler.name))?;
                Ok::<_, anyhow::Error>((brawler, data))
            }
        })
        .buffered(config.concurrency);
    let mut jobs = Vec::new();
    while let Some(result) = results.next().await {
        let (brawler, data) = result?;
        let Some(data) = data else {
            eprintln!("Brawler page not found for {}, skipping...", brawler.name);
            continue;
        };
        jobs.extend(plan_assets(
            brawler,
            &data,
            &config.out,
            &starpowers,
            &gadgets,
        )?);
        write_data(
            &data,
            &config
                .out
                .join("brawlers")
                .join(brawler.id.to_string())
                .join("data.json"),
        )
        .await?;
    }
    let failures = downloader.download_all(jobs).await;
    if !config.skip_gears {
        scrape_gears::scrape_gears(&http, &downloader, &config).await?;
    }
    Ok(failures)
}
