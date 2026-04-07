<script setup lang="ts">
import { Icon } from "@iconify/vue";

defineEmits<{
  (e: "add-node"): void;
  (e: "group"): void;
  (e: "align"): void;
  (e: "delete"): void;
  (e: "zoom-in"): void;
  (e: "zoom-out"): void;
  (e: "fit-view"): void;
  (e: "split"): void;
}>();
</script>

<template>
  <div
    class="flex h-[50px] items-center justify-between rounded-[10px] border border-line bg-surface px-3"
  >
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-[7px] bg-page px-3 text-[12px] font-semibold text-strong transition hover:bg-brand-tint"
        @click="$emit('add-node')"
      >
        <Icon icon="lucide:plus" class="h-3.5 w-3.5" />
        Add Node
      </button>
      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-[7px] px-3 text-[12px] font-medium text-body transition hover:bg-page"
        @click="$emit('group')"
      >
        <Icon icon="lucide:group" class="h-3.5 w-3.5" />
        Group
      </button>
      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-[7px] px-3 text-[12px] font-medium text-body transition hover:bg-page"
        @click="$emit('align')"
      >
        <Icon icon="lucide:align-center-horizontal" class="h-3.5 w-3.5" />
        Align
      </button>
      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-[7px] px-3 text-[12px] font-medium text-body transition hover:bg-page"
        @click="$emit('delete')"
      >
        <Icon icon="lucide:trash-2" class="h-3.5 w-3.5" />
        Delete
      </button>
    </div>

    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-body transition hover:border-brand-tint-border"
        @click="$emit('zoom-out')"
      >
        <Icon icon="lucide:zoom-out" class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-body transition hover:border-brand-tint-border"
        @click="$emit('fit-view')"
      >
        <Icon icon="lucide:maximize" class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-body transition hover:border-brand-tint-border"
        @click="$emit('split')"
      >
        <Icon icon="lucide:columns-2" class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line bg-surface text-body transition hover:border-brand-tint-border"
        @click="$emit('zoom-in')"
      >
        <Icon icon="lucide:zoom-in" class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
