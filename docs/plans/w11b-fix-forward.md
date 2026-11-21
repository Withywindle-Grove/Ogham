# W11b fix-forward: what the lineage check really says, and what fails in #892

Row: w11b-ff-plan. Written for PR #892 (branch `dec3-w11b-buy-undo`, "W11b: Undo on Buy it"). A plan only: no code, no migrations. Francis ruled on 17 Nov (local time): **fix forward; the applied migrations are never edited.**

## 1. What I found (read first: it changes the brief)

**The function-lineage check (rvw-7) flags none of #892's three migrations.** I ran `checkLineage` from `scripts/check-function-lineage.mjs` (the real function, unchanged) over every migration on `main` plus #892's three files:

| Migration (on TEST, not on main) | Defines | Watched? | Flagged? |
|---|---|---|---|
| `20261115180000_dec3_w11b_buy_undo.sql` | `public.undo_buy` (new) | no | no |
| `20261115190000_dec3_w11b_buy_undo_archived.sql` | `public.undo_buy` (create or replace) | no | no |
| `20261115200000_dec3_w11b_buy_undo_touched.sql` | `public.undo_buy` (create or replace) | no | no |

Why: the check watches only four names: `private.undo_body`, `private.log_change`, `public.import_pack`, `public.undo_request` (`WATCHED`, line 12). #892 redefines none of them; the first migration's header says so in words ("`private.undo_body` and `private.undo_check_change` are NOT touched"). `undo_buy` is a new function and its three versions follow each other in order, so no marker is wanted. The lineage conclusion does not depend on what else is on `main`: `main`'s newest migration is now `20261118090000_fix_856_1_shop_stock_gm_read.sql` (#935), newer than all three, but it redefines none of the watched names either, so it cannot make them "not the newest version". The output was `[]` (no problems) when I ran it, and is expected to stay so; the builder re-runs it after merging `main` in (see 4).

So the premise "the check flags a migration of #892" does not hold for the files as they are. I cannot reproduce it. Possible reasons, none verified: the flag came from a different branch or a version of the script I don't have; or it was read from another PR's output. **If Francis or the driver has the failing output, paste it into the ⚑ below; I did not guess.**

**Consequence: no migration is needed to satisfy the check.** Adding a new migration that redefines a watched function only to add a marker would be a change to production functions (`undo_body` and friends are the Undo and log core) for no reason: worse than the problem it solves. I recommend against it and did not route round anything. The one thing the lineage check does require of #892 is nothing.

## 2. Why "database shard 3/3" failed in #892's last CI run

Run 44162672654, job `database shard 3/3` (run at 2026-11-17 20:31–20:37, head `8cabeada`). Not a migration problem. One test failed (45 of 46 files and 915 tests passed):

`supabase/tests/commands.test.ts › the app and the database agree › the buyer can undo their own purchase`
`the database refused: There's no purchase to undo.` (expected `true`, got `false`; line 685)

Cause: the shared permission case (`src/testing/permissionCases.ts`, "the buyer can undo their own purchase") builds its input with `w.freshOffer()`. In the **database** world (`supabase/tests/commands.test.ts`, `freshOffer`, about line 342) that is a **Sell** offer: `kind: 'sell'`, no reply, no bought line. `public.undo_buy` rightly refuses it at its first real check (`req.kind <> 'buy' or reply is distinct from 'accept'`), with the one refusal text it uses for every reason. In the stand-in used by the unit tests the same fixture is accepted, which is why `npm run check` passed and only the real database caught it.

The three refused cases (another player, the GM, an outsider) pass today **by accident**: they are refused at the ownership check, before the kind check ever runs. They would still pass with a real purchase, so nothing else is hiding.

The aggregate `database` job failed only because shard 3 did; shards 1 and 2 passed. `check` and `layout` were green. The PR's own file `supabase/tests/dec3-w11b-buy-undo.test.ts` passed (it builds a true purchase in `boughtLantern`).

## 3. The smallest fix-forward (tests only; no migration)

A: Builder. Smallest change that fixes what is actually red: the failing case needs a real purchase. Add a `freshPurchase()` to the permission world, build it in the database world the way `boughtLantern` in `dec3-w11b-buy-undo.test.ts` does (a buy request, the GM's In stock answer, the buyer's Buy it reply with its line, through the commands), give the stand-in the same in `src/testing/permissionCases.test.ts` (the stand-in's `freshPurchase` must produce a line that came in as bought, at version 1, with the buyer's creating event, so the stand-in and the database agree on the same facts and not by accident), and switch the four `undoBuy` cases to it.

B: Critic. Three challenges. (1) Is it the fixture or the function? The function is right: a Sell offer is not a purchase, and the refusal is by design, so do not touch `undo_buy`. (2) Could the case simply be dropped or moved to the PR's own test file? It would stop the shared "app and database agree" check covering `undoBuy`, which is the point of the file; and the other three cases hold only by accident today, so they need the true fixture too. (3) Does it need Francis's say? It edits no migration, no screen, no rule; it touches `src/testing/` only (not app code), so no mockup is owed. But the PR is also stale (see 4), which is the larger risk.

Synthesis: do the test-only fix, all four cases on the true purchase. No `it.fails` step: that rule is for `fix-…` branches and this is the PR's own branch (its test is a new case for new behaviour, not a bug test). The test's plain purpose sentence: "a buyer can undo their own bought, untouched item through the real database; another player, the GM and an outsider cannot."

