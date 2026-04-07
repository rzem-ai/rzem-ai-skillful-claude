<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore } from "@/stores/config";
import { basename, tildify } from "@/composables/useClaudeConfigAccessors";

const configStore = useConfigStore();
const { config, activeProjectEntry } = storeToRefs(configStore);

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
