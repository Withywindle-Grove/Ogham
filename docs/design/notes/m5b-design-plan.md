# M5b design plan (v2, for approval; pack check added)

Status: proposal · 2026-10-30 · design agent. Converted from the design agent's notes: aliases only; the packs' costs, chances, multipliers and modifiers are replaced by "the pack's …" (the private packs hold them). The approved result is `../rulings/m5b-wilderness-2026-10-30.md` and the specs.

**M5b scope (08):** wilderness play before M6: the travel budget in the pack's own name and unit, forced march and carry-over; terrain and mount warnings; weather and seasons (special seasons switched by the GM); camp with watches, the night check and sleep offers; activities and Other… (Propose an activity… for players); getting lost, Secret or Open; Show hex numbers to players; activities in day modes (X-2). Gate (calendar Nov 15): a mock 3-day trek with weather, a lost check, a forage and a camp.

**What exists already:** 05 specifies most of M5b's behaviour (S17, X-1/X-2, G-07, the 2026-10-29 engine rulings). M5 built the clock, procedure engine, Scene tab, time strip, reminders, Hit/Miss and the minimal location ("Where?", with an optional terrain). 06's inventory has rows for the Budget line, Tick-confirm and Watches, but **no wilderness screen has been mocked up**. So M5b design is screens plus a few real gaps, not a blank page.

**Test data (private):** fae-woodland 0.3.2: a travel-points budget derived from speed, three terrain classes with their own costs and lost and wandering chances, roads and tracks, forced march, a rest day every few days, weather by season with tags, day and night wandering checks with columns (road/wild, fire/no fire), camp with firewood, about fifteen activities. classic-advanced 0.6.2: miles with terrain costs, about a dozen terrains, lost and wandering checks once a day, camp reusing the day's check.

## Design items

| # | Item | Kind | Known issues to settle |
|---|---|---|---|
| M5b-1 | **The GM's wilderness day** (Explore in a day mode, tablet and phone): the procedure strip, budget line, current place and terrain, activities row, Next day | Screens | ⚑ How a move spends the budget: setting "Where?" alone, or a **Move to…** that asks the terrain (or road/track) and takes its cost. No hexes until M8b, so the GM names or picks a place and its terrain on the fly |
| M5b-2 | **Travel budget** (points or miles, slowest member, mounts and carts, GM override, carry-over, forced march, rest every N days) | Screens + rules | ⚑ The two models: a points budget (fae-woodland) vs miles cut by terrain (classic-advanced). One budget line must read right for both |
| M5b-3 | **The day's checks: lost, wandering, weather** (start / middle / end of day, road and track modifiers, weather tags feeding checks, table columns) | Prompts | ⚑ What "lost" means without a map: a GM-only **Lost** status on the party in Secret mode (the true position arrives with hexes in M8b)? ⚑ Columns that depend on state (road or wild; fire or no fire) picked automatically or asked? |
| M5b-4 | **Activities in day modes** (forage, hunt, fish…; who acts, cost from the budget or clock, item to pack or stash; Other… and Propose an activity…) | Prompts | Fits the X-2 Act… pattern from M5; the row shows only what's usable here and now |
| M5b-5 | **Camp and night** (watches by drag, fire on/off, the night check naming the watch, sleep offers with Tick-confirm, quick camping) | Screens | ⚑ Where camp opens (time strip ⋯ only, or a step at the end of Next day as the packs' procedures already have) |
| M5b-6 | **Players' wilderness Scene** (phone and tablet): date, season, weather, budget left, place and terrain, own watch, Propose an activity…, the reference list | Screens | Hidden means hidden: no tables, no GM modifiers, nothing in Secret mode |
| M5b-7 | **Settings** (Getting lost: Secret / Open; Show hex numbers to players; quick camping; special seasons) | Confirm | Placement in Rules for this campaign (Adventuring group) |

## Pack check (2026-10-30): both packs against this plan

Checked classic-advanced 0.6.2 and fae-woodland 0.3.2 field by field.

**One budget model, not two.** Both packs use `movement.kind: "budget"`; classic-advanced's miles already carry per-distance costs by terrain and road, converted from the book's own terms. The budget line reads the same for both. (Closes the M5b-2 ⚑.)

**Covered by the plan and 05:** budget from the slowest member, forced march, carry-over, periodic rest with each pack's condition, terrain cost and check chances (fae-woodland through terrain classes), mount and vehicle warnings (classes' `mounts` ride/lead/none, `vehicles`), lost and wandering checks with road and track modifiers, weather by season with tags (some tags slow travel or raise the lost chance), once-a-day dedupe for classic-advanced's camp, Check again for packs that allow several checks a day, activities with skills, bestOf, fullDay bonus, `requires.item`, bySeason yields, secret search, Other….

