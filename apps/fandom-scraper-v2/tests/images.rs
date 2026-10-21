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
