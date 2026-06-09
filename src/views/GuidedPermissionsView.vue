<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { SCOPES } from '@/lib/scopes';
import type { Behaviour, ChangeOp, DiffLine, GuidedRule, ScopeId } from '@shared/contract';

interface ScopeOption {
    v: ScopeId;
    t: string;
    d: string;
}
interface Pending {
    id: string;
    label: string;
    op: ChangeOp;
}

const config = useConfigStore();
const guided = computed(() => config.guidedPermissions);

// Mode buttons + merged rules come live from the engine; the form drives real
// writes through the write-target resolver.
const MODES = computed(() => guided.value?.modes ?? []);
const effectiveMode = computed(() => guided.value?.effectiveMode ?? 'default');
const effectiveScope = computed(() => guided.value?.effectiveModeScope ?? null);
const bypassLock = computed(() => guided.value?.bypassLock ?? null);

const SCOPE_OPTS: ScopeOption[] = [
    { v: 'user', t: 'Just me (all projects)', d: '~/.claude/settings.json' },
    { v: 'project', t: 'This project (shared with team)', d: '.claude/settings.json · committed' },
    { v: 'local', t: 'Just me, this project', d: '.claude/settings.local.json · gitignored' },
];

const BEHAVIOURS: Behaviour[] = ['allow', 'ask', 'deny'];
const TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'WebFetch'];

// ── Reactive state ────────────────────────────────────────────────────────
const pending = ref<Pending[]>([]);
const curMode = ref(effectiveMode.value);
const rules = ref<GuidedRule[]>([]);
const modeScopeSel = ref<ScopeId>('project');
const ruleScopeSel = ref<ScopeId>('project');
const cBeh = ref<Behaviour>('allow');
const cTool = ref('Bash');
const cSpec = ref('');
const showDiff = ref(true);
const modalOpen = ref(false);

// Keep the editable copy in sync with the engine until the user starts editing.
watch(
    guided,
    (g) => {
        if (!g) return;
        if (pending.value.length === 0) {
            curMode.value = g.effectiveMode;
            rules.value = g.rules.map((r) => ({ ...r }));
        }
    },
    { immediate: true },
);

const pendN = computed(() => pending.value.length);
const canApply = computed(() => pending.value.length > 0);
const modeDisableNonUser = computed(() => MODES.value.find((m) => m.v === curMode.value)?.userOnly === true);
const modeWhy = 'auto can only be set in user settings';

interface Effect {
    kind: 'info' | 'warn';
    html: string;
}
const modeEffect = computed<Effect>(() => {
    const m = MODES.value.find((x) => x.v === curMode.value);
    if (m?.userOnly) {
        return { kind: 'warn', html: '<b>auto</b> mode is honoured only from <b>user</b> settings. Project / local placements are silently ignored (since v2.1.142).' };
    }
    if (curMode.value === effectiveMode.value) {
        return { kind: 'info', html: `No change — this is already the effective value (from ${effectiveScope.value ?? 'default'}).` };
    }
    return { kind: 'info', html: `This will set <code>${curMode.value}</code> for the selected scope.` };
});

function regPending(id: string, label: string, op: ChangeOp): void {
    const existing = pending.value.findIndex((p) => p.id === id);
    if (existing >= 0) pending.value[existing] = { id, label, op };
    else pending.value.push({ id, label, op });
}
function unreg(id: string): void {
    pending.value = pending.value.filter((p) => p.id !== id);
}

// ── Drag-to-reorder (within one behaviour + scope group only) ──────────────
const dragIndex = ref<number | null>(null);
const dropIndex = ref<number | null>(null);

