use fandom_scraper_v2::scraper::{CatalogItem, parse_brawler};
use flate2::read::GzDecoder;
use serde::Deserialize;
use serde_json::Value;
use std::{io::Read, path::Path};

#[derive(Deserialize)]
struct Fixture {
    name: String,
    title: String,
    source: String,
    html: String,
    starpowers: Vec<CatalogItem>,
    gadgets: Vec<CatalogItem>,
    expected: Value,
}

fn compare(actual: &Value, expected: &Value, path: &str, differences: &mut Vec<String>) {
    if actual == expected {
        return;
    }
    match (actual, expected) {
        (Value::Object(a), Value::Object(e)) => {
            for (key, value) in e {
                if let Some(actual) = a.get(key) {
                    compare(actual, value, &format!("{path}/{key}"), differences);
                } else {
                    differences.push(format!("{path}/{key}: missing field"));
                }
            }
            for key in a.keys().filter(|k| !e.contains_key(*k)) {
                differences.push(format!("{path}/{key}: unexpected field"));
            }
        }
        (Value::Array(a), Value::Array(e)) => {
            if a.len() != e.len() {
                differences.push(format!("{path}: lengths {} != {}", a.len(), e.len()));
            }
            for (index, (a, e)) in a.iter().zip(e).enumerate() {
                compare(a, e, &format!("{path}/{index}"), differences);
            }
        }
        _ => differences.push(format!("{path}: {actual} != {expected}")),
    }
}

#[test]
fn matches_unchanged_typescript_scraper() {
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut count = 0;
    for entry in std::fs::read_dir(directory).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|s| s.to_str()) != Some("gz") {
            continue;
        }
        let mut text = String::new();
        GzDecoder::new(std::fs::File::open(&path).unwrap())
            .read_to_string(&mut text)
            .unwrap();
        let fixture: Fixture = serde_json::from_str(&text).unwrap();
        let result = parse_brawler(
            &fixture.name,
            &fixture.title,
            &fixture.source,
            &fixture.html,
            &fixture.starpowers,
            &fixture.gadgets,
        )
        .unwrap();
        let mut differences = Vec::new();
        compare(&result, &fixture.expected, &fixture.name, &mut differences);
        assert!(differences.is_empty(), "{}", differences.join("\n"));
        serde_json::from_value::<fandom_scraper_v2::output::CdnBrawler>(result).unwrap_or_else(
            |error| panic!("{} violates generated CDN types: {error}", fixture.name),
        );
        count += 1;
    }
    assert!(
        count >= 108,
        "the full compatibility corpus must be present"
    );
}
