---
status: pending
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, rows C4, C7, C8 and C9; mockup page M2)
absorbed-into: 06 (Player tab pop-ups, a new row; the Sheet; the Breakdown sheet; the Load bar; Entry, book format); docs/09-decisions-log.md (2026-11-19); **pending: 07** (rule text set out like the book gains a trait's `note`: 07 is read by the app's code, so its paragraph goes with the reader's pull request, plan row C9a, as pf-18's did); `docs/plans/test-feedback-2026-11-19.md` (sections C and D). What these pop-ups look like is not in 06: page M2 draws it, and nothing here is built before he approves that page
supersedes: nothing as a file. Inside it: tfb-1 replaces the plain look of the figure's pop-up approved on 2026-11-14 (frames P7 and P7b of december/14; sv-2, sv-2a and sv-2b still say what the pop-up holds); tfb-2 adds an exception to mc-43a (`dec-mockup-rulings-2026-11-12.md`) and to cs-27 (`dec-creation-sweep-2026-11-12.md`); tfb-3 replaces "the number in bold under the head" of the Breakdown sheet (06) for a figure that is not a roll; tfb-4 replaces the load bar's levels opening in place (06, Load bar); tfb-5 widens pf-18 (`dec-rule-text-blocks-2026-11-13.md`) to a trait's text
---

# The test feedback of 19 November, sitting 2: the book format and the figures (ruled 2026-11-19)

The second of seven sittings on Francis's notes from the live Player tab (`docs/intents/test-feedback-2026-11-19.md`; the questions are in `docs/design/notes/test-feedback-2026-11-19-sittings.md`, his answers word for word in `docs/design/notes/test-feedback-2026-11-19-answers.md`). The driver put the five questions to him one at a time. His words are in quotes; anything else is the designer's reading and says so.

**Nothing here is built yet.** Page M2 draws these pop-ups; he approves the page first (mockups first, 2026-11-12).

## The rulings

| Id | Ruling | His words | It replaces |
|---|---|---|---|
| tfb-1 | **Every pop-up reachable from the Player tab is in the book's format.** An entry from the book stays as it is. A figure explained, and the Abilities and Traits lists, take the book format. A pop-up you act in (Hit points, Portrait, the Quiver, an item, a status, Notes, a blocked action) takes the book's red heading and keeps its own buttons, with no "Got it" | "Review everything on player tab to ensure pop ups are book format" (item 17); to the two sketches: "Option 2, all three"; to question 2.1: "Confirm" | The plain look of a figure's pop-up (frames P7, P7b, approved 2026-11-14). The figure's pop-up is one part, so it changes on the full sheet's page too (said with the question) |
| tfb-2 | **A pop-up you only read ends with "Got it", at the right,** as an entry from the book does today | "A" (2.2) | mc-43a ("a sheet or pop-up with an X has no Close button") and cs-27 ("an X or buttons, never both") gain one exception: the Player tab's reading pop-ups |
| tfb-3 | **A figure's pop-up does not repeat its figure in bold under the title, for every figure that is not a roll:** Level, Experience bonus, a movement speed. The pop-up starts with its sentence ("Level 2 Warden."). Saves, scores, armour class and attack keep their figure beside the title, as approved | "Level 2 is duplicative." (item 11); "Get rid of the first 0% in bold. it's presented in text just below, and also on the table below." (item 21); "A" (2.3) | 06, Breakdown sheet: "elsewhere the number … in bold under the head" |
| tfb-4 | **A tap on the burden opens its levels in a pop-up, not in place, everywhere the load bar shows:** the Player tab, the Pack, the full sheet | "The expanded rules should be a pop up sheet like the saves/abilities/etc." (item 16); "A" (2.4) | 06, Load bar: the levels opening in place under the bar |
| tfb-5 | **The packs write a trait's text in blocks, as place rules already are, and the app sets each block on its own line.** A trait not yet rewritten shows as today | "Hospitality should be on it's own line, as an example." (item 20); "A" (2.5) | pf-18's list of texts that take the shape, which gains a trait's text |

## tfb-1, pop-up by pop-up

