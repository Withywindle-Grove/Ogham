---
status: approved at sitting B, 2026-11-27 (tickets #162 to #171)
loop: 2
rulings: docs/design/rulings/player-sitting-sheet-2026-11-27.md (pss-1 to pss-17; "For the spec (loop 2)"); docs/design/rulings/player-sitting-b-2026-11-27.md (psb-1 to psb-8); ic-3 (docs/design/rulings/dec-night-2026-11-14.md)
mockups: december/14 frames P3 and P5b (approved 2026-11-27); page 28 frame M4g (approved 2026-11-20); three frames owed (38-3 at 375 px, the icon page, the light block with Use)
---

# Spec: the Player sitting's work

Loop 2 of the build loop. It builds the ten pieces of the Player sitting of 2026-11-27 ("For the spec (loop 2)" in the rulings file). Francis ruled that all of them go through one spec, not plan rows.

Seven pieces can be built now. Three wait for a frame that is not drawn yet (pieces 7, 8 and 9). Their tickets are blocked until Francis approves the frame. Nothing in this spec changes stored data or adds a migration.

## Problem Statement

A player at the table uses the Player tab to see their character and act. Some parts of the tab do not yet do what Francis approved:

- Details shows "Nothing written yet." when nothing is written, and its entry names (kindred, class, alignment, background) are plain words. The player must go to another tab to read what "Bog folk" means.
- A spell cannot be pinned. A caster must open the Magic tab every time they cast the same spell.
- At 0 hit points, only a toast says "Down". After the toast goes, nothing on the tab says the character is down.
- Every ready weapon gets its own weapon block. A character with six ready weapons has six blocks, and At hand goes off the screen.
- In armour mode the load card says "Move N", and the speed tile says the speed again.
- On a phone a long name stays cut in the bar ("Brannoch Ironhorn of t…").
- Fire, Drink, Eat and Stance carry a generic mark, not an icon of their own.
- A lit lantern with charges shows twice in At hand: as the light, and as an item row with Use.
- A blocked Attack says "Open the quiver". The ruled word is "Quiver".

## Solution

The Player tab does what the sitting ruled:

| # | Piece | What the player sees | Frame | Ruling |
|---|---|---|---|---|
| 1 | Details | Each entry name is a tap that opens its entry. The backstory has the label "Backstory". With nothing written, there is no Details part at all. One line for each thing, in the sheet's order | P3, "opened" and "almost nothing" panels; approved 2026-11-27 | pss-1, pss-9 |
| 2 | The pinned spell | A pinned spell (any spell in the book) is a block in At hand, like the weapon in hand's: the star and its name, its state ("Memorized, 1 of 2 left"), its roll, its range, and Cast | M4g, left panel and right panel; approved 2026-11-20 | pss-5, psb-4, psb-5, euf-6, pin-1, pg28-2 |
| 3 | The Pin star on a spell's sheet | A spell's sheet on the Magic tab has the Pin star beside ✕, as every other sheet has (any spell in the book) | None: approved from a picture of the built sheet | pss-6 |
| 4 | Down | At the rules' `death.at`, a Status ring "Down" shows among the character's other statuses in the head | None: approved from a picture of the built screen | pss-7, psb-1 to psb-3 |
| 5 | Weapon blocks | A weapon block only for what is in hand (two at most). Every other ready weapon is an At hand row with Wield | P5b; approved 2026-11-27 | pss-8 |
| 6 | Armour mode's load card | No "Move N" on its top line. The speed is said once, in the speed tile | None: approved from a picture of the built card | pss-12 |
| 7 | A long name on a phone | A cut name leaves the bar and leads the head's line, as on an upright tablet | **Owed**: 38-3 at 375 px, light and dark | pss-14 |
| 8 | Icons | Fire, Drink, Eat and Stance each get an icon | **Owed**: the icon page; Francis picks | pss-10 |
| 9 | A lit light with charges | One row: the light's ring, with Use on it. No second item row | **Owed**: the light block with a Use button | pss-17 |
| 10 | "Quiver" | A blocked Attack's button says the mode's own word: "Quiver", "Pouch", "Grip", "Stance" | None: words only | ic-3 |

Pictures owed with this work, nothing new to build: "none left" on a trait as built (pss-2); P5's middle column and the spent mode (pss-3); P5b's open parts (pss-4). They go in the pull request of the piece that touches the same screen part (see Further Notes).

## User Stories

**Details (piece 1)**

1. As a player, I want to tap my kindred's name in Details, so that I can read what my kindred does without leaving the Player tab.
2. As a player, I want to tap my class's name in Details, so that I can read my class's entry at the table.
3. As a player, I want to tap my alignment and my background, so that I can read their entries the same way.
4. As a player, I want a name with no entry in the pack to stay plain words, so that I never tap something that opens nothing.
5. As a player, I want my backstory to carry the label "Backstory", so that I know what the paragraph is.
6. As a player with nothing written in Details, I want no Details part at all, so that the tab shows no empty heading.
7. As a player, I want each detail on its own line, in the sheet's order, so that I find them where the full sheet puts them.
8. As a player, I want Details to stay folded or open as I left it on this device, so that the tab does not change under me.
9. As a player with a screen reader, I want each entry tap to say "<name>: open its entry", so that I know what it does.

**The pinned spell (pieces 2 and 3)**

10. As a caster, I want a Pin star beside ✕ on any spell's sheet on the Magic tab, ready or not, so that I can pin a spell I cast often (psb-4).
11. As a caster, I want the toast "<name> pinned to the top" with Undo, so that I can take back a pin I did not mean.
12. As a caster, I want a pinned spell to show in At hand as a block, so that I can cast it from the Player tab.
13. As a caster, I want the block to show the star and the spell's name, so that I see it is pinned.
14. As a caster, I want the block to show "Memorized, 1 of 2 left", so that I know how many castings I have.
15. As a caster, I want the block to show the spell's roll ("d6 +2 turns of light") and its range ("30 paces range"), so that I need not open the spell to play it.
16. As a caster, I want Cast on the block to do what Cast on the Magic tab does, with the same toast and Undo, so that the two places agree.
17. As a caster with no castings left, I want the block to say "Memorized, 0 of 2 left" and keep Cast as a button that says why on a tap, so that I am never left with a dead button.
18. As a caster, I want a spell with no roll to show a block without a roll line, so that the block shows nothing empty.
19. As a caster, I want a long spell name to wrap beside Cast, so that I can read all of it.
20. As a caster with two pinned spells, I want the two blocks one after the other, so that At hand stays in order.
21. As a caster, I want the pinned things At hand to come first in At hand and take no drag handle, so that At hand keeps its own order (pg28-2).
22. As a caster, I want to tap the block's name to open the spell's sheet, with the star filled, so that I can unpin it there.
23. As a caster, I want a pinned spell that is in my book but not ready today to keep its block, saying "Not memorized" (or the setting's own word), with Cast saying in a pop-up why it cannot be cast today, so that my pin is kept (psb-5). A pin whose spell has left the book is ignored, as `livePins` does.
24. As a caster on a phone, I want the block to fit at 375 px, so that I can cast from a phone too.
25. As a GM viewing a player, I want the pinned spell block to show as the player sees it, so that I see what they see.

**Down (piece 4)**

26. As a player whose character reaches the rules' `death.at`, I want a "Down" Status ring among my other statuses in the head, so that the tab keeps saying it after the toast goes.
27. As a player in a setting whose rules set no `death.at`, I want no Down ring at 0 hit points, so that the app never guesses a rule.
28. As a player who is healed above `death.at`, I want the Down ring to go, so that the head shows only what is true.
29. As a player with many statuses, I want Down to count among the rings in view and the "+N", so that the head keeps its size.
30. As a player, I want nothing under the hit points bar about Down, so that Down is said once.
31. As a player, I want the "Down" toast to stay as built, so that the moment is still marked.

**Weapon blocks (piece 5)**

32. As a fighter, I want a weapon block only for what is in my hands, so that the blocks mean "what I fight with".
33. As a fighter with a weapon in each hand, I want two blocks at most, so that At hand stays on the screen.
34. As a fighter, I want every other ready weapon as an At hand row with Wield, so that I can take it in hand with one tap.
35. As a fighter, I want a ready weapon's row to keep its mode button (for example Quiver), so that I can choose what it shoots before I wield it.
36. As a fighter with six ready weapons, I want one block and five rows, so that the tab is calm.
37. As a fighter with nothing in hand, I want no weapon block, so that the tab shows nothing empty.

**Armour mode's load card (piece 6)**

38. As a player in a setting with armour mode, I want the load card's top line without "Move N", so that the speed is said once, in the speed tile.
39. As a player, I want the load card on the Pack tab and the full sheet to keep their words where no speed tile shows, so that the speed is still said somewhere.

**A long name on a phone (piece 7, after its frame)**

40. As a player on a phone with a long name, I want the cut name to leave the bar, so that the name is not shown cut.
41. As a player on a phone, I want the full name to lead the head's line, wrapping, so that I can read all of it once.
42. As a player on a phone with a short name, I want the bar as today, so that nothing moves without need.

**Icons (piece 8, after the icon page)**

43. As a player, I want Fire, Drink, Eat and Stance to each have an icon, so that I find the button by its shape.
44. As a player in dark mode, I want the icons to read in dark too, so that both modes work.

**A lit light with charges (piece 9, after its frame)**

45. As a player with a lit lantern that has charges, I want one row, the light's ring with Use on it, so that the lantern shows once.
46. As a player, I want Use on that row to spend a charge, as Use does today, with its toast and Undo, so that nothing else changes.

**"Quiver" (piece 10)**

47. As an archer whose arrows are used up, I want the blocked Attack's button to say "Quiver", so that the word matches the button I know.
48. As a player with a pouch, a grip or a stance weapon, I want the same: "Pouch", "Grip", "Stance".

**Everyone**

49. As a player, I want every new tap to be at least 44 px, so that I can hit it at the table.
50. As a player, I want each piece to work at 375 px, in light and dark, and with Larger text, so that every device works.
51. As a player offline, I want the pin and the cast to work as other commands do offline, so that nothing new breaks.
52. As Francis, I want each built piece shown beside its approved picture in its pull request, so that I approve it by sight.

## Implementation Decisions

**No stored data changes.** The `pins` list on the character's play row already takes `{ kind: 'spell', key }` (dec-13 C8, data half). The command `character.pin` already exists. Casting uses the existing `character.castSpell` and `character.uncastSpell` commands. No new command, no migration, no read rule.

**Piece 1, Details**
- The Player tab's Details reuses the full sheet's entry taps (`TapValue`, opening `EntryPanel`) for kindred, class, alignment and background. A value is a tap only when the pack has an entry for it.
- The backstory gets the label "Backstory" in the ledger's label column.
- With no detail and no backstory, the Player tab draws no Details part: no heading, no chevron. The full sheet keeps "Nothing written yet." (P3 covers the Player tab only).
- `detailsItems()` stays the one place that decides which lines show. It returns, for each line, whether its value has an entry.

**Pieces 2 and 3, the pinned spell**
- The Magic tab's spell sheet passes `PinStar` as its `headAction`, as the trait sheet does. Its toast and Undo are the shared Pin star's.
- Any spell in the book can be pinned, ready or not (psb-4). At hand reads pins only through `livePins`. A spell pin is live while the spell is in the character's book. A pin whose spell has left the book stays stored and is ignored, as today. A pin is kept when the spell is not ready today.
- At hand order (pg28-2, M4g): the weapon in hand's block stays above At hand, outside it; inside At hand, the pinned spells come first, as blocks, then the items (pinned first, as today), then the light.
- A pinned spell's block is a named variant of the weapon in hand's block (the Components inventory, "Weapon in hand"), not a copy. The block shows: the small filled star and the name (a tap that opens the spell's sheet); the state line; the roll line when the spell has one; the range line when it has one; Cast at the right.
- The state line uses the Magic tab's own count of castings ("Memorized, 1 of 2 left"). A spell in the book but not ready today says "Not memorized", or the setting's own word (psb-5). The words come from where the Magic tab gets them, not a new string.
- Cast runs the same command, the same toast (`castToastText`) and the same Undo as the Magic tab. With no casting left, or the spell not ready today, Cast stays tappable and opens a pop-up that says why (hard rule 10, psb-5).
- A spell ready at more than one level: one block for the spell; Cast spends as the Magic tab's Cast would (psb-6).
- On the Player tab, the pinned spell shows once (At hand). The Magic tab keeps listing it, its sheet's star filled (psb-7).

**Piece 4, Down**
- A pure function gives the head's status list: the character's statuses, plus "Down" when `downAtOf(rulesSets)` is not null and hit points are at or below it. The head's ring part draws that list. Down is not stored: it is worked out each time.
- The Down ring is a Status ring with no end (a dashed track, no arc), in the harm tone (psb-1). It is first among the rings and shows only while the character is Down (psb-2). Its tap opens the death panel (psb-3). Its symbol is one of the 25 approved; if none fits, the builder stops and Francis selects one (no first-letter fallback).
- The existing "Down" toast (`burstWords`) stays.

**Piece 5, weapon blocks**
- `atHandAction()` gives Attack only to a weapon in hand. A weapon worn ready gets Wield.
- The weapon block takes only the lines in hand, at most two. Every other ready weapon is an At hand row (`ItemRow`) with Wield and its mode button.

**Piece 6, armour mode's load card**
- Where the speed tile shows (`speedOnce`), armour mode's top line says the burden's name without "Move N", as slot bands do (of-6). Where no speed tile shows, the words stay as today.

**Piece 7, a long name on a phone (blocked by its frame)**
- The upright tablet's rule (`PlayerHead`'s head name, the bar's cut title hidden) extends to a phone. Build to the approved 38-3 at 375 px.

**Piece 8, icons (blocked by the icon page)**
- The four icons join `ACTION_ICONS`. Each is one of the app's icon set, as Francis picks.

**Piece 9, a lit light with charges (blocked by its frame)**
- When the lit light's item is itself At hand and has charges, the item's own row is not drawn. The light's row (`LightInAtHand`) carries Use beside its ring. Use runs the existing charge command. Build to the approved frame.

**Piece 10, "Quiver"**
- `spentWords()` returns the mode button's own word (`MODE_BUTTON_WORDS`) as `open`.

**Docs in the same pull requests**
- Each visible piece keeps the Components inventory's Code column current (06): Details ledger, Weapon in hand (the spell variant), Pin star, Status ring, Load bar or load card, Light section, the icon list.
- 05's Player screen lines already say the ruled behaviour (#157). A builder lists a departure in the pull request's text; the design agent updates this spec after the merge (lc-3).

## Testing Decisions

Three test points, all in use today (Francis, 2026-11-27: "Yes"):

| Seam | What it tests | Prior art |
|---|---|---|
| 1. The pure functions that decide what shows | `detailsItems` (which lines, which have an entry); `livePins` and the At hand order with a pinned spell; the head's status list with Down; `atHandAction` and the weapon block's lines; the load card's top line in armour mode; `spentWords` | `pins.test.ts`, `hp.test.ts`, `packHelpers.test.ts`, `weaponModes.test.ts`, `PlayerDetails.test.tsx` (its `detailsItems` cases) |
| 2. One part of the Player tab, drawn in a test (Testing Library) | What a player taps: the entry taps in Details; the Pin star on the Magic tab's spell sheet and its toast; Cast on the block and its Undo; Cast with none left opens a pop-up; the Down ring among the rings and the "+N" | `PlayerDetails.test.tsx`, `PlayerTraits.test.tsx`, `PlayerWeaponInHand.test.tsx`, `atHandStacked.test.tsx`, `lightSection.test.tsx` |
| 3. The real screen in a browser (layout checks) | 375 px, light and dark, Larger text, long names, 44 px targets, no sideways scroll; the pictures Francis approves | `player-p3-pins.spec.ts` (`p1=pins`), `player-c2.spec.ts` (`p1=messy`), `player-c14.spec.ts` (`p1=weapon`), `light-tap.spec.ts`, `gallery.spec.ts` |

- A good test checks what a player sees or what a function returns, never how a component is built inside.
- Each test's purpose is written first, as a plain sentence.
- New layout fixtures go in the layout harness as `p1` flags: a caster with pinned spells (one with a long name, one with none left, one with no roll, one in the book but not ready), a character at `death.at`, a character with several ready weapons, a lit lantern with charges at hand.
- The examples are invented ("Marsh light", "Hush", "Bog folk"): no game IP (hard rule 2).
- Database tests: none needed (no migration, no read rule). The pin and cast commands keep their existing permission cases.

## Out of Scope

- The bonus hit points band (pss-3): it waits until the app has bonus hit points.
- Frame P4 (retired, pss-2) and P1's merged Details lines (pss-9).
- The weapon block's edge (stays 1.5 px, pss-11); the comma after the name (none, pss-13); the GM's view as a player (as built, pss-15); the light's place in At hand (as built, pss-16).
- Moving the pinned things At hand by hand (pg28-2), hover text and arranging the screen (euf-8, euf-9: after 5 December).
- A block's short line (⚑ 28 of page 28): it waits on pack question E7.
- Pinning from anywhere but a spell's sheet on the Magic tab.
- Drawing the three owed frames: a designer job, outside this spec's tickets.

## Further Notes

**Ruled at sitting B** (`docs/design/rulings/player-sitting-b-2026-11-27.md`; Francis, 2026-11-27):

| Id | Ruled |
|---|---|
| psb-1 | The Down ring: harm tone, dashed track (no end); its symbol one of the 25 approved. None fits: the builder stops and Francis selects one |
| psb-2 | First among the rings; shown only while Down |
| psb-3 | Its tap opens the death panel |
| psb-4 | Any spell in the book takes the star, not only ready ones |
| psb-5 | A pinned spell not ready today keeps its block: "Not memorized" (or the setting's word); Cast says why in a pop-up; the pin is kept |
| psb-6 | A spell ready at two levels: one block; Cast spends as the Magic tab's Cast would |
| psb-7 | The Magic tab keeps listing a pinned spell, the star filled |
| psb-8 | The full sheet with nothing in Details keeps "Nothing written yet." |

**Pictures owed** (no new code): "none left" on a trait (pss-2) goes with piece 2's pull request (At hand); P5's middle column and the spent mode (pss-3) and P5b's open parts (pss-4) go with piece 5's pull request (P5b).

**Owed frames** (a designer job, each with `impeccable critique`): 38-3 at 375 px, light and dark (piece 7); the icon page, two or three candidates each for Fire, Drink, Eat and Stance at 20 px, light and dark (piece 8); the light block with a Use button (piece 9). The tickets for pieces 7, 8 and 9 stay blocked until Francis approves each frame.

**Left from #154:** three CI review nits on #154 were not applied. A builder of a piece that touches the head (piece 4 or 7) may fold them in and list them in its pull request.
