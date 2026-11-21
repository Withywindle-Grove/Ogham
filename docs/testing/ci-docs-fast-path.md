# CI and the commit hook: the docs-only fast path (Francis, 2026-11-05)

These checks work once this pull request has merged and the main checkout (`<home>/Documents/grimoire`) is on an up-to-date main: every worktree runs the hooks in the main checkout's `.githooks/` folder.

1. On the computer, in any worktree on a throwaway branch, change one line in a file under `docs/` (say `docs/testing/README.md`), then run `git add docs/testing/README.md` and `git commit -m "try"`. You should see "Docs-only commit: running the docs check only", then "Docs check passed", and the commit is made in a second or two instead of about 3½ minutes.
2. In the same branch, change one line in a file under `src/` as well, `git add` it and commit. You should see the full check start (typecheck, lint, the tests, the build), as before.
3. Stage a docs file that holds a broken link (e.g. `[x](nowhere.md)`) and commit: the docs check stops the commit and names the file. Remove the link.
4. On GitHub, open the next docs-only pull request's checks: **changes** says "Docs-only change: only the docs check runs."; **check** runs only `npm run docs:check` (no "Run npm ci" step), finishing in well under a minute; **database** and **layout** are green with their work skipped.
5. Open the next pull request that changes code: **check** runs `npm ci` and `npm run check` as before.
6. Delete the throwaway branch (`git checkout main`, then `git branch -D <branch>`).
