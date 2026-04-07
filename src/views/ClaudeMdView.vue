<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { ref } from "vue";
import MilkdownEditor from "@/components/editor/MilkdownEditor.vue";

// Stub content matching the design's "Project instructions" body. Once Tauri
// is wired in, this gets replaced by readClaudeMd / writeClaudeMd round-trips.
const body = ref(`# System

You are Claude, an AI coding partner. Be concise. Lead with the answer.

## Tone

- No preamble or filler. Skip transitions.
- One sentence beats three when it can.
- Use file_path:line for code references.

## Project context

This is the skillful-claude monorepo for managing CLAUDE.md and SKILLS files.
All UI mockups live under design/.

## Memory

Persist learnings about the user, their preferences, and the active project to
\`~/.claude/memory/\` as soon as learned.
`);

const fileMeta = {
  state: "Synced",
  modified: "2 hours ago",
  tokens: "1,346",
};

const inheritedFrom = [
  { name: "Global instructions", path: "~/.claude/CLAUDE.md", overrides: 1 },
  { name: "Effective merge", path: "skillful-claude · project", overrides: 0 },
];

const recentEdits = [
  { time: "14:32", message: "Added Memory section", delta: "+12 / -0" },
  { time: "09:15", message: "Tightened Tone bullets", delta: "+3 / -7" },
];
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-end gap-3">
      <h1 class="text-[24px] font-bold leading-none text-strong">
        Project instructions
      </h1>
      <span class="text-[12px] text-soft">~/Dev/skillful-claude/CLAUDE.md</span>
    </div>
    <div class="flex items-center gap-2">
      <span
        class="flex items-center gap-1.5 rounded-md bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand"
      >
        <Icon icon="lucide:circle-dot" class="h-3 w-3" />
        Unsaved changes
      </span>
      <button
        type="button"
        class="rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-body transition hover:bg-page"
      >
        Discard
      </button>
      <button
        type="button"
        class="rounded-md bg-strong px-3.5 py-1.5 text-[12px] font-semibold text-surface transition hover:opacity-90"
      >
        Save changes
      </button>
    </div>
  </div>

  <div class="flex flex-1 gap-6 overflow-hidden">
    <!-- Editor column -->
    <div
      class="flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div class="flex items-center justify-between border-b border-line px-5 py-3">
        <div class="flex items-center gap-2">
          <span
            class="flex items-center gap-1.5 rounded-md bg-strong px-3 py-1 text-[11px] font-semibold text-surface"
          >
            <Icon icon="lucide:file-text" class="h-3 w-3" />
            Merged with global
          </span>
          <button
            type="button"
            class="rounded-md px-3 py-1 text-[11px] font-medium text-body hover:bg-page"
          >
            Project only
          </button>
        </div>
        <div class="flex items-center gap-1.5 text-[11px] text-muted">
          <span>2 of 23 lines from project</span>
          <span class="h-3 w-px bg-line" />
          <span class="rounded bg-brand-tint px-1.5 py-0.5 font-semibold text-brand">
            global
          </span>
          <span class="rounded bg-page px-1.5 py-0.5 font-semibold text-soft">
            project
          </span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto px-6 py-5">
        <MilkdownEditor v-model="body" />
      </div>
    </div>

    <!-- Right rail -->
    <aside class="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto">
      <section class="rounded-xl border border-line bg-surface p-4">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          File
        </h2>
        <dl class="mt-3 space-y-2 text-[12px]">
          <div class="flex justify-between">
            <dt class="text-muted">State</dt>
            <dd class="font-semibold text-strong">{{ fileMeta.state }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Modified</dt>
            <dd class="text-body">{{ fileMeta.modified }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Tokens</dt>
            <dd class="text-body">{{ fileMeta.tokens }}</dd>
          </div>
          <div class="flex items-center justify-between pt-1">
            <dt class="text-muted">Auto-load</dt>
            <dd>
              <span
                class="flex h-5 w-9 items-center rounded-full bg-brand p-0.5"
              >
                <span class="ml-auto h-4 w-4 rounded-full bg-surface" />
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-line bg-surface p-4">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Inherited from
        </h2>
        <ul class="mt-3 space-y-3">
          <li
            v-for="parent in inheritedFrom"
            :key="parent.path"
            class="flex items-start gap-2.5"
          >
            <Icon
              icon="lucide:file-text"
              class="mt-0.5 h-3.5 w-3.5 text-claude"
            />
            <div class="flex-1 leading-tight">
              <div class="text-[12px] font-semibold text-strong">
                {{ parent.name }}
              </div>
              <div class="text-[11px] text-muted">{{ parent.path }}</div>
            </div>
            <span
              v-if="parent.overrides"
              class="rounded bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand"
            >
              {{ parent.overrides }} override
            </span>
          </li>
        </ul>
      </section>

      <section class="rounded-xl border border-line bg-surface p-4">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Recent edits
        </h2>
        <ul class="mt-3 space-y-3">
          <li
            v-for="edit in recentEdits"
            :key="edit.time"
            class="flex items-start gap-3"
          >
            <span class="text-[11px] font-semibold text-muted">{{ edit.time }}</span>
            <div class="flex-1 leading-tight">
              <div class="text-[12px] text-body">{{ edit.message }}</div>
              <div class="text-[10px] font-medium text-soft">{{ edit.delta }}</div>
            </div>
          </li>
        </ul>
      </section>
    </aside>
  </div>
</template>
