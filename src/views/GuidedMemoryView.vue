<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import type { GuidedMemorySlot } from '@shared/contract';

// Memory: a file manager for the CLAUDE.md files Claude loads. Memory is
// markdown, not settings JSON, so "create" writes a whole file through the
// saveFile channel (atomic + backup) rather than a ChangeOp. Editing hands off
// to the Raw Editor.
const config = useConfigStore();
const router = useRouter();
const mem = computed(() => config.guidedMemory);
const SLOTS = computed(() => mem.value?.slots ?? []);
const IMPORTS = computed(() => mem.value?.imports ?? []);
const brokenCount = computed(() => mem.value?.brokenCount ?? 0);
const auto = computed(() => mem.value?.auto ?? null);

const busy = ref<string | null>(null);
const previewSlot = ref<GuidedMemorySlot | null>(null);

function openPreview(s: GuidedMemorySlot): void {
    previewSlot.value = s;
}
function closePreview(): void {
    previewSlot.value = null;
}

async function create(s: GuidedMemorySlot): Promise<void> {
    if (config.readOnly) {
        toast('Read-only mode is on — writes are disabled.', 'alert');
        return;
    }
    busy.value = s.scope;
    const res = await config.saveFile({ realPath: s.realPath, content: s.template });
    busy.value = null;
    previewSlot.value = null;
    if (res.ok) toast(`Created ${s.path}`, 'check');
    else toast(res.blocked ?? res.error ?? 'Could not create the file', 'alert');
}

