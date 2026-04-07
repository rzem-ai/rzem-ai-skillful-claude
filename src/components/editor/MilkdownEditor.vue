<script setup lang="ts">
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { Milkdown, useEditor } from "@milkdown/vue";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { computed } from "vue";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

// Capture an immutable initial value for Milkdown's first render. We rely on
// the listener plugin to push subsequent updates back to the parent.
const initial = computed(() => props.modelValue ?? "");

useEditor((root) =>
  Editor.make()
    .config(nord)
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial.value);
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        emit("update:modelValue", markdown);
      });
    })
    .use(commonmark)
    .use(gfm)
    .use(listener),
);
</script>

<template>
  <div class="milkdown-host">
    <Milkdown />
  </div>
</template>

<style scoped>
.milkdown-host :deep(.milkdown) {
  background: transparent;
}
.milkdown-host :deep(.editor) {
  font-size: 14px;
  line-height: 1.65;
  min-height: 360px;
  padding: 0;
}
</style>
