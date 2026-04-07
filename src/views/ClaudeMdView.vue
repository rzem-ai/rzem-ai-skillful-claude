<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import MilkdownEditor from "@/components/editor/MilkdownEditor.vue";
import { useConfigStore } from "@/stores/config";
import { writeClaudeMd } from "@/composables/useTauriFs";
import {
  basename,
  formatBytes,
  relativeTime,
  tildify,
} from "@/composables/useClaudeConfigAccessors";
import type { ProjectEntry } from "@/composables/useTauriFs";

const configStore = useConfigStore();
const {
  config,
  resolvedClaudeMd,
  resolvedClaudeMdTitle,
  selectedEntryId,
  focusedProjectPath,
} = storeToRefs(configStore);

// ── Editor buffer ──────────────────────────────────────────────────────
// ProseMirror owns content after mount, so we track the working copy here
// and the template uses `:key` on <MilkdownEditor> to force a fresh mount
// whenever the selection points at a different file on disk.
const editedBody = ref<string>(resolvedClaudeMd.value?.body ?? "");
const saving = ref(false);
const saveError = ref<string | null>(null);

watch(
  resolvedClaudeMd,
  (next) => {
    editedBody.value = next?.body ?? "";
    saveError.value = null;
  },
  { immediate: false },
);

// ── Selection-derived display values ───────────────────────────────────
const isGlobalSelected = computed(() => {
  const id = selectedEntryId.value;
  return id === null || id === "global:claudemd";
});

const crumbSection = computed(() =>
  isGlobalSelected.value ? "Global" : "Project",
);

const crumbCategory = "Instructions";
const crumbCurrent = "CLAUDE.md";

const headerSubtitle = computed(() => {
  const md = resolvedClaudeMd.value;
  if (!md) return "No CLAUDE.md selected";
  return tildify(md.path, config.value?.home ?? null);
});

const editorTabLabel = computed(() => {
  const md = resolvedClaudeMd.value;
  if (!md) return "CLAUDE.md";
  if (isGlobalSelected.value) return "CLAUDE.md";
  // For a project override, show the project name so the user can tell
  // which file is open at a glance: `my-repo / CLAUDE.md`.
  const owner = focusedProjectPath.value
    ? basename(focusedProjectPath.value)
    : basename(md.path.replace(/\/CLAUDE\.md$/, ""));
  return `${owner} / CLAUDE.md`;
});

// ── Dirty state + token/size/line metrics ──────────────────────────────
const hasUnsavedChanges = computed(
  () =>
    resolvedClaudeMd.value !== null &&
    editedBody.value !== resolvedClaudeMd.value.body,
);

const byteSize = computed(() => {
  // Byte length, not char length — CLAUDE.md files may contain multi-byte
  // runes and the design's "N KB" pill is about the actual file size.
  const body = resolvedClaudeMd.value?.body ?? "";
  return new TextEncoder().encode(body).length;
});

const lineCount = computed(() => {
  const body = resolvedClaudeMd.value?.body ?? "";
  if (!body) return 0;
  return body.split("\n").length;
});

const tokenEstimate = computed(() => {
  const body = resolvedClaudeMd.value?.body ?? "";
  if (!body) return "—";
  return `~${Math.ceil(body.length / 4).toLocaleString()}`;
});

const stateLabel = computed(() => {
  if (!resolvedClaudeMd.value) return "Empty";
  return hasUnsavedChanges.value ? "Unsaved" : "Synced";
});

const modifiedLabel = computed(() =>
  relativeTime(resolvedClaudeMd.value?.modifiedAt ?? null),
);

// ── Inheritance: which projects use this global CLAUDE.md ─────────────
// Inheritance only makes sense for the *global* file — it's the root that
// every project implicitly inherits from. Project CLAUDE.md files are
// leaves in the chain, so we hide the "inherited by" card for those.
const inheritedByProjects = computed<ProjectEntry[]>(() => {
  if (!isGlobalSelected.value || !config.value) return [];
  return config.value.projects.filter((p) => p.exists);
});

const inheritedByCount = computed(() => inheritedByProjects.value.length);

const topInheritedProjects = computed(() => inheritedByProjects.value.slice(0, 3));

// Deterministic color per project based on path, so the same project keeps
// the same swatch across reloads. Pure function, no state.
const AVATAR_BACKGROUNDS = [
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarClassFor(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    hash = (hash * 31 + path.charCodeAt(i)) | 0;
  }
  return AVATAR_BACKGROUNDS[Math.abs(hash) % AVATAR_BACKGROUNDS.length];
}

function initialsFor(path: string): string {
  const name = basename(path);
  const letters = name.replace(/[^a-z0-9]/gi, "");
  return (letters.slice(0, 2) || "··").toUpperCase();
}

// ── Actions ────────────────────────────────────────────────────────────
async function onSave() {
  const md = resolvedClaudeMd.value;
  if (!md) return;
  saving.value = true;
  saveError.value = null;
  try {
    await writeClaudeMd(md.path, editedBody.value);
    await configStore.reload();
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err);
  } finally {
    saving.value = false;
  }
}

