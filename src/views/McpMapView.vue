<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import type { Server } from '@shared/contract';

// MCP servers across scopes come live from the engine; collisions resolve
// Local › Project › User with the loser rendered as a ghosted shadow card.
const config = useConfigStore();
const SERVERS = computed<Server[]>(() => config.mcp);
const connectedCount = computed(() => SERVERS.value.filter((s) => s.status.cls === 'ok').length);
const warnCount = computed(() => SERVERS.value.filter((s) => s.status.cls === 'warn').length);

const router = useRouter();

function testConnection(s: Server): void {
    const unresolved = s.env.find((e) => !e.resolved);
    if (unresolved) {
        toast(`${s.name}: cannot connect — \${${unresolved.name}} is unset`, 'alert');
    } else {
        toast(`${s.name}: connection OK`, 'check');
    }
}

function openSource(): void {
    router.push('/raw');
}
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <h1>MCP Server Map</h1>
                    <span class="sub">All servers across scopes. Name collisions resolve Local › Project › User.</span>
                </div>
                <div class="spacer"></div>
                <span class="hint">
                    {{ SERVERS.length }} server{{ SERVERS.length === 1 ? '' : 's' }} ·
                    <span style="color: var(--ok)">{{ connectedCount }} connected</span>
                    <template v-if="warnCount">
                        ·
                        <span style="color: var(--warn)">{{ warnCount }} need{{ warnCount === 1 ? 's' : '' }} a variable</span>
                    </template>
                </span>
            </div>
            <div class="view-body">
                <div v-if="!SERVERS.length" class="card" style="padding: 22px; text-align: center">
                    <span class="hint">{{ config.hasProject ? 'No MCP servers configured across user, project, or local scopes.' : 'No project selected — only user-scope servers resolve.' }}</span>
                </div>
                <div class="mcp-grid">
                    <div v-for="s in SERVERS" :key="s.name" class="card srv" :class="{ stacked: s.shadow }">
                        <div class="card-h">
                            <span class="sname">
                                <Icon name="db" :size="14" />
                                {{ s.name }}
                            </span>
                            <span class="health" :class="s.status.cls">
                                <span class="dot"></span>
                                {{ s.status.label }}
                            </span>
                        </div>
                        <div class="card-b" style="padding-bottom: 6px">
                            <div class="srow">
                                <span class="sk">Transport</span>
                                <span class="sv">
                                    <span class="transport">{{ s.transport }}</span>
                                </span>
                            </div>
                            <div class="srow">
                                <span class="sk">Target</span>
                                <span class="sv">{{ s.target }}</span>
                            </div>
                            <div class="srow">
                                <span class="sk">Source</span>
                                <span class="sv">
                                    <ProvenanceChip :scope="s.scope" />
                                    &nbsp;{{ s.file }}
                                </span>
                            </div>
                            <div class="srow">
                                <span class="sk">Variables</span>
                                <span class="sv">
                                    <template v-if="s.env.length">
                                        <div v-for="e in s.env" :key="e.name" class="envrow">
                                            <Icon :name="e.resolved ? 'check' : 'alert'" :size="12" />
                                            <span class="vname">${{ '{' }}{{ e.name }}{{ '}' }}</span>
                                            <span class="tag" :class="e.resolved ? 'ok' : 'warn'">{{ e.resolved ? 'resolved' : 'unresolved' }}</span>
                                            <span class="dim" style="font-family: var(--ui)">{{ e.note }}</span>
                                        </div>
                                    </template>
                                    <span v-else class="dim" style="font-size: 11px">No variables</span>
                                </span>
                            </div>
                        </div>

                        <div v-if="s.collision" class="collide-note">
                            <Icon name="layers" :size="13" />
                            {{ s.collision }}
                        </div>

                        <div v-if="s.shadow" class="shadowed-def">
                            <div class="sd-h">
                                <ProvenanceChip :scope="s.shadow.scope" ghosted />
                                shadowed definition
                            </div>
                            <div class="srow" style="border: 0; padding: 0">
                                <span class="sk">target</span>
                                <span class="sv" style="text-decoration: line-through; color: var(--fg-dim)">{{ s.shadow.target }}</span>
                            </div>
                            <div class="hint" style="margin-top: 3px">{{ s.shadow.file }} — {{ s.shadow.note }}</div>
                        </div>

                        <div style="padding: 9px 14px; border-top: 1px solid var(--border-soft); display: flex; gap: 8px">
                            <button class="btn sm" @click="testConnection(s)">
                                <Icon name="play" :size="12" />
                                Test connection
                            </button>
                            <button class="btn ghost sm" @click="openSource">
                                <Icon name="code" :size="12" />
                                Open source
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<style scoped>
.mcp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 16px;
    align-items: start;
}
.srv {
    position: relative;
}
.srv.stacked::before,
.srv.stacked::after {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    height: 10px;
    bottom: -5px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    z-index: -1;
}
.srv.stacked::after {
    bottom: -9px;
    left: 11px;
    right: 11px;
    opacity: 0.6;
}
.srv .card-h {
    justify-content: space-between;
}
.srv .sname {
    font: 13px var(--mono);
    font-weight: 600;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 8px;
}
.srv .transport {
    font: 10.5px var(--mono);
    color: var(--fg-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.srow {
    display: grid;
    grid-template-columns: 78px 1fr;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 12px;
    align-items: start;
}
.srow:last-child {
    border-bottom: 0;
}
.srow .sk {
    color: var(--fg-dim);
}
.srow .sv {
    font: 11.5px var(--mono);
    color: var(--fg);
    word-break: break-all;
}
.envrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 11.5px var(--mono);
    padding: 3px 0;
}
.envrow .vname {
    color: #c9a0ff;
}
.shadowed-def {
    margin: 10px 14px 0;
    padding: 9px 11px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-1);
    opacity: 0.72;
}
.shadowed-def .sd-h {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--fg-dim);
    margin-bottom: 5px;
}
.collide-note {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: var(--info);
    padding: 8px 14px;
    background: var(--info-bg);
}
</style>
