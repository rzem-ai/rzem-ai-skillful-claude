// Monaco setup: web workers via Vite's `?worker` bundling, plus app-token
// themes. Themes are defined from the live CSS custom properties so the editor
// always matches app.css — re-applied whenever the data-theme toggles.

// Slim build: full editor feature set but only the two languages we render
// (json + markdown) instead of monaco-editor's ~80-language default bundle.
import 'monaco-editor/esm/vs/editor/editor.all.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

export { monaco };

let envReady = false;

export function ensureMonacoEnv(): void {
    if (envReady) return;
    envReady = true;
    (self as unknown as { MonacoEnvironment: object }).MonacoEnvironment = {
        getWorker(_id: string, label: string): Worker {
            return label === 'json' ? new JsonWorker() : new EditorWorker();
        },
    };
}

function cssHex(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    // Monaco only accepts #RGB/#RRGGBB( AA) — skip rgba()/oklab tokens.
    return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback;
}

// Define (or re-define) the app theme from the current CSS tokens and apply it.
export function applyMonacoTheme(theme: 'dark' | 'light'): void {
    const base = theme === 'light' ? 'vs' : 'vs-dark';
    monaco.editor.defineTheme('skillful', {
        base,
        inherit: true,
        rules: [
            { token: 'string.key.json', foreground: cssHex('--syntax-key', '8fd0ff').replace('#', '') },
            { token: 'string.value.json', foreground: cssHex('--syntax-str', '9cdca0').replace('#', '') },
            { token: 'number', foreground: cssHex('--syntax-num', 'e6b673').replace('#', '') },
            { token: 'keyword.json', foreground: cssHex('--syntax-kw', 'c9a0ff').replace('#', '') },
        ],
        colors: {
            'editor.background': cssHex('--surface-1', theme === 'light' ? '#ffffff' : '#111114'),
            'editor.foreground': cssHex('--fg', theme === 'light' ? '#1b1d21' : '#e6e7ea'),
            'editorLineNumber.foreground': cssHex('--fg-faint', '#6c737c'),
            'editorLineNumber.activeForeground': cssHex('--fg-muted', '#9aa1aa'),
        },
    });
    monaco.editor.setTheme('skillful');
}

export function monoFontFamily(): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim();
    return v || 'ui-monospace, Menlo, monospace';
}
