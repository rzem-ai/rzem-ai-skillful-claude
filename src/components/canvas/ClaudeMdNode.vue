<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";

interface ClaudeMdData {
  label?: string;
  sub?: string;
  /**
   * True when this node represents a CLAUDE.md file that the loader knows
   * about conceptually (e.g. the global root) but that doesn't actually
   * exist on disk yet. Renders a dashed, dimmed variant so the graph
   * doesn't lie about which files are real.
   */
  missing?: boolean;
}

defineProps<NodeProps<ClaudeMdData>>();
</script>

<template>
  <div
    class="flex h-10 items-center gap-2 rounded-[20px] px-4 text-surface"
    :class="
      data.missing
        ? 'border-2 border-dashed border-claude bg-claude/30 text-claude'
        : 'bg-claude shadow-[0_6px_18px_var(--color-claude-shadow)]'
    "
    :title="data.missing ? 'File does not exist on disk yet' : undefined"
  >
    <Icon icon="lucide:file-text" class="h-3.5 w-3.5" />
    <span class="text-[12px] font-bold tracking-[0.2px]">
      {{ data.label ?? "CLAUDE.md" }}
    </span>
    <span
      v-if="data.sub"
      class="text-[10px] font-medium"
      :class="data.missing ? 'text-claude/70' : 'text-white/75'"
    >
      {{ data.sub }}
    </span>
    <span
      v-if="data.missing"
      class="text-[9px] font-bold uppercase tracking-wider text-claude/80"
    >
      missing
    </span>
    <Handle type="target" :position="Position.Top" class="!bg-edge" />
    <Handle type="source" :position="Position.Bottom" class="!bg-edge" />
  </div>
</template>
