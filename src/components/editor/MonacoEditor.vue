<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
// Import the editor API directly instead of the `monaco-editor` meta
// package — the meta package eagerly registers ~70 languages (julia,
// abap, solidity, freemarker…) and inflates this chunk to 7+ MB. The
// API entry alone is ~1 MB; we then add only the markdown language
// contribution we actually need.
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Monaco needs a worker for off-thread tokenization. We only ship the
// generic editor worker — no language services (TS/JS/CSS/JSON/HTML),
// since the editor is markdown-only here. Vite's `?worker` import
// bundles the worker as a same-origin chunk so the renderer's CSP
// (`default-src 'self'`) lets it load.
const w = self as unknown as { MonacoEnvironment?: monaco.Environment };
if (!w.MonacoEnvironment) {
  w.MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
  };
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language?: string;
    readonly?: boolean;
  }>(),
  {
    language: "markdown",
    readonly: false,
  },
);

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

const container = ref<HTMLDivElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
// Suppress the change-event re-emit when we're the ones writing into the
// model — otherwise external `modelValue` updates would echo back through
// the parent and cause infinite v-model loops.
let suppressEmit = false;

onMounted(() => {
  if (!container.value) return;
  editor = monaco.editor.create(container.value, {
    value: props.modelValue,
    language: props.language,
    theme: "vs",
    automaticLayout: true,
    wordWrap: "on",
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "off",
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    scrollBeyondLastLine: false,
    renderLineHighlight: "none",
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    padding: { top: 12, bottom: 12 },
    readOnly: props.readonly,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
      useShadows: false,
    },
  });

  editor.onDidChangeModelContent(() => {
    if (suppressEmit || !editor) return;
    emit("update:modelValue", editor.getValue());
  });
});

watch(
  () => props.modelValue,
  (next) => {
    if (!editor) return;
    if (editor.getValue() === next) return;
    suppressEmit = true;
    editor.setValue(next);
    suppressEmit = false;
  },
);

watch(
  () => props.readonly,
  (next) => {
    editor?.updateOptions({ readOnly: next });
  },
);

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
});
</script>

<template>
  <div ref="container" class="monaco-host" />
</template>

<style scoped>
.monaco-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  flex: 1;
}
.monaco-host :deep(.monaco-editor),
.monaco-host :deep(.monaco-editor .overflow-guard) {
  border-radius: 0;
}
</style>
