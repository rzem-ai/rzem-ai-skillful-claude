<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore } from "@/stores/config";
import { basename, tildify } from "@/composables/useClaudeConfigAccessors";
import type { Skill } from "@/composables/useTauriFs";

const configStore = useConfigStore();
const { config, allSkills } = storeToRefs(configStore);

interface SkillGroup {
  label: string;
  sub: string | null;
  skills: Skill[];
}

// Group skills by source so users can see which project a skill ships with.
// Global first, then one group per project that has local skills.
const groups = computed<SkillGroup[]>(() => {
  if (!config.value) return [];
  const out: SkillGroup[] = [];

  if (config.value.userSkills.length) {
    out.push({
      label: "Global",
      sub: tildify(`${config.value.userDir}/skills`, config.value.home),
      skills: config.value.userSkills,
    });
  }

  for (const project of config.value.projects) {
    if (project.localSkills.length === 0) continue;
    out.push({
      label: basename(project.path),
      sub: tildify(project.path, config.value.home),
      skills: project.localSkills,
    });
  }

  return out;
});

function skillDisplayName(skill: Skill): string {
  if (skill.name) return skill.name;
  // Skills live at `{skillDir}/SKILL.md`, so the parent directory name is a
  // reasonable fallback display label.
  const parts = skill.path.split("/");
  return parts[parts.length - 2] ?? skill.path;
}
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">Browse skills</h1>
    <span class="text-[12px] text-soft">
      {{ allSkills.length }} in library
    </span>
  </div>

  <div
    v-if="!groups.length"
    class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-soft"
  >
    <div class="flex flex-col items-center gap-2">
      <Icon icon="lucide:sparkles" class="h-8 w-8" />
      <p class="text-[13px]">No skills found.</p>
      <p class="text-[11px]">
        Drop a <code>SKILL.md</code> into <code>~/.claude/skills/</code> to
        get started.
      </p>
    </div>
  </div>

  <div v-else class="flex flex-col gap-5">
    <section v-for="group in groups" :key="group.label">
      <div class="mb-2 flex items-baseline gap-2 px-1">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          {{ group.label }}
        </h2>
        <span v-if="group.sub" class="text-[11px] text-soft">{{ group.sub }}</span>
        <span class="ml-auto text-[11px] font-semibold text-soft">
          {{ group.skills.length }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="skill in group.skills"
          :key="skill.path"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <Icon icon="lucide:sparkles" class="mt-0.5 h-4 w-4 text-skill" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="truncate text-[13px] font-semibold text-strong">
                {{ skillDisplayName(skill) }}
              </span>
              <span
                v-if="Object.keys(skill.frontmatter).length"
                class="rounded bg-page px-1.5 py-0.5 text-[10px] font-medium text-soft"
              >
                {{ Object.keys(skill.frontmatter).length }} keys
              </span>
            </div>
            <p
              v-if="skill.description"
              class="mt-0.5 text-[12px] text-body line-clamp-2"
            >
              {{ skill.description }}
            </p>
            <p
              class="mt-1 truncate text-[10px] text-muted"
              :title="skill.path"
            >
              {{ tildify(skill.path, config?.home ?? null) }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
