// Write-target resolver + apply pipeline. Given a guided change and the user's
// scope intent, it determines the correct destination file, refuses invalid
// placements (managed = read-only; auto mode = user only), and produces both a
// file diff and the effective-config diff before anything touches disk.

import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { ApplyPreview, ChangeOp, DiffLine, McpServerInput, ScopeId, WriteResult } from '../../shared/contract.js';
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

function ensureObj(parent: Record<string, unknown>, key: string): Record<string, unknown> {
    if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {};
    return parent[key] as Record<string, unknown>;
}

function blockedResult(reason: string): Resolved {
    return { targetPath: '', display: '', before: {}, after: {}, blocked: reason };
}

// Render the on-disk MCP server definition from the form input. stdio servers
// carry `command`/`args`; http & sse carry `type` + `url`. The engine's
// transport inference reads exactly these shapes back.
function serverToDef(s: McpServerInput): Record<string, unknown> {
    if (s.transport === 'stdio') {
        const def: Record<string, unknown> = { command: s.command ?? '' };
        if (s.args && s.args.length) def.args = s.args;
        if (s.env && Object.keys(s.env).length) def.env = s.env;
        return def;
    }
    const def: Record<string, unknown> = { type: s.transport, url: s.url ?? '' };
    if (s.env && Object.keys(s.env).length) def.env = s.env;
    return def;
}

// MCP servers do not live in settings.json. Project servers go in .mcp.json;
// user servers in ~/.claude.json (mcpServers); local servers in ~/.claude.json
// under projects[<projectDir>].mcpServers.
function resolveMcpWrite(op: Extract<ChangeOp, { kind: 'addMcpServer' | 'removeMcpServer' }>, env: EngineEnv): Resolved {
    const p = paths(env);
    if (op.scope === 'user') {
        const targetPath = p.globalState;
        const before = readJson(targetPath);
        const after = clone(before);
        mutateServers(ensureObj(after, 'mcpServers'), op);
        return { targetPath, display: shortPath(targetPath, env), before, after };
    }
    if (!env.projectDir) {
        return blockedResult('No project is selected, so project/local MCP servers cannot be written. Pick a project first.');
    }
    if (op.scope === 'project') {
        const targetPath = p.projectMcp!;
        const before = readJson(targetPath);
        const after = clone(before);
        mutateServers(ensureObj(after, 'mcpServers'), op);
        return { targetPath, display: shortPath(targetPath, env), before, after };
    }
    // local → ~/.claude.json · projects[<dir>].mcpServers
    const targetPath = p.globalState;
    const before = readJson(targetPath);
    const after = clone(before);
    const projects = ensureObj(after, 'projects');
    const proj = ensureObj(projects, env.projectDir);
    mutateServers(ensureObj(proj, 'mcpServers'), op);
    return { targetPath, display: shortPath(targetPath, env), before, after };
}

function mutateServers(servers: Record<string, unknown>, op: Extract<ChangeOp, { kind: 'addMcpServer' | 'removeMcpServer' }>): void {
    if (op.kind === 'addMcpServer') servers[op.name] = serverToDef(op.server);
    else delete servers[op.name];
}

