// Smoke test against the real machine's Claude Code config (whatever is on
// this host), pointing the project at the repo itself. Assertions are loose —
// it proves the engine reads live, possibly-sparse config without throwing and
// always returns well-formed view-models.

import { describe, expect, it } from 'vitest';
import { buildSnapshot, liveEnv } from '../index.js';

describe('engine smoke (live host config)', () => {
    it('builds a well-formed snapshot for the current repo without throwing', () => {
        const snap = buildSnapshot(liveEnv(process.cwd()));
        expect(Array.isArray(snap.dashboard)).toBe(true);
        expect(Array.isArray(snap.scopeStack)).toBe(true);
        expect(Array.isArray(snap.permissions.rules)).toBe(true);
        expect(Array.isArray(snap.mcp)).toBe(true);
        expect(snap.memory).toBeTruthy();
        expect(snap.raw.files.every((f) => Array.isArray(f.lines))).toBe(true);
        // Scope stack always renders all five precedence layers.
        expect(snap.scopeStack.map((l) => l.scope)).toEqual(['managed', 'cli', 'local', 'project', 'user']);
    });

    it('handles no-project mode', () => {
        const snap = buildSnapshot(liveEnv(null));
        expect(snap.project).toBeNull();
        expect(Array.isArray(snap.dashboard)).toBe(true);
    });
});
