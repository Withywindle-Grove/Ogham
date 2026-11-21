# Cloud brief: K16b, the GM sends a find (the command; migration and logic only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool (new test files may be created). If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.
**Never edit a migration that has been applied anywhere: fix forward with a new one.**
**Hidden means hidden:** enforced by row-level security, and tested on what the database sends, in the stand-in database (`src/testing/fakeDb.ts`) too.

**Start only after K16a (the hoard rows) and K28 (the log lines) have merged to `main`.** This builds on both.

## Objective
The GM hands out a find from a hoard, to a character or to the party stash. This is row K16b of `docs/plans/dec-6-the-whole-pack-tab.md`. The sheets (K16c) come later and are NOT part of this.

Francis's ruling (pk-12, ruled 2026-11-14), in his words: "When you send a find from a hoard, one action adds the things and the coin together, and your Undo takes both back in one step."

**The party stash as a target IS inside what he approved:** ruling pk-1 rules it, and the approved frame PK5 draws "To the party stash" (`docs/design/mockups/pack/08-the-pack-tab-whole.html` at b474da61 on design-december-mockups). The stash's coin is read by whoever reads the stash's purse today (pu-3). That doesn't change.

**That is ALL his yes covers. STOP and say so in the pull request if this needs:**
- any drop, rename or delete;
- a player's Undo of the GM's send;
- a new reader of anything;
- a change to an existing read rule;
- a second mechanism for hiding amounts (see "Keep the amount from those who can't read the purse").

## Output
- **Branch:** `dec-6-k16b-send-find`, from `main`. **One pull request against `main`.**
- **A migration file (SQL), applied NOWHERE.**
  - The Builder applies it through the database session and names the final version when applying it.
  - Use a timestamp after every migration on main, K20's included.
  - Any function you replace starts from its NEWEST definition: search ALL migrations.
- **The command, the logic and the tests.** No screen files. Do not edit `src/app/PlaceCard.tsx`, `src/app/PackScreen.tsx` or `src/app/PlayerScreen.tsx`.
- **Status file:** `docs/status/<date>-dec-6-k16b-send-find.md`, citing pk-12.

## Read first
- The plan's row K16 and rulings **pk-1, pk-2, pk-3, pf-6, pg-1, pk-11, pu-3, pu-7, pu-9, pk-12**.
- **K16a's work:** `src/modules/expedition/hoard.ts`, its rows.
- **K28's work:**
  - its status file, for the event shape it assumed for this send. Use that shape, or say exactly where you had to differ.
  - its words in `src/core/events.ts`, including the "…, at <place>." form for a piece with no hoard.
- **The purse:**
  - `docs/plans/dec-6-purse.md` and its Departures, especially **3e**: Undo refuses a mixed coin-and-things action today;
  - `supabase/migrations/20261114090000_dec_6b_purse_commands.sql` and `20261114093000_dec_6b_keep_fm1_in_core.sql`.
- **Undo:** `public.undo_request`, `private.undo_as_gm` and `private.coin_action_lines`, at their NEWEST definitions (search every migration).
- How the GM gives a thing today (a character's Add item; `inventory` adds).

## What to build
- **One command** (e.g. `hoard.send`), GM only, with its `can(user, command, target)` check and an event written.
  - It takes the rows the GM chose. Each row is a thing (an item id, or a one-off's words) or coin (a denomination and a whole number). A pk-11 row sends the coin it's READ as, and keeps its printed words for the log.
  - The target is a character, or the party stash.
  - In ONE request (one request id) it adds the things to the target's carrier, and the coin to the target's purse or the stash's purse.
  - **The server checks shape:** whole numbers of 0 or more, and denominations the setting defines. It does NOT check the rows against the place's treasure: the GM may give anything.
- **Its `public.logged_commands` row,** in the migration.
- **Keep the amount from those who can't read the purse.** An amount in a payload every member can read is a leak, whatever the words say. Reuse the SAME mechanism the purse's give uses (`20261114090000`, its header points 2 and 3):
  - each purse change is its own log line through `private.log_change`, whose audience comes from `private.log_audience` for the purses table: the purse's readers only;
  - the other side is named in the line's reason as "with:<character id>" or "with:stash" (`private.coin_counterpart`), never an amount.
  - The things' lines are the party's as today.
  - If the send can't reuse this as it stands, STOP and say why. Don't invent a second mechanism.
- **The words** are K28's: "Your GM gave <Name> …, from <hoard> at <place>." and "Your GM put … in the party stash, …". The amount appears only on the lines the purse's readers can read; the line others read says "coin".
- **"Sent to <Name>" is READ FROM THE LOG,** not stored on the piece. Give a pure function for it.
- **Undo, the GM's Undo of the GM's own send, whole:** things and coin back in one step. It's refused with today's words ("That's changed since. Undo the later change first.") if any part has moved on. That needs `private.coin_action_lines` / `undo_as_gm` to accept this one mixed action shape, and NOTHING else. Change only that, from the newest definitions.

## Tests (each written first as a plain sentence)
- **Database tests** (a new file in `supabase/tests/`; CI's database job runs them):
  - the GM sends things and coin to a character as one action;
  - the GM sends to the stash;
  - the GM's Undo takes both back;
  - that Undo is refused once a sent thing or coin has moved on;
  - a player can't send;
  - **a PLAYER's Undo of the send stays refused**;
  - another player's view of the event and its lines carries NO amount (check the stored payloads they can read, not only the words);
  - the receiver's player reads the amount;
  - the shape checks (a negative or fractional amount, or an undefined denomination, is refused).
- **Permission cases,** allowed and not allowed, in `src/testing/permissionCases.ts`.
- **The "Sent to" function**, from the log.
- **The existing undo tests stay green.** Name the ones that cover the paths you touched (at least the purse's undo tests and `undo.test.ts`).
- Invented names only.

## Boundaries
- Add-only. Anything wider than pk-12 means STOP.
- Applied nowhere: the Builder runs the database session.
