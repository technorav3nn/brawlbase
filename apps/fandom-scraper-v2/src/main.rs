use anyhow::{Context, Result, bail};
use fandom_scraper_v2::{
    images::Vips,
    index::{Config, run},
    scraper::{CatalogItem, parse_brawler, parse_mode},
};
use serde_json::Value;
use std::path::PathBuf;

fn field<'a>(value: &'a Value, key: &str) -> Result<&'a str> {
    value[key]
        .as_str()
        .with_context(|| format!("missing string field {key}"))
}

fn parse_fixture(input: &Value, mode: bool) -> Result<Value> {
    if mode {
        Ok(parse_mode(
            field(input, "name")?,
            field(input, "title")?,
            field(input, "source")?,
        ))
    } else {
        parse_brawler(
            field(input, "name")?,
            field(input, "title")?,
            field(input, "source")?,
            field(input, "html")?,
            &serde_json::from_value::<Vec<CatalogItem>>(input["starpowers"].clone())?,
            &serde_json::from_value::<Vec<CatalogItem>>(input["gadgets"].clone())?,
        )
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let mut config = Config::default();
    let mut strict = false;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "generate-types" => {
                let check = match args.next().as_deref() {
                    None => false,
                    Some("--check") => true,
                    Some(option) => bail!("unknown type generation option {option:?}"),
                };
                anyhow::ensure!(
                    args.next().is_none(),
                    "unexpected type generation arguments"
                );
                let path = fandom_scraper_v2::output::typescript_path();
                let generated = fandom_scraper_v2::output::typescript();
                if check {
                    let existing = std::fs::read_to_string(&path).with_context(|| {
                        format!("reading {}; run generate-types", path.display())
                    })?;
                    anyhow::ensure!(
                        existing == generated,
                        "generated CDN types are stale; run generate-types"
                    );
                    println!("CDN types are up to date: {}", path.display());
                } else {
                    std::fs::create_dir_all(
                        path.parent().context("type output requires a directory")?,
                    )?;
                    std::fs::write(&path, generated)?;
                    println!("Generated CDN types: {}", path.display());
                }
                return Ok(());
            }
            "-h" | "--help" => {
                println!(
                    "fandom-scraper-v2 [--out DIR] [--concurrency N] [--asset-concurrency N]\n                  [--brawler NAME]... [--skip-gears] [--strict]\n\nDefault: scrape every brawler and gear into ./out, matching the old scraper.\n\nType generation:\n  generate-types [--check]\n\nOffline tools:\n  parse-brawler INPUT.json\n  parse-mode INPUT.json\n  bench-parse INPUT.json ROUNDS\n  convert-image INPUT OUTPUT [--remove-white | --gear]\n\nHTTP endpoints can be overridden for testing:\n  --fandom-api URL --catalog-url URL --game-api URL --curated-api URL (legacy alias: --raw-api URL)"
                );
                return Ok(());
            }
            "parse-brawler" | "parse-mode" | "bench-parse" => {
                let path = args.next().context("fixture path required")?;
                let input: Value = serde_json::from_slice(&std::fs::read(path)?)?;
                if arg == "bench-parse" {
                    let rounds: usize = args.next().context("round count required")?.parse()?;
                    anyhow::ensure!(rounds > 0, "round count must be positive");
                    parse_fixture(&input, false)?;
                    let start = std::time::Instant::now();
                    for _ in 0..rounds {
                        std::hint::black_box(parse_fixture(&input, false)?);
                    }
                    println!(
                        "{}",
                        serde_json::json!({"rounds": rounds, "milliseconds": start.elapsed().as_secs_f64()*1000.0})
                    );
                } else {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&parse_fixture(&input, arg == "parse-mode")?)?
                    );
                }
                return Ok(());
            }
            "convert-image" => {
                let input = std::fs::read(args.next().context("input path required")?)?;
                let output = args.next().context("output path required")?;
                let option = args.next();
                let encoded = match option.as_deref() {
                    Some("--gear") => Vips::global()?.gear(&input)?,
                    None => Vips::global()?.asset(&input, false)?,
                    Some("--remove-white") => Vips::global()?.asset(&input, true)?,
                    _ => bail!("unknown image option"),
                };
                std::fs::write(output, encoded)?;
                return Ok(());
            }
            "--skip-gears" => config.skip_gears = true,
            "--strict" => strict = true,
            "--out" => config.out = PathBuf::from(args.next().context("--out requires a path")?),
            "--concurrency" => {
                config.concurrency = args
                    .next()
                    .context("--concurrency requires a number")?
                    .parse()?
            }
            "--asset-concurrency" => {
                config.asset_concurrency = args
                    .next()
                    .context("--asset-concurrency requires a number")?
                    .parse()?
            }
            "--brawler" => config
                .brawlers
                .push(args.next().context("--brawler requires a name")?),
            "--fandom-api" => {
                config.fandom_api = args.next().context("--fandom-api requires a URL")?
            }
            "--catalog-url" => {
                config.catalog_url = args.next().context("--catalog-url requires a URL")?
            }
            "--game-api" | "--raw-api" => {
                config.game_api = args
                    .next()
                    .with_context(|| format!("{arg} requires a URL"))?
            }
            "--curated-api" => {
                config.curated_api = args.next().context("--curated-api requires a URL")?
            }
            _ => bail!("unknown argument {arg:?}; see --help"),
        }
    }
    let failures = run(config).await?;
    if failures > 0 {
        if strict {
            bail!("{failures} assets failed; completed files were preserved. Rerun to retry.");
        }
        eprintln!("{failures} assets failed; completed files were preserved. Rerun to retry.");
    }
    Ok(())
}
