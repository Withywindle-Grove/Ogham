# Brief: W12, a shop's stock for the day (data and logic only)

If a guard, a hook or a permission check blocks you, stop and report to the Builder. Do not reach the same end another way: not with another tool, another branch, another session or another command. After a combined command is refused you may run its ordinary parts one at a time as plain commands, leaving out anything that deletes, restores or reaches outside your folder (gd-4); a plain part refused means stop.

**For:** a local builder, on main. **Row:** W12 of `docs/plans/dec-3-the-whole-town.md`. **Mockup:** none: data and logic only. Build the record, its commands, its read rule and their tests, and stop before any screen (W9, W10 and W11 draw it later, from page 19's approved frames).

## Francis's yes (2026-11-14), in plain words
He was asked: "A new record holds each shop's stock for the day. You read and write all of it. A player reads only the lines switched on (in stock today), never the ones off or undecided. It adds a table and removes nothing. May the town's stock record be built with that read rule: yes or no?" He answered: "Yes".

## The rulings it serves
tn-4, tn-5, tn-6, ap-13 (`docs/design/rulings/dec-town-stock-2026-11-14.md`); ap-14, tn-7, tn-8 (`docs/design/rulings/dec-town-ask-card-2026-11-14.md`); mc-73, mc-74.

## Corrected after the lead's second read (binding)
- **What a shop is today.** A shop is a town service of kind `buy` from the rules set's `settlement.services` (`src/modules/expedition/town.ts`, about lines 138 and 179; a service has an `id`), and a request names a `serviceId` and an `itemId` (`src/modules/requests/townRequests.ts`, about lines 28 to 72). A service carries no list of its own things: what it sells is every item for sale, by the item's own `availability`. So the record is keyed by **the campaign, the service's id, the item's id and the day**. There is no per-shop list of things; do not invent one (per-shop stock from a pack waits, dec-2-3).
- **The day.** The campaign's clock holds seconds only (`campaign_clocks`, `20261029170000_m5_clock.sql`). Use the campaign calendar's day as the app already works it out where a "new day" matters (find that one place; say which function and file in the status file; do not write a second way of counting days). The row stores that day's number. If no single existing source gives it, stop and ask.
- **Three stored answers.** A stored row's answer is **in**, **out** or **undecided**. Reset writes **undecided** rows for the day (so Undo can restore what it cleared and nothing is deleted). A stored answer always wins over a computed default; a player reads a thing as in stock only when the answer in force (stored, else the default) is **in**.
- **An item's printed availability stays readable where it is readable today** (the lead's ruling: it is the players' book's own information; players can already read an item entry they know or that is for sale, `availability` included; the rarity and "sold in" lines are meant for the entry by tn-5 and ap-13). The plan's "a stock line switched off or undecided; any chance" means the day's answers and rolls, which this record holds and players never get. This row changes nothing about what the library sends.
- **The reader for players** returns only things whose answer in force is **in**, for one service. It never returns the things that are out or undecided, their ids, or a count of them.
- **A thing with no `availability` at all is in stock by default** (w12-2, Francis, 2026-11-14: "A thing with no availability information counts as always in stock: yes or no?" "Yes"). Build the default as a single named function with that case tested; a stored answer still wins. The main database push is covered by w12-1 and w12-2 if the dry run shows only this migration.

## What to build
1. **One new table, add-only**, holding for a campaign, a shop (a `buy` service's id) and an item's id, on a campaign day, the answer: **in**, **out** or **undecided**; no row means the default (see 5). Keyed so that a new day starts clean (see 4). Integers and ids only; no price here (prices stay where they are today).
2. **Who may read (the yes above, and no wider):** the GM reads every line. A player (a member of the campaign who is not its GM) reads ONLY lines whose answer is **in**. A line that is **out** or undecided is never sent to a player: not its row, not its thing's id, not a count. Someone outside the campaign reads nothing. Enforced by row-level security on the table, not by a screen.
3. **Who may write:** the GM only, through commands, each checking `can(user, command, target)` and writing an event:
   - set one thing **in** or **out** (Undo puts it back to what it was, undecided included);
   - **reset**: every thing that has a chance goes back to undecided for that shop (Undo restores the answers it cleared).
   No client writes the table directly. A player writes nothing.
4. **A new day:** the day's answers do not carry over: at a new campaign day the shop reads as it does before anyone has answered. Do it without deleting rows (a row belongs to its day; the reader takes today's): hard rule 4's list of deletions is closed.
5. **What a thing reads as before the GM has answered** (logic, from the pack's `availability`, which is an object `{ where?, chance?, rarity?, note? }` on the item; today `src/app/townTrade.ts` reads it only as a string: read the object):
   - `chance: "always"` → **in**;
   - `chance: "x-in-y"` → undecided;
   - `where` (settlement sizes): the town's size is in the list → **in**; the town has a size not in the list → **out**; the town's size is not known → undecided;
   - only a `rarity` or only a `note` → undecided;
   - no `availability` at all → see "Corrected after the lead's second read": with Francis.
   These defaults are computed, not stored: a stored row exists only once the GM has answered. A player therefore reads a default **in** thing as in stock without any row: say how the read rule and the reader give a player those defaults without sending the others (a view or a function over the pack's readable data; the pack's item entries players can already read).
6. **Logged:** the two commands in `public.logged_commands`; the GM's lines are the GM's; whether a player reads a log line of a thing coming **in** is NOT ruled: make the lines the GM's alone and raise it as a ⚑.

## Not in this row
The screen (W9, W10). The card that answers a request and the answer the app gives at once (ap-14, tn-7: W10 and W11): but shape the record so that both can flip and read the same line. Buying. Prices. Per-shop stock lists from the pack beyond what today's shops already have.

## Tests (database, and the stand-in the same)
A player reads an **in** line and never an **out** or undecided one (no row, no id); the GM reads all three; an outsider and another campaign read nothing; a player cannot write, by the command or straight at the table; set and Undo; reset and Undo; a new day reads clean and yesterday's rows are still there; each default case in 5; permission cases both ways in `src/testing/permissionCases.ts`.

## Paperwork
A NEW migration with a timestamp after every one on main and every one reserved (ask the Builder for the number). The test database first, through the Builder's database session; the main database under the yes above, provided the dry run shows only this migration. No line in `docs/09-decisions-log.md` (dl-1): put it in the status file. A status file with its ⚑ list and what was not tested.

If unsure, stop and ask the Builder; don't guess.