Work list for the builder on `dec3-w11b-buy-undo`:
1. `src/testing/permissionCases.ts`: add `freshPurchase(): Promise<Request>` to the `World` type; use it in the four `undoBuy` rules.
2. `supabase/tests/commands.test.ts`: implement it in the world (a real buy, accepted, line made, through the commands).
3. `src/testing/permissionCases.test.ts`: the stand-in's `freshPurchase`: a line that came in as bought, at version 1, with the buyer's creating event (what `undo_buy` checks), so the stand-in and the database agree because they hold the same facts, not by accident.
4. Bring the paperwork up (flagged twice on #628): see 4.
5. `npm run check` locally; on TEST, `npm run test:db` (needs the TEST project; not runnable in a cloud seat, so the builder says so rather than claiming it).

## 4. Other things a fix-forward push has to deal with (found while reading)

- **The branch is behind `main`** (checked at build time, not quoted here). It carries no `scripts/check-function-lineage.mjs` run; the green `check` on the PR therefore proves nothing about rvw-7. Before the final push: `gh pr view 892 --json mergeable`; if it says CONFLICTING, merge `main` in first (CLAUDE.md, "Things Claude gets wrong"). Merely behind is not a reason. After the merge, run `node scripts/check-function-lineage.mjs` (expect "ok").
- **Stale paperwork** (flagged twice on #628): the PR body and `docs/status/2026-11-15-dec3-w11b-buy-undo.md` still say the migration is "NOT applied anywhere" and describe one migration, not three; and since rvw-12 there is no status file per pull request, so the PR's own text should carry what the file says (three migrations, applied on TEST, main push waits for Francis). The plan's Departures for W11b (in `docs/plans/dec-3-the-whole-town.md`) should say the two fix-forward migrations (VB4 archived; bu-2b touched) and this test fixture fix. Decision for Francis below: delete the status file or leave it as history.
- **Docs the migration needs on `main`**: `public.logged_commands` has a row from the first migration; `supabase/tests/m3-health.test.ts` shards passed, so the match holds. The sixth exception to hard rule 4 (bu-1) needs its `docs/09-decisions-log.md` line in the same commit as the CLAUDE.md edit. **Checked: `docs/09-decisions-log.md` on `main` already has bu-1's line (2026-11-14, "A sixth exception to 'nothing erased'"), so the builder adds no 09 line;** if the CLAUDE.md edit has not reached `main` yet, it goes in with the paperwork push and points at that existing line (I did not check whether #937, the look-back sitting's rulings, touches either file; the builder re-checks after merging `main`).

## 5. Order of pushes

1. Builder pushes the test-only commit to `dec3-w11b-buy-undo`, once, with `npm run check` green locally (push-once rule). No migration in it.
2. **TEST database: nothing to push.** All three migrations are already applied there (Francis, 17 Nov) and the fix touches none. If a builder with the TEST credentials is available: `npm run test:db` on the branch to see `commands.test.ts` and `dec3-w11b-buy-undo.test.ts` green before the CI round.
3. CI on the PR: check, database (3 shards), layout (needs the `ready` label, already on) all green.
4. Driver's reviewer (a migration PR is always reviewed), then Francis's yes.
5. **Main database: Francis, not a builder.** Backup first (`npm run db:backup`, `docs/testing.md`, Backups), then the push below. The three migrations are add-only plus two `create or replace` of the one new function: nothing dropped, renamed or deleted in existing data. They apply in filename order. **This is an out-of-order push.** `main` already has `20261118090000_fix_856_1_shop_stock_gm_read.sql` (#935), applied on the main database on 18 Nov, which is newer than #892's three (`…180000`, `…190000`, `…200000`). A plain `db push` refuses migrations older than the newest applied one, so the push needs `--include-all`: from the db-session folder, `npx supabase --workdir <db-session> db push --linked --include-all`, after the backup and after a dry run (`--dry-run`) that lists **only those three** files. The real condition to restate at build time: any migration newer than `…180000` already applied on main means `--include-all`; check `supabase/migrations` on `main` and the dry run right before. Order: backup, dry run (only the three), push with `--include-all`, `db:types`.
6. Run the security advisor on main afterwards (`npx supabase db advisors --linked`) as for any migration push.

## 6. ⚑ For Francis (collected, not decided)

1. **⚑ The lineage flag I could not reproduce.** The check passes for #892's migrations. Was the flag seen from another branch, or can you paste the output? If it came from a later migration of another PR, that is that PR's marker, not #892's.
2. ⚑ Delete the status file `docs/status/2026-11-15-dec3-w11b-buy-undo.md` (rvw-12 says there are none) or leave it as history? I propose delete in the fix-forward push, text moved into the PR body.
3. ⚑ OK to push the three migrations to the **main** database after the PR is green? (Backup first; no data touched.)

## 7. Estimate

Test-only fix: about 1 builder turn plus 1 push. Paperwork: about half a turn. Main database push: about 10 minutes of Francis's time.

## Not done, and fragile

I did not run `npm run check` or any database test (no TEST project credentials here). The finding in 1 comes from running the check's own function over the merged file set; the cause in 2 comes from the CI log and reading the fixture and the function. Both are reproducible: `node scripts/check-function-lineage.mjs` after a merge of `main` into the branch.
