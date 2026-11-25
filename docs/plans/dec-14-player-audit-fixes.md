# Plan: the Player tab's audit fixes (page 38)

Written by a designer worker on 2026-11-24 (row plan-player-audit), from the driver's brief. Plan only: no code, no spec or ruling changed here.

It covers the nine findings of the `impeccable audit` of the built Player tab (2026-11-23), as drawn on page 38. The Player screen itself is `docs/plans/dec-13-the-player-screen.md` (built); this plan repairs it and adds nothing.

**Status: approved 2026-11-24 with Francis's answers ("Ruled 2026-11-24" below).** Rows 1 to 6, 7b, 8 and 9 are ready once this plan and the mockup's pull request (#58) are on `main`. Row 7a is ready too: Francis approved A2 as drawn (⚑ 5, ruled 2026-11-24).

## How it is built
- **Mockups first.** The pictures of record: `docs/design/mockups/december/38-player-tab-audit-fixes.html` and its `png/38-*.png`, on branch `mock-player-audit-fixes` at 52319db (pull request #58, not on `main` when this was written). **Approved 2026-11-24, with fixes** (critique 7, critique 4, dark frames for 1 and 7); finding 8 **ruled 8a** the same day (the load tile keeps the lone warning sign; "Can't move" only on the speed tile). A builder branches only after #58 and this plan are merged.
- **The numbers are page 38's** (1 to 9). The audit's own text was not saved; the page says how its numbers were rebuilt.
- **Each frame is the built screen with the fix laid over it.** The overlay's CSS (the picture script's `:has()` selectors and `!important`) is evidence of what the fix looks like, never the way to build it: build it in the part's own stylesheet, tokens only.
- **Parts are changed, never copied.** Where a fix sits in a part other screens use, the row says how far it reaches. Page 38 draws the Player tab only, so nothing changes on another screen unless the row says so.
- **Test characters** (the layout page, all invented): `layout.html?as=player&p1=1` (Brannoch Fenward, "The Storm Lantern Road"), `p1=messy` (the long name, nine statuses), `p1=heavy` (over the most he can carry), `p1=modes` (two-button rows and the long weapon names).
- **Every row's pull request** shows its built screen beside the page 38 frame, and brings the Code column of `docs/06-screens-and-design.md` (Components) up to date (see "The Components inventory").
- **Tests.** Each batch adds its own layout spec file (named below), so batches never meet in one spec. Each test's purpose is the plain sentence given in the row.

## The rows
Sizes are a designer's guess read against `main` (eedbd1b) on 2026-11-24, in builder turns low / likely / high.

| Row | What changes | Frame (page 38; approved 2026-11-24) | Files | Tests (purpose) | States and 375 px | Size | State |
|---|---|---|---|---|---|---|---|
| 1 | **The rail's tabs and the handle.** On a tablet held sideways (1024 px and wider) the folded rail's tabs are 44 px wide (40 today) and 8 px apart (4 today); the handle's tap area sits 8 px clear of the rail (0 today), so the left column moves 12 px to the right. The handle is drawn as a grip: a 24 by 44 px lozenge on the line (Surface fill, a 1.5 px Control edge), the arrow inside it in Ink at 16 px, in place of the 6 px bar and the 14 px arrow. Held upright (600 to 1023 px) the tabs in their row are 8 px apart (4 today). | 38-1: `38-1-rail-and-handle-tablet-light.png`, `-dark.png`, `38-1-tabs-tablet-upright-light.png`; no change on `38-1-tab-bar-phone-light.png` | `src/ui/SectionNav.css`, `src/ui/DividerHandle.css` (and `.tsx` if the arrow moves inside the pill), `src/app/PlayerScreen.css` (`.player__side` only) | Folded and open, each rail tab is at least 44 px wide and 8 px from the next. The handle's tap area is 8 px or more from the nearest tab. The grip's edge is 3 to 1 or better against the page in light and in dark. The phone's tab bar and a phone on its side keep their tabs touching, unchanged. The keyboard's focus ring still goes round the grip. | Open and folded; light and dark; a caster's four tabs; upright; 375 px (no change: assert it); a phone on its side (the 600 to 1023 px, short, bar: no gap added) | 1 / 1.5 / 2.5 | **Ready**: the shared parts change for every screen that places them (ruled 7a); the GM's campaign screen is approved from pictures of the real screen after the build |
| 2 | **Two tight gaps.** With a long weapon name the weapon in hand's buttons wrap under the words 8 px below them (4 today). The ⓘ beside "Abilities and traits" sits 8 px above the first pinned trait (4 today). | 38-2: `38-2-weapon-in-hand-tablet-light.png`, `38-2-pinned-traits-tablet-light.png` | `src/app/WeaponInHand.css` (`.weapon-in-hand__top`); `src/app/PlayerScreen.css` (the right column's section that has a heading row with ⓘ) | With a long weapon name the buttons are 8 px or more under the words. The ⓘ is 8 px or more above the first pinned box. With a short name nothing moves. | A short and a long weapon name (`p1=modes`); no pins, one pin, several; 375 px; Larger text | 0.3 / 0.5 / 1 | **Ready** |
| 3 | **A long name no longer squeezes the way back.** Held upright, the way back keeps at least four targets' width (176 px), so it keeps its words; the head's line carries the full name, wrapping, before "the" kindred and the title. "No notices" keeps its place under the line. Held sideways: no change. Ruled 2026-11-24: the floor holds on every screen with the standard top row, and the cut name leaves the bar so the name shows once (*driver's reading of "2,8 every screen"*). | 38-3: `38-3-long-name-tablet-upright-light.png`; no change on `38-3-long-name-tablet-light.png` | `src/app/TopRow.css` (`.top-row--standard`; every screen that uses it), `src/app/TopRow.tsx` (the bar's cut name), `src/app/player/PlayerHead.tsx`, `src/app/PlayerScreen.css` (the head) | Upright, with the long name the way back is 176 px or wider and shows its words. The head's line shows the whole name, uncut. Sideways nothing changes. Every other screen with the standard top row keeps its way back at 176 px or wider. The name shows once. | `p1=messy` and a short name; upright and sideways; a phone is **not drawn**; each other screen with the standard top row (pictured in the pull request) | 1 / 1.5 / 2.5 (the reach may add) | **Ready** |
| 4 | **"Use" off the heading's rule.** In the right column, "Abilities and traits" takes At hand's double rule and its first row starts 8 px below it (today the first row's "Use" starts 5 px under the heading, its top edge on the rule). As the frames draw it: the double rule only where a plain row comes first (38-4); with pinned boxes first the heading is as 38-2, no rule added. | 38-4: `38-4-use-on-the-rule-tablet-light.png` | `src/app/PlayerScreen.css` (scoped to the right column; `.row-list` itself in `src/ui/parts.css` is not changed) | The first row's button starts 8 px or more below the heading's rule. Scores, Saves and Movement keep bare headings. | A trait with Use first; a trait with no button first; pinned boxes first; no traits at all; 375 px (one column); dark (not drawn: picture it) | 0.3 / 0.5 / 1 | **Ready** |
| 5 | **The left column says more lies beyond.** Held sideways, where the left column scrolls by itself, a 32 px fade on an edge only while something is cut there, as page 38 draws it (ruled 2026-11-24: built at its cost). Known risk (critique 2): the fade dims "Refill" at the foot; the builder checks its contrast and reports it. | 38-5: `38-5-left-column-edge-tablet-light.png`; 38-A at the foot | `src/app/PlayerScreen.css`, `src/app/PlayerScreen.tsx` (the column must know whether it is scrolled: new logic) | No fade when the column fits. A fade at the foot only when more lies below; at the top only when scrolled. The fade never catches a tap. | Fits; cut below; cut both; cut above only; dark (not drawn); one column (no fade) | 1 / 2 / 3 | **Ready** |
| 6 | **Two buttons on a row, on a phone.** On a row of At hand with two buttons, the words take the full width (343 px at 375) and the two buttons sit under them, to the right. One-button rows keep the button beside the name. A tablet: no change. Ruled 2026-11-24: at every text size on a phone, and the Pack tab's rows (the same row part) too. | 38-6: `38-6-two-buttons-larger-text-phone-light.png`; no change on `38-6-two-buttons-tablet-light.png` | `src/app/PackScreen.css` (`.pack__row`), perhaps `src/app/ItemRow.tsx` (a named variant, so the row knows it has two buttons) | On a phone a two-button row's name has the full width and its buttons sit under it. A one-button row is unchanged. No sideways scroll at 375 px. A tablet is unchanged. | `p1=modes`; standard and Larger text; the longest name; 375 px; the Pack tab's own rows | 0.7 / 1 / 2 | **Ready** |
| 7a | **The armour class tile's line in whole words (A2).** "AC +1 from NIM" becomes the score's full name from the setting, then its figure: "Nimbleness +1". When the score adds nothing there is no line. Approved 2026-11-24 ("approve A2 as drawn, no line for zero"). | Page 39 (`docs/design/mockups/december/39-armour-class-tile-both-ways.html`), frames 39-4 to 39-6: `39-4-three-ways-tablet-light.png`, `-dark.png`, `39-5-three-ways-phone-light.png`, `39-6-three-ways-phone-larger-text-light.png`; approved 2026-11-24. Draw A2 only; A and B are not chosen | `src/app/player/PlayerVitals.tsx`, `src/modules/characters/explain.ts` (`acCaption`) | The line names the score in full (the setting's own long name) and never "AC" or "from". A score that adds nothing leaves no line. "Set by hand" is unchanged. A long name wraps and is never cut. | A score that adds something; one that adds nothing; a setting where lower is better; a long score name; the tile is 216 px wide on a tablet, 168 px on a phone, and at Larger text | 0.7 / 1 / 1.5 | **Ready** |
| 7b | **The attack tile's line in plain case.** "Melee +2, Missile +1" becomes "Melee +2, missile +1" (as frame P1 of december/14 already reads, dec-13 C15). | 38-7, the same two pictures | `src/modules/characters/play.ts` (the attack sub-line) or `PlayerVitals.tsx`, whichever keeps other screens' lines as they are | The attack tile's line has no capital after its first word. A setting with no such figures shows no line. | Melee only, missile only, both, neither; dark | 0.3 / 0.5 / 0.7 | **Held:** re-examined after 5 December (09, 24 Nov) |
| 8 | **Over the most he can carry (ruled 8a).** "Can't move" is said once, in the speed tile. The load tile keeps its warning sign, its full bar and its count, with no words beside the sign. Only on the Player tab's "speed said once" variant of the load bar (`speedOnce`), which is used only when the speed tile is there. | 38-8: `38-8-over-loaded-tablet-light.png` | `src/app/LoadSummary.tsx`, `src/app/PackScreen.css` (`.pack__tier`) | Over the most, with the speed tile there, the words show once on the screen. The sign still has a spoken name for a screen reader (the pack's own words, not new ones) and is still a 44 px target that opens the burden's levels. With no speed tile the load tile keeps its words. The Pack tab and the GM's overview are unchanged. | `p1=heavy`; under the most (unchanged); slot bands and armour mode (**not drawn: left as built**); 375 px; dark (not drawn: picture it) | 0.5 / 1 / 1.5 | **Ready** |
| 9 | **"Hit points" in the headings' hand.** The box's label takes the section headings' style (the book face's small capitals, their size), in place of the plain face, small and spaced out. On the Player tab only. | 38-9: `38-9-hit-points-heading-tablet-light.png` | `src/app/PlayerScreen.css` (beside the existing tile-label rule; `src/ui/HpBox.css` is not changed) | On the Player tab the label's face, size and case match a section heading's. Nothing is under 14 px. The hit points box elsewhere (the gallery, any other host of `HpInPlace`) is unchanged. | Light and dark; 375 px; Larger text; 0 and 999 hit points | 0.3 / 0.5 / 0.7 | **Ready** |

