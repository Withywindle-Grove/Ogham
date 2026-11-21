# Plan: M5c slice 2 — the Magic tab and its lists

Written by the design agent, 2026-11-09 (night). **Its mockup, `design/mockups/magic/04-magic-tab.html`, was approved on 2026-11-10 with mm-1 and mm-2 (`design/rulings/m5c-magic-mockups-2026-11-10.md`). The plan is still a draft: nothing is built before the M5b gate passes and Francis says go.** It makes no rulings. Overview: `docs/plans/magic-in-play.md` ("A new slice, the Magic tab", and slice 2). Comes after slice 1 (`plans/m5c-1-magic-state.md`).

## What it delivers

A character with any magic gets a **Magic** tab (mp-20): what is ready, by level, one line per spell; each other kind of magic as its own list in the pack's words; the rules one tap from every name. The Player screen loses its Spells section. Casting itself (the tap's effects) is slice 3: here **Cast** marks the spell and toasts with Undo, nothing more.

## Rests on

| Read | For |
|---|---|
| Mockup `design/mockups/magic/04-magic-tab.html` (and its picture) | the screens, once approved |
| 05 Spells: the Magic tab; Rules one tap away | what the tab holds |
| `design/rulings/m5c-magic-in-play-2026-11-05.md` mp-15, mp-19 … mp-21 | Use only with uses or something tracked; the shrine's spell; the fourth tab; the sheet beside the play column |
| `design/rulings/m5b-sheet-review-2026-11-04.md` sr-4 | the sheet's Magic section, a tab per kind |
| 06 Components (Tab bar; the row patterns of the players' standard, 2026-11-07) | build from listed parts; name any variant there |

## Build order

1. **The tab.** Shown only for a character with any magic. On a tablet it joins the rail; on a phone it joins the bar (see ⚑ 1). The GM sees the same tab when looking at a player's character.
2. **Ready spells.** By level, the level line "Level 1, 2 a day" (never a count left). **One row per spell (mm-1):** name, worked-out duration and range, a note; **Cast** as the row's button. A spell prepared more than once carries a dot for each casting, hollowed as they are cast (a screen reader hears "1 of 2 left"), and keeps Cast while a dot is left; a spell prepared once has no dots. When no casting remains the spell is crossed out, says "Cast" in words with when, and sits last in its level.
3. **The rules sheet.** A tap anywhere on the row but its button opens the spell: what it does, the duration and range worked out for this caster, the reversed form where the list has one, the source line. The same component as the breakdown and item sheets.
4. **Prepare** as the first row (it opens a screen; slice 4 builds the screen, until then the row opens today's Prepare).
5. **The other kinds of magic** as lists under the pack's own words, read-only in this slice: a row with a chevron opens its rule. Uses, pips and **Use** are slice 6.
6. **States.** Nothing ready (words, and where to go); a spell given outside the slots under its source; Cast when something stops the caster explains why and never disables.
7. **The Player screen** drops its Spells section; powers with uses that aren't magic stay in its Traits list (mp-20).
8. **The sheet beside the play column** has no Prepared tab in its Magic section; opened on its own, it has (mp-21).
9. **Gallery and layout scenes** for the tab at 375 px and on a tablet, both themes; the components inventory's Code column.

## Tests (each purpose as a plain sentence first)

- A character with no magic has no Magic tab; one with a single glamour has it.
- The level line says how many a day and never how many are left.
- A spell prepared twice shows as one row with two dots; the first cast hollows one and keeps Cast; the second crosses the spell out.
- A spell prepared once shows no dots.
- A cast spell moves to the foot of its level and says "Cast" in words.
- Tapping a spell's name opens its rules with the duration worked out for this caster's level.
- The Player screen of a caster shows no Spells section.
- Beside the play column the sheet's Magic section has no Prepared tab; opened alone it has.
- At 375 px with five tabs nothing scrolls sideways and every tab is at least 44 px.
- A 79-character spell name wraps and keeps its button whole.

## ⚑ for Francis (collected, not decided)

1. ~~Five tabs on a phone~~ **Ruled A, 2026-11-10 (mm-2): five tabs; five is the limit.** Was: mp-20 called Magic "a fourth tab"; two days later the phone's bar gained Log as its fourth. **A (proposed, drawn):** five tabs for a caster, the same bar as everyone's with Magic added. **B:** four tabs, Magic in Log's place, the log from the top row's ⋯. The mockup shows both.
2. ~~The tab's symbol~~ **Approved 2026-11-10 (mm-2).** Drawn as a crescent moon with a spark (the star is Pin's, the flame is Scene's).
3. **First pictures.** This slice draws a new screen; under the picture rule being written now (the Collaborator's pull request) its first pictures merge first only because this mockup describes them, so the mockup needed your approval before the build. **Given 2026-11-10.**

## Estimate

3–5 builder turns for the tab, 5–7 for the lists (the overview's figures). The Builder confirms it in hours when the slice is claimed.

## Departures

(The builder keeps this current in the same pull request.)
