// Engine ground-truth suite. Points the injectable engine env at the committed
// fixture tree (docs §A) and asserts the expected effective configuration
// (docs §B). This is the engine's contract: scalar override, array merge, the
// v2.1.142 auto-mode rule, wrong-file routing, unreachable-deny, MCP collision,
// secret masking, broken imports.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from '../index.js';
import type { EngineEnv } from '../env.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(here, '..', '__fixtures__');
const HOME = join(FIX, 'home');
const PROJECT = join(FIX, 'project');
const MANAGED = join(FIX, 'managed');
const GLOBAL = join(HOME, '.claude.json');
const GLOBAL_TEMPLATE = readFileSync(GLOBAL, 'utf8');

// Auto-memory + the local-MCP project key depend on the absolute project path,
// which varies by checkout location. Patch the two dynamic fixtures in place
// before the suite and restore afterwards.
const encoded = PROJECT.replace(/[/\\]/g, '-');
const memDir = join(HOME, '.claude', 'projects', encoded, 'memory');

beforeAll(() => {
    writeFileSync(GLOBAL, GLOBAL_TEMPLATE.replace('__PROJECT__', PROJECT), 'utf8');
    mkdirSync(memDir, { recursive: true });
    writeFileSync(
        join(memDir, 'MEMORY.md'),
        ['# Project Memory', '- [Engine purity](engine.md)', '- [Release flow](release.md)', '- [a](a.md)', '- [b](b.md)', '- [c](c.md)', '- [d](d.md)'].join('\n'),
        'utf8',
    );
});

afterAll(() => {
    writeFileSync(GLOBAL, GLOBAL_TEMPLATE, 'utf8');
    const projectsDir = join(HOME, '.claude', 'projects');
    if (existsSync(projectsDir)) rmSync(projectsDir, { recursive: true, force: true });
});

function env(): EngineEnv {
    return {
        home: HOME,
        platform: 'linux',
        vars: { NODE_ENV: 'development' }, // SENTRY_AUTH_TOKEN intentionally unset
        projectDir: PROJECT,
        managedDir: MANAGED,
    };
}

describe('effective config (docs §B1 — scalars)', () => {
    const snap = () => buildSnapshot(env());

    it('model: Project sonnet wins, User opus shadowed', () => {
        const row = snap().dashboard.find((r) => r.key === 'model')!;
        expect(row.value).toBe('claude-sonnet-4-6');
        expect(row.scope).toBe('project');
        const shadowed = row.chain.find((c) => c.status === 'shadowed');
        expect(shadowed?.scope).toBe('user');
        expect(shadowed?.value).toBe('claude-opus-4-7');
    });

    it('defaultMode: Project acceptEdits wins; User plan shadowed; Local auto ignored by rule', () => {
        const row = snap().dashboard.find((r) => r.key === 'permissions.defaultMode')!;
        expect(row.value).toBe('acceptEdits');
        expect(row.scope).toBe('project');
        expect(row.hero).toBe(true);
        const ignored = row.chain.find((c) => c.status === 'ignored');
        expect(ignored?.scope).toBe('local');
        expect(ignored?.value).toBe('auto');
        const shadowed = row.chain.find((c) => c.status === 'shadowed');
        expect(shadowed?.scope).toBe('user');
    });

    it('outputStyle resolves to Local with no shadow', () => {
        const row = snap().dashboard.find((r) => r.key === 'outputStyle')!;
        expect(row.value).toBe('Explanatory');
        expect(row.scope).toBe('local');
        expect(row.chain).toHaveLength(1);
    });

    it('forceLoginMethod is a locked managed row', () => {
        const row = snap().dashboard.find((r) => r.key === 'forceLoginMethod')!;
        expect(row.value).toBe('claudeai');
        expect(row.scope).toBe('managed');
        expect(row.locked).toBe(true);
    });

    it('autoConnectIde is inert (wrong-file key)', () => {
        const row = snap().dashboard.find((r) => r.key === 'autoConnectIde')!;
        expect(row.inert).toBe(true);
        expect(row.scope).toBeNull();
        expect(row.lint).toMatch(/~\/\.claude\.json/);
    });

    it('NPM_TOKEN is masked in the chain but the real value is available to reveal', () => {
        const row = snap().dashboard.find((r) => r.key === 'env.NPM_TOKEN')!;
        expect(row.secret).toBe(true);
        expect(row.chain[0].value).toMatch(/npm_•+/);
        expect(row.value).toBe('npm_EXAMPLEFAKETOKEN0000000000000000');
    });

    it('spinnerTipsEnabled falls back to default because its source is invalid JSON', () => {
        const row = snap().dashboard.find((r) => r.key === 'spinnerTipsEnabled')!;
        expect(row.isDefault).toBe(true);
        expect(row.value).toBe('true');
    });
});

