# M5 gate fixes (technical)

The live M5 gate (2026-11-01) found three bugs that need no design: the hand-off's D2–D4. Francis asked for the technical items to go ahead while the designer reviews the rest (2026-11-01). This plan was written by the builder session; these are technical-only fixes, which Francis rules on directly (CLAUDE.md, Scope checks). No behaviour or screen changes beyond the fixes. The sign-out bug (D1) gets its own pull request.

## What to build
1. **Check now stacks (gate item 4).** Each tap of the hour track's M marker, or of ⋯ → Check now, adds the wandering check to the card again: `mergeCard` raises its count (×2, ×3…). It also shows no toast, so Undo does nothing.
   - Fix: when the check's line is already on the card, Check now doesn't add it again. Instead, the toast says it's already there (e.g. "The wandering check is already on the card").
   - Otherwise, Check now puts it on the card and shows a toast with Undo, which takes that line off again.
   - Keep the wording otherwise as it is: "Check now" will be renamed in the design pass (hand-off B12).
2. **Pop-ups cut off on the iPad Player screen (gate items 7, 8).** In landscape, the status picker (+ status) and a skill's detail pop-up open inside the left column and are cut off by it. Make both open over the whole screen, using the existing pop-up component (06, Components: no new component). Don't change their contents: the status picker gets a design pass (B6).
3. **Campaign setup scroll (gate item 1).** After choosing a pack, the optional rules step opens scrolled to the bottom. Each step should start at the top.

## Tests (purpose first)
- "Tapping Check now twice leaves one wandering check on the card, not ×2."
- "Check now's toast Undo takes the check off the card."
- Layout (webkit, 1024 × 768 landscape): "the status picker and a skill's details fit on screen on the Player screen, nothing clipped by the column." Add the scene to `tests/layout/layout.spec.ts`.
- "Moving to the optional rules step starts at the top of the page."

## Docs
- The 06 Code column, if a component's use changes.
- The manual checklist in `docs/testing.md`: three lines under M5 (gate fixes).

## Estimate
About 15 turns on Opus. No migrations.

## Departures
- **Item 2 is fixed in the pop-up component, so it covers every pop-up.** `Dialog` now opens on the page body (a React portal) instead of inside the screen part that opened it. That's the one place pop-ups are built, so every pop-up gets it, not only + Status and the skill details. Nothing in them changes. The full unit and layout suites pass; CI's gallery pictures are the check that nothing looks different.
- **The layout scene can't show the iPad bug itself.** Desktop WebKit (what Playwright runs) already drew both pop-ups whole before the fix; it was Safari on the iPad that clipped them. So the scene checks that each pop-up is centred, on screen and uncovered, and that it isn't inside the Player column. That last check fails without the fix. A look on the real iPad is still the proof (manual checklist).
- **The layout harness has a `?skills=1` switch.** It gives Wren a class with two skills, for this scene only. It's off by default so the gallery's pictures of Wren don't change.
- **Toast words.** Added: "Wandering check on the card" (or "N wandering checks on the card" after a split). Already there: "The wandering check is already on the card" (or "checks are", after a split). Undo is local: Check now writes nothing to the log until Hit or Miss is tapped. The words may change in the design pass (B12).
