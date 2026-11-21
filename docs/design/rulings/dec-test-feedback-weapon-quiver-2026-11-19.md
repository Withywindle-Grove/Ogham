---
status: absorbed
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, rows C2, C3 and C16; mockup page M2)
absorbed-into: 05 (At hand: what a name and Attack open; the pin star; the Quiver); 06 (At hand pop-up, a new row; Pack groups; the Item sheet; the Pin star); docs/09-decisions-log.md (2026-11-19); `docs/plans/test-feedback-2026-11-19.md` (sections C and D). What the pop-up looks like is not in 06: page M2 draws it, and nothing here is built before he approves that page
supersedes: nothing as a file. Inside it: tfh-1 and tfh-3 replace, on the Player tab only, "Its name opens the item's sheet" with its rows of details (06, Item sheet; `players/01`, 2026-11-07); tfh-2 changes what Attack opens (ah-1, `m5b-at-hand-actions-2026-11-08.md`; the Attack sheet's content, as-1 to as-3, stands); tfh-4 replaces, for a weapon in hand, "an item that shows At hand by itself keeps Hide from At hand instead" of the star (06, Item sheet; frame P1's note "In hand has no star: the star means pinned"); tfh-6 replaces the Quiver's list of every kind the weapon fires (`docs/testing/m5b-at-hand.md`) and the two lines of `players/06` (a page marked "proposed")
---

# The test feedback of 19 November, sitting 3: the weapon's pop-up and the Quiver (ruled 2026-11-19)

The third of seven sittings (`docs/intents/test-feedback-2026-11-19.md`, items 6, 7 and 8; the questions in `docs/design/notes/test-feedback-2026-11-19-sittings.md`; his answers in `docs/design/notes/test-feedback-2026-11-19-answers.md`). His words are in quotes; anything else is the designer's reading and says so.

**Nothing here is built yet.** Page M2 draws the pop-up; he approves the page first.

## The rulings

| Id | Ruling | His words | It replaces |
|---|---|---|---|
| tfh-1 | **On the Player tab a weapon's name opens one short pop-up:** the two roll boxes and its qualities ("Qualities: Blunt, Melee"), then Give to…, Put in…, Hide from At hand and Drop, drawn as the Pack tab's newer pop-up (frame PK8). No slot, hands, value or weight | "we agreed on the player tab not to show the pack details. Here I care about modifiers, and associated abilities and tags that matter i use such as blunt and melee." (item 6); "Yes, B plus Attack"; "Confirm" (3.1) | On this tab, the item's sheet with its rows of details |
| tfh-2 | **The weapon's name and its Attack button open the same pop-up.** For now: Attack is repurposed when fights are built | "A" (3.2); then: "Eventually we'll repurpose attack for actual attacks when we do combat encounters but for now keep as I just ruled" | What Attack opens (ah-1): the Attack view alone |
| tfh-3 | **The other things At hand (a wand, a lantern, a pinned thing) open the same short shape:** what it does now (its uses, its light left), then the quick buttons. No pack facts | "A" (3.3) | On this tab, the item's sheet with its rows of details |
| tfh-4 | **The pin star always shows on a weapon in hand,** in its one place beside the ✕, filled when pinned. Pinned while in hand means it stays At hand when put away | "w here is the pin star" (item 7); "A" (3.4) | No star while in hand, with "Hide from At hand" standing in |
| tfh-5 | **This pop-up is built now, for the Player tab, once M2 is approved.** It does not wait for the Pack tab's second sitting | "A" (3.5) | Nothing ruled: the order of building. Row K4 of `dec-6-the-whole-pack-tab.md` keeps the Pack tab's own pop-up |
| tfh-6 | **The Quiver lists only the kinds the character carries.** The lines "What the <weapon> fires. Each shot uses one." and "Out of a kind: it leaves the quiver and the pack." are gone. With none carried, one line says so | "only what is in pack should appear here. "what the longbow fires and Out of a kind" messages can be removed." (item 8); "Confirm" (3.6) | The list of every kind the weapon can fire, carried or not, built that way on purpose |

## His note of the evening (item 30), kept with this sitting

His words: "grip "melee" still shows thrown values. thrown grip shows correct values." (item 30 of the notes; kept too in `docs/design/notes/sitting-2026-11-19-evening.md`, "Notes he gave unasked").

