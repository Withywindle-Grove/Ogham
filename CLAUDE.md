# CLAUDE.md — Grimoire (working title)

Claude Code reads this file at the start of every session. It's the rulebook for how we build.

## What we're building

A rules-agnostic web app (PWA) that tracks character and party progression for a tabletop RPG group (OSR style): characters, XP, purses, party fund, inventory and encumbrance, expeditions (time, light, marching order), combat, votes, charter, titles, log, and basic hirelings/holdings. Tablet first, phone supported, optional shared table view. **Prime directive:** limit paperwork and distraction so the group plays and talks, not stares at tablets. Fewer taps, calm screens, large text.

## Read before working

All specs live in `docs/`. They are the **single source of truth**: `01-product-brief.md` vision, principles, R1 scope · `02-architecture.md` stack and the five foundations (must follow) · `03-roles-permissions.md` who can do what · `04-data-model.md` entities and fields · `05-features.md` how each R1 feature behaves · `06-screens-and-design.md` layouts, look, tap budgets · `07-content-packs.md` pack format and IP rules · `08-roadmap.md` milestones and timeline · `09-decisions-log.md` rulings so far · `10-open-questions.md` things still to decide (⚑) · `testing.md` testing rules, how to run the checks, manual checklist per milestone · `design/r1/` the R1 design of record (approved screens; see its `README.md`). Where it and the written docs differ, the docs win. Read the docs relevant to the current task before writing code. If code and docs disagree, stop and ask which is right.

## Who you're working with

Francis is a **novice coder**. He's sharp, experienced with SaaS products, and new to writing code. So:
- Explain what you're about to do in plain language before doing it, in 1–3 sentences.
- Work in **small steps**. After each step, tell him exactly how to see or test the result (which command to run, what URL to open, what he should see).
- Before installing anything, running anything that changes his system, or adding a dependency, say what it is and why, and wait for a yes.
- When something breaks, explain the error in plain words, then fix it. Don't bury him in stack traces.
- Never assume he knows Git, npm or terminal commands. Give the exact command and say what it does.
- Suggest a Git commit at the end of each working step, with the message written for him.

## How we work

The why and the date of each rule are in `docs/09-decisions-log.md` (search `[process]`).

