import { ipcMain, dialog, BrowserWindow } from "electron";
import log from "electron-log/main";

import {
  scanWorkspace,
  readClaudeMd,
  writeClaudeMd,
  readSkill,
  writeSkill,
} from "./fs";
import { loadClaudeConfig } from "./config";
import {
  runSkillsCli,
  startSkillsCli,
  cancelSkillsJob,
} from "./skills-cli";
import { checkForUpdatesNow, quitAndInstall } from "./updater";

/**
 * Single source of truth for the renderer↔main IPC surface.
 *
 * Channel naming convention: `<namespace>:<verb>` (e.g. `fs:scanWorkspace`).
 * The preload (electron/preload/index.ts) exposes a typed wrapper around
 * each channel as `window.api.*`. The renderer composable
 * (`src/composables/useDesktopApi.ts`) then re-exports those wrappers
 * with the same shapes the old Tauri code used, so view code is
 * unchanged downstream.
 *
 * Streaming events go the other way: main → renderer via
 * `webContents.send`. Channels: `skills:chunk` and `skills:exit` for
 * the live terminal, `updater:status` for auto-update progress.
 */
export function registerIpcHandlers(): void {
  // ── fs / config ────────────────────────────────────────────────────────
  ipcMain.handle("fs:scanWorkspace", async (_e, root: string) =>
    scanWorkspace(root),
  );
  ipcMain.handle("fs:readClaudeMd", async (_e, path: string) =>
    readClaudeMd(path),
  );
  ipcMain.handle("fs:writeClaudeMd", async (_e, path: string, body: string) =>
    writeClaudeMd(path, body),
  );
  ipcMain.handle("fs:readSkill", async (_e, path: string) => readSkill(path));
  ipcMain.handle("fs:writeSkill", async (_e, path: string, raw: string) =>
    writeSkill(path, raw),
  );
  ipcMain.handle("config:load", async () => loadClaudeConfig());

  // ── dialog (replaces tauri-plugin-dialog) ──────────────────────────────
  ipcMain.handle("dialog:openDirectory", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── skills CLI: one-shot ──────────────────────────────────────────────
  // Used by view code that just wants the final stdout/stderr (e.g. for
  // populating a list of installed skills).
  ipcMain.handle(
    "skills:run",
    async (_e, args: string[], opts?: { cwd?: string; env?: Record<string, string> }) =>
      runSkillsCli(args, opts ?? {}),
  );

  // ── skills CLI: streaming ──────────────────────────────────────────────
  // The PrimeVue Terminal view starts a job, gets a jobId, and listens for
  // `skills:chunk` / `skills:exit` events. We forward each chunk via
  // webContents.send so it shows up live in the UI.
  ipcMain.handle(
    "skills:exec",
    async (
      event,
      args: string[],
      opts?: { cwd?: string; env?: Record<string, string> },
    ) => {
      const sender = event.sender;
      const jobId = startSkillsCli(
        args,
        opts ?? {},
        (chunk) => {
          if (!sender.isDestroyed()) sender.send("skills:chunk", chunk);
        },
        (exit) => {
          if (!sender.isDestroyed()) sender.send("skills:exit", exit);
        },
      );
      return jobId;
    },
  );

  ipcMain.handle("skills:cancel", async (_e, jobId: string) =>
    cancelSkillsJob(jobId),
  );

  // ── updater ────────────────────────────────────────────────────────────
  ipcMain.handle("updater:check", async () => checkForUpdatesNow());
  ipcMain.handle("updater:quitAndInstall", async () => {
    quitAndInstall();
  });

  log.info("ipc: handlers registered");
}
