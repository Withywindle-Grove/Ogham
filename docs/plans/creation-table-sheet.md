# Plan: creation's tables, the pop-up sheet and one format

Written by the designer on 2026-11-19 from the ruling [`dec-creation-table-sheet-2026-11-19.md`](../design/rulings/dec-creation-table-sheet-2026-11-19.md) (cts-1 to cts-7), for the intent [`creation-table-sheet-2026-11-19.md`](../intents/creation-table-sheet-2026-11-19.md). Row: `creation-table-sheet`.

**Status, 2026-11-19: ruled, every frame approved, ready to hand out.** Francis answered ⚑ 1 and ⚑ 2 the same evening (cts-8, cts-9; `docs/design/notes/sitting-2026-11-19-evening.md`, rows 13 and 14); T1 builds both. ⚑ 3 to 5 and 7 are still open; they touch T2 and words, not T1, T1b or T2a.

Pictures of record: frames TS1 to TS8 of `docs/design/mockups/creation/final/24-table-sheet-and-one-format.html` on the branch `design-creation-table-sheet-mockup` (stacked on `design-december-mockups`, commit `c3f4f7c3`); the pictures are on `main` in `docs/design/mockups/creation/final/png/24-TS…`. All eight approved by Francis on 2026-11-19: TS2 and TS5 "Approve with fix", TS1, TS3 and TS6 "Approve with fixes", TS4, TS7 and TS8 on "Keep full width".

Each piece follows `REVIEW.md`, the self-review and hard rules 1 to 9. Examples here are invented (Travelling odds, Reed rope, a Stone kin's manner).

## The rows

A row with something to see shows its built picture beside the frame in its pull request.

| # | What it builds | Ruling | Mockup, approved | Size |
|---|---|---|---|---|
| T1 | **A table's sheet works one way at any length.** Every table of Looks and manner opens in the Backgrounds format: the book's table, a tap marks, "Take it" at the foot's right; no Pick on a row; a tap no longer takes and closes. The player's own words in "Or type your own" are the marked answer and wait for "Take it". An empty take answers "Mark a row first.", or "Mark a row or type your own first." where the table takes typed words. The Details step's roll line ends "then mark your row". **The same format, at any length, for the trinket's table and a kindred's roll at a level** (cts-8). **Latest wins** between typed words and a marked row: marking a row moves the mark to it and leaves the words in the box, unmarked; typing in or tapping the box moves the mark back to the words; Clear takes off a typed answer as it does a row (cts-9) | cts-2, cts-4, cts-5 (b, c), cts-7, cts-8, cts-9 | TS5, TS6 (phone), TS7, TS8 (tablet), 2026-11-19; the trinket's table and a roll at a level take TS5's format (cts-8: his words, no frame of their own) | M |
| T1b | **Details shows every table**, in the pack's order, with no "N more tables" fold. Rides with T1 (the same file). It is the surviving half of #991 | Francis, 2026-11-18, in #991: "I want all 8 tables on this screen displayed together, no need to divide by two." | No frame draws eight rows; TS6's last column draws the step's rows with no fold. Approved from the built screen in #991 on 2026-11-18 | S |
| T2a | **The words of the pick table's row and foot**, as one helper: "0 of 4 picked. 20 to choose from"; "4 of 4 picked: Reed rope, Eel hooks ×2, Tallow candles ×3" (a thing taken twice, or given by two rows, once with its sum; every name, in the order taken); "4 of 4 marked: …" for the sheet's foot | cts-1, cts-3 | None: data and logic only | S |
| T2 | **Gear's pick table opens as a pop-up sheet, and is one row on the step.** The row is the trinket's kind of row: Open before anything is taken, Change after, the names on at most two lines, then "…"; no chevron. The sheet: its title "Travelling odds: pick up to 4", the roll line "Roll d20, then mark your row.", "What you rolled", the table, a foot that stays in view with what is marked and "Take these". "Take these" closes the sheet, with the toast and Undo; the ✕ takes nothing. The fold (`PickTableFold`) goes. **After T1 and T2a** | cts-1, cts-3, cts-5 (a), cts-6, cts-7 | TS1, TS2, TS3 (phone), TS4 (tablet), 2026-11-19 | M |

## What stays as it is

- Who they are's folded short lists (a liege's rows with an ⓘ and Pick), the name table ("Use this name") and a kit's rolls (Next).
- Mark and confirm itself (cs-15), the same row twice with − (R3-8), the typed roll and the range bar (2026-11-09), two columns on a tablet from 24 rows, the sheet's full width on a tablet (cts-7).
- "4 of 4 marked: take one off to mark another." at the limit (cs-50), with no row greyed.
- Creation's plain word buttons (cs-40); the chevron on what folds (cs-9).

