import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { basename, relative, sep } from "node:path";
import matter from "gray-matter";
import log from "electron-log/main";

// ── Models (mirror src/composables/useDesktopApi.ts) ────────────────────

export type WorkspaceEntryKind = "claudemd" | "skill";

export interface WorkspaceEntry {
  path: string;
  kind: WorkspaceEntryKind;
  displayName: string;
  /** POSIX seconds since epoch, or null if stat failed. */
  modifiedAt: number | null;
  sizeBytes: number;
}

export interface WorkspaceScan {
  root: string;
  entries: WorkspaceEntry[];
}

export interface ClaudeMd {
  path: string;
  body: string;
  sha256: string;
  modifiedAt: number | null;
}

export interface Skill {
  path: string;
  name: string | null;
  description: string | null;
  frontmatter: Record<string, unknown>;
  body: string;
  sha256: string;
  modifiedAt: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────

export const CLAUDE_MD_NAME = "CLAUDE.md";
export const SKILL_MD_NAME = "SKILL.md";
export const MAX_SCAN_DEPTH = 8;
const SKIPPED_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  ".next",
  ".venv",
]);

// ── Errors ───────────────────────────────────────────────────────────────

/**
 * Wraps any failure with a stable code so the renderer can branch on it.
 * The Tauri backend used a thiserror enum; we surface the same shapes via
 * `code` strings to keep the renderer's error-handling unchanged in spirit.
 */
