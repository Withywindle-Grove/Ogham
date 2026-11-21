# Plan: M5b step 6 — settlements (ST1–ST12, with the downtime rulings that replaced parts of them)

Francis ruled B on the builder's scope check (2026-11-03): settlements stay in **M5b** and are planned before the M5b gate counts as passed. Rulings: `design/rulings/m5b-wilderness-2026-10-30.md` (Settlement, ST1–ST12) as amended by `design/rulings/m7-downtime-2026-11-02.md` (dt-2, dt-3, dt-9, dt-11). 05 Settlements; 06; 07 Settlements and Downtime (`lodgings[]`, `storedPlaces[]`, `loans`, `lifestyles[]` on settlements, dt-46). Five steps, each its own pull request, from main, in order.

**What changed since the settlement dry run (read first):**
- **ST2's Back in safety / Into town are replaced by the arrival card** (dt-9): arriving at a Safe place by Where? or Move… puts a quiet card on the GM's console (End expedition · Not now; then Start downtime · Not yet). Hostile: no card. The "who taps them" ⚑ is gone (the GM, through the card).
- **End expedition and Start downtime are two taps** (dt-2): today End expedition puts the campaign into Downtime; after this step it ends the expedition and leaves the party **in town on the adventure clock**; Start downtime is the second tap.
- **The split and Award XP belong to End expedition** (dt-3; M7 and M7b build them; until then End expedition goes straight on, as 05 says).
- **Lodging needs the GM's yes only for "Somewhere else…"** (dt-11, ruled for downtime; ⚑ 3 asks whether it also replaces ST7's "the GM approves" while in town on an expedition).

## Step 6.0 — the town switches and `onlyWhen` (ST4; ruled sw-1 … sw-4, `design/rulings/m5b-settlement-switches-2026-11-03.md`; first, small)
**Build order**
1. Two campaign flags, **Out and about today** and **Active tonight**, set by the **GM** (sw-1) from the time strip's ⋯ (as Travelling in darkness), with a small marker on the strip while one is on (sw-2). Commands `town.outDay` / `town.activeNight` (on / off), each a Simple log line with Undo; permission cases (GM yes, player no).
2. **The reader:** a check with `onlyWhen: "outDay"` comes due (due mark, prompt) only while Out and about today is on; `"activeNight"` only while Active tonight is on; no `onlyWhen`, always (as today).
3. **Reset** (sw-3): both turn off at the next morning (a mode without parts of the day: when the day changes) and at Start downtime, logged ("Out and about ended · morning").
4. **Players** (sw-4): a quiet line on their Scene while a switch is on; nothing about checks.
5. **pack:check** accepts `"outDay"` and `"activeNight"` and warns on any other value.
6. **Migration:** one, for the campaign's two flags (and the two commands' `logged_commands` rows); test project first.

**Tests (purpose first)**
- A check with `onlyWhen: "outDay"` prompts while Out and about today is on and stays quiet (no due mark, no prompt) while it's off; the same for `"activeNight"`.
- A check without `onlyWhen` prompts either way.
- Both switches turn off at the next morning and at Start downtime, each logged; Undo of a flip restores the previous state.
- A player can't flip a switch (permission case); a player's Scene shows the state line and nothing about the checks.
- pack:check warns on `onlyWhen: "rainy"`.

**Scope checks:** any other `onlyWhen` value; switches on the town screen before 6c.
**⚑:** none (ruled sw-1 … sw-4).
**Estimate:** 3–4 turns, one migration. Test data: fae-woodland 0.3.16 (`packs/_current`), its town-day and town-night checks.

