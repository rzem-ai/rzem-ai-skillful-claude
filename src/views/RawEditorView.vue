<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import Icon from "@/components/Icon.vue";
import ProvenanceChip from "@/components/ProvenanceChip.vue";
import { toast } from "@/composables/useToast";
import type { ScopeId } from "@/lib/scopes";

// ── Types ──
type Health = "ok" | "warn" | "err";
type LintType = "err" | "warn";

interface Lint {
  type: LintType;
  msg: string;
  action: string;
}
interface Line {
  t: string;
  n?: number;
  g?: LintType;
  hi?: boolean;
  key?: string;
  lint?: Lint;
  folded?: boolean;
}
interface RawFile {
  scope: ScopeId;
  path: string;
  label: string;
  health: Health;
  committed?: boolean;
  gitignore?: boolean;
  locked?: boolean;
  dragons?: boolean;
  parseErr?: { line: number; msg: string };
  lines: Line[];
}
type FileId = "proj" | "local" | "user" | "mgmt" | "mgmt2" | "global";
interface TreeGroup {
  scope: ScopeId;
  ids: FileId[];
}

// ── line helper, mirroring L(t, opts) ──
function L(t: string, opts: Partial<Line> = {}): Line {
  return { ...opts, t };
}

// ── files (fixture, preserved verbatim) ──
const FILES: Record<FileId, RawFile> = {
  proj: {
    scope: "project", path: ".claude/settings.json", label: "settings.json", health: "warn", committed: true,
    lines: [
      L("{"), L('  "$schema": "…/claude-code-settings.json",'),
      L('  "model": "claude-sonnet-4-6",'),
      L('  "permissions": {'),
      L('    "defaultMode": "acceptEdits",', { hi: true, key: "defaultMode" }),
      L('    "allow": ["Bash(npm run *)", "Bash(curl localhost*)"],', { g: "warn", lint: { type: "warn", msg: "Bash(curl localhost*) is unreachable — always matched first by managed deny Bash(curl *).", action: "Explain" } }),
      L('    "ask": ["Bash(git push *)"],'),
      L('    "deny": ["Read(./.env)", "Read(./.env.*)"],'),
      L('    "additionalDirectories": ["../config-studio-docs/"]'),
      L("  },"),
      L('  "enabledPlugins": { "formatter@team-tools": true },'),
      L('  "extraKnownMarketplaces": { "team-tools": { "source": {…} } }'),
      L("}"),
    ],
  },
  local: {
    scope: "local", path: ".claude/settings.local.json", label: "settings.local.json", health: "ok", gitignore: true,
    lines: [
      L("{"), L('  "permissions": {'),
      L('    "defaultMode": "auto"', { hi: true, key: "defaultMode", g: "warn", lint: { type: "warn", msg: "Ignored — “auto” mode can only be set in user settings (since v2.1.142).", action: "Move to user" } }),
      L("  },"),
      L('  "outputStyle": "Explanatory",'),
      L('  "enabledPlugins": { "formatter@team-tools": false }'),
      L("}"),
    ],
  },
  user: {
    scope: "user", path: "~/.claude/settings.json", label: "settings.json", health: "warn",
    lines: [
      L("{"), L('  "model": "claude-opus-4-7",'),
      L('  "effortLevel": "high",'),
      L('  "alwaysThinkingEnabled": true,'),
      L('  "editorMode": "vim",'),
      L('  "autoConnectIde": true,', { g: "warn", lint: { type: "warn", msg: "Wrong file — autoConnectIde belongs in ~/.claude.json or it is ignored.", action: "Move it" } }),
      L('  "permissions": { "defaultMode": "plan", "allow": ["Bash(git diff *)","Bash(git log *)"], "deny": ["Read(~/.ssh/**)"] },', { key: "defaultMode" }),
      L('  "env": {'),
      L('    "NODE_ENV": "development",'),
      L('    "NPM_TOKEN": "npm_••••••••••••"  // masked', { g: "warn", lint: { type: "warn", msg: "Secret detected — masked by default. Reveal per-field; never written to diffs.", action: "Reveal" } }),
      L("  }"),
      L("}"),
    ],
  },
  mgmt: {
    scope: "managed", path: "/etc/claude-code/managed-settings.json", label: "managed-settings.json", health: "ok", locked: true,
    lines: [
      L("{"), L('  "permissions": { "deny": ["Bash(curl *)", "Read(//etc/secrets/**)"] },'),
      L('  "disableBypassPermissionsMode": "disable",'),
      L('  "forceLoginMethod": "claudeai",'),
      L('  "sandbox": { "network": { "deniedDomains": ["uploads.github.com"] } }'),
      L("}"),
    ],
  },
  mgmt2: {
    scope: "managed", path: "managed-settings.d/20-experimental.json", label: "20-experimental.json", health: "err", locked: true,
    parseErr: { line: 4, msg: 'Unexpected token } — trailing comma after "autoUpdatesChannel" (line 4). File excluded from resolution.' },
    lines: [
      L("{"), L('  "spinnerTipsEnabled": false,'),
      L('  "autoUpdatesChannel": "stable",', { g: "err" }),
      L("}", { g: "err", lint: { type: "err", msg: "Trailing comma — invalid JSON. This whole file is excluded until fixed.", action: "Open docs" } }),
    ],
  },
  global: {
    scope: "user", path: "~/.claude.json", label: ".claude.json", health: "ok", dragons: true,
    lines: [
      L("{"),
      L('  "oauthAccount": { … },', { folded: true }),
      L('  "mcpServers": {'),
      L('    "github": { "type": "http", "url": "https://api.githubcopilot.com/mcp",'),
      L('               "headers": { "Authorization": "Bearer ${GITHUB_PAT}" } }'),
      L("  },"),
      L('  "projects": { "/home/alex/Projects/config-studio": { "hasTrustDialogAccepted": true, … } }'),
    ],
  },
};

