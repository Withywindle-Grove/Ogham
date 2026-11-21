---
status: absorbed
milestone: process
absorbed-into: CLAUDE.md, docs/testing.md, docs/08-roadmap.md, docs/09-decisions-log.md (once ruled)
supersedes: —
---

# Grimoire's SDLC against the AI-native SDLC playbook (proposal, 2026-11-01)

Francis shared Anthropic's *AI-Native SDLC Playbook* (design v2, 54 pages; Francis's copy, not in the repo) and asked how to fold it into our way of working before design continues. This file maps what we already do onto its six stages and proposes changes, each a ⚑ for Francis. It makes no ruling.

## Where we stand (honest map)

| Stage | Playbook | Grimoire today | Gap |
|---|---|---|---|
| Plan | `intent.md` in the originator's words, committed, template, product owner accepts | Francis's intent arrives in chat, in private `packs/_design/design-prompt-*.md` files and as ⚑ in `docs/10`; no template, not versioned in the repo | **Medium.** Intent is scattered and some of it is in a git-ignored folder |
| Design | requirements and design in one session, constrained by skills; `spec.md` | The `designer` agent, the `design-session` skill, the uiux checklist; rulings files with headers; specs 03–09 **are** the spec and the repo is the source of truth | **Small.** Already ahead of the playbook on the artifact chain |
| Build | plan mode → committed `plan.md`; CLAUDE.md under a page; skills; hooks; parallel sessions | `docs/plans/<step>.md` from design (two written so far); CLAUDE.md ≈ 2 pages; 2 skills; 3 hooks (migration guard, real-names scan, typecheck); designer + builder in parallel | **Medium.** Plans are new and the builder doesn't yet record departures; CLAUDE.md is long |
| Test | a feedback loop the agent runs itself; protect it (no test edits during a fix); evals on config changes | `npm run check`, `test:db`, layout screenshots with baselines, the gallery; "verification is part of done" | **Small to medium.** No guard against weakening a test while fixing; no evals (not worth it solo) |
| Deploy | AI review on every PR against `REVIEW.md`; human judges intent and risk; hooks as approval gates; agent acts up to the production gate | `reviewer` agent exists but runs only when asked; Francis reads PRs himself; branch protection; CI with three jobs; auto-merge on since 2026-10-31; main DB push is Francis's (hook-like via settings deny) | **Largest.** Review is Francis's bottleneck and the reviewer isn't automatic |
| Maintain | deterministic detection, tiered response, findings re-enter as intent | M10 plans an uptime alert; nothing closes the loop | **Expected.** R1 has no production users yet |

The playbook's one-line thesis fits us exactly: **build is no longer the bottleneck; Francis's attention is.** This week produced 44 design questions and ~10 PRs for one reviewer.

## Proposals (cheapest first)

| # | Proposal | Playbook play | Cost | What it buys |
|---|---|---|---|---|
| P1 | **`docs/intents/` as the front door.** A one-page template (problem · outcome · who and what it touches · constraints · open ⚑). Francis writes or dictates one from his phone (claude.ai + GitHub connector, or a chat here) and it's committed; the designer starts from it. Design prompts move here from `packs/_design` (neutral wording only). | Capture as intent.md | 1 docs PR | Intent in his own words, versioned, one place to find "why" |
| P2 | **`REVIEW.md` at the root** holding the reviewer's three passes (bugs · hidden-data and rules · compliance with the plan and 05/06), what Important means, a nit cap, what to skip. The `reviewer` agent reads it instead of carrying the rules itself. | AI in the PR review loop | 1 docs PR | One reviewable review policy; step 1 toward automatic review |
| P3 | **Automatic review on every PR.** Run the reviewer in CI (`claude-code-action` with an API key, or the managed Code Review if the Team plan offers it); findings as a PR comment; Francis reads the summary and judges intent and risk only. | AI in the PR review loop | setup 2–3 turns + API spend per PR | Removes the biggest bottleneck; Francis reviews from his phone |
| P4 | **Plans record departures.** The builder adds a "Departures from the plan" section to `docs/plans/<step>.md` in the same PR; the review's compliance pass checks diff against plan. | Plan mode → plan.md | builder.md + reviewer.md lines | The audit trail the playbook asks for, at no extra ceremony |
| P5 | **Protect the feedback loop.** A `PreToolUse` hook that blocks edits under `src/**/*.test.*`, `supabase/tests/**` and `tests/layout/**` on a branch named `fix-*`, with a plain message (write the failing test first, on its own commit, then fix). | Give Claude a feedback loop | 1 script + settings line | A fix can't pass by weakening its test |
| P6 | **CLAUDE.md under a page.** Keep commands, the hard rules, the working agreement; move the roles-and-models table, budget rules and the gate workflow to `.claude/README.md` and `docs/testing.md`; add "Things Claude gets wrong" fed by review findings (twice → a line). | CLAUDE.md | 1 docs PR | Less stale context in every session; the correction loop |
| P7 | **Two numbers in every status report**: first-pass merge (did the step's PR merge without a rework round?) and ⚑ raised per step. Francis watches them weekly with Usage. | How to measure it | one line in builder.md | Shows whether the process is working, cheaply |
| P8 | **CI judgment steps**: `claude -p` to triage a failed CI run into three lines on the PR, and to draft the CHANGELOG entry at a gate. | CI/CD integration | API key + 2 workflow steps | Saves Francis reading logs; optional |
| P9 | **Not now**: agent evals on config changes, managed settings, Slack on-call, the 3σ maintenance loop. Revisit at M10 (uptime alert) and R2. | Evals · Maintain | — | Solo project, no production users yet |

## Suggested order
P1 and P2 together (one docs PR), P4–P7 as one process PR, then P3 once Francis has an API key budget he's comfortable with; P8 with P3.

## Rulings (Francis, 2026-11-01)
| ⚑ | Ruling | Lands in |
|---|---|---|
| P1 | Yes | `docs/intents/` (README, TEMPLATE) |
| P2 | Yes | `REVIEW.md`; `reviewer.md` reads it |
| P3 | Yes, API key with a monthly cap (Francis names it at the plan's start; he asked for help configuring) | `docs/plans/process-sdlc-1.md` |
| P4–P7 | Yes to all | `builder.md` (Departures, two numbers); `CLAUDE.md` trimmed, roles and budget moved to `.claude/README.md`; "Things Claude gets wrong" section |
| P8 | Yes | `docs/plans/process-sdlc-1.md` |
| P9 | Not now (as proposed) | revisit at M10 |

## What I couldn't check
- Whether the Team plan includes the managed Code Review (research preview) for this repo; Francis sees it in the GitHub app settings or the Claude admin console.
- Per-PR cost of P3 before trying it on two PRs.