## Step 6a — time in town, End expedition, Start and End downtime (ST1, ST10, ST11; dt-2)
**Build order**
1. A settlement mode's step is a **part of the day** (morning · afternoon · night); its main advance is **Next part of day**; the strip shows the part. The pack's step unit for it follows ⚑ 2 (until ruled, a settlement mode with a one-day step advances a day and shows no part of the day).
2. **End expedition** (time strip ⋯; D22, summary with Undo) ends the expedition and leaves the campaign in Adventure, in town, with no expedition running; the time strip offers Next part of day (or the current mode's step) and **Start expedition** again.
3. **Start downtime** (a separate tap, from the strip ⋯ or the arrival card): applies a **full rest** by itself (no Full rest button), switches to Downtime; Downtime's +1 day, +1 week, a date as today (M7 widens it).
4. **End downtime** returns to Adventure (M7 adds its summary and clock ticks).

**Tests (purpose first)**
- Next part of day moves morning → afternoon → night → the next morning, and the log says so (Simple).
- End expedition leaves the campaign in Adventure with no expedition; Undo restores the expedition.
- Start downtime applies a full rest to every character once, and Undo reverses both.
- End downtime returns to Adventure.

**Scope checks:** a new mode or clock unit beyond a part of the day; anything that changes M5's End expedition summary.
**⚑:** 2 (the step unit's name).
**Estimate:** 4–6 turns.

## Step 6b — Safe and Hostile, the arrival card (ST2 as replaced by dt-9)
**Build order**
1. A settlement place is **Safe** (default) or **Hostile**, set by the GM on the place card (a property of the place, ST2; also covers a safe place inside a dungeon).
2. Arriving at a Safe place by **Where?** or **Move…** puts the **arrival card** on the GM's console (mockup `design/mockups/downtime/02-settling-in.html`, picture 1): "The party is back in a safe place" · **End expedition** (accent) · **Not now**. After End expedition: the summary line with Undo, then **Start downtime** · **Not yet**. A Hostile place: no card. Players see nothing.
3. Not now dismisses the card for this arrival; the town screen works either way.

**Tests:** a Safe arrival raises the card once per arrival; a Hostile one never; Not now dismisses it; the card's End expedition is the same command as the strip's.
**Scope checks:** any player-facing control for Safe / Hostile.
**⚑:** none.
**Estimate:** 3–4 turns. (This was slice 1 of `plans/m7-downtime.md`; it moves here.)

## Step 6c — the town screen (ST3, ST12)
**Build order**
1. The **town screen** is the settlement version of the location view (06): **Overview** · **Places in town** (shops, lodgings, temples, others; each with **Show players** and **Open / Closed**) · **People** · **Things to do** · **Encounters** (GM only) · **Rumours**. Scoped to the current settlement.
2. Players see only what the GM shows; hidden places never reach their devices (row-level security, hard rule 5).
3. M5b fills it from the pack: the settlement's **services** and **lodgings** (07; ⚑ 2 for the services' field names), the lifestyle option's daily cost as text. M8b fills people, named shops and rumours from adventures.
4. **No settlement mode** (classic-advanced, ST12): a settlement place still shows the town screen and the arrival card; time moves with the current mode or Downtime.
5. Phones: a place's name wraps above its two controls.

**Tests:** a hidden place is not sent to a player's device; Show players reveals one place only; a classic-advanced settlement place shows the town screen.
**Scope checks:** generating shop stock from random tables (ST13, parking lot); people and rumours beyond the GM's own text (M8b).
**⚑:** 2.
**Estimate:** 6–8 turns.

## Step 6d — (moved to step 6.0)
The switches and `onlyWhen` are step 6.0, first. When 6c lands, the town screen shows the same two switches (sw-2).

## Step 6e — buying, selling, lodging, town activities, the overnight summary (ST5–ST9)
**Build order**
1. **Buying** (ST5): a player's **Ask for…** (the town's list, or **Something not listed…**) lands in the GM's Waiting for you; the GM's prompt shows the pack's availability chance as **Hit / Miss**, then **In stock** (pack price) · **Not here** · **Price…**; the player buys it or leaves it. Costs logged as text until purses (M7b).
2. **Selling** (ST6): **Sell…** (the item; the buyer: a service such as used goods or a jeweller, or a person) → the GM sees a price suggested from the pack's sale rule → **Offer** (changeable) → the player **Accepts** or **Declines**.
3. **Lodging** (ST7, with dt-11 per ⚑ 3): players pick from the town's lodgings with their rates; per night, cost logged as text until purses; "Somewhere else…" waits for the GM's yes; the lifestyle option's daily cost as text.
4. **Town activities** (ST8): the pack's town activities plus **Something else…**, each rule one tap away; the GM narrates, or the app offers the result (a rest day's heal); money results as text.
5. **Overnight summary** (ST9): each morning every player gets a short card (HP healed and why, statuses changed, the lodging cost), applied with the GM's next part of the day.