const TREE: TreeGroup[] = [
  { scope: "managed", ids: ["mgmt", "mgmt2"] },
  { scope: "local", ids: ["local"] },
  { scope: "project", ids: ["proj"] },
  { scope: "user", ids: ["user", "global"] },
];

// ── JSON colorizer (line-level), ported from color() ──
function colorize(t: string): string {
  return t
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="key">$1</span><span class="pun">$2</span>')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, (_m, p1: string) => ': <span class="str">' + p1 + "</span>")
    .replace(/:\s*(true|false|null)/g, ': <span class="bool">$1</span>')
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="num">$1</span>')
    .replace(/([{}[\],])/g, '<span class="pun">$1</span>');
}

// ── reactive state ──
const route = useRoute();
const curId = ref<FileId>("proj");
const split = ref(route.query.key === "defaultMode");
const splitKey = "defaultMode";
// mutable copy of the project lines so the diff-confirm can remove a line.
const projLines = ref<Line[]>([...FILES.proj.lines]);

const SPLIT_LEFT: FileId = "proj";
const SPLIT_RIGHT: FileId = "local";

function fileLines(id: FileId): Line[] {
  return id === "proj" ? projLines.value : FILES[id].lines;
}
function healthCls(h: Health): string {
  return h === "ok" ? "ok" : h === "warn" ? "warn" : "err";
}

const curFile = computed(() => FILES[curId.value]);

// Numbered render rows: foldeds don't get a gutter number but DO consume a line
// number (matching the prototype's n++ before the folded branch).
interface RenderRow {
  line: Line;
  n: number;
  hi: boolean;
  cls: string;
}
function buildRows(id: FileId, hiKey?: string): RenderRow[] {
  let n = 0;
  return fileLines(id).map((line) => {
    n++;
    let cls = "cl";
    if (line.g === "err") cls += " errln";
    else if (line.g === "warn") cls += " warnln";
    let hi = false;
    if (hiKey) hi = line.key === hiKey;
    else hi = !!line.hi;
    if (hi) cls += " hi";
    return { line, n, hi, cls };
  });
}

const tabLabel = computed(() => (split.value ? "defaultMode · 2 sources" : curFile.value.label));
const splitBtnLabel = computed(() => (split.value ? "Exit side-by-side" : "Side-by-side resolution"));

// ── interactions ──
function openFile(id: FileId): void {
  curId.value = id;
  split.value = false;
}
function toggleSplit(): void {
  split.value = !split.value;
  if (split.value) curId.value = "proj";
}
function lintAction(action: string): void {
  toast(`“${action}” — guided fix opens`, "sliders");
}
function unlockFolded(): void {
  toast("Sensitive section unlocked for this session", "alert");
}

// ── save bar (single-file) ──
const saveBarOk = computed(() => curFile.value.health !== "err");
const saveBarStatus = computed(() => {
  const f = curFile.value;
  if (!saveBarOk.value) return "Invalid JSON — cannot save";
  return f.health === "warn" ? "Valid JSON · 1 semantic warning" : "Valid JSON";
});
const saveBarMeta = computed(() => {
  const f = curFile.value;
  return (f.gitignore ? "gitignored · " : "") + (f.committed ? "committed · " : "") + "last saved Jun 6";
});
function doSave(): void {
  const f = curFile.value;
  toast(`Saved ${f.label} · backup created`, "check", "Undo", () => toast("Restored from backup", "check"));
}
function doRevert(): void {
  toast("Reverted unsaved changes", "check");
}

