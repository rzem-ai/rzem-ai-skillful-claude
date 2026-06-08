// Memory map. Reconstructs the CLAUDE.md files Claude loads for this project
// (upward-recursion always-loaded files + lazy subtree files), walks the
// @import graph flagging broken links and cycles, and summarises auto memory.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import type { ImportNode, MemFile, MemoryModel } from '../../shared/contract.js';
import { type EngineEnv, paths, displayPath } from './env.js';

const MAX_DEPTH = 5;

function readIf(path: string): string | null {
    try {
        return statSync(path).isFile() ? readFileSync(path, 'utf8') : null;
    } catch {
        return null;
    }
}

function lineCount(text: string): number {
    return text.split('\n').length;
}

// Extract @import targets, ignoring fenced code blocks (``` … ```).
function parseImports(text: string): string[] {
    const out: string[] = [];
    let inFence = false;
    for (const line of text.split('\n')) {
        if (/^\s*```/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        const m = line.match(/^\s*@([^\s]+)\s*$/);
        if (m) out.push(m[1]);
    }
    return out;
}

function resolveImportPath(spec: string, baseDir: string, env: EngineEnv): string {
    if (spec.startsWith('~/')) return join(env.home, spec.slice(2));
    if (spec.startsWith('/')) return spec;
    return resolvePath(baseDir, spec);
}

export function resolveMemory(env: EngineEnv): MemoryModel {
    const p = paths(env);
    const files: MemFile[] = [];
    let ord = 0;

    const userMem = readIf(p.userMemory);
    if (userMem !== null) {
        files.push({ ord: ++ord, scope: 'user', path: '~/.claude/CLAUDE.md', sub: `${lineCount(userMem)} lines · personal memory · loads always` });
    }

    let projectMemPath: string | null = null;
    let projectMemText: string | null = null;
    if (env.projectDir) {
        for (const candidate of [p.projectMemory!, p.projectMemoryAlt!]) {
            const t = readIf(candidate);
            if (t !== null) {
                projectMemPath = candidate;
                projectMemText = t;
                break;
            }
        }
        if (projectMemText !== null && projectMemPath) {
            const imports = parseImports(projectMemText);
            files.push({
                ord: ++ord,
                scope: 'project',
                path: displayPath(projectMemPath, env),
                sub: imports.length ? `imports ${imports.length} file${imports.length > 1 ? 's' : ''} · loads always` : 'loads always',
                committed: true,
            });
        }
        const localMem = readIf(p.localMemory!);
        if (localMem !== null) {
            files.push({ ord: ++ord, scope: 'local', path: 'CLAUDE.local.md', sub: 'machine-local notes', gitignore: true });
        }
        // Lazy subtree files: CLAUDE.md below the project root.
        for (const rel of findSubtreeMemory(env.projectDir)) {
            files.push({ scope: 'project', path: rel, lazy: true, sub: `loads only when Claude reads files under ${dirname(rel)}/` });
        }
    }

    // Import graph (BFS from project CLAUDE.md, capped at MAX_DEPTH).
    const imports: ImportNode[] = [];
    let maxReached = 0;
    if (projectMemText !== null && projectMemPath) {
        const seen = new Set<string>();
        type Q = { path: string; text: string; depth: number };
        const queue: Q[] = [{ path: projectMemPath, text: projectMemText, depth: 0 }];
        while (queue.length) {
            const cur = queue.shift()!;
            if (cur.depth >= MAX_DEPTH) continue;
            for (const spec of parseImports(cur.text)) {
                const abs = resolveImportPath(spec, dirname(cur.path), env);
                const depth = cur.depth + 1;
                const broken = !existsSync(abs);
                const id = basename(spec).replace(/\.[^.]+$/, '');
                if (seen.has(abs)) continue;
                seen.add(abs);
                imports.push({ id, path: spec, depth, broken });
                if (!broken) {
                    maxReached = Math.max(maxReached, depth);
                    const childText = readIf(abs);
                    if (childText !== null) queue.push({ path: abs, text: childText, depth });
                }
            }
        }
    }

    return {
        files,
        imports,
        maxDepth: MAX_DEPTH,
        maxReached,
        brokenCount: imports.filter((i) => i.broken).length,
        auto: env.projectDir ? readAutoMemory(env) : null,
    };
}

function findSubtreeMemory(projectDir: string, limit = 40): string[] {
    const out: string[] = [];
    const skip = new Set(['node_modules', '.git', 'dist', 'out', '.claude', 'dist-builds']);
    const walk = (dir: string, depth: number): void => {
        if (depth > 3 || out.length >= limit) return;
        let entries: string[] = [];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const name of entries) {
            const full = join(dir, name);
            let st;
            try {
                st = statSync(full);
            } catch {
                continue;
            }
            if (st.isDirectory()) {
                if (skip.has(name)) continue;
                if (existsSync(join(full, 'CLAUDE.md'))) {
                    out.push(join(full.slice(projectDir.length + 1), 'CLAUDE.md'));
                }
                walk(full, depth + 1);
            }
        }
    };
    walk(projectDir, 0);
    return out;
}

function readAutoMemory(env: EngineEnv): MemoryModel['auto'] {
    if (env.vars.CLAUDE_CODE_DISABLE_AUTO_MEMORY === '1') {
        return { enabled: false, entries: 0, directory: '', index: 'MEMORY.md', preview: [] };
    }
    const p = paths(env);
    const encoded = (env.projectDir ?? '').replace(/[/\\]/g, '-');
    const memDir = join(p.autoMemoryRoot, encoded, 'memory');
    const indexPath = join(memDir, 'MEMORY.md');
    const text = readIf(indexPath);
    if (text === null) {
        return { enabled: true, entries: 0, directory: displayPath(memDir, env), index: 'MEMORY.md', preview: [] };
    }
    const bullets = text.split('\n').filter((l) => /^\s*[-*]\s/.test(l));
    return {
        enabled: true,
        entries: bullets.length,
        directory: displayPath(memDir, env),
        index: 'MEMORY.md',
        preview: text.split('\n').slice(0, 6),
    };
}
