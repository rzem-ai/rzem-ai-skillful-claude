<script setup lang="ts">
import { computed, ref } from "vue";
import Icon from "@/components/Icon.vue";
import ProvenanceChip from "@/components/ProvenanceChip.vue";
import { toast } from "@/composables/useToast";
import { SCOPES, type ScopeId } from "@/lib/scopes";

// ── Fixtures ──────────────────────────────────────────────────────────────
type Behaviour = "allow" | "ask" | "deny";

interface Mode {
  v: string;
  label: string;
  d: string;
  cur?: boolean;
  userOnly?: boolean;
  locked?: boolean;
}

interface ScopeOption {
  v: ScopeId;
  t: string;
  d: string;
}

interface Rule {
  beh: Behaviour;
  spec: string;
  scope: ScopeId;
  locked?: boolean;
}

interface Pending {
  id: string;
  label: string;
}

const MODES: Mode[] = [
  { v: "plan", label: "plan", d: "Read-only planning" },
  { v: "acceptEdits", label: "acceptEdits", d: "Auto-accept edits", cur: true },
  { v: "auto", label: "auto", d: "Fully autonomous", userOnly: true },
  { v: "bypassPermissions", label: "bypassPermissions", d: "Skip all prompts", locked: true },
];

const SCOPE_OPTS: ScopeOption[] = [
  { v: "user", t: "Just me (all projects)", d: "~/.claude/settings.json" },
  { v: "project", t: "This project (shared with team)", d: ".claude/settings.json · committed" },
  { v: "local", t: "Just me, this project", d: ".claude/settings.local.json · gitignored" },
];

const INITIAL_RULES: Rule[] = [
  { beh: "deny", spec: "Bash(curl *)", scope: "managed", locked: true },
  { beh: "deny", spec: "Read(~/.ssh/**)", scope: "user" },
  { beh: "deny", spec: "Read(./.env)", scope: "project" },
  { beh: "ask", spec: "Bash(git push *)", scope: "project" },
  { beh: "allow", spec: "Bash(git diff *)", scope: "user" },
  { beh: "allow", spec: "Bash(npm run *)", scope: "project" },
];

const BEHAVIOURS: Behaviour[] = ["allow", "ask", "deny"];
const TOOLS = ["Bash", "Read", "Edit", "Write", "WebFetch"];

// ── Reactive state ────────────────────────────────────────────────────────
const pending = ref<Pending[]>([]);
const curMode = ref("acceptEdits");
const rules = ref<Rule[]>(INITIAL_RULES.map((r) => ({ ...r })));

// Scope selectors — default to "project" as in the prototype (dataset.def).
const modeScopeSel = ref<ScopeId>("project");
const ruleScopeSel = ref<ScopeId>("project");

// Composer
const cBeh = ref<Behaviour>("allow");
const cTool = ref<string>("Bash");
const cSpec = ref<string>("");

// Apply bar
const showDiff = ref(true);

// Modal
const modalOpen = ref(false);

// ── Derived ───────────────────────────────────────────────────────────────
const pendN = computed(() => pending.value.length);
const canApply = computed(() => pending.value.length > 0);

// "auto" mode is honoured only from user settings — non-user options disabled.
const modeDisableNonUser = computed(
  () => MODES.find((m) => m.v === curMode.value)?.userOnly === true,
);
const modeWhy = "auto can only be set in user settings";

interface Effect {
  kind: "info" | "warn";
  html: string;
}

const modeEffect = computed<Effect>(() => {
  const m = MODES.find((x) => x.v === curMode.value);
  if (m?.userOnly) {
    return {
      kind: "warn",
      html: "<b>auto</b> mode is honoured only from <b>user</b> settings. Project / local placements are silently ignored (since v2.1.142).",
    };
  }
  if (curMode.value === "acceptEdits") {
    return {
      kind: "info",
      html: "No change — this is already the effective value (from Project settings).",
    };
  }
  return {
    kind: "info",
    html: "This will override the current Project value <code>acceptEdits</code> for the selected scope.",
  };
});

// ── Pending change helpers ────────────────────────────────────────────────
function regPending(id: string, label: string): void {
  if (!pending.value.find((p) => p.id === id)) {
    pending.value.push({ id, label });
  }
}
function unreg(id: string): void {
  pending.value = pending.value.filter((p) => p.id !== id);
}

