import { ref } from 'vue';

// Theme is stored on <html data-theme="..."> and persisted to localStorage.
// Light is the default theme; dark is an opt-in override. Ported from
// the prototype's theme toggle (localStorage key kept app-scoped).

const STORAGE_KEY = 'sc:theme';
type Theme = 'dark' | 'light';

const theme = ref<Theme>('light');

function apply(next: Theme): void {
    theme.value = next;
    document.documentElement.setAttribute('data-theme', next);
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        /* localStorage unavailable — ignore */
    }
}

/** Read any persisted theme and apply it. Call once on app boot. */
export function initTheme(): void {
    let stored: Theme | null = null;
    try {
        stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    } catch {
        /* ignore */
    }
    apply(stored ?? 'light');
}

export function useTheme() {
    function toggle(): void {
        apply(theme.value === 'light' ? 'dark' : 'light');
    }
    return { theme, toggle };
}
