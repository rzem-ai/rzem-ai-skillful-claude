<script setup lang="ts">
import { computed } from "vue";
import { ICON_PATHS } from "@/lib/icons";

const props = withDefaults(defineProps<{ name: string; size?: number }>(), {
  size: 16,
});

const inner = computed(() => ICON_PATHS[props.name] ?? "");
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="inner"
  />
</template>