// Two rows belong to the same reorderable group when they share behaviour and
// scope and neither is a managed (locked) rule.
function sameGroup(a: number, b: number): boolean {
    const ra = rules.value[a];
    const rb = rules.value[b];
    return !!ra && !!rb && ra.beh === rb.beh && ra.scope === rb.scope && !ra.locked && !rb.locked;
}
function onDragStart(i: number, e: DragEvent): void {
    if (rules.value[i].locked) {
        e.preventDefault();
        return;
    }
    dragIndex.value = i;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i)); // Firefox needs a payload
    }
}
function onDragOver(i: number): void {
    if (dragIndex.value === null) return;
    dropIndex.value = sameGroup(dragIndex.value, i) ? i : null;
}
function onDrop(i: number): void {
    const from = dragIndex.value;
    if (from === null || from === i || !sameGroup(from, i)) {
        onDragEnd();
        return;
    }
    const moved = rules.value.splice(from, 1)[0];
    rules.value.splice(from < i ? i - 1 : i, 0, moved);
    const specs = rules.value.filter((r) => r.beh === moved.beh && r.scope === moved.scope).map((r) => r.spec);
    regPending(`reorder:${moved.beh}:${moved.scope}`, `Reorder ${moved.beh} rules (${SCOPES[moved.scope].label})`, { kind: 'reorderRules', beh: moved.beh, scope: moved.scope, specs });
    onDragEnd();
}
function onDragEnd(): void {
    dragIndex.value = null;
    dropIndex.value = null;
}

function selectMode(m: { v: string; locked?: boolean; userOnly?: boolean }): void {
    if (m.locked) return;
    curMode.value = m.v;
    if (m.userOnly) modeScopeSel.value = 'user';
    syncModePending();
}
function selectModeScope(o: ScopeOption): void {
    if (modeDisableNonUser.value && o.v !== 'user') return;
    modeScopeSel.value = o.v;
    syncModePending();
}
function syncModePending(): void {
    if (curMode.value === effectiveMode.value && modeScopeSel.value === effectiveScope.value) {
        unreg('defaultMode');
    } else {
        regPending('defaultMode', `Set defaultMode = "${curMode.value}" (${SCOPES[modeScopeSel.value].label})`, {
            kind: 'setDefaultMode',
            mode: curMode.value,
            scope: modeScopeSel.value,
        });
    }
}
function selectRuleScope(o: ScopeOption): void {
    ruleScopeSel.value = o.v;
}

function removeRule(i: number): void {
    const r = rules.value[i];
    if (r.locked) return;
    rules.value.splice(i, 1);
    regPending('del' + r.spec, `Remove ${r.beh} ${r.spec}`, { kind: 'removeRule', beh: r.beh, spec: r.spec, scope: r.scope });
}
function addRule(): void {
    const spec = cSpec.value.trim();
    if (!spec) {
        toast('Enter a specifier first', 'alert');
        return;
    }
    const full = `${cTool.value}(${spec})`;
    rules.value.push({ beh: cBeh.value, spec: full, scope: ruleScopeSel.value });
    regPending('add' + full, `Add ${cBeh.value} ${full} (${SCOPES[ruleScopeSel.value].label})`, {
        kind: 'addRule',
        beh: cBeh.value,
        spec: full,
        scope: ruleScopeSel.value,
    });
    cSpec.value = '';
}

function discard(): void {
    pending.value = [];
    if (guided.value) {
        curMode.value = guided.value.effectiveMode;
        rules.value = guided.value.rules.map((r) => ({ ...r }));
    }
    toast('Pending changes discarded', 'check');
}

// ── Diff preview built from real engine previews ───────────────────────────
const fileLines = ref<DiffLine[]>([]);
const effLines = ref<DiffLine[]>([]);

async function buildPreview(): Promise<void> {
    const file: DiffLine[] = [];
    const eff: DiffLine[] = [];
    for (const p of pending.value) {
        const { preview, blocked } = await config.previewChange(p.op);
        if (blocked) {
            toast(blocked, 'alert');
            continue;
        }
        if (preview) {
            file.push(...preview.file.lines);
            eff.push(...preview.effective);
        }
    }
    fileLines.value = file;
    effLines.value = eff;
}

