<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import Terminal from "primevue/terminal";
import TerminalService from "primevue/terminalservice";

import {
  cancelSkills,
  execSkills,
  onSkillsChunk,
  onSkillsExit,
  type SkillsChunkEvent,
  type SkillsExitEvent,
} from "@/composables/useDesktopApi";

// ── Live job tracking ──────────────────────────────────────────────────
//
// PrimeVue's <Terminal> is purely a UI shell — it knows nothing about
// processes. We track a single in-flight CLI job locally so the user
// can `cancel` it and so we know which jobId's chunks to forward to the
// terminal output.
let currentJobId: string | null = null;
let unsubChunk: (() => void) | null = null;
let unsubExit: (() => void) | null = null;

// Strip ANSI color/control sequences. We pass `FORCE_COLOR=1` to the
// CLI so its output is interesting, but PrimeVue's <Terminal> doesn't
// render escape codes — it would just print the raw `\x1b[31m` garbage.
// If we ever swap the renderer for xterm.js we can drop this.
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

function emitLines(text: string): void {
  // <Terminal> appends one response per emit. Split incoming chunks on
  // newlines so multi-line output renders as multiple terminal lines
  // instead of one giant blob.
  const lines = stripAnsi(text).split(/\r?\n/);
  // Drop a trailing empty string from a chunk that ends in `\n` so we
  // don't render a blank line for every newline-terminated chunk.
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  for (const line of lines) {
    TerminalService.emit("response", line);
  }
}

// Tiny shell-style tokenizer. Handles single/double-quoted args so
// `add "git@github.com:foo/bar"` works. Doesn't try to be a real shell.
function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

const HELP_LINES = [
  "Available commands:",
  "  list                show installed skills",
  "  find <query>        search the registry",
  "  add <source>        install a skill (e.g. owner/repo, url, path)",
  "  remove <name>       remove an installed skill",
  "  check               check for skill updates",
  "  init                scaffold a new skill",
  "  cancel              kill the running command",
  "  clear               clear the screen",
  "  help                show this message",
  "",
  "Anything else is forwarded to `skills` as-is (e.g. `list --json`).",
];

async function handleCommand(rawInput: unknown): Promise<void> {
  const text = String(rawInput).trim();
  if (!text) return;

  // ── Local builtins ───────────────────────────────────────────────────
  if (text === "help") {
    for (const line of HELP_LINES) TerminalService.emit("response", line);
    return;
  }
  if (text === "cancel") {
    if (currentJobId) {
      await cancelSkills(currentJobId);
      TerminalService.emit("response", "[cancelled]");
    } else {
      TerminalService.emit("response", "[no running command]");
    }
    return;
  }

  if (currentJobId) {
    TerminalService.emit(
      "response",
      "[a command is already running — type 'cancel' to abort it]",
    );
    return;
  }

  // ── Forward to the bundled CLI ──────────────────────────────────────
  const argv = tokenize(text);
  try {
    currentJobId = await execSkills(argv);
  } catch (e) {
    TerminalService.emit("response", `[exec error] ${(e as Error).message}`);
    currentJobId = null;
  }
}

onMounted(() => {
  unsubChunk = onSkillsChunk((chunk: SkillsChunkEvent) => {
    if (chunk.jobId !== currentJobId) return;
    emitLines(chunk.text);
  });
  unsubExit = onSkillsExit((exit: SkillsExitEvent) => {
    if (exit.jobId !== currentJobId) return;
    if (exit.killed) {
      TerminalService.emit("response", "[killed]");
    } else if (exit.code === 0) {
      TerminalService.emit("response", "[done]");
    } else {
      TerminalService.emit("response", `[exit ${exit.code ?? "?"}]`);
    }
    currentJobId = null;
  });
  TerminalService.on("command", handleCommand);
});

onUnmounted(() => {
  TerminalService.off("command", handleCommand);
  unsubChunk?.();
  unsubExit?.();
  if (currentJobId) {
    void cancelSkills(currentJobId);
    currentJobId = null;
  }
});
</script>

<template>
  <div class="flex flex-1 flex-col gap-3 overflow-hidden">
    <div class="flex items-end gap-3">
      <h1 class="text-[24px] font-bold leading-none text-strong">
        Skills terminal
      </h1>
      <span class="text-[12px] text-soft">
        vercel-labs/skills CLI · type
        <code class="rounded bg-page px-1 py-0.5">help</code>
        to begin
      </span>
    </div>

    <div
      class="skills-terminal flex-1 min-h-0 overflow-hidden rounded-xl border border-line bg-page"
    >
      <Terminal
        welcome-message="Skillful Claude · bundled `skills` CLI. Type `help` for commands."
        prompt="skills$ "
      />
    </div>
  </div>
</template>

<style scoped>
/* PrimeVue's <Terminal> ships with sensible defaults but assumes a light
   surface; pin it to our dark page tokens so it blends with the rest of
   the app. The :deep() selectors poke past the scoped boundary into the
   PrimeVue-rendered elements. */
.skills-terminal :deep(.p-terminal) {
  height: 100%;
  background: transparent;
  color: var(--color-strong, #e5e7eb);
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 12px 14px;
  overflow: auto;
}
.skills-terminal :deep(.p-terminal-prompt) {
  color: var(--color-claude, #d97706);
}
.skills-terminal :deep(.p-terminal-input) {
  background: transparent;
  color: inherit;
  border: 0;
  outline: 0;
  font: inherit;
  caret-color: var(--color-claude, #d97706);
}
.skills-terminal :deep(.p-terminal-command) {
  color: var(--color-strong, #f3f4f6);
}
.skills-terminal :deep(.p-terminal-response) {
  color: var(--color-body, #9ca3af);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
