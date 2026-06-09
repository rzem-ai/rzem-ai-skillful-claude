// Backup manager. Before every write we snapshot the current file under a
// sibling `.backups/` directory with a timestamped name, and retain only the
// five most recent — mirroring Claude Code's own five-backup behaviour.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const RETAIN = 5;

export function backupFile(targetPath: string): string | undefined {
    if (!existsSync(targetPath)) return undefined; // nothing to back up (new file)
    const dir = join(dirname(targetPath), '.backups');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${basename(targetPath)}.${stamp}.bak`;
    const dest = join(dir, name);
    copyFileSync(targetPath, dest);
    prune(dir, basename(targetPath));
    return dest;
}

function prune(dir: string, baseName: string): void {
    let files: string[];
    try {
        files = readdirSync(dir).filter((f) => f.startsWith(baseName + '.') && f.endsWith('.bak'));
    } catch {
        return;
    }
    const sorted = files
        .map((f) => ({ f, m: safeMtime(join(dir, f)) }))
        .sort((a, b) => b.m - a.m)
        .map((x) => x.f);
    for (const stale of sorted.slice(RETAIN)) {
        try {
            unlinkSync(join(dir, stale));
        } catch {
            /* best effort */
        }
    }
}

function safeMtime(p: string): number {
    try {
        return statSync(p).mtimeMs;
    } catch {
        return 0;
    }
}
