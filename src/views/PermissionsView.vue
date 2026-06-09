<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import ProvenanceChip from '@/components/ProvenanceChip.vue';
import { useConfigStore } from '@/stores/config';
import { SCOPES } from '@/lib/scopes';
import type { Behaviour, PermRule as Rule } from '@shared/contract';

// Merged rules, sandbox, and effective default mode come live from the engine.
const config = useConfigStore();
const RULES = computed<Rule[]>(() => config.permissions?.rules ?? []);
const sandbox = computed(() => config.permissions?.sandbox ?? []);
const fallMode = computed(() => config.permissions?.defaultMode ?? 'default');
const unreachableCount = computed(() => config.permissions?.unreachableCount ?? 0);

const GROUPS: { beh: Behaviour; label: string }[] = [
    { beh: 'deny', label: 'Deny — checked first' },
    { beh: 'ask', label: 'Ask' },
    { beh: 'allow', label: 'Allow' },
];

const EXAMPLES = ['Bash(curl localhost:3000/health)', 'Bash(git push origin main)', 'Bash(npm run test)', 'Read(./src/main.ts)'];

function rulesFor(beh: Behaviour): Rule[] {
    return RULES.value.filter((r) => r.beh === beh);
}

// ── Glob matcher (ports toRe / parseInput / evaluate) ──
interface Compiled {
    tool: string;
    re: RegExp;
}

function toRe(spec: string): Compiled | null {
    const m = spec.match(/^([A-Za-z]+)\((.*)\)$/);
    if (!m) return null;
    const tool = m[1];
    const pat = m[2];
    const esc = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return { tool, re: new RegExp('^' + esc + '$') };
}

interface ParsedInput {
    tool: string;
    arg: string;
}

function parseInput(s: string): ParsedInput | null {
    const m = s.match(/^([A-Za-z]+)\((.*)\)$/);
    return m ? { tool: m[1], arg: m[2] } : null;
}

interface Evaluation {
    error: boolean;
    matches: Rule[];
    winner: Rule | null;
}

function evaluate(input: string): Evaluation {
    const p = parseInput(input.trim());
    if (!p) return { error: true, matches: [], winner: null };
    const matches: Rule[] = [];
    RULES.value.forEach((r) => {
        const c = toRe(r.spec);
        if (!c) return;
        if (c.tool === p.tool && c.re.test(p.arg)) matches.push(r);
    });
    return { error: false, matches, winner: matches[0] ?? null };
}

// ── Reactive rule tester state (preload first example) ──
const testIn = ref(EXAMPLES[0]);
const tested = ref(EXAMPLES[0]);

function runTest(value: string): void {
    tested.value = value;
}

function runExample(value: string): void {
    testIn.value = value;
    tested.value = value;
}

const result = computed<Evaluation>(() => evaluate(tested.value));

const hitN = computed<number | null>(() => result.value.winner?.n ?? null);

interface Outcome {
    kind: 'error' | 'fall' | Behaviour;
    cls: string;
    icon: string;
    word: string;
    trace?: string;
}

const outcome = computed<Outcome>(() => {
    const res = result.value;
    if (res.error) {
        return { kind: 'error', cls: 'fall', icon: 'info', word: 'Unparseable' };
    }
    const w = res.winner;
    if (!w) {
        return { kind: 'fall', cls: 'fall', icon: 'info', word: 'Default behaviour' };
    }
    const cls =
        w.beh === 'deny' ? 'denied'
        : w.beh === 'ask' ? 'ask'
        : 'allowed';
    const word =
        w.beh === 'deny' ? 'Denied'
        : w.beh === 'ask' ? 'Ask'
        : 'Allowed';
    const icon =
        w.beh === 'deny' ? 'xcircle'
        : w.beh === 'ask' ? 'alert'
        : 'check';
    let trace = `Matched rule #${w.n} ${w.spec} (${SCOPES[w.scope].label}).`;
    if (w.beh === 'deny') {
        const laterAllow = res.matches.find((m) => m.beh === 'allow');
        if (laterAllow) {
            trace += ` Note: allow #${laterAllow.n} ${laterAllow.spec} would also match, but deny is evaluated first.`;
        }
    }
    return { kind: w.beh, cls, icon, word, trace };
});
</script>

