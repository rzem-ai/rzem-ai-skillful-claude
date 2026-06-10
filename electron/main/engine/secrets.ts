// Secret hygiene. Values that look like tokens are masked by default; the
// renderer reveals per-field. Masked values never end up in diffs unless the
// user explicitly reveals them.

const TOKEN_PREFIXES = [/^npm_[A-Za-z0-9]{8,}/, /^ghp_[A-Za-z0-9]{20,}/, /^gho_[A-Za-z0-9]{20,}/, /^sk-[A-Za-z0-9-]{16,}/, /^xox[baprs]-[A-Za-z0-9-]{8,}/, /^Bearer\s+[A-Za-z0-9._-]{12,}/];

// Matched against whole words of the key name, not substrings — "PAT" must
// not match "path", "pattern", or "compatible".
const SECRET_WORDS = new Set(['token', 'secret', 'password', 'passwd', 'key', 'apikey', 'pat', 'credential', 'credentials']);

// Words that mark the key as *metadata about* a secret-ish thing, not the
// thing itself — "claudeCodeFirstTokenDate" is a date, not a token.
const METADATA_WORDS = new Set(['date', 'time', 'timestamp', 'at', 'count', 'counts', 'limit', 'limits', 'usage', 'total', 'max', 'min', 'num', 'number', 'enabled', 'disabled', 'dismissed', 'checked', 'shown', 'version']);

// ISO-8601-ish dates ("2025-06-15", "2025-06-15T03:16:53.369Z") are never
// secrets, whatever the key is called.
const DATE_VALUE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;

// Split a key name into words across snake_case, kebab-case, dots, and
// camelCase boundaries: "ANTHROPIC_API_KEY" → [anthropic, api, key],
// "githubPat" → [github, pat], "path" → [path].
function nameWords(name: string): string[] {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .map((w) => w.toLowerCase())
        .filter(Boolean);
}

export function looksSecret(name: string, value: unknown): boolean {
    if (typeof value !== 'string' || value.length < 10) return false;
    if (TOKEN_PREFIXES.some((re) => re.test(value))) return true;
    if (value.length >= 12 && !DATE_VALUE.test(value)) {
        const words = nameWords(name);
        if (words.some((w) => SECRET_WORDS.has(w)) && !words.some((w) => METADATA_WORDS.has(w))) return true;
    }
    return false;
}

// "npm_4xK9…" → "npm_••••••••••••". Generic values → first 4 chars + dots.
export function maskValue(value: string): string {
    const prefix = value.match(/^([A-Za-z]+_)/);
    if (prefix) return prefix[1] + '••••••••••••';
    return value.slice(0, 4) + '••••••••••••';
}
