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

- **Debate pattern** for substantive work (planning, design, multi-step changes). In one reply: **A — Builder** (first-pass approach with reasoning), **B — Critic** (specific challenges: assumptions, edge cases, better approaches), **Synthesis** (the improved plan). Override: `[solo]` = just answer; `[debate]` = use it even for something small. Skip it for quick questions and trivial fixes.
- **Gates.** Work milestone by milestone (see `08-roadmap.md`). Propose the plan for a milestone, get approval, build, then run the milestone's gate check with Francis before moving on. Don't start work outside the current milestone without asking. **Gate workflow** (standing rule, 2026-10-25): collect feedback during a gate, act after it; details in `.claude/README.md`.
- **Components.** The UI is built from the inventory in `06-screens-and-design.md` (Components). Build once, change once: a screen composes listed parts and never rebuilds one; a variant is named there, not copied. Keep the inventory's Code column current in the same pull request as any UI change. Never add a disabled button: a blocked action stays tappable and explains why in a pop-up. **Every UI change runs the self-review** before it's shown: Nielsen's 10 heuristics, every state (empty, loading, partial, overflow, error, offline), contrast, 44 px targets, a 375 px width, and messy data (long names, 0 and 999). Words follow the words and voice guide in 06.
- **Markers.** ⚑ = a pending decision for Francis (collect, don't decide). ◈ = deliberately left open (don't "fix" it).
- **Testing.** Every feature ships with tests. Every bug fix adds a test that would have caught it. Write each test's purpose as a plain sentence first. Run npm run check before every commit; never commit if it fails. Before each milestone, run the manual checklist in docs/testing.md. A pull request's own manual checks go in the pull request's text (rvw-12); only the designer edits the gate list's numbered lines (ruled 2026-11-05).
- **Honesty.** Say what you couldn't test, what's fragile, and what's a workaround. No overselling.
- **Keeping docs current.** When a decision is made, update `docs/09-decisions-log.md` (and the relevant spec file) in the same commit, and remove the item from `10-open-questions.md`.
- **Branches and pull requests.** Do each step on a branch named after it (e.g. `m2-e3-undo`), push it and open a pull request. Merge to `main` only when the Check, database and layout jobs are all green and Francis says yes (his standing yes, 2026-11-17, covers a green, locally reviewed pull request; not one with a migration before he has pushed it, a screen he hasn't seen, or a draft). **The full checks (check, database, layout) run by day again on pull requests** (rvw-6, Francis, 2026-11-17, ending the cq-3 deferral early); **on `main` a merge runs check and database, and the pictures (layout) are checked once a night** (Francis, 2026-11-19: "a nightly picture check sounds best can you implement that?"): the night run at 07:00 UTC runs everything on `main`, going live waits for check and database only, and a red night run is fixed first thing the next day. `main` is protected: no direct pushes. Each pull request gets a Vercel preview that uses the **test** Supabase project.
- **One check run per batch** (Francis, 2026-11-19: "Yes to all of them", then "Yes, batching too. Let's make sure this is carried forward."). Rows of one plan that touch the same files go in one pull request, at most three rows, with one review and one layout check for the batch; its title names every row. Rows that share no file may still run side by side: two or three batches in flight at once. A builder opens its pull request without the `ready` label; the driver adds it after the local review and the builder's fixes, so the layout checks run once.
- **Database changes.** Every migration runs on the test project first (`npm run db:push:test`, then `npm run test:db`). Never edit a migration after it has been applied anywhere (test or main); fix forward with a new migration. Any migration that drops, renames or deletes data needs Francis's explicit OK first, with what it removes said in plain words. Before pushing a migration to the main project, take or confirm a backup (`docs/testing.md`, Backups).
- **Milestones.** When a milestone's gate passes: run the fresh-session review and the security advisor (`docs/testing.md`), tag the gate commit (`m1`, `m2`, …) and push the tag, and add a `CHANGELOG.md` entry (newest first, in plain language a player could read). **Code health check:** after each milestone gate passes, before starting the next milestone, run the code health check described in docs/testing.md and show me the report.
- **Design lives in `docs/design/` and `docs/plans/`;** the design agent updates specs itself. **The artifact chain** (2026-11-01; ends at the pull request since 2026-11-17, rvw-12): `docs/intents/` (what Francis wants, his words) → `docs/design/rulings/` → `docs/plans/<milestone>-<step>.md` (the plan, its ⚑ list, an estimate; since 2026-11-19 a plan's **Departures** section is history: a builder lists its departures in its pull request's own text) → the pull request, reviewed against `REVIEW.md`; its own text carries the status (no status file). Each stage starts by reading the file the last one committed.
- **Mockups first** (ruled 2026-11-12). Nothing a person can see is built without a mockup Francis has approved. Every piece of a plan names its mockup's file and the date he approved it, or says "none: data and logic only"; a plan with a visible piece and neither is not handed to a builder. A piece without one is built to its data, rules and tests and stops before the screen. A ruling in words is not an approval of a screen. A piece already built is approved from pictures of the real screen. A plan is merged to `main` before a builder branches from it. A piece with something to see shows its built screen beside the approved picture in its pull request's text (2026-11-19).
- **Scope checks.** Never add a feature or change approved behaviour or screens on your own. If you notice one is needed, write a scope check in the format in docs/08-roadmap.md ("Scope checks"), then stop and wait for my ruling. Technical-only checks I rule here; design changes go to a `designer` session.
- **Parallel work** (ruled 2026-11-17, rvw-3, rvw-10, rvw-11). Francis talks to one driver session; it starts short-lived workers from a brief, within the session limit in `.claude/README.md`. There is no board. Each session works in its own worktree (`claude --worktree <name>`); never switch branches in a folder another session uses. When I say "docs pushed" or "pack updated", re-read the docs and re-run the pack checker on packs/<your-pack>/, and tell me about any new discrepancies before continuing.
- **Roles, models, budget.** Who runs what, on which model, the budget rules and the gate workflow are in `.claude/README.md`. Read it at the start of a session. Which skill to load for which kind of work is in its **Skills** section (Francis, 2026-11-21).

## Hard rules

1. **No LLM in the app.** Nothing in core may call an AI service. The R4 table assistant hooks in through the command layer later.
2. **Rules-agnostic and IP-clean.** No game-system names, rules text, tables, stat blocks or numbers in code, seeds or tests. Use invented examples ("Bog lurker", "Lantern Warden"). Content packs are private user data; never commit them (`packs/` is gitignored).
3. **Everything through commands.** UI never writes to the database directly. Every command checks `can(user, command, target)` and writes an event.
4. **Everything logged, nothing erased.** Rollback creates a reversing event. Log levels: `simple` or `verbose`. Eight documented exceptions (see `09-decisions-log.md`, 2026-10-19, 2026-10-25, 2026-10-26, 2026-11-03, 2026-11-14, 2026-11-17 and 2026-11-21): a character that was never approved can be deleted by its owner or the GM; an archived character can be permanently deleted by its owner or the GM after a clear confirm (kept after M2: the deletion event keeps a full copy); and items leaving play (dropped, used up or burnt out, given to someone outside the party, or a one-off the GM declines) are deleted, and the log keeps a copy for undo; and undoing a move of part of a stack (a partial give) merges what's left of the split-off part back into its stack, deleting the part (the log keeps it; ruled 2026-10-26, 5b: if some was used, what's left comes back); and undoing an action that created an item (an activity's yield, such as rations found while foraging) removes that item while nobody has touched it (the log keeps a copy; ruled 2026-11-03, `docs/design/rulings/m5b-3-yield-undo-2026-11-03.md`); and the buyer's own Undo of "Buy it" removes their bought item while nobody has touched it (the log keeps a full copy; ruled 2026-11-14, bu-1); and a picture slot whose upload failed, which never held a file and was tied to nothing, is removed (the log keeps a copy; ruled 2026-11-17, ls-5); and a whole line given or moved onto a same-name stack in the same place is merged into it and removed (the log keeps a full copy, and Undo makes the line again; ruled 2026-11-21, sw-9). The list is closed: any new kind of deletion needs a design ruling first.
5. **Hidden means hidden.** Other players' purses, monster HP and GM-only notes must never be sent to a client that can't see them. Enforce with Supabase row-level security, not just the UI. One named exception (ruled 2026-10-29, see `09-decisions-log.md`): a Down or dead character's pack and purse open to the other players (every take logged), enforced by row-level security on the character's state and closing again if the character recovers; and a hireling's pack is always open to their employer.
6. **Modules don't touch core internals.** Use the registry (`02-architecture.md`). Core never imports a module.
7. **Calm UI.** Spacing, type and colour come only from the tokens in `06-screens-and-design.md` (no raw values). Body 16, nothing under 14, tap targets ≥44px with 8px between, one accent button per screen, colour may carry a distinction by itself only where its mockup shows it with the hue taken away and Francis has approved it (relaxed 2026-11-12 from "never colour alone"; text contrast floors still hold), never a disabled button, light and dark mode. **Undo over confirm:** reversible actions happen at once with an Undo toast; dialogs only for irreversible or high-cost actions.
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
