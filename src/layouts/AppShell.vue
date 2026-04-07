<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { Icon } from "@iconify/vue";
import TopBar from "@/components/layout/TopBar.vue";
import SideBar from "@/components/layout/SideBar.vue";
import { useConfigStore } from "@/stores/config";

// Single boot point for the whole app: as soon as the shell mounts we kick
// off `loadClaudeConfig()` and keep the rest of the UI gated on its loading
// state. The shell owns both the top bar and the sidebar, so every child
// view can assume `config` is populated (or an error banner is showing).
const configStore = useConfigStore();
const { loading, error, config } = storeToRefs(configStore);

onMounted(() => {
  configStore.loadAll();
});
</script>

<template>
  <div class="flex h-full w-full flex-col bg-page">
    <TopBar />
    <div class="flex flex-1 overflow-hidden">
      <SideBar />
      <main class="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <!-- Loading overlay: shown on the very first load and during
             subsequent reloads. Doesn't unmount the child view so in-flight
             editor state survives reloads triggered by save actions. -->
        <div
          v-if="loading && !config"
          class="flex flex-1 items-center justify-center"
        >
          <div class="flex flex-col items-center gap-3 text-soft">
            <Icon icon="lucide:loader-2" class="h-6 w-6 animate-spin" />
            <p class="text-[13px]">Loading Claude configuration…</p>
          </div>
        </div>

        <!-- Error panel: shown when ~/.claude.json can't be read or parsed.
             The retry button re-runs loadAll() so transient FS issues are
             recoverable without a full app restart. -->
        <div
          v-else-if="error"
          class="flex flex-1 items-center justify-center"
        >
          <div
            class="flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface p-6 text-center"
          >
            <Icon icon="lucide:alert-triangle" class="h-6 w-6 text-skill" />
            <div>
              <h2 class="text-[14px] font-semibold text-strong">
                Couldn't load Claude config
              </h2>
              <p class="mt-1 text-[12px] text-soft">{{ error }}</p>
            </div>
            <button
              type="button"
              class="rounded-md bg-strong px-3.5 py-1.5 text-[12px] font-semibold text-surface transition hover:opacity-90"
              @click="configStore.loadAll()"
            >
              Retry
            </button>
          </div>
        </div>

        <slot v-else />
      </main>
    </div>
  </div>
</template>
