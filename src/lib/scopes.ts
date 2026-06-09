// Scope metadata — the heart of the app. Each piece of config is badged by
// where it came from. Ported from the prototype's SCOPES map. These five
// colors (defined as --scope-* tokens in app.css) are reserved and must
// never be reused for chrome.

import type { IconName } from '@/lib/icons';

export type ScopeId = 'managed' | 'cli' | 'local' | 'project' | 'user';

export interface ScopeMeta {
    label: string;
    icon: IconName;
    order: number;
}

export const SCOPES: Record<ScopeId, ScopeMeta> = {
    managed: { label: 'Managed', icon: 'lock', order: 1 },
    cli: { label: 'CLI args', icon: 'terminal', order: 2 },
    local: { label: 'Local', icon: 'laptop', order: 3 },
    project: { label: 'Project', icon: 'folder', order: 4 },
    user: { label: 'User', icon: 'user', order: 5 },
};
