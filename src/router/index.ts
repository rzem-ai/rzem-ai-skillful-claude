import { createRouter, createWebHashHistory } from 'vue-router';

import AppShell from '@/layouts/AppShell.vue';
import DashboardView from '@/views/DashboardView.vue';
import ScopeStackView from '@/views/ScopeStackView.vue';
import PermissionsView from '@/views/PermissionsView.vue';
import McpMapView from '@/views/McpMapView.vue';
import MemoryMapView from '@/views/MemoryMapView.vue';
import ExtensionsView from '@/views/ExtensionsView.vue';
import GuidedPermissionsView from '@/views/GuidedPermissionsView.vue';
import GuidedModelView from '@/views/GuidedModelView.vue';
import GuidedEnvView from '@/views/GuidedEnvView.vue';
import GuidedMcpView from '@/views/GuidedMcpView.vue';
import GuidedMemoryView from '@/views/GuidedMemoryView.vue';
import RawEditorView from '@/views/RawEditorView.vue';

// Hash history: packaged Electron loads the renderer over file://, where
// HTML5 history breaks on reload/deep-link. The launcher (Overview) sits
// outside the shell; every other screen renders inside AppShell via this
// pathless parent route. meta.navId drives sidebar active state.
export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            // Layout route: a distinct parent path that never collides with "/".
            // Children use absolute paths, so they match independently of this
            // path but still render inside AppShell.
            path: '/',
            component: AppShell,
            children: [
                // Land on the Dashboard — the primary "what's in effect" view.
                { path: '', redirect: '/dashboard' },
                { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { navId: 'dashboard' } },
                { path: '/scope-stack', name: 'scope-stack', component: ScopeStackView, meta: { navId: 'scope' } },
                { path: '/permissions', name: 'permissions', component: PermissionsView, meta: { navId: 'permissions' } },
                { path: '/mcp', name: 'mcp', component: McpMapView, meta: { navId: 'mcp' } },
                { path: '/memory', name: 'memory', component: MemoryMapView, meta: { navId: 'memory' } },
                { path: '/extensions', name: 'extensions', component: ExtensionsView, meta: { navId: 'extensions' } },
                { path: '/guided/permissions', name: 'guided-permissions', component: GuidedPermissionsView, meta: { navId: 'g-perm' } },
                { path: '/guided/model', name: 'guided-model', component: GuidedModelView, meta: { navId: 'g-model' } },
                { path: '/guided/environment', name: 'guided-environment', component: GuidedEnvView, meta: { navId: 'g-env' } },
                { path: '/guided/mcp', name: 'guided-mcp', component: GuidedMcpView, meta: { navId: 'g-mcp' } },
                { path: '/guided/memory', name: 'guided-memory', component: GuidedMemoryView, meta: { navId: 'g-mem' } },
                { path: '/raw', name: 'raw', component: RawEditorView, meta: { navId: 'raw' } },
            ],
        },
    ],
});
