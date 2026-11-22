# .claude/ — agents, roles, budget

Moved out of `CLAUDE.md` on 2026-11-01 (P6: CLAUDE.md stays under a page). `CLAUDE.md` still holds the rules that apply to every session; this file holds who runs what, on which model, and how the budget is watched. How the project is run since 2026-11-17: `docs/design/rulings/process-after-review-2026-11-17.md` (rvw-3 to rvw-18).

## Roles and models

Agents live in `.claude/agents/` (`claude --agent driver`, `claude --agent builder`).
- **The driver, Fable, medium** (`driver`, rvw-3; Fable by Francis, 2026-11-19): the one session Francis talks to. It orders the work, writes each worker's brief, starts builders and a reviewer as short-lived workers, looks at pictures, and merges. Details in `.claude/agents/driver.md`.
- **Fable, high** (`designer`, rvw-4): only a short design sitting that ends in a ruling file: a question that touches the data model, permissions or hidden data; a screen with no approved mockup; anything that failed twice on Opus. The driver stops and says so when it meets one. A `designer` the driver starts from a brief (Opus) draws mockups as a studio worker.
- **Fable, high** (`project-review`, ruled 2026-11-10): reviews how we build, the app's architecture as built against as specified, and the pack pipeline, for cost, efficiency, efficacy and quality, after each milestone gate and on demand. It reports first and makes small technical fixes only on Francis's yes; on packs it advises, and the Pack Creator decides or sends the question to Design. Reports in `docs/health/project-review-<date>.md`.
- **Opus, high** (`builder`; Francis, 2026-11-19): build steps, as short-lived workers of the driver. **A fresh worker per row and per fix round** (Francis, 2026-11-22): one builder builds one row and stops; each row of a batch, and each round of review fixes, is done by a fresh short-lived worker that commits to the batch's branch; a worker is never resumed for a later round (Saving CI minutes, below). **Fable, high, only on Francis’s yes each time** (rvw-18): the steps listed in `.claude/agents/builder.md`, Escalating to Fable.
- **Opus, medium** (`reviewer`, read-only): against `REVIEW.md`. **Each code pull request gets one local review before it merges (ruled 2026-11-10):** the driver runs the `reviewer` once on it; docs-only and scripts-only pull requests are skipped; a pull request with a migration or access rules is always reviewed. The findings go in one comment on the pull request, and the pull request's text says "Reviewed: local reviewer, N findings, fixed / not"; for a pull request that draws a screen the comment names the mockup or ruling it was compared against. The CI review (P3) runs the same file when its API credit allows; it is not a substitute. **The order (restated 2026-11-13, rv-1):** the reviewer reports first; auto-merge is set only after its comment is on the pull request. Until 2026-12-01 the CI review is at its cap and the local review is the only one. One cloud seat may stay for first reviews (rvw-11).
- **Opus, high** (`pack-reviewer`, read-only): an independent re-check of each pack review or build against the books, the private pack and the app, run in a fresh session; it reads the pack session's note last (ruled 2026-11-03, `docs/plans/pack-review-method.md`).
- **Sonnet** (`tester`, `docs-sync`, `pack-tools`): tests, fixtures, docs sync, 09 lines, pack scripts, changelog, inventory Code column. Merges, conflicts and watching CI also go to Sonnet or Haiku workers (rvw-10).
- **Haiku** (`scout`): searches, "where is X", log reading.
- **At most four local sessions at once** (rvw-10; cloud builders are outside the four, Francis, 2026-11-19): the driver, two builders on the same screen (rows that share no file), one reviewer on demand. **Cloud builders: no restrictions** (Francis, 2026-11-19, ending rvw-11): the driver uses cloud seats for building rows whenever the local seats are full; the other rules hold (one check run per batch, batches that share no file, the brief with the guard line).
- **The exception to rvw-10** (Francis, 2026-11-17): the day before the reset the driver reads the week's meter with Francis. If usage will be left, it may add seats only for data-and-logic rows of the next screen, tests and owed look-back reviews, the checks for rvw-6 and rvw-7, and clean-up that touches no file a live row holds; never a second screen's visible rows, never more seats than the PC's memory allows.
- **Two checks at once (ln-1, 2026-11-14; placed here 2026-11-18, Francis):** two checks may run at once while free memory is 12 GB or more; one below 10 GB. The second runs only with three test workers, only with 13 GB free at its start, and is dropped below 9 GB; a layout run counts as a heavy thing. Ruling: `docs/design/rulings/dec-pack-town-players-2026-11-14.md`.