**Tests:** an Ask for… with Hit then In stock reaches the player with the pack price; a Sell… offer the player declines changes nothing; a lodging pick logs its cost; the overnight card arrives once per morning with the HP healed.
**Scope checks:** purses, Due or repeating costs (M7b, M7); shared stays (dt-14, M7); stored places, banks and vaults (dt-8, dt-12, M7).
**⚑:** 2, 3.
**Estimate:** 8–11 turns.

## ⚑ for Francis (all ruled 2026-11-03)
1. ~~Out and about today / Active tonight: who sets them?~~ **Ruled sw-1 (the GM)**, with sw-2 … sw-4 (`design/rulings/m5b-settlement-switches-2026-11-03.md`).
2. ~~Settlement field names (07)~~ **Ruled st-2 (A)**: in 07 Settlements. Was:: services, availability, the sale rule, and the step unit for a part of the day. Recommendation: `settlement.services[] { id, name, kind: buy | sell | identify | store | loan, rate?, note }`, `settlement.availability { bySize: [{ size, chance }] }` (Hit / Miss), `settlement.salePrice { default, byService? }` (a share of the price), a mode's `step: { value: 1, unit: "partOfDay" }`. Today fae-woodland's services are text and its settlement mode steps a day.
3. ~~Lodging in town on an expedition~~ **Ruled st-3 (A)**: one rule, only Somewhere else… needs the GM's yes. Was:: does dt-11 (only "Somewhere else…" needs the GM's yes) replace ST7's "the GM approves each stay"? Recommendation: yes, one rule for lodging in and out of downtime.

## M5b and M7, so they don't overlap
- **M5b (this plan):** parts of the day; End expedition and Start downtime as two taps, full rest on Start downtime, plain End downtime; Safe / Hostile and the arrival card; the town screen with services and lodgings; Out and about and Active tonight with `onlyWhen`; buying, selling, lodging per night, town activities and the overnight card, with costs as text.
- **M7 (`plans/m7-downtime.md`):** everything about downtime itself: activities and threads, progress bars and rolls, troubles and clocks, moving time by any amount with summaries, End downtime's summary and clock ticks, the notes sheets; and, once M7b's purses exist, weekly lodging on Due, shared stays and their payment (dt-14), stored places (banks, vaults, strongboxes), fees, Spend…, auto-pay and unpaid dues.

## Fits the gate
The scripted trek gains a **town day** (day 4) in "M5b — gate run, in play order" (`docs/testing.md`): arrive at a Safe town, the arrival card, End expedition, Not yet, the town screen, Next part of day, Ask for… and Sell…, lodging, Out and about with a gated check, the overnight card next morning, Start downtime with its full rest, End downtime, and the same town in classic-advanced.

## Estimate
About 27–37 builder turns for 6.0 and 6a–6e (6.0 first; 6a after ⚑ 2 and 3).

## After the M5b gate

- **The item's own line on the GM's buy card** (a6-2, G-121; `design/rulings/m5b-area-6-cases-2026-11-05.md`): under the settlement's chances, Ask for… shows the asked item's `availability` in words ("Towns and cities · 3-in-6"; the rarity word or the note when that is all it has; nothing when the item has none). The GM still taps Hit or Miss; nothing is filtered. A test for each form; the checker accepts the shape and wants `where` to name the setting's sizes. About 1–2 turns, no migration.

## Departures

**Designer, 2026-11-04 (`design/rulings/m5b-overlay-rules-fragment-2026-11-04.md`, ov-1):** after the gate, a small follow-up: the town screen and downtime read a rules overlay's `rulesSets[]` fragment merged into the setting's rules set (lists by id, scalars top wins, `option` on entries). Test: "an overlay's money-changer appears beside the setting's services; its valuation service only while its option is on".

