// IPC seam. Registers every channel the renderer calls, backed by the config
// engine and the write pipeline, and pushes live snapshots when watched files
// change. Keep this list in lockstep with electron/shared/contract.ts (CH) and
// the preload bridge.

import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { CH, type ChangeOp, type SaveFileRequest, type Snapshot } from '../shared/contract.js';
import { buildSnapshot } from './engine/index.js';
import { liveEnv } from './engine/env.js';
import { applyChange, previewChange, saveFile } from './writing/apply.js';
import { currentProject, initProjectContext, recents, setProject } from './projectContext.js';
import { ConfigWatcher } from './watch.js';

// Must match the renderer store's initial state — the UI boots with the
// read-only toggle ON and only syncs this over IPC when the user flips it.
let readOnly = true;
let watcher: ConfigWatcher | null = null;
let handlersRegistered = false;

// Detected lazily from the local CLI; empty until known. The sidebar falls
// back to a plain "Claude Code" label, so an unknown version is never faked.
let claudeVersion = process.env.CLAUDE_CODE_VERSION ?? '';

function detectClaudeVersion(): void {
    if (claudeVersion) return;
    // Packaged GUI apps get a minimal PATH on macOS, so also try the common
    // install location. First responder wins; failures leave version unknown.
    const candidates = ['claude', join(homedir(), '.local', 'bin', 'claude')];
    for (const bin of candidates) {
        execFile(bin, ['--version'], { timeout: 3000 }, (err, stdout) => {
            if (claudeVersion || err) return;
            const m = /\d+(?:\.\d+)+/.exec(stdout);
            if (m) claudeVersion = `Claude Code ${m[0]}`;
        });
    }
}

function snapshot(): Snapshot {
    const env = liveEnv(currentProject());
    return buildSnapshot(env, recents(), claudeVersion);
}

// Handlers must not capture a BrowserWindow: on macOS the window is destroyed
// and re-created on dock re-activate while ipcMain handlers live on.
function anyWindow(): BrowserWindow | undefined {
    return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
}

function broadcast(reason: string): void {
    for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send(CH.onChange, { reason });
    }
}

function restartWatcher(): void {
    watcher?.stop();
    watcher = new ConfigWatcher(liveEnv(currentProject()), broadcast);
    watcher.start();
}

export function registerIpc(): void {
    initProjectContext();
    restartWatcher();
    detectClaudeVersion();

    // Handlers are global to ipcMain; only attach them once even though a new
    // window (and watcher) may be created on macOS "activate".
    if (handlersRegistered) return;
    handlersRegistered = true;

    ipcMain.handle(CH.snapshot, () => snapshot());

    ipcMain.handle(CH.setProject, (_e, path: string | null) => {
        setProject(typeof path === 'string' || path === null ? path : null);
        restartWatcher();
        return snapshot();
    });

    ipcMain.handle(CH.pickProject, async () => {
        const win = anyWindow();
        const opts = { properties: ['openDirectory' as const], title: 'Choose a project folder' };
        const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
        if (res.canceled || !res.filePaths[0]) return snapshot();
        setProject(res.filePaths[0]);
        restartWatcher();
        return snapshot();
    });

    ipcMain.handle(CH.setReadOnly, (_e, value: boolean) => {
        readOnly = value === true;
        return readOnly;
    });

    ipcMain.handle(CH.previewChange, (_e, op: ChangeOp) => previewChange(op, liveEnv(currentProject())));

    ipcMain.handle(CH.applyChange, (_e, op: ChangeOp) => applyChange(op, liveEnv(currentProject()), readOnly));

    ipcMain.handle(CH.saveFile, (_e, req: SaveFileRequest) => saveFile(req.realPath, req.content, readOnly, liveEnv(currentProject())));
}

export function disposeIpc(): void {
    watcher?.stop();
    watcher = null;
}