## Skills (Francis, 2026-11-21)

Where this section differs from the rules above or in `CLAUDE.md`, those rules win. Load the named skill before doing the work it covers; where two could apply, use the one named here. Say which skill you used in one line. If a skill named here isn't available in the session, say so and continue without it (several are installed only on Francis's PC, not in cloud sessions).

**Plan**
- `grill-me`: in a design sitting with Francis, before anything non-trivial is planned; interview him in rounds until nothing is assumed. Builders working from an approved plan do not grill him.
- `product-management:write-spec`: turn a settled plan into a spec.
- `engineering:system-design`: new services, data models, API boundaries.
- `engineering:architecture`: when choosing between technologies; record it as an ADR.

**Build**
- `ponytail`: on every coding task: the smallest change that fully delivers the plan's row. End with what you skipped and any risk.
- `engineering:testing-strategy`: when Francis asks what to test or how.
- `superpowers:verification-before-completion`: before a worker reports "done" or "passed": say what was run and what was not.

**Fix**
- `engineering:debug`: any bug not obvious in one read. Reproduce before proposing a cause.
- `superpowers:systematic-debugging`: instead, where `engineering:debug` isn't available (cloud sessions).
- `superpowers:test-driven-development`: on `fix-` branches, within the tests-first rule (Fix branches, below; P5, bq-6).

**Review**
- `ponytail-review`: the default for reviewing a change.
- `engineering:code-review`: instead, when the change touches auth, user input, secrets or performance-critical paths.
- `ponytail-audit`: whole-repo review, or "what can I delete".
- `engineering:tech-debt`: only when Francis asks for a prioritised debt backlog.

**Ship**
- `engineering:deploy-checklist`: before any release with migrations or feature flags.
- `engineering:documentation`: READMEs, runbooks, API docs.

**UI** (mockups first and the design tokens still rule)
- `frontend-design`: the default for building new UI; `uiux` if it isn't available.
- `design:accessibility-review`: before a UI ships.
- `design:ux-copy`: labels, errors, empty states (within the words and voice guide in 06).
- `impeccable`: only when Francis names it or one of its commands.
- `hallmark`: only when Francis names it.
- `design:design-critique`: only when he asks for a critique without naming `impeccable`.

**Data**
- `data:sql-queries` for SQL; `dataviz` before any chart.

**Rules**
- A review or audit Francis asks for himself reports only: change nothing until he picks findings by number. The local reviewer before a merge is unchanged: the driver has a fresh worker fix its findings (Roles and models, above).
- `hallmark` and `impeccable` are condensed ports without their tooling. Never claim a linter or detector ran.
- Of the Superpowers plugin (obra/superpowers), only the three skills named above are used (Francis, 2026-11-22). The rest of it (its brainstorming, plan-writing, subagent and worktree workflows) is not: the project's own chain, driver and briefs stand.
- Do not use Adobe or marketing skills in this project unless Francis names one.

## How the driver runs the work (rvw-9, rvw-13, rvw-14, rvw-16, rvw-17)

