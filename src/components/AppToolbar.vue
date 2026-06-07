<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import Icon from "@/components/Icon.vue";
import { useTheme } from "@/composables/useTheme";
import { toast } from "@/composables/useToast";

// Top chrome: window traffic lights, project switcher, global search,
// file-watcher heartbeat, read-only toggle, theme toggle. Ported from
// shell.js buildToolbar. Search field is exposed for ⌘K focus.
const router = useRouter();
const { theme, toggle: toggleTheme } = useTheme();

const readOnly = ref(false);
const search = ref("");
const searchEl = ref<HTMLInputElement | null>(null);

defineExpose({ focusSearch: () => searchEl.value?.focus() });

function onSearch(e: KeyboardEvent): void {
  if (e.key === "Enter" && search.value.trim()) {
    router.push({ path: "/dashboard", query: { q: search.value.trim() } });
  }
}

function toggleReadOnly(): void {
  readOnly.value = !readOnly.value;
  toast(
    readOnly.value
      ? "Read-only mode on — writes are disabled"
      : "Read-only mode off",
    readOnly.value ? "eye" : "check",
  );
}

function switchProject(): void {
  toast(
    "Project switcher — recent: config-studio · claude-plugins · rzem-web",
    "repo",
  );
}
</script>

<template>
  <header class="toolbar">
    <div class="traffic"><i></i><i></i><i></i></div>
    <button class="proj-switch" title="Switch project" @click="switchProject">
      <span class="repo-dot"><Icon name="repo" :size="14" /></span>
      <span>config-studio</span>
      <span class="path">~/Projects/config-studio</span>
      <span class="chev"><Icon name="chevDown" :size="14" /></span>
    </button>
    <div class="tb-search">
      <span><Icon name="search" :size="15" /></span>
      <input
        ref="searchEl"
        v-model="search"
        type="text"
        placeholder="Search keys, rules, files, servers…"
        @keydown="onSearch"
      />
      <kbd>⌘K</kbd>
    </div>
    <div class="tb-spacer"></div>
    <div class="sync" title="File watcher heartbeat">
      <span class="pulse"></span>Watching · synced 2s ago
    </div>
    <button
      class="tb-toggle"
      :class="{ on: readOnly }"
      title="Read-only mode"
      @click="toggleReadOnly"
    >
      <Icon name="eye" :size="14" /><span>Read-only</span><span class="sw"></span>
    </button>
    <button class="icon-btn" title="Toggle theme" @click="toggleTheme">
      <Icon :name="theme === 'light' ? 'sun' : 'moon'" :size="16" />
    </button>
  </header>
</template>
