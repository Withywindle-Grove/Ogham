# The driver's working rules

One page of the rules in force for the driver, each with its source. Compiled 19 Nov 2026 by the seventeenth driver from the rule files on `main` and Francis's words since; it adds no rule of its own. A rule file wins over this page: when one changes, this page changes in the same pull request. Short names: `README` = `.claude/README.md`; `driver.md`, `builder.md` = `.claude/agents/`; `09` = `docs/09-decisions-log.md`; "memory" = a note in the project's memory folder.

## Starting and handing over
- Start from `handover-driver.md` in the memory folder, never from history; never resume yesterday's conversation. (driver.md, Start; README rvw-5)
- A fresh driver each morning and when the conversation passes about 250,000 tokens (lp-6, Francis, 27 Nov; was 400,000). **At the limit the driver writes the handover and hands over on its own, without asking.** (driver.md; README rvw-5; Francis, 19 Nov)
- **A fresh context may come from `/clear` instead of a new session**, once the handover is written and pushed. The handover names every running worker (ID, row, brief, branch or PR), so the cleared driver can pick up their reports. `/clear` keeps the session's trust card, PR subscriptions, running workers and container; a new session has none of them. Home Two may `/clear` likewise, restarting from the prompt the driver gives Francis. (Francis, 24 Nov: "Yes write clear in")
- Workers started from a brief finish their task past the limit; only the driver hands over. (README rvw-5)
- Re-create the hourly check at the start: "what are the builders working on and what is our bottleneck?" (Francis; memory, handover)

## Talking to Francis
- He talks only to the driver; the driver relays to other sessions itself. (driver.md; memory, coordinate-through-driver)
- Short replies, one question or step at a time. (memory, one-at-a-time)
- **An open question holds the updates to Francis, never the building.** Workers keep building; their news waits for his answer or for "status". (memory, hold-updates-while-question-open; Francis, 19 Nov)
- Verify every claim against the source (GitHub, the database, the code) before telling him. (memory, driver-on-fable)
- Pictures: one line on what it is, what it shows, "I opened it", my fixes, then "Approve with those fixes?" (memory, review-style-he-likes). Pictures once per whole screen, not per row, unless a row departs from its mockup. (README rvw-14)
- No dates: report the order, rows live / built / not built, and the bottleneck. (memory, no-dates-sequence-and-completeness)
- Decisions once a day: settle what is reversible inside an approved mockup and list it afterwards; everything else in one sitting. (README rvw-13)
- ⚑, and design questions touching the data model, permissions or hidden data, a screen with no approved mockup, or anything that failed twice on Opus: not the driver's; a short Fable design sitting. (driver.md, Never; README rvw-4)

