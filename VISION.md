# Skillful Claude

## The problem

Claude Code's behavior is shaped by two kinds of files scattered across your filesystem:

- CLAUDE.md — instructions Claude reads on every turn. There's a global one at ~/.claude/CLAUDE.md that applies to every project, plus a per-project ./CLAUDE.md that adds project-specific rules on top.
- SKILL.md — reusable, named capabilities (slash commands, workflows) that live in ~/.claude/skills/ globally or ./.claude/skills/ per project.

At runtime, Claude doesn't see these as separate files — it sees a single merged picture: global instructions plus whatever the current project layered on top, in source order. That merge is invisible. If Claude does something unexpected, you have to mentally diff the two files yourself, remember which skill came from where, and guess which scope to edit. The more projects and skills you accumulate, the more this falls apart.

## What Skillful Claude does

It's a desktop app (Tauri 2 + Vue 3) that turns those scattered files into a single, navigable picture organised around scope and inheritance. Three screens carry the whole product:

1. Global CLAUDE.md editor — edit ~/.claude/CLAUDE.md directly, with a side panel showing every project that inherits it, which projects override which lines, and recent edits. The point: when you change a global rule, you can see who it affects before you save.
2. Dashboard — Claude & Skills graph — a node-graph canvas of every CLAUDE.md and SKILL.md in your world, drawn as connected pills. Purple pills are CLAUDE.md files, coral pills are skills, and the edges show which projects inherit from ~/.claude/. You can expand a node to see its contents inline. The point: a single visual answer to "what does Claude know about, and where does it come from?"
3. Project CLAUDE.md (merged view) — edit a project's ./CLAUDE.md while a coloured rail down the left edge of the editor shows, line by line, whether each line came from global (purple) or this project (coral). A toggle flips between "merged with global" (what Claude actually sees) and "project only" (what this project owns). The point: never wonder again which file owns a given instruction.

## Why the colours matter

Two colours carry the entire product: purple #7872B5 = global / inherited, coral #EE8E83 = project / override. They're consistent across every screen — graph nodes, source rails, badges, explainers — so once you've learned them on one screen, you can read every other screen instantly.

## Who it's for

Anyone who uses Claude Code seriously across more than one project: the people who've started accumulating CLAUDE.md tweaks and skills and have lost track of which scope owns what. It's a config inspector and editor for the part of Claude Code that's currently invisible: the merge.