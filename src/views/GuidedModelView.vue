<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import GuidedApplyBar from '@/components/GuidedApplyBar.vue';
import GuidedDiffModal from '@/components/GuidedDiffModal.vue';
import { useConfigStore } from '@/stores/config';
import { useGuidedWrites } from '@/composables/useGuidedWrites';
import { SCOPES } from '@/lib/scopes';
import type { ScopeId } from '@shared/contract';

// Model & Effort: the scalar settings that steer the model (model, effortLevel,
// alwaysThinkingEnabled, language). Values come live from the engine's resolved
// dashboard; edits write top-level keys to the chosen settings.json scope.
const config = useConfigStore();
const model = computed(() => config.guidedModel);

const SCOPE_OPTS: { v: ScopeId; t: string; d: string }[] = [
    { v: 'user', t: 'Just me (all projects)', d: '~/.claude/settings.json' },
    { v: 'project', t: 'This project (shared)', d: '.claude/settings.json · committed' },
    { v: 'local', t: 'Just me, this project', d: '.claude/settings.local.json · gitignored' },
];
const scopeOpts = computed(() => SCOPE_OPTS.filter((o) => o.v === 'user' || config.hasProject));

const w = useGuidedWrites({ onDiscard: resync });

// ── Editable copies, kept in sync with the engine until the user edits ──
const scopeSel = ref<ScopeId>('user');
const modelSel = ref('');
const effortSel = ref('');
const thinkingOn = ref(false);
const languageVal = ref('');

function resync(): void {
    const m = model.value;
    if (!m) return;
    modelSel.value = m.model.value;
    effortSel.value = m.effort.value;
    thinkingOn.value = m.thinking.value === 'true';
    languageVal.value = m.language.value;
}
watch(model, () => { if (w.count.value === 0) resync(); }, { immediate: true });

function fieldOf(key: 'model' | 'effort' | 'thinking' | 'language') {
    return computed(() => model.value?.[key] ?? { value: '', scope: null, isDefault: true });
}
const modelField = fieldOf('model');
const effortField = fieldOf('effort');
const thinkingField = fieldOf('thinking');
const languageField = fieldOf('language');

// Register / unregister a scalar write for `key`. Writing the same value the
// scope already resolves to is a no-op, so we drop it from the pending list.
function setScalar(key: string, value: string | boolean, field: { value: string; scope: ScopeId | null }): void {
    const id = `scalar:${key}`;
    const same = String(value) === field.value && field.scope === scopeSel.value;
    if (same) {
        w.unregister(id);
        return;
    }
    w.register(id, `Set ${key} = ${JSON.stringify(value)} (${SCOPES[scopeSel.value].label})`, { kind: 'setScalar', key, value, scope: scopeSel.value });
}
function resetScalar(key: string): void {
    w.register(`scalar:${key}`, `Reset ${key} to default (${SCOPES[scopeSel.value].label})`, { kind: 'removeScalar', key, scope: scopeSel.value });
}

function pickModel(v: string): void {
    modelSel.value = v;
    setScalar('model', v, modelField.value);
}
function pickEffort(v: string): void {
    effortSel.value = v;
    setScalar('effortLevel', v, effortField.value);
}
function toggleThinking(): void {
    thinkingOn.value = !thinkingOn.value;
    setScalar('alwaysThinkingEnabled', thinkingOn.value, thinkingField.value);
}
function commitLanguage(): void {
    const v = languageVal.value.trim();
    if (!v) resetScalar('language');
    else setScalar('language', v, languageField.value);
}