## Ordering the work
- One screen at a time, to live; the order in driver.md. (README rvw-9)
- **One check run per batch:** rows of one plan that touch the same files go in one pull request, at most three rows, one review and one layout check for the batch, its title naming every row; batches that share no file may run side by side, two or three in flight. (CLAUDE.md; 09, 19 Nov: "Yes, batching too. Let's make sure this is carried forward.")
- **A fresh worker per row and per fix round:** one pull request and one check run per batch stay; one builder per batch goes. Each row of a batch, and each round of review fixes, is done by a fresh short-lived worker that commits to the batch's branch; a worker is never resumed for a later round. A batch's pull request is opened as a draft by the worker of its first row; later rows' workers push to the same branch; the layout checks still run once, when the driver adds `ready`. (CLAUDE.md; README, Saving CI minutes; 09, 22 Nov: "Yes to 'fresh worker'", "Your suggestion")
- Builders on Opus at medium effort (`effort: "medium"`); the driver on Opus at medium; Fable is the project-wide advisor (Francis, 24 Nov). Merges, conflicts, watching CI and look-ups on Sonnet or Haiku workers. (Francis, 19 Nov; README rvw-10)
- At most four local sessions at once; cloud builders are outside the four. (README rvw-10; Francis, 19 Nov)
- In a cloud driver session, **at most three builders at once; reviewers don't count**, and **one heavy job (a full check or a layout run) at a time** (09, 25 Nov: two container restarts with four builders and parallel checks on a 4-core, 15 GB machine). Never two workers on the same file, branch or task; check what is in flight before starting one. These builders are subagents of the driver's session by default (Francis, 27 Nov: "Agree, go with subagents here"). Playwright runs use at most `--workers=2` (technical, 27 Nov). (README, Roles and models; was four, Francis, 24 Nov: "Four builders max if reviewers use less")
- **Push as you go:** a worker commits and pushes its branch each time its check passes; the pull request opens when the row is done (a branch push without a pull request runs no CI). A branch with an open pull request pushes once. (Francis, 24 Nov: "Yes")
- **One full check at a time in a cloud container:** builders run the full check in the check slot, `scripts/check-slot.sh <command>` (one slot unless `OGHAM_CHECK_SLOTS` says more; each run's time logged to `/tmp/ogham-check-times.log`), and only the tests they touch while working. Four checks at once on four cores slowed each other and made tests time out. The Scene and town UI failures seen the same day with two at once were not caused by the second check but by a stray `node_modules/node_modules` link (below); two slots have not been timed again since, so it stays one until they are, and two are kept only if they gain time. (technical ownership, 24 Nov; 09, 24 Nov; Francis, 24 Nov: "Let two checks run at a time, if it gains us time keep it, if it slows things down, go back to one.")
- **The commit hook is the check for a commit:** where the hook is on, a worker commits through `scripts/check-slot.sh git commit …` and doesn't run the full check by hand right before. A change of docs or mockups only runs `npm run docs:check` (the hook's docs-only path, `scripts/docs-only.mjs`), never the full check by hand. (Francis, 24 Nov: "Skip the full check on pull requests that change only docs or mockups, and run the docs check alone.")
- **Pack changes are the Pack Creator's alone;** it builds in its own scratch folder, then copies the finished pack file into `packs/`. (Francis, 24 Nov: "it builds in its scratch folder, then copies the finished pack file into packs/")
- **No cut line on 27 November:** we build until Francis says stop. (Francis, 24 Nov: "there is no cut line on nov 27. we build until i say stop.")
- **Test-ready:** all the functionality for 5 December complete in its first iteration, and every fix or change Francis has already sent done, so he can test it whole and give feedback while the pack and the settlement are built; the same for the Player tab. (Francis, 24 Nov; `docs/plans/december-first-play.md`, How we know it works)
- Builders are subagents of the driver's own cloud session by default. A separate cloud session is the exception: extra machine power for one whole batch that shares no file with the work in the driver's session, only when the check queue is long; it works from the driver's brief, reports in its pull request's text and pushes nothing after `ready`. (Francis, 27 Nov: "Agree, go with subagents here"; was no restrictions, 19 Nov)
- Home One (PC) is a fourth builder seat, one batch at a time, through its own short-lived builder subagent from the driver's brief (sent in full by send_message; reports by bridge), and runs the PC checks: audits, TEST runs, WebKit layout. MAIN-database pushes go to the PC session in manual mode (Zazzy), each with Francis's Allow there. (Francis, 27 Nov: "Agree get home one building"; 26 Nov: "Zazzy Matsumoto is in manual mode so use it for pushes. Every other pc check can go to home one")
- Before waiting on CI, ask what can build now. (memory, idle-seats-check)
- Mockups first; a plan piece names its mockup and approval date or says "none: data and logic only". Whole, once (po-4). (CLAUDE.md; README)
- No new process rules before 5 December, except the ones Francis orders. (README rvw-16; 09, 19 Nov)

