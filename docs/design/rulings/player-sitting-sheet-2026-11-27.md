---
status: pending
milestone: December first play (the Player screen's open questions: `docs/plans/dec-13-the-player-screen.md`, `docs/plans/dec-14-player-audit-fixes.md`, pull request #154)
absorbed-into: pending, after the sitting: the rulings file it becomes, 05, 06, docs/09-decisions-log.md
supersedes: nothing
---

# The Player screen: the sitting sheet (2026-11-27)

Prepared by a designer worker for one sitting with Francis. **Nothing here is decided.** Each ⚑ has options and one recommendation; answer by number ("3 A", "7 B"). One at a time.

Pictures are the mockups (`../mockups/december/png/`) or the built screen (`../built/dec-14/`). Where a question needs a drawing that does not exist, the ⚑ says which frame to draw; none is drawn here.

## Already ruled (not asked again)

| What | Ruled | Source |
|---|---|---|
| The two-column order; the phone's order; no marching order or party list | ps-2, ps-2a, ps-4 | `dec-player-screen-2026-11-14.md` |
| The head: name, "the" kindred, title; portrait; status rings, four in view (three on a phone) | ps-5; C2 as built | same; dec-13 C2 |
| The level block above Details; score boxes one size; the aligned top | ps-8, ps-10, ls-1 | same; `lookback-sitting-2026-11-18.md` |
| Rule lines in the Saves and Scores headings; no class note above Skills | sv-3, ps-7, pf-20, rl-1 | `dec-player-screen-2026-11-14.md` |
| Stacked buttons; toggles for opposite pairs; weapon modes on the screen | sb-2, tg-1, md-1 | same |
| The ruled icons (Wield, Grip, Quiver, Use, Pouch, Refill, Put out, Set max, Clear, Light) | ic-3 | `dec-night-2026-11-14.md` |
| Details folded shows its heading alone; remembered open on the device | tfr-1, euf-1 | `dec-test-feedback-player-rows-2026-11-19.md`; `dec-player-end-user-feedback-2026-11-19.md` |
| Experience row has no chevron; "+0" under a score with no modifier | tfr-2, tfr-3 | `dec-test-feedback-player-rows-2026-11-19.md` |
| No "Full character sheet" heading and no Edit on the Player tab; Edit on "Your characters" | tfr-4, tfr-5 | same |
| Notices box beside the portrait; a waiting or refused change goes in it, no "15 waiting" on a tile | tfn-1, tfn-2; M1 fix 1; of-3 | `dec-test-feedback-notices-2026-11-19.md`; `p4-sitting-2026-11-20.md` |
| "No light" only in the notices box and on Scene | d5-20 | `dec5-flags-sitting-2026-11-20.md` |
| Abilities and traits pinnable, shown in the right column's list, in the player's order | euf-2 to euf-5; pg28-1 to pg28-8 | `dec-player-end-user-feedback-2026-11-19.md`; `page-28-m4-pins-2026-11-20.md` |
| A pinned spell stays At hand, as a block like the weapon's (page 28, frame M4g, approved); it leaves the list it came from | euf-6; pin-1 | same two files |
| The light: the ring is the tap; not lit and burnt out sit in At hand; Refill and "Light another" when burnt out | lt-1 to lt-9; light-tap ⚑ 1 to 7 | `light-tap-2026-11-22.md`; `docs/plans/light-tap.md` (page 35 approved, page 37) |
| Skill figures: "5+ on d6"; "2 in 6" read as the top faces | tfs-3; of-2 | `docs/plans/test-feedback-2026-11-19.md`; `p4-sitting-2026-11-20.md` |
| Movement: the unit, "Speed, 40 paces in a fight", "coins' weight", left-aligned | P1 fixes 5 and 6 (19 Nov) | dec-13, "The fixes to frame P1" |
| Over the most: "Can't move" once, in the speed tile | 8a | `docs/plans/dec-14-player-audit-fixes.md` |
| Slot bands: only the band that sets the speed | of-6 | `p4-sitting-2026-11-20.md` |
| Armour class line in whole words ("Nimbleness +1"); "Melee +2, Missile +1" | 7a (A2); tfw-7 | dec-14 plan |
| The way back keeps 176 px; a cut name leaves the bar | dec-14 ⚑ 2 and 8 | dec-14 plan, "Ruled 2026-11-24" |
| Grip shows its own roll lines only | 09, 2026-11-20 | `docs/09-decisions-log.md` |
| Hover text and players arranging the screen: after 5 December | euf-8, euf-9 | `dec-player-end-user-feedback-2026-11-19.md` |

## Dropped from the brief's list, as already ruled

- **Light: unlit vs burnt out (brief item 3).** Ruled by lt-4 and lt-5 (page 35, approved 2026-11-22) and built (`StatusRingTap`, `LightSection.tsx`). "Light another" on a burnt-out light is page 35's word, approved after ic-3's "Light".
- **Where "waiting" sits (brief item 6).** In the notices box (tfn-2), with no mark on the tile (M1 fix 1, of-3).
- **What an open Edit does on a tablet (item 7).** tfr-4 took Edit off the Player tab; nothing to open there now.
- **"Open the quiver" (item 7).** Ruled by ic-3: it reads "Quiver". Still built as "Open the quiver" (`spentWords`, `src/modules/inventory/weaponModes.ts`): a build fix for the driver, not a question.
- **The C13 figure differences (item 7).** Replaced by tfs-3 ("5+ on d6") and of-2.
- **Most of the C10 differences (item 7).** Settled by P1 fixes 5 and 6, 8a and of-6; the phone's two cards now sit side by side ([built](../built/dec-14/38-8-over-loaded-phone-light.png)). One is left: ⚑ 12.
- **C12's one "Traits" row.** Settled by pg28-1 and pg28-3 (two foot rows, the list headed "Abilities and traits").

## The open list

### Frames not yet approved (page 14)

**⚑ 1. Frame P3, Details** ([light](../mockups/december/png/14-P3-who-you-are-light.png), [dark](../mockups/december/png/14-P3-who-you-are-dark.png)).
Its "at rest" panel is out of date (tfr-1: heading only). Still open in it: each entry name (kindred, class, alignment, background) is a tap to its entry; the backstory has a "Backstory" label; with nothing written there is no Details part at all. Built today: no links, no label, and "Nothing written yet."
- A. Approve P3's "opened" and "almost nothing" panels, as drawn. With nothing written, no Details part.
- B. Approve them, but keep "Nothing written yet."
- C. Leave Details as built.
- **Recommend A.** The links save a trip to the rules; an empty heading is noise. Cost: about 1 builder turn.

**⚑ 2. Frame P4, a caster and a trait with none left** ([light](../mockups/december/png/14-P4-caster-and-none-left-light.png), [dark](../mockups/december/png/14-P4-caster-and-none-left-dark.png)).
Mostly overtaken: the pinned spell is now page 28's block (M4g), and a pinned trait sits on the right (euf-3). What is left: a trait with none left keeps its Use button and says why on a tap. Built: the toast "No uses of Horn charge left. They come back each day."
- A. Retire P4; approve "none left" as built, from a picture of the real screen.
- B. Approve P4 as drawn (the boxed message under the row).
- **Recommend A.** P4's caster panel would contradict M4g.

**⚑ 3. Frame P5, states, first part** ([light](../mockups/december/png/14-P5-messy-light.png), [dark](../mockups/december/png/14-P5-messy-dark.png)).
Its prompts column is overtaken (tfn-1), and its lights column (page 35). Still open: hit points with no maximum ("Set max"), no hit points yet ("—, tap to set"), armour class unset ("Set AC") or set by hand ("Clear"), and the spent mode's sheet. "Down" is ⚑ 7. Bonus hit points as their own band: the app has no bonus hit points to show.
- A. Approve the middle column and the spent mode, as drawn; leave the bonus band until bonus hit points exist.
- B. Approve the whole frame.
- C. Redraw P5 with only its live parts first.
- **Recommend A.** Those parts are built near the drawing; a builder checks them against it by pictures.

**⚑ 4. Frame P5b, states, second part** ([light](../mockups/december/png/14-P5b-states-and-messy-light.png), [dark](../mockups/december/png/14-P5b-states-and-messy-dark.png)).
Its "change waiting" line and "15 waiting" are overtaken (tfn-2). The six weapons are ⚑ 8. Still open: three rings and "+2" on a phone, "Can't cast" worked out by the app, the form switch by the level block, 999 hit points as one bar, five saves across on a phone, no saves or scores.
- A. Approve those parts as drawn.
- B. Approve from pictures of the built screen instead.
- **Recommend A.** Most are built to it already (C2, C3, C11); pictures follow in the fix pull requests.

### Brief items 2, 5, 4, 7

**⚑ 5. When the pinned spell is built.** Ruled and drawn (euf-6, M4g); the data is on main (`livePins`); no plan row, no code. euf-6 says "with the screen half of magic". The Magic tab exists (dec-8); whether that counts as magic's screen half I did not settle.
- A. Spec it now, as its own small loop (about 1 builder turn).
- B. Wait for a later magic piece.
- **Recommend A.** It is small, ruled and drawn.

**⚑ 6. The pin star on a spell's sheet.** The Magic tab's approved frame (magic/04) draws no star. Every other sheet has it beside ✕ (the Pin star, 06).
- A. The same star beside ✕, approved from a picture of the built sheet.
- B. Draw a frame first (the Magic tab's spell sheet with the star).
- **Recommend A.** The standard exists; nothing new to design.

**⚑ 7. "Down" at 0 hit points.** P5 draws "⚠ Down" under the bar. Built: only the toast says "Down", and only where the rules set a figure for it (`death.at`).
- A. Show "⚠ Down" under the bar where the rules set it; nothing where they don't.
- B. Always at 0.
- C. Toast only, as built.
- **Recommend A.** The app never guesses a rule it hasn't been given.

**⚑ 8. Several weapons ready.** Built: a block for each weapon whose action is Attack (in hand or worn ready), so six ready weapons make six blocks. P5b draws one block and the others as At hand rows with Wield.
- A. A block each, as built.
- B. A block only for what is in hand (two hands, two blocks); the rest are rows.
- **Recommend B.** Blocks mean "this is what you're fighting with"; six of them push At hand off the screen. Cost: about 1 turn.

**⚑ 9. Details' merged lines.** P1 draws "Background: Drover. Lawful." and puts manner inside Looks. Built: one line per thing, in the sheet's order.
- A. One line each, as built.
- B. Merge as P1 draws.
- **Recommend A.** No rule says which things pair; P3 (⚑ 1) draws them apart too.

**⚑ 10. Icons for Fire, Drink, Eat and Stance.** They carry the generic mark (sb-2). The Studio suggested `bread` (Eat) and `drink-me` (Drink), not ruled.
- A. Pick from a small icon page.
- B. Keep the generic mark.
- **Recommend A.** Frame to draw: one icon page like page 20's IC1, two or three candidates each, at 20 px, light and dark.

**⚑ 11. The weapon block's edge.** P1 draws 2 px; built 1.5 px (`--line-control`, every control's edge). The only 2 px token is the Selected wash's edge.
- A. 1.5 px, as built.
- B. 2 px, with a new token.
- **Recommend A.** Reusing the "selected" edge would make the block look selected.

**⚑ 12. Armour mode's load card.** Its top line still says "Move N", which repeats the speed tile (C10's ⚑, kept by dec-14).
- A. Leave it.
- B. Drop "Move N" there, as for slot bands (of-6); approved from a picture of the built card.
- **Recommend B.** The speed is said once.

