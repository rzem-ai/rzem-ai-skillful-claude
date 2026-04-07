<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore } from "@/stores/config";
import {
  basename,
  getAllowedTools,
  getDisabledTools,
  tildify,
} from "@/composables/useClaudeConfigAccessors";
import type { Skill } from "@/composables/useTauriFs";

const configStore = useConfigStore();
const { config, allSkills, activeProjectEntry } = storeToRefs(configStore);

// Effective allow/deny lists are the union of the global ~/.claude.json
// entries and (when a project is in focus) the project-specific overrides.
// If both lists are empty we treat *every* skill as implicitly enabled,
// which matches Claude Code's default-open behavior.
const effectiveAllow = computed(() => {
  if (!config.value) return new Set<string>();
  const set = new Set(getAllowedTools(config.value.userConfigRaw));
  if (activeProjectEntry.value) {
    for (const t of getAllowedTools(activeProjectEntry.value.config)) set.add(t);
  }
  return set;
});

const effectiveDisable = computed(() => {
  if (!config.value) return new Set<string>();
  const set = new Set(getDisabledTools(config.value.userConfigRaw));
  if (activeProjectEntry.value) {
    for (const t of getDisabledTools(activeProjectEntry.value.config)) set.add(t);
  }
  return set;
});

const hasExplicitOverrides = computed(
  () => effectiveAllow.value.size > 0 || effectiveDisable.value.size > 0,
);

function skillKey(skill: Skill): string {
  return skill.name ?? skill.path;
}

function isActive(skill: Skill): boolean {
  const key = skillKey(skill);
  if (effectiveDisable.value.has(key)) return false;
  if (effectiveAllow.value.size === 0) return true;
  return effectiveAllow.value.has(key);
}

const enabledSkills = computed(() => allSkills.value.filter(isActive));
const disabledSkills = computed(() => allSkills.value.filter((s) => !isActive(s)));

function skillDisplayName(skill: Skill): string {
  if (skill.name) return skill.name;
  const parts = skill.path.split("/");
  return parts[parts.length - 2] ?? skill.path;
}
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">Active here</h1>
    <span class="text-[12px] text-soft">
      {{ enabledSkills.length }} enabled
      <template v-if="activeProjectEntry">
        · {{ basename(activeProjectEntry.path) }}
      </template>
      <template v-else>· global</template>
    </span>
  </div>

  <div
    v-if="!hasExplicitOverrides"
    class="rounded-md border border-dashed border-line bg-surface px-3 py-2 text-[11px] text-soft"
  >
    No explicit <code>allowedTools</code>/<code>disabledTools</code> found in
    <code>~/.claude.json</code>{{ activeProjectEntry ? " or the focused project" : "" }};
    showing all skills as implicitly active.
  </div>

  <div v-if="!allSkills.length" class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-soft">
    <div class="flex flex-col items-center gap-2">
      <Icon icon="lucide:circle-check" class="h-8 w-8" />
      <p class="text-[13px]">No skills installed.</p>
    </div>
  </div>

  <div v-else class="flex flex-col gap-5">
    <section v-if="enabledSkills.length">
      <div class="mb-2 flex items-baseline gap-2 px-1">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Enabled
        </h2>
        <span class="ml-auto text-[11px] font-semibold text-soft">
          {{ enabledSkills.length }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="skill in enabledSkills"
          :key="skill.path"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <Icon icon="lucide:check-circle-2" class="mt-0.5 h-4 w-4 text-brand" />
          <div class="flex-1 min-w-0">
            <div class="truncate text-[13px] font-semibold text-strong">
              {{ skillDisplayName(skill) }}
            </div>
            <p
              v-if="skill.description"
              class="mt-0.5 text-[12px] text-body line-clamp-2"
            >
              {{ skill.description }}
            </p>
            <p class="mt-1 truncate text-[10px] text-muted" :title="skill.path">
              {{ tildify(skill.path, config?.home ?? null) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section v-if="disabledSkills.length">
      <div class="mb-2 flex items-baseline gap-2 px-1">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Disabled
        </h2>
        <span class="ml-auto text-[11px] font-semibold text-soft">
          {{ disabledSkills.length }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="skill in disabledSkills"
          :key="skill.path"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 opacity-70"
        >
          <Icon icon="lucide:x-circle" class="mt-0.5 h-4 w-4 text-soft" />
          <div class="flex-1 min-w-0">
            <div class="truncate text-[13px] font-semibold text-body">
              {{ skillDisplayName(skill) }}
            </div>
            <p class="mt-1 truncate text-[10px] text-muted" :title="skill.path">
              {{ tildify(skill.path, config?.home ?? null) }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
