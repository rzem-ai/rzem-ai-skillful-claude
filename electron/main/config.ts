import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import log from "electron-log/main.js";

import {
  AppError,
  readClaudeMdAt,
  readSkillAt,
  sha256Hex,
  type ClaudeMd,
  type Skill,
  SKILL_MD_NAME,
} from "./fs";

// ── Models ───────────────────────────────────────────────────────────────

export interface UserSettings {
  path: string;
  /** Parsed JSON body — left open because the Claude Code settings schema
   *  is still in flux; consumers narrow as needed. */
  raw: unknown;
  sha256: string;
}

export interface ProjectEntry {
  path: string;
  exists: boolean;
  config: unknown;
  claudeMd: ClaudeMd | null;
  localSettings: UserSettings | null;
  localSkills: Skill[];
}

export interface ClaudeConfig {
  home: string;
  userDir: string;
  userConfigPath: string;
  userConfigRaw: unknown;
  userSettings: UserSettings | null;
  userClaudeMd: ClaudeMd | null;
  userSkills: Skill[];
  projects: ProjectEntry[];
}

// ── Constants ────────────────────────────────────────────────────────────

const CLAUDE_DIR = ".claude";
const CLAUDE_JSON = ".claude.json";
const SETTINGS_JSON = "settings.json";
const CLAUDE_MD = "CLAUDE.md";
const SKILLS_SUBDIR = "skills";

/**
 * Skills can nest one level deeper for plugin-style layouts (e.g.
 * `~/.claude/skills/my-pack/sub-skill/SKILL.md`), but going much deeper
 * just invites scanning unrelated junk.
 */
const MAX_SKILL_DEPTH = 4;

// ── Helpers ──────────────────────────────────────────────────────────────

