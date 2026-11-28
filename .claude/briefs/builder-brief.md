# The standard builder brief

The driver copies this file into its scratchpad, fills the four marked lines, and starts a `builder` worker whose prompt is only: the `Row: <id>` line (the usage report reads the prompt; `.claude/README.md`, Measuring), then "Read your brief first and follow it exactly: <path>", followed by the guard line. A fresh worker gets it for each row and for each round of review fixes (`CLAUDE.md`, One integration branch per spec). Nothing here adds a rule: each line points to where the rule lives. When a rule file changes, this brief changes in the same pull request.

---

Row: <the one row id this worker builds: a ticket's issue number, or a plan row's id; for a round of review fixes on a spec, the spec's name; for a plan batch's fixes, its ids joined by +, for example B6 + B7>

If a guard, a hook or a permission check blocks you, stop and report to the driver. Do not reach the same end another way: not with another tool, another branch, another session or another command.

**Objective:** build exactly the one ticket #<issue number> of the spec `<docs/specs/name.md>` (for work begun from a plan: the one row <row id> of `<docs/plans/plan-file.md>`, as it is on `origin/main`), or fix exactly these review findings: <findings, with their files>. A ticket: commit to your own branch `<ticket-branch>`, from the tip of the spec's integration branch `<spec-name>`. Open no pull request: the driver merges your branch into the integration branch and opens the spec's one pull request. Plan work only: commit to the batch's branch `<branch-name>` (a batch is up to three rows that touch the same files), for the batch's one pull request into `<main, or the stack's branch>`, whose title names every row (`.claude/README.md`, Measuring). <Plan work: open the pull request / the pull request is #n: do not open another.>

**One row, then stop** (`CLAUDE.md`, One integration branch per spec): you build this one row (or this one round of fixes), push, report and stop. You will not be resumed: a later row or a later round goes to a fresh worker, so your report and your `pr-text.md` must say everything the next one needs.

**Before any code**
- Read the row (a ticket: the issue and the spec sections it names; a plan row: its table line, its files line, every ⚑ that names it), the rulings it cites, `CLAUDE.md` and `.claude/agents/builder.md`. Read the spec sections the row touches, not whole specs.
- **Mockups first** (`CLAUDE.md`, How we work): the row names its mockup's file and the date Francis approved it, or says "none: data and logic only". Open the mockup and look at it. A visible piece with neither: build its data, rules and tests, stop before the screen, and say so.
- If the row waits on a row not yet on its base, or on a ⚑ not yet ruled, stop and report.
- If unsure, stop and ask the driver.

**Build**
- In your own worktree only, on your branch: for a ticket, from the freshly fetched tip of the integration branch `<spec-name>`; for plan work, on the batch's branch `<branch-name>`, from freshly fetched `origin/main` for the batch's first row, from the freshly fetched branch itself for a later row or a round of fixes. Keep your own files (notes, `pr-text.md`) in your scratch subfolder `<scratch-path>`, never in another worker's. Never work in, or switch the branch of, a folder another session uses. Run `npm ci` there if `node_modules` is missing (it installs exactly what `package-lock.json` lists and never rewrites it; never `npm install`, which rewrites the lock file; never in `<home>\Documents\grimoire`).
- **The cloud container** has Chromium, but no WebKit, no Docker daemon and no running Postgres: database tests and WebKit run on CI or the PC, so say in `pr-text.md` that you did not run them. Layout checks here: `scripts/check-slot.sh npx playwright test -c playwright.chromium.config.ts <specs> --workers=2` (`docs/testing.md`). Run every layout spec that shows a component you changed (`grep -rl <ComponentName> tests/layout`), not only the specs you edited. A long run goes in the background (`run_in_background`, or Monitor): a `sleep` is blocked.
- Tests with each feature, each with its purpose as a plain sentence first. On a `fix-` branch the failing test comes first as `it.fails`, in a commit of its own: that commit passes the commit hook (the test fails, as marked); only a plain failing test is refused, so never fold the test and the fix into one commit. And test files change only with the Edit tool (`.claude/README.md`, Fix branches).
- Hard rules in `CLAUDE.md` in full: every command through `can()` and an event; tokens only; never a disabled button; the Components inventory's Code column kept current.
- The smallest change that fully delivers the row (`docs/12-coding-standards.md`); say in `pr-text.md` what you skipped and any risk. With a ticket, use `tdd`.
- Stay inside the row's files. Another builder works on another row at the same time: if you need a file outside your row, stop and say which.
- **No decisions are yours:** collect ⚑. A new feature or a change to approved behaviour is a scope check (`docs/08-roadmap.md`): write it and stop.
- **A migration:** stop and report before writing one; the driver says how it goes (`.claude/agents/builder.md`, Database).
- Self-review (`CLAUDE.md`, Components): every state, 375 px, long names, 0 and 999, light and dark.
- `npm run check` passes before every commit; never `--no-verify`, not even on a temporary commit. In your worktree, run `npm run hooks:install` once (it turns the hooks on there only). Before queueing for the full check, run `npm run check:quick` (a few minutes; outside the slot). Then commit through `scripts/check-slot.sh git commit …`: the hook is the check, so don't run it by hand right before; the slot refuses a commit while the hooks are off. A docs- or mockup-only change runs `npm run docs:check` only, never the full check by hand. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Push and `pr-text.md`** (plan work: the pull request)
- GitHub reads go through REST: `gh api repos/Withywindle-Grove/Ogham/…`. Here `gh pr …` fails (GraphQL, 403).
- **A ticket, before you report:** merge the integration branch's tip into your branch (fetch first), so the driver's merge is clean; re-run the check if the merge brought changes. **Plan work, before the final push:** `gh api repos/Withywindle-Grove/Ogham/pulls/<n> --jq .mergeable_state`: if `dirty` (it conflicts), merge `origin/main` in first; if merely behind, don't.
- **Push** your branch as `.claude/README.md`, Workers says. A ticket's builder opens no pull request. Plan work: once the pull request is open, one push, when the row is done; for a later row or a round of fixes, update the pull request's text instead of opening a new one.
- **Do NOT add the `ready` label**: the driver adds it after its review and the fixes, which a fresh worker makes (`.claude/README.md`, Saving CI minutes).
- Your `pr-text.md` (plan work: the pull request's text) is the status report in `.claude/agents/builder.md` (eight points): what's built; migrations; tests; not done or fragile; ⚑; numbered manual checks and **the gallery pictures you expect to change, and why**, announced on one line the CI reads, `Gallery pictures expected to change: <name>.png, <name>.png` (or `none`; `docs/testing.md`, Announced redraws); **after any review fix, re-read that line** and add what the fix redraws; **departures from the ticket and its spec (or the plan) and from the mockup, here and only here**; for a piece with something to see, **the built screen beside the approved picture**; the ⚑ count. End with:
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

**Output** (to the driver, under 100 words): your branch and head commit (plan work: the pull request's number too), files changed, pictures expected to change, departures, ⚑, the check's result line quoted exactly (or its `rc=` and `secs=` line from `/tmp/ogham-check-times.log`), and what you could not test. Then stop; don't wait for CI, and don't expect to be resumed.
