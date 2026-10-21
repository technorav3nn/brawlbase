//! fast-fuzzy's default Sellers/Damerau matching, including its tie breakers.
use crate::scraper::CatalogItem;
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

fn normalize(value: &str) -> Vec<String> {
    let lower = value.to_lowercase();
    let mut output: Vec<String> = Vec::new();
    for g in lower.graphemes(true) {
        if g.chars().all(char::is_whitespace) {
            if !output.is_empty() && output.last().is_none_or(|s| s != " ") {
                output.push(" ".into());
            }
        } else if !g
            .chars()
            .all(|c| "`~!@#$%^&*()-=_+{}[]|\\;':\",./<>?".contains(c))
        {
            output.push(g.nfc().collect());
        }
    }
    if output.last().is_some_and(|s| s == " ") {
        output.pop();
    }
    output
}

pub fn get_id_from_name<'a>(name: &str, catalog: &'a [CatalogItem]) -> Option<&'a CatalogItem> {
    let term = normalize(name);
    if term.is_empty() {
        return catalog.iter().find(|item| normalize(&item.name).is_empty());
    }
    // A normalized exact match wins every tie breaker and avoids building edit matrices.
    if let Some(item) = catalog.iter().find(|item| normalize(&item.name) == term) {
        return Some(item);
    }
    let mut best: Option<(f64, usize, usize, &CatalogItem)> = None;
    for item in catalog {
        let candidate = normalize(&item.name);
        let mut rows = vec![vec![0; candidate.len() + 1]; term.len() + 1];
        for (i, row) in rows.iter_mut().enumerate().skip(1) {
            row[0] = i;
        }
        for j in 0..candidate.len() {
            for i in 0..term.len() {
                let cost = usize::from(term[i] != candidate[j]);
                let mut v = (rows[i + 1][j] + 1)
                    .min(rows[i][j + 1] + 1)
                    .min(rows[i][j] + cost);
                if i > 0 && j > 0 && term[i] == candidate[j - 1] && term[i - 1] == candidate[j] {
                    v = v.min(rows[i - 1][j - 1] + cost);
                }
                rows[i + 1][j + 1] = v;
            }
        }
        let (end, distance) = rows[term.len()]
            .iter()
            .enumerate()
            .min_by_key(|(_, d)| **d)?;
        let score = 1.0 - *distance as f64 / term.len() as f64;
        if score < 0.6 {
            continue;
        }
        let mut start = end;
        if end > 0 {
            for i in (1..term.len()).rev() {
                if start <= 1 {
                    break;
                }
                if rows[i][start] >= rows[i][start - 1] {
                    start -= 1;
                }
            }
            start -= 1;
        }
        let difference = candidate.len().abs_diff(term.len());
        if best.as_ref().is_none_or(|(s, p, d, _)| {
            score > *s || (score == *s && (start, difference) < (*p, *d))
        }) {
            best = Some((score, start, difference, item));
        }
    }
    best.map(|(_, _, _, item)| item)
}
