---
status: pending
milestone: December first play (a player's bug report, 2026-11-24; row design-save-bonus-in-number)
absorbed-into: nothing yet. Once Francis picks: docs/09-decisions-log.md, docs/07-content-packs.md (Races, Classes, `saveModifiers`), docs/06-screens-and-design.md (the Save tile, the Figure head's sheet), docs/05-features.md (the sheet's saves)
supersedes: nothing until Francis picks. It would then supersede, for saves only: the 2026-10-25 line "Save modifiers … shown beside saves …, never added in (tentative)"; bq-8 of m5b-builder-questions-2026-11-03.md (a kindred's bonus by Constitution "beside the save, not added in"); pf-21 of dec-player-screen-2026-11-14.md ("shown beside the save and never added in"); the part of sv-2a (same file) that keeps the class-and-level line off a save's sheet; and, if he picks M, the part of sv-2 (same file) that puts the general rule on each save's sheet
---

# Save bonuses counted in the save's number (pending, 2026-11-24)

**Nothing here is ruled.** This file states the question, the options and the designer's pick. The drawings: `docs/design/mockups/december/42-save-bonuses-in-the-number.html` (frames 42-1 to 42-8, light and dark, with a critique of eighteen numbered findings; option D, added later the same day, is frames 42-9 to 42-14 with findings 19 to 30, by hand, a real `impeccable critique` by the PC session to follow).

## What happened

A player reported that his kindred's bonus to saves did not change his save tiles. The driver explained the standing ruling: a kindred's or class's save bonus (`saveBonus`, `saveBonusByCon`) and a rules set's score-driven modifier (`saveModifiers`) are shown beside the number, never added in. Francis, 2026-11-24: "this is a bad ruling." He wants saves to reflect these bonuses.

## Why the old ruling said "never added in"

| Reason given then | Still true? |
|---|---|
| "They apply only sometimes; the GM decides" (2026-10-25) | Only for a bonus with a condition ("vs venom"). A bonus with none always applies. |
| "The pack gives no structured way to say which way a save runs" (2026-11-03) | No longer: since pf-20 (2026-11-14) the rules set's `rolls.save` says `atOrOver` or `atOrUnder`. |

So the two reasons no longer cover a bonus that always holds.

## Proposed, the same in every option (S1 to S6)

| # | Proposal | Drawn |
|---|---|---|
| S1 | **A bonus that always holds is counted.** The tile, the sheet's head and its roll line show the number to roll. Where a high roll succeeds, +2 makes the number 2 lower; where a low roll succeeds, 2 higher. | 42-1, 42-3, 42-6 |
| S2 | **"Always holds" means:** a `saveBonus` with no `vs` / `against` / `when`; the "otherwise" part of a bonus written "+4 vs venom, +2 otherwise"; a `saveBonusByCon` entry that names a whole save. **"At times" means:** anything with a condition, a `saveBonusByCon` entry written for part of a save, and every `saveModifiers` entry (each has `appliesWhen`). | n/a |
| S3 | **The sheet shows how the number is reached,** under "Modifiers": the class's number first, then one row for each bonus, the bonus in the book's own sign on the left ("+2 from Bog folk") and the number after it on the right. Shown only when something changes the number; with nothing to count, the sheet is as today. This brings back a class-and-level row that sv-2a removed. | 42-3, 42-4 |
| S4 | **A bonus of 0:** no row, no line, as today. | 42-4 |
| S5 | **A rules set that does not say which way saves are rolled** (no `rolls.save`): nothing can be counted, so its bonuses stay beside the number, as today. | not drawn |
| S6 | **A bonus every save has at times** (a `saveModifiers` entry; the pack does not say which save it belongs to) is said once under the Saves heading ("Spell ward: +1 vs magic, from Lore."), not on five tiles. Each save's sheet carries its worked figure. | 42-5 |

## The question: a bonus that holds only at times

The tile cannot change for every roll. Three ways:

| | A. A second quiet figure | B. The best case as the number | C. A mark |
|---|---|---|---|
| The tile | Keeps the usual number; a quiet line under it: "11 vs venom" | Shows 11 | Keeps the usual number; "±" in its corner |
| The sheet | Head 13; a second roll line "Vs venom: 11 or higher succeeds." | Head 11; "Otherwise: 13 or higher succeeds." | As A |
| At a glance | Both numbers, no tap | One number, wrong for most rolls | "There is more": one tap |
| Risk | The row grows a line; long or several conditions wrap (four lines measured) | A fail called as a pass | The bonus forgotten; the sign is never explained |
| Critique's score | 29 of 40 | 22 of 40 | 22 of 40 |

### Option D, added later the same day (pending)

Francis, 2026-11-24: "Can we show the bonus underneath like attributes? Mock it up w impeccable and your recommendations." Read as: the save tile takes the Score tile's shape, a figure with a caption under it (06, Components, "Stat"), and the bonus sits on that caption. No new part. Two readings, both drawn (frames 42-9 to 42-13; 42-14 sets them beside the built screen on a tablet, light). **Neither is chosen.**

| | D1. The counted number, the bonus named under it | D2. The book's number, the bonus under it |
|---|---|---|
| The tile's figure | The number to roll (S1 holds) | The book's number: **S1 does not hold**. This is the old "beside, never added in" ruling with the bonus made visible, the ruling Francis called bad |
| The caption, a bonus that always holds | "+2 Bog folk": already in the figure | "+2 Bog folk": for the player to apply |
| The caption, a bonus that holds at times | "+2 vs venom": for the player to apply | The same |
| Two bonuses on one save | A caption with parts, a line each | The same |
| A bonus of 0 | No caption (S4) | The same |
| The sheet | As A's (42-3): head, roll line and S3 rows agree | The head is the book's number; the roll line and the S3 rows give the number to roll, so the two disagree (42-13) |
| At a glance | The number to roll and what made it; a sum for a bonus that holds at times | Every bonus in sight; a sum at every roll |
| Risk | One caption line with two meanings: "+2" under a counted figure read as "add 2", the bonus counted twice. It also reads against the Scores row above, where the caption is never in the figure | The sum left to the player, the wrong way round where low rolls succeed |
| Measured on the built tile | One line at 375 and 1180 px (the row 92 px, from 67); two lines at 1024 px (113 px). A's "11 vs venom" measures the same | The same |
| Critique's score (by hand) | 22 of 40 | 23 of 40 |

A and D use the same part: A's quiet line is the Stat tile's caption too. They differ in what the caption says. A's rule is the Score tile's own: the caption carries only what is not in the figure.

## Added the same day: each save's own line, and the general rule

Francis widened the question (2026-11-24, the driver's chat): a save's sheet must show, at its top, that save's own one-line description from the pack: "This should be passed by the pack, not the app". The driver's facts: the pack format already holds it (`saveCategories[].notes`; the app reads only the name and `short` today); the rules set's `saveRule` is one plain text, the same on every save's sheet; the bare "<score> vs magic" that ends every save's sheet today is a bug (a `saveModifiers` entry printed without its number), to be fixed as a Modifiers line with its number.

| # | Proposal | Drawn |
|---|---|---|
| S7 | **A save's sheet opens with that save's own line, in the pack's words** (`saveCategories[].notes`), under the head and above the roll line. The app writes none: a save with no line has none. | 42-7, 42-8 |
| S8 | **A `saveModifiers` entry is never printed bare.** It is a Modifiers row with its number ("Vs magic only: +1 from Lore", and the number it gives). An entry that gives nothing is left out. | 42-7 |

**The question: where the general rule (`saveRule`) lives.**

| | K. Keep it on every save's sheet | M. Move it behind an ⓘ beside the Saves heading |
|---|---|---|
| A save's sheet | The save's line, the roll, Modifiers, then the same paragraph as on the other four | Only what is about this save |
| New on the tab | Nothing | One ⓘ (44 px) and its pop-up: the roll line, the general rule, the source |
| Against an earlier ruling | None | sv-2 (2026-11-14): a tap on a figure "shows its rule at once". With M the save's own line is that rule |
| A save with no line from the pack | Still has the general rule | The number, its roll line and the source |

**The designer's pick: M.** Each fact gets one home: the save's sheet says what this save is for and what number to roll; the rule common to all five is said once. The cost is a new target on a heading row, and a Saves heading that differs from Scores and Skills unless they follow.

## The designer's pick

**A,** with S1 to S6 (unchanged after option D was drawn; if Francis wants the kindred named on the tile, D1 with plainer words, "with +2 Bog folk" and "+2 more vs venom", frame 42-11, is the second choice; not D2). A save tile exists to give the number to roll without a tap, and only A gives the right number for both cases. B shows a number that is wrong whenever the condition does not hold, which is most rolls. C is calm but sends the player to the sheet for the very thing they opened the tab to read.

**Builder, then critic, in short.** First pass: count everything and show the best number (B), the least to build. Challenge: a save tile that is right only against venom fails at the table, silently. Second pass: a mark (C). Challenge: a sign with no words, and useless when every save carries it. A is what is left; its real weakness is height and long words, which is why S6 takes the one bonus every save shares off the tiles, and why ⚑ 2 below needs an answer.

**On option D, builder then critic.** First pass: D1, since the shape is built, the number is the one to roll and the player sees his bonus. Challenge: the same grey line says "already in" under one save and "not in" under the next, against the Scores row's meaning; a kindred that helps every save writes itself five times. Second pass: D2, which reads like a Score tile. Challenge: it is the ruling Francis called bad, drawn better, and its sheet shows two numbers. What is left is A, built with the same caption.

## ⚑ For Francis (one at a time)

| # | Question | The designer's lean |
|---|---|---|
| 1 | A, B, C, D1 or D2? (A, B and C differ on a bonus that holds at times; D1 also names a counted bonus under the figure; D2 counts nothing.) Pending | A |
| 2 | If A: a tile with long or several conditions. (a) Let it wrap, nothing cut (four lines measured for a long one); (b) one condition at most on the tile, and "more on its sheet" beyond that or beyond two lines; (c) the pack gives each condition a short word for the tile. | (a) now; (c) is a pack-format change and can follow |
| 3 | S6: the bonus every save shares, once under the heading? | Yes |
| 4 | A number that would fall below the die's lowest face (or above its highest, where low rolls succeed): stop at 1 with a plain line saying why, or show the worked number ("−1")? | Stop at 1; the words are finding 8 of the critique |
| 5 | S3: the class's row comes back on a save's sheet when something is counted (it reverses part of sv-2a). | Yes: the rows need a starting number |
| 6 | The right-hand column as the number after each row (drawn), or each part as on the Armour class sheet ("−2")? | As drawn |
| 7 | The general rule: K (on every save's sheet) or M (once, behind an ⓘ beside the Saves heading)? It touches sv-2. | M |
| 8 | S7 and S8 as proposed? | Yes |

## Not covered here

- A status that changes saves (a blessing's +1 for some turns), a save set by hand, and the GM's save prompt in a fight (today the modifier is "offered" there): not drawn. The same rule would be expected to follow; each needs its own frame before it is built.
- Scores, skills and armour class: unchanged. Armour class already counts its bonuses (cs-7).
- No pack-format change is needed for S1 to S6. Option (c) of ⚑ 2 would be one.

## Cost to build (an estimate, not a plan)

Data and logic: the save's number worked out with its bonuses and the roll's direction, its tests, and the rows for the sheet. Screens: the tile's second line (A; D1 and D2 use the same part and cost about the same) and its spoken name, the sheet's rows and second roll line, the line under the heading. The save's own line, the Modifiers row for a `saveModifiers` entry, and (M) the ⓘ with its pop-up add a little. About 5 to 7 builder turns, one pull request, or two if the bug fix (S8) goes first; no migration, no stored data changes. Nothing is built until Francis picks and approves frames.

## When he picks

Docs to update: `docs/09-decisions-log.md` (one line, below), `docs/07-content-packs.md` (Races and Classes: `saveBonus`, `saveBonusByCon`; `saveModifiers`), `docs/06-screens-and-design.md` (the Save tile and its sheet in the Components inventory), `docs/05-features.md` (the sheet's saves; the save's own line from `saveCategories[].notes`; where the general rule lives); mark the superseded parts in the three older ruling files; a plan in `docs/plans/`.

The `09` line, to be completed with his choice: `2026-11-24 — [sheet] A save bonus that always holds is counted in the save's number; one that holds at times is shown <A | B | C | D1 | D2>; a save's sheet opens with the save's own line from the pack, a save modifier is never printed without its number, and the general rule <stays on each save's sheet | moves behind an ⓘ beside the Saves heading> — "this is a bad ruling" and "This should be passed by the pack, not the app" (Francis), on a player's report that his kindred's bonus did not change his saves — design/rulings/dec-save-bonus-in-number-2026-11-24.md`