- **Unsaved work first** (rvw-17): right after `main` is green the driver commits and pushes, as drafts, the work in the eleven folders the review listed; only then is a local session archived.
- **One screen at a time, to live** (rvw-9): no new screen is opened while one is held. The order: `main` green; the unsaved work saved; the waiting pull requests merged or closed; the Scene stack to live; the Player screen; the Pack's first-night seven; the town's buying path (the last two swapped by Francis, 2026-11-19: "town is easier to run on paper than pack").
- **Decisions once a day** (rvw-13): the driver settles anything reversible inside an approved mockup and lists it for Francis afterwards; everything else comes to him in one sitting.
- **Pictures once per whole screen** (rvw-14), not per row, unless a row departs from its mockup.
- **Whole, once** (po-4, 2026-11-14, `docs/design/rulings/dec-scene-whole-2026-11-14.md`): a piece of a screen that has an approved redesign is not put to Francis, and does not merge, until that screen matches its approved drawing, unless he says otherwise. Before any piece on Scene, the Player screen, Pack or the town is handed to a builder, its plan covers the whole screen's drawing; a part of the drawing with no plan row stops the hand-out.
- **No new process rules until 5 December** (rvw-16): a failure is fixed by checking an existing rule.

## Short conversations (rvw-5)

- A fresh driver each morning, and whenever its conversation passes about 400,000 tokens (was 250,000; Francis, 21 Nov: "we're blowing through drivers"). At the limit the driver writes its handover and hands over on its own, without asking (Francis, 2026-11-19).
- A worker started from a brief (builder, reviewer, tester, docs-sync, pack worker, cloud seats included) finishes its task past the limit and never stops, hands over or starts a fresh session for it; it just keeps its replies lean.
- It starts from one handover file it writes itself and overwrites each time: `handover-driver.md` in the project's memory folder.
- The hook `scripts/context-warn.mjs` warns any session past that size; only the driver (or another session Francis talks to directly) hands over. Never resume yesterday's conversation.

## Budget rules

- Fresh session per topic; `/compact` before a long build step; point to files, never paste whole docs into prompts.
- Read the spec section you need, not the file (specs are large); the scout fetches line ranges.
- Subagents return summaries; never ask them to paste logs or files back.
- Fable only for the driver (Francis, 2026-11-19) and through the `designer` and `project-review` agents; Fable sessions start with the question and the files, not with history.
- Francis watches Settings → Usage weekly: Fable stays under 35% of the week; past that, the rest of the week's design runs on Opus.
- **November 2026 (Francis, 2026-11-01): a larger plan for the month.** The 35% rule is off until it ends; design sittings stay on Fable. The weekly rule returns on 2026-12-01 unless Francis says otherwise.
- If the plan drops to a smaller one: `designer` switches to `model: opus`, effort high; Fable only for one or two approved decisions a month on credits.
- The CI review, triage and CHANGELOG draft (P3, P8) run on the repository secret `ANTHROPIC_API_KEY`, with a [amount removed] monthly spend cap set in the Anthropic console (ruled 2026-11-01). The cap was reached in November 2026 and stays as it is until access returns on 2026-12-01 (Francis: "A", 2026-11-13); check that the review job is green again that day.

## Gate workflow (standing rule, 2026-10-25)

During a gate, Claude Code collects Francis's feedback without acting on it until the gate is finished or he explicitly says to act on an item, then hands over one grouped list (ruled · needs a ruling · technical) for the designer. Meanwhile it may plan the next milestone (plan plus ⚑ list) and build engine-only pieces (no UI, no migrations) on a separate branch, merged only after the gate passes and its fixes are in. Gate work always comes before the next milestone's work.

## Shared files (ruled 2026-11-05; cut 2026-11-17, rvw-12)

**The gate list's numbered lines** (`docs/testing.md`) are edited only by the designer. A pull request's manual checks and its status go in the pull request's own text. **The board** (`docs/status/board.md`), the per-pull-request status files (`docs/status/`) and the per-branch test lists (`docs/testing/`) are history since 2026-11-17. **Pictures:** what waits for Design before merge and what is reviewed just after is in `docs/testing.md` (The component gallery). CI's database job runs in three shards (technical, 2026-11-05).

## Saving CI minutes (Francis, 2026-11-05)