- **Debate pattern** for substantive work (planning, design, multi-step changes), in one reply: **A — Builder** (first pass, with reasoning), **B — Critic** (assumptions, edge cases, better approaches), **Synthesis** (the improved plan). `[solo]` = just answer; `[debate]` = use it even for something small. Skip it for quick questions and trivial fixes.
- **Gates.** Milestone by milestone (`08-roadmap.md`): propose the plan, get approval, build, run the gate check with Francis. Nothing outside the current milestone without asking. During a gate, collect feedback; act after it (`.claude/README.md`, Gate workflow).
- **Components.** The UI is built from the inventory in `06-screens-and-design.md` (Components): a screen composes listed parts and never rebuilds one; a variant is named there, not copied. Keep its Code column current in the same pull request as any UI change. A blocked action stays tappable and explains why in a pop-up. **Every UI change runs the self-review** before it's shown: Nielsen's 10 heuristics, every state (empty, loading, partial, overflow, error, offline), contrast, 44 px targets, a 375 px width, messy data (long names, 0 and 999). Words follow the voice guide in 06.
- **Markers.** ⚑ = a pending decision for Francis (collect, don't decide). ◈ = deliberately left open (don't "fix" it).
- **Testing.** Every feature ships with tests; every bug fix adds a test that would have caught it; each test's purpose is written first as a plain sentence. Run `npm run check` before every commit; never commit if it fails. Before each milestone, run the manual checklist in `docs/testing.md`. A pull request's own manual checks go in its text; only the designer edits the gate list's numbered lines.
- **Honesty.** Say what you couldn't test, what's fragile, and what's a workaround. No overselling.
- **Docs current.** A decision goes into `docs/09-decisions-log.md` and the relevant spec in the same commit, and comes out of `10-open-questions.md`.
- **Branches and pull requests.** Each step on a branch named after it (e.g. `m2-e3-undo`), pushed, with a pull request. `main` is protected. Merge only when check, database and layout are green and Francis says yes; his standing yes covers a green, locally reviewed pull request, but not a migration he hasn't pushed, a screen he hasn't seen, or a draft. Previews use the **test** Supabase project.
- **Checks.** Pull requests run check, database and layout by day. A merge to `main` runs check and database, and going live waits for those only; the night run (07:00 UTC) checks everything on `main`, pictures included, and a red one is fixed first thing next day (`docs/testing.md`, The GitHub check).
- **One check run per batch; a fresh worker per row.** Rows of one plan that touch the same files share one pull request: at most three rows, one review, one layout check, the title naming every row. Batches that share no file run side by side, two or three in flight. Each row, and each round of review fixes, goes to a fresh short-lived worker that commits to the batch's branch; no worker is resumed. No `ready` label at opening: the driver adds it after the local review and the fixes (`.claude/README.md`, Saving CI minutes).
- **Database changes.** Every migration runs on the test project first (`npm run db:push:test`, then `npm run test:db`). Never edit a migration applied anywhere (test or main): fix forward with a new one. One that drops, renames or deletes data needs Francis's explicit OK first, with what it removes said in plain words. Before a push to the main project, take or confirm a backup (`docs/testing.md`, Backups).
- **Milestones.** When a gate passes: the fresh-session review and the security advisor (`docs/testing.md`); tag the gate commit (`m1`, `m2`, …) and push the tag; a `CHANGELOG.md` entry (newest first, plain language a player could read); then, before the next milestone, the code health check (`docs/testing.md`), its report shown to Francis.
- **The artifact chain.** `docs/intents/` (what Francis wants, his words) → `docs/design/rulings/` → `docs/plans/<milestone>-<step>.md` (plan, ⚑ list, estimate) → the pull request, reviewed against `REVIEW.md`. Each stage starts from the file the last one committed. The pull request's text carries the status and the builder's departures (no status file; a plan's Departures section is history). The design agent updates specs itself.
- **Mockups first.** Nothing a person can see is built without a mockup Francis has approved; a ruling in words is not an approval of a screen. Every plan piece names its mockup's file and approval date, or says "none: data and logic only"; with neither, a visible piece is not handed to a builder, or is built to its data, rules and tests and stops before the screen. A piece already built is approved from pictures of the real screen. A plan is merged to `main` before a builder branches from it. A visible piece shows its built screen beside the approved picture in its pull request's text.
- **Scope checks.** Never add a feature or change approved behaviour or screens on your own: write a scope check (format in `docs/08-roadmap.md`, "Scope checks"), stop, and wait for Francis's ruling. He rules technical-only checks in the session; design changes go to a `designer` session.
- **Parallel work.** Francis talks to one driver session; it starts short-lived workers from a brief, within the session limit in `.claude/README.md`. No board. Each session in its own worktree (`claude --worktree <name>`); never switch branches in a folder another session uses. On "docs pushed" or "pack updated": re-read the docs, re-run the pack checker on `packs/<your-pack>/`, and report new discrepancies before continuing.
- **Roles, models, budget, skills:** `.claude/README.md`. Read it at the start of a session.

## Hard rules

1. **No LLM in the app.** Nothing in core may call an AI service. The R4 table assistant hooks in through the command layer later.
2. **Rules-agnostic and IP-clean.** No game-system names, rules text, tables, stat blocks or numbers in code, seeds or tests. Use invented examples ("Bog lurker", "Lantern Warden"). Content packs are private user data; never commit them (`packs/` is gitignored).
3. **Everything through commands.** UI never writes to the database directly. Every command checks `can(user, command, target)` and writes an event.
4. **Everything logged, nothing erased.** Rollback creates a reversing event. Log levels: `simple` or `verbose`. Eight exceptions, the log keeping a copy in each: a never-approved character (deleted by its owner or the GM); an archived character (by its owner or the GM, after a clear confirm); items leaving play (dropped, used up or burnt out, given outside the party, a one-off the GM declines); undoing a partial give (what's left merges back into its stack); undoing an action that created an item nobody has touched; the buyer's own Undo of "Buy it", likewise; a picture slot whose upload failed and was tied to nothing; a whole line merged onto a same-name stack in the same place. **The list is closed:** a new kind of deletion needs a design ruling first. Full wording and dates: `docs/09-decisions-log.md`, Standing rulings, "Deletion exceptions".
5. **Hidden means hidden.** Other players' purses, monster HP and GM-only notes must never be sent to a client that can't see them. Enforce with Supabase row-level security, not just the UI. One named exception (`09-decisions-log.md`, Standing rulings): a Down or dead character's pack and purse open to the other players (every take logged), enforced by row-level security on the character's state and closing again if the character recovers; and a hireling's pack is always open to their employer.
6. **Modules don't touch core internals.** Use the registry (`02-architecture.md`). Core never imports a module.
7. **Calm UI.** Spacing, type and colour come only from the tokens in `06-screens-and-design.md` (no raw values). Body 16, nothing under 14, tap targets ≥44px with 8px between, one accent button per screen, never a disabled button, light and dark mode. Colour may carry a distinction by itself only where its mockup shows it with the hue taken away and Francis has approved it; text contrast floors still hold. **Undo over confirm:** reversible actions happen at once with an Undo toast; dialogs only for irreversible or high-cost actions.
8. **Integers** for money, quantities, weights and slots.
9. **Few dependencies.** Only those listed in `02-architecture.md` without asking.

## Stack

TypeScript (strict), React, Vite, vite-plugin-pwa, Dexie (IndexedDB), Supabase (Postgres, Auth, Realtime, Storage), Vitest, ESLint. Plain CSS with design tokens.

## Commands (fill in as the project is set up)

- Install: `npm install`
- Run locally: `npm run dev` then open the URL it prints
- Full check (before every commit): `npm run check` (type check, lint, tests, build; see `docs/testing.md`)
- Tests: `npm test`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Database tests (test project only): `npm run test:db`; apply migrations with `npm run db:push:test`, then `npm run db:push`, then `npm run db:types` (see `docs/testing.md`)
- New command: register it in its module and add allowed/not-allowed cases to `src/testing/permissionCases.ts`; if it's logged, add its row to `public.logged_commands` in a new migration (`supabase/tests/m3-health.test.ts` checks they match)
- Layout and accessibility checks (real browser): `npm run test:layout`
- Security advisor (main project): `npx supabase db advisors --linked`
- Check a setting-rules pack: `npm run pack:check -- <file>`
- Function-lineage check: part of `npm run check` (rvw-7); see `docs/testing.md`
- Backup of the main project before a migration: `npm run db:backup` (see `docs/testing.md`, Backups)

## Definition of done (per step)

- Runs locally without errors
- `npm run check` passes
- Francis has seen it work
- Docs updated if behavior or decisions changed
- Committed on its branch, pull request green, merged to `main` on Francis's yes

## Things Claude gets wrong

One line each, added when a review flags the same mistake twice (`REVIEW.md`, Feeding back).
- Long heredocs in Bash fail on Windows; write files with the Write tool or a saved script.
- `python -I` hides user site-packages (PyMuPDF): use `python -E`.
- Dependabot pull requests need no secrets: CI runs a local Supabase; a PR behind main needs `@dependabot rebase`.
- Never `--no-verify`, not even on a local or temporary commit (or an amend): a "temporary" commit can be pushed by accident. If the hook fails, fix the cause or ask.
- In a merge conflict in `docs/11-modelling-gaps.md`, keep one row per G-id (the newer, ruled one), never both sides; check with `grep -oE "^\| G-[0-9]+ " docs/11-modelling-gaps.md | sort | uniq -d`.
- A pull request that conflicts with `main` starts no CI run on push: before a final push check `gh pr view <n> --json mergeable` and merge `main` in first if it says CONFLICTING. (Merely behind `main` is not a reason to merge it in.)
- A pull request brought up to `main` after a long wait keeps stale paperwork: the departures in its own text and the spec lines it touches must be brought up to what has been ruled and applied since, in the same push as the merge (flagged twice on #628).
- A pop-up opened from inside a sheet keeps its own form: wrap it in `SheetScope.Provider value={false}`, and add a layout check (flagged twice: #864, #877).
