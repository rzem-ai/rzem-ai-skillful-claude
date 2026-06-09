import { contextBridge, ipcRenderer } from 'electron';
import { CH, type ChangeOp, type SaveFileRequest } from '../shared/contract.js';

// The renderer is sandboxed and contextIsolation is on, so this bridge is the
// only seam through which the Vue app reaches the config engine. Every method
// is a thin wrapper over ipcRenderer.invoke for a channel declared in the
// shared contract — keep this in lockstep with electron/main/ipc.ts.
const api = {
    snapshot: () => ipcRenderer.invoke(CH.snapshot),
    setProject: (path: string | null) => ipcRenderer.invoke(CH.setProject, path),
    pickProject: () => ipcRenderer.invoke(CH.pickProject),
    setReadOnly: (value: boolean) => ipcRenderer.invoke(CH.setReadOnly, value),
    previewChange: (op: ChangeOp) => ipcRenderer.invoke(CH.previewChange, op),
    applyChange: (op: ChangeOp) => ipcRenderer.invoke(CH.applyChange, op),
    saveFile: (req: SaveFileRequest) => ipcRenderer.invoke(CH.saveFile, req),
    // Live updates: main pushes when watched config files change. Returns an
    // unsubscribe function.
    onChange: (cb: (e: { reason: string }) => void) => {
        const listener = (_evt: unknown, payload: { reason: string }) => cb(payload);
        ipcRenderer.on(CH.onChange, listener);
        return () => ipcRenderer.removeListener(CH.onChange, listener);
    },
};

contextBridge.exposeInMainWorld('api', api);

export type DesktopApi = typeof api;
