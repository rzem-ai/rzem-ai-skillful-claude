// Extensions overview. Discovers subagents, skills, slash commands, output
// styles, and plugins across user + project scopes, reads their frontmatter,
// and resolves plugin enable/disable (project enables, local can opt out).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtItem, ExtSection, ExtensionsModel, ScopeId } from '../../shared/contract.js';
import { type EngineEnv, paths } from './env.js';
import type { DiscoveredSources } from './sources.js';

interface Frontmatter {
    name?: string;
    description?: string;
    tools?: string;
}

function readFrontmatter(path: string): Frontmatter {
    let text = '';
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return {};
    }
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return {};
    const fm: Frontmatter = {};
    for (const line of m[1].split('\n')) {
        const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
        if (!kv) continue;
        const key = kv[1];
        let val = kv[2].trim();
        if ((key === 'name' || key === 'description') && (val.startsWith('"') || val.startsWith("'"))) val = val.slice(1, -1);
        if (key === 'name') fm.name = val;
        else if (key === 'description') fm.description = val;
        else if (key === 'tools') fm.tools = val.replace(/[[\]]/g, '');
    }
    return fm;
}

function mdFiles(dir: string | null): string[] {
    if (!dir || !existsSync(dir)) return [];
    try {
        return readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .map((f) => join(dir, f));
    } catch {
        return [];
    }
}

function skillDirs(dir: string | null): string[] {
    if (!dir || !existsSync(dir)) return [];
    try {
        return readdirSync(dir)
            .map((name) => join(dir, name))
            .filter((full) => {
                try {
                    return statSync(full).isDirectory() && existsSync(join(full, 'SKILL.md'));
                } catch {
                    return false;
                }
            });
    } catch {
        return [];
    }
}

export function resolveExtensions(src: DiscoveredSources, env: EngineEnv): ExtensionsModel {
    const p = paths(env);
    const sections: ExtSection[] = [];

    // Subagents
    const agents: ExtItem[] = [];
    for (const [dir, scope] of [
        [p.userAgents, 'user'],
        [p.projectAgents, 'project'],
    ] as [string | null, ScopeId][]) {
        for (const file of mdFiles(dir)) {
            const fm = readFrontmatter(file);
            agents.push({
                name: fm.name ?? base(file).replace(/\.md$/, ''),
                scope,
                icon: 'user',
                desc: fm.description ?? 'Subagent.',
                meta: fm.tools ? `tools: ${fm.tools.replace(/,\s*/g, ' · ')}` : 'subagent',
                file: short(file, env),
            });
        }
    }
    sections.push({ title: 'Subagents', icon: 'user', items: agents });

    // Skills
    const skills: ExtItem[] = [];
    for (const [dir, scope, committed] of [
        [p.userSkills, 'user', false],
        [p.projectSkills, 'project', true],
    ] as [string | null, ScopeId, boolean][]) {
        for (const sd of skillDirs(dir)) {
            const fm = readFrontmatter(join(sd, 'SKILL.md'));
            skills.push({
                name: fm.name ?? base(sd),
                scope,
                icon: 'puzzle',
                desc: fm.description ?? 'Skill.',
                meta: committed ? 'SKILL.md · committed' : 'SKILL.md',
                file: short(join(sd, ''), env),
            });
        }
    }
    sections.push({ title: 'Skills', icon: 'puzzle', items: skills });

    // Slash commands
    const commands: ExtItem[] = [];
    for (const [dir, scope, committed] of [
        [p.userCommands, 'user', false],
        [p.projectCommands, 'project', true],
    ] as [string | null, ScopeId, boolean][]) {
        for (const file of mdFiles(dir)) {
            const fm = readFrontmatter(file);
            commands.push({
                name: '/' + base(file).replace(/\.md$/, ''),
                scope,
                icon: 'terminal',
                desc: fm.description ?? 'Slash command.',
                meta: committed ? 'committed' : 'user',
                file: short(file, env),
            });
        }
    }
    sections.push({ title: 'Slash commands', icon: 'terminal', items: commands });

    // Output styles — the resolved active style plus any defined style files.
    const styles: ExtItem[] = [];
    const activeStyle = resolveScalar(src, 'outputStyle');
    if (activeStyle) {
        styles.push({
            name: String(activeStyle.value),
            scope: activeStyle.scope,
            icon: 'sliders',
            desc: 'Active output style.',
            meta: `active · set in ${activeStyle.scope} settings`,
            file: short(settingsPath(activeStyle.scope, env), env),
        });
    }
    sections.push({ title: 'Output styles', icon: 'sliders', items: styles });

    // Plugins & marketplaces
    const plugins: ExtItem[] = [];
    const projPlugins = obj(src.project.enabledPlugins);
    const localPlugins = obj(src.local.enabledPlugins);
    const userPlugins = obj(src.user.enabledPlugins);
    const names = new Set([...Object.keys(projPlugins), ...Object.keys(localPlugins), ...Object.keys(userPlugins)]);
    for (const name of names) {
        const projVal = projPlugins[name];
        const localVal = localPlugins[name];
        const effective = localVal !== undefined ? localVal : projVal !== undefined ? projVal : userPlugins[name];
        const override = projVal === true && localVal === false;
        plugins.push({
            name,
            scope: 'project',
            icon: 'grid',
            desc: override ? 'Enabled by the team, but turned OFF on this machine.' : effective ? 'Enabled plugin.' : 'Disabled plugin.',
            meta: override ? 'overridden locally' : effective ? 'enabled' : 'disabled',
            file: marketplaceOf(name, src),
            disabled: !effective,
            override,
        });
    }
    sections.push({ title: 'Plugins & marketplaces', icon: 'grid', items: plugins });

    const skillCount = skills.length;
    return {
        sections,
        skillCount,
        skillBudgetNote:
            skillCount === 0
                ? 'No skills discovered — nothing to budget.'
                : `at the current skillListingBudgetFraction, all ${skillCount} skill description${skillCount > 1 ? 's' : ''} fit — none would truncate.`,
    };
}

