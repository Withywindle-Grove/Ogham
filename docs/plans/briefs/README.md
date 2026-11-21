# Briefs for cloud builders

A cloud builder is a Claude Code session started by Francis in the cloud (claude.ai/code, repository Withywindle-Grove/Ogham, branch main, model Opus) with one line: "Read docs/plans/briefs/<file> and do exactly what it says." It has no one to ask, no private packs, no database keys, and returns a pushed branch (and a pull request if it can open one). The coordinating Builder's local reviewer then reviews it like any other. Each brief names its plan piece; the plan stays the definition of the piece.

## Rules every brief relies on (read these once; each brief adds its own task and fences)

**Read first:** `.claude/agents/builder.md` (how a builder works here; where it says "ask", write the question down instead), then `CLAUDE.md` at the root (hard rules, testing, "Things Claude gets wrong").

**Fences, always:**
- No migration, nothing under `supabase/`, no workflow file, no `.env`, nothing under `packs/`, no new dependency. If the task turns out to need a database change or a change to who may read what, STOP that part and write the question down.
- Do not edit `docs/07-content-packs.md` (it is read by code): if it needs a line, write the proposed line in your status file.
- No screen unless the brief says so: no component, no route, no CSS.
- Existing tests: add, never edit. Never use `--no-verify`.
- Invented names only in code, fixtures and tests ("Bog lurker", "Lantern Warden", coins such as "crowns, herons, bits"): no real game, book, setting, adventure or creature names, no text or numbers from any rulebook. A pre-commit hook scans for real names.
- Do not run database tests.

**How to work:**
- Check out the branch the brief names (`git fetch origin <branch>`, `git switch <branch>`); it already exists on the remote at main's head. Bring it up to `origin/main` first if main has moved. If you cannot push to it, push to a branch of your own and say which.
- Each test's purpose as a plain sentence first, then the test, then the code.
- `npm ci`, then `npm run check` (type check, lint, tests, build). It must pass before you commit; the pre-commit hook runs it too. If it cannot run in your environment, say exactly what failed and run at least your new test files with vitest.
- Push ONCE when done. If you can open a pull request to `main`, open ONE with the title the brief gives, no label, no auto-merge, and do not merge it. If you cannot, leave the branch pushed and say so.
- Add a status file `docs/status/2026-11-13-<branch>.md`: what was built, the tests added, what was not tested or could not run, every question, and the line "Reviewed: not yet (local reviewer to follow)". Update the plan's Departures in place only if you departed from it.
- **If unsure, stop and say so; don't guess.** Build only what is certain and write each question plainly at the top of the status file.
- Final message, short: the branch, the pull request's number if any, files changed, whether `npm run check` passed with the test count, what you could not do, every question.
