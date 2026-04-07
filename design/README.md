# Skillful Claude — Design Notes

Durable record of the design intent for the Skillful Claude UI (a Tauri app
for managing global / project `CLAUDE.md` and `SKILLS.md` files, plus tool /
MCP configuration).

The Pencil source file (`skillful-claude-ui.pen`) is held in memory by the
Pencil MCP server and may not always be present on disk. This README plus the
exported PNGs in `exports/` is the artifact a fresh Claude Code session can
rebuild from without needing the original `.pen`.

---

## Files

| Path | Role |
|---|---|
| `skillful-claude-ui.pen` | Pencil source — when on disk, open with `open_document` for true continuity. |
| `exports/01-global-claude-md-editor.png` | Screen 1 reference render |
| `exports/02-dashboard-claude-skills-graph.png` | Screen 2 reference render |
| `exports/03-project-claude-md-merged.png` | Screen 3 reference render |
| `20260407_*.png` | Original visual reference that shaped the Dashboard's node-graph aesthetic |

---

## Visual language

### Color tokens

Hand-picked, hardcoded throughout (the `.pen` file has no `variables` block).

| Token | Hex | Usage |
|---|---|---|
| `bg-page` | `#F4F6F9` | Page background, cool light gray |
| `bg-surface` | `#FFFFFF` | Card / sidebar / top bar fills |
| `bg-soft` | `#FAFBFD` | Subtle elevated panels (gutter, tab strip, toolbar inactive states) |
| `border` | `#E5E9F0` | All 1px borders and dividers |
| `text-strong` | `#0B1220` | Primary text, headings |
| `text-default` | `#475569` | Body text, secondary labels |
| `text-muted` | `#64748B` | Tertiary, captions |
| `text-faint` | `#94A3B8` | Placeholders, kicker labels, line numbers |
| `accent-blue` | `#2F5BFF` | Sidebar active state, save button, primary CTA |
| `accent-blue-bg` | `#EEF2FF` | Active item background fill |
| `accent-blue-stroke` | `#DCE3FF` | Active item border |
| `success` | `#10B981` | "Synced" dot, positive deltas |
| `warning` | `#F59E0B` | Unsaved changes dot, mixed deltas |
| **`graph-purple`** | `#7872B5` | CLAUDE.md nodes, "global" source rail, dusty indigo |
| **`graph-coral`** | `#EE8E83` | SKILLS nodes, "project" source rail, warm coral |
| `graph-purple-soft` | `#CDC8E0` | Purple text accents on dark pills |
| `graph-coral-soft` | `#FAD7D0` | Coral text accents on dark pills |
| `graph-edge` | `#B6B0C7` | Connection paths, lavender-gray |
| `dark-pill` | `#0B1220` | Dark backgrounds (Global root card, "Out" segmented active) |

The graph palette (purple/coral) is the **load-bearing visual** of the whole
app — it carries the inheritance metaphor across every screen. Don't swap
those without thinking through what that signals.

### Typography

- **Inter** — all UI text (headings, body, labels, sidebar, buttons). Weights 500 / 600 / 700.
- **Geist Mono** — code, file paths, line numbers, data values, kbd hints.

Common sizes: heading 22–26, subheading 15, body 12–13, caption 10–11, kicker 9 with `letterSpacing: 0.6–0.8`.

### Spacing rhythm

- Page padding: `[24, 32]` (top/bottom × left/right)
- Card padding: `18` (or `[14, 16]` for compact tiles)
- Gap between cards / sections: `16–24`
- Gap inside cards: `8–14`
- Border radius: `8` for buttons/inputs, `10–12` for cards, `18–20` for graph pills, `6` for tags

---

## App shell

Every screen shares the same shell:

```
┌──────────────────────────────────────────────┐
│ Top Bar (64h, white, border-bottom)          │
├──────┬───────────────────────────────────────┤
│      │                                       │
│ Side │  Main (padding [24, 32])              │
│ bar  │                                       │
│ 264w │                                       │
│      │                                       │
└──────┴───────────────────────────────────────┘
```

### Top bar (`height: 64`, `padding: [0, 24]`)
- **Left cluster**: brand (32px dark icon + "Skillful Claude") | divider | scope dropdown (kicker `SCOPE` / `PROJECT` + value + chevron, `bg-soft` fill, `36h`)
- **Right cluster**: search input (`280w`, with `⌘K` kbd hint) | docs icon button | avatar (`32px`, `accent-blue` fill, initials)

### Sidebar (`width: 264`, `padding: [20, 16]`, `gap: 24`)
Order top-to-bottom:
1. **Dashboard** item (active when on screen 2) — icon `layout-dashboard`, label "Dashboard", subtitle "Claude & Skills graph"
2. **`INSTRUCTIONS`** kicker section
   - `CLAUDE.md` item (active when on screen 1 or 3) — icon `file-text`, subtitle is the path (`~/.claude/` or `./CLAUDE.md`)
   - `Project overrides` item — icon `folder`, badge with count