async function apply(): Promise<void> {
    if (pending.value.length === 0) return;
    if (showDiff.value) {
        await buildPreview();
        modalOpen.value = true;
    } else {
        await commit();
    }
}
function closeDiff(): void {
    modalOpen.value = false;
}
async function confirmDiff(): Promise<void> {
    modalOpen.value = false;
    await commit();
}
async function commit(): Promise<void> {
    const ops = [...pending.value];
    let ok = 0;
    let backup: string | undefined;
    for (const p of ops) {
        const res = await config.applyChange(p.op);
        if (res.ok) {
            ok++;
            backup = res.backupPath ?? backup;
        } else {
            toast(res.blocked ?? res.error ?? 'Write failed', 'alert');
        }
    }
    pending.value = [];
    if (ok > 0) {
        toast(`${ok} change${ok > 1 ? 's' : ''} written${backup ? ' · backup created' : ''}`, 'check');
    }
}
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <span class="crumb">
                        Guided Config &nbsp;›&nbsp;
                        <b>Permissions</b>
                    </span>
                    <h1 style="margin-top: 2px">Permissions</h1>
                </div>
                <div class="spacer"></div>
                <RouterLink class="btn ghost sm" to="/permissions">View merged result</RouterLink>
            </div>

            <div class="view-body">
                <div class="guided">
                    <!-- Default mode -->
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Default permission mode</h3>
                            <span class="hint" style="margin-left: auto">
                                Currently resolves to
                                <code class="mono-v">{{ effectiveMode }}</code>
                                <template v-if="effectiveScope">({{ effectiveScope }})</template>
                            </span>
                        </div>
                        <div class="card-b">
                            <div class="modes">
                                <button
                                    v-for="m in MODES"
                                    :key="m.v"
                                    class="mode"
                                    :class="{ on: m.v === curMode }"
                                    :disabled="m.locked"
                                    :title="m.locked ? 'Locked by managed policy' : undefined"
                                    @click="selectMode(m)">
                                    <span v-if="m.cur" class="cur">live</span>
                                    <div class="mn">{{ m.label }}</div>
                                    <div class="md">{{ m.d }}</div>
                                </button>
                            </div>
                            <div style="margin-top: 14px">
                                <label class="lbl">Apply this change to</label>
                                <div class="scope-sel">
                                    <button
                                        v-for="o in SCOPE_OPTS"
                                        :key="o.v"
                                        class="opt"
                                        :class="{ on: o.v === modeScopeSel }"
                                        :aria-disabled="modeDisableNonUser && o.v !== 'user' ? 'true' : undefined"
                                        @click="selectModeScope(o)">
                                        <div class="ttl">
                                            <ProvenanceChip :scope="o.v" />
                                            {{ o.t }}
                                        </div>
                                        <div class="desc">{{ o.d }}</div>
                                        <div v-if="modeDisableNonUser && o.v !== 'user'" class="why">
                                            <Icon name="alert" :size="12" />
                                            {{ modeWhy }}
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div style="margin-top: 12px">
                                <div class="effect" :class="modeEffect.kind">
                                    <Icon :name="modeEffect.kind === 'warn' ? 'alert' : 'info'" :size="14" />
                                    <span v-html="modeEffect.html"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Rule builder -->
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Permission rules</h3>
                            <span class="hint" style="margin-left: auto">drag to reorder within a group</span>
                        </div>
                        <div class="card-b">
                            <div>
                                <div
                                    v-for="(r, i) in rules"
                                    :key="r.beh + ':' + r.scope + ':' + r.spec"
                                    class="rule-edit"
                                    :class="{ dragging: dragIndex === i, 'drop-target': dropIndex === i }"
                                    :draggable="!r.locked"
                                    @dragstart="onDragStart(i, $event)"
                                    @dragover.prevent="onDragOver(i)"
                                    @drop="onDrop(i)"
                                    @dragend="onDragEnd">
                                    <span v-if="r.locked"></span>
                                    <span v-else class="drag"><Icon name="grip" :size="14" /></span>
                                    <span class="beh" :class="r.beh">{{ r.beh }}</span>
                                    <span class="spec">{{ r.spec }}</span>
                                    <ProvenanceChip :scope="r.scope" />
                                    <span v-if="r.locked" class="tag lock" title="Managed rule — read-only">
                                        <Icon name="lock" :size="10" />
                                        managed
                                    </span>
                                    <span v-else class="del" title="Remove" @click="removeRule(i)">
                                        <Icon name="trash" :size="14" />
                                    </span>
                                </div>
                            </div>
                            <hr class="hr" />
                            <label class="lbl">Add a rule</label>
                            <div class="composer">
                                <div>
                                    <select v-model="cBeh" class="field">
                                        <option v-for="b in BEHAVIOURS" :key="b" :value="b">{{ b }}</option>
                                    </select>
                                </div>
                                <div>
                                    <select v-model="cTool" class="field field-mono">
                                        <option v-for="t in TOOLS" :key="t" :value="t">{{ t }}</option>
                                    </select>
                                </div>
                                <div class="syntax-help">
                                    <input v-model="cSpec" class="field field-mono" placeholder="docker compose *" @keyup.enter="addRule" />
                                    <div class="help-pop">
                                        <b>Specifier syntax</b>
                                        <div class="row">
                                            <code>npm run *</code>
                                            <span class="dim">prefix + wildcard</span>
                                        </div>
                                        <div class="row">
                                            <code>./.env.*</code>
                                            <span class="dim">relative path glob</span>
                                        </div>
                                        <div class="row">
                                            <code>~/.ssh/**</code>
                                            <span class="dim">recursive home glob</span>
                                        </div>
                                        <div class="row">
                                            <code>(exact)</code>
                                            <span class="dim">no wildcard = exact</span>
                                        </div>
                                    </div>
                                </div>
                                <button class="btn" @click="addRule">
                                    <Icon name="plus" :size="13" />
                                    Add
                                </button>
                            </div>
                            <div style="margin-top: 12px">
                                <label class="lbl">Scope for new rule</label>
                                <div class="scope-sel">
                                    <button v-for="o in SCOPE_OPTS" :key="o.v" class="opt" :class="{ on: o.v === ruleScopeSel }" @click="selectRuleScope(o)">
                                        <div class="ttl">
                                            <ProvenanceChip :scope="o.v" />
                                            {{ o.t }}
                                        </div>
                                        <div class="desc">{{ o.d }}</div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Locked example -->
                    <div v-if="bypassLock" class="card mb">
                        <div class="card-h"><h3>Bypass-permissions mode</h3></div>
                        <div class="card-b">
                            <div class="locked">
                                <span class="lk-ico"><Icon name="lock" :size="16" /></span>
                                <div>
                                    <div class="lk-val">{{ bypassLock.value }}</div>
                                    <div class="lk-chan">{{ bypassLock.channel }}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            
            <!-- Apply bar -->
            <div class="applybar">
                <span class="count">
                    <b>{{ pendN }}</b>
                    pending changes
                </span>
                <label class="chk" :class="{ on: showDiff }">
                    <input v-model="showDiff" type="checkbox" />
                    Preview diff before applying
                </label>
                <div class="spacer"></div>
                <button class="btn" :disabled="!canApply" @click="discard">Discard</button>
                <button class="btn primary" :disabled="!canApply" @click="apply">Apply changes</button>
            </div>
        </section>

        <!-- Diff modal -->
        <div v-if="modalOpen" class="scrim">
            <div class="modal">
                <div class="modal-h">
                    <span style="color: var(--accent)"><Icon name="diff" :size="16" /></span>
                    <h2>Review changes</h2>
                    <div class="spacer" style="flex: 1"></div>
                    <button class="icon-btn" @click="closeDiff"><Icon name="xcircle" :size="16" /></button>
                </div>
                <div class="modal-b">
                    <!-- File diff -->
                    <div class="diff-block">
                        <div class="diff-h">
                            <Icon name="file" :size="13" />
                            File diff
                        </div>
                        <div class="diff">
                            <div v-if="!fileLines.length" class="ln">
                                <span class="gut">…</span>
                                <span class="txt">no textual change</span>
                            </div>
                            <div v-for="(l, i) in fileLines" :key="'f' + i" class="ln" :class="l.add ? 'add' : 'del'">
                                <span class="gut">{{ l.add ? '+' : '-' }}</span>
                                <span class="txt">{{ l.text }}</span>
                            </div>
                        </div>
                    </div>
                    <!-- Effective-config diff (the thesis) -->
                    <div class="diff-block thesis">
                        <div class="diff-h">
                            <Icon name="arrow" :size="13" />
                            What actually changes · effective configuration
                        </div>
                        <div class="diff thesis">
                            <div v-for="(l, i) in effLines" :key="'e' + i" class="ln" :class="l.add ? 'add' : 'del'">
                                <span class="gut">{{ l.add ? '+' : '-' }}</span>
                                <span class="txt">{{ l.text }}</span>
                            </div>
                        </div>
                        <div class="hint" style="margin-top: 7px">
                            <Icon name="info" :size="12" />
                            This is the resolved result after merge — what the agent will actually see.
                        </div>
                    </div>
                </div>
                <div class="modal-f">
                    <span class="hint">Atomic write · timestamped backup created (5 retained)</span>
                    <div style="flex: 1"></div>
                    <button class="btn" @click="closeDiff">Cancel</button>
                    <button class="btn primary" @click="confirmDiff">Apply &amp; back up</button>
                </div>
            </div>
        </div>
    </main>
</template>

<style scoped>
.guided {
/*    max-width: 860px;*/
}
.modes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}
.mode {
    text-align: left;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-1);
    cursor: pointer;
    position: relative;
}
.mode:hover {
    border-color: var(--border-strong);
}
.mode.on {
    border-color: var(--accent);
    background: var(--accent-soft);
}
.mode .mn {
    font: 12px var(--mono);
    font-weight: 600;
    color: var(--fg);
}
.mode .md {
    font-size: 11px;
    color: var(--fg-dim);
    margin-top: 3px;
}
.mode .cur {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--scope-project);
    background: color-mix(in oklab, var(--scope-project) 14%, transparent);
    padding: 1px 5px;
    border-radius: 4px;
}
.composer {
    display: grid;
    grid-template-columns: 96px 86px 1fr auto;
    gap: 8px;
    align-items: end;
}
.syntax-help {
    position: relative;
}
.help-pop {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: 300px;
    background: var(--surface-4);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    box-shadow: var(--shadow-pop);
    padding: 11px;
    font-size: 11.5px;
    line-height: 1.55;
}
.syntax-help:hover .help-pop,
.syntax-help:focus-within .help-pop {
    display: block;
}
.help-pop code {
    color: var(--accent);
}
.help-pop .row {
    justify-content: space-between;
    padding: 2px 0;
    border-bottom: 1px solid var(--border-soft);
}
.help-pop .row:last-child {
    border-bottom: 0;
}
.rule-edit {
    display: grid;
    grid-template-columns: 18px 64px 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
    height: 34px;
    border-bottom: 1px solid var(--border-soft);
}
.rule-edit .spec {
    font: 12px var(--mono);
    color: var(--fg);
}
.rule-edit .del {
    color: var(--fg-faint);
    cursor: pointer;
    display: flex;
}
.rule-edit .del:hover {
    color: var(--err);
}
.rule-edit .drag {
    color: var(--fg-faint);
    cursor: grab;
    display: flex;
}
.rule-edit[draggable='true']:active {
    cursor: grabbing;
}
.rule-edit.dragging {
    opacity: 0.45;
}
.rule-edit.drop-target {
    box-shadow: inset 0 2px 0 0 var(--accent);
}
.applybar {
    position: sticky;
    bottom: 0;
    margin: 18px 0px -28px;
    padding: 12px 20px;
    background: var(--surface-2);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
}
.applybar .count {
    font-size: 12px;
    color: var(--fg-muted);
}
.applybar .count b {
    color: var(--fg);
}
.applybar .spacer {
    flex: 1;
}
</style>
