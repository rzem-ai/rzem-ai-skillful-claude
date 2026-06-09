// Engine environment — everything the engine needs to know about the host,
// fully injectable so tests can point it at a fixture tree instead of the
// real machine. Nothing here touches Electron.

import { homedir, platform as osPlatform } from 'node:os';
import { join } from 'node:path';

export interface EngineEnv {
    home: string;
    platform: NodeJS.Platform;
    vars: Record<string, string | undefined>;
    projectDir: string | null;
    // Managed tier location. Overridable so tests don't need to write to
    // /etc. The base file lives at `<managedDir>/managed-settings.json`, the
    // drop-in fragments at `<managedDir>/managed-settings.d/*.json`, and the
    // managed MCP policy at `<managedDir>/managed-mcp.json`.
    managedDir: string;
}

// Default managed-settings directory by OS (configuration-guide §8).
export function defaultManagedDir(platform: NodeJS.Platform): string {
    switch (platform) {
        case 'darwin':
            return '/Library/Application Support/ClaudeCode';
        case 'win32':
            return 'C:\\Program Files\\ClaudeCode';
        default:
            return '/etc/claude-code';
    }
}

// Build the live environment from the real process. The renderer drives
// projectDir through the project switcher.
export function liveEnv(projectDir: string | null): EngineEnv {
    const platform = osPlatform();
    return {
        home: homedir(),
        platform,
        vars: process.env,
        projectDir,
        managedDir: defaultManagedDir(platform),
    };
}

// Map an absolute path to its short display form (~/… and project-relative).
export function displayPath(abs: string, env: EngineEnv): string {
    if (env.projectDir && abs.startsWith(env.projectDir + '/')) {
        return abs.slice(env.projectDir.length + 1);
    }
    if (abs === env.projectDir) return '.';
    if (abs.startsWith(env.home + '/')) {
        return '~/' + abs.slice(env.home.length + 1);
    }
    return abs;
}

// Canonical file locations for the current environment.
export function paths(env: EngineEnv) {
    const claudeDir = join(env.home, '.claude');
    const proj = env.projectDir;
    return {
        managedBase: join(env.managedDir, 'managed-settings.json'),
        managedDropinDir: join(env.managedDir, 'managed-settings.d'),
        managedMcp: join(env.managedDir, 'managed-mcp.json'),
        userSettings: join(claudeDir, 'settings.json'),
        globalState: join(env.home, '.claude.json'),
        userMemory: join(claudeDir, 'CLAUDE.md'),
        userAgents: join(claudeDir, 'agents'),
        userSkills: join(claudeDir, 'skills'),
        userCommands: join(claudeDir, 'commands'),
        userOutputStyles: join(claudeDir, 'output-styles'),
        autoMemoryRoot: join(claudeDir, 'projects'),
        projectSettings: proj ? join(proj, '.claude', 'settings.json') : null,
        localSettings: proj ? join(proj, '.claude', 'settings.local.json') : null,
        projectMcp: proj ? join(proj, '.mcp.json') : null,
        projectMemory: proj ? join(proj, 'CLAUDE.md') : null,
        projectMemoryAlt: proj ? join(proj, '.claude', 'CLAUDE.md') : null,
        localMemory: proj ? join(proj, 'CLAUDE.local.md') : null,
        projectAgents: proj ? join(proj, '.claude', 'agents') : null,
        projectSkills: proj ? join(proj, '.claude', 'skills') : null,
        projectCommands: proj ? join(proj, '.claude', 'commands') : null,
        projectOutputStyles: proj ? join(proj, '.claude', 'output-styles') : null,
        gitignore: proj ? join(proj, '.gitignore') : null,
    };
}
