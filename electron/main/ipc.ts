// IPC seam. Registers every channel the renderer calls, backed by the config
// engine and the write pipeline, and pushes live snapshots when watched files
// change. Keep this list in lockstep with electron/shared/contract.ts (CH) and
// the preload bridge.

import { BrowserWindow, dialog, ipcMain } from 'electron';
import { CH, type ChangeOp, type SaveFileRequest, type Snapshot } from '../shared/contract.js';
import { buildSnapshot } from './engine/index.js';
import { liveEnv } from './engine/env.js';
import { applyChange, previewChange, saveFile } from './writing/apply.js';
import { currentProject, initProjectContext, recents, setProject } from './projectContext.js';
import { ConfigWatcher } from './watch.js';

let readOnly = false;
let watcher: ConfigWatcher | null = null;
let handlersRegistered = false;

function snapshot(): Snapshot {
    const env = liveEnv(currentProject());
    return buildSnapshot(env, recents(), detectClaudeVersion());
}

function detectClaudeVersion(): string {
    return process.env.CLAUDE_CODE_VERSION || 'Claude Code 2.1.x';
}

function restartWatcher(win: BrowserWindow): void {
    watcher?.stop();
    const env = liveEnv(currentProject());
    watcher = new ConfigWatcher(env, (reason) => {
        if (!win.isDestroyed()) win.webContents.send(CH.onChange, { reason });
    });
    watcher.start();
}

export function registerIpc(win: BrowserWindow): void {
    initProjectContext();
    restartWatcher(win);

    // Handlers are global to ipcMain; only attach them once even though a new
    // window (and watcher) may be created on macOS "activate".
    if (handlersRegistered) return;
    handlersRegistered = true;

    ipcMain.handle(CH.snapshot, () => snapshot());

    ipcMain.handle(CH.setProject, (_e, path: string | null) => {
        setProject(path);
        restartWatcher(win);
        return snapshot();
    });

    ipcMain.handle(CH.pickProject, async () => {
        const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose a project folder' });
        if (res.canceled || !res.filePaths[0]) return snapshot();
        setProject(res.filePaths[0]);
        restartWatcher(win);
        return snapshot();
    });

    ipcMain.handle(CH.setReadOnly, (_e, value: boolean) => {
        readOnly = value;
        return readOnly;
    });

    ipcMain.handle(CH.previewChange, (_e, op: ChangeOp) => previewChange(op, liveEnv(currentProject())));

    ipcMain.handle(CH.applyChange, (_e, op: ChangeOp) => applyChange(op, liveEnv(currentProject()), readOnly));

    ipcMain.handle(CH.saveFile, (_e, req: SaveFileRequest) => saveFile(req.realPath, req.content, readOnly));

    ipcMain.handle(CH.revealSecret, (_e, _key: string) => ({ ok: true }));
}

export function disposeIpc(): void {
    watcher?.stop();
    watcher = null;
}
