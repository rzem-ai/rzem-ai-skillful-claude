// Renderer-side type declarations for the bridge exposed by
// electron/preload/index.ts. The runtime object lives at `window.api` after
// `contextBridge.exposeInMainWorld("api", api)`. Kept in lockstep with the
// preload wrappers and the shared IPC contract.

import type { ApplyPreview, ChangeOp, SaveFileRequest, Snapshot, WriteResult } from '../shared/contract';

export interface DesktopApi {
    snapshot: () => Promise<Snapshot>;
    setProject: (path: string | null) => Promise<Snapshot>;
    pickProject: () => Promise<Snapshot>;
    setReadOnly: (value: boolean) => Promise<boolean>;
    previewChange: (op: ChangeOp) => Promise<{ preview?: ApplyPreview; blocked?: string }>;
    applyChange: (op: ChangeOp) => Promise<WriteResult>;
    saveFile: (req: SaveFileRequest) => Promise<WriteResult>;
    onChange: (cb: (e: { reason: string }) => void) => () => void;
}

declare global {
    interface Window {
        api: DesktopApi;
    }
}

export {};
