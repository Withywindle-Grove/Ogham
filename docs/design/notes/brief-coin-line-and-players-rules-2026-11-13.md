# Brief for the Design Studio: the coin line, and where a player finds a place's rules (2026-11-13)

From the lead. Read this first; start from this file and the files it names, not from history. Mockups and proposal notes only: you report to the lead, never ask Francis for a ruling, never edit rulings, 09 or specs, and start no workers. **If unsure, stop and ask the lead; don't guess.**

## Why
Three pieces are being built this week whose screens have no picture Francis has approved (mockups first, ruled 2026-11-12). The builders have stopped before those screens. Your pictures are what lets them go on.

## What to draw, in this order

### 1. The purse on the Pack tab (plan `docs/plans/dec-6-purse.md`, piece c)
The frames drawn in dashes on `docs/design/mockups/pack/` pages 01 to 04 were proposals. Redraw them **solid, on the swept Pack tab** (the finals of `pack/png/05-PA*` and `06-PB*`, rulings psw-1 to psw-7 in `docs/design/rulings/dec-pack-and-rules-sweeps-2026-11-13.md`), with the words of the plan's "Words" section exactly.

- The coin line: with three denominations; with none ("No coin"); with five denominations and long coin names; with 0 and 999 of a coin; at 375 px.
- Its small sheet: "<Name>'s coin", Spend… and Give to…, the amounts by denomination, buttons that name the amount ("Spend 2 herons"), the refusal ("<Name> has 30 herons.").
- The party stash's Coin fact and its Take.
- Coin as a row in a hoard handed out from a place, and the find card naming coin.
- The GM's view: giving coin to a character and taking it.
- A hireling's purse as its employer sees it.
- What another player sees: nothing (draw the Pack tab of a character whose purse they may not read: no line, no gap).

Coin names are invented ("crowns, herons, bits"). Coin weighs nothing; no change-making between coins; nothing charges by itself.

### 2. Where a player finds a place's rules that have no button
Ruled: `docs/design/rulings/dec-place-rules-for-players-2026-11-13.md` (rp-1 to rp-6), with mc-39b, mc-51 and pf-12d. A rule with an action has its icon button (set 1: `01-08j-action-rule-sheet`, `01-04c`). A rule **without** one has no home on the players' page yet. Propose it, twice:

- on the players' redesigned page (set 1's `01-08-players-ways` and its siblings);
- on today's built place card, since the piece ships there first (ask the lead for the pictures of the built screen; they are being taken).

States: no rule open to players; one; many; a long rule name; a rule that came from a wider region the players were never shown, which appears under the shown place's name (rp-4); the phone.

### 3. A rule the GM closes while a player has it open
One small proposal, with words: what a player's rule sheet shows when the GM closes that rule while the sheet is open, and what a rule's button does once its rule is closed. Give your pick and one alternative.

## Format
One HTML file per proposal (`docs/design/mockups/pack/` for 1, `docs/design/mockups/december/` for 2 and 3), light and dark side by side on the same page, buttons as plain blocks, tokens from `docs/06-screens-and-design.md` only, the standards ds-1 to ds-12 and the sweep's dress (cs-30). Pictures as PNG under `png/`, each with its row in `docs/design/mockups/index.md`. Branch `design-december-mockups`.

Run the self-review before you send anything (Nielsen's ten; every state; contrast; 44 px targets with 8 px between; 375 px; messy data; no disabled buttons; Undo over confirm; one accent button a screen) and say what you checked and what you could not.

## Boundaries
- The PC is short of memory today: render one page at a time, close the browser between pages, and stop if a render fails for memory; tell the lead.
- Draw only what is listed. A new idea goes in your note as a line, not as a frame.
- Report to the lead with: the pictures' paths on the branch, your self-review, your picks, and every question.
