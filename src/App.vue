<script setup lang="ts">
import { onMounted } from 'vue';
import Icon from '@/components/Icon.vue';
import ToastHost from '@/components/ToastHost.vue';
import { useConfigStore } from '@/stores/config';

// Load the engine snapshot once at boot and subscribe to live file-watcher
// updates; every screen reads from the store thereafter.
const config = useConfigStore();
onMounted(() => void config.init());
</script>

<template>
    <RouterView />
    <ToastHost />
    <!-- Engine failures would otherwise leave every screen on a silent empty
         state — surface them once, globally, with a retry. -->
    <div v-if="config.error" class="engine-error" role="alert">
        <Icon name="xcircle" :size="14" />
        <span class="msg">{{ config.error }}</span>
        <button class="btn sm" @click="config.init()">Retry</button>
        <button class="icon-btn" aria-label="Dismiss" @click="config.error = null"><Icon name="xcircle" :size="13" /></button>
    </div>
</template>

<style scoped>
.engine-error {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: min(640px, calc(100vw - 32px));
    padding: 9px 12px;
    border: 1px solid var(--err);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--err);
    box-shadow: var(--shadow-pop);
    font-size: var(--t-body);
}
.engine-error .msg {
    color: var(--fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
