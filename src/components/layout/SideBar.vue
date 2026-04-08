<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import {
  useConfigStore,
  globalClaudeMdId,
  projectClaudeMdId,
} from "@/stores/config";
import { basename, tildify } from "@/composables/useClaudeConfigAccessors";
import type { ProjectEntry } from "@/composables/useDesktopApi";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  sub?: string;
  badge?: string | number;
  onClick?: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const PROJECT_OVERRIDES_PATH = "/instructions/overrides";

const configStore = useConfigStore();
const router = useRouter();
const { config, sidebarBadges, overrideProjects, focusedProjectPath } =
  storeToRefs(configStore);

// The CLAUDE.md sidebar entry's subtitle is the real path on disk, collapsed
// to `~` for display. When the global CLAUDE.md is missing we say so
// explicitly so the row doesn't lie about a file that doesn't exist.
const claudeMdSub = computed(() => {
  const md = config.value?.userClaudeMd;
  if (!md) return "Not created yet";
  return tildify(md.path, config.value?.home ?? null);
});

// Whole sidebar structure is reactive: badge counts and the CLAUDE.md
// subtitle recompute whenever the store reloads. Anything that isn't driven
// by data (titles, routes, icons) stays static.
const sections = computed<NavSection[]>(() => [
  {
    title: "INSTRUCTIONS",
    items: [
      {
        to: "/instructions/claude-md",
        label: "CLAUDE.md",
        icon: "lucide:file-text",
        sub: claudeMdSub.value,
        onClick: () => configStore.selectEntry(globalClaudeMdId()),
      },
      {
        to: "/instructions/overrides",
        label: "Project overrides",
        icon: "lucide:folder",
        badge: sidebarBadges.value.projectOverrideCount,
      },
    ],
  },
  {
    title: "SKILLS",
    items: [
      {
        to: "/skills/browse",
        label: "Browse skills",
        icon: "lucide:sparkles",
        badge: sidebarBadges.value.totalSkillCount,
      },
      {
        to: "/skills/active",
        label: "Active here",
        icon: "lucide:circle-check",
        badge: sidebarBadges.value.activeSkillCount,
      },
      {
        to: "/skills/terminal",
        label: "Terminal",
        icon: "lucide:terminal",
        sub: "vercel-labs/skills",
      },
    ],
  },
  {
    title: "TOOLS",
    items: [
      { to: "/tools/builtin", label: "Built-in tools", icon: "lucide:wrench" },
      {
        to: "/tools/mcp",
        label: "MCP servers",
        icon: "lucide:plug",
        badge: sidebarBadges.value.mcpServerCount,
      },
    ],
  },
]);

const route = useRoute();
const activePath = computed(() => route.path);

function isActive(path: string) {
  return activePath.value === path;
}

// ── project overrides dropdown ──────────────────────────────────────────
//
// Two layers of expansion state, both kept local because they're purely
// visual and shouldn't survive app reloads:
//   1. `overridesExpanded` — whether the dropdown under "Project overrides"
//      is showing its tree at all. Defaults to true so users discover the
//      tree on first load. Clicking the chevron toggles without navigating.
//   2. `expandedProjects` — which individual projects in the tree are
//      showing their file children. A Set keyed by absolute project path
//      so multiple projects can be expanded independently.
const overridesExpanded = ref(true);
const expandedProjects = ref(new Set<string>());

function toggleOverrides() {
  overridesExpanded.value = !overridesExpanded.value;
}