// The raw model exposes the same memory files under stable ids per scope.
const RAW_ID: Record<string, string> = { user: 'mem-user', project: 'mem-proj', local: 'mem-local' };
function openInEditor(scope: string): void {
    void router.push({ path: '/raw', query: { file: RAW_ID[scope] ?? '' } });
}
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <span class="crumb">Guided Config &nbsp;›&nbsp; <b>Memory</b></span>
                    <h1 style="margin-top: 2px">Memory</h1>
                </div>
                <div class="spacer"></div>
                <RouterLink class="btn ghost sm" to="/memory">View memory map</RouterLink>
            </div>

            <div class="view-body">
                <div v-if="mem" class="guided">
                    <div v-if="brokenCount" class="banner warn">
                        <span class="b-ico"><Icon name="alert" :size="16" /></span>
                        <div><b>{{ brokenCount }} broken import{{ brokenCount > 1 ? 's' : '' }}.</b> An <code class="mono-v">@import</code> points to a missing file — fix it in the Raw Editor.</div>
                    </div>

                    <div class="card mb">
                        <div class="card-h">
                            <h3>Memory files</h3>
                            <span class="hint" style="margin-left: auto">create a missing file from a template, or open an existing one to edit</span>
                        </div>
                        <div class="card-b">
                            <div v-for="s in SLOTS" :key="s.scope" class="slot">
                                <span class="s-ico" :class="{ on: s.exists }"><Icon name="file" :size="15" /></span>
                                <div class="s-main">
                                    <div class="s-top">
                                        <span class="s-label">{{ s.label }}</span>
                                        <ProvenanceChip :scope="s.scope" />
                                        <span v-if="s.committed" class="tag info">committed</span>
                                        <span v-if="s.gitignore" class="tag gitignore">git</span>
                                    </div>
                                    <div class="s-path">{{ s.path }}</div>
                                </div>
                                <div class="s-state">
                                    <template v-if="s.exists">
                                        <span class="tag ok"><Icon name="check" :size="10" /> {{ s.lines }} lines</span>
                                        <button class="btn sm" @click="openInEditor(s.scope)"><Icon name="code" :size="12" /> Edit</button>
                                    </template>
                                    <template v-else>
                                        <span class="tag inert">not created</span>
                                        <button class="btn sm" @click="openPreview(s)"><Icon name="plus" :size="12" /> Create</button>
                                    </template>
                                </div>
                            </div>
                            <p v-if="!config.hasProject" class="hint" style="margin-top: 12px">
                                <Icon name="info" :size="12" /> No project selected — only the personal (user) memory file is shown. Pick a project for project &amp; local memory.
                            </p>
                        </div>
                    </div>

                    <div class="mem-grid">
                        <div class="card">
                            <div class="card-h"><h3>Import graph</h3><span class="hint" style="margin-left: auto">@import from project CLAUDE.md</span></div>
                            <div class="card-b graph">
                                <div v-if="!IMPORTS.length" class="hint">No <code>@import</code> directives.</div>
                                <div v-for="imp in IMPORTS" :key="imp.id" class="gimport">
                                    <span class="conn">└─ @</span>
                                    <span :class="{ broken: imp.broken }">{{ imp.path }}</span>
                                    <span v-if="imp.broken" class="tag err"><Icon name="xcircle" :size="10" /> broken</span>
                                    <span v-else class="tag ok"><Icon name="check" :size="10" /> depth {{ imp.depth }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-h">
                                <h3>Auto memory</h3>
                                <span class="tag" :class="auto?.enabled ? 'ok' : 'inert'" style="margin-left: auto">
                                    <Icon :name="auto?.enabled ? 'check' : 'info'" :size="10" /> {{ auto?.enabled ? 'enabled' : 'disabled' }}
                                </span>
                            </div>
                            <div class="card-b">
                                <div v-if="auto" class="hint" style="line-height: 1.6">
                                    {{ auto.entries }} entr{{ auto.entries === 1 ? 'y' : 'ies' }} ·
                                    <code class="mono-v" style="font-size: 10.5px">{{ auto.directory || '—' }}</code>
                                    <br />Managed automatically — edit through Claude, not here.
                                </div>
                                <span v-else class="hint">No project selected — auto memory is per-project.</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="card" style="padding: 22px; text-align: center"><span class="hint">Loading…</span></div>
            </div>
        </section>

        <!-- Create preview -->
        <div v-if="previewSlot" class="scrim">
            <div class="modal">
                <div class="modal-h">
                    <span style="color: var(--accent)"><Icon name="file" :size="16" /></span>
                    <h2>Create {{ previewSlot.path }}</h2>
                    <div class="spacer" style="flex: 1"></div>
                    <button class="icon-btn" @click="closePreview"><Icon name="xcircle" :size="16" /></button>
                </div>
                <div class="modal-b">
                    <p class="hint" style="margin-bottom: 8px">A new file will be written with this starter content. You can edit it afterwards in the Raw Editor.</p>
                    <pre class="tpl">{{ previewSlot.template }}</pre>
                </div>
                <div class="modal-f">
                    <span class="hint">Atomic write · {{ previewSlot.realPath }}</span>
                    <div style="flex: 1"></div>
                    <button class="btn" @click="closePreview">Cancel</button>
                    <button class="btn primary" :disabled="busy === previewSlot.scope" @click="create(previewSlot)">Create file</button>
                </div>
            </div>
        </div>
    </main>
</template>

<style scoped>
.slot {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 14px;
    padding: 12px 4px;
    border-bottom: 1px solid var(--border-soft);
}
.slot:last-child {
    border-bottom: 0;
}
.s-ico {
    width: 30px;
    height: 30px;
    border-radius: var(--radius);
    display: grid;
    place-items: center;
    background: var(--surface-3);
    color: var(--fg-dim);
    border: 1px solid var(--border);
}
.s-ico.on {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: color-mix(in oklab, var(--accent) 30%, transparent);
}
.s-top {
    display: flex;
    align-items: center;
    gap: 8px;
}
.s-label {
    font-size: 13px;
    color: var(--fg);
    font-weight: 500;
}
.s-path {
    font: 11px var(--mono);
    color: var(--fg-dim);
    margin-top: 2px;
}
.s-state {
    display: flex;
    align-items: center;
    gap: 10px;
}
.mem-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
}
@media (max-width: 1100px) {
    .mem-grid {
        grid-template-columns: 1fr;
    }
}
.graph {
    font: 12px var(--mono);
}
.gimport {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
}
.gimport .conn {
    color: var(--fg-faint);
}
.gimport .broken {
    text-decoration: line-through;
    color: var(--fg-dim);
}
.tpl {
    font: 11.5px var(--mono);
    color: var(--fg-muted);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    white-space: pre-wrap;
    line-height: 1.55;
    max-height: 320px;
    overflow: auto;
}
</style>
