import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// The config engine is pure Node logic, so the suite runs in the node
// environment with no Electron. Tests point the engine's injectable env at the
// committed fixture tree and assert the documented ground-truth.
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@shared': fileURLToPath(new URL('./electron/shared', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['electron/**/*.test.ts'],
    },
});