function homeDir(): string {
  const home = homedir();
  if (!home) throw new AppError("InvalidPath", "$HOME is not set");
  return home;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readSettingsAt(path: string): Promise<UserSettings> {
  log.debug(`readSettingsAt: ${path}`);
  let body: string;
  try {
    body = await fs.readFile(path, "utf8");
  } catch (e) {
    log.warn(`readSettingsAt: failed ${path}: ${(e as Error).message}`);
    throw new AppError("Io", (e as Error).message);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (e) {
    log.warn(`readSettingsAt: invalid JSON in ${path}: ${(e as Error).message}`);
    throw new AppError("Serde", (e as Error).message);
  }
  const keyCount =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? Object.keys(raw as object).length
      : 0;
  log.debug(
    `readSettingsAt: ok ${path} (${body.length} bytes, ${keyCount} top-level keys)`,
  );
  return { path, raw, sha256: sha256Hex(body) };
}

async function loadOptionalClaudeMd(path: string): Promise<ClaudeMd | null> {
  if (!(await isFile(path))) {
    log.debug(`loadOptionalClaudeMd: missing ${path}`);
    return null;
  }
  try {
    return await readClaudeMdAt(path);
  } catch (e) {
    log.warn(`loadOptionalClaudeMd: error ${path}: ${(e as Error).message}`);
    return null;
  }
}

async function loadOptionalSettings(path: string): Promise<UserSettings | null> {
  if (!(await isFile(path))) {
    log.debug(`loadOptionalSettings: missing ${path}`);
    return null;
  }
  try {
    return await readSettingsAt(path);
  } catch (e) {
    log.warn(`loadOptionalSettings: error ${path}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Walks `skillsDir` collecting every `SKILL.md` it finds, parsing each
 * one into a `Skill`. Returns an empty array if the directory is missing —
 * per-project skill dirs commonly don't exist.
 */
async function collectSkillMdFiles(skillsDir: string): Promise<Skill[]> {
  if (!(await isDirectory(skillsDir))) {
    log.debug(`collectSkillMdFiles: skills dir absent ${skillsDir}`);
    return [];
  }
  log.debug(
    `collectSkillMdFiles: scanning ${skillsDir} (max depth ${MAX_SKILL_DEPTH})`,
  );

  const candidates: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_SKILL_DEPTH) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      log.warn(`collectSkillMdFiles: walk error: ${(e as Error).message}`);
      return;
    }
    for (const dirent of dirents) {
      if (dirent.isSymbolicLink()) continue;
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(full, depth + 1);
      } else if (dirent.isFile() && dirent.name === SKILL_MD_NAME) {
        candidates.push(full);
      }
    }
  }
  await walk(skillsDir, 0);
  log.debug(
    `collectSkillMdFiles: ${candidates.length} SKILL.md candidates under ${skillsDir}`,
  );

  const out: Skill[] = [];
  let failed = 0;
  for (const path of candidates) {
    try {
      out.push(await readSkillAt(path));
    } catch (e) {
      failed += 1;
      log.warn(`collectSkillMdFiles: skip ${path}: ${(e as Error).message}`);
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  log.info(
    `collectSkillMdFiles: loaded ${out.length} skill(s) from ${skillsDir} (${failed} failed)`,
  );
  return out;
}

// ── Public command ──────────────────────────────────────────────────────

/**
 * Loads the user's full Claude configuration tree:
 *
 * 1. `~/.claude.json`           — required, the central anchor
 * 2. `~/.claude/settings.json`  — optional global settings
 * 3. `~/.claude/CLAUDE.md`      — optional global instructions
 * 4. `~/.claude/skills/**\/SKILL.md` — every global skill
 * 5. For each entry under `~/.claude.json` → `projects`:
 *    - `{path}/CLAUDE.md`
 *    - `{path}/.claude/settings.json`
 *    - `{path}/.claude/skills/**\/SKILL.md`
 *
 * Missing optional files are reported as `null` / empty rather than
 * errors, so a single broken project doesn't fail the whole load. Stale
 * projects (entries in `.claude.json` whose directory no longer exists)
 * are still returned with `exists: false` so the UI can offer to prune.
 */
export async function loadClaudeConfig(): Promise<ClaudeConfig> {
  const started = Date.now();
  log.info("════════ load_claude_config: START ════════");

  const home = homeDir();
  const userDir = join(home, CLAUDE_DIR);
  const userConfigPath = join(home, CLAUDE_JSON);
  log.info(`home=${home}`);
  log.info(`user_dir=${userDir}`);

  // ── Phase 1/5: ~/.claude.json (required) ──────────────────────────────
  log.info(`── phase 1/5: read ${userConfigPath} ──`);
  let rawBody: string;
  try {
    rawBody = await fs.readFile(userConfigPath, "utf8");
    log.info(`phase 1/5: ok (${rawBody.length} bytes from ${userConfigPath})`);
  } catch (e) {
    log.warn(`phase 1/5: FATAL — cannot read ${userConfigPath}: ${(e as Error).message}`);
    throw new AppError("Io", (e as Error).message);
  }
  let userConfigRaw: unknown;
  try {
    userConfigRaw = JSON.parse(rawBody);
  } catch (e) {
    log.warn(`phase 1/5: FATAL — invalid JSON in ${userConfigPath}: ${(e as Error).message}`);
    throw new AppError("Serde", (e as Error).message);
  }
  const topKeys =
    userConfigRaw && typeof userConfigRaw === "object" && !Array.isArray(userConfigRaw)
      ? Object.keys(userConfigRaw as object).length
      : 0;
  const projectsObj =
    userConfigRaw &&
    typeof userConfigRaw === "object" &&
    !Array.isArray(userConfigRaw) &&
    typeof (userConfigRaw as Record<string, unknown>)["projects"] === "object"
      ? ((userConfigRaw as Record<string, unknown>)["projects"] as Record<string, unknown>)
      : null;
  const projectCount = projectsObj ? Object.keys(projectsObj).length : 0;
  log.info(`phase 1/5: parsed (${topKeys} top-level keys, ${projectCount} projects)`);

  // ── Phase 2/5: ~/.claude/settings.json ────────────────────────────────
  const userSettingsPath = join(userDir, SETTINGS_JSON);
  log.info(`── phase 2/5: check ${userSettingsPath} ──`);
  const userSettings = await loadOptionalSettings(userSettingsPath);
  log.info(`phase 2/5: settings = ${userSettings ? "loaded" : "absent"}`);

  // ── Phase 3/5: ~/.claude/CLAUDE.md ────────────────────────────────────
  const userClaudeMdPath = join(userDir, CLAUDE_MD);
  log.info(`── phase 3/5: check ${userClaudeMdPath} ──`);
  const userClaudeMd = await loadOptionalClaudeMd(userClaudeMdPath);
  log.info(
    `phase 3/5: global CLAUDE.md = ${
      userClaudeMd ? `loaded (${userClaudeMd.body.length} bytes)` : "absent"
    }`,
  );

  // ── Phase 4/5: ~/.claude/skills/**/SKILL.md ───────────────────────────
  const userSkillsDir = join(userDir, SKILLS_SUBDIR);
  log.info(`── phase 4/5: scan ${userSkillsDir} ──`);
  const userSkills = await collectSkillMdFiles(userSkillsDir);
  log.info(`phase 4/5: ${userSkills.length} global skill(s)`);

  // ── Phase 5/5: per-project files from .claude.json → projects ─────────
  log.info(`── phase 5/5: load ${projectCount} project entries ──`);
  const projects: ProjectEntry[] = [];
  let stale = 0;
  let totalProjectSkills = 0;
  let totalProjectClaudeMd = 0;
  let totalProjectSettings = 0;

  if (projectsObj) {
    const entries = Object.entries(projectsObj);
    let idx = 0;
    for (const [pathKey, config] of entries) {
      idx += 1;
      const exists = await isDirectory(pathKey);
      log.debug(`project [${idx}/${projectCount}] ${pathKey} exists=${exists}`);

      let claudeMd: ClaudeMd | null = null;
      let localSettings: UserSettings | null = null;
      let localSkills: Skill[] = [];

      if (exists) {
        claudeMd = await loadOptionalClaudeMd(join(pathKey, CLAUDE_MD));
        localSettings = await loadOptionalSettings(
          join(pathKey, CLAUDE_DIR, SETTINGS_JSON),
        );
        localSkills = await collectSkillMdFiles(
          join(pathKey, CLAUDE_DIR, SKILLS_SUBDIR),
        );
        log.debug(
          `project [${idx}/${projectCount}] ${pathKey} → CLAUDE.md=${
            claudeMd ? "yes" : "no"
          } settings=${localSettings ? "yes" : "no"} skills=${localSkills.length}`,
        );
        if (claudeMd) totalProjectClaudeMd += 1;
        if (localSettings) totalProjectSettings += 1;
        totalProjectSkills += localSkills.length;
      } else {
        stale += 1;
        log.debug(
          `project [${idx}/${projectCount}] ${pathKey} → stale (directory missing)`,
        );
      }

      projects.push({
        path: pathKey,
        exists,
        config,
        claudeMd,
        localSettings,
        localSkills,
      });
    }
    projects.sort((a, b) => a.path.localeCompare(b.path));
  }

  log.info(
    `phase 5/5: ${projects.length} projects (${stale} stale) — ${totalProjectClaudeMd} CLAUDE.md, ${totalProjectSettings} settings.json, ${totalProjectSkills} project-local skill(s)`,
  );

  const elapsed = Date.now() - started;
  log.info(
    `════════ load_claude_config: DONE in ${elapsed}ms — global: settings=${
      userSettings ? "yes" : "no"
    } claude_md=${userClaudeMd ? "yes" : "no"} skills=${
      userSkills.length
    }; projects=${projects.length} (stale=${stale}) skills=${totalProjectSkills} ════════`,
  );

  return {
    home,
    userDir,
    userConfigPath,
    userConfigRaw,
    userSettings,
    userClaudeMd,
    userSkills,
    projects,
  };
}