**Designer, 2026-11-04 (`design/rulings/m5b-settlements-followups-2026-11-04.md`):** SC-6e-1 ruled sf-2 (camp's `onGoodRest` on lodgings, lifestyles and the settlement default, offered at the morning, never automatic; after the gate; check 50 tail); #418's town-name finding ruled sf-1 (B in the database plus the show-the-town-too tap).

**Designer, 2026-11-04 (`design/rulings/m5b-builder-questions-3-2026-11-04.md`):** SC-6b-1 ruled A (Neither · Safe · Hostile on every place; 6c goes ahead); SC-6a-1 ruled A (only the clock between expeditions; thirds from 06:00).
(The builder keeps this current.)

### Step 6.0 (branch `m5b-6-0-town-switches`)
- **Start downtime is End expedition until 6a.** Today End expedition is what puts the campaign into Downtime, so that is where the switches reset. The database does it (a trigger on the campaign's move into Downtime, migration `20261104110000`), in the same change: End expedition's log line ends "… Out and about ended · downtime." and its Undo puts the switches back. When 6a splits End expedition from Start downtime, the reset follows Start downtime with no change (it rides the move into Downtime, whichever command makes it).
- **The morning's reset is a third command, `town.reset`** (Simple, the GM's), its own log line ("Out and about ended · morning."), run by the GM's device right after a move that crosses into the next day; the GM's card gets the same line. It is separate from the clock's move, so Undo on the move puts the clock back but leaves the switches off (the GM flips them on again from ⋯); the reset's own line can be undone from the log.
- **When the ⋯ items show.** Out and about today shows during an expedition while the current mode has a check with `onlyWhen: "outDay"`, or while the switch is on (so it can always be turned off); Active tonight the same with `"activeNight"`. Read from "as Travelling in darkness", which shows only in the modes it applies to. The marker on the strip is one quiet line under the title ("Out and about today · Active tonight"), the same line the players see (sw-4).
- **Where `onlyWhen` applies.** Everywhere a check comes due: the procedure (prompt and due mark, incl. the hour track's marks), a location's own check, Encounter check in ⋯, a Move…'s `alsoWhen` checks, and the Explore list of tables. A location's own check with `onlyWhen` still stands in for the mode's encounter checks while its switch is off (it just doesn't prompt).
- **Any other `onlyWhen` value** is read as none (the check runs as before); `pack:check` already warned on it (it was built with the 2026-10-30 rulings), so build order 5 only gained the plan's own example (`"rainy"`) as a test.
- **To a time (a correction)** doesn't reset the switches: corrections run nothing (05).
- **Test data:** `packs/_current` holds fae-woodland 0.3.17 (not 0.3.16); its settlement mode has the two checks (`town-day` with `outDay`, `town-night` with `activeNight`).
- Scope checks: none.

### Step 6a (branch `m5b-6a-time-in-town`, from #367's branch)
- **Where the parts of the day fall** (a technical choice; Francis may rule otherwise): a part is a third of the campaign's day (the `partOfDay` time unit, 8 hours on a 24-hour day), and the morning starts a quarter into the day (06:00): morning 06:00–14:00, afternoon 14:00–22:00, night 22:00–06:00. Equal parts keep the procedure engine's fixed step, and one Next part of day always lands in the next part wherever the clock was (09:30 → 17:30 afternoon → 01:30 night → 09:30 morning). The ruling names the parts, not their hours.
- **Next part of day is its own command, `time.partOfDay` (Simple)**, during an expedition in a town mode and in town; the other modes' main advances stay `time.advance` (Verbose). Its log line says "moved on to the next part of the day (8 hours)": the log doesn't know the campaign's day length, so it doesn't name the part.
- **The town switches' morning reset** (6.0) now falls at the start of the morning part in a mode whose step is a part of the day; in other modes still when the day changes (sw-3 as written).
- **The downtime reset moved with no new code**: 6.0's trigger fires on the move into Downtime, which is now Start downtime's (`start_downtime`). End expedition's log line no longer carries it; Start downtime's does ("… started downtime with a full rest (2 characters got abilities back). Active tonight ended · downtime.").
- **Start downtime's full rest is "every character in play"**: the campaign's approved, active player characters (who an expedition takes along), also those who stayed home; their rest and day ability uses come back (as Full rest). It doesn't heal HP: its "Downtime began" panel shows the setting's healing rule and **Heal** per character (the full rest's lines, one shared part, `FullRestPanel`). Offered in town only (⋯), refused while an expedition is under way; a second one is refused. End expedition's summary and its Full rest line (D23) are unchanged.
- **End downtime** is in the strip's ⋯ in Downtime (a toast with Undo); Start downtime in ⋯ in town (6b adds the arrival card's button).
- **"The current mode" in town** is the newest expedition's mode (after End expedition, the mode the party was in), or the GM's pick in the Mode row. In town the title is the mode's name and, for a town mode, the part ("Settlement · night"); the main advance is that mode's step, a plain move, shown secondary so Start expedition stays the one accent.
- **Secret check results** reach players at Start downtime (the existing trigger on the move into Downtime), no longer at End expedition. A party that sets out again without a downtime keeps them hidden until the next one.
- **Words:** End expedition's line under it changed from "The party leaves and downtime begins" to "The party stays where it is; downtime is its own step" (dt-2 made the old words wrong; 05 B7 updated). Start downtime: "A full rest for everyone, then time passes by the day"; End downtime: "Back to adventure time; the party stays where it is".
- **Tests changed with the behaviour:** `sceneTime.test.tsx` (End expedition stays in Adventure), `sceneReminders.test.tsx`, `supabase/tests/m5-clock.test.ts`, `m5-reminders.test.ts` and `m5b-6-0-town-switches.test.ts` (reveals and the reset come with Start downtime), and the gate's trek (`m5bGate.test.tsx`, checks 45 and 51).

**Scope check SC-6a-1 (technical; built as A, waiting for the ruling): does the town's procedure run in town, with no expedition?**
- *What:* after End expedition, Next part of day in town is a plain move: no expedition is under way, so nothing in the procedure runs, and a town mode's checks (fae-woodland's town-day and town-night, gated by the switches) don't come due there. They do during an expedition in the town mode. The gate run puts check 48 (the switches with a gated check) after 45 (End expedition).
- *Options:* **A** as built: the checks run during an expedition in the town mode; in town between expeditions the clock moves only (the switches still reset at the morning). **B** the town mode's procedure also runs in town with no expedition (its checks, the switches' gating, the card): the engine counts steps from an expedition's start, so it needs an anchor (the last expedition's end, or the day), and the card and rest flows read the expedition; about 3–5 more turns, as a 6a follow-up.
- *Recommendation:* B if the town's checks matter between expeditions at the table (the gate run's order suggests so); with A, check 48 moves before 45.

