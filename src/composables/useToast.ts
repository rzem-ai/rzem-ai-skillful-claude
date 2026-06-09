import { ref } from 'vue';

// Lightweight global toast queue. A single <ToastHost> renders the list;
// any component calls toast(...) to push one. Ported from Shell.toast —
// auto-dismiss after ~4.2s, optional inline action.

export interface Toast {
    id: number;
    msg: string;
    icon: string;
    actionLabel?: string;
    action?: () => void;
}

const toasts = ref<Toast[]>([]);
let seq = 0;

export function toast(msg: string, icon = 'check', actionLabel?: string, action?: () => void): void {
    const id = ++seq;
    toasts.value.push({ id, msg, icon, actionLabel, action });
    setTimeout(() => dismiss(id), 4200);
}

export function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function useToast() {
    return { toasts, toast, dismiss };
}