The question named seven pop-ups you act in. The Player tab opens more (the notes' table, item 17). Sorted here by his rule: do you only read it, or do you act in it? **The sorting of the ones he did not name is the designer's reading**, for him to see on page M2.

| Band | Pop-ups | Heading | Foot |
|---|---|---|---|
| 1. An entry from the book | A language, one ability or trait, the class, the kindred, alignment, a patron, a Details value's entry | The book's, as today | As today |
| 2. A figure explained, and the two lists | Each score, save and skill; armour class; Attack; Level; a movement speed; Experience bonus; the burden's levels (tfb-4); the Abilities list; the Traits list. Reading: Weapon skills | The book's | "Got it" at the right (tfb-2) |
| 3. A pop-up you act in | Named by him: Hit points, Portrait, the Quiver, an item, a status, Notes, a blocked action. Reading: Max hit points, setting the armour class, a trait with uses, Keep lit, the weapon's pop-up (sitting 3) | The book's red heading | Its own buttons, no "Got it" |

## tfb-4 against the Pack tab's approved frames

Checked on 2026-11-19, as he was told it had not been: `pack/08-the-pack-tab-whole.html` (PK1 to PK13, on the branch `design-december-mockups`) and its shared `pk.js`, and the older `pack/01` and `pack/05`.

- **No conflict found.** No Pack frame draws the levels open, in place or anywhere. The frames draw the load as its state in words, the bar and the figures. PK1's caption calls it "the load as built".
- So tfb-4 changes how the built bar opens, and no approved Pack picture is redrawn.

## Not settled

1. ⚑ **Two more places show the load bar, and the question named three.** The GM's character overview (itself a pop-up, so this would be a pop-up opened from a pop-up) and creation's Gear step. His "everywhere the load bar shows" reads as covering both; the designer's list in the question did not name them. One question: "The burden's levels as a pop-up in the character overview and in creation's Gear step too, or do those two keep opening in place?"
2. ⚑ **Does "Got it" count as the screen's one accent button, or is it a plain button?** The entry in creation draws "Pick" as its button; nothing says which a lone "Got it" is. Drawn on M2 for him to pick.
3. ⚑ **A trait's own entry still says "When: from level N"** (sitting 1's ⚑ 2, still open): asked with page M2, which draws the entry.

## For the builder and the Pack Creator

- tfb-3: "every figure that is not a roll" also takes in a field's figure and the title, which the full sheet opens through the same part. The designer's reading; it shows on M2.
- tfb-4: the pop-up holds what opens in place today: the levels with their limits and effects, what raises the limit, the source line. The GM's "Switch on / Switch off" for treasure stays on the bar. Three kinds of load to draw: coin levels, slots, and armour's movement table.
- tfb-5, **07's paragraph, to go in with the reader (row C9a)**, under "Rule text set out like the book (pf-18)": *A trait's text takes the shape too (tfb-5, 2026-11-19): a class's or a kindred's `abilities[].note`. A trait written as a plain string always reads as today.* It is not in 07 yet on purpose: 07 is what a converter is given, and a pack that wrote a trait in blocks today would print the object.
- tfb-5: a trait's text is `abilities[].note` on a class or a kindred (07). The app's reader for blocks exists for place rules (`src/modules/library/ruleText.ts`, `src/ui/RuleText.tsx`); a trait's entry does not use it yet. **The reader reaches traits before any pack writes a trait in blocks**, or today's app would print the object. The pack work is the Pack Creator's (plan row E5).
- The red heading over the accent "Set" on Hit points was shown to him in a sketch and accepted there. Its contrast was not measured. M2 measures it in both modes.

## Honest notes

- **Not drawn yet:** dark, a phone, long names, and every band 3 pop-up but Hit points and the Quiver. His "Option 2, all three" came from two sketches, light, on a tablet held sideways.
- **Cost:** the largest build of this feedback. One part (the figure's pop-up) serves the Player tab and the full sheet's page, so both change at once.
- **tfb-5 costs pack work on both rules packs** before it shows. Until then every trait reads as today.
- **Not checked:** the private packs (how many traits carry a sub-heading inside their text: row E5).

Docs to update: 06 (a new row, Player tab pop-ups; the Sheet's mc-43a line; the Breakdown sheet; the Load bar; Entry, book format); 09; the plan's sections C and D. Done in the same pull request as this file. Owed, not here: 07 (pf-18's list of texts, with row C9a's pull request; the words are above); the gate lines of `docs/testing.md` that describe these pop-ups, with the build.

09 lines:
- 2026-11-19 — [ui] Every pop-up reachable from the Player tab takes the book's format: an entry as it is, a figure explained and the Abilities and Traits lists in the book format, a pop-up you act in under the book's red heading with its own buttons (tfb-1); one you only read ends with "Got it" at the right, an exception to mc-43a and cs-27 (tfb-2). It replaces the plain figure pop-up of 2026-11-14 (P7, P7b). Page M2 draws it before anything is built — Francis: "Option 2, all three"; "Confirm"; "A"
- 2026-11-19 — [sheet] A figure's pop-up does not repeat its figure in bold when the figure is not a roll (Level, Experience bonus, a movement speed); saves, scores, armour class and attack keep theirs beside the title (tfb-3). A tap on the burden opens its levels in a pop-up, not in place, on the Player tab, the Pack and the full sheet (tfb-4; no approved Pack frame draws the levels open) — Francis: "A" to each
- 2026-11-19 — [packs] A trait's text is written in pf-18's blocks by the packs and set out block by block by the app; a trait not yet rewritten shows as today (tfb-5, widening pf-18) — Francis: "A"; the breaks are the book's own, never guessed
