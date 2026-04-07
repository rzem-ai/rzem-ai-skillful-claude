// Typed accessors for the parts of `~/.claude.json` (and per-project config
// objects inside its `projects` map) that the UI actually needs to read.
//
// The Rust backend returns these as open `serde_json::Value` / `unknown`
// because the Claude Code settings schema is still in flux. Rather than
// scatter `as any` casts across every view, we centralize them here as a
// single boundary — every caller goes through one of these helpers.

/** Narrows `unknown` to a plain object or null — everything else is "not an object". */
function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Narrows `unknown` to `string[]`, dropping non-string entries. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Extract the `mcpServers` map from a raw config value. The key is the
 * server name; the value is a server config object we pass through as-is.
 */
export function getMcpServers(raw: unknown): Record<string, unknown> {
  const obj = asObject(raw);
  if (!obj) return {};
  const servers = asObject(obj.mcpServers);
  return servers ?? {};
}

/** Top-level or per-project `allowedTools` list, or `[]` if absent. */
export function getAllowedTools(raw: unknown): string[] {
  const obj = asObject(raw);
  if (!obj) return [];
  return asStringArray(obj.allowedTools);
}

/** Top-level or per-project `disabledTools` list, or `[]` if absent. */
export function getDisabledTools(raw: unknown): string[] {
  const obj = asObject(raw);
  if (!obj) return [];
  return asStringArray(obj.disabledTools);
}

/**
 * Per-project `disabledMcpServers` array, or `[]`. Claude Code writes these
 * when a user disables a globally-configured MCP server at the project level.
 */
export function getDisabledMcpServers(raw: unknown): string[] {
  const obj = asObject(raw);
  if (!obj) return [];
  return asStringArray(obj.disabledMcpServers);
}

/**
 * `enabledPlugins` map from `~/.claude/settings.json` (note: settings JSON,
 * not `~/.claude.json`). Shape is `{ "plugin@marketplace": boolean }`.
 */
export function getEnabledPlugins(settingsRaw: unknown): Record<string, boolean> {
  const obj = asObject(settingsRaw);
  if (!obj) return {};
  const plugins = asObject(obj.enabledPlugins);
  if (!plugins) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(plugins)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Last path segment (project name) from an absolute path. Falls back to the full path. */
export function basename(path: string): string {
  if (!path) return path;
  const trimmed = path.replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/** `~/.claude/CLAUDE.md` → `~/.claude/CLAUDE.md` (homedir collapsed). */
export function tildify(path: string, home: string | null | undefined): string {
  if (!home || !path.startsWith(home)) return path;
  return "~" + path.slice(home.length);
}

/**
 * Formats a POSIX-seconds timestamp as a relative phrase like
 * "just now", "3 minutes ago", "2 hours ago", "5 days ago". Returns `—`
 * when the timestamp is null so callers don't have to guard.
 */
export function relativeTime(unixSeconds: number | null | undefined): string {
  if (unixSeconds === null || unixSeconds === undefined) return "—";
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, now - unixSeconds);

  if (delta < 45) return "just now";
  if (delta < 90) return "a minute ago";
  const minutes = Math.round(delta / 60);
  if (minutes < 45) return `${minutes} minutes ago`;
  if (minutes < 90) return "an hour ago";
  const hours = Math.round(minutes / 60);
  if (hours < 22) return `${hours} hours ago`;
  if (hours < 36) return "a day ago";
  const days = Math.round(hours / 24);
  if (days < 26) return `${days} days ago`;
  if (days < 45) return "a month ago";
  const months = Math.round(days / 30);
  if (months < 11) return `${months} months ago`;
  const years = Math.round(days / 365);
  return years <= 1 ? "a year ago" : `${years} years ago`;
}

/** Formats a byte count as `1.2 KB`, `4.8 MB`, etc. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