export class AppError extends Error {
  constructor(
    public readonly code:
      | "InvalidPath"
      | "UnsupportedFile"
      | "Io"
      | "Serde"
      | "Walk",
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function modifiedUnix(path: string): Promise<number | null> {
  try {
    const stat = await fs.stat(path);
    return Math.floor(stat.mtimeMs / 1000);
  } catch {
    return null;
  }
}

function classify(path: string): WorkspaceEntryKind | null {
  const name = basename(path);
  if (name === CLAUDE_MD_NAME) return "claudemd";
  if (name === SKILL_MD_NAME) return "skill";
  return null;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// ── Internal readers (no filename validation) ───────────────────────────

/**
 * Reads a CLAUDE.md without validating its filename. Used by both
 * `readClaudeMd` (after `classify` validation) and the global config
 * loader, which already knows the path it's reading.
 */
export async function readClaudeMdAt(path: string): Promise<ClaudeMd> {
  log.debug(`readClaudeMdAt: ${path}`);
  let body: string;
  try {
    body = await fs.readFile(path, "utf8");
  } catch (e) {
    log.warn(`readClaudeMdAt: failed ${path}: ${(e as Error).message}`);
    throw new AppError("Io", (e as Error).message);
  }
  const sha256 = sha256Hex(body);
  const modifiedAt = await modifiedUnix(path);
  log.debug(
    `readClaudeMdAt: ok ${path} (${body.length} bytes, sha256=${sha256.slice(0, 12)}…, mtime=${modifiedAt})`,
  );
  return { path, body, sha256, modifiedAt };
}

/**
 * Reads a SKILL.md and parses its YAML frontmatter via gray-matter.
 * Same shape as `readClaudeMdAt` — no filename validation.
 */
export async function readSkillAt(path: string): Promise<Skill> {
  log.debug(`readSkillAt: ${path}`);
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch (e) {
    log.warn(`readSkillAt: failed ${path}: ${(e as Error).message}`);
    throw new AppError("Io", (e as Error).message);
  }
  const sha256 = sha256Hex(raw);
  const modifiedAt = await modifiedUnix(path);

  let frontmatter: Record<string, unknown> = {};
  let body = raw;
  try {
    const parsed = matter(raw);
    if (parsed.data && typeof parsed.data === "object") {
      // gray-matter returns the data object as-is; sort keys to match the
      // Rust BTreeMap ordering so on-disk diffs of cached payloads stay
      // stable across the IPC boundary.
      frontmatter = Object.fromEntries(
        Object.entries(parsed.data).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    body = parsed.content;
  } catch (e) {
    log.warn(`readSkillAt: frontmatter parse failed ${path}: ${(e as Error).message}`);
    // Fall through with empty frontmatter — Rust did the same.
  }

  const name =
    typeof frontmatter["name"] === "string"
      ? (frontmatter["name"] as string)
      : null;
  const description =
    typeof frontmatter["description"] === "string"
      ? (frontmatter["description"] as string)
      : null;

  log.debug(
    `readSkillAt: ok ${path} (${raw.length} bytes, name=${name ?? "<none>"}, frontmatter_keys=${Object.keys(frontmatter).length}, mtime=${modifiedAt})`,
  );

  return {
    path,
    name,
    description,
    frontmatter,
    body,
    sha256,
    modifiedAt,
  };
}

// ── Public commands (called from IPC) ────────────────────────────────────

/**
 * Walks `root` looking for `CLAUDE.md` and `SKILL.md`. Skips heavy dirs
 * (`node_modules`, `.git`, `target`, `dist`, `.next`, `.venv`) and is
 * depth-limited so a misclick on `/` doesn't lock the app up.
 *
 * Implemented as a manual recursive walk so we can both depth-limit AND
 * prune skipped directories before recursing into them — `fs.readdir
 * { recursive: true }` can't do directory-level filtering.
 */
export async function scanWorkspace(root: string): Promise<WorkspaceScan> {
  log.info(`scan_workspace: start root=${root}`);
  if (!(await isDirectory(root))) {
    log.warn(`scan_workspace: root is not a directory: ${root}`);
    throw new AppError("InvalidPath", root);
  }

  const entries: WorkspaceEntry[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_SCAN_DEPTH) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      log.warn(`scan_workspace: readdir failed ${dir}: ${(e as Error).message}`);
      return;
    }
    for (const dirent of dirents) {
      if (SKIPPED_DIRS.has(dirent.name)) continue;
      const full = dir + sep + dirent.name;
      if (dirent.isSymbolicLink()) continue; // matches walkdir follow_links(false)
      if (dirent.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }
      if (!dirent.isFile()) continue;
      const kind = classify(full);
      if (!kind) continue;

      const displayName = relative(root, full);
      let sizeBytes = 0;
      let mtime: number | null = null;
      try {
        const stat = await fs.stat(full);
        sizeBytes = stat.size;
        mtime = Math.floor(stat.mtimeMs / 1000);
      } catch {
        /* leave defaults */
      }

      entries.push({
        path: full,
        kind,
        displayName,
        modifiedAt: mtime,
        sizeBytes,
      });
    }
  }

  await walk(root, 0);
  entries.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const claudeMdCount = entries.filter((e) => e.kind === "claudemd").length;
  const skillCount = entries.length - claudeMdCount;
  log.info(
    `scan_workspace: done root=${root} (${entries.length} entries: ${claudeMdCount} CLAUDE.md, ${skillCount} SKILL.md)`,
  );

  return { root, entries };
}

export async function readClaudeMd(path: string): Promise<ClaudeMd> {
  if (classify(path) !== "claudemd") {
    throw new AppError("UnsupportedFile", path);
  }
  return readClaudeMdAt(path);
}

export async function writeClaudeMd(
  path: string,
  body: string,
): Promise<ClaudeMd> {
  if (classify(path) !== "claudemd") {
    throw new AppError("UnsupportedFile", path);
  }
  await fs.writeFile(path, body, "utf8");
  return readClaudeMdAt(path);
}

export async function readSkill(path: string): Promise<Skill> {
  if (classify(path) !== "skill") {
    throw new AppError("UnsupportedFile", path);
  }
  return readSkillAt(path);
}

export async function writeSkill(path: string, raw: string): Promise<Skill> {
  // For v0 we accept the full file (frontmatter + body) as a single string —
  // structured editing is a follow-up once the canvas is wired up.
  if (classify(path) !== "skill") {
    throw new AppError("UnsupportedFile", path);
  }
  await fs.writeFile(path, raw, "utf8");
  return readSkillAt(path);
}
