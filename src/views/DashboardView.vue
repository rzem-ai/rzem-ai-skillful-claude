<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import type { ConfigRow, ScopeId } from '@shared/contract';

// Effective config + resolution chains come live from the engine snapshot.
const config = useConfigStore();
const DATA = computed<ConfigRow[]>(() => config.dashboard);

const SCOPE_FILTERS: ScopeId[] = ['managed', 'local', 'project', 'user'];

// ── Reactive filter + selection state ──
const search = ref('');
const cat = ref('');
const onlyDiffer = ref(false);
const onlyConflict = ref(false);
const activeScopes = reactive<Record<ScopeId, boolean>>({
    managed: true,
    cli: true,
    local: true,
    project: true,
    user: true,
});
const selectedKey = ref<string | null>(null);
const revealed = reactive<Record<string, boolean>>({});

const route = useRoute();
const router = useRouter();

const rows = computed(() =>
    DATA.value.filter((d) => {
        const q = search.value.trim().toLowerCase();
        if (q && !d.key.toLowerCase().includes(q) && !String(d.value).toLowerCase().includes(q)) return false;
        if (cat.value && d.cat !== cat.value) return false;
        if (onlyDiffer.value && !d.differ) return false;
        if (onlyConflict.value && !d.conflict) return false;
        if (d.scope && !activeScopes[d.scope]) return false;
        return true;
    }),
);

const selected = computed(() => DATA.value.find((d) => d.key === selectedKey.value) ?? null);

function vclass(t: string): string {
    return (
        t === 'boolean' ? 'bool'
        : t === 'string' ? 'str'
        : ''
    );
}
function maskedValue(d: ConfigRow): string {
    return d.chain[0]?.value ?? '••••••••••••';
}
function toggleScope(s: ScopeId): void {
    activeScopes[s] = !activeScopes[s];
}
function selectKey(key: string): void {
    selectedKey.value = key;
}
function closeInspector(): void {
    selectedKey.value = null;
}
function whyText(d: ConfigRow): string {
    if (d.locked) return 'Managed scope sits above every other source and cannot be overridden — not even by CLI flags.';
    if (d.inert) return 'No active source supplies this key in a valid location, so it has no effect on the session.';
    if (d.isDefault) return 'No valid source defines this key, so Claude Code uses its built-in default.';
    if (d.chain.length > 1)
        return 'Scope order is Managed › CLI › Local › Project › User. The highest scope that defines this key in a valid location wins; lower scopes are shadowed.';
    return 'Only one source defines this key, so it wins uncontested.';
}
function chainAction(action: string): void {
    if (action.includes('Raw')) router.push('/raw');
    else if (action.includes('user settings') || action.includes('.claude.json')) router.push('/guided/permissions');
    else toast(`“${action}” — opens the guided fix`, 'sliders');
}

onMounted(() => {
    const q = route.query.q;
    if (typeof q === 'string' && q) {
        search.value = q;
        const hit = DATA.value.find((d) => d.key.toLowerCase().includes(q.toLowerCase()));
        if (hit) selectKey(hit.key);
    }
});
</script>