What he saw: a weapon in hand held with the grip "Melee" listed four roll lines, two of them "as a missile". Today a roll line is made for each kind the weapon has, and nothing reads the chosen grip (`src/modules/characters/play.ts`; md-1 rules the grip's button and its line, not the rolls).

His words name the fault and not the rule, so it is ⚑ 1 below and row C16 of the plan. Nothing is ruled.

## Not settled

1. ⚑ **A grip shows only its own roll lines** (item 30). Proposed from his words: *With a grip chosen, the weapon shows that grip's roll lines alone, in the weapon in hand's block and in its pop-up. A weapon that is both melee and missile and has no grip keeps a line for each, as today.* Confirm? Beside it and not ruled here: his item 31 ("need the first option to be selected by default for grip."), which the notes keep as "check, then fix or change" (was the first grip unmarked, or was it these lines?).
2. ⚑ **What of the Attack view stays in the pop-up?** The question said "the two roll boxes and its qualities". The Attack view as built also has the rows under each roll (each part with its figure), the range, a magic weapon's notes, what the attack inflicts, and "Fire one". His item 7 called the Attack view "the desired screen", so **the designer reads all of it as staying** and M2 draws it so. His to change on the page.
3. ⚑ **Does the star always show on the other things too** (a lit lantern, a wand worn)? 3.4 asked about a weapon; 3.3 gives the others "the same short shape". Drawn on M2 both ways.
4. ⚑ **Does a thing's own description show** (a draught's text, a wand's)? "No pack facts" takes out slot, value and weight. The book's words on what it does are not a pack fact in that sense, and were not named. Drawn on M2 for him to pick.

## For the builder

- tfh-1 and tfh-4 together: a weapon in hand carries the star **and** "Hide from At hand". The star keeps it At hand after it is put away; "Hide from At hand" takes an unpinned one off the list. M2 draws both on one pop-up.
- tfh-4 is about the star in the pop-up's head. The small filled star on a row still means pinned (09, 2026-11-08): an unpinned weapon in hand has none on its row.
- tfh-6: "the Quiver" is read as every mode that draws from a stack (Quiver, Pouch). Grip and Stance list no stack and do not change. The words of the empty line are drawn on M2.
- tfh-6 does not explain why his own arrows did not show: that is the pack check E2.
- tfh-5's cost, told to him with the question: for some weeks an item's pop-up looks one way on the Player tab and another on the Pack tab.

## Honest notes

- **Frame PK8 draws no weapon** and is not drawn for the Player tab. tfh-1 is his direction in words from a review of two pictures; M2 is the first drawing of it.
- **Not found:** the id of the ruling that hid the star in hand. The sittings file dates it 2026-11-08; what is in force is 06's Item sheet line and frame P1's note, both named in the header.
- **Not checked:** the private packs, and his pictures.

Docs to update: 05 (At hand); 06 (At hand pop-up, a new row; Pack groups; the Item sheet; the Pin star); 09; the plan's sections C and D. Done in the same pull request as this file. Not touched here: 06's Weapon in hand row (another open pull request changes that line; its text does not say what the name opens).

09 lines:
- 2026-11-19 — [items] On the Player tab a weapon's name and its Attack button open one short pop-up: the two roll boxes and its qualities, then Give to…, Put in…, Hide from At hand and Drop, as frame PK8 draws a thing's pop-up, with no slot, hands, value or weight (tfh-1, tfh-2, changing what ah-1's Attack opens); the other things At hand open the same short shape (tfh-3). Built for the Player tab once page M2 is approved, ahead of the Pack tab's own (tfh-5) — Francis: "Yes, B plus Attack"; "Eventually we'll repurpose attack for actual attacks when we do combat encounters but for now keep as I just ruled"
- 2026-11-19 — [items] The pin star always shows on a weapon in hand, beside the ✕, filled when pinned; pinned while in hand, it stays At hand when put away (tfh-4, replacing "no star in hand"). The Quiver lists only the kinds carried, its two lines of explanation gone, one line when none is carried (tfh-6, replacing the list of every kind the weapon fires) — Francis: "A"; "only what is in pack should appear here."
