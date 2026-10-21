use fandom_scraper_v2::scraper::parse_mode;
use serde_json::Value;

#[test]
fn matches_typescript_mode_data() {
    let mut count = 0;
    for entry in
        std::fs::read_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/modes")).unwrap()
    {
        let fixture: Value =
            serde_json::from_slice(&std::fs::read(entry.unwrap().path()).unwrap()).unwrap();
        let actual = parse_mode(
            fixture["name"].as_str().unwrap(),
            fixture["title"].as_str().unwrap(),
            fixture["source"].as_str().unwrap(),
        );
        assert_eq!(actual, fixture["expected"], "{}", fixture["name"]);
        serde_json::from_value::<fandom_scraper_v2::output::CdnMode>(actual).unwrap();
        count += 1;
    }
    assert!(count > 0);
}