// Changing the target scope re-targets edits that are ALREADY staged — it never
// stages a field the user hasn't touched.
const staged = (key: string) => w.pending.value.some((p) => p.id === `scalar:${key}`);
watch(scopeSel, () => {
    if (staged('model')) setScalar('model', modelSel.value, modelField.value);
    if (staged('effortLevel')) setScalar('effortLevel', effortSel.value, effortField.value);
    if (staged('alwaysThinkingEnabled')) setScalar('alwaysThinkingEnabled', thinkingOn.value, thinkingField.value);
    if (staged('language') && languageVal.value.trim()) setScalar('language', languageVal.value.trim(), languageField.value);
});
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <span class="crumb">Guided Config &nbsp;›&nbsp; <b>Model &amp; Effort</b></span>
                    <h1 style="margin-top: 2px">Model &amp; Effort</h1>
                </div>
                <div class="spacer"></div>
                <RouterLink class="btn ghost sm" to="/dashboard">View merged result</RouterLink>
            </div>

            <div class="view-body">
                <div v-if="model" class="guided">
                    <!-- Scope selector governs every edit on this page -->
                    <div class="card mb">
                        <div class="card-h"><h3>Apply changes to</h3></div>
                        <div class="card-b">
                            <div class="scope-sel">
                                <button v-for="o in scopeOpts" :key="o.v" class="opt" :class="{ on: o.v === scopeSel }" @click="scopeSel = o.v">
                                    <div class="ttl"><ProvenanceChip :scope="o.v" /> {{ o.t }}</div>
                                    <div class="desc">{{ o.d }}</div>
                                </button>
                            </div>
                            <p v-if="!config.hasProject" class="hint" style="margin-top: 10px">
                                <Icon name="info" :size="12" /> No project selected — only user scope is writable.
                            </p>
                        </div>
                    </div>

                    <!-- Model -->
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Model</h3>
                            <span class="hint" style="margin-left: auto">
                                Resolves to <code class="mono-v">{{ modelField.value || 'account default' }}</code>
                                <template v-if="modelField.scope">(<ProvenanceChip :scope="modelField.scope" />)</template>
                            </span>
                        </div>
                        <div class="card-b">
                            <div class="modes">
                                <button v-for="m in model.modelOptions" :key="m.v" class="mode" :class="{ on: m.v === modelSel || m.label === modelSel }" @click="pickModel(m.v)">
                                    <div class="mn">{{ m.label }}</div>
                                    <div class="md">{{ m.d }}</div>
                                </button>
                            </div>
                            <p class="hint" style="margin-top: 10px">
                                Aliases (<code>opus</code>, <code>sonnet</code>) track the latest release; pin a full id in the Raw Editor if you need an exact build.
                            </p>
                        </div>
                    </div>

                    <!-- Effort + thinking -->
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Reasoning effort</h3>
                            <span class="hint" style="margin-left: auto">
                                <code class="mono-v">effortLevel</code> ·
                                resolves to <code class="mono-v">{{ effortField.value || '—' }}</code>
                            </span>
                        </div>
                        <div class="card-b">
                            <div class="modes" style="grid-template-columns: repeat(3, 1fr)">
                                <button v-for="e in model.effortOptions" :key="e.v" class="mode" :class="{ on: e.v === effortSel }" @click="pickEffort(e.v)">
                                    <div class="mn">{{ e.label }}</div>
                                    <div class="md">{{ e.d }}</div>
                                </button>
                            </div>
                            <label class="toggle-row" @click="toggleThinking">
                                <span class="tg" :class="{ on: thinkingOn }"><span class="knob"></span></span>
                                <div>
                                    <div class="tg-t">Extended thinking always on</div>
                                    <div class="tg-d"><code>alwaysThinkingEnabled</code> — thinks before every turn instead of only when useful.</div>
                                </div>
                                <span v-if="thinkingField.scope" style="margin-left: auto"><ProvenanceChip :scope="thinkingField.scope" /></span>
                            </label>
                        </div>
                    </div>

                    <!-- Language -->
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Output language</h3>
                            <span class="hint" style="margin-left: auto"><code class="mono-v">language</code></span>
                        </div>
                        <div class="card-b">
                            <div style="display: flex; gap: 8px; max-width: 360px">
                                <input v-model="languageVal" class="field" placeholder="english" @keyup.enter="commitLanguage" @blur="commitLanguage" />
                                <button class="btn" @click="commitLanguage">Set</button>
                            </div>
                            <p class="hint" style="margin-top: 8px">Leave blank to fall back to the default. Applied to the <b>{{ SCOPES[scopeSel].label }}</b> scope.</p>
                        </div>
                    </div>

                </div>
                <div v-else class="card" style="padding: 22px; text-align: center"><span class="hint">Loading…</span></div>
            </div>
            <GuidedApplyBar :count="w.count.value" :can-apply="w.canApply.value" v-model:show-diff="w.showDiff.value" @discard="w.discard" @apply="w.apply" />
        </section>

        <GuidedDiffModal :open="w.modalOpen.value" :file-lines="w.fileLines.value" :eff-lines="w.effLines.value" @close="w.closeDiff" @confirm="w.confirmDiff" />
    </main>
</template>

<style scoped>
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
.toggle-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    padding: 11px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-1);
    cursor: pointer;
}
.tg {
    flex: 0 0 auto;
    width: 34px;
    height: 20px;
    border-radius: 999px;
    background: var(--surface-3);
    border: 1px solid var(--border-strong);
    position: relative;
    transition: background 0.12s;
}
.tg .knob {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--fg-dim);
    transition: transform 0.12s, background 0.12s;
}
.tg.on {
    background: var(--accent-soft);
    border-color: var(--accent);
}
.tg.on .knob {
    transform: translateX(14px);
    background: var(--accent);
}
.tg-t {
    font-size: 12.5px;
    color: var(--fg);
}
.tg-d {
    font-size: 11px;
    color: var(--fg-dim);
    margin-top: 2px;
}
</style>
