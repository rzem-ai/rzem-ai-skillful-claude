<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import {
  useConfigStore,
  projectClaudeMdId,
  type ConfigScope,
} from "@/stores/config";
import { basename, tildify } from "@/composables/useClaudeConfigAccessors";

const configStore = useConfigStore();
const { config, focusedProjectPath } = storeToRefs(configStore);
const router = useRouter();

// Projects that have any kind of override on disk — CLAUDE.md, local
// settings, or local skills. A project that exists in ~/.claude.json but
// has zero overrides on disk is uninteresting for this view.
const overrideProjects = computed(() => {
  if (!config.value) return [];
  return config.value.projects.filter(
    (p) =>
      p.claudeMd !== null ||
      p.localSettings !== null ||
      p.localSkills.length > 0,
  );
});

const staleProjects = computed(() => {
  if (!config.value) return [];
  return config.value.projects.filter((p) => !p.exists);
});

const activeCount = computed(
  () => overrideProjects.value.filter((p) => p.exists).length,
);

function openProjectClaudeMd(projectPath: string, hasClaudeMd: boolean) {
  if (!hasClaudeMd) return;
  configStore.setFocusedProject(projectPath);
  // Explicit cast: setFocusedProject flips scope to `project` already, but
  // we keep the type import around for future places that need it.
  void ("project" satisfies ConfigScope);
  configStore.selectEntry(projectClaudeMdId(projectPath));
  router.push("/instructions/claude-md");
}

function focusProject(projectPath: string) {
  configStore.setFocusedProject(projectPath);
}
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">
      Project overrides
    </h1>
    <span class="text-[12px] text-soft">
      {{ activeCount }} {{ activeCount === 1 ? "project" : "projects" }} with
      overrides
    </span>
  </div>

  <div
    v-if="!overrideProjects.length && !staleProjects.length"
    class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-soft"
  >
    <div class="flex flex-col items-center gap-2">
      <Icon icon="lucide:folder" class="h-8 w-8" />
      <p class="text-[13px]">No projects with overrides yet.</p>
    </div>
  </div>

  <div v-else class="flex flex-col gap-3">
    <div
      v-for="project in overrideProjects"
      :key="project.path"
      class="rounded-xl border border-line bg-surface transition hover:border-brand-tint-border"
      :class="{
        'ring-2 ring-brand-tint-border': focusedProjectPath === project.path,
      }"
    >
      <button
        type="button"
        class="flex w-full items-start gap-3 px-5 py-4 text-left"
        @click="focusProject(project.path)"
      >
        <Icon icon="lucide:folder" class="mt-0.5 h-4 w-4 text-claude" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="truncate text-[14px] font-semibold text-strong">
              {{ basename(project.path) }}
            </span>
            <span
              v-if="!project.exists"
              class="rounded bg-skill/20 px-1.5 py-0.5 text-[10px] font-semibold text-skill"
            >
              stale
            </span>
            <span
              v-if="focusedProjectPath === project.path"
              class="rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand"
            >
              focused
            </span>
          </div>
          <div class="truncate text-[11px] text-muted" :title="project.path">
            {{ tildify(project.path, config?.home ?? null) }}
          </div>
        </div>
        <div class="flex items-center gap-4 text-[11px] text-soft">
          <span v-if="project.claudeMd" class="flex items-center gap-1">
            <Icon icon="lucide:file-text" class="h-3 w-3" />
            CLAUDE.md
          </span>
          <span v-if="project.localSettings" class="flex items-center gap-1">
            <Icon icon="lucide:settings" class="h-3 w-3" />
            settings
          </span>
          <span v-if="project.localSkills.length" class="flex items-center gap-1">
            <Icon icon="lucide:sparkles" class="h-3 w-3" />
            {{ project.localSkills.length }}
            {{ project.localSkills.length === 1 ? "skill" : "skills" }}
          </span>
        </div>
      </button>
      <div
        v-if="project.claudeMd"
        class="flex items-center justify-between border-t border-line px-5 py-2.5"
      >
        <span class="truncate text-[11px] text-muted" :title="project.claudeMd.path">
          {{ tildify(project.claudeMd.path, config?.home ?? null) }}
        </span>
        <button
          type="button"
          class="text-[11px] font-semibold text-brand hover:underline"
          @click="openProjectClaudeMd(project.path, project.claudeMd !== null)"
        >
          Open editor →
        </button>
      </div>
    </div>

    <section
      v-if="staleProjects.length"
      class="rounded-xl border border-dashed border-line bg-surface p-4"
    >
      <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        Stale entries ({{ staleProjects.length }})
      </h2>
      <p class="mt-1 text-[11px] text-soft">
        Referenced in <code>~/.claude.json</code> but the directory is missing
        on disk.
      </p>
      <ul class="mt-2 space-y-1">
        <li
          v-for="project in staleProjects"
          :key="project.path"
          class="truncate text-[11px] text-muted"
          :title="project.path"
        >
          {{ tildify(project.path, config?.home ?? null) }}
        </li>
      </ul>
    </section>
  </div>
</template>
