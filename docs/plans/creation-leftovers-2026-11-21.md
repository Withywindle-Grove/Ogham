# Plan: creation's leftovers, drawn and never built

Written by the designer on 2026-11-21. Row: `creation-leftovers`. A look-up found creation frames that were drawn and approved but never given a plan row, so were never built. They were left out on purpose: each was new behaviour the sweep was not allowed to add (cs-30), and the lead's rulings cs-45 to cs-53 (2026-11-14, [`dec-scene-whole-2026-11-14.md`](../design/rulings/dec-scene-whole-2026-11-14.md)) kept the build's behaviour and sent each one to Francis "as its own piece". The other sources: [`dec-10-creation-sweep.md`](dec-10-creation-sweep.md) (D, E, F-b, G and H notes), [`dec-1-creation.md`](dec-1-creation.md) (rework, item 11) and [`dec-patrons-2026-11-12.md`](../design/rulings/dec-patrons-2026-11-12.md).

**Status, 2026-11-21: not ready to hand out.** Every row waits on Francis's yes to build it (⚑ 1 to 11): each would supersede a ruling now in force or reopen one of his own. A row he refuses is struck from this plan with his words; nothing else changes.

**Pictures of record.** `docs/design/mockups/creation/final/`, pages 14 and 19 to 23, on the branch `design-december-mockups`. Page 14 (the Patron step, `14-patron-step.html`) approved by Francis on 2026-11-12 (pt-10, "approve"). Pages 19 and 20 (batches D and E) approved by him batch by batch on 2026-11-12. Pages 21 to 23 (batches F to H) approved on 2026-11-12 under his pre-approval of the lead's changes, not frame by frame (⚑ 12). **None of these pages or their pictures is in this repository** (only pages 01 to 13 and 24 are): see ⚑ 13. The designer could not open them for this plan, so each row's description comes from the plans' and rulings' words, not from the frame.

Each piece follows `REVIEW.md`, the self-review and hard rules 1 to 9. A piece with something to see shows its built screen beside its frame in its pull request's text. Examples are invented (a Marsh Chaplain, a Lantern Warden).

## Checked against `main`: nothing dropped

Checked on `main` at `5da9830` (2026-11-21), in the code and tests, not the plans' marks. No piece is built whole, so no row is dropped. Four are built in part; their rows build only the rest.

| Frame | Built already (evidence) | Not built (evidence) |
|---|---|---|
| 22-G2 | The special-approval card, last (`src/app/Characters.tsx:1231-1233`, `exceptionsPart` in `src/app/creationReview.ts:37-50`) | The card at the top |
| 22-G5 | The words "Your GM asks for a change" and the author line (`src/app/Characters.tsx:3073-3077`; `PinnedNote` in `src/ui/organisms.tsx:10`, `:97`; cs-53, cf-1) | The rest of the frame's sent-back layout |
| 22-G6 | The GM's approval card in the book's type, Approve and Send back plain (`src/app/GmCampaign.tsx:472-484`, `:1062-1084`; cs-25, cs-47) | The rest of the frame's card |
| 22-G8 | Nothing: the review is one column at every width (`src/ui/creation.css:1293-1294`) | The review's two columns on an iPad |
| 23-H1 | The whole-screen loaders, in the book's type (`CreationLoading`, `src/ui/creation.tsx:425-429`; used at `src/app/Characters.tsx:929`, `:1695`; cs-48) | Loading inside a step |
| 23-H2 | The offline words that are true today (`src/ui/creation.tsx:279-290`, `:347-350`; cs-49) | A step that works offline and keeps its picks on the device |
| 23-H3 | "Nothing to choose here" once, in the foot, and "This step comes back if you change your class." (`SkippedStep`, `src/app/Characters.tsx:3347-3360`; `src/app/skippedStep.test.tsx`) | The step's own why-line (`why=""` today) |
| 23-H5 | One pop-up: "A Marsh Chaplain follows a patron." with Back to Class and Choose a patron (`PatronFirstDialog`, `src/app/GuidedCreation.tsx:1235`) | The other blocked taps' pop-ups: they are toasts (`pickProblem`, `src/modules/characters/creationSteps.ts:295`; `src/app/WeaponSkillsStep.tsx:138`; cs-50) |
| 19-D5, 19-D6 | Nothing: Who they are is one column at every width (`src/app/Characters.tsx:2362-2365`, the comment citing his 2026-11-07 ruling) | Who they are and Details in two columns on an iPad |
| 20-E5 to E7 | Nothing: of the steps, only Kindred, Class and Expertise pass a side panel (`panel=` at `src/app/GuidedCreation.tsx:698`, `:839`; `src/app/ExpertiseStep.tsx:268`) | Magic, Languages and Weapon skills in two columns on an iPad |
| 14-07 | Nothing on the Patron step (`src/app/GuidedCreation.tsx:870` on). But Magic and Languages already have a find field past twelve rows (`SEARCH_ABOVE = 12`, `src/app/FirstSpellsStep.tsx:49`, `:224-229`; `src/app/LanguagesStep.tsx:27`, `:226-231`), so dec-1's "none to reuse" no longer holds | The find field past twelve patrons |
| 21-F5 | Nothing: the count screen has its own − and + (`src/app/AddItem.tsx:473-481`) | The shared stepper (`Stepper`, `src/ui/parts.tsx:139`) on the count screen |

