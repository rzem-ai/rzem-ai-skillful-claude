import { contextBridge } from "electron";

/**
 * The renderer is sandboxed and contextIsolation is on, so the only way
 * the Vue app can talk to the main process is through this bridge.
 *
 * The v1 surface (fs, config, skills CLI, updater) was stripped. This is
 * the empty template: add namespaced wrappers over `ipcRenderer.invoke`
 * here, mirror them in the main process (electron/main/index.ts) and in
 * the renderer type declarations (electron/preload/api.d.ts).
 */
const api = {};

contextBridge.exposeInMainWorld("api", api);

export type DesktopApi = typeof api;
