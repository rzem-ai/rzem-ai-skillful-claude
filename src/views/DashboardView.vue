<script setup lang="ts">
import { computed, markRaw } from "vue";
import { storeToRefs } from "pinia";
import { VueFlow, useVueFlow, type Edge, type Node } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { MiniMap } from "@vue-flow/minimap";
import ClaudeMdNode from "@/components/canvas/ClaudeMdNode.vue";
import SkillNode from "@/components/canvas/SkillNode.vue";
import CanvasToolbar from "@/components/canvas/CanvasToolbar.vue";
import { useConfigStore } from "@/stores/config";
import { basename } from "@/composables/useClaudeConfigAccessors";

// Vue Flow expects custom node types to be registered (not reactive).
const nodeTypes = {
  claudemd: markRaw(ClaudeMdNode),
  skill: markRaw(SkillNode),
};

const configStore = useConfigStore();
const { config } = storeToRefs(configStore);

// Layout: a simple column/row placement driven by array index. Root on top,
// one project column per live project, skills below each column. A dagre
// auto-layout would look nicer but is a follow-up — the priority here is
// that every node/edge corresponds to a real file on disk.
const ROOT_X = 500;
const ROOT_Y = 20;
const PROJECT_ROW_Y = 160;
const SKILL_ROW_Y = 300;
const COLUMN_WIDTH = 220;
const SKILL_STACK_STEP = 52;

const nodes = computed<Node[]>(() => {
  if (!config.value) return [];
  const out: Node[] = [];

  // Root: the global CLAUDE.md. Always present as a node even when the file
  // itself is missing — it's the conceptual anchor the rest of the graph
  // hangs off — but we tag `missing` in `data` so the node can style itself.
  const globalMd = config.value.userClaudeMd;
  out.push({
    id: "root",
    type: "claudemd",
    position: { x: ROOT_X, y: ROOT_Y },
    data: {
      label: "CLAUDE.md",
      sub: "global",
      missing: globalMd === null,
    },
  });

  // Global skills splay to the left of the root.
  config.value.userSkills.forEach((skill, i) => {
    out.push({
      id: `skill-g-${skill.path}`,
      type: "skill",
      position: {
        x: ROOT_X - COLUMN_WIDTH - 40,
        y: ROOT_Y + i * SKILL_STACK_STEP,
      },
      data: { label: skill.name ?? basename(skill.path) },
    });
  });

  // Projects with CLAUDE.md get a column; their local skills stack beneath.
  // We only show projects whose directory still exists and that have at
  // least one real file to show (CLAUDE.md OR local skills).
  const projectsToRender = config.value.projects.filter(
    (p) => p.exists && (p.claudeMd !== null || p.localSkills.length > 0),
  );

  projectsToRender.forEach((project, colIdx) => {
    const columnX = 40 + colIdx * COLUMN_WIDTH;
    const projectNodeId = `project-${project.path}`;

    if (project.claudeMd) {
      out.push({
        id: projectNodeId,
        type: "claudemd",
        position: { x: columnX, y: PROJECT_ROW_Y },
        data: {
          label: "CLAUDE.md",
          sub: basename(project.path),
        },
      });
    }

    project.localSkills.forEach((skill, i) => {
      out.push({
        id: `skill-p-${project.path}-${skill.path}`,
        type: "skill",
        position: {
          x: columnX,
          y: SKILL_ROW_Y + i * SKILL_STACK_STEP,
        },
        data: { label: skill.name ?? basename(skill.path) },
      });
    });
  });

  return out;
});

const edges = computed<Edge[]>(() => {
  if (!config.value) return [];
  const out: Edge[] = [];

  // Root → global skills
  config.value.userSkills.forEach((skill) => {
    out.push({
      id: `e-root-skill-g-${skill.path}`,
      source: "root",
      target: `skill-g-${skill.path}`,
    });
  });

  // Root → project CLAUDE.md → project skills
  const projectsToRender = config.value.projects.filter(
    (p) => p.exists && (p.claudeMd !== null || p.localSkills.length > 0),
  );
  projectsToRender.forEach((project) => {
    const projectNodeId = `project-${project.path}`;

    if (project.claudeMd) {
      out.push({
        id: `e-root-${projectNodeId}`,
        source: "root",
        target: projectNodeId,
      });
    }

    project.localSkills.forEach((skill) => {
      const skillNodeId = `skill-p-${project.path}-${skill.path}`;
      out.push({
        id: `e-${projectNodeId}-${skillNodeId}`,
        source: project.claudeMd ? projectNodeId : "root",
        target: skillNodeId,
      });
    });
  });

  return out;
});

const { zoomIn, zoomOut, fitView } = useVueFlow();

// The add-node button used to push fake seed nodes. It's a no-op until we
// decide what "add node" means against real on-disk files.
function onAddNode() {
  /* no-op placeholder until tied to a real create-file flow */
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
      :nodes="nodes"
      :edges="edges"
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