## The rows

| # | Frame | What it builds | The ruling in force, and what building it changes | Mockup, approved | Size |
|---|---|---|---|---|---|
| L1 | 22-G2 | **The special-approval card at the top of the review**, above the step cards, instead of last. Same card, same words ("1 thing needs the GM's special approval", each pick over its requirement) | cs-46 keeps it last. Building it supersedes cs-46 (⚑ 1) | Frame 22-G2, page 22, approved 2026-11-12 (pre-approval) | ¼ turn |
| L2 | 22-G5 | **The sent-back screen laid out as drawn.** The words and the author line stay as built; what else the frame changes is read from the frame first and listed in the pull request before any of it is built | cs-53 kept "its words only" (⚑ 2) | Frame 22-G5, page 22, approved 2026-11-12 (pre-approval) | ½ turn, once the frame is read |
| L3 | 22-G8 | **The review in two columns on an iPad** (from 700 px), the cards in the build's order | cs-52 keeps one column, after Francis's own ruling (retest 2, 2026-11-07: only Race and Class keep two columns). Building it reopens his ruling (⚑ 3) | Frame 22-G8, page 22, approved 2026-11-12 (pre-approval) | ½ to 1 turn |
| L4 | 23-H1 | **Loading inside a step**: the step's frame stays and only its rows wait, where the whole screen waits today. Where the frame draws it (which steps load on their own) is read from the frame first | cs-48 keeps the whole-screen loaders (⚑ 4) | Frame 23-H1, page 23, approved 2026-11-12 (pre-approval) | ½ to 1 turn |
| L5 | 23-H3 | **A skipped step's why-line**: the step says, in its own line, why it has nothing to choose (the frame's words), as well as the foot's "Nothing to choose here" | cs-51 kept the foot's words alone (⚑ 5) | Frame 23-H3, page 23, approved 2026-11-12 (pre-approval) | ¼ turn |
| L6 | 23-H5 | **A blocked tap opens a pop-up** in the frame's words, with the frame's buttons, where today it is a toast ("Pick a class first.", "2 of 2 picked: take one off to pick another."). The patron's pop-up is built and stays | cs-50 keeps toasts, and 06 and cts-5 (2026-11-19) state them as the rule. Building it supersedes all three (⚑ 6) | Frame 23-H5, page 23, approved 2026-11-12 (pre-approval) | ½ to 1 turn |
| L7 | 19-D5, 19-D6 | **Who they are and Details in two columns on an iPad** (from 700 px) | Francis's 2026-11-07 ruling (only Race and Class keep two columns); Design's own caption calls the columns its proposal (⚑ 7) | Frames 19-D5 and 19-D6, page 19, approved by Francis 2026-11-12 | ½ turn |
| L8 | 20-E5 to E7 | **Magic, Languages and Weapon skills in two columns on an iPad**, the entry beside the list as Kindred and Class have it | The same ruling and caption as L7 (⚑ 7) | Frames 20-E5, 20-E6 and 20-E7, page 20, approved by Francis 2026-11-12 | ½ to 1 turn |
| L9 | 14-07 | **A find field on the Patron step past twelve patrons**, as Magic and Languages have one: the same label pattern ("Search patrons"), the same twelve, a picked patron always shown. The field is built once: Magic's and Languages' copies become one shared part, named in 06's inventory | pt-10's step; dec-1's item 11 left it out for want of a part to reuse, which now exists (⚑ 8) | Frame 14-07, `14-patron-step.html`, approved by Francis 2026-11-12 | ¼ to ½ turn |
| L10 | 22-G6 | **The GM's approval card as drawn.** The book's type and the two plain buttons stay as built; what else the frame changes is read from the frame first and listed in the pull request before any of it is built | cs-47 built "only cs-25, in the book's type" (⚑ 9) | Frame 22-G6, page 22, approved 2026-11-12 (pre-approval) | ¼ to ¾ turn, once the frame is read |
| L11 | 21-F5 | **The count screen uses the shared stepper** (`Stepper`): a step past a limit stays tappable and says why, as today's "One is the fewest you can add." | F-b kept the build's − and + ("a follow-up if the lead wants it") (⚑ 10) | Frame 21-F5, page 21, approved 2026-11-12 (pre-approval) | ¼ to ½ turn |
| L12 | 23-H2 | **A creation step that works offline and keeps its picks on the device**, with the frame's "Waiting" tag and "Kept on this device until you're back" | cs-49: nothing untrue is written before the offline queue exists. **Not handed out until M9's offline queue is built** (08, M9) (⚑ 11) | Frame 23-H2, page 23, approved 2026-11-12 (pre-approval) | Sized with M9 |

