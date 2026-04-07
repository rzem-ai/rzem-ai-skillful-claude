import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: () => import("@/views/DashboardView.vue"),
    meta: { sidebar: "dashboard" },
  },
  {
    path: "/instructions/claude-md",
    name: "claude-md",
    component: () => import("@/views/ClaudeMdView.vue"),
    meta: { sidebar: "claude-md" },
  },
  {
    path: "/instructions/overrides",
    name: "project-overrides",
    component: () => import("@/views/ProjectOverridesView.vue"),
    meta: { sidebar: "project-overrides" },
  },
  {
    path: "/skills/browse",
    name: "browse-skills",
    component: () => import("@/views/BrowseSkillsView.vue"),
    meta: { sidebar: "browse-skills" },
  },
  {
    path: "/skills/active",
    name: "active-skills",
    component: () => import("@/views/ActiveSkillsView.vue"),
    meta: { sidebar: "active-skills" },
  },
  {
    path: "/tools/builtin",
    name: "builtin-tools",
    component: () => import("@/views/BuiltinToolsView.vue"),
    meta: { sidebar: "builtin-tools" },
  },
  {
    path: "/tools/mcp",
    name: "mcp-servers",
    component: () => import("@/views/McpServersView.vue"),
    meta: { sidebar: "mcp-servers" },
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("@/views/SettingsView.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
