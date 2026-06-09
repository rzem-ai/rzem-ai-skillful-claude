<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import AppToolbar from '@/components/AppToolbar.vue';
import AppSidebar from '@/components/AppSidebar.vue';

// The .app CSS grid expects exactly three children: .toolbar, .sidebar, and
// the view's .main. The matched route component (rendered by <RouterView>)
// supplies .main, so the grid resolves without an extra wrapper element.
const toolbar = ref<InstanceType<typeof AppToolbar> | null>(null);

function onKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toolbar.value?.focusSearch();
    }
}

onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
    <div class="app">
        <AppToolbar ref="toolbar" />
        <AppSidebar />
        <RouterView />
    </div>
</template>
