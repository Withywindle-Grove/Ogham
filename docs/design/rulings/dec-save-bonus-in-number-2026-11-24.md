---
status: absorbed
milestone: December first play (a player's bug report, 2026-11-24; row design-save-bonus-in-number)
absorbed-into: 2026-11-25: docs/09-decisions-log.md (nine lines, 2026-11-25), docs/05-features.md ("Save bonuses in the number"), docs/06-screens-and-design.md (Type and its table; the Save row; the Breakdown sheet; the gallery tests), docs/07-content-packs.md (`saveBonus`, `saveBonusByCon`, `saveModifiers`; the two flags under `naturals` and a condition's short word, as pending), docs/04-data-model.md (saveModifiers), docs/11-modelling-gaps.md (G-220, G-221, G-222), docs/10-open-questions.md (what it left open), docs/testing.md (the under-14 rule's exception). Not in that commit: CLAUDE.md, hard rule 7's sentence for the named exception (see "Absorbed", below)
supersedes: for saves only: the 2026-10-25 line "Save modifiers … shown beside saves …, never added in (tentative)"; bq-8 of m5b-builder-questions-2026-11-03.md (a kindred's bonus by Constitution "beside the save, not added in"); pf-21 of dec-player-screen-2026-11-14.md ("shown beside the save and never added in"); the part of sv-2a (same file) that keeps the class-and-level line off a save's sheet; and the part of sv-2 (same file) that puts the general rule on each save's sheet (he chose M)
---

# Save bonuses counted in the save's number (absorbed 2026-11-25)

## Absorbed, 2026-11-25: every answer, and whose words

Francis's own words are quoted. "Overnight" means: the driver's advice, approved under Francis's overnight authority (25 Nov), after the PC session's impeccable critique of c3ce6a4. His words for that authority, until 07:00 EST on 25 November: **"I approve your advise on screens after impeccable reviews."** The critique scored the page 34 of 40.

| Topic | Ruled | Whose words | Drawn |
|---|---|---|---|
| ⚑ 10 | The at-times line keeps "vs" ("11 vs venom") and is **12 px**: a named exception to hard rule 7, for that line only | Francis: "10 make an exception and drop to 12 px" | 42-29; 42-28 (third picture) |
| ⚑ 10, the critique's finding 1 | The line's **number is in ink**; "vs venom" stays muted; 12 px, the same font and weight | Overnight | 42-29, 42-28, 42-25 |
| ⚑ 11 | The number stops at 2 **only where the pack says so as data**; otherwise at 1, with no rule sentence | Francis: "11-13 agreed" | 42-25 |
| ⚑ 12 | On the sheet, the "Only at times" label and the "→" figures | Francis: "11-13 agreed" | 42-26 |
| ⚑ 13 | Keep the ⓘ, at the end of the roll line | Francis: "11-13 agreed" | 42-29, 42-28 |
| The critique's finding 4 | 42-29's 1024 px block redrawn to match the real screen (42-28): the roll line with the ⓘ at its end takes its own row under "Saves"; the heading row grows from 24 to 49 px. Accepted | Overnight | 42-29 |
| ⚑ 14 | **Yes.** A sheet row that the floor held back says "no lower than 1" in quiet words. It says what happened to this character's number, not a rule | Overnight | 42-25, 42-26 (fifth sheet) |
| ⚑ 15 | **Keep S6**, once under the Saves heading, reworded so it has no signed number: "Vs magic: each save 1 lower (Spell ward, from Lore)." Where low rolls succeed it reads "1 higher". The app builds the words from the rules set's direction | S6 itself is Francis's (24 Nov, "2–8 as recommended"); keeping it and the new words are overnight | 42-29; 42-28 (third picture) |
| 42-25, the sentence | At a stop at 2 that the pack flags as data, the sheet shows the pack's own sentence under the roll line (it agrees with the number). At the stop at 1, no sentence, as ruled | Overnight | 42-25 |
| The top of the die (the critique's finding 3) | Ruled the same way as the bottom: where an at-times bonus pushes the number past the die's top face ("21 vs venom"), the line shows the worked number as it is (honest: it cannot succeed). It stops at the top face only if the pack flags, as data, that a top natural always succeeds: the same pending pack-format flag as the bottom's | Overnight | 42-25 (second row) |

**Build notes** (overnight; for the plan):

| # | Note |
|---|---|
| 1 | A no-break space between the number and "vs", so a wrap never leaves the number alone |
| 2 | A layout check at 80 px with "20 vs venom", in Chromium **and** WebKit, that accepts one line or the clean break "20 vs" / "venom", and nothing else |
| 3 | **One** role token only, `--text-save-line: calc(12px * var(--text-scale, 1))`, and **no** general `--text-12` (this replaces the two-token proposal in the exception's table below) |
| 4 | A guard test that `--text-save-line` is used only in the save tile's CSS |
| 5 | The layout checks' "nothing under 14 px" whitelists that one selector by name |

**The frames of record:** 42-29, 42-28's third picture, 42-25 and 42-26, with the sheets of 42-19 and 42-20. 42-22, 42-23, 42-24 and 42-27 are kept as first drawn (the ⓘ beside "Saves", the heading's line with "+1", the line all muted); where they differ, 42-29 wins. On the sheets the rows keep the book's own sign ("+1 from Lore"; S3): ⚑ 15 reworded the heading's line only.

**Drawn beyond what was said, for the driver to confirm:** 42-26's fifth sheet puts "no lower than 1" on an "Only at times" row (⚑ 14 with ⚑ 12); 42-25's flagged sheets say "no lower than 2" and "no higher than 20" (the stop's own number); 42-29 shows the "1 higher" wording and the usual case with the hue taken away.

**Not in the absorbing commit: `CLAUDE.md`.** The sentence for hard rule 7 is ready: "One named exception: a save tile's at-times line is 12 px (`--text-save-line`), ruled by Francis 2026-11-25; nothing else under 14." The design agent does not change `CLAUDE.md` on another session's word; it goes in from Francis or from a session he tells directly. Until then 06 (Type) and 09 carry the exception.

**Left open** (in `docs/10-open-questions.md`): a tile's own figure past the hard end; a status that changes saves, a save set by hand and the fight's save prompt; the two flags' shapes and a condition's short word (G-220 to G-222); the 12 px line at the real table.

The `09` lines are in `docs/09-decisions-log.md` under 2026-11-25 (`[sheet]` four, `[ui]` two, `[words]` two, `[packs]` one).

---

*What follows is the file as it stood while pending, kept as the record. Where it differs from the table above, the table wins.*

**Francis answered the questions on 2026-11-24 and ruled on 2026-11-25, twice and then on ⚑ 10 to 13; the drawing of his answers (frames 42-29 and the redrawn 42-28, then 42-22 to 42-27, with the sheets of 42-19 and 42-20) waited for his approval, so this file stayed pending** until 2026-11-25 (above).

## Francis's rulings on ⚑ 10 to 13, 2026-11-25 (the driver's chat)

His words: **"10 make an exception and drop to 12 px, 11-13 agreed"**.

| ⚑ | Ruled | Drawn |
|---|---|---|
| 10 | The line of a bonus that holds at times keeps "vs" ("11 vs venom") and is set at **12 px**: a **named exception to hard rule 7** ("nothing under 14"). Francis owns the hard rules and made it. It covers that one line only: not the tile's name, its figure, or anything else. Forms (b1) to (d) are not taken up. | 42-29; 42-28 (third picture) |
| 11 | The number stops at 2 **only where the pack says so as data** (an explicit flag that a low natural fails: a pack-format change, to `07` as pending). Otherwise it stops at 1, with no rule sentence. | 42-25, as drawn |
| 12 | On the sheet: the "Only at times" label and the "→" figures. | 42-26 |
| 13 | Keep the ⓘ, at the end of the roll line. | 42-29, 42-28 |

**The exception (⚑ 10), for the record.**

| | |
|---|---|
| Where | The line under a save tile's figure that gives the number to roll when a bonus holds at times. Nowhere else. |
| Why | Five across was ruled, with "try to prevent wrapping with small font or abbreviation"; at 14 px "11 vs venom" is 75.8 px in 70 px of room; he chose smaller type over shorter words: "make an exception and drop to 12 px". |
| Risk | The smallest text in the app carries a number needed at a roll, read at arm's length on a tablet at the table. Larger text raises it with everything else (15 px). The sheet repeats it at 16 px. |
| Colour | Muted, kept: 6.31 to 1 on the tile in light, 7.63 to 1 in dark (small text needs 4.5 to 1). Ink (15.82, 14.63) is not needed. |
| Token | None exists for 12 px (the scale starts at `--text-14`). Proposed, in the drawing only: `--text-12: calc(12px * var(--text-scale, 1))`, with the role name `--text-save-line: var(--text-12)`. The builder adds both with 06's tokens table. |

**Measured at 12 px inside the built save tile** (Chrome, 2026-11-25; Bitter). Room: 70 px (80 px tile), 87 px (97 px tile), 99 px (phone).

| The words | 14 px | 12 px | 80 px tile | 97 px tile | Phone |
|---|---|---|---|---|---|
| 11 vs venom | 75.8 | **64.9** | one line, 5 px to spare | one line | one line |
| 20 vs venom | 81.0 | 69.4 | one line, 0.6 px to spare (fragile) | one line | one line |
| 7 vs marsh-rot | 94.2 | 80.8 | **wraps, two lines** | one line | one line |
| 11 vs drowning | 93.5 | 80.1 | wraps, two lines | one line | one line |
| 20 vs marsh-rot | 103.8 | 88.9 | wraps | wraps (2 px over) | one line |
| 12 vs barrow-lights and will-o'-the-wisps | 263.2 | 225.6 | wraps, five lines | three lines | three lines |
| Two conditions joined | 172.8 | 148.2 | a line each | a line each | a line each |

The row of tiles at 1024 px: 67 px today, 113 px with the line at 14 px, **89 px at 12 px**, 107 px where "7 vs marsh-rot" wraps. With the ⓘ at its end the roll line (385 px) still takes its own row in the 430 px column: the heading is 49 px (24 today). With Larger text at 1180 px "11 vs venom" (81.2 px) fits on one line.

**For the driver, not ruled:** 42-25's second sheet shows the pack's own sentence under the roll line where the number stops at 2. "With no rule sentence" was said of the stop at 1; whether the sentence shows beside a flagged stop at 2 is not said. Left as drawn.

## Francis's rulings, 2026-11-25 (the driver's chat)

| Topic | His words | What it means |
|---|---|---|
| ⚑ 9, the tablet | "Stick with 5 across, try to prevent wrapping with small font or abbreviation." | **Five across.** Three across is not taken up. The line of a bonus that holds at times should stay on one line: the ways are drawn (42-23, 42-24) and are ⚑ 10 below. |
| The caption of a counted bonus | "If we're adding it to the number we don't need with bog folk. Only partial save like +2 vs poison needs to be listed." | **This replaces "5(b)" of 2026-11-24.** A bonus that always holds is counted into the figure and gets **no caption on the tile**. Only a bonus that holds at times gets a caption, A's line ("11 vs venom"). The source of a counted bonus is shown only on the save's sheet (the S3 rows). |

**The caption's rule now:** a caption under a save's figure is always something that is *not* in the figure, as on a Score tile. No signed number appears on a save tile.

**On "small font"** (replaced the same day by the exception above, for the tile's line): not available. The built caption is 14 px (hard rule 7: nothing under 14 px) and the tile's side padding is 4 px, the smallest spacing token. Only the words can change.

## The revised drawing, 2026-11-25 (awaiting approval)

| Frame | What |
|---|---|
| 42-29 | **The line at 12 px:** the usual case and another character's longer data at 80 px, 97 px and on a phone; 14 px beside 12 px; the widest figures; Larger text (15 px) at 97 px. The ⓘ at the end of the roll line |
| 42-22 | The tiles five across at 1024 px (80 px tiles) and 1180 px (97 px), and on a phone (three across, 109 px): counted saves with no caption, "11 vs venom" for a bonus at times, and the bonus every save shares once under the heading (S6); another character's longer conditions; and, not ruled, that shared bonus as a line on every tile (⚑ 15) |
| 42-23 | Ways to keep the line on one line, at 80 px and 97 px: (a) as built, (b1) "11 venom", (b2) "venom 11", (b3) "11 vs ven.", (c) the pack's short word, (b1 + c), (d) a cut with "…" |
| 42-24 | The same forms on a phone |
| 42-25 | An option: the number stops at the lowest roll that can succeed. A second option, not ruled: a stopped row says "no lower than 1" (⚑ 14) |
| 42-26 | An option: on the sheet, an "Only at times" label and "→ 11" figures, on the sheets of 42-22's character |
| 42-27 | An option: the Saves roll line itself opens the general rule, with no ⓘ |
| 42-28 | Tablet landscape, light, redrawn: the built screen beside the revised A with "11 vs venom" at 14 px (two lines) and at 12 px (one line, as ruled); the second and third are the built screen edited in a browser, not built, each with the ⓘ at the end of the roll line and the shared bonus's line under the Saves heading. The "11 venom" picture is withdrawn |

Of the drawing of 2026-11-24, the "with Bog folk" captions and the three-across blocks (in 42-15 to 42-18 and 42-21) are replaced; the sheets (42-19, 42-20) stand. Findings 42 to 55 on the page are the designer's critique of the new frames, by hand; the PC session's real `impeccable critique` follows.

**Measured inside the built save tile** (Chrome, 2026-11-25; the caption is Bitter 14 px). Room: 70 px in an 80 px tile, 87 px in a 97 px tile, 99 px on a phone.

| Form | The usual case | Width | One line at 80 px | at 97 px | A longer condition ("marsh-rot") | A long one |
|---|---|---|---|---|---|---|
| (a) as built, "vs" | 11 vs venom | 75.8 px | no (6 px over) | yes | 94.2 px: no, no | wraps: five lines, four |
| (b1) no "vs" | 11 venom | 59.2 px | yes | yes | 77.7 px: no, yes | wraps: four lines, four |
| (b2) name first | venom 11 | 59.2 px | yes | yes | 77.7 px: no, yes; the number drops alone | wraps, the number last |
| (b3) three letters | 11 vs ven. | 57.4 px | yes | yes | "7 vs mar." 55.6 px: yes, yes | "12 vs bar." 56.6 px: yes, yes |
| (c) the pack's short word, "vs" kept | 11 vs venom | 75.8 px | no | yes | "7 vs rot" 45.4 px: yes, yes | "12 vs lights" 68.8 px: yes (1 px to spare), yes |
| (b1 + c) the pack's short word, no "vs" | 11 venom | 59.2 px | yes | yes | "7 rot" 28.8 px: yes, yes | "12 lights" 52.3 px: yes, yes |
| (d) cut with "…" | "11 vs ven…" at 80 px; whole at 97 px | cut to fit | yes | yes | "7 vs mars…", "7 vs marsh-…" | "12 vs bar…", "12 vs barro…" |

Two conditions on one save are a line each in every form: the shortest joined form ("9 venom, 7 rot") is 90.9 px, over at 80 and at 97 px. On the built screen at 1024 px the row is 67 px today, 113 px with "11 vs venom" (two lines) and 92 px with "11 venom" (one). With Larger text the built row at 1024 px already drops to three across by itself (a name never breaks inside a word); not drawn.

**The pack format, checked in `docs/07-content-packs.md`:**

- **A short word for a condition: no.** `saveBonus` is a whole number, `{ bonus, vs?, saves? }` or a list; `vs` is free words. `saveBonusByCon` and `saveModifiers` have none either. Form (c) is a pack-format change (an optional short form beside `vs`).
- **"A rolled 1 always fails" as data: in part.** `naturals.save.low` is `{ on, text }`: the face is data, what happens on it is the pack's words, and 07 rules it "never automated"; the app reads none of it today. Option 42-25 needs a ruling that a low natural on a save means "fails", or a new key.

## ⚑ Open after 2026-11-25 (one at a time): 10 to 13 answered that day (above); 14 and 15 open

| # | Question | The designer's lean |
|---|---|---|
| 10 (**answered: "vs" kept, 12 px**) | The line of a bonus that holds at times, to stay on one line: (a) as built, it wraps at 80 px; (b1) "11 venom"; (b2) "venom 11"; (b3) "11 vs ven."; (c) a short word from the pack; (d) a cut with "…". | **(b1)**, the same words on every device, nothing cut; a condition too long for the tile wraps as ruled (question 2, a); **(c) follows** as an optional short word in the pack. Not (b3), not (d). |
| 11 (**answered: 2 only where the pack flags it as data**) | A number stops at the die's lowest face (ruled, question 4), or at the lowest roll that can succeed where the pack says a rolled 1 always fails (42-25)? | Keep the ruling; show the pack's own sentence under the roll line where it has one. |
| 12 (**agreed**) | On the sheet, an "Only at times" label and "→ 11" on the rows that hold at times (42-26)? | Yes: the sheet is now the only place a counted bonus is explained. |
| 13 (**answered: keep the ⓘ, at the end of the roll line**) | The roll line as the tap that opens the general rule, in place of the ⓘ (42-27)? | Keep the ⓘ (ruled M). The tap line is 44 px against 51 on a tablet, taller on a phone, and the Scores line beside it would not be a tap. |
| 14 (**answered: yes**) | A Modifiers row that the stop holds back says so in quiet words under it, "no lower than 1" (42-25, fifth sheet; the PC session's critique, finding 3)? Question 4 was ruled "with no sentence that states a rule". | Not given: drawn at the driver's word as an option only. |
| 15 (**answered: keep S6, reworded with no signed number**) | The bonus every save has at times (the +1 against magic): once under the Saves heading (S6, ruled 2026-11-24, and drawn so), or a line on every tile, as the PC session's critique read "Only partial save like +2 vs poison needs to be listed" (42-22, third set)? | Keep S6: on every tile it is five lines that say one thing, two lines deep at 80 px and four on a save with a second condition. |

**Redrawn 2026-11-25 after the PC session's `impeccable critique`, finding 1** (the tiles and the sheets disagreed: the tiles had no word of the +1 against magic that every sheet shows, and 42-26 used another character's Fever). One character now runs through 42-22, 42-26, 42-27 and 42-28, and his sheets are 42-19's: Fever 13 with "11 vs venom" and, on its sheet, 12 against magic; Wisps 12, 11 against magic. Every row of a sheet that holds at times is on the Player tab: on its tile, or in the heading's line. The forms of 42-23 and 42-24 are untouched.

For the plan, not for Francis unless he wants it: finding 31 (the ⓘ pushes the Saves roll line onto its own row at 1024 px) still stands.

---

*What follows is the file as it stood on 2026-11-24, kept as the record. Where it differs from the rulings of 2026-11-25 above, they win: "5(b)" is replaced, and ⚑ 9 is answered (five across).*

## Francis's answers, 2026-11-24 (the driver's chat)

| Question | His answer | His words, or what it means |
|---|---|---|
| 1. A, B, C, D1 or D2 | **A** | "We can't add the modifier directly to save. For one thing a low score is better than a high score so you'd want to reduce the score by the bonus. I agree A is the move." S1 already works this way: where a high roll succeeds a +2 makes the number 2 lower; the direction comes from the rules set's `rolls.save`. |
| 2. Long or several conditions on a tile | **(a)** | "2–8 as recommended." A long condition wraps; nothing is cut. |
| 3. S6, the shared bonus once under the heading | **Yes** | As above. |
| 4. A number past the die's lowest face | **Stop at the lowest face, with no sentence that states a rule** | As above; finding 8's second fix. Where low rolls succeed, the stop is the die's highest face. |
| 5. The class's row back on a save's sheet (S3) | **Yes** | As above. |
| 6. The sheet's right-hand column | **As drawn** (the number after each row) | As above. |
| 7. The general rule | **M**: once, behind an ⓘ by the Saves heading | As above. |
| 8. S7 and S8 | **Yes** | As above. |
| "5(b)" **(replaced 2026-11-25: a counted bonus gets no caption on the tile; see the top of this file)** | **A counted bonus names its source on the tile in words, with no signed number** ("with Bog folk" under Wisps 12). A bonus that holds at times keeps A's line ("11 vs venom"). | From the PC session's `impeccable critique` of option D, its finding 5. **The caption's rule: a signed number never appears under a counted figure.** |
| "draw 6" | **Draw the saves three across on a tablet**, like the Scores, beside five across | The PC critique's finding 6. Drawn, not chosen: see below. |

Also taken into the drawing from the PC critique: a kindred's name does not break across lines where the tile can hold it; a captionless tile's empty room stays accepted; the level is 3 in the drawings and in the built pictures alike.

**This changes one proposal below.** The designer's pick left a counted bonus with no trace on the tile (finding 5 of the first critique); "5(b)" gives it one, in words. S1 to S8 otherwise stand as written.

## The drawing of 2026-11-24 (in part replaced on 2026-11-25)

| Frame | What |
|---|---|
| 42-15 | The tiles on a phone, beside the tiles as built |
| 42-16 | The tiles on a tablet in landscape, five across beside three across |
| 42-17 | Messy data on the tiles: two on one save, counted and at times on one save, a long condition, three counted, a long kindred name, the shared bonus under the heading; phone and the tablet both ways |
| 42-18 | Low rolls succeed; a number stopped at the lowest face |
| 42-19 | A save's sheet (S3 rows, the save's own line, the modifier row with its number) and the ⓘ's pop-up for the general rule |
| 42-20 | Messy data on the sheet |
| 42-21 | Tablet landscape, light: the built screen beside the final A five across and three across (the second and third are the built screen edited in a browser, not built) |

Findings 31 to 41 on the page are the designer's critique of these frames, by hand; the PC session's real `impeccable critique` follows.

## ⚑ 9 (answered 2026-11-25: five across)

| # | Question | Measured on the built screen at 1024 by 768 | The designer's lean |
|---|---|---|---|
| 9 | On a tablet, the saves **five across** (as built) or **three across** (like the Scores)? | Five: 80 px tiles, each caption two lines, one row of 113 px. Three: 138 px tiles, each caption one line, two rows, 192 px; and 142 px against 67 for a character with no save bonus. | Three across, weakly: words on an 80 px tile are A's weak point. The cost in height is real (findings 35, 36). |

For the plan, not for Francis unless he wants it: on the built screen the ⓘ pushes the Saves roll line onto its own row at 1024 px (finding 31, about 25 px).

---

*What follows is the file as it stood before he answered: the question, the options and the designer's pick. Kept as the record.* The drawings: `docs/design/mockups/december/42-save-bonuses-in-the-number.html` (frames 42-1 to 42-8, light and dark, with a critique of eighteen numbered findings; option D, added later the same day, is frames 42-9 to 42-14 with findings 19 to 30, by hand, a real `impeccable critique` by the PC session to follow).

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

## ⚑ For Francis (one at a time): answered 2026-11-24, see the top of this file

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

## When he approves the drawing (done 2026-11-25; the line below was split into nine)

Docs to update: `docs/09-decisions-log.md` (one line, below), `CLAUDE.md` (hard rule 7: the named exception, in the same commit as 06), `docs/07-content-packs.md` (Races and Classes: `saveBonus`, `saveBonusByCon`; `saveModifiers`; the low-natural flag, as pending), `docs/06-screens-and-design.md` (the Save tile and its sheet in the Components inventory; the tokens table: `--text-12`, `--text-save-line`; the type rule's exception), `docs/05-features.md` (the sheet's saves; the save's own line from `saveCategories[].notes`; where the general rule lives); mark the superseded parts in the three older ruling files; a plan in `docs/plans/`.

The `09` line, not yet written into `09` (its date is the day he approves the drawing): `<date> — [sheet] A save bonus that always holds is counted in the save's number and says nothing on the tile; its source is on the save's sheet. One that holds at times is a line under the figure with the number to roll then ("11 vs venom"), set at 12 px as a named exception to hard rule 7, for that line only; a number stops at the die's lowest face, or one short of it only where the pack flags as data that a low natural fails; a save's sheet opens with the save's own line from the pack and shows its working rows, a save modifier is never printed without its number, the rows that hold at times stand under "Only at times" with "→" figures, and the general rule moves behind an ⓘ at the end of the Saves roll line; on a tablet the saves stay five across — "this is a bad ruling", "If we're adding it to the number we don't need with bog folk", "make an exception and drop to 12 px" and "This should be passed by the pack, not the app" (Francis), on a player's report that his kindred's bonus did not change his saves — design/rulings/dec-save-bonus-in-number-2026-11-24.md`

(The line as drafted on 2026-11-24 named the source under the figure, "with Bog folk", and left five or three across open; both were ruled otherwise on 2026-11-25.)
