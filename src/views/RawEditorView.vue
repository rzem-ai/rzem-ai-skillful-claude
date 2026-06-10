<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
// Monaco is ~8 MB of JS — load it on the first "Edit file" click, not at boot.
const CodeEditor = defineAsyncComponent(() => import('@/components/CodeEditor.vue'));
import GuidedDiffModal from '@/components/GuidedDiffModal.vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import type { DiffLine, RawFile, RawHealth as Health, RawLine as Line } from '@shared/contract';

type FileId = string;

// File tree + line-annotated contents come live from the engine. Managed files
// are read-only; writable files save through the atomic write + backup pipeline.
const config = useConfigStore();
const files = computed<RawFile[]>(() => config.raw?.files ?? []);
const TREE = computed(() => config.raw?.tree ?? []);
const byId = computed(() => {
    const m = new Map<FileId, RawFile>();
    for (const f of files.value) m.set(f.id, f);
    return m;
});

const EMPTY_FILE: RawFile = { id: '', scope: 'user', realPath: '', path: '', label: '', health: 'ok', content: '', lines: [] };
function fileById(id: FileId): RawFile {
    return byId.value.get(id) ?? EMPTY_FILE;
}

// ── JSON colorizer (line-level), ported from color() ──
function escapeHtml(t: string): string {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function colorize(t: string): string {
    return escapeHtml(t)
        .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="key">$1</span><span class="pun">$2</span>')
        .replace(/:\s*("(?:[^"\\]|\\.)*")/g, (_m, p1: string) => ': <span class="str">' + p1 + '</span>')
        .replace(/:\s*(true|false|null)/g, ': <span class="bool">$1</span>')
        .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="num">$1</span>')
        .replace(/([{}[\],])/g, '<span class="pun">$1</span>');
}
// Markdown memory files render plain — the JSON colorizer would mis-paint them.
function renderLine(f: RawFile, t: string): string {
    return f.markdown ? escapeHtml(t) : colorize(t);
}

// ── reactive state ──
const route = useRoute();
const router = useRouter();
const curId = ref<FileId>('');
const split = ref(route.query.key === 'defaultMode');
const splitKey = 'defaultMode';

// Hero side-by-side: project settings (winner) vs local settings (ignored).
const SPLIT_LEFT = computed<FileId>(() => files.value.find((f) => f.scope === 'project' && f.label.includes('settings.json'))?.id ?? 'proj');
const SPLIT_RIGHT = computed<FileId>(() => files.value.find((f) => f.scope === 'local')?.id ?? 'local');

const curFile = computed(() => fileById(curId.value));

// ── edit mode (Monaco) ──
// Declared BEFORE the deep-link watcher below — it runs immediately during
// setup and calls leaveEditOk(), so this state must already exist (TDZ).
// View mode is the annotated, secret-masked lint view; Edit swaps the pane for
// a real Monaco editor over the on-disk text. Saves go through the engine's
// saveFile pipeline (allowlist + JSON validation + atomic write + backup).
const editing = ref(false);
const draft = ref('');
const canEdit = computed(() => !split.value && !curFile.value.locked && !!curFile.value.realPath);
const dirty = computed(() => editing.value && draft.value !== curFile.value.content);
const draftJsonError = computed<string | null>(() => {
    if (!editing.value || curFile.value.markdown) return null;
    try {
        JSON.parse(draft.value);
        return null;
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
});
function startEdit(): void {
    draft.value = curFile.value.content;
    editing.value = true;
}
function cancelEdit(): void {
    editing.value = false;
}
function revertDraft(): void {
    draft.value = curFile.value.content;
}
// Returns false (and stays put) if the user keeps unsaved changes.
function leaveEditOk(): boolean {
    if (!editing.value) return true;
    if (dirty.value && !window.confirm('Discard unsaved changes?')) return false;
    editing.value = false;
    return true;
}

// Deep link (?file=<id>) wins — the Guided pages' Edit buttons land here.
// Otherwise select a sensible default file once the snapshot loads.
watch(
    [files, () => route.query.file],
    ([list, qf]) => {
        if (typeof qf === 'string' && qf && byId.value.has(qf)) {
            if (!leaveEditOk()) return;
            curId.value = qf;
            split.value = false;
            // One-shot: drop the query so watcher-driven reloads don't snap
            // the selection back while the user browses other files.
            void router.replace({ query: {} });
            return;
        }
        if (!curId.value || !byId.value.has(curId.value)) {
            curId.value = list.find((f) => f.scope === 'project')?.id ?? list[0]?.id ?? '';
        }
    },
    { immediate: true },
);

function fileLines(id: FileId): Line[] {
    return fileById(id).lines;
}
function healthCls(h: Health): string {
    return (
        h === 'ok' ? 'ok'
        : h === 'warn' ? 'warn'
        : 'err'
    );
}

// Numbered render rows: foldeds don't get a gutter number but DO consume a line
// number (matching the prototype's n++ before the folded branch).
interface RenderRow {
    line: Line;
    n: number;
    hi: boolean;
    cls: string;
}
function buildRows(id: FileId, hiKey?: string): RenderRow[] {
    let n = 0;
    return fileLines(id).map((line) => {
        n++;
        let cls = 'cl';
        if (line.g === 'err') cls += ' errln';
        else if (line.g === 'warn') cls += ' warnln';
        let hi = false;
        if (hiKey) hi = line.key === hiKey;
        else hi = !!line.hi;
        if (hi) cls += ' hi';
        return { line, n, hi, cls };
    });
}

const tabLabel = computed(() => (split.value ? 'defaultMode · 2 sources' : curFile.value.label));
const splitBtnLabel = computed(() => (split.value ? 'Exit side-by-side' : 'Side-by-side resolution'));

// ── interactions ──
function openFile(id: FileId): void {
    if (id !== curId.value && !leaveEditOk()) return;
    curId.value = id;
    split.value = false;
}
function toggleSplit(): void {
    if (!leaveEditOk()) return;
    split.value = !split.value;
    if (split.value) curId.value = SPLIT_LEFT.value;
}
// Folded sensitive sections (~/.claude.json) can be revealed for the session.
const foldsUnlocked = ref(false);
function unlockFolded(): void {
    foldsUnlocked.value = true;
    toast('Sensitive sections revealed for this session', 'alert');
}

// ── save bar (single-file) ──
const saveBarCls = computed(() => {
    if (editing.value) return draftJsonError.value ? 'err' : dirty.value ? 'warn' : 'ok';
    return healthCls(curFile.value.health);
});
const saveBarStatus = computed(() => {
    const f = curFile.value;
    if (editing.value) {
        if (f.markdown) return dirty.value ? 'Markdown · unsaved changes' : 'Markdown';
        if (draftJsonError.value) return 'Invalid JSON — cannot save';
        return dirty.value ? 'Valid JSON · unsaved changes' : 'Valid JSON';
    }
    if (f.markdown) return 'Markdown';
    if (f.health === 'err') return 'Invalid JSON';
    return f.health === 'warn' ? 'Valid JSON · semantic warnings' : 'Valid JSON';
});
const saveBarMeta = computed(() => {
    const f = curFile.value;
    return (f.gitignore ? 'gitignored · ' : '') + (f.committed ? 'committed · ' : '') + f.path;
});
async function doSave(): Promise<void> {
    const f = curFile.value;
    if (!f.realPath) {
        toast('This file is read-only.', 'alert');
        return;
    }
    if (draftJsonError.value) {
        toast('Invalid JSON — fix it before saving', 'alert');
        return;
    }
    const res = await config.saveFile({ realPath: f.realPath, content: draft.value });
    if (res.ok) toast(`Saved ${f.label}${res.backupPath ? ' · backup created' : ''}`, 'check');
    else toast(res.blocked ?? res.error ?? 'Save failed', 'alert');
}

// ── diff modal (hero step 4) ──
// The preview is computed by the engine for the real on-disk state — never
// hardcoded — so what the user confirms is what actually happens.
const diffOpen = ref(false);
const diffFileLines = ref<DiffLine[]>([]);
const diffEffLines = ref<DiffLine[]>([]);
async function openDiff(): Promise<void> {
    const { preview, blocked } = await config.previewChange({ kind: 'removeDefaultMode', scope: 'project' });
    if (blocked) {
        toast(blocked, 'alert');
        return;
    }
    diffFileLines.value = preview?.file.lines ?? [];
    diffEffLines.value = preview?.effective ?? [];
    diffOpen.value = true;
}
function closeDiff(): void {
    diffOpen.value = false;
}
async function confirmDiff(): Promise<void> {
    diffOpen.value = false;
    const res = await config.applyChange({ kind: 'removeDefaultMode', scope: 'project' });
    if (res.ok) toast('Project defaultMode removed · now resolves to the User value · backup created', 'check');
    else toast(res.blocked ?? res.error ?? 'Change failed', 'alert');
}
</script>

<template>
    <main class="main">
        <section class="view view-body flush" style="overflow: hidden">
            <div class="raw">
                <!-- file tree -->
                <aside class="ftree">
                    <div v-for="g in TREE" :key="g.scope" class="ftg">
                        <div class="h"><ProvenanceChip :scope="g.scope" /></div>
                        <div v-for="id in g.ids" :key="id" class="fitem" :class="{ on: id === curId && !split }" @click="openFile(id)">
                            <span class="fdot">
                                <span class="health" :class="healthCls(fileById(id).health)"><span class="dot"></span></span>
                            </span>
                            <span>{{ fileById(id).label }}</span>
                            <span class="fb">
                                <span v-if="fileById(id).locked" class="tag lock" title="read-only"><Icon name="lock" :size="10" /></span>
                                <span v-if="fileById(id).gitignore" class="tag gitignore">git</span>
                            </span>
                        </div>
                    </div>
                </aside>

                <!-- editor -->
                <div class="editor-wrap">
                    <div class="etabs">
                        <div class="etab on">
                            <Icon name="file" :size="13" />
                            {{ tabLabel }}
                        </div>
                        <div class="etools">
                            <button class="btn ghost sm" @click="toggleSplit">
                                <Icon name="compare" :size="13" />
                                {{ splitBtnLabel }}
                            </button>
                        </div>
                    </div>

                    <!-- panes -->
                    <div class="panes" :class="{ split }">
                        <!-- side-by-side resolution -->
                        <template v-if="split">
                            <!-- winner -->
                            <div class="pane">
                                <div class="pane-h">
                                    <ProvenanceChip :scope="fileById(SPLIT_LEFT).scope" />
                                    <span class="ph-path">{{ fileById(SPLIT_LEFT).path }}</span>
                                    <span class="tag info" style="margin-left: auto">
                                        <Icon name="check" :size="10" />
                                        winner
                                    </span>
                                </div>
                                <div class="code">
                                    <template v-for="row in buildRows(SPLIT_LEFT, splitKey)" :key="row.n">
                                        <div v-if="row.line.folded && !foldsUnlocked" class="folded">
                                            <Icon name="lock" :size="12" />
                                            <span>{{ row.line.t.trim() }}</span>
                                            <span class="unlock" @click="unlockFolded">here be dragons — unlock</span>
                                        </div>
                                        <template v-else>
                                            <div :class="row.cls">
                                                <span class="g" :class="{ warn: row.line.g === 'warn' }">
                                                    <Icon v-if="row.line.g" :name="row.line.g === 'err' ? 'xcircle' : 'alert'" :size="13" />
                                                </span>
                                                <span class="n">{{ row.n }}</span>
                                                <span class="t" v-html="colorize(row.line.t)"></span>
                                            </div>
                                            <div v-if="row.line.lint" class="lint-line" :class="row.line.lint.type">
                                                <Icon :name="row.line.lint.type === 'err' ? 'xcircle' : 'alert'" :size="12" />
                                                <span>{{ row.line.lint.msg }}</span>
                                            </div>
                                        </template>
                                    </template>
                                </div>
                                <div style="padding: 8px 12px; border-top: 1px solid var(--border-soft)">
                                    <button class="btn danger sm" @click="openDiff">
                                        <Icon name="trash" :size="12" />
                                        Delete this defaultMode entry
                                    </button>
                                </div>
                            </div>
                            <!-- ignored -->
                            <div class="pane">
                                <div class="pane-h">
                                    <ProvenanceChip :scope="fileById(SPLIT_RIGHT).scope" />
                                    <span class="ph-path">{{ fileById(SPLIT_RIGHT).path }}</span>
                                    <span class="tag warn" style="margin-left: auto">
                                        <Icon name="alert" :size="10" />
                                        ignored
                                    </span>
                                </div>
                                <div class="code">
                                    <template v-for="row in buildRows(SPLIT_RIGHT, splitKey)" :key="row.n">
                                        <div v-if="row.line.folded && !foldsUnlocked" class="folded">
                                            <Icon name="lock" :size="12" />
                                            <span>{{ row.line.t.trim() }}</span>
                                            <span class="unlock" @click="unlockFolded">here be dragons — unlock</span>
                                        </div>
                                        <template v-else>
                                            <div :class="row.cls">
                                                <span class="g" :class="{ warn: row.line.g === 'warn' }">
                                                    <Icon v-if="row.line.g" :name="row.line.g === 'err' ? 'xcircle' : 'alert'" :size="13" />
                                                </span>
                                                <span class="n">{{ row.n }}</span>
                                                <span class="t" v-html="colorize(row.line.t)"></span>
                                            </div>
                                            <div v-if="row.line.lint" class="lint-line" :class="row.line.lint.type">
                                                <Icon :name="row.line.lint.type === 'err' ? 'xcircle' : 'alert'" :size="12" />
                                                <span>{{ row.line.lint.msg }}</span>
                                            </div>
                                        </template>
                                    </template>
                                </div>
                            </div>
                        </template>

                        <!-- single file -->
                        <template v-else>
                            <div class="pane">
                                <div class="pane-h">
                                    <ProvenanceChip :scope="curFile.scope" />
                                    <span class="ph-path">{{ curFile.path }}</span>
                                    <span v-if="curFile.locked" class="tag lock" style="margin-left: auto">
                                        <Icon name="lock" :size="10" />
                                        read-only
                                    </span>
                                </div>
                                <div v-if="curFile.parseErr && !editing" class="banner err" style="margin: 10px 12px 0">
                                    <span class="b-ico"><Icon name="xcircle" :size="16" /></span>
                                    <div>
                                        <b>Parse error · line {{ curFile.parseErr.line }}.</b>
                                        {{ curFile.parseErr.msg }}
                                    </div>
                                </div>
                                <CodeEditor v-if="editing" v-model="draft" :language="curFile.markdown ? 'markdown' : 'json'" />
                                <div v-else class="code">
                                    <template v-for="row in buildRows(curId)" :key="row.n">
                                        <div v-if="row.line.folded && !foldsUnlocked" class="folded">
                                            <Icon name="lock" :size="12" />
                                            <span>{{ row.line.t.trim() }}</span>
                                            <span class="unlock" @click="unlockFolded">here be dragons — unlock</span>
                                        </div>
                                        <template v-else>
                                            <div :class="row.cls">
                                                <span class="g" :class="{ warn: row.line.g === 'warn' }">
                                                    <Icon v-if="row.line.g" :name="row.line.g === 'err' ? 'xcircle' : 'alert'" :size="13" />
                                                </span>
                                                <span class="n">{{ row.n }}</span>
                                                <span class="t" v-html="renderLine(curFile, row.line.t)"></span>
                                            </div>
                                            <div v-if="row.line.lint" class="lint-line" :class="row.line.lint.type">
                                                <Icon :name="row.line.lint.type === 'err' ? 'xcircle' : 'alert'" :size="12" />
                                                <span>{{ row.line.lint.msg }}</span>
                                            </div>
                                        </template>
                                    </template>
                                </div>
                            </div>
                        </template>
                    </div>

                    <!-- save bar -->
                    <div class="savebar">
                        <template v-if="split">
                            <div class="vstat health warn">
                                <span class="dot"></span>
                                Resolution view — Project wins, Local ignored by rule
                            </div>
                            <div style="flex: 1"></div>
                            <span class="hint">Edit a side to write directly to that file</span>
                        </template>
                        <template v-else-if="curFile.locked">
                            <div class="vstat">
                                <span class="tag lock">
                                    <Icon name="lock" :size="11" />
                                    Managed
                                </span>
                                <span class="muted">Read-only — managed files are observed, never written.</span>
                            </div>
                        </template>
                        <template v-else>
                            <div class="vstat health" :class="saveBarCls">
                                <span class="dot"></span>
                                {{ saveBarStatus }}
                            </div>
                            <span class="hint">{{ saveBarMeta }}</span>
                            <div style="flex: 1"></div>
                            <template v-if="editing">
                                <button class="btn sm" @click="cancelEdit">Cancel</button>
                                <button class="btn sm" :disabled="!dirty" @click="revertDraft">Revert</button>
                                <button class="btn primary sm" :disabled="!dirty || !!draftJsonError" @click="doSave">
                                    <Icon name="check" :size="12" />
                                    Validate &amp; save
                                </button>
                            </template>
                            <template v-else>
                                <button v-if="canEdit" class="btn primary sm" @click="startEdit">
                                    <Icon name="code" :size="12" />
                                    Edit file
                                </button>
                            </template>
                        </template>
                    </div>
                </div>
            </div>
        </section>

        <!-- diff modal — lines come from the engine's live preview -->
        <GuidedDiffModal :open="diffOpen" :file-lines="diffFileLines" :eff-lines="diffEffLines" @close="closeDiff" @confirm="confirmDiff" />
    </main>
</template>

<style scoped>
.raw {
    display: grid;
    grid-template-columns: 256px 1fr;
    height: 100%;
}
.ftree {
    border-right: 1px solid var(--border);
    background: var(--surface-1);
    overflow: auto;
    padding: 8px 0;
}
.ftg {
    padding: 8px 0 2px;
}
.ftg .h {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-dim);
    font-weight: 650;
}
.fitem {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 5px 12px 5px 22px;
    cursor: pointer;
    font: 12px var(--mono);
    color: var(--fg-muted);
}
.fitem:hover {
    background: var(--surface-2);
    color: var(--fg);
}
.fitem.on {
    background: var(--accent-soft);
    color: var(--fg);
    box-shadow: inset 2px 0 0 var(--accent);
}
.fitem .fdot {
    display: flex;
}
.fitem .fb {
    display: flex;
    gap: 4px;
}
.editor-wrap {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.etabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 8px;
    height: 38px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
}
.etab {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 38px;
    padding: 0 12px;
    font: 12px var(--mono);
    color: var(--fg-muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
}
.etab.on {
    color: var(--fg);
    border-bottom-color: var(--accent);
}
.etools {
    margin-left: auto;
    display: flex;
    gap: 6px;
}
.panes {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    overflow: hidden;
}
.panes.split {
    grid-template-columns: 1fr 1fr;
}
.pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--border);
}
.pane:last-child {
    border-right: 0;
}
.pane-h {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--border-soft);
    background: var(--surface-1);
    font: 11px var(--mono);
    color: var(--fg-muted);
}
.pane-h .ph-path {
    color: var(--fg);
}
.code {
    flex: 1;
    overflow: auto;
    font: 12px/1.6 var(--mono);
    padding: 8px 0;
    background: var(--surface-1);
}
.cl {
    display: grid;
    grid-template-columns: 20px 40px 1fr;
    align-items: start;
}
.cl .g {
    color: var(--err);
    display: flex;
    justify-content: center;
    padding-top: 3px;
}
.cl .g.warn {
    color: var(--warn);
}
.cl .n {
    text-align: right;
    padding-right: 12px;
    color: var(--fg-faint);
    user-select: none;
}
.cl .t {
    white-space: pre;
    padding-right: 14px;
}
.cl.hi {
    background: var(--accent-soft);
    box-shadow: inset 2px 0 0 var(--accent);
}
.cl.errln {
    background: var(--err-bg);
}
.cl.warnln {
    background: var(--warn-bg);
}
.cl .t :deep(.key) {
    color: var(--syntax-key);
}
.cl .t :deep(.str) {
    color: var(--syntax-str);
}
.cl .t :deep(.num) {
    color: var(--syntax-num);
}
.cl .t :deep(.bool) {
    color: var(--syntax-kw);
}
.cl .t :deep(.pun) {
    color: var(--fg-dim);
}
.lint-line {
    grid-column: 1/-1;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 14px 5px 60px;
    font-size: 11px;
}
.lint-line.err {
    color: var(--err);
    background: var(--err-bg);
}
.lint-line.warn {
    color: var(--warn);
    background: var(--warn-bg);
}
.lint-line .la {
    margin-left: auto;
    color: var(--accent);
    cursor: pointer;
    font-weight: 600;
}
.savebar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
}
.savebar .vstat {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
}
.folded {
    padding: 6px 14px 6px 60px;
    color: var(--fg-dim);
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.folded .unlock {
    color: var(--accent);
    cursor: pointer;
}
</style>
