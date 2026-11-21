# Plan: the creation rework (cw-11)

Written by the design agent, 2026-11-06. Ruling: `docs/design/rulings/m5b-gate-creation-words-2026-11-06.md` (cw-1's list, cw-5, cw-7, cw-11). **Francis's first priority (2026-11-06): nothing goes to his players until the reworked creation is live;** then the Table Generator in creation (#529), then the gate. Mockup, approved 2026-11-06: `docs/design/mockups/creation/12-rework-phone.html` (picture `creation/png/12-rework-phone.png`). This file makes no rulings. No migration expected.

## What this step delivers (the phone first; the tablet keeps the same parts in a centred column)
1. **The shell.** No "‹" or "›" in creation: **Leave** is a worded button at the top; the step header loses its back caret (Back is in the footer); **Help me choose** is a small button with an ⓘ; rows that unfold carry a plus or minus square button; the footer sits in the page's flow and is always whole (the status line, Back, Next).
2. **Scores.** One row per ability on a phone: the **full name** (a tap opens what the score does, in plain words, then what this number does), the stepper in line, the caption of what the number changes under it. Three tiles across on a tablet, the stepper centred.
3. **Pick steps.** The name (marked ⓘ) opens the entry; Pick picks; a closed choice shows ▲ and why, with no Pick (as cw-8).
4. **Who they are.** The name tables start **folded**, one row each (the kindred's, then any pack's "Optional · from <pack>"); a tapped name fills the field and can be typed over. Hit points as a stepper beside its one-line rule. Outlook as pick rows. **The liege as pick rows** (cw-5): the house's name opens its entry (the liege table's note), Pick sets it and says what it changed (toast with Undo). "What the rules work out" folded (cw-7; the heading replaces "Derived fields").
5. **Gear.** Starting coin first: a stepper that **starts at the setting's usual amount** (the average of the pack's money dice), typable in the middle. Then **To choose**: each kit (Pick), the keepsake or trinket (Roll), the shop (Open). Then **Yours already**: what is given, folded. **A kit with rolls:** Pick opens its tables one at a time (roll at the table, tap the row, Next roll); after the last, back on Gear the kit shows what it gave, with **Change the rolls** and **Take it off**.
6. **Details.** Age, height and weight as steppers that start at the kindred's usual, typable; each describing table one row (Roll, then the result with Change); the rest folded as "N more tables".
7. **The review.** One card per step with **Change** at its top right; scores on one line; gear as lines (the kit and what it gave, the keepsake, Given folded) with "N items · load · X left of Y"; magic by source ("From your kindred", "From your class"); "What the rules work out" folded, each figure a tap; **Save and leave** and the accent **Send to your GM**. Change opens that step; Back from it with nothing changed returns to the review; a change that touches later steps walks only those, then returns.
8. **The GM's approval card.** Starting coin as "rolled · spent · left".

