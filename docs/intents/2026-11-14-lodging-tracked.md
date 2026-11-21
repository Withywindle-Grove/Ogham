# Intent: lodging is tracked

Author: Francis (written down by the lead, in his words where quoted) · Date: 2026-11-14 · Status: draft

## Problem
On the Scene's town frame the Studio drew a "Lodging" fact ("Eel and Lantern, paid to tomorrow"). The Builder read the code: the app does not record where the party is lodged or until when it is paid, so the lead dropped the fact as invented. Francis, on hearing it: "We very much need to track lodging, players decide it on the settlement page and if nothing is selected when time advances we'll need to prompt them."

Who feels it: the GM, who today has to remember who is sleeping where and what it costs; and the players, whose pick of a lodging is a request that is answered and then forgotten.

Later the same morning: "Oftentimes players will choose the same lodging again and again so remember preferences and plug it into the pouch/expenses mechanics we designed. Players can have their own lodging [or] common party lodging. Much like clicking on a shop players can click on an inn or place offering lodging to engage that service. Pretty sure we did an early design session on this topic that needs updating."

## The earlier design session (found; to be updated, not replaced)
`docs/design/rulings/m7-downtime-2026-11-02.md`, planned for M7, after first play:
- dt-11: players choose from the town's lodgings with their rates; only "Somewhere else…" needs the GM's yes; a stay can be shared (the player names who else stays, up to a whole party in a rented cottage); a stay is a repeating spend under Due.
- dt-12: a rented room can include storage.
- dt-24: when the GM moves time by a day, a week or more, everything due multiplies, shown before the move and summed after.
- sf-2 (`m5b-settlements-followups-2026-11-04.md`): what heals overnight in town sits on the lodging, offered at the morning, never applied by itself.
What is new in Francis's words today: the app remembers a player's usual lodging and offers it again; a character with nothing chosen is asked when time advances; a lodging is engaged by tapping the place that offers it, as a shop is.

## What exists today
- The town's lodgings (name, rate, open, shown) are set by the GM on the place; players read the shown ones on the settlement page.
- A player's "Stay here" is a request between that player and the GM, answered by itself for a shown, open lodging. It is logged and undoable. It has no end, and only that player and the GM read it.
- The cost is text ("2 sp a night"): "costs stay text until purses". Purses now exist.
- An overnight summary is ruled (ST9: each morning a card with what healed and the lodging's cost) and not built.

## Outcome
The app knows, for the night to come, where each character is staying in a settlement. A player decides it on the settlement page. When time is advanced and someone has chosen nothing, they are asked. The GM sees at a glance who stays where and who has not chosen.

## Touches
- 05 (Settlements: Lodging, ST7; the overnight summary, ST9), 04 (a record of a stay), 03 (who may read it), 06 (the settlement page for players; the town's top on the Scene, where a Lodging fact can then say something true).
- The Scene's top (page 16, frames T4 and T5): the fact returns once the data exists.
- Purses (dec-6): whether a night's cost is spent from a purse.
- Camp and overnight healing in town (the parked sl- rulings).

## Constraints
- Hidden means hidden: who may read where another character stays is a ruling (today only that player and the GM).
- Everything through commands; everything logged; Undo over confirm.
- Rules-agnostic: rates and what a lodging gives come from the pack or the GM's town, never from the app.
- Mockups first: nothing visible is built without an approved drawing.

## Out of scope
What a lodging does to healing or statuses beyond what is already ruled; hirelings' lodging; a stable for mounts.

## Open questions
- Answered 2026-11-14: each character may have their own lodging, or the party a common one (dt-11's shared stay).
- Answered 2026-11-14: the cost goes through the purse and its Due list (a repeating spend), as designed.
- ⚑ What "when time advances" means here: each part of the day, or the step into night.
- ⚑ Who is asked: the player, with the GM seeing it in "Waiting for you", or the GM for everyone.
- ⚑ Whether a night's cost is taken from the purse, and if so when (at the pick, each night, at leaving).
- ⚑ Until when a stay lasts: this night, or until the character leaves or picks another.
- ⚑ Whether other players see where a character stays.
- ⚑ Before 5 December, or after.

## Links (filled in later)
Ruling: — · Plan: — · Pull request: — · Status report: —