describe('permissions (docs §B2 — array merge + unreachable)', () => {
    const perms = () => buildSnapshot(env()).permissions;

    it('merges and orders deny → ask → allow with correct provenance', () => {
        const rules = perms().rules;
        expect(rules.map((r) => `${r.beh} ${r.spec} ${r.scope}`)).toEqual([
            'deny Bash(curl *) managed',
            'deny Read(//etc/secrets/**) managed',
            'deny Read(~/.ssh/**) user',
            'deny Read(./.env) project',
            'deny Read(./.env.*) project',
            'ask Bash(git push *) project',
            'allow Bash(git diff *) user',
            'allow Bash(git log *) user',
            'allow Bash(npm run *) project',
            'allow Bash(curl localhost*) project',
        ]);
    });

    it('flags the unreachable allow shadowed by the managed curl deny', () => {
        const rules = perms().rules;
        const curlLocal = rules.find((r) => r.spec === 'Bash(curl localhost*)')!;
        expect(curlLocal.unreachable).toMatch(/managed deny/i);
        expect(perms().unreachableCount).toBe(1);
    });

    it('effective defaultMode is acceptEdits', () => {
        expect(perms().defaultMode).toBe('acceptEdits');
    });
});

describe('MCP map (docs §B4)', () => {
    const mcp = () => buildSnapshot(env()).mcp;

    it('github: Project wins, User definition shadowed', () => {
        const gh = mcp().find((s) => s.name === 'github')!;
        expect(gh.scope).toBe('project');
        expect(gh.shadow?.scope).toBe('user');
        expect(gh.collision).toMatch(/shadowed/i);
    });

    it('sentry: unresolved ${SENTRY_AUTH_TOKEN}', () => {
        const s = mcp().find((x) => x.name === 'sentry')!;
        expect(s.status.cls).toBe('warn');
        expect(s.env.some((e) => e.name === 'SENTRY_AUTH_TOKEN' && !e.resolved)).toBe(true);
    });

    it('docs-search: resolved via default', () => {
        const d = mcp().find((x) => x.name === 'docs-search')!;
        expect(d.status.cls).toBe('ok');
        expect(d.env.some((e) => e.name === 'DOCS_API_BASE' && e.resolved)).toBe(true);
    });

    it('scratch-db: Local scope, connected', () => {
        const s = mcp().find((x) => x.name === 'scratch-db')!;
        expect(s.scope).toBe('local');
        expect(s.status.cls).toBe('ok');
    });
});

describe('scope stack (docs §B5)', () => {
    it('managed warns (invalid drop-in), project warns (unreachable), local ok+ignored, user warns', () => {
        const layers = buildSnapshot(env()).scopeStack;
        const by = (s: string) => layers.find((l) => l.scope === s)!;
        expect(by('managed').health.cls).toBe('warn');
        expect(by('project').health.cls).toBe('warn');
        expect(by('local').health.cls).toBe('ok');
        expect(by('local').health.label).toMatch(/ignored/i);
        expect(by('user').health.cls).toBe('warn');
    });
});

describe('memory map (docs §B6)', () => {
    const mem = () => buildSnapshot(env()).memory;

    it('load order: user → project → local, with the engine/ file lazy', () => {
        const files = mem().files;
        const ordered = files.filter((f) => !f.lazy);
        expect(ordered.map((f) => f.scope)).toEqual(['user', 'project', 'local']);
        expect(files.some((f) => f.lazy && f.path.includes('engine/'))).toBe(true);
    });

    it('import graph: git-workflow resolves, style-guide is broken', () => {
        const imports = mem().imports;
        expect(imports.find((i) => i.path.includes('git-workflow'))?.broken).toBe(false);
        expect(imports.find((i) => i.path.includes('style-guide'))?.broken).toBe(true);
        expect(mem().brokenCount).toBe(1);
    });

    it('auto memory enabled with entries', () => {
        const auto = mem().auto!;
        expect(auto.enabled).toBe(true);
        expect(auto.entries).toBeGreaterThanOrEqual(6);
    });
});

describe('extensions (docs §A8)', () => {
    it('discovers the subagent, skill, command, and the locally-disabled plugin', () => {
        const ext = buildSnapshot(env()).extensions;
        const find = (t: string) => ext.sections.find((s) => s.title === t)!;
        expect(find('Subagents').items[0].name).toBe('code-reviewer');
        expect(find('Skills').items[0].name).toBe('release-notes');
        expect(find('Slash commands').items[0].name).toBe('/changelog');
        const plugin = find('Plugins & marketplaces').items[0];
        expect(plugin.override).toBe(true);
        expect(plugin.disabled).toBe(true);
    });
});

describe('no project selected', () => {
    it('resolves only user/managed scopes', () => {
        const snap = buildSnapshot({ ...env(), projectDir: null });
        expect(snap.project).toBeNull();
        // model now resolves to the User value (no project to shadow it).
        expect(snap.dashboard.find((r) => r.key === 'model')!.value).toBe('claude-opus-4-7');
    });
});