## Files and tests

Paths and lines checked on `main` at `5da9830`, 2026-11-21. Each test is written first as a plain sentence. Every row with something to see updates the gallery's creation pictures it changes and says which.

| # | Files it will touch | Tests it must add |
|---|---|---|
| L1 | `src/app/Characters.tsx` (`buildReview`, the push at `:1232-1233`); `src/app/creationReview.ts` (`exceptionsPart`'s comment, `:37-40`); tests in `src/app/creationReview.test.tsx` | A character with one pick needing special approval shows that card first on the review, above the first step's card; with none, no card |
| L2 | `src/app/Characters.tsx` (`:3073-3077`); `src/ui/organisms.tsx` (`PinnedNote`, `:10-100`); tests in `src/ui/creationFinalD.test.tsx`; a layout check in `tests/layout/reviewFoot.spec.ts` if the foot moves | Written from the frame's list. At least: a sent-back character still reads "Your GM asks for a change", the author line and "Send to the GM" |
| L3 | `src/ui/creation.css` (`.creation-review`, `:1288-1294`); the review's cards in `src/ui/creation.tsx` (`:1860-1915`) if the order needs a column each; a layout check in `tests/layout/reviewTiles.spec.ts` or a new spec | At 1,024 px the review's cards sit in two columns in the build's order and no card is cut; at 375 px and at 699 px, one column |
| L4 | `src/ui/creation.tsx` (`CreationLoading`, `:425-440`; `CreationStep`, `:236-400`); the steps the frame names; tests in `src/ui/creationFinalD.test.tsx` | While a step's rows load, its title, counter and foot show and the rows say they are loading, once; the whole-screen loader still shows while the setting's rules load |
| L5 | `src/app/Characters.tsx` (`SkippedStep`, `:3351-3360`, its `why`); the reason from the step's own check; `src/app/skippedStep.test.tsx` | A skipped Magic step reached by Back says why in its line (the frame's words), and "Nothing to choose here" still shows once, in the foot |
| L6 | `src/modules/characters/creationSteps.ts` (`pickProblem`, `:291-297`); `src/ui/creation.tsx` (Next's blocked tap, `:393`); `src/app/WeaponSkillsStep.tsx` (`:138`); `src/modules/characters/firstSpells.ts` (`:580`, `:587`); `src/modules/characters/languagesStep.ts` (`:180`, `:190`); the pop-up is `Dialog` (`src/ui/Dialog.tsx`), not a new part; tests in `src/modules/characters/creationSteps.test.ts` and `src/ui/creationBookType.test.tsx`, which state the toasts today | Next on Class with nothing picked opens a pop-up with the frame's sentence and buttons, and no toast; a pick past the count does the same; the patron's pop-up is unchanged |
| L7 | `src/app/Characters.tsx` (Who they are, `:2340-2366`, and its comment); `src/app/KindredTables.tsx` (`DetailsStep`, `:498`); `src/ui/creation.css` (`.creation-step--split`, `:178-190`); a layout check in a new `tests/layout/creationColumns.spec.ts` | At 1,024 px Who they are and Details show the frame's two columns; at 699 px and 375 px, one; an open name table is still a sheet |
| L8 | `src/app/FirstSpellsStep.tsx`, `src/app/LanguagesStep.tsx`, `src/app/WeaponSkillsStep.tsx` (each passes `panel` as `GuidedCreation.tsx:839` does); `src/ui/creation.css`; the same layout spec as L7 | At 1,024 px a tapped spell, language or weapon opens beside the list, with an X; at 699 px it opens as today |
| L9 | `src/app/GuidedCreation.tsx` (the Patron step, `:870` on); `src/app/FirstSpellsStep.tsx` (`:49`, `:218-232`) and `src/app/LanguagesStep.tsx` (`:27`, `:226-232`), whose two copies become the shared part; the part in `src/ui/creation.tsx`; tests in `src/app/patronStep.test.tsx` | With thirteen patrons offered the step shows "Search patrons"; with twelve, none; typing filters by name and the picked patron stays shown; Magic's and Languages' fields behave as before |
| L10 | `src/app/GmCampaign.tsx` (the card, `:472-484`; its buttons, `:1062-1084`); tests in `src/app/smoke.test.tsx` or a new `src/app/gmApprovalCard.test.tsx` | Written from the frame's list. At least: Approve and Send back stay plain and the card stays in the book's type |
| L11 | `src/app/AddItem.tsx` (`:473-481`); `src/ui/parts.tsx` (`Stepper`, `:139`), not changed; tests in a new `src/app/addItemCount.test.tsx` | On the count screen − at one stays tappable and says "One is the fewest you can add."; + raises the count and the button's words ("Buy 3") follow it |
| L12 | Not listed until M9's offline queue exists: `src/ui/creation.tsx` (`:279-350`) and the queue | Written with M9 |

**Who touches what.** Rows that share a file go in one batch, at most three; batches that share a file run one after another.

| Batch | Rows | Shares | Order |
|---|---|---|---|
| A, the review | L1, L2, L3 | `Characters.tsx`, the review in `creation.tsx` and `creation.css` | First of A, B and C |
| B, the states | L4, L5, L6 | `creation.tsx`, `Characters.tsx`, `creationSteps.ts` | After A; after any `creation-table-sheet.md` row holding `src/ui/creation.tsx` (T2) |
| C, the iPad and the patrons | L7, L8, L9 | `creation.css`, `Characters.tsx`, `FirstSpellsStep.tsx`, `LanguagesStep.tsx` | After B; L7 after `creation-table-sheet.md` T1 (`KindredTables.tsx`). If L7 and L8 are refused, L9 runs alone |
| D | L10 | `GmCampaign.tsx` alone | Beside any batch |
| E | L11 | `AddItem.tsx` alone | Beside any batch |
| Not handed out | L12 | | With M9 |

A batch runs with the rows Francis has said yes to; a refused row leaves its batch smaller. Committed tests that state today's behaviour (L6's toasts, L3's and L7's one column) change in the same pull request, each named in its text.

