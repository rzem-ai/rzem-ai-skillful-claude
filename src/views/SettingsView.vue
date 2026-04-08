<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore } from "@/stores/config";
import { basename, tildify } from "@/composables/useClaudeConfigAccessors";
import {
  checkForUpdates,
  getAppMeta,
  onUpdaterStatus,
  quitAndInstallUpdate,
  type AppMeta,
  type UpdaterStatus,
} from "@/composables/useDesktopApi";

const configStore = useConfigStore();
const { config, activeProjectEntry } = storeToRefs(configStore);

// ── Updates panel ──────────────────────────────────────────────────────
//
// Pulls the running app version from the main process and subscribes to
// `updater:status` events. The updater itself is a no-op in dev because
// `app.isPackaged` is false there — we surface that as an inline notice
// so the buttons aren't mysteriously dead during local development.

const appMeta = ref<AppMeta | null>(null);
const updateStatus = ref<UpdaterStatus | null>(null);
const checking = ref(false);
const checkMessage = ref<string | null>(null);
let unsubStatus: (() => void) | null = null;

onMounted(async () => {
  try {
    appMeta.value = await getAppMeta();
  } catch (err) {
    console.error("settings: failed to read app meta", err);
  }
  unsubStatus = onUpdaterStatus((status) => {
    updateStatus.value = status;
  });
});

onUnmounted(() => {
  unsubStatus?.();
});

async function onCheckUpdates() {
  checking.value = true;
  checkMessage.value = null;
  try {
    const result = await checkForUpdates();
    checkMessage.value = result.message ?? (result.ok ? "OK" : "Failed");
  } catch (err) {
    checkMessage.value = (err as Error).message;
  } finally {
    checking.value = false;
  }
}

async function onInstall() {
  await quitAndInstallUpdate();
}

const downloadProgress = computed(() => {
  if (updateStatus.value?.kind !== "progress") return null;
  return Math.round(updateStatus.value.percent ?? 0);
});

const statusLabel = computed(() => {
  const s = updateStatus.value;
  if (!s) return "Idle";
  switch (s.kind) {
    case "checking":
      return "Checking for updates…";
    case "available":
      return `Update available: v${s.version ?? "?"}`;
    case "not-available":
      return `Up to date (v${s.version ?? appMeta.value?.version ?? "?"})`;
    case "progress":
      return `Downloading update (${downloadProgress.value ?? 0}%)`;
    case "downloaded":
      return `Update v${s.version ?? "?"} ready to install`;
    case "error":
      return `Update error: ${s.message ?? "unknown"}`;
  }
  return "Idle";
});

const isDownloaded = computed(() => updateStatus.value?.kind === "downloaded");

// Pretty-print the raw settings JSON so users can see exactly what's on
// disk. This view is read-only for now — a structured editor lives behind
// dedicated per-feature views (Active skills, MCP servers, etc.).
const globalJson = computed(() => {
  const raw = config.value?.userSettings?.raw;
  if (raw === undefined) return null;
  return JSON.stringify(raw, null, 2);
});

const projectJson = computed(() => {
  const raw = activeProjectEntry.value?.localSettings?.raw;
  if (raw === undefined) return null;
  return JSON.stringify(raw, null, 2);
});

const globalPath = computed(
  () => config.value?.userSettings?.path ?? null,
);

