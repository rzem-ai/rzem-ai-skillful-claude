// Permission resolution. Array-valued rules concatenate + dedupe across scopes
// (configuration-guide §1) and evaluate deny → ask → allow, first match wins.
// We also flag rules that can never win because a higher-priority deny always
// matches first — the "unreachable allow" lint.

import type { Behaviour, PermissionsModel, PermRule, SandboxLine, ScopeId } from '../../shared/contract.js';
import type { DiscoveredSources } from './sources.js';

// Concatenation order for array merge. Managed denies must surface first;
// the remaining tiers follow user → project → local (matches Claude Code's
// observed merge order in the fixture ground-truth).
const ARRAY_ORDER: ScopeId[] = ['managed', 'user', 'project', 'local'];

interface RawRule {
    beh: Behaviour;
    spec: string;
    scope: ScopeId;
}

function perms(obj: Record<string, unknown>): Record<string, unknown> {
    const p = obj.permissions;
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
}

function arr(obj: Record<string, unknown>, key: string): string[] {
    const v = obj[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function scopeObjs(src: DiscoveredSources): Record<ScopeId, Record<string, unknown>> {
    return { managed: src.managed, user: src.user, project: src.project, local: src.local, cli: {} };
}

// Glob → anchored regex (same grammar the renderer's rule tester uses).
interface Compiled {
    tool: string;
    re: RegExp;
}
function toRe(spec: string): Compiled | null {
    const m = spec.match(/^([A-Za-z]+)\((.*)\)$/);
    if (!m) return null;
    const esc = m[2].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return { tool: m[1], re: new RegExp('^' + esc + '$') };
}

export function resolvePermissions(src: DiscoveredSources): PermissionsModel {
    const objs = scopeObjs(src);

    // Gather rules per behaviour, concatenated in ARRAY_ORDER and deduped by
    // (behaviour, spec) keeping the first (highest-priority) occurrence.
    const collected: RawRule[] = [];
    const seen = new Set<string>();
    const behaviours: Behaviour[] = ['deny', 'ask', 'allow'];
    for (const beh of behaviours) {
        for (const scope of ARRAY_ORDER) {
            for (const spec of arr(perms(objs[scope]), beh)) {
                const dedupe = `${beh}:${spec}`;
                if (seen.has(dedupe)) continue;
                seen.add(dedupe);
                collected.push({ beh, spec, scope });
            }
        }
    }

    // Number in final evaluation order (deny block, then ask, then allow).
    const denies = collected.filter((r) => r.beh === 'deny');
    const rules: PermRule[] = [];
    let n = 0;
    for (const r of collected) {
        n++;
        const rule: PermRule = { n, beh: r.beh, spec: r.spec, scope: r.scope };
        if (r.beh !== 'deny') {
            const blocker = denies.find((d) => {
                const dc = toRe(d.spec);
                const rc = toRe(r.spec);
                return dc && rc && dc.tool === rc.tool && dc.re.test(r.spec.replace(/^[A-Za-z]+\(/, '').replace(/\)$/, ''));
            });
            if (blocker) {
                const bn = rules.find((x) => x.spec === blocker.spec && x.beh === 'deny')?.n;
                rule.unreachable = `Unreachable — always matched first by ${blocker.scope} deny${bn ? ` #${bn}` : ''} ${blocker.spec}.`;
            }
        }
        rules.push(rule);
    }

    // Sandbox view: filesystem deny (Read denies + sandbox denyRead), extra
    // dirs, network deny (sandbox deniedDomains).
    const sandbox: SandboxLine[] = [];
    const fsDeny: { code: string; scope?: ScopeId }[] = [];
    for (const r of rules.filter((x) => x.beh === 'deny' && x.spec.startsWith('Read('))) {
        fsDeny.push({ code: r.spec.replace(/^Read\(/, '').replace(/\)$/, ''), scope: r.scope });
    }
    for (const scope of ARRAY_ORDER) {
        const sb = objs[scope].sandbox as Record<string, unknown> | undefined;
        const fs = sb?.filesystem as Record<string, unknown> | undefined;
        for (const d of arr(fs ?? {}, 'denyRead')) fsDeny.push({ code: d, scope });
    }
    if (fsDeny.length) sandbox.push({ label: 'Filesystem deny', items: fsDeny });

    const extraDirs: { code: string; scope?: ScopeId }[] = [];
    for (const scope of ARRAY_ORDER) {
        for (const d of arr(perms(objs[scope]), 'additionalDirectories')) extraDirs.push({ code: d, scope });
    }
    if (extraDirs.length) sandbox.push({ label: 'Extra directories', items: extraDirs });

    const netDeny: { code: string; scope?: ScopeId }[] = [];
    for (const scope of ARRAY_ORDER) {
        const sb = objs[scope].sandbox as Record<string, unknown> | undefined;
        const net = sb?.network as Record<string, unknown> | undefined;
        for (const d of arr(net ?? {}, 'deniedDomains')) netDeny.push({ code: d, scope });
    }
    if (netDeny.length) sandbox.push({ label: 'Network deny', items: netDeny });

    return {
        rules,
        sandbox,
        defaultMode: effectiveDefaultMode(src),
        unreachableCount: rules.filter((r) => r.unreachable).length,
    };
}

// Resolve permissions.defaultMode with the auto-from-user-only rule applied.
export function effectiveDefaultMode(src: DiscoveredSources): string {
    const order: ScopeId[] = ['managed', 'local', 'project', 'user'];
    for (const scope of order) {
        const objs = scopeObjs(src);
        const v = perms(objs[scope]).defaultMode;
        if (typeof v !== 'string') continue;
        if (v === 'auto' && (scope === 'project' || scope === 'local')) continue; // ignored by rule
        return v;
    }
    return 'default';
}
