# Brief: an independent review of the project to date

Written by the lead (Conductor) on 2026-11-17 at Francis's request. You are a fresh session with no history of this project. That is the point: Francis wants a view that is not the lead's. The lead planned most of what you will judge, so this brief gives you sources and questions, and no conclusions.

## Who you report to

Francis, directly. He is the owner, the GM and a novice coder; he reads on a phone or iPad. The lead answers factual questions only (where a file is, what a term means) and reads your report after Francis does. Do not ask the lead what it thinks went well or badly.

## The objective

Francis's words: "I want to understand from an unbiased view what we've been doing right, what we've been doing wrong, what we can do better, and how to move forward from here so that once we get our usage back, we can utilize it effectively."

Usage returns on Thursday 19 November. First play is Saturday 5 December 2026.

## What to produce

One file, `docs/reviewer/project-review-2026-11-17.md`, on a branch `project-review-2026-11-17`, pushed, with a pull request. Nothing else changes.

1. **One screen for a phone, first:** the five things that matter most, each in two lines, and the one change you would make first on Thursday.
2. **What has been done right**, with evidence.
3. **What has been done wrong**, with evidence.
4. **What could be done better**, each with what it would save (credits, Francis's time, rework) and what it would cost.
5. **How to work from Thursday:** a concrete way of running (which sessions, on which models, doing what, in what order; what to stop doing). Sequence and counts only: no forecast dates.
6. **The skills:** which of the account's skills (step 1 below) would help this project, for what, and which to ignore.
7. **The initial review's nine risks** (its section 13.2), ranked: act before 5 December, act after, or leave; one line of reason each. Do not re-audit the code.
8. **Not verified:** what you could not check and what you took on someone's word.

## Questions the review must answer with numbers where it can

- Of the work done, how much reached the live app, how much sits in held branches, and how much was redone? Count pull requests and plan rows; do not accept anyone's percentage.
- What does one finished, live plan row cost, in credits and in Francis's attention? If it cannot be measured from what exists, say what to record from Thursday so that it can.
- Where did the usage go: building, reviewing, coordinating between sessions, documents, rework? `docs/` holds about as many files as `src/`. Is that share earning its keep?
- Is the number of sessions and roles (a lead, a coordinating builder, a second builder, a design studio, a pack creator, up to six cloud seats) helping or costing?
- Which rules and checks have caught real faults, and which only add steps?
- Francis asked "how many usage credits would I need for the new character sheet to go live" and the lead could not answer. What would let that be answered?

## How to start

1. List the skills you can see in this session and say so in the report. Francis added them in the desktop app's settings (Customize, Skills) on 17 November; a session that cannot see them should say so and stop.
2. Read, in this order: the root `CLAUDE.md`; `.claude/README.md`; `docs/reviewer/initial-review.md` on the branch `initial-review` (`git show origin/initial-review:docs/reviewer/initial-review.md`; sections 1, 11, 12, 13 and 14 first); `docs/08-roadmap.md`; the last 150 lines of `docs/09-decisions-log.md`.
3. Then the evidence, by search and count and not by reading everything: `git log` and `gh pr list --state all` (what merged, when, how large, how many rounds); `docs/status/`; `docs/plans/` (the December plans and their Departures); `docs/design/rulings/` (how many rulings a day, how many supersede an earlier one); `CHANGELOG.md`; the GitHub Actions run history.
4. The sessions' own handovers are in `<home>\.claude\projects\<project>\memory\` (index: `MEMORY.md`). Treat them as claims by the people being reviewed: useful for what was attempted and what went wrong, never as proof that something works.

## Boundaries

- Read-only everywhere except your one file. No edits to `src/`, `supabase/`, specs, rulings, plans, `CLAUDE.md`, settings or hooks. No migrations, no database turns, no installs, no merges.
- Start no builders and no cloud seats. One scout or reviewer for a search pass is fine; say which claims came from one.
- Never open a `kb-exam` file. `packs/` is private: read it only if Francis says so, and commit nothing from it. In the repo use the pack aliases only; no real game, book or adventure names.
- The budget is the credit Francis added on 17 November. Tell him when about half is used and what is left to do; stop and report rather than run out mid-file.
- Run `npm run docs:check` before the commit. Never `--no-verify`.
- Every claim carries its evidence (a file, a count, a pull request number) or is marked as an impression.
- If unsure, stop and ask Francis; don't guess.
