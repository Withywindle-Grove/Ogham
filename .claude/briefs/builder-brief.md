# The standard builder brief

The driver copies this file into its scratchpad, fills the four marked lines, and starts a `builder` worker on Opus at medium effort (`effort: "medium"`; Francis, 2026-11-24, #56) whose prompt is only: the `Row: <id>` line (the usage report reads the prompt; `.claude/README.md`, Measuring), then "Read your brief first and follow it exactly: <path>", followed by the guard line. **One worker per row and per fix round** (Francis, 2026-11-22; `.claude/README.md`, Saving CI minutes): for a batch, the driver starts a fresh worker for each row, and another for each round of review fixes, all on the batch's branch; it never resumes one. Nothing here adds a rule: each line points to where the rule lives. When a rule file changes, this brief changes in the same pull request.

---

Row: <the one row id this worker builds; for a round of review fixes, the batch's ids joined by +, for example B6 + B7>

If a guard, a hook or a permission check blocks you, stop and report to the driver. Do not reach the same end another way: not with another tool, another branch, another session or another command.

**Objective:** build exactly the one row <row id> of `<docs/plans/plan-file.md>` (as it is on `origin/main`), or fix exactly these review findings: <findings, with their files>. Commit it to the batch's branch `<branch-name>` (a batch is up to three rows of one plan that touch the same files), for the batch's one pull request into `<main, or the stack's branch>`, whose title names every row (`.claude/README.md`, Measuring; one check run per batch, Francis, 2026-11-19). <Open the pull request / the pull request is #n: do not open another.>

**One row, then stop** (`CLAUDE.md`, One check run per batch): you build this one row (or this one round of fixes), push, report and stop. You will not be resumed: a later row or a later round goes to a fresh worker, so your report and the pull request's text must say everything the next one needs.

**Before any code**
- Read the row (its table line, its files line, every ⚑ that names it), the rulings it cites, `CLAUDE.md` and `.claude/agents/builder.md`. Read the spec sections the row touches, not whole specs.
- **Mockups first** (`CLAUDE.md`, How we work): the row names its mockup's file and the date Francis approved it, or says "none: data and logic only". Open the mockup and look at it. A visible piece with neither: build its data, rules and tests, stop before the screen, and say so.
- If the row waits on a row not yet on its base, or on a ⚑ not yet ruled, stop and report.
- If unsure, stop and ask the driver.

**Build**
- In your own worktree only, on the batch's branch `<branch-name>`: from freshly fetched `origin/main` for the batch's first row, from the freshly fetched branch itself for a later row or a round of fixes. Keep your own files (notes, the pull request's text) in your scratch subfolder `<scratch-path>`, never in another worker's. Never work in, or switch the branch of, a folder another session uses. Run `npm ci` there if `node_modules` is missing (it installs exactly what `package-lock.json` lists and never rewrites it; never `npm install`, which rewrote the lock file in a cloud container on 2026-11-21; never in `<home>\Documents\grimoire`).
- Tests with each feature, each with its purpose as a plain sentence first. On a `fix-` branch the failing test comes first as `it.fails`, and test files change only with the Edit tool (`.claude/README.md`, Fix branches).
- Hard rules in `CLAUDE.md` in full: every command through `can()` and an event; tokens only; never a disabled button; the Components inventory's Code column kept current.
- Load `ponytail` (`.claude/README.md`, Skills): the smallest change that fully delivers the row; say in the pull request what you skipped and any risk.
- Stay inside the row's files. Another builder works on another row at the same time: if you need a file outside your row, stop and say which.
- **No decisions are yours:** collect ⚑. A new feature or a change to approved behaviour is a scope check (`docs/08-roadmap.md`): write it and stop.
- **A migration:** stop and report before writing one; the driver says how it goes (`.claude/agents/builder.md`, Database).
- Self-review (`CLAUDE.md`, Components): every state, 375 px, long names, 0 and 999, light and dark.
- `npm run check` passes before every commit; never `--no-verify`, not even on a temporary commit. In a cloud clone with linked worktrees, never run `npm run hooks:install`. Where the hooks are on (an absolute `core.hooksPath`), commit through `scripts/check-slot.sh git commit …`: the hook is the check, so don't run it by hand right before; where they are not, run `scripts/check-slot.sh npm run check` before each commit. A docs- or mockup-only change runs `npm run docs:check` only, never the full check by hand. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Pull request**
- Before the final push, `gh pr view <n> --json mergeable`: if CONFLICTING, merge `origin/main` in first; if merely behind, don't.
- **Push once**, when the row is done (`.claude/README.md`, Saving CI minutes). For a later row or a round of fixes, update the pull request's text instead of opening a new one.
- **Do NOT add the `ready` label**: the driver adds it after its review and the fixes, which a fresh worker makes (`.claude/agents/builder.md`; 2026-11-19, 2026-11-22).
- The pull request's text is the status report in `.claude/agents/builder.md` (eight points): what's built; migrations; tests; not done or fragile; ⚑; numbered manual checks and **the gallery pictures you expect to change, and why**, announced on one line the CI reads, `Gallery pictures expected to change: <name>.png, <name>.png` (or `none`; `docs/testing.md`, Announced redraws); **after any review fix, re-read that line** and add what the fix redraws (redraw-line-1, 2026-11-20); **departures from the plan and the mockup, here and only here** (never in the plan's Departures section, which is history since 2026-11-19); for a piece with something to see, **the built screen beside the approved picture**; the ⚑ count. End with:
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

**Output** (to the driver, under 100 words): the pull request's number and head commit, files changed, pictures expected to change, departures, ⚑, whether `npm run check` passed, and what you could not test. Then stop; don't wait for CI, and don't expect to be resumed.
