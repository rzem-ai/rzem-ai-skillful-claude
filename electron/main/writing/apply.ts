// Write-target resolver + apply pipeline. Given a guided change and the user's
// scope intent, it determines the correct destination file, refuses invalid
// placements (managed = read-only; auto mode = user only), and produces both a
// file diff and the effective-config diff before anything touches disk.

import { readFileSync } from 'node:fs';
import type { ApplyPreview, ChangeOp, DiffLine, ScopeId, WriteResult } from '../../shared/contract.js';
import { type EngineEnv, paths } from '../engine/env.js';
import { discoverSources } from '../engine/sources.js';
import { effectiveDefaultMode } from '../engine/permissions.js';
import { backupFile } from './backup.js';
import { atomicWrite } from './atomic.js';

interface Resolved {
    targetPath: string;
    display: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    blocked?: string;
}

function settingsPathFor(scope: ScopeId, env: EngineEnv): string | null {
    const p = paths(env);
    if (scope === 'user') return p.userSettings;
    if (scope === 'project') return p.projectSettings;
    if (scope === 'local') return p.localSettings;
    return null;
}

function readJson(path: string): Record<string, unknown> {
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

function ensurePerms(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj.permissions || typeof obj.permissions !== 'object') obj.permissions = {};
    return obj.permissions as Record<string, unknown>;
}

// Turn an op + scope into a concrete file mutation, or a block reason.
export function resolveWrite(op: ChangeOp, env: EngineEnv): Resolved {
    const scope = op.scope;
    if (scope === 'managed' || scope === 'cli') {
        return blockedResult('Managed and CLI scopes are read-only — the app never writes to policy-controlled locations.');
    }
    const targetPath = settingsPathFor(scope, env);
    if (!targetPath) {
        return blockedResult('No project is selected, so project/local settings cannot be written. Pick a project first.');
    }

    // auto mode is honoured only from user settings (v2.1.142).
    if (op.kind === 'setDefaultMode' && op.mode === 'auto' && scope !== 'user') {
        return blockedResult('“auto” mode can only be set in user settings — it is silently ignored in project/local.');
    }

    const before = readJson(targetPath);
    const after = clone(before);
    const perms = ensurePerms(after);

    switch (op.kind) {
        case 'setDefaultMode':
            perms.defaultMode = op.mode;
            break;
        case 'removeDefaultMode':
            delete perms.defaultMode;
            if (Object.keys(perms).length === 0) delete after.permissions;
            break;
        case 'addRule': {
            const list = Array.isArray(perms[op.beh]) ? (perms[op.beh] as string[]) : [];
            if (!list.includes(op.spec)) list.push(op.spec);
            perms[op.beh] = list;
            break;
        }
        case 'removeRule': {
            const list = Array.isArray(perms[op.beh]) ? (perms[op.beh] as string[]) : [];
            perms[op.beh] = list.filter((s) => s !== op.spec);
            break;
        }
    }

    return { targetPath, display: shortPath(targetPath, env), before, after };

    function blockedResult(reason: string): Resolved {
        return { targetPath: '', display: '', before: {}, after: {}, blocked: reason };
    }
}

function shortPath(abs: string, env: EngineEnv): string {
    if (env.projectDir && abs.startsWith(env.projectDir + '/')) return abs.slice(env.projectDir.length + 1);
    if (abs.startsWith(env.home + '/')) return '~/' + abs.slice(env.home.length + 1);
    return abs;
}

// Naive line diff between two JSON renderings.
function diffJson(before: Record<string, unknown>, after: Record<string, unknown>): DiffLine[] {
    const a = JSON.stringify(before, null, 2).split('\n');
    const b = JSON.stringify(after, null, 2).split('\n');
    const setA = new Set(a);
    const setB = new Set(b);
    const out: DiffLine[] = [];
    for (const line of a) if (!setB.has(line)) out.push({ add: false, text: line.trim() });
    for (const line of b) if (!setA.has(line)) out.push({ add: true, text: line.trim() });
    return out;
}

// Effective-config diff: what actually changes after the merge.
function effectiveDiff(op: ChangeOp, env: EngineEnv, after: Record<string, unknown>): { lines: DiffLine[]; note: string } {
    if (op.kind === 'setDefaultMode' || op.kind === 'removeDefaultMode') {
        const beforeSnap = discoverSources(env);
        const beforeVal = effectiveDefaultMode(beforeSnap);
        const afterVal = simulateDefaultMode(env, op.scope, after);
        if (beforeVal === afterVal) {
            return { lines: [{ add: true, text: `defaultMode = ${afterVal} (no change to effective value)` }], note: 'This scope is shadowed — the change has no visible effect.' };
        }
        return {
            lines: [
                { add: false, text: `defaultMode = ${beforeVal} (was)` },
                { add: true, text: `defaultMode = ${afterVal} (now)` },
            ],
            note: 'This is the resolved result after merge — what the agent will actually see.',
        };
    }
    if (op.kind === 'addRule') {
        return { lines: [{ add: true, text: `${op.beh} ${op.spec} (${op.scope})` }], note: 'Rule merged into the effective permission list.' };
    }
    return { lines: [{ add: false, text: `${op.beh} ${op.spec} (${op.scope})` }], note: 'Rule removed from the effective permission list.' };
}

// Recompute effective defaultMode as if `after` replaced the op's scope object.
function simulateDefaultMode(env: EngineEnv, scope: ScopeId, after: Record<string, unknown>): string {
    const src = discoverSources(env);
    const patched = {
        ...src,
        managed: scope === 'managed' ? after : src.managed,
        user: scope === 'user' ? after : src.user,
        project: scope === 'project' ? after : src.project,
        local: scope === 'local' ? after : src.local,
    } as typeof src;
    return effectiveDefaultMode(patched);
}

export function previewChange(op: ChangeOp, env: EngineEnv): { preview?: ApplyPreview; blocked?: string } {
    const r = resolveWrite(op, env);
    if (r.blocked) return { blocked: r.blocked };
    const eff = effectiveDiff(op, env, r.after);
    return {
        preview: {
            file: { path: r.display, lines: diffJson(r.before, r.after) },
            effective: eff.lines,
            note: eff.note,
        },
    };
}

export function applyChange(op: ChangeOp, env: EngineEnv, readOnly: boolean): WriteResult {
    if (readOnly) return { ok: false, blocked: 'Read-only mode is on — writes are disabled.' };
    const r = resolveWrite(op, env);
    if (r.blocked) return { ok: false, blocked: r.blocked };
    try {
        const backupPath = backupFile(r.targetPath);
        atomicWrite(r.targetPath, JSON.stringify(r.after, null, 2) + '\n');
        return { ok: true, backupPath };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

// Direct file save (Raw Editor). Validates JSON for .json files before writing.
export function saveFile(realPath: string, content: string, readOnly: boolean): WriteResult {
    if (readOnly) return { ok: false, blocked: 'Read-only mode is on — writes are disabled.' };
    if (!realPath) return { ok: false, blocked: 'This file is read-only.' };
    if (realPath.endsWith('.json')) {
        try {
            JSON.parse(content);
        } catch (err) {
            return { ok: false, error: `Refusing to save invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
        }
    }
    try {
        const backupPath = backupFile(realPath);
        atomicWrite(realPath, content);
        return { ok: true, backupPath };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
