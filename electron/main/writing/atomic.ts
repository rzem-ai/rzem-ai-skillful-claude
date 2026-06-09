// Atomic writes: render to a temp file in the same directory, fsync, then
// rename over the target. A rename is atomic on the same filesystem, so a
// crash mid-write never leaves a half-written config behind.

import { closeSync, mkdirSync, openSync, renameSync, writeSync, fsyncSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function atomicWrite(targetPath: string, content: string): void {
    const dir = dirname(targetPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = join(dir, `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    const fd = openSync(tmp, 'w');
    try {
        writeSync(fd, content);
        fsyncSync(fd);
    } finally {
        closeSync(fd);
    }
    renameSync(tmp, targetPath);
}