<template>
    <main class="main" :class="{ 'show-inspector': selected }">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <h1>Effective Configuration</h1>
                    <span class="sub">
                        Every key in effect
                        <template v-if="config.project">
                            for
                            <b class="muted">{{ config.project.name }}</b>
                        </template>
                        <template v-else>
                            (no project selected — showing user &amp; managed scopes)
                        </template>
                        — resolved value, type, and where it came from.
                    </span>
                </div>
                <div class="spacer"></div>
                <button class="btn ghost sm" @click="selectKey('permissions.defaultMode')">
                    Resolved keys:
                    <b style="margin-left: 4px">{{ DATA.length }}</b>
                </button>
            </div>

            <div class="view-body">
                <div class="filters">
                    <input v-model="search" class="field" type="text" placeholder="Filter keys…" style="width: 240px" />
                    <div class="scope-filter">
                        <span v-for="s in SCOPE_FILTERS" :key="s" class="sf" :class="{ off: !activeScopes[s] }" @click="toggleScope(s)">
                            <ProvenanceChip :scope="s" />
                        </span>
                    </div>
                    <select v-model="cat" class="field">
                        <option value="">All categories</option>
                        <option value="model">Model &amp; effort</option>
                        <option value="permissions">Permissions</option>
                        <option value="environment">Environment</option>
                        <option value="quality">Quality of life</option>
                        <option value="security">Security / managed</option>
                        <option value="ide">IDE</option>
                    </select>
                    <label class="chk" :class="{ on: onlyDiffer }">
                        <input v-model="onlyDiffer" type="checkbox" />
                        Differs from default
                    </label>
                    <label class="chk" :class="{ on: onlyConflict }">
                        <input v-model="onlyConflict" type="checkbox" />
                        Has conflicts
                    </label>
                    <span class="count-pill">{{ rows.length }} of {{ DATA.length }} keys</span>
                </div>

                <div class="card" style="overflow: hidden">
                    <table class="tbl">
                        <thead>
                            <tr>
                                <th style="width: 30%">Key</th>
                                <th style="width: 26%">Resolved value</th>
                                <th style="width: 84px">Type</th>
                                <th style="width: 130px">Provenance</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!rows.length">
                                <td colspan="5" class="dim" style="padding: 22px 14px; text-align: center; font-size: 12px">
                                    {{ config.loading ? 'Resolving configuration…' : 'No configuration keys in effect for the active scopes.' }}
                                </td>
                            </tr>
                            <tr v-for="d in rows" :key="d.key" :class="{ sel: d.key === selectedKey }" @click="selectKey(d.key)">
                                <td>
                                    <span class="k">{{ d.key }}</span>
                                    <span v-if="d.lint" class="lint-i" :title="d.lint"><Icon name="alert" :size="13" /></span>
                                </td>
                                <td>
                                    <span v-if="d.inert" class="dim mono-v">—</span>
                                    <span v-else-if="d.secret" class="secret">
                                        <span class="v str">{{ revealed[d.key] ? d.value : maskedValue(d) }}</span>
                                        <span class="reveal" title="Reveal value" @click.stop="revealed[d.key] = !revealed[d.key]">
                                            <Icon :name="revealed[d.key] ? 'eye' : 'eyeoff'" :size="13" />
                                        </span>
                                    </span>
                                    <span v-else class="v" :class="vclass(d.type)">{{ d.value }}</span>
                                </td>
                                <td>
                                    <span class="ty">{{ d.type }}</span>
                                </td>
                                <td>
                                    <ProvenanceChip v-if="d.scope && d.chain[0]" :scope="d.scope" :path="d.chain[0].path" :meta="'Last modified ' + d.chain[0].mod" />
                                    <ProvenanceChip v-else-if="d.scope" :scope="d.scope" />
                                    <span v-else class="dim" style="font-size: 11px">none active</span>
                                </td>
                                <td>
                                    <span v-if="d.locked" class="tag lock">
                                        <Icon name="lock" :size="11" />
                                        Managed lock
                                    </span>
                                    <span v-else-if="d.inert" class="shadow-i ignored-i">
                                        <Icon name="alert" :size="12" />
                                        Ignored · wrong file
                                    </span>
                                    <span v-else-if="d.isDefault" class="shadow-i">
                                        <Icon name="info" :size="12" />
                                        Default · source excluded
                                    </span>
                                    <span v-else-if="d.chain.some((c) => c.status === 'ignored')" class="shadow-i ignored-i">
                                        <Icon name="alert" :size="12" />
                                        1 shadowed · 1 ignored
                                    </span>
                                    <span v-else-if="d.chain.some((c) => c.status === 'shadowed')" class="shadow-i">
                                        <Icon name="layers" :size="12" />
                                        Shadows {{ d.chain.length - 1 }}
                                    </span>
                                    <span v-else class="dim" style="font-size: 11px">—</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <aside class="inspector">
            <template v-if="selected">
                <div class="insp-h">
                    <div>
                        <div class="eyebrow">Resolution chain</div>
                        <h2>{{ selected.key }}</h2>
                    </div>
                    <div class="spacer"></div>
                    <button class="icon-btn" title="Close" @click="closeInspector"><Icon name="xcircle" :size="16" /></button>
                </div>
                <div class="insp-b">
                    <div class="insp-sec">
                        <h4>Effective value</h4>
                        <div class="row gap-sm" style="align-items: baseline">
                            <span class="mono-v" style="font-size: 14px; font-weight: 600">{{ selected.inert ? '—' : selected.value }}</span>
                            <span class="ty">{{ selected.type }}</span>
                            <ProvenanceChip v-if="selected.scope" :scope="selected.scope" />
                        </div>
                    </div>

                    <div v-if="selected.locked" class="insp-sec">
                        <div class="locked">
                            <span class="lk-ico"><Icon name="lock" :size="16" /></span>
                            <div>
                                <div class="lk-val">{{ selected.value }}</div>
                                <div class="lk-chan">{{ selected.channel }}</div>
                            </div>
                        </div>
                    </div>
                    <div v-if="selected.lint" class="insp-sec">
                        <div class="effect warn">
                            <Icon name="alert" :size="14" />
                            <span>{{ selected.lint }}</span>
                        </div>
                    </div>

                    <div class="insp-sec">
                        <h4>Precedence ({{ selected.chain.length }} source{{ selected.chain.length > 1 ? 's' : '' }})</h4>
                        <div class="chain">
                            <div
                                v-for="(c, i) in selected.chain"
                                :key="i"
                                class="chain-row"
                                :class="
                                    c.status === 'winner' ? 'winner'
                                    : c.status === 'ignored' ? 'ignored'
                                    : 'shadowed'
                                ">
                                <div class="chain-rail">
                                    <div class="node"></div>
                                    <div class="line"></div>
                                </div>
                                <div class="chain-main">
                                    <div class="cm-top">
                                        <ProvenanceChip :scope="c.scope" />
                                        <span class="cm-val">{{ c.value }}</span>
                                        <span v-if="c.status === 'winner'" class="win-pill">winner</span>
                                        <span v-else-if="c.status === 'ignored'" class="ignored-pill">ignored by rule</span>
                                    </div>
                                    <div class="cm-note dim" style="margin-top: 5px">{{ c.path }} · {{ c.mod }}</div>
                                    <div v-if="c.note" class="cm-note" :class="{ warn: c.status === 'ignored' }">
                                        <Icon v-if="c.status === 'ignored'" name="alert" :size="13" />
                                        <span>{{ c.note }}</span>
                                    </div>
                                    <div v-if="c.action" style="margin-top: 7px">
                                        <button class="btn sm" @click="chainAction(c.action)">
                                            {{ c.action }}
                                            <Icon name="arrow" :size="12" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="insp-sec">
                        <h4>Why this value</h4>
                        <p class="hint" style="line-height: 1.5">{{ whyText(selected) }}</p>
                    </div>
                </div>

                <div v-if="!selected.locked" class="insp-actions">
                    <RouterLink v-if="selected.hero" class="btn primary sm" to="/raw">
                        <Icon name="compare" :size="13" />
                        Open side-by-side
                    </RouterLink>
                    <RouterLink class="btn sm" to="/guided/permissions">
                        <Icon name="sliders" :size="13" />
                        Edit in Guided
                    </RouterLink>
                    <RouterLink class="btn sm" to="/raw">
                        <Icon name="code" :size="13" />
                        Open in Raw
                    </RouterLink>
                </div>
            </template>
        </aside>
    </main>
</template>

<style scoped>
.filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}
.scope-filter {
    display: inline-flex;
    gap: 4px;
    align-items: center;
}
.sf {
    cursor: pointer;
    user-select: none;
}
.sf.off {
    opacity: 0.32;
    filter: grayscale(0.5);
}
.count-pill {
    font: 11px/1 var(--mono);
    color: var(--fg-dim);
    margin-left: auto;
}
td .secret {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
td .reveal {
    color: var(--fg-dim);
    cursor: pointer;
    display: flex;
}
td .reveal:hover {
    color: var(--accent);
}
.lint-i {
    color: var(--warn);
    display: inline-flex;
    vertical-align: -2px;
    margin-left: 6px;
}
.ignored-i {
    color: var(--warn);
}
.insp-actions {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid var(--border);
}
</style>
