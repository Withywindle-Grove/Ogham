# CI: `CI_RUNNER` = `auto`, the PC first and GitHub when every PC lane is taken (ci-auto-1)

The driver sets `CI_RUNNER` = `auto` after the merge (GitHub → the repository → Settings → Secrets and variables → Actions → Variables).

1. With nothing else running, push to one pull request (or add `ready` to one). Open **Actions** → the run → **pick**: the log ends "auto: 0 other run(s) on or waiting for the PC, 2 lane(s) from CI_LOCAL_SLOTS: the PC." Its other jobs show a `pc-*` runner, and there is no Overflow notice.
2. While that run is still going, push to a second pull request. Its **pick** says "1 other run(s) ...: the PC." and its jobs show a `pc-*` runner too (one run with a check and three picture shards is one run, not four).
3. While both are still going, push to a third. Its **pick** says "2 other run(s) ...: GitHub's machines." The run's page shows a notice **Overflow to GitHub**, its summary has the same line, its jobs show a GitHub-hosted runner, and its check and picture shards don't wait for the PC's.
4. Push a docs-only change while two PC runs are going: it overflows too, and costs about 3 billed minutes.
5. Set `CI_RUNNER` back to `pc` when done, or leave `auto` if the driver says so; a run on `pc` shows "CI_RUNNER is unset." in pick's log and every job on a `pc-*` runner.

Pictures: none change (CI files and docs only).
