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
import type { McpServerInput, ScopeId } from '@shared/contract';

// MCP Servers: add or remove servers. Project servers write to .mcp.json; user
// and local servers write to ~/.claude.json (mcpServers / projects[…]). The
// merged, collision-resolved list comes live from the engine.
const config = useConfigStore();
const mcp = computed(() => config.guidedMcp);
const SERVERS = computed(() => mcp.value?.servers ?? []);

const w = useGuidedWrites({ onDiscard: resync });

type Transport = McpServerInput['transport'];
const scopeSel = ref<ScopeId>('project');
const name = ref('');
const transport = ref<Transport>('stdio');
const command = ref('');
const argsStr = ref('');
const url = ref('');
const envPairs = ref<{ k: string; v: string }[]>([]);
const removed = ref<Set<string>>(new Set());
interface AddedServer {
    name: string;
    scope: ScopeId;
    summary: string;
}
const added = ref<AddedServer[]>([]);

function resync(): void {
    removed.value = new Set();
    added.value = [];
    name.value = '';
    command.value = '';
    argsStr.value = '';
    url.value = '';
    envPairs.value = [];
}
watch(mcp, () => { if (w.count.value === 0) resync(); }, { immediate: true });
watch(() => config.hasProject, (has) => { if (!has) scopeSel.value = 'user'; }, { immediate: true });

const scopeOpts = computed(() => (mcp.value?.scopeTargets ?? []).filter((o) => o.v === 'user' || config.hasProject));

function removeServer(s: { name: string; scope: ScopeId }): void {
    removed.value.add(s.name);
    w.register(`mcp-del:${s.name}`, `Remove server ${s.name} (${SCOPES[s.scope].label})`, { kind: 'removeMcpServer', name: s.name, scope: s.scope });
}
function undoRemove(n: string): void {
    removed.value.delete(n);
    w.unregister(`mcp-del:${n}`);
}

function buildInput(): McpServerInput | null {
    if (transport.value === 'stdio') {
        if (!command.value.trim()) {
            toast('stdio servers need a command', 'alert');
            return null;
        }
        const args = argsStr.value.trim() ? argsStr.value.trim().split(/\s+/) : undefined;
        return { transport: 'stdio', command: command.value.trim(), ...(args ? { args } : {}), ...envObj() };
    }
    if (!url.value.trim()) {
        toast(`${transport.value} servers need a URL`, 'alert');
        return null;
    }
    return { transport: transport.value, url: url.value.trim(), ...envObj() };
}
function envObj(): { env?: Record<string, string> } {
    const env: Record<string, string> = {};
    for (const p of envPairs.value) if (p.k.trim()) env[p.k.trim()] = p.v;
    return Object.keys(env).length ? { env } : {};
}
function summaryOf(input: McpServerInput): string {
    return input.transport === 'stdio' ? [input.command, ...(input.args ?? [])].join(' ') : `${input.transport} · ${input.url}`;
}

