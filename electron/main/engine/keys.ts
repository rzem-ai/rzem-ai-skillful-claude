// Key metadata: category, type, and the routing rules that make the engine
// truthful — which keys are managed-only (locked), which are "global-config"
// keys that are silently ignored when placed in settings.json, and built-in
// defaults for the keys we can fall back to.

export interface KeyMeta {
    cat: string;
    type: string;
    managedOnly?: boolean;
    globalConfig?: boolean; // belongs in ~/.claude.json — ignored in settings.json
    default?: string;
}

// Global-config keys that must live in ~/.claude.json (configuration-guide §3).
export const GLOBAL_CONFIG_KEYS = new Set(['autoConnectIde', 'autoInstallIdeExtension', 'externalEditorContext', 'teammateDefaultModel']);

// Managed-only governance keys (configuration-guide §8). Display as locked.
export const MANAGED_ONLY_KEYS = new Set([
    'forceLoginMethod',
    'forceLoginOrgUUID',
    'disableBypassPermissionsMode',
    'allowManagedPermissionRulesOnly',
    'allowManagedHooksOnly',
    'strictKnownMarketplaces',
    'blockedMarketplaces',
    'strictPluginOnlyCustomization',
    'requiredMinimumVersion',
    'requiredMaximumVersion',
    'channelsEnabled',
    'allowedMcpServers',
    'deniedMcpServers',
    'allowManagedMcpServersOnly',
]);

const KNOWN: Record<string, KeyMeta> = {
    model: { cat: 'model', type: 'string' },
    effortLevel: { cat: 'model', type: 'enum' },
    alwaysThinkingEnabled: { cat: 'model', type: 'boolean' },
    language: { cat: 'model', type: 'string' },
    'permissions.defaultMode': { cat: 'permissions', type: 'enum' },
    outputStyle: { cat: 'quality', type: 'string' },
    editorMode: { cat: 'quality', type: 'enum' },
    autoUpdatesChannel: { cat: 'quality', type: 'enum', default: 'stable' },
    cleanupPeriodDays: { cat: 'quality', type: 'number', default: '30' },
    spinnerTipsEnabled: { cat: 'quality', type: 'boolean', default: 'true' },
    statusLine: { cat: 'quality', type: 'object' },
    attribution: { cat: 'quality', type: 'object' },
    autoConnectIde: { cat: 'ide', type: 'boolean', globalConfig: true },
    autoInstallIdeExtension: { cat: 'ide', type: 'boolean', globalConfig: true },
    teammateDefaultModel: { cat: 'ide', type: 'string', globalConfig: true },
    forceLoginMethod: { cat: 'security', type: 'enum', managedOnly: true },
    disableBypassPermissionsMode: { cat: 'security', type: 'enum', managedOnly: true },
};

// Keys handled by dedicated views, not the scalar dashboard.
export const STRUCTURED_KEYS = new Set([
    'permissions',
    'env',
    'mcpServers',
    'enabledPlugins',
    'extraKnownMarketplaces',
    'sandbox',
    'hooks',
    'worktree',
    '$schema',
]);

export function keyMeta(key: string): KeyMeta {
    if (KNOWN[key]) return KNOWN[key];
    if (key.startsWith('env.')) return { cat: 'environment', type: 'string' };
    if (MANAGED_ONLY_KEYS.has(key)) return { cat: 'security', type: 'enum', managedOnly: true };
    if (GLOBAL_CONFIG_KEYS.has(key)) return { cat: 'ide', type: 'string', globalConfig: true };
    return { cat: 'other', type: typeof key };
}

// Render a resolved value as the short string the table shows.
export function valueToString(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    return JSON.stringify(v);
}

export function valueType(v: unknown): string {
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (Array.isArray(v)) return 'array';
    return 'object';
}
