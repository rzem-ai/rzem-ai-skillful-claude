// The merge/resolution engine — the single source of truth for "what config
// is actually in effect, and why". Replicates Claude Code precedence: scalars
// override by scope (Managed › CLI › Local › Project › User), with the v2.1.142
// auto-mode rule and global-config-key routing applied as it goes.

import type { ChainEntry, ConfigRow, ScopeId } from '../../shared/contract.js';
import type { DiscoveredSources, SourceFile } from './sources.js';
import { GLOBAL_CONFIG_KEYS, MANAGED_ONLY_KEYS, STRUCTURED_KEYS, keyMeta, valueToString, valueType } from './keys.js';
import { looksSecret, maskValue } from './secrets.js';

// Precedence rank — lower wins. CLI sits between managed and local but this
// build has no CLI source, so it never appears.
const RANK: Record<ScopeId, number> = { managed: 0, cli: 1, local: 2, project: 3, user: 4 };
const SCOPE_ORDER: ScopeId[] = ['managed', 'local', 'project', 'user'];
const SCOPE_LABEL: Record<ScopeId, string> = { managed: 'Managed', cli: 'CLI args', local: 'Local', project: 'Project', user: 'User' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(mtime: number | null): string {
    if (!mtime) return '—';
    const d = new Date(mtime);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Pull a (possibly nested) scalar for a dotted key out of one scope object.
function getScalar(obj: Record<string, unknown>, key: string): unknown {
    if (key.includes('.')) {
        const [head, tail] = key.split('.', 2);
        const sub = obj[head];
        if (sub && typeof sub === 'object') return (sub as Record<string, unknown>)[tail];
        return undefined;
    }
    return obj[key];
}

// Enumerate the scalar keys a scope object contributes (descending only into
// permissions.defaultMode and env.*; arrays/objects are handled by dedicated
// views).
function scalarKeys(obj: Record<string, unknown>): string[] {
    const out: string[] = [];
    for (const k of Object.keys(obj)) {
        if (k === 'env' && obj.env && typeof obj.env === 'object') {
            for (const e of Object.keys(obj.env as object)) out.push(`env.${e}`);
            continue;
        }
        if (k === 'permissions' && obj.permissions && typeof obj.permissions === 'object') {
            if ('defaultMode' in (obj.permissions as object)) out.push('permissions.defaultMode');
            continue;
        }
        if (STRUCTURED_KEYS.has(k)) continue;
        out.push(k);
    }
    return out;
}

interface ScopeView {
    scope: ScopeId;
    file: SourceFile | undefined;
    obj: Record<string, unknown>;
}

export function resolveDashboard(src: DiscoveredSources): ConfigRow[] {
    const views: ScopeView[] = [
        { scope: 'managed', file: src.byRole('managed')[0], obj: src.managed },
        { scope: 'local', file: src.settingsFor('local'), obj: src.local },
        { scope: 'project', file: src.settingsFor('project'), obj: src.project },
        { scope: 'user', file: src.settingsFor('user'), obj: src.user },
    ];

    // Collect every scalar key defined by any valid scope.
    const keys = new Set<string>();
    for (const v of views) for (const k of scalarKeys(v.obj)) keys.add(k);

    // Keys that a *broken* (excluded) source tried to set, for the
    // "default · source excluded" fallback rows.
    const excludedKeys = new Map<string, SourceFile>();
    for (const f of src.files) {
        if (f.health !== 'err') continue;
        // Re-read the broken text leniently enough to know which keys it meant
        // to set (top-level identifiers before a colon).
        for (const m of f.text.matchAll(/"([A-Za-z0-9_$]+)"\s*:/g)) {
            const k = m[1];
            if (!STRUCTURED_KEYS.has(k) && !excludedKeys.has(k)) excludedKeys.set(k, f);
        }
    }

    const rows: ConfigRow[] = [];
    for (const key of keys) {
        rows.push(buildRow(key, views));
    }

    // Fallback-to-default rows for keys only a broken source defined.
    for (const [key, file] of excludedKeys) {
        if (keys.has(key)) continue;
        const meta = keyMeta(key);
        if (meta.default === undefined) continue;
        rows.push({
            key,
            value: meta.default,
            type: meta.type,
            cat: meta.cat,
            scope: null,
            differ: false,
            conflict: false,
            isDefault: true,
            lint: `A managed drop-in tried to set this, but that file is invalid JSON and was excluded. Falling back to default.`,
            chain: [
                {
                    scope: 'managed',
                    value: valueToString(readExcludedValue(file, key)),
                    status: 'ignored',
                    path: file.display,
                    mod: fmtDate(file.mtime),
                    note: `Source file is invalid JSON (line ${file.parseErr?.line ?? '?'}) — excluded from resolution. Effective value falls back to default ${meta.default}.`,
                    action: 'Open in Raw Editor',
                },
            ],
        });
    }

    rows.sort((a, b) => a.key.localeCompare(b.key));
    return rows;
}

function readExcludedValue(file: SourceFile, key: string): unknown {
    const m = file.text.match(new RegExp(`"${key}"\\s*:\\s*("[^"]*"|true|false|-?\\d+)`));
    if (!m) return '?';
    try {
        return JSON.parse(m[1]);
    } catch {
        return m[1];
    }
}

function buildRow(key: string, views: ScopeView[]): ConfigRow {
    const meta = keyMeta(key);

    interface Entry {
        scope: ScopeId;
        raw: unknown;
        value: string;
        file: SourceFile | undefined;
        ignored: boolean;
        ignoreNote?: string;
        ignoreAction?: string;
    }
    const entries: Entry[] = [];
    for (const v of views) {
        const raw = getScalar(v.obj, key);
        if (raw === undefined) continue;
        let ignored = false;
        let ignoreNote: string | undefined;
        let ignoreAction: string | undefined;

        // v2.1.142: defaultMode "auto" only honoured from user settings.
        if (key === 'permissions.defaultMode' && raw === 'auto' && (v.scope === 'project' || v.scope === 'local')) {
            ignored = true;
            ignoreNote = 'Ignored — “auto” mode can only be set in user settings (since v2.1.142). This entry has no effect.';
            ignoreAction = 'Move to user settings';
        }
        // Global-config key placed in any settings.json file → silently ignored
        // (it must live in ~/.claude.json).
        if (GLOBAL_CONFIG_KEYS.has(key)) {
            ignored = true;
            ignoreNote = `Wrong file — ${key} is a global-config key. It must live in ~/.claude.json or it is silently ignored.`;
            ignoreAction = 'Move to ~/.claude.json';
        }

        const secret = looksSecret(key.replace(/^env\./, ''), raw);
        entries.push({
            scope: v.scope,
            raw,
            value: secret && typeof raw === 'string' ? maskValue(raw) : valueToString(raw),
            file: v.file,
            ignored,
            ignoreNote,
            ignoreAction,
        });
    }

    // Winner = highest-precedence non-ignored entry.
    const active = entries.filter((e) => !e.ignored).sort((a, b) => RANK[a.scope] - RANK[b.scope]);
    const winner = active[0];
    const winnerLabel = winner ? SCOPE_LABEL[winner.scope] : '';

    // Order chain: winner, then shadowed (by precedence), then ignored.
    const ordered: Entry[] = [];
    if (winner) ordered.push(winner);
    for (const e of entries) {
        if (e === winner) continue;
        if (!e.ignored) ordered.push(e);
    }
    ordered.sort((a, b) => {
        if (a === winner) return -1;
        if (b === winner) return 1;
        return RANK[a.scope] - RANK[b.scope];
    });
    for (const e of entries) if (e.ignored) ordered.push(e);

    const chain: ChainEntry[] = ordered.map((e) => ({
        scope: e.scope,
        value: e.value,
        status: e === winner ? 'winner' : e.ignored ? 'ignored' : 'shadowed',
        path: e.file?.display ?? '—',
        mod: fmtDate(e.file?.mtime ?? null),
        note: e === winner ? undefined : e.ignored ? e.ignoreNote : `Shadowed by ${winnerLabel}`,
        action: e.ignored ? e.ignoreAction : undefined,
    }));

    const managedLock = MANAGED_ONLY_KEYS.has(key) && winner?.scope === 'managed';
    const allIgnored = entries.length > 0 && !winner;
    const isSecretRow = winner ? looksSecret(key.replace(/^env\./, ''), winner.raw) : false;
    const hasShadow = chain.some((c) => c.status === 'shadowed');
    const hasIgnored = chain.some((c) => c.status === 'ignored');

    const row: ConfigRow = {
        key,
        value: winner ? winner.value : '—',
        type: winner ? meta.type || valueType(winner.raw) : 'inert',
        cat: meta.cat,
        scope: winner ? winner.scope : null,
        differ: meta.default === undefined || (winner ? winner.value !== meta.default : false),
        conflict: hasShadow || hasIgnored || allIgnored,
        chain,
    };
    if (managedLock) {
        row.locked = true;
        row.channel = `Enforced via file — ${winner!.file?.path ?? winner!.file?.display ?? ''}`;
    }
    if (key === 'permissions.defaultMode' && hasIgnored) row.hero = true;
    if (isSecretRow) {
        // The chain entry stays masked; the row carries the real value so the
        // renderer can reveal it per-field on demand. Never enters diffs.
        row.secret = true;
        row.value = String(winner!.raw);
    }
    if (allIgnored && GLOBAL_CONFIG_KEYS.has(key)) {
        row.inert = true;
        row.scope = null;
        row.value = '—';
        row.type = 'inert';
        row.lint = `This key is ignored here — it belongs in ~/.claude.json. It currently has no effect.`;
    }
    return row;
}

export { SCOPE_ORDER, SCOPE_LABEL, RANK };
