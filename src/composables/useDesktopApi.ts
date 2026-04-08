// Renderer-side wrapper for the Electron preload bridge.
//
// The shapes here intentionally match what `useTauriFs.ts` used to expose
// so view code (ClaudeMdView, BrowseSkillsView, ActiveSkillsView, the
// stores, etc.) can keep importing the same names. The bodies just
// forward to `window.api.*` instead of `invoke()`.

import type {
  ClaudeConfig,
  ClaudeMd,
  ProjectEntry,
  Skill,
  SkillsChunkEvent,
  SkillsExitEvent,
  SkillsResult,
  SkillsRunOptions,
  UpdaterStatus,
  UserSettings,
  WorkspaceEntry,
  WorkspaceEntryKind,
  WorkspaceScan,
} from "../../electron/preload/api";

export type {
  ClaudeConfig,
  ClaudeMd,
  ProjectEntry,
  Skill,
  SkillsChunkEvent,
  SkillsExitEvent,
  SkillsResult,
  SkillsRunOptions,
  UpdaterStatus,
  UserSettings,
  WorkspaceEntry,
  WorkspaceEntryKind,
  WorkspaceScan,
};

// ── fs / config ────────────────────────────────────────────────────────

export function scanWorkspace(root: string): Promise<WorkspaceScan> {
  return window.api.fs.scanWorkspace(root);
}

/** Loads the user's global Claude configuration plus every project listed
 *  under `~/.claude.json` → `projects`, including each project's CLAUDE.md,
 *  `.claude/settings.json`, and `.claude/skills/**\/SKILL.md` files. */
export function loadClaudeConfig(): Promise<ClaudeConfig> {
  return window.api.config.load();
}

export function readClaudeMd(path: string): Promise<ClaudeMd> {
  return window.api.fs.readClaudeMd(path);
}

export function writeClaudeMd(path: string, body: string): Promise<ClaudeMd> {
  return window.api.fs.writeClaudeMd(path, body);
}

export function readSkill(path: string): Promise<Skill> {
  return window.api.fs.readSkill(path);
}

export function writeSkill(path: string, raw: string): Promise<Skill> {
  return window.api.fs.writeSkill(path, raw);
}

// ── dialog ─────────────────────────────────────────────────────────────

export function openDirectoryDialog(): Promise<string | null> {
  return window.api.dialog.openDirectory();
}

// ── skills CLI ─────────────────────────────────────────────────────────

export function runSkills(
  args: string[],
  opts?: SkillsRunOptions,
): Promise<SkillsResult> {
  return window.api.skills.run(args, opts);
}

export function execSkills(
  args: string[],
  opts?: SkillsRunOptions,
): Promise<string> {
  return window.api.skills.exec(args, opts);
}

export function cancelSkills(jobId: string): Promise<boolean> {
  return window.api.skills.cancel(jobId);
}

export function onSkillsChunk(
  handler: (event: SkillsChunkEvent) => void,
): () => void {
  return window.api.skills.onChunk(handler);
}

export function onSkillsExit(
  handler: (event: SkillsExitEvent) => void,
): () => void {
  return window.api.skills.onExit(handler);
}

// ── updater ────────────────────────────────────────────────────────────

export function checkForUpdates(): Promise<{ ok: boolean; message?: string }> {
  return window.api.updater.check();
}

export function quitAndInstallUpdate(): Promise<void> {
  return window.api.updater.quitAndInstall();
}

export function onUpdaterStatus(
  handler: (status: UpdaterStatus) => void,
): () => void {
  return window.api.updater.onStatus(handler);
}