function toggleProject(path: string) {
  // Replace the Set rather than mutating in place so Vue's reactivity
  // picks up the change — Set mutations don't trigger updates by default.
  const next = new Set(expandedProjects.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  expandedProjects.value = next;
}

function isProjectExpanded(path: string) {
  return expandedProjects.value.has(path);
}

function onClickOverridesRow() {
  // Clicking the row navigates to the overrides page AND ensures the tree
  // is open. The chevron click is the only way to collapse without losing
  // your spot — see `toggleOverrides`.
  overridesExpanded.value = true;
}

function openProjectClaudeMd(projectPath: string) {
  configStore.setFocusedProject(projectPath);
  configStore.selectEntry(projectClaudeMdId(projectPath));
  router.push("/instructions/claude-md");
}

function openProjectSkills(projectPath: string) {
  configStore.setFocusedProject(projectPath);
  router.push("/skills/browse");
}

function focusProject(projectPath: string) {
  // Toggle expansion AND mark as focused, so the rest of the app reflects
  // which project the user is digging into. Doesn't navigate — staying on
  // the current page lets the user expand multiple projects to compare.
  configStore.setFocusedProject(projectPath);
  toggleProject(projectPath);
}

function projectFileCount(project: ProjectEntry): number {
  return (
    (project.claudeMd ? 1 : 0) +
    (project.localSettings ? 1 : 0) +
    (project.localSkills.length > 0 ? 1 : 0)
  );
}
</script>

<template>
  <aside
    class="flex h-full min-h-0 w-[264px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-5"
  >
    <!-- Dashboard hero entry -->
    <RouterLink
      to="/dashboard"
      class="flex items-center gap-2.5 rounded-lg border px-3 py-3 transition"
      :class="
        isActive('/dashboard')
          ? 'border-brand-tint-border bg-brand-tint'
          : 'border-transparent hover:bg-page'
      "
    >
      <Icon
        icon="lucide:layout-dashboard"
        class="h-4 w-4"
        :class="isActive('/dashboard') ? 'text-brand' : 'text-body'"
      />
      <div class="flex flex-1 flex-col leading-tight">
        <span class="text-[13px] font-semibold text-strong">Dashboard</span>
        <span class="text-[10px] text-soft">Claude &amp; Skills graph</span>
      </div>
      <span
        v-if="isActive('/dashboard')"
        class="h-1.5 w-1.5 rounded-full bg-brand"
      />
    </RouterLink>

    <!-- Sections -->
    <nav
      v-for="section in sections"
      :key="section.title"
      class="flex flex-col gap-1"
    >
      <div
        class="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-muted"
      >
        <span>{{ section.title }}</span>
        <Icon icon="lucide:plus" class="h-3 w-3 text-muted" />
      </div>

      <template v-for="item in section.items" :key="item.to">
        <!--
          Project overrides gets a custom row with a chevron toggle and an
          inline project tree below. Everything else stays on the generic
          NavItem path so adding new items doesn't require touching this
          component.
        -->
        <template v-if="item.to === PROJECT_OVERRIDES_PATH">
        <RouterLink
          :to="item.to"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition"
          :class="
            isActive(item.to)
              ? 'border border-brand-tint-border bg-brand-tint'
              : 'border border-transparent hover:bg-page'
          "
          @click="onClickOverridesRow()"
        >
          <Icon
            :icon="overridesExpanded ? 'lucide:folder-open' : item.icon"
            class="h-4 w-4"
            :class="isActive(item.to) ? 'text-brand' : 'text-muted'"
          />
          <div class="flex flex-1 flex-col leading-tight">
            <span class="text-[13px] font-medium text-body">
              {{ item.label }}
            </span>
            <span v-if="item.sub" class="truncate text-[10px] text-muted">
              {{ item.sub }}
            </span>
          </div>
          <span
            v-if="item.badge !== undefined"
            class="flex h-[18px] items-center justify-center rounded-full bg-page px-1.5 text-[10px] font-semibold text-soft"
          >
            {{ item.badge }}
          </span>
          <button
            type="button"
            class="-m-1 flex h-6 w-6 items-center justify-center rounded text-muted transition hover:bg-page hover:text-body"
            :class="{ 'text-brand': isActive(item.to) }"
            :aria-label="overridesExpanded ? 'Collapse projects' : 'Expand projects'"
            @click.stop.prevent="toggleOverrides()"
          >
            <Icon
              :icon="
                overridesExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'
              "
              class="h-3.5 w-3.5"
            />
          </button>
        </RouterLink>

        <!-- Tree of projects with overrides — only when the dropdown is open. -->
        <div
          v-if="overridesExpanded"
          class="flex flex-col gap-0.5 pl-3 pt-1 pb-1"
        >
          <p
            v-if="!overrideProjects.length"
            class="px-2 py-1 text-[11px] italic text-muted"
          >
            No projects with overrides yet.
          </p>
          <div
            v-for="project in overrideProjects"
            :key="project.path"
            class="flex flex-col gap-px"
          >
            <button
              type="button"
              class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition hover:bg-page"
              :class="{
                'bg-page': isProjectExpanded(project.path),
              }"
              :title="tildify(project.path, config?.home ?? null)"
              @click="focusProject(project.path)"
            >
              <Icon
                :icon="
                  isProjectExpanded(project.path)
                    ? 'lucide:chevron-down'
                    : 'lucide:chevron-right'
                "
                class="h-3 w-3 shrink-0"
                :class="
                  isProjectExpanded(project.path) ? 'text-body' : 'text-muted'
                "
              />
              <Icon
                :icon="
                  isProjectExpanded(project.path)
                    ? 'lucide:folder-open'
                    : 'lucide:folder'
                "
                class="h-3.5 w-3.5 shrink-0"
                :class="
                  isProjectExpanded(project.path) ? 'text-body' : 'text-muted'
                "
              />
              <span
                class="flex-1 truncate text-[12px]"
                :class="
                  isProjectExpanded(project.path)
                    ? 'font-semibold text-strong'
                    : 'font-medium text-body'
                "
              >
                {{ basename(project.path) }}
              </span>
              <span
                v-if="focusedProjectPath === project.path"
                class="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              />
            </button>

            <!-- File children of an expanded project. -->
            <div
              v-if="isProjectExpanded(project.path)"
              class="flex flex-col gap-px pt-0.5 pl-[18px]"
            >
              <button
                v-if="project.claudeMd"
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium text-body transition hover:bg-page"
                @click="openProjectClaudeMd(project.path)"
              >
                <Icon icon="lucide:file-text" class="h-3 w-3 text-claude" />
                <span class="truncate">CLAUDE.md</span>
              </button>
              <div
                v-if="project.localSettings"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-body"
              >
                <Icon icon="lucide:settings" class="h-3 w-3 text-muted" />
                <span class="truncate">settings.json</span>
              </div>
              <button
                v-if="project.localSkills.length"
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium text-body transition hover:bg-page"
                @click="openProjectSkills(project.path)"
              >
                <Icon icon="lucide:sparkles" class="h-3 w-3 text-skill" />
                <span class="truncate">
                  skills ({{ project.localSkills.length }})
                </span>
              </button>
              <p
                v-if="!projectFileCount(project)"
                class="px-2 py-1 text-[11px] italic text-muted"
              >
                No files yet.
              </p>
            </div>
          </div>
        </div>

        </template>

        <RouterLink
          v-else
          :to="item.to"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition"
          :class="
            isActive(item.to)
              ? 'border border-brand-tint-border bg-brand-tint'
              : 'border border-transparent hover:bg-page'
          "
          @click="item.onClick?.()"
        >
          <Icon
            :icon="item.icon"
            class="h-4 w-4"
            :class="isActive(item.to) ? 'text-brand' : 'text-muted'"
          />
          <div class="flex flex-1 flex-col leading-tight">
            <span class="text-[13px] font-medium text-body">{{ item.label }}</span>
            <span v-if="item.sub" class="truncate text-[10px] text-muted">
              {{ item.sub }}
            </span>
          </div>
          <span
            v-if="item.badge !== undefined"
            class="flex h-[18px] items-center justify-center rounded-full bg-page px-1.5 text-[10px] font-semibold text-soft"
          >
            {{ item.badge }}
          </span>
          <span
            v-else-if="isActive(item.to)"
            class="h-1.5 w-1.5 rounded-full bg-brand"
          />
        </RouterLink>
      </template>
    </nav>
  </aside>
</template>
