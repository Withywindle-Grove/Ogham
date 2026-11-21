# Intent: the sideways-tablet layout grows on a wide window

Author: Francis · Date: 2026-11-19 · Status: accepted (ruled Later, in the sweep)

## Problem
On a laptop or a PC the app is a narrow column in the middle of a wide window. Francis, 19 Nov, after a picture of the GM's Scene as a centred tablet-width column on a 2000 px window:

> "all i want is landscape tablet view, but with an exandable width so that it can fill some of the blank space. nothing extra in the layout itself."

## Outcome
On a window wider than a sideways tablet, the same layout widens to fill some of the blank space. No new column, panel or part.

## Touches
Layout only: the page's widest-width token and each screen's column rules (06). No data, permissions or events.

## Constraints
- Mockups first: he approves a picture (one per screen family at about 1600 and 2000 px) before anything is built.
- Tablet first, phone supported (`01-product-brief.md`): nothing changes at those widths.

## Out of scope
Anything extra in the layout itself: no new column, panel or part for wide windows.

## Scope check and ruling

> **Scope check — the sideways-tablet layout grows on a wide window**
> **What:** on a window wider than a sideways tablet, the same layout widens to fill some of the blank space; no new column, panel or part.
> **Now:** goes in the December screens' sweep · cost about 1 day of design plus 1 to 2 days of build · pushes back nothing on the Player screen's path to live if done after it · chance of redoing work low.
> **Later:** goes in the one app sweep after the December mockups · cost then the same · what we lose by waiting: a GM on a PC keeps seeing a narrow centred column.
> **Signals:** screen or layout only → usually fine later; rare at the table.
> **Recommendation:** Later, in the sweep, but drawn early so the Player screen and the Scene are not rebuilt twice.
> **Options:** A Now · B Later (the sweep) · C R2 · D Drop

**Ruled 2026-11-19, Francis: "b"** (Later: the one app sweep after the December mockups).

## Open questions
- ⚑ How wide at most (a cap, or the whole window)? "fill some of the blank space" suggests a cap.
- ⚑ Which columns grow: all in proportion, or only the main one with the side column fixed?
- ⚑ Which screens: the GM's Scene, the Player screen, the town, the Pack, or every screen at once?
- ⚑ Does a paragraph's line length stay capped inside a wider column?
- ⚑ The shared table view: the same rule or its own?

## Links (filled in later)
Ruling: `09-decisions-log.md`, 2026-11-19 (Scope) · Plan: — · Pull request: — · Status report: —
