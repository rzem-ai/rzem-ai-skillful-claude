<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useRoute, RouterLink } from "vue-router";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore, globalClaudeMdId } from "@/stores/config";
import { tildify } from "@/composables/useClaudeConfigAccessors";

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

const configStore = useConfigStore();
const { config, sidebarBadges } = storeToRefs(configStore);

// The CLAUDE.md sidebar entry's subtitle is the real path on disk, collapsed
// to `~` for display. When the global CLAUDE.md is missing we still show a
// hint so the row isn't empty.
const claudeMdSub = computed(() => {
  const md = config.value?.userClaudeMd;
  if (!md) return "~/.claude/CLAUDE.md";
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
</script>

<template>
  <aside
    class="flex w-[264px] shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-5"
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

      <RouterLink
        v-for="item in section.items"
        :key="item.to"
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
    </nav>
  </aside>
</template>
