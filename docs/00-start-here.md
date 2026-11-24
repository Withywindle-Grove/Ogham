# 00 — Start here (for Francis and the design agent)

Claude Code doesn't need this page: it starts from `CLAUDE.md`. This one page is for anyone else picking up the project.

## Who does what

Diagram: [design-and-build loop](diagrams/design-and-build-loop.md).

| Who | Where | Does |
|---|---|---|
| Francis | everywhere | Owner, GM and product designer. Makes every ruling; writes no code. |
| Driver | Claude Code, `claude --agent driver` (Opus, medium; advisor Fable) | The one session Francis talks to (from 2026-11-17, rvw-3). Orders the work, briefs and starts short-lived workers, looks at pictures, merges. A fresh one each morning. |
| Design agent | Claude Code, `claude --agent designer` (Fable, medium) | Short design sittings that end in a ruling file; mockups, paper dry runs, build plans; updates the specs itself. Never builds. |
| Builder | Claude Code, `claude --agent builder` (Opus, medium; advisor Fable) | Builds each step from its plan, tests, migrates, opens the pull request and reports in its text. |
| Project Review | Claude Code, `claude --agent project-review` (Fable, high) | Reviews how we build, the architecture as built and the pack pipeline (advice only) for cost, quality and rework, after each gate and on demand. Reports to Francis; fixes small technical things on his yes. |
| Helpers | Claude Code subagents (`.claude/agents/`) | Reviewer (Opus, read-only), tester, docs sync, pack tools (Sonnet), scout (Haiku). |

**The loop (from 2026-10-30):** the design agent writes rulings (`docs/design/rulings/`) and a plan (`docs/plans/<milestone>-<step>.md`) → the builder builds from the plan and reports in the pull request's text (with scope checks and ⚑ lists; the files in `docs/status/` are history since 2026-11-17) → the reviewer comments on the pull request → Francis rules and approves → gate. Both roles read and write the same repo files; nothing is copied by hand. (The diagram still shows the older loop through the claude.ai Project.)

## Where things are

- **Names:** the app is **Tome** (2026-11-24). This repository is Ogham. The earlier repository, also called Tome, is frozen and read-only: "Tome" in a task means the app unless it names the old repository.
- **Current rules:** the specs, `docs/01`–`08`, `10`, `11`. **Why:** `docs/09` (by `[topic]`), then `docs/design/rulings/`. **Pictures:** `docs/design/r1/` and `docs/design/mockups/index.md`.
- **Plan:** `docs/08`. There's also a readable roadmap in Claude Docs ("Nemeton roadmap"), kept in step with 08. Milestone dates are on Google Calendar.
- **Private:** `packs/` on the PC (packs, build scripts, design notes, the name map and denylist) and Drive `Grimoire/` (Design, Test Files, build zips). Nothing private ever goes into the repo. The repo names packs only by neutral ID: `classic-advanced`, `fae-woodland`, `fae-woodland-region`, `conv-fae-woodland-to-classic`, `valley-town-adventure`, `monster-overlay`, `slot-test-homebrew`; private folders and files carry the source's real name (07 §18, File names), and the private map from ID to folder is `packs/README.md`.
- **Design agent working files:** `docs/design/notes/` (dry runs, session records), `docs/plans/` and `docs/design/mockups/`. Private drafts that hold pack content stay in `packs/_design/`.

## How the docs stay healthy

- Every rule an agent must obey is either in `CLAUDE.md` (universal rules) or in a folder's `CLAUDE.md` (local rules), or it's enforced by a hook or CI check.
- The decisions most likely to be re-proposed are listed in CLAUDE.md under "Settled", and the code carries comments pointing to their `09` line.
- At most once per gate, 3 questions from a private docs exam go into the fresh-session review (the full exam runs only after a major restructure, or after 2 misses): a fresh agent has to answer from the docs alone. If it misses, the doc that caused the miss gets fixed.