## Rests on
05 character creation (cr-1 … cr-6, ct-1 Pick moves on, cs-1 … cs-7); 06 the component inventory (PickRow and its `closed` variant, the stepper, the table sheet, Help me choose) and row states; the words and voice guide; `docs/plans/m5b-creation-tables.md` (#529, "Optional · from <pack>").

## Build order (slices that can run side by side; each its own pull request, pushed once)
- **A · Shell, Scores, pick steps** (1–3).
- **B · Who they are and Details** (4, 6).
- **C · Gear and the kit's rolls** (5).
- **D · The review and the approval card** (7, 8).
Inventory rows and the Code column change in the same pull request. Gallery scenes for each changed state (help open, a closed row, a folded group, the kit's roll pop-up, the review).

## Tests (purpose first)
- No creation screen draws "‹" or "›" (a layout test over the steps).
- The footer's Next is fully inside the screen at 375 × 667 and in landscape on a phone, with the browser's bottom bar.
- A name table starts folded; a tapped name fills the field; typing over it keeps the typed name.
- Starting coin starts at the pack's average and can be typed; Next still explains an overspend in words.
- A kit's rolls come one at a time; closing midway keeps nothing; finishing shows the results; Change the rolls runs them again; Take it off removes exactly what the kit gave.
- Going Back from Gear and Next again gives the kit once (#524's test still passes).
- Change from the review, then Back with nothing changed, lands on the review.
- A liege pick sets the outlook, says so, and Undo restores both.
- Every state: empty, loading, a pack with no names or kits or details, long names, 0 and 999, offline.

## Scope checks (write one and stop)
No rolling by the app. No typed-over details beyond the name and the numbers. No change to what a step asks or to its rules. The "‹ ›" removal outside creation (its own mockup first).

## ⚑ and data questions
1. **Full ability names and what each does:** does every pack carry a full name and a plain description for each ability (and where)? If not, the pack session adds them; the app shows the abbreviation only where no full name exists.
2. **"The setting's usual" for coin, age, height and weight:** coin is the average of the money dice (the app works it out). Age, height and weight: does a kindred carry a usual value or dice? If not, the step keeps a typed number with no starting value.
3. **A kit's one line** ("Instead of buying: armour, a weapon and travelling gear"): the pack's own line where it has one; otherwise the app's by kind (free kit, priced kit).
4. **Affiliation** (fae-woodland's sheet line): a knight's starts as their liege's house, editable; the help line reworded. To rule with Francis.
5. **The second mockup page** (the tablet; spells, languages, weapon skills; errors and loading): drawn while slices A–D are built; where a slice needs it first, ask.

## Answers to the builder (2026-11-06; design details inside the approved mockup, for Francis to judge in the pictures)
1. **Age, height and weight steppers** read `races[].usual` (`{ base, dice?, times?, unit }`, unit years / in / lb, or `variants` by sex), never the word strings, which stay as the caption. Age: step 1, or `times` where the formula has one. Height: stored in inches, shown as feet and inches, step 1 in; typing takes "5 7", "5'7" or inches. Weight: pounds, step 5. Start: base plus the dice's average, rounded to the step; with variants the first one's, the caption naming each. No `usual`, or an unreadable one: the typed field as today, never a guess. An old free-text value shows in the stepper if it reads as a number in the unit, else unchanged in the typed field.
2. **Coin.** The app never rolls, so an untouched starting amount is "the usual, not rolled"; stepped or typed, it is "rolled". Gear: "Starts at the usual N. Roll at the table and change it to what you rolled." Never blocks Next. The review and the approval card: "N rolled · +M from <the pick> · S spent · L left", or "N, the usual (not rolled) · …"; the "from" part only when picks add coin (rc-2).
3. **The kit's rolls** are a new Dialog variant, "Roll sequence" (an inventory row): one step per thing to settle in the kit's order: a roll; a roll made several times as that many steps ("Weapon · 1 of 2"; with `distinct` a taken row shows ▲ "Already rolled"); a choice (`oneOf`) as a step of pick rows titled "Choose one". Head: the kit's name and ✕. Then "Step 2 of 4 · Armour · roll d6 at the table, tap what you rolled". Foot: the status line, Back (the previous step; closes on the first), the accent Next (Done on the last); Next with nothing tapped explains. ✕ midway keeps nothing and says so. Afterwards Gear shows the kit Picked ✓ with what it gave, "Change the rolls" and "Take it off".
4. **Name tables:** one row per table, as the data has it ("Stone kin names · d20 · first names, family names"), with an **Open** button that opens today's table sheet; a tapped cell fills that part of the name. A plus is only for unfolding in place. The mockup's separate first-name and family-name rows were a simplification.

## Pack data (published 2026-11-06)
classic-advanced 0.6.77, fae-woodland 0.3.67, the zine 0.5.46 (conversion 0.2.59): `abilities[].description`; `races[].usual` (all six fae-woodland kindreds; height and weight for seven classic-advanced races, none for human, half-elf, half-orc, no ages); a `blurb` on every kit (12 words or fewer, no roll count); the liege rows' plain `name`, `alsoFills: "affiliation"` on the liege field, Affiliation's reworded help (cw-12).

## Estimate (the builder's scout, main 7aac10fe)
About half a day of builder time per slice; three builders at most at once (the machine's memory). A first (it owns the shell, the footer, the typable stepper and the plus/minus fold); C and D start from A's branch when A pushes; B after #529 merges (same files), with `alsoFills` (4–6 turns). B is the riskiest.

## Departures
(The builder keeps this current in the same pull request.)