// ── diff modal (hero step 4) ──
const diffOpen = ref(false);
function openDiff(): void {
  diffOpen.value = true;
}
function closeDiff(): void {
  diffOpen.value = false;
}
function confirmDiff(): void {
  diffOpen.value = false;
  projLines.value = projLines.value.filter((l) => l.key !== "defaultMode");
  toast("Project defaultMode removed · now resolves to User “plan” · backup created", "check", "Undo", () => {
    projLines.value = [...FILES.proj.lines];
  });
}
</script>

<template>
  <main class="main">
    <section class="view view-body flush" style="overflow: hidden">
      <div class="raw">
        <!-- file tree -->
        <aside class="ftree">
          <div v-for="g in TREE" :key="g.scope" class="ftg">
            <div class="h"><ProvenanceChip :scope="g.scope" /></div>
            <div
              v-for="id in g.ids"
              :key="id"
              class="fitem"
              :class="{ on: id === curId && !split }"
              @click="openFile(id)"
            >
              <span class="fdot">
                <span class="health" :class="healthCls(FILES[id].health)"><span class="dot"></span></span>
              </span>
              <span>{{ FILES[id].label }}</span>
              <span class="fb">
                <span v-if="FILES[id].locked" class="tag lock" title="read-only"><Icon name="lock" :size="10" /></span>
                <span v-if="FILES[id].gitignore" class="tag gitignore">git</span>
              </span>
            </div>
          </div>
        </aside>

        <!-- editor -->
        <div class="editor-wrap">
          <div class="etabs">
            <div class="etab on"><Icon name="file" :size="13" />{{ tabLabel }}</div>
            <div class="etools">
              <button class="btn ghost sm" @click="toggleSplit">
                <Icon name="compare" :size="13" />{{ splitBtnLabel }}
              </button>
            </div>
          </div>

          <!-- panes -->
          <div class="panes" :class="{ split }">
            <!-- side-by-side resolution -->
            <template v-if="split">
              <!-- winner -->
              <div class="pane">
                <div class="pane-h">
                  <ProvenanceChip :scope="FILES[SPLIT_LEFT].scope" />
                  <span class="ph-path">{{ FILES[SPLIT_LEFT].path }}</span>
                  <span class="tag info" style="margin-left: auto"><Icon name="check" :size="10" />winner</span>
                </div>
                <div class="code">
                  <template v-for="row in buildRows(SPLIT_LEFT, splitKey)" :key="row.n">
                    <div v-if="row.line.folded" class="folded">
                      <Icon name="lock" :size="12" /><span>{{ row.line.t.trim() }}</span>
                      <span class="unlock" @click="unlockFolded">here be dragons — unlock</span>
                    </div>
                    <template v-else>
                      <div :class="row.cls">
                        <span class="g" :class="{ warn: row.line.g === 'warn' }">
                          <Icon v-if="row.line.g" :name="row.line.g === 'err' ? 'xcircle' : 'alert'" :size="13" />
                        </span>
                        <span class="n">{{ row.n }}</span>
                        <span class="t" v-html="colorize(row.line.t)"></span>
                      </div>
                      <div v-if="row.line.lint" class="lint-line" :class="row.line.lint.type">
                        <Icon :name="row.line.lint.type === 'err' ? 'xcircle' : 'alert'" :size="12" />
                        <span>{{ row.line.lint.msg }}</span>
                        <span class="la" @click="lintAction(row.line.lint.action)">{{ row.line.lint.action }}</span>
                      </div>
                    </template>
                  </template>
                </div>
                <div style="padding: 8px 12px; border-top: 1px solid var(--border-soft)">
                  <button class="btn danger sm" @click="openDiff">
                    <Icon name="trash" :size="12" />Delete this defaultMode entry
                  </button>
                </div>
              </div>
              <!-- ignored -->
              <div class="pane">
                <div class="pane-h">
                  <ProvenanceChip :scope="FILES[SPLIT_RIGHT].scope" />
                  <span class="ph-path">{{ FILES[SPLIT_RIGHT].path }}</span>
                  <span class="tag warn" style="margin-left: auto"><Icon name="alert" :size="10" />ignored</span>
                </div>
                <div class="code">
                  <template v-for="row in buildRows(SPLIT_RIGHT, splitKey)" :key="row.n">
                    <div v-if="row.line.folded" class="folded">
                      <Icon name="lock" :size="12" /><span>{{ row.line.t.trim() }}</span>
                      <span class="unlock" @click="unlockFolded">here be dragons — unlock</span>
                    </div>
                    <template v-else>
                      <div :class="row.cls">
                        <span class="g" :class="{ warn: row.line.g === 'warn' }">
                          <Icon v-if="row.line.g" :name="row.line.g === 'err' ? 'xcircle' : 'alert'" :size="13" />
                        </span>
                        <span class="n">{{ row.n }}</span>
                        <span class="t" v-html="colorize(row.line.t)"></span>
                      </div>
                      <div v-if="row.line.lint" class="lint-line" :class="row.line.lint.type">
                        <Icon :name="row.line.lint.type === 'err' ? 'xcircle' : 'alert'" :size="12" />
                        <span>{{ row.line.lint.msg }}</span>
                        <span class="la" @click="lintAction(row.line.lint.action)">{{ row.line.lint.action }}</span>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
            </template>

            <!-- single file -->
            <template v-else>
              <div class="pane">
                <div class="pane-h">
                  <ProvenanceChip :scope="curFile.scope" />
                  <span class="ph-path">{{ curFile.path }}</span>
                  <span v-if="curFile.locked" class="tag lock" style="margin-left: auto">
                    <Icon name="lock" :size="10" />read-only
                  </span>
                </div>
                <div v-if="curFile.parseErr" class="banner err" style="margin: 10px 12px 0">
                  <span class="b-ico"><Icon name="xcircle" :size="16" /></span>
                  <div><b>Parse error · line {{ curFile.parseErr.line }}.</b> {{ curFile.parseErr.msg }}</div>
                </div>
                <div class="code">
                  <template v-for="row in buildRows(curId)" :key="row.n">
                    <div v-if="row.line.folded" class="folded">
                      <Icon name="lock" :size="12" /><span>{{ row.line.t.trim() }}</span>
                      <span class="unlock" @click="unlockFolded">here be dragons — unlock</span>
                    </div>
                    <template v-else>
                      <div :class="row.cls">
                        <span class="g" :class="{ warn: row.line.g === 'warn' }">
                          <Icon v-if="row.line.g" :name="row.line.g === 'err' ? 'xcircle' : 'alert'" :size="13" />
                        </span>
                        <span class="n">{{ row.n }}</span>
                        <span class="t" v-html="colorize(row.line.t)"></span>
                      </div>
                      <div v-if="row.line.lint" class="lint-line" :class="row.line.lint.type">
                        <Icon :name="row.line.lint.type === 'err' ? 'xcircle' : 'alert'" :size="12" />
                        <span>{{ row.line.lint.msg }}</span>
                        <span class="la" @click="lintAction(row.line.lint.action)">{{ row.line.lint.action }}</span>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <!-- save bar -->
          <div class="savebar">
            <template v-if="split">
              <div class="vstat health warn">
                <span class="dot"></span>Resolution view — Project wins, Local ignored by rule
              </div>
              <div style="flex: 1"></div>
              <span class="hint">Edit a side to write directly to that file</span>
            </template>
            <template v-else-if="curFile.locked">
              <div class="vstat">
                <span class="tag lock"><Icon name="lock" :size="11" />Managed</span>
                <span class="muted">Read-only — managed files are observed, never written.</span>
              </div>
            </template>
            <template v-else>
              <div class="vstat health" :class="saveBarOk ? 'warn' : 'err'">
                <span class="dot"></span>{{ saveBarStatus }}
              </div>
              <span class="hint">{{ saveBarMeta }}</span>
              <div style="flex: 1"></div>
              <button class="btn sm" @click="doRevert">Revert</button>
              <button class="btn primary sm" :disabled="!saveBarOk" @click="doSave">
                <Icon name="check" :size="12" />Validate &amp; save
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- diff modal -->
    <div class="scrim" :hidden="!diffOpen">
      <div class="modal">
        <div class="modal-h">
          <span style="color: var(--accent)"><Icon name="diff" :size="16" /></span>
          <h2>Delete project <code class="mono-v" style="font-size: 13px">defaultMode</code></h2>
          <div style="flex: 1"></div>
          <button class="icon-btn" @click="closeDiff"><Icon name="xcircle" :size="16" /></button>
        </div>
        <div class="modal-b">
          <div class="diff-block">
            <div class="diff-h"><Icon name="file" :size="13" />File diff · .claude/settings.json</div>
            <div class="diff">
              <div class="ln"><span class="gut">…</span><span class="txt">  "permissions": {</span></div>
              <div class="ln del"><span class="gut">-</span><span class="txt">    "defaultMode": "acceptEdits",</span></div>
              <div class="ln"><span class="gut">…</span><span class="txt">  }</span></div>
            </div>
          </div>
          <div class="diff-block thesis">
            <div class="diff-h"><Icon name="arrow" :size="13" />What actually changes · effective configuration</div>
            <div class="diff thesis">
              <div class="ln del"><span class="gut">-</span><span class="txt">defaultMode = acceptEdits   (was: Project)</span></div>
              <div class="ln add"><span class="gut">+</span><span class="txt">defaultMode = plan          (now: User)</span></div>
            </div>
            <div class="hint" style="margin-top: 7px">
              <Icon name="info" :size="12" /> With the Project entry gone, the User value <code>plan</code> becomes effective. (Local <code>auto</code> stays ignored.)
            </div>
          </div>
        </div>
        <div class="modal-f">
          <span class="hint">Atomic write · timestamped backup created</span>
          <div style="flex: 1"></div>
          <button class="btn" @click="closeDiff">Cancel</button>
          <button class="btn primary" @click="confirmDiff">Apply &amp; back up</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.raw { display: grid; grid-template-columns: 256px 1fr; height: 100%; }
