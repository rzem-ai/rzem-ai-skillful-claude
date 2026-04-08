import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import log from "electron-log/main.js";

import { registerIpcHandlers } from "./ipc";
import { initAutoUpdater } from "./updater";

// ESM doesn't have __dirname. We resolve it from import.meta.url so the
// preload + renderer paths below work after the bundler emits ESM .mjs.
const __dirname = dirname(fileURLToPath(import.meta.url));

// electron-log: routes main-process logs to a rotating file under
// app.getPath("userData") and to the dev console. The renderer can read
// these via the standard log file location if needed.
log.initialize();
log.transports.file.level = "info";
log.transports.console.level = "debug";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Skillful Claude",
    backgroundColor: "#0b0b0d",
    show: false,
    webPreferences: {
      // electron-vite emits the preload as ESM (.mjs). ESM preloads
      // require `sandbox: false`; the renderer is still safely walled
      // off via `contextIsolation: true` + `nodeIntegration: false`.
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // External links open in the user's browser, not a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // electron-vite injects ELECTRON_RENDERER_URL in dev. In production we
  // load the bundled HTML from out/renderer.
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  // Auto-update is a no-op in dev (electron-updater refuses to run from
  // an unpackaged app). In packaged builds it polls GitHub Releases.
  if (mainWindow) {
    initAutoUpdater(mainWindow);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
