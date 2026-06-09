// Engine orchestrator. Discovers sources for the given environment and
// assembles the full renderer Snapshot — every workspace's view-model in one
// pass. Pure (no Electron), so the same entrypoint backs the Vitest suite.

import { basename } from 'node:path';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectInfo, RecentProject, Snapshot } from '../../shared/contract.js';
import type { EngineEnv } from './env.js';
import { discoverSources } from './sources.js';
import { resolveDashboard } from './resolve.js';
import { resolvePermissions } from './permissions.js';
import { resolveMcp } from './mcp.js';
import { resolveMemory } from './memory.js';
import { resolveExtensions } from './extensions.js';
import { resolveScopeStack } from './scopeStack.js';
import { resolveGuidedPermissions } from './guided.js';
import { resolveRaw } from './raw.js';

export function buildSnapshot(env: EngineEnv, recents: RecentProject[] = [], claudeVersion = 'unknown'): Snapshot {
    const src = discoverSources(env);

    const project: ProjectInfo | null = env.projectDir
        ? { name: basename(env.projectDir), path: env.projectDir, isGit: existsSync(join(env.projectDir, '.git')) }
        : null;

    const dashboard = resolveDashboard(src);
    const permissions = resolvePermissions(src);
    const mcp = resolveMcp(src, env.projectDir, project?.name ?? '', env.vars);
    const memory = resolveMemory(env);
    const extensions = resolveExtensions(src, env);
    const scopeStack = resolveScopeStack(src, permissions);
    const guidedPermissions = resolveGuidedPermissions(src, permissions);
    const raw = resolveRaw(src, permissions);

    const extCount = extensions.sections.reduce((n, s) => n + s.items.length, 0);

    return {
        project,
        recents,
        claudeVersion,
        counts: { keys: dashboard.length, rules: permissions.rules.length, servers: mcp.length, extensions: extCount },
        flags: { memoryWarn: memory.brokenCount > 0, scopeWarn: scopeStack.some((l) => l.health.cls === 'warn' || l.health.cls === 'err') },
        dashboard,
        scopeStack,
        permissions,
        mcp,
        memory,
        extensions,
        guidedPermissions,
        raw,
    };
}

export type { EngineEnv } from './env.js';
export { liveEnv } from './env.js';
