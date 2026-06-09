// Guided view-models for the Model & Effort, Environment, MCP, and Memory
// forms. Model & Environment derive from the already-resolved dashboard rows
// (so they inherit the engine's tested scalar/override resolution); MCP reuses
// the resolved server list; Memory enumerates the creatable CLAUDE.md slots
// with absolute paths so the form can write whole files via saveFile.

import { statSync, readFileSync } from 'node:fs';
import type {
    ConfigRow,
    GuidedEnvModel,
    GuidedEnvVar,
    GuidedField,
    GuidedMcpModel,
    GuidedMemoryModel,
    GuidedMemorySlot,
    GuidedModelModel,
    MemoryModel,
    Server,
} from '../../shared/contract.js';
import { type EngineEnv, paths, displayPath } from './env.js';

// ── Model & Effort ──────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
    { v: 'default', label: 'Default', d: 'Follow the account / CLI default' },
    { v: 'opus', label: 'Opus', d: 'Most capable — claude-opus-4-8' },
    { v: 'sonnet', label: 'Sonnet', d: 'Balanced — claude-sonnet-4-6' },
    { v: 'haiku', label: 'Haiku', d: 'Fastest — claude-haiku-4-5' },
];

const EFFORT_OPTIONS = [
    { v: 'low', label: 'low', d: 'Least reasoning, fastest' },
    { v: 'medium', label: 'medium', d: 'Balanced reasoning' },
    { v: 'high', label: 'high', d: 'Most reasoning, slowest' },
];

// Lift a resolved dashboard row into the form's field shape.
function fieldFromRow(rows: ConfigRow[], key: string): GuidedField {
    const row = rows.find((r) => r.key === key);
    if (!row || row.scope === null) {
        return { value: '', scope: null, isDefault: true };
    }
    return {
        value: row.value,
        scope: row.scope,
        isDefault: row.isDefault === true,
        locked: row.locked === true,
    };
}

export function resolveGuidedModel(dashboard: ConfigRow[]): GuidedModelModel {
    return {
        model: fieldFromRow(dashboard, 'model'),
        effort: fieldFromRow(dashboard, 'effortLevel'),
        thinking: fieldFromRow(dashboard, 'alwaysThinkingEnabled'),
        language: fieldFromRow(dashboard, 'language'),
        modelOptions: MODEL_OPTIONS,
        effortOptions: EFFORT_OPTIONS,
    };
}

// ── Environment ─────────────────────────────────────────────────────────────

export function resolveGuidedEnv(dashboard: ConfigRow[], hasProject: boolean): GuidedEnvModel {
    const vars: GuidedEnvVar[] = [];
    for (const row of dashboard) {
        if (!row.key.startsWith('env.') || row.scope === null) continue;
        const shadowed = row.chain.find((c) => c.status === 'shadowed');
        vars.push({
            name: row.key.slice('env.'.length),
            value: row.value, // secret rows carry the real value
            display: row.chain[0]?.value ?? row.value, // chain head is masked for secrets
            scope: row.scope,
            secret: row.secret === true,
            locked: row.locked === true,
            ...(shadowed ? { shadowedBy: shadowed.scope } : {}),
        });
    }
    vars.sort((a, b) => a.name.localeCompare(b.name));
    return { vars, hasProject };
}

// ── MCP ─────────────────────────────────────────────────────────────────────

export function resolveGuidedMcp(servers: Server[], hasProject: boolean): GuidedMcpModel {
    const scopeTargets: GuidedMcpModel['scopeTargets'] = [
        { v: 'user', t: 'User (all projects)', d: '~/.claude.json · mcpServers' },
        { v: 'project', t: 'Project (shared with team)', d: '.mcp.json · committed' },
        { v: 'local', t: 'Local (just me, this project)', d: '~/.claude.json · projects[…]' },
    ];
    return { servers, transports: ['stdio', 'http', 'sse'], scopeTargets, hasProject };
}

// ── Memory ──────────────────────────────────────────────────────────────────

function fileLines(path: string): number | null {
    try {
        if (!statSync(path).isFile()) return null;
        return readFileSync(path, 'utf8').split('\n').length;
    } catch {
        return null;
    }
}

const USER_TEMPLATE = `# Personal memory

Guidance that applies to *you* across every project. Coding style, tools you
prefer, how you like Claude to communicate.
`;

function projectTemplate(name: string): string {
    return `# ${name}

## What this is

<!-- One or two sentences on what this project does. -->

## Architecture

<!-- The shape of the codebase: key directories, the main seams. -->

## Conventions

<!-- House rules: naming, testing, what to avoid. -->
`;
}

const LOCAL_TEMPLATE = `# Local notes

Machine-local memory for this project. Gitignored — never committed. Scratch
context, local paths, personal reminders.
`;

export function resolveGuidedMemory(env: EngineEnv, memory: MemoryModel): GuidedMemoryModel {
    const p = paths(env);
    const slots: GuidedMemorySlot[] = [];

    const userLines = fileLines(p.userMemory);
    slots.push({
        scope: 'user',
        label: 'Personal memory',
        path: '~/.claude/CLAUDE.md',
        realPath: p.userMemory,
        exists: userLines !== null,
        lines: userLines ?? 0,
        template: USER_TEMPLATE,
        desc: 'Loads in every project, always.',
    });

    if (env.projectDir) {
        const projLines = fileLines(p.projectMemory!);
        slots.push({
            scope: 'project',
            label: 'Project memory',
            path: 'CLAUDE.md',
            realPath: p.projectMemory!,
            exists: projLines !== null,
            lines: projLines ?? 0,
            committed: true,
            template: projectTemplate(env.projectDir.split('/').pop() || 'Project'),
            desc: 'Shared with the team. Committed to the repo.',
        });

        const localLines = fileLines(p.localMemory!);
        slots.push({
            scope: 'local',
            label: 'Local notes',
            path: 'CLAUDE.local.md',
            realPath: p.localMemory!,
            exists: localLines !== null,
            lines: localLines ?? 0,
            gitignore: true,
            template: LOCAL_TEMPLATE,
            desc: 'Just you, this machine. Gitignored.',
        });
    }

    // displayPath keeps the slot labels honest if a path sits outside ~ or the
    // project (rare, but the resolver should never lie about location).
    for (const s of slots) s.path = displayPath(s.realPath, env);

    return {
        slots,
        imports: memory.imports,
        brokenCount: memory.brokenCount,
        auto: memory.auto,
        hasProject: !!env.projectDir,
    };
}
