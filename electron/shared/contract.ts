// The IPC contract — the single typed seam between the config engine (main
// process, Node) and the renderer (Vue). Pure types + channel-name constants,
// no runtime dependencies, so both bundles can import it freely.
//
// The view-model shapes below deliberately mirror the interfaces each screen
// already declared for its fixtures (ConfigRow, Layer, Rule, Server, …). The
// engine emits exactly these shapes, so the templates render real data with no
// structural change.

export type ScopeId = 'managed' | 'cli' | 'local' | 'project' | 'user';

// ── Dashboard (Effective Configuration) ──────────────────────────────────
export interface ChainEntry {
    scope: ScopeId;
    value: string;
    status: 'winner' | 'shadowed' | 'ignored';
    path: string;
    mod: string;
    note?: string;
    action?: string;
}

export interface ConfigRow {
    key: string;
    value: string;
    type: string;
    cat: string;
    scope: ScopeId | null;
    differ: boolean;
    conflict: boolean;
    hero?: boolean;
    secret?: boolean;
    locked?: boolean;
    inert?: boolean;
    isDefault?: boolean;
    channel?: string;
    lint?: string;
    chain: ChainEntry[];
}

// ── Scope Stack ───────────────────────────────────────────────────────────
export type FileHealth = 'ok' | 'warn' | 'err' | 'miss';

export interface LayerFile {
    path: string;
    health: FileHealth;
    note?: string;
    gitignore?: boolean;
    committed?: boolean;
}

export interface Layer {
    scope: ScopeId;
    win: boolean;
    keys: number;
    mod: string;
    delivery?: string;
    empty?: boolean;
    gitignore?: boolean;
    committed?: boolean;
    health: { cls: FileHealth; label: string };
    files: LayerFile[];
}

// ── Permissions ───────────────────────────────────────────────────────────
export type Behaviour = 'deny' | 'ask' | 'allow';

export interface PermRule {
    n: number;
    beh: Behaviour;
    spec: string;
    scope: ScopeId;
    unreachable?: string;
}

export interface SandboxLine {
    label: string;
    items: { code: string; scope?: ScopeId }[];
}

export interface PermissionsModel {
    rules: PermRule[];
    sandbox: SandboxLine[];
    defaultMode: string;
    unreachableCount: number;
}

// ── MCP Server Map ─────────────────────────────────────────────────────────
export interface EnvVar {
    name: string;
    resolved: boolean;
    note: string;
}
export interface ShadowDef {
    scope: ScopeId;
    target: string;
    file: string;
    note: string;
}
export interface ServerStatus {
    cls: 'ok' | 'warn';
    label: string;
}
export interface Server {
    name: string;
    scope: ScopeId;
    transport: string;
    target: string;
    status: ServerStatus;
    file: string;
    env: EnvVar[];
    collision?: string;
    shadow?: ShadowDef;
}

// ── Memory Map ─────────────────────────────────────────────────────────────
export interface MemFile {
    scope: ScopeId;
    path: string;
    sub: string;
    ord?: number;
    lazy?: boolean;
    committed?: boolean;
    gitignore?: boolean;
}
export interface ImportNode {
    id: string;
    path: string;
    depth: number;
    broken: boolean;
}
export interface AutoMemory {
    enabled: boolean;
    entries: number;
    directory: string;
    index: string;
    preview: string[];
}
export interface MemoryModel {
    files: MemFile[];
    imports: ImportNode[];
    maxDepth: number;
    maxReached: number;
    brokenCount: number;
    auto: AutoMemory | null;
}

// ── Extensions ─────────────────────────────────────────────────────────────
export interface ExtItem {
    name: string;
    scope: ScopeId;
    icon: string;
    desc: string;
    meta: string;
    file: string;
    disabled?: boolean;
    override?: boolean;
}
export interface ExtSection {
    title: string;
    icon: string;
    items: ExtItem[];
}
export interface ExtensionsModel {
    sections: ExtSection[];
    skillCount: number;
    skillBudgetNote: string;
}

