# CLAUDE.md — Tome

Claude Code reads this file at the start of every session. It's the rulebook for how we build.

## What we're building

A rules-agnostic web app (PWA) that tracks character and party progression for a tabletop RPG group (OSR style): characters, XP, purses, party fund, inventory and encumbrance, expeditions (time, light, marching order), combat, votes, charter, titles, log, and basic hirelings/holdings. Tablet first, PC widescreen second, phone supported, optional shared table view. **Prime directive:** limit paperwork and distraction so the group plays and talks, not stares at tablets or spends too much time reviewing rules. Fewer taps, calm screens, easily accessible text at a glance.

## Index: read before working

The specs in `docs/` are the **single source of truth**. Read the section the task needs, not the file: several are too large to read whole (marked ▲). If code and docs disagree, stop and ask which is right.

| File | Holds |
|---|---|
| `docs/01-product-brief.md` | vision, principles, R1 scope |
| `docs/02-architecture.md` | stack, the five foundations (must follow), allowed dependencies |
| `docs/03-roles-permissions.md` | who can do what |
| `docs/04-data-model.md` | entities and fields; the domain's words |
| `docs/05-features.md` ▲ | how each R1 feature behaves |
| `docs/06-screens-and-design.md` ▲ | layouts, tokens, components, words and voice, tap budgets |
| `docs/07-content-packs.md` ▲ | pack format and IP rules |
| `docs/08-roadmap.md` | milestones, timeline, the scope-check format |
| `docs/09-decisions-log.md` ▲ | rulings; "Standing rulings" at the top are those in force; search by tag |
| `docs/10-open-questions.md` | things still to decide (⚑) |
| `docs/11-modelling-gaps.md` | rules and data shapes the app or the pack format cannot yet express |
| `docs/12-coding-standards.md` | the judgement rules a reviewer checks code against; the automated checks |
| `docs/testing.md` ▲ | testing rules, how to run the checks, hooks, CI, the manual checklist per milestone |
| `docs/design/r1/` | the R1 design of record (see its `README.md`); where it and the written docs differ, the docs win |
| `docs/design/rulings/` | one file per sitting of rulings; `process-loop-2026-11-27.md` is the build loop |
| `docs/design/mockups/` | approved mockups (`index.md`) |
| `docs/specs/` | one spec per loop (from 2026-11-27); `docs/plans/` holds the plans of earlier work |
| `docs/agents/` | where tickets live (`issue-tracker.md`) and where the domain lives (`domain.md`) |
| `docs/generated/` | command and visibility references; never edited by hand |
| `REVIEW.md` | what a review checks, and what counts as Important |
| `.claude/README.md` | the build loop, roles, models, seats, budget; read at the start of a session |
| `.claude/skills/README.md` | the project's skills and who starts each |
| `.claude/agents/` | one file per agent |
| `skills/` | the pack converter and pack skills (private packs stay in `packs/`, never committed) |
| `CHANGELOG.md` | what changed, in words a player can read |

## Who you're working with

