<script setup lang="ts">
import Icon from '@/components/Icon.vue';
import { useToast } from '@/composables/useToast';

const { toasts, dismiss } = useToast();

function onAction(id: number, action?: () => void): void {
    action?.();
    dismiss(id);
}
</script>

<template>
    <div v-if="toasts.length" class="toast-wrap">
        <div v-for="t in toasts" :key="t.id" class="toast">
            <span class="t-ico"><Icon :name="t.icon" :size="15" /></span>
            <span>{{ t.msg }}</span>
            <span v-if="t.actionLabel" class="t-act" @click="onAction(t.id, t.action)">{{ t.actionLabel }}</span>
        </div>
    </div>
</template>
