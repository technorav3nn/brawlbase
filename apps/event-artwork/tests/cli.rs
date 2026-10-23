use image::Rgba;
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
};

static DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

struct Fixture {
    directory: PathBuf,
    manifest: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let directory = std::env::temp_dir().join(format!(
            "brawlbase-event-artwork-test-{}-{}",
            std::process::id(),
            DIRECTORY_ID.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        let manifest = directory.join("manifest.json");
        fs::write(&manifest, r#"{"environments":{"fixture":{"banner":"/images/fixture.png","source":"https://example.invalid/events.sc","export":"event_fixture_banner"}}}"#).unwrap();
        Self {
            directory,
            manifest,
        }
    }

    fn command(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_event-artwork"));
        command
            .args([
                "--input",
                concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/minimal.sc"),
                "--manifest",
            ])
            .arg(&self.manifest)
            .arg("--output")
            .arg(&self.directory)
            .args(["--width", "200", "--height", "64"]);
        command
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

#[test]
fn offline_extraction_produces_lossless_png_at_requested_dimensions() {
    let fixture = Fixture::new();
    let result = fixture.command().output().unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let image = image::open(fixture.directory.join("fixture.png"))
        .unwrap()
        .into_rgba8();
    assert_eq!(image.dimensions(), (200, 64));
    assert!(image.pixels().all(|pixel| *pixel == Rgba([255, 0, 0, 255])));
}

#[test]
fn failed_write_preserves_existing_png_and_unowned_temporary_file() {
    let fixture = Fixture::new();
    fs::write(fixture.directory.join("fixture.png"), b"original").unwrap();
    fs::write(fixture.directory.join("fixture.png.tmp"), b"other writer").unwrap();
    let result = fixture.command().output().unwrap();
    assert!(!result.status.success());
    assert_eq!(
        fs::read(fixture.directory.join("fixture.png")).unwrap(),
        b"original"
    );
    assert_eq!(
        fs::read(fixture.directory.join("fixture.png.tmp")).unwrap(),
        b"other writer"
    );
}

#[test]
fn invalid_dimensions_fail_before_network_or_output() {
    let fixture = Fixture::new();
    let result = fixture
        .command()
        .args(["--width", "4294967295"])
        .output()
        .unwrap();
    assert!(!result.status.success());
    assert!(String::from_utf8_lossy(&result.stderr).contains("Output size"));
    assert!(!fixture.directory.join("fixture.png").exists());
}
