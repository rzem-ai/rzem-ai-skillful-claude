import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { app } from "electron";
import log from "electron-log/main";

/**
 * Wrapper around the `vercel-labs/skills` npm CLI.
 *
 * The CLI is shipped as a runtime dependency of this app. We resolve its
 * package.json to find the entry script, then spawn it via Node so we
 * don't depend on `npx` being available on the user's PATH inside a
 * packaged app.
 *
 * In development the resolution walks node_modules normally. In a
 * packaged build, electron-builder unpacks `skills` into
 * `app.asar.unpacked/node_modules/skills` (see electron-builder.yml's
 * `asarUnpack` rule), and we point the spawn at that path.
 */

let cachedEntry: string | null = null;

function resolveSkillsEntry(): string {
  if (cachedEntry) return cachedEntry;

  // 1) Try CommonJS resolution from this file. Works in dev and in
  //    most packaged builds where the dep is reachable from out/main.
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("skills/package.json");
    const pkg = require(pkgPath) as { bin?: string | Record<string, string>; main?: string };
    const dir = dirname(pkgPath);
    const binRel =
      typeof pkg.bin === "string"
        ? pkg.bin
        : pkg.bin && typeof pkg.bin === "object"
          ? (pkg.bin["skills"] ?? Object.values(pkg.bin)[0])
          : (pkg.main ?? "bin/index.js");
    cachedEntry = join(dir, binRel);
    return cachedEntry;
  } catch (e) {
    log.warn(`resolveSkillsEntry: dev resolution failed: ${(e as Error).message}`);
  }

  // 2) Fallback for packaged builds: look in app.asar.unpacked.
  const unpacked = join(
    app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked"),
    "node_modules",
    "skills",
  );
  try {
    const require = createRequire(import.meta.url);
    const pkg = require(join(unpacked, "package.json")) as {
      bin?: string | Record<string, string>;
      main?: string;
    };
    const binRel =
      typeof pkg.bin === "string"
        ? pkg.bin
        : pkg.bin && typeof pkg.bin === "object"
          ? (pkg.bin["skills"] ?? Object.values(pkg.bin)[0])
          : (pkg.main ?? "bin/index.js");
    cachedEntry = join(unpacked, binRel);
    return cachedEntry;
  } catch (e) {
    throw new Error(
      `Could not locate the bundled \`skills\` CLI. Tried require.resolve and ${unpacked}. Original: ${(e as Error).message}`,
    );
  }
}

