import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  loadClaudeConfig,
  type ClaudeConfig,
  type ClaudeMd,
  type ProjectEntry,
  type Skill,
} from "@/composables/useDesktopApi";
import {
  getAllowedTools,
  getDisabledTools,
  getMcpServers,
} from "@/composables/useClaudeConfigAccessors";

/** Scope the UI is filtered by. `global` shows the union across all projects. */
export type ConfigScope = "global" | "project";

/**
 * Opaque id identifying a selectable entry. Encoded as a discriminated string
 * so it's trivial to round-trip through storage / URLs later. Callers should
 * build these via the helpers below rather than string-concatenating.
 *
 *   global:claudemd
 *   global:skill:{absolutePath}
 *   global:settings
 *   project:{absoluteProjectPath}:claudemd
 *   project:{absoluteProjectPath}:skill:{absolutePath}
 *   project:{absoluteProjectPath}:settings
 */
export type EntryId = string;

export const globalClaudeMdId = (): EntryId => "global:claudemd";
export const globalSkillId = (path: string): EntryId => `global:skill:${path}`;
export const globalSettingsId = (): EntryId => "global:settings";
export const projectClaudeMdId = (projectPath: string): EntryId =>
  `project:${projectPath}:claudemd`;
export const projectSkillId = (projectPath: string, skillPath: string): EntryId =>
  `project:${projectPath}:skill:${skillPath}`;
export const projectSettingsId = (projectPath: string): EntryId =>
  `project:${projectPath}:settings`;

/** Rows rendered by `McpServersView`, built by flattening global + per-project servers. */
export interface MergedMcpEntry {
  name: string;
  config: unknown;
  scope: "global" | "project";
  projectPath?: string;
}

/** Counts consumed by the sidebar badges. Always defined — zeros while loading. */
export interface SidebarBadges {
  projectOverrideCount: number;
  totalSkillCount: number;
  activeSkillCount: number;
  mcpServerCount: number;
}

