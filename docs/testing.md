# Testing

How we keep things from breaking as the app grows. Automated checks catch most mistakes; the manual checklist covers what only a person on a real device can judge.

## Rules

- **Every feature ships with tests.**
- **Every bug fix adds a test that would have caught it.**
- **Write each test's purpose as a plain sentence first** (e.g. "names every missing or blank setting"), then the test. Test what the app does, not how the code is written, so tests survive tidy-ups.
- **Run `npm run check` before every commit, and never commit if it fails.**
- **Before each milestone gate,** run the manual checklist below and add new items for that milestone.
- Tests use invented data only (no game-system names, rules text or numbers) and never real keys or settings from `.env`.

## Running the checks

| Command | What it does |
|---|---|
| `npm run check` | Type check, lint, tests, the docs check and build, in order; stops at the first failure. Run before every commit. |
| `npm run typecheck` | TypeScript type-check (strict) |
| `npm run lint` | ESLint: common mistakes and React hook rules |
| `npm test` | Vitest: all automated tests, once |
| `npm run build` | Production build, as Vercel does it |
| `npm run test:db` | Database access-rule tests, against the **test** project locally, or a throwaway local Supabase on GitHub (not part of `check`; see below) |
| `npm run test:layout` | Layout checks in a real browser at phone and tablet widths (not part of `check`; see below) |
| `npm run db:push:test` | Apply `supabase/migrations/` to the **test** project |
| `npm run db:push` | Apply `supabase/migrations/` to the **main** project (only after the tests pass) |
| `npm run db:types` | Regenerate `src/core/database.types.ts` (the code's description of the tables) after a database change |
| `npm run db:backup` | Save the main project's structure and data into `backups/` before a migration (see Backups) |
| `npm run pack:check -- <file>` | Check a setting-rules pack with the app's own reader: counts, anything left out, entries the editor would ask to fix. Name several files to check them together as a library too (same-named options without `ruleKey`), and, for information, every same-named pair of one kind with different ids (sn-1) |
| `npm run names:check` | The real-names scan on every file in the repo (see Git hooks) |
| `npm run hooks:install` | Turn on the git hooks below, once per computer |
| `npm run docs:gen` | Rewrite the generated references in `docs/generated/` (see Docs checks) |
| `npm run docs:check` | The docs drift check on its own (see Docs checks) |

A pass ends with the build's "✓ built" line and no errors above it. A failure prints what broke and stops there; the parts after it don't run.

**A full regression run** (on demand, ruled 2026-11-09) runs every check on GitHub, whatever changed: **Actions** → **Check** → **Run workflow** → the branch (main by default) → **Run workflow**, or `gh workflow run check.yml --ref main`. What it covers and who hears about it: The GitHub check.

Tests live next to the code they test, named `*.test.ts` (e.g. `src/core/env.test.ts`). Database tests live in `supabase/tests/`. Tests of the repo's own scripts sit beside them in `scripts/` (`*.test.mjs`) and run inside `npm test`.

## Docs checks (drift)

The docs stay true to the repo through two generated references and one check, all inside `npm run check` (so the GitHub Check job runs them too). Each failure is one plain line naming the file to fix.

- **Generated references** (`docs/generated/`, never edited by hand): `commands.md` (every command, its log level, and the permission cases, from the registry and `src/testing/permissionCases.ts`) and `visibility-matrix.md` (who can read, add, change or delete rows in each table, from the access rules in `supabase/migrations/`, replayed in order). `npm test` fails when either is out of date; `npm run docs:gen` rewrites them. Commit them with the change that caused them.
- **`npm run docs:check`** (`scripts/docs-check.mjs`): relative links in every Markdown file resolve; every ruling file in `docs/design/rulings/` has a valid header (`status: pending | absorbed | superseded`, `milestone`, `absorbed-into`, `supersedes`); the mockup index (`docs/design/mockups/index.md`) has exactly one row per picture; the components inventory's Code column (`docs/06`) names files that exist; every row in `docs/11-modelling-gaps.md` has a valid status and kind.
- **Function-lineage check** (`scripts/check-function-lineage.mjs`, part of `npm run check`; rvw-7): a migration that redefines `private.undo_body`, `private.log_change`, `public.import_pack` or `public.undo_request` must carry, for each, the line `-- builds on: <function> from <previous migration file>` naming the newest earlier migration that defines it (for example `-- builds on: private.undo_body from 20261115170000_dec13_c8_pins.sql`). Why: two pull requests that each copy the same old definition would otherwise make the later one silently throw away the other's change. Reads only the files on disk; migrations up to `20261115170000_dec13_c8_pins.sql` are grandfathered.

## Git hooks (rules that always hold)

Some rules are enforced by hooks, because written instructions alone aren't followed every time. Turn the git hooks on once per computer with `npm run hooks:install` (it tells Git to use the hooks in `.githooks/`; nothing is installed).

| Hook | When | What it does |
|---|---|---|
| `.githooks/pre-commit` | before every commit | Runs the real-names scan (`scripts/check-names.mjs`) on the staged files, then `npm run check`; a docs-only commit (see below) runs `npm run docs:check` instead of `npm run check`. Either failing stops the commit. |
| `.githooks/commit-msg` | on every commit message | Runs the real-names scan on the message. |
| `.claude/settings.json` (Claude Code, `PreToolUse`) | before Claude Code edits or writes a file | Blocks an edit to a migration that's already on `main` (`scripts/guard-migrations.mjs`) and says to write a new migration instead. New migrations are allowed. |
| `.claude/settings.json` (Claude Code, `PreToolUse`) | before Claude Code writes or edits a file under `docs/` or `src/` | Runs the real-names scan on the new text (`scripts/check-names.mjs --hook`) and blocks it on a hit, naming the file and line but not the name. |
| `.claude/settings.json` (Claude Code, `PreToolUse`) | before Claude Code writes or edits a test file (`src/**/*.test.*`, `supabase/tests/**`, `tests/layout/**`, `scripts/*.test.mjs`) | On a branch whose name starts with `fix-`, allows only the two edits of the ruled method and blocks the rest with a message saying how (`scripts/guard-tests.mjs`): the first commit adds the failing test marked `it.fails` / `test.fails` (the check passes because it fails), and the fix commit removes `.fails` and changes nothing else in that test, which must now pass (`design/rulings/m5b-builder-questions-2026-11-03.md` bq-6). So it lets through (a) new tests that are all marked `.fails` (in a `describe` block or not; the `import` lines they need may be their own edit; helpers go inside the test) and (b) removing `.fails` with no other change; never a plain `it(`, `.only` / `.skip`, a hook (`beforeEach` …), `vi.mock`, a change to an existing line, or anything it can't read for sure. Those limits hold only for committed tests (gd-1, `design/rulings/dec-midday-2026-11-14.md`): a test that no commit on the branch holds yet (an `it(` / `test(` call, with or without `.fails`, whose plain-string title no committed version of the file has: at the merge base with `origin/main`, or in any later commit reachable from HEAD or from an earlier tip in HEAD's or the branch's reflog, so a reset, an amend or a deleted and remade branch frees nothing; the path is matched in any case, and so are the test-file patterns above, after Windows' trailing dots and spaces and a `::$DATA` suffix are dropped; a name still holding a `~` short form the guard can't resolve is refused) may be added, edited, rewritten or deleted freely, and a test file no such commit holds is wholly free. The guard takes those tests out of the file before and after the edit and applies the rule above to what is left, so anything outside them (a hook, a helper, `.only`, a changed committed line) is still refused; and it reads each new test's own text, refusing a mock, stub, spy, fake clock, hook or the `{ only }` / `{ skip }` / `{ todo }` options in it, however `vi` is reached (`vi?.`, brackets, `vitest.`, `globalThis.vi`, handed on or destructured, imported under another name, loaded with `import(`, hidden in a template's `${…}` or behind a `\u` escape, or run from text with `eval`, `Function` or `.constructor`) (those are refused in an added `.fails` test too). When it can't read the file, the edit or git for sure (any git step failing, no `origin/main`), it refuses as before, and a Write over a file that is there but can't be read is refused. Two conditions go with it, as process: commit 1 is still the tests alone, before the fix, marked `.fails`; and the pull request shows each new test's real failure message once (run without `.fails`). Any other branch is let through. The branch is the edited file's own (helper agents' worktrees count separately). |
| `.claude/settings.json` (Claude Code, `PostToolUse`) | after Claude Code writes or edits a file under `src/` | Runs `npm run typecheck` (`scripts/typecheck-hook.mjs`, about 7 seconds) and shows Claude the first 20 lines of any error. |
| `.claude/settings.json` (Claude Code, `UserPromptSubmit`) | each time Francis sends a session a message | Reads how much history the session carries from the end of its own record (`scripts/context-warn.mjs`; numbers only). From 250,000 tokens (was 150,000; raised 18 Nov) it adds one line: a worker started from a brief, cloud seats included, finishes its task and never stops for it; only the driver, or another session Francis talks to directly, brings its handover up to date and tells Francis it is time for a fresh one. It never blocks a message (ruled 2026-11-17). |

- **The real-names scan** reads the private list `packs/_design/denylist.txt` (one real game, book, adventure or publisher name per line). It doesn't care about case, and only whole words count. If the list is missing (GitHub, a fresh copy) it does nothing. Helper agents' worktrees use the main checkout's list.
- **The docs-only fast path** (ruled 2026-11-05; `scripts/docs-only.mjs`, the same rule for the hook and the GitHub check): a commit or pull request is docs-only when every path it adds, changes or deletes (both sides of a rename) is a file under `docs/` (except `docs/generated/` and the docs code reads: `docs/07-content-packs.md`, `docs/plans/m5b-0c-creation-options.md`, `docs/plans/options-audit-2026-11-03.md`), a Markdown file at the top of the repo, or a Markdown file under `.claude/` or `skills/`. Anything else (`src/`, `scripts/`, `supabase/`, `tests/`, `public/`, `.github/`, `.githooks/`, `.claude/settings.json`, `package*.json`, any config) means the full check. A docs-only commit still runs the real-names scan and the docs check, in a second or two instead of about 3½ minutes. When code starts reading a new doc, `scripts/docs-only.test.mjs` fails until it's added to the list.
- **What the fix-branch test guard is** (gd-3, Francis, 2026-11-14). It is a scan that deters: it makes weakening a test awkward and leaves the attempt visible in the diff. It is not a wall, and a determined bypass can still be written. The backstop is the reviewer's read of every fix branch's test diff (the local review rule, `REVIEW.md`). That reader looks for three things:
  - a committed failing test that changed;
  - a fake or stub (a mock, spy, stubbed global, fake clock or hook) added beside a test that loses its `.fails`;
  - a test file under an odd name or path (a short `~` name, a trailing dot or space, `::$DATA`, a case that differs from the file's).
- **The guard's known limits**, each needing a shell command or a setting outside the file being edited:
  - a detached HEAD (its own reflog still counts, but no branch reflog does);
  - `git reflog expire` run through Bash, which erases the commits the guard reads;
  - git config in `HOME` or `XDG_CONFIG_HOME`, which the guard's git calls still read;
  - a junction or link that opens a test file under another path.
- **What the guard refuses that is harmless** (the price of the scan, accepted by the lead): a new test on a fix branch may not contain the word `constructor` (so no class with a constructor), the type name `Function`, or a `\u` escape outside a string.
- **Working tests out first** (gd-3): when a test needs more trial and error than a fix branch allows, work it out on a non-fix branch. Then enter it on the fix branch through the guard: added marked `.fails`, as commit 1.
- **An existing test changed by ruling** (tg-1, 2026-11-11, `design/rulings/m5b-morning-rulings-2026-11-11.md`): a change the fix-branch test guard refuses is made on a non-fix branch cut from the fix branch, keeping its tests-first commits; that branch becomes the pull request. The guard is not bypassed.
- **Around a fix branch** (2026-11-14, `design/rulings/dec-late-2026-11-14.md`, `dec-night-2026-11-14.md`): a worker's worked-out tests are taken out of the working folder before the fix branch is made, so they enter it fresh through the guard (gd-7, the lead's); pictures of a fix are taken from a never-pushed copy of the same commit on an ordinary branch, and no temporary test file goes on a fix branch (gd-8, Francis); tests that run git strip every `GIT_` variable and work only under the system's temporary folder, so they never reach the real repository (gd-2, the lead's).
- **A refused command** (gd-4, gd-5, 2026-11-14, `design/rulings/dec-town-stock-2026-11-14.md`): after a combined command is refused, a session may run its ordinary parts one at a time as plain commands, so the check can read each one; it leaves out anything that deletes, restores or reaches outside its own folder, and if a plain part is refused too, it stops for Francis (gd-4). A worker may remove its own temporary test, never committed, with the Edit tool (the one the guard watches); on a fix branch the guard's own rule (gd-1) still applies (gd-5).
- If a hook stops a commit, the message names the file and line. Fix it and commit again. Never skip a hook (`--no-verify`) unless Francis says so.

**When the failing test already exists (bq-6a, 2026-11-13).** On a `fix-` branch whose failing test is already in the repository and red on `main` (a layout or gallery check a merge broke), the fix cites that test by name in its pull request's text and says how it was seen red; no `.fails` commit is needed, and no test file is edited. If the fix needs a test that does not exist yet, bq-6 holds as written.

**Checking the fix-branch test guard by hand (bq-6).** In a Claude Code session on a throwaway branch named `fix-guard-try`:
1. Ask Claude to add a new test marked `it.fails` to any `*.test.ts` file: it goes through, and `npm test` passes on it (the test fails, as marked).
2. Ask Claude to remove that `.fails` and nothing else: it goes through (the test now fails the run until a fix exists).
3. Ask Claude to change any line inside an existing test: the edit is blocked, and the message says to commit the failing test as `it.fails` / `test.fails` first, then remove `.fails` alone.
4. Delete the branch (`git checkout main`, then `git branch -D fix-guard-try`).

## Smoke tests (click-through)

`src/app/smoke.test.tsx` drives the real screens the way a person does: it finds things by their visible words and labels ("Email me a code", "Sign-in code"), types and taps, and checks what appears. It runs inside `npm test` in a pretend browser (jsdom) against an in-memory stand-in database (`src/testing/fakeDb.ts`), so it's fast and never touches Supabase. The stand-in only mimics the calls the screens make; the real access rules are checked by `npm run test:db`.

- **Renaming a button or label breaks these tests on purpose.** Update the test with the new words.
- **A new screen or flow adds a smoke test** for its main path and its most likely mistake.
- **They can't judge looks, tap sizes or the iPad keyboard.** Tap sizes and layout are checked by the layout checks below; looks and the iPad keyboard stay on the manual checklist.

## Layout checks (real browser)