- Skills: which skill for which work is in `.claude/README.md`, Skills; the rules win where it differs. A review Francis asks for reports only until he picks findings by number; the local reviewer flow before a merge is unchanged. (Francis, 21 Nov: "approve")
- Remind Francis of `impeccable` and `hallmark` in one line at the moments in `.claude/README.md`, Skills (The driver's reminders); he may say no. The skill sets not used are listed there too. (Francis, 22 and 23 Nov)

## Briefing workers
- Every worker gets a brief in a file: first line `Row: <id>`, then the guard line word for word, the objective, the output, the files to read, the boundaries, "if unsure, stop and ask". The pull request's title carries the row. (driver.md; memory, no-routing-round-guards; README rvw-15)
- The `Row: <id>` line goes in the worker's prompt itself as well as in its brief file: the usage report reads the prompt. (README, Measuring; 09, 22 Nov)
- A later worker's brief (a batch's next row, a round of review fixes) names the branch, the files and the findings. (driver.md; README, Saving CI minutes)
- Each worker keeps its files in its own scratch subfolder, named in its brief. (lesson, 22 Nov)
- In a cloud clone with linked worktrees, never run `npm run hooks:install` (its relative path doesn't reach linked worktrees); where the hooks are on through an absolute `core.hooksPath`, workers commit through `scripts/check-slot.sh git commit …`; where they are not, they run `scripts/check-slot.sh npm run check` by hand before each commit. (lesson, 22 Nov; CLAUDE.md, Testing; Francis, 24 Nov)
- Builders use the standard brief, `.claude/briefs/builder-brief.md`.
- **Worktree setup:** after `cp -al …/node_modules` into a new worktree, check there is no `node_modules/node_modules` link (`ls node_modules/node_modules` must say No such file; `unlink` it if present). A self-loop there, made once inside the shared `node_modules`, is copied into every worktree; packages then load twice and the UI tests miss re-renders, failing locally while CI stays green. (lesson, 24 Nov; 09, 24 Nov)
- Never start a worker to do what you were refused; a refused action is never handed to another session, branch, tool or command. (driver.md, Never; memory, no-routing-round-guards)
- Never work in, or switch the branch of, another session's worktree; use a worker in its own. (CLAUDE.md, Parallel work)

## Reviewing and merging
- Each code pull request gets one local `reviewer` run before it merges; docs-only and scripts-only are skipped; migrations and access rules always reviewed. One comment, and "Reviewed: local reviewer, N findings, fixed / not" in its text. (README; REVIEW.md)
- A row with something to see shows its built screen beside the approved picture. (CLAUDE.md; builder.md)
- **The driver adds `ready`** after its review and the fixes (made by a fresh worker), so the layout checks run once. After adding it, re-run the labelled run, not the push run. (CLAUDE.md; builder.md; handover lesson, 19 Nov)
- **Before adding `ready`, compare the pull request's "Gallery pictures expected to change" line with what the fixes touched**; a stale line costs a second picture run. (docs/testing.md, Announced redraws; redraw-line-1, Francis, 20 Nov)
- Merge on green under Francis's standing yes, and list the merges afterwards. Not without him: pull requests with migrations (until he has pushed them to the main database), screens he hasn't seen, drafts. (memory, standing-merge-permission, Francis 17 Nov)
- `gh pr merge <n> --merge --repo Withywindle-Grove/Ogham` as a lone command. (memory, standing-merge-permission)
- A pull request merely behind `main` is not updated; one that conflicts merges `main` in before its push. (CLAUDE.md, Things Claude gets wrong; README)
- Never `--no-verify`, not even on a temporary commit. (CLAUDE.md)

## CI
- The layout job runs only with `ready`. Push once. Re-run only machine faults. (README, Saving CI minutes; memory, ci-cost-rules)
- Full checks by day on pull requests; on `main` a merge runs check and database, and its pictures are checked by the night run at 07:00 UTC (going live waits for check and database only); a red night run is fixed first the next day; if `main` goes red, fix it before merging anything else. To check main's pictures sooner: `gh workflow run check.yml --ref main`. (CLAUDE.md; docs/testing.md, The GitHub check; Francis, 19 Nov: "a nightly picture check sounds best can you implement that?")

## Database
- Every migration to the test project first; never edit an applied migration; drops, renames and deletes need Francis's plain-words OK. (CLAUDE.md)
- Until 5 December: any migration, the driver pushes to `main` after his one-word "push" in the chat for that push; backup first, dry run lists only the expected file, advisors after. If Claude Code's own check refuses the push, Francis runs it himself. (09, 19 Nov; memory, main-db-push-by-francis)
