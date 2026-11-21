# Intent: the Rules library and campaign set-up, tidied

Author: Francis (written down by the design agent from his testing notes) · Date: 2026-11-01 · Status: done (ruled 2026-11-02)

## Problem
- **Rules library** is one flat list. It should be organised by pack type, with sort and filter; Browse / Update / Delete as the actions rather than what's there now. "About this time" tells a GM nothing: show what the pack contains and how to use it. "Edit pack" shows on one pack (a homebrew-kind overlay) and not the others — why not every pack?
- **Campaign creation — Setting rules step**: needs a collapsible list or at least a filter by type.
- **Campaign creation — Optional rules (step 3)**: collapse by source; the "All defaults" explanation is unnecessary; put the source and page in each description. Two packs ask about encumbrance: how do conflicts get resolved? (Found: the overlay's options lack the `ruleKey` that would group them — a pack fix; the design already says one group, one pick.)
- **Scene — Advance time**: before a campaign's time is first set, the control should read "Set time".
- **GM landscape menu**: no "Fold the menu" words and no button in the column; something like tapping the divider line — propose a few options.

## Outcome
A GM finds a pack by type, sees at a glance what it holds, and sets up a campaign without reading boilerplate; the Scene's first time control says what it does; the landscape menu folds without a labelled button.

## Touches
05 (Rules library, Campaign creation, Rules for this campaign), 06 (library list, set-up steps, Scene time control, landscape layout), mockups for each.

## Constraints
Hard rule 7; the gate workflow (collected now, acted on after the creation rework unless Francis says otherwise).

## Out of scope
Character creation (its own intent). Pack format changes beyond `ruleKey` on the overlay.

## Open questions
- ~~⚑ Edit on every pack~~ Ruled 2026-11-01 (A): Edit pack stays for homebrew-kind packs only; other packs keep the per-entry Edit as homebrew.
- ~~⚑ The landscape menu fold~~ Ruled 2026-11-02 (lr-4): the divider is the handle.

## Links (filled in later)
Ruling: `../design/rulings/m5b-0d-library-and-campaign-rules-2026-11-02.md` · Plan: `../plans/m5b-0d-library-and-campaign-rules.md` · Pull request: — · Status report: —