3. **`SKILLS`** kicker section
   - `Browse skills` (badge `24`)
   - `Active here` (badge `11`)
4. **`TOOLS`** kicker section
   - `Built-in tools`
   - `MCP servers` (badge `7`)

**Active item style**: `fill: accent-blue-bg`, `stroke: accent-blue-stroke`, label in `text-strong`, icon in `accent-blue`, trailing 6px dot in `accent-blue`.

---

## Inheritance model

The thing every screen is trying to teach the user:

- **Global scope** = `~/.claude/CLAUDE.md` + global `~/.claude/skills/`. One source of truth that auto-loads into every project.
- **Project scope** = each project can add its own `./CLAUDE.md` and `./.claude/skills/`. These **interleave with**, not replace, the global ones.
- **Effective merge** = what Claude actually sees at runtime: global lines + project lines, in source order.
- **Visual language**:
  - **Purple `#7872B5`** = anything from global / inherited
  - **Coral `#EE8E83`** = anything project-local / overriding
  - These two colors carry the model across all three screens.

---

## Screens

### 1. Global CLAUDE.md editor (`name: Global CLAUDE.md Editor`)

Purpose: edit the root `~/.claude/CLAUDE.md`, see what depends on it.

**Page header row** — breadcrumb `Global › Instructions › CLAUDE.md` on the left; `Unsaved changes` warning + `Discard` + `Save changes` (blue) on the right.

**Title row** — file icon in soft blue square + `Global instructions` heading + `~/.claude/CLAUDE.md` mono subtitle. Right side: chip `Inherited by 8 projects`, chip `4.2 KB · 187 lines`.

**Content row** — horizontal flex:
- **Editor card** (`fill_container`, white, rounded 12, border):
  - Tab strip — `CLAUDE.md` tab (with unsaved dot), `Edit / Preview` toggle, format and overflow icon buttons
  - Body — horizontal: `48w` gutter (line numbers, `bg-soft`, right-border) + code area (light bg, monospace, sample global instructions: `# System` / `## Tone` / `## Defaults` / `## Memory`)
- **Side panel** (`width: 340`, vertical stack of 3 cards):
  - **`FILE`** card — header with `Synced` green-dot badge, rows for Path / Modified / Tokens / Auto-load (with iOS-style toggle in `accent-blue`)
  - **`INHERITED BY`** card — list of project rows with colored folder icon, name, override hint (`+ overrides 4 lines` / `inherits as-is`), trailing chevron, plus a `See all 8` link
  - **`RECENT EDITS`** card — time/date column + action description + diff line counts (green for additions)

### 2. Dashboard — Claude & Skills graph (`name: Overview / Hierarchy`)

Purpose: visualize the entire CLAUDE.md / SKILLS.md inheritance graph as a node canvas.

**Title row** — `Claude & Skills` heading + small badge `22 nodes · 31 edges`. Right side: `In / Out / Reset` segmented control (active state has dark fill).

**Toolbar strip** — white card with border. Left: `+ Add Node` (filled), `Group`, `Align`, `Delete`. Right: zoom-out / fit / split / zoom-in icon buttons (each `30px` square).

**Canvas** — `height: 600`, `layout: none` (absolute positioning), soft radial gradient background, clipped:
- **Paths layer** — inserted at index 1 so it renders behind nodes. Contains all SVG cubic-bezier connection paths, `stroke: graph-edge`, `thickness: 1.5`, `cap: round`. Parent-to-expanded edges use `dashPattern: [3, 3]`.
- **CLAUDE.md pill nodes** — `170×40`, `cornerRadius: 20`, fill `graph-purple`, layered shadow `#7872B533`. Inside: `file-text` icon + bold label + optional sub or chevron.
- **SKILLS pill nodes** — `140×36`, `cornerRadius: 18`, fill `graph-coral`, layered shadow `#EE8E8340`. Inside: `sparkles` icon + bold label.
- **Expanded CLAUDE.md card** — purple header pill on top, white card body below with two `bg-soft` "dropdown row" stand-ins and a centered `Default` tag (purple-tinted).
- **Expanded SKILLS card** — coral header pill on top, white card body with `graph-coral-soft` border and four list rows (`#FCEBE7` fill), each containing a coral bar and an `on` / `off` micro-tag.
- **Minimap** — bottom-right `212×150`, white card with shadow. Header `Minimap` + `maximize-2` icon. Body is a small `bg-soft` canvas containing miniature dots in matching purple/coral plus a `graph-purple` viewport rectangle showing what's currently in view.

### 3. Project CLAUDE.md (merged view) (`name: Project CLAUDE.md (merged)`)

Purpose: edit a project's `./CLAUDE.md` while seeing exactly what it inherits from global.

Same shell as screen 1, but:
- **Top bar scope dropdown** kicker reads `PROJECT`, value reads the project name (e.g. `skillful-claude`).
- **Breadcrumbs**: `Projects › skillful-claude › CLAUDE.md`.
- **Title** is `Project instructions`, subtitle is the project-relative path.
- **Title meta chip** reads `Inherits from ~/.claude` instead of `Inherited by N projects`.

