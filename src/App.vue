<script setup lang="ts">
import { onMounted } from 'vue';
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
</template>
