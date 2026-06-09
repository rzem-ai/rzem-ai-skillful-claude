<script setup lang="ts">
// The sticky footer every guided form shares: pending-change count, the
// preview-diff toggle, and Discard / Apply. Pure presentation — the parent owns
// the write flow (useGuidedWrites) and reacts to the emitted events.
defineProps<{ count: number; canApply: boolean; showDiff: boolean }>();
const emit = defineEmits<{ discard: []; apply: []; 'update:showDiff': [v: boolean] }>();
</script>

<template>
    <div class="applybar">
        <span class="count">
            <b>{{ count }}</b>
            pending change{{ count === 1 ? '' : 's' }}
        </span>
        <label class="chk" :class="{ on: showDiff }">
            <input type="checkbox" :checked="showDiff" @change="emit('update:showDiff', ($event.target as HTMLInputElement).checked)" />
            Preview diff before applying
        </label>
        <div class="spacer"></div>
        <button class="btn" :disabled="!canApply" @click="emit('discard')">Discard</button>
        <button class="btn primary" :disabled="!canApply" @click="emit('apply')">Apply changes</button>
    </div>
</template>

<style scoped>
.applybar {
    position: sticky;
    bottom: 0;
    margin: 18px 0px -28px;
    padding: 12px 20px;
    background: var(--surface-2);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
}
.applybar .count {
    font-size: 12px;
    color: var(--fg-muted);
}
.applybar .count b {
    color: var(--fg);
}
.applybar .spacer {
    flex: 1;
}
</style>