- **Push once.** A worker pushes once, when its row is done and `npm run check` passes locally, not after each commit; a round of review fixes is one more push.
- **Full checks by day again; the night run stays** (Francis, 2026-11-13, `cq-3` to `cq-3d` in `docs/design/rulings/process-ci-by-day-2026-11-13.md`): since rvw-6 (2026-11-17) the full checks run by day again on pull requests; the night run at 07:00 UTC on main still runs everything. Details: `docs/testing.md`, The GitHub check.
- **Main's pictures once a night** (Francis, 2026-11-19: "a nightly picture check sounds best can you implement that?"): a merge to main runs check and database only; its layout job is green with a note, going live waits for check and database, and the night run checks main's pictures. A red night run is fixed first thing. To check main's pictures sooner: `gh workflow run check.yml --ref main`.
- **One check run per row batch** (Francis, 2026-11-19): rows of one plan that touch the same files travel as one row batch, one pull request; the rule is in `CLAUDE.md` ("One check run per batch"). Not the same as cq-2's merge batch below.
- **A fresh worker per row and per fix round** (Francis, 2026-11-22: "Yes to 'fresh worker'"). One pull request and one check run per batch stay; one builder per batch goes. Each row of a batch, and each round of review fixes, is done by a fresh short-lived worker that commits to the batch's branch; a worker is never resumed for a later round. The driver's brief for a later worker names the branch, the files and the findings. **A batch's pull request is opened as a draft by the worker of its first row; later rows' workers push to the same branch; the layout checks still run once, when the driver adds `ready`** (Francis, 2026-11-22: "Your suggestion"). Why: measured that day, workers were 82.5% of a driver session's usage, and replies carrying 200,000 tokens or more of history were 66% of it; long-lived builders resumed for fixes were the cost.
- **The layout job runs only on a pull request labelled `ready`** (the driver adds the label when the step is finished). Docs-only pull requests never get the label: they run the docs and name checks only.
- **No updating for its own sake.** A pull request that is merely behind main is not updated; it is updated only when it conflicts, or just before its merge.
- **Builders don't wait for CI** (Francis, 2026-11-05): a builder pushes once, reports and stops; the driver's Sonnet or Haiku worker watches CI, fetches the pictures, and if something fails the driver starts a fresh worker with the findings (never a resumed one; 2026-11-22).
- **Mechanical work runs on Sonnet** (same day): merge conflicts, moving pictures, read-only look-ups and small fixes; real building and tricky fixes keep the stronger model.
- **Trial:** a local layout run before the push, to catch unannounced picture changes without a CI round (local renders differ slightly: a filter, not the final pictures); first on sheet order 4.
- **Dependabot's pull requests** get the `ready` label by hand, from the driver, when they are ready to merge (Francis, 2026-11-05): no picture check on each of its pushes.
- **Design batches its docs:** one docs pull request per sitting of rulings.
- **Small reviewed fixes may merge as one merge batch** (cq-2, Francis, 2026-11-13, `docs/design/rulings/process-ci-queue-2026-11-13.md`): each keeps its own local review first; a batch branch from main merges them in order, with one check and one merge commit; a real fault drops the culprit's merge and re-runs the batch once. A large piece travels alone.

## Fix branches: tests first (P5, bq-6, 2026-11-03)

On a branch named `fix-…`, the first commit adds the failing test marked `it.fails` / `test.fails` (the check passes because it fails); the fix commit removes `.fails` and changes nothing else in that test, which must now pass. The history proves the test failed first; nothing is bypassed. The test guard hook (`scripts/guard-tests.mjs`, `docs/testing.md`) allows only those two edits to test files on a fix branch and says how when it blocks one.

## Measuring (P7, rvw-15)

- **Every worker's brief starts with `Row: <id>`** (a batch: `Row: <id> + <id>`), and the pull request's title carries it, every row of a batch named. The same `Row: <id>` line also goes in the worker's prompt itself (2026-11-22): the usage report reads the prompt, not the brief file. The usage report (`npm run usage:report`) is run at each Thursday reset, so a row's cost can be read.
- **⚑ raised** this step, which only the builder knows, goes in the pull request's text.
- **First-pass merge** (did a code pull request merge on its first push?) is counted by Project Review from GitHub's Check runs at each gate and reported in `docs/health/project-review-<date>.md` (ruled 2026-11-10). Francis reads both; a falling first-pass rate or a rising ⚑ count means the plans or the specs need work before the builder does.
