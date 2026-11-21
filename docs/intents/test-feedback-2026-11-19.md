# Test feedback, 19 November 2026: Francis's notes from the live app

Collected in chat on 19 November, in his words, then checked read-only against the plans, mockups and code. Nothing is fixed or decided here: the driver turns this list into rows and design sittings.

- **Screen:** all 28 items are on the Player tab (item 22 also touches "Your characters").
- **Real setting names** are replaced by the pack's neutral name in square brackets (hard rule 2); nothing else in his words is changed.
- **Pictures** (34) are not in the repo, because they show real book names. They are kept as `1.png` to `34.png` in the driver's shared notes folder, under `test-feedback-2026-11-19-pictures`.
- **The approved Player screen** is frames P1 and P2 of `docs/design/mockups/december/14-player-screen-for-the-player.html` (ruling ps-9, `docs/design/rulings/dec-player-screen-2026-11-14.md`). That page is on the branch `design-december-mockups` only; it was read at commit `4303bd32`. "P1" below means that frame.

## The tags

| Tag | Meaning | Items | Count |
|---|---|---|---|
| Bug | Built differently from its approved mockup or spec, or plainly broken | 1, 3, 5, 11, 15, 19 | 6 |
| Change | Built as approved; he wants it different (needs a design ruling) | 2, 6, 7, 8, 13, 14, 16, 17, 20, 21, 22, 24, 25, 26, 27, 28 | 16 |
| Wording | A fix to words only | 4, 9, 10, 23 | 4 |
| Question | He asked; answered below | 12, 18 | 2 |

Each item has one main tag, counted above. Several carry a second part (a bug inside a change, a question inside a bug); the item says so.

## For the driver

- **A mockup is asked for** (item 2): a larger portrait with a notices box beside it. It needs a designer sitting; this session did not draw it.
- **Two reviews were held with him on 19 November,** each ending in his direction in words, not an approved screen; both need a ruling and a designer's mockup:
  - the weapon's pop-up on the Player tab (items 6 and 7): "Yes, B plus Attack";
  - which pop-ups take the book format (item 17): "Option 2, all three", picked from two option sketches this session drew at his request (outside the repo).
- **An open ⚑ already in the plan** covers item 1: `docs/plans/dec-13-the-player-screen.md:139` and `:141` (a banner breaks the level tops). Nobody has ruled on it.
- **Pack questions** for the Pack Creator: item 8 (silver-tipped arrows are not a kind the longbow fires), item 11 (does level 2 start at 2,250?), item 15 (a second attack field in the sheet layout), item 20 (trait text has no line breaks), items 27 and 28 (how each pack states its skills, and the roll line for the [classic-advanced] pack).
- **Tests.** He asked whether a tester should run browser tests over the Player tab. The layout checks passed on this screen and missed these, so re-running them adds nothing; each fix below wants the test that would have caught it (the empty bar, the tops not level, buttons of two heights, a field shown twice).
- **Not checked:** the stored data of his character and the private pack. Where an answer leans on them, the item says so.

---

## 1. The light notice pushes the left column down

**Tag: bug** (the tops not level, and where the notice sits). Moving notices off the tab is a **change**.

**His words:** "the two columns (hit points and scores) do not line up - i assume because of the no-lite notification. This notification should either appear as a status circle, and therefore not push down the page, or it should go to the scene page. i'm open to other ideas, like a pop-up sheet. the goal is to use the player tab as a reference sheet so notifications are not the correct use of this tab. What other notifications are configured to appear on this page? I see "weather due" in the [fae-woodland] test campaign."

**Picture 1:** campaign "Dec Dry Run", a character's Player tab. A boxed notice "No light, Nothing to light in your pack" sits above the left column, so Hit points starts lower than Scores.

**Checked:**
- The notice is drawn above the head (`src/app/PlayerScreen.tsx:343`, `src/app/Darkness.tsx:86`). P1 draws no notice, and rules that "the first row of score boxes starts exactly level with the top edge of the hit points box" (ps-8, ls-1; plan `dec-13-the-player-screen.md:60`).
- The ruled place for prompts is between the head and hit points (`docs/design/notes/player-screen-ruled-so-far-2026-11-14.md:154`), not above the head.
- The builder flagged this as an open ⚑ (plan `:139`, `:141`).

**His question answered: every notice that can show on the Player tab today**

