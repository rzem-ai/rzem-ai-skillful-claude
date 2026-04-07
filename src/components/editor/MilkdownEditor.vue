<script setup lang="ts">
import { MilkdownProvider } from "@milkdown/vue";
import MilkdownEditorCore from "./MilkdownEditorCore.vue";

// Public wrapper around Milkdown. The actual `useEditor` call and the
// `<Milkdown />` component live in `MilkdownEditorCore` because Milkdown 7's
// Vue integration requires both to be inside a `<MilkdownProvider>` parent —
// the provider is what supplies `editorInfoCtxKey` via Vue's inject system.
// Putting `useEditor` in the same component as the provider would inject
// from a sibling scope and crash with "Cannot destructure property
// 'editorFactory' from null or undefined value".
defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

function onUpdate(value: string) {
  emit("update:modelValue", value);
}
</script>

<template>
  <div class="milkdown-host">
    <MilkdownProvider>
      <MilkdownEditorCore
        :model-value="modelValue"
        @update:model-value="onUpdate"
      />
    </MilkdownProvider>
  </div>
</template>

<style scoped>
/* The host must fill its parent so the ProseMirror contenteditable covers
 * the full scrollable area. Without this, only the top ~360px of the card
 * is actually clickable — the rest is dead white space and clicks never
 * reach the editor to focus it. */
.milkdown-host {
  display: flex;
  flex: 1;
  min-height: 100%;
}
.milkdown-host :deep(.milkdown) {
  background: transparent;
  display: flex;
  flex: 1;
  min-height: 100%;
}
/* Target both `.editor` (Milkdown theme class) and `.ProseMirror` (the
 * underlying contenteditable), since which of the two is present depends
 * on the active theme. Either way we want it to fill the host. */
.milkdown-host :deep(.milkdown > .editor),
.milkdown-host :deep(.ProseMirror) {
  flex: 1;
  font-size: 14px;
  line-height: 1.65;
  min-height: 360px;
  padding: 0;
  outline: none;
}
</style>
