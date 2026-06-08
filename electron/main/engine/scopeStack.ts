// Scope Stack model. Renders the five precedence layers with per-file health,
// key counts, and the one-line "what to inspect here" summary each layer earns.

import type { Layer, LayerFile, PermissionsModel } from '../../shared/contract.js';
import { GLOBAL_CONFIG_KEYS } from './keys.js';
import { looksSecret } from './secrets.js';
import { fmtDate } from './resolve.js';
import type { DiscoveredSources, SourceFile } from './sources.js';

function countKeys(obj: Record<string, unknown>): number {
    return Object.keys(obj).filter((k) => k !== '$schema').length;
}

function latestMtime(files: SourceFile[]): number | null {
    const ms = files.map((f) => f.mtime).filter((m): m is number => m !== null);
    return ms.length ? Math.max(...ms) : null;
}

export function resolveScopeStack(src: DiscoveredSources, perms: PermissionsModel): Layer[] {
    const layers: Layer[] = [];

    // Managed
    const managedFiles = src.files.filter((f) => f.scope === 'managed' && f.role !== 'managed-mcp');
    const presentManaged = managedFiles.filter((f) => f.exists);
    const invalid = managedFiles.filter((f) => f.health === 'err').length;
    layers.push({
        scope: 'managed',
        win: presentManaged.length > 0,
        keys: countKeys(src.managed),
        mod: fmtDate(latestMtime(managedFiles)),
        delivery: 'Enforced via file',
        health: invalid
            ? { cls: 'warn', label: `${invalid} of ${managedFiles.length} files invalid` }
            : presentManaged.length
              ? { cls: 'ok', label: 'Valid' }
              : { cls: 'miss', label: 'Not present' },
        files: managedFiles.map((f) => fileRow(f, f.health === 'err' ? f.parseErr?.message ?? 'Invalid JSON — excluded from resolution.' : 'Managed policy — read-only')),
    });

    // CLI (never sourced in this build)
    layers.push({
        scope: 'cli',
        win: false,
        keys: 0,
        mod: '—',
        empty: true,
        health: { cls: 'miss', label: 'No flags this session' },
        files: [{ path: '--model · --permission-mode · --settings', health: 'miss', note: 'Session-only overrides. None passed when this project was opened.' }],
    });

    // Local
    const localFile = src.settingsFor('local');
    const localIgnored = hasIgnoredAuto(src.local);
    layers.push({
        scope: 'local',
        win: false,
        keys: countKeys(src.local),
        mod: fmtDate(localFile?.mtime ?? null),
        gitignore: true,
        health: localFile?.exists
            ? localIgnored
                ? { cls: 'ok', label: 'Valid · 1 ignored key' }
                : { cls: 'ok', label: 'Valid' }
            : { cls: 'miss', label: 'Not present' },
        files: localFile && localFile.exists ? [fileRow(localFile, localIgnored ? 'defaultMode: "auto" is ignored by rule (auto is user-scope only).' : 'Machine-local overrides.')] : [],
    });

    // Project
    const projectFile = src.settingsFor('project');
    layers.push({
        scope: 'project',
        win: false,
        keys: countKeys(src.project),
        mod: fmtDate(projectFile?.mtime ?? null),
        committed: true,
        health: projectFile?.exists
            ? perms.unreachableCount
                ? { cls: 'warn', label: `Valid · ${perms.unreachableCount} unreachable rule${perms.unreachableCount > 1 ? 's' : ''}` }
                : { cls: 'ok', label: 'Valid' }
            : { cls: 'miss', label: 'Not present' },
        files: projectFile && projectFile.exists ? [fileRow(projectFile, perms.unreachableCount ? 'Contains an allow rule shadowed by a managed deny.' : 'Committed project settings.')] : [],
    });

    // User
    const userFile = src.settingsFor('user');
    const wrongFile = Object.keys(src.user).some((k) => GLOBAL_CONFIG_KEYS.has(k));
    const hasSecret = secretCount(src.user) > 0;
    const userNotes: string[] = [];
    if (wrongFile) userNotes.push('1 wrong-file key');
    if (hasSecret) userNotes.push('1 secret');
    layers.push({
        scope: 'user',
        win: false,
        keys: countKeys(src.user),
        mod: fmtDate(userFile?.mtime ?? null),
        health: userFile?.exists
            ? userNotes.length
                ? { cls: 'warn', label: `Valid · ${userNotes.join(', ')}` }
                : { cls: 'ok', label: 'Valid' }
            : { cls: 'miss', label: 'Not present' },
        files: userFile && userFile.exists ? [fileRow(userFile, userNotes.length ? userNotes.join(' · ') : 'Personal settings, all projects.')] : [],
    });

    return layers;
}

function fileRow(f: SourceFile, note: string): LayerFile {
    return { path: f.display, health: f.health, note, gitignore: f.gitignore, committed: f.committed };
}

function hasIgnoredAuto(local: Record<string, unknown>): boolean {
    const p = local.permissions as Record<string, unknown> | undefined;
    return p?.defaultMode === 'auto';
}

function secretCount(obj: Record<string, unknown>): number {
    const env = obj.env as Record<string, unknown> | undefined;
    if (!env) return 0;
    return Object.entries(env).filter(([k, v]) => looksSecret(k, v)).length;
}
