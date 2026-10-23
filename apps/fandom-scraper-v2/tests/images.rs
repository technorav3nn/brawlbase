use fandom_scraper_v2::images::Vips;
use std::path::Path;

#[test]
fn matches_sharp_trim_transparency_resize_and_encoding() {
    let api = Vips::global().expect("image parity tests require libvips (see README)");
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/images");
    for name in ["rgb3", "rgb4", "gadget"] {
        let input = std::fs::read(directory.join(format!("{name}.png"))).unwrap();
        for mode in ["asset", "remove-white", "gear"] {
            let expected = std::fs::read(directory.join(format!("{name}-{mode}.webp"))).unwrap();
            let actual = match mode {
                "gear" => api.gear(&input),
                "remove-white" => api.asset(&input, true),
                _ => api.asset(&input, false),
            }
            .unwrap();
            assert_eq!(
                actual.len(),
                expected.len(),
                "{name}/{mode}: encoded length differs"
            );
            assert!(
                actual == expected,
                "{name}/{mode}: WebP differs from the old Sharp downloader"
            );
        }
    }
}

#[test]
fn removes_real_profile_frames_without_changing_the_artwork() {
    let api = Vips::global().expect("profile icon tests require libvips");
    let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/images");
    // Sharp reference crops: Shelly 313² -> 263×268, Crow 960² -> 812×817,
    // 8-Bit 200² -> 172². These cover a noisy frame and dark character details.
    for name in ["shelly", "crow", "8-bit"] {
        let input = std::fs::read(directory.join(format!("profile-{name}.png"))).unwrap();
        assert!(
            input.starts_with(b"\x89PNG\r\n\x1a\n"),
            "reference input must be the original PNG"
        );
        let expected =
            std::fs::read(directory.join(format!("profile-{name}-borderless.webp"))).unwrap();
        let output = api.profile_icon(&input).unwrap();
        assert_eq!(
            output, expected,
            "{name}: borderless image differs from the reference crop"
        );
        assert!(
            output.windows(4).any(|chunk| chunk == b"VP8L"),
            "profile icons must use lossless WebP"
        );
    }
}
