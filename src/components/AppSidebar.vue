<script setup lang="ts">
import { useRoute } from 'vue-router';
import Icon from '@/components/Icon.vue';
import type { IconName } from '@/lib/icons';

// Left navigation: three workspaces (Visualise, Guided Config, Raw Editor)
// with nested sections. Ported from shell.js NAV. Active state is driven by
// each route's meta.navId so guided clones resolve to one highlighted item.

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

const NAV: NavGroup[] = [
    {
        group: 'Visualise',
        icon: 'layers',
        items: [
            { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'grid' },
            { id: 'scope', label: 'Scope Stack', to: '/scope-stack', icon: 'layers', warn: true },
            { id: 'permissions', label: 'Permissions', to: '/permissions', icon: 'lock', count: '10' },
            { id: 'mcp', label: 'MCP Servers', to: '/mcp', icon: 'db', count: '4' },
            { id: 'memory', label: 'Memory', to: '/memory', icon: 'file', warn: true },
            { id: 'extensions', label: 'Extensions', to: '/extensions', icon: 'puzzle', count: '4' },
        ],
    },
    {
        group: 'Guided Config',
        icon: 'sliders',
        items: [
            { id: 'g-perm', label: 'Permissions', to: '/guided/permissions', icon: 'lock' },
            { id: 'g-model', label: 'Model & Effort', to: '/guided/permissions', icon: 'sliders' },
            { id: 'g-env', label: 'Environment', to: '/guided/permissions', icon: 'terminal' },
            { id: 'g-mcp', label: 'MCP Servers', to: '/guided/permissions', icon: 'db' },
            { id: 'g-mem', label: 'Memory', to: '/guided/permissions', icon: 'file' },
        ],
    },
    {
        group: 'Raw Editor',
        icon: 'code',
        items: [{ id: 'raw', label: 'Files & Editor', to: '/raw', icon: 'code' }],
    },
];

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
                <span class="ni-ico"><Icon :name="it.icon" :size="15" /></span>
                {{ it.label }}
                <span v-if="it.count" class="count">{{ it.count }}</span>
                <span v-else-if="it.warn" class="warn-dot" title="needs attention"></span>
            </RouterLink>
        </div>
        <div class="grow"></div>
        <div class="side-foot">
            <Icon name="info" :size="13" />
            <span>Claude Code 2.1.144 · engine v0.9</span>
        </div>
    </nav>
</template>
