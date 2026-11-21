# Plan: December step 4, point-to-point travel in turns (first cut)

Written by the lead, 2026-11-11. Part of `docs/plans/december-first-play.md` (step 4). From Francis's planning answers (the first night ends in an adventure's linked spots, moved between in turns with an encounter roll on every move) and the Builder's sizing of a first cut the same day. The full step (12 to 20 turns: split parties, day budgets, players seeing the ways on, hidden links shown) is M8b's and is not this plan.

## What the first cut does
The GM, in a turn-scale mode, taps **Move on** and sees the ways on from the place the party is in, as the adventure pack links them: where each leads, by which way of moving, and how many turns it takes. Picking one moves the party there and advances the clock by that many turns, as one logged step with one Undo. Then the encounter check is put on the card, as **Encounter check** does today.

The GM makes every move. Players see the ways on and may propose one (mc-28; pieces e and f). No split party (the party's own group only). No day budget. Hidden links stay the GM's throughout.

## Prerequisite
The Scene must know the place the party is in: #532 (the place picker) merged. Not counted here.

## Pieces
| | Piece | Size | Migration | Model |
|---|---|---|---|---|
| a | Import the adventure pack's `routes` as a GM-only kind: `from`, `to`, `hidden`, `oneWay`, `travel` | 1 turn | Small (the library's kind check gains `route`); not player-facing, so no read-rule change | Opus |
| b | The **Move on** sheet: the links leaving the current place (both ways unless `oneWay`; a hidden one marked for the GM), each with its ways of moving and their turns. Drawn as mockup `scene/07`, frame 6, reusing the sheet and list parts; the cost reads in turns | 1 turn | No | Opus |
| c | The move: one database function sets the place and advances the clock N turns in one request: one log line, one Undo. The clock's side effects (lights burning down, statuses ending, the deletions that Undo restores) behave exactly as Advance by… does | 2 to 3 turns | Yes | **Fable, high** (the command and event core: it qualifies; November's rule covers it) |
| d | After the move, the encounter check goes on the card as the ⋯ menu's Encounter check does | half a turn | No | Opus |

| e | **Players see the ways on** (mc-28, ruled after this plan was first written): the `route` kind becomes player-facing under a read rule: a link is sent to a player only if it is not hidden (or has been shown in this campaign), and its far end reads "not yet explored" until that place has been shown to their group. A player's Scene lists the ways on from where their group is, read from the same sheet part | about 2 turns | Yes (the read rule, a "shown" record per campaign, a database test as a player) | **Fable, high** (row-level security on hidden data) |
| f | **A player proposes a way** (mc-28): a tap on a way sends a request to the GM, as Ask the GM does; it shows in Waiting for you ("<name> proposes: <the way>") with **Move** (which makes the move as piece c) and **Not now**; the player sees "Proposed. Cancel" until answered. One proposal at a time per group; a new one replaces the last | to size (the requests module is reused) | To confirm | Opus, unless it needs a new request kind in the database |

Total: 5 to 7 turns after #532 for pieces a to d; pieces e and f add about 2 turns and a sizing. (a) can start before #532 merges; (b) and (d) wait for it and for Francis's rulings on mockup 07 (one Move on; the checks named before the move; a way with a problem listed with its warning; players not seeing the ways on).

## The format, ruled by the lead as design (`docs/design/rulings/dec-point-travel-format-2026-11-11.md`)
1. **A link's time per way of moving.** A route's `travel` is one amount, as today, or a list: `[{ "by": "row", "name": "Rowing", "value": 1, "unit": "turn" }, { "by": "swim", "name": "Swimming", "value": 3, "unit": "turn" }]`. `by` is a short id and `name` its words, both on the link; no list of ways on the mode.
2. **What the move runs.** The procedure for each turn passed, as Advance by N does (scheduled checks, reminders, lights), so nothing is skipped. The check after the move is in addition.
3. **Hidden and one-way links.** A hidden link is the GM's throughout this cut (marked as hidden on the sheet). A one-way link is listed only from its `from`.

## Boundaries
- Nothing here changes day-scale Move… or the travel budget.
- Players see the ways on and propose (mc-28), but never move the party themselves; a hidden link and an unshown place's name are never sent to them.
- Migrations are built and held: no TEST turn and no push without Francis's word through the lead.
- Words on the sheet and the log line go to the lead before any picture.

## ⚑
1. A link whose `to` is a place not yet made in the campaign: the move makes it from the pack (as the picker does). Confirm with #532's code; stop and ask if it can't.
2. A way of moving the party can't use (no boat): the first cut lists every way and lets the GM choose; the warning of mockup 07 is words on the row only if the pack carries a `needs` note. Nothing is checked.
3. The log line's words, for the lead: "<GM> moved the party to <place>: <way>, N turns."

## Done when
On the live app, with an invented adventure pack of four linked places: the GM moves by one way (1 turn) and another (3 turns); lights burn down by as many turns; the encounter check is on the card after each; one Undo puts the place, the clock and the lights back; a hidden and a one-way link behave as ruled. Manual checks in `docs/testing/<branch>.md`.

## Departures
(The builder keeps this current in each pull request.)

