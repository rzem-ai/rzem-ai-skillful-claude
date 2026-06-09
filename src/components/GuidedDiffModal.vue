<script setup lang="ts">
// The review-changes modal shared by every guided form. Shows the textual file
// diff and — the thesis of the whole app — the effective-config diff: what the
// agent actually sees after the merge. Presentation only; the parent supplies
// the lines and handles confirm/cancel.
import Icon from '@/components/Icon.vue';
import type { DiffLine } from '@shared/contract';

defineProps<{ open: boolean; fileLines: DiffLine[]; effLines: DiffLine[] }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
    <div v-if="open" class="scrim">
        <div class="modal">
            <div class="modal-h">
                <span style="color: var(--accent)"><Icon name="diff" :size="16" /></span>
                <h2>Review changes</h2>
                <div class="spacer" style="flex: 1"></div>
                <button class="icon-btn" @click="emit('close')"><Icon name="xcircle" :size="16" /></button>
            </div>
            <div class="modal-b">
                <div class="diff-block">
                    <div class="diff-h">
                        <Icon name="file" :size="13" />
                        File diff
                    </div>
                    <div class="diff">
                        <div v-if="!fileLines.length" class="ln">
                            <span class="gut">…</span>
                            <span class="txt">no textual change</span>
                        </div>
                        <div v-for="(l, i) in fileLines" :key="'f' + i" class="ln" :class="l.add ? 'add' : 'del'">
                            <span class="gut">{{ l.add ? '+' : '-' }}</span>
                            <span class="txt">{{ l.text }}</span>
                        </div>
                    </div>
                </div>
                <div class="diff-block thesis">
                    <div class="diff-h">
                        <Icon name="arrow" :size="13" />
                        What actually changes · effective configuration
                    </div>
                    <div class="diff thesis">
                        <div v-if="!effLines.length" class="ln">
                            <span class="gut">…</span>
                            <span class="txt">no change to the effective configuration</span>
                        </div>
                        <div v-for="(l, i) in effLines" :key="'e' + i" class="ln" :class="l.add ? 'add' : 'del'">
                            <span class="gut">{{ l.add ? '+' : '-' }}</span>
                            <span class="txt">{{ l.text }}</span>
                        </div>
                    </div>
                    <div class="hint" style="margin-top: 7px">
                        <Icon name="info" :size="12" />
                        This is the resolved result after merge — what the agent will actually see.
                    </div>
                </div>
            </div>
            <div class="modal-f">
                <span class="hint">Atomic write · timestamped backup created (5 retained)</span>
                <div style="flex: 1"></div>
                <button class="btn" @click="emit('close')">Cancel</button>
                <button class="btn primary" @click="emit('confirm')">Apply &amp; back up</button>
            </div>
        </div>
    </div>
</template>
