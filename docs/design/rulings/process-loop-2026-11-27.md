---
status: pending
milestone: December first play (how the work is run from 27 November)
absorbed-into: CLAUDE.md (hard rules, Agent skills), .claude/README.md (Skills), .claude/skills/, docs/agents/; still to do: docs/12-coding-standards.md (lp-9), the consolidation of CLAUDE.md and .claude/ (lp-10), scripts/context-warn.mjs (lp-6), the agent files' models (lp-5)
supersedes: rvw-16 (no new process rules until 5 December); "Matt Pocock's skills are not used" and "only three Superpowers skills" (2026-11-22); `docs/plans/` as the plan stage of the artifact chain, for new work; `ponytail`, `ponytail-review`, `engineering:code-review`, `product-management:write-spec` and `superpowers:test-driven-development` in the Skills list (2026-11-21); the driver's 400,000-token limit (2026-11-21)
---

# The build loop (2026-11-27)

Francis ruled in chat with a cloud session on 27 November. His words are in quotes. The plan he ruled on is in that session; this file is the record.

| Id | Ruling | Francis |
|---|---|---|
| lp-1 | **One loop for all work, from now.** Design, spec, tickets, build, review per ticket, retro per spec, then the next part of the project plan. It replaces the plan stage of the artifact chain for new work; work in flight on 27 November finishes under the rules it started with. rvw-16 ends | "we implement the full loop (all phases) and we use it moving forward" |
| lp-2 | **The project plan is reviewed on 6 December** | "The larger project plan is reviewed on Dec 6" |
| lp-3 | **The skills of the loop** (table below). Eleven of Matt Pocock's skills are copied into `.claude/skills/` (MIT licence, commit `6f7f783`); its setup, triage, wayfinder and router skills are not installed. No other skill is added | "I want to use the correct skills with no extra ones that use excess tokens"; "A" (copy into the repository) |
| lp-4 | **The spec is a file; the tickets are GitHub issues.** `docs/specs/<name>.md` is reviewed as a diff and versioned with the code. Each ticket is an issue; the pull request closes it. `docs/agents/issue-tracker.md` holds the conventions | "Agree on the split" |
| lp-5 | **Models.** Steps 1 to 4 on Opus, medium. Steps 5 and 6 on Opus, high. ⚑ Step 7 on Fable, high is Claude's recommendation (the same model as `project-review`); it raises spend, so it waits for Francis's yes | "All of 1-4 do in opus medium effort"; "5-7 should use opus at high level effort (or fable you tell me)" |
| lp-6 | **Context limits.** A worker and a ticket stay near 150,000 tokens. The driver hands over at 250,000, to a cleared session | "each ticket should try to stay near 150k context maximum"; "Agreed. Handover to a cleared session" |
| lp-7 | **Three sittings per loop.** A: after design, the mockup and the rulings. B: after the tickets, the plain-language part of the spec and the ticket list. C: after review, the built screen beside the mockup, the review result and the retro findings. The technical parts of a spec and the ticket sizes are Claude's (technical ownership). The standing yes for a green, reviewed, data-only pull request holds | "Agree on ... sittings A, B, C" |
| lp-8 | **Every third loop, an architecture pass** (`improve-codebase-architecture`). It reports only; a refactor starts on Francis's yes | "Every three completed loops use improve code base architecture to clean things up" |
| lp-9 | **One coding-standards file, for agents: `docs/12-coding-standards.md`.** It sets a higher target than today's code. A rule a machine can check becomes an automated check; the file holds judgement calls. The reviewer reads it; the builder does not. A new package for a check needs Francis's yes each time (hard rule 9) | "Agents. It should include automated checks, strict typing, and fast test suites"; "Higher target"; "Agreed" |
| lp-10 | **The existing rule files are cleaned up and merged**, and `CLAUDE.md` gets an index of the important files | "We have existing files but I want them cleaned up and consolidated. Claude.md should have an index of important files" |
| lp-11 | **The hard rules are reworded** (below): same meaning, exceptions and details moved to where they are already written (`09`, Standing rulings; `06`). The numbers 1 to 9 are kept, because code, tests and migrations cite them; "Undo over confirm" leaves rule 7 and becomes rule 10 | "Approve draft" |
| lp-12 | **The pack specialist is kept as it is** (`skills/pack-*`, `pack-reviewer`, `pack-tools`); it becomes one skill later, as its own ticket. The design principles and formats in `06` and the rulings are kept whatever happens to the `designer` agent | "I also want my pack builder specialist preserved and eventually turned into a skill"; "I do not want to lose the design and formatting principles we've established" |
| lp-13 | **`ponytail` is dropped;** "the smallest change that delivers the ticket" becomes a line of the standards file | "Yes" |
| lp-14 | **Agent-facing files use the terms of the Dictionary of AI Coding** (github.com/mattpocock/dictionary-of-ai-coding). It has no licence file: its terms are used and it is linked; no text is copied | "Yes AS you describe it" |
| lp-15 | **Account plugins Tome does not use are switched off for this project** (Adobe, marketing, data, product-management, productivity, GIA, unslop). They are synced from Francis's claude.ai account, not installed by the repository, so the repository cannot switch them off: Francis does it on each account | "Yes if you can't, tell me how" |

## The loop

| Step | What | Skill | Model |
|---|---|---|---|
| 1 | Design sitting | `grill-me`, `impeccable`, `hallmark` (mockups first holds) | Opus, medium |
| 2 | Spec | `to-spec` | Opus, medium |
| 3 | Tickets | `to-tickets` | Opus, medium |
| 4 | Build | `implement-spec`, each ticket by a fresh `builder` with `tdd` | Opus, medium |
| 5 | Review, per ticket | `code-review` (the project's copy: standards and spec) | Opus, high |
| 6 | Retro, per spec | `retro`, with `writing-for-agents` | Opus, high |
| 7 | Every third loop | `improve-codebase-architecture`, with `codebase-design`, `domain-modeling`, `grilling` | ⚑ lp-5 |

What holds through the loop: the hard rules, mockups first, the migration rules, the guard hooks, at most three builders at once and one heavy job at a time, one check run per batch (a ticket is a row), a fresh worker per ticket and per fix round.

## The hard rules, as reworded (lp-11)

1. **No AI in the app.** Core never calls an AI service.
2. **No game IP.** No system names, rules text, tables, stat blocks or numbers in code, seeds or tests. Invented examples only. Never commit `packs/`.
3. **Commands only.** The UI never writes to the database. Each command checks `can(user, command, target)` and writes an event.
4. **Nothing erased.** An undo is a reversing event. The deletion exceptions are a closed list (`09`, Standing rulings, "Deletion exceptions"); a new one needs a design ruling.
5. **Hidden means hidden.** Row-level security enforces it, not the UI. The named exceptions are in `09`, Standing rulings.
6. **Core never imports a module.** Modules use the registry (`02`).
7. **Tokens only.** No raw spacing, type or colour values. Sizes, tap targets, contrast, the one accent button and light and dark mode: `06`, Accessibility and calm, and Design tokens.
8. **Integers** for money, quantities, weights and slots.
9. **No new dependency without a yes.** Those listed in `02` are allowed.
10. **Undo over confirm.** A dialog only for an irreversible or high-cost action. Never a disabled button.

## Open

- ⚑ lp-5: step 7 on Fable, high.
- lp-15: the steps for each account, once Francis has tried them.
