# Vision

Claude Code configuration is spread across five scopes (Managed › CLI › Local ›
Project › User), a dozen files, and a set of merge rules that live only in the
docs and the source. When something behaves unexpectedly, the question is never
"what did I write?" — it's **"what configuration is actually in effect, and
why?"**

Skillful Claude is the diagnostic instrument for that question.

## Principles

1. **Provenance over values.** Every value on screen carries its scope chip and
   source file. The interesting fact is never the value — it's who won and who
   was overridden.
2. **The effective-config diff is the thesis.** Before any write, the app shows
   not just the file diff but what the *resolved* configuration becomes — what
   the agent will actually see after the merge.
3. **Honest data only.** Every value traces to a real file on disk or an
   explicit empty state. Nothing is fabricated, ever.
4. **Writes are guarded.** Atomic temp+rename writes, timestamped backups
   (5 retained), a write-target resolver that refuses managed scopes and
   invalid placements, an allowlist on raw saves, and a global read-only mode.
5. **Managed is observed, never written.** The app explains policy; it does not
   fight it.

## v1.0 scope

Read + resolve all five scopes live (file watchers), twelve screens, guided
forms for permissions/model/environment/MCP/memory, and a raw editor with
line-level lints — all over the real config engine with a Vitest-asserted
ground truth ([docs/fixtures.md](./docs/fixtures.md)).

## Beyond v1

- In-app auto-update (electron-updater) once releases are signed/notarized.
- Backup browsing + one-click restore (the write pipeline already retains 5).
- E2E coverage of the write flows (Playwright/Electron).
- Deeper extension introspection (agents/skills/commands contents, not just
  inventory).
