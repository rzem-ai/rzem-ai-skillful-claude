# Config Studio - Design Brief

Input for Claude Design. Read alongside `claude-code-config-studio-structure.md` (the logical spec) and `config-studio-fixtures.md` (sample data - design every screen against it).

---

## 1. What this is

A desktop application for power users of Claude Code. It answers one question - "what configuration is actually in effect, and why?" - and provides two ways to change it: guided forms that hide the files, and a raw editor that doesn't.

The emotional target: the relief of `git log` after someone's been guessing. Calm, dense, truthful. This is a diagnostic instrument, not a consumer app.

## 2. Audience and tone

- Developers and platform engineers who live in terminals and IDEs. They distrust magic and read error messages.
- The app should feel like serious developer tooling: Xcode, Tower, Proxyman, TablePlus. Not Notion, not a SaaS dashboard.
- No illustrations, no mascots, no gradients, no marketing whitespace. Information density is a feature.

## 3. Platform and window model

- **Platform**: macOS-first desktop (native feel - SF symbols-style iconography, standard toolbar, vibrancy acceptable in the sidebar only). Design should remain portable to Windows/Linux: nothing load-bearing on macOS-only chrome.
- **Window model**: single main window.
  - **Toolbar (top)**: project switcher (current project name + recent projects dropdown), global search, read-only mode toggle, sync status indicator (file watcher heartbeat).
  - **Left sidebar (~220 px)**: three workspaces - Visualise, Guided Config, Raw Editor - with their sub-sections nested beneath (e.g. Visualise → Dashboard, Scope Stack, Permissions, MCP, Memory, Extensions).
  - **Main content area**: the selected view.
  - **Right inspector panel (collapsible, ~320 px)**: contextual detail - resolution chain for a selected key, rule match trace, file metadata.
- **Density**: compact. Default row height ~28 px in tables. Power users scroll less when rows are tight.

## 4. Colour system

Dark mode is the primary theme; light mode is a deliverable but design dark-first.

**Scope colours are the heart of the app.** Every piece of config data is badged by where it came from. These five colours must be distinguishable at chip size, in both themes, and never used for anything else:

| Scope | Colour | Dark hex (suggested) | Chip icon |
|---|---|---|---|
| Managed | Crimson | `#E5484D` | lock |
| CLI args | Amber | `#F5A623` | terminal |
| Local | Violet | `#8E6FF7` | laptop |
| Project | Blue | `#4C8DFF` | folder/repo |
| User | Green | `#3DD68C` | person |

Chips always pair colour with icon + label - never colour alone (colour-blind safety).

**Semantic colours** (separate from scope colours): error red for invalid JSON/parse failures, warning amber for semantic lints, success green for valid/connected, neutral grey for shadowed/inert values. Where amber/green could collide with CLI/User scope colours, semantic states use background tints + icons while scope chips use solid fills - the two must never be confusable in the same component.

**Neutrals**: near-black background (`#141517`-ish), elevated surfaces one step lighter, hairline borders. No pure black, no pure white text.

## 5. Typography

- **UI text**: system sans (SF Pro on macOS). Sizes: 11 px captions, 13 px body, 15 px section headers, 20 px view titles. Nothing larger - this isn't a landing page.
- **Code and values**: monospace (SF Mono / JetBrains Mono) for every file path, key name, JSON value, permission rule, and diff. If it could appear in a config file, it renders in mono.
- Tabular numerals in tables.

## 6. Core components (design once, reuse everywhere)

1. **Provenance chip** - scope colour + icon + scope name, with hover card showing source file path and last-modified. The signature component.
2. **Resolution chain** - vertical list of every scope that defines a key, winner on top, shadowed entries greyed with strikethrough value and "shadowed by X" caption.
3. **Rule row** - permission rule in mono, behaviour badge (deny/ask/allow), provenance chip, drag handle (guided mode only).
4. **Health badge** - file parse status: green dot (valid), amber (warnings), red (invalid JSON), grey (missing/empty).
5. **Lock state** - managed-controlled controls: lock icon, managed value displayed, delivery channel caption ("Enforced via MDM (plist)"). Never just disabled-grey with no explanation.
6. **Diff preview modal** - two stacked diffs: file diff (top) and effective-config diff (bottom, labelled "What actually changes"). The second one is the product's thesis - give it visual priority.
7. **Scope selector** - segmented control used in all guided forms: "Just me (all projects)" / "This project (team)" / "Just me, this project". Invalid options for the current key render disabled with a tooltip reason.
8. **Empty/error states** - no project selected (prompt to pick one, show user+managed scopes still active); file invalid (show parse error, line number, "Open in Raw Editor" action).

## 7. Screen inventory, in priority order

Design in this order; later screens reuse earlier components.

1. **Effective Config Dashboard** (Visualise) - searchable/filterable table: key, resolved value (mono), type, provenance chip, shadow indicator. Row click → resolution chain in the inspector. Filters: scope, category, "differs from default", "has conflicts".
2. **Scope Stack** (Visualise) - vertical layer cards in precedence order, each with path, health badge, key count, last modified, "open raw" link. Managed card shows delivery channel.
3. **Permissions Inspector** (Visualise) - merged rule list grouped deny → ask → allow, plus the **rule tester**: an input where the user types a hypothetical tool call and the matching rule highlights with an outcome banner (allowed / asked / denied) and a match trace.
4. **Guided Config - Permissions category** (the template for all guided categories) - rule builder (tool picker, specifier field with inline syntax help), the scope selector, effect note line, Apply with diff preview.
5. **Raw Editor** - file tree grouped by scope (lock badges on managed, gitignore badges on local files), Monaco-class editor pane, lint gutter, save bar with validation status. Include the side-by-side resolution mode (same key across two files).
6. **MCP Server Map** (Visualise) - server cards across scopes; name collisions shown as stacked cards with the winner on top; env-var resolution status per server (resolved / unresolved-with-warning).
7. **Memory Map** (Visualise) - CLAUDE.md tree with load-order, lazy-load markers, @import graph with broken-link flags, auto-memory summary card.
8. Remaining guided categories (clones of #4 with different controls) and Extensions Overview - low fidelity acceptable.

## 8. The hero flow: "why won't this setting die"

Design this end to end - it's the demo and the reason the app exists:

1. User searches `defaultMode` in the Dashboard → sees resolved value `acceptEdits` with a Project chip and a shadow indicator.
2. Clicks the row → inspector shows the resolution chain: Project `acceptEdits` (winner), User `plan` (shadowed). A warning row notes the Local file also sets `auto` but it's **ignored by rule** (auto mode can't come from project/local scope) - distinct visual treatment from ordinary shadowing.
3. "Open side-by-side" → Raw Editor split view, both files open, the key highlighted in each, lint annotation on the ignored one.
4. User deletes the project entry → diff preview shows effective config now resolving to User `plan` → Apply → backup toast.

## 9. States to cover

For every screen: loaded (fixture data), empty (no project), error (invalid JSON in one source), locked (managed override present), and conflict (the fixture set provides all of these deliberately).

## 10. Out of scope for design

Onboarding/first-run, preferences window, app icon, marketing. No mobile, no responsive breakpoints below ~1100 px window width.