**Gaps to add to the design (new ⚑):**
- ⚑ **Route type drives more than the lost check.** fae-woodland's day wandering table picks its column by road or wild, and water travel has its own costs (lake, river downstream, river upstream). So a move needs a route type: wild, road, track, river down/up, lake.
- ⚑ **Camp fire as real state.** fae-woodland's night table picks a column by fire or no fire; wet weather makes fires hard. Camp needs a Fire lit / No fire toggle that feeds the night check.
- ⚑ **Sleep is per character with two outcomes.** fae-woodland: a sleep-difficulty step, then an ability check each; good rest heals, bad rest marks Exhausted and unrested spells; cooking and entertaining each give a bonus. One Tick-confirm with Good / Bad per character, the modifiers listed.
- ⚑ **Darkness is set by the GM, not rolled.** A "Travelling in darkness" toggle adds the tag (raises the lost chance). Daylight by month gives the hint.
- ⚑ **Regional encounter tables need a region.** fae-woodland's wandering hit rolls a type, then a regional table. Until G-05 regions, the GM picks the region's table when the type says Regional (the place can remember it).
- ⚑ **Lost has a recovery roll.** fae-woodland: with the right skill in the party, a chance to find the way. Lost becomes a party status (GM-only in Secret mode) with a daily recovery prompt when the pack gives one.
- ⚑ **Special seasons do more than swap weather.** One swaps encounters at the pack's chance (`encounterSwap`); some start on a chance on set days. R1: the GM switches them by hand; offer a quiet reminder on their start days.
- ⚑ **Settlement mode** (fae-woodland's third mode: town days, encounters only when out and about, earn money, gossip, rest day, herbalist) wasn't in the plan. It needs the mode switch mid-expedition (wilderness → settlement → wilderness) and its activities; money results stay notes until purses (M7b).
- ⚑ **Scope check: daily rations.** Both packs expect food each day (fae-woodland's hunger and spoilage rules; classic-advanced rations). Not in M5b's scope. Option: a daily "Eat: ✓ ✓ ✓" Tick-confirm that takes a ration from each pack, with a warning when someone has none. In M5b, or parking lot?

**Pack tasks (data, not design):**
- Activity results are text. For "the item goes to the pack" the pack needs `yields: { item, dice }` (fish, forage, hunt, find food).
- classic-advanced has no mounted or vehicle speeds; the budget uses the GM's override until a pack gives them.
- fae-woodland's asleep-on-watch option is text only; the Watches step shows it as the rule (structured later if the table wants it).

**Deferred, already planned:** hex grid and hexes (M8b), the setting's special routes and sites (G-05), sea travel and wind (text only), encounter distance and surprise (M6), exploration XP deeds (M7's XP waiting, as Bonus XP).

## Order of design sessions (proposal)

1. M5b-1 and M5b-2 together (the day screen and the budget: everything else sits on it)
2. M5b-3 the day's checks and weather
3. M5b-4 activities and M5b-5 camp
4. M5b-6 players' view and M5b-7 settings (light)
5. A short **paper dry run**: the gate's 3-day trek on paper, like the fight and tables runs

Each session: proposals with mockups in light and dark (buttons drawn as plain blocks), the uiux self-review run and stated, rulings, then 09 lines.

## Risk

The M5b build is due Nov 15. Design should finish before M5's step 13 (gate) so Claude Code can plan M5b while the M5 gate runs. Five short sessions fit if we take one or two a day.
