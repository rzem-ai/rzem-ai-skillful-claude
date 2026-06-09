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
const projectPath = computed(() => config.project?.path ?? 'Click to choose a folder');
const readOnly = computed(() => config.readOnly);
const syncLabel = computed(() => (config.watching ? 'Watching · live' : 'Not watching'));

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

async function switchProject(): Promise<void> {
    await config.pickProject();
}
</script>

<template>
    <header class="toolbar">
        <button class="proj-switch" title="Switch project" @click="switchProject">
            <span class="repo-dot"><Icon name="repo" :size="14" /></span>
            <span>{{ projectName }}</span>
            <!--
            <span class="path">{{ projectPath }}</span>
            -->
            <span class="chev"><Icon name="chevDown" :size="14" /></span>
        </button>
        <div class="tb-search">
            <span><Icon name="search" :size="15" /></span>
            <input ref="searchEl" v-model="search" type="text" placeholder="Search keys, rules, files, servers…" @keydown="onSearch" />
            <kbd>⌘K</kbd>
        </div>
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
