use crate::{
    downloader::{AssetJob, AssetTransform, Downloader, write_data},
    fuzzy_dict::get_id_from_name,
    http::Http,
    scrape_gears,
    scraper::{CatalogItem, FandomScraper, is_base_profile_icon},
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
    pub profile_icons_only: bool,
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
            profile_icons_only: false,
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

fn asset_job(asset: &Value, path: PathBuf, transform: AssetTransform) -> Result<AssetJob> {
    Ok(AssetJob {
        url: asset["sourceUrl"]
            .as_str()
            .context("asset missing sourceUrl")?
            .into(),
        path,
        transform,
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
    let mut jobs = vec![asset_job(
        &data["model"],
        dir.join("model.webp"),
        AssetTransform::Standard,
    )?];
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
                AssetTransform::RemoveWhite,
            )?);
        }
    }
    if let Some(hypercharge) = data.get("hypercharge") {
        jobs.push(asset_job(
            &hypercharge["asset"],
            out.join("hypercharges")
                .join(format!("{}.webp", brawler.id)),
            AssetTransform::Standard,
        )?);
    }
    for skin in data["skins"].as_array().context("missing skins array")? {
        let skin_name = skin["name"].as_str().context("missing skin name")?;
        // Wiki names are used verbatim as directory names by the old downloader.
        let skin_dir = dir.join("skins").join(skin_name);
        jobs.push(asset_job(
            &skin["asset"],
            skin_dir.join("model.webp"),
            AssetTransform::Standard,
        )?);
    }
    for (key, directory, transform) in [
        ("pins", "pins", AssetTransform::Standard),
        ("buffies", "buffies", AssetTransform::Standard),
        ("sprays", "sprays", AssetTransform::Standard),
        ("buffieSkins", "buffie-skins", AssetTransform::Standard),
        ("voicelines", "voicelines", AssetTransform::Raw),
    ] {
        for item in data[key].as_array().into_iter().flatten() {
            let Some(asset) = item.get("asset") else {
                continue;
            };
            let filename = asset["filename"]
                .as_str()
                .context("missing asset filename")?;
            ensure!(
                !filename.contains(['/', '\\']) && filename != "..",
                "unsafe asset filename"
            );
            let filename = if transform == AssetTransform::Raw {
                filename.to_owned()
            } else {
                format!(
                    "{}.webp",
                    filename.rsplit_once('.').map_or(filename, |(stem, _)| stem)
                )
            };
            jobs.push(asset_job(
                asset,
                dir.join(directory).join(filename),
                transform,
            )?);
        }
    }
    jobs.extend(plan_profile_assets(brawler, data, out)?);
    if let Some(avatar) = data.get("avatar") {
        jobs.push(asset_job(
            avatar,
            dir.join("portrait.webp"),
            AssetTransform::Standard,
        )?);
    }
    Ok(jobs)
}

/// Select by file identity so rank and Hypercharge variants cannot replace icon.webp.
pub fn plan_profile_icon(brawler: &Brawler, data: &Value, out: &Path) -> Result<AssetJob> {
    let icon = data["skins"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|skin| skin["name"] == "Default")
        .filter_map(|skin| skin["profileIcons"].as_array())
        .flatten()
        .find(|asset| {
            asset["filename"]
                .as_str()
                .is_some_and(|filename| is_base_profile_icon(filename, &brawler.name))
        })
        .with_context(|| format!("missing default profile icon for {}", brawler.name))?;
    asset_job(
        icon,
        out.join("brawlers")
            .join(brawler.id.to_string())
            .join("icon.webp"),
        AssetTransform::ProfileIcon,
    )
}

pub fn plan_profile_assets(brawler: &Brawler, data: &Value, out: &Path) -> Result<Vec<AssetJob>> {
    let mut jobs = vec![plan_profile_icon(brawler, data, out)?];
    let dir = out.join("brawlers").join(brawler.id.to_string());
    for skin in data["skins"].as_array().context("missing skins array")? {
        let name = skin["name"].as_str().context("missing skin name")?;
        for icon in skin["profileIcons"]
            .as_array()
            .context("missing profile icons")?
        {
            // Keep the default skin's image consistent with the brawler icon.
            if name == "Default"
                && !icon["filename"]
                    .as_str()
                    .is_some_and(|file| is_base_profile_icon(file, &brawler.name))
            {
                continue;
            }
            jobs.push(asset_job(
                icon,
                dir.join("skins").join(name).join("profile-icon.webp"),
                AssetTransform::ProfileIcon,
            )?);
        }
    }
    Ok(jobs)
}

/// Refresh only icon metadata; keep existing stats, gear enrichment, and skins.
pub fn refresh_profile_icons(existing: &mut Value, fresh: &Value) -> Result<()> {
    let fresh_skins = fresh["skins"].as_array().context("missing fresh skins")?;
    for skin in existing["skins"]
        .as_array_mut()
        .context("missing existing skins")?
    {
        if let Some(updated) = fresh_skins.iter().find(|updated| {
            updated["name"] == skin["name"]
                && updated["asset"]["filename"] == skin["asset"]["filename"]
        }) {
            skin["profileIcons"] = updated["profileIcons"].clone();
        }
    }
    Ok(())
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
        let Some(mut data) = data else {
            eprintln!("Brawler page not found for {}, skipping...", brawler.name);
            continue;
        };
        let path = config
            .out
            .join("brawlers")
            .join(brawler.id.to_string())
            .join("data.json");
        if config.profile_icons_only {
            let mut existing =
                serde_json::from_slice(&tokio::fs::read(&path).await.with_context(|| {
                    format!("reading {}; run a full scrape first", path.display())
                })?)?;
            refresh_profile_icons(&mut existing, &data)?;
            data = existing;
            jobs.extend(plan_profile_assets(brawler, &data, &config.out)?);
        } else {
            jobs.extend(plan_assets(
                brawler,
                &data,
                &config.out,
                &starpowers,
                &gadgets,
            )?);
        }
        write_data(&data, &path).await?;
    }
    let failures = downloader.download_all(jobs).await;
    if !config.skip_gears && !config.profile_icons_only {
        scrape_gears::scrape_gears(&http, &downloader, &config).await?;
    }
    Ok(failures)
}
