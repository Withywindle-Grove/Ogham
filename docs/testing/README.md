# docs/testing/ — manual checks, one file per pull request

Ruled 2026-11-05 (`docs/09-decisions-log.md`). Each pull request that needs manual checks writes them here as `<branch>.md`, never into `docs/testing.md`: shared lines made every open pull request clash and re-run CI.

- **Name:** the branch name (`m5b-sheet-3-magic.md`).
- **Content:** a one-line heading (what the step is, its ruling ids), then numbered checks: the device, what to open, what to tap, what should show. Invented names only.
- **Linked from** the pull request's status report (`docs/status/<date>-<branch>.md`, item 6).
- **The gate list** (`docs/testing.md`, "M5b — gate run, in play order") is edited only by the designer, who adds a pointer to the file when flipping a check to built.
- The sections already in `docs/testing.md` stay there.
