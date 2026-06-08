<script setup lang="ts">
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { useTheme } from '@/composables/useTheme';
import type { IconName } from '@/lib/icons';
import type { ScopeId } from '@/lib/scopes';

// Launcher / overview — sits outside the app shell. Mirrors the prototype's
// index.html: hero demo flow, scope legend, and a card grid that links into
// every screen.
const { theme, toggle: toggleTheme } = useTheme();

interface FootBadge {
    kind: 'ok' | 'warn' | 'hint';
    text: string;
}
interface LaunchCard {
    to: string;
    icon: IconName;
    title: string;
    desc: string;
    foot: FootBadge;
}

const ok = (text: string): FootBadge => ({ kind: 'ok', text });
const warn = (text: string): FootBadge => ({ kind: 'warn', text });

const legend: { scope: ScopeId; note: string }[] = [
    { scope: 'managed', note: 'IT policy, unbeatable' },
    { scope: 'cli', note: 'session flags' },
    { scope: 'local', note: 'this machine' },
    { scope: 'project', note: 'committed, team' },
    { scope: 'user', note: 'personal' },
];

const visualise: LaunchCard[] = [
    { to: '/dashboard', icon: 'grid', title: 'Effective Config', desc: 'Searchable table of every resolved key with provenance and shadow indicators.', foot: ok('12 keys') },
    { to: '/scope-stack', icon: 'layers', title: 'Scope Stack', desc: 'The five layers in precedence order, each with a health badge.', foot: warn('1 invalid file') },
    { to: '/permissions', icon: 'lock', title: 'Permissions', desc: 'Merged rules deny→ask→allow, plus a live rule tester.', foot: warn('1 unreachable') },
    { to: '/mcp', icon: 'db', title: 'MCP Servers', desc: 'Servers across scopes; collisions and unresolved variables.', foot: warn('1 unresolved var') },
    { to: '/memory', icon: 'file', title: 'Memory', desc: 'CLAUDE.md load order, lazy subtrees, and the @import graph.', foot: warn('1 broken import') },
    { to: '/extensions', icon: 'puzzle', title: 'Extensions', desc: 'Subagents, skills, commands, output styles, and plugins.', foot: ok('4 active') },
];

const guided: LaunchCard[] = [
    { to: '/guided/permissions', icon: 'lock', title: 'Permissions builder', desc: 'Rule builder, scope selector, and the two-stack diff preview.', foot: ok('template category') },
    {
        to: '/guided/permissions',
        icon: 'sliders',
        title: 'Model · Env · MCP · Memory',
        desc: 'Remaining categories follow the same guided pattern.',
        foot: { kind: 'hint', text: 'clones of the template' },
    },
];

const raw: LaunchCard[] = [
    { to: '/raw', icon: 'code', title: 'Files & Editor', desc: 'Scope-grouped tree, lint gutter, and side-by-side resolution.', foot: warn('lint warnings') },
    { to: '/raw', icon: 'compare', title: 'Side-by-side', desc: 'Same key across two files — the fastest debug path.', foot: ok('hero step 3') },
];

const sections: { id: string; head: string; icon: IconName; cards: LaunchCard[] }[] = [
    { id: 'vis', head: 'Visualise', icon: 'layers', cards: visualise },
    { id: 'guide', head: 'Guided Config', icon: 'sliders', cards: guided },
    { id: 'raw', head: 'Raw Editor', icon: 'code', cards: raw },
];
</script>

