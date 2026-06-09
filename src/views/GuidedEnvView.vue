<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import GuidedApplyBar from '@/components/GuidedApplyBar.vue';
import GuidedDiffModal from '@/components/GuidedDiffModal.vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import { useGuidedWrites } from '@/composables/useGuidedWrites';
import { SCOPES } from '@/lib/scopes';
import type { ScopeId } from '@shared/contract';

// Environment: the merged `env` object Claude injects into every shell. Values
// come live from the engine (secrets masked); edits write entries into the
// `env` object of the chosen settings.json scope.
const config = useConfigStore();
const env = computed(() => config.guidedEnv);
const VARS = computed(() => env.value?.vars ?? []);

const SCOPE_OPTS: { v: ScopeId; t: string; d: string }[] = [
    { v: 'user', t: 'Just me (all projects)', d: '~/.claude/settings.json' },
    { v: 'project', t: 'This project (shared)', d: '.claude/settings.json · committed' },
    { v: 'local', t: 'Just me, this project', d: '.claude/settings.local.json · gitignored' },
];
const scopeOpts = computed(() => SCOPE_OPTS.filter((o) => o.v === 'user' || config.hasProject));

const w = useGuidedWrites({ onDiscard: resync });

const scopeSel = ref<ScopeId>('project');
const newName = ref('');
const newValue = ref('');
const removed = ref<Set<string>>(new Set());
interface AddedVar {
    name: string;
    value: string;
    scope: ScopeId;
}
const added = ref<AddedVar[]>([]);

function resync(): void {
    removed.value = new Set();
    added.value = [];
    newName.value = '';
    newValue.value = '';
}
watch(env, () => { if (w.count.value === 0) resync(); }, { immediate: true });
watch(() => config.hasProject, (has) => { if (!has) scopeSel.value = 'user'; }, { immediate: true });

function removeVar(name: string, scope: ScopeId, locked?: boolean): void {
    if (locked) return;
    removed.value.add(name);
    w.register(`env-del:${name}`, `Remove env ${name} (${SCOPES[scope].label})`, { kind: 'removeEnvVar', name, scope });
}
function undoRemove(name: string): void {
    removed.value.delete(name);
    w.unregister(`env-del:${name}`);
}
function addVar(): void {
    const name = newName.value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        toast('Enter a valid variable name (letters, digits, underscore)', 'alert');
        return;
    }
    const value = newValue.value;
    added.value.push({ name, value, scope: scopeSel.value });
    w.register(`env-set:${name}`, `Set env ${name} (${SCOPES[scopeSel.value].label})`, { kind: 'setEnvVar', name, value, scope: scopeSel.value });
    newName.value = '';
    newValue.value = '';
}
function removeAdded(i: number): void {
    const a = added.value[i];
    added.value.splice(i, 1);
    w.unregister(`env-set:${a.name}`);
}
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <span class="crumb">Guided Config &nbsp;›&nbsp; <b>Environment</b></span>
                    <h1 style="margin-top: 2px">Environment</h1>
                </div>
                <div class="spacer"></div>
                <RouterLink class="btn ghost sm" to="/dashboard">View merged result</RouterLink>
            </div>

            <div class="view-body">
                <div v-if="env" class="guided">
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Environment variables</h3>
                            <span class="hint" style="margin-left: auto">{{ VARS.length }} merged across scopes</span>
                        </div>
                        <div class="card-b">
                            <div v-if="!VARS.length && !added.length" class="hint" style="padding: 8px 0">
                                No <code>env</code> variables set across {{ config.hasProject ? 'user, project, or local' : 'user' }} scope.
                            </div>
                            <div v-for="v in VARS" :key="v.name" class="evar" :class="{ removed: removed.has(v.name) }">
                                <span class="vk">{{ v.name }}</span>
                                <span class="vv">
                                    {{ v.display }}
                                    <span v-if="v.secret" class="tag warn"><Icon name="eyeoff" :size="10" /> secret</span>
                                </span>
                                <ProvenanceChip :scope="v.scope" />
                                <span v-if="v.shadowedBy" class="tag inert" :title="`also defined in ${v.shadowedBy}`">+1</span>
                                <button v-if="removed.has(v.name)" class="btn ghost sm" @click="undoRemove(v.name)">Undo</button>
                                <span v-else-if="v.locked" class="tag lock"><Icon name="lock" :size="10" /> managed</span>
                                <span v-else class="del" title="Remove" @click="removeVar(v.name, v.scope, v.locked)"><Icon name="trash" :size="14" /></span>
                            </div>
                            <!-- pending additions -->
                            <div v-for="(a, i) in added" :key="'add' + a.name" class="evar added">
                                <span class="vk">{{ a.name }}</span>
                                <span class="vv">{{ a.value || '(empty)' }}</span>
                                <ProvenanceChip :scope="a.scope" />
                                <span class="tag ok">new</span>
                                <span class="del" title="Drop" @click="removeAdded(i)"><Icon name="xcircle" :size="14" /></span>
                            </div>
                        </div>
                    </div>

                    <div class="card mb">
                        <div class="card-h"><h3>Add / overwrite a variable</h3></div>
                        <div class="card-b">
                            <div class="composer">
                                <input v-model="newName" class="field field-mono" placeholder="NAME" @keyup.enter="addVar" />
                                <input v-model="newValue" class="field field-mono" placeholder="value or ${OTHER_VAR}" @keyup.enter="addVar" />
                                <button class="btn" @click="addVar"><Icon name="plus" :size="13" /> Add</button>
                            </div>
                            <div style="margin-top: 14px">
                                <label class="lbl">Scope for new variable</label>
                                <div class="scope-sel">
                                    <button v-for="o in scopeOpts" :key="o.v" class="opt" :class="{ on: o.v === scopeSel }" @click="scopeSel = o.v">
                                        <div class="ttl"><ProvenanceChip :scope="o.v" /> {{ o.t }}</div>
                                        <div class="desc">{{ o.d }}</div>
                                    </button>
                                </div>
                            </div>
                            <div class="effect info" style="margin-top: 12px">
                                <Icon name="info" :size="14" />
                                <span>Secrets are best kept in <b>local</b> scope — it is gitignored, so the value never reaches the repo.</span>
                            </div>
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
.evar {
    display: grid;
    grid-template-columns: minmax(120px, 220px) 1fr auto auto auto;
    align-items: center;
    gap: 10px;
    padding: 8px 4px;
    border-bottom: 1px solid var(--border-soft);
}
.evar:last-child {
    border-bottom: 0;
}
.evar.removed {
    opacity: 0.5;
}
.evar.removed .vk,
.evar.removed .vv {
    text-decoration: line-through;
}
.evar.added .vk {
    color: var(--ok);
}
.evar .vk {
    font: 12px var(--mono);
    font-weight: 600;
    color: var(--fg);
    word-break: break-all;
}
.evar .vv {
    font: 11.5px var(--mono);
    color: var(--fg-muted);
    display: flex;
    align-items: center;
    gap: 8px;
    word-break: break-all;
}
.evar .del {
    color: var(--fg-faint);
    cursor: pointer;
    display: flex;
}
.evar .del:hover {
    color: var(--err);
}
.composer {
    display: grid;
    grid-template-columns: minmax(120px, 240px) 1fr auto;
    gap: 8px;
    align-items: center;
}
</style>
