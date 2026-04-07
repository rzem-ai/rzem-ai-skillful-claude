<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { useWorkspaceStore, type Scope } from "@/stores/workspace";
import { storeToRefs } from "pinia";

const workspace = useWorkspaceStore();
const { scope } = storeToRefs(workspace);

const scopeLabel = computed(() =>
  scope.value === "workspace" ? "Workspace" : "Global",
);
const scopeSub = computed(() =>
  scope.value === "workspace" ? "skillful-claude" : "All projects",
);

function toggleScope() {
  const next: Scope = scope.value === "workspace" ? "global" : "workspace";
  workspace.setScope(next);
}
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-6"
  >
    <!-- Left: brand + scope selector -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-strong">
          <Icon icon="lucide:sparkles" class="h-4 w-4 text-surface" />
        </div>
        <span class="text-[15px] font-semibold text-strong">Skillful Claude</span>
      </div>

      <div class="h-6 w-px bg-line" />

      <button
        type="button"
        class="flex h-9 items-center gap-2.5 rounded-lg border border-line bg-page px-3.5 transition hover:border-brand-tint-border"
        @click="toggleScope"
      >
        <Icon icon="lucide:globe" class="h-4 w-4 text-body" />
        <div class="flex flex-col items-start leading-tight">
          <span class="text-[11px] font-medium text-muted">Scope</span>
          <span class="text-[12px] font-semibold text-strong">
            {{ scopeLabel }} · {{ scopeSub }}
          </span>
        </div>
        <Icon icon="lucide:chevron-down" class="h-3.5 w-3.5 text-muted" />
      </button>
    </div>

    <!-- Right: search + actions + avatar -->
    <div class="flex items-center gap-3">
      <div
        class="flex h-9 w-[280px] items-center gap-2.5 rounded-lg border border-line bg-page px-3"
      >
        <Icon icon="lucide:search" class="h-3.5 w-3.5 text-muted" />
        <span class="flex-1 truncate text-[12px] text-muted">
          Search instructions, skills, tools…
        </span>
        <span
          class="flex h-[18px] items-center justify-center rounded border border-line bg-surface px-1.5 text-[10px] font-medium text-muted"
        >
          ⌘K
        </span>
      </div>

      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface transition hover:border-brand-tint-border"
        title="Documentation"
      >
        <Icon icon="lucide:book-open" class="h-4 w-4 text-body" />
      </button>

      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-surface"
      >
        AR
      </div>
    </div>
  </header>
</template>
