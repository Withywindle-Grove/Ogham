# Pack review, area 2: exploration and time (pack session, 2026-11-03)

The second rule area of `plans/pack-review-method.md`, with the options audit (step 5). Packs: classic-advanced 0.6.14 → 0.6.15 → **0.6.16**, fae-woodland 0.3.14 → 0.3.15 → **0.3.16**, and the wilderness add-on (0.2, retired after the re-check). Shapes only here: no rules text, numbers or names from the books.

## 1. Map
| Book chapters | Pack parts | App (read-only, `main`) |
|---|---|---|
| classic-advanced, Player's volume: time, weight and movement; ability checks; hazards; dungeon, wilderness and waterborne adventuring; encounters; evasion and pursuit; vehicles' movement. Referee's volume: running the game; the dungeon and wilderness encounter tables | rules set `time`, `movement`, `healing`, `procedures`, `exploration` (two modes), `skills`; `lightTypes`; encounter tables; the add-on's four tables | `modules/expedition/*` (modes, checks, travel, camp, sleep, eating, weather, daylight, dungeon exit, activities), `app/SceneTime.tsx`, `CampCard`, `TravelCard`, `WeatherCard` |
| fae-woodland, players' volume: basic procedure, core rules, time and movement, hazards, travel, camping, settlements, dungeons, encounters; the calendar. GM's volume: ley lines, shrines, fairy roads, dungeon environment, traps, secret doors, seasons and unseasons, weather, getting lost, encounters, fishing, foraging, hunting. bestiary volume: the encounter endpapers | rules set `time`, `seasons`, `specialSeasons`, `daylight`, `weather`, `lost`, `exploration` (three modes), `hazards`, `hunger`, `dungeon`, `dungeonExit`, `fairyRoads`, `leyLines`, `shrines`; 60-odd tables; `lightTypes`; the calendar | the same |

## 2. Full read
Every chapter above, read in full.

## 3. Values by script
- **Tables:**
  - A checker found each row of every page-sourced table on its book page.
  - Structured parsers read the bestiary volume's encounter endpapers and the Referee's volume's dungeon and wilderness tables, and compared every row's name and count.
- **Mode data:** terrain classes and terrains, the sleep table, daylight by month, unseasons, light types and the encounter-type matrix.
- **Results:** all match the books except the items below.

## 4. Book × pack × app: what was wrong or missing (fixed today unless marked)

