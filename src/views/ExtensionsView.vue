<script setup lang="ts">
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import type { ScopeId } from '@/lib/scopes';

// ── Fixture: extensions discovered across scopes ──
interface ExtItem {
    name: string;
    scope: ScopeId;
    icon: string;
    desc: string;
    meta: string;
    file: string;
    disabled?: boolean;
    override?: boolean;
}
interface ExtSection {
    title: string;
    icon: string;
    items: ExtItem[];
}

const SECTIONS: ExtSection[] = [
    {
        title: 'Subagents',
        icon: 'user',
        items: [
            {
                name: 'code-reviewer',
                scope: 'user',
                icon: 'user',
                desc: 'Reviews diffs for correctness and reuse.',
                meta: 'tools: Read · Grep',
                file: '~/.claude/agents/code-reviewer.md',
            },
        ],
    },
    {
        title: 'Skills',
        icon: 'puzzle',
        items: [
            {
                name: 'release-notes',
                scope: 'project',
                icon: 'puzzle',
                desc: 'Generates release notes from merged PRs.',
                meta: 'SKILL.md · committed',
                file: '.claude/skills/release-notes/',
            },
        ],
    },
    {
        title: 'Slash commands',
        icon: 'terminal',
        items: [
            {
                name: '/changelog',
                scope: 'project',
                icon: 'terminal',
                desc: 'Appends a changelog entry from the current diff.',
                meta: 'committed',
                file: '.claude/commands/changelog.md',
            },
        ],
    },
    {
        title: 'Output styles',
        icon: 'sliders',
        items: [
            {
                name: 'Explanatory',
                scope: 'local',
                icon: 'sliders',
                desc: 'Verbose, teaching-oriented responses.',
                meta: 'active · set in local settings',
                file: '.claude/settings.local.json',
            },
        ],
    },
    {
        title: 'Plugins & marketplaces',
        icon: 'grid',
        items: [
            {
                name: 'formatter@team-tools',
                scope: 'project',
                icon: 'grid',
                desc: 'Auto-formats on save. Enabled by the team, but turned OFF on this machine.',
                meta: 'overridden locally',
                file: 'team-tools · github:rzem/claude-plugins',
                disabled: true,
                override: true,
            },
        ],
    },
];
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <h1>Extensions</h1>
                    <span class="sub">Subagents, skills, commands, output styles, and plugins discovered across scopes.</span>
                </div>
            </div>

            <div class="view-body">
                <div v-for="s in SECTIONS" :key="s.title" class="ext-sec">
                    <h3 class="sec-title">
                        <Icon :name="s.icon" :size="15" />
                        {{ s.title }}
                        <span class="hint" style="margin-left: auto; font-weight: 400">{{ s.items.length }}</span>
                    </h3>
                    <div class="ext-grid">
                        <div v-for="it in s.items" :key="it.name" class="card ext" :class="{ disabled: it.disabled }">
                            <div class="eh">
                                <span class="ei"><Icon :name="it.icon" :size="16" /></span>
                                <div>
                                    <div class="en">{{ it.name }}</div>
                                </div>
                                <ProvenanceChip :scope="it.scope" />
                            </div>
                            <div class="ed">{{ it.desc }}</div>
                            <div class="em">
                                <template v-if="it.override">
                                    <span class="tag warn">
                                        <Icon name="alert" :size="10" />
                                        disabled locally
                                    </span>
                                    <span class="tag info">enabled by project</span>
                                </template>
                                <template v-else>
                                    <span class="tag ok">
                                        <Icon name="check" :size="10" />
                                        active
                                    </span>
                                </template>
                                <span class="hint" style="font-family: var(--mono); font-size: 10px">{{ it.file }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card" style="padding: 13px 15px">
                    <div class="row" style="gap: 10px">
                        <span style="color: var(--fg-dim)"><Icon name="info" :size="15" /></span>
                        <div class="hint" style="line-height: 1.55">
                            Skill-listing budget simulation: at the current
                            <code class="mono-v">skillListingBudgetFraction</code>
                            , all 1 skill description fits — none would truncate. Increase skills to preview truncation.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<style scoped>
.ext-sec {
    margin-bottom: 22px;
}
.ext-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
}
.ext {
    padding: 13px 14px;
}
.ext .eh {
    display: flex;
    align-items: center;
    gap: 9px;
}
.ext .eh .ei {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--surface-3);
    color: var(--fg-muted);
    flex: none;
}
.ext .en {
    font: 13px var(--mono);
    font-weight: 600;
    color: var(--fg);
}
.ext .ed {
    font-size: 11.5px;
    color: var(--fg-dim);
    margin-top: 8px;
    line-height: 1.5;
}
.ext .em {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    flex-wrap: wrap;
}
.ext.disabled {
    opacity: 0.62;
}
</style>
