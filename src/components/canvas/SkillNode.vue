<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Handle, Position, type NodeProps } from "@vue-flow/core";

interface SkillData {
  label?: string;
}

defineProps<NodeProps<SkillData>>();
</script>

<template>
  <div
    class="flex h-9 items-center gap-2 rounded-[18px] bg-skill px-3.5 text-surface shadow-[0_4px_12px_var(--color-skill-shadow)]"
  >
    <Icon icon="lucide:sparkles" class="h-3 w-3" />
    <span class="text-[11px] font-bold tracking-[0.4px] uppercase">
      {{ data.label ?? "SKILLS" }}
    </span>
    <Handle type="target" :position="Position.Top" class="!bg-edge" />
    <Handle type="source" :position="Position.Bottom" class="!bg-edge" />
  </div>
</template>
