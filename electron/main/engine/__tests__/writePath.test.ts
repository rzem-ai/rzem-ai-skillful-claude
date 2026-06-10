// saveFile takes a renderer-supplied absolute path, so the allowlist is the
// only thing standing between the IPC surface and an arbitrary-file write.

import { describe, expect, it } from 'vitest';
import { isAllowedWritePath } from '../../writing/apply.js';
import type { EngineEnv } from '../env.js';

const env: EngineEnv = {
    home: '/Users/test',
    platform: 'darwin',
    vars: {},
    projectDir: '/Users/test/proj',
    managedDir: '/Library/Application Support/ClaudeCode',
};

describe('isAllowedWritePath', () => {
    it('allows the user settings tree and global state file', () => {
        expect(isAllowedWritePath('/Users/test/.claude/settings.json', env)).toBe(true);
        expect(isAllowedWritePath('/Users/test/.claude/agents/foo.md', env)).toBe(true);
        expect(isAllowedWritePath('/Users/test/.claude.json', env)).toBe(true);
    });

    it('allows project config files', () => {
        expect(isAllowedWritePath('/Users/test/proj/.claude/settings.local.json', env)).toBe(true);
        expect(isAllowedWritePath('/Users/test/proj/.mcp.json', env)).toBe(true);
        expect(isAllowedWritePath('/Users/test/proj/CLAUDE.md', env)).toBe(true);
        expect(isAllowedWritePath('/Users/test/proj/CLAUDE.local.md', env)).toBe(true);
    });

    it('refuses everything else', () => {
        expect(isAllowedWritePath('/etc/hosts', env)).toBe(false);
        expect(isAllowedWritePath('/Users/test/.ssh/authorized_keys', env)).toBe(false);
        expect(isAllowedWritePath('/Users/test/proj/src/index.ts', env)).toBe(false);
        expect(isAllowedWritePath('/Users/test/.claude', env)).toBe(false); // the dir itself, not a file in it
        expect(isAllowedWritePath('/Library/Application Support/ClaudeCode/managed-settings.json', env)).toBe(false);
    });

    it('refuses dot-dot traversal out of allowed dirs', () => {
        expect(isAllowedWritePath('/Users/test/.claude/../.ssh/config', env)).toBe(false);
        expect(isAllowedWritePath('/Users/test/proj/.claude/../../other/CLAUDE.md', env)).toBe(false);
    });

    it('refuses project files when no project is selected', () => {
        const noProj = { ...env, projectDir: null };
        expect(isAllowedWritePath('/Users/test/proj/.mcp.json', noProj)).toBe(false);
        expect(isAllowedWritePath('/Users/test/.claude/settings.json', noProj)).toBe(true);
    });
});
