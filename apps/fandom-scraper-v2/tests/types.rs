use fandom_scraper_v2::output::{self, CdnBrawler, GearCollection};
use flate2::read::GzDecoder;
use std::io::Read;

#[test]
fn generated_cdn_types_are_current() {
    let checked_in = std::fs::read_to_string(output::typescript_path()).unwrap();
    assert_eq!(
        checked_in,
        output::typescript(),
        "Run generate-types to update the CDN package"
    );
}

#[test]
fn live_gear_outputs_match_the_generated_contract() {
    let mut json = String::new();
    GzDecoder::new(include_bytes!("fixtures/api/gear-output.json.gz").as_slice())
        .read_to_string(&mut json)
        .unwrap();
    let gears: GearCollection = serde_json::from_str(&json).unwrap();
    assert_eq!(gears.0.len(), 19);
    for gear in gears.0.values() {
        assert!(!gear.url.is_empty());
    }
}

#[test]
fn gear_enriched_brawler_matches_the_generated_contract() {
    let mut json = String::new();
    GzDecoder::new(include_bytes!("fixtures/api/brawler-gears.json.gz").as_slice())
        .read_to_string(&mut json)
        .unwrap();
    let brawler: CdnBrawler = serde_json::from_str(&json).unwrap();
    let gears = brawler.gears.expect("gear-enriched output fixture");
    assert_eq!(gears.len(), 1);
    assert_eq!(gears[0].name, "SHELL SHOCK");
}
