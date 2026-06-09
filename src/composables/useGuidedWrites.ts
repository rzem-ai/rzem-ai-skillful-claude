// Shared write-flow for the guided config forms. Each form stages a list of
// pending ChangeOps, optionally previews the file + effective-config diff, then
// commits them through the store (atomic write + backup). Extracted so every
// guided page drives the same apply bar + diff modal instead of re-deriving it.

import { computed, ref } from 'vue';
import { toast } from '@/composables/useToast';
import { useConfigStore } from '@/stores/config';
import type { ChangeOp, DiffLine } from '@shared/contract';

export interface PendingChange {
    id: string; // stable identity, so re-editing the same target replaces it
    label: string;
    op: ChangeOp;
}

export function useGuidedWrites(opts: { onDiscard?: () => void } = {}) {
    const config = useConfigStore();

    const pending = ref<PendingChange[]>([]);
    const showDiff = ref(true);
    const modalOpen = ref(false);
    const fileLines = ref<DiffLine[]>([]);
    const effLines = ref<DiffLine[]>([]);

    const count = computed(() => pending.value.length);
    const canApply = computed(() => pending.value.length > 0);

    function register(id: string, label: string, op: ChangeOp): void {
        const i = pending.value.findIndex((p) => p.id === id);
        if (i >= 0) pending.value[i] = { id, label, op };
        else pending.value.push({ id, label, op });
    }
    function unregister(id: string): void {
        pending.value = pending.value.filter((p) => p.id !== id);
    }

    function discard(): void {
        pending.value = [];
        opts.onDiscard?.();
        toast('Pending changes discarded', 'check');
    }

    async function buildPreview(): Promise<void> {
        const file: DiffLine[] = [];
        const eff: DiffLine[] = [];
        for (const p of pending.value) {
            const { preview, blocked } = await config.previewChange(p.op);
            if (blocked) {
                toast(blocked, 'alert');
                continue;
            }
            if (preview) {
                file.push(...preview.file.lines);
                eff.push(...preview.effective);
            }
        }
        fileLines.value = file;
        effLines.value = eff;
    }

    async function apply(): Promise<void> {
        if (pending.value.length === 0) return;
        if (showDiff.value) {
            await buildPreview();
            modalOpen.value = true;
        } else {
            await commit();
        }
    }
    function closeDiff(): void {
        modalOpen.value = false;
    }
    async function confirmDiff(): Promise<void> {
        modalOpen.value = false;
        await commit();
    }

    async function commit(): Promise<void> {
        const ops = [...pending.value];
        let ok = 0;
        let backup: string | undefined;
        for (const p of ops) {
            const res = await config.applyChange(p.op);
            if (res.ok) {
                ok++;
                backup = res.backupPath ?? backup;
            } else {
                toast(res.blocked ?? res.error ?? 'Write failed', 'alert');
            }
        }
        pending.value = [];
        if (ok > 0) toast(`${ok} change${ok > 1 ? 's' : ''} written${backup ? ' · backup created' : ''}`, 'check');
    }

    return { pending, showDiff, modalOpen, fileLines, effLines, count, canApply, register, unregister, discard, apply, closeDiff, confirmDiff };
}
