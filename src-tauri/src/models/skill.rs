use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Represents a single skill file (typically `SKILL.md` inside a skill directory).
///
/// Skills carry YAML frontmatter (`name`, `description`, optional triggers,
/// allowed-tools, etc.) followed by markdown body. We capture the frontmatter
/// as an open-ended map so we don't have to baked-in every possible key here.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub path: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub frontmatter: BTreeMap<String, serde_json::Value>,
    pub body: String,
    pub sha256: String,
    pub modified_at: Option<i64>,
}