### classic-advanced 0.6.15
| Rule | Was | Now |
|---|---|---|
| Wilderness encounters | The terrain table names sub-tables by letter; the pack carried only the forest one (the barren one sits in the add-on) | Eight sub-tables (30 tables, 600 rows) from the book, with stat-block links where one stat block fits |
| Hunting | The pack said a success feeds a number of people (foraging's yield) | As the book: a success is an encounter with edible animals, beside the day's wandering check |
| Wandering checks outdoors | The camp re-rolled the day's check at night: two a day | One a day; the note says the referee may add more |
| Dungeon movement in familiar areas | Missing | `familiarFormula` (the referee may allow faster movement) |
| Rations | No `food`, so the camp's eating step couldn't suggest them | Standard fresh, iron preserved |
| Light spells | One caster of Light had no light type; Continual light had a type nothing pointed to | Both linked |
| Checked and matching | — | Time units, rest, the dungeon turn and wilderness day procedures, lost and wander chances by terrain, terrain costs (converted from the book's percentages; corrected in 0.6.16: barren travels at the open rate and broken lands is its own terrain), forced march, foraging, searching, listening, doors, all six dungeon tables (240 rows), the by-terrain table and sub-tables 1, 2 and F, light types and durations |

### fae-woodland 0.3.15
| Rule | Was | Now |
|---|---|---|
| The camp (sleep, campfire, cooking, campfire talk) | The app reads `camp.sleep`, `camp.fire`, `camp.cooking` and a campfire-talk modifier (built in M5b); the pack carried none: the sleep step pointed at a plain table and fire, cooking and talk were one note | All four, from the book; fire, cooking and camaraderie as their own steps |
| Sleeping in a dungeon | No camp for the dungeon mode | Its own camp (the wilds' sleep rules, no campfire, the referee's fewer checks) |
| Food and finding it | No `food` on rations; foraging and fishing gave no item | `food`; foraging and fishing `yields` fresh rations (foraging by season, as before) |
| Fever Marsh encounters | Rows 6–20 shifted by one: a creature twice, one missing | Rebuilt from the book |
| Mulchgrove encounters | One count wrong | Fixed |
| Ten tables in the pack's own words (written before the exact-wording ruling) | Dungeon doom, getting lost, two reaction tables, trap effects, secret door locations, three party-quest tables | The books' words (trap clues as notes) |
| Light spells | No light types | Three, linked by `lightTypeId` (the app doesn't light spells yet: G-113) |
| Checked and matching | — | Time units, movement (exploration, familiar, running, travel points), terrain classes (all twelve terrains), routes, forced march, rest, the travel, camp, settlement and dungeon procedures, the sleep table, the weather tables and their effects, getting lost (chances, visibility, the hunter), the regional and common encounter tables (the other 14), unseasons, daylight by month, fishing, foraging and hunting rules, the dungeon exit (added in 0.3.14) |

### The wilderness add-on (0.2)
All four tables match the book. The same sub-table (barren) is now in classic-advanced as well, so the add-on is redundant. With both attached, the higher pack wins and the content is identical.

## 5. Options (method step 5)
The options touched here are in `plans/options-audit-2026-11-03.md`:
- quick camping, asleep on watch, weather effects, dungeon adversity, dungeon exit, safe paths;
- classic-advanced's wind conditions.

Today's camp fixes give quick camping and falling asleep the sleep rules they work beside. No row's status changes, except that the camp's fire, cooking and talk now appear for fae-woodland: they were built but unused.

## 6. Gaps (in 11)
G-106 … G-114:
- **G-106** water travel at a vessel's speed, the daily wind roll changing it, a navigator's lost chance;
- **G-107** flying travel (double distance, terrain ignored, its own wander chance);
- **G-108** a day's food smaller than the pack's ration bundle;
- **G-109** yields worked out from a fight (game by hit points and size);
- **G-110** cooking's bonus (and a fumble's penalty) on the night's sleep check;
- **G-111** food that spoils by place;
- **G-112** one roll with two outcome bands, up to three times a day (fairy roads);
- **G-113** light from a spell;
- **G-114** a matrix whose cells name sub-tables.

## 7. Not carried, on purpose
- The fairy roads' location tables, the ley lines and shrines: region content, for the region pack (M8b).
- The dungeon-design aids: random dungeon areas, caches, trap and secret-door type tables, opening mechanisms, clues, tricks.
- Settlement services: area 6.

## 8. Found here, other areas
- Hiring reactions, rune granted and the witch's oyster tables are also in the pack's own words. The parser didn't read their layout, so they're left for areas 5 and 6.
- The giant toad has no stat block in classic-advanced (area 4).
- The add-on's barren table and the base's are now duplicates (ids match).

## 9. Passes
- **Pass 1:**
  - The full read.
  - The page checker over all 153 fae-woodland tables.
  - Mode data by script.
- **Pass 2:**
  - Structured parsers for both settings' encounter tables. They found Fever Marsh, Mulchgrove and the missing sub-tables.
  - The app's camp, sleep, cooking, food, yields and light readers, against what the packs carry. Found the unused camp shapes.
  - The re-run checker: what's left is line-break hyphens and the encounter tables' comma-for-dash name style. The structured parsers checked those tables, and their names match the stat blocks.
- **Pass 3:**
  - pack:check and the copy check on both rebuilt packs: only the known notes.
  - Idempotent rebuilds.
  - Nothing new.
- **Not checked:**
  - The app on screen with the new data.
  - Hunger's effects in play: whether the app applies the effects table wasn't traced.
  - Vehicles' movement (area 3).
- **Independent re-check:** done; see §10.

## 10. The independent re-check (2026-11-03)
A fresh `pack-reviewer` session re-checked area 2 and found 18 points the passes had missed. Each is fixed in fae-woodland **0.3.16** and classic-advanced **0.6.16**, logged as a gap, or waiting on a ruling.

| # | Point | Result |
|---|---|---|
| 1 | No speed came from fae-woodland's loads: plain numbers where the app reads text; a "medium" armour row the app can't use; slot rules in an unread shape | Fixed: text speeds; rows none / light / heavy, with medium on the heavy row (the book's "Medium or Heavy"); `armourType` on the six armours, which also stops false armour warnings for classes with armour lists. Slots: G-115. Each choice checked for a speed: weight and basic weight give one, slots don't |
| 2 | Night encounter rolls opened on the day's road column (column ids instead of labels) | Fixed |
| 3 | The lost roll didn't come when the party leaves a road | Fixed (`alsoWhen`) |
| 4 | No generic dungeon wandering tables | Fixed: the six level tables, linked from the dungeon check |
| 5 | The lost-consequences notes named a secret / open setting that didn't exist | Fixed: an option (reference; the options audit has it) |
| 6 | weather-effects on by default, though the book marks it optional | Fixed: off by default |
| 7 | Nagwood row 16: the two volumes give different counts | Recorded in the table's notes; the pack follows the bestiary endpaper (the source of every regional table). Francis ruled: keep (2026-11-03) |
| 8 | Town encounter checks had no `onlyWhen` | Fixed (data); the app doesn't read it yet (builder) |
| 9 | The campfire radius isn't in the book; the permanent holy light had no light type | Radius marked as the pack's choice. No light type for the permanent light: it's fixed to a spot and never burns down, so there's nothing to time |
| 10 | No speed in classic-advanced's detailed loads | Fixed: `movement` on each tier |
| 11 | Wilderness chaining never resolves (exact, case-sensitive match; ids must be lower case) | Not fixable in data: G-114 rewritten |
| 12 | Foraging and hunting ignored the barbarian's and ranger's better chances, and weren't the party's roll | Fixed |
| 13 | Barren slowed without a book basis; settled lands' lost chance not in the book | Barren at the open rate, broken lands added (no chances of its own: the book gives none); settled marked as the pack's choice |
| 14 | The trek budget was called miles but spent in mile-points | Renamed "Travel", points |
| 15 | Listening ignored the thief's and assassin's hear-noise | G-116 |
| 16 | wind-conditions did nothing | Both wind tables added as reference; the options audit says reference only (G-106) |
| 17 | The druid's path-finding and the ranger's awareness are text | G-117 |
| 18 | The stuck-door note said a door can be tried again | Fixed, as the book says |
| — | The wilderness add-on | Retired from `_current`; its meta says superseded |

## 11. Rulings applied (ex-1 … ex-7, ga-1 … ga-4, st-2) and the seeded-campaign run (2026-11-03)
Versions: classic-advanced **0.6.17**, then **0.6.18**; fae-woodland **0.3.17**, then **0.3.18**; zine overlay **0.5.8**, then **0.5.9**.

| Ruling | Applied |
|---|---|
| ex-1 chaining by normalised text | classic-advanced: `nextTablePattern` on the terrain table, and a script confirms every cell resolves. fae-woodland: on the encounter-type table; "Regional" goes on through the region's table, on purpose |
| ga-2 a result that splits by terrain | classic-advanced: "C-Human" keeps the book's words and carries `next.byTerrain` (city or settled sub-table). There's no `default`, so the row's other columns aren't sent there |
| ex-2, ga-3 class traits on checks | classic-advanced: the druid's path-finding as a set chance in forest. The ranger's awareness has no check to sit on, because surprise isn't a mode check in either pack |
| ex-3, ga-4 a skill standing in | classic-advanced: listening is the better of the base chance and hear noise (`fill.best`, and the activity's skill list). Not tried in the app: hear noise is a range in the class table ("1-2") |
| ex-4 optional rules off | classic-advanced: morale off, encumbrance none. fae-woodland: weather-effects off. Non-lethal stays on (a core rule, with a note) |
| ex-5 when volumes disagree | Nagwood row 16: Francis ruled to keep the bestiary endpaper's count; the table's notes record the other value. No other conflict found |
| ex-6 budgets in points | classic-advanced's "Travel" points stand |
| ex-7 options run by hand | 79 options marked `manual`; the list is in the options audit |
| ga-1 slot bands | fae-woodland: `slot.bands` (equipped, stowed), `combine: "slowest"` |
| st-2 settlement fields | fae-woodland: 11 services with kinds and rates, availability by size (uncommon items only in towns and cities), the sale price, the settlement step as a part of the day. classic-advanced: the base town's three services; its volumes give no rates, availability or sale rule |

**The seeded-campaign run (tester):**
- Glamours and knacks didn't reach First spells: `known.listLevel: 1` for the enchanter, the three kindred-classes and the zine's kineticist and runesmith, which had the same fault. Every level-1 count fits its list. 07 and `pack:check` still say `listLevel` is 0 (G-119).
- The hunter's and knight's kits were already right in 0.3.16: the armour items lacked `armourType`. The book's armour lines match every class, and a script checking every kit line against its class's rules finds nothing in any of the three packs.
- Cantrips with no overlay can't be finished (G-118, for the designer).
- Also found: the settlement sizes table carried broken dash characters (fixed).
- `distinct: true` (bq-1): no kit roll in the three packs' books says its results must differ, so none is set. The zine's "re-roll duplicates" is on a trait list, which the field doesn't cover (G-120). The converter's playbook now has the check.