| Notice | Shows when | Where | Specified? |
|---|---|---|---|
| "No light" | The group is in darkness (any tab but Scene) | `PlayerScreen.tsx:343` | Yes (DG7, 06) |
| "Weather due: roll…" or "Weather: waiting for the GM to set the season" | Weather is due | `PlayerScreen.tsx:371-373`, `WeatherCard.tsx:342-348` | Yes (09, 06) |
| Retired banner | The campaign is retired | `PlayerScreen.tsx:340` | Retiring is (05); not for this screen |
| "Opening…" or "Couldn't open this character" with Try again | First load, or a failed read | `PlayerScreen.tsx:351-352` | Yes (C11) |
| "Setting rules as of…" | Offline, on the device's stored rules | `PlayerScreen.tsx:356` | Yes (06) |
| A change waiting for the GM, or a refusal | A sheet change was sent, or refused and not put away | `CharacterSheet.tsx:607-626` | Yes (06) |
| A line after an Edit is saved | Just after saving | `CharacterSheet.tsx:767` | Not found |
| "To finish" card | Creation steps left with "Decide later" | `CharacterSheet.tsx:772-774` | Yes (06) |
| The Light section's unlit, burnt-out or nothing-to-light state | No light is burning (above At hand) | `LightSection.tsx:408,416` | No frame draws it |
| Burn-out toast | A light burns out | `LightSection.tsx` | Yes |

Specified but not wired yet: a status ending and "Ready to level" (05). No rest, rations or turn notices on this tab.

## 2. The portrait is too small, its two buttons don't match, and an idea for a notices box

