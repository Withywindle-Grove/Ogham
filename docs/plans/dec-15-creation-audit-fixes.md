# Plan: character creation's audit fixes 2, 1 and 9 (page 41)

Written by a designer worker on 2026-11-24 (row mock-41-creation-fixes), from the driver's brief; brought up to Francis's rulings the same day (`docs/design/rulings/creation-audit-fixes-2026-11-24.md`, caf-1 to caf-10). No code.

It covers three findings of the `impeccable audit` of built character creation (2026-11-24), picked by Francis the same day: "fix 2, 1 and 9; merge same-name purchases." The other fifteen findings are not here.

**Status: page 41 approved 2026-11-24 with fixes; the eight ⚑ ruled ("All recommended"), critique 1 and 6 picked. No row is held by a question.** A builder branches once this plan is on `main`. One thing for the driver: the looks of caf-9 and caf-10 were drawn after the approval and Francis has not seen them (below, "To show Francis").

## How it is built
- **Mockups first.** The pictures: `docs/design/mockups/december/41-creation-audit-fixes.html` and its `png/41-*.png`, **approved 2026-11-24 with fixes**. Where a `41-…-fix-…` frame exists it is the one to build to; the frames the index marks `superseded` are history. A builder branches once this plan is on `main`.
- **The numbers are the audit's** (2, 1, 9), in the order Francis gave them.
- **Each frame is the built screen with the fix laid over it in the page.** The picture script's changes (rows regrouped in the page, words swapped, an inline gap) show what the fix looks like; they are never the way to build it.
- **Parts are changed, never copied.** Where a fix sits in a part other screens use, the row says how far it reaches.
- **Test page** (all invented): `layout.html?as=new&gear=1`, the campaign "The Fen Muster", Guided; the Fen sample gives scores a range of 2 to 16 and the Bog folk +1 Nimbleness, −1 Grit.
- **Every row's pull request** shows its built screen beside the page 41 frame, and brings the Code column of `docs/06-screens-and-design.md` (Components) up to date.
- **Tests.** Each test's purpose is the plain sentence given in the row.

## What the code says about a merge (finding 2)
Read on `main` at 560a0ee; nothing was changed.

| Fact | Where |
|---|---|
| A purchase at creation is at once a real line in the pack (the add-item command, got as "bought"). | `src/app/StartingGear.tsx`, `buy`, and the shop's `onBought` |
| The character's creation record keeps one entry a purchase: its label, its price, the pack line it made and how many. | `Purchase` in `src/modules/characters/startingGear.ts`; `creation.bought` |
| A put-back takes that entry's count out of the pack, refunds its price and drops the entry. | `remove` in `StartingGear.tsx` |
| A stackable thing joins a same-name stack in the pack already (the stacks ruling, Q2); a thing that does not stack stays a line each. | `addItem` in `src/modules/inventory/inventory.ts` |

**The merge is display-only for single purchases**: the Gear step groups the entries it already has, and the review groups the names it already reads. Two Bog slings stay two lines in the pack.

**A purchase of several at once is not display-only (caf-1).** "Dry rations ×3" bought in the shop's form is one entry with one price. It joins its name's row, and "Put back one" takes one: the entry is split, or its count and price lowered, in the creation record. No migration; a record written before the change reads as before. How the price of one is found from the entry's price (and what happens when it does not divide evenly: integers, hard rule 8) is the builder's to settle and test; a bundle sold as one thing at one price is the case to check first.

**Hard rule 4.** No new kind of deletion is ruled. A put-back already takes the thing out of the pack and its entry out of the creation record. If lowering or splitting an entry needs a deletion the closed list does not have, stop with a scope check.

**Technical, for the builder (not a decision):** `remove` tells entries apart by label and first pack line. Two single buys of a stackable share a line, so they look the same to it. On the layout page putting one of three back left two rows and took one out of the pack (probed 2026-11-24), but that settles nothing: the layout page's store may not join stacks as the database does. Two things to check against a store that really joins: the shop's `onBought` keeps the count of the line the add returns, and a join returns the whole stack read back, so a later buy's entry may hold the stack's count and its put-back may take more than one. Row 2's test for it runs against a store that joins stacks (the database tests, or a unit test of the join's answer), not the layout page.

## The rows
Sizes are a designer's guess read against `main` (560a0ee), in builder turns low / likely / high.