// ── Mode selection ────────────────────────────────────────────────────────
function selectMode(m: Mode): void {
  if (m.locked) return;
  curMode.value = m.v;
  // If switching to a user-only mode while a non-user scope is selected,
  // the disabled state forces user — reflect that in the selection.
  if (m.userOnly) modeScopeSel.value = "user";
  if (curMode.value !== "acceptEdits") {
    regPending("defaultMode", `Set defaultMode = "${curMode.value}"`);
  } else {
    unreg("defaultMode");
  }
}

// ── Scope selector interaction ────────────────────────────────────────────
function selectModeScope(o: ScopeOption): void {
  if (modeDisableNonUser.value && o.v !== "user") return;
  modeScopeSel.value = o.v;
}
function selectRuleScope(o: ScopeOption): void {
  ruleScopeSel.value = o.v;
}

// ── Rules ─────────────────────────────────────────────────────────────────
function removeRule(i: number): void {
  const r = rules.value[i];
  rules.value.splice(i, 1);
  regPending("del" + r.spec, `Remove ${r.beh} ${r.spec}`);
}

function addRule(): void {
  const spec = cSpec.value.trim();
  if (!spec) {
    toast("Enter a specifier first", "alert");
    return;
  }
  const full = `${cTool.value}(${spec})`;
  rules.value.push({ beh: cBeh.value, spec: full, scope: ruleScopeSel.value });
  regPending("add" + full, `Add ${cBeh.value} ${full} (${SCOPES[ruleScopeSel.value].label})`);
  cSpec.value = "";
}

// ── Discard / apply / modal ───────────────────────────────────────────────
function discard(): void {
  pending.value = [];
  toast("Pending changes discarded", "check");
}

function apply(): void {
  if (pending.value.length === 0) return;
  if (showDiff.value) modalOpen.value = true;
  else commit();
}

function closeDiff(): void {
  modalOpen.value = false;
}

function confirmDiff(): void {
  modalOpen.value = false;
  commit();
}

function commit(): void {
  const n = pending.value.length;
  pending.value = [];
  toast(
    `${n} change${n > 1 ? "s" : ""} written · backup created`,
    "check",
    "Undo",
    () => toast("Restored from backup", "check"),
  );
}

// ── Diff rendering ────────────────────────────────────────────────────────
interface DiffLine {
  add: boolean;
  text: string;
}

// File diff — first 4 pending entries rendered as added/removed JSON-ish lines.
const fileLines = computed<DiffLine[]>(() =>
  pending.value.slice(0, 4).map((p) => {
    const add = p.label.indexOf("Remove") < 0;
    if (!add) {
      return { add: false, text: `    (removed) ${p.label.replace("Remove ", "")}` };
    }
    if (p.label.indexOf("defaultMode") >= 0) {
      return { add: true, text: `    "defaultMode": "${curMode.value}""` };
    }
    const stripped = p.label
      .replace(/^(Add|Remove) (allow|ask|deny) /, "")
      .replace(/ \(.+\)$/, "");
    return { add: true, text: `    "${stripped}"` };
  }),
);

// Effective-config diff — the "what actually changes" thesis block.
const effLines = computed<DiffLine[]>(() =>
  pending.value.map((p) => ({ add: p.label.indexOf("Remove") < 0, text: p.label })),
);
</script>

