// Secret detection is a heuristic over key names + value shapes. The key-name
// match must be word-based: "PAT" as a substring famously matches "path",
// which flagged plugin marketplace directory paths as secrets.

import { describe, expect, it } from 'vitest';
import { looksSecret, maskValue } from '../secrets.js';

describe('looksSecret', () => {
    it('flags well-known token value shapes regardless of key name', () => {
        expect(looksSecret('whatever', 'npm_abcDEF123456')).toBe(true);
        expect(looksSecret('whatever', 'ghp_' + 'a'.repeat(24))).toBe(true);
        expect(looksSecret('whatever', 'sk-ant-api03-abcdef123456')).toBe(true);
    });

    it('flags secret-named keys with long string values', () => {
        expect(looksSecret('NPM_TOKEN', 'hunter2hunter2')).toBe(true);
        expect(looksSecret('ANTHROPIC_API_KEY', 'hunter2hunter2')).toBe(true);
        expect(looksSecret('githubPat', 'hunter2hunter2')).toBe(true);
        expect(looksSecret('apiKey', 'hunter2hunter2')).toBe(true);
        expect(looksSecret('db-password', 'hunter2hunter2')).toBe(true);
    });

    it('does not match secret words as substrings (the "path" regression)', () => {
        expect(looksSecret('path', '/Users/alex/Dev/Work/ai/some-plugin')).toBe(false);
        expect(looksSecret('pattern', 'some-long-glob-pattern/**/*.ts')).toBe(false);
        expect(looksSecret('compatible', 'claude-code >= 2.1.100')).toBe(false);
        expect(looksSecret('keyboardShortcuts', 'cmd+shift+p and friends')).toBe(false);
        expect(looksSecret('monkeypatch', 'definitely-not-a-secret')).toBe(false);
    });

    it('does not flag metadata about secrets (the "claudeCodeFirstTokenDate" regression)', () => {
        expect(looksSecret('claudeCodeFirstTokenDate', '2025-06-15T03:16:53.369Z')).toBe(false);
        expect(looksSecret('tokenUsageTotal', 'a-long-ish-string-value')).toBe(false);
        expect(looksSecret('apiKeyLastChecked', '2026-01-02')).toBe(false);
        expect(looksSecret('keyboardShortcutsVersion', 'something-long-here')).toBe(false);
    });

    it('never flags ISO-date values regardless of key name', () => {
        expect(looksSecret('NPM_TOKEN', '2025-06-15T03:16:53.369Z')).toBe(false);
        expect(looksSecret('API_KEY', '2025-06-15 03:16:53')).toBe(false);
    });

    it('ignores non-strings and short values', () => {
        expect(looksSecret('SECRET', 'short')).toBe(false);
        expect(looksSecret('TOKEN', 12345678901234 as unknown)).toBe(false);
        expect(looksSecret('API_KEY', true as unknown)).toBe(false);
    });
});

describe('maskValue', () => {
    it('keeps a recognisable prefix', () => {
        expect(maskValue('npm_abcDEF123456')).toBe('npm_••••••••••••');
        expect(maskValue('/Users/alex/secret')).toBe('/Use••••••••••••');
    });
});
