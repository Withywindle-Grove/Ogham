---
status: absorbed
milestone: m5b
absorbed-into: docs/03-roles-permissions.md, docs/04-data-model.md, docs/05-features.md, docs/06-screens-and-design.md, docs/07-content-packs.md, docs/08-roadmap.md, docs/10-open-questions.md (2026-10-30; session 4 the same evening into 03, 04, 05, 06, 08, 10); the code is built in M5b, except the database fix-forward that makes weather tags player-readable again (D1)
supersedes: players never seeing weather tags (S17 Weather in s17-exploration-ruled.md; 05, 07; the 2026-10-30 hiding of weather tags from players); "Getting lost is Secret or Open" (S17-11 in s17-exploration-ruled.md; the campaign setting `gettingLost`); daily rations as one GM Eat Tick-confirm (scope added 2026-10-30), now per-player eating inside camp; camp prompting only watches, the night check and sleep (S17-7); forced march as the GM's one tap (S17-4); the 2026-10-29 order of which table a hit rolls, now only the order of the GM's pick list; activity `yields` as "planned, no app change yet" (2026-10-30); D3's "secret activities stay GM-only" (session 4, S4-3: players get request buttons); D7's "Lost is always GM-only" (session 4, S4-6: Getting lost Secret / Open returns as a campaign setting, Open showing Lost to players); DG10's separate "Things you can do" row (m5-dungeon-2026-10-30.md; session 4, S4-2: it lives in Something else…)
---

# M5b wilderness rulings, 2026-10-30 (Francis approved)

