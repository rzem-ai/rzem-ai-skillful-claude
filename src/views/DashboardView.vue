<script setup lang="ts">
import { markRaw, ref } from "vue";
import { VueFlow, useVueFlow, type Edge, type Node } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { MiniMap } from "@vue-flow/minimap";
import ClaudeMdNode from "@/components/canvas/ClaudeMdNode.vue";
import SkillNode from "@/components/canvas/SkillNode.vue";
import CanvasToolbar from "@/components/canvas/CanvasToolbar.vue";

// Vue Flow expects custom node types to be registered (not reactive).
const nodeTypes = {
  claudemd: markRaw(ClaudeMdNode),
  skill: markRaw(SkillNode),
};

// Seed graph mirroring the design's hierarchy: a root CLAUDE.md (global) → two
// project CLAUDE.md files → SKILLS branches.
const initialNodes: Node[] = [
  {
    id: "root",
    type: "claudemd",
    position: { x: 470, y: 20 },
    data: { label: "CLAUDE.md", sub: "global" },
  },
  {
    id: "claude-a",
    type: "claudemd",
    position: { x: 80, y: 130 },
    data: { label: "CLAUDE.md" },
  },
  {
    id: "claude-b",
    type: "claudemd",
    position: { x: 600, y: 130 },
    data: { label: "CLAUDE.md" },
  },
  { id: "s1", type: "skill", position: { x: 320, y: 80 }, data: {} },
  { id: "s2", type: "skill", position: { x: 330, y: 160 }, data: {} },
  { id: "s3", type: "skill", position: { x: 480, y: 160 }, data: {} },
  { id: "s4", type: "skill", position: { x: 830, y: 80 }, data: {} },
  { id: "s5", type: "skill", position: { x: 830, y: 160 }, data: {} },
  {
    id: "claude-c",
    type: "claudemd",
    position: { x: 80, y: 490 },
    data: { label: "CLAUDE.md", sub: "binary-tools" },
  },
  { id: "s6", type: "skill", position: { x: 330, y: 430 }, data: {} },
];

const initialEdges: Edge[] = [
  { id: "e-root-a", source: "root", target: "claude-a" },
  { id: "e-root-b", source: "root", target: "claude-b" },
  { id: "e-a-s1", source: "claude-a", target: "s1" },
  { id: "e-a-s2", source: "claude-a", target: "s2" },
  { id: "e-a-c", source: "claude-a", target: "claude-c" },
  { id: "e-b-s4", source: "claude-b", target: "s4" },
  { id: "e-b-s5", source: "claude-b", target: "s5" },
  { id: "e-c-s6", source: "claude-c", target: "s6" },
];

const nodes = ref<Node[]>(initialNodes);
const edges = ref<Edge[]>(initialEdges);

const { zoomIn, zoomOut, fitView } = useVueFlow();

function onAddNode() {
  const id = `node-${nodes.value.length + 1}`;
  nodes.value.push({
    id,
    type: "claudemd",
    position: { x: 200, y: 300 },
    data: { label: "CLAUDE.md", sub: "new" },
  });
}
</script>

<template>
  <!-- Title bar -->
  <div class="flex items-center justify-between">
    <div class="flex items-end gap-3">
      <h1 class="text-[24px] font-bold leading-none text-strong">
        Claude &amp; Skills
      </h1>
      <span
        class="flex h-6 items-center gap-1.5 rounded-md bg-brand-tint px-2.5 text-[11px] font-semibold text-brand"
      >
        {{ nodes.length }} nodes · {{ edges.length }} edges
      </span>
    </div>

    <div
      class="flex h-[34px] items-center gap-0.5 rounded-lg border border-line bg-surface p-[3px]"
    >
      <button
        type="button"
        class="rounded-md px-3.5 text-[12px] font-medium text-body transition hover:bg-page"
      >
        In
      </button>
      <button
        type="button"
        class="rounded-md bg-strong px-3.5 py-1 text-[12px] font-semibold text-surface"
      >
        Out
      </button>
      <button
        type="button"
        class="rounded-md px-3.5 text-[12px] font-medium text-body transition hover:bg-page"
      >
        Reset
      </button>
    </div>
  </div>

  <CanvasToolbar
    @add-node="onAddNode"
    @zoom-in="zoomIn()"
    @zoom-out="zoomOut()"
    @fit-view="fitView()"
  />

  <div
    class="relative flex-1 overflow-hidden rounded-xl border border-line bg-canvas"
  >
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      fit-view-on-init
      class="h-full w-full"
    >
      <Background pattern-color="#E5E9F0" :gap="16" />
      <MiniMap
        position="bottom-right"
        :node-color="
          (n) => (n.type === 'skill' ? 'var(--color-skill)' : 'var(--color-claude)')
        "
      />
    </VueFlow>
  </div>
</template>
