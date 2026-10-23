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
fn preserves_legacy_data_except_expanded_cosmetics() {
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
        // Keep legacy snapshots intact; expanded cosmetics have dedicated assertions.
        let mut legacy_fields = result.clone();
        for key in ["pins", "sprays", "voicelines", "buffies", "buffieSkins"] {
            legacy_fields.as_object_mut().unwrap().remove(key);
        }
        for (skin, expected) in legacy_fields["skins"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .zip(fixture.expected["skins"].as_array().unwrap())
        {
            for key in ["profileIcons", "pins", "sprays", "voicelines"] {
                skin[key] = expected[key].clone();
            }
        }
        let image_count = |marker: &str| {
            let title = if marker == "Pin-" { "Pins" } else { "Sprays" };
            let start = fixture
                .html
                .find(&format!("id=\"{title}\""))
                .unwrap_or(fixture.html.len());
            let section = &fixture.html[start..];
            let end = section.find("<h").unwrap_or(section.len());
            let html = scraper::Html::parse_fragment(&section[..end]);
            let selector = scraper::Selector::parse("img[data-image-name]").unwrap();
            html.select(&selector)
                .filter_map(|img| img.value().attr("data-image-name"))
                .filter(|name| name.contains(marker))
                .collect::<std::collections::BTreeSet<_>>()
                .len()
        };
        assert_eq!(
            result["pins"].as_array().unwrap().len(),
            image_count("Pin-"),
            "{} pins",
            fixture.name
        );
        assert_eq!(
            result["sprays"].as_array().unwrap().len(),
            image_count("-Spray"),
            "{} sprays",
            fixture.name
        );
        let voice_section = fixture
            .html
            .split("id=\"Voice_Lines\"")
            .nth(1)
            .unwrap_or("");
        let voice_section = voice_section.split("<h2").next().unwrap_or("");
        let html = scraper::Html::parse_fragment(voice_section);
        let audio = scraper::Selector::parse("audio").unwrap();
        assert_eq!(
            result["voicelines"].as_array().unwrap().len(),
            html.select(&audio).count(),
            "{} audio",
            fixture.name
        );
        if fixture.name == "Shelly" {
            assert_eq!(result["buffies"].as_array().unwrap().len(), 5);
            assert_eq!(
                result["buffies"][0]["description"],
                "Take no damage while dashing."
            );
            assert_eq!(
                result["buffies"][1]["description"],
                "Attacks slow enemies. Increases duration with each hit."
            );
            assert!(
                result["buffies"][0]["asset"]["filename"]
                    .as_str()
                    .unwrap()
                    .contains("Buffie-Gadget")
            );
            let brawler = fandom_scraper_v2::index::Brawler {
                id: 16000000,
                name: fixture.name.clone(),
                star_powers: fixture.starpowers.clone(),
                gadgets: fixture.gadgets.clone(),
            };
            let jobs = fandom_scraper_v2::index::plan_assets(
                &brawler,
                &result,
                Path::new("review"),
                &fixture.starpowers,
                &fixture.gadgets,
            )
            .unwrap();
            let audio_jobs: Vec<_> = jobs
                .iter()
                .filter(|job| job.transform == fandom_scraper_v2::downloader::AssetTransform::Raw)
                .collect();
            assert_eq!(
                audio_jobs.len(),
                result["voicelines"].as_array().unwrap().len()
            );
            assert!(
                audio_jobs
                    .iter()
                    .all(|job| job.path.extension().unwrap() == "ogg"
                        && job.path.parent().unwrap().ends_with("voicelines"))
            );
            for directory in ["pins", "sprays", "buffies", "buffie-skins"] {
                assert!(
                    jobs.iter()
                        .any(|job| job.path.parent().unwrap().ends_with(directory))
                );
            }

            assert_eq!(result["buffieSkins"].as_array().unwrap().len(), 4);
            assert!(!result["voicelines"].as_array().unwrap().is_empty());
            assert_eq!(result["voicelines"][0]["trigger"], "Spawning");
            assert_eq!(result["voicelines"][0]["description"], "\"Let's go!\"");
        }
        let mut differences = Vec::new();
        compare(
            &legacy_fields,
            &fixture.expected,
            &fixture.name,
            &mut differences,
        );
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
