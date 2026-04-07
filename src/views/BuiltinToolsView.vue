<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore } from "@/stores/config";
import {
  basename,
  getAllowedTools,
  getDisabledTools,
} from "@/composables/useClaudeConfigAccessors";

const configStore = useConfigStore();
const { config, activeProjectEntry } = storeToRefs(configStore);

// The canonical Claude Code built-in tool set. Static list — new tools ship
// with Claude Code updates, not with this app. Keep sorted by category so
// the UI stays legible as the set grows.
interface ToolDef {
  name: string;
  category: "Files" | "Shell" | "Web" | "Tasks" | "Other";
  description: string;
  icon: string;
}

const BUILTIN_TOOLS: ToolDef[] = [
  { name: "Read", category: "Files", description: "Read files from disk", icon: "lucide:file" },
  { name: "Write", category: "Files", description: "Write files to disk", icon: "lucide:file-plus" },
  { name: "Edit", category: "Files", description: "In-place edits", icon: "lucide:file-edit" },
  { name: "Glob", category: "Files", description: "Find files by pattern", icon: "lucide:search" },
  { name: "Grep", category: "Files", description: "Search file contents", icon: "lucide:search-code" },
  { name: "Bash", category: "Shell", description: "Run shell commands", icon: "lucide:terminal" },
  { name: "WebFetch", category: "Web", description: "Fetch URLs", icon: "lucide:globe" },
  { name: "WebSearch", category: "Web", description: "Search the web", icon: "lucide:search" },
  { name: "Task", category: "Tasks", description: "Launch subagents", icon: "lucide:bot" },
  { name: "TodoWrite", category: "Tasks", description: "Track todos", icon: "lucide:list-checks" },
  { name: "NotebookEdit", category: "Files", description: "Edit Jupyter notebooks", icon: "lucide:book-open" },
];

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

const hasOverrides = computed(
  () => effectiveAllow.value.size > 0 || effectiveDisable.value.size > 0,
);

function statusOf(tool: ToolDef): "allowed" | "disabled" | "default" {
  // `allowedTools` entries in ~/.claude.json are commonly written in the
  // form "Bash(git status)" — prefix match so the whole Bash tool lights up
  // when any specific bash invocation is allow-listed.
  const prefixAllow = Array.from(effectiveAllow.value).some((entry) =>
    entry === tool.name || entry.startsWith(`${tool.name}(`),
  );
  const prefixDisable = Array.from(effectiveDisable.value).some((entry) =>
    entry === tool.name || entry.startsWith(`${tool.name}(`),
  );
  if (prefixDisable) return "disabled";
  if (prefixAllow) return "allowed";
  return "default";
}

const grouped = computed(() => {
  const out = new Map<string, ToolDef[]>();
  for (const tool of BUILTIN_TOOLS) {
    const bucket = out.get(tool.category) ?? [];
    bucket.push(tool);
    out.set(tool.category, bucket);
  }
  return Array.from(out.entries());
});
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">Built-in tools</h1>
    <span class="text-[12px] text-soft">
      {{ BUILTIN_TOOLS.length }} tools
      <template v-if="activeProjectEntry">
        · {{ basename(activeProjectEntry.path) }}
      </template>
    </span>
  </div>

  <div
    v-if="!hasOverrides"
    class="rounded-md border border-dashed border-line bg-surface px-3 py-2 text-[11px] text-soft"
  >
    No <code>allowedTools</code>/<code>disabledTools</code> entries in
    <code>~/.claude.json</code>{{ activeProjectEntry ? " or the focused project" : "" }};
    all tools are at their defaults.
  </div>

  <div class="flex flex-col gap-5">
    <section v-for="[category, tools] in grouped" :key="category">
      <h2 class="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        {{ category }}
      </h2>
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div
          v-for="tool in tools"
          :key="tool.name"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <Icon :icon="tool.icon" class="mt-0.5 h-4 w-4 text-body" />
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-[13px] font-semibold text-strong">{{ tool.name }}</span>
              <span
                v-if="statusOf(tool) === 'allowed'"
                class="rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand"
              >
                allow-listed
              </span>
              <span
                v-else-if="statusOf(tool) === 'disabled'"
                class="rounded bg-skill/20 px-1.5 py-0.5 text-[10px] font-semibold text-skill"
              >
                disabled
              </span>
              <span
                v-else
                class="rounded bg-page px-1.5 py-0.5 text-[10px] font-medium text-soft"
              >
                default
              </span>
            </div>
            <p class="mt-0.5 text-[11px] text-muted">{{ tool.description }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