**The defining feature — a new toggle row inside the editor card**, between the tab strip and the code body:

- Left side:
  - Segmented control: **`Merged with global`** (active, dark fill, `layers` icon) | `Project only` (inactive, `file-text` icon)
  - Hint text: `6 of 22 lines from project`
- Right side:
  - Legend dot in `graph-purple` + label `global`
  - Legend dot in `graph-coral` + label `project`

**Editor body becomes three columns**, not two:
1. Gutter — line numbers (existing pattern)
2. **Source rail** — new `16w` column, `bg-soft`, right-border. Contains 22 small frames (`4w × 14h`, `cornerRadius: 2`), one per code line, each filled `graph-purple` if the line came from global or `graph-coral` if from the project. The rail aligns line-for-line with the gutter and code area because all three columns share the same vertical layout / padding-top / gap.
3. Code area — same monospace text content as screen 1, plus a `## Project context` block in the middle.

In the sample data, lines 1–11 and 18–22 are global (purple bars), lines 12–17 are project additions (coral bars). The visual effect: scan the rail and you see at a glance which sections this project owns.

**Side panel** changes:
- **`INHERITED BY`** card → **`INHERITS FROM`** card. Shows a single source row for `Global instructions · ~/.claude/CLAUDE.md · 187 lines`, followed by an **`Effective merge`** explainer note: `22 lines total · 16 from global, 6 from project. Project additions interleave at sections marked with the coral rail.`

The toggle is the conceptual heart of the screen — it lets the user flip between "what does Claude actually see at runtime" (merged) and "what does this project own" (project only).

---

## Rebuilding from scratch

If `skillful-claude-ui.pen` is missing and a new Claude session needs to recreate the design:

1. **Read this file and the three PNGs in `exports/`** for visual anchor.
2. `mcp__pencil__open_document({filePathOrTemplate: "/home/alex/Dev/Work/rzem-ai-skillful-claude/design/skillful-claude-ui.pen"})`. This creates a fresh in-memory document at that path (the file won't actually exist on disk; that's fine, the document lives in the MCP server's memory).
3. Use `mcp__pencil__get_guidelines({category: "guide", name: "Web App"})` and `... name: "Design System"` for layout / composition idioms. Skip the `style` guide — we don't use it; colors are hardcoded from the table above.
4. Build screens with `batch_design`. Useful conventions:
   - Each screen is a top-level frame in `document` with absolute `x` (screen 1 at `x: 0`, screen 2 at `x: 1500`, screen 3 at `x: 3000`, all `y: 0`)
   - Always set `placeholder: true` while building, unset when done
   - Cap each `batch_design` call at ~25 ops
   - Establish the shell first (top bar + body row + sidebar shell + main shell), then populate
   - For the Dashboard, the canvas needs `layout: "none"` so children can be `layoutPosition: "absolute"`. Insert a paths layer frame and `M` it to index 1 so connection paths render behind node pills.
5. After major sections, `get_screenshot` to verify visually before moving on.
6. To export hi-res renders: `mcp__pencil__export_nodes({format: "png", scale: 2, ...})` writes to `exports/`. Rename the auto-generated `nodeId.png` files to the readable `01-…`, `02-…`, `03-…` names.

### Things that bit me, in no particular order

- `enabled: false` on a layout child still occupies main-axis space in some cases — use a real frame (transparent, no fill) as a spacer instead.
- Lucide icon names: many "obvious" ones aren't there. `check-circle` → `circle-check`, `align-center` → `menu` or `align-justify`, `more-horizontal` → `ellipsis`. Always check the warning output of `batch_design`.
- A frame with `fit_content` height and `fill_container` children creates a circular layout dependency — children resolve to zero. Either make the parent a fixed/`fit_content(N)` size or make the children `fit_content` themselves.
- `C` (copy) recreates descendant IDs — you cannot `U` a copied node's descendants by their old IDs in the same batch. Use `snapshot_layout` afterwards to find the new IDs, or rebuild the section instead of copying it.
- For curved connection lines, use `type: "path"` with SVG cubic bezier geometry (`M x y C cx1 cy1, cx2 cy2, x y`). Stroke must have an explicit `fill` color; don't set `fill` on the path itself.
- Both columns of an editor (gutter + code area, or gutter + source rail + code area) align line-for-line **only if** they share `padding-top`, `gap`, and child counts. The source rail in screen 3 specifically uses bars sized to roughly match the rendered text height so the alignment holds.

---

## Why the colors carry meaning

Repeating because it's the single most important thing to preserve:

- **Purple = global / inherited**
- **Coral = project / override**

These show up in:
- The Dashboard graph (node fills + minimap dots + viewport border)
- The Project CLAUDE.md source rail (per-line provenance)
- The Project CLAUDE.md side panel "Effective merge" explainer
- Any future screen that needs to convey "this is global vs this is local"

Everywhere else (sidebar active state, save button, badges) uses `accent-blue` as a neutral chrome accent that doesn't compete with the inheritance signal. Keep it that way.