**Tag: change** (the portrait's size, the notices box). The two buttons are a **bug**.

**His words:** "related, the character profile image is too small ( a player requested it be larger), and the change/remove buttons are different sized/formatted. My thinking is we increase the size of the portrait, and which creates more of a gap between right and left column  - we fill that gap with a notifications box that when tapped pops up the notifications one at a time in a sheet. the box itself would have an icon that glows when you have notifications. mock it up when we finish processing feedback."

**Pictures 2, 3:** the Player tab with a small round portrait above Hit points; the "Portrait" pop-up with "Change portrait" in larger type than "Remove portrait".

**Checked:**
- The portrait is 64 px (`src/app/player/PlayerHead.tsx:68`, `Portrait.css:30-34`), as P1 draws it and ps-5 rules ("larger portrait, 64 px").
- "Change portrait" is the 48 px secondary button; "Remove portrait" is the small 44 px one (`Portrait.tsx:118`, `:122`). p2p-16 rules that buttons side by side share one height (`docs/06-screens-and-design.md:27`). No mockup draws this pop-up.

**His request:** a mockup of the larger portrait with the notices box, after processing.

## 3. The "Hit points" pop-up: buttons of two heights, empty space on the right, no temporary hit points

**Tag: bug** (the buttons, the alignment). Temporary hit points is a **question**, answered.

**His words:** "once again, buttons are differently sized. they should be same height, and the sheet itself should not have the whitespace to the right. I dont see an option to add temporary hp - what did we design for that?"

**Picture 4:** "CURRENT HP (MAX 12)", a number box, then "Set" (taller) beside "Cancel" (shorter), all at the left.

**Checked:**
- "Set" is 56 px, "Cancel" 44 px (`src/app/HpInPlace.tsx:216-238`, `buttons.css`); against p2p-16.
- The form uses its own class instead of the pop-up's standard foot, which sits at the right (ft-1, 06:583), and the box is capped at 10rem in a 440 px pop-up (`PlayerScreen.css:246-254`). No mockup draws this pop-up.

**His question answered:** temporary hit points are designed and not built. Ruled 2026-10-29 as "bonus HP" (G-23, `docs/11-modelling-gaps.md:34`; `docs/05-features.md:386`): a separate band on the hit points bar, damage takes it first, it ends on its timer or at 0. A quiet "Add bonus HP…" in the character's ⋯ comes in M6; spells and items granting it come in M7.

## 4. The "Armour class" pop-up: drop notes like "Your GM checks it at the table."

**Tag: wording.**

**His words:** "no need for notes like "your gm checks it at the table" - the goal here is to reduce screen noise. notes like that are obvious and unnessecary reminders. notes should be more about rules than about table dynamics"

**Picture 5:** the "Armour class" pop-up: the armour and its number, a kindred's +1 that does not apply now, and "Your GM checks it at the table."

**Checked:** the line is `src/modules/characters/play.ts:907` and `:911`. No ruling asks for it; it was carried over from older text. Two docs quote it and would change with it (`docs/plans/m5b-0c-creation-rebuild.md:136`, `docs/testing.md:615`). Lines of the same kind elsewhere, for the same sweep: `explain.ts:110`, `guidance.ts:22,49,60`, `play.ts:384`, `ActivityButtons.tsx:280`. His rule ("about rules, not table dynamics") is not in the words and voice guide yet.

## 5. The "Attack" pop-up and the Attack box

**Tag: bug** (the box's numbers). "Written on the sheet" is a **wording** fix and a **question**, answered.

**His words:** "Written on the sheet - is not helpful. is that referencing the Knight at level 2? If so then dont list it twice. if these are the modifiers, then on the page Attack box itself I'd expect. Attack +1 and below it Melee +2, Ranged +1"

**Picture 6:** the pop-up's rows: "Written on the sheet" 1, "Knight at level 2" +1, "Melee, STR +1" +2, "Missile, DEX +0" +1. Behind it the box reads "+1", "Melee +1, Missile +0".

**Checked:**
- The box's small line shows the scores' modifiers alone (`src/app/player/PlayerVitals.tsx:181`), while the pop-up's rows show totals (`src/modules/characters/sheetCombat.ts:136-140`). P1 draws totals, as he expects: "Attack +2 / Melee +2, missile +0".
- No ruling asks for a "Written on the sheet" row (`sheetCombat.ts:130`).

**His question answered:** yes, most likely the same number twice. "Written on the sheet" is the value saved in the character's own attack field; creation saves a copy of the class's figure there. Not checked against his character's stored data.

## 6. The weapon's pop-up (Mace): looks like an older design, shows pack details

**Tag: change.** The "Pinned from" row is a **bug**.

**His words:** "This looks like an older version of our design. check for the latest. we agreed on the player tab not to show the pack details. Here I care about modifiers, and associated abilities and tags that matter i use such as blunt and melee. find the agreed design and we'll review together."

**Picture 7:** the "Mace" pop-up: rows Slot, Hands, Value, Weapon, Category, "Pinned from", Weapon tags, Weight, a "From your setting:" line; then "Attack", "Give to…", "Put in…", "Hide from At hand", and a boxed "Drop".

**Checked (his request: find the agreed design):**
- No design exists for what a weapon opens on the Player tab. Page 14 draws no item pop-up, and no ruling was found that says "no pack details on the Player tab".
- What opens is the Pack tab's item pop-up (`src/app/ItemRow.tsx:291`, `ItemSheet.tsx:265`), approved 2026-11-07 (`players/01`; `docs/06-screens-and-design.md:727`, `:731`).
- A newer design of that pop-up is approved and not built: frame PK8 of `pack/08-the-pack-tab-whole.html` (ap-7, 2026-11-14), held as row K4 until after 5 December (`docs/plans/dec-6-the-whole-pack-tab.md:69`).
- "Pinned from" is a bookkeeping key that should never print (`src/modules/library/describe.ts:56` does not skip it).
- The long table is specified: 06's "Item sheet" row asks for "its details as kv rows" ("Slot", "hand"); the 7 November picture shows only one line of description.

**Reviewed with him, 19 November** (items 6 and 7 together). He was shown the 7 November pop-up (built) and frame PK8 (14 November, not built). Neither draws a weapon, and neither is drawn for the Player tab. Put to him: "on the Player tab, a weapon opens design B [PK8] with the Attack view's content in place of the facts (the two roll boxes and "Qualities: Blunt, Melee"), then Give to…, Put in…, Hide from At hand, Drop." **His answer: "Yes, B plus Attack".**

This is his direction in words, not an approved screen: it needs a ruling and a mockup before a builder (mockups first). Left open for that sitting: whether the pin star shows for a weapon in hand (hidden today by the 2026-11-08 ruling; he asked for "the pin star" in item 7), and whether PK8's hold until after 5 December still stands for this piece.

## 7. The weapon's pop-up, continued: keep only the Attack view, the quick pack buttons and the pin star

**Tag: change.** With a **question**, answered.

**His words:** "clicking the attack button shows the desired screen, so i think we'd only want these "quick pack" buttons plus the pin star. w here is the pin star"

**Pictures 8, 9:** the Attack view ("Roll 1d20 to hit" and "Roll 1d6 + 1 for damage" with their rows, "Qualities: Blunt, Melee"); the lower part of the item pop-up ("Give to…", "Put in…", "Hide from At hand", "Drop").

**His question answered:** the pin star sits at the top of an item's pop-up beside the ✕ (`src/ui/parts.tsx:429`; 06:733). It is hidden on purpose for anything in hand, which shows "Hide from At hand" instead (`ItemSheet.tsx:259-260`, `:487`; ruled 2026-11-08; P1: "In hand has no star: the star means pinned"). The Mace was in hand, so it had no star.

## 8. The "Quiver" pop-up: shows arrows he doesn't have, misses the ones he has

**Tag: change.** With a likely pack gap.

**His words:** "in my pack i have silver tipped arrows but they dont show up in quiver. meanwhile "arrows" and "magic arrows" do and none are in pack. only what is in pack should appear here. "what the longbow fires and Out of a kind" messages can be removed."

**Picture 10:** "What the Longbow fires. Each shot uses one.", then "Arrows" ("None in the pack, 1d6") and "Magic arrows" ("None in the pack…"), each with "Pick", then "Out of a kind: it leaves the quiver and the pack."

**Checked:**
- The list is every kind the weapon can fire, from the pack, carried or not (`src/app/AtHandSheets.tsx:135`, `src/modules/inventory/weaponModes.ts:253`); built and tested that way on purpose (`docs/testing/m5b-at-hand.md:10`). The mockup (`players/06-at-hand-actions.html:43-51`, marked "proposed") shows only carried stacks.
- A carried item counts as a kind only by its id, never by its name (`weaponModes.ts:148-157`). So the pack's longbow has no silver-tipped kind, or his arrows carry another id. Not checked in the pack.
- The two lines come from that mockup (`weaponModes.ts:221`, `AtHandSheets.tsx:139`).
- **Not explained:** his At hand row read "Quiver: 20 arrows" (picture 15) while this pop-up said none in the pack.

## 9. The Attack view: remove "Rolling the attack here comes with the fight rules, later."

**Tag: wording** (the line was ruled, so 06 changes with it).

**His words:** "Rolling the attack here comes with the fight rules, later. - remove that message."

**Picture 11:** the "Longsword" Attack view, with that small line last.

**Checked:** `src/app/AtHandSheets.tsx:15`, `:96`. The words are ruling ah-1's (`docs/design/rulings/m5b-at-hand-actions-2026-11-08.md:14`), drawn in `players/06` and `players/09`, listed at 06:726.

## 10. The "Can't wield" pop-up says it twice

**Tag: wording.**

**His words:** "This message "can't wield" is duplicative. It should simply say the rule. "knight can't sue longbow" in this case"

**Picture 12:** a pop-up titled "Can't wield the Longbow" whose only text is "Knight can't use Longbow."

**Checked:** the title is `src/app/ItemRow.tsx:257`, the line `src/modules/inventory/equipWarnings.ts:189`. It is the standard blocked-action pop-up, "the title and one line of why" (06:583); no ruling gives the words for this case.

## 11. The "Level" pop-up and the experience bar

**Tag: bug** (the bar). The pop-up's bold "2" is a **change** to the standard figure pop-up (see item 21).

**His words:** "Level 2 is duplicative. Start with Level 2 Knight. Bar is empty, but should show 2250 of 4500 experience and so be half full."

**Pictures 13, 14:** the "Level" pop-up (a bold "2", "Level 2 Knight.", "Level 3 at 4,500 XP.", "The highest level is 15."); the row "Knight, level 2", "2,250 of 4,500 experience" over an empty bar.

**Checked:**
- The bar measures progress within the level: (experience − this level's start) ÷ (next level's − this level's) (`src/modules/characters/advancement.ts:41-49`). A character exactly at level 2's start shows an empty bar. P1 draws "2,400 of 4,000" at 60 %, which is the total over the next level's figure, as he expects. Not checked in the pack that level 2 starts at 2,250.
- The bold "2" is the figure every figure pop-up shows under its title (`src/ui/BreakdownSheet.tsx:66`); "Level 2 Knight." is `explain.ts:292`.

## 12. "In hand" and "At hand"

**Tag: question**, answered.

**His words:** "what is the difference between in-hand and at hand?"

**Picture 15:** "Mace" and "Longsword" boxes labelled "In hand" with "Attack"; under a heading "AT HAND", a starred "Longbow" with "Quiver" and "Wield".

**Answered:** "In hand" is a state: the thing is held right now, ready to attack with (`src/modules/inventory/packView.ts:136-140`). "At hand" is the quick list: things worn or held that have uses, plus anything pinned with the star, within reach but not held, hence "Wield" (`docs/05-features.md:51`, `packView.ts:146-151`; order ruled ps-2; the separate weapon block is plan row C14). Built as approved.

## 13. "Details", collapsed, should show only its heading

**Tag: change.**

**His words:** "details when collapsed should show only "Details" not the head/face/fur"

**Picture 16:** the collapsed "Details" still lists three lines beside a down chevron.

**Checked:** three lines at rest is approved: P1 draws them, and plan row C4 says "At rest the first three" (`docs/plans/dec-13-the-player-screen.md:117`; `src/app/player/PlayerDetails.tsx:9`).

## 14. The experience row needs no chevron

**Tag: change.**

**His words:** "Experience doesn't need a chevron as it's not collapsed. Tapping on it to find the rule is app behavior that should be known to the user."

**Picture 17:** the row "Knight, level 2", "2,250 of 4,500 experience" with a right chevron.

**Checked:** P1 draws the chevron, and ch-1 rules a chevron on every row that opens something (`docs/design/rulings/dec-morning-2026-11-15.md:90`; `src/app/player/PlayerLevel.tsx:67`). His note would change ch-1, at least for this row.

## 15. "Attack bonus" should not be in Details

**Tag: bug.**

**His words:** "Attack bonus should not be part of the details. we've shown it above."

**Picture 18:** the open "Details": the look and manner lines, Age, Height, Weight, Background, Affiliation, Liege, Moon sign, and last "Attack bonus" with a boxed 1.

**Checked:** Details takes every sheet field not used elsewhere (`src/app/CharacterSheet.tsx:1376`, `:2253`). Only the first attack-like field is kept out (`src/modules/characters/play.ts:36`); a second one in the pack's sheet layout falls into Details. It breaks "nothing shows on both" (`player-screen-ruled-so-far-2026-11-14.md:15`). Nothing specifies it there.

## 16. "Movement": the burden rules open in place; they should be a pop-up

**Tag: change.**

**His words:** "tappng heavily budened still expands movement box. The expanded rules should be a pop up sheet like the saves/abilities/etc."

**Picture 19:** two boxes under "Movement". The left ("30", "Speed, 10 ft in a fight") is stretched tall and mostly empty. The right ("Heavily burdened") has opened its four burden levels and a "From your setting:" line in place.

**Checked:** opening in place is how the load bar is specified ("the tiers one tap away", 06:574; `src/app/LoadSummary.tsx:61`, `:108-120`). P1 does not draw the tap. No earlier ruling or fix to make it a pop-up was found, so "still" has no source in the docs. In his favour: sv-2 rules "a tap on a figure opens one sheet… it holds for every figure."

## 17. Some pop-ups are in the book format and some are not

**Tag: change.**

**His words:** "Gaffe is in book format, listen at doors is not. Review everything on player tab to ensure pop ups are book format"

**Pictures 20, 21:** "Listen at doors" in the plain style (a bold result, lines of rules text, a small source line); a language's pop-up in the book format (red capital heading, red "Note" label, "Got it").

**Checked:** the book format is the part "Entry, book format" (`src/ui/creation.tsx:877`; 06:614; cs-4, cs-41). The figure pop-ups are approved in the plain style (frames P7, P7b; sv-2a). No ruling puts every Player pop-up in the book format.

**His request, the review: every pop-up reachable from the Player tab today**

| Style | Pop-ups |
|---|---|
| Book format | A language; a single ability or trait (Knighthood); class; kindred; alignment; patron; a Details value's entry |
| Plain, a figure's pop-up | Armour class; Attack; Level; movement speed; Experience bonus; Wisdom vs magic; each score; each save; each skill (Listen at doors) |
| Plain, other | Hit points; setting the armour class; a trait with uses; the Abilities and Traits lists; Notes; Weapon skills; a status; Portrait; Keep lit; an item's pop-up; the Attack view; Quiver; "Can't wield" and other blocked actions |

**Reviewed with him, 19 November.** The pop-ups were put to him as three groups: (1) an entry from the book, in the book format today; (2) a figure explained, and the Abilities and Traits lists, plain today; (3) something you do (Hit points, Portrait, Quiver, an item's pop-up, a status), plain today. Suggested: the book format for groups 1 and 2. He asked: "why not also group 3?" Told that the red heading carries over, that "Got it" does not (those pop-ups have their own buttons), and that red labels beside a typed box need care, he asked: "mock up both options for me 1+2, 1-3. make sure i can see all 3 groups in the mockups. light mode, tablet landscape."

Two option sketches were drawn on frame P1 with the shared book stylesheet, invented names, light, a tablet held sideways:

| | Option 1 | Option 2 |
|---|---|---|
| Group 1 (a trait's entry) | Book format, as today | The same |
| Group 2 (a skill, a save, the Abilities list) | Book format, new | The same |
| Group 3 (Hit points, the Quiver) | Plain heading | The book's red heading; its own buttons; no "Got it" |

**His answer: "Option 2, all three".**

This is his direction from sketches, not an approved screen: it needs a ruling and a designer's mockup before a builder (mockups first), and it changes the figure pop-up he approved plain on 2026-11-14 (frames P7, P7b; sv-2a). What the sketches did not settle, for that sitting:
- "Got it" at the foot of the Abilities list, and "In use ✓" on the Quiver's chosen kind, were invented for the sketch.
- On Hit points the red heading stands over the accent "Set"; shown to him and accepted in the sketch, not measured for contrast.
- Not drawn: dark, a phone, long names, the other group 3 pop-ups (Portrait, a status, Notes, blocked actions, an item's pop-up).
- The sketches used his notes' words where he had given them (items 3, 8, 23, 26).

The sketches are outside the repo: the pictures and the page's source are in the driver's shared notes folder under `test-feedback-2026-11-19-popups-options`, and the pictures are in his Drive under `Pictures for approval\2026-11-19\popups-book-format-options`.

## 18. The "Abilities" pop-up: "drawback", "from level 3", and its formatting

**Tag: question**, answered. The formatting is a **change** (see item 23).

**His words:** "why are we calling liege and code a drawback? formatting on this screen can be mproved. why does knighthood say from level 3"

**Picture 22:** the "Abilities" list: "Liege" and "Chivalric code" with a large bold "drawback"; "Knighthood" "from level 3"; "Monster slayer" "from level 5"; "Wisdom vs magic" "0"; "Experience bonus" "+0 %"; others with nothing at the right.

**Answered:**
- "drawback" is the app's word for an ability the pack marks as a disadvantage (`src/modules/characters/traitChips.ts:77`; ruled sr-3, `docs/design/rulings/m5b-sheet-review-2026-11-04.md:14`, and tc-2). It prints in the large figure slot, which is why it shouts.
- "from level 3" shows an ability the class gains later, ahead of time; his character is level 2 (`traitChips.ts:78`; sr-3 gives those words).
- No frame draws this list; plan row C12 lists it among the rows never framed (`dec-13-the-player-screen.md:132`).

## 19. "Wisdom vs magic": no rules citation

**Tag: bug.** With a **question**, answered.

**His words:** "Wisdom vs magic - where does this come from? i dont see a rules citation."

**Picture 23:** a plain pop-up: "Wisdom vs magic 0: the same as WIS.", a paragraph of rules text, no source line.

**Answered and checked:**
- It comes from the pack's rules for save modifiers (`src/modules/characters/fills.ts:320-341`, `explain.ts:240`, `:254`).
- It was ruled off the sheet on 2026-11-08 (`docs/09-decisions-log.md:1040`). It leaks into Abilities because the filter drops two families of fields and not this one (`src/app/CharacterSheet.tsx:1791-1797`).
- Its pop-up is drawn without a source (`CharacterSheet.tsx:2160-2166`), though every figure's pop-up must carry one (`docs/plans/dec-player-figure-sheet.md:17`).

## 20. The "Knighthood" pop-up: the text is one block

**Tag: change.**

**His words:** "Knighthood not formatted well. Hospitality should be on it's own line, as an example."

**Picture 24:** the book-format pop-up: one long paragraph in which a sub-heading runs on inside the text, then "From" and "When" labels and a source line.

**Checked:** a trait's text prints as one paragraph and keeps no line breaks (`src/modules/characters/listEntries.ts:164`, `src/ui/creation.tsx:733`, `creation.css:1804`). The structured text format (pf-18, `docs/design/rulings/dec-rule-text-blocks-2026-11-13.md`) covers place rules, area text and procedure steps, not traits. It needs that format widened to traits (app and packs), or a new rule.

## 21. The "Experience bonus" pop-up says the bonus three times

**Tag: change.**

**His words:** "Experience bonus has duplicative information. Get rid of the first 0% in bold. it's presented in text just below, and also on the table below."

**Picture 25:** a bold "+0%", then "Your prime requisite CHA 10, STR 14 gives +0% to the experience you earn.", then the table "Experience by prime score" with the matching row in bold.

**Checked:** the bold figure is what every figure pop-up shows under its title (`src/ui/BreakdownSheet.tsx:66`; frames P7, P7b; sv-2a), the same part as the bold "2" of item 11. The sentence is `src/app/CharacterSheet.tsx:1248-1255`; the table `src/ui/creation.tsx:1238-1246`. The spec asks for the row and the table on a tap (`docs/plans/m5b-sheet-revised.md:45,54`); no mockup draws this pop-up.

## 22. "Full character sheet" with its Edit button is out of place

**Tag: change.**

**His words:** "this is out of place. dont put it on this screen. instead add the Edit button with the icon to the "your characters" screen."

**Pictures 26, 27:** on the Player tab, a large heading "Full character sheet" with an "Edit" button (quill). The "your characters" screen: two character cards, each with "Remove…", and "+ Make another character"; no Edit.

**Checked:**
- P1 draws the heading with its Edit in the right column (plan rows C12 and C6, `dec-13-the-player-screen.md:41`, `:45`; `src/app/CharacterSheet.tsx:729-740`).
- No approved frame shows Edit on "Your characters" (december/13 frame G4, approved 2026-11-13, has none), and `docs/05-features.md:94` rules "no Change portrait or Open buttons" on its cards.

## 23. The "Abilities" and "Traits" pop-ups: "at level 3", and the book format

**Tag: wording** ("at level 3"). The book format is a **change** (see items 17 and 18).

**His words:** "Instead of "From level 3" say "at level 3" again we need to put this in book formatting. Same for Traits."

**Picture 28:** the same "Abilities" list as item 18.

**Checked:** "from level 3" is sr-3's wording (`docs/design/rulings/m5b-sheet-review-2026-11-04.md:14`; `src/modules/characters/traitChips.ts:78`). Both lists are plain rows in a pop-up (`src/app/SheetSection.tsx:77-88`; `CharacterSheet.tsx:1960-1981`); only the single entry a row opens is in the book format.

## 24. Scores with no modifier should show "+0"

**Tag: change.**

**His words:** "One more - abilities with no modifier should show +0"

**Picture 29:** a second character's Player tab on a tablet, in the dark theme. Under "Scores", four tiles carry "+1" under the number; Intelligence 13 and Wisdom 12 carry nothing, so their numbers sit alone.

**Checked:** leaving it out is deliberate and tested: "A score whose modifier is nothing shows none under it (no "+0")" (`src/app/player/PlayerP1Fixes.test.tsx:8`, `:125`), one of the fixes that brought the screen to P1, whose note reads "every tile one size whether or not it has a modifier". His note reverses that fix.

**Also in this picture:** the experience bar is empty again at "1,750 of 3,500" (item 11, on another class), and the attack tile reads "+0" over "Melee +1, Missile +1" (item 5).

---

## Added after the first pass: skills (items 25 to 28)

Given in one message, with pictures 30 to 34, split here into four. He closed with "any questions?"; none was needed.

## 25. "Skills": drop the class's line under the heading

**Tag: change.**

**His words:** "There's no need for the "friars have..." line, since it's reflected in the forage skill below and is a duplicative explainer."

**Picture 30:** the heading "Skills" with one line under it: "Friars have a Skill Target of 5 for Survival when foraging."

**Checked:** the line is the pack's own note on the class's skills, printed under the heading on purpose (`src/app/CharacterSheet.tsx:1743-1746`). No ruling for or against it under the heading was found; the 2026-11-08 ruling (R3-13, `docs/09-decisions-log.md:1036`) puts the class's skill text in the skill's pop-up.

## 26. A skill's pop-up: a new top line, and four lines out

**Tag: change.**

**His words:** "remove "base chance for everyone" from all skills. it's duplicative and not needed for the character. Using forage skill as an example: Format for these checks (at top) is "Succeeds on a 5+,  [die icon] roll 1d6 [+ any modifier, only show if there's a modifier]" Remove base chance for everyone, a friar, higher is better, burrowkin [name swapped]. Keep everything after and including "Foraging""

**Pictures 31, 32:** "Listen at doors": a bold "Succeeds on 6, 1 in 6", "Base chance for everyone: 1-in-6.", then the rules text and the source line. "Forage": a bold "Succeeds on 5 or 6, 2 in 6", then "Base chance for everyone: 1-in-6.", "A Friar at level 2: 2-in-6.", "Higher is better: 2-in-6 counts.", "Burrowkin [name swapped]: 2 when foraging.", then the rules text starting "Foraging…" and the source line.

**Checked:** all of it is specified as built. The top line is "the odds both ways" (`docs/05-features.md:107`; `src/app/FigureSheets.tsx:68`). The four lines are "where the number comes from" (`src/modules/characters/explain.ts:209-224`; the manual check at `docs/testing.md:612` names them). His note replaces both, and keeps the pack's text (R3-13) and the source line.

## 27. "Skills" should have a roll line like Saves and Scores

**Tag: change.**

**His words:** "Skills should have a roll row like Saves and Scores that shows the pack rules. For [fae-woodland] it's [Die icon] Roll d6: Target or higher succeeds. i'm not sure what it is for [classic-advanced]"

**Picture 33:** the "Saves" heading with its line: the d20 glyph and "Roll d20: your save's number or higher succeeds."

**Checked:** the Saves line is sv-1 (`docs/design/rulings/dec-player-screen-2026-11-14.md:16`), "built from the rules set's die and pass condition", and P1 gives Scores the same. Nothing rules such a line for Skills. **Open, his words:** what the line reads for the [classic-advanced] pack (a pack question).

## 28. A skill's figure: "[Target]+ on [die]" in place of "1-in-6"

**Tag: change.** Part of it may be a pack fix.

**His words:** "target numbers (now 1-in-6) should read "[Target]+ on [die icon][die roll, ex: d6]""

**Picture 34:** the skills' figures at the right of their rows: the d6 glyph, then "1-in-6" (four rows) and "2-in-6" (two rows), each with a chevron.

**Checked:** a row shows the skill "in that pack's own style ("2-in-6" or "5+", or "35%")" (`docs/05-features.md:107`, CS-5a), with the die's glyph before it (ch-1; `src/app/CharacterSheet.tsx:1750-1762`). So the app can already show "5+" when the pack states its skills that way; the [fae-woodland] pack states them "in-6" today. Not checked in the pack. His format also moves the die after the number ("5+ on d6"), which is new.

## Added in the evening, to the driver (items 29 to 32)

Two pictures of the Player tab in a narrow window: the left rail of icons with a scroll bar and a small arrow beside it; and the weapon in hand, "Dagger", "In hand, Grip: Melee", with four roll lines ("to hit, in melee", "to hit, as a missile", "damage, in melee", "damage, as a missile").

## 29. The left rail shows a scroll bar

**Tag: fix.**

**His words:** "scroll bar on left column is disruptive."

**Checked:** the rail is `src/ui/SectionNav.tsx` and `src/ui/SectionNav.css`. No ruling or mockup has the rail scroll. The rule that draws the bar was not found by the scout.

## 30. Grip "Melee" still lists the missile lines

**Tag: change** (nothing rules it yet).

**His words:** "grip "melee" still shows thrown values. thrown grip shows correct values."

**Checked:** the roll lines are built one per kind the weapon has, from its tags and qualities (`src/modules/characters/play.ts:436-449`); nothing there reads the chosen grip. Grips are ruled as a button and the line naming the mode only (md-1, `docs/design/rulings/dec-player-screen-2026-11-14.md:45`). **Open:** that a grip shows only its own roll lines needs a ruling.

## 31. The first grip is selected by default

**Tag: check, then fix or change.**

**His words:** "need the first option to be selected by default for grip."

**Checked:** a fresh weapon already takes its first mode that draws nothing or has its stack in the pack (`src/modules/inventory/weaponModes.ts:186-194`, ah-3). **Open:** what he saw unselected (the Grip sheet's mark, or the roll lines of item 30).

## 32. Spells can be pinned, once magic is built

**Tag: already ruled; keep it in the plan.**

**His words:** "I know magic is not implemented yet but make sure in the plan we have the ability to pin spells"

**Checked:** ruled: the pin's star reaches spells and traits (`docs/09-decisions-log.md`, 2026-11-14), a player may pin a spell or trait to At hand (pin-2, 2026-11-15), and "Memorized spells can be pinned to At hand and cast from there" (`docs/05-features.md:52`). The data half is built (`docs/status/2026-11-15-dec13-c8-pins.md`); the screen half waits for its mockup with magic.
