use serde::{Deserialize, Serialize};

/// Represents the contents of a `CLAUDE.md` file.
///
/// `CLAUDE.md` files do not have YAML frontmatter (unlike SKILLS), so this is
/// just the raw markdown body plus its on-disk path.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMd {
    pub path: String,
    pub body: String,
    pub sha256: String,
}
