use fandom_scraper_v2::{
    http::Http,
    index::catalog,
    scrape_gears::{game_csv, gear_data},
};
use flate2::read::GzDecoder;
use serde_json::Value;
use std::io::Read;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

fn fixture(name: &str) -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/api")
        .join(format!("{name}.json.gz"));
    let mut json = String::new();
    GzDecoder::new(std::fs::File::open(path).unwrap())
        .read_to_string(&mut json)
        .unwrap();
    serde_json::from_str(&json).unwrap()
}

#[tokio::test]
async fn accepts_live_brawlapi_catalog_and_game_csv_contracts() {
    // A captured production response catches envelope/field changes independently of our mocks.
    let responses = [
        ("/v1/brawlers", fixture("catalog")),
        ("/game/csv_logic/gear_boosts", fixture("game-gears")),
        ("/game/localization/texts", fixture("game-texts")),
        ("/game/csv_logic/characters", fixture("game-characters")),
    ];
    let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", server.local_addr().unwrap());
    let task = tokio::spawn(async move {
        for (path, response) in responses {
            let (mut stream, _) = server.accept().await.unwrap();
            let mut request = [0; 2048];
            let size = stream.read(&mut request).await.unwrap();
            assert!(
                std::str::from_utf8(&request[..size])
                    .unwrap()
                    .starts_with(&format!("GET {path} "))
            );
            let body = serde_json::to_vec(&response).unwrap();
            stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).as_bytes()).await.unwrap();
            stream.write_all(&body).await.unwrap();
        }
    });
    let http = Http::new(1).unwrap();
    let brawlers = catalog(&http, &format!("{base}/v1/brawlers"))
        .await
        .unwrap();
    let game = format!("{base}/game/");
    let gears = game_csv(&http, &game, "csv_logic/gear_boosts")
        .await
        .unwrap();
    let texts = game_csv(&http, &game, "localization/texts").await.unwrap();
    let characters = game_csv(&http, &game, "csv_logic/characters")
        .await
        .unwrap();
    task.await.unwrap();
    assert_eq!(brawlers.len(), 109);
    assert_eq!(
        brawlers
            .iter()
            .map(|b| b.gadgets.len() + b.star_powers.len())
            .sum::<usize>(),
        436
    );
    let shelly = brawlers.iter().find(|b| b.id == 16000000).unwrap();
    assert_eq!(shelly.name, "Shelly");
    assert_eq!(shelly.gadgets[0].id, 23000255);
    assert!(brawlers.iter().any(|b| b.name == "Larry & Lawrie"));

    assert_eq!(gears.as_object().unwrap().len(), 19);
    let legacy = fixture("gears");
    let legacy_texts = fixture("texts");
    let legacy_characters = fixture("characters");
    for row in gears.as_object().unwrap().values() {
        let gear = gear_data(row, &texts, &characters).unwrap();
        let key = row["Name"].as_str().unwrap();
        let legacy_gear = gear_data(
            &legacy["data"][key],
            &legacy_texts["data"],
            &legacy_characters["data"],
        )
        .unwrap();
        assert_eq!(
            gear, legacy_gear,
            "game CSV must preserve gear output for {key}"
        );
        assert!(!gear["name"].as_str().unwrap().is_empty());
        assert!(!gear["description"].as_str().unwrap().is_empty());
        if let Some(ids) = gear["brawlersAvaliableTo"].as_array() {
            for id in ids {
                assert!(
                    brawlers.iter().any(|b| Some(b.id) == id.as_i64()),
                    "unresolved gear character: {id}"
                );
            }
        }
    }
    let vision = gear_data(&gears["Vision"], &texts, &characters).unwrap();
    assert_eq!(vision["modifierValue"], 2);
    assert_eq!(vision["brawlersAvaliableTo"], Value::Null);
}
