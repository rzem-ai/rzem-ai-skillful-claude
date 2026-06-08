<script setup lang="ts">
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import type { ScopeId } from '@/lib/scopes';

// ── Fixture: the five configuration layers in precedence order ──
type FileHealth = 'ok' | 'warn' | 'err' | 'miss';

interface LayerFile {
    path: string;
    health: FileHealth;
    note?: string;
    gitignore?: boolean;
    committed?: boolean;
}

interface Layer {
    scope: ScopeId;
    win: boolean;
    keys: number;
    mod: string;
    delivery?: string;
    empty?: boolean;
    gitignore?: boolean;
    committed?: boolean;
    health: { cls: FileHealth; label: string };
    files: LayerFile[];
}

const LAYERS: Layer[] = [
    {
        scope: 'managed',
        win: true,
        keys: 4,
        mod: 'May 12',
        delivery: 'Enforced via file',
        health: { cls: 'warn', label: '1 of 2 files invalid' },
        files: [
            { path: '/etc/claude-code/managed-settings.json', health: 'ok', note: 'Base policy — deny rules, login method, sandbox network' },
            { path: '/etc/claude-code/managed-settings.d/20-experimental.json', health: 'err', note: 'Invalid JSON — trailing comma at line 4. Excluded from resolution.' },
        ],
    },
    {
        scope: 'cli',
        win: false,
        keys: 0,
        mod: '—',
        empty: true,
        health: { cls: 'miss', label: 'No flags this session' },
        files: [{ path: '--model · --permission-mode · --settings', health: 'miss', note: 'Session-only overrides. None passed when this project was opened.' }],
    },
    {
        scope: 'local',
        win: false,
        keys: 3,
        mod: 'Jun 6',
        gitignore: true,
        health: { cls: 'ok', label: 'Valid · 1 ignored key' },
        files: [{ path: '.claude/settings.local.json', health: 'ok', gitignore: true, note: 'defaultMode: "auto" is ignored by rule (auto is user-scope only).' }],
    },
    {
        scope: 'project',
        win: false,
        keys: 5,
        mod: 'Jun 5',
        committed: true,
        health: { cls: 'warn', label: 'Valid · 1 unreachable rule' },
        files: [{ path: '.claude/settings.json', health: 'warn', committed: true, note: 'allow Bash(curl localhost*) can never beat the managed curl deny.' }],
    },
    {
        scope: 'user',
        win: false,
        keys: 8,
        mod: 'Jun 2',
        health: { cls: 'warn', label: 'Valid · 1 wrong-file key, 1 secret' },
        files: [{ path: '~/.claude/settings.json', health: 'warn', note: 'autoConnectIde belongs in ~/.claude.json · NPM_TOKEN masked.' }],
    },
];

