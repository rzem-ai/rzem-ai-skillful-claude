// Guided Permissions model. Surfaces the editable controls the form needs:
// the default-mode options (with the user-only flag on "auto" and the managed
// lock on "bypassPermissions"), the merged rule list, and the resolved state.

import type { GuidedPermissionsModel, GuidedRule, PermissionsModel, ScopeId } from '../../shared/contract.js';
import type { DiscoveredSources } from './sources.js';

export function resolveGuidedPermissions(src: DiscoveredSources, perms: PermissionsModel): GuidedPermissionsModel {
    const effective = perms.defaultMode;
    const effectiveScope = defaultModeScope(src);
    const bypassDisabled = src.managed.disableBypassPermissionsMode === 'disable';

    const modes = [
        { v: 'plan', label: 'plan', d: 'Read-only planning' },
        { v: 'acceptEdits', label: 'acceptEdits', d: 'Auto-accept edits' },
        { v: 'auto', label: 'auto', d: 'Fully autonomous', userOnly: true },
        { v: 'bypassPermissions', label: 'bypassPermissions', d: 'Skip all prompts', locked: bypassDisabled },
    ].map((m) => ({ ...m, cur: m.v === effective }));

    const rules: GuidedRule[] = perms.rules.map((r) => ({ beh: r.beh, spec: r.spec, scope: r.scope, locked: r.scope === 'managed' }));

    return {
        modes,
        rules,
        effectiveMode: effective,
        effectiveModeScope: effectiveScope,
        bypassLock: bypassDisabled
            ? {
                  value: 'disableBypassPermissionsMode = "disable"',
                  channel: 'Locked by managed policy · Enforced via file. This control cannot be changed from this machine.',
              }
            : null,
    };
}

function defaultModeScope(src: DiscoveredSources): ScopeId | null {
    const order: [ScopeId, Record<string, unknown>][] = [
        ['managed', src.managed],
        ['local', src.local],
        ['project', src.project],
        ['user', src.user],
    ];
    for (const [scope, obj] of order) {
        const p = obj.permissions as Record<string, unknown> | undefined;
        const v = p?.defaultMode;
        if (typeof v !== 'string') continue;
        if (v === 'auto' && (scope === 'project' || scope === 'local')) continue;
        return scope;
    }
    return null;
}