.ftree { border-right: 1px solid var(--border); background: var(--surface-1); overflow: auto; padding: 8px 0; }
.ftg { padding: 8px 0 2px; }
.ftg .h { display: flex; align-items: center; gap: 7px; padding: 5px 12px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--fg-dim); font-weight: 650; }
.fitem { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 5px 12px 5px 22px; cursor: pointer; font: 12px var(--mono); color: var(--fg-muted); }
.fitem:hover { background: var(--surface-2); color: var(--fg); }
.fitem.on { background: var(--accent-soft); color: var(--fg); box-shadow: inset 2px 0 0 var(--accent); }
.fitem .fdot { display: flex; }
.fitem .fb { display: flex; gap: 4px; }
.editor-wrap { display: flex; flex-direction: column; overflow: hidden; }
.etabs { display: flex; align-items: center; gap: 2px; padding: 0 8px; height: 38px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
.etab { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 12px; font: 12px var(--mono); color: var(--fg-muted); border-bottom: 2px solid transparent; cursor: pointer; }
.etab.on { color: var(--fg); border-bottom-color: var(--accent); }
.etools { margin-left: auto; display: flex; gap: 6px; }
.panes { flex: 1; display: grid; grid-template-columns: 1fr; overflow: hidden; }
.panes.split { grid-template-columns: 1fr 1fr; }
.pane { display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--border); }
.pane:last-child { border-right: 0; }
.pane-h { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid var(--border-soft); background: var(--surface-1); font: 11px var(--mono); color: var(--fg-muted); }
.pane-h .ph-path { color: var(--fg); }
.code { flex: 1; overflow: auto; font: 12px/1.6 var(--mono); padding: 8px 0; background: var(--surface-1); }
.cl { display: grid; grid-template-columns: 20px 40px 1fr; align-items: start; }
.cl .g { color: var(--err); display: flex; justify-content: center; padding-top: 3px; }
.cl .g.warn { color: var(--warn); }
.cl .n { text-align: right; padding-right: 12px; color: var(--fg-faint); user-select: none; }
.cl .t { white-space: pre; padding-right: 14px; }
.cl.hi { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
.cl.errln { background: var(--err-bg); }
.cl.warnln { background: var(--warn-bg); }
.cl .t :deep(.key) { color: #8fd0ff; }
.cl .t :deep(.str) { color: #9cdca0; }
.cl .t :deep(.num) { color: #e6b673; }
.cl .t :deep(.bool) { color: #c9a0ff; }
.cl .t :deep(.pun) { color: var(--fg-dim); }
.lint-line { grid-column: 1/-1; display: flex; align-items: center; gap: 7px; padding: 5px 14px 5px 60px; font-size: 11px; }
.lint-line.err { color: var(--err); background: var(--err-bg); }
.lint-line.warn { color: var(--warn); background: var(--warn-bg); }
.lint-line .la { margin-left: auto; color: var(--accent); cursor: pointer; font-weight: 600; }
.savebar { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-top: 1px solid var(--border); background: var(--surface-2); }
.savebar .vstat { display: flex; align-items: center; gap: 7px; font-size: 12px; }
.folded { padding: 6px 14px 6px 60px; color: var(--fg-dim); font-size: 11px; display: flex; align-items: center; gap: 8px; }
.folded .unlock { color: var(--accent); cursor: pointer; }
</style>
