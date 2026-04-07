<script setup lang="ts">
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { Milkdown, useEditor } from "@milkdown/vue";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

// Capture the initial value for Milkdown's first render. Subsequent edits
// flow back to the parent via the listener plugin; we intentionally don't
// react to later prop changes because ProseMirror owns editor state once
// the editor is live and pushing markdown back in would clobber selection.
const initial = props.modelValue ?? "";

useEditor((root) =>
  Editor.make()
    .config(nord)
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, initial);
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
  <Milkdown />
</template>
