use serde::{Deserialize, Serialize};

use super::{ClaudeMd, Skill};

/// A `settings.json` (or other JSON config) loaded from disk.
///
/// We keep the parsed value as an open `serde_json::Value` so the frontend can
/// read whatever fields it wants without the backend having to mirror the
/// (still-evolving) Claude Code settings schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub path: String,
    pub raw: serde_json::Value,
    pub sha256: String,
}

/// One project entry as listed under `~/.claude.json`'s `projects` map.
///
/// `path` is the absolute project root (the key in `projects`). If that
/// directory still exists on disk, we also try to load its `CLAUDE.md`,
/// `.claude/settings.json`, and any project-local skills under
/// `.claude/skills/*/SKILL.md`. Each of those is `None`/empty if absent —
/// the entry is still returned so the frontend can show stale projects.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEntry {
    pub path: String,
    pub exists: bool,
    pub config: serde_json::Value,
    pub claude_md: Option<ClaudeMd>,
    pub local_settings: Option<UserSettings>,
    pub local_skills: Vec<Skill>,
}

/// Aggregate snapshot of the user's global Claude configuration.
///
/// Built by `load_claude_config`, which reads `~/.claude.json` (required) and
/// then opportunistically pulls in `~/.claude/settings.json`,
/// `~/.claude/CLAUDE.md`, every `~/.claude/skills/*/SKILL.md`, and the
/// per-project files for each entry in `projects`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeConfig {
    pub home: String,
    pub user_dir: String,
    pub user_config_path: String,
    pub user_config_raw: serde_json::Value,
    pub user_settings: Option<UserSettings>,
    pub user_claude_md: Option<ClaudeMd>,
    pub user_skills: Vec<Skill>,
    pub projects: Vec<ProjectEntry>,
}