const HEALTH_LABEL: Record<FileHealth, string> = {
    ok: 'Valid',
    warn: 'Warnings',
    err: 'Invalid JSON',
    miss: 'Not present',
};
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <h1>Scope Stack</h1>
                    <span class="sub">The five configuration layers in real precedence order. Higher layers win.</span>
                </div>
            </div>
            <div class="view-body">
                <div class="stack">
                    <div class="prec-note">
                        <span>Precedence</span>
                        <span class="arrow">→</span>
                        <span class="mono-v">Managed</span>
                        <span class="arrow">›</span>
                        <span class="mono-v">CLI args</span>
                        <span class="arrow">›</span>
                        <span class="mono-v">Local</span>
                        <span class="arrow">›</span>
                        <span class="mono-v">Project</span>
                        <span class="arrow">›</span>
                        <span class="mono-v">User</span>
                        <span style="margin-left: auto" class="hint">Scalars override · arrays merge + dedupe</span>
                    </div>
                    <div>
                        <div v-for="(l, i) in LAYERS" :key="l.scope" class="layer">
                            <div class="rail">
                                <div class="num">{{ i + 1 }}</div>
                                <div class="conn"></div>
                            </div>
                            <div class="card lcard">
                                <div class="card-h">
                                    <div class="lh-left">
                                        <ProvenanceChip :scope="l.scope" :solid="true" />
                                        <span v-if="l.win" class="winner-flag">cannot be overridden</span>
                                    </div>
                                    <span class="health" :class="l.health.cls">
                                        <span class="dot"></span>
                                        {{ l.health.label }}
                                    </span>
                                </div>

                                <div class="lmeta">
                                    <div class="m">
                                        <span class="ml">Keys defined</span>
                                        <span class="mv">{{ l.empty ? '—' : l.keys }}</span>
                                    </div>
                                    <div class="m">
                                        <span class="ml">Last modified</span>
                                        <span class="mv">{{ l.mod }}</span>
                                    </div>
                                    <div v-if="l.delivery" class="m">
                                        <span class="ml">Delivery channel</span>
                                        <span class="mv">
                                            <span class="channel">
                                                <Icon name="lock" :size="11" />
                                                {{ l.delivery }}
                                            </span>
                                        </span>
                                    </div>
                                    <div class="m" style="margin-left: auto; align-items: flex-end">
                                        <span class="ml">Status</span>
                                        <span class="mv">
                                            <span class="health" :class="l.health.cls">
                                                <span class="dot"></span>
                                                {{ l.health.label }}
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                <div class="files">
                                    <div v-for="(f, fi) in l.files" :key="fi" class="frow">
                                        <div>
                                            <div class="fpath">
                                                <span class="fico"><Icon :name="l.empty ? 'terminal' : 'file'" :size="13" /></span>
                                                {{ f.path }}
                                                <span v-if="f.gitignore" class="tag gitignore">gitignored</span>
                                                <span v-if="f.committed" class="tag info">committed</span>
                                                <span v-if="l.scope === 'managed'" class="tag lock">
                                                    <Icon name="lock" :size="10" />
                                                    read-only
                                                </span>
                                            </div>
                                            <div v-if="f.note" class="fnote">{{ f.note }}</div>
                                        </div>
                                        <span class="health" :class="f.health">
                                            <span class="dot"></span>
                                            {{ HEALTH_LABEL[f.health] }}
                                        </span>
                                        <template v-if="l.scope === 'managed'">
                                            <span class="openraw" style="opacity: 0.5; cursor: default" title="Managed files are read-only">
                                                <Icon name="eye" :size="12" />
                                                view
                                            </span>
                                        </template>
                                        <template v-else-if="l.empty">
                                            <span></span>
                                        </template>
                                        <RouterLink v-else class="openraw" to="/raw">
                                            <Icon name="code" :size="12" />
                                            open raw
                                        </RouterLink>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<style scoped>
.stack {
    max-width: 940px;
}
.prec-note {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    color: var(--fg-dim);
    font-size: 12px;
}
.prec-note .arrow {
    color: var(--fg-faint);
}
.layer {
    display: grid;
    grid-template-columns: 26px 1fr;
    gap: 14px;
}
.layer + .layer {
    margin-top: 2px;
}
.rail {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.rail .num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font: 11px var(--mono);
    font-weight: 700;
    color: var(--fg-dim);
    background: var(--surface-3);
    border: 1px solid var(--border);
}
.rail .conn {
    flex: 1;
    width: 2px;
    background: var(--border);
    margin: 3px 0;
}
.layer:last-child .rail .conn {
    display: none;
}
.lcard {
    margin-bottom: 2px;
}
.lcard .card-h {
    justify-content: space-between;
}
.lcard .lh-left {
    display: flex;
    align-items: center;
    gap: 10px;
}
.lcard .winner-flag {
    font-size: 10px;
    color: var(--scope-managed);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.lmeta {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    padding: 11px 14px;
    border-bottom: 1px solid var(--border-soft);
}
.lmeta .m {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.lmeta .m .ml {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-dim);
}
.lmeta .m .mv {
    font: 12px var(--mono);
    color: var(--fg);
}
.files {
    padding: 6px 0;
}
.frow {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
}
.frow + .frow {
    border-top: 1px solid var(--border-soft);
}
.frow .fpath {
    font: 12px var(--mono);
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 8px;
}
.frow .fpath .fico {
    color: var(--fg-dim);
    display: flex;
}
.frow .fnote {
    font-size: 11px;
    color: var(--fg-dim);
    margin-top: 2px;
}
.openraw {
    color: var(--accent);
    font-size: 11px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    text-decoration: none;
}
.openraw:hover {
    text-decoration: underline;
}
.channel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--scope-managed);
    background: color-mix(in oklab, var(--scope-managed) 11%, transparent);
    padding: 3px 9px;
    border-radius: 5px;
}
</style>
