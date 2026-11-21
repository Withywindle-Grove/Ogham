# Cloud brief: K16a, the hoard's rows from a Treasure piece (logic only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool. If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.

## Objective
Turn a place's **Treasure** into the list of rows the GM will hand out. This is the first logic part of row K16 of `docs/plans/dec-6-the-whole-pack-tab.md` (K16a, released as "none: data and logic only"). The send command (K16b) and its sheets (K16c) come later and are NOT part of this.

## Output
- **Branch:** `dec-6-k16a-hoard-rows`, from `main`. **One pull request against `main`.**
- **Logic and tests only.** A new module, `src/modules/expedition/hoard.ts`, and its tests. No screen files. Do not edit `src/app/PlaceCard.tsx`, `src/app/PackScreen.tsx` or `src/app/PlayerScreen.tsx`. No migration, and no new command.
- **Status file:** `docs/status/<date>-dec-6-k16a-hoard-rows.md`.

## Read first
- The plan's row K16, and rulings **pk-1, pk-2, pf-6, pg-1** and **pk-11**.
- The Pack page's frame **PK5** (`docs/design/mockups/pack/08-the-pack-tab-whole.html` on branch design-december-mockups), which draws two coin rows in one hoard.
- `docs/07-content-packs.md`: a location's `treasure` entries (`value` as a coin map such as `{ "gp": 127, "cp": 7 }`, `itemId`, the text) and its Treasure pieces.
- How a place's Treasure piece and pack entry reach the GM today (`src/modules/expedition/placeFromPack.ts`, the place pieces, the pack reader), and the rules set's coins (the purse plan, `docs/plans/dec-6-purse.md`).

## What to build
A pure function: a Treasure piece, plus the place's pack entry, plus the setting's coins, gives hoard rows.
- **Things:** a known item by its id, else a one-off with its text.
- **Coin is "a row like any other" (pf-6):** ONE ROW PER TREASURE ENTRY THAT CARRIES COIN, with its amounts by denomination in the setting's coin names. That is NOT one coin row per hoard: a hoard with two coin entries has two coin rows, as PK5 draws.
- **A coin word the setting doesn't define is handled exactly as pk-11 rules:**
  - it is READ as the coin pk-11 names, so it counts when the hoard is shared out;
  - the row keeps the book's words as printed;
  - the row carries a short note saying how they were read (pk-11's words).
- **GM only:** a Treasure piece's value is the GM's ("Value stays yours", pg-1). The function is for the GM's device. Add a test that nothing the players read carries it, through the stand-in database's player read of place pieces.

## Tests (each written first as a plain sentence)
- Things and coin, mixed.
- Two coin entries in one hoard give two coin rows.
- A coin word the setting doesn't define: read as pk-11 names, the book's words kept, the note present.
- A hoard with no coin.
- A piece with no treasure.
- Invented names, items, coins and values only.

## Boundaries
- No migration, no command, and no change to who may read or write anything. If any is needed, stop and say so.
