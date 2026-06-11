<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import { useTheme } from '@/composables/useTheme';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';

// Top chrome: window traffic lights, project switcher, global search,
// file-watcher heartbeat, read-only toggle, theme toggle. Search field is
// exposed for ⌘K focus. Project + sync state come from the engine store.
const router = useRouter();
const { theme, toggle: toggleTheme } = useTheme();
const config = useConfigStore();

const search = ref('');
const searchEl = ref<HTMLInputElement | null>(null);

const projectName = computed(() => config.project?.name ?? 'No project');
const currentPath = computed(() => config.project?.path ?? null);
const projects = computed(() => config.projects);
const readOnly = computed(() => config.readOnly);
const syncLabel = computed(() => (config.watching ? 'Watching · live' : 'Not watching'));

const menuOpen = ref(false);

defineExpose({ focusSearch: () => searchEl.value?.focus() });

function onSearch(e: KeyboardEvent): void {
    if (e.key === 'Enter' && search.value.trim()) {
        router.push({ path: '/dashboard', query: { q: search.value.trim() } });
    }
}

async function toggleReadOnly(): Promise<void> {
    const on = await config.toggleReadOnly();
    toast(on ? 'Read-only mode on — writes are disabled' : 'Read-only mode off', on ? 'eye' : 'check');
}

// Trim the user's home prefix for compact display; the full path is the title.
function shortPath(p: string): string {
    const home = currentPath.value && p.startsWith('/Users/') ? p.replace(/^\/Users\/[^/]+/, '~') : p.replace(/^\/home\/[^/]+/, '~');
    return home;
}

async function selectProject(path: string): Promise<void> {
    menuOpen.value = false;
    if (path === currentPath.value) return;
    await config.setProject(path);
    toast(`Switched to ${config.project?.name ?? path}`, 'check');
}

async function chooseFolder(): Promise<void> {
    menuOpen.value = false;
    await config.pickProject();
}
</script>

<template>
    <header class="toolbar">
        <div class="proj-wrap">
            <button class="proj-switch" title="Switch project" :class="{ active: menuOpen }" @click="menuOpen = !menuOpen">
                <span class="repo-dot"><Icon name="repo" :size="14" /></span>
                <span class="proj-name">{{ projectName }}</span>
                <span class="chev"><Icon name="chevDown" :size="14" /></span>
            </button>
            <div v-if="menuOpen" class="proj-backdrop" @click="menuOpen = false"></div>
            <div v-if="menuOpen" class="proj-menu">
                <div class="pm-head">Projects · {{ projects.length }} in ~/.claude.json</div>
                <div class="pm-list">
                    <button v-for="p in projects" :key="p.path" class="pm-item" :class="{ on: p.path === currentPath }" :title="p.path" @click="selectProject(p.path)">
                        <span class="pm-ico"><Icon name="repo" :size="13" /></span>
                        <span class="pm-text">
                            <span class="pm-name">{{ p.name }}</span>
                            <span class="pm-path">{{ shortPath(p.path) }}</span>
                        </span>
                        <span v-if="p.path === currentPath" class="pm-check"><Icon name="check" :size="13" /></span>
                    </button>
                    <div v-if="!projects.length" class="pm-empty">No projects recorded in ~/.claude.json yet.</div>
                </div>
                <div class="pm-foot">
                    <button class="pm-browse" @click="chooseFolder"><Icon name="folder" :size="13" /> Open a folder…</button>
                </div>
            </div>
        </div>
        <!--
        <div class="tb-search">
            <span><Icon name="search" :size="15" /></span>
            <input ref="searchEl" v-model="search" type="text" placeholder="Search keys, rules, files, servers…" @keydown="onSearch" />
            <kbd>⌘K</kbd>
        </div>
        -->
        <div class="tb-spacer"></div>
        <div class="sync" title="File watcher heartbeat">
            <span class="pulse"></span>
            {{ syncLabel }}
        </div>
        <button class="tb-toggle" :class="{ on: readOnly }" title="Read-only mode" @click="toggleReadOnly">
            <Icon name="eye" :size="14" />
            <span>Read-only</span>
            <span class="sw"></span>
        </button>
        <button class="icon-btn" title="Toggle theme" @click="toggleTheme">
            <Icon :name="theme === 'light' ? 'sun' : 'moon'" :size="16" />
        </button>
    </header>
</template>

<style scoped>
.proj-wrap {
    position: relative;
}
.proj-switch .proj-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
}
.proj-switch.active {
    background: var(--surface-4);
    border-color: var(--border-strong);
}
.proj-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
}
.proj-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 41;
    width: 320px;
    background: var(--surface-4);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
    overflow: hidden;
}
.pm-head {
    padding: 9px 12px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-dim);
    border-bottom: 1px solid var(--border-soft);
}
.pm-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
}
.pm-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 8px;
    border: 0;
    background: transparent;
    border-radius: var(--radius);
    cursor: pointer;
    text-align: left;
}
.pm-item:hover {
    background: var(--surface-2);
}
.pm-item.on {
    background: var(--accent-soft);
}
.pm-ico {
    color: var(--scope-project);
    display: flex;
    flex: 0 0 auto;
}
.pm-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}
.pm-name {
    font-size: 12.5px;
    color: var(--fg);
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pm-path {
    font: 10.5px var(--mono);
    color: var(--fg-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pm-check {
    color: var(--accent);
    display: flex;
    flex: 0 0 auto;
}
.pm-empty {
    padding: 14px 12px;
    font-size: 12px;
    color: var(--fg-dim);
    text-align: center;
}
.pm-foot {
    border-top: 1px solid var(--border-soft);
    padding: 6px;
}
.pm-browse {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    border: 0;
    background: transparent;
    border-radius: var(--radius);
    cursor: pointer;
    color: var(--fg-muted);
    font-size: 12.5px;
}
.pm-browse:hover {
    background: var(--surface-2);
    color: var(--fg);
}
</style>
