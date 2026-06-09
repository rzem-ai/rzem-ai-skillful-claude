// The single renderer-side store over the config engine. It loads the engine
// Snapshot through the preload bridge, re-loads live when watched files change,
// and exposes per-workspace view-models plus the write actions. Every screen
// reads from here instead of inline fixtures.

import { defineStore } from 'pinia';
import type { ApplyPreview, ChangeOp, SaveFileRequest, Snapshot, WriteResult } from '@shared/contract';

interface State {
    snapshot: Snapshot | null;
    loading: boolean;
    error: string | null;
    readOnly: boolean;
    lastSync: number;
    watching: boolean;
    unsub: (() => void) | null;
}

export const useConfigStore = defineStore('config', {
    state: (): State => ({
        snapshot: null,
        loading: false,
        error: null,
        readOnly: false,
        lastSync: Date.now(),
        watching: false,
        unsub: null,
    }),

    getters: {
        ready: (s) => s.snapshot !== null,
        project: (s) => s.snapshot?.project ?? null,
        hasProject: (s) => !!s.snapshot?.project,
        recents: (s) => s.snapshot?.recents ?? [],
        counts: (s) => s.snapshot?.counts ?? { keys: 0, rules: 0, servers: 0, extensions: 0 },
        flags: (s) => s.snapshot?.flags ?? { memoryWarn: false, scopeWarn: false },
        dashboard: (s) => s.snapshot?.dashboard ?? [],
        scopeStack: (s) => s.snapshot?.scopeStack ?? [],
        permissions: (s) => s.snapshot?.permissions ?? null,
        mcp: (s) => s.snapshot?.mcp ?? [],
        memory: (s) => s.snapshot?.memory ?? null,
        extensions: (s) => s.snapshot?.extensions ?? null,
        guidedPermissions: (s) => s.snapshot?.guidedPermissions ?? null,
        raw: (s) => s.snapshot?.raw ?? null,
        claudeVersion: (s) => s.snapshot?.claudeVersion ?? '',
    },

    actions: {
        async init() {
            await this.load();
            if (!this.unsub) {
                this.watching = true;
                this.unsub = window.api.onChange(() => {
                    this.lastSync = Date.now();
                    void this.load();
                });
            }
        },

        async load() {
            this.loading = true;
            this.error = null;
            try {
                this.snapshot = await window.api.snapshot();
                this.lastSync = Date.now();
            } catch (err) {
                this.error = err instanceof Error ? err.message : String(err);
            } finally {
                this.loading = false;
            }
        },

        async pickProject() {
            this.snapshot = await window.api.pickProject();
        },

        async setProject(path: string | null) {
            this.snapshot = await window.api.setProject(path);
        },

        async toggleReadOnly() {
            this.readOnly = await window.api.setReadOnly(!this.readOnly);
            return this.readOnly;
        },

        previewChange(op: ChangeOp): Promise<{ preview?: ApplyPreview; blocked?: string }> {
            return window.api.previewChange(op);
        },

        async applyChange(op: ChangeOp): Promise<WriteResult> {
            const res = await window.api.applyChange(op);
            if (res.ok) await this.load();
            return res;
        },

        async saveFile(req: SaveFileRequest): Promise<WriteResult> {
            const res = await window.api.saveFile(req);
            if (res.ok) await this.load();
            return res;
        },
    },
});
