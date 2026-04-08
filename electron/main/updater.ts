import { app, BrowserWindow } from "electron";
import log from "electron-log/main";
import pkg from "electron-updater";

// electron-updater is CommonJS-only; pull autoUpdater off the default
// import to avoid an ESM/CJS interop trap.
const { autoUpdater } = pkg;

/**
 * Wires electron-updater for GitHub Releases.
 *
 * Update channel: GitHub. The publish target is configured in
 * electron-builder.yml (`publish: { provider: github, owner: rzem-ai,
 * repo: rzem-ai-skillful-claude }`). electron-updater reads the same
 * config from the packaged app's app-update.yml at runtime.
 *
 * In dev (`npm run dev`) electron-updater is a no-op because the app
 * isn't packaged — it logs and returns immediately.
 */
export function initAutoUpdater(window: BrowserWindow): void {
  // Pipe updater logs into the same electron-log file the rest of the
  // main process uses. Easier to debug "why didn't it update".
  autoUpdater.logger = log;
  // electron-log accepts a transports object — typings are a little loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (autoUpdater.logger as any).transports.file.level = "info";

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (!app.isPackaged) {
    log.info("updater: skipping in dev (app is not packaged)");
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    log.info("updater: checking for update");
    window.webContents.send("updater:status", { kind: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    log.info(`updater: update available v${info.version}`);
    window.webContents.send("updater:status", {
      kind: "available",
      version: info.version,
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    log.info(`updater: up to date v${info.version}`);
    window.webContents.send("updater:status", {
      kind: "not-available",
      version: info.version,
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    window.webContents.send("updater:status", {
      kind: "progress",
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    log.info(`updater: downloaded v${info.version} — will install on quit`);
    window.webContents.send("updater:status", {
      kind: "downloaded",
      version: info.version,
    });
  });
  autoUpdater.on("error", (err) => {
    log.error(`updater: ${err.message}`);
    window.webContents.send("updater:status", {
      kind: "error",
      message: err.message,
    });
  });

  // Kick off an initial check shortly after the window is up. We don't
  // block startup on the network round-trip.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      log.error(`updater: initial check failed: ${err.message}`);
    });
  }, 5_000);
}

/** Manual trigger for the renderer's "Check for updates" button. */
export async function checkForUpdatesNow(): Promise<{ ok: boolean; message?: string }> {
  if (!app.isPackaged) {
    return { ok: false, message: "Auto-update is disabled in development." };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, message: `Checked. Latest: ${result?.updateInfo.version ?? "unknown"}` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Renderer can request "install now" once an update is downloaded. */
export function quitAndInstall(): void {
  if (!app.isPackaged) {
    log.info("updater: quitAndInstall noop in dev");
    return;
  }
  autoUpdater.quitAndInstall();
}
