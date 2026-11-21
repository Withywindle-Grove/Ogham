---
status: absorbed
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, rows B1 to B6 and A3)
absorbed-into: 05 (the Attack sheet), 06 (Words and voice, rule 16; the Roll card; the blocked-action Sheet; the List row's Sheet row; the Breakdown sheet; Pack groups; Weapon in hand), docs/testing.md (the request button's gate line), docs/09-decisions-log.md (2026-11-19), docs/10-open-questions.md (one new ⚑), `docs/plans/test-feedback-2026-11-19.md` (section B)
supersedes: nothing as a file. Inside it: tfw-3 supersedes the last clause of ah-1 (`m5b-at-hand-actions-2026-11-08.md`); tfw-5 replaces sr-3's words "from level 3" in the lists (`m5b-sheet-review-2026-11-04.md`); tfw-2 ends the Roll card's note on who reads a roll made against a target (as-1's card, 2026-11-10); tfw-7 changes frame P1's small "missile" (ps-9, `dec-player-screen-2026-11-14.md`)
---

# The test feedback of 19 November, sitting 1: words (ruled 2026-11-19)

The first of seven sittings on Francis's notes from the live Player tab (`docs/intents/test-feedback-2026-11-19.md`; the questions are in `docs/design/notes/test-feedback-2026-11-19-sittings.md`). The driver put the seven questions to him one at a time in chat and kept his answers word for word. His words are in quotes. The designer checked where each line shows, in the code on `origin/main`, before writing this.

Words only: no screen is redrawn and no data changes. The code follows in rows B1 to B6 of the plan.

## The rulings

| Id | Ruling | His words |
|---|---|---|
| tfw-1 | **The Armour class pop-up ends with how the figure is worked out.** The line "Your GM checks it at the table." is gone, for a worked figure and for one typed on the sheet. On the full sheet and the Player tab. The same line at character creation is not settled (⚑ 1) | "Confirm" (question 1.1) |
| tfw-2 | **A note says a rule, not how the table runs.** Outside character creation, no line reminds the player what the GM gives, checks, reads or decides. In character creation such lines stay: there the app teaches more. It is rule 16 of the words and voice guide. Line by line below | "notes should be more about rules than about table dynamics" (item 4); to question 1.2: "keep them for character creation where i want more explicit tutorials, drop them elsewhere" |
| tfw-3 | **The Attack view ends with its rows.** The line "Rolling the attack here comes with the fight rules, later." is gone | "confirm" (1.3) |
| tfw-4 | **When a class can't use a thing, the pop-up says the rule once.** Its title is the rule itself ("Warden can't use Shortbow"). There is no "Can't wield" or "Can't use" title and no second line, unless the pack's rule carries a note of its own, which then sits under the title. The same for a weapon, armour and a shield | "confirm" (1.4) |
| tfw-5 | **In the Abilities and Traits lists an ability gained later reads "at level 3".** Creation's chips ("lv 3") are not touched | "confirm" (1.5) |
| tfw-6 | **The Attack pop-up does not list the class's figure twice.** The row "Written on the sheet" is not shown when its number is the class's own figure. When a figure typed by hand differs, its row reads "Set by hand" | "confirm" (1.6) |
| tfw-7 | **The Attack box's small line keeps the pack's words, each with a capital: "Melee +2, Missile +1".** Not "Ranged". The full sheet's page reads the same line, so it changes there too | "keep pack's words. "Missile" capitalized" (1.7) |

## tfw-2, line by line

His words decide each of the six lines put to him by where it shows. Where each shows was read in the code.

| # | The line | Where it shows today | Ruled |
|---|---|---|---|
| 1 | "Your GM sets the most hit points." | Nowhere: its function (`explainHp`, `src/modules/characters/explain.ts`) is called by no screen, only by its test | **Goes.** Not character creation |
| 2 | "Enter the hit points your GM gives you." | Character creation only: the hit points prompt of a class with no hit dice (`hpPromptLine`, `src/app/Characters.tsx:600`) | **Stays** |
| 3 | "…Your GM decides what it means at your table." | Character creation only: alignment's ⓘ, and only when the pack gives no note of its own (`alignmentAbout`, `Characters.tsx:680`) | **Stays** |
| 4 | "…Ask your GM how yours works." | Character creation only: literacy's ⓘ, and only when the pack gives no note (`literacyAbout`, `Characters.tsx:681`) | **Stays** |
| 5 | "The GM reads the hit from the roll and the foe's armour." | The Attack view, an item's pop-up and the weapon in hand's block, in a setting with a target number (`READ_BY_TARGET`, `src/modules/characters/play.ts:384`). Never in creation | **Goes** |
| 6 | "The GM rolls for this in secret and tells you what comes of it. The cost applies if the GM says yes." | A secret activity's sheet on the players' Scene (`src/app/ActivityButtons.tsx:280`). Never in creation | **Goes**, both sentences, as put to him |

Lines 3 and 4 do not show on the sheet at all, so nothing of them is dropped.

## Not settled

1. ⚑ **The Armour class line at character creation.** The same line, "Your GM checks it at the table.", also ends the Armour class pop-up in creation's Derived fields (`creationAcLines`, `src/app/fromSetting.ts:317`; the gate line `docs/testing.md:615`). tfw-1 takes the line out of "the Armour class pop-up"; tfw-2 keeps lines of this kind in creation. His two answers pull apart here, and question 1.1 did not say the pop-up also shows in creation. **Until he rules, creation keeps the line** and the gate line is not changed. One question: "In character creation, does the Armour class pop-up keep "Your GM checks it at the table.", as your creation rule says, or lose it too?"
2. ⚑ **A trait's own entry still says "When: from level N"** (06, Trait chips), and a chip is read aloud as "…, from level 3". tfw-5 names the lists only. Asked with page M2, which draws the entry; not changed here.

## For the builder

- tfw-1: `acLines` is shared with creation (`creationAcLines`). Take the line out of the sheet's pop-up and keep it in creation, where ⚑ 1 will settle it.
- tfw-2, line 5: the weapon block decides whether to print "to hit" by whether the note is there (`src/app/WeaponInHand.tsx:29`). With the note gone it must still print no "to hit" beside a target number (as-1: never roll-high-and-add).
- tfw-2, line 1: the function is unused. Removing the line is enough; removing the function is the builder's technical call, said in the pull request.
- tfw-4: a blocked wear or wield can carry more than one reason. Not ruled: the first is the title, and any other sits under it as a line. The builder says so in the pull request if it meets one.
- tfw-7: the capital is on the kind's word wherever this line shows. The weapon's own roll lines ("to hit, as a missile") are not this line and do not change.

## Honest notes

- **My question 1.1 was incomplete.** It named the gate line `docs/testing.md:615` as losing the words and did not say that line is creation's. That is why ⚑ 1 is open.
- **My recommendation on 1.2 was not taken.** I had kept the four lines that say what happens next. He ruled by place instead. After tfw-2 the secret activity's sheet shows its cost and "Ask the GM" with no line on when the cost is paid, and in a setting with a target number the Attack view shows the roll with no line on who reads it.
- **Not checked:** the private packs (whether either gives alignment or literacy notes, which would mean lines 3 and 4 never show), and his pictures.
- Other lines of this kind found later follow rule 16; the app sweep looks for them.

Docs to update: 05 (the Attack sheet: no note on who reads the hit); 06 (Words and voice, rule 16; the Roll card; the blocked-action Sheet; the Sheet row; the Breakdown sheet; Pack groups' Attack sheet; Weapon in hand); docs/testing.md (the request button's gate line; line 615 waits on ⚑ 1); 09; 10 (⚑ 1); the plan's section B. Done in the same pull request as this file.

09 lines:
- 2026-11-19 — [words] A note says a rule, not how the table runs: outside character creation no line reminds the player what the GM gives, checks, reads or decides; character creation keeps such lines (voice rule 16, tfw-2) — Francis, from the live Player tab: "keep them for character creation where i want more explicit tutorials, drop them elsewhere"
- 2026-11-19 — [words] The Armour class pop-up drops "Your GM checks it at the table." on the sheet and the Player tab (tfw-1; creation's copy is ⚑); the Attack view drops its line about the fight rules (tfw-3, superseding ah-1's last clause); a class that can't use a thing: the pop-up's title is the rule, once (tfw-4) — Francis: "confirm" to each
- 2026-11-19 — [sheet] A later ability reads "at level 3" in the Abilities and Traits lists (tfw-5, replacing sr-3's "from level 3"); the Attack pop-up shows no "Written on the sheet" row for the class's own figure, and "Set by hand" for one that differs (tfw-6); the Attack box's small line reads "Melee +2, Missile +1" (tfw-7, changing frame P1's small "missile") — Francis: "confirm"; "keep pack's words. "Missile" capitalized"
