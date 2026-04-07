use std::path::{Path, PathBuf};

use log::{debug, info, warn};
use walkdir::WalkDir;

use crate::commands::files::{read_claude_md_at, read_skill_at, sha256_hex, SKILL_MD_NAME};
use crate::error::{AppError, AppResult};
use crate::models::{ClaudeConfig, ClaudeMd, ProjectEntry, Skill, UserSettings};

const CLAUDE_DIR: &str = ".claude";
const CLAUDE_JSON: &str = ".claude.json";
const SETTINGS_JSON: &str = "settings.json";
const CLAUDE_MD: &str = "CLAUDE.md";
const SKILLS_SUBDIR: &str = "skills";

/// Skills can nest one level deeper for plugin-style layouts (e.g.
/// `~/.claude/skills/my-pack/sub-skill/SKILL.md`), but going much deeper just
/// invites scanning unrelated junk.
const MAX_SKILL_DEPTH: usize = 4;

/// Resolves the user's home directory across platforms.
///
/// We avoid pulling in the `dirs` crate for one call — `HOME` is set on
/// macOS/Linux and `USERPROFILE` is set on most Windows shells, which is
/// good enough until we hit a platform where it isn't.
fn home_dir() -> AppResult<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| AppError::InvalidPath("$HOME is not set".into()))
}

async fn read_settings_at(path: &Path) -> AppResult<UserSettings> {
    debug!("read_settings_at: {}", path.display());
    let body = match tokio::fs::read_to_string(path).await {
        Ok(b) => b,
        Err(e) => {
            warn!("read_settings_at: failed {}: {}", path.display(), e);
            return Err(e.into());
        }
    };
    let raw: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(e) => {
            warn!("read_settings_at: invalid JSON in {}: {}", path.display(), e);
            return Err(e.into());
        }
    };
    let key_count = raw.as_object().map(|o| o.len()).unwrap_or(0);
    debug!(
        "read_settings_at: ok {} ({} bytes, {} top-level keys)",
        path.display(),
        body.len(),
        key_count
    );
    Ok(UserSettings {
        path: path.to_string_lossy().to_string(),
        raw,
        sha256: sha256_hex(&body),
    })
}

async fn load_optional_claude_md(path: &Path) -> Option<ClaudeMd> {
    if !path.is_file() {
        debug!("load_optional_claude_md: missing {}", path.display());
        return None;
    }
    match read_claude_md_at(path).await {
        Ok(md) => Some(md),
        Err(e) => {
            warn!("load_optional_claude_md: error {}: {}", path.display(), e);
            None
        }
    }
}

async fn load_optional_settings(path: &Path) -> Option<UserSettings> {
    if !path.is_file() {
        debug!("load_optional_settings: missing {}", path.display());
        return None;
    }
    match read_settings_at(path).await {
        Ok(s) => Some(s),
        Err(e) => {
            warn!("load_optional_settings: error {}: {}", path.display(), e);
            None
        }
    }
}

