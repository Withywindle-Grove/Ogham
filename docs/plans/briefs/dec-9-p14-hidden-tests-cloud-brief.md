# Cloud brief: P14, hidden means hidden for the players' Scene (tests only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool (new test files may be created). If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.

## Objective
Write the tests that prove the players' Scene never sends a player what they may not see. They test what the DATABASE sends, as a player, not what a screen draws. This is row P14 of `docs/plans/dec-9-the-players-scene.md` ("none: data and logic only"). Its table "P14: never sent to a player" is the list of cases.

## Output
- **Branch:** `dec-9-p14-hidden-tests`, from `main`. **One pull request against `main`.**
- **Tests only:**
  - a new database test file, `supabase/tests/dec-9-scene-hidden.test.ts`;
  - stand-in cases in `src/testing/permissionCases.ts`, if needed;
  - `src/testing/fakeDb.ts`, which MAY be edited as test support.
  - No other file under `src/` outside test files may change. No app code, no screen files, no migration.
- **Status file:** `docs/status/<date>-dec-9-p14-hidden-tests.md`, listing each case, its kind (see below), and the existing test that already covers it, if any.
- **You can't run database tests.** CI's database job runs them on the pull request.

## Read first
- The plan's row P14 and its table, hard rule 5 (`CLAUDE.md`), and each ruling the table names. The rulings files are in `docs/design/rulings/`, including `dec-hd2-ways-on-read.md`.
- `supabase/tests/`: the existing hidden-data tests for ways (`campaign_ways_on`), place rules (`place_rules_for_players`), the encounter check (`encounter_check_for_players`), `scene_pieces`, `known_places_campaign`, `scene_town`, hooks (`hook_sends`, ca-1 to ca-3), the map entries (5m-1, 5m-2) and the weather table (s10-weather-table-hidden). Read them FIRST and don't duplicate them: where one already covers a case, name it in the status file and write nothing new for it.
- The read rules and SECURITY DEFINER reads involved, at their NEWEST definitions across `supabase/migrations` (a function may be replaced several times; search every file for `create or replace function <name>`).

## The rule for each case
- **The thing is built and works:** an ordinary passing test.
- **The thing doesn't exist yet** (no table, no read, no command): `it.todo`, with its reason and the row that will build it. Never `it.fails` on a missing table.
- **The thing exists and sends what it shouldn't:** `it.fails`, ONLY then. Put it at the TOP of the pull request and the status file for the lead. Don't fix it.
- **Another character's hit points when the campaign hides them:** the plan says the database doesn't keep this yet (mo-2; hidden on the screen only until M6). Write it as `it.todo` with that reason, not `it.fails`.

## The cases (from the plan's table, each as a player: one in the group, one in ANOTHER group, one outside the campaign where it applies)
1. A hidden way, its far end and its modes. A hidden way out never makes Leave the dungeon count.
2. Any way at all, or a far end's name, before something of the place is shown to the group.
3. An obstacle's note, extra time, chance and need for approval; its name only after a No.
4. A route's pack id, type or cost beyond the shown way and time.
5. The weather table.
6. An encounter check's table or note; an unshown place's own check.
7. A rule the pack keeps for the GM; a rule the GM closed (it leaves at once).
8. An unshown place's name or id; a link's id.
9. The region in the session line until shown.
10. The book's text for the GM.
11. A hook before it is sent; a rumour's truth (rm-1: a GIVEN rumour's words reach only its hearers, never its `truth` or `note`). The rumours command (`give_rumour`) may not be on main yet: if not, `it.todo` naming dec-12 E.
12. The map, and the pack's map entries, until the GM shares it.
13. Monster hit points.
14. Another character's hit points when hidden: `it.todo` (mo-2, M6).
15. The GM's reminders (S15 is not built yet: `it.todo` naming S15).

## Boundaries
- Tests only. If a case shows that something is sent today which shouldn't be, DON'T fix it: `it.fails`, with a clear reason, at the top of the pull request.
- Invented names only. No game-system names, rules text or numbers from any book.
- Reviewed under rv-3 before merge.