## What happens to #991 (`creation-test-fixes`)

- **Its fold is superseded.** "Take these folds its table", the folded row and "starts folded" are replaced by the sheet and the row (cts-1, cts-3); cts-6 holds it back from going live. Its words survive in cts-3: the row names what was taken.
- **Its other half survives: "Details shows every table"** (Francis, 2026-11-18). Nothing in the ruling touches it. It is row T1b here.
- **My recommendation: close #991 without merging** and rebuild its two reusable pieces from its commits: the Details change in T1b, the list of names with sums (`shortList`, `pickFoldLines`) in T2a. Its changes to `src/app/KindredTables.tsx` and `src/ui/creation.tsx` sit where T1 and T2 rewrite. The other way, the driver's to choose (⚑ 6): cut #991 down to the Details change and merge it first.
- **Its three 09 lines of 2026-11-18 are not on `main`.** T1b carries the Details line into 09 word for word. The two pick-table lines are history that cts-1 and cts-3 overtook; the ruling quotes what they kept.

## Files and tests

Paths checked against `main` on 2026-11-19. "Tests" are the ones the row must add, each written first as a plain sentence. Every row with something to see also adds a layout check at 375 px and on a tablet, and brings the gallery's pictures up to its frames.

| # | Files it will touch | Tests it must add |
|---|---|---|
| T1 | `src/app/KindredTables.tsx` (`OneTableSheet`, `:137-187`: the `long` branch becomes the only one for these tables; `take`'s toast, `:158`; `DetailsStep`'s roll lines, `:597`, and the close on a short pick, `:636`), `src/ui/creation.tsx` (`TableSheet`, `:2102-2190`: the typed answer as the marked one, saved by Take it), `src/ui/creation.css`; `src/app/longTableSheet.test.tsx`, `src/app/kindredTables.test.tsx`, `src/app/creationRetest2.test.tsx`, `src/app/rollRowGuard.test.tsx`; `src/gallery/CreationLongTablesSpecimens.tsx`, `src/gallery/CreationFinalDSpecimens.tsx`; `tests/layout/longTables.spec.ts`; 06 (the Table sheet row's Code column) | On a 6-row table of Looks and manner a tap marks the row and takes nothing; "Take it" takes it and closes; the ✕ takes nothing. No row carries a Pick button. Typed words are not saved until "Take it"; the ✕ leaves what was taken before. "Take it" with nothing marked says "Mark a row or type your own first." on a table with the box and "Mark a row first." on one without. The Details step's line reads "then mark your row". A trinket table of 12 rows or fewer and a kindred's roll at a level mark on a tap and take only on "Take it" (cts-8). Typed words, then a row tapped: the row is marked and the words stay in the box; tapping the box marks the words again; "Take it" takes whichever was marked last (cts-9). Layout: a short table's sheet and a long one's have the same parts in the same order at 375 px and 1,024 px; "Take it" ends at the sheet's right edge; every row is a 44 px tap |
| T1b | `src/app/KindredTables.tsx` (`SHOWN`, `:406`, and the fold, `:599-607`); `src/app/kindredTables.test.tsx`; `src/gallery/CreationWhoSpecimens.tsx`; 09 (the 2026-11-18 line) and 06 (the Details step's words) | With eight describing tables the step shows eight rows in the pack's order and no "more tables" row; with 0 and with 1 it reads as today |
| T2a | `src/modules/characters/startingGear.ts` (beside `pickTitle`, `pickMeta`, `pickFull`, `:396-402`); `src/modules/characters/startingGear.test.ts` | Nothing taken reads "0 of 4 picked. 20 to choose from"; picks read "4 of 4 picked: …" with no "to choose from"; a row of 2 taken twice reads "×4"; every name is listed, in the order taken; 0 and 999 |
| T2 | `src/app/StartingGear.tsx` (`:1296-1351`: the row and the sheet's state; `:824-893` and `:1245`, the marks that wait for Next: see ⚑ 3), `src/ui/creation.tsx` (`PickTableFold`, `:1582-1609`, replaced by the sheet's Pick table variant; `BookTapTable` unchanged), `src/ui/creation.css`; `src/app/kitLines.test.tsx`, `src/app/gearStep.test.tsx`; `src/gallery/CreationGearSpecimens.tsx`; `tests/layout/bookRows.spec.ts`; 06 (the Table sheet and Detail row rows' Code columns, the Creation step shell's Gear passage) | The row reads Open with nothing taken and Change after, and opens the sheet; nothing unfolds in the page. In the sheet a tap marks, a second tap marks twice, − puts one back; a fifth tap at four says "4 of 4 marked: take one off to mark another." and marks nothing. "Take these" takes the marks, closes the sheet and shows one toast with Undo; Undo puts the pack back. The ✕ takes nothing and writes no log line. Opened by Change, the rows taken come marked. Layout: at 375 px with 20 rows "Take these" stays in view while the rows scroll; the row's names keep to two lines; on a tablet the sheet is the screen's width |

## Who touches what

Rows sharing a file go one after another, in the order given.

| Shared file | Rows, in order |
|---|---|
| `src/app/KindredTables.tsx`, `src/app/kindredTables.test.tsx` | T1 with T1b (one builder, one pull request) |
| `src/ui/creation.tsx`, `src/ui/creation.css` | T1, then T2 (both change the Table sheet) |
| `docs/06-screens-and-design.md` (the Table sheet row) | T1, then T2 |

**No shared file, so these two can start at once:**
1. **T1 with T1b**: `src/app/KindredTables.tsx`, `src/ui/creation.tsx`, their tests and specimens.
2. **T2a**: `src/modules/characters/startingGear.ts` and its test.

**Then T2**, once both have landed: `src/app/StartingGear.tsx`, `src/ui/creation.tsx`.

## Rows that change committed tests

These rows change tests that state today's behaviour, so each needs an ordinary branch, not a `fix-` branch. **The driver asks Francis before each.** Asked once for all three (T1, T1b, T2) on 2026-11-19, "Creation's new sheet overturns a few old tests (a tap taking at once; the "more tables" fold). Update them?": "Yes, update them".

| Row | Test that states today's behaviour |
|---|---|
| T1 | `src/app/longTableSheet.test.tsx` (`:235`, a 6-row table takes on the tap; `:288`, "Tap a row first."); `src/app/kindredTables.test.tsx` (`:236`, "Tap a row first."; a short detail table closes on a tap); the gallery's pictures of the long tables and Details |
| T1b | `src/app/kindredTables.test.tsx` (the "N more tables" fold); the gallery's `creation-who` pictures |
| T2 | `src/app/kitLines.test.tsx` (the fold: it starts open with a pick, "Take these" at the fold's end, Next takes marks not yet taken); `tests/layout/bookRows.spec.ts` (the fold's row); the gallery's `creation-gear` pictures |

T2a only adds tests.

## ⚑

Collected, not decided. 1 and 2 are Francis's (answered 2026-11-19, below); 3 to 5 are "confirm?"; 6 is the driver's.

1. **Answered, cts-8.** Francis, asked "Do the trinket table and a kindred's roll at a level use the same mark, then "Take it" format?": "Yes, same format". T1 builds it. The question as it stood: **A short table opened in the same sheet elsewhere.** The trinket's table when it has 12 rows or fewer, and the kindred's roll at a level (it sits in the Looks and manner group, with no typed answer). Do they mark and confirm too? My pick: yes to both; the sheet is one part, and one behaviour needs no length test. Until he answers, T1 changes the describing tables of Looks and manner (the ones cts-2's pictures show) and leaves a short trinket table and a short roll at a level taking on the tap, as 06 says. A yes is a small follow-up in the same file.
2. **Answered, cts-9.** Francis, asked whether the row or the typed words win (explained: latest wins, or typed words win): "latest wins". T1 builds the pick below. The question as it stood: **Typed words, then a row marked** (and the reverse). Not drawn. My pick: the mark moves to the row and the words stay in the box, unmarked; typing or tapping the box moves the mark back to the words; nothing is lost by a stray tap. Clear takes off a typed answer as it does a row. Until he answers, T1 builds that.
3. ⚑ Confirm: **"Next takes marks not yet taken" goes with the fold** (cs-42). Marks now live only while the sheet is open, and the sheet covers Next; the ✕ drops them (cs-15). Its toasts ("2 taken from Odds and ends.") and "Next is plain while marks wait" leave with it. T2 builds it so.
4. ⚑ Confirm: **one list of names everywhere.** As built the toast says "In the pack: Bog eel ×2 ×2" for a row of two taken twice; the row sums it ("Bog eel ×4"). My pick: the toast and the sheet's foot use T2a's summed list.
5. ⚑ Confirm: **"pick up to 1"** reads "Take it", not "Take these", in the sheet. Not drawn; as built the fold always says "Take these".
6. ⚑ For the driver: **#991 closed and rebuilt here, or cut down to its Details change and merged first.** My pick: closed.
7. ⚑ Words, small: on Who they are a long field's roll line still ends "then tap the row." though its sheet marks and confirms. cts-5 (c) names the Details step only. My pick: the same "then mark your row"; not built until he says.

## Not in this plan

- The gate list's lines on Gear's pick table (`docs/testing.md`, the fae-woodland given pick and "A pick under an option"): the designer brings them in line when T2 is built.
- The name table's own "Tap a row first: Use this name puts it in the Name field.": not asked.
- Icons on creation's buttons (ic-1) and the one fold mark app-wide: the sweep, after 5 December.
- A narrower sheet or two columns from 13 rows on a tablet: ruled out by cts-7 and by the build's 24.
- Larger text, offline and a failed take: unchanged from the build; each row's self-review still covers them.

## Estimate

In builder turns, low to high. Each builder sizes their row against the code before starting.

| What | Turns |
|---|---|
| T1 with T1b | 2 to 3 |
| T2a | 0.5 |
| T2 | 2 to 3 |
| Francis: three "confirm?" and ⚑ 7 (⚑ 1 and ⚑ 2 answered) | Four short answers |

## Honest notes

- **Read, not run:** the files and line numbers are from reading `main` on 2026-11-19; they will drift. I did not run the app or the tests.
- **#991 was read from its pull request text and its file list**, not from its diff. T1b and T2a should open its commits before rebuilding.
- **The sheet's foot staying in view** is drawn; whether the built sheet's body can scroll under a fixed foot without a change to `Dialog` was not checked. If it needs one, that is a technical scope check for the driver, not a redesign.
- **The mockup's phone is 343 px inside**, tighter than a 375 px screen: a marked row's price and weight wrap to two lines there and may not on a real phone.
- The approvals reached me through the driver; Francis has not seen the phone pictures since the three wording fixes went in.
