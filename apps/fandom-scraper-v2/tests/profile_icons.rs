use fandom_scraper_v2::{
    downloader::{AssetTransform, Downloader},
    http::Http,
    index::{
        Brawler, Config, plan_assets, plan_profile_assets, plan_profile_icon,
        refresh_profile_icons, run,
    },
    scraper::{CatalogItem, parse_brawler},
};
use flate2::read::GzDecoder;
use serde::Deserialize;
use serde_json::{Value, json};
use std::{io::Read, path::Path};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[derive(Deserialize)]
struct Fixture {
    name: String,
    title: String,
    source: String,
    html: String,
    starpowers: Vec<CatalogItem>,
    gadgets: Vec<CatalogItem>,
}

fn load(path: &Path) -> Fixture {
    let mut text = String::new();
    GzDecoder::new(std::fs::File::open(path).unwrap())
        .read_to_string(&mut text)
        .unwrap();
    serde_json::from_str(&text).unwrap()
}

fn parse(f: &Fixture) -> Value {
    parse_brawler(
        &f.name,
        &f.title,
        &f.source,
        &f.html,
        &f.starpowers,
        &f.gadgets,
    )
    .unwrap()
}

fn brawler(name: &str) -> Brawler {
    Brawler {
        id: 16000000,
        name: name.into(),
        star_powers: vec![],
        gadgets: vec![],
    }
}

#[test]
fn every_captured_brawler_has_a_base_icon_and_correct_output_path() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut count = 0;
    for entry in std::fs::read_dir(&root).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|s| s.to_str()) != Some("gz") {
            continue;
        }
        let fixture = load(&path);
        let data = parse(&fixture);
        let brawler = brawler(&fixture.name);
        let jobs = plan_assets(
            &brawler,
            &data,
            Path::new("out"),
            &fixture.starpowers,
            &fixture.gadgets,
        )
        .unwrap_or_else(|e| panic!("{}: {e:#}", fixture.name));
        let icons: Vec<_> = jobs
            .iter()
            .filter(|job| job.path == Path::new("out/brawlers/16000000/icon.webp"))
            .collect();
        assert_eq!(
            icons.len(),
            1,
            "{} must have exactly one base icon job",
            fixture.name
        );
        assert!(matches!(icons[0].transform, AssetTransform::ProfileIcon));
        assert!(!icons[0].url.contains("/scale"));
        assert!(!icons[0].url.contains("/smart"));
        assert_eq!(icons[0].url.matches('?').count(), 1);
        assert!(icons[0].url.contains("format=original"));
        assert!(!icons[0].url.to_lowercase().contains("hypercharge"));
        assert!(!icons[0].url.to_lowercase().contains("prestige"));
        count += 1;
    }
    assert_eq!(count, 108);
}

#[test]
fn attaches_base_rank_hypercharge_and_skin_icons_to_their_skins() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let data = parse(&load(&root.join("shelly.json.gz")));
    let skins = data["skins"].as_array().unwrap();
    let icons = |name: &str| -> Vec<String> {
        skins.iter().find(|skin| skin["name"] == name).unwrap()["profileIcons"]
            .as_array()
            .unwrap()
            .iter()
            .map(|icon| icon["filename"].as_str().unwrap().to_owned())
            .collect()
    };
    assert_eq!(
        icons("Default"),
        [
            "Shelly1-pfp.png",
            "Shelly2-pfp.png",
            "Shelly Hypercharge-pfp.png",
            "Shelly Prestige-pfp.png"
        ]
    );
    assert_eq!(icons("Hoot Hoot"), ["Hoot Hoot Shelly-pfp.png"]);
    assert_eq!(icons("Shelly Dancer"), ["Shelly Dancer-pfp.png"]);
    assert_eq!(icons("Witch"), ["Witch Shelly-pfp.png"]);
    assert_eq!(icons("True Silver"), Vec::<String>::new());
    let pierce = parse(&load(&root.join("pierce.json.gz")));
    let skin = pierce["skins"]
        .as_array()
        .unwrap()
        .iter()
        .find(|skin| skin["name"] == "Pierce Vampire Hunter")
        .unwrap();
    assert_eq!(
        skin["profileIcons"][0]["filename"],
        "Pierce Vampire Hunter-pfp.png"
    );
}

#[test]
fn base_icon_selection_is_independent_of_variant_order() {
    let data = json!({"skins": [{"name": "Default", "profileIcons": [
        {"filename":"Shelly Hypercharge-pfp.png", "sourceUrl":"https://fixture.test/hypercharge"},
        {"filename":"Shelly1-pfp.png", "sourceUrl":"https://fixture.test/base"},
        {"filename":"Shelly2-pfp.png", "sourceUrl":"https://fixture.test/rank"}
    ]}]});
    let job = plan_profile_icon(&brawler("Shelly"), &data, Path::new("out")).unwrap();
    assert_eq!(job.url, "https://fixture.test/base");
    let jobs = plan_profile_assets(&brawler("Shelly"), &data, Path::new("out")).unwrap();
    assert_eq!(jobs.len(), 2);
    assert!(
        jobs.iter()
            .all(|job| job.url == "https://fixture.test/base")
    );
    let no_base = json!({"skins":[{"name":"Default","profileIcons":[
        {"filename":"Shelly Hypercharge-pfp.png","sourceUrl":"https://fixture.test/hypercharge"}
    ]}]});
    assert!(plan_profile_icon(&brawler("Shelly"), &no_base, Path::new("out")).is_err());
}

