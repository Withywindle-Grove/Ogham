# Cloud brief: K27, hidden means hidden for the Pack tab (tests only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool (new test files may be created). If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.

## Objective
Write the tests that prove the Pack tab never sends a player what they may not see. They test what the database sends, not what a screen draws. This is row K27 of `docs/plans/dec-6-the-whole-pack-tab.md` (released as "none: data and logic only").

## Output
- **Branch:** `dec-6-k27-hidden-tests`, from `main`. **One pull request against `main`.**
- **Tests only:**
  - a new database test file, `supabase/tests/dec-6-pack-hidden.test.ts`;
  - stand-in cases in `src/testing/permissionCases.ts`, if needed;
  - `src/testing/fakeDb.ts`, which MAY be edited as test support.
  - No other file under `src/` outside test files may change. No app code, no screen files, no migration.
- **Status file:** `docs/status/<date>-dec-6-k27-hidden-tests.md`, listing each case and its kind (see "The rule for each case").
- **You can't run database tests.** CI's database job runs them on the pull request.

## Read first
- The plan's row K27, hard rule 5 (`CLAUDE.md`), rulings **pu-9** and **pu-11**, and `docs/design/rulings/dec-purse-screens-2026-11-13.md`.
- `supabase/tests/`: the purse's existing hidden-data and permission cases (about 33 database and 27 stand-in). Read them FIRST and don't duplicate them; refer to the covering test by name.
- The read and write rules on the tables involved, at their newest definitions across `supabase/migrations`.

## The rule for each case
- **The thing is built and works:** an ordinary passing test.
- **The thing doesn't exist yet** (no table, no command): `it.todo`, with its reason and the row that will build it. Never `it.fails` on a missing table.
- **The thing exists and sends what it shouldn't:** `it.fails`, ONLY then. Put it at the TOP of the pull request and the status file for the lead. Don't fix it.

## The cases
Purse (built; check the existing tests first):
1. Another living character's purse, to any player.
2. A purse line's amount, to anyone who can't read that purse.
3. A give refused to a giver who can't read the purse names no one.
4. A player's Undo of their own give is refused once the receiver's purse has moved on.
5. Another player's Undo can't remove someone else's give (a write rule).
6. **A Down or dead character, both halves:** the others MAY read and take from that character's pack and purse while Down or dead (the open half), and may not once the character recovers (the closing half, which already has tests).

Finds and things (not built yet: `it.todo` with the row named, unless something exists and leaks):
7. A find's card naming coin, to anyone but that character's player (K18).
8. An unidentified thing's true name, bonus or curse, before the GM tells (K22).
9. A place's Treasure piece and its value, to players (pg-1). Check today's place-piece reads: this may already pass, and then it's an ordinary test.

## Boundaries
- Tests only. If a case shows that something is sent today which shouldn't be, DON'T fix it: `it.fails`, with a clear reason, at the top of the pull request.
- Invented names only.
