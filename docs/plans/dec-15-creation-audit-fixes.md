# Plan: character creation's audit fixes 2, 1 and 9 (page 41)

Written by a designer worker on 2026-11-24 (row mock-41-creation-fixes), from the driver's brief. Plan only: no code, no spec or ruling changed here.

It covers three findings of the `impeccable audit` of built character creation (2026-11-24), picked by Francis the same day: "fix 2, 1 and 9; merge same-name purchases." The other fifteen findings are not here.

**Status: not approved. Nothing here goes to a builder yet.** Page 41 is a proposal, not ruled, and eight ⚑ are open. Each row says what holds it.

## How it is built
- **Mockups first.** The pictures: `docs/design/mockups/december/41-creation-audit-fixes.html` and its `png/41-*.png`. **Not approved** when this was written. A builder branches only after page 41 is approved and this plan is on `main`.
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

**So the merge is display-only**: the Gear step groups the entries it already has, and the review groups the names it already reads. No stored data changes, no migration, no command, and hard rule 4's exception 8 is not touched (no line is merged or deleted that is not today). Two Bog slings stay two lines in the pack.

**One case is not display-only (⚑ 1):** a purchase made as several at once in the shop's form is one entry ("Dry rations ×3", one price), and it goes back whole. "Put back one" on it would split a stored entry.

**Technical, for the builder (not a decision):** `remove` tells entries apart by label and first pack line. Two single buys of a stackable share a line, so they look the same to it. On the layout page putting one of three back left two rows and took one out of the pack (probed 2026-11-24), but that settles nothing: the layout page's store may not join stacks as the database does. Two things to check against a store that really joins: the shop's `onBought` keeps the count of the line the add returns, and a join returns the whole stack read back, so a later buy's entry may hold the stack's count and its put-back may take more than one. Row 2's test for it runs against a store that joins stacks (the database tests, or a unit test of the join's answer), not the layout page.

## The rows
Sizes are a designer's guess read against `main` (560a0ee), in builder turns low / likely / high.

| Row | What changes | Frame (page 41; not approved) | Files | Tests (purpose) | States and 375 px | Size | State |
|---|---|---|---|---|---|---|---|
| 2 | **Same-name purchases as one row.** On the Gear step the bought rows are grouped: one row a name, with its count and summed price ("Bog sling ×3, 4 gp 5 sp"; a row of one as today, "Reed rope, 1 gp"), one button a row, rows 8 px apart (0 today). The button on a row of several puts back the last one bought of that name; its spoken name carries the item and what comes back. The review's "Bought" line names each thing once with its count ("Bog sling ×3, Dry rations ×3, Reed rope"). Display only: the creation record, the pack, the coin line, the burden, "11 things bought" and Undo last are unchanged. Grouped by the same name and the same price each (⚑ 3). | 41-2: `41-2-gear-merged-phone-light.png`, `41-2-gear-merged-tablet-sideways-light.png`, `41-2-gear-long-name-phone-light.png`, `41-2-review-bought-phone-light.png`, `41-2-review-bought-tablet-sideways-light.png` | `src/app/StartingGear.tsx` (the bought list), `src/modules/characters/startingGear.ts` (a pure grouping function), `src/app/Characters.css` (`.starting-gear__bought`), `src/app/creationReview.ts` (`gearGroups`) | Three buys of one name show as one row with "×3" and the sum of their prices. The button on that row puts back one: the row reads "×2", the coin gains one price, the pack loses one. Putting back the last one removes the row. Two single buys of a stackable: putting one back leaves one in the pack and one row. Two things of one name at two prices stay two rows. The rows' buttons are 44 px tall and 8 px apart. The review's Bought line names each thing once with its count, and its total of items is unchanged. A kit's own line is unchanged. No sideways scroll at 375 px. | Nothing bought (no list, as today); one; eleven of five names; a long item name (the button under the words, 8 px); a count of 99; a purchase of several at once (as ⚑ 1 rules); refunds off (no buttons, as today); a thing dropped from the pack since (as today); 375 px, a tablet held sideways; dark and Larger text (**not drawn: picture them**) | 1.5 / 2.5 / 4 | **Held:** page 41 not approved; ⚑ 1, 2, 3 |
| 1 | **The Scores refusal names the problem.** A score outside the setting's range is answered with the range, read from the setting, never from the app ("Muscle must be 2 to 16" on the Fen sample); 999, 0 and the like no longer read "is missing". The score's box takes digits only. A box whose number is refused is marked invalid for a screen reader, tied to the refusing line. An empty box still reads "Muscle is missing". | 41-1: `41-1-scores-999-phone-light.png`, `41-1-scores-0-phone-light.png`, `41-1-scores-letters-phone-light.png`, `41-1-scores-3-5-phone-light.png` | `src/modules/characters/creation.ts` (`readScore`: today it turns 0 and three digits into "nothing typed"), `src/modules/characters/creationSteps.ts` (`scoresProblem`), `src/app/GuidedCreation.tsx` (the Scores step; the same check runs again from the review), `src/ui/creation.tsx` (`ScoreTile`), `src/ui/parts.tsx` (`TypedStepper`: a named digits-only variant) | 999 and 0 are answered with the setting's range, not "is missing". The range in the words is the setting's: a second sample with another range reads that range. An empty box reads "is missing". Letters do not enter the box; a pasted "3.5" leaves what ⚑ 6 rules. The refused box is announced as invalid and names its reason; a box in range is not. − and + still step, and still stop at their limits with their words. No number of the app's own appears in the words (a test fails on a hard-coded range). | In range; under; over; empty; letters; "3.5"; a pasted word; a setting with no range (⚑ 5); a setting with no upper end ("must be 2 or more", as today); a score left at the average; the same refusal met from the review's Send; Freeform (not walked: the builder checks whether it shares the check); 375 px, tablet; dark and Larger text (**not drawn**) | 1 / 2 / 3 | **Held:** page 41 not approved; ⚑ 4, 5, 6 |
| 9 | **A score not rolled says so once.** On the review's Scores card a score left at the average carries no "(rolled N)", whatever the kindred did to it; the line under the list says it was not rolled. A rolled score the kindred or a trade changed keeps "(rolled N)". | 41-9: `41-9-review-not-rolled-phone-light.png`, `-dark.png`, `41-9-review-none-rolled-phone-light.png`; the wording question on `41-9-review-not-rolled-other-words-phone-light.png` | `src/app/creationReview.ts` (`scoresLine`, `averageScoresLine`), `src/app/Characters.tsx` only if the call changes; **the GM's card** `src/app/reviewSections.ts` as ⚑ 8 rules | A score in the record's not-rolled list never reads "(rolled N)". A rolled score changed by the kindred still does. With every score rolled there is no second line. With none rolled no score reads "(rolled N)". A record from before the not-rolled list reads as today. | None, one, several, all six not rolled; a rolled score changed by the kindred; an older record; 375 px; dark (drawn); tablet (**not drawn**) | 0.5 / 1 / 1.5 | **Held:** page 41 not approved; ⚑ 7, 8 |