const projectPath = computed(
  () => activeProjectEntry.value?.localSettings?.path ?? null,
);
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">Settings</h1>
    <span class="text-[12px] text-soft">
      Read-only view of <code>settings.json</code>
    </span>
  </div>

  <div class="flex flex-col gap-5">
    <!-- ── Updates ──────────────────────────────────────────────────── -->
    <section class="rounded-xl border border-line bg-surface">
      <header class="flex items-center justify-between border-b border-line px-5 py-3">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:download-cloud" class="h-4 w-4 text-claude" />
          <h2 class="text-[13px] font-semibold text-strong">Updates</h2>
        </div>
        <span v-if="appMeta" class="text-[11px] text-muted">
          v{{ appMeta.version }} · {{ appMeta.platform }}/{{ appMeta.arch }}
        </span>
      </header>
      <div class="flex flex-col gap-3 p-5">
        <p
          v-if="appMeta && !appMeta.isPackaged"
          class="rounded-md border border-line bg-page px-3 py-2 text-[11px] text-muted"
        >
          <Icon icon="lucide:info" class="mr-1 inline h-3 w-3" />
          Auto-update is disabled in development. Buttons below are wired
          but won't contact GitHub Releases until you ship a packaged build.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="flex h-8 items-center gap-1.5 rounded-md border border-line bg-page px-3 text-[12px] font-semibold text-strong transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="checking"
            @click="onCheckUpdates"
          >
            <Icon
              :icon="checking ? 'lucide:loader-circle' : 'lucide:refresh-cw'"
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': checking }"
            />
            {{ checking ? "Checking…" : "Check for updates" }}
          </button>

          <button
            v-if="isDownloaded"
            type="button"
            class="flex h-8 items-center gap-1.5 rounded-md bg-claude px-3 text-[12px] font-semibold text-surface transition hover:opacity-90"
            @click="onInstall"
          >
            <Icon icon="lucide:rocket" class="h-3.5 w-3.5" />
            Install &amp; restart
          </button>

          <span class="text-[12px] text-soft">
            {{ statusLabel }}
          </span>
        </div>

        <!-- Download progress bar -->
        <div
          v-if="downloadProgress !== null"
          class="h-1.5 w-full overflow-hidden rounded-full bg-page"
        >
          <div
            class="h-full bg-claude transition-[width] duration-150"
            :style="{ width: `${downloadProgress}%` }"
          />
        </div>

        <p
          v-if="checkMessage"
          class="text-[11px] text-muted"
        >
          {{ checkMessage }}
        </p>
      </div>
    </section>

    <section class="rounded-xl border border-line bg-surface">
      <header class="flex items-center justify-between border-b border-line px-5 py-3">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:globe" class="h-4 w-4 text-claude" />
          <h2 class="text-[13px] font-semibold text-strong">Global settings</h2>
        </div>
        <span
          v-if="globalPath"
          class="truncate text-[11px] text-muted"
          :title="globalPath"
        >
          {{ tildify(globalPath, config?.home ?? null) }}
        </span>
      </header>
      <div class="p-5">
        <pre
          v-if="globalJson"
          class="max-h-[400px] overflow-auto rounded-md bg-page p-4 font-mono text-[11px] text-body"
          >{{ globalJson }}</pre
        >
        <p v-else class="text-[12px] text-soft">
          No <code>~/.claude/settings.json</code> on disk.
        </p>
      </div>
    </section>

    <section class="rounded-xl border border-line bg-surface">
      <header class="flex items-center justify-between border-b border-line px-5 py-3">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:folder" class="h-4 w-4 text-skill" />
          <h2 class="text-[13px] font-semibold text-strong">
            Project settings
            <template v-if="activeProjectEntry">
              · {{ basename(activeProjectEntry.path) }}
            </template>
          </h2>
        </div>
        <span
          v-if="projectPath"
          class="truncate text-[11px] text-muted"
          :title="projectPath"
        >
          {{ tildify(projectPath, config?.home ?? null) }}
        </span>
      </header>
      <div class="p-5">
        <p v-if="!activeProjectEntry" class="text-[12px] text-soft">
          No project focused. Pick a project from
          <strong>Project overrides</strong> to view its
          <code>.claude/settings.json</code>.
        </p>
        <pre
          v-else-if="projectJson"
          class="max-h-[400px] overflow-auto rounded-md bg-page p-4 font-mono text-[11px] text-body"
          >{{ projectJson }}</pre
        >
        <p v-else class="text-[12px] text-soft">
          This project has no <code>.claude/settings.json</code> on disk.
        </p>
      </div>
    </section>
  </div>
</template>