#[test]
fn refreshing_icons_preserves_existing_brawler_data_and_gears() {
    let mut existing = json!({"stats":{"health":1234},"gears":[{"name":"SHIELD"}],"skins":[
        {"name":"Default","asset":{"filename":"Shelly Skin-Default.png"},"profileIcons":[]},
        {"name":"Old skin","asset":{"filename":"Old.png"},"profileIcons":[{"filename":"old-pfp.png"}]}
    ]});
    let mut expected = existing.clone();
    expected["skins"][0]["profileIcons"] = json!([{"filename":"Shelly1-pfp.png"}]);
    let fresh = json!({"stats":{"health":9999},"skins":[
        {"name":"Default","asset":{"filename":"Shelly Skin-Default.png"},"profileIcons":[{"filename":"Shelly1-pfp.png"}]},
        {"name":"New skin","asset":{"filename":"New.png"},"profileIcons":[]}
    ]});
    refresh_profile_icons(&mut existing, &fresh).unwrap();
    assert_eq!(existing, expected);
}

#[tokio::test]
async fn downloads_the_default_icon_with_the_border_removed() {
    let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/base", server.local_addr().unwrap());
    let input = include_bytes!("fixtures/images/profile-shelly.png");
    let task = tokio::spawn(async move {
        let (mut stream, _) = server.accept().await.unwrap();
        let mut request = [0; 2048];
        let size = stream.read(&mut request).await.unwrap();
        assert!(
            std::str::from_utf8(&request[..size])
                .unwrap()
                .starts_with("GET /base ")
        );
        stream
            .write_all(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    input.len()
                )
                .as_bytes(),
            )
            .await
            .unwrap();
        stream.write_all(input).await.unwrap();
    });
    let dir = std::env::temp_dir().join(format!("fandom-profile-test-{}", std::process::id()));
    let data = json!({"skins":[{"name":"Default","profileIcons":[{"filename":"Shelly1-pfp.png","sourceUrl":url}]}]});
    let job = plan_profile_icon(&brawler("Shelly"), &data, &dir).unwrap();
    let downloader = Downloader::new(Http::new(1).unwrap(), 1).unwrap();
    assert_eq!(downloader.download_all(vec![job]).await, 0);
    task.await.unwrap();
    let output = std::fs::read(dir.join("brawlers/16000000/icon.webp")).unwrap();
    assert_eq!(
        output,
        include_bytes!("fixtures/images/profile-shelly-borderless.webp")
    );
    std::fs::remove_dir_all(&dir).unwrap();
}

#[tokio::test]
async fn icons_only_refresh_updates_existing_output_without_downloading_models() {
    let fixture =
        load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/shelly.json.gz"));
    let mut existing = parse(&fixture);
    for skin in existing["skins"].as_array_mut().unwrap() {
        skin["profileIcons"] = json!([]);
    }
    existing["gears"] = json!([{"name":"preserve this gear"}]);
    let dir = std::env::temp_dir().join(format!(
        "fandom-profile-refresh-test-{}",
        std::process::id()
    ));
    let path = dir.join("brawlers/16000000/data.json");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, serde_json::to_vec(&existing).unwrap()).unwrap();

    let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", server.local_addr().unwrap());
    let html = regex::Regex::new(r#"data-src="[^"]*""#)
        .unwrap()
        .replace_all(&fixture.html, format!("data-src=\"{base}/image\""))
        .to_string();
    let catalog = json!({"list":[{"id":16000000,"name":"Shelly","starPowers":fixture.starpowers,"gadgets":fixture.gadgets}]});
    let page =
        json!({"parse":{"title":fixture.title,"wikitext":{"*":fixture.source},"text":{"*":html}}});
    let task = tokio::spawn(async move {
        loop {
            let (mut stream, _) = server.accept().await.unwrap();
            let mut request = [0; 4096];
            let size = stream.read(&mut request).await.unwrap();
            let request = std::str::from_utf8(&request[..size]).unwrap();
            let path = request.split_whitespace().nth(1).unwrap();
            let body = if path == "/catalog" {
                serde_json::to_vec(&catalog).unwrap()
            } else if path.starts_with("/api.php?") {
                serde_json::to_vec(&page).unwrap()
            } else if path == "/image?format=original" {
                include_bytes!("fixtures/images/profile-shelly.png").to_vec()
            } else {
                panic!("icons-only refresh requested an unrelated resource: {path}");
            };
            stream
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
            stream.write_all(&body).await.unwrap();
        }
    });
    let failures = run(Config {
        out: dir.clone(),
        profile_icons_only: true,
        catalog_url: format!("{base}/catalog"),
        fandom_api: format!("{base}/api.php"),
        game_api: format!("{base}/must-not-fetch-gears"),
        ..Config::default()
    })
    .await
    .unwrap();
    assert_eq!(failures, 0);
    task.abort();
    let mut output: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    assert_eq!(
        output["skins"][0]["profileIcons"].as_array().unwrap().len(),
        4
    );
    for skin in output["skins"].as_array_mut().unwrap() {
        skin["profileIcons"] = json!([]);
    }
    assert_eq!(output, existing);
    assert!(!dir.join("brawlers/16000000/model.webp").exists());
    assert_eq!(
        std::fs::read(dir.join("brawlers/16000000/icon.webp")).unwrap(),
        include_bytes!("fixtures/images/profile-shelly-borderless.webp")
    );
    std::fs::remove_dir_all(&dir).unwrap();
}