### From #154 (row 3, built, in review; frame [38-3](../mockups/december/png/38-3-long-name-tablet-upright-light.png); the built pictures are listed in the pull request's text)

**⚑ 13. A comma after the name in the head's line.** 38-3 draws "…called the Unbowed, the Bog folk, Warden". Built without it, as the sideways bar reads (P1, ps-5).
- A. No comma, as built and as P1.
- B. A comma, in the head and the bar alike.
- **Recommend A.** ps-5 is his own words: name, "the" kindred, title.

**⚑ 14. The same on a phone?** Not drawn: on a phone a long name stays cut in the bar.
- A. Leave the phone as built.
- B. The same rule on a phone (the cut name leaves the bar and leads the head's line).
- **Recommend B**, after a frame is drawn: 38-3 at 375 px, light and dark. #154 can merge as it is meanwhile.

**⚑ 15. The same in the GM's view as the player?** The bar's title takes the focus as the view opens, so it was left as built.
- A. Leave it.
- B. The same rule there.
- **Recommend A.** The GM knows whose view it is, and the focus needs a place to land.

### Added: open on the Player screen, missing from the brief

**⚑ 16. The light's place in At hand.** Built: the items, then the light, then pins (C9). P1 draws the lantern between the bow and the wand; built, a charged wand sits above it.
- A. As built.
- B. The light first in At hand.
- **Recommend A.** Easy to find at the end; no rebuild of the Pack's list.

**⚑ 17. A lit lantern with charges shows twice.** When the lit light is itself At hand and has charges, its row stays (with Use) beside the light's ring (C9; checked in `PackScreen.tsx`).
- A. As built.
- B. One row: the light's ring, with Use moved onto it.
- **Recommend B**, if it happens at the table; it needs a frame (the light block with a Use button). Otherwise A.

**Not asked: ⚑ 28 (page 28), a block's short line.** It waits on pack question E7.

## What I checked, and what I didn't

- Each item read against the rulings files, both plans, 09, 10, the mockup index and the code (`PackScreen.tsx`, `LightSection.tsx`, `hp.ts`, `weaponModes.ts`, `ItemAction.tsx`, `tokens.css`, `WeaponInHand.css`).
- Not checked: the built screen against P5b part by part (⚑ 4); whether dec-8 counts as "magic's screen half" (⚑ 5); page 25 (M1) itself, which is not in the mockup index here; the pictures for #154 (in Drive, not the repository).
- No new mockup; no colour-only distinction is asked, so no greyscale strip.

## After the sitting

Docs to update: the rulings file this sheet becomes (status absorbed or superseded); 05 (At hand, the hit points box, Details); 06 (Weapon in hand, Light section, Pin star, Details ledger); `docs/09-decisions-log.md`; `docs/10-open-questions.md` if anything is parked.

Its 09 line, shaped: `2026-11-27 — [ui] The Player screen's open ⚑ (frames P3 to P5b, the pinned spell, Down, the weapon blocks, …) ruled: … — Francis, "…" — design/rulings/player-sitting-sheet-2026-11-27.md`