`tests/layout/layout.spec.ts` uses Playwright to open the app in WebKit (Safari's engine) at four widths: phone 390, iPad Split View 507, tablet portrait 820 and tablet landscape 1180. It opens each main screen on `layout.html`, a test-only page (`src/testing/layoutHarness.tsx`) that loads the real screens against the stand-in database with invented sample data. It never touches Supabase, and it isn't part of the built app.

- **On every screen and width:** no sideways scrolling; every button, link and box at least 44px tall; body text at least 16px and nothing under 14px; and **no serious or critical accessibility problems** (axe, `@axe-core/playwright`, checking the WCAG 2.1 A and AA rules: labels, contrast, names on buttons and so on). Minor axe findings don't fail the check.
- **On a landscape tablet only:** the GM's sections are a column on the left, and the full sheet sits beside the Player screen (without repeating the name).
- **Screenshots** of every screen at every width land in `test-results/layout-screens/` (not committed). Open them to see each layout; they aren't compared pixel by pixel, which breaks across machines.
- **A new screen adds a scene** to the list in the test file.
- First time on a computer: `npx playwright install webkit` downloads the browser (about 100–150 MB, in your user folder).

## The component gallery

`gallery.html` (`src/gallery/Gallery.tsx`) shows every shared part (`src/ui/parts.tsx`, `src/ui/buttons.css`, `src/ui/Dialog.tsx`) in its states, on the real tokens, with invented data. It's built with the app but never linked: open `/gallery.html` on the preview or the live site; `?theme=dark`, `?size=larger` and `?motion=reduced` set the page.

- **`npm test`** (`src/ui/designSystem.test.ts`): every token pair's contrast in both themes; no raw spacing, type or colour value in any stylesheet (`src/ui/rawValues.ts`); the words guide on the app's own text (`src/ui/words.ts`; mark a line of invented names with `words: names`).
- **`npm run test:layout`** (`tests/layout/gallery.spec.ts`): the gallery at 375 and 1024 px in both themes (fits, 44px targets, 14px text, axe), at the largest text, and under reduced motion. Pictures of each section land in `test-results/gallery/`.
- **Approved pictures** (`tests/layout/gallery-baselines/`): in CI each section is compared with its approved picture. A missing picture is made instead (the run's page → Artifacts → gallery-baselines-1, -2 and -3, one per layout shard; each holds the pictures its shard drew); once Francis approves the look, download it and commit the pictures on the branch. To approve an intended change, delete the old pictures, push, and commit the new ones from the run. They're compared in CI only: other systems draw text a little differently. A pull request into a held stack (any base but `main`) skips only this comparison, so it draws no new pictures either; every other layout check still runs, and the stack's own pull request into `main` compares in full (Francis, 2026-11-18, ci-held-gallery; `PR_BASE` in check.yml).
- **Announced redraws: one picture run, not two** (ci-announced-redraws, Francis, 2026-11-20: "do the second saving too - write them both so they persist past this session"). A pull request that changes gallery pictures on purpose **announces them in its text, on one line**, by their file names in `tests/layout/gallery-baselines/`:

  `Gallery pictures expected to change: phone-light-atoms.png, tablet-dark-atoms.png`

  (or `Gallery pictures expected to change: none`). **The line is kept current** (redraw-line-1, Francis, 2026-11-20): after any review fix the builder re-reads it against the pictures the fix touches (a gallery specimen, a shared part, a screen's spec), and before adding **ready** the driver compares it with the fixes; a stale "none" costs a whole second picture run (#1070). Only whole names ending in `.png` on that line count; a list on the lines below it doesn't. When the labelled run's picture check then fails, check and database passed, and every failure in all three shards is a difference in an announced picture, the **redraw** job (check.yml, `scripts/ci-redraws.mjs`) commits each picture's 1x `*-actual.png` (the very picture the shard compared, never a `gallery/` 2x picture) over its approved picture, as one commit by `github-actions[bot]` on top of the commit the run checked, and reports **check**, **database** and **layout** green on that new commit ("Carried: announced redraws only", naming the run and the pictures). A push made with the run's own token starts no workflow, so this is how the new commit gets its required checks without a second picture run: its code is the code that run checked, and its pictures are the bytes it drew. The old commit's layout stays red, and triage stays quiet. **Anything else still fails as before:** a picture that differs but isn't announced, any other failing test, a picture that never held still, a shard whose pictures weren't kept, an announced picture with no approved picture yet (a new picture is still committed by hand from **gallery-baselines-N**), or a branch that moved on since the run started. An announced picture that didn't change is listed in the redraw job's summary. **A re-run is not a second chance:** "Re-run failed jobs" reads the pull request's text as it was when the run started (a newer announcing line isn't seen), and a shard report from an earlier attempt of the run is refused (each report names the attempt and commit that drew it), so after changing the announcing line, or to redraw after a re-run, remove and add the **ready** label again for a fresh run. The judging script is the one on `main` (the pull request's base), not the pull request's own copy (that is used only while `main` has none), and the job's checkout keeps no token: only its push is given one. **After a redraw, pull the branch** (`git pull`) before pushing anything else to it. If the push succeeded but the carried checks are missing (the job's last step failed), remove and add the **ready** label again: that starts a full run on the new commit.
- **Who approves, and when** (ruled 2026-11-09, limits by Design; it replaces the 2026-11-05 limits until pre-test hardening; pictures go to the Design session, 2026-11-04). Merges don't wait for Design, with one exception:

  | The pull request's picture change | What happens |
  |---|---|
  | **Not announced:** its pull request's text lists the pictures it expects to change, and why, and this one isn't on the list | Waits for Design before merge |
  | **Not ruled:** a layout or wording change to an approved screen that no ruling or plan line asks for; the first pictures of a new screen, component or named variant that no approved mockup or ruling describes; anything with an open scope check or ⚑ on what it draws | Stops as a scope check, as before |
  | **Announced:** the first pictures of a new screen, component or named variant that an approved mockup or a ruling describes; an approved component drawn with new data or a state its ruling describes; gallery-only changes (a specimen added or reworded for an existing component); pure offsets, with the diff picture | Merges first; Design looks after |

  - **At the merge** the driver commits CI's pictures and merges (rvw-3). No label and no note to Design: the pictures go to Francis once per whole screen (rvw-14; ruled 2026-11-19).
  - **A rejection** is a fix pull request that goes ahead of new work.
  - **Gates and player tests:** nothing rejected or not yet looked at is open when a gate run, a gate sitting or a player test starts, or when a milestone is tagged. During a sitting or a player test, merges that change pictures wait: the walk is on the live app.
  - **When pre-test hardening begins** (after the M8b gate) the 2026-11-05 limits return: the first pictures of a new screen, component or variant wait for Design before merge again, unless Francis rules otherwise.

## Commands and permissions

Every action is a command (`src/core/commands.ts`); screens never touch the database (a lint rule enforces this in `src/app` and `src/ui`). Another lint rule stops `src/core` importing anything from `src/modules` (hard rule 6). Each command carries the app's copy of its permission rule, and the database's access rules stay the real gate. To keep the two copies honest, **one table of permission cases** in plain sentences (`src/testing/permissionCases.ts`) runs twice:
- `npm test` checks the app's `can()` against every case (fast, no database), and fails if a command has no case;
- `npm run test:db` runs every case for real as that person, and checks the database gives the same answer, refusing for permission reasons only.
- the same run checks the event log (M2): every allowed case writes at least one event named after its command, and a refused one writes none. A case that's allowed but has nothing to change (e.g. removing a portrait from a character without one) is marked `quiet`.

**The event log** (`supabase/tests/events.test.ts`): only changed values are recorded; a change that changes nothing isn't logged; untagged writes still are; deleting keeps a full copy; only the GM's changes can be fiat; players never receive events about invites or another player's waiting character; nobody can write, change or erase events directly; deleting a campaign takes its events with it.

**Adding a command:** add it to its module's registration, then add at least one "allowed" and one "not allowed" case to the table.

## The test database

Access-rule tests ("a player can't read another player's purse") have to run against a real Supabase database, because the rules live there. They use a **second free Supabase project, grimoire-test**, never the main one. **Real data is never used in tests**: the tests create invented users and campaigns in the test project and clean up after themselves.

- **Safety catch:** the tests and `db:push:test` refuse to run if their settings point at the main project.
- **TEST ahead of open pull requests** (db-1, 2026-11-11, `design/rulings/m5b-morning-rulings-2026-11-11.md`): `db:push:test` accepts migrations TEST already holds from other open pull requests, so a branch can push its own while another's waits unmerged; each TEST turn is still checked with Francis first (until 5 December the driver runs the sessions itself, db-s1 to db-s6, widened on 2026-11-19 to any migration after Francis's one-word "push").
- **Order for any database change:** write the migration → `npm run db:push:test` → `npm run test:db` → when it passes, `npm run db:push` (main project) → `npm run db:types` → commit.
- The main project is linked once with `npx supabase link` (on Windows PowerShell, type `npx.cmd`). The CLI's login token and link details stay on your PC, outside Git.

### Seeded test campaigns (`npm run seed:test`)

Builds, on the **test** project only, "Seed · <setting> · defaults" and "Seed · <setting> · options on" campaigns from the newest packs in `packs/_current/`: one character per class, every kindred or race at least once, made through the app's own creation commands and approved by the test GM. A pack that needs another (`meta.requires`) is seeded on top of it ("Seed · Base + Overlay · …", the base first, in the order `requires` lists them); a pack with no classes of its own (an adventure) is skipped. A creation method the default does not offer gets its own campaign ("Seed · … · <method name>"). Plan: `docs/plans/test-seed-campaigns.md`.
- **One-time set-up:** make three accounts on the test project (dashboard → Authentication → Users → Add user, "Auto confirm"): a GM and two players. Copy `.env.seed.example` to `.env.seed` (git-ignored) and fill in their emails and passwords. The project itself comes from `.env.test`.
- **Run:** `npm run seed:test` (about two minutes). `npm run seed:test -- --reset` first removes every campaign named "Seed ·…" (only those), then rebuilds. `npm run seed:test -- --dry-run` only prints the plan and needs no accounts.
- **Safety:** it stops unless `.env.test` points at the test project (the API address and the database address must name the same one, and neither may be the main project). Run it only on your PC (it needs `packs/`).
- **What each character gets:** scores, kindred, class and hit points, then (as its owner, with the app's own commands) the class's first kit with the first row of each roll, what everyone is given, the first spells (given ones, the first picks, the first readable row of each roll, the first cantrips), the first entry of each trait list it takes (and that entry's gear), and the given languages plus the first of the list for each extra. Where the weapon-skills step exists (its option is on, so in the "options on" campaigns), the first weapons it offers, up to the level's picks. Last, the kit's first armour and first shield are worn and its first weapon is held (the Pack's Put it, `inventory.equip`), so AC and At hand are real. Anything it can't do, or the class or setting refuses, is printed under "left out" with the reason; nothing is forced.
- **Shop campaigns (si-3):** a class with no kit, in a setting with a shop and a starting money roll, buys a starting set instead: the cheapest armour and shield its class may use, one weapon it may use (one-handed if there is a shield), a backpack, a week of rations and a light source, in that order and within the starting money (the roll's typical total). They are added as bought items (`inventory.add`, with the cost), recorded as purchases, then worn and held like a kit. What isn't found or can't be afforded is printed under "left out".
- **Edge cases (`--edge <pack id>`, design note `docs/design/notes/seed-edge-cases-2026-11-05.md`):** one extra campaign, "Seed · <setting> · edge cases", for a single-pack setting named by its pack id (`meta.id`): eight characters made to show messy data (uneven scores, a 40-character name, a level-5 caster half-way to level 6, the most traits, a pack at and over the load limit, nothing at all, the last level with 999999 XP). Every figure comes from the pack, none from this repo. Not part of the gate run. `-- --edge-only --edge <id>` builds only it (with `--reset`, removes only the edge campaigns). XP has no command yet, so the script writes it on the test project's own row with the service key, like `--reset`. Left out and said in the summary: spells beyond the first ones, a spent use, the slot-encumbrance twin.
- **Not seeded:** no money roll is logged; a language list that lets "any" be picked gets only the given ones.

### Which keys live where

| Value | Project | Where it lives | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | main | `.env` (git-ignored) and Vercel | Safe to reach the browser; the access rules protect the data |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | test | `.env.test` (git-ignored) and GitHub secrets | |
| `SUPABASE_SECRET_KEY` | test | `.env.test` and GitHub secrets | Full access, for setting up test data only |
| `SUPABASE_TEST_DB_URL` | test | `.env.test` only | Contains the test database password |
| main database password | main | your password manager; typed into `supabase link` | Never saved in a file |
| **main secret key** | main | **nowhere** in this project | Never in Git, Vercel, GitHub, `.env` files or chat |

`.env.test.example` lists the names with empty values. Where to copy each test value from (grimoire-test project in the Supabase dashboard):
- **URL:** Project Settings → Data API → Project URL. Just `https://<ref>.supabase.co`, nothing after it.
- **Publishable key:** Project Settings → API Keys → Publishable key (`sb_publishable_…`).
- **Secret key:** Project Settings → API Keys → Secret keys (`sb_secret_…`).
- **Database URL:** Connect → Connection string → Session pooler, with `[YOUR-PASSWORD]` replaced by the test database password (letters and numbers only, so it needs no escaping).

## Branches, pull requests and previews

Each step happens on its own branch (e.g. `m2-e3-undo`) and reaches `main` through a pull request. `main` is protected: the **check**, **database** and **layout** jobs must pass, and nobody pushes to it directly. A branch doesn't have to be up to date with main to merge (changed 2026-11-01): main re-runs the checks on each merge before it goes live. A pull request gets a **Vercel preview** link, using the **test** Supabase project (grimoire-test), when it carries the **preview** label, so trying a change never touches real data. Production (the live site) uses the main project.

## Deploying

Vercel's free plan can't connect to a private repo owned by a GitHub organization, so **GitHub deploys** (`.github/workflows/check.yml`). It builds the app itself with the Supabase address and publishable key passed in directly (both public: they ship inside the app), then `scripts/vercel-output.mjs` **refuses to deploy** unless the build points at the expected Supabase project, and packages it for Vercel's own tool (`vercel@62.5.0`) to upload.
- **Production:** every push to `main` (each merged pull request) runs the check, database and layout jobs on everything changed since the last main commit whose push run went green (by the same file rules as a pull request; everything, when that can't be found); only if all pass, **deploy-production** builds against the **main** project (repository variables `MAIN_SUPABASE_URL` and `MAIN_SUPABASE_PUBLISHABLE_KEY`) and puts it live. The run's summary shows the address. **Only the newest commit on `main` goes live** (2026-11-19, Francis: "Yes, fix it"): runs can finish out of order, so deploy-production first checks that its run's commit is still main's head (before anything is fetched or built, and again just before deploying); when main has moved on, it skips the rest, stays green, and its summary says "Not deployed: main has moved on to <commit>; that commit's own run deploys it." So if the newest commit's run fails, nothing new goes live until the next merge.
- **Previews (on request, ruled 2026-11-01):** add the **preview** label to a pull request (its page → Labels, or `gh pr edit <n> --add-label preview`) and **Preview** (`.github/workflows/preview.yml`) builds it against the **test** project (the `TEST_SUPABASE_URL` and `TEST_SUPABASE_PUBLISHABLE_KEY` secrets) and comments the link. While the label stays on, each push rebuilds it (the new link is in that run's summary); remove the label to stop. Building one on every push used up Vercel's free 100 deployments a day, which production shares. It isn't a required check. Dependabot's pull requests get none (they can't use the secrets). When a manual check says "on the preview", the builder adds the label first.
- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Vercel's own environment-variable settings are no longer used for builds.
- **If a bad version goes live:** Vercel → Deployments → the last good **Production** deployment → ⋯ → **Promote to Production** (instant).

## Backups

The free Supabase plan doesn't give us backups we can restore ourselves (daily backups and point-in-time restore are on paid plans; check **Database → Backups** in the dashboard to see what yours shows). So before pushing a migration to the main project we take our own: `npm run db:backup` saves the main project's structure and the data of our own tables into `backups/` on this computer (git-ignored, never committed). Keep the last few. It needs PostgreSQL 17's command-line tools (`pg_dump`, installed in `C:\Program Files\PostgreSQL\17\bin`); the Supabase CLI supplies short-lived connection details, so no password is typed. Sign-in accounts live in Supabase's own auth tables and aren't in this backup. Automatic backups with a practice restore come in M10.

## The GitHub check

Every pull request, and every push to main, runs `npm run check` on GitHub (`.github/workflows/check.yml`), using the Node version in `.nvmrc`. A second job, **database**, runs the full `npm run test:db` against a **fresh, throwaway local Supabase** started inside the GitHub runner (`npx supabase start`, the CLI version in `package.json`, with Docker), not the shared test project (ruled 2026-10-30). It applies every migration in `supabase/migrations/` from scratch, so it tests the branch's own migrations, and nothing is shared between runs: no queueing, no leftovers from aborted runs, no free-tier timeouts. The local stack takes its settings from `supabase/config.toml` (sign-in rate limits are raised there, because the tests sign in many invented people from one address); the job reads its address and keys from `supabase status` and never prints them.

- **Three shards, one check (ruled 2026-11-05):** the tests run as three parallel jobs, **database shard 1/3**, **2/3** and **3/3** (`npm run test:db -- --shard=N/3`: Vitest splits the test files three ways). Each shard starts its own local Supabase, so they share nothing; every test file builds its own invented world (`supabase/tests/world.ts`), so a file passes alone or in any shard. A last small job named **database** (the required check) sums them up: green when all three passed or when the shards were skipped, red when any shard failed, timed out or was cancelled. When it's red, open the red **database shard N/3** job to see the failing test. Before (one job, early November 2026): about 9 minutes, of which 2½ are setup (`npm ci`, starting Supabase) and 6½ the tests. With three shards each shard still pays the 2½ minutes of setup, so the wait drops to about 5 minutes while the minutes billed rise by about 5 per run.

- **The database shards run on GitHub's machines** (Francis, 2026-11-13, "built, with a [amount removed] limit to start", cq-4): every other job stays on the PC's self-hosted runners. The PC had one database lane (fixed Supabase ports), and on 13 November it queued main's runs behind the pull requests' for over an hour. On GitHub each shard gets a fresh machine, so the three run side by side and nothing queues. Cost: about 4 billed minutes a shard, so about [amount removed] a run at the organisation's [amount removed] a minute; its Actions spending limit (Francis sets it, [amount removed] to start) stops paid minutes if it's reached. The repository variable `DB_RUNNER` = `self` sends them back to the PC's `db` runner; `CI_RUNNER` = `github` still sends everything to GitHub, and `CI_RUNNER` = `auto` runs on the PC while it has room and on GitHub when it's busy (ci-auto-1; `docs/plans/ci-self-hosted-runner.md`, How the workflows choose the runner). **The local check** (one at a time, through the lock in the coordinator's notes) no longer waits for database runs: by day it waits only for the night run or a run by hand, and for 12 GB free.
- **Overflow and the spending limit** (`CI_RUNNER` = `auto`, ci-auto-1): a run goes to GitHub only when every PC lane already has a run. **Lanes:** `CI_LOCAL_SLOTS` is **2** again since 20 November (Francis, about 18:00 UTC: "Yes, set 2 lanes", once new builders ran in the cloud; it was 1 from 19 November). If picture shards time out under load, set it back to 1. Only the runners pc-1 and pc-2 are used: Francis keeps pc-3 off because three runners together run out of memory. Its page then shows an **Overflow to GitHub** notice and a line in its summary. **Check and the picture shards never overflow** (ci-pc-pictures, Francis, 2026-11-20: "Yes, PC only"): under `auto` they run on the PC even in an overflow run, waiting their turn in the one-at-a-time queue below; only the run's small jobs (and the database shards, which follow `DB_RUNNER`) use GitHub. Why: on 20 November a picture shard took 19 to 40 minutes on GitHub (runs 44730545041, 44731335414, 44732655677) against 3 to 5 on the PC (44735125048, 44709515597), and check 12 to 18 minutes against 4 to 6; three overflow runs used up the Actions budget. The old estimate here (three picture shards about 16 billed minutes, check about 4) was wrong by about five times. **Cost per overflow run** now (at [amount removed] a minute; each job is billed in whole minutes): the small jobs only, about 5 billed minutes on top of the database shards, under [amount removed]; a docs-only run is about 3 minutes, under [amount removed]. In `auto`, pick itself is one billed minute per run of each workflow, overflow or not. **If a picture run times out on the PC, run it on GitHub** (Francis, 2026-11-20: "If a picture run times out locally run it on git"): `gh variable set CI_RUNNER --body github`, then `gh run rerun <id>`, and set it back with `gh variable set CI_RUNNER --body auto` once that run's **pick** job has finished (pick reads the switch once, at the start; the variable is Francis's to change). **If the spending limit is hit, set `CI_RUNNER` to `pc` (and `DB_RUNNER` to `self`)**: pick runs on GitHub in `auto`, so at the limit every workflow goes red even while the PC idles; `pc` (like unset) keeps everything, pick included, on the PC.
- **One-file checkouts go in their own folder** (19 Nov 2026): a PC runner reuses its folder between jobs, and pick's sparse checkout there left `core.sparseCheckout` on, so the next job's full checkout came out almost empty (`.nvmrc` and `scripts/ci-jobs.mjs` missing; every job on pc-1 failed in seconds). Pick checks out into `.pick` and the review comment's script into `.review-tools`, never the main folder.

- **Saving GitHub minutes** (ruled 2026-10-30, changed 2026-11-01): a first job, **changes**, works out what a pull request (or, on main, a merge) touches, and the others follow it. Skipped steps (and, for database, skipped shards) still let a job report success, so the required **check**, **database** and **layout** checks never block merging (except layout waiting for the **ready** label, below). **database** (its three shards) runs only when something its tests reach changed: it skips changes made only of screen files (`src/ui/`, `src/gallery/`, the `.tsx` and `.css` files directly in `src/app/`, any `.css`), `tests/layout/`, `public/`, the pages, `scripts/pack-*` and the CI files other than `check.yml`. The database tests import only `src/core/`, `src/modules/`, `src/testing/` and three `.ts` files in `src/app/`, none of which import screen code; if that ever changes, widen the rule.

- **The full checks run by day again; the night run stays** (rvw-6, Francis, 2026-11-17, "approve"; `docs/design/rulings/process-after-review-2026-11-17.md`). The day deferral `cq-3` (Francis, 2026-11-13, `docs/design/rulings/process-ci-by-day-2026-11-13.md`) is off, so on a pull request a code change runs **check**, **database** and **layout** as the table below says (on main's run after a merge, **check** and **database**: main's pictures wait for the night run, below), and the **ready** label is needed again for layout on a pull request that could change a screen (add it last, after the final push). `DEFER_BY_DAY` in `scripts/ci-jobs.mjs` is `false`. While the deferral was on (13 to 17 November), **check** and **layout** were **deferred**: they did no work and reported green; check's summary says "Deferred to the night run (cq-3): the local check covers this by day." and layout's "Deferred to the night run (cq-3): the pictures and browser checks run at 07:00 UTC." Why it was brought in: every commit already runs `npm run check` locally (the pre-commit hook), and the PC that runs CI was overloaded by day (with one heavy job at a time, below, every run waited for the others). The docs-only fast path doesn't change. Main deploys once **check** and **database** are green, both doing their work.
  - **The night run** (`cq-3a`): every day at 07:00 UTC GitHub starts a run on main (a `schedule` trigger) that runs **check**, every **database** shard and every **layout** shard, through the heavy-job queue like any other run. Nothing deploys from it and it isn't triaged. Its first job's summary says "The night run (cq-3): everything runs on main."
  - **Main's pictures are checked only here** (Francis, 2026-11-19: "a nightly picture check sounds best can you implement that?"): a push to main (a merge) runs **check** and **database** but no layout shard; its **layout** job is green with "Main's pictures are checked by the night run (07:00 UTC), not after each merge." (plan `night` in `scripts/ci-jobs.mjs`), and **deploy-production** waits for check and database only. So a picture fault two merges make together goes live and is found by the next night run, then fixed forward first thing. A pull request is unchanged: it still needs the **ready** label and a green layout before it merges. To check main's pictures sooner (say after a large visible merge), start a run by hand on main: `gh workflow run check.yml --ref main`.
  - **Its pictures:** new or changed gallery baselines come from the night run's **gallery-baselines-N** artifacts and are committed the next day (they're kept for two days).
  - **Who reads it:** the driver's morning start (by 7 am local time) starts from `gh run list --workflow check.yml --event schedule -L 1`; a red night run is fixed first thing.
  - **When it fails:** a failure on load alone (a timeout with nothing else wrong) is re-run once, alone (`gh run rerun <id> --failed`, with nothing else running). A real failure goes in the morning report and is fixed first thing, before anything else merges.
  - **The full run by hand** (below) is still there: call one on the branch of a large visible piece before it merges (`cq-3c`), so its pictures are checked before it goes live.
  - **The deferral is off since rvw-6** (`cq-3b` brought forward): `DEFER_BY_DAY` is `false`, which brings back the day runs below, the ready label's wait included. The night run stays, and so does the full run by hand. Night-only CI and paid runners were not taken up (`cq-3d`).

The table below is the rule, now in force (the deferral is off since rvw-6).

| The pull request changes | check | database | layout | preview |
|---|---|---|---|---|
| Only docs and process files (the docs-only fast path, see Git hooks: `docs/` except `docs/generated/` and the docs code reads, top-level Markdown, Markdown under `.claude/` and `skills/`) | `docs:check` only, without installing the packages | skipped | skipped | with the label |
| Code, but no screen files (e.g. `supabase/`, `scripts/db-*`) | full | runs | skipped | with the label |
| Only the pack scripts (`scripts/pack-*`) | full | skipped | skipped | with the label |
| Only screen files (`src/ui/`, `src/app/*.tsx` / `.css`, `tests/layout/`, `public/`, the pages) | full | skipped | with the **ready** label (red until then) | with the label |
| Screen files and data code (`src/core/`, `src/modules/`, `supabase/`, `package*.json`, build config, `check.yml`) | full | runs | with the **ready** label (red until then) | with the label |
| Nothing new: the **ready** label (or another label) was just added | not again if it passed for this commit | not again if it passed for this commit | runs, unless it passed for this commit or no screen file changed | — |
| A push to main (a merge) | by the same rules, on everything changed since main's last green run | | not run: green with a note; the night run checks main's pictures (2026-11-19) | — (production deploys only if check and database pass) |
| Nothing: the run was **started by hand** (a full regression run, below) | full | runs | runs, no label needed | — (nothing deploys) |
| Nothing: **the night run** (07:00 UTC on main, `cq-3a`) | full | runs | runs | — (nothing deploys) |

- **The picture check waits for the ready label** (Francis, 2026-11-05; applies again since rvw-6, 2026-11-17): **layout** costs about 20 minutes, the most of any job, and most pushes are work in progress. On a pull request whose changes could alter a screen, layout runs only once the pull request has the **ready** label. Until then it goes red in a few seconds with "Pictures not checked yet: add the ready label when this pull request is finished.", which blocks the merge. Changes that can't alter a screen (docs-only, pack scripts, database code alone) don't need the label: layout is green as before. A `package.json` change that stays inside its `"scripts"` block, with `package-lock.json` unchanged, is not a screen change either (`scripts/package-scripts-only.mjs`; Francis, 2026-11-17). **The driver adds the label last** (2026-11-19), after its local review and the builder's fixes and after the final push: `gh pr edit <number> --add-label ready` (or, on the pull request page, **Labels** → ready). Adding it starts a run on the same commit that runs layout and doesn't redo **check** or **database** if they already passed for that commit (`scripts/ci-jobs.mjs` decides; a run started by a label waits for a running one rather than cancelling it, so it can reuse its passes). Any later push while the label is on runs layout again, so nothing merges unchecked. Removing the label doesn't undo a pass. Re-running an old red layout job (`gh run rerun`) doesn't see a label added since; add the label instead. Dependabot's pull requests change `package*.json`, so they need the label too. The **triage** comment isn't posted when the only red is layout waiting for the label.

- **A full regression run** (Francis, 2026-11-09): started by hand, a run treats everything as changed, so **check**, every **database** shard and every **layout** shard do their work on the chosen branch, with no label, and nothing deploys (deploy-production runs only on a push to main, triage only on a pull request). Start it from **Actions** → **Check** → **Run workflow** → the branch (main by default), or with `gh workflow run check.yml --ref <branch>`; the first job's summary says "Started by hand: everything runs." On a branch it tests the branch **as it is**, not merged with main as a pull request's run does. On a pull request's branch a green run also turns that commit's **layout** check green without the **ready** label (the pictures really were checked; adding **ready** afterwards reuses those passes for the same commit), and a red one keeps the pull request red until a run passes. It takes the PC's runners for a full run's time (the database shards side by side on GitHub's machines (cq-4; one at a time on the PC's `db` runner when `DB_RUNNER` is `self`)). **Who hears about it:** tell Design when one is called and why (before a gate, early enough for the result to arrive before the walk). Design gets the pictures that differ from their approved ones and the layout and accessibility failures, with the run's link; check and database failures go to the driver (rvw-3).
- **A cloud seat's pull request that touches `src/`** gets the full check run on it once locally before it merges, and the seat states which checks it ran (ck-1, the lead's, 2026-11-14, `design/rulings/dec-night-2026-11-14.md`).

- **Why main re-checks (changed 2026-11-01):** requiring every branch to be up to date with main before it merges meant each merge restarted every open pull request's 33-minute run, many times a day with several sessions merging. Now a pull request is tested against main as it was at its last push, and main runs check and database again on each merge; deploy-production waits for them, so a pull request that only breaks those combined with another never goes live (main's pictures are checked by the night run, 2026-11-19). If main goes red, fix it before merging anything else. A newer push to the same pull request cancels the older run. **On `main` only the newest commit's run goes on** (2026-11-19, Francis: "Yes, add it"; a code merge's run costs about 100 check minutes): every push to main shares one group, and a newer merge drops the older main runs still queued or running, their deploy included (the newer commit's own run deploys it; a dropped run cancelled mid-upload may briefly go live, since Vercel finishes a deployment it has created). Re-run only the newest main run; re-running an older one cancels the newest and deploys nothing. The newest run checks everything changed since the last main commit whose push run went green, not just its own merge, so a docs-only merge landing after a code merge still runs the code merge's checks; when no green run can be found, or the lookup fails, everything runs. So a red `main` names the newest state, not necessarily the merge that broke it: look through the merges since the last green run. The layout shards run inside Playwright's ready-made image (`mcr.microsoft.com/playwright:v<version>-noble`, Ubuntu 24.04 like the runner), which carries WebKit and its system libraries and fonts, so nothing is installed through apt (2026-11-06). Its version must be exactly `@playwright/test`'s in `package-lock.json`: a Playwright update changes both in the same pull request (`scripts/ci-jobs.test.mjs` fails otherwise).
- **Locally, nothing changes:** agents and Francis still run single test files against the shared test project with `.env.test` (`npm run test:db -- supabase/tests/<file>.test.ts`), after `npm run db:push:test` for a database change. Run one file at a time, not the whole suite: the free test project has a small disk budget. The shared project also stays for the Vercel previews and manual checks.

A third job, **layout**, runs `npm run test:layout` in three shards (**layout shard 1/3** … **3/3**, 2026-11-05); the job named **layout** passes when all three do. **One heavy job at a time** (Francis, 2026-11-13, "A", cq-1 in `design/rulings/dec-night-and-morning-2026-11-13.md`, widened by the lead to check, cq-1a in `design/rulings/process-ci-queue-2026-11-13.md`): **check** (when it runs the code's tests) and the three **layout** shards share one queue across every run on the PC, main's included, and **database** runs beside it. A docs-only or reused check doesn't queue, nor does any heavy job on GitHub's machines (cq-1b): the group follows pick's answer for the heavy jobs (`heavy_target`), so `CI_RUNNER` = `github` gives check and each shard a group of their own; an `auto` overflow run keeps them on the PC, in the queue (ci-pc-pictures, 2026-11-20). Main's check queues like any other, so its deploy can wait a few minutes behind a pull request's shards (main's own run has no shards since 2026-11-19; the night run's do queue). Why: a WebKit shard beside another, or beside check, timed tests out (six runs failed on load alone on the night of 12–13 November; on 13 November check's app tests timed out at 15 s beside a layout shard, run 43419092528 and #672's). The others wait in line (a shared concurrency group with `queue: max`) and are never cancelled. A shard takes 2 to 4 minutes and check about 3, so a run takes a few minutes longer, and a pull request may wait for another's. Every run, green or red, keeps each shard's screenshots for a week (the run's page → **Artifacts** → layout-screens-1, -2, -3).

- On the repo page, the latest commit shows a **green ✓** (passed), a **red ✗** (failed) or a **yellow dot** (still running) next to its message. The **Actions** tab lists every run.
- **Reading a failure:** click the red ✗ → **Details** (or open the run in the Actions tab) → the **check** job → expand the step with the red ✗, usually **Run npm run check**. Scroll to the first error: it names the part that failed (typecheck, lint, test or build), the file and line, and what was expected.
- Fix it locally, run `npm run check` until it passes, then commit and push. The new push runs the check again.
- A failing check stops the production deploy (it waits for check and database; main's pictures wait for the night run); a labelled preview still builds. Treat red as "fix before anything else".

### Claude in CI (ruled 2026-11-01, plan `process-sdlc-1`)

Three jobs ask Claude, paid from the repository secret `ANTHROPIC_API_KEY` (a [amount removed] monthly cap is set in the Anthropic console). None is a required check and each may fail without failing anything else: they comment, they never block or merge. Claude only reads in all three; plain shell steps post the comments and push the branch.

| Job | When | What it does |
|---|---|---|
| **Review** (`.github/workflows/review.yml`) | A pull request that touches `src/` or `supabase/` is opened, reopened or marked ready, or gets the **review** label; not on each push (ruled 2026-11-02, to save money), not drafts, not Dependabot | Reviews it against `REVIEW.md` (Sonnet; Opus when `supabase/` changes) and posts one comment, updated on each run, ending with `Important: N · nits: N`. To review again after fixes, add the **review** label (remove it first if it's on). Any other label (**ready**, **preview**) leaves a running review alone (fixed 2026-11-10: adding **ready** just after opening used to cancel it). Spend is capped at [amount removed] a month in the Anthropic console; past the cap, or when the credit is used up, the comment says the review didn't run and why (2026-11-10: before, it failed unseen behind a green run), and nothing else fails. |
| **triage** (in `check.yml`) | check, database or layout failed on a pull request; not Dependabot | Reads the failed jobs' logs and posts three lines as one comment: likely cause · flaky or real · what to try (Sonnet). It's a guess; the red job is the signal. |
| **CHANGELOG draft** (`.github/workflows/changelog-draft.yml`) | By hand at a gate: **Actions → CHANGELOG draft → Run workflow**, with the milestone's name (e.g. M5) | Drafts the milestone's entry from the titles of the pull requests merged since the last tag, puts it on top of `CHANGELOG.md` on a new branch `changelog-draft-<milestone>-<run>`, and links it in the run's summary. Edit it there, then open the pull request from that link. |

- The local `reviewer` agent reads the same `REVIEW.md`.
- Each job's cost shows in the Anthropic console (**Usage**); if the cap is reached or the credit runs out, the review says so in its comment on the pull request, triage and the CHANGELOG draft fail quietly, and the checks are unaffected.

## What's coming

- **M1 (done):** click-through smoke tests for every screen, access-rule tests against Supabase's row-level security, and layout checks in a real browser. Purse and GM-notes access tests arrive with those features.
- **M2 onward:** event-log and undo tests (every change writes an event; rollback creates a reversing event and nothing is erased).
- **M3 (done):** pack reading (JSON and Markdown), stacking, the formula evaluator, the editor's checks, and access rules for setting rules and homebrew; `npm run pack:check` for real packs.
- Each later milestone adds tests for its own features, per the rules above.

## Code health check (after every milestone gate)

After a gate passes, start a fresh agent that didn't write the code. It reviews the codebase and writes docs/health/M<n>.md, one screen long: tangled spots, duplication, test gaps (especially permissions and hidden data), risks for the next milestone, and for each item fix now (with rough hours) or later. Francis rules on each item. Fixes that change behaviour need a scope check first. It's an AI reviewing AI-written code: useful, not a senior engineer's review.

## Manual checklist

Run before each milestone gate, on the real devices. Add the next milestone's items before its gate. For the whole-group test, see `docs/table-test-1.md`.

**The Tester's pre-walk (ruled 2026-11-10).** Before each gate sitting the Tester (`.claude/agents/tester.md`) walks the app in Chrome as a player and reports to Design, so Francis's time at the gate goes to judgement and not to finding broken counts. It does what it can do alone: guided creation for one character of each class the gate's campaign offers (reading out the saved sheet's lines, the languages among them); the full sheet and At hand; every screen it reaches at 375 px (no sideways scroll, nothing cut, no word broken); and hidden stays hidden as a player. It changes no files and fixes nothing: each finding goes to Design as one message with the gate check's number, what it did, what it saw and what the check says. It runs on the campaign the sitting will use (the live app for a gate walked there, a preview otherwise); Francis signs in first, since it can't read the emailed code. **After a deploy that changes a screen,** Design may ask it for a short look at just that screen before a sitting; not after every merge. **Its limits:** it reads screens as a person does and can miss or misjudge; it is a second pair of eyes, not a regression suite, and the automated checks stay the safety net. First used at the M5b rewalk, where it found nine faults in creation, one of them lost data (given languages overwritten on save), before Francis reached them.

**A walk of creation outside a gate (ruled 2026-11-13).** It runs in a separate test campaign with the same packs and settings as the players' campaign, never in the campaign the players use: Francis makes it and adds the test player; the Tester's characters are named "Test 01", "Test 02"…. The Tester's session is started from inside its own worktree, brought up to `main` first (an agent's tools come from the folder it starts in).

**Every milestone, before its tag:**
- **Run the security advisor** on the main project and read what it flags: `npx supabase db advisors --linked`, or in the Supabase dashboard **Advisors → Security Advisor**. Known and accepted: the functions deliberately callable by signed-in people, each checking permissions itself (`create_campaign`, `peek_invite`, `redeem_invite`; `undo_request` and `use_ability` run as the caller, so they need no exception) and leaked-password protection (we don't use passwords). Accepted since M4b, each with its tests:
  - `note_rule_skipped`: only a member of the campaign can call it; it writes one GM-only log line, at most once a minute per rule.
  - `found_company`: only for a character the caller may act for (their own approved one, or any for the GM), and only while companies are on.
  - `ask_or_invite`: an ask only for a character the caller may act for; an invitation only from the company's members or the GM, and only to an approved player character still in play.
  - `answer_invitation`: an invitation only by the invited character's player, an ask only by the company's members; the GM answers anything.
  - `cancel_invitation`: only whoever sent it, or the GM.

  Accepted since M5 (reviewed 2026-11-01, `supabase/tests/m5-review.test.ts` and each step's tests):
  - `campaign_calendars`: only a member of the campaign; gives the campaign's calendars as players may see them (`private.visible_of`), and which the GM prefers.
  - `campaign_exceptions`: only a member; the GM gets every override, a player only the player-facing kinds (and only readable items).
  - `choose_party_group`: only for a character the caller may play (their own approved one or hireling, or any for the GM); a non-GM moves into a group someone is in only while it's in the same place as theirs (`private.groups_together`).
  - `close_message`: only a recipient of that message who is a member; closes their own copy alone.
  - `groups_meeting`: only a member; says which groups share a place, never which place (ruled 2026-11-01: players may learn that groups are in the same place even while both places are hidden, since Join up appearing or going says as much).
  - `join_party_groups`: only a member; a non-GM joins up only groups in the same place; the GM any two.
  - `weather_die`: only a member; gives only the die of one of the setting's weather tables (null for any other table), never a row.

  Anything else gets fixed or ruled on.
- **Fresh-session review:** open a new Claude Code session and ask it to review the milestone's changes (since the previous milestone's tag), especially the access rules.
- Tag the gate commit and add the CHANGELOG.md entry (see CLAUDE.md, Milestones).

### R0 — app shell

- [ ] The app loads on the PC, the tablet and the phone.
- [ ] The light/dark switch works (Device follows the device; Light and Dark override it; the choice survives a reload).
- [ ] The app installs to the iPad home screen (Safari → Share → Add to Home Screen) and opens with the "G" icon.
- [ ] The live Vercel address (https://grimoire-orpin.vercel.app) shows no "Setup needed" box.

### M1 — accounts and campaigns (passed 2026-10-20)

- [x] A sign-in code arrives within a minute at a Gmail address and at each player's own address, not in spam.
- [x] The code is 6 digits and signs you in as soon as the sixth digit goes in.
- [x] First sign-in asks "What should we call you?" once; later sign-ins don't.
- [x] Sign in inside the app installed on the iPad home screen, close it, reopen it: still signed in.
- [x] Sign out works on every device.
- [x] Start a new campaign; it shows in Your campaigns as "GM · No players yet".
- [x] An invite link opened while signed out keeps its code through sign-in, shows the campaign and GM, and Join adds the player (GM's row then reads "GM · 1 player").
- [x] A used, expired or wrong code says "Invite not found".
- [x] On the iPad, an invite link opens in Safari, not the installed app; after joining there, the campaign also shows in the installed app once signed in.
- [x] The ⋯ menu opens and closes on every screen, and its theme choice survives a reload.
- [x] As GM, Invite a player → Make invite link → Copy link (and Share… on the iPad) → the link opens the invite on another device. Links made on the live site, not localhost.
- [x] Revoke a waiting invite; its link then says "Invite not found".
- [x] Two devices, two logins: the player joins by link, makes a character (name, starting level, HP max, backstory) and sees "waiting for approval"; the GM sees it on the Campaign screen with its level and approves it, and the player's campaign then reads "Playing · level N".
- [x] The GM sends a character back with a note; the player sees the note, edits, sends it again, and it's waiting once more.
- [x] A player makes a second character, the GM approves it, and the player switches which one is active.
- [x] Delete a waiting character and remove (archive) an approved one, each after "Download a copy"; the file opens and shows the character. On the iPad, the download offers to save or share.
- [x] The GM restores an archived character, and deletes another permanently after a plain confirm (originally: after typing its name). A player can open their collapsed Archived characters, download one, and delete their own permanently.
- [x] As GM, Setting rules → add a List field and a Number field (with a group, one on the card), reorder, hide one, delete an unused one. On the iPad, typing a negative number in a Number field works with the on-screen keyboard.
- [x] A player sees the fields in "Who are they?" under their group names, fills them in, and the GM sees the values on the approval row; hidden fields don't appear.
- [x] On the iPad, "Add a portrait" offers the photo library and the camera; a photo (including HEIC) uploads and shows round on the card, the GM's rows and the picker; a non-picture file gets a plain message.
- [x] Change and remove a portrait; delete a waiting character with a portrait (the picture goes); archive one (the picture stays).
- [x] As GM, tap the campaign's sigil or name: rename it, add a sigil from the iPad's photos, then remove it (the first letter comes back). A player sees the new name and sigil on their picker row (when their character has no portrait) and campaign page, and can't edit either.
- [x] As GM, on Companies: make a company (a blank name is refused), rename it, put a waiting and an approved character in it, move one to "No company". A company with characters shows no Delete; empty, it deletes. The player sees the company on their picker row and character card.
- [x] On the iPad and a phone, as a player with an approved active character: opening the campaign shows the Player screen; − and + change HP (+ stops at max); tapping the number brings up a keyboard that can type a minus sign; a typed number above max shows "over max"; the bottom tabs sit above the home bar and Events and Pack say they're coming later; ⋯ → Your characters and "‹ Back to …" work.
- [x] Layouts on the real devices: iPad landscape (GM: section column on the left; player: Player screen beside the full sheet), iPad portrait (one column, GM tabs on top), iPad Split View at half width (one column, nothing cut off), and a phone. Rotating the iPad switches layout without losing your place.
- [x] **Gate: two test logins see one party.** On two devices, as two players in one campaign (each with an approved character, one in a company): each sees both characters under "The party" (theirs marked "(you)"), with the right levels and company; a waiting character of the other player doesn't appear; the GM sees both on the player list and Companies.
- [x] Full sheet: as a player, ⋯ → Full character sheet shows fields by category, Backstory and Notes; Edit saves notes and a field, and the level says the GM changes it. As GM, View sheet on the player list shows the hidden fields and can change the level; the player sees the new level.

### M2 — event log (passed 2026-10-21)

- [x] Security advisor run on the main project; nothing new flagged.
- [x] Fresh-session review: before the m2 tag, open a new Claude Code session and ask it to review the milestone's changes (`git diff m1..HEAD`), especially access rules. (Found a critical undo hole and three smaller issues; all fixed and pinned by `supabase/tests/review-fixes.test.ts` before the tag.)

- [x] As a player, tap − on the Player screen, open Events: the simple log doesn't show it; tick Verbose and it reads "You set Wren's HP to … (was …)".
- [x] With the GM's Log open on the iPad and a player's Events open on the phone, a change on either device appears on the other within a few seconds, without reopening.
- [x] As GM, make an invite: it shows in the GM's Log, never in a player's.
- [x] A player's waiting character shows in their own log and the GM's, not in another player's.
- [x] **Gate: change HP, undo it, see both in the log.** On the iPad, tap − on the Player screen, open Events, tick Verbose, Undo the HP line: HP is back on the Player screen, and the log shows both the change (marked undone) and "You undid a change to Wren's HP (back to …)".
- [x] Change HP twice, then Undo the first change: it says "That's changed since. Undo the later change first."
- [x] A player sees no Undo on the GM's lines; the GM sees Undo on everyone's; nobody sees Undo on making or deleting something.
- [x] Write a note about a character on the phone; it appears on the iPad's log within seconds. Tap a log line → Add a note to this; it shows indented under the line. Edit your note ("edited" shows; Verbose shows "Was: …"). Another player has no Edit on it; the GM does.
- [x] As GM, add a note to an invite line: no player ever sees it.
- [x] As GM, edit a player's sheet with a reason: the form says it's a GM ruling; the player's log shows the seal, "Fiat" and the reason, with no Undo for them; the GM can undo it. The player editing their own sheet sees no Reason box.

### M3 — setting rules and content packs (passed 2026-10-23)

- [x] **Gate: import the private test pack, pick options, see classes, items and stat blocks.**
- [x] Security advisor run on the main project; nothing new flagged.
- [x] Fresh-session review: before the m3 tag, open a new Claude Code session and ask it to review the milestone's changes (`git diff m2..main`), especially access rules. (Nothing critical; five medium and five small issues, all fixed and pinned by `supabase/tests/m3-review.test.ts` before the tag.)
- [x] On the iPad, ⋯ → Rules library → Import a file: pick the private test pack from Files; the preview shows its counts and the version warning; Save; it's listed with its counts. Another account never sees it.
- [x] Update it from the same file: the preview says 0 added, 0 changed, 0 removed; Update changes nothing.
- [x] Import a small Markdown pack (the example in docs/07): the preview counts it and lists any line it didn't understand.
- [x] As GM, Campaign → Setting rules → From your library → Add the private test pack: its optional rules open first, with Multiple classes choosable; Add to this campaign; it's listed with its counts. Every rule name has an ⓘ: tap it to see whether it can change later and any notes; tap again hides them. No "can change later" text or mid-campaign warning shows otherwise.
- [x] Then its Optional rules button: change two; the one that warns asks first (Keep leaves it, Change it changes it and doesn't ask again); a locked one is greyed out and says Locked; "Use all defaults" asks too if it would change a rule that warns; Save; it reads "Optional rules · N changed". The change shows in the Log, and Undo works on it.
- [x] Everyone has "Rules library" in the ⋯ menu, players too (changed 2026-10-22: players may import packs into their own library).
- [x] Remove it from the campaign: it's gone from the campaign but still in the Rules library.
- [x] Start a new campaign through all five steps: pick the private test pack, change an optional rule (a locked one can be chosen here), see encumbrance and time lengths filled in from it, create; Campaign → Setting rules shows the pack with those choices. Start another with "Create campaign now" after the name: no setting rules, the defaults.
- [x] The Log reads in plain words for setting rules: "You added the setting rules …", "You changed the optional rules of …", "You removed the setting rules … from the campaign".
- [x] Setting rules browser: as GM, Campaign → Setting rules → Browse these rules: groups per kind with counts, no optional rules; open a class, an item and a stat block and check the details read sensibly; search finds by name; "‹ Setting rules" goes back. Rules library → Browse on a pack: the same. As a player, ⋯ → Setting rules: classes, items and so on, but no stat blocks, tables or treasure. On a landscape tablet the details sit beside the list.
- [x] Stacking: with two setting rules in a campaign that share an entry (e.g. two packs with the same class id), Setting rules says the higher one wins; ↑ ↓ move them and the Log says so (Undo puts it back). Browse: the shared entry shows once, "Also in …"; See the other version; Use this version; it now wins for that entry only; Back to the stack order. As a player, only the winning version, no choosing. Adding new setting rules puts them on top but under homebrew.
- [x] Formulas: browse the private test pack's spells as a player whose character is level 3: a spell with a level-based duration shows "→" and the value at level 3; + and − change it; something with a fraction says "(rounded down)"; an item with no formulas has no level picker.
- [x] Editor: as GM, Campaign → Setting rules → + New homebrew entry → Stat block: leave Average hit points as "about 13" and Save: a plain message, nothing saved; fix it, add a stat line and an ability, Save: "… was saved in this campaign's homebrew", and "<campaign> homebrew" is on top with no Remove. Browse: an item from the private test pack → Edit as homebrew → change its weight → Save: the browser shows the new weight and "Also in …"; the Log has the line (making the homebrew version can't be undone); change the weight again: that line has Undo, which puts it back; Delete from homebrew… brings the pack's back. As a player: no editing anywhere, and the log shows the item line but not the stat block's.
- [x] Editor, 7b: + New homebrew entry → Spell list: type a spell name that doesn't exist: a plain message; fix it, Save. Race: add an ability change and a class with a level. Browse a class from the private test pack → Edit as homebrew: the form says what it keeps as it is (its progression); change the hit die, Save; the class still has its progression. Spell: duration as "2 + level" turns shows worked out in the browser.
- [x] Editor, 7c: + New homebrew entry → Optional rule with two choices and a default; Save: the homebrew now has an Optional rules button with it. Table: a row without a result is caught; Save. Treasure type with only a letter saves. Browse a matrix table from the private test pack → Edit as homebrew: the form says its rows are kept; Save; the rows are still there. On a phone, each row box names itself.
- [x] Converter skill test: Rules library → Import a file → packs/<your-pack>/<sub-table>.pack.json: the preview says 4 tables, matching `npm run pack:check`; Save; add it to a campaign that uses the private test pack; Browse → Tables: the four sub-tables, and a row's Monster shows the linked monster's name.
- [x] Hidden item fields: import a pack with an item whose `gmOnly` names a field (e.g. a cursed ring); as a player in a campaign using it, browse items: the hidden field isn't there; as GM it is, marked hidden from players.
- [x] Update a pack two campaigns use from a newer file: each campaign's Log has "Setting rules updated: … 0.1 → 0.2 (N changed, M removed)"; tapping it lists them; as a player, GM-only entries (stat blocks, tables) aren't named and there's no Undo.
- [x] Campaign → Setting rules: the campaign's homebrew has no Remove, and detaching it is refused even if tried another way.
- [x] Add setting rules that have a sheet layout: the layout offer shows its fields, "already here" on ones the campaign has; Use this sheet layout: the new fields appear under Character fields, yours unchanged, and the Log has one line.
- [x] Rules library → Convert a book with an AI…: the instructions show; Copy the instructions, paste into a note: it's all there.
- [x] Import a file whose meta has an author: the pack's row has About this file with it. A file with "formatVersion": 3 warns in the preview.
- [ ] App updates: after a new version goes live, switch away from the installed app and back: it's on the new version (no reopening twice), and an open form is never reloaded away.
- [x] As GM, Campaign → Setting rules → Retire campaign…: the confirm says what it means; Retire; the banner shows with Bring back, Invite a player is gone, and the Log says you retired it. On the picker it's under "Retired · 1", folded. As a player in it: the banner, no Bring back, sheets still open, changing HP is refused with a plain message. Bring back: the banner goes and things change again.
- [x] Rules library → Delete… on a pack no campaign uses: a plain confirm; it's gone. On a pack two campaigns use: the warning names both and what they lose; no typing, just Delete for good or Cancel; afterwards each campaign's Log says it was deleted, and the line has no Undo.


### M4 — inventory and encumbrance (passed 2026-10-24)

- [ ] **Gate: the load bar changes correctly in every mode, checked against a set of test characters with hand-worked numbers for each mode, using the test pack's real tiers (slot mode from a small invented homebrew test pack).**
- [ ] Gate, the hand-worked checks (kept private, beside each pack: `packs/<your-pack>/gate-checks.json`, never committed): coin mode with the pack's detailed encumbrance option (two kits A and B, then B with treasure, then B with treasure and heavy armour; a hold-only backpack doesn't raise the max), armour mode (A in heavy armour without and with treasure, B in light armour, B with no armour carrying treasure), and slot mode from the slot test homebrew (8 slots → its middle tier, plus the heavy ingot 11 → its top tier, the bar full at the last tier). `npx vitest run src/modules/inventory/gateChecks.test.ts` runs them all through the engine on a machine that has the packs; then on the iPad, give a test character each kit and check the Pack tab's numbers, tier and movement match the file. Magic armour is left out.
- [ ] Step 1, the name: the page title, the header and the installed app's name read Nemeton (on the iPad, remove the old home-screen icon and add it again to see the new name). A connection error says "Can't reach Nemeton…".
- [ ] Step 2 is data and commands only (screens come in step 4); its checks are automatic: who may add, take, move, equip and give (permission table, run against the database), a waiting character's items and log lines stay its player's and the GM's, items outlive deleted setting rules, one Party stash per campaign, rolls kept and never changed.
- [ ] Step 3 (automatic): the load in each mode (slot: the slot test pack's hand-worked check, 8 slots → Laden, 11 → Straining; coin with the flat misc-gear allowance; armour with treasure by category), containers add or hold-only, fixed-weight bags; byOption inside a section; a line's item details come from the database.
- [ ] Step 3, New campaign: with setting rules that give no slot data, Slots isn't shown at all; Not tracked is always there; the preset says "setting rules".
- [ ] Step 4, on the iPad as a player: Pack tab shows the load (tier label, bar, "N of M coins"), items grouped Worn and in hand · each container · Carried; tap the tier label for the tiers and "From your setting: …".
- [ ] Step 4: Add item → search → pick → Bought (cost filled in, "Cost noted; purses arrive later") → Put it → Add: the item shows, the load changes, the log says "… bought …". Crossing a tier shows a brief note.
- [ ] Step 4: tap an item, then a name under "Give to": it moves (two taps). Move it into a bag and out again; Drop part of a stack.
- [ ] Step 4: "Party stash · N items" at the bottom opens; take something from it. As GM: Campaign → Party stash; add loot there; a player's one-off shows "Add to campaign homebrew"; after it, the item is in Add item's search.
- [ ] Step 4: a player's device never receives a rules set's GM-only sections (checked automatically); armour mode shows "Move …" and a closed Gear group.
- [ ] Step 5, visible charges: add a wand; its sheet asks "Charges (2d10): enter the roll" (an impossible number is refused); Use a charge counts down; at 0 the row says "0 left · spent" and Use is greyed out. The GM's Recharge adds charges, logged.
- [ ] Step 5, hidden charges (a pack with magicItems.charges.hidden): the player sees "Charges: ?" and can always Use; the GM (Campaign → Party stash → Whose pack → the character) enters the roll, sees what's left, sees "Spent (hidden)" and a quiet log note at zero, and taps "Reveal: spent"; then the player sees "spent".
- [ ] Step 5, reveal: an item with a gmOnly field shows "Hidden from players" to the GM with Reveal; after it, the player sees the field.
- [ ] Step 5, tier line: crossing a tier writes "<name> is now <tier>" in the log.
- [ ] Step 6, text size: ⋯ → This device → Text size: Large and Larger make every screen's text bigger; taps stay big; the choice stays on this device only.
- [ ] Step 6, pins: on an item's sheet, Pin; it shows under "At hand" on the Player screen; Unpin there; give a pinned item away: the pin goes with it.
- [ ] At hand fills itself (gate-run ruling): put a weapon in hand, it shows under At hand without pinning; worn armour doesn't; "Hide from At hand" removes it, "Show in At hand" on its sheet brings it back; a pinned item in hand shows once.
- [ ] No "Show all items" switch on the GM's Players list; as a player, Add item shows only items for sale; as GM, set an item's "For sale in shops" to no in the homebrew editor and the player no longer sees it.
- [ ] On a phone and the iPad, as GM and as a player, the tabs match the rulings in the same order with the same icons, in portrait, landscape and Split View.
- [ ] As GM, the Players tab shows the "Waiting for you" count; Companies and Party stash are inside Players; ⋯ holds This device, Rules library and Sign out.
- [ ] The top-row log button opens a sheet on the phone (drag up, swipe down) and a side panel on the iPad, and closing it returns to the same spot.
- [ ] Scene shows recent log lines and no "Full log ›".
- [ ] At the largest text size, the theme and text-size switches show every word in full.
- [ ] On a phone and the iPad, scroll a long page (a full sheet, a long Pack): the slim bar stays with the back link, Log and ⋯, and Log opens from it.
- [ ] At the largest text size, in phone landscape and Split View, the slim bar fits without overlapping.
- [ ] As GM with nothing waiting, the tab reads "Players" with no count; with items waiting it reads "Players · N". Players never see a count.
- [ ] Gate feedback: writing a log note and pressing Escape loses the draft. Decide: ask first, or keep the draft.
- [ ] Gate feedback: the log sheet swipes only on its handle, with no live movement. Decide whether it needs more after trying it at the table.
- [ ] Step 6, Arrange: Player ⋯ → Arrange this screen: drag ⋮⋮ to reorder, switch a section off; the Player screen follows, says "N sections hidden · ⋯ to arrange", and another device shows the same; with VoiceOver, swipe up or down on a handle moves it.
- [ ] Step 6, Setting rules order: drag a pack's ⋮⋮ above another; the higher one wins.
- [ ] Step 6, page references: an entry with a source shows "From your setting: <short name> · <page>" at the foot of its popup (Pack item sheet, setting rules browser); one without shows no such line.
- [ ] Step 6, sayings: an empty Your campaigns, Rules library or GM Players and characters shows one of Ogham's sayings; the Player, Scene and Pack tabs never do.
- [ ] Step 1, emails (by hand, once): in the Supabase dashboard (main project), Authentication → Emails → SMTP settings, set the sender name to the brand file's `emailSenderName` ("Ogham"); in the email templates, use the brand file's `appName` wherever the app is named, and its `tagline` ("Under the old oaks.") in the footer. Then sign in from a fresh device: the code email comes from Ogham.

### M6 — encounters and fights (items so far)

- [ ] Linking a tactics table on a monster feels right in live play (tables dry run, 2026-10-29).
- [ ] In Explore, Encounter and Fight the current table is one row (its name · Roll); tapping it opens the panel; Table library › opens the table library.
- [ ] The GM's fight buttons read End foes' turn and, after End fight, Finish without loot.

### M5b — gate run, in play order (2026-11-03; the one M5b gate list; read this first)

One walk through the M5b gate as a session would play it: set up, make characters, then the gate's **3-day trek** (08: weather, a lost check, a forage, a camp) with a ruin on day 2 for the room, rest and status checks. Each check names the per-step section below that holds the detail; when a check fails, run that section. The per-step sections stay as spot checks; nothing was removed from them (stale lines are struck through with the ruling that changed them).

**Scripted first.** `npm test` runs the same trek (checks 17–28 and 40) on the fixture pack in `src/app/m5bGate.test.tsx`; `npm run test:layout` checks its screens (the wilderness scenes on `layoutHarness.tsx`: The Long Fen Road, The Reed Camp) and the gallery's Wilderness section. Both green before the walk; they don't replace it. Known differences on main: the plan's Departures (`docs/plans/m5b-5-gate.md`, SC-5-1 for check 26).

**Set-up.** The GM's iPad (landscape), Player A on an iPad, Player B on a 375 px iPhone. Newest packs from `packs/_current` (Drive `import/`): classic-advanced with the zine overlay, fae-woodland, and the invented fixture `scripts/fixtures/m5b-creation.fixture.json` (its Fen trek mode has the travel budget, Cut reeds and Scout ahead, a camp, watches and a rest rule; use it wherever a real pack lacks a piece). Light mode first; repeat the starred (★) checks in dark mode. **The rewalk (2026-11-10)** changes the where and who: the live app, a fresh fae-woodland campaign with its region, the Tester as Player A on the PC, the iPad as Player B, no phone; see `plans/m5b-gate-rewalk.md`.

**1 · The library and a new campaign**
1. [ ] ★ Rules library: packs under Setting rules · Adventures · Homebrew, the overlay with "Needs: classic-advanced"; Browse, Update, ⋯ (*Rules library by kind*).
2. [ ] New campaign → step 2: pick classic-advanced and the overlay; a missing base blocks Next with words (*campaign set-up*).
3. [ ] Step 3 opens with **App · N settings** folded; open it: charter, starting level and the rest (*shared rules and the App section*).
4. [ ] ★ **Encumbrance · one row:** step 3 has exactly one row that sets how load is counted. When a pack option sets it (an overlay's added choice included), that row lists every choice ("1 of N ▾") and the app's own Encumbrance row isn't shown; with no such option, the app's Encumbrance row is the one. Create campaign: Rules shows the same pick (*shared rules*; ruled 2026-11-05).
5. [ ] ★ A pack's rules: all shown, changed first; toggle two near the bottom: they don't move, each says "changed (the book: …)"; fold and reopen: they're on top (*rules rows that stay put*).
6. [ ] ★ A 3-choice rule as a segment in the Selected wash; a 4-choice one as a ▾ button with "1 of N"; ⓘ explains (*rules rows*).
7. [ ] Create campaign; the Rules tab shows the same choices; a "can't change once started" rule explains itself; Retire campaign… sits at the foot of Rules for this campaign, above the Setting rules heading (lr-7) (*Rules for this campaign*).
8. [ ] iPad landscape: the divider's pill folds and opens the menu; phone: none (*the divider*).

**2 · Characters (both settings)**
9. [ ] Player A, classic-advanced, Guided: Method (if offered), Scores (tiles whole, 18 fits), Race, Class with "to level N as …", Adjust (the C layout) (*character creation*, Part B and PRs D, E).
10. [ ] Every pick row ends in **Pick** / **Picked ✓** (Selected wash); Pick moves on with Undo; a name opens its entry (*PR E*).
11. [ ] Who they are: hit points with the one-line rule, Derived fields with AC as a number, leaning hidden from others (*creation*, *alignment visibility*).
12. [ ] Weapon proficiencies on: "Pick N · 0 of N"; with specialisation the step stays (*PR F*).
13. [ ] Gear: money first, kit first with its rolls, the shop; overspending stops Next with words (*creation, Gear*).
14. [ ] Player B (iPhone), fae-woodland: kindred-as-class off and on; a trait-list step with the pack's own why-line; first spells from the table (*PR F*, *First spells*).
15. [ ] Review: Change › on Scores and on Class (hit points cleared on a class change), Save and leave, Send; the GM approves (a typed weapon shows "Add to homebrew") (*review and send*, *PR G*).
16. [ ] An add-on class reaches its races at the book's limits and no others (deathcaster-class 0.2, or the race-reach fixture) (*a class reaching the base races*).

**The hand walk: three characters Francis makes** (added 2026-11-05 on the tester's ask; the checks a script can't walk because a character must be made by hand). Each row points back at its numbered check; a failure names one row. Make them in two scratch campaigns with every option on, then retire the campaigns. Which seeded campaigns and accounts to use: `docs/testing/gate-run-cast.md`.
- **H1 · an elf enchanter, fae-woodland, on the phone**
    - [ ] H1-53 a fairy can't take a mortals-only class (Pick explains); a mortal enchanter is pickable and flagged for special approval.
    - [ ] H1-54 the Magic step asks for two glamours, labelled kindred and class; Change › on the class reopens Kindred.
    - [ ] H1-14 the trait list and the first spells (roll and tap, or choose).
    - [ ] H1-55 Roll a name; the trinket in Gear; Details skipped in one tap.
    - [ ] H1-56 languages: rolled or picked within who may learn.
- **H2 · a knight of a small kindred (if the pack has one), fae-woodland**
    - [ ] H2-57a Liege is asked of a knight only; tapping a house sets the alignment and says why.
    - [ ] H2-56 a Small character's swapped weapon; "10 arrows" gives 10; an unusable kit item is carried and labelled.
    - [ ] H2-57b a one-off item at creation comes in approved; a bonus shows on the sheet and on the review.
    - [ ] H2-53 a Church class offers no Chaotic.
- **H3 · a classic-advanced character on the add-on class pack**
    - [ ] H3-12 the weapon proficiencies step (its option on).
    - [ ] H3-16 the add-on class reaches its races at the book's limits and no others.
    - [ ] H3-58 the XP modifier at creation and on the sheet.
    - [ ] H3-59 an option flipped off hides its field, and the value is kept when it is flipped back on.
- **Before check 42 (hidden stays hidden):** as the GM, write a GM-only note and add a piece that is not shown; then Player B looks on the phone.

**3 · Day 1 of the trek: travel, weather, foraging, camp**
17. [ ] GM: Start expedition in the day-by-day mode (Where? at a known place brings back its shown pieces) (*travel*, *g2b*).
18. [ ] ★ Weather: both players see "Weather due · Roll d<N>"; one enters it; the card shows on every device (*weather roll*).
19. [ ] The travel card: "<name> N of N", the breakdown on tap; **Move…** with a route, terrain and a place name; Undo (*travel*).
20. [ ] Players: the activity buttons under "Around you"; **Cut reeds** with a roll: the item lands in the finder's pack; Undo takes it back; after one is used, Undo refuses (*the players' activities*, yu-1).
21. [ ] **Scout ahead** (secret): Ask the GM; the GM answers Yes with a note; points drop; Undo restores (*secret activities*).
22. [ ] What we know: empty, then the shown place appears (*secret activities and What we know*).
23. [ ] Player B: **Force march**: "+N points · rest due this evening", no prompt yet (*camp follow-up*).
24. [ ] GM: ⋯ → **Make camp**; players' buttons swap for the Camp card; firewood, cook, eat (the GM sees who hasn't eaten; Give food) (*camp, part 1*).
25. [ ] Sleep: Player B's step starts "Rest due (forced march)"; watches (three at most, casters noted); the GM changes a difficulty (*camp, part 2*, *camp follow-up*). *(to build, after 57/63/64)* the Cooking and Campfire talk steps end with Worked · Didn't work · Fumbled; the sleep roll's line names the meal and the fumble (sl-1 … sl-4); until built, the GM adds them by hand.
26. [ ] GM: Next day stops first at the night check ("The night", the clock and the camp unchanged); Night prowlers hits; its Encounter waiting card asks **Which watch?** with the watch order; Next day again: the camp line on the card, no second Night prowlers; the Camp card leaves every screen; Undo puts the day back and the camp opens, and Next day then moves straight on (*camp, part 2*, *Encounter waiting*, *SC-5-1 B*).

**4 · Day 2: lost, then a ruin**
27. [ ] GM: Mark lost; players see nothing (Getting lost is secret); Found the way / Still lost (*travel*).
28. [ ] A Move… beyond the day's points: "Entering <place> · N more tomorrow" (*travel*).
29. [ ] Encounter: a wandering check **Hit** opens the tables (pinned, likely, rest); a row with stat blocks; the card queues; View, Start, Dismiss with Undo (*Encounter waiting*, g3).
    - [ ] **Every table shows its rows** (fix-table-row-shapes): in **Tables ›** and the GM reference's Tables, a lookup (classic-advanced's mercenary wages, a key and its columns), a name table (fae-woodland's, each column under its heading) and a treasure table (fae-woodland's magic rings: Type, Value, Summary) all show words on every row (*table row shapes* section below).
30. [ ] Into the ruin (the dungeon mode): the place card's **+ Piece**, the eye shows a piece to players in the order shown; edit a shown piece quietly; Remove with Undo (*place card as pieces*, *g2b*).
31. [ ] Next turn until rest is due: every player's prompt Rest / Push on; answers arrive live; the GM flips one; Next turn applies; the log line ends "next rest due turn N" (*rest flow*, *g6 rulings*).
32. [ ] ★ No light in a group: "◑ No light" on the band and the tiles; Light a torch (*rest flow*, *g6 rulings*).
33. [ ] **+ Status** (GM): a family row, Until rest, Other…, a custom status; the player sees the effect, no + Status (*statuses*).
34. [ ] Split the party and join it again: each group its own budget, prompts and pieces (*travel*, *rest flow*).

**5 · Day 3 and the GM's tools**
35. [ ] ★ GM reference (the open book): a 220 px list under **From the rules** and **The book's GM pages**, values in words, the switcher wraps (*GM reference and compose*, *g5 bug fix*).
36. [ ] ✉ Messages: the GM sends to Player B (with a picture), Undo within 8 s, a disappearing one; Player B replies; compose's Attach and Send line up (*messaging*, *GM reference and compose*).
37. [ ] ★ Close everywhere is a bare ✕ at the top right; Escape closes (*selected state and one Close*).
38. [ ] Strip ⋯: Encounter check, Advance by…, no Set time…; the procedure opens from the mode and turn; due marks sit on their turn (*gate sweep*, *start time, due marks*).
39. [ ] End session mid-trek: **Resume session**; players see "Session paused" (*gate sweep*).
40. [ ] End expedition: the summary with Undo; the next Start shows no old Encounter waiting cards (*Encounter waiting*).
41. [ ] **Every screen at 375 px:** nothing scrolls sideways; long names wrap; every button 44 px (each section's Phone line).
42. [ ] **Hidden stays hidden:** on both players' devices, no GM note, unshown piece, GM-only table, secret check or another player's leaning anywhere (Scene, log, Rules, reference).
43. [ ] Security advisor on main: no errors; the warnings are the known kinds (*Every milestone, before its tag*).
**6 · Day 4: a town (M5b step 6, `plans/m5b-6-settlements.md`; checks to detail with each PR)**
44. [ ] Move… into a **Safe** town: the GM's arrival card; players see nothing. A Hostile place: no card.
45. [ ] **End expedition** from the card: the summary with Undo; the campaign stays in Adventure, in town, no expedition; then **Not yet**.
46. [ ] The **town screen** (GM, the place card of a Safe or Hostile place; step 6c): **Places in town** (fae-woodland: Shops and Others from its services; Lodgings once a pack has `downtime.lodgings`), **Things to do**, **Encounters** with the two switches. **Show players** on one shop: Player B's Scene lists that one under "Places in town", nothing else; **Closed** on it: they see "Closed"; Undo on the toast hides it again. After **End expedition** the town screen stands on its own (the town's name on top) and players keep what's shown (*town screen*). **Options and overlays:** fae-woodland with Lifestyle expenses and Treasure valuation **off**: no "Living:" line, no valuation service; turned on, both. classic-advanced with the zine: the base's five services stay beside the zine's (*town options and stack*).
    - [ ] **The town shown before its places** (review finding 2, ruled B; `m5b-6c-town-shown`): at a Safe place not yet shown to players, the first eye on a shop shows the town with it, toast "Shown: <town> and <shop>", one Undo hides both; with no Description piece the tap explains and changes nothing (*the town shown before its places* section below).
47. [ ] **Next part of day**: morning → afternoon → night → morning, logged (*time in town*).
48. [ ] **Out and about today** and **Active tonight** (GM, the strip's ⋯; sw-1 … sw-4; **during an expedition**, bq3-2: between expeditions only the clock moves): on, fae-woodland's town-day (and town-night) check comes due; off, it stays quiet; the strip shows a marker, players a state line only; both reset at the next morning, logged, with Undo.
49. [ ] **Ask for…** (Hit, In stock) and **Sell…** (Offer, Decline) between a player and the GM: Player B's Scene, under the places in town, **Ask for…** → a shown shop → a pack item → Send; the GM's Waiting for you shows the pack's price and the chance by size, **Hit** then **In stock**; Player B taps **Buy it** and the item is in their pack as bought, the price on the line. **Sell…** an item to a shown buyer: the GM's offer starts at the pack's suggestion; Player B **Declines** and keeps the item (*town requests*).
50. [ ] **Lodging**: a player picks a shown lodging in **Where you stay** (at once, the cost in the log); Somewhere else… waits for the GM; next morning (Next part of day from the night) the **overnight card** with last night's lodging and its cost, once (*town requests*). *(to build, after the gate)* the morning offers the lodging's `onGoodRest` and the card names the source (sf-2, which ruled SC-6e-1); until then the card shows the rule as text and the GM's Heal serves.
51. [ ] **Start downtime** (strip ⋯, in town): a full rest applied once; **End downtime** (⋯): back to Adventure (*time in town*). **The rewalk ends on Start downtime:** the button and its log line (downtime itself isn't modelled yet).
52. [ ] classic-advanced (no settlement mode): a place marked Safe shows the town screen (its services: Black market under Shops; Healing and Rumours under Things to do) and the arrival card; time moves with the current mode or Downtime (*town screen*).

**How this list grows (ruled 2026-11-04):** this section is **the one M5b gate list**. **Only the designer edits the numbered lines** (ruled 2026-11-05: every merge that touched them made every open pull request clash and re-run CI). A pull request writes its manual checks in its own text (rvw-12; the per-branch files in `docs/testing/` are history since 2026-11-17). The detailed sections below stay as written. A check marked *(to build)* is planned, not yet built.

**What holds the tag** (gt-1, gt-2, 2026-11-11, `design/rulings/m5b-morning-rulings-2026-11-11.md`): M5b is not tagged until both hidden-data fixes are pushed and live (the pack cache and patches, hd-1; the place being entered, fm-2) and F86 (no Rest day card at camp after a forced march that paid off a move) and F87 (the clock and the travel day out of step after an Undo of the day and a new Next day) are understood and fixed. The gate walk can pass before them.

**7 · Since the first gate run: creation, options, the sheet, the rest (checks to detail with each PR)**
53. [ ] **Class limits** (survey PR 1, cs-3, cs-5, rc-5): a fairy can't take a mortals-only class (Pick explains, bq2-2); a mortal enchanter is pickable and flagged for special approval; a Church class offers no Chaotic; with lifted limits a demihuman cleric is allowed.
54. [ ] **Kindred-classes and grants** (survey PR 2, cs-2, cs-4): an elf enchanter's Magic step asks for two glamours, labelled kindred and class; picking a kindred-class sets the kindred and drops its traits; Change › on class reopens Kindred (*names, trinket and Details* sections below).
55. [ ] **Names, trinket, Details** (survey PR 3, cs-1): Roll a name; the trinket in Gear; the optional Details step skipped in one tap and editable from the sheet.
56. [ ] **Kits, languages, bundles** (survey PR 4, cs-6, rc-2, rc-3, si-2): a Small character's swapped weapon; "10 arrows" gives 10; an unusable kit item carried and labelled; extra languages rolled or picked within who may learn. A background's cantrip roll opens under its pick, tapped or typed, and shows on the review and the sheet (*a background's spell roll*, bq3-18).
57. [ ] **One-off items at creation** (bq3-6; *one-offs from creation come in approved* below), **bonuses** (PR 5, cs-7; *bonuses and traits* below), **figures tappable everywhere** (PR J, bq-2): on the Player screen a skill's and a save's pop-up reads word for word as the full sheet's, the rules, the class and the kindred; on Who they are a Derived field opens its breakdown, Armour as the AC tile's; on the review each derived value is a tap value; HP keeps the damage pad ("M5b — figures tappable everywhere" below). **The liege** (PR 6, cs-3): a fae-woodland knight is asked Liege on Who they are, a fighter isn't; tapping a house sets the alignment and says why ("M5b — the knight's liege" below).
    - [ ] **Small follow-ups** (sq-3, sq-4; *the small follow-ups* below): a `distinct` kit roll's picked row untaps on a second tap, no message; At hand's weapon line opens its breakdown with **Open <item> ›** at its foot.
58. [ ] **Prime XP** (rc-1): a class shows its XP modifier at creation and on the sheet.
59. [ ] **Options that behave** (options-gates PRs 1–5): every audit row's option on and off in the seeded options-on and defaults campaigns; a field whose option is off is hidden (value kept); an overlay's `extends` choice in one option; a gate on several choices; **patches** (PR 3b, of-13, of-14; *patches applied in the app* below); **add-ons, a later rule change, presets** (PR 5): an add-on shows only once its parent is on and goes with it in one change; a later change of the carrying rule moves every load; a preset previews, applies and undoes (*add-ons, a later change of the carrying rule, presets* below); **every weapon's damage from a rule** (of-8, the area-4 re-check fix): in classic-advanced with "All weapons d6", a battle axe at hand reads d6 and names the rule (*the area-4 re-check fixes* section below); fae-woodland's GM reference shows its encounter rules under Combat; **the small ones** (PR 4, *options that behave: the small ones* below): Fen small options' Safe paths only choice leaves Use safe paths alone in Leave the dungeon, the stepper reads "levels below the first", a Bog singer is asked for the one spell its level has, the Odds and ends pick shows only with its option.
    - [ ] **Small follow-ups** (sq-1, sq-2; *the small follow-ups* below): Leave the dungeon's stepper starts at **0 levels below the first: no change**; **Use safe paths** writes one log line ("… led the party out by safe paths") with Undo, once per expedition.
    - [ ] **A patch on a GM-only kind stays the GM's** (fresh-session review fixes, `fix-review-2026-11-04`): with an overlay whose `patches[]` has one on `statBlock`, a player's Library and log never show it; the GM's do; `pack:check` warns on it (*fresh-session review fixes* section below).
60. [ ] **Area 2 and area 3 fixes** (#353, #380): table chaining by name; armour tier; magic armour by its base; and each piece below. *(After the gate: the rest of area 3 order 9, a magic item's base in play, mb-1 … mb-3; camp facts on sleep, sl-1 … sl-4; an armour's load type, al-1.)*
    - [ ] **Party and self modifiers** (area-2 PR 1, ex-2, ga-3): with a Reed Witch in the party, Going astray in a reedbed is "1 on d6 · a Reed Witch in the party", elsewhere the terrain's chance; Cut reeds lists "+1 for <her> · a Reed Witch" (*party and self modifiers* section below).
    - [ ] **Skill lists and best-of fills** (area-2 PR 2, ex-3, ga-4): a level-3 Mire Stalker's sheet shows Hark 4+ and its breakdown names Keen ear; Hark for prowlers rolls "Hark (4+) · … · the better of Hark and Keen ear counts", a Lantern Warden's plain Hark 6+ (*skill lists and best-of fills* section below).
    - [ ] **The next table by terrain** (area-2 PR 4, ga-2): Fen prowlers' 6 "Fen folk" opens Reed folk in a reedbed and Meadow folk elsewhere, the other one a chip away (*next table by terrain* section below).
    - [ ] **Options run by hand** (area-2 PR 5, ex-7): a `manual` option says "Run by hand · the app doesn't apply this yet" in set-up and Rules, the words open its rules, its choice is saved; `pack:check` lists every one (*options run by hand* section below).
    - [ ] **Slot bands** (area-2 PR 3, ga-1, sr-9): with slots and two bands, the Pack tab shows one bar per band with its count and speed, the slower one "sets your speed"; the sheet's Movement and the travel card's slowest speed say the same number (*slot bands* section below).
    - [ ] **Day-food from a bundle** (area-2 PR 6, G-108): in a bog, Dig bog roots puts single days of the week's rations in the finder's pack, and Undo takes them out (*day-food from a bundle* section below).
    - [ ] **Containers by fill and carry bonuses** (area 3 order 11, eq-5, eq-6): a half-full Heron satchel reads "300 of 600 · half full" and its contents don't count; Ogre grips (slot `worn`, beside a sword and shield) raise the limit only while worn, named in the tier's breakdown (*containers by fill and carry bonuses* section below).
    - [ ] **Carrying treasure and clashes** (area 3 order 12, eq-3, eq-4): under armour mode one gem reads "Carrying treasure · treasure in the pack"; the GM's Switch off restores the no-treasure move and logs one line with Undo; importing a pack that shares an item id with an attached one lists it under "Same item id as an attached pack"; `pack:check` on two such files notes the clash (*Carrying treasure and clashes* section below).
    - [ ] **Quick-kit rolls by class** (area 3 order 13, eq-9): a quick kit shows each class only its own rolls.
    - [ ] **Weapon rules and class forms** (area 3 order 10, eq-7, eq-8, mb-4): a weapon allowed or refused by its combat category and the class's, the rule's exceptions, and a class's forms with their own lists (*weapon rules and class forms* section below).
    - [ ] **The small follow-ups** (sq-1 … sq-4): the dungeon-exit stepper starts at 0; Use safe paths is logged; a distinct kit roll untaps; At hand's weapon figure opens its breakdown with Open <item> › (*the small follow-ups* section below).
61. [ ] **The ✕ on full-screen pop-ups** and **a forced march with no camp** (ruled B): Reference and the log's sheet close with ✕; a forced march's rest comes at Next day without a camp.
62. [ ] **The location view on a phone** (#364, bq-4, bq2-3): the Open card with › at the right edge; "Where are we? · Set place"; the sheet opens full screen.
63. [ ] **Fewer links** (fl-1 … fl-5): no action drawn as underlined text anywhere (every Cancel, Not now, Delete, Decline, Edit and the travel card's Spend the day looking, Set by hand…, Mark lost are small buttons; only ‹ back links, "… ›" links and Help me choose stay underlined, plus fl-5's two: a dotted underline on a heading you tap to edit or open, and the toast's Undo; a homebrew entry in Setting rules reads "Name · kind ›"); the Encounter waiting card's Start, View, Dismiss; Watches by watch with + Add and Split evenly; on the Fen trek (no daylight table) Split evenly asks **How many watches tonight?** (− N +, only counts with every watch 1–3; a step past it explains why in a pop-up), then splits (bq3-4).
64. [ ] **The full character sheet** (sr-1 … sr-10, `plans/m5b-sheet.md`; built in orders 1–6): on a tablet two columns, Combat (four captioned tiles), Saves, Movement, Pack load and Skills on the left, Abilities, Traits (chips by source, use pips, "· drawback", "· lv N"), Magic (spells a day as dots, a tab per kind), the setting's own groups and Advancement (the bar, "N to level N", the XP bonus with its reason, the title) on the right; on a phone Combat open with its tiles two by two and every other section folded to one line with a summary, opening in place and remembered on the device; a field that doesn't apply is absent; no caption line starts with a separator. On the Pack tab, tiny things in their own folded section. Checked on every seeded class and the eight edge-case characters. Detail: "M5b — the sheet's Combat, Movement and Skills" below and `docs/testing/m5b-sheet-2-traits.md`, `m5b-sheet-3-magic.md`, `m5b-sheet-4-combat.md`, `m5b-sheet-5-pack-load.md`, `m5b-sheet-5-tiny-tab.md`.
    - [ ] **`sheetFields` in pack:check** (order 6, sr-10): `npm run pack:check` on classic-advanced, fae-woodland and the zine overlay prints "Printed sheet fields: N, M with no home" and lists only the coins (they wait for M7b's purses) (*`sheetFields` in pack:check* section below).
65. [ ] **The seeded campaigns** (`npm run seed:test`, docs/testing.md "Seeded test campaigns"): rebuilt from the newest packs before the gate run; every class opens its sheet.
66. [ ] **Live:** production deployed from the gate's commit; the main database has every migration (`supabase migration list --linked` shows none pending); the security advisor shows no errors.
67. [ ] **Weapon rules and class forms** (area 3 order 10, eq-7, eq-8, mb-4): a martial class puts on a thunder-tube its list lacks ("By the Thunder-tube rule"); the excepted knight is blocked with the rule named; a phase kin's Form chips on the sheet switch it, the coat comes off with a toast, Undo puts both back (*weapon rules and class forms* section below).

**8 · Added for the rewalk (2026-11-09; `plans/m5b-gate-rewalk.md`, where they were drafted as 53–58)**
68. [ ] **The Players tab glows** while a character waits for approval and goes out on approval (#568, GM rail A2).
69. [ ] **The full sheet on the standard** (#567, #575, #576; players/05, players/08): saves and scores by their full names, the Movement and load cards, language boxes, skills, abilities and traits as rows, the Details ledger; a player edits a score → the GM approves it from Players, and the sheet shows the new figure.
70. [ ] **At hand** (#569, the packs' `modes`): Wield, then Attack; a bow's Quiver with two arrow stacks; the spent stack; Fire one.
71. [ ] **A long table** (names or trinkets; #571): the typed roll and the range bar.
72. [ ] **An attached pack's class renders fully** (retest 4, T8): in Francis's classic-advanced campaign with the zine, a zine class's sheet shows every section, nothing bare.
73. [ ] **Sources** (#576, retest 4 T6): every "From your setting" line on the sheet and in creation names the book and the page.


### M5b — `sheetFields` in pack:check (sheet plan build order 6, sr-10; 2026-11-05)
On your PC, in the project folder. Nothing in the app changes.
1. [ ] **The invented setting:** `npm run pack:check -- scripts/fixtures/m5b-sheet-fields.fixture.json` prints "Printed sheet fields: 11, 2 with no home." and lists "Thistle marks" (no home) and "Bramble debt" (its home "brambleDebt" isn't a figure, the Pack tab or a layout field); one Format note on "Wick tally"'s choice "always"; no "sheetFields isn't a part" line.
2. [ ] **An overlay alone and on its base:** `npm run pack:check -- scripts/fixtures/m5b-sheet-fields-overlay.fixture.json` lists two "Homes this overlay's base may have"; with the setting's file first (`npm run pack:check -- scripts/fixtures/m5b-sheet-fields.fixture.json scripts/fixtures/m5b-sheet-fields-overlay.fixture.json`), "The 2 packs together" lists only "Briar scars" ("Oath of the hedge" lives in the base's layout).
3. [ ] **The real packs:** `npm run pack:check -- <classic-advanced file>`, then the fae-woodland file, then the zine overlay with classic-advanced: each prints its "Printed sheet fields" line; the only fields with no home are the coins.

### M5b — weapon rules and class forms (area 3 order 10, 2026-11-04; eq-7, eq-8, mb-4; `docs/plans/m5b-review-area-3.md`)
A campaign with the invented `scripts/fixtures/m5b-review-area-3.fixture.json` (its rules set has a Thunder-tube rule for martial classes, excepting the Bog knight; the Phase kin has a Dawn phase and a Dusk phase). The migration `20261104210000_m5b_area_3_class_forms.sql` applied.
1. [ ] **Allowed by the rule (iPad, player):** a Reed warden (martial; its own list has no thunder-tube) with a Reed thunder-tube in the Pack: Put it › in hand goes on; the row reads "… · By the Thunder-tube rule".
2. [ ] **Blocked by category (iPad, player):** a Bog mage (gentle) with the same tube: Put it says "Bog mage can't use Reed thunder-tube. The Thunder-tube rule allows martial classes; Bog mage is gentle. The marsh referee decides for chaplains." OK is the only button.
3. [ ] **The excepted class (iPad, player):** a Bog knight (martial, on `exceptClasses`): Put it says "Bog knight can't use Reed thunder-tube. No thunder-tubes: the order forbids them. The Thunder-tube rule doesn't apply to Bog knight: its own list decides. …"; its Reed darts still go on.
4. [ ] **The form switch (iPad, player):** a Phase kin wearing an Iron scale and holding Reed darts; Full character sheet › Combat shows "Form" with **Dawn phase ✓** and **Dusk phase**, and "Any weapon or armour." under them. Tap Dusk phase: the chips swap, the note reads "Darts only; no armour or shield.", the toast reads "<name> is now in Dusk phase. Iron scale came off and is carried: Phase kin can't use Iron scale in Dusk phase. Darts only; no armour or shield." with Undo; the Pack shows the scale carried, the darts still in hand; the log reads "… switched <name> to Dusk phase (Iron scale came off and is carried)".
5. [ ] **Undo (iPad, player):** tap Undo on the toast: Dawn phase ✓ again, the scale worn again, one more log line.
6. [ ] **Put it in the dusk form (iPad, player):** in Dusk phase, Put it on the scale: "Phase kin can't use Iron scale in Dusk phase. Darts only; no armour or shield."
7. [ ] **The GM (iPad, GM):** Players › View <name>'s sheet: the same Form chips; tapping the current one says "<name> is already in Dawn phase."; switching works and is logged as the GM's.
8. [ ] **Another player (iPad):** opens a party member's sheet, if a screen offers it: tapping a form says "Only <name>'s player or the GM can switch the form." and nothing changes.
9. [ ] **375 px (iPhone):** the Form chips wrap to two lines inside the Combat block; each chip is 44 px tall; no sideways scroll; the toast's long text wraps.
10. [ ] **No forms (iPad):** a Reed warden's sheet has no Form row; the Combat block is as before.
11. [ ] **pack:check:** `npm run pack:check -- scripts/fixtures/m5b-review-area-3.fixture.json` lists one note on weaponRules (Hand-cannon's "iron-born" category) and none on forms.
### M5b — the sheet's Combat, Movement and Skills (sheet plan build order 1, sr-1, sr-2, sr-8, A4; 2026-11-04)
On the seeded campaigns (`npm run seed:test`, "Seeded test campaigns" above), private packs only. Sign in to the preview as the test GM; open each character with **View sheet**.
- [ ] **iPad landscape, fae-woodland "defaults", a thief:** the Combat block has four tiles, each with a quiet second line: **Hit points** "<dice> · CON ±N" (the class's hit dice), **AC** the armour worn and "DEX ±N", **Attack** "+N" with "melee +N · missile +N", **Level** "1" with "0 / <next> XP". No "Movement: …" box anywhere in Combat.
- [ ] **Movement (same thief):** one **Movement** section: Speed, Overland (travel points per day), Exploring and In a fight, each with the pack's own figure (the private gate-checks file has them) (no blank row, no second Exploring); a quiet "Encounter, Familiar, Running, Swimming ›" line under it. Tap Speed: "Speed N: from <the tier> (your load)." then one line per folded figure. Load the thief past the first coin tier in the Pack: Speed reads the next tier's figure, and Overland and the rest follow.
- [ ] **Skills (same thief):** a **Skills** section with **Everyone** (Listen, Search, Survival) and **Thief** (Climb wall, Decipher document, Disarm mechanism, Legerdemain; "2 more ›" opens Pick lock and Stealth in place), each "5+" style; a duskcat's Listen carries a "kindred" tag. Tap Pick lock: "Succeeds on 5 or more · 2 in 6", the class's number at this level. The thief's skills are not in Combat.
- [ ] **Player screen (fae-woodland thief, as the player, or the GM's Player view):** Skills reads "Listen", "Search", "Survival" (the pack's names and capitals), then the thief's own; tapping one gives the same odds.
- [ ] **iPad landscape, classic-advanced "defaults" (descending AC), a fighter:** the Attack tile is named after the layout's field ("THAC0") and reads "19" with "melee N · missile N" (19 less each score's modifier). Tap it: the class at level 1, Melee and Missile rows, then **AC 9 … 0** with the d20 roll under each (the pack's attack table) and "From the rules: descending AC · the option “Armour class and attacks”". At hand on the Player screen reads "THAC0 <N> · <damage>" for the held weapon, not "+0 · …".
- [ ] **Same fighter, ascending AC:** GM: Rules → Armour class and attacks → Ascending; reopen the sheet: the tile is **Attack +0** (or +N), its pop-up has no AC row and ends "+0 to the d20 against AC"; At hand reads "+N · <damage>". Set the option back.
- [ ] **classic-advanced, a thief:** Skills has **Everyone** (the adventuring skills: Listen at doors, Open stuck doors, Find secret doors, … each "N-in-6") and **Thief** (Climb sheer surfaces N%, Hear noise N-N, …), the rest folded after 4.
- [ ] **Phone 375 px:** the four tiles fit two by two with their captions wrapping; the Movement grid and both skill groups fit; Attack's AC row is two rows of five (AC 9–5 over 4–0, each with its Roll line), every column in sight with no sideways scroll (on the iPad it stays one row); a skill name too long for half the width (the gallery's "Find the way through the drowned causeway at night") takes the whole row while "Wade the deep pools" keeps its half; a long tag ("4 when wading") wraps; every tap is 44 px.

### M5b — table row shapes (fix branch, 2026-11-04; `docs/plans/m5b-fix-table-row-shapes.md`)
GM on the preview, a campaign with classic-advanced, and one with fae-woodland (private packs). Before this fix, 66 tables showed no rows at all (they were missing from the lists) and 5 lost some rows.
1. [ ] **A lookup with columns (iPad landscape, GM):** Explore › **Tables ›** › "Mercenary wages per month": each row reads its troop type on the left ("Archer", "Archer, mounted") and "AC: 6 [13] · Morale: 8 · Human: 5gp · …" beside it. No column chips, no Go to number.
2. [ ] **A lookup by key (fae-woodland or the dungeon pack):** a table of hooks or tolls (one `{ key, value }` row each): the key on the left, its words beside it; a long key wraps inside the left 40% and the words keep their width.
3. [ ] **A name table (fae-woodland):** Tables › a kindred's names table: each row "Male: … · Female: … · Unisex: … · Surname: …"; no column chips.
4. [ ] **A treasure table (fae-woodland):** Tables › "Magic rings": each row "Type: Ring of … · Value (gp): … · Summary of Effect: …". Tap a row from an encounter's Hit: the toast and the log name the same words.
5. [ ] **A matrix still picks its column:** the Encounter type table (by time and setting): the four column chips; tapping one changes every row's result.
6. [ ] **GM reference:** the open-book icon › Tables › the mercenary wages table: the same rows as in 1.
7. [ ] **Phone 375 px:** the mercenary and hooks tables: nothing scrolls sideways; the left key column wraps; each row is at least 44 px.

### M5b — the area-4 re-check fixes (fix branch, 2026-11-04; of-8; `docs/plans/m5b-fix-area-4-recheck.md`)
A campaign with the invented `scripts/fixtures/weapon-damage-rule.fixture.json` (Reed damage; its Weapon damage option starts at "All weapons d6"), or classic-advanced with its default weapon-damage choice; and a campaign with fae-woodland.
1. [ ] **At hand, the rule's die (iPad, player):** a character carrying a **Bog axe** (its own die 1d8) and an **Eel knife** (1d4, melee and missile), both in hand. The Player screen's At hand: the axe reads "… · d6 · All weapons d6" (with a Muscle bonus, "d6+1 · All weapons d6"); the knife "Melee … · Missile … · d6 · All weapons d6". In classic-advanced: a battle axe reads d6, not 1d8, with the choice's name.
2. [ ] **The choice off (iPad, GM, then the player):** Rules for this campaign › Weapon damage › **By weapon**. The player's At hand (reopen it): the axe reads 1d8, the knife 1d4, no rule named.
3. [ ] **Weapon skills step (iPad, player):** with "All weapons d6", a new character with weapon skills (a pack with `weaponProficiency`; the creation fixture with the option added, or classic-advanced): tap a weapon's row to open it: "Damage and use" reads "d6 · All weapons d6 · melee, one-handed".
4. [ ] **The book unchanged (iPad, GM):** Setting rules' browser and the GM reference's Equipment still show the axe's own 1d8 (they show the book, X3).
5. [ ] **Encounters in the GM reference (iPad, GM, fae-woodland):** the top row's open book › Combat: an **Encounters** entry with fae-woodland's encounter rules, after Surprise. A pack with both `procedures.encounter` and `encounter` shows two Encounters entries, the procedure first.
6. [ ] **375 px (iPhone):** the At hand line with the rule's name wraps inside its row; no sideways scroll.
7. [ ] **The rule, then a patch (iPad, GM, then the player):** with "All weapons d6", Rules for this campaign › Blade stuff › **Bone** (the fixture's invented patch, damage −1). The player's At hand: the axe reads "… · d6−1 · All weapons d6 · Damage −1 · Bone, Reed damage". Back to Iron: "d6 · All weapons d6" again.

### M5b — figures tappable everywhere, and repeats on a kit roll (creation rebuild PR J, bq-2, bq-1; 2026-11-04)

Fixture: scripts/fixtures/m5b-creation.fixture.json (fen sample), a Lantern Warden or Mire Stalker in play.

1. iPad landscape, Player screen: tap a skill (Hark). The pop-up gives the odds, then where the number comes from ("Base chance for everyone: …", the kindred's line, "Higher is better: … counts."), then what the setting says the skill does (the pack's text; R3-13), then the setting. Open the full sheet beside it and tap the same skill: the same lines.
2. Tap a save: the first line reads "Save vs … 13 for a Mire Stalker at level 1." and any kindred or class bonus follows on its own line (no "Your number: …" any more).
3. Tap HP: the damage pad opens, as before (no breakdown).
4. New character, Who they are: open Derived fields and tap Attack: a pop-up reads "Attack 19 for a Lantern Warden at level 1."; tap Armour: "Unarmoured: 10" then "Your GM checks it at the table." Got it closes.
5. On the review, Derived fields: each value is a tappable pill opening the same pop-up; the section still has no Change ›.
6. Phone 375 px: steps 1, 4 and 5 again; the pills wrap, nothing runs off the screen.
7. bq-1 (needs a pack whose kit roll is rolled twice and says `"distinct": true`; the fixture has none, so add it to a copy of the fixture's kit roll): tap a row, tap it again: it untaps at once, no message (sq-3, changed by the small follow-ups). Without `distinct` the second tap still gives "Twice ✓✓".
8. `npm run pack:check -- <file>` on a kit roll with `"distinct": "yes"`: one line saying distinct should be true or false.

### M5b — the small follow-ups (sq-1 … sq-4, armour-mode travel speed, "≤N" rows; 2026-11-05)
Fixture: scripts/fixtures/m5b-creation.fixture.json (fen sample) for 5–6; a test campaign whose rules set has a `dungeonExit` with `depth` and `safePaths` for 1–4.
1. **iPad landscape, the depth stepper (sq-1):** GM, an expedition in a turn mode → **Leave the dungeon**: the stepper shows **0** and the line reads "0 levels below the first: no change". Tap **+** once: "1 level below the first: −1" (the pack's per-level value).
2. **Use safe paths (sq-2):** in the same pop-up tap **Use safe paths**: the pack's note shows and the toast says **Left by safe paths** with Undo. Open the Log: one line "<GM> led the party out by safe paths."
3. Tap **Hide safe paths**, then **Use safe paths** again: the note shows, no second toast, still one log line. Tap the toast's **Undo** (or Undo on the log line): the line is undone.
4. A player can't see or use it (the button is the GM's; the log line reads for everyone).
5. **A distinct kit roll (sq-3):** with a copy of the fixture whose kit roll is rolled twice and says `"distinct": true`: tap a row (✓), tap it again: it untaps at once, no toast.
6. **At hand's weapon (sq-4):** Player screen with a reed spear in hand: the At hand row reads "+N · 1d6"; tap it: a pop-up "Reed spear" with one row per part (the class at its level, Melee with the score's modifier, Damage) and **Got it** / **Open Reed spear ›**. Open Reed spear › closes it and opens the item's sheet under the row (Hide from At hand, Give…). A potion or a torch at hand still opens its sheet straight away.
7. **Phone 375 px:** 1, 2 and 6 again: the pop-ups fit, the buttons wrap, nothing runs off the screen.
8. **Armour-mode travel speed:** a campaign carrying by armour worn, a wilderness expedition: a character in light armour shows the armour row's move as their travel speed (no "your GM says"); over the treasure limit it asks the GM.
9. **"≤N" rows:** a table whose row is written `"roll": "≤2"`: Tables › shows the row as "≤2"; typing 1 or 2 lands on it.

### M5b — the knight's liege (creation survey PR 6, cs-3, G-86, G-89, 2026-11-04)
The shared fixture is unchanged (the tests patch a copy); these checks use a test campaign on fae-woodland (0.3.23 or later: its sheet's Liege field `forClasses: ["knight"]`, `from: "knight-liege"`), private pack only.
- [ ] **iPad landscape, a knight:** New character → Guided → any kindred → **Knight** → on Who they are, a group **Liege · roll d8 · it sets your alignment** with the line "The noble house the knight serves…" and one row "Liege — Roll d8 ›". There is no Liege text box lower down.
- [ ] **iPad landscape, picking a house:** pick **Chaotic** first, then tap the Liege row: the table opens ("Knight's liege (the lower houses) · roll d8"). Tap **2 · House Harrowmoor (Lawful)**: the sheet closes, the row reads "House Harrowmoor (Lawful) · Change", the toast says "Alignment: Lawful, your liege's.", and the alignment group shows only **Lawful**, picked, with "A knight's alignment is their liege's: House Harrowmoor (Lawful)." Tap **Undo**: the liege is blank and Chaotic is picked again.
- [ ] **iPad landscape, the review and the sheet:** finish the knight with a house; the review's Who they are lists the Liege; after approval the full sheet shows it.
- [ ] **iPad landscape, a fighter:** the same walk with **Fighter**: no Liege group on Who they are, and the fighter's full sheet and Player screen have no Liege.
- [ ] **iPad landscape, a change of class keeps it:** a knight draft with a house: on the review, Change › on Class → **Fighter** → Who they are has no Liege; Change › on Class → **Knight** again: the house is back.
- [ ] **Phone 375 px:** on Who they are the Liege row with a long house name wraps without sideways scrolling; the row is a 44 px tap; the table sheet scrolls and Done is reachable.
- [ ] **Checker:** `npm run pack:check` on fae-woodland prints no `forClasses` or `knight-liege` line.

### M5b — party and self modifiers (area-2 PR 1, ex-2, ga-3, 2026-11-04)
The shared fixture (`scripts/fixtures/m5b-creation.fixture.json`) now has, on fen-trek's Going astray, "a Reed Witch in the party goes astray in reedbeds only on a 1", and on Cut reeds "+1 for a Reed Witch's own roll". Use a campaign on that fixture with a Reed Witch and a Lantern Warden in the party, the expedition under way in fen-trek.
- [ ] **iPad landscape, GM, the lost chance with her:** tap Move…, pick **Reedbed**: before you move, the sheet reads **"Going astray: 1 on d6 · a Reed Witch in the party"** (not 1–3). Move. Mark lost: the Lost card reads "… finding the way: 1 on d6". Move… and pick **Bog**: "Going astray: 1–2 on d6" with no Reed Witch (her modifier counts only in reedbeds).
- [ ] **iPad, GM, without her:** archive or move the Reed Witch to another group (Split); the first group in a reedbed reads 1–3 on d6 and no Reed Witch line.
- [ ] **Phone (375 px), the Reed Witch's player:** in Reedbed or Sedge, tap **Cut reeds**: the modifiers read "+1 a whole day at it · the rules" and **"+1 for <her name> · a Reed Witch"**. The Lantern Warden's player opening the same sheet sees no Reed Witch line unless she is ticked as acting with them.
- [ ] **pack:check:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json` has no format note about the new modifiers.

### M5b — skill lists and best-of fills (area-2 PR 2, ex-3, ga-4, 2026-11-04)
The shared fixture (`scripts/fixtures/m5b-creation.fixture.json`) now gives the **Mire Stalker** a class skill **Keen ear** ("1-2" at level 1, "1-3" at level 3; the GM rolls it), Hark `fill: { best: ["base", { classSkill: "EAR" }] }`, and fen-trek the activity **Hark for prowlers** (`chance: { skill: ["hark", "EAR"] }`, no cost). The level fill now reaches class skills, as the real packs' does. Use a campaign on that fixture with a Mire Stalker at level 3, a stone kin Mire Stalker at level 1, and a Lantern Warden, in fen-trek.
- [ ] **iPad landscape, the Mire Stalker's player (level 3):** open the full sheet → Skills: **Hark 4+** (not 6+), and Keen ear 1-3 under the class's own. Tap **Hark**: the breakdown reads "Base chance for everyone: 6+", "A Mire Stalker's Keen ear at level 3: 1-3 (4 as Hark rolls it)." · "The better counts: Keen ear, 4."
- [ ] **iPad, the same player, on the Scene:** tap **Hark for prowlers**: the roll line reads "Roll Hark (4+) · Succeeds on 4 or more · 3 in 6 · the better of Hark and Keen ear counts", the same 4+ as the sheet.
- [ ] **iPad, the stone kin Mire Stalker (level 1):** Hark shows 5+; tap it: "Stone kin: 5." and "The better counts: the general chance, 5." (Keen ear's 1-2 is also 2 in 6: on a tie the general chance counts).
- [ ] **Phone (375 px), the Lantern Warden's player:** Hark for prowlers reads "Roll Hark (6+) · Succeeds on 6 or more · 1 in 6", with no "better of"; the line wraps without sideways scrolling.
- [ ] **pack:check:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json` has no note about `chance.skill`; in a copy, change it to `[]` and it says "chance.skill names a skill … or a list of them".

### M5b — day-food from a bundle (area-2 PR 6, G-108, ga-5, 2026-11-04)
The shared fixture (`scripts/fixtures/m5b-creation.fixture.json`) now has **Fen rations (1 week)** (a bundle of 7, each a "Ration day") and, in fen-trek's bogs, **Dig bog roots** (1 point, `yields: { item: "fen-rations-week", units: "1d3" }`). Use a campaign on that fixture, the expedition under way in fen-trek, the group in a **Bog**.
- [ ] **iPad landscape, a player:** tap **Dig bog roots**: the sheet shows the cost and a count (start 1). Tap + twice (3), then **Done**: the toast reads "Dig bog roots · 1 point · **3 Ration day (Fen rations (1 week))** → <name>'s pack". Open the Pack tab: a **Ration day** line with **3**, weighing 3 days' share of the week, not 3 weeks. The log reads "… did Dig bog roots … · 3 Ration day → <name>'s pack".
- [ ] **iPad, the same player:** tap **Undo** on the toast: the line leaves the pack and the point comes back. Dig again, eat one day in camp (the line drops to 2), then try Undo from the log: it says the find has been used and leaves it.
- [ ] **Phone (375 px):** the same sheet fits without sideways scrolling; the toast's words wrap.
- [ ] **pack:check:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json` has no format note about yields; change Dig bog roots' `units` to `0` in a copy and it says "yields.units should be dice like "1d3" or a whole number of 1 or more…".

### M5b — bonuses and traits (creation survey PR 5, cs-7, 2026-11-04)
The shared fixture is unchanged; these checks use the test campaigns on the real settings (fae-woodland 0.3.21 or later, classic-advanced), private packs only.
- [ ] **iPad landscape, fae-woodland, a thistlekin unarmoured:** New character → Guided → **Thistlekin** → any class → on Who they are, Derived fields' AC reads higher than with another kindred, and its parts say "unarmoured, DEX …, Thistlekin +N". After approval, the full sheet's **AC** tile: tap it: the pop-up lists "Thistlekin, unarmoured or Light armour: +N".
- [ ] **iPad landscape, the same thistlekin in heavy armour:** equip a heavy armour (chain or plate) in the Pack, open the full sheet, tap AC: the pop-up reads "Thistlekin: +N only when unarmoured or Light armour, not now", and the number has no +N. Equip a light armour: the +N is back.
- [ ] **iPad landscape, fae-woodland, the friar:** a friar at level 1: AC's pop-up lists "Friar at level 1: +N"; set the friar to a higher level (GM): the larger bonus the pack gives.
- [ ] **iPad landscape, fae-woodland, the burrowkin:** a burrowkin (or the burrowkin kindred-class): on the full sheet and the Player screen each save reads its number with "(+N to the roll vs <a named hazard>; +N to the roll otherwise)"; tap a save: the last line names the burrowkin (or the class) and says the same.
- [ ] **iPad landscape, the Traits section:** the full sheet has **Traits** after Abilities: one row per kindred trait, then per class trait (a thistlekin friar: Fur, Horns, …, then Armour of faith, …). Tap **Horns**: the entry says what it does, "From · Your kindred · Thistlekin", and the source page; a later trait (Gaze) says "When · From level 4"; the friar's Poverty says "Kind · A drawback". **Got it** closes it.
- [ ] **iPad landscape, classic-advanced, a dwarf:** the CON-based save bonus still shows beside the saves as before; the Traits section lists the dwarf's and the class's traits.
- [ ] **Phone 375 px:** the Traits rows and a long AC pop-up line ("… the setting doesn't say how heavy … is, so it isn't counted") wrap without sideways scrolling; every row is a 44 px tap.
- [ ] **Checker:** `npm run pack:check` on fae-woodland and classic-advanced prints no `acBonus` or `saveBonus` line.

### M5b — kits, languages and bundles (creation survey PR 4, cs-6, rc-2, rc-3, si-2, 2026-11-04)
The shared fixture is unchanged; these checks use the test campaigns on the real settings (fae-woodland 0.3.21 or later, classic-advanced with the zine overlay), private packs only.
- [ ] **iPad landscape, fae-woodland, a Small kindred's kit:** New character → Guided → a **Small** kindred → the class whose kit rolls a longbow → Gear: tap its kit; on the Weapons roll that row reads **Shortbow**, not Longbow. With a Medium kindred the same row reads Longbow.
- [ ] **iPad landscape, fae-woodland, the armour substitute:** the Small kindred with armour substitutes, and a class whose kit rolls chainmail: the armour row reads the kindred's substitute armour; take it: the Pack holds that, worn.
- [ ] **iPad landscape, fae-woodland, a choice:** the class whose kit has an instrument: take the kit; under it **Choose one · … stringed or … wind**, the stringed one ticked; tap the wind one: the Pack swaps them; tap the ticked one: "Tap another to change it."
- [ ] **iPad landscape, si-2:** a kit that rolls a weapon the class can't use (a weapon outside the class's list, or one the kindred can't wield): after the take, the toast and the kit row read "<weapon> · your class can't use it · carried"; in the Pack it isn't held.
- [ ] **iPad landscape, fae-woodland, languages:** a high-INT **mortal** kindred: Languages shows "roll d6 or choose" and rows with their ranges first ("1 · …", "2–3 · …"); the fairies-only language isn't offered and a line says one language is left out; the soft fairy language reads "Usually learnt only by fairy kinds · Needs the GM's special approval"; pick it, Next: the review (and the GM's approval card) list "<language>: Needs the GM's special approval". A **fairy** kindred sees the fairies-only language, and the soft one without the flag.
- [ ] **iPad landscape, classic-advanced + zine overlay:** Languages lists the base's languages with their d20 ranges and the overlay's own at the end; the common tongue is still given.
- [ ] **iPad landscape, zine overlay, part-bundles and dice units:** with the quick-equipment option on, a quick kit shows **Roll 1d6 · Torches** (and rations) under it once picked; tap 4: the kit is taken and the Pack holds 4 torches; the crossbow row gives 20 bolts, not a whole stack of stacks.
- [ ] **iPad landscape, zine overlay, a background with coins and a one-off:** the background giving 50: after the pick the toast says "… 50 added to your starting money."; the review's money line reads "… · 50 gp from your picks" and what's left counts it. The wizard's apprentice background puts a **Spell book** (a one-off) in the Pack at once (bq3-6: nothing on the GM's Waiting for you).
- [ ] **iPad landscape, fae-woodland, a given pick (option buy-equipment off):** once the pack session marks the adventuring-items table shared, Gear shows **Pick up to 4 · Starting adventuring items · 0 of 4 picked · roll d20 or choose**; tap four rows: each goes into the Pack; a fifth says "4 of 4 picked · unpick one first."; tap one again: it comes back out. Until then `pack:check` names the table.
- [ ] **Phone 375 px:** the Choose one and Roll groups, the given pick's rows and a long "· your class can't use it · carried" line wrap without sideways scrolling; every Pick button stays tappable.
- [ ] **Checker:** `npm run pack:check` on fae-woodland names the pick table that isn't shared; on the zine overlay it notes the two "Spell book" one-offs and no longer flags the base's language ids.

### M5b — a background's spell roll and checker notes (survey follow-ups, bq3-18, bq3-19, 2026-11-04)
Classic-advanced with the zine overlay and its level-0 option on (the backgrounds by hit points), private packs only. The app never rolls: roll a d12 at the table.
- [ ] **iPad landscape, the roll under the pick:** New character → Guided → walk to the backgrounds step for 1 hit point → tap **Pick** on the wizard's apprentice. Under the row: **From <the background> · roll d12 for one cantrip** · at the table, then tap what it shows, a **What you rolled** box, then twelve rows "1 · …" to "12 · …". Tap **Next** before rolling: the toast says "Roll d12 at the table for your cantrip, then tap it." and the step stays.
- [ ] **iPad landscape, tapped or typed:** type **14** in What you rolled: "No row has 14." Type **10**: the line names the 10th cantrip and its row says **Picked ✓**; the group's line says "1 of 1 tapped". Tap the name of another row: its spell opens beside the list (range, duration, rules); its Pick button picks that one instead.
- [ ] **iPad landscape, another pick:** tap **Pick** on a background without a roll: the roll group goes; pick the apprentice again: the roll is blank again. Roll, tap **Next**: the step saves and moves on.
- [ ] **iPad landscape, the review:** the backgrounds section shows the background, then "<the cantrip> · cantrip, rolled 10 on d12". (A background picked without its roll, which only the scripted tests reach, reads "Cantrip not rolled yet" in bold and stops Send at that step.)
- [ ] **iPad landscape, the sheet:** after the GM approves, the full sheet's Background reads "<the background> · <the cantrip> · cantrip, rolled 10 on d12"; tap the background: its entry shows **Rolled** with the same words. The hermit does the same.
- [ ] **iPad landscape, a race or class change:** from the review, Change › on Class to another class: the background is cleared (as before) and so is its roll.
- [ ] **Phone 375 px:** the roll group, the What you rolled box and twelve rows wrap without sideways scrolling; every Pick is a 44 px tap; the spell opens as a sheet over the list.
- [ ] **Checker:** `npm run pack:check` on the zine overlay no longer says "spells.roll isn't read"; a table with an `option` (one choice or a list) gets no "option is the old way" line; a background with `money` as dice is noted ("the entry's pop-up says to roll it at the table and the GM adds it"; neither real pack has one).

### M5b — one-offs from creation come in approved (bq3-6, `m5b-0c-one-offs`, 2026-11-04)
In a test campaign using `scripts/fixtures/m5b-creation.fixture.json`, with **One-off items need approval** left On (the default) and **Characters need approval** On.
- [ ] **iPad landscape, the trinket:** as a player, New character → Guided → Stone kin → Lantern Warden → Gear: roll the trinket (type 11): "A pebble that is always warm" is in the pack with no "Sent to the GM for approval" and no "1 item waiting for the GM" line. Send the character. As the GM, **Waiting for you** lists the character only, not the pebble; approve the character: the pebble is in its Pack, counted in the load.
- [ ] **iPad landscape, a kit's one-off:** a Bog folk Lantern Warden takes the warden's kit: its line by name (the one-off) is in the pack at once, like the trinket; nothing for it on Waiting for you.
- [ ] **iPad landscape, an approved character, unchanged:** on an approved character's Pack, Add item → Not listed? → a one-off: "Sent to the GM for approval" as before, and the GM's Waiting for you shows it.
- [ ] **Phone 375 px, sent back:** the GM sends a new character back; the player adds a one-off from Gear (a trinket change, or Add item on the draft's pack where the app offers it): it's in the pack at once; re-send; the GM approves: it stays.
- [ ] **Another player:** player B can't see player A's draft or add to it (unchanged); the database refuses an item on another's character.

### M5b — names, trinket and Details (creation survey PR 3, cs-1, 2026-11-04)
In a test campaign using `scripts/fixtures/m5b-creation.fixture.json` (tables included): **Stone kin** carry a name table, a trinket table (d30), two detail tables, a growth and age, height and weight dice; **Bog folk** carry none.
- [ ] **iPad landscape, the Name roll:** New character → Guided → Stone kin → Lantern Warden → Who they are: under Name, **Roll a name · stone kin ›**; tap it: "Stone kin names · roll d6" with two groups, First name and Surname; tap **Bramble** and **Mudfoot**: the Name box reads "Bramble Mudfoot"; **Clear** puts back what you had typed; **Done** closes. With Bog folk there is no Roll a name.
- [ ] **iPad landscape, the trinket:** on Gear, a **Trinket · stone kin · roll d30** group; tap **Roll d30 ›**: type **11** in "What you rolled": the line reads "11 · A pebble that is always warm" and a toast says it's in the pack; **Done**: the row reads "A pebble that is always warm · rolled 11" with **Change**. Change → tap another row: the Pack holds one trinket, the new one; **Undo** on the toast brings the pebble back. Next never asks for the trinket.
- [ ] **iPad landscape, Details left untouched** (rewritten 2026-11-13 for cs-11: "Skip, leave blank" is gone, and Next on an untouched step saves the averages, flagged): after the background step, **Details** opens with no "Skip, leave blank". Age, Height and Weight each read "Average." with their dice and glyph above the box, and the unit (years, lb) once, beside the box. Tap **Next** without touching anything: the review lists age, height and weight, each "the average, not rolled", and **Send to the GM** works. (The step's other words are in `docs/testing/dec-10-d-who-details.md`.)
- [ ] **iPad landscape, Details filled:** instead, tap Looks → tap a row: the table closes and the row shows it with Change; open Age · Height · Weight: each box says the dice ("Roll 3d6 × 10 years"); type an age; the hint counts "N of 6 filled in"; Next: the review lists them; **Change ›** on Details reopens the step with them (no Skip there, Done comes back).
- [ ] **iPad landscape, Bog folk:** a Bog folk character goes from the last step straight to the review (no Details step, no trinket).
- [ ] **iPad landscape, the sheet:** once the GM approves it, the full sheet's **Details** block lists the looks and the age, with **Change details ›**: change one, Done: "Details saved." and the new one shows. **Edit** has Roll a name under the Name box too.
- [ ] **Phone 375 px:** the Details rows wrap (a long trinket wraps under its label, Change stays tappable); the table sheet's rows and the "What you rolled" box fit without sideways scrolling.
- [ ] **Both real settings, after the pack session's update:** a fae-woodland duskcat gets Roll a name (first name · surname), its d100 trinket (type the number), eight detail tables (four shown, "4 more ›"); a burrowkin's growth shows on Details, other kindreds' don't.
- [ ] **Checker:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json` lists "races with creation tables: 1" and no `tables.` notes.

### M5b — kindred-classes and kindred grants (creation survey PR 2, cs-2, cs-4, 2026-11-04)
- [ ] **iPad landscape, fae-woodland, kindred-classes on:** in the fae-woodland test campaign (Rules for this campaign → Kindred-classes: On), New character → Guided → Kindred: **Elf** → Class: the **Elf** kindred-class row reads "… · replaces your kindred’s traits"; no other kindred's class is listed, open or under "Not open to elf".
- [ ] **iPad landscape, the same, another kindred:** Back → Kindred: **Human** → Class: no kindred-class at all (not even under "Not open to human"). Back → **Elf** → pick the Elf class → Back → **Burrowkin**: the Elf class is unpicked; Undo on the toast puts Elf and the Elf class back.
- [ ] **iPad landscape, an elf fighter:** Elf → Fighter → Who they are → Next: the step is called **Magic**, with one group "From your kindred · roll d20 · Random glamour"; tap the row you rolled; Next.
- [ ] **iPad landscape, an elf enchanter:** Elf → Enchanter: **Magic** shows "From your class · roll …" groups first, then "From your kindred · roll d20 · Random glamour"; the same glamour can be tapped on both (it says "already yours · roll again" on the second).
- [ ] **iPad landscape, the Elf kindred-class:** Elf → the Elf class: **Magic** shows its own rolls only (no "From your kindred" group): the kindred's glamour is part of the traits the class replaces.
- [ ] **iPad landscape, a gloamwight's item:** Gloamwight → any class → Gear: the **Given** group has the kindred's instrument with "from your kindred"; tap it: "… comes with your kindred: it stays in the pack." After Next, the Pack holds it.
- [ ] **iPad landscape, Change › reopens Kindred:** finish an Elf (kindred-class) to the review → Change › beside the class → pick **Fighter** → Next: the **Kindred** step opens with Elf picked and the toast "Fighter picked · your kindred’s own traits are back: check your kindred, then Next." Next → Class → Next: back on the review with Elf Fighter.
- [ ] **iPad landscape, classic-advanced, Human:** a Human on the Advanced path: the Class step lists no race-class (Dwarf, Elf, …), open or folded. On the Basic path, the Dwarf class: the review and the sheet show the race as Dwarf, and the sheet's saves are the class's only (no race save bonus added).
- [ ] **Phone 375 px:** the Magic step's group headings ("From your kindred · roll d20 · Random glamour") wrap without cutting; the Gear row with "from your kindred" wraps.
- [ ] **Checker:** `npm run pack:check -- <the fae-woodland pack file>` says nothing about races' `firstSpells` or `startingItems`.

### M5b — fewer links PR 1: the small button, the Encounter waiting card, the Watches step (fl-1 … fl-3, 2026-11-03)
GM on an iPad, two players on an iPad and an iPhone, the `m5b-creation` fixture pack (Fen trek: watches of 2 hours, no daylight table). Make camp first.
1. [ ] **iPad landscape, player, the boxes:** the Camp card's Set watches step shows one box, "1st watch", "No one yet" and **+ Add**; under it "Not on watch: <everyone>". Your own line reads "<name> · not on watch".
2. [ ] **+ Add:** tap + Add: a pop-up "Add to the 1st watch" lists everyone free, in marching order; tap your character: the pop-up closes, the toast reads "Watches: 1st <name>" with Undo, the name is a chip with ✕ in the 1st watch, a 2nd watch box appears, and your line reads "· your watch: 1st". The other player's screen shows the same.
3. [ ] **Three at most:** put three on one watch: its + Add goes away. ✕ on one of them: they leave that watch (toast with Undo) and + Add comes back.
4. [ ] **Watches move up:** with people on the 1st and 2nd, ✕ everyone on the 1st: the 2nd's names move up to the 1st (see the plan's Departures, scope check 4).
5. [ ] **Casters:** put a caster on a watch: "Casters on watch: <name>" under the boxes.
6. [ ] **Split evenly** (needs a pack with a daylight table, e.g. classic-advanced's wilderness camp, or the gallery): **Split evenly** with "N characters → M watches, in marching order"; tap it: every watch filled from the front of the marching order, the first ones taking the extra, a caster not on the last watch when someone else can take it; Undo in the toast. Each box shows its time ("19:00–21:00").
6b. [ ] **How many watches tonight?** (bq3-4 C; the Fen trek, no daylight table): over Split evenly, "How many watches tonight?" with − N +, starting at 3 (or the watches already set; with 2 characters, 2). Tap + past the number of characters: it stays at that number and a pop-up says "At most N watches: each watch needs someone on it, and there are N characters."; tap − below a third of them (rounded up): "At least M watches: up to 3 on each, for N characters." Neither button greys out. Tap Split evenly: the characters spread over that many watches, in marching order, with Undo.
7. [ ] **iPad landscape, GM, the Encounter waiting card:** Next day; a hit on Night prowlers, read a row: the card's **Which watch?** shows chips "1st · <names>", "2nd · <names>"; tap one: "Awake: 2nd watch · <names>", with Undo. **Start** is an outlined button (Next turn is the screen's accent), **View** and **Dismiss** smaller outlined buttons, not underlined. View: the details read "Awake: 2nd watch · <names>" (no doubled "watch"). Dismiss: the card goes, with Undo.
8. [ ] **iPhone 375 px:** the boxes stack one per row; a long name wraps inside its chip; + Add and the chips wrap; nothing scrolls sideways. iPad: the boxes sit two by two.
9. [ ] **Dark mode:** the boxes, chips and small buttons readable.
10. [ ] **Gallery:** `/gallery.html` (and `?theme=dark`), Wilderness: the first waiting card's Start is the accent (full width on a phone), View and Dismiss small; Which watch? chips (a long one wraps); the Watches step with five boxes (times from 19:00), a full 2nd watch with no + Add, "No one yet · fill the 3rd first" on the 4th and 5th, Split evenly, "Not on watch: Ash", "Casters on watch: Wick".

### M5b — prime XP reads the packs' shape (bug fix, rc-1, 2026-11-03)
- [ ] **iPad landscape, the fixture pack, a penalty:** in a campaign using `scripts/fixtures/m5b-creation.fixture.json`, New character → Scores: MUS 7, the rest 9 → Class: the **Lantern Warden** row reads "Prime MUS 7 · −10% XP · d8 hp · …"; tap it: the pop-up's Prime requisite reads "MUS · −10% XP with your scores".
- [ ] **iPad landscape, the fixture pack, bonuses:** back to Scores, MUS 13: the row reads "+5% XP"; MUS 15: "+10% XP"; MUS 9: "0% XP". The **Reed Witch** (rules thresholds) with LORE 12: "+5% XP"; LORE 15: "+10% XP".
- [ ] **iPad landscape, both real settings:** with classic-advanced, a class with one prime: prime 7 shows "−10% XP", 13 "+5% XP"; a class with two primes and thresholds: both at 13 or more shows a bonus. With fae-woodland, a class with two primes, one at 6 and one at 15: the XP line follows the **lower** one only once the pack writes `primeRequisiteRule: "lowest"` (today it carries words; see the status report).
- [ ] **Phone 375 px:** the Class row with "−10% XP" wraps without cutting the line.
- [ ] **Checker:** `npm run pack:check -- <the fae-woodland pack file>` lists "primeRequisiteRule should be \"lowest\""; classic-advanced lists no prime XP line.

### M5b — pack review area 2 fixes (2026-11-03; `docs/plans/m5b-review-area-2.md`)
- [ ] **iPad landscape, GM, the next table by its cell:** in a test campaign with the invented pack `scripts/fixtures/m5b-review-area-2.fixture.json` imported and attached, open the GM reference → Tables → **Wild kinds**: on the **Road** column, row 1–3 reads "B-Animal" and leads to **Wild animals**; on the **Wild** column, row 1–3 reads "C-Flyer*" and leads to **Wild flyers**; row 4–6 on Road ("D-Swimmer") leads nowhere.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-review-area-2.fixture.json`: four Format notes, one each for `onHit.columns` ("Marsh"), `encounterColumn` ("Reeds"), `nextTablePattern` ("wild-D-Swimmer") and movement as the number 30 (text preferred); nothing under "Left out"; the command ends without an error.

### M5b — a row's next table by terrain (area-2 PR 4, ga-2, 2026-11-04)

With the invented pack `scripts/fixtures/m5b-creation.fixture.json` imported and attached (its Fen trek mode; Fen prowlers' row 6 "Fen folk" reads `next: { byTerrain: { reedbed: "reed-folk" }, default: "meadow-folk" }`). iPad landscape first, then a phone at 375 px, light and dark.
- [ ] **iPad, GM, in a reedbed:** start an expedition in Fen trek and Move… into **Reedbed**. Tap **Encounter tables ›** → **Fen prowlers**: row 6 reads "Fen folk · opens Reed folk ›". Tap it: the toast with Undo; the header reads "Fen prowlers › Reed folk"; at the top two chips, **Reed folk** (pressed) and **Meadow folk**.
- [ ] Tap **Meadow folk**: the header reads "Fen prowlers › Meadow folk" and its rows show (Hedge pedlars…). Back ‹ goes to Fen prowlers, not to Reed folk.
- [ ] **Elsewhere:** Move… into **Sedge meadow**, open Fen prowlers again: row 6 reads "opens Meadow folk ›" and opens Meadow folk, Reed folk a chip away.
- [ ] **Reading:** Tables › → Fen prowlers (and the GM reference → Tables → Fen prowlers): below the rows both Reed folk and Meadow folk are listed; nothing is recorded.
- [ ] **Phone, 375 px:** the two chips sit on one line or wrap, no sideways scrolling.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json`: no note about `next`. Change "meadow-folk" in row 6 to "moor-folk" in a copy and check the copy: a Format note says `next.default names "moor-folk", which isn't a table in this pack`.

### M5b — slot bands (area-2 PR 3, ga-1, sr-9, 2026-11-04; `docs/plans/m5b-area-2-app.md` build order 3)
With the invented pack `scripts/fixtures/m5b-creation.fixture.json` imported and attached, the campaign's Carrying set to slots and, in Rules for this campaign, **Two-band slots › On** (its bands: on the body up to 2 slots 120 ft, up to 4 60 ft; in the bags up to 4 120 ft, up to 6 90 ft, up to 8 30 ft). iPad first, then a phone at 375 px, light and dark.
- [ ] **iPad, player, an empty pack:** the Pack tab's load reads **Speed 120**, then two short bars: "On the body 0 of 4 slots · speed 120" and "In the bags 0 of 8 slots · speed 120"; neither says "sets your speed".
- [ ] **The bags set it:** add five things that aren't worn or in hand (Rope of reeds, Dry rations…, 1 slot each): "In the bags 5 of 8 slots · speed 90 · sets your speed" (in bold ink, not only colour); the top reads **Speed 90** in the warning colour.
- [ ] **The body sets it:** put three things In hand or worn: "On the body 3 of 4 slots · speed 60 · sets your speed"; the top reads **Speed 60**.
- [ ] **Over:** put a fifth thing on the body: that bar's cell past the end is in the warning colour and its line ends "· Can't move"; the top reads **Can't move**.
- [ ] **The lists:** tap the top words: both bands' lists ("up to 4 slots · speed 60 ft", …), then "The slower of the two sets your speed." and the setting's name; tap again to close.
- [ ] **Travel agrees (iPad, GM):** start an expedition in Fen trek: the travel card's breakdown says "Slowest: <name> (speed N)" with the same N as that character's Pack tab. On a player's iPad the card shows the GM's number; the player's own breakdown knows only their own characters' speeds (others' packs are hidden).
- [ ] **The sheet agrees** (once sheet PR 1, #410, is in): the full sheet's Movement shows the same speed, its breakdown naming the band ("from On the body 3 / 4 (your load)").
- [ ] **One list still works:** Two-band slots › Off: one row of cells, "Nimble" / "Burdened" as before.
- [ ] **375 px (iPhone):** the two band lines wrap inside the width; the cells wrap; no sideways scroll.

### M5b — options run by hand (area-2 PR 5, ex-7, 2026-11-04; `docs/plans/m5b-area-2-app.md` build order 5)
With the invented pack `scripts/fixtures/m5b-area-2-manual.fixture.json` imported into your library (**Reed winds** and **Mire sickness** are marked `manual`, **Lantern oil** isn't). iPad first, then a phone at 375 px, light and dark.
- [ ] **iPad landscape, GM, campaign set-up:** + Start a new campaign → name it → pick **Invented by-hand options** → Next. Its group is open: **Reed winds** and **Mire sickness** each show the line "Run by hand · the app doesn't apply this yet" under their source; **Lantern oil** doesn't.
- [ ] **iPad landscape, the rules one tap away:** tap that line on **Reed winds**: a pop-up titled Reed winds opens with "Run by hand · the app doesn't apply this yet. Play it as its rules say; your choice is saved.", what it does, and each choice with its words (Off, On). Close it. On **Mire sickness** (four choices, a ▾ button) the line opens the same kind of pop-up.
- [ ] **iPad landscape, the choice is saved:** set Reed winds to **On** and Mire sickness to **Chills after wading**, then **Create campaign**. Open the campaign → **Rules** → Optional rules · Invented by-hand options: both still show the line, Reed winds reads On and Mire sickness Chills after wading, each "changed (the book: …)".
- [ ] **iPad landscape, Rules in play:** tap Reed winds **Off**: it changes at once with Undo, like any rule; tap the line: the pop-up opens as in set-up.
- [ ] **Phone 375 px:** the line wraps under the source without sideways scrolling, in the accent colour and underlined, and is a 44 px tap apart from the row's control.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-area-2-manual.fixture.json`: a section "Run by hand, the app doesn't apply these yet (2):" listing Reed winds (fen-reed-winds) and Mire sickness (fen-mire-sickness); no Format notes, nothing under "Left out". On the real settings' packs, the same section lists every option they mark `manual`.

### M5b — the town switches and `onlyWhen` (step 6.0, 2026-11-03; sw-1 … sw-4)

With fae-woodland (its settlement mode: the town-day check reads `outDay`, the town-night check `activeNight`). iPad first, then a phone at 375 px, light and dark.
- [ ] GM, Scene: start an expedition in the settlement mode. The time strip's ⋯ has **Out and about today: Off** and **Active tonight: Off**; in a dungeon (turn) mode neither shows.
- [ ] Tap **Out and about today: Off**: a toast "Out and about today: On" with Undo; under the strip's title a quiet line "Out and about today". Undo: the line goes.
- [ ] With Out and about off, the mode's step (Next day): the town-day check isn't on the card. Turn it on, step again: it is (Hit / Miss), and the strip's line goes, the card says "Out and about ended · morning", and the log has the same line.
- [ ] ~~Turn on Active tonight, then End expedition: the switches are off; the log's End expedition line ends "Active tonight ended · downtime."; Undo on the summary brings the expedition and the switch back.~~ (M5b step 6a: the reset moved to Start downtime; see *time in town*)
- [ ] A player's Scene, while a switch is on: the same quiet line under the time; nothing about the checks; no switches in their view.
- [ ] Both on at a 375 px phone: "Out and about today · Active tonight" wraps without sideways scrolling.
- [ ] `npm run pack:check -- <a pack with onlyWhen "rainy">` warns that it isn't one of outDay, activeNight.

### M5b — time in town, End expedition, Start and End downtime (step 6a, 2026-11-03; dt-2, ST1, ST10, ST11)

With fae-woodland (its settlement mode steps a part of the day). iPad landscape first, then a phone at 375 px, light and dark.
- [ ] **iPad, GM, Scene:** pick the settlement mode, Start expedition (with the clock in the morning, 06:00–14:00): the strip's title reads "Settlement · morning" (the mode's own name) and the main button reads **Next part of day**. Tap it three times: afternoon, night, morning; the date moves on a day at the last one. The log (Simple) has three lines "… moved on to the next part of the day (8 hours)."
- [ ] **End expedition** (⋯; under it: "The party stays where it is; downtime is its own step"): the summary with Undo; the title stays "Settlement · <part>"; no +1 day buttons. Tap Undo on the summary: the expedition is back. End it again, close the summary: **Next part of day**, Undo, the mode buttons, Where? and **Start expedition**. Next part of day moves the part on (a toast "Afternoon" with Undo); no card comes (nothing in the procedure runs between expeditions).
- [ ] **Start downtime** (⋯, only in town; not offered during an expedition): the title reads "Downtime"; a "Downtime began" panel with Undo, "Full rest: rest and day abilities are back.", the setting's healing rule and **Heal** for every character in play (also one who stayed home). +1 day, +1 week and To day… are back. The log has one line "… started downtime with a full rest (N characters got abilities back)." On a player's phone, a secret check's line from the expedition now shows in the log.
- [ ] Tap **Undo** on the "Downtime began" panel: back in town ("Settlement · <part>"), abilities used again as before.
- [ ] **End downtime** (⋯, only in Downtime; under it: "Back to adventure time; the party stays where it is"): a toast "Downtime ended · back to adventure time" with Undo; the strip is in town again.
- [ ] **Out and about** left on in town: Next part of day from night to morning turns it off ("Out and about ended · morning"); afternoon to night doesn't.
- [ ] **Phone 375 px:** in town, Next part of day, Undo and the reminder button wrap without sideways scrolling; the ⋯ items' lines under Start downtime and End downtime wrap.
- [ ] **classic-advanced** (no settlement mode): End expedition from a dungeon: the title reads the mode's name ("Dungeon"), the main button its step (Next turn), and Start downtime works the same.

### M5b — Safe and Hostile, the arrival card (step 6b, 2026-11-04; ST2 as replaced by dt-9)

With fae-woodland (any mode works; places are typed). iPad landscape first, then a phone at 375 px, light and dark.
- [ ] **iPad, GM, Scene:** Start expedition with Where? "Brackenford" (any town name). On its place card, below Where now?, a **Safe or hostile** row: Neither (pressed) · Safe · Hostile, and the line "Mark a town or a haven Safe: arriving there offers to end the expedition." Tap **Safe**: a toast "Brackenford is safe" with Undo; the line reads "Arriving here offers to end the expedition." No card comes (setting out isn't coming back).
- [ ] **Where now?** "The Old Mill", then **Where now?** "Brackenford": a quiet card under the strip: "The party is back in a safe place." · **End expedition** (the accent) · **Not now**; the strip's main button (Next part of day, or Next turn) is a plain button while the card is up.
- [ ] Tap **Not now**: the card goes and stays away when the clock moves; reload the page: still away. Go to the Old Mill and back again: the card comes back.
- [ ] Tap the card's **End expedition**: the strip's own "Expedition ended" summary with Undo and Full rest, and under it "Staying a while?" · **Start downtime** · **Not yet** (no accent). Tap **Undo**: the expedition and the card are back. End it again, tap **Not yet**: the question goes, the party is in town (Start expedition is offered). Do it once more and tap **Start downtime**: "Downtime began" with its full rest (6a).
- [ ] **Hostile:** mark a place Hostile, go away and come back: no card; its line reads "Arriving here offers nothing: the expedition goes on."
- [ ] **Move…** (a travel mode): mark the destination town Safe first (on a visit, or after the arrival with a second arrival), then Move… to it with its name in the place box: the card comes on arrival.
- [ ] **Players (a phone signed in as a player):** nothing changes on their Scene at any of these steps: no card, no Safe or hostile row.
- [ ] **Phone 375 px, GM:** the three Safe or hostile buttons sit on one line; the card's two buttons and the summary's Start downtime · Not yet wrap without sideways scrolling.
- [ ] **Log (GM, Verbose):** "… marked Brackenford safe."; Undo from the log puts it back to Neither.

### M5b — the town shown before its places (2026-11-04; review finding 2, ruled B; `m5b-6c-town-shown`)

Follows the town screen's set-up below (fae-woodland, Player B's character approved). iPad landscape first, then a phone at 375 px.
- [ ] **iPad, GM, Scene:** Start expedition with Where? "Brackenford" (no description). Tap **Safe**. Tap the eye on **Buy equipment**: a red toast "Players see Brackenford once a piece of it is shown: add a Description to the place first."; the eye stays unpressed; the count stays "0 of N"; nothing in the log.
- [ ] **+ Piece › Description** on the card ("Mud streets and a lantern-lit quay."), hidden. Tap the eye on **Buy equipment**: toast **"Shown: Brackenford and Buy equipment"** with Undo; the description piece's eye is pressed too; the count reads 1 of N.
- [ ] **Player B, Scene:** the place line "Brackenford" with the description, and under it "Places in town" with **Buy equipment**. Back on the GM, **Undo** on the toast: the description is hidden again and the count reads 0 of N; Player B's place line and Places in town both go.
- [ ] Show the description from its own eye first, then a shop: the toast reads "Shown to players: <shop>" (the town was already shown).
- [ ] **Log (GM, Verbose):** "… showed players Brackenford and Buy equipment." for the joint line; Undo from the log hides both.
- [ ] **After End expedition** (the town screen on its own): the same, with the last visit's pieces.
- [ ] **Phone 375 px:** the red toast wraps on three lines without hiding the eye; nothing scrolls sideways.

### M5b — the town screen (step 6c, 2026-11-04; ST3, ST12, bq3-1)

With fae-woodland (`packs/_current`, its `settlement.services`) and a second campaign on classic-advanced. Player B's character approved. iPad landscape first, then a phone at 375 px, light and dark.
- [ ] **iPad, GM, Scene:** Start expedition with Where? "Brackenford". The place card has no town sections. Tap **Safe** in Safe or hostile: under it **Places in town** with "0 of N shown to players", **Shops** (Buy equipment · "Shop · sells", Sell used equipment · "Shop · buys at 50% of the price", …) and **Others** (Safe storage and the loan service), each row with the eye and **Open · Closed**; **Things to do** (Change money, ›: its rule opens on a tap); **Encounters** (the settlement mode's town-day and town-night checks with "only while …", and the two switches Off · On). At the foot: "People and rumours come with an adventure's town."
- [ ] Tap the eye on **Buy equipment**: toast "Shown to players: Buy equipment" with Undo; the eye looks pressed; the count reads 1 of N. Tap **Closed** on it: toast "Buy equipment: Closed".
- [ ] **Player B (phone or second tab), Scene:** under the place, "Places in town" with **Buy equipment** · "Shop · sells · Closed", and nothing else from the town (no hidden service, no Encounters, no eye). Back on the GM, Undo the last show: Player B's list empties (or loses that line) within a moment.
- [ ] Turn **Out and about today** On in Encounters: the strip's marker line says "Out and about today" (the same switch as the strip's ⋯); Undo on its toast.
- [ ] **End expedition** (strip ⋯), Not yet: the place card goes, and the town screen stands on its own with "Brackenford" on top, "Safe", the same rows and "They come due only during an expedition." under Encounters. Player B still sees the shown places, with "Brackenford" on top. **Start downtime**: still there (the switches go, Downtime has none).
- [ ] Set the place back to **Neither** (during the next expedition at Brackenford): the town sections go, and Player B's list goes.
- [ ] **classic-advanced:** start an expedition at a typed town, mark it **Safe**: the town screen shows (Black market under Shops; Healing and Rumours under Things to do); no Encounters section when its mode has no checks.
- [ ] **Phone 375 px, GM:** the place card opens as a sheet (wilderness day) or sits in the page; in Places in town each name and its line sit on top and the eye and Open · Closed wrap under it; nothing scrolls sideways. A long service name wraps.
- [ ] **Log (GM, Verbose):** "… showed players Buy equipment in Brackenford.", "… closed Buy equipment in Brackenford."; Undo from the log works.

### M5b — fresh-session review fixes (2026-11-04; `fix-review-2026-11-04`; hard rule 5, bq3-6)

A homebrew overlay with an option, one item patch and one stat-block patch (write a small file: `options`, `items`, `statBlocks`, `patches: [{ byOption, match: { kind: "item", … } }, { byOption, match: { kind: "statBlock", ids: [...] } }]`), attached to a campaign with Player B's character approved. iPad first.
- [ ] **`npm run pack:check -- <file>`:** one note on the stat-block patch: `match.kind "statBlock" isn’t a kind players read, so this patch reaches only the GM.`; none on the item patch.
- [ ] **GM, Library:** the pack lists both patches ("<option>=<choice> · item …" and "… · statBlock <id>").
- [ ] **Player B, Library:** the item patch is there; nothing names the stat-block patch or its monster's id.
- [ ] **GM:** import the file again as a new version with both deltas changed. **Player B's log:** the pack line names the item patch under changed, not the stat-block patch; **the GM's log** line (gm) names the stat-block patch.
- [ ] **One-offs (Player B, creation):** make two drafts; add a one-off to the first (approved at once); move it to the second draft: still approved (not waiting); move it to an approved character: waits for the GM, as before.

### M5b — town requests: buying, selling, lodging, town activities, the overnight card (step 6e, 2026-11-04; ST5–ST9, dt-11, st-3)

fae-woodland (`packs/_current`) has services, availability, the sale rule and lodgings; any campaign on it works. Player B's character approved. On the GM: Start expedition at "Brackenford", mark it **Safe**, and with the eye show players **Buy equipment**, **Sell used equipment** and one lodging. iPad landscape first, then a phone at 375 px, light and dark.
- [ ] **iPad, Player B, Scene:** under "Places in town", a line "<name> has nowhere to stay yet" and four buttons: **Ask for…** · **Sell…** · **Where you stay** · **Things to do**.
- [ ] **Ask for…:** type "rope" in Find an item, pick it (its price beside it), **Send to the GM**: toast "Sent to the GM" with Undo; the Scene shows "Sent to the GM · Cancel". Try **Something not listed…** with nothing typed: it says "Say what you're after."
- [ ] **GM, Players, Waiting for you:** "<name> asks for Rope · Buy equipment", "The pack's price: …", "Chance it's here: Hamlet 0% · Village 0% · Small town 100% …" and the pack's note; **Hit** and **Miss** only. Tap **Hit**: **In stock** · **Price…** · **Not here**. Tap **In stock**: toast with Undo.
- [ ] **Player B:** "The GM says · In stock · <price>" with **Buy it** · **Leave it**. **Buy it**: toast "Bought for <price>: it's in your pack" with Undo, which takes the rope out while nobody has touched it (bu-1, 2026-11-14); the Pack tab has the rope, bought, the price on its line.
- [ ] **Sell…:** pick an item from the pack (a stack asks how many), **Sell used equipment**, Send. **GM:** "The pack's rule suggests … (50% of the price)", the offer box filled with it; change it, **Offer**. **Player B:** "Offers …" with **Accept** · **Decline**. **Decline**: the item stays; toast with Undo. Sell again and **Accept**: the item leaves the pack; Undo on the toast brings it back.
- [ ] **Where you stay:** the shown lodging with its rate, and **Somewhere else…**; pick the lodging, **Stay here**: toast "Staying at … · <rate>" with Undo, and the line above the buttons says so; the log reads "… chose to stay at … for <name> · <rate>". **Somewhere else…** "my aunt's cottage": waits for the GM; the GM's card has "What it costs, in words", **Yes** · **Not available**.
- [ ] **GM:** Close the lodging in Places in town; Player B's **Stay here** on it says it's closed.
- [ ] **Things to do:** the settlement mode's activities (Gossip in a tavern, Full day of rest, …) and Change money; picking one shows its rule; **Send to the GM**. **GM:** "<name>: Gossip in a tavern · a part of the day" with the rule; a note, **Yes**: Player B sees the note.
- [ ] **Overnight:** with the stay picked, the GM's **Next part of day** to the night, then to the morning: Player B's Scene shows **Morning in Brackenford** · "Last night: … · <rate>" (and any status that ended overnight) with **Got it**; after Got it it doesn't come back that morning, even after a reload.
- [ ] **Hidden means hidden:** Player C (or the GM's second tab as another player) never sees Player B's requests or stay in their Scene or log.
- [ ] **Phone 375 px:** the four buttons sit two to a row; each pop-up scrolls; long item names wrap; nothing scrolls sideways.

### M5b — town fix: entries' options and an overlay's lists (2026-11-04; `docs/plans/fix-town-options-and-stack.md`)
Newest packs from `packs/_current`: a campaign on fae-woodland, and one on classic-advanced with the zine overlay attached. As the GM: Start expedition at "Brackenford", mark it **Safe**. iPad landscape first, then a phone at 375 px.
- [ ] **iPad, fae-woodland, options off** (Rules: Lifestyle expenses and Treasure valuation off, the defaults): the town's Overview has no "Living:" line; Places in town has no valuation service at the jeweller.
- [ ] **Turn both on** in Rules and come back: Overview lists "Living: Wretched …", "Living: Poor · 5 sp a day" and the rest; the valuation service is under Shops; the count reads one more place.
- [ ] **Shown, then off:** show players the valuation service, then turn Treasure valuation off: Player B's Scene no longer lists it under Places in town.
- [ ] **classic-advanced + zine:** Places in town and Things to do hold classic-advanced's five services (black market, healing, lodgings, rumours, guard) and the zine's trader, jeweller, money changing, safe storage and loan; the zine's four lodgings under Lodgings.
- [ ] **Phone 375 px:** the longer town list scrolls; nothing scrolls sideways.

### M5b — pack review area 3 fixes (2026-11-04; `docs/plans/m5b-review-area-3.md`)
In a test campaign with the invented pack `scripts/fixtures/m5b-review-area-3.fixture.json` imported and attached, with one character of class **Bog mage** (no armour) and one of class **Reed warden** (quilted armour only).
- [ ] **iPad landscape, armour tier:** as the GM, add **Fen coat** to the Reed warden's pack and tap **Wear**: it goes on (its tier is quilted), with an Undo toast. Add **Iron scale** and tap Wear: a pop-up says "Reed warden can't use Iron scale. Quilted armour only."
- [ ] **iPad landscape, magic armour, base chosen:** add **Mist mail** to the Reed warden's pack, choosing **Iron scale** as its base; tap Wear: blocked, "Reed warden can't use Mist mail. Quilted armour only." Add another Mist mail with base **Quilted coat**: Wear puts it on.
- [ ] **iPad landscape, magic armour, no armour allowed:** add **Mist mail** to the Bog mage's pack without choosing a base; tap Wear: blocked, "Bog mage can't use Mist mail. No armour at all."
- [ ] **Phone, 375 px:** the same blocked pop-up on the Bog mage's Mist mail reads in full, and its button is easy to tap.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-review-area-3.fixture.json`: three Format notes, for the kit roll "Darts" with no die, "Reed darts (12)" with no bundle, and treasureWeights with no "art" (the Heron idol); nothing under "Left out"; the command ends without an error. Since order 13 a fourth note too: roll 2 ("Coat") names "mist-caller", which isn't a class in the pack.
- [ ] **iPad landscape, quick-kit rolls by class (order 13, eq-9):** in a campaign with the creation fixture `scripts/fixtures/m5b-creation.fixture.json` and its quick-equipment option **On**: New character → Guided → Bog folk → **Lantern Warden** → … → Gear: tap **Quick bundle**: it asks for **Roll 1d4 · Warden's light** and nothing about "Witch's book". Start again as a **Reed Witch**: the Quick bundle asks for **Witch's book** only. A **Mire Stalker** gets neither roll: the bundle is taken at once.

### M5b — area 3 order 12: Carrying treasure and clashes (eq-3, eq-4; 2026-11-04; `docs/plans/m5b-review-area-3.md`, order 12)
The same test campaign and pack as above (`scripts/fixtures/m5b-review-area-3.fixture.json`), the campaign's encumbrance on armour mode, with the **Reed warden** wearing the Quilted coat. iPad first, then a phone.
- [ ] **Suggested on.** As the GM, hand the Reed warden a Marsh pearl. Open their Pack: the load reads "Move 20 ft", "Carrying treasure · treasure 0 of 800 coins' weight", then the line "treasure in the pack" with a small **Switch off** button. As the player, the same words and no button.
- [ ] **The GM's switch.** Tap **Switch off**: at once "No treasure", "Move 30 ft", the line "the GM's call · the pack suggests on", the button now **Switch on**; a toast "<name>: No treasure" with **Undo**. The log has one line, "<GM> switched Carrying treasure off for <name>". Tap Undo: back to "Carrying treasure" and "Move 20 ft".
- [ ] **Follows the pack again.** With the pearl given away (no treasure left): "No treasure · nothing counts as treasure". Tap **Switch on**: "Carrying treasure", "Move 20 ft", "the GM's call · the pack suggests off". Tap **Switch off** again: the words return to "nothing counts as treasure" (the switch follows the pack again, not a stored "off"). Open the character from the marching order: the overview's Load shows the same words, no button.
- [ ] **Travel follows.** With the GM's switch on (and no treasure), the log's next item change for this character says "<name> is now Move 20 ft" (the database reads the switch too).
- [ ] **A clash at import.** On Setting rules, import `scripts/fixtures/m5b-review-area-3-clash.fixture.json` (Fen gear extras): the preview shows **Same item id as an attached pack** with "Marsh pearl (polished) (marsh-pearl) · also in Invented fen gear (review area 3)" and the line "The pack on top wins; the other copy stays one tap away in Rules." Attach it: in Rules, the Marsh pearl entry says which pack wins and "Also in" the other.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-review-area-3.fixture.json scripts/fixtures/m5b-review-area-3-clash.fixture.json`: under "The 2 packs together", one library note: item "Marsh pearl" (marsh-pearl) is in both, and what to do.

### M5b — area 3 follow-ups: pick the base, what counts as treasure (bq3-8, bq3-9; 2026-11-04; `docs/plans/m5b-review-area-3.md`, Follow-up)
The same test campaign and pack as above (`scripts/fixtures/m5b-review-area-3.fixture.json`, re-imported for the Otter totem), with the **Reed warden**; the campaign's encumbrance on armour mode.
- [ ] **iPad landscape, GM, Pick the base:** add **Mist mail** to the Reed warden's pack without choosing a base, then tap **Wear**: it goes on (one of its bases fits). Open **Players**: the tab reads "· 1 waiting" and **Waiting for you** shows "Pick the base for Mist mail (worn by <the warden's name>)" with **Quilted coat** and **Iron scale**. Tap **Quilted coat**: the card goes, a toast reads "Mist mail: Quilted coat" with Undo, and the warden's AC shows a number. Tap **Undo**: the card is back.
- [ ] **iPad landscape, GM, a base that doesn't fit:** on the same card tap **Iron scale**: the toast reads "Mist mail came off and is carried: Reed warden can't wear Iron scale."; in the warden's Pack, Mist mail is under Carried, not Worn; the log reads "… picked the base armour for Mist mail. It came off and is carried: the class can't wear that base." One **Undo** puts it back on, with no base.
- [ ] **iPad landscape, player, the same on AC:** as the warden's player, with Mist mail worn and no base, tap AC ("Choose base armour") and pick **Iron scale**: the same toast, and Mist mail is carried.
- [ ] **Phone, 375 px, GM:** the Pick the base card's title wraps with a long character name; both base rows are easy to tap.
- [ ] **iPad landscape, treasure by `treasure: true`:** give the warden the **Otter totem** (category "art", which treasureWeights doesn't name, marked `treasure: true`): in the Pack it shows the treasure marker and "10 coins’ weight · counted", and the load counts it. The **Heron idol** (same category, not marked) doesn't count.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-review-area-3.fixture.json`: still three Format notes; the treasure note names only the Heron idol and ends "Name the category there, or give each item "treasure": true."; the Otter totem gets none.

### M5b — area 3 order 11: containers by fill and carry bonuses (eq-5, eq-6; 2026-11-04; `docs/plans/m5b-review-area-3.md`, Departures)
The same test campaign and pack (`scripts/fixtures/m5b-review-area-3.fixture.json`, re-imported: it now has a coin mode, the **Heron satchel**, **River stone** and **Ogre grips**), with the campaign's encumbrance switched to **coin** (the campaign's encumbrance setting) and the **Reed warden**.
- [ ] **iPad landscape, a bag by fill:** add the Heron satchel and 50 River stones to the warden. Move the stones into the satchel. The satchel's row reads "300 of 600 · half full"; the load counts 300 for the satchel and nothing for the stones. Take 25 out: "150 of 600 · a quarter full". Empty it: "0 of 600 · empty".
- [ ] **iPad landscape, a carry bonus and the worn slot (mb-5):** give the warden a sword and a shield in hand, then add Ogre grips; carried, the load's "of …" number doesn't move. Tap the grips, **Wear**: they read "Worn", the sword and shield stay in hand, and the "of …" number rises by 200 (the tier can drop a step). Tap the tier words: the list ends "Ogre grips: +200 coins to each limit, while worn or in hand." **Take off**: the line goes.
- [ ] **The log, the tier line:** with the warden near a tier's edge, wearing the grips (or filling the satchel) writes "<name> is now <tier>" with the same tier the bar shows.
- [ ] **Phone, 375 px:** the satchel's row "450 of 600 · three quarters full" (75 stones in it) stays on its line or wraps cleanly beside a long name; the breakdown line wraps without cutting off.
- [ ] **Checker, on your PC:** `npm run pack:check -- scripts/fixtures/m5b-review-area-3.fixture.json`: still four Format notes (none for the satchel or the grips).

### M5b — the gate's scripted trek (step 5, build orders 1–2, 2026-11-03)
- [ ] **iPad landscape, GM, Which watch? in the night:** in a Fen trek camp with the watches set (Reed 1st, Moss 2nd), tap ⋯ → Encounter check → Hit on Prowlers, read a row, close the tables: the Encounter waiting card asks **Which watch?** with chips "1st · Reed" and "2nd · Moss" (fewer links PR 1); tap one: the card reads "Awake: 2nd watch · Moss", with Undo in the toast.
- [ ] **Dark mode, the GM's travel card:** Mark lost; the Lost card's Roll box and Move…'s Place and cost boxes are a plain field (the sheet colour) with light text, readable; the same in light mode (a white field).
- [ ] **Gallery:** open `/gallery.html` (and `?theme=dark`): a **Wilderness** section with three Encounter waiting cards (Which watch? on the first; tapping a watch turns it into "Awake: …"; Dismiss takes a card away) and the Watches step (by watch since fewer links PR 1: boxes with name chips and + Add, a long name wraps, "Casters on watch: Wick").

### M5b — the pack checker's library note (step 0d.5, 2026-11-02)

- [ ] **Checker, several packs:** on your PC, `npm run pack:check -- scripts/fixtures/m5b-0d-clash-a.fixture.json scripts/fixtures/m5b-0d-clash-b.fixture.json`: each file is checked under its own `===` line, then "The 2 packs together" lists one Library note for "Lantern reckoning" naming both packs. The same with `m5b-0d-keyed-a` and `m5b-0d-keyed-b`: "No library notes." One file alone prints no library section.

### M5b — the divider folds the menu (step 0d.1, 2026-11-02; lr-4)
- [ ] **iPad landscape, GM:** open a campaign. The left column has no "Fold the menu" row at its foot and no chevron; a thin line runs down its right edge with a short grey pill on it. Tap the pill (or anywhere on the line): the column folds to icons and the console widens. Tap again: it opens. Reload while folded: still folded.
- [ ] **iPad landscape, drag:** press on the line and drag left about a quarter of the column, let go: nothing changes. Drag left more than half the column: it folds. Drag right from the folded line about the same distance: it opens.
- [ ] **iPad landscape, player:** open a character in the campaign: the same line and pill beside Player · Scene · Pack; it folds and opens the same way.
- [ ] **Keyboard or VoiceOver (iPad with a keyboard, or a computer at 1024 px wide):** Tab reaches the handle after the sections; it's read as "Fold the menu" (then "Show the menu" once folded); Enter or Space folds and opens it; the focus ring goes round the pill.
- [ ] **Phone and iPad portrait:** no line, no pill, the tabs as before.

### M5b — character creation (step 0c, slices 1–8 and 4b, 2026-11-02; both settings)

One checklist for guided creation on the step shell. It replaces the slice-by-slice lists and M4b steps 3, 4b and 5 and the step items of M5b step 0b part B (the screens they described were rebuilt on the shell). iPad landscape first, then a 375 px phone. Part A uses the invented fixture pack; Part B the two real settings.

**Set-up.** Import the invented fixture pack `scripts/fixtures/m5b-creation.fixture.json` (⋯ → Rules library → Import a file; get it onto the iPad through Files, or test from a laptop; if an older copy is imported, Update it from the file) and attach it to the test campaign. Then, in the campaign's setting rules, tap **Use this sheet layout** on the fixture's row (it marks Hit points required). Set the campaign's Encumbrance to **coin**. Play as a **player** unless an item says GM. Create your character → Guided.

#### Part A — the fixture pack

**The pack**
- [ ] **Checker:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json` lists "rules sets with scores: 1" and prints no Format notes. Remove the `scores` block from a copy and check it: one note says the Scores step needs it.
- [ ] **Import:** the preview counts the fixture's entries (classes, races, spells, items, kits, trait lists, hooks) with no warnings; Save; attach.

**Method, Scores, Kindred, Class, Adjust**
- [ ] **Method:** "How do you want to build?" with two rows, "Step 1 of N". Next with nothing picked says "Pick one to continue." Tap the ✓ of "Calling as kindred": the hint says "… picked · 6 steps"; the other path says 7. Tap the row's name: a sheet with Pick at its foot. A setting with one path has no Method step: creation opens on the scores (Part B shows both).
- [ ] **Scores:** six tiles start at 9 ("Scores · roll 2d8"; the dice average, rounded down); each shows the modifier words under the number as you change it (MUS 13: "+1 melee"). Clear CHARM: the hint and Next say "CHARM is missing". Type 17: "CHARM must be 2–16". − / + nudge by one. Every tile 5 or less: the Weak roll callout; Start over clears them, Undo brings them back; Keep them hides it.
- [ ] **Kindred (the pack's word for the race step):** the strip shows the six scores; pick Bog folk: GRT reads "9 → 8 · bog folk −1" live. With GRT 8, Stone kin's row says "Needs GRT 9 · you have 8" with the 8 in bold and "Needs the GM's special approval"; pick it and tap Next: it goes on (the review and the GM's card flag it). Tap a row's name: on the iPad the entry opens beside the list with six headings and Pick; on the phone as a sheet. No Decide later on Kindred or Class.
- [ ] **Class:** the strip starts with the race; rows carry "Prime MUS 13 · +5% XP · d8 hp · to level 8 as bog folk" (the witch adds "casts"); "Not open to … · N ›" folds the rest at the foot, still pickable, and Next explains if you pick one.
- [ ] **Adjust scores:** the why-line is the pack's note with its page; −2 on non-primes, +1 on the prime, ↶ per trade; a forbidden tap answers in a toast (the prime's −2; GRT as a warden; a score at the floor). Lower WIT: the bank says "Lowered WIT by 2 · 1 to spend" and Next says "1 to spend …"; raise MUS: the tile shows "10" with "9 +1" and the modifier change. Back: "Trades reset." with Undo. Next lands on "Who they are" with the traded scores. A rule written only in words gives no Adjust step, and the counter never counts it.
- [ ] **Back keeps every value:** Back from "Who they are" returns to Adjust with the trades; Back again through Class, Kindred and Scores shows every pick and number as left.

**Who they are** (Scores: type GRT 9 → Kindred: Bog folk → Class: Lantern Warden → Adjust: Next)
- [ ] **The step:** "Who they are", "Step 5 of …", the why-line "A name the table will remember." and Help me choose. The foot's hint reads "Name, hp and leaning missing"; Next says the same in a toast and stays.
- [ ] **Never asked twice:** no box for Armour, Movement, Attack, Save vs mire, Title or Literacy; the scores, Languages, Background and Starting money aren't here either. Motto (a free field) is asked.
- [ ] **Derived fields:** "Derived fields · 6 ›" (open on the iPad, folded on the phone) lists Armour 0, Movement 120, Attack 19, Save vs mire 12, Title Lamplighter, Literacy Reads. Tap "Attack": a toast says it's worked out by the setting's rules. Nothing there can be typed into. Type a name, Back twice to Class, pick Reed Witch, Next (twice): the name is still there; Attack reads 20 and Title Reed-reader.
- [ ] **Hit points:** "Roll 1d8, add your GRT modifier (0); never below 1". Type 9: "1d8 gives 1–8: type what the dice showed." and Next repeats it. Type 5: "1d8 → 5, GRT 0 → 5 hp". (GRT 6 and bog folk, a 1: "1d8 → 1, GRT −1 → 1 hp (at least 1)".) Without **Use this sheet layout**, hit points aren't asked.
- [ ] **Roll again (follow-up A, cf-1):** in the campaign's setting rules, Second wind **On** (the default). Type 2: a "Weak roll" callout says "A 1 or 2 on the die: you may roll your hit points again." with **Roll again** and **Keep it**. Roll again empties the box (toast with Undo; Undo brings the 2 back). Keep it hides the callout and Next goes on with 2 hp. Type 3 or more: no callout. Turn Second wind **Off**: a 1 or 2 shows no callout. `npm run pack:check` on the fixture counts "rules sets with a hit-points re-roll: 1".
- [ ] **Leaning (alignment):** the pack's line, "Only you and your GM see it.", three rows (Lantern, Reed, Mire) each with its note; tap a row or its ✓: ticked, and the hint says "Name, hp and leaning set". Portrait: optional, Add a picture works.

**First spells** (Class: **Reed Witch**)
- [ ] **The step:** "First spells" after Who they are, the why-line and Help me choose. "Given by your class · always in your book" with Glimmer ticked; tapping its ✓ says "Given by your class: always in your book." and it stays.
- [ ] **Pick 2:** Reed whisper, Mire grip, Damp wick, each with its blurb and "Level 1 · 1 turn · 60 ft · Fen rules p. 40". A third tick says "2 of 2 picked · unpick one first." Tap a row (not the ✓): Level, Range, Duration, Saves, the rules text and Pick / Unpick, beside the list on the iPad, a sheet on the phone. **Cantrips · pick 2:** Frog chorus, Dry boots, Knot charm.
- [ ] **The shared table, as a player (slice 4b; ruling fs-1 … fs-3):** "Roll d4 · First whispers · at the table, then tap what it shows" with four rows, ranges first ("1 · Reed whisper" … "4 · Glimmer"), each with the spell's blurb; no "only your GM can see" wording. "4 · Glimmer" (given) says "already yours · roll again"; its ✓ answers "Already yours · roll again." and stays unticked. Tapping a second row untaps the first (one roll per table).
- [ ] **Next:** with nothing picked the foot says "3 spells and 2 cantrips to go" (the roll counts as one) and Next adds ", or Decide later"; with the picks and cantrips done, "Roll d4 at the table, then tap what it shows"; with "3 · Damp wick" tapped ("1 of 1 tapped"), "6 spells in your book", and Next goes on. Back says "<name> is saved as a draft. Change who they are from the review at the end." and keeps the picks.
- [ ] **Two tables, in the pack's order:** class **Fen Cantor** (no picks, no cantrips): "Roll d4 · First whispers" then "Roll d2 · First charms"; the foot asks for the d4 first, then the d2. Tap "2 · Mire grip" on the d4; on the d2 "2 · Mire grip" says "already yours · roll again"; tap "1 · Light and dark": a whole-book row puts two spells in ("3 spells in your book").
- [ ] **A table that isn't shared:** as the GM, remove First whispers' `"gmOnly": false` (edit it in the Rules library, or import a copy without it): the player's Reed Witch sees "Rolled at the table · not shared with players" naming "first-whispers", and Next doesn't wait for it; `npm run pack:check` on such a file says "write "gmOnly": false on the table". Put the flag back.
- [ ] **Hidden means hidden:** as the GM, ⋯ → Tables lists every table as before; as a player, no GM-only table of a real setting appears anywhere, only the starting-spell tables the pack opens.
- [ ] **No step:** a Lantern Warden (no spells) and a Marsh Chaplain (prayers from level 2) go from Who they are straight on; the step count is one less.

**Gear** (Class: Lantern Warden)
- [ ] **Money first:** "Starting money" with "Roll 3d6 × 10 gp at the table and type it." Tap the ✓ of Warden's kit before typing: "Type your starting money first." Type 100: "Gold to spend: 100 gp".
- [ ] **The kit:** "Warden's kit", its contents in one line, "22 gp · 300 coins", "Fen sample · p. 31"; the row opens About, Worn and held, Carried, In the reed basket, Cost and Weight with Pick / Unpick. The ✓ takes it: toast "Took Warden's kit · 22 gp" with Undo; the tally says "Gold to spend: 78 gp · spent 22 gp"; the load line shows **Light** and "300 of 1200 coins" (tap Light: the tiers); the foot "1 kit · 0 bought".
- [ ] **The shop:** Browse the shop ›: the tally on top, categories Weapons · Armour · Adventuring gear, each row with its price and Add. Storm lantern adds at once (toast with Undo, gold −8 gp); Dry rations asks how many. Bog-iron coat (40 gp) with less left: "N gp short." and nothing bought, never greyed. Undo last takes the last buy back. Done shopping: the buys are listed with Put back · N gp.
- [ ] **Next checks overspending:** money 10: "Short by …"; Next says "… gp short: put something back, or Decide later." Money cleared: Next goes on (the purse starts at 0).
- [ ] **Load follows the campaign:** Encumbrance **slots**: "Burdened · 6 of 10 slots" after the kit; **not tracked**: no load line.
- [ ] **No shop, given gear (follow-up A, cf-4):** in the campaign's setting rules, Fen market **Off**. On Gear: a **Given** group at the top, "everyone in your setting starts with these", with Reed rope and Storm lantern ticked; tapping either's ✓ says "… is given to everyone in your setting: it stays in the pack." and it stays ticked. No Browse the shop ›. The load line counts them before any kit ("90 of 1200 coins"; with Warden's kit, 390). Review → Change Gear → Done: the pack still has one Reed rope. Fen market **On**: the shop is back and no Given group.
- [ ] **A rolled kit (Mire Stalker):** "Stalker's bundle · Free", "Roll d6 · Armour · tap your result" and two "Roll d4 · Weapons" groups, range first. A tap in each takes the kit; another Armour row swaps it.

**Languages, trait lists, weapon skills** (Kindred: Bog folk, Class: Lantern Warden, Who they are: a name, leaning **Reed**)
- [ ] **Languages:** no Decide later (the fixture requires it). "Yours already · 4": Fen common (everyone), Reed (alignment), Deep croak (Bog folk), Old lantern (Lantern Warden). Tapping Deep croak's ✓: "Given by Bog folk: always yours." "Pick 1 more · WIT 9 · 0 of 1 picked": Reedspeak. Next with nothing: "Pick 1 more." Other… → "Heron-call" → Add shows it ticked as "Typed in by you" (with one already picked: "1 of 1 picked · unpick one first."). Under the list: "Literacy: Reads · from WIT 9 · Derived fields".
- [ ] **Skipped:** WIT 6 (0 extra): no Languages step; the sheet still lists the given ones.
- [ ] **Trait lists (as a player; follow-up B, cf-5):** Who they are never asks for the Background; after Languages a "Bog folk backgrounds" step (the layout's `fen-backgrounds-{race}`, chosen by the kindred); pick "4–5 · Reed cutter", Next; the review's Background line says "Reed cutter". A second character as Stone kin gets "Stone kin backgrounds" instead ("1–2 · Causeway mason"). Birth omens off (the default): no step and no Omen field. GM turns it On: a "Birth omens" step after Languages, "Roll d4 at the table and tap your result, or just pick.", range first. "3–4 · Frog in frost" says "starts with Dry rations"; pick it, Next: toast "Dry rations added to your pack." with Undo. Other… with nothing typed: "Type a name first, then tap Add."; with a name and note, the sheet shows "Name — note".
- [ ] **Weapon skills** (a pack with weapon skills on, or Part B): grouped by category, "0 of 2 picked", Specialise beside a picked row ("2 of 3 picked · Reed spear spends 2"), the class's other weapons folded at the foot, never picked; the row opens the weapon's entry.

**Review and send** (walk to the end: Tam, leaning Reed, Gear 100, Languages Reedspeak)
- [ ] **The review:** the title is the name, "Step N of N · Review", the why-line "Look it over. Anything you change goes back to its step and comes back here." Sections in the order walked: Kindred · Class ("Bog folk Lantern Warden · level 1"), Scores ("(rolled N)" on a changed one), Who they are, Derived fields "· from the rules" (no Change), Gear (what's carried, the count, the load tier, "N gp left · 100 gp rolled"; no money typed: "Starting money not typed · the purse starts at 0"), Languages, the background. Every other section has **Change ›**.
- [ ] **Change ›:** on Languages opens the step with no counter; Next returns with the new list. On Gear the button says Done. On Who they are, add " of the Reeds", Next: the title follows, and Your characters still has one Tam; Change then Back: nothing saved. On Scores, Kindred or Class: the guided steps again (follow-up C, below).
- [ ] **Change › on Scores (follow-up C, cf-7):** from the review, Change › Scores opens Scores with the numbers as saved; raise MUS by 1, Next through Kindred (Bog folk still ticked) and Class (the warden still ticked), Adjust: "Scores saved." and the review; Gear ("… gp left", the kit still in the pack), Languages and the background are unchanged; the Scores section shows the new number. Back from Scores instead: the review, nothing changed.
- [ ] **Change › on Kindred · Class, a new class (follow-up C, cf-7):** with Warden's kit taken and a background picked, Change › Kindred · Class opens Class; pick Reed Witch, Next: a toast "Class changed: the hit points, spells, gear, languages, weapon skills and traits after it are cleared." with **Undo**; with hit points asked (Use this sheet layout), Who they are opens first with the name kept and the hit-points box empty (Next says "Type the hit points you rolled."; type the new die's roll); then the walk goes on to First spells, Gear (the kit gone, "100 gp left", a Given group still there with Fen market off), Languages (Fen common, Deep croak given; Reedspeak still picked; Old lantern gone), the background (nothing picked), the review. Tap Undo on the toast: "Put back as it was." and the review reads "Bog folk Lantern Warden · level 1" with the kit, Reed cutter, Old lantern and the old hit points back; a Change › Scores alone, or a Kindred change alone (Stone kin, same class: its toast names no hit points), keeps the hit points; the log has one line "changed Tam's race or class: the later picks were cleared" and its undo.
- [ ] **A scores-only change with a requirement missed:** lower GRT under 7 (the warden's), Next to the review: "Lantern Warden: Needs the GM's special approval" is back on the first section; raise it again: gone.
- [ ] **Add to homebrew (follow-up C, cf-6; as the GM):** a player types Heron-call with Other… on Languages and "Mud diver — knows the flats" on the background, sends the character; on Players, the card shows "Typed by <player>" with Heron-call (Language) and Mud diver (Bog folk backgrounds · knows the flats), each with **Add to homebrew**. Tap the language's: "In the campaign’s homebrew now"; Settings › Rules library shows the campaign's homebrew with a "Campaign languages" rules set; the next character's Languages step offers Heron-call. Tap the trait's: the next bog folk's backgrounds list has Mud diver with its note. The player's own sheet still says Heron-call and Mud diver as typed.
- [ ] **Special approval:** a Stone kin with GRT 8 shows "Stone kin: Needs the GM's special approval" in bold with the requirement; the GM's approval card flags it too.
- [ ] **To finish:** Decide later on a step: the section says "… · to finish" and the box "To finish · 1 — you can do it later, from your sheet" with "Do it now ›"; finishing it returns to the review, the box gone. After sending, the sheet's To finish card opens the same step in a pop-up (no counter).
- [ ] **Save and leave:** "Tam is saved. Carry on from Your characters."; Your characters says "Not sent yet · tap to continue"; tapping it opens the same review, as saved. **Back** on the review opens the last step walked.
- [ ] **Send to the GM:** "Sent Tam to your GM." and you land on the campaign. With approval off, the button says Create character and "Tam has joined the party."

**The older review, still in use**
- [ ] **Sent back:** the GM sends a guided character back with a note: Your characters → the character opens the older review with the GM's note pinned and the ticked sections marked; Resend to the GM works (moving it onto the new review: slice 8, scope check 1).
- [ ] **A class gone:** a draft whose class's setting rules were taken off the campaign opens the older review and can still be sent.
- [ ] **Freeform is unchanged:** Create your character → Freeform shows "Who are they?" with HP max (optional) and Send to the GM.

**Second test, PR D (bugs)** (iPad in landscape first, then a phone; the fixture pack, or fae-woodland 0.3.7 and classic-advanced with the zine overlay 0.5.3)
- [ ] **Score tiles:** Scores: four tiles on the first row in landscape (three in portrait); type 18 in each: both digits show whole, −, the number and + on one line, every tile the same height. On a phone: two tiles per row, the same, the controls closer together (4 px) but each a full 44 px.
- [ ] **Each step opens at its top:** scroll down on Kindred and on Class, tap Next: Who they are opens with its title at the top; the same going into each trait-list step (Background, Birth omens).
- [ ] **Kindred-as-class off/on:** with the option off (fixture: Kin callings; fae-woodland: kindred classes), the Class step has no kindred class, not even in "Not open to …", and the kindred's entry doesn't list it under Open classes. Turn it on: the class is a row you can pick.
- [ ] **Quick equipment off/on:** with the option off (fixture: Quick bundle; the zine overlay's quick equipment), Gear shows only the class's kits; on, the quick kit is a row any class can take.
- [ ] **AC at creation:** Who they are → Derived fields: AC shows a number (fixture: Armour 10 with NIM 9, 11 with NIM 12; classic-advanced: 9 descending or 10 ascending, changed by DEX), not "—".

**Second test, PR E (rows and the entry)** (iPad in landscape first, then a phone; the fixture pack, or fae-woodland and classic-advanced)
- [ ] **Pick buttons:** every pick row (Kindred, Class, Leaning, spells, kits, languages, weapon skills, trait lists) ends in a **Pick** button; no empty ✓ square. Picked: the button reads **Picked ✓** in the Selected wash (tf-4, 2026-11-03; it was filled dark), the row has a tinted band and a dark edge on its left.
- [ ] **Pick → Next:** on Kindred tap Pick on Bog folk: Class opens at once with "Bog folk picked · Undo"; tap Undo: back on Kindred, nothing picked. Tap Pick on a class: Adjust scores (or Who they are) opens with "<class> picked · Undo"; Undo returns to Class with nothing picked. On Languages or First spells with Pick 2, a Pick stays and the foot counts.
- [ ] **The entry:** tap a kindred's name: small-caps headings, Advantages and Disadvantages as bullet lines "name — effect", Open classes as chips; tap a chip: that class's entry to read, "Back to <kindred>" returns. A class's entry has "Armour and weapons" and "Level cap by kindred".
- [ ] **A spell book:** fixture, Fen Cantor → First spells: tap "1 · Light and dark": one row per spell (name, line, facts); tap a spell: its full rules; "Back to 1 · Light and dark".
- [ ] **Adjust scores (option C):** Lantern Warden: no GRT tile, the line "GRT stays as rolled in these rules · not shown here"; MUS has only +1, the others only −2; lower WIT, raise MUS: the chip "WIT −2 → MUS +1 ✕"; make a second trade, tap the first chip's ✕: only that trade goes.
- [ ] **Hit points:** with a sheet layout asking hit points: one line under the box "Roll 1d8 and type the die. The app adds GRT (0); never below 1."; no "type what the dice showed"; the arithmetic beside the box once a die is in.
- [ ] **Score words:** a score whose modifier row has words shows them after the column's name ("literacy Reads", "open doors 2-in-6").
- [ ] **Derived fields:** only fields with a value ("Derived fields · N"); when some have none yet the note says "more appear as you pick gear"; no "—"; AC reads "10 · unarmoured, NIM +0" (fixture).
- [ ] **Kit first:** Gear, a kit with rolls (fixture: a Mire Stalker's Stalker's bundle, two rolls): Pick it: Picked ✓ at once, its rolls unfold under it; Next says "Tap your armour roll…"; tap each roll: the kit goes in the pack.
- [ ] **Set-up unchanged:** New campaign → Setting rules: the pack rows still have their ✓ slot.

**Second test, PR F (options at creation, weapon proficiencies, trait-list explainers)** (iPad in landscape first, then a phone; classic-advanced 0.6.8 + the zine overlay 0.5.3, and fae-woodland 0.3.7, in two test campaigns)
- [ ] **Weapon proficiencies:** classic-advanced, Rules for this campaign → weapon proficiency **on**; make a fighter: the Weapon skills step has a line "Pick 4 · 0 of 4 picked" over the weapon groups; Pick a weapon: "1 of 4 picked"; Pick it again: back to Pick. At the foot, Other…: type "Whip", Add: a row "Whip · Typed in by you", Picked ✓, the count goes up by one.
- [ ] **Specialisation:** set weapon proficiency to **on with specialisation**: the step is still there (it vanished before), the line ends "· specialisation on: pick one again to specialise", the why-line has the pack's rule ("Spend two picks on one weapon…"). Pick a sword, Pick it again: **Specialised ✓✓**, the foot says it spends 2. Specialise a second weapon: the first goes back to Picked ✓ with a toast. With every pick spent, a second Pick unpicks and the toast says why. Switch back to plain **on**: the line says nothing about specialisation.
- [ ] **Trait lists:** fae-woodland, a kindred's backgrounds step: the why-line is the pack's "Roll 1d20 at the table, then tap the range — or pick one. …", once (no second roll line after it). Help me choose shows the steps' help. Zine overlay: a d8 or d10 list (when a step shows one) opens with "Roll 1d8 at the table, then tap — or pick." before the pack's notes.
- [ ] **Options on and off:** for each option in `docs/plans/m5b-0c-creation-options.md` marked tested, switch it off in Rules for this campaign and start a new character: the thing in its "What it gates" column is gone; switch it on: it's there. (Most are also covered by `src/app/creationOptions.test.ts`; this is the check on the real packs.)
- [ ] **Local check:** on the PC with `packs/`, `npx vitest run src/app/creationOptions.realPacks.test.ts` passes (every option the table names is in the packs).
- [ ] **Phone (375 px):** the count line wraps under the title; "Specialised ✓✓" fits its button; Other…'s field and Add are 44 px.

**Seeded test campaigns (tester, 2026-11-03)** (on your PC with `packs/_current/` and `.env.seed` set up; docs/testing.md, Seeded test campaigns)
- [ ] **First run:** `npm run seed:test`, then sign in to the preview as the test GM: a "Seed ·" campaign pair for each setting is there ("defaults" and "options on"), each class has a character, every kindred or race appears at least once, and each sheet opens. The summary at the end lists anything skipped, with the app's own reason.
- [ ] **Kit, spells, traits, languages:** open a fighter's sheet: the Pack holds the class's first kit (and the given gear); a caster's sheet lists a spell book with the given spells and the first picks; the background (and a birth omen in the options-on campaign) shows the first entry of its list, and the languages field lists the given ones and the extras. The summary's "left out" lines name anything that could not be set, with the app's reason.
- [ ] **Worn, held, weapon skills:** on a fighter's Player screen the armour and shield show as worn, the first weapon is held and in At hand, and AC is worked out from them (not the bare value). In an "options on" campaign a fighter's sheet lists weapon skills, the first ones the step offers. Any kit item the class or setting refused shows in the summary as "not put on", with the reason.
- [ ] **Reset:** `npm run seed:test -- --reset`: the same campaigns are rebuilt (new ids, same names and characters), and no other campaign in the test project changed (check a campaign you made by hand is still there).

**Second test, PR G (a typed weapon on the GM's review; a list's own help)** (iPad in landscape first, then a phone; the fixture pack `scripts/fixtures/m5b-creation.fixture.json`, with Weapon drill on)
- [ ] **Typed weapon:** as a player, make a Lantern Warden; on Weapon skills pick Reed spear, then Other…: type "Heron hook", Add; send the character. As the GM, Players → the waiting card: under "Typed by <player>", a row **Heron hook · Weapon skill** with **Add to homebrew**; Reed spear has no row. Tap Add to homebrew: the row reads "In the campaign’s homebrew now"; the Rules tab's homebrew holds a weapon "Heron hook" (no damage yet: the GM fills it in). A second Lantern Warden's Weapon skills step now lists Heron hook among the weapons (a class whose allowed weapons are limited may list it under the ones it can't use: the new item has no tags).
- [ ] **A list's own help:** make a Stone kin character; on the Stone kin backgrounds step tap Help me choose: only "Stone kin trades come from the causeways. …" (since the third test, ct3-8: the list's own help alone). A Bog folk character's backgrounds step shows the app's paragraphs ("What this decides. …"), as before.
- [ ] **Phone (375 px):** the "Heron hook · Weapon skill" row and its Add to homebrew button wrap without scrolling sideways; the button stays 44 px.

**Third test, PR H (bugs and reading the pack)** (iPad in landscape first, then a phone; fae-woodland 0.3.8 in the test campaign, a duskcat fighter; or the fixture pack `scripts/fixtures/m5b-creation.fixture.json`, where Stone kin stand for the duskcat: Hark 5, a spell ward of +2, left out of the birth omens)
- [ ] **Re-roll at the average (ct3-1):** Guided → Abilities: type 3 in every tile. The Weak roll callout appears; tap Start over: every tile reads the dice average again (fae-woodland 10, the fixture 9), none empty; Undo puts the 3s back.
- [ ] **Tiles 3 + 3 (ct3-2):** on the iPad in landscape the six tiles sit three to a row, two rows; no number clipped. On a phone, two per row as before.
- [ ] **Back beside Next (ct3-5):** from Kindred on, the foot has **Back** beside Next (none on the first step). Walk to the first step after Who they are (Equipment in fae-woodland, Gear in the fixture), then tap Back: Who they are, with the name, alignment and hit points kept ("Now N hp"). Back again: Class with Fighter picked; Back again: Kindred with Duskcat picked. Next, Next…: Who they are, then the same step, its picks kept; the GM's Waiting for you shows **one** draft. The top row's ‹ does the same as Back on every step.
- [ ] **No moon sign for a duskcat (ct3-4b):** with Moon signs on, a duskcat is never asked a moon sign: not on Name and alignment, not as a step, not on the review. A human (or a thistlekin) gets the Moon signs step, with its roll line "Roll 1d100 at the table, then tap the range — or pick one." (ct3-4).
- [ ] **Roll line (ct3-4):** each trait-list step (Background, Moon signs) shows its roll line as the why-line under the title.
- [ ] **Help per step (ct3-8):** on the Background step, Help me choose speaks of backgrounds only; on Moon signs, of moon signs only (each list's own help); neither repeats the other list.
- [ ] **Affiliation (ct3-3):** Name and alignment doesn't ask for an Affiliation. On the full sheet, Affiliation has an ⓘ: tap it: "The faction your character works with or answers to, …" (the pack's help line); Edit still lets the owner type one.
- [ ] **Listen 5, magic resistance (ct3-12a):** the duskcat fighter's Derived fields (Name and alignment) and the full sheet's Skills show Listen 5, Search 6, Survival 6; Saves show Magic resistance = the WIS modifier + 2 (WIS 9–12 → 2). A human fighter: Listen 6, Magic resistance = the WIS modifier alone.
- [ ] **Movement (ct3-10):** the full sheet's Movement block shows Speed, Exploring and Overland with the pack's figures (a character made before this PR shows them too, from the pack). The other modes sit in the Combat block's grid once each (encounter, familiar, running, combat, swimming; since PR I there is no "How it's worked out" link, ct3-9) and no second Speed or Exploring. Classic-advanced: Movement reads the pack's words (two figures, the second in brackets).
- [ ] **Left column with the menu open (ct3-7):** on the iPad in landscape, the Player screen with the menu open: the AC and Attack tiles, the saves and skills all fit the left column (tiles wrap to a second row if they must), nothing cut off or under the full sheet; fold the menu: the column widens. Also at the Larger text size. (`npx playwright test tests/layout/player-column.spec.ts` checks the same with a fighter's figures drawn into the stand-in screen.)
- [ ] **Phone (375 px):** Back and Next sit on one row in the foot (or wrap under the hint), each 44 px, 8 px or more apart.
- **PR H2 (ruled B, 2026-11-03):** the app no longer leaves Affiliation out by name, nor copies exploration into `movement.explore`. Until the pack session's two fixes (Affiliation's `atCreation: false`, the layout's `movement.exploration`), fae-woodland **asks** Affiliation on Name and alignment and its **Exploring** reads blank (the figure shows in the Combat grid); the Affiliation and Movement checks above then pass on the fixture pack only.
- [ ] **atCreation (fixture):** with the fixture pack, Guided to Who they are: no Affiliation, Motto asked. After sending, open the full sheet: Affiliation is there with its ⓘ, and Edit lets you type one.
- [ ] **Checker:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json`: no note about atCreation. After the pack session's fix, the same on fae-woodland.

**Third test, PR I (explain and pick)** (iPad in landscape first, then a phone; fae-woodland in the test campaign, a fighter whose kit rolls the same die twice; or the fixture pack `scripts/fixtures/m5b-creation.fixture.json`: a Mire stalker's **Stalker's bundle** rolls Weapons on d4 twice)
- [ ] **One table for two rolls (ct3-6):** Gear: Pick the rolled kit. Under it, the twice-rolled roll is **one** table: "Roll d4 twice · pick 2 · Weapons", "tap your results". Tap one row: "1 of 2 tapped"; tap another: "2 of 2 tapped", and the kit goes into the pack. Tap a third row: nothing changes and a toast says "2 of 2 tapped · untap one first." Untap one, then tap the row that's still picked: it reads **Twice ✓✓** (the dice showed the same twice) and the pack holds two of it. A roll made once (Armour) still moves its tap to the row you tap.
- [ ] **Every figure explains itself (ct3-9):** open the full sheet. There is no "How it's worked out" link. Tap each of hit points, AC, attack, level, every save, every skill, the save modifier (magic resistance; the fixture's Spell ward), Movement and each movement figure in the Combat grid: each opens a pop-up with at least one line saying where the number comes from (a skill: the rules', the class's and the kindred's numbers and "Lower is better: N counts"; a save modifier: "+N from WIS …", "+N from <the kindred>", the total; movement: "Speed N: …'s own" and "speed × 3 = N"). A figure the race qualifies says so last ("<Kindred>: N when foraging."). Got it closes each.
- [ ] **Every pack-list value opens its entry (ct3-11):** on the full sheet tap the kindred and the class at the top, the alignment, the background, the moon sign (fixture: the Omen, Heron at dawn) and each language: each opens its entry (what it is, what it does, the source and page; the moon sign's "Roll 1–2 on d4" and the list it's from). A language the setting doesn't list, a motto or a typed value stays plain words. A kindred's Open classes chip opens that class.
- [ ] **The same in creation (ct3-11):** on Name and alignment, tap an alignment row's text: its entry opens with **Pick <name>** at the foot (it picks and closes). On the review, the kindred, the class, the alignment, the trait-list values and each listed language are buttons that open their entries; Change › still goes to each step.
- [ ] **Phone (375 px):** the sheet's tappable values wrap inside their borders (a long background name, several languages as pills over two lines), each 44 px tall with 8 px between; the review's value pills wrap under their section title; nothing scrolls sideways.

**Races: save bonus by CON, optional abilities, a skill target in a situation (2026-11-03, branch `m5b-0c-race-saves-options`)** (iPad in landscape first, then a phone; classic-advanced and fae-woodland in the test campaign; or the fixture pack `scripts/fixtures/m5b-creation.fixture.json`, where Stone kin gain LORE +1 and "Causeway memory" with **Kin callings** on, and Bog folk have Hark 4 when wading)
- [ ] **Saves by CON (classic-advanced):** Guided, a high CON, pick **Dwarf**, a Fighter. Name and alignment's Derived fields (and later the full sheet's saves) show beside the saves: Death "… (+N to the roll vs poison)", Wands, Spells "… (+N to the roll)"; the numbers themselves are the class's, unchanged. Paralysis has no note. On the Player screen tap the Spells save: the pop-up says "Dwarf: +N to the roll." With a low CON: no notes. A Halfling the same on its saves; a Gnome only on Wands and Spells.
- [ ] **Human with race limits lifted (classic-advanced):** as the GM, set **Demihuman class and level limits** to **Lifted**. As the player, Guided: the Human's entry pop-up lists "Score changes CHA +N · CON +N" and Blessed, Decisiveness, Leadership under its abilities; pick Human: the score strip shows CHA and CON higher ("human +N"). Set the rule back to **Enforced** (and start a new character): the Human has no score changes and none of the three. Lifted, the demihumans' class and level limits go too (cs-5): a Dwarf is offered every class, with no "to level".
- [ ] **A skill target in a situation (fae-woodland):** a **Burrowkin**'s Derived fields show Survival "N · M when foraging"; the full sheet's Survival "N (M when foraging)"; on the Player screen, tap Survival: "Burrowkin: M when foraging." A duskcat's Listen is still its usual figure, with no note.
- [ ] **Checker:** `npm run pack:check -- <classic-advanced pack>` counts "races with a save bonus by CON: N" and "races with optional abilities behind an option: N", with no note on those fields; fae-woodland counts "races with a skill target in a situation: N".
- [ ] **Phone (375 px):** a long note ("+N to the roll vs poison") wraps under its figure on Derived fields and the sheet; nothing is cut off.

**A class reaching the base races (pg-2, 2026-11-03)** (iPad in landscape first, then a phone; the fixture pack `scripts/fixtures/m5b-creation.fixture.json` plus the invented add-on `scripts/fixtures/m5b-0c-race-reach.fixture.json`, both imported and attached)
- [ ] **Checker:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json scripts/fixtures/m5b-0c-race-reach.fixture.json`: under "The 2 packs together", one note: `"race-dune-walker"` isn't a race in any of these packs. Exit is 0.
- [ ] **Offered at its limit:** as a player, Guided, pick **Stone kin**; on the Class step **Ash Tender** is in the list, its line says "to level 9 as stone kin". Open its entry: "Level cap by kindred" lists stone kin 9. Stone kin's own entry lists Ash Tender (to 9) under Open classes.
- [ ] **Not named, not offered:** go back, pick **Bog folk**; Ash Tender is only in the folded "Not open to bog folk" group.
- [ ] **Detach:** as the GM, detach the add-on; start a new character as Stone kin: no Ash Tender anywhere.

**Class and alignment limits, hard or soft; a race read after the campaign's choices (cs-3, cs-5, 2026-11-03)** (iPad in landscape first, then a phone; the fixture pack, re-imported or updated from the file so it has the **Kindred limits** option)
1. [ ] **Hard: not open, can't be picked.** As a player, Guided, pick **Stone kin**. On the Class step **Reed Witch** is only in the folded "Not open to stone kin" group; its line starts "Not open to stone kin" in bold and has no special-approval note. Tap its **Pick**: nothing is picked, you stay on Class, and the toast says "Reed Witch isn't open to stone kin. Pick another class, or go back."
2. [ ] **Soft: pickable, flagged.** Back, pick **Bog folk**. **Fen Cantor** is in the open list, its line ends "Needs the GM's special approval" in bold and says "to level 6 as bog folk". Pick it: the next step opens with the toast "Fen Cantor picked · needs the GM's special approval". Bog folk's entry lists "Fen Cantor (to 6, with the GM's leave)" under Open classes. Finish and send: the GM's card and the review show "Needs the GM's special approval: Fen Cantor" with "Fen Cantor as bog folk needs the GM's leave".
3. [ ] **Alignment, hard.** A Bog folk **Marsh Chaplain**: on Who they are, the Leaning group says "A marsh chaplain may only be Lantern or Reed." and offers Lantern and Reed only (no Mire).
4. [ ] **Alignment, soft.** A Bog folk **Mire Stalker**: the Leaning group says "A mire stalker is usually Reed or Mire; another needs the GM's special approval."; Lantern's row has the note in bold, Reed and Mire don't. Pick Lantern and send: the GM's card shows "Needs the GM's special approval: Lantern" with "A mire stalker is usually Reed or Mire". From the review, Change › Who they are, pick Reed and save: the flag is gone.
5. [ ] **The option's default.** As the GM, the campaign's Rules: **Kindred limits** is on **Kept**. A Bog folk can take **Marsh Chaplain** (in the open list).
6. [ ] **NPC-only.** Set Kindred limits to **Chaplains are the GM's**. New character, Bog folk: Marsh Chaplain is only under "Not open to bog folk"; its Pick says "Marsh Chaplain isn't open to bog folk (only the GM's characters). Pick another class, or go back."
7. [ ] **Lifted.** Set it to **Lifted**. New character, Stone kin: every class is open, Reed Witch included, with no "to level" for the kindred; Stone kin's entry has no Open classes heading (no limits).
8. [ ] **Checker:** `npm run pack:check -- scripts/fixtures/m5b-creation.fixture.json` prints no note on classMaxLevels, alignments or byOption.
9. [ ] **Phone (375 px):** the Leaning line and a row's bold note wrap; the toast on a hard limit fits; nothing scrolls sideways.

**Alignment visibility** (the fixture says owner)
- [ ] As player A, make a character with a Leaning and send it; the GM approves. As player B, open A's character: no Leaning anywhere (sheet, card, log). The GM and A see it. A changes it on the sheet: logged, Undo puts it back. Detach the fixture: B now sees it.

**Phone (375 px), every step**
- [ ] One column; the strip wraps; adjust tiles one per row; derived fields one per row; group headings wrap with their counts; the tally wraps; every ✓, row, Add, Other… and Change › at least 44 px; Save and leave and Send stay in the foot; nothing scrolls sideways.

#### Part B — the two real settings (private packs, newest builds)

Import or update each setting pack, attach it to its own test campaign (Use this sheet layout), and make one character per row below. Each step uses the pack's own words and pages.
- [ ] **Setting A (classic-advanced):** with the creation-method option on "each player chooses", Method appears and its paths give different step counts; a race with a requirement the scores miss is pickable with the special-approval note; Adjust scores follows the pack's rule; a druid's First spells only shows the given spells and Next is ready at once; with the cantrips option on, a caster gets a Cantrips group; the secondary-skills list follows its option; weapon skills follow the option.
- [ ] **Setting B (fae-woodland):** with the kindred-as-class option, Method offers it and the race step goes; alignment stays hidden from the other players (`alignmentVisibility`); the magician's first spells are rolled on the two tables the pack opens to players (slice 4b), shown to a player in the pack's order; the moon signs list has no step for the races it excludes; a player gets the backgrounds list of their kindred as a step (follow-up B, cf-5), and the secondary-skill field of setting A shows only with its option on; with buy-equipment off, no shop link and the setting's starting equipment as a Given group (follow-up A, once the pack session's build carries `startingGear` and `startingEquipment` through `byOption`); a hit-points roll at or under the pack's `hitPoints.reroll.atMost` offers Roll again while its option is on.
- [ ] **Every class, automatically:** on the PC with `packs/`, `npx vitest run src/modules/characters/allClasses.test.ts` passes for both settings.
- [ ] **Class limits, hard or soft (cs-3, cs-5; survey PR 1):** setting A: a Dwarf is offered only the classes its table lists, each "to level N as dwarf"; a Drow Druid is under "Not open to drow" and its Pick says why. As the GM, set **Demihuman clerics and druids** to **NPCs only**: an Elf's Cleric and Druid move under "Not open to elf" ("only the GM's characters"); a Half-elf's Cleric stays open. Set **Demihuman class and level limits** to **Lifted**: every race is offered every class with no kindred cap. An Assassin offers only Neutral and Chaotic on Who they are, with the line "An assassin may only be Neutral or Chaotic."; a Paladin only Lawful. Setting B: an Elf's Knight and a Human's Enchanter are in the open list with "Needs the GM's special approval" and send flagged; a Cleric or Friar offers only Lawful and Neutral (no Chaotic). `npm run pack:check` on setting A notes the Human's class table (a word, not a table: read as no limits) and that its lifted `byOption` changes `abilityModifiers` (not read; see the plan's scope check).

### M5b — the Rules library by kind (step 0d.2, 2026-11-02; lr-1 … lr-3)

iPad landscape first, then a 375 px phone. Use a library with both settings, an adventure and the zine overlay (homebrew, needs classic-advanced).
- [ ] Packs sit under **Setting rules · Adventures · Homebrew** with counts; the overlay is under Homebrew with "Needs: <setting>"; sort is by name, and **Sort: name** switches to last updated.
- [ ] Each row: name · the pack's description and Needs · what it holds ("kindreds" for fae-woodland's races where its creation guide calls them that) · "Used by <campaign> and N more" or "Not used by a campaign", version, date. No "About this file" on the row; Browse › About this file shows it.
- [ ] Browse and Update on the row; ⋯ holds Edit pack (homebrew only), Export as a pack file (a file is saved, named after the pack's id) and Delete from your library… (with "<campaign> uses it"); Delete still asks first.
- [ ] The chips filter to one kind; with one kind only, no chips; with 8 or more packs, the find field narrows by name or description; nothing found says so with Clear.
- [ ] While an import preview is open, tapping Browse or Update says "Save or cancel the file above first." (nothing greyed out).
- [ ] Phone: the description is dropped (Needs stays), the buttons wrap under the text, a long name wraps, Import a file is the bottom bar; nothing scrolls sideways.

### M5b — campaign set-up on the shell (step 0d.3, 2026-11-02; lr-5, lr-6)

iPad landscape first, then a 375 px phone. Use a library with both settings, an adventure that needs one of them and the zine overlay (homebrew, needs classic-advanced); for a clash, two packs whose options share a `ruleKey` (the overlay's encumbrance options and classic-advanced's, or the layout page `/layout.html?as=gm&library=1`).
- [ ] **Step 2:** Start a new campaign → name → Next: setting rules. The title bar says "Setting rules · Step 2 of 3"; packs sit under Setting rules · Adventures · Homebrew, each heading saying how it's picked; the chips filter; Next is the only red button; Import a file… is quiet in the foot.
- [ ] **The ✓ slot** picks and unpicks in one tap; the hint says "1 picked" or "N picked · where two have the same entry, the one on top wins".
- [ ] **A row** (its name) opens the pack's entries full screen with Pick <pack> at the foot; Pick closes it and the ✓ is on.
- [ ] **A missing base:** pick the adventure (or the overlay) alone: its row says "Needs: <setting>."; the hint and Next's message say "<pack> needs <setting> · pick it, or leave it out."; Next stays on the step. Pick the setting: the row says "needs <setting> ✓" and Next goes on.
- [ ] ~~**Step 3:** one group per pack, "<pack> · N rules · none changed", the first open; a pack without optional rules says "· none" and doesn't open; Show all shows the rest; each row says the pack, page and when it can change in words.~~ *(superseded 2026-11-03, tf-5 no Show all, tf-7 the App section: see *rules rows that stay put*, *shared rules and the App section*)*
- [ ] **Change** an On / Off rule and a many-choice rule (its › sheet): the group's line says "2 changed"; fold and open it: the changed ones come first.
- [ ] ~~**A clash:** with two packs offering the same rule, one callout at the top says "Two packs offer a <topic> rule", each pack's choice as a link, and "Now: <pack on top> · <choice> (on top)"; inside the groups that rule says "Decided above · …" with no buttons. (Which choice the campaign uses: the follow-up's checks below.)~~ *(superseded 2026-11-03, tf-1 one card of every pack's choices: see *shared rules and the App section*)*
- [ ] **Reset to the books' defaults:** everything goes back, the toast says "Back to the books' defaults"; Undo puts the changes back. Create campaign: the campaign's Rules tab shows the choices made.
- [ ] **Phone:** groups' names wrap beside the ▸; segments drop under the text; the callout stays one block; nothing scrolls sideways.

### M5b — one choice per `ruleKey` group (step 0d follow-up, 2026-11-02; 07 `ruleKey`)

iPad landscape first, then a 375 px phone. Use a setting pack and the zine overlay (homebrew) whose options share `ruleKey: encumbrance`, or the layout page `/layout.html?as=gm&library=1`.
- [ ] ~~**Set-up, the pick:** Start a new campaign, pick both packs, go to step 3. The callout says "Now: <overlay> · <its choice> (on top)". Tap the setting pack's choice in the callout and pick a choice in its sheet (or tap the one already ticked): the Now line reads "Now: <setting> · <choice> (your pick)" and the overlay's row in its group says "Decided above · <setting> · <choice>". Reset to the books' defaults: Now goes back to "(on top)"; Undo brings the pick back. Create campaign.~~ *(superseded 2026-11-03, tf-1: see *shared rules and the App section*)*
- [ ] **In play:** on a character's creation or sheet, the rule reads the pick (an AC style or creation method under a shared key follows the picked pack, not the one on top). The log line for the campaign's settings says "chose which pack's <topic> rule the campaign uses" when the pick was made after creation.
- [ ] **New choice for <topic>:** in a campaign with the setting pack alone, Campaign → Setting rules → add the overlay (accept its optional rules). A callout "New choice for <topic>" lists both packs' choices and "Now: <setting> · <choice> (kept)": nothing changed yet; the log says "added the setting rules <overlay>; a new choice for <topic> waits for you". Tap the overlay's choice: the notice says "<overlay> now decides <topic> for this campaign." and the callout goes. Leave the screen without tapping: the setting pack's choice still counts (the Rules tab's callout, build order 4, shows it as the pick).
- [ ] **Fall-back:** remove the pack that decides the topic: the log says "removed the setting rules <pack> from the campaign; the choice for <topic> falls back to the next pack", and the other pack's choice now counts.
- [ ] **Phone:** the "New choice for" callout wraps its buttons under the text; nothing scrolls sideways.
### M5b — Rules for this campaign on the new rows (step 0d.4, 2026-11-02; lr-7, lr-8)

iPad landscape first, then a 375 px phone. Use a campaign with classic-advanced and the zine overlay attached (both offer an encumbrance rule), or the layout page `/layout.html?as=gm`.
- [ ] **Folded with count lines:** Campaign → Rules. Every group is folded: "Characters · 3 settings · none changed", "Time and calendar · Starts at …", "Items and treasure · 2 settings · …", "Table and players · …", then "Optional rules · <pack> · N rules · N changed" for each attached pack (top of the stack first), then "Character fields · N fields" when there are fields. No red button on the screen.
- [ ] **Tablet:** open Characters, then an optional-rules group: both stay open. **Phone:** open one, then another: the first folds.
- [ ] ~~**A rule in place:** in a pack's group, the changed rules come first, the rest behind Show all; each row says what it does, the pack and page, and when it can change in words. Tap the other side of an "at any time" On / Off: it changes at once, the toast says "<rule>: <choice>" with Undo, and the group's count line goes up by one. Undo: it goes back and the count follows; the log has both lines.~~ *(superseded 2026-11-03, tf-2, tf-3, tf-5: see *rules rows that stay put*)*
- [ ] **Asks first:** a "can change, asks first" rule opens "Change <rule>?" (as before); Change to … changes it with Undo; Not now changes nothing.
- [ ] **Locked:** a "can't change once the campaign starts" rule's buttons stay tappable and the toast says why; nothing changes.
- [ ] ~~**A clash:** with two packs offering the same rule, one callout above the first pack's group says "Two packs offer a <topic> rule" and "Now: <pack on top> · <choice> (on top)"; inside the groups that rule reads "Decided above · …". A callout link opens that pack's rule in a sheet. (Which choice counts in play isn't built yet: 0d.3's scope check 1.)~~ *(superseded 2026-11-03, tf-1: see *shared rules and the App section*)*
- [ ] **Reset to the books' defaults** (the foot): with an "asks first" rule changed, it asks first, naming it; Reset puts every unlocked rule back, the toast says "Optional rules reset to the books' defaults" with Undo; Undo restores them.
- [ ] **Retire campaign…** is at the foot of Rules for this campaign, above the Setting rules heading, and no longer after the Setting rules list; its confirm, banner and Bring back are as before.
- [ ] **Setting rules' "Change rules for this campaign"** opens the optional-rules groups (the first one on a phone) and scrolls to them.
- [ ] **Phone:** long pack names wrap beside the ▸; segments drop under the text; nothing scrolls sideways.

### M5b — the players' activities (step 3, build orders 1–2 and 5, 2026-11-03)

GM on an iPad, a player on an iPad and an iPhone, a campaign whose day-by-day mode lists activities (one with a `yields` item that's in the setting rules, one with `onlyOnTerrain`, one secret).
1. [ ] **The button group:** iPad, player: Scene during the expedition, once the GM's device has started the day. Under "Around you: <terrain>" one group holds the activities by their own names, then Force march with ⓘ, 3 to a row, an odd last button centred. The secret one isn't there; one with `onlyOnTerrain` shows only on its terrain.
2. [ ] **Doing one:** tap an activity with a roll: the sheet shows who's acting (your character ticked), "Cost: 2 points", the roll ("Roll a WIS check") with each modifier and "· the rules", a Rolled box and "How many <item>?". Enter a roll, tap **It worked**: the toast reads "<Activity> · 2 points · 3 <item> → <name>'s pack"; the travel points drop by 2 and the item is in the pack.
3. [ ] **Undo:** tap Undo on that toast: the points come back and the item leaves the pack; the log shows "<you> undid <Activity>". Do it again, use one of the items, then try Undo from the log: "That's changed since…".
4. [ ] **The GM sees it live:** iPad, GM: the log line "<player> did <Activity> (…) · 2 points · 3 <item> → <name>'s pack" arrives; its Undo works for the GM too.
5. [ ] **Several and best of:** an activity with `who: several` and `bestOf`: pick two characters, enter 3 and 5: the item goes to the better roll's pack.
6. [ ] **iPhone (375 px):** the group is 2 columns, an odd last button centred across both; a long activity name wraps inside its button; nothing scrolls sideways; the sheet fits.
7. [ ] **Split party:** split the party; a player in the other group sees their own group's points and buttons only (the activity's log line is everyone's).

### M5b — the location view's phone sheet and empty state (bq-4, 2026-11-03; `m5b-1c-location-phone`)

GM on an iPad held landscape and on an iPhone, a player (in the party) on an iPad and an iPhone, the `m5b-creation` fixture pack (Fen trek). Start an expedition in Fen trek. Check light and dark mode.
1. [ ] **Empty state (iPad, GM):** before any move, the place card on the right reads **"Where are we?"** with **Set place** (never "Somewhere unnamed"). Tap Set place: Where now? opens. Type "Heron Jetty", Go there: the card reads "Heron Jetty", the button is **Where now?** again.
2. [ ] **iPad, no sheet:** GM and player on iPads (held either way): the place card (GM) and "Where you are" (player) stand on the page, as before; no Open card.
3. [ ] **Empty on a phone (iPhone, GM):** on a new expedition the place is a card "Where are we?" with "Set place ›" under it (with "Around them: …" once a move named the ground). One tap opens Where now?.
4. [ ] **The sheet (iPhone, GM):** after Move… to "Heron Jetty", the card reads "Heron Jetty" with "Around them: Bog · Nothing shown yet ›". Tap it: the whole screen shows **Where the party is** with ✕ top right, and the full place card (name, Around them, + Picture, Pieces, + Piece, Hide all, Where now?, Checks here, Notes once written). Add a piece, show it with its eye: the toast has Undo. Tap ✕: back on Scene, the card now says "1 of 1 piece shown".
5. [ ] **Pop-ups inside the sheet:** in the sheet, tap Where now?, then Escape on a keyboard (or ✕): only Where now? closes; the sheet stays. Same with a picture opened full screen.
6. [ ] **The player's sheet (iPhone):** with nothing shown, the player sees no place card at all. GM shows one piece and keeps a second piece and the picture hidden: the player's card reads "Heron Jetty" with the shown piece's words ›; tap it: **Where you are** with ✕, the name and the shown piece only (no hidden piece, no picture). GM shows the picture: it appears in the sheet.
7. [ ] **375 px and messy data:** a place named with 40 characters wraps inside the card and the sheet; nothing scrolls sideways; the ✕ is easy to hit.
8. [ ] **Offline (iPhone, GM):** Wi-Fi off, open the sheet, + Piece → Add: the error toast says what went wrong; the sheet stays open.
9. [ ] **The › on a phone (iPhone):** on the place's card and What we know's card, the › sits at the card's right edge, halfway down, never under the words; with the 40-character name the name wraps in two lines beside it. On the iPad the › still follows the summary's last word.

### M5b — location view: the place's picture, the two-column day, a move's checks on the card (step 1 follow-up, build orders 7 and 8, 2026-11-03)

GM on an iPad held landscape, a player (in the party) on an iPad and the same player on an iPhone, the `m5b-creation` fixture pack (Fen trek: routes Wild, Causeway; Going astray has `alsoWhen: leaveRoute causeway`). Start an expedition in Fen trek. Any photo on the GM's iPad will do for the picture.
1. [ ] **Two columns (iPad landscape):** GM, Scene: the time strip, the travel card (Move…) and camp sit in the left column; the place card ("Where are we?", Set place; bq-4) and the marching order in the right. Fold the left menu (the divider's handle): both columns widen. Turn the iPad to portrait: one column, the place card below the travel card.
2. [ ] **+ Picture:** GM: Move… → Bog, type "Heron Jetty", Move. The place card reads "Heron Jetty" with **+ Picture** ("From this device; hidden until you show it"). Tap it, pick a photo: "Uploading the picture…", then the toast "Picture added (hidden): Heron Jetty" and the picture across the card with a struck-through eye at its right and "Hidden: players see it once you show it." Tap the picture: it opens full screen, whole; close it.
3. [ ] **Undo and Take it off:** tap the toast's **Undo**: the picture goes, **+ Picture** is back. Add it again; tap **Take it off**: it goes at once with an Undo toast; Undo brings it back.
4. [ ] **The picture's own eye (player's iPad; ruled B):** with the picture on and nothing shown, the player's Scene shows nothing of the place. GM: + Piece → "A rotten jetty over black water" → Add, then tap its eye: the player sees "Heron Jetty" and the line, **no picture**. GM: tap the **picture's** eye ("Shown to the party: the picture"): the picture appears under the name (tap: full screen). Tap it again: it goes. Show it again, then **Hide all**: the place and picture go. Show the picture, Where now? → somewhere else, then Where now? → "Heron Jetty": the picture is back ("… shown again").
5. [ ] **Another group sees nothing:** split the party (the player's character in a group of its own), show the picture to Group 1 only: the split-off player sees no picture.
6. [ ] **A move's checks on the card:** GM: Move… → Bog, Route **Causeway**, "Moss Landing", Move: no check line. Move… again: tap **Causeway** to let go of it, Bog, "Reed Hollow", Move: the toast ends "On the card: Going astray", and the time strip's card has "Going astray · Left the Causeway" with **Hit** and **Miss**. Tap the toast's Undo: the line goes with the move. Move again and tap **Miss**: the toast "Going astray · Left the Causeway: a miss"; the log has the check.
7. [ ] **375 px (iPhone, as the player):** the picture fits the width under the place's name; nothing scrolls sideways. As the GM on an iPhone: the place's Open card comes below the travel card, and its tap opens the place card (with its picture) as a sheet (bq-4, below).
8. [ ] **Offline:** GM, Wi-Fi off, + Picture: the toast "Couldn't upload the picture. Check your connection and try again."; nothing changes on the card.

### M5b — the ✕ on full-screen pop-ups, and a forced march with no camp (ruled B, 2026-11-03)

GM on an iPad, a player on an iPhone (375 px), the `m5b-creation` fixture pack (Fen trek: a forced march, a rest rule, a camp; its encounter tables). Check light and dark mode.
1. [ ] **Tables › (iPad, GM):** Scene → **Tables ›**: the full-screen list has the ✕ at the top right of its bar and no ‹ at the left. Tap a table: now ‹ (Back) at the left and the ✕ at the right. ‹ goes back to the list; open the table again and tap ✕: the whole thing closes, back to the Scene. Escape (a keyboard) closes it too.
2. [ ] **Which table? (iPad, GM):** in a turn mode, a check's **Hit**: the Which table? screen has only the ✕ (top right). Open a table, tap a row (it's recorded), tap ‹: back to the list; tap ✕: back to the Scene with the hit still open.
3. [ ] **A pack's entries (iPad, GM):** New campaign → Setting rules → tap a pack row: its entries open full screen with the ✕ at the top right and no ‹.
4. [ ] **iPhone 375 px, dark mode:** repeat 1: the ✕ sits at the right of the bar, a long table name wraps beside it and never runs under it; the ✕ is easy to hit (44 px); nothing scrolls sideways.
5. [ ] **Forced march, no camp (iPad):** start an expedition in Fen trek. Player: **Force march**. GM: **Next day** without making camp: both characters in the group get the pack's rest condition (Weary in the fixture); the log has one rest line for the group.
6. [ ] **Undo:** GM: the strip's **Undo**: the condition comes off both again.
7. [ ] **With a camp (as before):** Force march again, then ⋯ → **Make camp**: the Sleep step says "Rest due (forced march)"; the player taps **Rest**; GM: Next day: the player's character gets no condition, the one left unanswered does.
8. [ ] **No forced march:** a day with no Force march and no camp: Next day gives no condition.

### M5b — camp follow-up: a forced march's rest in camp's Sleep step (SC-4-3 A, 2026-11-03)

GM on an iPad, two players (each in the party) on an iPad and an iPhone, the `m5b-creation` fixture pack (Fen trek: a forced march of half again, a rest rule every 6 days, a camp with a Sleep step). Start an expedition in Fen trek.
1. [ ] **No prompt at the march:** iPad, player: tap **Force march** on the travel card: the toast "Forced march · +N points · rest due this evening"; **no** rest prompt opens under the time band, and the strip's marker still counts down ("Rest day in 6").
2. [ ] **Rest due at camp:** GM: ⋯ → **Make camp**. Both players: the Camp card's **Sleep** step starts with "ⓘ Rest due (forced march)", and the rest prompt (Rest / Push on) opens with the same note. Player 1 taps **Rest**, player 2 taps **Push on**; the GM's panel shows "☾ Resting" and "→ Pushing on".
3. [ ] **Next day applies it:** GM: Next day: the card's rest line names the rest; player 2's character gets the pack's rest condition (Weary in the fixture), player 1's doesn't; the prompt and the Camp card go.
4. [ ] **A group that didn't march:** Undo the move, undo the camp; Next day; Make camp again without a forced march: the Sleep step has no "Rest due (forced march)" and no rest prompt opens.
5. [ ] **Undo of the march:** Force march again (player), then Make camp (GM): the line and the prompt show. GM: Log → the forced march's Undo: the line and the prompt go on the GM's screen at once and on the players' at their next reload (any log line, or coming back to the app).
6. [ ] **Split party:** split the party; only the group whose player tapped Force march gets the line and the prompt at camp; the other group's camp has neither.
7. [ ] **375 px (iPhone):** the note wraps inside the Sleep step; nothing scrolls sideways.

### M5b — camp, part 2: watches, Which watch?, sleep, Next day (step 4, build orders 5–7, 2026-11-03)

GM on an iPad, two players on an iPad and an iPhone, the `m5b-creation` fixture pack (Fen trek's camp: watches of 2 hours, Night prowlers, a sleep rule that is Easy by a lit fire and Hard without). Make camp first (part 1, check 1).
1. [ ] **Watches:** iPad, player: Set watches reads "Each watch: 2 hours · the night's length is the GM's call" (the fixture has no daylight table). Since fewer links PR 1 the step is laid out by watch: see that section's checks 1–5.
2. [ ] **Three at most:** see fewer links PR 1, check 3 (a full watch hides its + Add).
3. [ ] **Casters on watch:** put a caster (a class with spells) on a watch: "Casters on watch: <name>".
4. [ ] **Sleep:** with the fire lit (part 1, check 3), each character reads "· Easy" and "Fire lit", "A good rest, no roll". Let the fire burn out (Advance by… 5 hours) or skip the firewood: "· Hard", "No fire", "Roll WIS · −1 Hard", a roll box, **Slept well** / **Slept badly**. Enter 4, tap Slept well: "✓ Slept well".
5. [ ] **The GM changes the difficulty:** GM: under each character, the difficulty chips; tap Easy on a Hard one: it reads "· Easy (changed by the GM)".
6. [ ] **Which watch?:** GM: Next day; when Night prowlers hits (enter a hit), its Encounter waiting card asks **Which watch?** with "1st · <names>" chips; tap one: "Awake: 1st watch · <names>", with Undo.
7. [ ] **Next day applies camp:** the GM's card gets "Camp · fire out · 2 bundles used · didn't eat: <name> · slept well: <name>"; the Camp card leaves every screen and the players' activity buttons come back. Undo the move (the card's Undo): the camp is back, open, as it was.
8. [ ] **375 px:** the watch boxes stack and their chips wrap; the roll box and both buttons wrap; nothing scrolls sideways.

### M5b — camp, part 1: the campfire, cooking, campfire talk, eating (step 4, build orders 1–4, 2026-11-03)

GM on an iPad, a player on an iPad and an iPhone, the `m5b-creation` fixture pack (its Fen trek mode has a camp: Reed fire burning Reed bundles, Bog eel cooking, the hunger note). Give the player's character 3 Reed bundles, 2 Bog eels and 1 Dry rations first (or gather Reed bundles with Cut reeds).
1. [ ] **Make camp:** iPad, GM: start an expedition in Fen trek; open the time strip's ⋯: **Make camp** ("The players work through the camp's steps"). Tap it: the toast "Camp made" with Undo; under the travel card, **Camp** lists Pitch camp (with its note), Campfire, Cooking, Campfire talk, Eat, Set watches, Night prowlers, Sleep, in that order. Undo: the card goes.
2. [ ] **The players' screen swaps:** iPad, player: the activity buttons and Force march are gone; the same Camp card is in their place. Another group's player (split the party first) sees no camp.
3. [ ] **Firewood:** player: Campfire reads "Reed fire · Not lit yet". Tap **Add firewood from packs**: "Reed bundle ×3 · <name>" with − 1 +. Set 2, tap **Put on the fire**: the toast "2 bundles on the fire · from <name>'s pack" with Undo; the line reads "Reed fire · Burning · 4 hours left"; the pack has 1 bundle. Undo: back to 3 and "Not lit yet".
4. [ ] **Cook:** tap **Cook**: the note "One eel feeds two.", "Bog eel ×2" with a stepper at 0 and "0 portions". Set 1: "2 portions". Tap Cook: the toast "<name> cooked · 2 portions in the pot"; Cooking reads "The pot · 2 of 2 portions left" and "A portion also gives: Heal 1". Tap Cook with nothing picked: "Pick what to cook first."
5. [ ] **Eat:** tap **Eat** beside your character: "A portion from the pot (cooked)" first, marked Suggested, with "Also: Heal 1", then "Bog eel ×1 (fresh)", then "Dry rations ×1 (preserved)". Tap the portion: the row reads "✓ Ate a portion"; the pot "1 of 2". The hunger note shows under Eat.
6. [ ] **The GM sees who hasn't eaten:** GM: under Eat, "Not eaten yet: <the others>", and an Eat button for each character. Eat for a player without a device: it's logged as the GM's.
7. [ ] **Nothing to eat, Give food:** GM: a character with no food: Eat opens "<name> has nothing to eat." and **Give food** with the others' food lines; tap "Give 1 to <name>": the toast says who gave what; the sheet now offers it to eat.
8. [ ] **Campfire talk:** player: tap **It worked**: "<name> led it · it worked" on both devices.
9. [ ] **Undo refused when it should be:** after a portion is eaten, Undo the cooking from the log: "Some of those portions were eaten: undo the meals first." Undo the meal, then the cooking: both go.
10. [ ] **Quick camp:** turn the fixture's quick camping on (if your pack has `camp.quick`): ⋯ shows **Quick camp**; tap it: the card reads "Quick camp: one tap, as the optional rule says. The night passes on Next day."
11. [ ] **375 px:** iPhone: the steps, the steppers and the buttons wrap with no sideways scroll; a long character or item name wraps; every button is a 44 px tap.

### M5b — options that behave: the small ones (options-gates PR 4, 2026-11-04; of-4, of-5, of-6 with bq3-15, of-11)

GM on an iPad, a player on an iPad and an iPhone. Import `scripts/fixtures/options-gates-4.fixture.json` (Fen small options) into a new campaign and attach it; Ways out of the dark starts at Escape roll, Odds and ends at No.
1. [ ] **The stepper (iPad, GM):** Scene › Start expedition in Creeping › Leave the dungeon. The pop-up's stepper is labelled "levels below the first" and its line reads "1 level below the first: −1"; tap + and it reads "2 levels below the first: −2". Ask for escape rolls: the player's card says "2 levels below the first: −2".
2. [ ] **Safe paths only (iPad, GM):** Rules for this campaign › Ways out of the dark › Safe paths. On Scene, Leave the dungeon is still there; its pop-up says "Your rules have no escape roll: the party leaves by safe paths.", with no stepper and no Ask for escape rolls. Tap **Use safe paths**: "Follow the chalk marks back; it takes an extra turn." shows. Close it; ⋯ › End expedition ends at once with its summary (no pop-up first).
3. [ ] **Fewer spells than the count (iPhone, player):** make a Bog singer. Its Magic step shows the given Reed spark and a known-spells group "pick 1" with the line "Only 1 cantrip at this level in your packs (your class gets 2): pick it." and Frog hum. Pick it: the foot says all picked and Next goes on. Check the words at 375 px: the line wraps, nothing is cut.
4. [ ] **A pick under an option (iPad, player):** with Odds and ends at No, the Gear step shows Reed rope under Given and no pick group. GM: Odds and ends › Yes; the player reopens Gear: "Pick up to 2 · Odds and ends" with "0 of 2 picked · roll d4 or choose". GM: The odd table › No: the pick group is gone.
5. [ ] **A modifier behind an option (fae-woodland, after the pack session moves the weather effects' penalty behind its option):** weather effects off, a foggy day: the lost check's prompt shows no poor-visibility line and its chance is the terrain's alone; on, the line and the extra face are back.
6. [ ] **The checker (terminal):** `npm run pack:check -- scripts/fixtures/options-gates-4.fixture.json` reports no format notes.

### M5b — options that behave: add-ons, a later change of the carrying rule, presets (options-gates PR 5, 2026-11-04; bq3-13: A1, A3, A8)

GM on an iPad, then an iPhone. Import `scripts/fixtures/options-gates-5-requires.fixture.json` (Lantern fen, setting) and `scripts/fixtures/options-gates-5-overlay.fixture.json` (Reed hymnal, homebrew).
1. [ ] **Set-up, add-ons (iPad):** start a new campaign, pick both packs, Next. Lantern fen's group reads "3 rules"; no Reed chorus, no Echo verse; Reed hymnal's group says "· none". Lantern songs › On: Reed chorus appears in Lantern fen, Night hymns in Reed hymnal. Reed chorus › On: Echo verse appears. Lantern songs › Off: all three go.
2. [ ] **Set-up, preset (iPad):** in Lantern fen's open group, "Presets · First night in the fen" › the pop-up "Use First night in the fen?" lists Carrying: Not tracked → By coin weight, Lantern songs: Off → On, Bog oaths: Off → On. Use it: a toast "First night in the fen: 3 rules changed" with Undo; the Carrying row shows By coin weight (the pack's row; the app's own Encumbrance row isn't shown while a pack option sets the load method, ruled 2026-11-05). Undo: back as before. Use it again, Create campaign.
3. [ ] **Switching a parent off (iPad):** Rules › Optional rules · Lantern fen: Reed chorus › On, Echo verse › On; Reed hymnal › Night hymns › On. Lantern songs › Off: the toast reads "Lantern songs: Off · Night hymns: Off · Reed chorus: Off · Echo verse: Off"; the three rows go. The log has one line: "… changed the optional rules of Lantern fen and Reed hymnal." Undo: all four are On again, one more log line.
4. [ ] **The carrying rule later (iPad):** a character carries a Bog anchor and a Reed lamp. With Carrying at By coin weight, the Pack shows its load by coin weight (the anchor and the lamp, 270). Carrying › Not tracked: it asks first, "The load method becomes Not tracked: every character's load is read again."; Change: the Pack shows no load; the log line ends "; the load method is now Not tracked." Undo: the load is back.
5. [ ] **Preset in play (iPad):** set Lantern songs and Carrying back to their defaults, then Presets · First night in the fen: the pop-up lists the two rules and "The load method becomes Coin weight…", and "Bog oaths stays as it is: it can't change once the campaign starts." (only if Bog oaths is Off). Use: one toast with Undo.
6. [ ] **Retired (iPad):** in a retired campaign, a preset says the campaign is retired and changes nothing.
7. [ ] **375 px (iPhone):** the Presets row wraps under its label with a long preset name; the preview pop-up scrolls with no sideways scroll; every button is a 44 px tap.

### M5b — options that behave: patches applied in the app (options-gates PR 3b, 2026-11-04; of-13, of-14)

GM on an iPad, a player on an iPad and an iPhone. Import `scripts/fixtures/options-gates.fixture.json` (the Fen options) and `scripts/fixtures/options-gates-3b-materials.fixture.json` (the Mire materials overlay, homebrew), attach both; Ordinary metal starts at Steel.
1. [ ] **Import (iPad, GM):** the overlay's preview counts "patch: 8", with no "isn't a part" line; in the library its entries list eight patches named like "mire-metals=bronze · item armour".
2. [ ] **A player's device gets them (iPad, player):** sign in as a player of the campaign; the Rules browser's Mire materials lists the patches too (it's a kind players read).
3. [ ] **Bronze (iPad, player):** a character wears a Waxed coat and holds an Eel knife. Rules for this campaign › Ordinary metal › Bronze. Player screen: AC drops by 1; tap AC: "Waxed coat: 12", then "AC +1 · Bronze, Mire materials" and "AC −1 · Bronze, Mire materials". Pack › Add item: Eel knife costs 20 gp (×10); open it: "Changed by your rules: Price ×10 · Bronze, Mire materials".
4. [ ] **Bone (iPad, player):** Ordinary metal › Bone. At hand, the knife's line reads "… 1d4−1 · Damage −1 · Bone, Mire materials"; AC drops by 2 (two patches add); the coat's sheet says its type is hide.
5. [ ] **Stone removes shields (iPad, player):** with Bronze, add and hold a Reed shield; switch to Stone: the shield's row stays, "Off · Stone" first on its sub-line, nothing deleted; tap it › Put it on: a toast says it's off under Stone. Back to Steel: the marker goes.
6. [ ] **The checker (terminal):** `npm run pack:check -- scripts/fixtures/options-gates.fixture.json scripts/fixtures/options-gates-3b-materials.fixture.json`: "patches: 8"; "The 2 packs together" says patch #8's `armour.ac` matches an entry without that field, and patches #1 and #2 name the base's Bog-iron coat as lacking an armour block; nothing about the Waxed coat.
7. [ ] **375 px (iPhone):** the Pack row with "Off · Stone" and the At hand line with the Damage line wrap under the name; no sideways scroll.

### M5b — options that behave: lists and patches (options-gates PR 3, 2026-11-04; of-12, of-13's checker)

GM on an iPad, a player on an iPad and an iPhone, a campaign with the invented Fen options pack (`scripts/fixtures/options-gates.fixture.json`, re-imported: it gained a Powder horn and a Bog lamp) attached. Powder age starts at No guns.
1. [ ] **Behind several choices (iPad, GM):** the Pack › Add item: search "Powder horn": nothing. Rules for this campaign › Powder age › Wheel guns: Add item now finds Powder horn at 5 gp; Flint guns: still found, at 3 gp. Back to No guns: gone again.
2. [ ] **A key with several choices (iPad, GM):** with No guns, Add item lists Bog lamp at 2 gp. With Wheel guns or Flint guns, Bog lamp has no price (its `byOption` key names both choices).
3. [ ] **A character keeps it (iPad, player):** with Wheel guns, add a Powder horn to a character; the GM sets No guns: the horn still shows by name in the Pack.
4. [ ] **The checker (terminal):** `npm run pack:check -- scripts/fixtures/options-gates.fixture.json scripts/fixtures/options-gates-3-patches.fixture.json`: the second pack's counts include "patches: 2" with no "isn't a part" line; its Format notes say the Spark lance names choice "relics", which isn't one of its option's choices; "The 2 packs together" says patch #2's match finds nothing (category "shield").
5. [ ] **375 px (iPhone):** Add item's Powder horn and Bog lamp rows fit; no sideways scroll.

### M5b — options that behave: extends and one switch (options-gates PR 2, 2026-11-04; of-1, of-2)

GM on an iPad, a player on an iPad and an iPhone, a campaign with the invented Fen options pack (`scripts/fixtures/options-gates.fixture.json`) and the invented Reed overlay (`scripts/fixtures/options-gates-overlay.fixture.json`) both imported and attached, the overlay on top.
1. [ ] **One row (iPad, GM):** Rules for this campaign › Optional rules · Invented options sample: **Carrying** reads "Not tracked · 1 of 3 ▾". Tap it: the pop-up lists "Fen options" with Not tracked and By coin weight, then "Reed zine" with Reed slots and its words.
2. [ ] **No twin (iPad, GM):** Optional rules · Invented reed overlay lists Wet boots only: no Reed slots row.
3. [ ] **Choose the overlay's way (iPad, GM, then a player):** tap Reed slots: the toast "Carrying: Reed slots" with Undo; the row reads "Reed slots · Reed zine" and "changed (the book: Not tracked)"; the log has the change. Undo: back to Not tracked. (The Pack's load method set at creation doesn't follow a later change: audit A3, not this PR.)
4. [ ] **The overlay gone (iPad, GM):** with Reed slots chosen, Setting rules › remove the Reed overlay: Carrying reads Not tracked again, with 2 choices (a segmented control: Not tracked · Coin weight).
5. [ ] **At set-up (iPad, GM):** New campaign › pick both packs › step 3: the same one Carrying row with the pack names in its pop-up; pick Reed slots, create: the campaign starts with slots.
6. [ ] **An empty level (iPad, player):** a pack whose caster's cantrips come from a level no attached pack fills (in the private packs: classic-advanced alone with cantrips on), Create your character › a caster › First spells: the Cantrips group says "No spells at this level in your packs." with no count; pick the rest: Next goes on, and the hint counts only the spells picked.
7. [ ] **375 px (iPhone):** the Carrying pop-up's pack names and long choice names wrap; the empty group's line wraps; no sideways scroll.

### M5b — options that behave: the shared reader (options-gates PR 1, 2026-11-03; of-3, of-9, of-10, bq2-1)

GM on an iPad, a player on an iPad and an iPhone, a campaign with the invented `scripts/fixtures/options-gates.fixture.json` pack (Fen options) imported and attached. Its options start at their defaults (Powder age: No guns; the rest Off).
1. [ ] **Guns by era (iPad, player):** Pack › Add item: search "gun": nothing. GM: Rules for this campaign › Powder age › Wheel guns. Player (reopen Add item): **Wheel gun** is there, **Flint gun** isn't. GM: Flint guns: now only Flint gun.
2. [ ] **A class behind an option (iPad, player):** Create your character › Guided: the class list has **Lantern Warden** only. GM: Powder age › Flint guns. Player, new character: **Powder Bailiff** is offered too.
3. [ ] **The kit (iPad, player):** a Lantern Warden at Gear: no **Warden's reed kit**. GM: Reed kits › On. Gear offers it.
4. [ ] **Staff and coat (iPad, player):** a Lantern Warden's Pack: add a **Reed staff** and tap In hand: refused ("Lantern Warden can't use Reed staff."). GM: Warden staves › On; the player re-opens the Pack: In hand works, and the staff's price in Add item reads 3 gp (1 gp with the option off). Same with **Bog-iron coat** and Heavy coats for wardens: refused off, worn on.
5. [ ] **A field behind an option (iPad, player, then the GM):** Moon marks Off: the full sheet and the Player screen show no Moon mark; creation never asks it. GM: Moon marks › On: creation has the Moon marks step, and the sheet shows the field. Pick one, save. GM: Moon marks › Off: the field is gone from the sheet, the Player screen and the character cards; edit and save the sheet (change the notes). GM: On again: the moon mark picked earlier is still there.
6. [ ] **Rules row says what it adds (iPad, GM):** Rules for this campaign › tap **Moon marks**' name: the words end "Adds a field: Moon mark." Powder age's don't.
7. [ ] **The rules browser and the GM reference (iPad, GM):** with Powder age at No guns, Setting rules' browser and the GM reference's Equipment list no gun and Classes no Powder Bailiff; at Flint guns they list the Flint gun and the class.
8. [ ] **A race's score changes under an option (bq2-1):** with a pack whose race has `byOption` changing `abilityModifiers` (the creation fixture's tests use an invented one): with the choice on, the race's pop-up at Kindred shows the extra change and the score strip after the pick adds it; off, only the race's own.
9. [ ] **375 px (iPhone, player):** Add item, the class list and the sheet with Moon mark on and off: no sideways scroll; nothing else moves when a field disappears.

### M5b — secret activities and What we know (step 3, build orders 3–4, 2026-11-03)

GM on an iPad, a player on an iPad and an iPhone, the `m5b-creation` fixture pack (its Fen trek mode has Cut reeds, open, and Scout ahead, secret) or any pack with a secret activity.
1. [ ] **The request button:** iPad, player: Scene during the expedition, once the day has started. In the button group, "Scout ahead · 3 points" sits with the open activities and Force march, in the pack's order. Tap it: the sheet shows who's acting (you ticked), "Cost: 3 points", **Ask the GM** and Cancel (no line about the GM's roll: tfw-2, 2026-11-19).
2. [ ] **Ask:** tap Ask the GM: the toast "Sent to the GM: Scout ahead"; the Scene's request card reads "Sent to the GM · Cancel" with "Scout ahead"; the button now reads "Scout ahead · waiting for the GM"; tapping it again only says "Already asked: the GM hasn't answered Scout ahead yet." Another player of the same group sees none of it (no card, no log line); their button still offers the activity.
3. [ ] **The GM's card:** iPad, GM: "N waiting · Players ›" under the turn area; Waiting for you shows "<name> asks: Scout ahead · 3 points", the roll line ("Roll a WIT check") with its modifiers and "· the rules", "On a hit: They learn what lies…". Tap **Hit**: the toast "Hit recorded for Scout ahead" with Undo; the GM's log has "recorded Scout ahead · <name>: a hit"; the player's log doesn't.
4. [ ] **Yes with the cost:** type a note, tap **Yes**: the toast "Yes to <name> · 3 points" with Undo; the group's points drop by 3 on both devices; the player's card reads "The GM says Yes" with the note, then Got it. The GM's log: "answered <name> Scout ahead: Yes · 3 points · <note>"; the player's log has the same line; the other player's has nothing.
5. [ ] **Undo:** tap Undo on the GM's toast (or the log line): the points come back and the request waits again. Answer **No**: no points move.
6. [ ] **All of today's points:** a pack activity whose cost is `all`: the button reads "… · All of today's leagues (N)"; Yes takes what's left; "0 of N".
7. [ ] **What we know, empty:** iPhone, player: under the marching strip, the card "What we know · Nothing shared yet"; tap: the panel says "Nothing shared yet. Places and maps the GM shows you gather here." Close.
8. [ ] **What we know, filled:** GM: on the place card, Show players on a description piece; the player's card now reads "What we know · 1 place"; the panel lists the place with that piece. Move the group on (Move…) and show a piece there: "2 places", both listed in the order visited. Hide the first piece: "1 place". A player in another group sees none of it.
9. [ ] **Earlier expeditions:** End expedition, Start expedition again: the card reads "What we know · Nothing shared yet · 1 earlier"-style ("1 earlier"); the panel's "Earlier expeditions · 1 place" fold is closed; tap it: the place and its piece. Show a piece of that same place now: it moves up to the open list and leaves the fold.
10. [ ] **375 px:** the request button's words wrap inside the button; the sheet and the panel fit without sideways scroll; long place names wrap; the fold's line is a 44 px tap.

### M5b — travel: Move…, the budget, Lost (step 1, 2026-11-03)

GM on an iPad, a player on an iPhone, a campaign whose wilderness rules have a travel budget.
1. [ ] **The budget:** iPad, GM: Start expedition in the day-by-day mode. Under the time strip the travel card reads "<name> N of N" (worked out from the slowest character's load tier), pips below it; tap the number: the breakdown names the slowest member.
2. [ ] **Move…:** tap Move…, pick a route and a terrain, type "The Sunken Causeway", read the cost line and the check chances; Move. The toast says "Moved into The Sunken Causeway · N points" with Undo; the place card now shows that place; the pips drop. Undo: both go back.
3. [ ] **Shortfall:** Move… with a cost above what's left: the toast and the card read "Entering <place> · N more tomorrow"; the place card still shows where the group was. Next day: a toast "Day 2 · <name> M · … arrived at <place>"; the place card shows it; the pips show the owed points already spent.
4. [ ] **Riding:** tap Riding; with no riding speed in the pack a pop-up asks for the number; Set by hand… sets the day's number; the breakdown says "Set by the GM".
5. [ ] **Force march:** iPhone, a player of the group: Scene shows "<name> N of M", "Around you: <terrain>" after a move, and Force march with ⓘ. Tap Force march: the toast says "+N points · rest due this evening"; the rest prompt opens for the group; tap it again: "already forced the march today". The GM's log has the line and Undo.
6. [ ] **Lost:** GM: Mark lost. The Lost card shows "Lost since day N · finding the way: <chance>", Found the way / Still lost. A player sees no Lost symbol (Getting lost is Secret). Rules for this campaign → Table and players → Getting lost: Open. The player now sees "Lost" and the roll line; they enter a roll; the GM taps Found the way; the card goes.
7. [ ] **Split party:** each group has its own travel card and budget; a forced march in one group leaves the other's shortfall alone.
8. [ ] **The log:** Day start, Move…, forced march and Lost lines read plainly for the GM; a player's log shows none of them.

### M5b — the selected state and one Close (test feedback 2026-11-03, part 1; tf-4, tf-8)

The GM's iPad (landscape), both light and dark (Settings, Theme); then a 375 px phone.
- [ ] **Selected wash:** Rules for this campaign: an On / Off rule's chosen side is a pale rose wash with a dark red edge and dark text (dark mode: a brown wash, copper edge, light text), never solid black. A multi-choice rule's pop-up: the chosen strip has the same look and keeps its ✓; every strip runs the pop-up's full width.
- [ ] **Everywhere else:** the same look on chips (a character's + Status durations), the theme toggle, creation's Picked ✓ and its picked row, Add item's chosen destination, the GM reference's pack switcher, and the current tab in the menu (bottom tabs on a phone, the top tabs in portrait, the left column in landscape).
- [ ] **Close:** open any pop-up (a status, Keep lit's ⓘ, Join up, the travel breakdown, a creation entry on a phone): a bare ✕ at the top right, no Close button at the foot; tap it, the pop-up closes. Escape still closes. The log sheet shows ✕ at the top right instead of "Close"; a swipe down still closes it.
- [ ] **Player messages:** a player opens Messages: no "‹ Close" in the bar; the sheet's ✕ closes it. A disappearing message still has its own "Close" under it.
- [ ] **Inline Close:** Rules and packs, a pack's optional rules: ✕ at the panel's top right. End expedition: "Expedition ended" with ✕ at its right. A compact marching order: ✕ in its header.
- [ ] **Phone (375 px):** a pop-up with a long title wraps beside the ✕; the ✕ is never pushed off the card.

### M5b — the GM reference and compose (test feedback 2026-11-03, part 4; tf-9, tf-10, tf-11)

The GM's iPad (landscape), classic-advanced and fae-woodland attached (any two packs with optional rules); then a 375 px phone.
- [ ] **The list:** the top row's open book: the panel list is a narrow column at the left (220 px), every name left-aligned, under **From the rules** (Combat, Dungeons, Class abilities, Equipment, Tables) and **The book's GM pages** (the pack's own panels). No "pack" or "adventure" tag anywhere.
- [ ] **Values in words:** Combat → Initiative: under "With optional rules" each line reads like "Initiative ties · Act at the same time", never "initiative-ties=simultaneous". Death and dying the same.
- [ ] **The switcher:** with two packs, the pack buttons wrap onto a second line when the names are long; the open pack is in the Selected wash.
- [ ] **Compose (GM):** ✉ → New message: Attach and Send sit together at the right, their bottoms level with the message box's. On a phone they sit under the box, Attach first, Send filling the line, nothing off the screen.
- [ ] **Setting rules:** Rules and packs → a pack's optional rules: the text never runs under the ✕.
- [ ] **Phone (375 px):** the reference is the list first, a panel full screen; no sideways scroll.

### M5b — rules rows that stay put (test feedback 2026-11-03, part 2; tf-2, tf-3, tf-5)

The GM's iPad (landscape), a campaign with classic-advanced (or the m5b-creation fixture pack) attached; then a 375 px phone.
- [ ] **No Show all:** Rules, open a pack's optional rules: every rule shows at once, the changed ones first. No Show all anywhere.
- [ ] **Rows stay put:** toggle two rules near the bottom: neither moves; each says "changed (the book: …)" in its source line at once, and the count line updates. Fold the pack and open it again: the changed rules are now at the top.
- [ ] **Segments:** a rule with 2 or 3 short choices (On / Off, or three short labels): side by side, the chosen one in the Selected wash. Its description is behind ⓘ beside the name; ⓘ shows it with each choice in words.
- [ ] **The ▾ button:** a rule with 4 or more choices, or a long choice name without a short label: one button with the current choice, "1 of N" and ▾; a tap opens the choices; picking one closes it and the button shows it.
- [ ] **Campaign creation:** New campaign, the Optional rules step: the same rows, the same behaviour.
- [ ] **Phone (375 px):** the control goes under the text, full width; a long choice name wraps inside the button; no sideways scroll.
- [ ] **pack:check:** `npm run pack:check -- <a pack with a three-way option and long names>` notes it "has 3 choices, some long and without a short label".

### M5b — shared rules and the App section (test feedback 2026-11-03, part 3; tf-1, tf-7)

The GM's iPad (landscape): classic-advanced and fae-woodland (or the two keyed fixtures, `scripts/fixtures/m5b-0d-keyed-a/b.fixture.json`) in your library; then a 375 px phone.
- [ ] **One card:** New campaign, pick both packs, Next: at the top a card "<Topic> · two packs offer it; one choice counts." with each pack's name and its choices under it as full-width strips. The pack on top has its choice ticked (✓, Selected wash); nothing else is ticked.
- [ ] **One tap:** tap a choice under the other pack: it's ticked at once, the first pack's tick goes, and that pack's own row in its group says "Decided above · <pack> · <choice>". Create campaign, then Rules: the same card shows the same pick.
- [ ] **In play:** Rules, the card: tap a choice of a rule that can't change once the campaign starts: a message says why and nothing changes. A rule that asks first asks.
- [ ] **App section:** New campaign's Optional rules step opens with **App · N settings · none changed**, folded. Open it: the same rows as Rules → Characters, Items and treasure, Table and players (New characters need approval, New characters start at, Companies with ⓘ …). Turn Companies off: the count says 1 changed. Create campaign: Rules → Table and players shows Companies off.
- [ ] **Phone (375 px):** the card's strips run full width; long pack names wrap; no sideways scroll.

### M5b — Encounter waiting (step 2, 2026-11-03; D11, S2-4)

The GM's iPad (landscape) and a player's device, a pack whose mode has a wandering check that rolls a table (the m5b-creation fixture pack, or any invented one; the layout harness `/layout.html?as=gm&tables=1` works too); then a 375 px phone.
- [ ] **A hit queues one card:** Start expedition, Next turn until the wandering check is due, tap **Hit**. Which table? opens as before; tap the likely table and the rolled row, Back, Back, Done. Under the hit area the console shows one card **Encounter waiting** · the check's name · the row ("Mortal: Pilgrims… · 1d4 · Turn 3"). No extra tap was needed for the card.
- [ ] **No row yet:** another hit where you Back out of Which table? without tapping a row: a second card on top reading "No row picked yet". Tap the hit's **Encounter tables ›** and a row later: the card reads the row after a moment.
- [ ] **View:** tap **View**: a pop-up with the row's full text, its note and "How many", the stat block it names (name and one line) and the check's modifiers. Close: the card is still there.
- [ ] **Start:** tap **Start**: "Started: <check>" opens with the same details and "Run it at the table. Fights come in a later update." Close: the card is gone. The toast "Started: <check>" has **Undo**: tap it, the card comes back.
- [ ] **Dismiss:** tap **Dismiss**: the card goes at once, toast "Dismissed: <check>" with **Undo**; Undo brings it back.
- [ ] **Undo the hit:** on a fresh hit, tap the hit toast's **Undo**: the hit line returns to the card and its Encounter waiting card goes.
- [ ] **Not encounters:** a **Miss** queues nothing; a lost check's Hit, or one of your own checks without **Encounter check** switched on, queues nothing.
- [ ] **Players:** on the player's device nothing of this shows (no card, no log line about it).
- [ ] **End expedition:** cards belong to the expedition: after End expedition and a new Start, none show.
- [ ] **Phone (375 px):** the cards stack, Start / View / Dismiss wrap, a long row text wraps; no sideways scroll.

### M5b — the shared rest flow and the players' table view (step g6, build orders 1–3, 2026-11-02; B5, B18)

The GM's iPad and two players' devices side by side (one player with two characters), a pack whose dungeon-style mode has a rest rule with a condition (the m5b-creation fixture pack, or any invented one); then a 375 px phone.
- [ ] **Steady state (player, iPad landscape):** Scene reads, top to bottom: the time band (mode and turn, "☾ Rest in N", "🔥 Your torch · N turns" or "◑ No light", the date), the prompt slot, **Marching order** as tiles (yours outlined, "· you", lights and statuses in words), a quiet **Rest** button under them, then the place. No accent-coloured button anywhere.
- [ ] **Tiles:** tap a tile: the character's overview opens with their statuses. Tap the **Marching order** title: the full order opens to drag (the GM's lock applies); Close goes back to tiles.
- [ ] **In darkness:** with no light lit in the group, the band reads **◑ No light** (bold outline) and the slot has "No light · Light a torch (N left)"; tap the mark: a short card explains. The GM's strip shows "◑ No light" (per group after a split).
- [ ] **Rest falls due:** Next turn until it's due: every strip reads **Rest due** (bold outline); each player's slot has "Rest due · this turn" with **Rest** (accent) / **Push on** / ⓘ, one line per character for a player with two; the GM's console has **Rest due · 0 of N answered** with one row per character.
- [ ] **Answers arrive live:** a player taps Rest: their line folds to "Resting this turn · Change"; within a few seconds the GM's row reads "☾ Resting" and the count goes up. Change reopens the choice.
- [ ] **GM flips and fills:** tap a row: Resting ↔ Pushing on. **Everyone rests** / **No one rests** fill the list. **Minimise**: the panel folds into the strip marker "Rest due · N of M"; tap it to reopen.
- [ ] **Next turn applies:** with some resting, one pushing on and one unanswered, tap Next turn: the panel goes, the card says "Rest · rested: … · pushed on: …", the pushed-on and unanswered carry the condition (stacked: "×2" the second time), and the strip reads "Rest in N" again. The log (Simple) has one line: "Rest · rested: … · pushed on: Name (Weary ×1)". **Undo** on the clock puts the answers, the countdown and the statuses back.
- [ ] **You pushed on:** on the pushed-on player's device the marker stays **Rest due · you pushed on** while the others read "Rest in N"; after a later rest where they rest, it reads "Rest in N" and the condition is gone.
- [ ] **Call a rest:** before it's due, a player taps **Rest** under the order: toast "You called a rest for the group…" with Undo; everyone's prompt opens; the GM's panel says "<character> called a rest."; the log line after Next turn reads "Rest called by …".
- [ ] **Split party:** split into two groups: each group has its own flow; a player sees only their group's; the GM's markers and panels are labelled by group.
- [ ] **Phone (375 px):** the same bands stacked, tiles two per row, the prompt's buttons wrap, no sideways scroll; a 40-letter name wraps in its tile and its panel row.

### M5b — the g6 rulings (follow-up, 2026-11-03; SC-g6-1 … SC-g6-4, the turn count)

The same set-up as the rest flow above (the GM's iPad and a player's device, the fixture pack's dungeon-style mode with a rest rule; a player with a torch in the pack); then a 375 px phone.
- [ ] **Below the place (player, iPad):** Scene, steady state: under the place sit the hour track and a few recent log lines, nothing else; still no accent button.
- [ ] **No light on the tiles:** with no light lit in the player's group, every marching-order tile reads **◑ No light** beside the name (and the band reads ◑ No light too). Light the torch from the slot's "Light a torch" card: the tiles show the torch instead and ◑ No light is gone.
- [ ] **Next rest due in the log:** let a rest fall due, answer, tap Next turn. The log (Simple) line ends "· next rest due turn N". Keep tapping Next turn until the strip reads turn N: the rest is due again, on that turn.
- [ ] **Newest prompt on top:** on the player's device with the rest prompt showing, send a message from the GM: the "✉ Message from the GM" card appears **above** the rest prompt. Reload the page: the fixed order is back (rest first). While typing in an escape-roll card, a new prompt doesn't move the card under your finger; it moves when you tap elsewhere.
- [ ] **Turn numbers agree:** on the GM's card, a check says "next at turn N"; tap Next turn until the strip reads turn N: the check comes due then, not one turn later.
- [ ] **Phone (375 px):** tiles with ◑ No light wrap inside the tile, no sideways scroll; the prompt cards stack in the slot with the newest first.

### M5b — GM reference: a pack's top-level panels, its places and the Overlay label (g5 bug fix, 2026-11-03)

On the GM's iPad, with zine-compendium 0.5.3 (an overlay with top-level `locations`) and any private overlay with a top-level `gmReference` (or the invented test pack in `src/modules/library/topLevelParts.test.ts` saved as a `.pack.json`); then a player's device and a 375 px phone.
- [ ] **Import preview (iPad):** Rules library › Import a file › the overlay. The line under the title reads "Version … · **Overlay**". No "isn't a part … knows" note for `gmReference` or `locations`. The counts line names the GM reference panels and the places; "Places, kept as text for now" lists each place by name with what players notice after it.
- [ ] **A plain setting:** import a setting with no `meta.requires`: the line still reads "· Setting".
- [ ] ~~**GM reference (iPad):** attach the overlay to a campaign; open Reference and pick the overlay in the pack switcher: its top-level panels appear after the standard ones, tagged with the pack, together with any rules-set panels in one list.~~ *(the "pack" tag was replaced 2026-11-03 by the heading The book's GM pages, tf-10: see *the GM reference and compose*; the panels still appear after the standard ones)*
- [ ] **Update keeps them:** Rules library › Update with the same file: "0 added · 0 removed", and the panels are still in Reference.
- [ ] **Players (player's device):** the overlay's panels and places never show anywhere (Rules tab, search); its classes and items still do.
- [ ] **Phone (375 px):** the preview's places list wraps, with no sideways scroll; the long place lines stay readable.
- [ ] `npm run pack:check -- packs/zine-compendium/zine-compendium-0.5.3.pack.json`: "location: 4" (or the pack's count) among the entries, and no "not imported yet" line for locations.

### M5b — statuses (step g6, build order 4, 2026-11-02; B6)

The GM's iPad (landscape) with a player's device beside it, a campaign whose setting has conditions with `notes`, two or more sharing a `family` (classic-advanced 0.6.3 or fae-woodland 0.3.3 carry 8 families; or add `"family"` to two invented conditions in the m5b-creation fixture pack), a dungeon-style mode with a rest rule, and an expedition under way; then a 375 px phone.
- [ ] **The pop-up (iPad):** Scene → tap a character → **+ Status**: a wide centred card. Under the search, **How long** is one row of chips: 1 turn · 1 hour · Until rest · Until removed · Other…, with **Until removed** pressed. The search field doesn't take focus (no keyboard).
- [ ] **Effects in the list:** every row shows the status's name (with "· stacks", "· N rounds" or its levels "A → B → C · 3 levels"), its brief effect underneath, and **Add**.
- [ ] **A family:** the pack's family shows as one row "<Family> · N kinds" with the kinds' names under it, and none of its kinds has a row of its own. Tap it: "‹ <Family> · N kinds" lists the kinds with their effects and Add. Tap 1 turn first, then a kind's Add: the toast says "Added <kind> to <name>", the overview shows the kind's own name, its effect, and "1 turn left". ‹ goes back to the list.
- [ ] **A pack without families:** import or switch to a pack whose conditions have no `family`: the list is flat, one row per condition; no family row appears, and nothing the pack doesn't carry is listed.
- [ ] **Until rest:** give a status with **Until rest**: the overview reads "Ends when they rest." At the next rest due, answer Rest for that character and tap Next turn: the status is gone. A character who pushed on keeps it. Undo on the clock brings it back.
- [ ] **Other…:** tap Other…: Rounds / Turns / Hours / Days and a How many field appear; with a number, Add gives that timer; with none, the pop-up says "How many …? A whole number from 1 to 9999." With a timer chosen the GM sees **Hide time left from players**.
- [ ] **Custom status:** type "Soaked" in the search: "No status called “Soaked”. Make it a custom status below." Tap **Custom status…**: Name is filled with "Soaked"; type What it does, tap **Stacks** (it stays pressed), pick a duration, tap **Add to <name>** (the one accent). The overview shows Soaked with What it does under it. Open + Status again and search "soak": Soaked is offered as a row with its effect (it's kept in the campaign's homebrew). Give it again: "Soaked ×2".
- [ ] **Custom, refused:** Custom status… with no name, Add: "Give the status a name." With the name of a setting condition: "<Name> is in the list already: add it from there."
- [ ] **The player:** on the player's device, tap their character: each status row shows its effect under the name; tap one: the sheet shows the effect once. There's no + Status (C1).
- [ ] **Phone (375 px):** + Status fills the screen; the chip row scrolls sideways and never wraps; a 60-letter condition name and a long effect wrap beside Add; every button is at least 44 px tall.

### M5b — the place card as pieces (step g2, B1, 2026-11-01)

On an iPad first (the GM's and a player's, side by side), then a 375 px phone.
- [ ] **No pieces yet:** start an expedition at a new place: the card shows **+ Piece** alone (no count, no eye buttons).
- [ ] **+ Piece:** pick a kind, type one line, Add: the row shows the text with its kind under it, a struck-through eye at its right, and the header "0 of 1 piece shown"; the toast says "Piece added (hidden)" with Undo.
- [ ] **Show (eye):** tap the eye: it opens, gets the pressed look, the header counts it, and the toast says "Shown to the party: …" with Undo. The player's Scene shows the place's name and that line within a few seconds. Undo: it goes from the player's screen again.
- [ ] **Order:** show two pieces in turn: the player sees them in the order shown, not the card's order.
- [ ] **Hide all:** the player's place goes; the toast says "Hidden from the party: N pieces"; Undo brings back the same pieces in the same order.
- [ ] **Split party:** with two groups, shown pieces reach only the group in focus's players; the other player's screen shows nothing of the room.
- [ ] **Hidden means hidden:** nothing the GM hasn't shown, and none of the GM's notes, appears anywhere on the player's device (Scene, log).
- [ ] **A crowded room:** with many pieces the card grows and the page scrolls; on a 375 px phone each row's text wraps beside its 44 × 44 eye.
- [ ] **Log (GM, Verbose):** each Show, Hide and + Piece is a line; Hide all is one line with the count.

### M5b — pieces after they're added (step g2b, gp-1 … gp-6, 2026-11-02)

On an iPad first (the GM's and a player's side by side), then a 375 px phone. The pieces from the g2 checks above.
- [ ] **Edit piece:** tap a piece's text (not the eye): the form opens under the list, titled "Edit piece", its kind chip pressed and its text in the field, with Save, Cancel and a quiet Remove this piece; + Piece is gone while it's open. Change the words and Save: the row reads the new words in the same place, the toast says "Piece changed: …" with Undo; Undo puts the old words back.
- [ ] **Quiet on the player's side:** with the piece shown, the form says "Shown to the party now · players see the change as you save it". Save: the player's Scene shows the new words within a few seconds, in the same place, with no marker or toast.
- [ ] **Empty Save:** clear the field and Save: "Write what players will see." and the form stays; nothing changed.
- [ ] **Remove this piece:** on a shown piece: it leaves the card and the player's screen at once; the header's count drops; the toast says "Piece removed: …" with Undo. Undo: it's back on the card and on the player's screen, shown as before. The log (Verbose) has a "removed a piece" line; nothing was deleted.
- [ ] **Coming back:** show two pieces, hide one of them again, Where now? to a new place (nothing shown, the player's place goes), + Piece there or back here; Where now? back to the first place: the toast says "The party is at <place> · 1 piece shown again"; the card shows that one piece and the player sees it; the hidden one and the new one stay hidden. The log has one "is back at <place> … shown again" line (Verbose) with Undo; Undo hides it again and the group stays there.
- [ ] **Any group:** split the party, send Group 2 elsewhere and back: Group 2 starts with what the room shows now (the party's visit), not its own old visit.
- [ ] **Never visited:** Where now? to a brand-new name: nothing shown, no "back at" line.
- [ ] **Start expedition at a known place (follow-up):** show two pieces at a place, End expedition, then Start expedition with that place in Where?: the card starts with those two pieces shown and the player's Scene shows them within a few seconds; the log (Verbose) has one "is back at <place> … 2 pieces shown again" line. Its Undo hides both; the expedition is still under way and the party still there. The start's toast reads "Started an expedition: <mode> · <place> · 2 pieces shown again"; at a new place it has no pieces part.
- [ ] **Start expedition at a new place:** Where? with a brand-new name: nothing shown, no "back at" line.
- [ ] **Old lines:** a log line from before this step that says "showed players <place>" / "hid <place> from players" still reads so.
- [ ] **Phone (375 px):** the chips wrap; Save and Cancel sit left, Remove this piece wraps to the right or under; the text button and the eye never overlap.

### M5b — messaging (step g4, 2026-11-01; B3)

On an iPad first (the GM's and a player's), then a 375 px phone. No Send to players… anywhere any more; the hit panel says **Message…**.
- [ ] **✉ in the top row (GM and players):** beside Log; a player with nothing unread sees no number.
- [ ] **GM → Messages → New message:** pick Player A's character (there is no Everyone; picking two is allowed), type a line, Send: the toast says "Sent to <name>" with Undo; the Messages list shows that thread first with the line.
- [ ] **Player A's phone:** ✉ shows **1**; Scene shows the silent card "✉ Message from the GM · Open" with no text of the message. Open: the thread shows it; the field has no cursor; back on Scene the card and the count are gone. **Player B** sees neither the card nor a count.
- [ ] **Undo on the toast** (within 6 s): the message leaves Player A's thread and count.
- [ ] **Disappears once read:** send one with the switch on; Player A sees it with "Gone from this device once you close it." and Close; after Close it's gone from their thread; the GM's thread still shows it marked "Disappears once read · read"; the GM's log has the text; Player A's log never does.
- [ ] **Attach → A file (GM):** a photo from the device: it shows as a thumbnail in both threads; tap it for the full size. A file over 10 MB is refused with "That picture is too large. Choose one under 10 MB." Attach → Handouts explains Handouts come with M8b.
- [ ] **Player writes back:** Player A's thread (with the GM) has no Attach; type and Send: "Sent to the GM"; the GM's ✉ counts 1 and the thread shows it under the character's name.
- [ ] **Hit panel → Message…:** New message opens with the result's words in the field, editable.
- [ ] **Offline:** airplane mode, Send: the toast says "Sends when back online" and the message waits under the thread; back online it goes and the toast says Sent.

### M5b — start time, due marks ahead, damage modifier (step g1b, 2026-11-01)

On an iPad first (the GM's), then a 375 px phone.
- [ ] **Start time (B13), new campaign:** Rules → Time and calendar reads "Starts at 06:00 (the default)" (the group shows even without a pack calendar). Open it: Hour 6, Minute 00 and **Set start time**. Type 7 and 30, tap it: "Saved", the group reads "Starts at 07:30", Scene's strip reads "Day 1 · Month 1 · 07:30", and the log has one line "… set the first day's start time to 07:30, and the clock with it."
- [ ] **Set start time › on the strip:** on a new campaign's Scene (Downtime, clock not moved), the GM sees a quiet **Set start time ›** under the date (players don't). Tap it: a Start time pop-up with Hour 6 and Minute 00. Set 06:30: the strip reads "Day 1 · Month 1 · 06:30" and a toast offers Undo, which puts the clock back to 00:00. Tap +1 day: the link goes.
- [ ] **Start time once the clock has moved:** start an expedition (or tap Next turn), then Rules → Time and calendar: no fields, "The first day started at 07:30." and a line pointing to Advance by… → To a time. Undo the move from the log: the fields come back.
- [ ] **Start time, a wrong hour:** type 24 and tap Set start time: "The hour is a whole number from 0 to 23."; nothing moves.
- [ ] **Hour's edge (B8):** with a check every 6 turns (or rest every hour), play to the hour's last turn: past a dashed rule at the right of the hour track, an extra pip shows the check (or rest) due as the hour turns over; on the turn before, it isn't there. A player sees the rest there, not the GM's check.
- [ ] **Damage modifier (C3):** with a pack whose rules set has `attack.damageScore` and a character with a +1 melee modifier from that score, a sword at hand reads "+N · 1d8+1"; a bow shows its die alone; without the field, the die alone as before.

### M5b — the gate sweep (step g1, 2026-11-01)

On an iPad first (the GM's and a player's), then a 375 px phone.
- [ ] **No long press (A6):** hold Next turn: one turn passes, and nothing asks "How many?".
- [ ] **Strip ⋯ (B11, B12, B7):** every item has its own icon; it reads **Encounter check** (not Check now) and **Advance by…**; there's no Set time…. Advance by… has **Forward by…** and **To a time**; in Downtime only To a time. End session and End expedition each have a line under them saying what they do.
- [ ] **Procedure (B5, B14):** there's no Procedure button; tapping the mode and turn ("Dungeon · turn 3") opens the procedure, with each step in the pack's words (never "A check" or "Done by the app"). A player sees it the same way when the setting shares it.
- [ ] **Due marks (B8):** a check due every 2 turns: its mark sits on the turn where its prompt shows (turn 3, after two Next turns), and the card reads **Due now**.
- [ ] **Icons (B11):** the hour track's marks are drawn icons (blades for the encounter check, a moon for rest), not letters.
- [ ] **Reminders (B9):** + Reminder sits beside Next turn and Undo, with one small icon per reminder; tapping one opens its sheet.
- [ ] **Session paused (B7):** End session mid-expedition: the strip folds behind a big **Resume session**; Show details opens the rest; a player sees "Session paused · waiting for the GM".
- [ ] ~~**Left column (B15, iPad landscape):** Fold the menu at its foot folds it to icons and the console widens; reload: still folded; Show the menu brings it back. A phone and a portrait iPad show no chevron.~~ (replaced by the divider handle, lr-4: see "M5b — the divider folds the menu (step 0d.1)")
- [ ] **Keep lit (B10):** a pressed toggle beside Put out that glows when on, with ⓘ.
- [ ] **Place card (B16):** no "Only you see this"; **Notes** has a chevron and shows its first line folded.
- [ ] **Date (B13):** with no pack calendar the strip reads "Day 14 · Month 3 · 08:10".
- [ ] **Statuses (C1):** a player has no + Status, even on their own character; the GM has it; the player can still Remove their own.
- [ ] **Weapons at hand (C3):** a weapon in hand shows "+N · 1d8" (or the die alone without an attack bonus in the pack).
- [ ] **Requests (C5, C6, C7):** while an escape roll waits, the GM's console shows "N waiting · Players ›" and it opens Waiting for you; a player's hireling shows "Tobb leaves with Wren and shares this result."; **Enter for <name>** lets the GM type the roll, and the log shows it as the GM's.
- [ ] **No keyboard on open (A4):** no screen or pop-up opens with the cursor in a text field.

### M5 — the R3 removals and no automatic keyboard (2026-11-01)
- [ ] Player's phone, no light lit in their group, in a turn mode: the "No light" reminder with "Light a rushlight (N left)" shows; the screen never darkens or greys, with or without dark sight. ⋯ → This device has Theme and Text size only.
- [ ] Player's Scene, during an expedition and in Downtime: no Something else… button anywhere, and no Describe what you want to do. An escape roll the GM asks for still shows and can be entered.
- [ ] GM → Players → Waiting for you with a request a player sent before this change (if any on the preview): Yes / No and a note, no Cost in turns; Yes leaves the clock where it was.
- [ ] End expedition, then Start downtime (⋯), on the iPad: the player's Scene shows no "Revealed this downtime" card; the phone's log has the check lines (since M5b step 6a they arrive at Start downtime, not at End expedition).
- [ ] Weather roll entered: the result card shows at once and is still open after 20 seconds; a tap folds it into the icon by the date; the icon opens it again.
- [ ] iPad and a phone, no keyboard on open: Sign in, What should we call you?, New campaign, Rename the campaign, Invite a player, a company, a setting-rules field, Add item → a one-off, the GM's one-off edit in Waiting for you, the HP and AC pop-ups, a log note, the approval note: none puts the cursor in a field or opens the keyboard until you tap the field. Tapping the damage pad's number still opens the keyboard (you asked to type).

### M5 — gate fixes (2026-11-01)

- [ ] GM, during an expedition in a mode with a wandering check: ⋯ → Check now puts it on the card with a toast ("Wandering check on the card"); tapping Check now again (⋯ or the hour track's marker) says "The wandering check is already on the card", and the card still shows it once (no ×2). Undo on the first toast takes it off the card.
- [ ] iPad in landscape, Player screen: + Status and a skill's details each open centred over the whole screen, nothing cut off by the left column.
- [ ] New campaign: name it, pick a setting pack (scroll down to it on a phone), Next: optional rules opens at the top of the page.

### M5 — late rulings (2026-10-29; with the small-fixes pull request)

Test packs for the M5 gate: classic-advanced 0.6.2 and fae-woodland 0.3.2 (private, `packs/<pack>/build/`), imported after #153. For the M5b gate (g3 tables, g5 reference, B6 statuses): classic-advanced 0.6.3 (built 2026-11-01), fae-woodland's refresh to follow.
- [ ] The GM opens a campaign: it lands on Scene; Players is one tap away. A player still lands where they did before.
- [ ] With no calendar start set: the strip reads "Day N" with a quiet Set date › (GM only); play goes on. The first step that needs the season asks "Which season?"; a chip makes the day the advance lands on that season's first day (the toast says "Today is 1 <month> (<season>)"), and Rules → Rules for this campaign → Time and calendar → Calendar start shows the start, editable.

### M5b — trait lists at creation (step 0b part B, 2026-11-01)

- [ ] Import (or update) a pack with `traitLists`: the preview counts "N trait lists" and no longer says the part was left out; a list with no entries gets a warning.
- [ ] The sheet shows the entry's name (never its id) in the field, on the overview line and on the roster; Edit offers the list's entries in the field; the change shows in the log.
- [ ] As a player: Rules (the setting) shows the trait lists; a GM-only field on a list stays out of the player's view.
- [ ] A campaign whose layout field was made before this step (as text): after the migration it offers the list; what a player typed before stays as typed.

### M5 — weather roll (M5b; ruled 2026-10-30, D1, S2-1, A8–A12)

On the preview: the GM on the iPad (Scene), two players on phones, one campaign whose setting rules have weather (a day mode, e.g. fae-woodland's wilderness), a calendar start set, and an expedition under way in that mode.
- [ ] Both phones: Scene shows "Weather due" with "Roll d<N> for the weather", and the Player screen's urgent strip shows "Weather due · Roll d<N>". The GM's card says "The players roll it; you can enter it instead." No phone ever shows the weather table's rows.
- [ ] Player 1 enters a roll on the urgent strip: within a few seconds the prompt closes on both phones (card and strip) and on the GM's screen; everyone's card shows "Today's weather · <result>", each tag as its name and the pack's note ("Wet · …") and any travel change ("Mired · −2 travel points"), and "Entered by <name>". The Simple log has the line, with who.
- [ ] Player 2 enters a different roll at the same moment: the second gets "Someone entered the weather first. It's on the card now." and the first result stays.
- [ ] The entrant's toast has Undo (6 seconds): it makes the weather due again for everyone. Waiting 30 seconds and undoing from the log is refused for the player; the GM can still undo it.
- [ ] ~~The card folds into the icon beside the date after 8 seconds, or at once on a tap; the icon opens it again. After a reload the weather starts folded. With reduced motion on, nothing animates.~~ (removed: the 8-second fold, R3 audit 15; see "the R3 removals"))
- [ ] The GM taps Change… on the card, picks another roll on the table: everyone sees the new weather; the log line shows the fiat seal; Undo puts the first result back.
- [ ] The GM enters it instead (Enter roll… on the card, or Enter roll on the reminder card's weather line after Next day): the row lights, and it's entered for everyone at once.
- [ ] Rules → Rules for this campaign → Table and players → "Weather rolled by": GM. The phones show "The GM rolls today's weather." with no prompt in the urgent strip; only the GM's Enter roll… is offered. Back to Players: the prompt returns.
- [ ] Without a calendar start (and Not now on "Which season?"): the phones read "Waiting for the GM to set the season" (card and strip); the GM's card offers Which season? and Enter roll… (a pick of the weather tables). Either one ends the wait.
- [ ] 375 px phone, dark mode and the largest text size: the card, the urgent strip prompt and the icon fit without sideways scrolling; a long result and four tags wrap.

### M5 — calendar follow-ups (2026-10-30)

- [ ] After some days on the clock, "Which season?" → a season: after the advance the strip's date is that season's first day (the day the advance landed on, not the day after it; ruled 2026-10-30); the Time and calendar group shows the start worked back from it.
- [ ] Not now on "Which season?": Next day goes on; the weather line says "No season yet: pick the weather table." and Enter roll… offers the setting's weather tables (Which table) in "Today's weather", where the row read is entered as the weather (M5b). On a second GM device (or after a reload) Next day doesn't ask again. End session, Start session, Next day: it asks again.
- [ ] A player's phone, once a start is known: the Scene strip reads the date and season ("14 Reedmonth (spring) · 08:00"), with no Set date ›.
- [ ] Rules for this campaign with a calendar: a Time and calendar group (before Table and players) holds Calendar start; there's no separate Calendar start group. Without a calendar the group isn't there.
- [ ] A turn mode: a check already run this turn reads "Checked this turn · Check again"; a day mode (a camp reusing the day's check) reads "Checked today · Check again".
- [ ] Log levels: Next turn, +N and Check again lines show only in Verbose; Advance by…, Set time…, Downtime moves, sessions and expeditions show in Simple.
- [ ] Set time… backwards: the sheet adds "Burnt-out lights and ended statuses stay gone. Use Undo to reverse a move exactly."; a status timer gets its time back (never past its full length); a burnt-out torch stays out.
- [ ] A day-step mode with a GM encounter-check reminder every 2 turns: one Next day with the wandering check marks that day's reminders done; Check again is still offered.
- [ ] A pack whose check says `onHit.column: "a|b"` imports with both columns offered on a hit.

### M5 — leaving the dungeon and Requests (step 12)

On the preview: the GM on the iPad, Player A and Player B on phones, each with an approved character; setting rules with a turn mode, and a rules set with `dungeonExit` (a save, a "Has a map" modifier, depth, an `onFail` table that is in the pack, `safePaths`).
- [ ] ~~Player A's Scene → Something else… → Describe what you want to do: type "Pry the idol loose", Send to the GM: the toast says "Sent to the GM"; Scene shows "Sent to the GM · “Pry the idol loose”" with Cancel. Player B's phone shows nothing of it.~~ (removed: Describe…, M5 gate A5)
- [ ] ~~GM → Players: "Waiting for you" lists "<character> asks · “Pry the idol loose”" with a Cost in turns stepper (an expedition under way) and a note field. Set 2, type a note, Yes: the toast "Yes to <character> · 2 turns" has Undo; the strip's turn count went up by 2; Player A's Scene shows "The GM says · Yes · 2 turns" and the note; Got it hides it. Undo in the toast: the clock is back and the request waits again.~~ (removed: Describe… and the cost in turns, A5)
- [ ] Cancel on Player A's phone while a request waits: it's gone from both screens. After the GM answers, there's no Cancel.
- [ ] No: Player A sees "The GM says · No" with the note; the log has the line on Player A's phone and the GM's, not Player B's.
- [ ] Without the `dungeonExit` rule (switch its option off, or a pack without it): no "Leave the dungeon" button on the GM's strip. With it: the button sits beside Undo.
- [ ] Leave the dungeon: the pop-up names the save, has the levels-down stepper (the depth line follows it), Use safe paths shows the pack's note, Ask for escape rolls: the toast says how many and has Undo. Each phone shows "Leave the dungeon: your escape roll" with the modifier switches and the depth; Player A enters 14 with Has a map on: "Sent to the GM · rolled 14 +2 (Has a map) −1 … = 15". Player B's phone shows only their own.
- [ ] GM → Players: each roll's card shows the roll worked out, or "Waiting for <name>'s roll"; Out safely is pressed; switch Player A's to Lost below, Send: Player A's phone pops "Lost below" with the note; the GM gets the "Lost below: <table>" pop-up to roll on.
- [ ] ⋯ → End expedition with the rule on and no rolls asked: the Leave the dungeon pop-up opens with "End without rolls"; after rolls were asked, End expedition ends at once with its summary.
- [ ] End session with the expedition under way, then Start session: the strip says "Resumed: <place>, turn N" (gone after the first Next turn); the place, lights and clock are as they were.
- [ ] 375 px and dark mode: a long request text wraps on both cards; the Leave the dungeon pop-up's buttons wrap without sideways scroll.

### M5 — places and the room, Send (step 11)

On the preview: the GM on the iPad, Player A and Player B on phones, each with an approved character; setting rules with a turn mode that has a wandering check, and (for Something else…) `exploration.playerActions` with a few invented actions in two groups.
- [ ] Start expedition with Where? "The Moth Gallery": the GM's place card says "The Moth Gallery · Only you see this"; neither phone shows the name.
- [ ] Type a line under "What players notice", tap elsewhere, then Show players: the toast "Players see The Moth Gallery" has Undo; both phones show the name and the line within seconds. Hide: both phones lose it. Show again, then Undo in the toast: hidden again.
- [ ] Your notes → Traps "The ninth step gives way": stays after a reload; never shows on a phone, shown or not.
- [ ] Split Player B's character off: the new group starts at The Moth Gallery (its chip in focus shows the same card). Where now? "The Bone Stair" for Group 2 → Show players: only Player B's phone shows The Bone Stair; Player A still sees The Moth Gallery.
- [ ] With the groups in different places, Join up isn't offered on either phone. Where now? "The Bone Stair" for Group 1 too: Join up appears; Player A taps it: the party is together again, hirelings included.
- [ ] Send to players…: type a line, Everyone, Send: the toast says "Sent to everyone" with Undo; both phones show it under "From the GM" with "New"; tap it, Close: "New" goes; the players' logs show "The GM sent you a message: …".
- [ ] Send to Player A's character only, Burn after reading: only Player A's phone gets it; after Close it's gone and their log never shows it; the GM's log keeps the text.
- [ ] A check's hit panel → Send to players…: the sheet starts with the result's words.
- [ ] ~~Player's Scene → Something else…: search narrows the list; tap an action: its rule and "From your setting: …"; Back to the list.~~ (removed: Something else…, A5)
- [ ] GM screen on the place card opens the setting rules on the rules set with the exploration rules.
- [ ] 375 px and dark mode: a long place name and a long message wrap; the card's buttons wrap without sideways scroll.

### M5 — starting and the clock (step 10)

On the preview: the GM on the iPad, a player on a phone; setting rules with a turn mode whose wandering check falls every 2 turns, a day mode, daylight times, a light type (invented: Rushlight) and a race with `vision`.
- [ ] Start expedition: type "The Drowned Stair" under Where? → Start: the toast names the place; the GM's strip says "Started at The Drowned Stair"; the player's Scene and log never show it.
- [ ] End expedition → Close: "The Drowned Stair" is a chip under Where?; tapping it fills the name and picks the mode it started in; tapping it again clears it.
- [ ] Mid-expedition: ⋯ → Check now: "Wandering check · now" with Hit / Miss on the card; Miss logs "checked … now: a miss"; the regular check still comes due on its turn. The check marker on the hour track (outlined) does the same.
- [ ] In a mode with no wandering check (the fallbacks), Check now opens a pop-up saying why.
- [ ] Split the party into two groups → Check now gives one line per group.
- [ ] Go to Players during an expedition: the compact strip (mode, turn, pips, Next turn) sits under the top row and stays as you scroll; Next turn moves the clock with a toast and Undo; when something came due, "N on the card · Scene ›" goes to Scene, where the card shows it. Also on Rules, a character's pack and the full sheet. No compact strip between expeditions, nor on Scene.
- [ ] ~~Player's phone, no light lit in their group, in a turn mode: the screen dims for about 4 seconds (grey for the race with `vision`), the "No light" reminder stays readable on top, a tap ends the dim early; "Light a rushlight (N left)" lights one and the reminder goes. Reduced motion on: the dim comes and goes with no fade.~~ (removed: the dim, R3 audit 8)
- [ ] ~~⋯ → This device → Darkness effect: Off: no dim, the reminder still shows. On again: the dim returns the next time the group goes dark.~~ (removed: the dim and its switch, R3 audit 8)
- [ ] Day mode: no darkness until the GM's ⋯ → "Travelling in darkness: Off" turns it on (toast with Undo; "Travelling in darkness" on the GM's strip); then a player with no light gets the "No light" reminder (no dim since the R3 removals). Turn modes don't offer the switch.
- [ ] "Sunset around now" shows on the GM's strip on the step that passes the pack's sunset.
- [ ] 375 px and dark mode: the compact strip wraps without sideways scroll; a long place name wraps on the strip and in its chip; the "No light" reminder and its button wrap.

### M5 — statuses and rest (step 9)

On the preview: the GM on the iPad (Scene tab), two players on phones; setting rules with a turn mode whose `rest` names a condition that stacks (invented: Weary), and a condition with levels (invented: Dazed → Reeling → Out cold).
- [ ] A player taps their own character in the marching order → + Status → types "Muddy boots" → Add: the toast "Added Muddy boots to <name>" with Undo; the symbol shows beside the name in the marching order (and on the other phone within seconds) and on the Player screen beside the name. Undo takes it off.
- [ ] + Status's search bar finds "Weary" by typing "wea"; adding it again shows "Weary ×2"; the sheet says "2 stacks", "From the setting's conditions", the rules text, and Remove (Undo puts it back).
- [ ] Dazed: the sheet lists the three levels with "(now)"; Step up → "Reeling"; Step down twice → "Step down (ends it)" ends it.
- [ ] GM: + Status on a player's character with 3 turns and "Hide time left from players": the GM sees "3 turns left · hidden from players" and a draining ring; the player sees the symbol without a fill and "Time left is the GM's". Three Next turns end it (the log: "Ended with the clock: …").
- [ ] A player opens another player's character: their statuses show, with no Remove, no Step buttons and no + Status.
- [ ] Rest: a player taps "Rest this turn" at any time (toast with Undo; "✓ Resting this turn" and Don't rest); the GM's Next turn shows "Rested: <name>" on the card. When rest falls due, players see "Rest due"; the GM's card has Rest due with Rested, Push on and ⓘ. Push on ticks those who didn't rest; confirming marks Weary on them ("Pushed on: …", Undo). A character who then rests loses the mark at the next Next turn.
- [ ] ⓘ beside the rest button (players) and on the card's rest line (GM) shows the pack's rest note and the rule plainly.
- [ ] Day mode with a rest rule: the button reads "Rest today"; Next day applies it.
- [ ] Set time… back one turn: a timer gets its time back (never past its full length); an ended status stays ended.
- [ ] 375 px and dark mode: a long status name with ×12 wraps in the overview; the Push on chips wrap; nothing scrolls sideways.

### M5 — marching (step 8)

On the preview: the GM on the iPad (Scene tab), two players on phones (Scene tab), one campaign with at least three approved characters; one character carrying a lit torch.
- [ ] Gate check: both phones hold a row and drag it at the same moment: the first move shows everywhere within seconds; the second phone says "That's changed since. Here's the latest." and shows the first move. Nothing is lost silently; the log has one line per saved move ("Sam moved Ash to the front.").
- [ ] A move happens at once with an Undo toast ("Moved Ash to the front"); Undo puts it back. A newly approved character appears at the back.
- [ ] Each character shows the light symbol first when lit (draining ring, ▲ near its end); tap a character: the overview shows HP, load, light and time left, what's at hand, and for the owner or the GM the Keep lit switch (Undo on its toast).
- [ ] In the overview, "Walk beside …" puts the character in the row ahead (a 4th is refused: "That row has 3 already…"); "A row of their own" splits them out behind.
- [ ] Saved orders: Save as… "Tunnel", move someone, then tap "Tunnel": the party is back in that order ("Marching as “Tunnel”", Undo). The same name again replaces it.
- [ ] The GM's "Locked: only you move it" switch: players see "The GM has locked the marching order." and can't move it; the GM still can. Unlock gives it back.
- [ ] Rules → Table and players: "Players can reorder marching order" off: players see "Only the GM sets the marching order in this campaign."; "Show each other's HP" off: a player's overview of another character shows no HP (their own still does).
- [ ] 375 px and dark mode: a row of three long names wraps without sideways scrolling; the overview fits.

### M5 — groups and marching (step 8)

On the preview: the GM on the iPad (Scene tab), two players on phones (Scene tab); player A has two characters and a hireling, player B one character; an expedition under way with a wandering check every 2 turns (the mode's, or a GM encounter-check reminder).
- [ ] With no split, the GM's Scene shows one marching order as before (no group chips); a player's Scene shows the compact strip "Marching order · 1 … · 2 …"; a tap opens the full order (hold to drag), Close folds it back.
- [ ] Player A: Split the party → their first character → New group: toast "<name> is in Group 2" with Undo; their hireling went too; player B's character shows "Group 1" with no chips. Undo puts both back.
- [ ] Split again, then player A's strip reads "Marching order · Group 2" and holds only Group 2; player B's still shows Group 1's order only.
- [ ] GM: chips "✓ Group 1 · N" and "Group 2 · N"; tapping Group 2 shows its order ("Marching order · Group 2"); moving it doesn't change Group 1's.
- [ ] Saved orders: Save as… in Group 1, then use it in Group 2: only Group 2's characters, in that order. Delete a saved order: "Deleted “…”" with Undo, which brings it back.
- [ ] GM locks the marching order: players in both groups are told "The GM has locked the marching order."
- [ ] Next turn twice: the GM's card shows the wandering check once per group ("… · Group 1", "… · Group 2"), each with its own Hit / Miss; the log names the group.
- [ ] Join up (GM or a player): "Joined up: the party is together again" with Undo; the chips go; the strip is the whole party again. The log reads "<name> joined up Group 2 with Group 1." or "… the party is together again."
- [ ] Light: a lantern lit, one turn on, then a torch lit instead: Light's pick shows "Lantern · 3 turns left"; lit again it burns on from 3 turns, with no oil used. The Keep lit toast reads "Rushlight will be kept lit".
- [ ] 375 px and dark mode: the Split pop-up with long names and four groups wraps without sideways scrolling; chips stay 44 px; the selected chip shows ✓ as well as its fill.

### M5 — light (step 7)

On the preview: the GM on the iPad (Scene tab), a player on a phone (Player tab), both in one campaign; the player's character carries 2 torches (any light item whose pack has a light type, e.g. 6 turns, warnAt 1, consumed) and, for the lantern checks, a lantern with 1 flask of oil.
- [ ] Gate check, journey 5: with one light item, Light lights it in one tap ("Torch · 6 turns left", the ring in the glow colour, toast "Lit Torch · Undo"); with two kinds, Light asks "Which light?" and the tapped one lights (2 taps). Undo puts it out.
- [ ] Gate check: the GM starts an expedition and takes Next turn: at 1 turn left the phone's ring turns the warning colour with ▲ and reads "1 turn left"; the GM's card shows "<name>'s torch is running low". The next turn: the phone toasts "Torch burnt out · Light another" (no Undo); the torch stack is one fewer; the GM's card shows "… burnt out"; the Simple log says "<name>'s torch burnt out."
- [ ] Light another (from the toast or the section) lights the next torch; when the last burns out the line is gone from the Pack and the section reads "Torch burnt out · No torches left".
- [ ] Undo the turn (the strip's Undo, or the log line) brings the torch back, lit, with the clock.
- [ ] Keep lit on: a long +N (13 turns) uses two torches and leaves the third lit; the log names them.
- [ ] Lantern: it burns out and stays in the Pack; the section offers Refill (1 left), which uses the flask; with no oil the burnout reads "Out of oil".
- [ ] Lantern burnt out, then Light another (a torch), then Put out: Light's pick doesn't offer the lantern to light as it is, only "Lantern · … · Refill and light (1 left)", which uses the flask and lights it for its whole length.
- [ ] Put out keeps its time left: put a torch out after 2 turns, light it again: "4 turns left".
- [ ] Set time… forwards past a torch's end: the toast and the log line end "Ran out with the clock: <name>'s torch."; backwards, a light lit later gets its whole time back and a burnt-out one stays out.

### M5 — reminders and checks (step 6)

On the preview: the GM on the iPad (Scene tab), a player on a phone (Scene tab), both in one campaign.
- [ ] Gate check: Scene → New reminder… → "Wandering check", Check, every 2 turns, chance "1 in 6", Encounter check on, Players see it off → Make the reminder. Start expedition (Dungeon), Next turn six times: the card shows "Wandering check" with Hit and Miss after turns 2, 4 and 6 only ("Roll 1d6 · on 1", "next at turn 4").
- [ ] Miss: the toast says "a miss · next at turn 4"; its Undo puts the line back on the card.
- [ ] + Modifier on a check: the sheet's +1 chip (one tap; the note is optional) → the chance reads "on 1–2" and the line "+1 · <note> (by hand)" (or "+1 · by hand") shows; then Hit keeps it with the result (the GM's log line).
- [ ] Secret and open checks: a secret result (the default) stays off the phone until Downtime; on a hit, Reveal to players shows it on the phone at once (logged; the toast's Undo hides it again). A setting check with `secret: false`, or any check recorded during Downtime, shows on the phone at once.
- [ ] Hit on a check with a table (the reminder's "Table on a hit", or a setting check): pick the table if there are several, type the roll; a roll no row has says so; the right roll reads the row ("Bog lurkers · 1d4"). Done closes it.
- [ ] ~~Gate check: players see results only at Downtime: on the phone, no result and no check line in the log during the expedition; End expedition on the iPad → the phone's Scene shows "Revealed this downtime" with the result, and the log shows the check lines.~~ (removed: the Scene card, B17; the log part still holds)
- [ ] A GM-only reminder never shows on the phone; a public one shows in the phone's Reference list (Every N turns).
- [ ] Hour track (Dungeon): six pips, the current one filled; a check to come sits on its pip (GM); the phone shows only public events.
- [ ] Procedure (top row, GM, during an expedition): the mode's steps in order, a check's chance and modifiers, and what was recorded this turn.
- [ ] With setting rules whose mode's check names tables: the Encounter table panel shows the table (or the GM's pick), Enter roll… lights the row; nothing is logged.
- [ ] A day-by-day mode: the procedure strip shows one row of step symbols; the step on the card glows with its name; done ones fade with ✓.
- [ ] Downtime +1 week with a "rations every day" reminder: one line "×7"; Done counts down; All done clears it.
- [ ] An item with `recharge: { amount: 2, every: "day" }`: +1 day → "<item> recharges today" with Recharge; one tap adds 2 charges (dice open the roll prompt).
- [ ] A reminder: tap it → Stop it → it no longer comes due; Start it again counts from now.

### M5 — the clock, sessions and expeditions (step 5)

On the preview: the GM on the iPad (Scene tab), a player on a phone (Scene tab), both in one campaign.
- [ ] Next turn on the iPad → the phone shows "Dungeon · turn 3" (or the pack's mode name) within seconds: Start expedition (Dungeon), Next turn twice; the phone's Scene follows without reloading.
- [ ] Start session is one tap: the strip reads "Day 1 · 00:00 · Session 1" on both devices; the clock didn't move. End session (strip ⋯) ends it; its toast's Undo brings it back.
- [ ] Long-press Next turn: "How many turns?" opens; take 3: the strip jumps 3 turns, one line in the log (Verbose).
- [ ] Strip ⋯ → Advance by… 40 minutes: the time moves 40 minutes, logged "moved the clock on 40 minutes" (not a correction). Set time…: logged "(a correction)".
- [ ] Undo on the strip puts the last move of the clock back; tapped again it steps further back; with nothing left it says so.
- [ ] ~~End expedition (strip ⋯): no confirm; the summary shows how long it took, with Undo and Full rest; the campaign is in Downtime. Undo reopens the expedition.~~ (since M5b step 6a, dt-2: the campaign stays in Adventure; see *M5b — time in town*)
- [ ] Full rest: a character's rest or day ability dots come back (a fight one doesn't); the setting's healing rule shows, with Heal for each character who went; Heal opens the pad on Heal.
- [ ] Downtime: +1 day, +1 week and To day… move the date; To day… refuses an earlier day.
- [ ] The phone never shows the GM's buttons (Start session, Next turn, Undo, ⋯) on the strip.
- [ ] Two devices: the GM's iPad and a second GM tab both on Scene; Next turn on one, then on the other without refreshing: "That's changed since. Here's the latest.", and the strip shows the newer turn.

### M5 — shared state (step 4: request ids, copy versions, the tier line)

- [ ] Phone and iPad on one Pack, pass a tier → exactly one log line: open the same character's Pack on both (the player's phone, the GM's iPad), add something heavy on one so the load crosses into the next tier; the log shows "<name> is now <tier>" once, and only the player whose pack it is sees the banner. Take it off again: one line back.
- [ ] A save from an old copy: open the same stack on both devices, change the count on the iPad, then tap − on the phone without refreshing: the phone says "That's changed since. Here's the latest." and shows the iPad's count; tapping − again works.

### M4b — items players know (discovery first)

- [ ] As a player, Setting rules → Items lists only what's for sale (no magic items unless a pack says they're for sale). As the GM, hand a magic item to any party member: the player now finds it in Setting rules, and still does after it's dropped. A player in another campaign using the same setting rules doesn't.

### M4b — every class, automatically (step 7)

- [ ] On your computer (where `packs/` is): `npx vitest run src/modules/characters/allClasses.test.ts` passes, one line per class in each private setting pack (it builds a legal 1st-level character for each through guided creation's rules). On GitHub it's skipped (no packs there).

### M4b — the GM's review (step 8)

- [ ] As the GM, a guided character waiting for approval shows "guided", its class and race, the scores with "(rolled N)" where adjusted, its starting gear, and "Over by …" when the shopping went over. No HP box at approval.
- [ ] Ask for a different level → pick a level → the player's character comes back to them at that level with "Your GM asks for level N." and HP to enter again.

### M4b — equip warnings (step 6)

- [ ] Your pack: a magic-user (or any class without plate) puts on plate: a calm warning with your setting's words, "Do it anyway" and "Keep things as they are"; nothing changes until you choose. Do it anyway: it's worn, and the log says "… despite a warning".
- [ ] A two-handed weapon with a shield in hand offers "Stow the <shield>": the shield comes off and the weapon goes in hand. A second suit of armour offers "Swap for the <armour>".
- [ ] As the GM, after a rule whose test your pack wrote wrongly: the log shows "A rule couldn't be checked: <id>" (players don't see it).

### M4b — filled values (step 4a)

- [ ] With your pack's sheet layout in use (re-use it, or check a campaign that used it): guided creation fills the save fields and THAC0 from the class at the starting level; changing the starting level changes them; one you type over keeps your value.
- [ ] The full sheet of a guided character shows "From your setting" with what no field shows (hit dice, the ability modifier rows, title…), read only.
- [ ] A campaign that used the sheet layout before this change also has the links (the saves fill in).

### M4b — new-character settings (step 2 of character creation)

- [ ] GM: Campaign → Rules → This campaign shows "New characters need approval" (Yes) and "New characters start at" (Level 1 · Party's lowest · GM's choice, GM's choice chosen).
- [ ] With "Level 1": a player's Who are they? offers only Level 1 and says so. With "Party's lowest": it starts at the lowest level of the approved, active characters and offers no higher.
- [ ] With approval No: the player's button says Create character; after it, "They've joined the party." and the Player screen opens on the new character. Under GM's choice, a level above the party's lowest still goes to the GM.
- [ ] Joining, then Later: the campaign page says "No character yet." with Create your character.

### M4b — hooks language (step 1 of character creation)

- [ ] Import a pack file with a broken hook (a test like `item.slot ==`, or "when": "onSneeze"): the preview lists it under "Good to know" as `hooks: "<id>": …`, and the pack still imports. `npm run pack:check -- packs/<your-pack>/<file>` lists the same.
- [ ] In homebrew, a hook with a test that can't be read (or a warn without a message) can't be saved; the form says why.
- [ ] As a player, ⋯ → Setting rules shows XP tables (and hooks) from the campaign's setting rules; stat blocks and tables still don't show.
- [ ] Formulas still work out as before in the browser (an entry with "2 + level" at the level picker).

### M4b — step 1: M4 gate follow-ups (rulings 2026-10-24)

- [ ] Live updates: with the phone (player) and iPad (GM) open on the same campaign, the GM adds homebrew, gives an item, approves a one-off, or attaches setting rules: the other device shows it within a few seconds, without reloading; the GM's "Players · N" count changes by itself.
- [ ] The log opens full screen on the phone and the iPad; it follows a finger dragged down from its top and closes; a half-written note is still there when the log opens again; Cancel throws it away.
- [ ] Pack: items A–Z in each group; after Give, Put it, Pin, Drop or Add, the item closes and the screen is back at the top; Drop on a stack asks how many (starting from all); Put it is one row; the how-many counter never shows "6 of 2".
- [ ] Add item on a phone: the choices on top, "Add to …" as the main button, cost or note below; after Add, "Cost noted; purses arrive later" shows at the top of the Pack.
- [ ] At hand: tap a pinned item on the Player screen and Give it to the Party stash.
- [ ] Hidden charges: use the last charge (nothing special), use it again: "Nothing happens. <item> seems spent." and the row says Spent; the GM's Reveal the count shows the player the number from then on.
- [ ] The GM hands out a wand: a popup asks for its charges. Recharge is a button with a prompt; on an item that can't be recharged, the GM sees "Recharge (fiat)". Campaign → Rules → This campaign: "Charged items can be recharged" Yes shows Recharge on items whose pack doesn't say.
- [ ] One-off items: the player's one-off isn't in the pack ("Sent to the GM for approval"; "1 item waiting for the GM" at the bottom, with Cancel it); the GM approves, or Edit first; with "One-off items need approval" No, it counts at once.
- [ ] "Other": an animal or a vehicle (or a category in the rules set's separateCategories) sits in "Other · not carried" and doesn't change the load. A container's Empty… moves everything to the Party stash, Carried or another character in one log line; Drop all asks once.
- [ ] Buttons with outlines look like buttons; item details use plain labels ("AC", "Ascending AC") with no empty headings; Yes/No fields are two buttons; dragging a row follows the finger, with the handle on the right; phone landscape keeps the bottom tabs; the sign-in name sits a third of the way down; tapping an entry in a homebrew's "What's in it" opens it to edit.
- [ ] Homebrew: every homebrew pack sits above the setting packs and can't be dragged below them; the campaign's homebrew can be removed (after asking) and comes back when homebrew is saved again; the homebrew's ⋯ has Export as pack file (downloads a .pack.json) and, on the campaign's own, Copy to Rules library: a new "<campaign> homebrew (copy)" appears in the Rules library, and editing the campaign's homebrew afterwards doesn't change it; Edit as homebrew on an entry with an exception asks "Use your edit instead?", and the sheet then says "Your version (…)".
- [ ] Edit pack (2026-10-25): in the Rules library, a homebrew pack (not a setting pack) has Edit pack; it says "Used by N campaigns: …" first; tap an entry → Edit, change it, Save: "Saved. The change applies in …", and each of those campaigns' logs shows "Setting rules updated". Hidden fields and the pack's notes are kept.
- [ ] iPad landscape: the player's Pack has the list on the left and the load on the right; the GM's Inventory has whose pack on the left (Party stash first) and that pack on the right; long names end in "…"; an item opens as a centred card.
- [ ] The GM's section is called Inventory; a note's About… shows name buttons and then a chip.
- [ ] Undo a drop (2026-10-25): drop a whole stack, then in the log tap its line → Undo: "You dropped … from …'s pack", then "You undid a drop: … is back with …" (a gift: "You undid a gift: …"), and it's back in the same container with the same count. Do the same with a container's Drop all. A hidden-charge wand dropped and undone by the player still shows "Charges: ?", and the GM still sees its total. Drop something from a bag, drop the bag, then undo the first drop: it says the container is gone and nothing comes back. Give 2 of 6 torches to "Other…" (a ferryman), then Undo: the stack is 6 again; give a whole item away and Undo: it's back.
- [ ] Companies: a player without a company opens ⋯ → Company, founds one with a co-founder; the co-founder's player accepts and both are founders; another character asks to join and a member accepts; with Companies No, there's no Company page and no Companies section (nothing is deleted).