function base(p: string): string {
    return p.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? p;
}
function short(p: string, env: EngineEnv): string {
    if (env.projectDir && p.startsWith(env.projectDir + '/')) return p.slice(env.projectDir.length + 1);
    if (p.startsWith(env.home + '/')) return '~/' + p.slice(env.home.length + 1);
    return p;
}
function obj(v: unknown): Record<string, boolean> {
    return v && typeof v === 'object' ? (v as Record<string, boolean>) : {};
}
function settingsPath(scope: ScopeId, env: EngineEnv): string {
    const p = paths(env);
    if (scope === 'user') return p.userSettings;
    if (scope === 'project') return p.projectSettings ?? '';
    if (scope === 'local') return p.localSettings ?? '';
    return '';
}
function resolveScalar(src: DiscoveredSources, key: string): { value: unknown; scope: ScopeId } | null {
    const order: [ScopeId, Record<string, unknown>][] = [
        ['managed', src.managed],
        ['local', src.local],
        ['project', src.project],
        ['user', src.user],
    ];
    for (const [scope, o] of order) if (o[key] !== undefined) return { value: o[key], scope };
    return null;
}
function marketplaceOf(plugin: string, src: DiscoveredSources): string {
    const mkt = plugin.split('@')[1];
    const declared = obj2(src.project.extraKnownMarketplaces)[mkt] ?? obj2(src.user.extraKnownMarketplaces)[mkt];
    const source = declared && typeof declared === 'object' ? (declared as Record<string, unknown>).source : undefined;
    if (source && typeof source === 'object') {
        const s = source as Record<string, unknown>;
        if (s.source === 'github' && s.repo) return `${mkt} · github:${s.repo}`;
    }
    return mkt ?? plugin;
}
function obj2(v: unknown): Record<string, unknown> {
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
