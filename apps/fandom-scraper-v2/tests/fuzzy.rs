use fandom_scraper_v2::{fuzzy_dict::get_id_from_name, scraper::CatalogItem};
use serde::Deserialize;

#[derive(Deserialize)]
struct Case {
    query: String,
    catalog: Vec<CatalogItem>,
    expected: Option<i64>,
}

#[test]
fn matches_fast_fuzzy_scoring_threshold_and_ties() {
    let cases: Vec<Case> = serde_json::from_str(include_str!("fixtures/fuzzy.json")).unwrap();
    let mut differences = Vec::new();
    for case in cases {
        let actual = get_id_from_name(&case.query, &case.catalog).map(|v| v.id);
        if actual != case.expected {
            differences.push(format!(
                "{:?}: {actual:?} != {:?}",
                case.query, case.expected
            ));
        }
    }
    assert!(differences.is_empty(), "{}", differences.join("\n"));
}
