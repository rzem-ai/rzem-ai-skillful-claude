<script setup lang="ts">
// Monaco wrapper: v-model over a standalone editor, themed from the app
// tokens and following the global dark/light toggle live.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { applyMonacoTheme, ensureMonacoEnv, monaco, monoFontFamily } from '@/lib/monaco';
import { useTheme } from '@/composables/useTheme';

const props = defineProps<{ modelValue: string; language: string; readOnly?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const host = ref<HTMLElement | null>(null);
const { theme } = useTheme();
let ed: ReturnType<typeof monaco.editor.create> | null = null;

onMounted(() => {
    ensureMonacoEnv();
    applyMonacoTheme(theme.value);
    ed = monaco.editor.create(host.value!, {
        value: props.modelValue,
        language: props.language,
        readOnly: props.readOnly ?? false,
        theme: 'skillful',
        fontFamily: monoFontFamily(),
        fontSize: 12,
        lineHeight: 19,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderLineHighlight: 'all',
        wordWrap: props.language === 'markdown' ? 'on' : 'off',
        padding: { top: 8, bottom: 8 },
    });
    ed.onDidChangeModelContent(() => emit('update:modelValue', ed!.getValue()));
    // e2e hook: lets automation drive edits through Monaco's API, since the
    // EditContext input path only accepts real OS-focused keystrokes.
    (window as { __scEditor?: unknown }).__scEditor = ed;
});

watch(
    () => props.modelValue,
    (v) => {
        if (ed && ed.getValue() !== v) ed.setValue(v);
    },
);
watch(
    () => props.readOnly,
    (v) => ed?.updateOptions({ readOnly: v ?? false }),
);
watch(
    () => props.language,
    (l) => {
        const m = ed?.getModel();
        if (m) monaco.editor.setModelLanguage(m, l);
        ed?.updateOptions({ wordWrap: l === 'markdown' ? 'on' : 'off' });
    },
);
watch(theme, (t) => applyMonacoTheme(t));

onBeforeUnmount(() => ed?.dispose());
</script>

<template>
    <div ref="host" class="monaco-host"></div>
</template>

<style scoped>
.monaco-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}
</style>