### Step 6b (branch `m5b-6b-arrival-card`, from #377's branch)
- **The setting on the place card is three-way: Neither · Safe · Hostile** (a `ButtonRow` labelled "Safe or hostile", with a hint line under it), and a new place is **Neither**. Nothing in the app or the packs says which places are settlements today, so "Safe (the default)" can't be read as "every place": every dungeon room would raise the card. See SC-6b-1. One column, `places.safety` (`safe` · `hostile` · none), read only by the GM like the rest of the row; `place.setSafety` (Verbose, the GM's) with Undo on its toast. Migration `20261104130000_m5b_6b_safe_places.sql` (adds the column and the log row; changes no function, drops nothing).
- **What counts as an arrival** (technical): the newest place a group is at, when it isn't that group's first place in the expedition. Setting out from a safe town (Start expedition's Where?) is not coming back, so it raises nothing. Where now?, Move… and a player's forced-march arrival all count: the GM's device reads where the groups are again with each log line.
- **A split party** (technical): the card is up only when **every** group's current place is Safe ("the party is back"); the newest of those visits is the arrival.
- **Not now is kept on the GM's device**, by arrival (the newest 50). A second GM device would show the card again; the next arrival raises it again anyway.
- **One accent:** while the card is up, the strip's main advance turns secondary, so End expedition is the screen's one accent (as the mockup draws it).
- **The card's End expedition is the strip's own** (`askEnd` in `SceneTime`: the dungeon-exit rule's escape rolls first when that's on, then `endNow`); one `expedition.end` line either way.
- **The second card sits on the strip's own Expedition ended summary** ("Staying a while?" · Start downtime · Not yet, no accent; `EndSummary` gained `children`), shown when the expedition ended while the card was up (its button or ⋯'s). Start downtime is 6a's `beginDowntime`. Not yet takes the question away; the summary stays until closed. Undo on the summary brings the expedition and the card back.
- **Words:** the card's line under the title reads "Ending the expedition sums it up and offers a full rest." rather than the mockup's "splits the loot, awards XP and offers a full rest": the split and Award XP aren't built until M7 and M7b (dt-3); the line gains them then.
- **SC-6a-1 doesn't touch 6b:** the card comes during an expedition (arrivals are kept per expedition); in town between expeditions there's nothing to arrive at.
- **Pictures:** no gallery picture changes (the place card and the strip aren't in the gallery); the card has no layout journey yet (the jsdom journeys in `src/app/arrivalCard.test.tsx` cover it).
- **Docs:** 04 Place (safety), 05 Settlements ST2 (as built), 06 Settlement line and the inventory row "Arrival card" (replacing "Arrival choice").

**Scope check SC-6b-1 (design; built as A, waiting for the ruling): which places can be Safe or Hostile, and what a new place is.**
- *What:* ST2 says "each settlement place is Safe (default) or Hostile", but no field marks a place as a settlement (places are typed names; the packs' settlements aren't places until M8b), and 6c's town screen will need the same answer ("a settlement place shows the town screen").
- *Options:* **A** as built: every place has Neither · Safe · Hostile, a new place is Neither; Safe or Hostile is what makes it a settlement place (6c reads it), and a safe room in a dungeon is marked Safe too. **B** a separate "This is a town" mark on the place, Safe by default once marked, Hostile as its other value (one more control; a safe dungeon room would have to be called a town, or get a third value). **C** settlement places come from the setting's settlement mode (a place first reached in it is a town): fails classic-advanced (no settlement mode, ST12) and arrivals by Move… in the travel mode.
- *Recommendation:* A (one row, matches "Safe also covers a safe place inside a dungeon"); if B, the database column stays and gains the mark.

### Step 6c (branch `m5b-6c-town-screen`)
- **One migration, though 6c's section names none** (technical): build order 2 ("hidden places never reach their devices, row-level security") needs the GM's choices stored where players can't read them. `20261104170000_m5b_6c_town_screen.sql` adds `places.town` (jsonb, on the GM-only places row), `public.scene_town` (a player's shown places in town), a check trigger, a signal trigger, and the two commands' `logged_commands` rows. It replaces no function and drops, renames or deletes nothing. Applied to the test project.
- **What a settlement place is:** one marked Safe or Hostile (bq3-1). The town screen sits inside the GM's place card, under Safe or hostile, during an expedition; the card's own pieces and picture are its overview. In town and in Downtime (no expedition) it stands on its own with the town's name and Safe or Hostile on top, at the newest expedition's last place (End expedition leaves the visits where they are, dt-2). The place card itself (pieces, Safe or hostile) still shows only during an expedition.
- **Show players and Open / Closed are kept per place, not per visit** (technical; Francis may rule otherwise): a shop shown stays shown on the next visit and for every group in that town, and players see it on Scene whether the town is Safe or Hostile (they never see which). Pieces are per visit (g2); a town's shops felt like the town's state, not the moment's. A place nobody touched is hidden and open.
- **Places in town** (from the pack, st-2 and dt-46): the services that are places to go, as **Shops** (`buy`, `sell`, `identify`) and **Others** (`store`, `loan`), and the **Lodgings** (`downtime.lodgings[]` of a rules set, with their rates in words). Temples have no data until M8b. Each row: the name, what it does ("Shop · buys at 50% of the price", "Lodging · 2 sp a night"), the pack's note, the pieces' eye (Show players) and `ButtonRow` Open · Closed. Narrow rows (a phone, or the tablet's side column) wrap the two controls under the name.
- **Things to do** are the services of kind `other` (07: "offered as a town activity"), the GM's in 6c, each rule behind ›. The players' town activities are 6e (ST8).
- **Encounters** (the GM's): the current mode's checks (the expedition's, or the last one's in town) with "only while …" for `onlyWhen`, and the two switches as Off · On rows, offered as the strip's ⋯ offers them (sw-2); between expeditions a line says "They come due only during an expedition." (bq3-2).
- **People and Rumours** have no data before M8b, and 06 shows a section only with data: one quiet line at the foot says "People and rumours come with an adventure's town."
- **The lifestyle's daily cost** (Overview) reads `downtime.lifestyles[]` as `{ name (or tier), rate (or cost), per? }`, "a day" by default: 07 names the list, not its fields, and no pack has one yet. Neither current pack has lodgings or lifestyles, so those two show only in the tests.
- **A player's view** (Town on Scene): "Places in town" under the place line (the town's name on top when there's no place line, as in town), each shown place with what it does (from the player's own pack, by the key) and Open or Closed; nothing else of the town.
- **Pictures:** no gallery picture changes (the town screen isn't in the gallery). Layout journeys: none added; the jsdom journeys in `src/app/townScreen.test.tsx` cover it.
- Scope checks: none.
- **Follow-up (`m5b-6c-town-shown`, 2026-11-04; the fresh-session review's finding 2, ruled B through Design):** the town's name and entries reach players only once the place itself is shown to their group (a piece of it shown on the visit, the rule since g2; `public.scene_town`, migration `20261104231000`). The first Show players in a town players don't see yet shows the town with it: its description piece, in the same request (one log line "showed players <town> and <entry>", one Undo hiding both; `town.showPlace` joins `undoable_makings`). With no description piece there's nothing to show the town with: the tap explains ("Players see <town> once a piece of it is shown: add a Description to the place first.") and changes nothing — a builder's choice where the ruling is silent (the alternative, showing some other piece, would surprise). Design writes 05 and 09. Brought up to date with main on 2026-11-05: #456's test "drops a shown place from the player's line when its option goes off" gives Quay Gate its Description and expects the combined toast for its first tap, as this rule needs (test only; behaviour unchanged).

### Step 6d (branch `m5b-6d-town-switches`)
- **Nothing left to build.** 6d's section says it moved to step 6.0 (#367); its one remaining line, "the town screen shows the same two switches (sw-2)", came with 6c (#418: Encounters' Off · On rows call the strip's own `town.outDay` / `town.activeNight`). This step adds the missing test: a flip from the town screen is one Simple line, kept with the campaign, marked on the strip, and undone from its toast (`src/app/townScreen.test.tsx`). No migration, no UI change, no new manual check (6c's list already has the flip).
- **Not built here:** buying, selling, lodging, town activities and the overnight card (ST5–ST9, dt-11) are step 6e.
- Scope checks: none.

### Step 6e (branch `m5b-6e-town-requests`)
- **One migration, `20261104190000_m5b_6e_town_requests.sql`** (applied to the test project): two columns on `requests` (`reply`, `replied_at`), `private.request_rules` replaced from its newest copy (20261102202000) with three marked changes (buy and sell get the hitMissChoice and offer answer kinds; a listed lodging the GM shows, open, in the asker's group's town is answered at once; the requester's one reply to a priced answer), `public.reply_request`, and rows: `request.reply`, `town.stay` (logged_commands), `town.stay` (undoable_makings), `request.reply` (undoable_deletions). Drops, renames and deletes nothing. No new request table: buying, selling, Somewhere else… and town activities are `requests` rows of kinds `buy`, `sell`, `lodging` and `askGm` (the kind M5 reserved for asking the GM).
- **The reply** (technical): 05's two-turn kinds (Hit / Miss then a choice; Offer → Accept / Decline) needed a player's second turn, which the request rules refused once answered. It is `request.reply` (Simple, the requester's, once).
- **Buy it has no Undo** (hard rule 4): it brings the item into the pack as bought (inventory.add's line, the price as text) in the same request as the reply; the generic Undo never removes a made line (only an activity's yield may, by ruling), so Buy it is like Add: Remove takes it out. Leave it, Accept and Decline have Undo; Accept takes the item out (inventory.remove, "sold"), and Undo puts it back. The migration's header says "one Undo puts both back" for both: true for a sale only (an applied migration's comment can't be edited). A one-off bought with **Something not listed…** comes in as a player's one-off, so it waits for the GM's approval like any other.
- **Hit / Miss** (ST5): the pack's availability is by town size and a place has no size, so the GM's card shows every size's chance in one line ("Hamlet 0% · Small town 100%") with the pack's note and the item's own availability text; Hit / Miss is the GM's own roll on this device, not logged, and only decides which answers follow (Hit: In stock · Price… · Not here; Miss: Price… · Not here). With no availability in the pack the answers show at once. A technical reading; Francis may rule a town size on the place instead.
- **The sale suggestion** (ST6): the item's pack price × how many × the share (by the service in `salePrice.byService`, then the service's own `rate`, then `salePrice.default`), rounded down, in the setting's coins. No price or no share: "The pack suggests no price for this", and the GM types the offer. The GM has Offer only (the ruling names no "not interested"); an offer is words.
- **Lodging** (ST7 with dt-11, st-3): the list is the lodgings the GM shows (hidden ones never reach the player, 6c); a closed one explains itself on Stay here. A stay stands until changed ("Change any time", the mockup). **Per night, cost logged as text** is read as: the pick's log line carries the rate ("… chose to stay at … · 2 sp a night") and each morning's card says it again; a line per night is a repeating cost, M7b's (the plan's scope checks). The mockup's **Sleep rough** row isn't built: no pack lists it, and the plan doesn't name it.
- **Town activities** (ST8): the town mode's own activities (not secret, option-gated) and the setting's services of kind `other` (6c's Things to do), each with its rule and cost in words, plus Something else…; each is a request the GM answers Yes or No with a note (the GM narrates). Their cost ("a part of the day") isn't applied: time is the party's, and the GM moves it. "The app offers the result (a rest day's heal)" waits on SC-6e-1.
- **Where the player's town shows:** with the places in town (6c's TownLine), so only once the GM shows at least one place there (players can't otherwise know they're in a town: Safe or Hostile is the GM's).
- **The overnight card** (ST9): built on the player's device from what it can read: at the first morning in town (06:00, 6a's parts), last night's stay (the newest picked before the morning, in this town by name, with its rate) and the character's statuses that started or ended overnight; shown from the morning until the night, until Got it (kept on the device, one per morning). Nothing is written: nothing is applied yet (no HP, SC-6e-1). A stay from an earlier visit to the same town counts until changed (fragile: the player's device can't tell visits apart).
- **Words:** "Ask for…", "Something not listed…", "Sell…", "Someone else…", "Where you stay", "Somewhere else…", "Stay here", "Things to do", "Something else…", "Send to the GM", "Buy it" / "Leave it", "Accept" / "Decline", "In stock" · "Price…" · "Not here", "Offer", "Not available", "Morning in <town>", "Got it".
- **Pictures:** no gallery picture changes (the town and requests aren't in the gallery). Journeys: the jsdom journeys in `src/app/townRequests.test.tsx`.

**Scope check SC-6e-1 (design; that part stopped): what heals overnight in town, and a rest day's heal.**
- *What:* ST9's card shows "HP healed and why", applied with the GM's next part of the day, and ST8 says the app offers a rest day's heal. No pack field says how much heals: fae-woodland's healing is text ("1 HP per night in a settlement"; its rest-day activity's `result` is "Heal 1d3 HP …"); lifestyles and the mockup's Sleep rough say "no healing" in words; classic-advanced says nothing per night. Start downtime's full rest (6a) shows the rule and **Heal** per character for the GM.
- *Options:* **A** a pack field for overnight healing in town (say `settlement.overnight: { heal: 1 }`, with `heal: 0` on a lodging or lifestyle that gives none, and an activity's `heals` for a rest day), applied by the GM's morning move for every character with a stay, each line "+1 HP · a night at The Lantern Rest" on the card; one migration (the morning applies HP), pack session work for both settings. **B** no field: the morning move opens a panel for the GM like Start downtime's (the healing rule as text, **Heal** per character), and the players' card lists what the GM healed. **C** the card shows the rule as text only; players heal themselves with the HP pad.
- *Recommendation:* A for the table's calm (no GM taps each morning), B until the packs carry the field.

