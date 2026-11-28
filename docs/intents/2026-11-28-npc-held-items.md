# Intent: items held by an NPC

Author: Francis · Date: 2026-11-28 · Status: draft (for the build loop's step 1, the design sitting)

## Problem
Found while bringing a setting pack up to date: a person in the pack format has no field for things, and the app has no screen for a pack's people. An item that a person carries (the Warden's lantern, the hermit's key) can only be written as a loose item or a link in the person's lead. Francis, 28 Nov 2026:

> "items on an NPC, not at a Location. They should be obtainable, but it's important that they move with and are attached to the NPC."

> "Npc holding an item is a common occurrence and will need to be modeled in the app. The packs can tell us what items are held by which npc but the rules and functionality is app-based."

## Outcome
An item can be held by an NPC. It moves with that NPC and stays attached to them, and the party can still obtain it. A pack says which NPC holds which item; what holding means and how the item is obtained are the app's rules.

## Touches
Data model (04), pack format for people (07), the screen for a pack's people (06), features (05). Gap row G-228 in `docs/11-modelling-gaps.md`.

## Constraints
- Rules and functions live in the app; the pack only names who holds what.
- Mockups first (CLAUDE.md): nothing visible is built before he approves a picture.
- Hard rules 2 and 3 apply: no game IP in examples, and every change is a command that writes an event.

## Out of scope
Nothing is decided beyond his words. How an item is obtained, what happens when the NPC is killed or moves, and any screen are for the design sitting.

## Open questions
- ⚑ How does the party obtain a held item (take, trade, steal, loot at death)?
- ⚑ What happens to the item when the NPC dies, leaves or is hidden from the players?
- ⚑ Who sees a held item: the GM only, or the table?
- ⚑ Does a held item still count as a Location's item, or only as the NPC's?

## Links (filled in later)
Ruling: — · Plan: — · Pull request: — · Status report: —
