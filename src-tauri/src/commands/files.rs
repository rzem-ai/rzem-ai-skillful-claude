use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use gray_matter::engine::YAML;
use gray_matter::Matter;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::error::{AppError, AppResult};
use crate::models::{
    workspace::WorkspaceEntryKind, ClaudeMd, Skill, WorkspaceEntry, WorkspaceScan,
};

const CLAUDE_MD_NAME: &str = "CLAUDE.md";
const SKILL_MD_NAME: &str = "SKILL.md";
const MAX_SCAN_DEPTH: usize = 8;

fn sha256_hex(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
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
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
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
    let body = tokio::fs::read_to_string(&p).await?;
    let sha256 = sha256_hex(&body);
    Ok(ClaudeMd {
        path: p.to_string_lossy().to_string(),
        body,
        sha256,
    })
}

#[tauri::command]
pub async fn write_claude_md(path: String, body: String) -> AppResult<ClaudeMd> {
    let p = PathBuf::from(&path);
    if classify(&p) != Some(WorkspaceEntryKind::ClaudeMd) {
        return Err(AppError::UnsupportedFile(path));
    }
    tokio::fs::write(&p, body.as_bytes()).await?;
    let sha256 = sha256_hex(&body);
    Ok(ClaudeMd {
        path: p.to_string_lossy().to_string(),
        body,
        sha256,
    })
}

#[tauri::command]
pub async fn read_skill(path: String) -> AppResult<Skill> {
    let p = PathBuf::from(&path);
    if classify(&p) != Some(WorkspaceEntryKind::Skill) {
        return Err(AppError::UnsupportedFile(path));
    }
    let raw = tokio::fs::read_to_string(&p).await?;
    let sha256 = sha256_hex(&raw);

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

    Ok(Skill {
        path: p.to_string_lossy().to_string(),
        name,
        description,
        frontmatter,
        body: parsed.content,
        sha256,
    })
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
    read_skill(p.to_string_lossy().to_string()).await
}
