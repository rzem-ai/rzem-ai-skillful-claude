// Secret hygiene. Values that look like tokens are masked by default; the
// renderer reveals per-field. Masked values never end up in diffs unless the
// user explicitly reveals them.

const TOKEN_PREFIXES = [/^npm_[A-Za-z0-9]{8,}/, /^ghp_[A-Za-z0-9]{20,}/, /^gho_[A-Za-z0-9]{20,}/, /^sk-[A-Za-z0-9-]{16,}/, /^xox[baprs]-[A-Za-z0-9-]{8,}/, /^Bearer\s+[A-Za-z0-9._-]{12,}/];

const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|_KEY|APIKEY|API_KEY|PAT|CREDENTIAL)/i;

export function looksSecret(name: string, value: unknown): boolean {
    if (typeof value !== 'string' || value.length < 10) return false;
    if (TOKEN_PREFIXES.some((re) => re.test(value))) return true;
    if (SECRET_NAME.test(name) && value.length >= 12) return true;
    return false;
}

// "npm_4xK9…" → "npm_••••••••••••". Generic values → first 4 chars + dots.
export function maskValue(value: string): string {
    const prefix = value.match(/^([A-Za-z]+_)/);
    if (prefix) return prefix[1] + '••••••••••••';
    return value.slice(0, 4) + '••••••••••••';
}
