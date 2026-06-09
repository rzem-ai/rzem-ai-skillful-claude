<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { resolveIcon, type IconName, type IconVariant } from '@/lib/icons';

const props = withDefaults(
    defineProps<{ name: IconName | string; size?: number; variant?: IconVariant }>(),
    { size: 16, variant: 'light' },
);

// Unknown names resolve to undefined and render nothing (matches the old behaviour).
const icon = computed(() => resolveIcon(props.name, props.variant));
</script>

<template>
    <FontAwesomeIcon v-if="icon" :icon="icon" :style="{ fontSize: size + 'px' }" fixed-width />
</template>