function addServer(): void {
    const n = name.value.trim();
    if (!n) {
        toast('Give the server a name', 'alert');
        return;
    }
    if (SERVERS.value.some((s) => s.name === n) || added.value.some((a) => a.name === n)) {
        toast(`A server named “${n}” already exists`, 'alert');
        return;
    }
    const input = buildInput();
    if (!input) return;
    added.value.push({ name: n, scope: scopeSel.value, summary: summaryOf(input) });
    w.register(`mcp-add:${n}`, `Add server ${n} (${SCOPES[scopeSel.value].label})`, { kind: 'addMcpServer', name: n, server: input, scope: scopeSel.value });
    name.value = '';
    command.value = '';
    argsStr.value = '';
    url.value = '';
    envPairs.value = [];
}
function removeAdded(i: number): void {
    const a = added.value[i];
    added.value.splice(i, 1);
    w.unregister(`mcp-add:${a.name}`);
}
function addEnvPair(): void {
    envPairs.value.push({ k: '', v: '' });
}
function dropEnvPair(i: number): void {
    envPairs.value.splice(i, 1);
}
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <span class="crumb">Guided Config &nbsp;›&nbsp; <b>MCP Servers</b></span>
                    <h1 style="margin-top: 2px">MCP Servers</h1>
                </div>
                <div class="spacer"></div>
                <RouterLink class="btn ghost sm" to="/mcp">View server map</RouterLink>
            </div>

            <div class="view-body">
                <div v-if="mcp" class="guided">
                    <div class="card mb">
                        <div class="card-h">
                            <h3>Configured servers</h3>
                            <span class="hint" style="margin-left: auto">{{ SERVERS.length }} across scopes · collisions resolve Local › Project › User</span>
                        </div>
                        <div class="card-b">
                            <div v-if="!SERVERS.length && !added.length" class="hint" style="padding: 8px 0">
                                {{ config.hasProject ? 'No MCP servers configured.' : 'No project selected — only user-scope servers resolve.' }}
                            </div>
                            <div v-for="s in SERVERS" :key="s.name" class="srv-row" :class="{ removed: removed.has(s.name) }">
                                <span class="sname"><Icon name="db" :size="13" /> {{ s.name }}</span>
                                <span class="transport">{{ s.transport }}</span>
                                <span class="starget">{{ s.target }}</span>
                                <ProvenanceChip :scope="s.scope" />
                                <button v-if="removed.has(s.name)" class="btn ghost sm" @click="undoRemove(s.name)">Undo</button>
                                <span v-else class="del" title="Remove" @click="removeServer(s)"><Icon name="trash" :size="14" /></span>
                            </div>
                            <div v-for="(a, i) in added" :key="'add' + a.name" class="srv-row added">
                                <span class="sname"><Icon name="db" :size="13" /> {{ a.name }}</span>
                                <span class="starget" style="grid-column: 2 / 4">{{ a.summary }}</span>
                                <ProvenanceChip :scope="a.scope" />
                                <span class="del" title="Drop" @click="removeAdded(i)"><Icon name="xcircle" :size="14" /></span>
                            </div>
                        </div>
                    </div>

                    <div class="card mb">
                        <div class="card-h"><h3>Add a server</h3></div>
                        <div class="card-b">
                            <label class="lbl">Name</label>
                            <input v-model="name" class="field field-mono" placeholder="github" style="max-width: 280px" />

                            <label class="lbl" style="margin-top: 14px">Transport</label>
                            <div class="seg">
                                <button v-for="t in mcp.transports" :key="t" class="seg-b" :class="{ on: t === transport }" @click="transport = t">{{ t }}</button>
                            </div>

                            <template v-if="transport === 'stdio'">
                                <label class="lbl" style="margin-top: 14px">Command</label>
                                <input v-model="command" class="field field-mono" placeholder="npx" style="max-width: 360px" />
                                <label class="lbl" style="margin-top: 10px">Arguments</label>
                                <input v-model="argsStr" class="field field-mono" placeholder="-y @modelcontextprotocol/server-github" />
                            </template>
                            <template v-else>
                                <label class="lbl" style="margin-top: 14px">URL</label>
                                <input v-model="url" class="field field-mono" placeholder="https://mcp.example.com/sse" />
                            </template>

                            <label class="lbl" style="margin-top: 14px">Environment (optional)</label>
                            <div v-for="(p, i) in envPairs" :key="i" class="envpair">
                                <input v-model="p.k" class="field field-mono" placeholder="API_TOKEN" />
                                <input v-model="p.v" class="field field-mono" placeholder="${GITHUB_TOKEN}" />
                                <span class="del" @click="dropEnvPair(i)"><Icon name="xcircle" :size="14" /></span>
                            </div>
                            <button class="btn ghost sm" style="margin-top: 8px" @click="addEnvPair"><Icon name="plus" :size="12" /> Add variable</button>

                            <div style="margin-top: 16px">
                                <label class="lbl">Scope</label>
                                <div class="scope-sel">
                                    <button v-for="o in scopeOpts" :key="o.v" class="opt" :class="{ on: o.v === scopeSel }" @click="scopeSel = o.v">
                                        <div class="ttl"><ProvenanceChip :scope="o.v" /> {{ o.t }}</div>
                                        <div class="desc">{{ o.d }}</div>
                                    </button>
                                </div>
                            </div>

                            <button class="btn primary" style="margin-top: 16px" @click="addServer"><Icon name="plus" :size="13" /> Add server</button>
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
.srv-row {
    display: grid;
    grid-template-columns: minmax(120px, 200px) 64px 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 9px 4px;
    border-bottom: 1px solid var(--border-soft);
}
.srv-row:last-child {
    border-bottom: 0;
}
.srv-row.removed {
    opacity: 0.5;
}
.srv-row.removed .sname,
.srv-row.removed .starget {
    text-decoration: line-through;
}
.srv-row.added .sname {
    color: var(--ok);
}
.srv-row .sname {
    font: 12.5px var(--mono);
    font-weight: 600;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 7px;
}
.srv-row .transport {
    font: 10.5px var(--mono);
    color: var(--fg-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.srv-row .starget {
    font: 11.5px var(--mono);
    color: var(--fg-muted);
    word-break: break-all;
}
.srv-row .del {
    color: var(--fg-faint);
    cursor: pointer;
    display: flex;
}
.srv-row .del:hover {
    color: var(--err);
}
.seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
}
.seg-b {
    padding: 6px 16px;
    background: var(--surface-1);
    border: 0;
    border-right: 1px solid var(--border);
    color: var(--fg-muted);
    cursor: pointer;
    font: 11.5px var(--mono);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.seg-b:last-child {
    border-right: 0;
}
.seg-b.on {
    background: var(--accent-soft);
    color: var(--accent);
}
.envpair {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
}
.envpair .del {
    color: var(--fg-faint);
    cursor: pointer;
    display: flex;
}
.envpair .del:hover {
    color: var(--err);
}
</style>