function onDiscard() {
  editedBody.value = resolvedClaudeMd.value?.body ?? "";
  saveError.value = null;
}
</script>

<template>
  <!-- ── Page Header: breadcrumbs + header actions ── -->
  <div class="flex items-center justify-between">
    <nav class="flex items-center gap-2 text-[12px] font-medium">
      <span class="text-soft">{{ crumbSection }}</span>
      <Icon icon="lucide:chevron-right" class="h-3 w-3 text-line" />
      <span class="text-soft">{{ crumbCategory }}</span>
      <Icon icon="lucide:chevron-right" class="h-3 w-3 text-line" />
      <span class="font-semibold text-strong">{{ crumbCurrent }}</span>
    </nav>

    <div class="flex items-center gap-2.5">
      <div
        v-if="hasUnsavedChanges"
        class="flex items-center gap-1.5 px-2"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span class="text-[11px] font-medium text-amber-700">Unsaved changes</span>
      </div>
      <button
        type="button"
        class="h-[34px] rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium text-body transition hover:bg-page disabled:opacity-40"
        :disabled="!hasUnsavedChanges || saving"
        @click="onDiscard"
      >
        Discard
      </button>
      <button
        type="button"
        class="flex h-[34px] items-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-surface transition hover:opacity-90 disabled:opacity-40"
        :disabled="!hasUnsavedChanges || saving || !resolvedClaudeMd"
        @click="onSave"
      >
        <Icon icon="lucide:check" class="h-3.5 w-3.5" />
        {{ saving ? "Saving…" : "Save changes" }}
      </button>
    </div>
  </div>

  <!-- ── Title Row: icon + stacked text + meta pills ── -->
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3.5">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-[10px] border border-brand-tint-border bg-brand-tint"
      >
        <Icon icon="lucide:file-text" class="h-[22px] w-[22px] text-brand" />
      </div>
      <div class="flex flex-col gap-1">
        <h1 class="text-[20px] font-bold leading-none text-strong">
          {{ resolvedClaudeMdTitle }}
        </h1>
        <span class="font-mono text-[12px] text-soft">{{ headerSubtitle }}</span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div
        v-if="isGlobalSelected && inheritedByCount > 0"
        class="flex h-[26px] items-center gap-1.5 rounded-md border border-line bg-surface px-2.5"
      >
        <Icon icon="lucide:git-branch" class="h-3 w-3 text-soft" />
        <span class="text-[11px] font-medium text-body">
          Inherited by {{ inheritedByCount }}
          {{ inheritedByCount === 1 ? "project" : "projects" }}
        </span>
      </div>
      <div
        v-if="resolvedClaudeMd"
        class="flex h-[26px] items-center rounded-md border border-line bg-surface px-2.5"
      >
        <span class="font-mono text-[11px] text-soft">
          {{ formatBytes(byteSize) }} · {{ lineCount }}
          {{ lineCount === 1 ? "line" : "lines" }}
        </span>
      </div>
    </div>
  </div>

  <div
    v-if="saveError"
    class="rounded-md border border-skill bg-surface px-3 py-2 text-[12px] text-skill"
  >
    {{ saveError }}
  </div>

  <!-- ── Content Row: Editor card + 340-wide Side Panel ── -->
  <div class="flex flex-1 gap-5 overflow-hidden">
    <!-- Editor card -->
    <div
      class="flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface"
    >
      <!-- Editor Tabs strip -->
      <div
        class="flex h-[42px] items-center justify-between border-b border-line bg-[#FAFBFD] px-3"
      >
        <div class="flex items-center gap-1.5">
          <div
            class="flex h-[30px] items-center gap-2 rounded-md border border-line bg-surface px-3"
          >
            <Icon icon="lucide:file-text" class="h-3 w-3 text-body" />
            <span class="text-[12px] font-semibold text-strong">
              {{ editorTabLabel }}
            </span>
            <span
              v-if="hasUnsavedChanges"
              class="h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <!-- Edit/Preview toggle: visual chrome for now. Milkdown is WYSIWYG, so
               "Edit" is the only state that works. Preview is shown disabled. -->
          <div
            class="flex h-[28px] items-center overflow-hidden rounded-md border border-line bg-surface"
          >
            <button
              type="button"
              class="h-full bg-strong px-2.5 text-[11px] font-semibold text-surface"
            >
              Edit
            </button>
            <button
              type="button"
              class="h-full px-2.5 text-[11px] font-medium text-muted disabled:cursor-not-allowed"
              disabled
              title="Preview mode coming soon"
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            class="flex h-[28px] w-[28px] items-center justify-center rounded-md border border-line bg-surface text-body transition hover:bg-page"
            title="Format"
          >
            <Icon icon="lucide:wand-2" class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="flex h-[28px] w-[28px] items-center justify-center rounded-md border border-line bg-surface text-body transition hover:bg-page"
            title="More"
          >
            <Icon icon="lucide:more-horizontal" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <!-- Editor body -->
      <div class="relative flex flex-1 flex-col overflow-y-auto px-6 py-5">
        <div
          v-if="!resolvedClaudeMd"
          class="flex h-full flex-col items-center justify-center gap-2 text-soft"
        >
          <Icon icon="lucide:file-text" class="h-8 w-8" />
          <p class="text-[13px]">No CLAUDE.md selected.</p>
          <p class="text-[11px]">
            Select an entry in the sidebar or add a project override to get started.
          </p>
        </div>
        <template v-else>
          <div
            v-if="editedBody === '' && resolvedClaudeMd.body === ''"
            class="pointer-events-none absolute inset-0 flex items-start px-6 py-5"
          >
            <div class="flex items-center gap-2 text-[13px] italic text-muted">
              <Icon icon="lucide:pencil-line" class="h-4 w-4" />
              <span>
                This file is empty — click anywhere and start writing. Your
                changes stay in memory until you hit <em>Save changes</em>.
              </span>
            </div>
          </div>
          <MilkdownEditor
            :key="resolvedClaudeMd.path"
            v-model="editedBody"
          />
        </template>
      </div>
    </div>

    <!-- ── Side Panel (340 wide) ── -->
    <aside class="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto">
      <!-- FILE card -->
      <section class="rounded-xl border border-line bg-surface p-[18px]">
        <header class="flex items-center justify-between">
          <span
            class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted"
          >
            File
          </span>
          <span
            class="flex items-center gap-1.5 rounded-md border border-line bg-page px-2 py-0.5 text-[10px] font-semibold"
            :class="hasUnsavedChanges ? 'text-amber-700' : 'text-emerald-600'"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="hasUnsavedChanges ? 'bg-amber-500' : 'bg-emerald-500'"
            />
            {{ stateLabel }}
          </span>
        </header>
        <dl class="mt-3.5 space-y-3 text-[12px]">
          <div class="flex items-start justify-between gap-3">
            <dt class="shrink-0 font-medium text-soft">Path</dt>
            <dd
              class="truncate font-mono text-[11px] text-strong"
              :title="resolvedClaudeMd?.path"
            >
              {{ headerSubtitle }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="font-medium text-soft">Modified</dt>
            <dd class="text-[12px] text-strong">{{ modifiedLabel }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="font-medium text-soft">Tokens</dt>
            <dd class="font-mono text-[12px] text-strong">
              {{ tokenEstimate }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3 pt-1">
            <dt class="font-medium text-soft">sha256</dt>
            <dd class="font-mono text-[10px] text-soft">
              {{ resolvedClaudeMd?.sha256.slice(0, 12) ?? "—" }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- INHERITED BY card -->
      <section
        v-if="isGlobalSelected"
        class="rounded-xl border border-line bg-surface p-[18px]"
      >
        <header class="flex items-center justify-between">
          <span
            class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted"
          >
            Inherited by
          </span>
          <span class="text-[11px] font-medium text-soft">
            {{ inheritedByCount }}
            {{ inheritedByCount === 1 ? "project" : "projects" }}
          </span>
        </header>
        <ul
          v-if="topInheritedProjects.length"
          class="mt-3 flex flex-col"
        >
          <li
            v-for="project in topInheritedProjects"
            :key="project.path"
            class="flex items-center gap-2.5 py-1.5"
          >
            <span
              class="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[9px] font-bold"
              :class="avatarClassFor(project.path)"
            >
              {{ initialsFor(project.path) }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="truncate text-[12px] font-semibold text-strong">
                {{ basename(project.path) }}
              </div>
              <div
                class="truncate font-mono text-[10px] text-muted"
                :title="project.path"
              >
                {{ tildify(project.path, config?.home ?? null) }}
              </div>
            </div>
            <Icon
              icon="lucide:chevron-right"
              class="h-3.5 w-3.5 shrink-0 text-muted"
            />
          </li>
        </ul>
        <p
          v-else
          class="mt-3 text-[11px] text-soft"
        >
          No live projects inherit from this file yet.
        </p>
        <button
          v-if="inheritedByCount > topInheritedProjects.length"
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-1.5 pt-2 text-[12px] font-semibold text-brand transition hover:opacity-80"
        >
          See all {{ inheritedByCount }}
          <Icon icon="lucide:arrow-right" class="h-3 w-3" />
        </button>
      </section>

      <!-- RECENT EDITS card — backend doesn't track edit history yet -->
      <section class="rounded-xl border border-line bg-surface p-[18px]">
        <header class="flex items-center justify-between">
          <span
            class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted"
          >
            Recent edits
          </span>
          <Icon icon="lucide:history" class="h-3.5 w-3.5 text-muted" />
        </header>
        <p class="mt-3 text-[11px] text-soft">
          Edit history isn't tracked yet. Reach for
          <code class="font-mono text-[10px]">git log</code> for now.
        </p>
      </section>
    </aside>
  </div>
</template>