export const useConfigStore = defineStore("config", () => {
  // ── state ────────────────────────────────────────────────────────────
  const config = ref<ClaudeConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedEntryId = ref<EntryId | null>(null);
  const scope = ref<ConfigScope>("global");
  const focusedProjectPath = ref<string | null>(null);

  // ── getters: projects & skills ───────────────────────────────────────

  /** All projects whose directory still exists on disk. */
  const liveProjects = computed<ProjectEntry[]>(
    () => config.value?.projects.filter((p) => p.exists) ?? [],
  );

  /** Projects that actually have a `{path}/CLAUDE.md` on disk. */
  const projectsWithClaudeMd = computed<ProjectEntry[]>(
    () => liveProjects.value.filter((p) => p.claudeMd !== null),
  );

  /**
   * Live projects that have *any* on-disk override — CLAUDE.md, local
   * settings, or local skills. This is the same set ProjectOverridesView
   * lists, exposed here so the sidebar badge stays in sync with the view.
   */
  const overrideProjects = computed<ProjectEntry[]>(
    () => liveProjects.value.filter(
      (p) =>
        p.claudeMd !== null ||
        p.localSettings !== null ||
        p.localSkills.length > 0,
    ),
  );

  /**
   * Flat merged skill array, global first. This is what most views consume —
   * individual source (global vs project) can be recovered via `skill.path`.
   */
  const allSkills = computed<Skill[]>(() => {
    if (!config.value) return [];
    const projectSkills = config.value.projects.flatMap((p) => p.localSkills);
    return [...config.value.userSkills, ...projectSkills];
  });

  const activeProjectEntry = computed<ProjectEntry | null>(() => {
    if (!focusedProjectPath.value || !config.value) return null;
    return (
      config.value.projects.find((p) => p.path === focusedProjectPath.value) ??
      null
    );
  });

  // ── getters: MCP servers merged across scopes ────────────────────────

  const allMcpServers = computed<MergedMcpEntry[]>(() => {
    if (!config.value) return [];
    const out: MergedMcpEntry[] = [];

    const globalServers = getMcpServers(config.value.userConfigRaw);
    for (const [name, cfg] of Object.entries(globalServers)) {
      out.push({ name, config: cfg, scope: "global" });
    }

    for (const project of config.value.projects) {
      const projectServers = getMcpServers(project.config);
      for (const [name, cfg] of Object.entries(projectServers)) {
        out.push({
          name,
          config: cfg,
          scope: "project",
          projectPath: project.path,
        });
      }
    }

    return out;
  });

  // ── getters: sidebar badges ──────────────────────────────────────────

  /**
   * Active skills are derived by cross-referencing every skill with the
   * effective `allowedTools`/`disabledTools` lists. We union global + the
   * currently-focused project's overrides (if any). This is the same logic
   * `ActiveSkillsView` uses, centralized so the badge and the view agree.
   */
  const activeSkillCount = computed<number>(() => {
    if (!config.value) return 0;
    const allowed = new Set(getAllowedTools(config.value.userConfigRaw));
    const disabled = new Set(getDisabledTools(config.value.userConfigRaw));

    if (activeProjectEntry.value) {
      for (const t of getAllowedTools(activeProjectEntry.value.config)) {
        allowed.add(t);
      }
      for (const t of getDisabledTools(activeProjectEntry.value.config)) {
        disabled.add(t);
      }
    }

    // A skill is "active" when it's either explicitly allowed, or not
    // disabled (i.e. implicit allow). Since neither `allowedTools` nor
    // `disabledTools` typically lists skills in current Claude Code
    // versions, this count defaults to the total skill count minus any
    // disabled ones — a reasonable first approximation.
    if (allowed.size === 0 && disabled.size === 0) {
      return allSkills.value.length;
    }

    let count = 0;
    for (const skill of allSkills.value) {
      const key = skill.name ?? skill.path;
      if (disabled.has(key)) continue;
      if (allowed.size === 0 || allowed.has(key)) count += 1;
    }
    return count;
  });

  const sidebarBadges = computed<SidebarBadges>(() => ({
    projectOverrideCount: overrideProjects.value.length,
    totalSkillCount: allSkills.value.length,
    activeSkillCount: activeSkillCount.value,
    mcpServerCount: allMcpServers.value.length,
  }));

  // ── getters: selection resolution ────────────────────────────────────

  /**
   * Parse a selectedEntryId back into its parts. Kept inline rather than a
   * discriminated-union type because most call sites only care about one
   * field. Returns null if the id doesn't match a known shape.
   */
  function parseEntryId(id: EntryId): {
    scope: "global" | "project";
    projectPath?: string;
    kind: "claudemd" | "skill" | "settings";
    skillPath?: string;
  } | null {
    if (id === "global:claudemd") return { scope: "global", kind: "claudemd" };
    if (id === "global:settings") return { scope: "global", kind: "settings" };
    if (id.startsWith("global:skill:")) {
      return { scope: "global", kind: "skill", skillPath: id.slice("global:skill:".length) };
    }
    if (id.startsWith("project:")) {
      const rest = id.slice("project:".length);
      // project path may contain colons on Windows drive letters — find the
      // *last* occurrence of `:claudemd`/`:settings`/`:skill:` as a suffix
      // separator instead.
      if (rest.endsWith(":claudemd")) {
        return {
          scope: "project",
          projectPath: rest.slice(0, -":claudemd".length),
          kind: "claudemd",
        };
      }
      if (rest.endsWith(":settings")) {
        return {
          scope: "project",
          projectPath: rest.slice(0, -":settings".length),
          kind: "settings",
        };
      }
      const skillIdx = rest.indexOf(":skill:");
      if (skillIdx >= 0) {
        return {
          scope: "project",
          projectPath: rest.slice(0, skillIdx),
          kind: "skill",
          skillPath: rest.slice(skillIdx + ":skill:".length),
        };
      }
    }
    return null;
  }

  /**
   * The CLAUDE.md file the current selection points at (global or project-scoped),
   * or `null` if the selection isn't a claudemd entry or the target is missing.
   */
  const resolvedClaudeMd = computed<ClaudeMd | null>(() => {
    if (!config.value || !selectedEntryId.value) {
      // Default-to-global: if nothing is selected but the global CLAUDE.md
      // exists, ClaudeMdView will still render it. Keeps the view useful on
      // first load before the user clicks anything.
      return config.value?.userClaudeMd ?? null;
    }
    const parsed = parseEntryId(selectedEntryId.value);
    if (!parsed || parsed.kind !== "claudemd") {
      return config.value.userClaudeMd;
    }
    if (parsed.scope === "global") return config.value.userClaudeMd;
    const project = config.value.projects.find((p) => p.path === parsed.projectPath);
    return project?.claudeMd ?? null;
  });

  /** Human-readable title for the currently resolved CLAUDE.md selection. */
  const resolvedClaudeMdTitle = computed<string>(() => {
    if (!selectedEntryId.value) return "Global instructions";
    const parsed = parseEntryId(selectedEntryId.value);
    if (!parsed) return "Global instructions";
    return parsed.scope === "global" ? "Global instructions" : "Project instructions";
  });

  // ── actions ──────────────────────────────────────────────────────────

  async function loadAll(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await loadClaudeConfig();
      config.value = result;
      // First-load default: point at the global CLAUDE.md if present. If it
      // isn't, leave the selection null and let the view show an empty state.
      if (selectedEntryId.value === null && result.userClaudeMd !== null) {
        selectedEntryId.value = globalClaudeMdId();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      config.value = null;
    } finally {
      loading.value = false;
    }
  }

  /** Refresh after a write. Preserves current selection. */
  async function reload(): Promise<void> {
    try {
      const result = await loadClaudeConfig();
      config.value = result;
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  function selectEntry(id: EntryId | null): void {
    selectedEntryId.value = id;
  }

  function setScope(next: ConfigScope): void {
    scope.value = next;
    if (next === "global") focusedProjectPath.value = null;
  }

  function setFocusedProject(path: string | null): void {
    focusedProjectPath.value = path;
    if (path !== null) scope.value = "project";
  }

  return {
    // state
    config,
    loading,
    error,
    selectedEntryId,
    scope,
    focusedProjectPath,
    // getters
    liveProjects,
    projectsWithClaudeMd,
    overrideProjects,
    allSkills,
    activeProjectEntry,
    allMcpServers,
    sidebarBadges,
    resolvedClaudeMd,
    resolvedClaudeMdTitle,
    // actions
    loadAll,
    reload,
    selectEntry,
    setScope,
    setFocusedProject,
    // helpers exposed for tests / views that need to parse ids
    parseEntryId,
  };
});