## ⚑ for Francis

Collected, not decided. One question each; asked one at a time.

- ⚑ 1. **L1.** Put the special-approval card at the top of the review, as 22-G2 draws, instead of last (cs-46)?
- ⚑ 2. **L2.** Build the rest of 22-G5's sent-back layout, beyond the words and author line already built (cs-53)?
- ⚑ 3. **L3.** Two columns for the review on an iPad, as 22-G8 draws? You ruled on 2026-11-07 that only Race and Class keep two columns (cs-52).
- ⚑ 4. **L4.** Loading inside a step, as 23-H1 draws, beside the whole-screen loaders (cs-48)?
- ⚑ 5. **L5.** A skipped step's own line saying why it has nothing to choose, as 23-H3 draws (cs-51)?
- ⚑ 6. **L6.** Blocked taps in creation as pop-ups, as 23-H5 draws, instead of one-sentence toasts (cs-50; 06 and cts-5 state toasts)? Note: CLAUDE.md's rule says a blocked action "explains why in a pop-up", which the toasts read loosely.
- ⚑ 7. **L7 and L8.** Who they are, Details, Magic, Languages and Weapon skills in two columns on an iPad (19-D5, 19-D6, 20-E5 to E7)? Against: your 2026-11-07 ruling. For: you approved these frames on 2026-11-12, though Design's caption called the columns its proposal. One answer for both rows, or one each.
- ⚑ 8. **L9.** A find field on the Patron step past twelve patrons (14-07)? Not checked: whether any pack in play offers more than twelve (the packs are private), so it may never show.
- ⚑ 9. **L10.** Build the rest of 22-G6's GM card, beyond the book's type and the plain buttons (cs-47)?
- ⚑ 10. **L11.** The shared stepper on the shop's count screen (21-F5)? The same count screen serves the Pack's Add item sheet, so it changes there too (build once): yes to both, or creation's only?
- ⚑ 11. **L12.** Keep the offline step (23-H2) waiting for M9's offline queue? (No change today.)
- ⚑ 12. **Frames F to H were approved under your pre-approval of the lead's changes, not seen one by one.** For the rows from pages 21 to 23 (L1 to L6, L10 to L12), is a yes to the row enough, or do you want to see each frame first? Mockups first holds either way: the date of record is 2026-11-12.
- ⚑ 13. **Technical, for the driver: the frames are not in this repository.** Pages 14 and 19 to 23 live on the private repository's `design-december-mockups` branch. Before any row is handed out, their pictures (14-07, 19-D5, 19-D6, 20-E5 to E7, 21-F5, 22-G2, G5, G6, G8, 23-H1, H2, H3, H5) go to `docs/design/mockups/creation/final/png/` with rows in `docs/design/mockups/index.md`, so the builder and the review can see them. L2 and L10 cannot be described further until then.

## When a row is ruled

Its pull request records the `09` line Francis's answer gives, in the form `2026-11-2x — [sheet] <what> (Francis: "<his words>") — <why>`, and marks the ruling it supersedes (cs-46, cs-47, cs-48, cs-50, cs-51, cs-52 or cs-53) in a new ruling file, never by rewriting `dec-scene-whole-2026-11-14.md`. Docs each updates: 06 (Review step, Pinned note panel, Creation step shell, Add item sheet's creation variant, and the inventory's Code column), 05 where creation's behaviour is stated.

**Estimate:** if every row is ruled in, about 4¼ to 7¼ builder turns (A 1¼ to 1¾, B 1¼ to 2¼, C 1¼ to 2, D ¼ to ¾, E ¼ to ½), plus L12 with M9. The sizes were made without seeing the frames; L2 and L10 are sized again once the frames are read.
