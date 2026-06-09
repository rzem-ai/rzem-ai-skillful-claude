// Source discovery + reading. Walks every configuration location for the
// current environment, reads and parses each file, and records health,
// mtime, and parse errors. This is the raw material the resolver merges.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ScopeId } from '../../shared/contract.js';
import { type EngineEnv, paths, displayPath } from './env.js';
import { parseJson, type ParseError } from './jsonc.js';

export type SourceRole =
    | 'managed'
    | 'managed-dropin'
    | 'managed-mcp'
    | 'user'
    | 'project'
    | 'local'
    | 'global'
    | 'project-mcp';

export interface SourceFile {
    role: SourceRole;
    scope: ScopeId;
    path: string; // absolute
    display: string;
    exists: boolean;
    text: string;
    json: Record<string, unknown> | undefined;
    health: 'ok' | 'warn' | 'err' | 'miss';
    parseErr?: ParseError;
    mtime: number | null;
    gitignore?: boolean;
    committed?: boolean;
    writable: boolean;
}

export interface DiscoveredSources {
    files: SourceFile[];
    // Convenience accessors for the resolver (parsed settings objects, in
    // precedence order managed → local → project → user; managed already
    // merged with valid drop-ins).
    managed: Record<string, unknown>;
    user: Record<string, unknown>;
    project: Record<string, unknown>;
    local: Record<string, unknown>;
    global: Record<string, unknown>;
    managedMcp: Record<string, unknown>;
    projectMcp: Record<string, unknown>;
    byRole(role: SourceRole): SourceFile[];
    settingsFor(scope: ScopeId): SourceFile | undefined;
}

interface RawRead {
    exists: boolean;
    text: string;
    mtime: number | null;
}

function readText(path: string): RawRead {
    try {
        const st = statSync(path);
        if (!st.isFile()) return { exists: false, text: '', mtime: null };
        return { exists: true, text: readFileSync(path, 'utf8'), mtime: st.mtimeMs };
    } catch {
        return { exists: false, text: '', mtime: null };
    }
}

function buildFile(
    role: SourceRole,
    scope: ScopeId,
    path: string,
    env: EngineEnv,
    opts: { writable: boolean; gitignore?: boolean; committed?: boolean },
): SourceFile {
    const r = readText(path);
    const base: SourceFile = {
        role,
        scope,
        path,
        display: displayPath(path, env),
        exists: r.exists,
        text: r.text,
        json: undefined,
        health: r.exists ? 'ok' : 'miss',
        mtime: r.mtime,
        writable: opts.writable,
        gitignore: opts.gitignore,
        committed: opts.committed,
    };
    if (!r.exists) return base;
    const parsed = parseJson<Record<string, unknown>>(r.text);
    if (parsed.ok) {
        base.json = parsed.value ?? {};
    } else {
        base.health = 'err';
        base.parseErr = parsed.error;
    }
    return base;
}

// Shallow-merge a list of objects left→right (later wins for scalars; arrays
// replaced — used only for the managed drop-in merge, which is a file overlay,
// not the cross-scope array merge).
function shallowMerge(objs: (Record<string, unknown> | undefined)[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const o of objs) {
        if (!o) continue;
        for (const [k, v] of Object.entries(o)) out[k] = v;
    }
    return out;
}

export function discoverSources(env: EngineEnv): DiscoveredSources {
    const p = paths(env);
    const files: SourceFile[] = [];

    // Managed base + drop-ins (alphabetical overlay over the base).
    const managedBase = buildFile('managed', 'managed', p.managedBase, env, { writable: false });
    files.push(managedBase);
    const dropinObjs: (Record<string, unknown> | undefined)[] = [managedBase.json];
    if (existsSync(p.managedDropinDir)) {
        let entries: string[] = [];
        try {
            entries = readdirSync(p.managedDropinDir)
                .filter((f) => f.endsWith('.json'))
                .sort();
        } catch {
            entries = [];
        }
        for (const name of entries) {
            const f = buildFile('managed-dropin', 'managed', join(p.managedDropinDir, name), env, { writable: false });
            f.display = `managed-settings.d/${name}`;
            files.push(f);
            if (f.health !== 'err') dropinObjs.push(f.json);
        }
    }
    const managed = shallowMerge(dropinObjs);

    // Managed MCP policy.
    const managedMcpFile = buildFile('managed-mcp', 'managed', p.managedMcp, env, { writable: false });
    if (managedMcpFile.exists) files.push(managedMcpFile);

    // gitignore presence for the local/secret-file badges.
    const ignored = readGitignore(p.gitignore);

    // User + global.
    const userFile = buildFile('user', 'user', p.userSettings, env, { writable: true });
    files.push(userFile);
    const globalFile = buildFile('global', 'user', p.globalState, env, { writable: true });
    if (globalFile.exists) files.push(globalFile);

    // Project + local + project MCP (only when a project is selected).
    let projectFile: SourceFile | undefined;
    let localFile: SourceFile | undefined;
    let projectMcpFile: SourceFile | undefined;
    if (env.projectDir) {
        projectFile = buildFile('project', 'project', p.projectSettings!, env, { writable: true, committed: true });
        files.push(projectFile);
        localFile = buildFile('local', 'local', p.localSettings!, env, {
            writable: true,
            gitignore: ignored('.claude/settings.local.json') || true,
        });
        files.push(localFile);
        projectMcpFile = buildFile('project-mcp', 'project', p.projectMcp!, env, { writable: true, committed: true });
        if (projectMcpFile.exists) files.push(projectMcpFile);
    }

    const managedMcp = managedMcpFile.json ?? {};
    const projectMcp = projectMcpFile?.json ?? {};

    return {
        files,
        managed,
        user: userFile.json ?? {},
        project: projectFile?.json ?? {},
        local: localFile?.json ?? {},
        global: globalFile.json ?? {},
        managedMcp,
        projectMcp,
        byRole(role) {
            return files.filter((f) => f.role === role);
        },
        settingsFor(scope) {
            const roleByScope: Record<ScopeId, SourceRole> = {
                managed: 'managed',
                cli: 'managed',
                user: 'user',
                project: 'project',
                local: 'local',
            };
            return files.find((f) => f.role === roleByScope[scope]);
        },
    };
}

function readGitignore(path: string | null): (rel: string) => boolean {
    if (!path) return () => false;
    const r = readText(path);
    if (!r.exists) return () => false;
    const patterns = r.text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
    return (rel: string) => patterns.some((pat) => rel === pat || rel.endsWith(pat.replace(/^\//, '')) || pat.includes(rel));
}