Session 1 of the M5b design (the GM's wilderness day: Move…, the budget, the location views) and paper dry run 3 (a wilderness travel day in 12 steps). Saved by Claude Code from the design Project's notes with neutral names and invented examples only; numbers, chances and route lists stay in the private packs. The specs say what is true now; the one-line history is under 2026-10-30 in `docs/09-decisions-log.md`.

## Session 1: the GM's wilderness day

| # | Ruling | Where |
|---|---|---|
| S1 | **Move…** (GM) spends the travel budget: route, terrain, optional place name; it shows the cost and the check chances, with Undo in the toast. "Where?" stays for free jumps and corrections. An unnamed place reads "<Terrain> (unnamed)". | 05, 06 |
| S2 | Routes come from the pack (e.g. Wild, Road, River). The route feeds the cost, the lost check (no roll on a road) and route-dependent table columns. | 05, 07 |
| S3 | **Budget card**: "<pack's name> 3 of 8" with the weather change; pips up to 12, above that a bar with ticks; On foot / Riding / Cart (riding uses the pack's value, else asks); tap the number for its breakdown; at day's end "N unused points lost" goes to the log. | 05, 06 |
| S4 | **Shortfall**: "Entering <place> · N more tomorrow"; the party arrives when the next day's points pay it, taken first next day. Never blocked. | 05, 06 |
| S5 | **Rest due**: on the pack's rest day, a quiet "Rest due" line on the budget card with the existing Rested / Push on. | 05, 06 |
| S6 | **Location view** in three versions (hex, place, dungeon room), as mocked: sections appear only when they have data; empty state "Where are we? · Set place". M5b builds the name, player text, terrain, picture and GM notes; M8b fills the rest. | 06, 08 |
| S7 | **Tablet landscape**: day controls on the left; the location view and marching order on the right. **Phone**: the location view opens as a sheet. | 06 |

## Dry run: who does what

| # | Ruling | Where |
|---|---|---|
| D1 | **Weather**: campaign setting "Weather rolled by: Players (default) / GM". Any player enters the roll (the first entry counts, logged with who); the GM can enter it instead. Everyone sees the result and each effect in plain words; the card folds to an icon beside the date (tap to reopen). The table is never shown to players. Weather tags are player-readable as effects. This replaces "never the table or its tags" for tags (05, 07). | 03, 04, 05, 06, 07 |
| D2 | **Check prompts** show only the rolling instructions and Enter roll. The GM asks players out loud; there's no who-rolls choice in the app. | 05, 06 |
| D3 | Players get the **activity buttons** for the pack's non-secret activities on their wilderness screen: they enter their own rolls and see the results; yields go to the finder's pack (Undo); the GM sees it live and can undo. Secret activities stay GM-only. | 03, 05 |
| D4 | **Force march** is the players' choice: a player button (also on the shortfall line), applied at once with no GM accept, its effects one tap away (ⓘ); the GM can undo; the pack's rest reminder is set automatically; repeats stack as the pack says. | 03, 05 |
| D5 | Players work through **camp** on their own screens; the GM sees everything and sets a number only where the pack is vague (a wet fire's chance, say). | 03, 05 |

## Dry run: travel

| # | Ruling | Where |
|---|---|---|
| D6 | **Ways on** (G-05, M8b): a GM-only list from hex neighbours, routes and linked room exits, ending in Other… (describe, route, terrain, cost; saved to the campaign homebrew). Players never see options. 07: room exits gain a link to the room they lead to. | 05, 07, 08 |
| D7 | No believed-vs-true position: Move… is always the GM's real move, and players see where they really are. **Lost** is a GM-only status with the pack's recovery reminder (the pack's recovery chance). | 03, 04, 05 |
| D8 | "Spend the day looking" uses up the day's remaining travel points, shown on the budget card. | 05 |
| D9 | **Event-triggered checks**: `checks[].alsoWhen` (e.g. `{ "leaveRoute": "road" }`); the engine prompts the check on a Move… that matches. `npm run pack:check` learns it. | 05, 07 |
| D10 | While entering a place (a shortfall), camp and the night check use the place the party is in. | 05 |

## Dry run: encounters

| # | Ruling | Where |
|---|---|---|
| D11 | A check hit queues an **Encounter waiting** card on the GM console; the GM starts it when it suits. | 05, 06 |
| D12 | The GM picks the encounter table from a **list of candidates** (route column, fire column, place, terrain, region, special-season swap, Other…), the likely one marked as the suggestion. The 2026-10-29 order becomes only the list's order. | 05 |

## Dry run: camp

| # | Ruling | Where |
|---|---|---|
| D13 | Camp follows the pack's order: set up → fire, cooking, campfire talk → eat → watches → night check → sleep. | 05 |
| D14 | **Eating** (M5b-8) is per player, inside camp after cooking: each player taps Eat and picks their food (fresh before preserved suggested); the GM sees who hasn't eaten; anyone can give food to a character with none; the pack's hunger rule shows as text. | 05, 06 |
| D15 | **Cooking** makes portions the cook hands out; a portion counts as the day's food, plus any pack bonus. | 05, 07 |
| D16 | The **campfire** is a party light on the M5 light engine, fuelled by firewood: bundles from packs ("Add firewood from packs") and gathered hours feed it; the night check reads whether it's lit. | 05, 07 |
| D17 | **Campfire talk** is a camp activity (the pack's entertaining rule). | 05 |
| D18 | **Watches**: players set the order; each watch holds 1–3 characters; the app works out the night's length and warns about casters on watch; a night hit asks "Which watch?" so the waiting encounter knows who's awake. Armour stays narrative (not modelled). | 05, 06 |
| D19 | **Sleep difficulty** from facts where the pack says so: per character from the season, the fire and that character's bedding, shown with reasons, changeable by the GM; Easy needs no roll; otherwise the pack's sleep check (with modifiers such as campfire talk). | 05, 07 |
| D20 | No separate camp Confirm: camp and sleep results show as they come in; **Next day** applies them as one undoable step, with the morning summary (unused points lost, fire out and fuel used, arrival paid first, the Lost recovery prompt, statuses shown). | 05 |

## Roadmap (08)

M5b's row gains: players' weather roll, player activity buttons and force march, Encounter waiting, the table pick list, event-triggered checks, the camp order with eating, cooking, the campfire as a light, campfire talk, shared watches, sleep difficulty from facts. Ways on (D6) goes to G-05 and M8b.

## Pack tasks (Francis's, in the private packs)

Format names fixed on 2026-10-30 in 07 (Exploration; adventure packs §2):
- Activity `yields` `{ item, dice }`.
- The cooking rule, structured (`camp.cooking`).
- The sleep table's rows as conditions on the fire and bedding (`difficulty` on the sleep step, with `camp.bedding`).
- `alsoWhen` on fae-woodland's lost check.
- Check the source book's camp procedure for foraging.
- Room exits linked to rooms (adventure format, `exits[].to`).

## Addendum (2026-10-30, night): optional rules

Approved by Francis with the dungeon dry-run rulings (`m5-dungeon-2026-10-30.md`). The pack's own chances, checks and abilities stay in the private packs.

| # | Ruling | Where |
|---|---|---|
| WA1 | Any activity, camp step, check or table can carry `onlyWithOption`; the app hides it when that option is off. `npm run pack:check` learns it everywhere. | 07 |
| WA2 | **Smoking for clues** (a fae-woodland option): a camp or rest activity (an hour, the pack's check for a clue). | 05 |
| WA3 | **Inebriation** (a fae-woodland option): the pack's check per drink, stepping through the pack's levels (tipsy, drunk, groggy, unconscious). Needs statuses with ordered levels (a status that steps up and down). | 05, 07 |
| WA4 | **Falling asleep on watch** (a fae-woodland option): a quiet check per watcher at the night check (the pack's chance, better or worse as the pack says). | 05 |
| WA5 | Lifestyle expenses (a settlement's daily cost): text until purses (M7b). Detailed wind (classic-advanced, ship travel): text in R1. XP for exploration: M7's XP waiting. | — |
| WA6 | The settlement view joins M5b's design (fae-woodland's settlement mode). | 08 |

## Session 2 (2026-10-30, late night): the day's checks and weather

Approved by Francis (from the design Project's `claude/m5b-session-rulings.md`), with the answers to Claude Code's late-night ⚑ (prompts 30d and 30e). The pack's chances and tables stay in the private packs.

| # | Ruling | Where |
|---|---|---|
| S2-1 | **Weather card**: players roll; everyone sees the result and its effects; it folds into the icon beside the date after 8 seconds or on tap, and reopens from the icon. | 05, 06 |
| S2-2 | **Two-outcome checks** (wandering, lost, gutter, special-season start, asleep on watch…) use **Hit / Miss** buttons with the instructions and modifiers shown; no number entry. | 05, 06 |
| S2-3 | After Hit, **the table pops up**: candidate tables with the suggestion first; each row shows its number range ("4–5 · Mortal"); the GM taps the rolled row; a row pointing to another table opens it next; long tables (d100) get a **go to number** box. | 05, 06 |
| S2-4 | **Encounter waiting** cards queue one per hit, with **Start**, **View** (details without starting or dismissing) and **Dismiss** (undoable). | 05, 06 |
| S2-5 | **Lost card** (GM-only): **Found the way** / **Still lost** each morning, with the pack's chance shown. | 05 |
| S2-6 | **Special seasons**: a switch in the time strip's ⋯; a quiet GM prompt (Hit / Miss) on their possible start days. | 05 |
| S2-7 | **Travelling in darkness**: a switch in the time strip's ⋯ (adds the darkness effect); a "Sunset around now" hint from the pack's daylight table. | 05 |

### Answers

| # | Answer | Where |
|---|---|---|
| A1 | **Keep lit** sits in both the Light section and the character overview. | 05, 06 |
| A2 | Confirmed for consumable lights (torches, candles): Put out keeps the time on that light; lighting a different one drops the old one's leftover. Holders: A7. | 05 |
| A3 | Confirmed: Keep lit switches itself off when a different type of light is lit. | 05 |
| A4 | Wording OK, except "Keep lit on for Rushlight" becomes the toast "Rushlight will be kept lit". | 06 |
| A5 | Kept: the burnout line on the GM's card; only the burnout line when low and out happen in one jump. | 05 |
| A6 | `warnAt` stays and the pack wins; one turn is the default when a pack gives none. DG6 meant there's a warning, not its timing. | 05, 07 |
| A7 | Holders (lanterns) keep their time left (the fuel in them) when put out, even if another light is lit in between. | 05 |
| A8 | The weather prompt shows both as a card on Scene and in the Player screen's urgent strip. Entering in either closes both for everyone. | 05, 06 |
| A9 | "Waiting for the GM to set the season" until the GM answers Which season? or picks a table. | 05, 06 |
| A10 | The player who entered the weather can Undo from the toast (8 seconds); after that only the GM corrects it (logged, fiat). | 03, 05 |
| A11 | A pack-given text per tag: the tag's name plus its note ("Wet · lighting a campfire is hard"), and any number it changes ("Travel impeded · −2 travel points"). | 05, 07 |
| A12 | The weather lasts until the next `rollEvery` step; the GM can change it any time (logged). | 05 |
| A13 | Confirmed: check prompts keep the modifier list with sources. D2 only removed the who-rolls choice. | 05 |
| A14 | Marching words OK ("Walk beside …" / "A row of their own"; rows hold 1–3). | 06 |
| A15 | Saved marching orders get **Delete** (undoable). The GM lock as a switch on Scene: OK. | 05, 06 |
| A16 | B, Later: the setting is renamed **"Show each other's HP"** now (no secrecy promised). HP moves into its own table (read by the owner, the GM, and everyone only when the setting is Yes) at the start of M6, alongside the Down/dead pack-and-purse exception (fight ruling 11), which already needs character-state read rules. Ask Francis before the migration. | 04, 05, 08 |
| A17 | Any player or the GM can open **Split the party**; each player picks their own character's group in the pop-up; the GM can move anyone. **Join up**: the GM, or any player when the groups are in the same place. | 03, 05 |
| A18 | Hirelings follow their employer's group by default; the employer or the GM can move them. | 03, 05 |

## Settlement (dry run 5; 2026-10-30, late night)

Approved by Francis (from the design Project's `claude/settlement-dry-run-notes.md`). Paper dry run 5 walked a party through a settlement. **This section replaces M5b session 3's rulings** (none were saved in the repo, so nothing here is marked superseded). Neutral names and invented examples only; the pack's chances, prices and lists stay in the private packs.

| # | Ruling | Where |
|---|---|---|
| ST1 | **Time in town** moves in parts of the day: morning, afternoon, night (**Next part of day**). A settlement mode's step is a part of the day. | 05 |
| ST2 | Each settlement place is **Safe** (default) or **Hostile**, set by the GM. Safe: **Back in safety** → Split loot → Award XP (M7/M7b) → the town screen. Hostile: **Into town** → the town screen only. | 03, 05, 06 |
| ST3 | **The town screen** is the settlement version of the location view: Overview; Places in town (shops, lodgings, temples, others, each with Show players and Open / Closed); People; Things to do; Encounters (GM-only); Rumours. Players see only what the GM shows; hidden places never reach their devices. Everything is scoped to the current settlement. M5b builds the layout and controls with the pack's services and lodging; M8b fills NPCs, named shops and rumours. On phones a place's name wraps above its two controls. | 05, 06 |
| ST4 | **Out and about today** and **Active tonight** switches gate the town's encounter checks; checks gain `onlyWhen` (`"outDay"` or `"activeNight"`). | 05, 07 |
| ST5 | **Buying**: a player's **Ask for…** (from the town's list or **Something else…**) lands in the GM's Waiting for you; the GM's prompt shows the pack's availability chance as Hit / Miss, then **In stock** (pack price) · **Not here** · **Price…**; the player buys or leaves it. Costs are logged as text until purses (M7b). | 03, 05, 06 |
| ST6 | **Selling**: **Sell…** (the item, and the buyer: a service such as used goods or a jeweller, or a person) → the GM sees a price suggested from the pack's rule → **Offer** (changeable) → the player **Accepts** or **Declines**. | 03, 05, 06 |
| ST7 | **Lodging**: players pick from the town's lodgings with their rates → the GM approves (cost logged) or says **Not available**; the lifestyle option shows its daily cost as text. | 05 |
| ST8 | **Town activities** for players (from the pack, plus **Something else…**), each rule one tap away; results narrated by the GM, or offered (a rest day's heal); money results as text until purses. | 05 |
| ST9 | **Overnight summary**: each morning every player gets a short card (HP healed and why, statuses changed, lodging cost), applied with the GM's next part of the day. | 05, 06 |
| ST10 | **Start downtime** ends the expedition, applies a full rest automatically (no button), and switches to Downtime; the town screen stays for buying and selling; time moves with +1 day, +1 week or a date until the downtime design. | 05 |
| ST11 | **End downtime** returns to Adventure (more in the downtime design session). | 05 |
| ST12 | Settings with **no settlement mode** (classic-advanced): settlement places still show the town screen, Back in safety and buying and selling; time moves with the current mode or Downtime. | 05 |
| ST13 | Parking lot: generating shop stock automatically from a setting's random tables. | 08 |
| ST14 | Roadmap: a **downtime design session** before M7's downtime work. Francis's model to start from: players propose activities, the GM sets each duration, and the total downtime comes from those or from a chosen or random date in the future. | 08 |

*Pack tasks (the design Project's):* `onlyWhen` on town checks; availability rules from both source books; lodging lists and rates; settlement services structured.

## Answers after #170 (2026-10-30, late night)

Approved by Francis: the answers to Claude Code's six ⚑ after pull request #170.

| # | Answer | Where |
|---|---|---|
| Q1 | Both, split by kind: in every mode players see the ground around them automatically (terrain and weather, D7); a place's name and description wait for **Show players** (DG9). In the wilderness they always know the terrain, not the place's name, until the GM shares it. | 03, 05 |
| Q2 | Rest prompts in day modes too: when a rest day is due, players get the prompt and a **Rest today** button; the GM's Next day applies it. | 03, 05, 06 |
| Q3 | The combined GM turn is re-budgeted without Act…: Next turn (1) + the check's Hit or Miss (1) + on a hit the table pick and row (2) = **2 taps on a miss, 4 on a hit**. Journey 7 stays day modes only. | 06 |
| Q4 | Table test 1, check 8 becomes: "the GM opens the GM screen's listening rule and rolls" (no Act…). | table-test-1 |
| Q5 | Pack names confirmed (07): `camp.sleep` difficulties are `{ id, name, result: "good" \| "check" \| "bad", add? }` (e.g. easy: good; moderate: check; difficult: check with a penalty as its `add`; impossible: bad), replacing the provisional `roll`. A weather tag's text is its `note` (the provisional `effect` merged into it; one field). Ordered status levels are `levels: [{ id, name, effects }]` in order, with step up and step down. | 05, 07 |
| Q6 | Use "dark sight" (the app's term) in 09 too; the 09 line that used another word is fixed in place. | 09 |

## Session 4 (2026-10-30, evening): the players' wilderness screen and settings

Approved by Francis (from the design Project's `claude/m5b-session-rulings.md`). With this session the M5b design is complete. Neutral names and invented examples only; the pack's costs, chances and lists stay in the private packs. S4-3 changes D3 and S4-6 changes D7 (both rows above stay as written; the header lists what they supersede).

| # | Ruling | Where |
|---|---|---|
| S4-1 | **Players' wilderness screen**: the date, the weather icon (tap for details), travel points left, the ground around them (terrain always; a place's name only once shown), the marching strip with "You" labelled, the rest prompt when due, then **one button group** (the pack's activities by their own names, **Force march** with ⓘ, **Something else…** last) laid out evenly by count (2 columns on phone, 3 on tablet, an odd last button centred), then a **What we know** card. The weather change shows on the budget only when it isn't zero. (Both test settings have rest days.) | 05, 06 |
| S4-2 | **Something else…** opens a pop-up: a searchable, grouped list of actions and rules (the pack's common player actions), plus **Describe what you want to do → Send to the GM**. It replaces the separate "Things you can do" row (DG10's reference lives here). | 05, 06 |
| S4-3 | **Secret activities** appear to players as request buttons showing their cost ("Search the area · 3 travel points"); the GM gets the secret prompt; the cost applies when the GM accepts (undoable); players see nothing until the GM narrates. This changes D3 (secret activities were GM-only). | 03, 05, 06 |
| S4-4 | **What we know** pops out into a panel: the places the GM has shown (with their descriptions) and revealed maps. M8b adds handouts. | 05, 06 |
| S4-5 | **During camp**, the middle of the players' screen swaps to the camp steps in the pack's order (Eat, your watch, Campfire talk, cooking, sleep). | 05, 06 |
| S4-6 | **Settings** in Rules for this campaign → Adventuring: Weather rolled by (Players / GM); **Getting lost** (Secret / Open; Open shows the party's Lost status and recovery roll to players); Show hex numbers to players; Show each other's HP; the pack's camping options labelled "from the setting". Per device: the darkness effect (on / off). Special seasons and Travelling in darkness stay switches in the GM's time strip ⋯. | 05 |
| S4-7 | **UI convention**: prefer pop-ups and pop-out panels over nested collapsible lists. Reference lists (rules) stay collapsible, with a search bar. | 06 |
| S4-8 | **Every activity, in every mode**: shows its cost (time, travel points or turns) and applies it when done (undoable); explains its roll (instructions, with modifiers and their sources); and pops up its table when one is needed (for the GM, generally). | 05 |

### All M5b sources (the design Project's files, gathered in this file)

- `m5b-design-plan.md` (v3, approved): items M5b-1 to M5b-9.
- `wilderness-dry-run-notes.md`: session 1 (S1–S7), dry run 3 (D1–D20), the optional-rules addendum (WA1–WA6).
- `dungeon-dry-run-notes.md`: DG1–DG19 (mostly M5, some M5b; in `m5-dungeon-2026-10-30.md`).
- `m5b-session-rulings.md`: session 2 (S2-1 to S2-7) and session 4 (above).
- `settlement-dry-run-notes.md`: ST1–ST14 (replaces session 3).
- `dungeon-exit-sample.md`: the invented escape rule for a private test pack.

*Pack task (the design Project's):* drop fae-woodland's duplicate "Find food" activity.
