<script setup lang="ts">
import { Icon } from "@iconify/vue";
</script>

<template>
  <div class="flex items-end gap-3">
    <h1 class="text-[24px] font-bold leading-none text-strong">Active here</h1>
    <span class="text-[12px] text-soft">8 enabled in workspace</span>
  </div>
  <div
    class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-soft"
  >
    <div class="flex flex-col items-center gap-2">
      <Icon icon="lucide:circle-check" class="h-8 w-8" />
      <p class="text-[13px]">Active-skill toggles coming soon.</p>
    </div>
  </div>
</template>
