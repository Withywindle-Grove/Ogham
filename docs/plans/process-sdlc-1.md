# Plan: process step 1 — review in CI, the test guard, CI triage

Written by the design agent, 2026-11-01, from `design/rulings/process-ai-native-sdlc-2026-11-01.md` (P3, P5, P8; Francis ruled yes to all). Docs-side pieces (P1, P2, P4, P6, P7) landed with the ruling's pull request; this plan is the code side. Technical only: no app behaviour changes.

## Rests on
- `REVIEW.md` (root): the review policy, with the machine-readable tally line.
- `.claude/README.md`: the artifact chain, the two numbers.
- `docs/testing.md`, Git hooks and The GitHub check (add rows for the new hook and jobs).
- `.claude/settings.json`: existing `PreToolUse` hooks (`guard-migrations.mjs`, `check-names.mjs --hook`) as the pattern.

## Build order
1. **Test guard hook (P5).** `scripts/guard-tests.mjs`: a `PreToolUse` hook on `Write|Edit|MultiEdit` that blocks edits under `src/**/*.test.*`, `supabase/tests/**`, `tests/layout/**` and `scripts/*.test.mjs` when the current branch name starts with `fix-`, with a plain message: "On a fix branch the test is written first, on its own commit, then the code is fixed without touching it. To change a test, say so to Francis or use a non-fix branch." Unit test beside it (`guard-tests.test.mjs`), following `guard-migrations.test.mjs`. Register in `.claude/settings.json`. Row in `docs/testing.md`, Git hooks.
2. **Automatic review (P3).** `.github/workflows/review.yml`: on `pull_request` (opened, synchronize, ready_for_review), skip Dependabot and docs-only PRs (reuse the `changes` job's kind, or a path filter); run `anthropics/claude-code-action` with `ANTHROPIC_API_KEY` from repository secrets, a prompt that says "Review this pull request against REVIEW.md; post one comment", allowed tools read-only (`Read, Grep, Glob, Bash(git diff *), Bash(git log *), Bash(gh pr view *), Bash(gh pr diff *)`), model Sonnet by default (Opus when the PR touches `supabase/` — the RLS pass matters most there). Findings never block the merge on their own: branch protection and Francis do. Row in `docs/testing.md`, The GitHub check. The `reviewer` agent stays for local use and reads the same file.
3. **CI triage (P8).** In `check.yml`, a final step `if: failure()` on the check, database and layout jobs: `claude -p` reads the failed step's log and writes three lines (likely cause · flaky or real · what to try) as a PR comment. Same key, Sonnet, read-only tools. Skip on Dependabot PRs.
4. **CHANGELOG draft (P8).** A manually triggered workflow (`workflow_dispatch`) or a `npm run changelog:draft` script that asks `claude -p` for the gate's CHANGELOG entry from the merged PR titles since the last tag, in plain language a player could read, written to a branch for Francis to edit. Optional in this step if the budget is tight: say so in the status report.
5. **Status report numbers (P7).** Already in `builder.md`; confirm the next report carries them.

## Tests (purpose first)
- The test guard blocks a test edit on a `fix-…` branch and allows it on any other branch.
- The test guard lets non-test files through on a `fix-…` branch.
- The review workflow skips Dependabot and docs-only pull requests (workflow lint or a dry run on a test PR).
- `npm run check` stays green; no new dependency in `package.json` (the action runs in CI only).

## Scope checks (write one and stop)
- No change to app code, migrations or screens.
- No automatic merge on review findings; no `@claude` fix loop pushing to branches in this step (later, once the review has run on ten PRs).

## ⚑ for Francis (ask at the start)
1. ~~The monthly spend cap for the API key, and whether the review runs on every PR or only on PRs touching `src/` and `supabase/`.~~ **Ruled 2026-11-01:** [amount removed] a month (organization limit in the Anthropic console; a [amount removed] warning threshold suggested); the key is in the repository secrets as `ANTHROPIC_API_KEY`. The automatic review runs only on pull requests touching `src/` or `supabase/`; docs-only and Dependabot pull requests are skipped (docs PRs have `docs:check`).
2. ~~Build order 4 now or later.~~ **Ruled 2026-11-01:** now.

## Francis's part
Done 2026-11-01: key `grimoire-ci` created, repository secret `ANTHROPIC_API_KEY` added, [amount removed] monthly limit under Organization settings → Billing → Spend limits.

## Estimate
8–12 builder turns on Opus (workflow files and a hook script; nothing touching the app). Not Fable.

## Departures

**Designer, 2026-11-03 (`design/rulings/m5b-builder-questions-2026-11-03.md` bq-6):** P5 as written couldn't pass the pre-commit check. New method: on a `fix-` branch the failing test is committed marked `test.fails`; the fix commit removes `.fails` only. **Builder task:** `scripts/guard-tests.mjs` allows that one edit on a `fix-` branch (a test file change that only removes `.fails`) and blocks any other; a test for the guard.
- **The action, not a bare `claude -p`, for triage and the CHANGELOG draft.** All three use `anthropics/claude-code-action@v1.0.266` (the same Claude Code CLI, run in its automation mode), pinned to one release, so nothing is installed by hand and there is one version to bump.
- **Claude never posts.** Claude returns its text as structured output (`--json-schema`), and a plain shell step posts it (`.github/scripts/pr-comment.sh`). The review's posting is a separate job, so the token that can write comments never reaches Claude; its job only reads. Each kind of comment (review, triage) is one comment, updated on each run, instead of a new comment per push.
- **Triage reads a file, not the run.** `gh run view --log-failed` doesn't work while the run is still going (the triage job is part of it), so a shell step fetches each failed job's log through the API (last 400 lines, colour codes stripped) and Claude reads that file with Read, Grep and Glob only (no Bash).
- **Review triggers and limits.** Also on `reopened`; drafts are skipped; a newer push cancels the older review; `--max-turns` caps each run (review 40, triage 15, draft 20) to keep inside the [amount removed] cap.
- **CHANGELOG draft as a manual workflow** (`.github/workflows/changelog-draft.yml`, not an npm script). It pushes a branch `changelog-draft-<milestone>-<run>` and doesn't open the pull request: pull requests opened by the workflow's own token don't run the checks, so Francis opens it from the link in the run's summary. The insert step is `scripts/changelog-insert.mjs`, with its own test.
- **The test guard reads the branch of the edited file's folder**, not of `$CLAUDE_PROJECT_DIR`, so a helper agent working in its own worktree is judged by its own branch.
- **Build order 5:** `.claude/agents/builder.md` already carries the two numbers (item 8 of the status report); nothing to change.
