// File watchers. External edits — including Claude Code writing its own config
// — trigger a re-resolution so all three workspaces stay live. Watches the
// handful of directories that hold config and debounces bursts.

import { watch, type FSWatcher } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { type EngineEnv, paths } from './engine/env.js';

export class ConfigWatcher {
    private watchers: FSWatcher[] = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(
        private env: EngineEnv,
        private onChange: (reason: string) => void,
    ) {}

    start(): void {
        this.stop();
        const p = paths(this.env);
        const dirs = new Set<string>();
        const candidates = [
            p.userSettings,
            p.globalState,
            p.userMemory,
            p.managedBase,
            p.projectSettings,
            p.localSettings,
            p.projectMcp,
            p.projectMemory,
        ].filter((x): x is string => !!x);
        for (const f of candidates) dirs.add(dirname(f));
        if (existsSync(p.managedDropinDir)) dirs.add(p.managedDropinDir);

        for (const dir of dirs) {
            if (!existsSync(dir)) continue;
            try {
                const w = watch(dir, { persistent: false }, (_evt, filename) => {
                    if (filename && String(filename).endsWith('.tmp')) return; // ignore our own atomic temps
                    this.fire(filename ? String(filename) : dir);
                });
                this.watchers.push(w);
            } catch {
                /* directory may be unwatchable (managed paths) — skip */
            }
        }
    }

    private fire(reason: string): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.onChange(reason), 150);
    }

    stop(): void {
        for (const w of this.watchers) {
            try {
                w.close();
            } catch {
                /* ignore */
            }
        }
        this.watchers = [];
        if (this.timer) clearTimeout(this.timer);
    }
}
