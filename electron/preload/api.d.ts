// Renderer-side type declarations for the bridge exposed by
// `electron/preload/index.ts`. The runtime object lives at `window.api`
// after `contextBridge.exposeInMainWorld("api", api)`.
//
// The v1 surface was stripped. Grow this interface as the rebuild adds
// IPC channels, keeping it in lockstep with the preload and main process.

export interface DesktopApi {
  // Add namespaced method groups here, e.g.:
  //   fs: { read: (path: string) => Promise<string> };
}

declare global {
  interface Window {
    api: DesktopApi;
  }
}

export {};
