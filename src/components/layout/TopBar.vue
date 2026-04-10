<script setup lang="ts">
import { Icon } from "@iconify/vue";
import iconUrl from "@/assets/icon.svg";
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-6"
  >
    <!-- Left: brand -->
    <div class="flex items-center gap-3">
      <img :src="iconUrl" alt="Skillful Claude" class="h-8 w-8 rounded-lg" />
      <span class="text-[15px] font-semibold text-strong">Skillful Claude</span>
    </div>

    <!-- Right: search + actions + avatar -->
    <div class="flex items-center gap-3">
      <div
        class="flex h-9 w-[280px] items-center gap-2.5 rounded-lg border border-line bg-page px-3"
      >
        <Icon icon="lucide:search" class="h-3.5 w-3.5 text-muted" />
        <span class="flex-1 truncate text-[12px] text-muted">
          Search instructions, skills, tools…
        </span>
        <span
          class="flex h-[18px] items-center justify-center rounded border border-line bg-surface px-1.5 text-[10px] font-medium text-muted"
        >
          ⌘K
        </span>
      </div>

      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface transition hover:border-brand-tint-border"
        title="Documentation"
      >
        <Icon icon="lucide:book-open" class="h-4 w-4 text-body" />
      </button>

      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-surface"
      >
        <Icon icon="lucide:user" class="h-4 w-4" />
      </div>
    </div>
  </header>
</template>
