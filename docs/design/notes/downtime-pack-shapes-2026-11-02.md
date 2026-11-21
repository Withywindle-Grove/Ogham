# Downtime: the packs' shapes against the proposed format (pack session, 2026-11-02)

The pack session's survey of **downtime-reference** (the whole supplement read), the downtime options in **classic-advanced** and **fae-woodland**, and the downtime pieces in **zine-compendium**, mapped against "Proposed for 07" in `design/rulings/m7-downtime-2026-11-02.md` (dt-16, dt-17, dt-27, dt-31, dt-32, dt-37, dt-38, dt-41). These are shapes only: no rules text, no numbers and no names from the books. Activity names are generic. Nothing is converted yet. The pack waits for the designer's format ruling.

**Key:** **F** fits as proposed · **C** needs a change · **M** a field is missing · — not used.
Columns: **Kind** = `kind`, `skippable`, `period` · **Dur** = `duration` · **Cost** = `costs` · **Roll** = `roll` and `bands` · **Prog** = `progress` steps · **Trbl** = the troubles table with `clock` and `whenItRunsOut` · **End** = `atTheEnd`.

## The activities

| # | Activity (generic) | Source | Kind | Dur | Cost | Roll | Prog | Trbl | End | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Founding or bolstering an enterprise | downtime-reference | F | F | C: cost set by the current step, a founding cost, extra spending buys a modifier | C: modifier from spending, capped | C: the GM picks the start step; each step grants benefits | M: a row that shuts the enterprise; a row that charges every downtime until settled; a row that is a choice; amounts scale with the step | F | **missing** |
| 2 | Befriending a person | downtime-reference | F | F | — | C: the middle band advances only if the character meets the person's need | M: the tracker lives on a person; its steps change other activities' rolls | — | F | **missing** |
| 3 | Recruiting a companion for one outing | downtime-reference | M: uses no action slot, neither significant nor upkeep | — | — | F (the top band adds a morale bonus: C) | — | — | — | **missing** |
| 4 | Asking around (gathering intelligence) | downtime-reference | F | F | — | C: the modifier is the best relationship step among the people consulted; a no-roll variant ("surprise me") | — | — | F (the GM's words become a note, dt-5) | **change** |
| 5 | Learning a skill | downtime-reference | F | F | — | C: modifier picked from named teacher tiers; the top band makes the next attempt need no roll | C: length picked from a few difficulty tiers | — | F | **change** |
| 6 | Keeping in practice | downtime-reference | F | F | — | C: modifier a level formula for one class group only; a training partner also acts and both gain | — | — | M: pick N small bonuses from a list, lasting until the next downtime | **missing** |
| 7 | Mastering a fighting technique | downtime-reference | F | F | — | C: same formula; the top band makes the next attempt free | C: a catalogue of techniques, each with its own length and effect | — | F | **change** |
| 8 | Researching a question | downtime-reference | F | F | — | F | M: steps written by the GM, kept secret until reached; a step may open a new question (branch) or stop progress until a new source is found (wall); needs access to a place that holds the subject | — | F | **missing** |
| 9 | Revels (carousing) | downtime-reference | F | F | C: a dice formula times level | C: the low band rolls a mishap table, the high band a boon table | — | F: tables with no clocks; M: their effects (timed penalties, lost item, a step on another tracker, extra loss with debt) | M: XP equal to gold spent | **missing** |
| 10 | Learning a known spell | downtime-reference | F (at a level-up: one per new slot, no roll) | F | — | C: modifier a formula of caster level and spell level; the top band makes the next attempt free | C: length = spell level | — | C: adds the spell to the book or list | **change** |
| 11 | Inventing a spell | downtime-reference | F | F | C: up-front cost per spell level, different by class | M: a band on the natural dice (a disaster); the middle band names a requirement (an item, a deed or gold) before progress | C: length = spell level plus a constant | C: the disaster table is rolled with a die plus the spell level; rows erase or reset progress | F | **missing** |
| 12 | Making a spell book | downtime-reference | F | via 14 | C: price doubles with capacity | — | — | — | C: a named item holding chosen spells | **change** |
| 13 | Copying a spell book | downtime-reference | F | F | F | F (a percentage chance as d100 bands) | — | — | F (the GM marks the spoiled spell) | **fits** |
| 14 | Commissioning a masterwork | downtime-reference | F | M: set by the band (this, next or the one after) | C: the higher of a flat fee or a multiple of the item's price | M: bands set the delivery, not progress | — | — | M: the player names the item and picks a property from a list by item kind; it becomes gear | **missing** |
| 15 | Spiritual exercise | downtime-reference | F | F | — | C: middle band rolls a table, skipped when the step would finish the tracker | C: length from tiers | M: rows that block progress until a deed is done (no clock); "until the next progress" effects; costs scale with level | F | **missing** |
| 16 | Training to level up | classic-advanced (option) | F | C: weeks rolled on a die; two variants (with a mentor or alone) | F | — | — | — | C: XP is blocked until done (05 level-up: Downtime only) | **change** |
| 17 | Training to level up | fae-woodland (option) | F | C: as 16 | C: per week times level | — | — | — | C: as 16 | **change** |
| 18 | XP for spending | fae-woodland (option) | M: not an activity: an XP rule on Spend… and costs | — | — | — | — | — | M: XP per gold spent | **missing** |
| 19 | Carousing as a setting option | classic-advanced, fae-woodland | — | — | — | — | — | — | — | n/a: no carousing rules in either setting pack (classic-advanced's players' volume isn't at hand; fae-woodland only names it inside 18). The supplement's carousing is row 9 |
| 20 | Lodging by tier | fae-woodland (items) | F (`lodgings[]` rate per night) | — | F | — | — | — | — | **fits** |
| 21 | Lifestyle cost | fae-woodland (option) | M: one daily cost by tier, behind an option, replacing lodging and meals; the lowest tier stops healing | — | — | — | — | — | — | **missing** |
| 22 | Money changer: storage and loans | fae-woodland, zine-compendium | C: `storedPlaces[].fee` as a share of the value, free past a minimum stay | — | M: a loan at a rate per month against a deposit (dt-28's bank loan) | — | — | — | — | **missing** |
| 23 | Building a stronghold | classic-advanced | F | C: a formula of the cost | C: summed from a catalogue of structures | — | F: named steps | — | F | **change** |
| 24 | A rune from a quest | fae-woodland (option) | F | F | — | — | — | — | C: roll on a rune table at the end | **change** |
| 25 | Brewing a potion | zine-compendium | F | C: per spell level | C: per spell level | C: a failure chance; needs a creature part (an item) first | — | — | F | **change** |
| 26 | Commissioning a specialty brew | zine-compendium | F | C: read from a table per unit | C: read from a table per unit | — | — | — | F | **change** |
| 27 | Forging magic arms | zine-compendium | F | C: per plus, from a table | C: per plus, from a table | — | — | — | F | **change** |
| 28 | Named inns | zine-compendium | F (`lodgings[]`) | — | F (services table) | — | — | — | — | **change**: a "what's going on" table on arrival needs `lodgings[].tableId` |
| 29 | Jeweller's appraisal | fae-woodland, zine-compendium (options) | F (upkeep) | — | C: a share of the value | — | — | — | F | **change** |
| 30 | Haggling when selling | zine-compendium (option) | F (upkeep) | — | — | F | — | — | F (a share of value offered) | **fits** |
| 31 | Worldbuilding prompts | downtime-reference | F as `gmReference` (one panel, a heading and text per prompt; the format's name is `gmReference`, not `gmPanels`) | — | — | — | — | — | — | **fits** |

**Tally (30 rows; row 19 has nothing to map, carousing itself is row 9):** 4 fit · 14 need a change · 12 miss a field.

## The rules around the activities (downtime-reference)
- One roll for every activity: the same dice, three bands (fail · advance with a catch · advance); the base modifier is named per activity. **F** with `roll` per activity; a rules-set default would save repeating it.
- The supplement's own score-to-modifier table for downtime, flatter than the setting's. **M**
- A cap on the total modifier (base, situation and helpers together). **M**
- Helping: any number of helpers each give up their action for a small bonus. **F** (dt-23), within the cap.
- Hirelings can't take actions for their employer. **F** (dt-1, as rules text).

## Field changes to the proposal (one line each, with the reason)
1. **`costs[].amount`, `duration.amount` and step lengths accept a formula** (of the current step, level, spell level, the item's price, dice), because nearly every activity scales with one of them.
2. **Band effects `{ progress?, table?, finishIn?, skipNextRoll?, needs? }`**, because a band can roll another table (mishap or boon), set when a commission is delivered, make the next attempt free, or advance only once a need is met.
3. **`roll.modifier` as an ability, a formula, named choices (teacher tiers) or another activity's step, plus a band on the natural dice**, because the base modifier comes from all four, and a natural roll triggers a disaster.
4. **Trouble rows: `clock` optional, `blocks: true`, `repeats`, and `whenItRunsOut` `{ progress: -1 | "reset", ends: true }`**, because some troubles stop progress until a deed is done (no deadline), one charges every downtime until settled, and one shuts the enterprise.
5. **`progress` with `lengths[]` or a formula, `start` (the GM picks), `secret` (GM-written, hidden until reached), per-step `cost` and `grants`, and `branch` / `wall` markers on a step**, because trackers vary in length, research hides its steps, and an enterprise's or a friendship's step changes other rolls.
6. **`target`: `npc` · `place` · `item`**, because friendship trackers live on a person, research needs a place that holds the subject, and a commission makes an item of a kind.
7. **`kind: "free"`** (a roll that takes no action slot), for recruiting a companion and haggling.
8. **`atTheEnd` structured as `{ text, grants? }`** (`xp: "spent"`, a spell, an item with a property picked from a list, a roll on a table), because the result should apply by itself (dt-34) and not only in words.
9. **Rules set: `downtime.abilityModifiers`, `downtime.modifierCap`, and an XP-per-gold-spent rule behind an option**, for the supplement's flatter table, its cap, and fae-woodland's XP for spending.
10. **Settlements: `lifestyles[]` behind an option, `storedPlaces[].fee` as a share with `freeAfter`, `loans { rate, per, against }`, `lodgings[].tableId`**, for one daily cost by tier, the money changer's terms, dt-28's loan and the named inns' arrival tables.
11. **Name: the worldbuilding prompts go in `gmReference`**, the format's name, not `gmPanels`.

## Section or a separate pack kind
**A `downtime` section, carried by a homebrew or overlay pack. No new kind.** The supplement doesn't depend on any system: it has no rules set of its own beyond the downtime roll and its modifier table, no settlements, and no classes. Its parts are activities, tables (troubles, mishaps, boons, disasters, conundrums), one GM panel and a technique catalogue. Each of those already has a home, or would have one under the proposed section. A homebrew pack with a `downtime` section (and no `meta.requires`) sits on either setting. Its activities refer to each other (a friendship's step feeds asking around; the boons feed friendships and enterprises), so the ids must resolve within the section. The setting packs only need `activities` for their options (16, 17, 23–27) and the settlement fields in change 10.

## Where it presses on a ruling
- **dt-33** (under each bar: the current step and the next one): research's next step must stay hidden from the player. Either a secret tracker shows only the reached steps, or dt-33 gets an exception.
- **dt-32** (tap the band, no number to type): a band on the natural dice (the disaster) can't be found from the total alone. The band picker would need a "natural …" chip.
- **dt-31** (a trouble carries a clock; then Apply it · Give more time · Clear it): troubles that block progress have no clock, and one repeats every downtime. dt-31 needs a no-clock form, settled by the deed itself.
- **dt-1** (one significant action plus upkeep): recruiting a companion and haggling are rolls that are neither. This is a small extension (`kind: "free"`), not a break.
- No conflict with dt-16, dt-17, dt-27, dt-37, dt-38 or dt-41: the supplement has no upkeep activities of its own, except the repeating trouble, which can become an upkeep under dt-38 (Skip = the worst result).

## Gaps register
G-71 … G-79 in `docs/11-modelling-gaps.md`.
