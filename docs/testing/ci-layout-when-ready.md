# CI: the picture check waits for the ready label (Francis, 2026-11-05)

These checks work once this pull request has merged and GitHub Actions is running again (it was blocked by billing when this was built). They use real pull requests, so do them on the next ones that come along rather than making throwaway ones (each push costs CI minutes).

1. On GitHub, open the next pull request that changes screen code (anything under `src/`), before anyone adds a label. In its checks, **layout** is red within a minute, and opening it shows "Pictures not checked yet: add the ready label when this pull request is finished." **check** and **database** run as usual. The **Merge** button says required checks are failing. No "CI triage" comment appears for this red.
2. On that pull request, once check and database are green, add the label: on the page, **Labels** (right-hand column) → **ready**; or on the computer, `gh pr edit <number> --add-label ready`. A new run starts. In it, **check** and **database** finish in seconds (their summaries say they already passed for this commit), and **layout** runs the full picture check (about 20 minutes). When it's green, the Merge button is allowed.
3. Push one more commit to that pull request while the label is on (only if a fix is needed anyway). The new run runs **layout** in full again, without anyone touching the label.
4. Open the next docs-only pull request (no label). **layout** is green with "No screen files changed: layout is skipped." in its log, and the pull request can merge without the label.
5. After a merge to main that changed screen files, open the run for that push on the **Actions** tab: **layout** runs in full, with no label involved, and the production deploy waits for it.
6. Optional, the next time someone adds another label anyway (**review** or **preview**, which start their own paid jobs) to a pull request whose checks have all passed: the Check run that label starts finishes in seconds, with check, database and layout each saying they already passed for this commit.

It feeds no gate check. No gallery pictures change.
