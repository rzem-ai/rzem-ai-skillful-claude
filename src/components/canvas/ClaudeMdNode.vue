<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";

interface ClaudeMdData {
  label?: string;
  sub?: string;
}

defineProps<NodeProps<ClaudeMdData>>();
</script>

<template>
  <div
    class="flex h-10 items-center gap-2 rounded-[20px] bg-claude px-4 text-surface shadow-[0_6px_18px_var(--color-claude-shadow)]"
  >
    <Icon icon="lucide:file-text" class="h-3.5 w-3.5" />
    <span class="text-[12px] font-bold tracking-[0.2px]">
      {{ data.label ?? "CLAUDE.md" }}
    </span>
    <span v-if="data.sub" class="text-[10px] font-medium text-white/75">
      {{ data.sub }}
    </span>
    <Handle type="target" :position="Position.Top" class="!bg-edge" />
    <Handle type="source" :position="Position.Bottom" class="!bg-edge" />
  </div>
</template>