// Turn an op + scope into a concrete file mutation, or a block reason.
export function resolveWrite(op: ChangeOp, env: EngineEnv): Resolved {
    const scope = op.scope;
    if (scope === 'managed' || scope === 'cli') {
        return blockedResult('Managed and CLI scopes are read-only — the app never writes to policy-controlled locations.');
    }

    // MCP ops target .mcp.json / ~/.claude.json, not settings.json.
    if (op.kind === 'addMcpServer' || op.kind === 'removeMcpServer') {
        return resolveMcpWrite(op, env);
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

    switch (op.kind) {
        case 'setDefaultMode':
            ensurePerms(after).defaultMode = op.mode;
            break;
        case 'removeDefaultMode': {
            const perms = ensurePerms(after);
            delete perms.defaultMode;
            if (Object.keys(perms).length === 0) delete after.permissions;
            break;
        }
        case 'addRule': {
            const perms = ensurePerms(after);
            const list = Array.isArray(perms[op.beh]) ? (perms[op.beh] as string[]) : [];
            if (!list.includes(op.spec)) list.push(op.spec);
            perms[op.beh] = list;
            break;
        }
        case 'removeRule': {
            const perms = ensurePerms(after);
            const list = Array.isArray(perms[op.beh]) ? (perms[op.beh] as string[]) : [];
            perms[op.beh] = list.filter((s) => s !== op.spec);
            break;
        }
        case 'reorderRules': {
            // Rewrite the visible specs into the desired order, leaving any
            // file-only entries (deduped losers) pinned to their original slots.
            const perms = ensurePerms(after);
            const cur = Array.isArray(perms[op.beh]) ? (perms[op.beh] as string[]) : [];
            const desired = op.specs.filter((s) => cur.includes(s));
            let di = 0;
            perms[op.beh] = cur.map((s) => (op.specs.includes(s) ? desired[di++] : s));
            break;
        }
        case 'setScalar':
            after[op.key] = op.value;
            break;
        case 'removeScalar':
            delete after[op.key];
            break;
        case 'setEnvVar':
            ensureObj(after, 'env')[op.name] = op.value;
            break;
        case 'removeEnvVar': {
            const e = ensureObj(after, 'env');
            delete e[op.name];
            if (Object.keys(e).length === 0) delete after.env;
            break;
        }
    }

    return { targetPath, display: shortPath(targetPath, env), before, after };
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
    if (op.kind === 'removeRule') {
        return { lines: [{ add: false, text: `${op.beh} ${op.spec} (${op.scope})` }], note: 'Rule removed from the effective permission list.' };
    }
    if (op.kind === 'reorderRules') {
        return {
            lines: op.specs.map((s, i) => ({ add: true, text: `${i + 1}. ${op.beh} ${s}` })),
            note: `Evaluation order of ${op.scope} ${op.beh} rules rewritten — first match still wins.`,
        };
    }

    // Scalar (model, effortLevel, …) and env vars resolve by scope override —
    // recompute the effective winner with `after` swapped into the op's scope.
    if (op.kind === 'setScalar' || op.kind === 'removeScalar' || op.kind === 'setEnvVar' || op.kind === 'removeEnvVar') {
        const key = op.kind === 'setEnvVar' || op.kind === 'removeEnvVar' ? `env.${op.name}` : op.key;
        const before = scalarWinner(discoverSources(env), key);
        const patched = patchScope(discoverSources(env), op.scope, after);
        const win = scalarWinner(patched, key);
        const beforeStr = before ? `${key} = ${render(before.value)} (${before.scope})` : `${key} unset`;
        const afterStr = win ? `${key} = ${render(win.value)} (${win.scope})` : `${key} unset`;
        if (beforeStr === afterStr) {
            return { lines: [{ add: true, text: afterStr + ' — no change to effective value' }], note: 'This scope is shadowed by a higher-precedence one; the change has no visible effect.' };
        }
        return {
            lines: [
                { add: false, text: beforeStr },
                { add: true, text: afterStr },
            ],
            note: 'This is the resolved result after merge — what the agent will actually see.',
        };
    }

    // MCP add/remove — collisions resolve Local › Project › User, so report the
    // placement and whether it can win.
    if (op.kind === 'addMcpServer') {
        return { lines: [{ add: true, text: `${op.name} → ${mcpTargetLabel(op.server)} (${op.scope})` }], note: 'Server merged into the MCP map. If the same name exists at a higher-precedence scope it stays shadowed.' };
    }
    return { lines: [{ add: false, text: `${op.name} (${op.scope})` }], note: 'Server removed from the MCP map.' };
}

// Pull a (possibly dotted, one level) scalar out of one scope object.
function getScalar(obj: Record<string, unknown>, key: string): unknown {
    if (key.includes('.')) {
        const [head, tail] = key.split('.', 2);
        const sub = obj[head];
        return sub && typeof sub === 'object' ? (sub as Record<string, unknown>)[tail] : undefined;
    }
    return obj[key];
}

// Effective scalar winner: managed › local › project › user (first defined).
function scalarWinner(src: ReturnType<typeof discoverSources>, key: string): { value: unknown; scope: ScopeId } | null {
    const order: [ScopeId, Record<string, unknown>][] = [
        ['managed', src.managed],
        ['local', src.local],
        ['project', src.project],
        ['user', src.user],
    ];
    for (const [scope, obj] of order) {
        const v = getScalar(obj, key);
        if (v !== undefined) return { value: v, scope };
    }
    return null;
}

function patchScope(src: ReturnType<typeof discoverSources>, scope: ScopeId, after: Record<string, unknown>): ReturnType<typeof discoverSources> {
    return {
        ...src,
        managed: scope === 'managed' ? after : src.managed,
        user: scope === 'user' ? after : src.user,
        project: scope === 'project' ? after : src.project,
        local: scope === 'local' ? after : src.local,
    };
}

function render(v: unknown): string {
    return typeof v === 'string' ? v : JSON.stringify(v);
}

function mcpTargetLabel(s: McpServerInput): string {
    if (s.transport === 'stdio') return [s.command, ...(s.args ?? [])].filter(Boolean).join(' ') || '—';
    return s.url || '—';
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

// The raw-save path takes a renderer-supplied absolute path, so it gets an
// explicit allowlist: only the config files the engine itself surfaces may be
// written. applyChange is safe without this — resolveWrite derives its target
// from paths(env), never from the op payload.
export function isAllowedWritePath(realPath: string, env: EngineEnv): boolean {
    const abs = resolve(realPath);
    if (abs.includes('\0')) return false;
    const exactFiles = [
        join(env.home, '.claude.json'),
        env.projectDir ? join(env.projectDir, '.mcp.json') : null,
        env.projectDir ? join(env.projectDir, 'CLAUDE.md') : null,
        env.projectDir ? join(env.projectDir, 'CLAUDE.local.md') : null,
    ].filter((x): x is string => !!x);
    const dirs = [join(env.home, '.claude'), env.projectDir ? join(env.projectDir, '.claude') : null].filter((x): x is string => !!x);
    return exactFiles.some((f) => abs === resolve(f)) || dirs.some((d) => abs.startsWith(resolve(d) + sep));
}

// Direct file save (Raw Editor). Validates JSON for .json files before writing.
export function saveFile(realPath: string, content: string, readOnly: boolean, env: EngineEnv): WriteResult {
    if (readOnly) return { ok: false, blocked: 'Read-only mode is on — writes are disabled.' };
    if (!realPath) return { ok: false, blocked: 'This file is read-only.' };
    if (!isAllowedWritePath(realPath, env)) return { ok: false, blocked: 'Refusing to write outside the Claude Code config files.' };
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
