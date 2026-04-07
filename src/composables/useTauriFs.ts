import { invoke } from "@tauri-apps/api/core";

export type WorkspaceEntryKind = "claudemd" | "skill";

export interface WorkspaceEntry {
  path: string;
  kind: WorkspaceEntryKind;
  displayName: string;
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
  /** POSIX mtime in seconds since the epoch, or null if stat failed. */
  modifiedAt: number | null;
}

export interface Skill {
  path: string;
  name: string | null;
  description: string | null;
  frontmatter: Record<string, unknown>;
  body: string;
  sha256: string;
  /** POSIX mtime in seconds since the epoch, or null if stat failed. */
  modifiedAt: number | null;
}

export interface UserSettings {
  path: string;
  /** Parsed JSON body — left as `unknown` because the Claude Code settings
   *  schema is still in flux; consumers should narrow as needed. */
  raw: unknown;
  sha256: string;
}

export interface ProjectEntry {
  /** Absolute project root (the key from `~/.claude.json` → `projects`). */
  path: string;
  /** False when the project directory no longer exists on disk. */
  exists: boolean;
  /** The per-project value object from `~/.claude.json` → `projects[path]`. */
  config: unknown;
  claudeMd: ClaudeMd | null;
  localSettings: UserSettings | null;
  localSkills: Skill[];
}

export interface ClaudeConfig {
  home: string;
  userDir: string;
  userConfigPath: string;
  /** Full parsed `~/.claude.json` so callers can read any field they need. */
  userConfigRaw: unknown;
  userSettings: UserSettings | null;
  userClaudeMd: ClaudeMd | null;
  userSkills: Skill[];
  projects: ProjectEntry[];
}

export function scanWorkspace(root: string): Promise<WorkspaceScan> {
  return invoke<WorkspaceScan>("scan_workspace", { root });
}

/** Loads the user's global Claude configuration plus every project listed
 *  under `~/.claude.json` → `projects`, including each project's CLAUDE.md,
 *  `.claude/settings.json`, and `.claude/skills/**\/SKILL.md` files. */
export function loadClaudeConfig(): Promise<ClaudeConfig> {
  return invoke<ClaudeConfig>("load_claude_config");
}

export function readClaudeMd(path: string): Promise<ClaudeMd> {
  return invoke<ClaudeMd>("read_claude_md", { path });
}

export function writeClaudeMd(path: string, body: string): Promise<ClaudeMd> {
  return invoke<ClaudeMd>("write_claude_md", { path, body });
}

export function readSkill(path: string): Promise<Skill> {
  return invoke<Skill>("read_skill", { path });
}

export function writeSkill(path: string, raw: string): Promise<Skill> {
  return invoke<Skill>("write_skill", { path, raw });
}
