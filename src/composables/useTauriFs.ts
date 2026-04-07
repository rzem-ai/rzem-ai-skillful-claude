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
}

export interface Skill {
  path: string;
  name: string | null;
  description: string | null;
  frontmatter: Record<string, unknown>;
  body: string;
  sha256: string;
}

export function scanWorkspace(root: string): Promise<WorkspaceScan> {
  return invoke<WorkspaceScan>("scan_workspace", { root });
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
