import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

/**
 * The renderer is sandboxed and contextIsolation is on, so the only way
 * the Vue app can talk to the main process is through this bridge.
 *
 * Each method here is a thin wrapper over `ipcRenderer.invoke` (or
 * `.on` for stream subscriptions). The shapes mirror what
 * `useTauriFs.ts` used to expose so the rest of the renderer didn't
 * have to change much. The renderer-side type declarations live in
 * `electron/preload/api.d.ts`.
 */

type Json = unknown;

interface SkillsResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

interface SkillsRunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

interface SkillsChunkEvent {
  jobId: string;
  stream: "stdout" | "stderr";
  text: string;
}

interface SkillsExitEvent {
  jobId: string;
  code: number | null;
  killed: boolean;
}

interface UpdaterStatus {
  kind: "checking" | "available" | "not-available" | "progress" | "downloaded" | "error";
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  message?: string;
}

interface AppMeta {
  version: string;
  name: string;
  isPackaged: boolean;
  platform: string;
  arch: string;
}

const api = {
  // ── fs / config ──────────────────────────────────────────────────────
  fs: {
    scanWorkspace: (root: string): Promise<Json> =>
      ipcRenderer.invoke("fs:scanWorkspace", root),
    readClaudeMd: (path: string): Promise<Json> =>
      ipcRenderer.invoke("fs:readClaudeMd", path),
    writeClaudeMd: (path: string, body: string): Promise<Json> =>
      ipcRenderer.invoke("fs:writeClaudeMd", path, body),
    readSkill: (path: string): Promise<Json> =>
      ipcRenderer.invoke("fs:readSkill", path),
    writeSkill: (path: string, raw: string): Promise<Json> =>
      ipcRenderer.invoke("fs:writeSkill", path, raw),
  },

  config: {
    load: (): Promise<Json> => ipcRenderer.invoke("config:load"),
  },

  dialog: {
    openDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke("dialog:openDirectory"),
  },

  // ── skills CLI ───────────────────────────────────────────────────────
  skills: {
    /** One-shot: spawn the CLI, await exit, return full stdout/stderr. */
    run: (args: string[], opts?: SkillsRunOptions): Promise<SkillsResult> =>
      ipcRenderer.invoke("skills:run", args, opts),

    /** Streaming: spawn the CLI and return a jobId. Subscribe to chunks
     *  via `onChunk` and to completion via `onExit`. Both subscriptions
     *  return an unsubscribe function. */
    exec: (args: string[], opts?: SkillsRunOptions): Promise<string> =>
      ipcRenderer.invoke("skills:exec", args, opts),

    cancel: (jobId: string): Promise<boolean> =>
      ipcRenderer.invoke("skills:cancel", jobId),

    onChunk: (handler: (event: SkillsChunkEvent) => void): (() => void) => {
      const wrapped = (_e: IpcRendererEvent, payload: SkillsChunkEvent) =>
        handler(payload);
      ipcRenderer.on("skills:chunk", wrapped);
      return () => ipcRenderer.off("skills:chunk", wrapped);
    },

    onExit: (handler: (event: SkillsExitEvent) => void): (() => void) => {
      const wrapped = (_e: IpcRendererEvent, payload: SkillsExitEvent) =>
        handler(payload);
      ipcRenderer.on("skills:exit", wrapped);
      return () => ipcRenderer.off("skills:exit", wrapped);
    },
  },

  // ── app meta ─────────────────────────────────────────────────────────
  app: {
    meta: (): Promise<AppMeta> => ipcRenderer.invoke("app:meta"),
  },

  // ── updater ──────────────────────────────────────────────────────────
  updater: {
    check: (): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke("updater:check"),
    quitAndInstall: (): Promise<void> =>
      ipcRenderer.invoke("updater:quitAndInstall"),
    onStatus: (handler: (status: UpdaterStatus) => void): (() => void) => {
      const wrapped = (_e: IpcRendererEvent, payload: UpdaterStatus) =>
        handler(payload);
      ipcRenderer.on("updater:status", wrapped);
      return () => ipcRenderer.off("updater:status", wrapped);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;