Francis is a **novice coder**. He's sharp, experienced with SaaS products, and new to writing code. So:
- Explain what you're about to do in plain language before doing it, in 1–3 sentences.
- Work in **small steps**. After each step, tell him exactly how to see or test the result (which command to run, what URL to open, what he should see).
- Before installing anything, running anything that changes his system, or adding a dependency, say what it is and why, and wait for a yes, unless he has precleared it (for example, overnight work): preclearance covers installs and commands for the precleared task, never a new dependency (hard rule 9), a migration that drops or renames data, or a push to the main database.
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
- **Docs current.** A decision goes into `docs/09-decisions-log.md` in the same commit, and comes out of `10-open-questions.md`. The spec line: the design agent writes it, in the same commit for its own rulings; for a builder's departure, after the merge (lc-3).
- **Branches and pull requests.** Each step on a branch named after it (e.g. `m2-e3-undo`), pushed, with a pull request. `main` is protected. Merge only when check, database and layout are green and Francis says yes; his standing yes covers a green, locally reviewed pull request, but not a migration he hasn't pushed, a screen he hasn't seen, or a draft. Previews use the **test** Supabase project.
- **Checks.** Pull requests run check, database and layout by day. A merge to `main` runs check and database, and going live waits for those only; the night run (07:00 UTC) checks everything on `main`, pictures included, and a red one is fixed first thing next day (`docs/testing.md`, The GitHub check).
- **One check run per batch; a fresh worker per row.** Rows of one plan that touch the same files share one pull request: at most three rows, one review, one layout check, the title naming every row. Batches that share no file run side by side, two or three in flight. Each row, and each round of review fixes, goes to a fresh short-lived worker that commits to the batch's branch; no worker is resumed. The first row's worker opens the batch's pull request as a draft; later rows' workers push to the same branch. No `ready` label at opening: the driver adds it after the local review and the fixes (`.claude/README.md`, Saving CI minutes).
- **Database changes.** Every migration runs on the test project first (`npm run db:push:test`, then `npm run test:db`). Never edit a migration applied anywhere (test or main): fix forward with a new one. One that drops, renames or deletes data needs Francis's explicit OK first, with what it removes said in plain words. Before a push to the main project, take or confirm a backup (`docs/testing.md`, Backups).
- **Milestones.** When a gate passes: the fresh-session review and the security advisor (`docs/testing.md`); tag the gate commit (`m1`, `m2`, …) and push the tag; a `CHANGELOG.md` entry (newest first, plain language a player could read); then, before the next milestone, the code health check (`docs/testing.md`), its report shown to Francis.
- **The build loop** (2026-11-27, `docs/design/rulings/process-loop-2026-11-27.md`; the steps, skills and models are in `.claude/README.md`). `docs/intents/` (what Francis wants, his words) → a design sitting, `docs/design/rulings/` and mockups → a spec, `docs/specs/<name>.md` → tickets, GitHub issues, each sized for one fresh worker → the pull request, reviewed against `REVIEW.md` and `docs/12-coding-standards.md` → a retro. Each stage starts from what the last one committed. Francis sits three times: after design, after the tickets, after review. The pull request's text carries the status and the builder's departures (no status file). Work begun from a `docs/plans/` file before 2026-11-27 finishes from that plan. Only the design agent edits a spec; a builder lists a departure in the pull request's text (lc-3).
- **Mockups first.** Nothing a person can see is built without a mockup Francis has approved; a ruling in words is not an approval of a screen. Before a new mockup page goes to him, the designer runs `impeccable critique` on it and puts the findings beside the drawing; he picks findings by number. Every ticket (and every plan piece of earlier work) names its mockup's file and approval date, or says "none: data and logic only"; with neither, a visible piece is not handed to a builder, or is built to its data, rules and tests and stops before the screen. A piece already built is approved from pictures of the real screen. A spec (or, for earlier work, a plan) is merged to `main` before a builder branches from it. A visible piece shows its built screen beside the approved picture in its pull request's text.
- **Scope checks.** Never add a feature or change approved behaviour or screens on your own: write a scope check (format in `docs/08-roadmap.md`, "Scope checks"), stop, and wait for Francis's ruling. Design changes go to a `designer` session.
- **Technical ownership.** Claude owns technical decisions: clean-up, efficiency, refactoring, tests and tooling, and agent orchestration (roles, models, briefs, batching, worker counts in `.claude/README.md`). The test: no player or GM can see the change, and no stored data changes. Decide, do it, and log it in 09 with the reason. Still Francis's: anything that raises spend or the session or memory limits, a new dependency (hard rule 9), a migration that drops or renames data, the hard rules, and anything visible (scope checks, mockups first).
- **Account switch.** Two Claude accounts drive Tome in turn, never at the same time, by usage left. Each has the same set-up: a Claude Code project with Ogham and the private notes repository, the same cloud environment, and the PC's Remote Control sessions (switched with `/login` while idle, then restarted). The handover stays where it is, in the notes repository, so it carries over; at a switch it names the account taking over. Both accounts' usage is read at the Thursday reset.
- **Parallel work.** Francis talks to one driver session; it starts short-lived workers from a brief, within the session limit in `.claude/README.md`. No board. Each session in its own worktree (`claude --worktree <name>`); never switch branches in a folder another session uses. On "docs pushed" or "pack updated": re-read the docs, re-run the pack checker on `packs/<your-pack>/`, and report new discrepancies before continuing.
- **Roles, models, budget, skills:** `.claude/README.md`. Read it at the start of a session.

## Hard rules

Reworded 2026-11-27 (lp-11); the numbers 1 to 9 are unchanged, and code and tests cite them.

1. **No AI in the app.** Core never calls an AI service.
2. **No game IP.** No system names, rules text, tables, stat blocks or numbers in code, seeds or tests. Invented examples only ("Bog lurker", "Lantern Warden"). Never commit `packs/`.
3. **Commands only.** The UI never writes to the database. Each command checks `can(user, command, target)` and writes an event.
4. **Nothing erased.** An undo is a reversing event. The deletion exceptions are a closed list (`docs/09-decisions-log.md`, Standing rulings, "Deletion exceptions"); a new one needs a design ruling.
5. **Hidden means hidden.** Row-level security enforces it, not the UI. The named exceptions are in `docs/09-decisions-log.md`, Standing rulings.
6. **Core never imports a module.** Modules use the registry (`02-architecture.md`).
7. **Tokens only.** No raw spacing, type or colour values. Sizes, tap targets, contrast, the one accent button, and light and dark mode: `06-screens-and-design.md`, "Accessibility and calm" and "Design tokens".
8. **Integers** for money, quantities, weights and slots.
9. **No new dependency without a yes.** Those listed in `02-architecture.md` are allowed.
10. **Undo over confirm.** A dialog only for an irreversible or high-cost action. Never a disabled button. (Part of rule 7 until 2026-11-27; older files cite it as rule 7.)

## Agent skills

The build loop and its skills: `docs/design/rulings/process-loop-2026-11-27.md`; the skills are in `.claude/skills/` (`README.md` there).

- **Issue tracker.** A spec is a file in `docs/specs/`; a ticket is a GitHub issue. See `docs/agents/issue-tracker.md`.
- **Domain docs.** The domain is in `docs/04-data-model.md`; decisions are lines in `docs/09-decisions-log.md`, not ADR files. See `docs/agents/domain.md`.

## Stack

TypeScript (strict), React, Vite, vite-plugin-pwa, Dexie (IndexedDB), Supabase (Postgres, Auth, Realtime, Storage), Vitest, ESLint. Plain CSS with design tokens.

## Commands (fill in as the project is set up)

- Install: `npm install`
- Run locally: `npm run dev` then open the URL it prints
- Full check (before every commit): `npm run check` (type check, lint, tests, build; see `docs/testing.md`)
- Quick check (a few minutes, before queueing for the full one): `npm run check:quick` (type check, lint and related tests on the changed files; see `docs/testing.md`, The quick check)
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
- A test that runs git must strip every `GIT_*` variable from its env (`withoutGitVariables`, `scripts/git-test-env.mjs`): inside a commit hook they aim its throwaway repository at the real one.
- A pop-up opened from inside a sheet keeps its own form: wrap it in `SheetScope.Provider value={false}`, and add a layout check (flagged twice: #864, #877).