**In all:** 3 / 5.5 / 8.5 turns, all held.

**Reach.**
- `TypedStepper` (row 1) is also the Starting coin box and the kindred tables' box, where a height is typed "5 7". Digits-only is therefore a **named variant** switched on by the score tile, not a change to the part; the other hosts are unchanged. Whether Starting coin and the Adjust step take the variant too is not asked and not drawn: they stay as built.
- `gearGroups` (row 2) also feeds the GM's approval card's gear lines if it reads the same groups; the builder checks and pictures it.

## ⚑ For Francis
None is decided here.

| ⚑ | The question | Holds |
|---|---|---|
| 1 | **Data. A purchase of several at once** ("Dry rations ×3", one stored entry, one price). (a) It joins its name's row and "Put back one" takes one: the stored entry is split or its count and price lowered: a change to what is stored in the creation record (no migration; older records read as before). (b) It joins the row, and its turn to go back takes all three at once. (c) It keeps a row of its own, as today. Not drawn. | Row 2 |
| 2 | **The button's words.** Drawn: "Put back one" on a row of several, "Put back" on a row of one. Or one wording for all; or the refund kept ("Put back 1 for 1 gp 5 sp"), as the built button says it. | Row 2 |
| 3 | **What joins, and in what order.** Drawn: the same name; rows in the order each name was first bought. The plan adds "and the same price each", so a sum is never mixed: say if that is wrong. | Row 2 |
| 4 | **The refusal's words.** Drawn: "Muscle must be 2 to 16" (the brief's form). The voice guide's error pattern is "What happened. What to do." ("Muscle can't be above 16. Lower it to continue."). Also "2 to 16" (drawn) or "2–16" (as built). | Row 1 |
| 5 | **A setting that gives no range.** The app has no numbers of its own to name. What does 999 say there? As built the box's own floor answers "is missing". | Row 1 |
| 6 | **"3.5" and letters.** Drawn: the point is dropped ("35", then refused by the range); letters do not enter and nothing says why. Or stop at the point ("3"); or say a word when a key is refused. | Row 1 |
| 7 | **The line under the scores.** Drawn: the built line kept, "Nimbleness 10: the average, not rolled", though the average was 9 and the kindred made it 10. The other wording, drawn beside it: "Nimbleness: the average, not rolled". And with none rolled the whole list is said twice: a shorter line ("All six: the average, not rolled") is new words. | Row 9 |
| 8 | **The GM's approval card** shows the same scores with "rolled N" and the same line. Not in the audit, not drawn. The same change there (approved from pictures of the real screen after the build), or left as built? | Row 9 |

Page 41's critique lists eleven findings; Francis picks by number, and a pick may add to a row (1: a visible sign on the refused box; 6: Undo last).

## Batches
At most three rows a batch, one pull request each, a fresh worker per row.

| Batch | Rows | Files | Spec file | When |
|---|---|---|---|---|
| A | 2 | `StartingGear.tsx`, `startingGear.ts`, `Characters.css`, `creationReview.ts` | `tests/layout/creationAuditGear.spec.ts`, plus unit tests beside `startingGear.ts` and `creationReview.ts` | Once page 41 is approved and ⚑ 1 to 3 are ruled |
| B | 1 | `creation.ts`, `creationSteps.ts`, `GuidedCreation.tsx`, `creation.tsx`, `parts.tsx` | `tests/layout/creationAuditScores.spec.ts`, plus unit tests beside `creationSteps.ts` | Side by side with A: no file shared |
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
| 2 | Creation step shell (the Gear step, `StartingGear`); Review step | The bought rows grouped by name with a count and one put-back; the 8 px between rows; the review's Bought line by name and count; the grouping function's name. |
| 1 | Score tiles; Average stepper / the row naming `TypedStepper` | The digits-only variant and where it is switched on; the invalid mark; the refusal's words and that its range is the setting's. |
| 9 | Review step (and Review screen, if ⚑ 8 is a yes) | An untouched score carries no "(rolled N)". |

## Not in this plan
The audit's other fifteen findings (3 to 8, 10 to 18), among them the tablet's 1,116 px rows (13) and Undo last's place (16), both visible on page 41's frames. Starting coin's and Adjust's boxes. Freeform's own screen. Loading, error and offline states: no fix changes them.

## Departures
The builder keeps this section current in the same pull request as the change.