// ── Raw Editor ─────────────────────────────────────────────────────────────
export type RawHealth = 'ok' | 'warn' | 'err';
export type LintType = 'err' | 'warn';

export interface RawLint {
    type: LintType;
    msg: string;
    action: string;
}
export interface RawLine {
    t: string;
    g?: LintType;
    hi?: boolean;
    key?: string;
    lint?: RawLint;
    folded?: boolean;
}
export interface RawFile {
    id: string;
    scope: ScopeId;
    realPath: string; // absolute path on disk; '' when not writable/real
    path: string; // display path
    label: string;
    health: RawHealth;
    committed?: boolean;
    gitignore?: boolean;
    locked?: boolean;
    dragons?: boolean;
    parseErr?: { line: number; msg: string };
    content: string; // raw file text (for editing); '' for synthetic
    lines: RawLine[];
}
export interface RawTreeGroup {
    scope: ScopeId;
    ids: string[];
}
export interface RawModel {
    files: RawFile[];
    tree: RawTreeGroup[];
}

// ── Guided Permissions ─────────────────────────────────────────────────────
export interface GuidedRule {
    beh: Behaviour;
    spec: string;
    scope: ScopeId;
    locked?: boolean;
}
export interface GuidedPermissionsModel {
    modes: { v: string; label: string; d: string; cur?: boolean; userOnly?: boolean; locked?: boolean }[];
    rules: GuidedRule[];
    effectiveMode: string;
    effectiveModeScope: ScopeId | null;
    bypassLock: { value: string; channel: string } | null;
}

// ── Guided Model & Effort ───────────────────────────────────────────────────
// A single resolved scalar setting the guided form edits. `scope` is where the
// effective value comes from (null when nothing sets it → built-in default).
export interface GuidedField {
    value: string; // effective value, '' when unset
    scope: ScopeId | null; // origin of the effective value
    isDefault: boolean; // true when no scope sets it
    locked?: boolean; // pinned by a managed policy
}
export interface GuidedChoice {
    v: string;
    label: string;
    d: string;
}
export interface GuidedModelModel {
    model: GuidedField;
    effort: GuidedField;
    thinking: GuidedField; // value is 'true' | 'false'
    language: GuidedField;
    modelOptions: GuidedChoice[];
    effortOptions: GuidedChoice[];
}

// ── Guided Environment ──────────────────────────────────────────────────────
export interface GuidedEnvVar {
    name: string;
    value: string; // real value (masked separately for display)
    display: string; // masked when secret, otherwise == value
    scope: ScopeId;
    secret: boolean;
    locked?: boolean; // defined by managed scope → read-only
    shadowedBy?: ScopeId; // a higher-precedence scope overrides this name
}
export interface GuidedEnvModel {
    vars: GuidedEnvVar[];
    hasProject: boolean;
}

// ── Guided MCP ──────────────────────────────────────────────────────────────
// The on-disk server definition the add form produces. The write-target
// resolver routes it to .mcp.json (project) or ~/.claude.json (user/local).
export interface McpServerInput {
    transport: 'stdio' | 'http' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
}
export interface GuidedMcpModel {
    servers: Server[]; // the resolved, merged list (reused from the MCP map)
    transports: McpServerInput['transport'][];
    scopeTargets: { v: ScopeId; t: string; d: string }[];
    hasProject: boolean;
}

// ── Guided Memory ───────────────────────────────────────────────────────────
// One creatable/editable CLAUDE.md slot per scope. Memory is markdown, so the
// guided page writes whole files through the saveFile channel, not a ChangeOp.
export interface GuidedMemorySlot {
    scope: ScopeId;
    label: string;
    path: string; // display path
    realPath: string; // absolute path on disk, for saveFile
    exists: boolean;
    lines: number; // 0 when missing
    committed?: boolean;
    gitignore?: boolean;
    template: string; // starter content used to create the file
    desc: string;
}
export interface GuidedMemoryModel {
    slots: GuidedMemorySlot[];
    imports: ImportNode[];
    brokenCount: number;
    auto: AutoMemory | null;
    hasProject: boolean;
}

