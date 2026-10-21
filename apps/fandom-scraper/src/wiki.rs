use regex::Regex;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct Section {
    pub title: String,
    pub level: usize,
    pub body: String,
    pub children: Vec<Section>,
}

#[derive(Debug)]
pub struct Page {
    pub intro: String,
    pub sections: Vec<Section>,
}

impl Page {
    pub fn parse(source: &str) -> Self {
        let headings = Regex::new(r"(?m)^(={2,6})([^\n]+?)={2,6}\s*$").unwrap();
        let matches: Vec<_> = headings.captures_iter(source).collect();
        let intro = source[..matches.first().map_or(source.len(), |m| m.get(0).unwrap().start())].to_owned();
        let mut flat = Vec::new();
        for (index, captures) in matches.iter().enumerate() {
            let full = captures.get(0).unwrap();
            let end = matches.get(index + 1).map_or(source.len(), |m| m.get(0).unwrap().start());
            flat.push(Section {
                title: captures[2].trim().to_owned(),
                level: captures[1].len(),
                body: source[full.end()..end].trim_start_matches('\n').to_owned(),
                children: Vec::new(),
            });
        }
        // The body of a section stops at its next heading; descendants are represented separately.
        for index in 0..flat.len() {
            if let Some(next) = matches.get(index + 1) {
                let start = matches[index].get(0).unwrap().end();
                flat[index].body = source[start..next.get(0).unwrap().start()].trim_matches('\n').to_owned();
            }
        }
        let mut stack: Vec<Section> = Vec::new();
        let mut sections = Vec::new();
        for section in flat {
            while stack.last().is_some_and(|parent| parent.level >= section.level) {
                let finished = stack.pop().unwrap();
                if let Some(parent) = stack.last_mut() {
                    parent.children.push(finished);
                } else {
                    sections.push(finished);
                }
            }
            stack.push(section);
        }
        while let Some(finished) = stack.pop() {
            if let Some(parent) = stack.last_mut() {
                parent.children.push(finished);
            } else {
                sections.push(finished);
            }
        }
        Self { intro, sections }
    }

    pub fn section(&self, title: &str) -> Option<&Section> {
        fn walk<'a>(sections: &'a [Section], title: &str) -> Option<&'a Section> {
            for section in sections {
                if section.title == title {
                    return Some(section);
                }
                if let Some(found) = walk(&section.children, title) {
                    return Some(found);
                }
            }
            None
        }
        walk(&self.sections, title)
    }

    pub fn section_or_children(&self, prefix: &str) -> Vec<&Section> {
        self.sections
            .iter()
            .find(|s| s.title.starts_with(prefix))
            .map_or_else(Vec::new, |s| {
                if s.children.is_empty() { vec![s] } else { s.children.iter().collect() }
            })
    }
}

pub fn template(source: &str, name: &str) -> Option<String> {
    templates(source, name).into_iter().next()
}

pub fn templates(source: &str, name: &str) -> Vec<String> {
    let mut results = Vec::new();
    let needle = format!("{{{{{}", name.to_ascii_lowercase());
    let lowercase = source.to_ascii_lowercase();
    let mut offset = 0;
    while let Some(found) = lowercase[offset..].find(&needle) {
        let start = offset + found;
        if let Some((content, end)) = template_at(source, start) {
            results.push(content);
            offset = end;
        } else { break; }
    }
    results
}

fn template_at(source: &str, start: usize) -> Option<(String, usize)> {
    let bytes = source.as_bytes();
    let mut depth = 0;
    let mut position = start;
    while position + 1 < bytes.len() {
        match &bytes[position..position + 2] {
            b"{{" => { depth += 1; position += 2; }
            b"}}" => {
                depth -= 1;
                position += 2;
                if depth == 0 { return Some((source[start + 2..position - 2].to_owned(), position)); }
            }
            _ => position += 1,
        }
    }
    None
}

pub fn split_template(source: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut start = 0;
    let mut braces = 0;
    let mut links = 0;
    let bytes = source.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if index + 1 < bytes.len() && &bytes[index..index + 2] == b"{{" {
            braces += 1;
            index += 2;
        } else if index + 1 < bytes.len() && &bytes[index..index + 2] == b"}}" {
            braces -= 1;
            index += 2;
        } else if index + 1 < bytes.len() && &bytes[index..index + 2] == b"[[" {
            links += 1;
            index += 2;
        } else if index + 1 < bytes.len() && &bytes[index..index + 2] == b"]]" {
            links -= 1;
            index += 2;
        } else {
            if bytes[index] == b'|' && braces == 0 && links == 0 {
                parts.push(source[start..index].trim().to_owned());
                start = index + 1;
            }
            index += 1;
        }
    }
    parts.push(source[start..].trim().to_owned());
    parts
}

