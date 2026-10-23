//! JSON output contracts shared with CDN TypeScript consumers.
//! The compatibility tests deserialize actual scraper outputs into these models.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use ts_rs::TS;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Asset {
    pub filename: String,
    pub source_url: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Stat {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct StatsByLevel {
    pub name: String,
    pub levels: Vec<Option<i32>>,
    pub values: Vec<Option<i32>>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Attack {
    pub name: String,
    pub description: String,
    pub stats: Vec<Stat>,
    pub stats_by_level: Vec<StatsByLevel>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Hypercharge {
    pub name: String,
    pub description: String,
    pub stats: Vec<Stat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub asset: Option<Asset>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Accessory {
    pub name: String,
    pub id: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub asset: Option<Asset>,
    pub stats_by_level: Vec<StatsByLevel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cooldown: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct PetSkin {
    #[serde(rename = "for")]
    pub for_pet: String,
    pub asset: Asset,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Pin {
    pub asset: Asset,
    pub rarity: String,
    pub emote: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Spray {
    pub asset: Asset,
    pub rarity: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Voiceline {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variant: Option<String>,
    pub trigger: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub asset: Option<Asset>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Skin {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rarity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub campaign: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cost: Option<String>,
    pub exclusive: bool,
    pub seasonal: bool,
    pub asset: Asset,
    pub pet_skins: Vec<PetSkin>,
    pub pins: Vec<Pin>,
    pub voicelines: Vec<Voiceline>,
    pub sprays: Vec<Spray>,
    pub profile_icons: Vec<Asset>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Stats {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rarity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub class: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub movementspeed: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub voiceactor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(repr(enum = name))]
pub enum Kind {
    Buff,
    Nerf,
    Neutral,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct History {
    // The legacy parser preserves unknown and empty labels; Kind exposes the known values.
    pub kind: String,
    /// ISO 8601 UTC timestamp as stored in JSON, not a JavaScript Date object.
    pub date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub enum GearRarity {
    #[serde(rename = "Super Rare")]
    SuperRare,
    Epic,
    Mythic,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(untagged)]
pub enum GearModifierValue {
    Number(f64),
    Text(String),
    Null,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Gear {
    pub name: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rarity: Option<GearRarity>,
    pub modifier_type: String,
    pub modifier_value: GearModifierValue,
    // Preserve the spelling and explicit null used in existing CDN files.
    pub brawlers_avaliable_to: Option<Vec<Option<i32>>>,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
pub struct GearCollection(pub BTreeMap<String, Gear>);

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Buffie {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub asset: Option<Asset>,
    pub name: String,
    pub kind: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct BuffieSkin {
    pub name: String,
    pub asset: Asset,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CdnBrawler {
    pub attribution: String,
    pub short_description: String,
    pub full_description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub r#trait: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub attack: Option<Attack>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub alt_attack: Option<Attack>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    #[serde(rename = "super")]
    pub super_attack: Option<Attack>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub alt_super: Option<Attack>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hypercharge: Option<Hypercharge>,
    pub health_by_level: Vec<Option<f64>>,
    pub stats: Stats,
    pub tips: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub model: Option<Asset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub avatar: Option<Asset>,
    #[serde(default)]
    pub pins: Vec<Pin>,
    #[serde(default)]
    pub sprays: Vec<Spray>,
    #[serde(default)]
    pub voicelines: Vec<Voiceline>,
    #[serde(default)]
    pub buffies: Vec<Buffie>,
    #[serde(default)]
    pub buffie_skins: Vec<BuffieSkin>,
    pub skins: Vec<Skin>,
    pub history: Vec<History>,
    pub gadgets: Vec<Accessory>,
    pub starpowers: Vec<Accessory>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub gears: Option<Vec<Gear>>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrawlerTip {
    pub brawler_id: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct HistoryEntry {
    pub date: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CdnMode {
    pub attribution: String,
    pub short_description: String,
    pub full_description: String,
    pub tips: Vec<String>,
    pub brawler_tips: Vec<BrawlerTip>,
    pub history: Vec<HistoryEntry>,
}

/// Deterministic single-file bindings, checked into the CDN package for builds without Rust.
pub fn typescript() -> String {
    let cfg = ts_rs::Config::default();
    let mut result = String::from(
        "// Generated by fandom-scraper-v2 generate-types. Do not edit.\n// Source: apps/fandom-scraper-v2/src/output.rs\n\n",
    );
    macro_rules! declarations {
        ($($ty:ty),* $(,)?) => { $(
            result.push_str("export ");
            result.push_str(&<$ty>::decl(&cfg));
            result.push_str("\n\n");
        )* };
    }
    declarations!(
        Asset,
        Stat,
        StatsByLevel,
        Attack,
        Hypercharge,
        Accessory,
        PetSkin,
        Pin,
        Spray,
        Voiceline,
        Skin,
        Stats,
        Kind,
        History,
        GearRarity,
        GearModifierValue,
        Gear,
        GearCollection,
        Buffie,
        BuffieSkin,
        CdnBrawler,
        BrawlerTip,
        HistoryEntry,
        CdnMode
    );
    result.push_str("// Compatibility names and accessory roles.\nexport type Avatar = Asset;\nexport type Power = Accessory;\nexport type Gadget = Accessory;\nexport type StarPower = Accessory;\nexport type FandomBrawlerData = CdnBrawler;\nexport type FandomModeData = CdnMode;\n");
    result
}

pub fn typescript_path() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/cdn/src/generated/fandom.ts")
}
