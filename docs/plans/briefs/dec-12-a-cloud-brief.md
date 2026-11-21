# Brief for a cloud builder: dec-12 piece A (an adventure's hooks are read and checked)

Written by the lead on 2026-11-13. A cloud session is started with one line: "Read docs/plans/briefs/dec-12-a-cloud-brief.md and do exactly what it says."

You are a builder for the repository Withywindle-Grove/Ogham (the app "Grimoire"/"Tome"), working in the cloud with no one to ask. Build exactly one small piece and push it. **Your branch is `dec-12-a-adventure-hooks`**: it already exists on the remote at main's head; check it out (`git fetch origin dec-12-a-adventure-hooks`, then `git switch dec-12-a-adventure-hooks`) and bring it up to `origin/main` first if main has moved. If you cannot push to that branch, push to a branch of your own and say which.

READ FIRST, in this order:
1. .claude/agents/builder.md : how a builder works in this repository. Follow it, except that you cannot ask Francis anything: where it says "ask", write the question down instead (see below).
2. CLAUDE.md (root): the rules (hard rules, testing, "Things Claude gets wrong").
3. docs/plans/dec-12-calls-to-adventure-and-notes.md : your brief is PIECE A ONLY ("The reader and the checker"). Do not build pieces B to F.
4. docs/design/rulings/dec-pack-formats-2026-11-11.md : only the rows pf-7, pf-7a and pf-5a.
5. docs/07-content-packs.md : only what you need about adventures, links of the form [[kind:id|label]], and "Rule hooks" (so you do not confuse `hooks` with `adventureHooks`).
6. The existing code that reads an adventure pack and that resolves [[kind:id|label]] links, and scripts/check-pack.mjs with one of its test files, to copy how things are read, reported and tested here. Find them by searching; do not guess paths.

THE TASK (piece A): (a) the app reads an adventure's `adventureHooks: [{ id, name, text, pays, giverNpcId? }]` (a typed reader with tests; GM-only until sent: nothing in this piece sends a hook's text to a player); (b) `adventureHook` joins the kinds a [[kind:id|label]] link may name, with the same fallback as the others (an unread or unresolved link shows its label as plain text); (c) `npm run pack:check` checks `adventureHooks` (each entry's shape; a `giverNpcId` that names no npc in the pack; an [[adventureHook:id]] link that names no hook) in the checker's existing style of errors and notes. No screen: build no visible part, no route, no component.

BOUNDARIES:
- No migration, nothing under supabase/, no workflow file, no .env, nothing under packs/, no new dependency. Do not edit docs/07-content-packs.md (it is read by code and changes there need a different process): if 07 needs a line, write the proposed line in your status file instead.
- If reading hooks safely (GM-only until sent) would need a database change or a change to who may read what, STOP that part: build the reader and checker against the pack's JSON only, and write the question down.
- Existing tests: add, never edit. Never use --no-verify.
- Invented names only in code, fixtures and tests (for example "Bog lurker", "Lantern Warden"): no real game, book, setting, adventure or creature names, no text or numbers from any rulebook. A pre-commit hook scans for real names.
- You have no private packs and no database keys, and do not need them. Do not run database tests.

HOW TO WORK:
- Each test's purpose as a plain sentence first, then the test, then the code.
- Run `npm ci`, then `npm run check` (type check, lint, tests, build). It must pass before you commit; the pre-commit hook runs it too. If it cannot run in your environment, say exactly what failed, and run at least the new test files and the existing scripts/*.test.mjs with vitest.
- Commit on the branch you were started on and push it ONCE when done. If you are able to open a pull request to main, open ONE titled "dec-12 A: an adventure's hooks are read and checked (pf-7, pf-7a, pf-5a)", with no label and no auto-merge, and do not merge it. If you cannot open one, leave the branch pushed and say so in your final message: someone else will open it.
- Add a status file docs/status/2026-11-13-dec-12-a-adventure-hooks.md : what was built, the tests added, what was not tested or could not run, any question, and the line "Reviewed: not yet (local reviewer to follow)". Update the plan's Departures section in place only if you departed from it.
- The pull request description (or your final message): what changed, the tests, what you could not do, any question, ending with the line: Generated with Claude Code.

IF UNSURE, STOP AND SAY SO; DON'T GUESS. Build only what is certain and write each question plainly at the top of the status file.

FINAL MESSAGE (short): the branch, the pull request's number if you opened one, files changed, whether `npm run check` passed and the test count, what you could not do, any question.
