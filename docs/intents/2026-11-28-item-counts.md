# Intent: item counts

Author: Francis · Date: 2026-11-28 · Status: draft (for the build loop's step 1, the design sitting)

## Problem
Found while bringing a setting pack up to date: a bottle with three portions is stored as `charges`; the screen says "charges" and "Use a charge"; and a setting can hide charge counts from the holder for every item at once (one switch), with no way for the GM to reveal one item's count. Francis, 28 Nov 2026:

> "An item should name what its count counts. The number of charges (portions in this case) should be revealable by the gm"

## Outcome
An item names what its count counts (portions, doses, arrows), and the screen uses that word. The GM can reveal one item's hidden count.

## Touches
Data model (04), pack format for items (07), the item screens and words (06), features (05). Gap rows G-233 and G-234 in `docs/11-modelling-gaps.md`.

## Constraints
- Mockups first (CLAUDE.md): nothing visible is built before he approves a picture.
- Hard rules 2 and 3 apply: no game IP in examples, and every change is a command that writes an event.

## Out of scope
Nothing is decided beyond his words. The unit word's source, the screen words, and how a reveal works and who sees it are for the design sitting.

## Open questions
- ⚑ Where does the unit word live (the item, its pack entry, or both), and what is the fallback?
- ⚑ Does a reveal cover one item for one holder, or for the whole table?
- ⚑ Does the setting's switch stay as the default, with a reveal as the exception?

## Links (filled in later)
Ruling: — · Plan: — · Pull request: — · Status report: —
