mod binary;
mod render;
mod sc;

use crate::{
    render::Renderer,
    sc::{MAX_INPUT_BYTES, Scene},
};
use anyhow::{Context, Result, bail, ensure};
use image::{
    ImageEncoder,
    codecs::png::{CompressionType, FilterType, PngEncoder},
};
use serde::Deserialize;
use std::{
    collections::BTreeSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};

#[derive(Deserialize)]
struct Manifest {
    environments: serde_json::Map<String, serde_json::Value>,
}
#[derive(Deserialize)]
struct Artwork {
    banner: String,
    source: String,
    export: String,
}
struct Options {
    input: Option<PathBuf>,
    output: PathBuf,
    manifest: PathBuf,
    width: u32,
    height: u32,
    list: bool,
    exports: BTreeSet<String>,
}

fn options() -> Result<Option<Options>> {
    let mut options = Options {
        input: None,
        output: PathBuf::from("out"),
        manifest: Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../web/shared/data/event-artwork.json"),
        width: 1600,
        height: 512,
        list: false,
        exports: BTreeSet::new(),
    };
    let mut arguments = std::env::args().skip(1);
    while let Some(argument) = arguments.next() {
        if argument == "--help" || argument == "-h" {
            println!(
                "Extract high-resolution SC v5 event banners into lossless PNGs.\n\nUsage: event-artwork [options]\n\n  --input PATH       Read a local SC file (offline); otherwise download the pinned manifest source\n  --output DIR       Output directory (default: out)\n  --manifest PATH    Web event artwork manifest\n  --export NAME      Select a manifest export; repeat to select several\n  --width PIXELS     Output width (default: 1600)\n  --height PIXELS    Output height (default: 512)\n  --list             List named exports without rendering\n\nThe viewport is 200 × 64 game units. Dimensions must retain its 25:8 aspect ratio."
            );
            return Ok(None);
        }
        if argument == "--list" {
            options.list = true;
            continue;
        }
        let value = arguments
            .next()
            .with_context(|| format!("Missing value for {argument}"))?;
        match argument.as_str() {
            "--input" => options.input = Some(value.into()),
            "--output" => options.output = value.into(),
            "--manifest" => options.manifest = value.into(),
            "--export" => {
                options.exports.insert(value);
            }
            "--width" => options.width = value.parse().context("Invalid width")?,
            "--height" => options.height = value.parse().context("Invalid height")?,
            _ => bail!("Unknown option {argument}; use --help"),
        }
    }
    ensure!(
        (64..=4096).contains(&options.width) && (32..=2048).contains(&options.height),
        "Output size must be 64..4096 by 32..2048"
    );
    ensure!(
        options.width * 8 == options.height * 25,
        "Use the 25:8 aspect ratio, e.g. 1600 × 512 or 2400 × 768"
    );
    Ok(Some(options))
}

fn read_limited(reader: impl Read) -> Result<Vec<u8>> {
    let mut output = Vec::new();
    reader
        .take(MAX_INPUT_BYTES as u64 + 1)
        .read_to_end(&mut output)?;
    ensure!(output.len() <= MAX_INPUT_BYTES, "Input exceeds 128 MiB");
    Ok(output)
}

fn write_png(path: &Path, image: &image::RgbaImage) -> Result<()> {
    let temporary = path.with_extension("png.tmp");
    let file = fs::File::create_new(&temporary).with_context(|| {
        format!(
            "Creating {}; remove a stale temporary file if needed",
            temporary.display()
        )
    })?;
    let result = (|| {
        PngEncoder::new_with_quality(&file, CompressionType::Best, FilterType::Adaptive)
            .write_image(
                image.as_raw(),
                image.width(),
                image.height(),
                image::ExtendedColorType::Rgba8,
            )?;
        file.sync_all()?;
        fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn run() -> Result<()> {
    let Some(options) = options()? else {
        return Ok(());
    };
    let manifest: Manifest = serde_json::from_slice(
        &fs::read(&options.manifest)
            .with_context(|| format!("Reading {}", options.manifest.display()))?,
    )?;
    let artwork = manifest
        .environments
        .into_values()
        .filter(|value| value.get("export").is_some())
        .map(serde_json::from_value::<Artwork>)
        .collect::<std::result::Result<Vec<_>, _>>()?;
    ensure!(!artwork.is_empty(), "Manifest has no SC exports");
    for export in &options.exports {
        ensure!(
            artwork.iter().any(|entry| &entry.export == export),
            "Export {export} is not configured in the manifest"
        );
    }
    let sources = artwork
        .iter()
        .map(|entry| entry.source.as_str())
        .collect::<BTreeSet<_>>();
    ensure!(
        sources.len() == 1,
        "Use a manifest with one pinned SC source per extraction run"
    );
    let source = *sources.first().context("Missing SC source")?;
    let raw = if let Some(input) = &options.input {
        read_limited(
            fs::File::open(input).with_context(|| format!("Opening {}", input.display()))?,
        )?
    } else {
        ensure!(
            source.starts_with("https://"),
            "Only HTTPS sources are supported"
        );
        eprintln!("Downloading {source}");
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(120))
            .build()?;
        read_limited(client.get(source).send()?.error_for_status()?)?
    };
    let scene = Scene::parse(&raw)?;
    for (index, texture) in scene.textures.iter().enumerate() {
        eprintln!(
            "Native high-resolution texture {index}: {} × {}",
            texture.width(),
            texture.height()
        );
    }
    if options.list {
        for name in scene.exports.keys() {
            println!("{name}");
        }
        return Ok(());
    }
    fs::create_dir_all(&options.output)?;
    for entry in artwork {
        if !options.exports.is_empty() && !options.exports.contains(&entry.export) {
            continue;
        }
        let filename = Path::new(&entry.banner)
            .file_name()
            .context("Invalid banner path")?;
        ensure!(
            Path::new(filename)
                .extension()
                .is_some_and(|extension| extension == "png"),
            "Banner must be a PNG path"
        );
        let path = options.output.join(filename);
        let image = Renderer::render(&scene, &entry.export, options.width, options.height)?;
        write_png(&path, &image)?;
        println!(
            "{} → {} ({} × {})",
            entry.export,
            path.display(),
            image.width(),
            image.height()
        );
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Error: {error:#}");
        std::process::exit(1);
    }
}
