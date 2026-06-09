<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Icon from '@/components/Icon.vue';
import { useConfigStore } from '@/stores/config';
import type { IconName } from '@/lib/icons';

// Left navigation: three workspaces (Visualise, Guided Config, Raw Editor)
// with nested sections. Active state is driven by each route's meta.navId so
// guided clones resolve to one highlighted item. Counts + warn dots come live
// from the engine snapshot.

interface NavItem {
    id: string;
    label: string;
    to: string;
    icon: IconName;
    count?: string;
    warn?: boolean;
}
interface NavGroup {
    group: string;
    icon: IconName;
    items: NavItem[];
}

const config = useConfigStore();

const NAV = computed<NavGroup[]>(() => {
    const c = config.counts;
    const f = config.flags;
    return [
        {
            group: 'Visualise',
            icon: 'layers',
            items: [
                { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'grid', count: c.keys ? String(c.keys) : undefined },
                { id: 'scope', label: 'Scope Stack', to: '/scope-stack', icon: 'layers', warn: f.scopeWarn },
                { id: 'permissions', label: 'Permissions', to: '/permissions', icon: 'lock', count: c.rules ? String(c.rules) : undefined },
                { id: 'mcp', label: 'MCP Servers', to: '/mcp', icon: 'server', count: c.servers ? String(c.servers) : undefined },
                { id: 'memory', label: 'Memory', to: '/memory', icon: 'file', warn: f.memoryWarn },
                { id: 'extensions', label: 'Extensions', to: '/extensions', icon: 'puzzle', count: c.extensions ? String(c.extensions) : undefined },
            ],
        },
        {
            group: 'Guided Config',
            icon: 'sliders',
            items: [
                { id: 'g-perm', label: 'Permissions', to: '/guided/permissions', icon: 'lock' },
                { id: 'g-model', label: 'Model & Effort', to: '/guided/model', icon: 'sliders' },
                { id: 'g-env', label: 'Environment', to: '/guided/environment', icon: 'terminal' },
                { id: 'g-mcp', label: 'MCP Servers', to: '/guided/mcp', icon: 'server' },
                { id: 'g-mem', label: 'Memory', to: '/guided/memory', icon: 'file' },
            ],
        },
        {
            group: 'Raw Editor',
            icon: 'code',
            items: [{ id: 'raw', label: 'Files & Editor', to: '/raw', icon: 'code' }],
        },
    ];
});

const claudeVersion = computed(() => config.claudeVersion || 'Claude Code');
const route = useRoute();
</script>

<template>
    <nav class="sidebar">
        <div v-for="g in NAV" :key="g.group" class="nav-group">
            <div class="nav-head">
                <span class="ws-ico"><Icon :name="g.icon" :size="13" /></span>
                {{ g.group }}
            </div>
            <RouterLink v-for="it in g.items" :key="it.id" class="nav-item" :class="{ active: it.id === route.meta.navId }" :to="it.to">
                <span class="ni-ico"><Icon :name="it.icon" :size="15" :variant="it.id === route.meta.navId ? 'solid' : 'light'" /></span>
                {{ it.label }}
                <span v-if="it.count" class="count">{{ it.count }}</span>
                <span v-else-if="it.warn" class="warn-dot" title="needs attention"></span>
            </RouterLink>
        </div>
        <div class="grow"></div>
        <div class="side-foot">
            <Icon name="info" :size="13" />
            <span>{{ claudeVersion }} · engine live</span>
        </div>
    </nav>
</template>
