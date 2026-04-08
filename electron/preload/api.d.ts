// Renderer-side type declarations for the bridge exposed by
// `electron/preload/index.ts`. The runtime object lives at `window.api`
// after `contextBridge.exposeInMainWorld("api", api)`.
//
// Models below match the Rust → TS shapes that used to come back from
// `useTauriFs.ts`. The renderer composable
// (`src/composables/useDesktopApi.ts`) re-exports these so view code can
// use the same names it always did.

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

export interface UserSettings {
  path: string;
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

export interface SkillsResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface SkillsRunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export interface SkillsChunkEvent {
  jobId: string;
  stream: "stdout" | "stderr";
  text: string;
}

export interface SkillsExitEvent {
  jobId: string;
  code: number | null;
  killed: boolean;
}

export interface UpdaterStatus {
  kind:
    | "checking"
    | "available"
    | "not-available"
    | "progress"
    | "downloaded"
    | "error";
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  message?: string;
}

export interface DesktopApi {
  fs: {
    scanWorkspace: (root: string) => Promise<WorkspaceScan>;
    readClaudeMd: (path: string) => Promise<ClaudeMd>;
    writeClaudeMd: (path: string, body: string) => Promise<ClaudeMd>;
    readSkill: (path: string) => Promise<Skill>;
    writeSkill: (path: string, raw: string) => Promise<Skill>;
  };
  config: {
    load: () => Promise<ClaudeConfig>;
  };
  dialog: {
    openDirectory: () => Promise<string | null>;
  };
  skills: {
    run: (args: string[], opts?: SkillsRunOptions) => Promise<SkillsResult>;
    exec: (args: string[], opts?: SkillsRunOptions) => Promise<string>;
    cancel: (jobId: string) => Promise<boolean>;
    onChunk: (handler: (event: SkillsChunkEvent) => void) => () => void;
    onExit: (handler: (event: SkillsExitEvent) => void) => () => void;
  };
  updater: {
    check: () => Promise<{ ok: boolean; message?: string }>;
    quitAndInstall: () => Promise<void>;
    onStatus: (handler: (status: UpdaterStatus) => void) => () => void;
  };
}

declare global {
  interface Window {
    api: DesktopApi;
  }
}

export {};
