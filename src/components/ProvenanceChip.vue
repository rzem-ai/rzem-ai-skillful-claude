<script setup lang="ts">
import { computed } from "vue";
import Icon from "@/components/Icon.vue";
import { SCOPES, type ScopeId } from "@/lib/scopes";

// The signature component: scope color + icon + label, with an optional
// hover card showing the source file path and last-modified. Ported from
// the prototype's chip() helper.
const props = defineProps<{
  scope: ScopeId;
  solid?: boolean;
  ghosted?: boolean;
  path?: string;
  meta?: string;
}>();

const meta = computed(() => SCOPES[props.scope]);
</script>

<template>
  <span
    class="chip"
    :class="{ solid, ghosted }"
    :data-scope="scope"
    :data-path="path ? '1' : undefined"
    :tabindex="path ? 0 : undefined"
  >
    <Icon :name="meta.icon" :size="11" />{{ meta.label }}
    <span v-if="path" class="chip-card">
      <div class="cc-path">{{ path }}</div>
      <div v-if="meta && props.meta" class="cc-meta">{{ props.meta }}</div>
    </span>
  </span>
</template>
