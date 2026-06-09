<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { useConfigStore } from '@/stores/config';
import type { ExtSection } from '@shared/contract';

// Extensions discovered across scopes come live from the engine.
const config = useConfigStore();
const SECTIONS = computed<ExtSection[]>(() => config.extensions?.sections ?? []);
const skillBudgetNote = computed(() => config.extensions?.skillBudgetNote ?? '');
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
                            Skill-listing budget simulation: {{ skillBudgetNote }} Increase skills to preview truncation.
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
