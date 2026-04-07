use serde::{Deserialize, Serialize};

/// Represents the contents of a `CLAUDE.md` file.
///
/// `CLAUDE.md` files do not have YAML frontmatter (unlike SKILLS), so this is
/// just the raw markdown body plus its on-disk path. `modified_at` is the
/// POSIX mtime in seconds, mirrored from `WorkspaceEntry` — surfaced so the
/// editor UI can display a relative "modified N ago" timestamp.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMd {
    pub path: String,
    pub body: String,
    pub sha256: String,
    pub modified_at: Option<i64>,
}