<template>
    <main class="main">
        <section class="view">
            <div class="view-head">
                <div class="col">
                    <h1>Permissions Inspector</h1>
                    <span class="sub">All rules merged across scopes, in real evaluation order. First match wins.</span>
                </div>
                <div class="spacer"></div>
                <RouterLink class="btn sm" to="/guided/permissions">
                    Edit rules
                    <Icon name="sliders" :size="13" />
                </RouterLink>
            </div>
            <div class="view-body">
                <div v-if="unreachableCount" class="banner warn">
                    <span class="b-ico"><Icon name="alert" :size="16" /></span>
                    <div>
                        <b>{{ unreachableCount }} unreachable rule{{ unreachableCount > 1 ? 's' : '' }}.</b>
                        A lower-scope
                        <code class="mono-v">allow</code>
                        is permanently shadowed by a higher-priority
                        <code class="mono-v">deny</code>
                        .
                    </div>
                </div>
                <div class="perm-grid">
                    <div>
                        <div class="card" style="overflow: hidden">
                            <template v-for="g in GROUPS" :key="g.beh">
                                <div class="group-label">
                                    <span class="beh" :class="g.beh">{{ g.beh }}</span>
                                    {{ g.label }}
                                    <span style="margin-left: auto" class="hint">{{ rulesFor(g.beh).length }}</span>
                                </div>
                                <template v-for="r in rulesFor(g.beh)" :key="r.n">
                                    <div class="rule" :class="{ unreachable: r.unreachable, hit: r.n === hitN }" :data-n="r.n">
                                        <span class="idx">{{ r.n }}</span>
                                        <span class="beh" :class="r.beh">{{ r.beh }}</span>
                                        <span class="spec">{{ r.spec }}</span>
                                        <span class="src"><ProvenanceChip :scope="r.scope" /></span>
                                    </div>
                                    <div v-if="r.unreachable" class="rule-warn">
                                        <Icon name="alert" :size="13" />
                                        {{ r.unreachable }}
                                    </div>
                                </template>
                            </template>
                        </div>

                        <div class="card mt">
                            <div class="card-h">
                                <h3>Effective sandbox</h3>
                                <span class="hint" style="margin-left: auto">merged from permission rules + sandbox config</span>
                            </div>
                            <div class="card-b">
                                <div v-for="line in sandbox" :key="line.label" class="sandbox-row">
                                    <span class="sb-k">{{ line.label }}</span>
                                    <div>
                                        <template v-for="(it, i) in line.items" :key="it.code">
                                            <code>{{ it.code }}</code>
                                            <ProvenanceChip v-if="it.scope" :scope="it.scope" style="margin: 0 6px" />
                                            <span v-else-if="i < line.items.length - 1"> · </span>
                                        </template>
                                    </div>
                                </div>
                                <div v-if="!sandbox.length" class="sandbox-row">
                                    <span class="dim" style="font-size: 12px">No sandbox restrictions in effect.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tester">
                        <div class="card">
                            <div class="card-h"><h3>Rule tester</h3></div>
                            <div class="card-b">
                                <p class="hint" style="margin: -2px 0 2px">Type a hypothetical tool call to see which rule matches first.</p>
                                <div class="tester-input">
                                    <input v-model="testIn" class="field field-mono" placeholder="Bash(git push origin main)" @keydown.enter="runTest(testIn)" />
                                    <button class="btn primary" @click="runTest(testIn)">Test</button>
                                </div>
                                <div class="examples">
                                    <span v-for="e in EXAMPLES" :key="e" class="ex" @click="runExample(e)">{{ e }}</span>
                                </div>
                                <div>
                                    <div v-if="outcome.kind === 'error'" class="outcome fall">
                                        <div class="ob-top">
                                            <Icon name="info" :size="16" />
                                            Unparseable
                                        </div>
                                        <div class="ob-sub">
                                            Use the form
                                            <code>Tool(specifier)</code>
                                            , e.g.
                                            <code>Bash(git push origin main)</code>
                                            .
                                        </div>
                                    </div>
                                    <div v-else-if="outcome.kind === 'fall'" class="outcome fall">
                                        <div class="ob-top">
                                            <Icon name="info" :size="16" />
                                            Default behaviour
                                        </div>
                                        <div class="ob-sub">
                                            No rule matched
                                            <code>{{ tested }}</code>
                                            → falls through to permission mode
                                            <b>{{ fallMode }}</b>
                                            .
                                        </div>
                                    </div>
                                    <div v-else class="outcome" :class="outcome.cls">
                                        <div class="ob-top">
                                            <Icon :name="outcome.icon" :size="16" />
                                            {{ outcome.word }}
                                        </div>
                                        <div class="ob-sub">{{ outcome.trace }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="hint mt" style="line-height: 1.6">
                            <b class="muted">Evaluation order</b>
                            <br />
                            <span style="color: var(--deny)">deny</span>
                            →
                            <span style="color: var(--ask)">ask</span>
                            →
                            <span style="color: var(--allow)">allow</span>
                            , first match wins. If nothing matches, the call falls through to the permission mode (
                            <code class="mono-v">{{ fallMode }}</code>
                            ).
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<style scoped>
.perm-grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 18px;
    align-items: start;
}
@media (max-width: 1180px) {
    .perm-grid {
        grid-template-columns: 1fr;
    }
}
.tester .card-b {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.tester-input {
    display: flex;
    gap: 8px;
}
.tester-input input {
    flex: 1;
}
.examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.ex {
    font: 11px var(--mono);
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--fg-muted);
    cursor: pointer;
    background: var(--surface-1);
}
.ex:hover {
    border-color: var(--border-strong);
    color: var(--fg);
}
.outcome {
    border-radius: var(--radius);
    padding: 13px;
    border: 1px solid transparent;
}
.outcome .ob-top {
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 700;
    font-size: 15px;
}
.outcome .ob-sub {
    font: 12px var(--mono);
    margin-top: 7px;
    color: var(--fg);
    line-height: 1.5;
}
.outcome.denied {
    background: var(--err-bg);
    border-color: color-mix(in oklab, var(--err) 32%, transparent);
}
.outcome.denied .ob-top {
    color: var(--err);
}
.outcome.ask {
    background: var(--warn-bg);
    border-color: color-mix(in oklab, var(--warn) 32%, transparent);
}
.outcome.ask .ob-top {
    color: var(--warn);
}
.outcome.allowed {
    background: var(--ok-bg);
    border-color: color-mix(in oklab, var(--ok) 32%, transparent);
}
.outcome.allowed .ob-top {
    color: var(--ok);
}
.outcome.fall {
    background: var(--surface-3);
    border-color: var(--border);
}
.outcome.fall .ob-top {
    color: var(--fg-muted);
}
.rule.hit {
    background: var(--accent-soft) !important;
    box-shadow: inset 2px 0 0 var(--accent);
}
.rule .src {
    display: flex;
}
.sandbox-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 12px;
}
.sandbox-row:last-child {
    border-bottom: 0;
}
.sandbox-row .sb-k {
    color: var(--fg-dim);
    width: 120px;
    flex: none;
}
.sandbox-row code {
    color: var(--fg);
}
</style>
