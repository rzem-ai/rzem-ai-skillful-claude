import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log/main.js';
import { registerIpc, disposeIpc } from './ipc.js';

// ESM doesn't have __dirname. We resolve it from import.meta.url so the
// preload + renderer paths below work after the bundler emits ESM .mjs.
const __dirname = dirname(fileURLToPath(import.meta.url));

// electron-log: routes main-process logs to a rotating file under
// app.getPath("userData") and to the dev console.
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Last-resort handlers: without these a main-process throw kills the app with
// no trace in the log file.
process.on('uncaughtException', (err) => log.error('uncaughtException', err));
process.on('unhandledRejection', (reason) => log.error('unhandledRejection', reason));

let mainWindow: BrowserWindow | null = null;

// ── Window-state persistence ────────────────────────────────────────────────
interface WindowState {
    width: number;
    height: number;
    x?: number;
    y?: number;
}
const stateFile = () => join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): WindowState {
    try {
        const s = JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState;
        if (typeof s.width === 'number' && typeof s.height === 'number') return s;
    } catch {
        /* first run or corrupt state — fall back to defaults */
    }
    return { width: 1280, height: 800 };
}

function saveWindowState(win: BrowserWindow): void {
    try {
        if (win.isMinimized() || win.isFullScreen()) return;
        writeFileSync(stateFile(), JSON.stringify(win.getBounds()));
    } catch (err) {
        log.warn('failed to save window state', err);
    }
}

// ── Application menu ────────────────────────────────────────────────────────
const REPO_URL = 'https://github.com/rzem-ai/rzem-ai-skillful-claude';

function buildMenu(): void {
    const isMac = process.platform === 'darwin';
    const template: MenuItemConstructorOptions[] = [
        ...(isMac ? [{ role: 'appMenu' as const }] : []),
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        {
            role: 'help',
            submenu: [
                { label: 'Skillful Claude on GitHub', click: () => void shell.openExternal(REPO_URL) },
                ...(isMac ? [] : [
                    { type: 'separator' as const },
                    {
                        label: 'About Skillful Claude',
                        click: () =>
                            void dialog.showMessageBox({
                                title: 'About Skillful Claude',
                                message: 'Skillful Claude',
                                detail: `Version ${app.getVersion()}\nWhat Claude Code configuration is actually in effect, and why.\n© ${new Date().getFullYear()} rzem.ai`,
                            }),
                    },
                ]),
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
    const state = loadWindowState();
    mainWindow = new BrowserWindow({
        width: state.width,
        height: state.height,
        x: state.x,
        y: state.y,
        minWidth: 960,
        minHeight: 640,
        title: 'Skillful Claude',
        backgroundColor: '#f4f5f7',
        show: false,
        webPreferences: {
            // electron-vite emits the preload as ESM (.mjs). ESM preloads
            // require `sandbox: false`; the renderer is still safely walled
            // off via `contextIsolation: true` + `nodeIntegration: false`.
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('close', () => {
        if (mainWindow) saveWindowState(mainWindow);
    });

    // Wire the config engine + write pipeline to the renderer.
    registerIpc();

    // External links open in the user's browser, not a new Electron window.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });

    // electron-vite injects ELECTRON_RENDERER_URL in dev. In production we
    // load the bundled HTML from out/renderer.
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) {
        void mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') {
        app.setAboutPanelOptions({
            applicationName: 'Skillful Claude',
            applicationVersion: app.getVersion(),
            copyright: `© ${new Date().getFullYear()} rzem.ai`,
            credits: 'What Claude Code configuration is actually in effect, and why.',
        });
    }
    buildMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    disposeIpc();
    if (process.platform !== 'darwin') app.quit();
});