pub fn template_fields(source: &str, name: &str) -> Option<Vec<(String, String)>> {
    let content = template(source, name)?;
    Some(fields_from_template(&content))
}

pub fn fields_from_template(content: &str) -> Vec<(String, String)> {
    let mut fields = Vec::new();
    for part in split_template(&content).into_iter().skip(1) {
        if let Some((key, value)) = part.split_once('=') {
            fields.push((key.trim().to_ascii_lowercase(), clean(value)));
        }
    }
    fields
}

pub fn first_quote(source: &str) -> Option<String> {
    let quote = template(source, "Quote")?;
    let content = split_template(&quote).get(1)?.to_owned();
    Some(clean(&content))
}

pub fn clean(source: &str) -> String {
    let mut text = source.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n");
    let comment = Regex::new(r"(?s)<!--.*?-->").unwrap();
    text = comment.replace_all(&text, "").into_owned();
    let link = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    text = link.replace_all(&text, |captures: &regex::Captures| {
        let parts: Vec<_> = captures[1].split('|').collect();
        parts.last().unwrap_or(&"").to_string()
    }).into_owned();
    let external = Regex::new(r"\[https?://[^\s\]]+\s+([^\]]+)\]").unwrap();
    text = external.replace_all(&text, "$1").into_owned();
    let template = Regex::new(r"\{\{([^{}]*)\}\}").unwrap();
    for _ in 0..8 {
        let replaced = template.replace_all(&text, |captures: &regex::Captures| {
            let parts = split_template(&captures[1]);
            match parts.first().map(|part| part.to_ascii_lowercase()).as_deref() {
                Some("rarity" | "translate" | "color" | "nowrap") => parts.get(1).cloned().unwrap_or_default(),
                Some("quote") => parts.get(1).cloned().unwrap_or_default(),
                _ => String::new(),
            }
        }).into_owned();
        if replaced == text { break; }
        text = replaced;
    }
    let tags = Regex::new(r"<[^>]+>").unwrap();
    text = tags.replace_all(&text, "").into_owned();
    text.replace("'''", "").replace("''", "").replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", "\"").trim().to_owned()
}

pub fn list_lines(source: &str) -> Vec<String> {
    source.lines().filter_map(|line| {
        let line = line.trim();
        let content = line.trim_start_matches(['*', '#']);
        if content.len() == line.len() { None } else { Some(clean(content)) }
    }).collect()
}

pub fn skin_entries(source: &str) -> Vec<HashMap<String, Vec<String>>> {
    let Some(fields) = template_fields(source, "Skin Gallery") else { return Vec::new(); };
    let numbered = Regex::new(r"^([a-z]+?)(p+)(\d+)(?:_(\d+))?$").unwrap();
    let ordinary = Regex::new(r"^([a-z]+?)(\d+)(?:_(\d+))?$").unwrap();
    let mut order = Vec::<String>::new();
    let mut entries = HashMap::<String, HashMap<String, Vec<String>>>::new();
    for (key, value) in fields {
        let (field, group, index, subindex) = if let Some(c) = numbered.captures(&key) {
            (c[1].to_owned(), c[2].to_owned(), c[3].to_owned(), c.get(4).map(|m| m.as_str().parse::<usize>().unwrap_or(1)).unwrap_or(1))
        } else if let Some(c) = ordinary.captures(&key) {
            (c[1].to_owned(), String::new(), c[2].to_owned(), c.get(3).map(|m| m.as_str().parse::<usize>().unwrap_or(1)).unwrap_or(1))
        } else { continue; };
        let identity = format!("{group}:{index}");
        if !entries.contains_key(&identity) { order.push(identity.clone()); }
        let values = entries.entry(identity).or_default().entry(field).or_default();
        if values.len() < subindex { values.resize(subindex, String::new()); }
        values[subindex - 1] = value;
    }
    order.into_iter().filter_map(|key| entries.remove(&key)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_sections_and_templates() {
        let page = Page::parse("Intro\n==Tips==\n===Other===\n* [[Shelly|Shelly]] wins.\n==History==\n*01/01/20:");
        assert_eq!(page.section("Tips").unwrap().children[0].title, "Other");
        assert_eq!(list_lines(&page.section("Other").unwrap().body), vec!["Shelly wins."]);
        assert_eq!(first_quote("{{Quote|A | B}}"), Some("A".to_owned()));
    }
}
