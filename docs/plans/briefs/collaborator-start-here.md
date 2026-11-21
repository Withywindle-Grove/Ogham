# Start here: a collaborator's first prompt for Claude Code

Written by the lead on 2026-11-13, for a second person joining the project with their own Claude Code. It orients and changes nothing. A first task comes afterwards as a brief of its own in this folder.

How to use it: accept the invitation to the repository, clone it, open Claude Code in the folder, and paste everything inside the block below as the first message.

```
You are joining an existing project as a second contributor's assistant.
The repo is Withywindle-Grove/Ogham (working title "Grimoire"): a
rules-agnostic web app for tracking a tabletop RPG campaign. The owner
is Francis. I am his collaborator.

Before doing anything else, read, in this order:
1. CLAUDE.md at the root (the rulebook: hard rules, testing, how we work).
2. .claude/README.md (roles, agents, review and merge rules).
3. docs/01-product-brief.md and docs/02-architecture.md.
4. docs/08-roadmap.md and docs/plans/december-first-play.md (what is
   being built now: first play is Saturday 5 December 2026).
5. docs/status/board.md (who is working on what). Do not edit it.

Rules that matter most for us:
- Work only on a branch, in a pull request. Never push to main, never
  merge, never add a label, never set auto-merge. Francis's side reviews
  and merges.
- Push once, when the work is finished. CI runs on Francis's own PC, so
  every push costs him time and memory. Never re-run an old CI run.
- No database changes: nothing under supabase/, no migrations, no
  commands against the TEST or main database. We do not have its keys.
- No real game, book or adventure names, rules text or numbers anywhere
  in code, tests or docs. Use invented examples. A pre-commit hook
  checks; never use --no-verify.
- The content packs are private and not in the repo. Use the fixtures.
- Nothing a person can see is built without a mockup Francis approved.
- Tests first, each with its purpose as a plain sentence. Run
  `npm run check` before any commit.
- Other Claude sessions are working in this repo on Francis's side. We
  cannot message them. Our channel is the pull request and a status
  file at docs/status/<date>-<branch>.md.
- If unsure, stop and ask me. Do not guess, and do not pick up work
  that has not been given to us.

Then:
a) Tell me what you need to install or run to set up locally, and wait
   for my yes before running anything.
b) After setup, run `npm run check` and tell me the result.
c) Give me a one-page summary: what the app does, how the code is laid
   out, what is in flight this week, and three questions you would ask
   Francis before taking a first task.

Do not change any file yet.
```

## What to expect
- **Setup is partial without the database keys.** The type check, lint, unit tests and build run; the database tests do not. That is expected.
- **No task is assigned by this prompt.** Francis names the first task; the lead then writes its brief here (the objective, the output, the files to read, the fences), as for every other builder.
- **Other briefs in this folder** are for cloud builders working for Francis's side. They are not tasks for a collaborator unless Francis says so.