<template>
    <div class="launch-scroll">
        <div class="launch">
            <div class="lhead">
                <div class="logo"><Icon name="layers" :size="24" /></div>
                <div>
                    <h1>Skillful Claude</h1>
                    <div class="tag">What configuration is actually in effect, and why — for Claude Code power users.</div>
                </div>
                <div class="ver">
                    <span class="tag info">
                        <Icon name="repo" :size="11" />
                        config-studio
                    </span>
                    <button class="icon-btn" title="Toggle theme" @click="toggleTheme">
                        <Icon :name="theme === 'light' ? 'sun' : 'moon'" :size="16" />
                    </button>
                </div>
            </div>

            <RouterLink class="hero" :to="{ path: '/dashboard', query: { q: 'defaultMode' } }">
                <div class="eb">Start here · the demo flow</div>
                <h2>“Why won’t this setting die?”</h2>
                <p>
                    Trace
                    <code class="mono-v">defaultMode</code>
                    from the dashboard, through its resolution chain, into a side-by-side of the files that fight over it — then delete the winner and watch the effective value
                    change. The whole reason this app exists, end to end.
                </p>
                <div class="steps">
                    <span class="step">
                        <b>1</b>
                        Search defaultMode
                    </span>
                    <span class="arr">→</span>
                    <span class="step">
                        <b>2</b>
                        Resolution chain
                    </span>
                    <span class="arr">→</span>
                    <span class="step">
                        <b>3</b>
                        Side-by-side files
                    </span>
                    <span class="arr">→</span>
                    <span class="step">
                        <b>4</b>
                        Delete &amp; preview diff
                    </span>
                </div>
                <span class="btn primary" style="pointer-events: none">
                    Open the flow
                    <Icon name="arrow" :size="14" />
                </span>
            </RouterLink>

            <div class="legend">
                <span v-for="l in legend" :key="l.scope" class="li">
                    <ProvenanceChip :scope="l.scope" />
                    {{ l.note }}
                </span>
            </div>

            <template v-for="s in sections" :key="s.id">
                <div class="sec-h">
                    <Icon :name="s.icon" :size="14" />
                    {{ s.head }}
                </div>
                <div class="cards">
                    <RouterLink v-for="c in s.cards" :key="c.title" class="scard" :to="c.to">
                        <div class="sc-top">
                            <span class="sc-ic"><Icon :name="c.icon" :size="16" /></span>
                            <h3>{{ c.title }}</h3>
                        </div>
                        <p>{{ c.desc }}</p>
                        <div class="sc-foot">
                            <span v-if="c.foot.kind === 'hint'" class="hint">{{ c.foot.text }}</span>
                            <span v-else class="health" :class="c.foot.kind">
                                <span class="dot"></span>
                                {{ c.foot.text }}
                            </span>
                        </div>
                    </RouterLink>
                </div>
            </template>

            <div class="lfoot">
                <span>
                    <b>States covered:</b>
                    loaded · empty · invalid JSON · managed lock · conflict
                </span>
                <span>
                    <b>Fixture:</b>
                    config-studio — every edge case appears once
                </span>
                <span>
                    <b>Platform:</b>
                    macOS-first desktop, portable to Win/Linux
                </span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.launch-scroll {
    height: 100vh;
    overflow-y: auto;
}
.launch {
    min-height: 100vh;
    max-width: 1080px;
    margin: 0 auto;
    padding: 56px 32px 64px;
}
.lhead {
    display: flex;
    align-items: flex-start;
    gap: 16px;
}
.logo {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    display: grid;
    place-items: center;
    color: var(--accent);
    flex: none;
}
.lhead h1 {
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -0.02em;
    margin: 0;
}
.lhead .tag {
    color: var(--fg-muted);
    font-size: 14px;
    margin-top: 4px;
}
.lhead .ver {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
}
.hero {
    display: block;
    text-decoration: none;
    color: inherit;
    margin: 30px 0 8px;
    padding: 22px 24px;
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg, var(--surface-2), var(--surface-1));
    border: 1px solid var(--border);
}
.hero .eb {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    font-weight: 650;
}
.hero h2 {
    font-size: 18px;
    margin: 6px 0 6px;
    font-weight: 600;
}
.hero p {
    color: var(--fg-muted);
    font-size: 13px;
    max-width: 640px;
    margin: 0 0 16px;
    line-height: 1.6;
}
.hero .steps {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 18px;
}
.hero .step {
    font: 11px var(--mono);
    color: var(--fg-dim);
    display: flex;
    align-items: center;
    gap: 7px;
}
.hero .step b {
    color: var(--fg);
    font-weight: 600;
}
.hero .step .arr {
    color: var(--fg-faint);
}
.legend {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 22px 0 6px;
}
.legend .li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--fg-dim);
}
.sec-h {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--fg-dim);
    font-weight: 650;
    margin: 30px 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
    gap: 12px;
}
.scard {
    display: block;
    text-decoration: none;
    color: inherit;
    padding: 15px 16px;
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    border: 1px solid var(--border);
    transition:
        border-color 0.12s,
        transform 0.12s;
}
.scard:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
}
.scard .sc-top {
    display: flex;
    align-items: center;
    gap: 9px;
}
.scard .sc-ic {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--surface-3);
    display: grid;
    place-items: center;
    color: var(--accent);
    flex: none;
}
.scard h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
}
.scard p {
    font-size: 12px;
    color: var(--fg-dim);
    margin: 9px 0 0;
    line-height: 1.5;
}
.scard .sc-foot {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 11px;
}
.lfoot {
    margin-top: 34px;
    padding-top: 18px;
    border-top: 1px solid var(--border-soft);
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    font-size: 11.5px;
    color: var(--fg-dim);
}
.lfoot b {
    color: var(--fg-muted);
}
</style>
