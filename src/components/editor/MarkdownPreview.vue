<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

const props = defineProps<{ source: string }>();

// `marked.parse` is sync when given a string with the default options.
// We force `async: false` so the return type is `string` instead of
// `string | Promise<string>` and the template can render it directly.
// DOMPurify keeps us safe against script/img-onerror injection if the
// markdown ever contains pasted HTML from an untrusted source.
const html = computed(() => {
  if (!props.source) return "";
  const raw = marked.parse(props.source, { async: false }) as string;
  return DOMPurify.sanitize(raw);
});
</script>

<template>
  <article
    v-if="source"
    class="markdown-preview"
    v-html="html"
  />
  <div
    v-else
    class="flex h-full items-center justify-center text-[12px] italic text-muted"
  >
    Nothing to preview yet — switch to Edit and add some markdown.
  </div>
</template>

<style scoped>
/* Self-contained markdown styling. We deliberately avoid pulling in a
 * heavyweight prose library (Tailwind Typography, github-markdown-css)
 * since we only need the GFM-ish subset that CLAUDE.md files use, and
 * the design's color tokens already cover headings, code, links, etc. */
.markdown-preview {
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-strong);
  word-break: break-word;
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  font-weight: 700;
  color: var(--color-strong);
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
.markdown-preview :deep(h1) {
  font-size: 1.75em;
  border-bottom: 1px solid var(--color-line);
  padding-bottom: 0.3em;
}
.markdown-preview :deep(h2) {
  font-size: 1.4em;
  border-bottom: 1px solid var(--color-line);
  padding-bottom: 0.3em;
}
.markdown-preview :deep(h3) {
  font-size: 1.2em;
}
.markdown-preview :deep(h4) {
  font-size: 1em;
}

.markdown-preview :deep(p) {
  margin: 0 0 0.85em;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 1.5em;
  margin: 0 0 0.85em;
}
.markdown-preview :deep(li) {
  margin: 0.2em 0;
}
.markdown-preview :deep(li > p) {
  margin-bottom: 0.3em;
}

.markdown-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  font-size: 0.9em;
  background: var(--color-page);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  border: 1px solid var(--color-line);
}
.markdown-preview :deep(pre) {
  background: var(--color-page);
  border: 1px solid var(--color-line);
  border-radius: 6px;
  padding: 0.85em 1em;
  margin: 0 0 0.85em;
  overflow-x: auto;
  font-size: 0.88em;
  line-height: 1.5;
}
.markdown-preview :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: inherit;
}

.markdown-preview :deep(blockquote) {
  border-left: 3px solid var(--color-line);
  padding: 0.2em 0 0.2em 1em;
  margin: 0 0 0.85em;
  color: var(--color-soft);
}
.markdown-preview :deep(blockquote > :last-child) {
  margin-bottom: 0;
}

.markdown-preview :deep(a) {
  color: var(--color-brand);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-preview :deep(a:hover) {
  text-decoration-thickness: 2px;
}

.markdown-preview :deep(table) {
  border-collapse: collapse;
  margin: 0 0 0.85em;
  font-size: 0.92em;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid var(--color-line);
  padding: 0.45em 0.8em;
  text-align: left;
}
.markdown-preview :deep(th) {
  background: var(--color-page);
  font-weight: 600;
}

.markdown-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-line);
  margin: 1.5em 0;
}

.markdown-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

.markdown-preview :deep(input[type="checkbox"]) {
  margin-right: 0.4em;
  vertical-align: middle;
}
</style>
