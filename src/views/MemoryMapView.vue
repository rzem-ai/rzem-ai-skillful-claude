<script setup lang="ts">
import { ref } from 'vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { toast } from '@/composables/useToast';
import type { ScopeId } from '@/lib/scopes';

// ── Fixture: every CLAUDE.md loaded for this project, in load order ──
interface MemFile {
    scope: ScopeId;
    path: string;
    sub: string;
    ord?: number;
    lazy?: boolean;
    committed?: boolean;
    gitignore?: boolean;
}

const FILES: MemFile[] = [
    { ord: 1, scope: 'user', path: '~/.claude/CLAUDE.md', sub: '14 lines · personal memory · loads always' },
    { ord: 2, scope: 'project', path: '~/Projects/config-studio/CLAUDE.md', sub: 'imports 2 files · loads always', committed: true },
    { ord: 3, scope: 'local', path: 'CLAUDE.local.md', sub: 'machine-local notes', gitignore: true },
    { lazy: true, scope: 'project', path: 'engine/CLAUDE.md', sub: 'loads only when Claude reads files under engine/' },
];

// ── Fixture: @import graph rooted at the project CLAUDE.md ──
interface ImportNode {
    id: string;
    path: string;
    depth: number;
    broken: boolean;
}

const IMPORTS: ImportNode[] = [
    { id: 'git-workflow', path: 'docs/git-workflow.md', depth: 1, broken: false },
    { id: 'style-guide', path: 'docs/style-guide.md', depth: 1, broken: true },
];

const MAX_DEPTH = 5;
const MAX_REACHED = 1;

// ── Reactive interaction state ──
const hovered = ref<string | null>(null);
const flagged = ref<string | null>(null);

function highlightBroken(): void {
    const broken = IMPORTS.find((i) => i.broken);
    if (!broken) return;
    flagged.value = broken.id;
    toast('Highlighted the broken import in the graph', 'alert');
}

function clearFlag(): void {
    flagged.value = null;
}
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <h1>Memory Map</h1>
                    <span class="sub">Every CLAUDE.md Claude loads for this project, in load order, plus the import graph.</span>
                </div>
            </div>
            <div class="view-body">
                <div class="banner warn">
                    <span class="b-ico"><Icon name="alert" :size="16" /></span>
                    <div>
                        <b>1 broken import.</b>
                        <code class="mono-v">CLAUDE.md → docs/style-guide.md</code>
                        points to a file that doesn&rsquo;t exist.
                    </div>
                    <span class="b-act" @click="highlightBroken">Locate in graph</span>
                </div>

                <div class="mem-grid">
                    <div class="card">
                        <div class="card-h">
                            <h3>Load order</h3>
                            <span class="hint" style="margin-left: auto">always-loaded files, top to bottom · then lazy subtrees</span>
                        </div>
                        <div>
                            <div v-for="f in FILES" :key="f.path" class="mfile" :class="{ lazy: f.lazy }">
                                <span class="ord">{{ f.lazy ? '∗' : f.ord }}</span>
                                <div>
                                    <div class="mp">
                                        {{ f.path }}
                                        <span v-if="f.lazy" class="tag inert">
                                            <Icon name="info" :size="10" />
                                            lazy
                                        </span>
                                        <span v-if="f.committed" class="tag info">committed</span>
                                        <span v-if="f.gitignore" class="tag gitignore">git</span>
                                    </div>
                                    <div class="msub">{{ f.sub }}</div>
                                </div>
                                <ProvenanceChip :scope="f.scope" />
                            </div>
                        </div>
                    </div>

                    <div class="col" style="gap: 18px">
                        <div class="card">
                            <div class="card-h">
                                <h3>Import graph</h3>
                                <span class="hint" style="margin-left: auto">@import · flag &gt; 5 hops</span>
                            </div>
                            <div class="card-b graph">
                                <div class="gnode">
                                    <span><Icon name="file" :size="13" /></span>
                                    <b>CLAUDE.md</b>
                                    <span class="dim" style="font-family: var(--ui)">project root</span>
                                </div>
                                <div
                                    v-for="imp in IMPORTS"
                                    :key="imp.id"
                                    class="gimport"
                                    :class="{ hovered: hovered === imp.id, flagged: flagged === imp.id }"
                                    @mouseenter="hovered = imp.id"
                                    @mouseleave="hovered = null">
                                    <span class="conn">└─ @</span>
                                    <span :class="{ broken: imp.broken }">{{ imp.path }}</span>
                                    <span v-if="imp.broken" class="tag err" @click="clearFlag">
                                        <Icon name="xcircle" :size="10" />
                                        broken link
                                    </span>
                                    <span v-else class="tag ok">
                                        <Icon name="check" :size="10" />
                                        depth {{ imp.depth }}
                                    </span>
                                </div>
                                <div class="hint" style="margin-top: 8px; line-height: 1.5">
                                    Max import depth reached:
                                    <b class="muted">{{ MAX_REACHED }}</b>
                                    of {{ MAX_DEPTH }}. No cycles detected.
                                </div>
                            </div>
                        </div>

                        <div class="card auto-card">
                            <div class="card-h">
                                <h3>Auto memory</h3>
                                <span class="tag ok" style="margin-left: auto">
                                    <Icon name="check" :size="10" />
                                    enabled
                                </span>
                            </div>
                            <div class="card-b">
                                <div class="ac-row">
                                    <span class="dim">Entries</span>
                                    <span class="mono-v">6</span>
                                </div>
                                <div class="ac-row">
                                    <span class="dim">Directory</span>
                                    <span class="mono-v" style="font-size: 10.5px">~/.claude/projects/-home-alex-…/memory/</span>
                                </div>
                                <div class="ac-row">
                                    <span class="dim">Index</span>
                                    <span class="mono-v">MEMORY.md</span>
                                </div>
                                <div class="mempreview">
                                    # Project Memory
                                    <br />
                                    - [Engine purity](engine.md) — no UI imports in engine/
                                    <br />
                                    - [Release flow](release.md) — tag → notes → publish
                                    <br />
                                    <span class="dim">+ 4 more entries…</span>
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
.mem-grid {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 18px;
    align-items: start;
}
@media (max-width: 1180px) {
    .mem-grid {
        grid-template-columns: 1fr;
    }
}
.mfile {
    display: grid;
    grid-template-columns: 26px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-soft);
}
.mfile:last-child {
    border-bottom: 0;
}
.mfile .ord {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font: 11px var(--mono);
    font-weight: 700;
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);
}
.mfile.lazy .ord {
    background: var(--surface-3);
    color: var(--fg-dim);
    border-color: var(--border);
}
.mfile .mp {
    font: 12px var(--mono);
    color: var(--fg);
}
.mfile .msub {
    font-size: 11px;
    color: var(--fg-dim);
    margin-top: 2px;
}
.graph {
    font: 12px var(--mono);
}
.gnode {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
}
.gnode .gline {
    color: var(--fg-faint);
}
.gimport {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0 5px 22px;
    border-radius: 6px;
}
.gimport .conn {
    color: var(--fg-faint);
}
.gimport.hovered {
    background: var(--surface-1);
}
.gimport.flagged {
    background: var(--warn-bg);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--err) 40%, transparent);
}
.gimport .broken {
    text-decoration: line-through;
    color: var(--fg-dim);
}
.gimport .tag {
    cursor: default;
}
.auto-card .ac-row {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 12px;
}
.auto-card .ac-row:last-child {
    border-bottom: 0;
}
.mempreview {
    font: 11px var(--mono);
    color: var(--fg-muted);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 9px 11px;
    margin-top: 8px;
    line-height: 1.6;
}
</style>
