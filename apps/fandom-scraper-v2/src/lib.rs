// Compile literal regular expressions once, including in hot text parsing paths.
macro_rules! re {
    ($pattern:literal) => {{
        static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        RE.get_or_init(|| {
            // OnceLock initializes this expression once, even inside parsing loops.
            #[allow(clippy::regex_creation_in_loops)]
            let regex = regex::Regex::new($pattern).expect("valid regular expression");
            regex
        })
    }};
}
// Rust implementation of the Fandom scraper and its output pipeline.
pub mod downloader;
pub mod fuzzy_dict;
pub mod http;
pub mod images;
pub mod index;
pub mod output;
pub mod scrape_gears;
pub mod scraper;
pub mod wiki;