/// Walks `skills_dir` collecting every `SKILL.md` it finds, parsing each
/// one into a `Skill`. Returns an empty Vec if the directory is missing —
/// per-project skill dirs commonly don't exist.
async fn collect_skill_md_files(skills_dir: &Path) -> Vec<Skill> {
    if !skills_dir.is_dir() {
        debug!(
            "collect_skill_md_files: skills dir absent {}",
            skills_dir.display()
        );
        return Vec::new();
    }
    debug!(
        "collect_skill_md_files: scanning {} (max depth {})",
        skills_dir.display(),
        MAX_SKILL_DEPTH
    );

    // walkdir is sync, so collect candidate paths first, then await reads.
    let candidates: Vec<PathBuf> = WalkDir::new(skills_dir)
        .follow_links(false)
        .max_depth(MAX_SKILL_DEPTH)
        .into_iter()
        .filter_map(|e| match e {
            Ok(entry) => Some(entry),
            Err(err) => {
                warn!("collect_skill_md_files: walk error: {}", err);
                None
            }
        })
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.file_name().to_str() == Some(SKILL_MD_NAME))
        .map(|e| e.into_path())
        .collect();
    debug!(
        "collect_skill_md_files: {} SKILL.md candidates under {}",
        candidates.len(),
        skills_dir.display()
    );

    let mut out = Vec::with_capacity(candidates.len());
    let mut failed = 0usize;
    for path in candidates {
        match read_skill_at(&path).await {
            Ok(skill) => out.push(skill),
            Err(e) => {
                failed += 1;
                warn!("collect_skill_md_files: skip {}: {}", path.display(), e);
            }
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    info!(
        "collect_skill_md_files: loaded {} skill(s) from {} ({} failed)",
        out.len(),
        skills_dir.display(),
        failed
    );
    out
}

/// Loads the user's full Claude configuration tree:
///
/// 1. `~/.claude.json`           — required, the central anchor
/// 2. `~/.claude/settings.json`  — optional global settings
/// 3. `~/.claude/CLAUDE.md`      — optional global instructions
/// 4. `~/.claude/skills/**/SKILL.md` — every global skill
/// 5. For each entry under `~/.claude.json` → `projects`:
///    - `{path}/CLAUDE.md`
///    - `{path}/.claude/settings.json`
///    - `{path}/.claude/skills/**/SKILL.md`
///
/// Missing optional files are reported as `None` / empty rather than errors,
/// so a single broken project doesn't fail the whole load. Stale projects
/// (entries in `.claude.json` whose directory no longer exists) are still
/// returned with `exists: false` so the UI can offer to prune them.
#[tauri::command]
pub async fn load_claude_config() -> AppResult<ClaudeConfig> {
    let started = std::time::Instant::now();
    info!("════════ load_claude_config: START ════════");

    let home = home_dir()?;
    let user_dir = home.join(CLAUDE_DIR);
    let user_config_path = home.join(CLAUDE_JSON);
    info!("home={}", home.display());
    info!("user_dir={}", user_dir.display());

    // ── Phase 1/5: ~/.claude.json (required) ────────────────────────────
    info!("── phase 1/5: read {} ──", user_config_path.display());
    let raw_body = match tokio::fs::read_to_string(&user_config_path).await {
        Ok(b) => {
            info!(
                "phase 1/5: ok ({} bytes from {})",
                b.len(),
                user_config_path.display()
            );
            b
        }
        Err(e) => {
            warn!(
                "phase 1/5: FATAL — cannot read {}: {}",
                user_config_path.display(),
                e
            );
            return Err(e.into());
        }
    };
    let user_config_raw: serde_json::Value = match serde_json::from_str(&raw_body) {
        Ok(v) => v,
        Err(e) => {
            warn!(
                "phase 1/5: FATAL — invalid JSON in {}: {}",
                user_config_path.display(),
                e
            );
            return Err(e.into());
        }
    };
    let top_keys = user_config_raw
        .as_object()
        .map(|o| o.len())
        .unwrap_or(0);
    let project_count = user_config_raw
        .get("projects")
        .and_then(|v| v.as_object())
        .map(|m| m.len())
        .unwrap_or(0);
    info!(
        "phase 1/5: parsed ({} top-level keys, {} projects)",
        top_keys, project_count
    );

    // ── Phase 2/5: ~/.claude/settings.json ──────────────────────────────
    let user_settings_path = user_dir.join(SETTINGS_JSON);
    info!("── phase 2/5: check {} ──", user_settings_path.display());
    let user_settings = load_optional_settings(&user_settings_path).await;
    info!(
        "phase 2/5: settings = {}",
        if user_settings.is_some() {
            "loaded"
        } else {
            "absent"
        }
    );

    // ── Phase 3/5: ~/.claude/CLAUDE.md ──────────────────────────────────
    let user_claude_md_path = user_dir.join(CLAUDE_MD);
    info!("── phase 3/5: check {} ──", user_claude_md_path.display());
    let user_claude_md = load_optional_claude_md(&user_claude_md_path).await;
    info!(
        "phase 3/5: global CLAUDE.md = {}",
        match &user_claude_md {
            Some(md) => format!("loaded ({} bytes)", md.body.len()),
            None => "absent".into(),
        }
    );

    // ── Phase 4/5: ~/.claude/skills/**/SKILL.md ─────────────────────────
    let user_skills_dir = user_dir.join(SKILLS_SUBDIR);
    info!("── phase 4/5: scan {} ──", user_skills_dir.display());
    let user_skills = collect_skill_md_files(&user_skills_dir).await;
    info!("phase 4/5: {} global skill(s)", user_skills.len());

    // ── Phase 5/5: per-project files from .claude.json → projects ───────
    info!("── phase 5/5: load {} project entries ──", project_count);
    let mut projects: Vec<ProjectEntry> = Vec::new();
    let mut stale = 0usize;
    let mut total_project_skills = 0usize;
    let mut total_project_claude_md = 0usize;
    let mut total_project_settings = 0usize;

    if let Some(map) = user_config_raw.get("projects").and_then(|v| v.as_object()) {
        for (idx, (path_key, config)) in map.iter().enumerate() {
            let project_path = PathBuf::from(path_key);
            let exists = project_path.is_dir();
            debug!(
                "project [{}/{}] {} exists={}",
                idx + 1,
                project_count,
                path_key,
                exists
            );

            let (claude_md, local_settings, local_skills) = if exists {
                let claude_md = load_optional_claude_md(&project_path.join(CLAUDE_MD)).await;
                let local_settings =
                    load_optional_settings(&project_path.join(CLAUDE_DIR).join(SETTINGS_JSON))
                        .await;
                let local_skills =
                    collect_skill_md_files(&project_path.join(CLAUDE_DIR).join(SKILLS_SUBDIR))
                        .await;
                debug!(
                    "project [{}/{}] {} → CLAUDE.md={} settings={} skills={}",
                    idx + 1,
                    project_count,
                    path_key,
                    if claude_md.is_some() { "yes" } else { "no" },
                    if local_settings.is_some() { "yes" } else { "no" },
                    local_skills.len()
                );
                if claude_md.is_some() {
                    total_project_claude_md += 1;
                }
                if local_settings.is_some() {
                    total_project_settings += 1;
                }
                total_project_skills += local_skills.len();
                (claude_md, local_settings, local_skills)
            } else {
                stale += 1;
                debug!(
                    "project [{}/{}] {} → stale (directory missing)",
                    idx + 1,
                    project_count,
                    path_key
                );
                (None, None, Vec::new())
            };

            projects.push(ProjectEntry {
                path: path_key.clone(),
                exists,
                config: config.clone(),
                claude_md,
                local_settings,
                local_skills,
            });
        }
        projects.sort_by(|a, b| a.path.cmp(&b.path));
    }
    info!(
        "phase 5/5: {} projects ({} stale) — {} CLAUDE.md, {} settings.json, {} project-local skill(s)",
        projects.len(),
        stale,
        total_project_claude_md,
        total_project_settings,
        total_project_skills
    );

    let elapsed = started.elapsed();
    info!(
        "════════ load_claude_config: DONE in {:.1?} — global: settings={} claude_md={} skills={}; projects={} (stale={}) skills={} ════════",
        elapsed,
        if user_settings.is_some() { "yes" } else { "no" },
        if user_claude_md.is_some() { "yes" } else { "no" },
        user_skills.len(),
        projects.len(),
        stale,
        total_project_skills
    );

    Ok(ClaudeConfig {
        home: home.to_string_lossy().to_string(),
        user_dir: user_dir.to_string_lossy().to_string(),
        user_config_path: user_config_path.to_string_lossy().to_string(),
        user_config_raw,
        user_settings,
        user_claude_md,
        user_skills,
        projects,
    })
}
