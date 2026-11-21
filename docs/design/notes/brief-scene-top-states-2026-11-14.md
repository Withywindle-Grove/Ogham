# Brief for the Design Studio: the Scene's top in every state, and homes for what the drawing drops

Written by the lead on 2026-11-14. You are a worker: mockups and a proposal note only; you report to the lead, never ask Francis for a ruling, never edit rulings, 09 or specs. If unsure, stop and ask the lead; don't guess.

## Why
Francis approved the whole Scene at a spot on 2026-11-12 (`02-the-turn.html`, frame R1, picture `02-01-scene-at-rest`). The place card is built, and he looked at it under today's old time strip and said: "Missing what we designed Thursday. No sequence of play strip and the entire top area" was to be reworked, space-efficient and relevant to play; then "Hold. Remember our rule about building once?". The Scene is now built whole, once, on the held branch. R1 draws one state: a turn, at a spot, with a session running. The builder cannot build the top from one state, and today's top has a dozen controls that R1 has no home for.

## Read first (in this order)
1. `docs/design/notes/scene-top-ruled-so-far-2026-11-14.md` (in the lead's worktree until it merges: `<home>\Documents\grimoire\.claude\worktrees\board\docs\design\notes\scene-top-ruled-so-far-2026-11-14.md`): every ruling in force for these parts, and the list "Not settled". Nothing you draw may contradict a ruling in it; where a proposal below seems to, say so before drawing.
2. Your own frames R1, R3 and R9 in `02-the-turn.html`, and pages 11 and 12 (the place page as approved, which leaves the facts row's place free).
3. Today's top as built, read only, on `origin/main`: the Scene's time strip and what it holds (the Builder lists them: Start and Resume session, Undo, "+ Reminder" and the reminders' icons, the hour track's pips, the "Encounter tables" row and "Tables", "No light", "Set date", "Set start time", "Started at…", "Travelling in darkness", "Leave the dungeon", "N waiting, Players", the ⋯ menu). List every part before you draw, as you did for the Player screen.

## The objective
One page that shows the Scene's top in every state the first night can reach, each dropped control in a home, drawn with the parts R1 already uses. A proposal: Francis rules it frame by frame.

## The lead's proposed homes (draw these; where you see a better one, draw it beside as a small alternative and say why)
| Today's control | Proposed home |
|---|---|
| Undo | The toast, as mc-57 rules. Nothing in the band |
| Start session / Resume session | In Next turn's own place in the band, as the one button there, while no session runs or it is paused (mc-24, B7). The band's heading says where the party is; no turn count while none runs |
| "+ Reminder" and the reminders' icons | A due reminder is a row in "Waiting for you". Adding one, and the list of those to come, is "Reminders" in ⋯ (a sheet with the list and "+ Reminder") |
| The hour track's pips | Dropped. Each fact's small line says when it next falls due ("In 4 turns", "4 turns left", "On every move") |
| The "Encounter tables" row and "Tables" | The place card's Tables card (built). A tap on the Encounter check fact opens the check, with "Which table?" inside it |
| "No light" | The Light fact's own state: the warning sign, "No light", a tap gives the rule |
| "Travelling in darkness" | Stays a ⋯ switch (a toggle); when on, the Light fact says so |
| "Set date", "Set start time" | The date line itself is the tap while either is unset ("Day 1. Set the date"); once set, changes go through ⋯, "Advance by…", as today |
| "Started at…" | Dropped from the band; it is in the log |
| "Leave the dungeon" | The last row of Move on's sheet when the pack's rule is on (Move on is every move, mc-21) |
| "N waiting, Players" | Dropped from the band: the Players tab already says it |
| The weather card | The Weather fact replaces it; a tap opens the weather sheet (each effect in plain words; the roll's entry for whoever rolls). When a roll is due it is a row in "Waiting for you" |

## Frames (tablet, landscape, light and dark side by side, unless said)
1. **A turn at a spot, everything quiet**: R1 as approved, redrawn only so the page stands alone. Mark it "approved 2026-11-12".
2. **The same, everything due at once**: rest due, no light, a reminder due, the weather to roll, an encounter waiting: where each lands (the facts' states; the rows in "Waiting for you"; which button is the accent, by mc-27).
3. **No session yet (a new campaign), and a paused one**: the band and what stands in Next turn's place; what the facts and the strip do.
4. **In town**: the band with the part of the day, the facts without Light (mc-69), the quiet step, Start expedition as the accent.
5. **Downtime**: the band and its step.
6. **The sheets this needs**: "Reminders" from ⋯; the date line's tap; the Weather fact's tap. One small frame each.
7. **A split party**: the Light and Rest facts with two groups.
8. **The GM's phone**: the band, the facts, the strip (icons only), Next turn.
9. **The players' top**, tablet and phone: what of the band and the facts they see (mc-39b: the Encounter check's fact as the GM sees it), paused, and before a place is shown (mc-50).
10. **The marching order**: R1 draws hit points under each circle; mc-4 (the day before) says no hit points on the circle, pips beside the formation. Draw R1's as approved and the mc-4 reading beside it, small, so Francis can settle which stands.

## Format
One HTML page in `docs/design/mockups/december/` on `design-december-mockups` (suggest `16-the-scenes-top-in-every-state.html`), buttons as plain blocks, tokens from `docs/06` only, R1's parts reused and never redrawn differently, the book's type as R1 has it. PNGs with index rows marked "a proposal, not ruled" (frame 1: "approved 2026-11-12"). A proposal note in `docs/design/notes/`: a table of every part of today's top and where it sits now; for each frame what you checked (the uiux self-review) and what you could not; and the things you are least sure of.

## Boundaries
- No new behaviour beyond the homes above: every control on the page exists today or is in the table. List anything else as new, with its frame.
- Hidden means hidden: nothing reaches the players' frames that they cannot read today (the weather table, a reminder that is the GM's, a hidden timer).
- Rules-agnostic: invented names; no real game's words.
- Calm: one accent button a frame; no explainer lines; 44 px targets with 8 px between; nothing under 14 px; a fact's value never wraps.
- Usage is tight and you run on the dearer model: one render pass a frame if you can, one browser at a time, and stop. If the ten frames are too many for one sitting, draw 2, 3, 6 and 8 first (the builder needs those to start) and tell the lead.
- When done: the page's path, the commit, what you opened, and what you are least sure of.
