# Plan: M5b step 3 — the players' wilderness screen and activities

Written by the design agent, 2026-11-01. Read the specs it names; this file makes no rulings. Opus, medium.

## What this step delivers
Players get their **wilderness screen**: date and weather icon, travel points left, the ground around them, the marching strip, the rest prompt, **one button group** (the pack's activities by name, Force march, Something else…), and **What we know**. Activities apply their cost, explain their roll, pop up their table, and send **yields** to the finder's pack. Secret activities are **Requests** (step 12's record) showing their cost.

## Already built (verify first)
*Re-plan 2026-11-01:* the players' screen is now the **live table view of g6** (time band, marching-order tiles, place, prompt slot); this step adds the wilderness parts onto it (travel points, the ground around them, the activity button group, Force march, camp steps) — not a separate screen. Something else… and Describe… are gone (A5, g1); the rest prompt is g6's. Still built: weather icon and card, the marching strip (now tiles), Force march (M5b step 1), the ground around them on the location view (M5b step 1).

## Rests on
- 05 Exploration modes: *Activities* (usable here and now; who's acting; S4-8 every activity shows and applies its cost, explains its roll, pops up its table), *The players' wilderness screen*, *Something else…*, *Requests*, *What players see*.
- 06: *Wilderness on Scene* (layout top to bottom; the button group 2 columns on phone, 3 on tablet, an odd last button centred), Components: Request card, What we know panel.
- 07 Exploration: `activities` (`cost`, `requires`, `chance`, `who`, `maxActors`, `bestOf`, `modifiers`, `result`, `tableId`, `tableByTerrain`, `bySeason`, `bySpecialSeason`, `onlyIn`, `onlyOnTerrain`, `secret`, `yields`), `onlyWithOption`.
- 03: players run non-secret activities themselves; secret ones are requests the GM answers; yields go to the finder's pack (Undo; the GM can undo).
- Rulings: `m5b-wilderness-2026-10-30.md` D3, D8, S4-1 to S4-4, S4-8; `m5-prompts-2026-10-31.md` (Request pattern).

## Build order
1. **Activity engine.** From the mode's `activities`, filter by `onlyIn`, `onlyOnTerrain`, `onlyWithOption`, `requires`, season; work out the cost (`budget`, `all`, `fromTerrain`, `time`), the chance (`skill` or `abilityCheck` with `modify` hooks and the modifiers' sources), and the result (`result`, `tableId`/`tableByTerrain`, `bySeason`, `bySpecialSeason`, `yields`). Commands as intents: `activity.start`, `activity.enterRoll`, `activity.apply` (cost + yields in one undoable event). `who`: one, several (each rolls), party; `maxActors`, `bestOf`.
2. **The button group.** The players' screen in a day mode: the pack's non-secret activities by their own names, **Force march** (ⓘ), **Something else…** last; even layout by count. Tapping an activity: who's acting (own character preselected), the cost line, the roll instructions with modifiers and sources, **Enter roll**; the result and the yield ("3 bundles of firewood → Tam's pack") with Undo; the GM sees it live and can undo.
3. **Secret activities as requests.** A secret activity shows as a request button with its cost ("Search the area · 3 travel points"); it creates a `Request` of kind `secretActivity`; the GM's card in Waiting for you shows the secret prompt (the pack's chance, Hit / Miss, the table); accepting applies the cost (undoable); players see nothing until the GM narrates. Spend the day looking (step 1) is offered this way when the pack marks it secret.
4. **What we know.** A card that pops out into a panel: the places the GM has shown (name and description), revealed maps (homebrew images). Empty state: "Nothing shared yet."
5. **Top of screen.** Date + weather icon (tap for details), travel points left (the weather change only when not zero), the ground around them (terrain always; the place's name only once shown), the marching strip with "You", the rest prompt when due.

## Tests (purpose first)
- An activity's cost comes off the group's budget and its yield lands in the finder's pack; Undo reverses both.
- A character without the `requires` skill or item isn't offered; `onlyOnTerrain` and `onlyWithOption` hide correctly.
- `bestOf` keeps the best of several rolls; `bySeason` dice override `yields.dice`.
- A secret activity reaches the GM as a request and never shows its result to other players before the GM answers (database test on the request).
- 375 px: the button group lays out 2 columns, odd last button centred; long activity names wrap.

## Scope checks (write one and stop)
- No turn-mode Act… (parking lot, DG12).
- No camp activities yet (step 4), no town activities (deferred).
- No handouts in What we know (M8b).

## ⚑ for Francis (ask at the start)
1. Secret activities' cost applies when the GM accepts (S4-3). The answer kind is Yes / No plus the GM's own Hit / Miss on the pack's chance. OK?
   **Answered by Francis (2026-11-03): OK.** A secret activity's cost applies when the GM accepts; the answer kind is Yes / No plus the GM's own Hit / Miss on the pack's chance (09, 2026-11-03).

## Estimate
30–40 builder turns.

## Departures
(The builder keeps this current in the same pull request.)

**Split (2026-11-03, builder):** build orders 1, 2 and 5 are this pull request (`m5b-3-players`, after #307). Build orders 3 (secret activities as requests) and 4 (What we know) are a second, stacked pull request; nothing of them is built here (a secret activity isn't offered to players until then).

Built:
- **Build order 1 (engine):** `activities.ts` gains who may act (`requires`), how many (`who`, `maxActors`), the spend (`budget`, `all`, `fromTerrain`; `time` takes no points), the cost line, the roll plan (instructions, each modifier with its source: the pack's `modifiers` as "the rules", the party's as "the party"), `bestOf`, the finder and the yield line. `activityPlay.ts` holds `activity.apply` and `activity.undo`. Two migrations (on test, not on main): `20261103130000_m5b_3_activities.sql` (`activity_runs`, `apply_activity`, `undo_activity`) and the fix-forward `20261103131000_m5b_3_undo_named.sql` (the undo is logged under its own name, `activity.undo`, as the commands test requires).
- **Build order 2 (the button group):** the travel card's player button group holds the activities by their own names, then Force march with ⓘ; a grid, 2 columns on a phone, 3 from 720 px, an odd last button centred, long names wrap. Tapping one opens its sheet; It worked / It didn't work (Done with no roll) applies at once, the toast has Undo; the log line is everyone's and the GM's log has Undo on it.
- **Build order 5 (top of screen):** already built by g6 and m5b-1 (date and weather icon, travel points with the weather change only when not zero, "Around you: <terrain>", the tiles with "You", the rest prompt); checked, nothing changed.

Choices made where the specs were silent (technical; Francis to confirm or rule otherwise):
1. **Undo of an activity has its own path** (`undo_activity`), not the generic undo: the generic undo refuses anything that made an item line (hard rule 4), and a player can't write the group's travel row. It takes the yield out of the finder's pack (the line it made, only while untouched: same pack, same count, not put in a container; else "That's changed since"), gives the points back (same day only) and marks the run undone, each change linked to the one it reverses (logged as `activity.undo`). D3 rules the yield's Undo; see ⚑ A below.
2. **Who's acting:** the screen's own character first; the group's other characters may be picked (up to `maxActors`; all for `party`). `requires` is checked for the screen's character only (this device knows its skills and pack); others are offered and the table decides.
3. **Whose roll is best:** higher for skills read as "N-in-6" or "N+"; lower for percent skills and ability checks (rolled under). Only `bestOf` uses it, to pick the finder.
4. **The outcome is the player's tap** (It worked / It didn't work), as the app doesn't judge rolls; a yield goes in only on It worked, with how many from its dice (a whole number fills itself in; otherwise "Roll 1d3" and a stepper).
5. **A time cost** (`time`, `steps`) is shown and logged but doesn't move the clock: only the GM moves the shared clock.
6. **A table result** (`tableId`, `tableByTerrain`) reads "The GM rolls on the pack's table for what you find": the player never sees the table; the GM reads the activity in the log. The GM's own table pop-up for an activity isn't built (see Not done).
7. **The log line is everyone's** ("Reed did Gather reeds (Reed, Moss) · 2 points · 3 Reed bundle → Reed's pack"); the run row is readable by the GM and the group's players only.
8. **A yield needs the item in the setting rules** (`yields.item` matched to an item's id); otherwise the sheet says the GM adds what's found and nothing goes in.

Not done (for a follow-up or a ruling):
- The party's `modify` hooks on activities aren't wired (the roll plan takes them; nothing supplies them yet, as for checks).
- The GM's live view is the log line (with Undo); no GM-side activity card or table pop-up.
- The 375 px layout check in a real browser (`npm run test:layout`) has no wilderness scene in the stand-in database yet; the grid is CSS only, checked by hand.

**Part 2 (2026-11-03, builder, `m5b-3-players-2`, after #312):** build orders 3 and 4.
- **Build order 3 (secret activities as requests):** a secret activity is a request button in the same button group, with its cost ("Scout ahead · 3 points"); its sheet asks who's acting and sends one of g4's requests (`request.send`, kind `secretActivity`; no second request system). The request carries only the activity's id, the group, who's acting and the cost: the GM's card in Waiting for you reads the secret prompt from the pack on the GM's device (the roll with its modifiers and sources, the result, the table with Open the table, what it yields). **Hit / Miss** is the GM's own roll on the pack's chance, recorded as the GM's secret check (`check.record`, GM-only until Downtime, as every GM check); then **Yes** applies the cost (`answer_secret_activity`: the points off the group's budget today in the same request, so the answer's one Undo puts both back) or **No**. While one waits the button reads "· waiting for the GM" and a second tap explains. One migration, `20261103140000_m5b_3_secret_requests.sql` (on test, not on main).
- **Build order 4 (What we know):** a card under the groups on the players' Scene ("What we know · 2 places · 1 map or handout", or "Nothing shared yet") that opens a panel: the places shown to the player's groups on this expedition, each with its shown pieces (`public.known_places`: every visit, not the current place alone; a piece hidden again drops out), and the maps and handouts the reader may see (the `assets` table's own reading rule). Nothing uploads or reveals a map yet (02: images live in the GM's Drive; handouts are M8b), so that list is empty until then.

Choices made in part 2 where the specs were silent (technical; Francis to confirm or rule otherwise):
9. **The GM's Hit / Miss is a check result, not part of the answer:** the requester reads their request's answer (hidden means hidden), so the roll's outcome can't sit in it; a secret check is the built GM-only record for exactly this, and it reaches players when the campaign next enters Downtime, as every GM check does (05, Checks). Undo of the roll is the toast's (and the log's), separate from the answer's.
10. **What the GM's Yes means:** the group may do it and pays; the GM narrates the result (and adds any yield to the finder's pack by hand: nothing goes in a pack from a secret activity, since the pack would tell the player what came of it). A time cost takes no points and doesn't move the clock (as part 1's choice 5).
11. **Who's acting** for a secret activity is picked as for an open one (own character first, up to `maxActors`); the names reach the GM's card ("With Moss."), the request itself is the asking character's.
12. **What we know lists the whole campaign** — ruled by Francis (2026-11-03, relayed by the coordinator: B until M8b): this expedition's places open, in visit order; earlier expeditions' places in **one fold** below ("Earlier expeditions · N places", closed by default; newest expedition first, no per-expedition headings: fewer words, and the places carry their own names), with the same hiding rules; a place shown again this expedition isn't repeated in the fold. The card's line stays this expedition's count and adds "· N earlier". Built as a fix forward: `20261103141000_m5b_3_known_places_campaign.sql` adds `known_places_campaign` beside the applied `known_places`. M8b's location browser takes this over.

Not done (part 2):
- No map or handout can be uploaded or revealed yet, so the panel's second list is empty in play (its reading is wired to `assets` and tested only by its empty state).
- The GM's card has no "Enter for <name>" for a secret activity (nothing to enter: the GM rolls).

⚑ for Francis (from this step):
- A. **Undoing a yield removes the item line the activity made** (the log keeps its copy). D3 rules "yields go to the finder's pack (Undo)", but hard rule 4's closed list of deletions doesn't name it: add it to the list (CLAUDE.md, 09), or rule otherwise? **Ruled A by Francis (2026-11-03):** added as the fifth exception in hard rule 4 (CLAUDE.md) and 09.

