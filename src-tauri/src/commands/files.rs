use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use gray_matter::engine::YAML;
use gray_matter::Matter;
use log::{debug, info, warn};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::error::{AppError, AppResult};
use crate::models::{
    workspace::WorkspaceEntryKind, ClaudeMd, Skill, WorkspaceEntry, WorkspaceScan,
};

pub(crate) const CLAUDE_MD_NAME: &str = "CLAUDE.md";
pub(crate) const SKILL_MD_NAME: &str = "SKILL.md";
const MAX_SCAN_DEPTH: usize = 8;

pub(crate) fn sha256_hex(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Reads a `CLAUDE.md` from `path` without validating its filename.
///
/// Used by both `read_claude_md` (after `classify` validation) and the
/// global config loader, which already knows the path it's reading.
pub(crate) async fn read_claude_md_at(path: &Path) -> AppResult<ClaudeMd> {
    debug!("read_claude_md_at: {}", path.display());
    let body = match tokio::fs::read_to_string(path).await {
        Ok(b) => b,
        Err(e) => {
            warn!("read_claude_md_at: failed {}: {}", path.display(), e);
            return Err(e.into());
        }
    };
    let sha256 = sha256_hex(&body);
    let modified_at = modified_unix(path);
    debug!(
        "read_claude_md_at: ok {} ({} bytes, sha256={}…, mtime={:?})",
        path.display(),
        body.len(),
        &sha256[..12.min(sha256.len())],
        modified_at,
    );
    Ok(ClaudeMd {
        path: path.to_string_lossy().to_string(),
        body,
        sha256,
        modified_at,
    })
}

/// Reads a `SKILL.md` from `path` and parses its YAML frontmatter.
///
/// Same shape as `read_claude_md_at` — no filename validation, used by both
/// the public command and the global config loader.
pub(crate) async fn read_skill_at(path: &Path) -> AppResult<Skill> {
    debug!("read_skill_at: {}", path.display());
    let raw = match tokio::fs::read_to_string(path).await {
        Ok(r) => r,
        Err(e) => {
            warn!("read_skill_at: failed {}: {}", path.display(), e);
            return Err(e.into());
        }
    };
    let sha256 = sha256_hex(&raw);
    let modified_at = modified_unix(path);

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&raw);

    let mut frontmatter: BTreeMap<String, serde_json::Value> = BTreeMap::new();
    if let Some(data) = parsed.data {
        if let Ok(json) = data.deserialize::<serde_json::Value>() {
            if let serde_json::Value::Object(map) = json {
                for (k, v) in map {
                    frontmatter.insert(k, v);
                }
            }
        }
    }

    let name = frontmatter
        .get("name")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let description = frontmatter
        .get("description")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    debug!(
        "read_skill_at: ok {} ({} bytes, name={:?}, frontmatter_keys={}, mtime={:?})",
        path.display(),
        raw.len(),
        name.as_deref().unwrap_or("<none>"),
        frontmatter.len(),
        modified_at,
    );

    Ok(Skill {
        path: path.to_string_lossy().to_string(),
        name,
        description,
        frontmatter,
        body: parsed.content,
        sha256,
        modified_at,
    })
}

fn modified_unix(path: &Path) -> Option<i64> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    modified
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs() as i64)
}

fn classify(path: &Path) -> Option<WorkspaceEntryKind> {
    let name = path.file_name()?.to_str()?;
    if name == CLAUDE_MD_NAME {
        Some(WorkspaceEntryKind::ClaudeMd)
    } else if name == SKILL_MD_NAME {
        Some(WorkspaceEntryKind::Skill)
    } else {
        None
    }
}

/// Walks `root` looking for `CLAUDE.md` and `SKILL.md` files.
///
/// Skips common heavy directories (`node_modules`, `.git`, `target`, `dist`)
/// and is depth-limited so a misclick on `/` doesn't lock the app up.
#[tauri::command]
pub async fn scan_workspace(root: String) -> AppResult<WorkspaceScan> {
    info!("scan_workspace: start root={}", root);
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        warn!("scan_workspace: root is not a directory: {}", root);
        return Err(AppError::InvalidPath(root));
    }

    let mut entries: Vec<WorkspaceEntry> = Vec::new();

    let walker = WalkDir::new(&root_path)
        .follow_links(false)
        .max_depth(MAX_SCAN_DEPTH)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !matches!(
                name.as_ref(),
                "node_modules" | ".git" | "target" | "dist" | ".next" | ".venv"
            )
        });

    for entry in walker {
        let entry = entry?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let Some(kind) = classify(path) else {
            continue;
        };

        let display_name = path
            .strip_prefix(&root_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

        entries.push(WorkspaceEntry {
            path: path.to_string_lossy().to_string(),
            kind,
            display_name,
            modified_at: modified_unix(path),
            size_bytes,
        });
    }

    entries.sort_by(|a, b| a.display_name.cmp(&b.display_name));

    let claude_md_count = entries
        .iter()
        .filter(|e| e.kind == WorkspaceEntryKind::ClaudeMd)
        .count();
    let skill_count = entries.len() - claude_md_count;
    info!(
        "scan_workspace: done root={} ({} entries: {} CLAUDE.md, {} SKILL.md)",
        root_path.display(),
        entries.len(),
        claude_md_count,
        skill_count
    );

    Ok(WorkspaceScan {
        root: root_path.to_string_lossy().to_string(),
        entries,
    })
}

#[tauri::command]
pub async fn read_claude_md(path: String) -> AppResult<ClaudeMd> {
    let p = PathBuf::from(&path);
    if classify(&p) != Some(WorkspaceEntryKind::ClaudeMd) {
        return Err(AppError::UnsupportedFile(path));
    }
    read_claude_md_at(&p).await
}

#[tauri::command]
pub async fn write_claude_md(path: String, body: String) -> AppResult<ClaudeMd> {
    let p = PathBuf::from(&path);
    if classify(&p) != Some(WorkspaceEntryKind::ClaudeMd) {
        return Err(AppError::UnsupportedFile(path));
    }
    tokio::fs::write(&p, body.as_bytes()).await?;
    read_claude_md_at(&p).await
}

#[tauri::command]
pub async fn read_skill(path: String) -> AppResult<Skill> {
    let p = PathBuf::from(&path);
    if classify(&p) != Some(WorkspaceEntryKind::Skill) {
        return Err(AppError::UnsupportedFile(path));
    }
    read_skill_at(&p).await
}

#[tauri::command]
pub async fn write_skill(path: String, raw: String) -> AppResult<Skill> {
    // For v0 we accept the full file (frontmatter + body) as a single string —
    // structured editing is a follow-up once the canvas is wired up.
    let p = PathBuf::from(&path);
    if classify(&p) != Some(WorkspaceEntryKind::Skill) {
        return Err(AppError::UnsupportedFile(path));
    }
    tokio::fs::write(&p, raw.as_bytes()).await?;
    read_skill_at(&p).await
}
