<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useConfigStore, type MergedMcpEntry } from "@/stores/config";
import { basename, tildify } from "@/composables/useClaudeConfigAccessors";

const configStore = useConfigStore();
const { config, allMcpServers } = storeToRefs(configStore);

// Split for the two groups in the UI: global servers first, then per-project
// bundles so users can see which project is overriding/adding what.
const globalServers = computed(() =>
  allMcpServers.value.filter((s) => s.scope === "global"),
);

const perProjectServers = computed(() => {
  const out = new Map<string, MergedMcpEntry[]>();
  for (const server of allMcpServers.value) {
    if (server.scope !== "project" || !server.projectPath) continue;
    const bucket = out.get(server.projectPath) ?? [];
    bucket.push(server);
    out.set(server.projectPath, bucket);
  }
  return Array.from(out.entries());
});

// `mcpServers[name]` in ~/.claude.json typically looks like
// `{ type: "stdio" | "http", command: "...", args: [...] }`. We peek a few
// common fields for the preview row but keep the raw value for detail views.
function describeServer(server: MergedMcpEntry): string {
  const raw = server.config;
  if (!raw || typeof raw !== "object") return "";
  const asAny = raw as Record<string, unknown>;
  const type = typeof asAny.type === "string" ? asAny.type : "";
  const command = typeof asAny.command === "string" ? asAny.command : "";
  const url = typeof asAny.url === "string" ? asAny.url : "";
  if (url) return `${type || "http"} · ${url}`;
  if (command) return `${type || "stdio"} · ${command}`;
  return type || "";
}
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">MCP servers</h1>
    <span class="text-[12px] text-soft">
      {{ allMcpServers.length }} configured
    </span>
  </div>

  <div
    v-if="!allMcpServers.length"
    class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-soft"
  >
    <div class="flex flex-col items-center gap-2">
      <Icon icon="lucide:plug" class="h-8 w-8" />
      <p class="text-[13px]">No MCP servers configured.</p>
      <p class="text-[11px]">
        Add one under <code>mcpServers</code> in <code>~/.claude.json</code>.
      </p>
    </div>
  </div>

  <div v-else class="flex flex-col gap-5">
    <section v-if="globalServers.length">
      <div class="mb-2 flex items-baseline gap-2 px-1">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Global
        </h2>
        <span class="text-[11px] text-soft">~/.claude.json</span>
        <span class="ml-auto text-[11px] font-semibold text-soft">
          {{ globalServers.length }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="server in globalServers"
          :key="`g-${server.name}`"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <Icon icon="lucide:plug" class="mt-0.5 h-4 w-4 text-claude" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="truncate text-[13px] font-semibold text-strong">
                {{ server.name }}
              </span>
              <span class="rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                global
              </span>
            </div>
            <p v-if="describeServer(server)" class="mt-0.5 truncate text-[11px] text-body">
              {{ describeServer(server) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section v-for="[projectPath, servers] in perProjectServers" :key="projectPath">
      <div class="mb-2 flex items-baseline gap-2 px-1">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          {{ basename(projectPath) }}
        </h2>
        <span class="text-[11px] text-soft" :title="projectPath">
          {{ tildify(projectPath, config?.home ?? null) }}
        </span>
        <span class="ml-auto text-[11px] font-semibold text-soft">
          {{ servers.length }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div
          v-for="server in servers"
          :key="`p-${projectPath}-${server.name}`"
          class="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"
        >
          <Icon icon="lucide:plug" class="mt-0.5 h-4 w-4 text-skill" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="truncate text-[13px] font-semibold text-strong">
                {{ server.name }}
              </span>
              <span class="rounded bg-page px-1.5 py-0.5 text-[10px] font-semibold text-soft">
                project
              </span>
            </div>
            <p v-if="describeServer(server)" class="mt-0.5 truncate text-[11px] text-body">
              {{ describeServer(server) }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
