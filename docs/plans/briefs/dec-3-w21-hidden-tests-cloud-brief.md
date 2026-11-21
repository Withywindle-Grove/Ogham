# Cloud brief: W21, hidden means hidden for the town (tests only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool (new test files may be created). If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.

## Objective
Write the tests that prove the town never sends a player what they may not see. They test what the DATABASE sends, as a player, not what a screen draws. This is row W21 of `docs/plans/dec-3-the-whole-town.md` ("none: data and logic only"). Its table "W21: never sent to a player" is the list of cases.

## Output
- **Branch:** `dec-3-w21-hidden-tests`, from `main`. **One pull request against `main`.**
- **Tests only:**
  - a new database test file, `supabase/tests/dec-3-town-hidden.test.ts`;
  - stand-in cases in `src/testing/permissionCases.ts`, if needed;
  - `src/testing/fakeDb.ts`, which MAY be edited as test support.
  - No other file under `src/` outside test files may change. No app code, no screen files, no migration.
- **Status file:** `docs/status/<date>-dec-3-w21-hidden-tests.md`, listing each case, its kind (see below), and the existing test that already covers it, if any.
- **You can't run database tests.** CI's database job runs them on the pull request.

## Read first
- The plan's row W21 and its table, hard rule 5 (`CLAUDE.md`), and each ruling the table names (in `docs/design/rulings/`; the newest town rulings are in `dec-pack-town-players-2026-11-14.md`: tr-1, tn-1 to tn-3, bu-1).
- `supabase/tests/`: the existing town and place tests (`scene_town`, piece 2c's database test, `scene_pieces`, `known_places_campaign`, the town requests, hooks ca-1 to ca-3, the map 5m-1/5m-2). Read them FIRST and don't duplicate them: where one already covers a case, name it in the status file and write nothing new for it.
- The read rules and SECURITY DEFINER reads involved, at their NEWEST definitions across `supabase/migrations` (search every file for `create or replace function <name>`).

## The rule for each case
- **The thing is built and works:** an ordinary passing test.
- **The thing doesn't exist yet** (no table, no read, no command): `it.todo`, with its reason and the row that will build it (W4b, W8, W10, W12, W13, W14 and so on, from the plan). Never `it.fails` on a missing table.
- **The thing exists and sends what it shouldn't:** `it.fails`, ONLY then. Put it at the TOP of the pull request and the status file for the lead. Don't fix it.

## The cases (from the plan's table, each as a player: one in the group, one in ANOTHER group, one outside the campaign where it applies)
1. A place in town not shown; a hidden piece and its lead.
2. The town's GM notes, facts, tables, the watch, the book's text row.
3. A person (name, leads, stat block) unless written into a shown piece.
4. A keeper's box line not revealed; a page reference into a GM's book. (The keeper's lines are W8's: `it.todo` if not built.)
5. A stock line switched off or undecided; any chance. (Stock a player reads is W10/W12 and needs Francis's yes first: `it.todo` naming them.)
6. A rumour's truth and notes; a rumour not given. (rm-1. `give_rumour` may not be on main yet: if not, `it.todo` naming dec-12 E.)
7. A notice not shared; a hook not sent.
8. The town's map until its eye is open.
9. A rule the GM switched off.

## Boundaries
- Tests only. If a case shows that something is sent today which shouldn't be, DON'T fix it: `it.fails`, with a clear reason, at the top of the pull request.
- Invented names only. No game-system names, rules text or numbers from any book.
- Reviewed under rv-3 before merge.