<template>
  <main class="main">
    <section class="view">
      <div class="view-head">
        <div class="col">
          <span class="crumb">Guided Config &nbsp;›&nbsp; <b>Permissions</b></span>
          <h1 style="margin-top: 2px">Permissions</h1>
        </div>
        <div class="spacer"></div>
        <RouterLink class="btn ghost sm" to="/permissions">View merged result</RouterLink>
      </div>

      <div class="view-body">
        <div class="guided">
          <!-- Default mode -->
          <div class="card mb">
            <div class="card-h">
              <h3>Default permission mode</h3>
              <span class="hint" style="margin-left: auto">Currently resolves to <code class="mono-v">acceptEdits</code> (Project)</span>
            </div>
            <div class="card-b">
              <div class="modes">
                <button
                  v-for="m in MODES"
                  :key="m.v"
                  class="mode"
                  :class="{ on: m.v === curMode }"
                  :disabled="m.locked"
                  :title="m.locked ? 'Locked by managed policy' : undefined"
                  @click="selectMode(m)"
                >
                  <span v-if="m.cur" class="cur">live</span>
                  <div class="mn">{{ m.label }}</div>
                  <div class="md">{{ m.d }}</div>
                </button>
              </div>
              <div style="margin-top: 14px">
                <label class="lbl">Apply this change to</label>
                <div class="scope-sel">
                  <button
                    v-for="o in SCOPE_OPTS"
                    :key="o.v"
                    class="opt"
                    :class="{ on: o.v === modeScopeSel }"
                    :aria-disabled="modeDisableNonUser && o.v !== 'user' ? 'true' : undefined"
                    @click="selectModeScope(o)"
                  >
                    <div class="ttl"><ProvenanceChip :scope="o.v" />{{ o.t }}</div>
                    <div class="desc">{{ o.d }}</div>
                    <div v-if="modeDisableNonUser && o.v !== 'user'" class="why">
                      <Icon name="alert" :size="12" />{{ modeWhy }}
                    </div>
                  </button>
                </div>
              </div>
              <div style="margin-top: 12px">
                <div class="effect" :class="modeEffect.kind">
                  <Icon :name="modeEffect.kind === 'warn' ? 'alert' : 'info'" :size="14" />
                  <span v-html="modeEffect.html"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Rule builder -->
          <div class="card mb">
            <div class="card-h">
              <h3>Permission rules</h3>
              <span class="hint" style="margin-left: auto">drag to reorder within a group</span>
            </div>
            <div class="card-b">
              <div>
                <div v-for="(r, i) in rules" :key="r.spec + i" class="rule-edit">
                  <span v-if="r.locked"></span>
                  <span v-else class="drag"><Icon name="grip" :size="14" /></span>
                  <span class="beh" :class="r.beh">{{ r.beh }}</span>
                  <span class="spec">{{ r.spec }}</span>
                  <ProvenanceChip :scope="r.scope" />
                  <span v-if="r.locked" class="tag lock" title="Managed rule — read-only">
                    <Icon name="lock" :size="10" />managed
                  </span>
                  <span v-else class="del" title="Remove" @click="removeRule(i)">
                    <Icon name="trash" :size="14" />
                  </span>
                </div>
              </div>
              <hr class="hr" />
              <label class="lbl">Add a rule</label>
              <div class="composer">
                <div>
                  <select v-model="cBeh" class="field">
                    <option v-for="b in BEHAVIOURS" :key="b" :value="b">{{ b }}</option>
                  </select>
                </div>
                <div>
                  <select v-model="cTool" class="field field-mono">
                    <option v-for="t in TOOLS" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="syntax-help">
                  <input v-model="cSpec" class="field field-mono" placeholder="docker compose *" @keyup.enter="addRule" />
                  <div class="help-pop">
                    <b>Specifier syntax</b>
                    <div class="row"><code>npm run *</code><span class="dim">prefix + wildcard</span></div>
                    <div class="row"><code>./.env.*</code><span class="dim">relative path glob</span></div>
                    <div class="row"><code>~/.ssh/**</code><span class="dim">recursive home glob</span></div>
                    <div class="row"><code>(exact)</code><span class="dim">no wildcard = exact</span></div>
                  </div>
                </div>
                <button class="btn" @click="addRule"><Icon name="plus" :size="13" />Add</button>
              </div>
              <div style="margin-top: 12px">
                <label class="lbl">Scope for new rule</label>
                <div class="scope-sel">
                  <button
                    v-for="o in SCOPE_OPTS"
                    :key="o.v"
                    class="opt"
                    :class="{ on: o.v === ruleScopeSel }"
                    @click="selectRuleScope(o)"
                  >
                    <div class="ttl"><ProvenanceChip :scope="o.v" />{{ o.t }}</div>
                    <div class="desc">{{ o.d }}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Locked example -->
          <div class="card mb">
            <div class="card-h"><h3>Bypass-permissions mode</h3></div>
            <div class="card-b">
              <div class="locked">
                <span class="lk-ico"><Icon name="lock" :size="16" /></span>
                <div>
                  <div class="lk-val">disableBypassPermissionsMode = "disable"</div>
                  <div class="lk-chan">Locked by managed policy · Enforced via file — /etc/claude-code/managed-settings.json. This control cannot be changed from this machine.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Apply bar -->
          <div class="applybar">
            <span class="count"><b>{{ pendN }}</b> pending changes</span>
            <label class="chk" :class="{ on: showDiff }">
              <input v-model="showDiff" type="checkbox" />Preview diff before applying
            </label>
            <div class="spacer"></div>
            <button class="btn" :disabled="!canApply" @click="discard">Discard</button>
            <button class="btn primary" :disabled="!canApply" @click="apply">Apply changes</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Diff modal -->
    <div v-if="modalOpen" class="scrim">
      <div class="modal">
        <div class="modal-h">
          <span style="color: var(--accent)"><Icon name="diff" :size="16" /></span>
          <h2>Review changes</h2>
          <div class="spacer" style="flex: 1"></div>
          <button class="icon-btn" @click="closeDiff"><Icon name="xcircle" :size="16" /></button>
        </div>
        <div class="modal-b">
          <!-- File diff -->
          <div class="diff-block">
            <div class="diff-h"><Icon name="file" :size="13" />File diff · .claude/settings.json</div>
            <div class="diff">
              <div class="ln"><span class="gut">…</span><span class="txt">  "permissions": {</span></div>
              <div v-for="(l, i) in fileLines" :key="'f' + i" class="ln" :class="l.add ? 'add' : 'del'">
                <span class="gut">{{ l.add ? "+" : "-" }}</span><span class="txt">{{ l.text }}</span>
              </div>
              <div class="ln"><span class="gut">…</span><span class="txt">  }</span></div>
            </div>
          </div>
          <!-- Effective-config diff (the thesis) -->
          <div class="diff-block thesis">
            <div class="diff-h"><Icon name="arrow" :size="13" />What actually changes · effective configuration</div>
            <div class="diff thesis">
              <div v-for="(l, i) in effLines" :key="'e' + i" class="ln" :class="l.add ? 'add' : 'del'">
                <span class="gut">{{ l.add ? "+" : "-" }}</span><span class="txt">{{ l.text }}</span>
              </div>
            </div>
            <div class="hint" style="margin-top: 7px">
              <Icon name="info" :size="12" /> This is the resolved result after merge — what the agent will actually see.
            </div>
          </div>
        </div>
        <div class="modal-f">
          <span class="hint">Atomic write · timestamped backup created (5 retained)</span>
          <div style="flex: 1"></div>
          <button class="btn" @click="closeDiff">Cancel</button>
          <button class="btn primary" @click="confirmDiff">Apply &amp; back up</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.guided { max-width: 860px; }
.modes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.mode {
  text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface-1); cursor: pointer; position: relative;
}
.mode:hover { border-color: var(--border-strong); }
.mode.on { border-color: var(--accent); background: var(--accent-soft); }
.mode .mn { font: 12px var(--mono); font-weight: 600; color: var(--fg); }
.mode .md { font-size: 11px; color: var(--fg-dim); margin-top: 3px; }
.mode .cur { position: absolute; top: 8px; right: 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--scope-project); background: color-mix(in oklab, var(--scope-project) 14%, transparent); padding: 1px 5px; border-radius: 4px; }
.composer { display: grid; grid-template-columns: 96px 86px 1fr auto; gap: 8px; align-items: end; }
.syntax-help { position: relative; }
.help-pop { display: none; position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; width: 300px; background: var(--surface-4); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow-pop); padding: 11px; font-size: 11.5px; line-height: 1.55; }
.syntax-help:hover .help-pop, .syntax-help:focus-within .help-pop { display: block; }
.help-pop code { color: var(--accent); }
.help-pop .row { justify-content: space-between; padding: 2px 0; border-bottom: 1px solid var(--border-soft); }
.help-pop .row:last-child { border-bottom: 0; }
.rule-edit { display: grid; grid-template-columns: 18px 64px 1fr auto auto; align-items: center; gap: 10px; padding: 0 4px; height: 34px; border-bottom: 1px solid var(--border-soft); }
.rule-edit .spec { font: 12px var(--mono); color: var(--fg); }
.rule-edit .del { color: var(--fg-faint); cursor: pointer; display: flex; }
.rule-edit .del:hover { color: var(--err); }
.rule-edit .drag { color: var(--fg-faint); cursor: grab; display: flex; }
.applybar {
  position: sticky; bottom: 0; margin: 18px -20px -28px; padding: 12px 20px;
  background: var(--surface-2); border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px;
}
.applybar .count { font-size: 12px; color: var(--fg-muted); }
.applybar .count b { color: var(--fg); }
.applybar .spacer { flex: 1; }
</style>
