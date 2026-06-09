// Project Context Manager — the app's equivalent of cwd. Tracks the active
// project (which drives project/local source resolution) and the recents list,
// persisted to userData so the choice survives restarts. Without a project,
// only user/managed/global sources resolve.

import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { RecentProject } from '../shared/contract.js';
import { atomicWrite } from './writing/atomic.js';

interface State {
    current: string | null;
    recents: RecentProject[];
}

let state: State = { current: null, recents: [] };
let statePath = '';

export function initProjectContext(): void {
    statePath = join(app.getPath('userData'), 'skillful-state.json');
    try {
        state = JSON.parse(readFileSync(statePath, 'utf8')) as State;
    } catch {
        // First run: default to the launch cwd if it looks like a project.
        const cwd = process.cwd();
        const looksLikeProject = existsSync(join(cwd, '.git')) || existsSync(join(cwd, '.claude'));
        state = { current: looksLikeProject ? cwd : null, recents: [] };
        if (state.current) addRecent(state.current);
    }
}

export function currentProject(): string | null {
    return state.current;
}

export function recents(): RecentProject[] {
    return state.recents;
}

export function setProject(path: string | null): void {
    state.current = path;
    if (path) addRecent(path);
    persist();
}

function addRecent(path: string): void {
    state.recents = [{ name: basename(path), path }, ...state.recents.filter((r) => r.path !== path)].slice(0, 8);
}

function persist(): void {
    try {
        atomicWrite(statePath, JSON.stringify(state, null, 2));
    } catch {
        /* best effort */
    }
}
