---
status: absorbed
milestone: December first play (how the work is run from 27 November)
absorbed-into: CLAUDE.md (How we work, One integration branch per spec; Branches and pull requests; the build loop), .claude/README.md (Review before a merge, Workers, the build loop table, Saving CI minutes, Measuring), .claude/agents/driver.md, .claude/agents/builder.md, .claude/briefs/builder-brief.md, docs/agents/issue-tracker.md
supersedes: lc-2, the words "once per batch, after its last row" for a spec's work only (`design/rulings/process-loop-1-sitting-c-2026-11-27.md`); work begun from a `docs/plans/` file keeps lc-2 and its batches
---

# One integration branch per spec (2026-11-27)

Francis ruled in chat with the driver session on 27 November. His words are in quotes.

| Id | Ruling | Why | Francis |
|---|---|---|---|
| ib-1 | **A spec is built on one integration branch, with one pull request.** See the rule below | One review and one picture run per spec save CI minutes. Nothing half-done reaches `main` ("whole, once", po-4). It matches the issue tracker's close rule. Francis sees the screen once, whole. Cost: nothing is live until the spec is done, and one branch lives long | "Switch to one branch and change the project rules to take this approach moving forward" |

## The rule (ib-1)

| Step | What |
|---|---|
| 1 | When `/implement-spec` starts, the driver makes the branch `<spec-name>` from `main` (for example `loop2-player-sitting`) |
| 2 | A fresh builder per ticket works on its own branch from the integration branch's tip, in its own worktree. It opens no pull request. Its commit hook is the full check. It pushes its branch and writes the status report, departures, ⚑, the gallery line and the built screen beside its picture to `pr-text.md` in its scratch folder. Before it reports, it merges the integration branch's tip into its own branch |
| 3 | The driver (or a Sonnet worker) merges each finished ticket branch into the integration branch, comments on the ticket with the merge commit, and closes it |
| 4 | After the first merge the driver opens one draft pull request from the integration branch into `main`, titled `Spec: <name> (Rows: #a, #b, …)`. Its text gathers each ticket's status, departures, ⚑ and gallery line. It closes the spec's parent issue when it merges |
| 5 | One review per spec, at the end, on the whole integration branch (`code-review` through the `reviewer`), then one fresh fix worker. Then the `ready` label, one layout run, sitting C, and merge on Francis's yes |
| 6 | A ticket still blocked when the rest are done (for example by a frame not yet approved) leaves the spec's pull request and follows as its own pull request from `main` after the merge, so it does not hold the spec |
| 7 | Unchanged: work begun from a `docs/plans/` file before 2026-11-27 keeps its batches (up to three rows, one pull request each). The merge-batch rule (cq-2) and the seats (three builders, one full check) stand |