export interface SkillsResult {
  /** Process exit code, or null if killed by signal. */
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface SkillsRunOptions {
  /** Working directory the CLI runs in. Defaults to the user's home. */
  cwd?: string;
  /** Extra environment variables merged on top of process.env. */
  env?: Record<string, string>;
  /** Hard timeout in ms. Default 5 minutes. */
  timeoutMs?: number;
}

/**
 * Spawns the bundled skills CLI with the given args. Resolves with stdout,
 * stderr, and exit code regardless of success/failure — the renderer is
 * responsible for inspecting `code` and surfacing errors. We never throw
 * for a non-zero exit because that's expected for things like
 * `skills find <unknown>`.
 */
export function runSkillsCli(
  args: string[],
  options: SkillsRunOptions = {},
): Promise<SkillsResult> {
  const entry = resolveSkillsEntry();
  const cwd = options.cwd ?? app.getPath("home");
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;

  log.info(`skills-cli: spawn node ${entry} ${args.join(" ")} (cwd=${cwd})`);

  return new Promise<SkillsResult>((resolve) => {
    // execPath is Electron's bundled Node binary. Setting ELECTRON_RUN_AS_NODE
    // tells Electron to behave as a plain Node interpreter, so we can run
    // the CLI script without shipping a separate `node` binary.
    const child = spawn(process.execPath, [entry, ...args], {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        ...options.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      log.error(`skills-cli: spawn error: ${err.message}`);
      resolve({ code: null, stdout, stderr: stderr + `\n[spawn error] ${err.message}` });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      log.info(
        `skills-cli: exit code=${code}${killed ? " (killed by timeout)" : ""}`,
      );
      resolve({ code, stdout, stderr });
    });
  });
}

// ── Convenience wrappers for the CLI subcommands ────────────────────────
//
// These exist so the renderer can call high-level methods like
// `skills.list()` instead of constructing argv arrays. Each one mirrors
// a `skills <subcommand>` from vercel-labs/skills. Free-form args are
// supported via the underlying `runSkillsCli` for anything we don't
// model explicitly.

export function skillsList(opts: SkillsRunOptions = {}): Promise<SkillsResult> {
  return runSkillsCli(["list"], opts);
}

export function skillsFind(query: string, opts: SkillsRunOptions = {}): Promise<SkillsResult> {
  return runSkillsCli(["find", query], opts);
}

export function skillsAdd(source: string, opts: SkillsRunOptions = {}): Promise<SkillsResult> {
  return runSkillsCli(["add", source], opts);
}

export function skillsRemove(name: string, opts: SkillsRunOptions = {}): Promise<SkillsResult> {
  return runSkillsCli(["remove", name], opts);
}

export function skillsCheck(opts: SkillsRunOptions = {}): Promise<SkillsResult> {
  return runSkillsCli(["check"], opts);
}

export function skillsInit(opts: SkillsRunOptions = {}): Promise<SkillsResult> {
  return runSkillsCli(["init"], opts);
}

// ── Streaming exec API ──────────────────────────────────────────────────
//
// The PrimeVue <Terminal> view wants live output as the CLI runs, not a
// single payload after it exits. `startSkillsCli` returns a job id and
// invokes `onChunk` for every chunk of stdout/stderr, then `onExit` once.
// `cancelSkillsJob(id)` SIGTERMs a still-running job.

export interface SkillsChunkEvent {
  jobId: string;
  stream: "stdout" | "stderr";
  text: string;
}

export interface SkillsExitEvent {
  jobId: string;
  code: number | null;
  /** True if we killed it via timeout or `cancelSkillsJob`. */
  killed: boolean;
}

const liveJobs = new Map<string, ChildProcess>();

export function startSkillsCli(
  args: string[],
  opts: SkillsRunOptions,
  onChunk: (e: SkillsChunkEvent) => void,
  onExit: (e: SkillsExitEvent) => void,
): string {
  const entry = resolveSkillsEntry();
  const cwd = opts.cwd ?? app.getPath("home");
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const jobId = randomUUID();

  log.info(`skills-cli: stream start jobId=${jobId} args=${args.join(" ")}`);

  const child = spawn(process.execPath, [entry, ...args], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      // Force the CLI to assume a TTY-like environment so it doesn't
      // strip ANSI colors. Most CLIs check `process.stdout.isTTY` and we
      // can't fake that, but FORCE_COLOR is the universal escape hatch.
      FORCE_COLOR: "1",
      ...opts.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  liveJobs.set(jobId, child);
  let killed = false;

  const timer = setTimeout(() => {
    killed = true;
    child.kill("SIGKILL");
  }, timeoutMs);

  child.stdout?.on("data", (chunk: Buffer) => {
    onChunk({ jobId, stream: "stdout", text: chunk.toString("utf8") });
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    onChunk({ jobId, stream: "stderr", text: chunk.toString("utf8") });
  });
  child.on("error", (err) => {
    onChunk({ jobId, stream: "stderr", text: `[spawn error] ${err.message}\n` });
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    liveJobs.delete(jobId);
    log.info(`skills-cli: stream exit jobId=${jobId} code=${code} killed=${killed}`);
    onExit({ jobId, code, killed });
  });

  return jobId;
}

export function cancelSkillsJob(jobId: string): boolean {
  const child = liveJobs.get(jobId);
  if (!child) return false;
  child.kill("SIGTERM");
  return true;
}
