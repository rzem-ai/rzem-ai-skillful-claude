// Self-contained coverage for the guided Model/Env producers and the new write
// targets (scalar, env, MCP). Builds its own temp config tree so it runs
// independently of the shared __fixtures__ ground-truth.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveGuidedModel, resolveGuidedEnv } from '../guidedConfig.js';
import { resolveWrite, applyChange } from '../../writing/apply.js';
import type { EngineEnv } from '../env.js';
import type { ChangeOp, ConfigRow } from '../../../shared/contract.js';

// ── Pure producers (over hand-built dashboard rows) ──────────────────────────

function row(key: string, value: string, scope: ConfigRow['scope'], extra: Partial<ConfigRow> = {}): ConfigRow {
    return { key, value, type: 'string', cat: 'model', scope, differ: true, conflict: false, chain: [{ scope: scope ?? 'user', value, status: 'winner', path: '—', mod: '—' }], ...extra };
}

describe('resolveGuidedModel', () => {
    it('lifts model/effort/thinking/language out of the dashboard', () => {
        const dash: ConfigRow[] = [
            row('model', 'claude-sonnet-4-6', 'project'),
            row('effortLevel', 'high', 'user'),
            row('alwaysThinkingEnabled', 'true', 'user'),
            row('language', 'english', 'user'),
        ];
        const m = resolveGuidedModel(dash);
        expect(m.model.value).toBe('claude-sonnet-4-6');
        expect(m.model.scope).toBe('project');
        expect(m.effort.value).toBe('high');
        expect(m.thinking.value).toBe('true');
        expect(m.modelOptions.some((o) => o.v === 'opus')).toBe(true);
        expect(m.effortOptions.map((o) => o.v)).toEqual(['low', 'medium', 'high']);
    });

    it('reports an unset key as a default field with null scope', () => {
        const m = resolveGuidedModel([]);
        expect(m.model.scope).toBeNull();
        expect(m.model.isDefault).toBe(true);
    });
});

describe('resolveGuidedEnv', () => {
    it('keeps only env.* rows, masking secrets via the chain head', () => {
        const dash: ConfigRow[] = [
            row('model', 'x', 'user'),
            { ...row('env.NPM_TOKEN', 'npm_realsecret', 'user', { secret: true }), chain: [{ scope: 'user', value: 'npm_•••', status: 'winner', path: '—', mod: '—' }] },
            row('env.NODE_ENV', 'production', 'project'),
        ];
        const e = resolveGuidedEnv(dash, true);
        expect(e.vars.map((v) => v.name)).toEqual(['NODE_ENV', 'NPM_TOKEN']);
        const tok = e.vars.find((v) => v.name === 'NPM_TOKEN')!;
        expect(tok.secret).toBe(true);
        expect(tok.value).toBe('npm_realsecret'); // real value retained for editing
        expect(tok.display).toBe('npm_•••'); // masked for display
    });
});

// ── Write-target routing (the part most likely to silently write the wrong file) ─

let dir: string;
let env: EngineEnv;

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sc-guided-'));
    mkdirSync(join(dir, 'home', '.claude'), { recursive: true });
    mkdirSync(join(dir, 'proj', '.claude'), { recursive: true });
    env = { home: join(dir, 'home'), platform: 'linux', vars: {}, projectDir: join(dir, 'proj'), managedDir: join(dir, 'managed') };
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function settings(scope: 'user' | 'project' | 'local'): Record<string, unknown> {
    const p = scope === 'user' ? join(dir, 'home', '.claude', 'settings.json') : scope === 'project' ? join(dir, 'proj', '.claude', 'settings.json') : join(dir, 'proj', '.claude', 'settings.local.json');
    return JSON.parse(readFileSync(p, 'utf8'));
}
function globalState(): Record<string, unknown> {
    return JSON.parse(readFileSync(join(dir, 'home', '.claude.json'), 'utf8'));
}
function apply(op: ChangeOp) {
    return applyChange(op, env, false);
}

describe('write targets', () => {
    it('setScalar writes a top-level key into the scope settings.json', () => {
        expect(apply({ kind: 'setScalar', key: 'model', value: 'opus', scope: 'project' }).ok).toBe(true);
        expect(settings('project').model).toBe('opus');
    });

    it('setEnvVar writes into the env object; removeEnvVar prunes an empty env', () => {
        expect(apply({ kind: 'setEnvVar', name: 'FOO', value: 'bar', scope: 'user' }).ok).toBe(true);
        expect((settings('user').env as Record<string, string>).FOO).toBe('bar');
        expect(apply({ kind: 'removeEnvVar', name: 'FOO', scope: 'user' }).ok).toBe(true);
        expect(settings('user').env).toBeUndefined();
    });

    it('project MCP server lands in .mcp.json (not settings.json)', () => {
        expect(apply({ kind: 'addMcpServer', name: 'gh', server: { transport: 'stdio', command: 'npx', args: ['-y', 'srv'] }, scope: 'project' }).ok).toBe(true);
        const mcp = JSON.parse(readFileSync(join(dir, 'proj', '.mcp.json'), 'utf8'));
        expect(mcp.mcpServers.gh.command).toBe('npx');
        expect(mcp.mcpServers.gh.args).toEqual(['-y', 'srv']);
    });

    it('user MCP server lands in ~/.claude.json mcpServers', () => {
        expect(apply({ kind: 'addMcpServer', name: 'docs', server: { transport: 'http', url: 'https://x/sse' }, scope: 'user' }).ok).toBe(true);
        expect((globalState().mcpServers as Record<string, { type: string; url: string }>).docs).toEqual({ type: 'http', url: 'https://x/sse' });
    });

    it('local MCP server lands in ~/.claude.json projects[dir].mcpServers', () => {
        expect(apply({ kind: 'addMcpServer', name: 'scratch', server: { transport: 'stdio', command: 'node' }, scope: 'local' }).ok).toBe(true);
        const projects = globalState().projects as Record<string, { mcpServers: Record<string, unknown> }>;
        expect(projects[env.projectDir!].mcpServers.scratch).toEqual({ command: 'node' });
    });

    it('refuses to write managed scope', () => {
        const r = resolveWrite({ kind: 'setScalar', key: 'model', value: 'opus', scope: 'managed' }, env);
        expect(r.blocked).toMatch(/read-only/i);
    });

    it('reorderRules rewrites the visible specs in the requested order', () => {
        for (const spec of ['Bash(a)', 'Bash(b)', 'Bash(c)']) apply({ kind: 'addRule', beh: 'allow', spec, scope: 'user' });
        expect(apply({ kind: 'reorderRules', beh: 'allow', scope: 'user', specs: ['Bash(c)', 'Bash(a)', 'Bash(b)'] }).ok).toBe(true);
        expect((settings('user').permissions as { allow: string[] }).allow).toEqual(['Bash(c)', 'Bash(a)', 'Bash(b)']);
    });

    it('reorderRules leaves file-only (deduped) entries pinned in their slots', () => {
        // permissions.allow on disk is [x, y, z]; the form only shows x and z.
        for (const spec of ['Bash(x)', 'Bash(y)', 'Bash(z)']) apply({ kind: 'addRule', beh: 'allow', spec, scope: 'project' });
        apply({ kind: 'reorderRules', beh: 'allow', scope: 'project', specs: ['Bash(z)', 'Bash(x)'] });
        // y keeps index 1; x and z swap into the visible slots.
        expect((settings('project').permissions as { allow: string[] }).allow).toEqual(['Bash(z)', 'Bash(y)', 'Bash(x)']);
    });
});