// ── Project context + snapshot ─────────────────────────────────────────────
export interface ProjectInfo {
    name: string;
    path: string; // absolute project dir, '' when no project selected
    isGit: boolean;
}
export interface RecentProject {
    name: string;
    path: string;
}

export interface Snapshot {
    project: ProjectInfo | null;
    recents: RecentProject[];
    projects: RecentProject[]; // known to ~/.claude.json, existing dirs only
    claudeVersion: string;
    counts: { keys: number; rules: number; servers: number; extensions: number };
    flags: { memoryWarn: boolean; scopeWarn: boolean };
    dashboard: ConfigRow[];
    scopeStack: Layer[];
    permissions: PermissionsModel;
    mcp: Server[];
    memory: MemoryModel;
    extensions: ExtensionsModel;
    guidedPermissions: GuidedPermissionsModel;
    guidedModel: GuidedModelModel;
    guidedEnv: GuidedEnvModel;
    guidedMcp: GuidedMcpModel;
    guidedMemory: GuidedMemoryModel;
    raw: RawModel;
}

// ── Write pipeline ─────────────────────────────────────────────────────────
export interface DiffLine {
    add: boolean;
    text: string;
}
export interface ApplyPreview {
    file: { path: string; lines: DiffLine[] };
    effective: DiffLine[];
    note: string;
}

// A guided/raw change request. The write-target resolver turns intent into a
// concrete file + JSON pointer mutation.
export type ChangeOp =
    | { kind: 'setDefaultMode'; mode: string; scope: ScopeId }
    | { kind: 'removeDefaultMode'; scope: ScopeId }
    | { kind: 'addRule'; beh: Behaviour; spec: string; scope: ScopeId }
    | { kind: 'removeRule'; beh: Behaviour; spec: string; scope: ScopeId }
    // Reorder the rules of one behaviour within one scope's file. `specs` is the
    // full desired order of that group's visible rules.
    | { kind: 'reorderRules'; beh: Behaviour; scope: ScopeId; specs: string[] }
    // Model & Effort: top-level scalar keys (model, effortLevel,
    // alwaysThinkingEnabled, language) in a settings.json file.
    | { kind: 'setScalar'; key: string; value: string | number | boolean; scope: ScopeId }
    | { kind: 'removeScalar'; key: string; scope: ScopeId }
    // Environment: entries of the `env` object in a settings.json file.
    | { kind: 'setEnvVar'; name: string; value: string; scope: ScopeId }
    | { kind: 'removeEnvVar'; name: string; scope: ScopeId }
    // MCP: the `mcpServers` map — routed to .mcp.json (project) or
    // ~/.claude.json (user / per-project local) by the write-target resolver.
    | { kind: 'addMcpServer'; name: string; server: McpServerInput; scope: ScopeId }
    | { kind: 'removeMcpServer'; name: string; scope: ScopeId };

export interface WriteResult {
    ok: boolean;
    backupPath?: string;
    error?: string;
    blocked?: string; // human-readable reason a write was refused
}

export interface SaveFileRequest {
    realPath: string;
    content: string;
}

// ── Read-only mode + watcher events ────────────────────────────────────────
export interface WatchEvent {
    reason: string; // path that changed
}

// IPC channel names. Keep main + preload in lockstep with this list.
export const CH = {
    snapshot: 'config:snapshot',
    setProject: 'config:setProject',
    pickProject: 'config:pickProject',
    revealSecret: 'config:revealSecret',
    previewChange: 'write:previewChange',
    applyChange: 'write:applyChange',
    previewSave: 'write:previewSave',
    saveFile: 'write:saveFile',
    restoreBackup: 'write:restoreBackup',
    setReadOnly: 'config:setReadOnly',
    onChange: 'config:onChange', // main → renderer push
} as const;
