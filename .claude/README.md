# .claude/ — agents, roles, budget

`CLAUDE.md` holds the rules of every session. This file holds who runs what, on which model, how workers are run, and how the budget is watched. Each rule has one home; the other files link to it. The date and the reason of a rule are in `docs/09-decisions-log.md` (search `[process]`) and in `docs/design/rulings/process-*.md`.

| For | Read |
|---|---|
| the driver's own rules | `.claude/agents/driver.md` |
| a builder's own rules, and its brief | `.claude/agents/builder.md`, `.claude/briefs/builder-brief.md` |
| what a review checks | `REVIEW.md`, `docs/12-coding-standards.md` |
| who starts each skill | `.claude/skills/README.md` |
| specs and tickets | `docs/agents/issue-tracker.md` |

## Terms

Agent-facing files use the terms of the [Dictionary of AI Coding](https://github.com/mattpocock/dictionary-of-ai-coding). The project's own words stay where the dictionary has none.

| Here | Dictionary term |
|---|---|
| worker | a [subagent](https://github.com/mattpocock/dictionary-of-ai-coding#subagent) of the driver's session; in the two exceptions under Seats, a separate [session](https://github.com/mattpocock/dictionary-of-ai-coding#session) |
| handoff, `handover-driver.md` | [handoff](https://github.com/mattpocock/dictionary-of-ai-coding#handoff), [handoff artifact](https://github.com/mattpocock/dictionary-of-ai-coding#handoff-artifact) |
| `/clear` | [clearing](https://github.com/mattpocock/dictionary-of-ai-coding#clearing) |
| spec, ticket | [spec](https://github.com/mattpocock/dictionary-of-ai-coding#spec), [ticket](https://github.com/mattpocock/dictionary-of-ai-coding#ticket) |
| `npm run check`, the layout job, the hooks | [automated check](https://github.com/mattpocock/dictionary-of-ai-coding#automated-check) |
| the `reviewer`'s review | [automated review](https://github.com/mattpocock/dictionary-of-ai-coding#automated-review) |
| driver, brief, row, batch, plan, hook, worktree | no dictionary term: the project's words. A **brief** is the file a worker reads first; a **row** is one ticket, or one row of a plan |

## Roles and models

Claude may change the roles, models and batching below under Technical ownership (`CLAUDE.md`), but not in a way that raises spend or the session or memory limits. Agents live in `.claude/agents/` (`claude --agent driver`). Fable is the advisor of every session (`advisorModel` in `.claude/settings.json`); workers inherit it, and an agent file cannot set it.

| Agent | Model, effort | Does |
|---|---|---|
| `driver` | Opus, medium | The one session Francis talks to. Orders the work, briefs and starts workers, looks at pictures, merges |
| `designer` | Fable, medium | A short design sitting that ends in a ruling file, only for the cases in `designer.md`, Two ways you run. The loop's ordinary sitting (step 1) runs on Opus, medium. As a studio worker started from a brief (Opus), it draws mockups |
| `project-review` | Fable, high | Reviews how we build, the architecture as built, and the pack pipeline; after each milestone gate and on demand. Reports in `docs/health/project-review-<date>.md` |
| `builder` | Opus, medium | Builds one row, as a worker. Fable only on Francis's yes each time (`builder.md`, Escalating to Fable) |
| `reviewer` | Opus, high | Read-only review against `REVIEW.md` |
| `pack-reviewer` | Opus, high | Read-only: an independent re-check of each pack review or build against the books, the private pack and the app, in a fresh session; it reads the pack session's note last (`docs/plans/pack-review-method.md`) |
| `tester`, `docs-sync`, `pack-tools` | Sonnet | Tests, fixtures, docs sync, `09` lines, pack scripts, changelog, the inventory's Code column |
| `scout` | Haiku | Searches, "where is X", log reading |

Mechanical work goes to Sonnet or Haiku workers: merges, conflicts, watching CI, moving pictures, look-ups, small fixes. Building and hard fixes keep the stronger model.

## Review before a merge

- The driver runs the `reviewer` once on each code pull request before it merges. Docs-only and scripts-only pull requests are skipped. A pull request with a migration or access rules is always reviewed.
- The findings go in one comment on the pull request. The pull request's text says "Reviewed: local reviewer, N findings, fixed / not". For a pull request that draws a screen, the comment names the mockup or ruling it was compared against.
- The reviewer reports first. Auto-merge is set only after its comment is on the pull request.
- A fresh worker fixes the findings (`CLAUDE.md`, One check run per batch).
- The CI review runs the same file when its API credit allows. It does not replace the local review.

## Seats

**In a cloud driver session**
- At most three builders at once. Reviewers do not count.
- One heavy job (a full check or a layout run) at a time.
- Playwright runs use at most `--workers=2`.
- Each worker has its own file, branch and task. Before the driver starts one, it checks what is in flight.
- Builders are subagents of the driver's own session. A separate cloud session is the exception: extra machine power for one whole batch that shares no file with the work in the driver's session, only when the check queue is long. It works from the driver's brief, reports in its pull request's text and pushes nothing after `ready`.

**On Francis's PC**
- At most four local sessions at once: the driver, two builders on the same screen (rows that share no file), one reviewer on demand. Cloud builders are outside the four.
- **Home One** (the PC session) is a fourth builder seat, one batch at a time, through its own builder subagent from the driver's brief (sent in full with `send_message`; it reports by the bridge). It runs the PC checks: audits, TEST runs, WebKit layout.
- A push to the main database goes to a PC session in manual mode, with Francis's Allow each time.
- Two checks may run at once while free memory is 12 GB or more; one below 10 GB. The second runs only with three test workers, only with 13 GB free at its start, and is dropped below 9 GB. A layout run counts as a heavy job (ln-1, `docs/design/rulings/dec-pack-town-players-2026-11-14.md`).

**The day before the weekly reset** the driver reads the week's meter with Francis. If usage will be left, it may add seats only for: data-and-logic rows of the next screen; tests and owed look-back reviews; the checks for rvw-6 and rvw-7; clean-up that touches no file a live row holds. Never a second screen's visible rows; never more seats than the PC's memory allows.

## Workers

The batching rule (one check run per batch, a fresh worker per row and per fix round, who opens the draft) is in `CLAUDE.md`. A ticket is a row.

- **Brief.** Every worker starts from a brief in a file (`driver.md`, Brief every worker). It keeps its own files in the scratch subfolder its brief names.
- **Context.** A worker and its ticket are sized to stay near 150,000 tokens (`docs/agents/issue-tracker.md`). No hook counts a worker. A worker past the limit finishes its task and keeps its replies lean (Short conversations).
- **Push.** A branch with no pull request yet is pushed each time its check passes (a branch push alone starts no CI run). Once the pull request is open: one push per row, and one per round of review fixes.
- **Builders do not wait for CI.** A builder pushes, reports and stops. A Sonnet or Haiku worker watches CI and fetches the pictures. If something fails, the driver starts a fresh worker with the findings.
- **The check slot.** In a cloud container a worker runs the full check through `scripts/check-slot.sh <command>`, and only the tests it touches while it works. One slot, unless `OGHAM_CHECK_SLOTS` says more; each run's time is logged to `/tmp/ogham-check-times.log`. A second slot is a trial: time it, and keep it only if it gains time.
- **The commit hook is the check.** Where the hooks are on (an absolute `core.hooksPath`), a worker commits through `scripts/check-slot.sh git commit …` and does not run the full check by hand first. Where they are off, it runs `scripts/check-slot.sh npm run check` before each commit.
- **Docs only.** A change of docs or mockups only runs `npm run docs:check`, not the full check.
- **Worktrees.** In a cloud clone with linked worktrees, `npm run hooks:install` is not run (its relative path does not reach a linked worktree). After `cp -al …/node_modules`, check the link named in `CLAUDE.md`, Things Claude gets wrong.

## Skills

Where this section differs from the rules above or in `CLAUDE.md`, those rules win. Load the named skill before the work it covers; where two could apply, use the one named here. Say which skill you used in one line. If a named skill is not available in the session, say so and continue without it (several are installed only on Francis's PC).

**The build loop** (`docs/design/rulings/process-loop-2026-11-27.md`). The project's skills are in `.claude/skills/`.

| Step | What | Skill | Model |
|---|---|---|---|
| 1 | Design sitting with Francis | `grill-me` at the start of every sitting, until nothing is assumed; then `impeccable` and `hallmark` as below | Opus, medium |
| 2 | Spec, a file in `docs/specs/` | `to-spec` | Opus, medium |
| 3 | Tickets, GitHub issues, each sized for one fresh worker | `to-tickets` | Opus, medium |
| 4 | Build: the driver orchestrates; a fresh `builder` per ticket | `implement-spec`, `tdd` | Opus, medium |
| 5 | Review, per ticket | `code-review` (the project's copy) | Opus, high |
| 6 | Retro, per spec | `retro`, `writing-for-agents` | Opus, high |
| 7 | Every third loop: an architecture pass; it reports only | `improve-codebase-architecture`, `codebase-design`, `domain-modeling`, `grilling` | Fable, high |

- Francis sits three times per loop: A, after step 1 (the mockup and the rulings); B, after step 3 (the spec's plain-language part and the ticket list); C, after step 5 (the built screen, the review, the retro findings).
- Francis starts steps 2, 3, 4, 6 and 7 himself. An agent does not start those five skills (`.claude/skills/README.md`, Who starts a skill). The driver tells him which command to type, at the moment each step is ready (`driver.md`, The loop).- `implement-spec` asks for as many workers as possible. The limits under Seats win.
- Step 5 keeps the Bugs and Rules passes of `REVIEW.md`: the project's `code-review` runs them with its standards pass, through the `reviewer` agent.

**Other skills still used**
- `engineering:system-design`: new services, data models, API boundaries.
- `superpowers:verification-before-completion`: before a worker reports "done" or "passed": say what was run and what was not.
- `superpowers:systematic-debugging`: any bug not obvious in one read. Reproduce before proposing a cause. (`engineering:debug` on the PC.)
- On `fix-` branches `tdd` works within the tests-first rule (Fix branches, below).
- `ponytail-audit`: whole-repo review, or "what can I delete", only when Francis asks.
- `engineering:deploy-checklist`: before any release with migrations or feature flags.

**UI** (mockups first and the design tokens still rule)
- `frontend-design`: the default for building new UI; `uiux` if it is not available.
- `design:accessibility-review`: before a UI ships.
- `design:ux-copy`: labels, errors, empty states (within the words and voice guide in 06).
- `impeccable`: only when Francis names it or one of its commands, with one standing use: the designer runs `impeccable critique` on each new mockup page before it goes to him.
- `hallmark`: only when Francis names it.
- `design:design-critique`: only when he asks for a critique without naming `impeccable`.

**When Francis names `impeccable` and `hallmark`**

Used on drawings (mockup pages) and as reports on built screens; never handed to a builder. A report changes nothing until he picks findings by number.

| Francis's question | Name | On |
|---|---|---|
| "Is this drawing good before I approve it?" | `impeccable critique` | a new mockup page |
| "What's wrong across this whole built screen?" | `impeccable audit` | a built screen, before a retest or a gate |
| "It's nearly right, tidy it" | `impeccable polish` | a drawing |
| "This screen is too busy" | `impeccable quieter` or `distill` | a drawing |
| "Players keep missing this" | `impeccable bolder` (rare) | a drawing |
| "Things don't line up" or "the text hierarchy is off" | `impeccable layout` or `typeset` | a drawing |
| "Long names, 999, offline, errors?" | `impeccable harden` | states, before they're built |
| The first drawing of a whole screen looks like a template | `hallmark` | that drawing |

`impeccable colorize` and `animate` are not used unless a design sitting is changing the tokens.

**The driver's reminders.** One line each; a reminder, never a block, and he may say no.

| When the driver | It offers |
|---|---|
| puts a new mockup page to him for approval | for a whole new screen, `hallmark` (`critique` already ran: the designer's findings sit beside the drawing) |
| tells him a screen is ready to retest, or a gate is near | `audit` |
| hears him say a screen is busy, misaligned or easy to miss | the matching command from the table above |
| brings a plan or a spec with undrawn states | `harden` |

**Data**
- `data:sql-queries` for SQL; `dataviz` before any chart.

**Rules**
- A review or audit Francis asks for himself reports only: change nothing until he picks findings by number. The local review before a merge is a different thing (Review before a merge).
- `hallmark` and `impeccable` are condensed ports without their tooling. Never claim a linter or detector ran.
- Of the Superpowers plugin (obra/superpowers), only the two skills named above are used. Its brainstorming, plan-writing, subagent and worktree workflows are not.
- Adobe and marketing skills: only when Francis names one.

**Not used in this project**

| Skill set | Why not |
|---|---|
| GIA Chief of Staff | reads the inbox, not the project |
| unslop | about 12,000 tokens, and its own style rules on pull request texts and docs |
| UI/UX Pro Max (`uipro init` is not run in this repo) | chooses colours and fonts, against hard rule 7 and mockups first |
| The rest of Matt Pocock's skills (its setup, triage, wayfinder and router skills, and every skill not in the loop's table) | eleven are the loop; the others would be a second way to do the same step |
| `ponytail`, `ponytail-review`, `engineering:code-review`, `product-management:write-spec`, `superpowers:test-driven-development` | replaced by the loop's skills; "the smallest change that delivers the ticket" is a line of the standards file |

## Short conversations

- **A fresh driver each morning, and when its conversation passes about 250,000 tokens.** At the limit the driver writes its handoff and hands over on its own, without asking.
- **The handoff artifact** is one file the driver writes itself and overwrites each time: `handover-driver.md` in the project's memory folder. A driver starts from it, never from history, and never resumes yesterday's conversation.
- **The fresh context may come from `/clear`** in the same session, after the handoff is pushed with every running worker's ID, row, brief and branch. `/clear` keeps the session's trust card, pull request subscriptions, workers and container; a new session has none of them. Home Two may `/clear` likewise, restarting from the prompt the driver gives Francis.
- **A worker started from a brief** (builder, reviewer, tester, docs-sync, pack worker, cloud seats included) finishes its task past the limit. It does not stop, hand over or start a fresh session for it.
- The hook `scripts/context-warn.mjs` warns any session past the limit. Only the driver, or another session Francis talks to directly, hands over.

## Budget rules

- Fresh session per topic; `/compact` before a long build step; point to files, never paste whole docs into prompts.
- Read the spec section you need, not the file (specs are large); the scout fetches line ranges.
- Subagents return summaries; never ask them to paste logs or files back.
- Fable only as the advisor and through the `designer` and `project-review` agents (and loop step 7). A Fable session starts with the question and the files, not with history.
- Francis watches Settings → Usage weekly: Fable stays under 35% of the week; past that, the rest of the week's design runs on Opus. **This rule is off until 2026-12-01** (a larger plan for November); design sittings stay on Fable until then.
- If the plan drops to a smaller one: `designer` switches to `model: opus`, effort high; Fable only for one or two approved decisions a month on credits.
- The CI review, triage and CHANGELOG draft run on the repository secret `ANTHROPIC_API_KEY`, with a monthly spend cap set in the Anthropic console. When the cap is reached, the review job goes quiet and the local review is the only review.

## Gate workflow

During a gate, Claude Code collects Francis's feedback without acting on it until the gate is finished or he explicitly says to act on an item, then hands over one grouped list (ruled · needs a ruling · technical) for the designer. Meanwhile it may plan the next milestone (plan plus ⚑ list) and build engine-only pieces (no UI, no migrations) on a separate branch, merged only after the gate passes and its fixes are in. Gate work always comes before the next milestone's work.

## Shared files

- **The gate list's numbered lines** (`docs/testing.md`) are edited only by the designer. A pull request's manual checks and its status go in the pull request's own text.
- The board (`docs/status/board.md`), the status files (`docs/status/`) and the per-branch test lists (`docs/testing/`) are not used: read them as history only.
- **Pictures:** what waits for Design before merge and what is reviewed just after is in `docs/testing.md` (The component gallery).

## Saving CI minutes

When each check runs (by day, on a merge, at night) is in `CLAUDE.md`, Checks, and `docs/testing.md`, The GitHub check. The push rule is under Workers.

- **The layout job runs only on a pull request labelled `ready`.** The driver adds the label after the local review and its fixes, so the layout checks run once per batch. After adding it, re-run the labelled run, not the push run. Before adding it, check the gallery line (`docs/testing.md`, Announced redraws). Docs-only pull requests never get the label.
- **No updating for its own sake.** A pull request merely behind `main` is not updated; one that conflicts merges `main` in (`CLAUDE.md`, Things Claude gets wrong).
- **Main's pictures sooner than the night run:** `gh workflow run check.yml --ref main`.
- **Re-run only a machine fault.** A real failure goes to a fresh worker.
- **Trial:** a local layout run before the push, to catch unannounced picture changes without a CI round (local renders differ slightly: a filter, not the final pictures).
- **Dependabot's pull requests** get the `ready` label by hand, from the driver, when they are ready to merge.
- **Design batches its docs:** one docs pull request per sitting of rulings.
- **Small reviewed fixes may merge as one merge batch** (cq-2, `docs/design/rulings/process-ci-queue-2026-11-13.md`): each keeps its own local review first; a batch branch from `main` merges them in order, with one check and one merge commit; a real fault drops the culprit's merge and re-runs the batch once. A large piece travels alone. A merge batch is not a row batch.

## Fix branches: tests first

On a branch named `fix-…`, the first commit adds the failing test marked `it.fails` / `test.fails` (the check passes because it fails); the fix commit removes `.fails` and changes nothing else in that test, which must now pass. The history proves the test failed first; nothing is bypassed. The test guard hook (`scripts/guard-tests.mjs`, `docs/testing.md`) allows only those two edits to test files on a fix branch and says how when it blocks one.

## Measuring

- **Every worker's brief starts with `Row: <id>`** (a batch: `Row: <id> + <id>`; for a ticket, its issue number). The same line is in the worker's prompt itself: the usage report reads the prompt, not the brief file. The pull request's title carries it, every row of a batch named.
- The driver runs the usage report (`npm run usage:report`) at each Thursday reset, so a row's cost can be read.
- **⚑ raised** in a step, which only the builder knows, goes in the pull request's text.
- **First-pass merge** (did a code pull request merge on its first push?) is counted by Project Review from GitHub's Check runs at each gate and reported in `docs/health/project-review-<date>.md`. Francis reads both; a falling first-pass rate or a rising ⚑ count means the specs need work before the builder does.

## Work begun from a plan

Work begun from a `docs/plans/` file before 27 November 2026 finishes from that plan. New work has a spec and tickets.

| For that work | Rule |
|---|---|
| What a builder reads first | the plan file, as it is on `main`; its row is one row of the plan |
| What a review compares the diff with | the plan, and the departures in the pull request's own text. A plan's own Departures section is history |
| Mockups first | each plan piece names its mockup's file and approval date, or says "none: data and logic only" (`CLAUDE.md`) |
| A new plan | none is written. New work goes through the loop |
