// MCP server resolution. Servers come from three user-facing scopes — user &
// local in ~/.claude.json, project in .mcp.json — and collide by name with
// precedence Local › Project › User. ${VAR} / ${VAR:-default} references are
// resolved against the environment so the map shows connect-readiness.

import type { EnvVar, ScopeId, Server, ServerStatus } from '../../shared/contract.js';
import type { DiscoveredSources } from './sources.js';

const RANK: Record<ScopeId, number> = { managed: 0, cli: 1, local: 2, project: 3, user: 4 };
const LABEL: Record<ScopeId, string> = { managed: 'Managed', cli: 'CLI', local: 'Local', project: 'Project', user: 'User' };

interface Def {
    name: string;
    scope: ScopeId;
    def: Record<string, unknown>;
    file: string;
}

function serversFrom(obj: unknown): Record<string, Record<string, unknown>> {
    if (!obj || typeof obj !== 'object') return {};
    const m = (obj as Record<string, unknown>).mcpServers;
    return m && typeof m === 'object' ? (m as Record<string, Record<string, unknown>>) : {};
}

export function resolveMcp(src: DiscoveredSources, projectPath: string | null, projectName: string, vars: Record<string, string | undefined>): Server[] {
    const defs: Def[] = [];

    for (const [name, def] of Object.entries(serversFrom(src.global))) {
        defs.push({ name, scope: 'user', def, file: '~/.claude.json' });
    }
    if (projectPath) {
        const projState = (src.global.projects as Record<string, unknown> | undefined)?.[projectPath];
        for (const [name, def] of Object.entries(serversFrom(projState))) {
            defs.push({ name, scope: 'local', def, file: `~/.claude.json · projects[${projectName}]` });
        }
        for (const [name, def] of Object.entries(serversFrom(src.projectMcp))) {
            defs.push({ name, scope: 'project', def, file: '.mcp.json' });
        }
    }

    // Group by name, winner = lowest rank (Local › Project › User).
    const byName = new Map<string, Def[]>();
    for (const d of defs) {
        const list = byName.get(d.name) ?? [];
        list.push(d);
        byName.set(d.name, list);
    }

    const out: Server[] = [];
    for (const [name, group] of byName) {
        group.sort((a, b) => RANK[a.scope] - RANK[b.scope]);
        const win = group[0];
        const loser = group[1];

        const transport = (win.def.type as string) || (win.def.command ? 'stdio' : 'http');
        const target = renderTarget(win.def);
        const env = collectVars(win.def, vars);
        const unresolved = env.some((e) => !e.resolved);
        const status: ServerStatus = unresolved ? { cls: 'warn', label: 'Unresolved variable' } : { cls: 'ok', label: 'Connected' };

        const server: Server = { name, scope: win.scope, transport, target, status, file: win.file, env };
        if (loser) {
            server.collision = `${LABEL[win.scope]} beats ${LABEL[loser.scope]} — both define “${name}”. ${LABEL[loser.scope]} definition is shadowed.`;
            const loserTarget = renderTarget(loser.def);
            server.shadow = {
                scope: loser.scope,
                target: loserTarget,
                file: loser.file,
                note: loserTarget === target ? 'Identical URL, lower scope' : 'Lower scope',
            };
        }
        out.push(server);
    }

    // Stable-ish ordering: winners by scope precedence then name.
    out.sort((a, b) => RANK[a.scope] - RANK[b.scope] || a.name.localeCompare(b.name));
    return out;
}

function renderTarget(def: Record<string, unknown>): string {
    if (typeof def.url === 'string') return compressDefaults(def.url);
    if (typeof def.command === 'string') {
        const args = Array.isArray(def.args) ? def.args.join(' ') : '';
        return `${def.command} ${args}`.trim();
    }
    return '—';
}

// ${VAR:-https://very/long/default} → ${VAR:-…} for compact display.
function compressDefaults(s: string): string {
    return s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*):-[^}]+\}/g, '${$1:-…}');
}

// Scan url, headers, command, args for ${VAR} / ${VAR:-default} references.
function collectVars(def: Record<string, unknown>, vars: Record<string, string | undefined>): EnvVar[] {
    const haystack: string[] = [];
    if (typeof def.url === 'string') haystack.push(def.url);
    if (typeof def.command === 'string') haystack.push(def.command);
    if (Array.isArray(def.args)) haystack.push(...def.args.filter((a): a is string => typeof a === 'string'));
    if (def.headers && typeof def.headers === 'object') haystack.push(...Object.values(def.headers as Record<string, unknown>).filter((v): v is string => typeof v === 'string'));
    if (def.env && typeof def.env === 'object') haystack.push(...Object.values(def.env as Record<string, unknown>).filter((v): v is string => typeof v === 'string'));

    const found = new Map<string, EnvVar>();
    const re = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;
    for (const s of haystack) {
        for (const m of s.matchAll(re)) {
            const name = m[1];
            if (found.has(name)) continue;
            const def0 = m[2];
            const live = vars[name];
            if (typeof live === 'string' && live.length) {
                found.set(name, { name, resolved: true, note: 'set in environment' });
            } else if (def0 !== undefined) {
                found.set(name, { name, resolved: true, note: `default → ${def0}` });
            } else {
                found.set(name, { name, resolved: false, note: 'unset · no default' });
            }
        }
    }
    return [...found.values()];
}
