# Plan: the Player tab's pop-ups on a tablet, centred and wider (fb-7)

Written by the designer on 2026-11-20 from the driver's brief. Francis, on the live Player tab: "i like the centered popup i think that should be standard and we can make it at least 50% wider"; "keep it centered".

Rulings: fb7-1 to fb7-8, with what the app does today and the measurements, in [`../design/rulings/dec-player-popups-centred-2026-11-20.md`](../design/rulings/dec-player-popups-centred-2026-11-20.md). It belongs with section Q of `test-feedback-2026-11-19.md` (Francis's tablet feedback, fb-1 to fb-6), which is on pull request #1110 and not on `main` yet; this row has its own file so the two don't collide.

**Ready for a builder once this plan is on `main`.** Francis approved page 31 on 2026-11-20 ("Approve") with the designer's pick on each ⚑, then changed the short pop-ups to fit to content ("Agreed"): fb7-3 to fb7-8.

## The row

| # | From | What it builds | Ruling, or his words | Mockup, approved | Size |
|---|---|---|---|---|---|
| fb-7 | Francis, 2026-11-20 | **On the Player tab, on a tablet either way up (700 px and over), every pop-up opens centred on the screen and fits its content.** A Sheet there is no longer placed beside the button that opened it: from either column, from a row's words or its chevron, from the keyboard, and from inside another pop-up, it sits in the middle, across and down, the page dimmed behind it. **Its width fits what it holds: 440 px at least, 720 px at most** (fb7-3, fb7-4), never wider than the screen less its margins; a long one's lines wrap at 720. Hit points and Max hit points keep their own fitted width and are centred (fb7-5). A pop-up taller than the screen stops at the margins and scrolls inside, as today. **Under 700 px nothing changes:** the sheet comes up from the bottom. The Log and Messages panels, the tables at the page's width, the picture pop-up and the side panel keep their own sizes. The other screens are not touched (fb7-7: the sweep) | fb7-1 to fb7-6 | Page 31, frames FB7b to FB7g, **approved by Francis 2026-11-20** as drawn: `docs/design/mockups/december/png/31-*.png`; source `december/31-fb7-player-tab-pop-ups-centred-and-wider.html` on the branch `design-fb7-popups-studio`. **For the widths, frame FB7h**, drawn to fb7-4 after the approval and not yet seen by him: where FB7b, FB7d, FB7f or FB7g draw a short pop-up at 720 px, the rule and FB7h win | M |

## Rules for the builder

- Read `Dialog.tsx` first (`SheetScope`, `anchorNow`, `sheetPlace`, the placing effect) and say in the pull request's text how the Player tab is told apart: a scope the tab sets is the expected way, as `BookPopUpScope` is set there today. The placing code stays for the screens that still use it (fb7-7).
- One change in the part, none in its callers: no pop-up on the tab is moved by hand.
- The two widths are named tokens, `--popup-width-min` (440 px) and `--popup-width-max` (720 px), in `tokens.css` as 06 names them; `.dialog` and `.dialog--wide` use them in place of the bare numbers.
- **Fit to content**: the card is as wide as its longest line, held between the two tokens, as the Hit points pop-up is fitted today (`PlayerScreen.css`, `.dialog:has(> .hp__keypad--fit)`). The pull request's text lists the width each pop-up of FB7h comes to on the built screen, beside FB7h's own (720, 708, 597, 480, 440). A pop-up must not change width while it is open because a row was tapped or a line was added: if one does, stop and write a scope check.
- A pop-up opened from inside another on this tab is centred too; `SheetScope.Provider value={false}` wrappers on the tab are checked, not copied (CLAUDE.md, "Things Claude gets wrong", the last line).
- If centring would change anything else a person sees (a pop-up's own layout at the new width, a button that wraps differently, a table that looks wrong wide), stop and write a scope check: page 31 draws the kinds in FB7d, and anything not drawn there is not approved.
- The pull request's text shows the built screen beside FB7b, FB7h and FB7g, taken at 1180 × 820, 1024 × 768, 820 px upright and 375 px. FB7h is shown to Francis there, since he has not seen it.

## Files and tests

Read on 2026-11-20 on `main`. Each test is written first as a plain sentence.

| Files it will touch | Tests it must add |
|---|---|
| `src/ui/Dialog.tsx`, `src/ui/Dialog.css`, `src/ui/tokens.css`; `src/app/PlayerScreen.tsx` (the scope); `src/app/PlayerScreen.css` only if the fitted Hit points rule needs it; `docs/06` (the Sheet row, the tokens, the Code column) | On a tablet, a pop-up opened on the Player tab from the left column, from the right column, from a row's words, from its chevron, from the keyboard and from inside another pop-up has its middle at the screen's middle, across and down (± 1 px). A pop-up that holds little is 440 px wide; one with a long line is 720 px and its lines wrap; one in between is as wide as its longest line; none is under 440 or over 720 but Hit points and Max hit points, which are no wider than their content and centred. A pop-up's width does not change when a row in it is tapped. At 1024 px and at 820 px upright it keeps the screen's margins. Under 700 px the sheet is at the bottom, the screen's width, as before. On a screen outside the tab's scope a Sheet is still placed beside its button |

**Committed tests that will change** (the builder names each in the pull request's text): `tests/layout/player-popups.spec.ts` (purpose 4, the Hit points pop-up on a tablet), `tests/layout/player-at-hand-popup.spec.ts`, `tests/layout/figure-popups-tf.spec.ts`, `tests/layout/book-popups-tf.spec.ts`, and any gallery picture that shows a Player tab pop-up at a tablet's width (announced redraws). `src/ui/sheet.test.tsx`, `src/ui/sheetFit.test.ts` and `tests/layout/sheetSteady.spec.ts` are creation's and should not change (fb7-7).

**Who touches what.** `Dialog.tsx` and `Dialog.css` are shared by every screen: no other open row should be in them at the same time. `PlayerScreen.css` is also in #1113 (the play column's borders and scroll bar): after it.

## ⚑

None open. The six the sitting collected were ruled on 2026-11-20 (fb7-3 to fb7-8, in the rulings file): 720 px at most; fit to content from 440 px; Hit points keeps its fitted width; the upright tablet follows; the other screens and a long pop-up's heading go to the sweep (`app-sweep.md`, S-24 and S-25).

## Estimate

One to two builder turns: the part and its tokens, then the layout checks at three widths and the committed checks that change. The other screens are the sweep's (S-24).

## Honest notes

- Why his iPad centres some taps today was not reproduced; the fix does not depend on it.
- Fit to content gives a spread of widths (FB7h: 440, 480, 597, 708, 720). If it reads as untidy once built, that is a question for Francis (steps instead of any width), not a builder's change.
- The on-screen keyboard over a centred pop-up with a field (Notes, Hit points) is not measured on a device: the builder checks it on the preview and Francis on his iPad at the gate.
