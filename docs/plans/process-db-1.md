# Plan: process db-1 — the TEST push accepts other pull requests' migrations

Written by the Builder, 2026-11-11, from ruling db-1 in `design/rulings/m5b-morning-rulings-2026-11-11.md` (Francis, "A"), on the lead's yes. Technical only: no app behaviour, no migration, no screen.

## The problem
TEST is shared. When pull request X has pushed its migration to TEST and pull request Y hasn't merged X, Y's `npm run db:push:test` stops: the Supabase CLI refuses a database whose history holds versions missing from the branch ("Remote migration versions not found in local migrations directory"). Today #583 and #532 hold migrations on TEST, so every other migration branch is stuck behind them.

## Rests on
- `scripts/db-push-test.mjs` (25 lines): loads `.env.test`, refuses the main project, runs `supabase db push --db-url`.
- `docs/testing.md`, the database section: the order for a database change. The command Francis types stays the same.

## Build order
1. **Read TEST's list.** `supabase migration list --db-url`; the rows with an empty Local column are the versions TEST holds from other pull requests. If the output has no Local | Remote table (a changed CLI), stop rather than push blind.
2. **Push from a temporary copy.** Copy `supabase/migrations` and `config.toml` to a temporary folder, add an empty, commented stand-in file `<version>_held_on_test.sql` for each held version, and run `supabase db push --db-url … --include-all --workdir <copy>`. The stand-ins count as applied; this branch's own unapplied migrations go on top (`--include-all`, because they can be older than another branch's). The copy is deleted afterwards.
3. **Never `migration repair`:** it rewrites TEST's history, which the other pull requests rely on. Nothing in this script writes the history except the push itself.
4. With nothing held, the push runs exactly as before.

## Tests (purpose first)
- A version TEST holds that this branch doesn't is found, so it gets a stand-in and the push can go on.
- Versions both sides hold, and this branch's own new ones, are never stood in for.
- If the list can't be read, the script stops instead of pushing blind.
- A stand-in is an empty, commented SQL file named for its version.

## What it can't catch
- Two branches that change the same function: TEST holds whichever pushed last. That was true before; the database tests of the branch being pushed are what show it.
- A held migration that a later merge edits (forbidden anyway: never edit an applied migration).

## Scope checks
- No change to app code, migrations, CI or screens. Not run against TEST in this pull request: every TEST turn goes through Francis.

## ⚑ for Francis
None.

## Estimate
One script (about 100 lines with comments) and one test file; one round.

## Departures
- Review round (#625): the pure parts moved to `scripts/db-push-test-lib.mjs` (so the script always runs and the tests import them); the header must be exactly Local then Remote; a backstop stops the push if a version said to be TEST's alone is one of this branch's files; Ctrl-C at the CLI's prompt still cleans up the copy; `roles.sql` is no longer copied (only migrations and config.toml, as step 2 says).
- Database session 2 (2026-11-12): with nothing held, the plain push refused a migration stamped older than TEST's newest. The push now always passes `--include-all` (tests first on `fix-db-push-test-include-all`; the old "plain push" test changed on this non-fix branch, per tg-1).