| Row | What changes | Frame (page 41; approved 2026-11-24 with fixes) | Files | Tests (purpose) | States and 375 px | Size | State |
|---|---|---|---|---|---|---|---|
| 2 | **Same-name purchases as one row.** On the Gear step the bought rows are grouped: one row a name, with its count and summed price ("Bog sling ×3, 4 gp 5 sp"; a row of one as today, "Reed rope, 1 gp"), one button a row, rows 8 px apart (0 today): "Put back one" on a row of several, "Put back" on a row of one (caf-2). The button on a row of several puts back the last one bought of that name; its spoken name carries the item and what comes back. A purchase of several at once joins its name's row and goes back one at a time (caf-1: the stored entry split, or its count and price lowered). Beside Undo last a quiet line names what it takes back, "Last bought: Dry rations" (caf-10; with its count when the last purchase was several at once), 14 px, muted, wrapping beside the button. The review's "Bought" line names each thing once with its count ("Bog sling ×3, Dry rations ×3, Reed rope"). The pack, the coin line, the burden, "11 things bought" and what Undo last does are unchanged; the creation record changes only as caf-1 says. Grouped by the same name and the same price, in the order first bought (caf-3). | 41-2, approved 2026-11-24: `41-2-fix-gear-undo-last-phone-light.png`, `41-2-fix-gear-undo-last-long-name-phone-light.png` (the rows and the "Last bought" line), `41-2-gear-merged-phone-light.png`, `41-2-gear-merged-tablet-sideways-light.png`, `41-2-gear-long-name-phone-light.png`, `41-2-review-bought-phone-light.png`, `41-2-review-bought-tablet-sideways-light.png` | `src/app/StartingGear.tsx` (the bought list, `remove`, the tally's line), `src/modules/characters/startingGear.ts` (a pure grouping function; taking one out of an entry of several), `src/app/Characters.css` (`.starting-gear__bought`), `src/app/creationReview.ts` (`gearGroups`) | Three buys of one name show as one row with "×3" and the sum of their prices. The button on that row puts back one: the row reads "×2", the coin gains one price, the pack loses one. Putting back the last one removes the row. Two single buys of a stackable: putting one back leaves one in the pack and one row. Two things of one name at two prices stay two rows. A purchase of three at once shows in its name's row; putting one back leaves two in the pack and in the record, refunds the price of one, and the coin never gains or loses a coin over the three put-backs. A record written before the change opens and reads as before. The line beside Undo last names the last purchase, changes after a buy and after an undo, and is absent with nothing to undo; a long name wraps with no sideways scroll at 375 px. The rows' buttons are 44 px tall and 8 px apart. The review's Bought line names each thing once with its count, and its total of items is unchanged. A kit's own line is unchanged. No sideways scroll at 375 px. | Nothing bought (no list, as today); one; eleven of five names; a long item name (the button under the words, 8 px); a count of 99; a purchase of several at once (caf-1; **not drawn**: it looks as any row of several); the "Last bought" line with a long name (drawn); refunds off (no buttons, as today); a thing dropped from the pack since (as today); 375 px, a tablet held sideways; dark and Larger text (**not drawn: picture them**) | 2 / 3.5 / 5.5 | **Ready** once this plan is on `main`. The "Last bought" line's look: see "To show Francis" |
| 1 | **The Scores refusal names the problem.** A score outside the setting's range is answered in the error pattern with the setting's own number, never the app's: "Muscle can't be above 16. Lower it to continue.", "Muscle can't be below 2. Raise it to continue." (caf-4, the Fen sample's numbers); 999, 0 and the like no longer read "is missing". A setting with no range: "Muscle must be a whole number." (caf-5; which numbers it refuses is as built). The score's box takes digits only; typing stops at the point, "3.5" gives "3" (caf-6). The refused tile carries its own sign (caf-9): the warning sign and short words in its words line ("Can't be above 16", "Can't be below 2", "Must be a whole number"), the box's edge in the warning colour; the box is marked invalid for a screen reader, tied to that line. An empty box still reads "Muscle is missing". | 41-1, approved 2026-11-24: `41-1-fix-scores-999-phone-light.png`, `41-1-fix-scores-0-phone-light.png`, `41-1-fix-scores-no-range-phone-light.png`, `41-1-fix-scores-3-5-phone-light.png`, `41-1-scores-letters-phone-light.png` | `src/modules/characters/creation.ts` (`readScore`: today it turns 0 and three digits into "nothing typed"), `src/modules/characters/creationSteps.ts` (`scoresProblem`), `src/app/GuidedCreation.tsx` (the Scores step; the same check runs again from the review), `src/ui/creation.tsx` (`ScoreTile`: the refused line, drawn with the part the foot's warning line uses), `src/ui/creation.css`, `src/ui/parts.tsx` (`TypedStepper`: a named digits-only variant) | 999 is answered "can't be above" and 0 "can't be below", each with the setting's number and what to do, not "is missing". The numbers in the words are the setting's: a second sample with another range reads that range. A setting with no range answers "must be a whole number". An empty box reads "is missing". Letters do not enter the box; "3.5", typed or pasted, leaves "3". The refused tile shows the warning sign and its short words, and loses them once the number is in range; it is told by the sign and the words, not the colour alone. The refused box is announced as invalid and names its reason; a box in range is not. − and + still step, and still stop at their limits with their words. No number of the app's own appears in the words (a test fails on a hard-coded range). | In range; under; over; empty; letters; "3.5"; a pasted word; a setting with no range (caf-5; drawn with the words laid over the Fen sample); a setting with no upper end ("must be 2 or more", as today); a score left at the average; the same refusal met from the review's Send; Freeform (not walked: the builder checks whether it shares the check); the refused tile three across on a tablet (its words line centred; **not drawn**); 375 px, tablet; dark and Larger text (**not drawn**) | 1.5 / 2.5 / 3.5 | **Ready** once this plan is on `main`. The tile's sign's look: see "To show Francis" |
| 9 | **A score not rolled says so once, on the review and on the GM's approval card.** On the review's Scores card a score left at the average carries no "(rolled N)", whatever the kindred did to it; the line under the list names it with no figure, "Nimbleness: the average, not rolled", and with none rolled "All six: the average, not rolled", the count in words from the setting's scores (caf-7). A rolled score the kindred or a trade changed keeps "(rolled N)". **The GM's approval card** gets the same change (caf-8): no mockup, approved from pictures of the real screen after the build, shown in the pull request. | 41-9, approved 2026-11-24: `41-9-fix-review-not-rolled-phone-light.png`, `41-9-fix-review-not-rolled-phone-dark.png`, `41-9-fix-review-none-rolled-phone-light.png`. The GM's card: none, from the real screen (caf-8) | `src/app/creationReview.ts` (`scoresLine`, `averageScoresLine`), `src/app/Characters.tsx` only if the call changes; **the GM's card** `src/app/reviewSections.ts` | A score in the record's not-rolled list never reads "(rolled N)". A rolled score changed by the kindred still does. With every score rolled there is no second line. With none rolled no score reads "(rolled N)" and the line reads "All six: the average, not rolled"; a setting with four scores says "All four". The line under the scores carries no figure. The GM's card reads the same lines as the review. A record from before the not-rolled list reads as today. | None, one, several, all six not rolled; a rolled score changed by the kindred; an older record; 375 px; dark (drawn); tablet (**not drawn**) | 0.5 / 1 / 2 | **Ready** once this plan is on `main`; the GM's card approved from its pictures in the pull request |

**In all:** 4 / 7 / 11 turns (was 3 / 5.5 / 8.5 before caf-1, caf-9 and caf-10 added to rows 2 and 1). None held by a question.

**Reach.**
- `TypedStepper` (row 1) is also the Starting coin box and the kindred tables' box, where a height is typed "5 7". Digits-only is therefore a **named variant** switched on by the score tile, not a change to the part; the other hosts are unchanged. Whether Starting coin and the Adjust step take the variant too is not asked and not drawn: they stay as built.
- `gearGroups` (row 2) also feeds the GM's approval card's gear lines if it reads the same groups; the builder checks and pictures it.

## To show Francis
| What | Why |
|---|---|
| **The refused tile's sign** (caf-9): `41-1-fix-scores-999-phone-light.png` | He picked critique 1 ("a visible sign on the refused box itself"); the look was drawn after his approval and he has not seen it. |
| **"Last bought: Dry rations" beside Undo last** (caf-10): `41-2-fix-gear-undo-last-phone-light.png` | He picked critique 6; the same. |

Both reuse what the screen has and add no part. Whether rows 2 and 1 wait for him to see the two frames is the driver's call under "Mockups first"; the rest of each row does not depend on them.

## Ruled 2026-11-24
Francis: "All recommended", critique 1 and 6 picked. `docs/design/rulings/creation-audit-fixes-2026-11-24.md`.

| ⚑ | The question | Ruled | Row |
|---|---|---|---|
| 1 | A purchase of several at once | caf-1: it joins its name's row; "Put back one" takes one; the stored entry split or lowered; no migration | 2 |
| 2 | The button's words | caf-2: "Put back one" on a row of several, "Put back" on a row of one | 2 |
| 3 | What joins, and in what order | caf-3: the same name and the same price, in the order first bought | 2 |
| 4 | The refusal's words | caf-4: "Muscle can't be above 16. Lower it to continue.", "… can't be below 2. Raise it to continue.", the setting's numbers | 1 |
| 5 | A setting that gives no range | caf-5: "Muscle must be a whole number." | 1 |
| 6 | "3.5" and letters | caf-6: typing stops at the point ("3"); letters don't enter | 1 |
| 7 | The line under the scores | caf-7: "Nimbleness: the average, not rolled"; none rolled, "All six: the average, not rolled" | 9 |
| 8 | The GM's approval card | caf-8: the same change, approved from pictures of the real screen after the build | 9 |
| Critique 1 | A sign on the refused box | caf-9 | 1 |
| Critique 6 | Undo last shows its row | caf-10 | 2 |

**Open, not a ⚑ (said so the builder does not guess):** with no range, 0 and 999 are whole numbers, so caf-5's words may read oddly for them; build the words as ruled and say what was refused in the pull request.

## Batches
At most three rows a batch, one pull request each, a fresh worker per row.

| Batch | Rows | Files | Spec file | When |
|---|---|---|---|---|
| A | 2 | `StartingGear.tsx`, `startingGear.ts`, `Characters.css`, `creationReview.ts` | `tests/layout/creationAuditGear.spec.ts`, plus unit tests beside `startingGear.ts` and `creationReview.ts` | Once this plan is on `main` |
| B | 1 | `creation.ts`, `creationSteps.ts`, `GuidedCreation.tsx`, `creation.tsx`, `creation.css`, `parts.tsx` | `tests/layout/creationAuditScores.spec.ts`, plus unit tests beside `creationSteps.ts` | Side by side with A: no file shared |
| C | 9 | `creationReview.ts`, `reviewSections.ts` | unit tests beside each (`creationReviewWords.test.ts`, `reviewSections.test.ts`) | After A (both edit `creationReview.ts`); or in A's pull request as its second row |

Every batch also edits `docs/06-screens-and-design.md` (the inventory): the known place for a small merge conflict between batches in flight.

**Overlap with open work (2026-11-24).** The branches the brief names (`pack-k11-k12-k13`, `player-audit-a`, `player-audit-c`, `fix-tap-through`, `fix-f8-tile-label-flake` and `-2`) are local, in other workers' folders, with **nothing committed beyond `main`** when this was written, so there was nothing to compare; what follows is read from their plans and names.
- **`player-audit-a`, `player-audit-c`** (`dec-14-player-audit-fixes.md`, batches A and C): `PlayerScreen.css`, `WeaponInHand.css`, `LoadSummary.tsx`, `PackScreen.css`, `play.ts`, `PlayerVitals.tsx`. No file of this plan; `docs/06` apart.
- **`fix-f8-tile-label-flake`**: its brief names `src/ui/parts.tsx` (the tile columns). Batch B edits `parts.tsx` (`TypedStepper`): another part of the file, but one file. Start B after it merges, or merge `main` in before the final push.
- **`fix-tap-through`**: not read (no commits, no plan found). If it touches the toast or the sheets, it meets row 2's put-back toast only in passing.
- **`pack-k11-k12-k13`**: pack work; if it changes the Fen sample or the layout page's creation data, the tests' figures here (2 to 16, the prices) move with it.
- **#51 (`scene-b14-pack-pictures`, on the remote)** changes `src/ui/parts.tsx`: the one unmerged remote branch that touches a file of this plan (batch B; read with `git log --remotes --not origin/main` over the plan's files on 2026-11-24). The same advice as for the F8 fix.
- **`plan-creation-leftovers` (on the remote)**: docs only (the creation sweep's mockup pages F and G, a ruling and a plan of 2026-11-21); nothing in it speaks of the bought rows, the Scores refusal or "rolled N". It also adds rows to the mockup index.
- **`mock-player-audit-fixes`** and this branch both add rows to `docs/design/mockups/index.md`: page 38's rows are on `main` already.

## The Components inventory (Code column, `docs/06-screens-and-design.md`)
The builder edits these in the same pull request as the row.

| Row | Inventory row | Change |
|---|---|---|
| 2 | Creation step shell (the Gear step, `StartingGear`); Review step | The bought rows grouped by name and price with a count and one put-back; the 8 px between rows; one taken out of an entry of several; the "Last bought" line; the review's Bought line by name and count; the functions' names. |
| 1 | Score tiles; Average stepper / the row naming `TypedStepper` | The digits-only variant and where it is switched on; the invalid mark and the tile's own sign; the refusal's words and that their numbers are the setting's. |
| 9 | Review step; the GM's review; Average stepper (its Code column quotes the old line) | An untouched score carries no "(rolled N)"; the line with no figure, and "All six". |

## Not in this plan
The audit's other fifteen findings (3 to 8, 10 to 18), among them the tablet's 1,116 px rows (13) and Undo last's place (16), both visible on page 41's frames. Starting coin's and Adjust's boxes. Freeform's own screen. Loading, error and offline states: no fix changes them.

## Departures
The builder keeps this section current in the same pull request as the change.