**In all:** ready 6.8 / 10 / 16.4 turns (rows 3 and 6 may grow with their reach); held none.

**Not drawn together.** Rows 2 and 4 both touch the "Abilities and traits" heading. The state with the ⓘ, pinned boxes and then a plain row with Use is on no frame: there the heading stays as built (as 38-2, no rule added), and the batch pictures it for Francis in its pull request.

## ⚑ For Francis
None open.

## Ruled 2026-11-24
Francis's answers, word for word, and what they mean here.

| ⚑ | His words | Ruling |
|---|---|---|
| 1 | "1, leave it" | The phone's tab bar keeps its tabs touching. No row. |
| 2 and 8 | "2,8 every screen" | The way back keeps its 176 px floor on every screen with the standard top row. The cut name leaves the bar (critique 6), so the name shows once: *driver's reading of "2,8 every screen"*, for Francis to correct. Row 3 is ready. |
| 3 | "3 every size pack included" | Fix 6 at every text size on a phone, and the Pack tab's rows too. Row 6 is ready. |
| 4 | "4, go with fade" | Row 5 is built as page 38 draws the fade, at its cost (1 to 3 turns). Known risk (critique 2): the fade dims "Refill"; the builder checks the contrast. Row 5 is ready. |
| 5 | "5, show me both", then "approve A2 as drawn, no line for zero" | Row 7a builds A2 (page 39, frames 39-4 to 39-6): the score's full name from the setting, "Nimbleness +1"; no line when it adds nothing. A and B are not chosen. Row 7a is ready. |
| 6 | (settled by 8a) | Nothing more. Slot bands and armour mode over the most stay as built (dec-13 C10's ⚑ still stands). |
| 7 | "7, a" | Row 1 changes `SectionNav` and `DividerHandle` for every screen that places them. The GM's campaign screen is approved from pictures of the real screen after the build. Row 1 is ready. |

## Batches
At most three rows a batch, one pull request each, a fresh worker per row.

| Batch | Rows | Files | Spec file | When |
|---|---|---|---|---|
| A | 2, 4, 9 | `PlayerScreen.css`, `WeaponInHand.css` | `tests/layout/playerAuditGaps.spec.ts` | First |
| B | 1 | `SectionNav.css`, `DividerHandle.css` / `.tsx`, `PlayerScreen.css` | `tests/layout/playerAuditRail.spec.ts` | After A merges (both edit `PlayerScreen.css`) |
| C | 8, 7b | `LoadSummary.tsx`, `PackScreen.css`, `play.ts`, `PlayerVitals.tsx` | `tests/layout/playerAuditWords.spec.ts`, plus unit tests beside each file | Side by side with A: no file shared (nor with B) |
| D | 3 | `TopRow.css`, `PlayerHead.tsx`, `PlayerScreen.css` | `tests/layout/playerAuditName.spec.ts` | After B |
| E | 5 | `PlayerScreen.css`, `PlayerScreen.tsx` | `tests/layout/playerAuditFade.spec.ts` | After B and D |
| F | 6, 7a | `PackScreen.css`, `ItemRow.tsx`, `PlayerVitals.tsx`, `explain.ts` | `tests/layout/playerAuditRows.spec.ts` | After C. Rows 6 and 7a touch `PlayerVitals.tsx`: one pull request. Side by side with D or E |

Every batch also edits `docs/06-screens-and-design.md` (one row or two of the inventory): the known place for a small merge conflict between batches in flight.

**Overlap with open work (2026-11-24).**
- **#50 (`k22-k2-screens-2`, not a draft)** changes `PlayerVitals.tsx`, `TopRow.css` and `.tsx`, `PackScreen.css`, `ItemRow.tsx`, `CharacterSheet.tsx`, `PlayerScreen.tsx` and `parts.css`: it meets batch C (rows 8, 7b) and rows 3, 5, 6 and 7a. Batch C is best started after #50 merges, or its builder merges `main` in before the final push.
- **#49 (`c15-g4-scene`, draft)** changes the same files except `parts.css`: the same rows.
- **#48 (`players-scene-p5-p10-p12`)** changes only `docs/06` and two layout specs of its own: the 06 conflict point, nothing else.
- **#51 (`scene-b14-pack-pictures`)** changes `src/ui/parts.tsx` and `docs/06`: no row here edits `parts.tsx`.
- **`fix-f8-tile-label-flake` and `-2`** are local branches with nothing committed beyond `main` when this was written, so there was nothing to compare. Their brief names `src/ui/parts.tsx` (the tile columns), which no row here edits. Row 9 changes a tile label's type on the Player tab: if the F8 fix measures labels, run its spec after batch A.
- Batches A and B meet no open pull request's files (06 apart).

## The Components inventory (Code column, `docs/06-screens-and-design.md`)
The builder edits these in the same pull request as the row.

| Row | Inventory row | Change |
|---|---|---|
| 1 | Divider handle (the row appears twice: both) | The description too: the grip (24 by 44, Surface fill, Control edge, the arrow inside in Ink, 16) replaces "a 6 × 44 pill … with a small triangle beside it"; the Code column names the 8 px clear of the rail (`.player__side`, and `.gm__side` if ⚑ 7 is a yes). |
| 1 | Tab bar | Code: the folded rail's 44 px tabs and the 8 px gap (`SectionNav.css`); the phone's bar unchanged. |
| 2 | Weapon in hand; Pinned block, Pinned row | Code: the 8 px row gap (`.weapon-in-hand__top`); the 8 px under the heading's ⓘ. |
| 3 | Top row; the row whose Code column names `PlayerHead` | Code: the way back's floor; the head's line carrying the name upright. Wording as ruled 2026-11-24 (2 and 8). |
| 4 | Sheet section | A named variant (the double rule under the heading, the Player tab's right column) and where it is switched on. |
| 5 | Player screen states | The fade and what switches it on. |
| 6 | The row whose Code column names `ItemRow` for At hand (and Stacked button, if its row changes) | A named variant: two buttons under the words, on a phone. |
| 7a, 7b | Stat tiles | The tile lines' words (`acCaption`, the attack sub-line). |
| 8 | Load bar | The "speed said once" variant: over the most, the sign alone with its spoken name. |
| 9 | HP box; Stat tiles | The label's heading style on the Player tab, and the rule's place. |

## Not in this plan
The phone's tab bar (ruled "leave it"). The rail's signs with no words (the critique's note under "Recognition"). Loading, error and offline states: no fix changes them. Dark frames for fixes 2 to 6, 8 and 9: each row pictures dark as built.

## Departures
The builder keeps this section current in the same pull request as the change.
