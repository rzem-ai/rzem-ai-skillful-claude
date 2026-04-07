<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useRoute, RouterLink } from "vue-router";
import { computed } from "vue";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  sub?: string;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "INSTRUCTIONS",
    items: [
      {
        to: "/instructions/claude-md",
        label: "CLAUDE.md",
        icon: "lucide:file-text",
        sub: "~/.claude/CLAUDE.md",
      },
      {
        to: "/instructions/overrides",
        label: "Project overrides",
        icon: "lucide:folder",
        badge: "3",
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
        badge: "26",
      },
      {
        to: "/skills/active",
        label: "Active here",
        icon: "lucide:circle-check",
        badge: "8",
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
        badge: "4",
      },
    ],
  },
];

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
          v-if="item.badge"
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
