<script setup lang="ts">
import TopBar from "@/components/layout/TopBar.vue";
import SideBar from "@/components/layout/SideBar.vue";
</script>

<template>
  <div class="flex h-full w-full flex-col bg-page">
    <TopBar />
    <div class="flex flex-1 overflow-hidden">
      <SideBar />
      <main class="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <slot />
      </main>
    </div>
  </div>
</template>