**Piece (c), `dec-4c-move-between-places` (2026-11-11).**
- **Base.** Built on `origin/main` (0a3d4a28), not on the open place-picker pull request #532: the move uses the place tables and functions main already has (agreed with the coordinating Builder, 2026-11-11). It doesn't depend on piece (a) (#634) either: the app sends the place, the turns and the way's `by` and `name`; the database reads no route.
- **A table was added** (`place_moves`), which the plan's row doesn't name. The log line needs the way taken and its turns, and the log only keeps what rows hold. Putting them on the visit's own row (`group_places`) would let a player's device read them whenever that row is readable, so they sit in a table only the GM reads (pt-f3).
- **Coming back to a place** brings back what was shown at the end of its last visit inside the move's own request (so it is in the one line and the one Undo), not as a second line of its own as Where now? writes it (`place.backAt`).
- **⚑ 1 (a place not yet made).** The function takes a place of the campaign. For a link whose `to` isn't made yet, the caller first runs main's `place.fromPack` (its own request and Simple line, as the picker does), then Move on. Nothing of #532 was needed. Left for the lead: whether that second line is acceptable, or the move should make the place in the same request (it could call main's `make_place_from_pack`; not built).
- **The rest flow.** The function passes Advance by…'s `rest` argument through, so a move during an open rest flow can apply the answers exactly as Advance by… does. Tonight's camps (a day-scale thing) are not applied by it.
- **Split party.** The function always moves group 1 and takes no group. It doesn't refuse while the party is split (the clock moves for everyone, as with Advance by…): ⚑ for the lead, with piece (b).
- **Held.** Migration `20261111150000_dec_4c_move_between_places.sql` is applied nowhere; its database tests have not been run (their first run is CI's local database).

**Piece (c), follow-up: the lead's rulings on its five ⚑ (ruled by the lead as design and words, 2026-11-11), built in the same pull request (#637).**
1. **Log words.** The GM's line stays: "<GM> moved the party to <place>: <way>, N turns." A player's line says the party moved without leaking a place: "The party moved to <the place's players' name>: N turns." when that place has been shown to their group, else "The party moved on: N turns."; never "moved the clock on". Built with a new function, `party_moves`, which gives a member's device the turns of their own group's moves and a place's name only once a piece of it has been shown to their group (What we know's test). The words are in one file, `src/core/moveWords.ts`, after fm-1's `TRAVEL_PLACE_WORDS` (#628, not on main); when fm-1 merges they can sit beside it.
2. **A place not yet made.** Accepted as built for this cut: made from the pack first, as its own line; an undone move leaves it made and unshown.
3. **A split party** is refused in the database with "Join the party up first: for now a move between linked places takes the whole party."; the app's command passes the refusal on. **For piece (b):** Move on stays tappable while the party is split and shows this text in a pop-up: no disabled button, no hiding.
4. **A return visit's pieces** come back inside the move's one line and one Undo: wanted, kept.
5. **An undone move says so.** The GM reads "<GM> undid the move to <place>: the party is back at <place>." (the second place is where they came from). A player reads "The party is back at <the place's players' name>." or, that place unshown, "The party went back." The move's record now also keeps the visit the party left.

**Piece (c), follow-up: from the Builder's local review of #637 (2026-11-11).**
- **The move's time must be its turns.** The database refuses a move whose seconds aren't its turns at the campaign's turn length (Rules for this campaign; 10 minutes without one), so the line's "N turns" and the clock always agree. The turn is the campaign's, not the mode's step, which the database can't read (pack data): piece (b) turns a way's time into turns before it calls the move.
- **Who writes `place_moves`.** Nobody directly, not even the GM: the move makes a record and Undo marks one undone. One update rule stays for the GM because Undo runs as the GM; the table's own rules refuse any change that isn't an undo.
- **The card's per-turn procedure** (due checks, reminders) is not in the database: it is the device's `advance()` in `SceneTime`. **Piece (b) must route the move through it** (run the engine for the turns, then call Move on with its seconds and `rest`), or the checks and reminders that fall due in the move won't reach the card (pt-f2).
- **05, 07 and 09** are updated on the docs branch (`docs-rulings-2026-11-11`), not in this pull request. Only `docs/04-data-model.md` has the new table here.
- A way's id over 60 characters now has its own refusal words.

**Piece (a), `dec-4a-route-kind` (2026-11-11):**
1. A route has no `name` in 07, so its library entry is named by its id (the importer's rule for any entry without a name), and an export writes it back without adding one (as for a GM reference panel).
2. `routes` is read in any pack, not only an adventure's (the importer reads every part the same way; a rules or overlay pack's `locations` already work so).
3. `pack:check` checks a route's `from` and `to` against the pack's own places only when the pack has places and names no other packs it needs (`meta.requires`).
4. `docs/04-data-model.md`'s list of library kinds is not updated: it already lacks several newer kinds (traitList, gmReferencePanel, location, patch); left for a docs sync.
5. The 09 line for pt-f1 to pt-f3 is on `docs-rulings-2026-11-11`; not repeated here. 07 is updated here (routes: `travel` as a list, the `route` kind).
6. The Rules browser leaves routes out until piece (b) (review of #634): a route has only ids to show.
7. A route's time counts only in the clock's units (round, turn, hour, day, week); any other unit gives no time (review of #634).
8. The migration is stamped `20261111140000` (not right after `20261111120000`): the patrons PR #636 took `20261111130000` and replaces the same kind check, so this one also keeps `patron`; #636 goes to main first (Builder, 2026-11-11).
