# Proposed docs update — 2026-10-18 (private test pack)

**Status: approved 2026-10-18 (all six questions ruled).**
After approval, give this file to Claude Code with: *"Apply DOCS-UPDATE-2026-10-18.md to docs/, then commit."*

Covers:
- the six rulings from this morning (they are not in the repo yet)
- the three rulings from this afternoon
- the format v2 changes the private test pack needs

Every example is invented.

---

## 1. `04-data-model.md`

**Replace** the LibraryEntry line with:

> **LibraryEntry** (account-level content library) — id, ownerUserId, packId, kind (`item`, `class`, `race`, `xpTable`, `rulesSet`, `option`, `statBlock`, `condition`, `lightType`, `spell`, `spellList`, `table`, `treasureType`, `calendar`, `fieldTemplate`), packEntryId (the entry's `id` inside the pack, used when re-importing), name, data (JSON per `07-content-packs.md`), source note.

**Replace** the Pack and CampaignPack lines with:

> **Pack** — id, ownerUserId, name, version, formatVersion, source note, imported at. A pack groups library entries. Re-importing a newer version updates entries with the same `packEntryId` after a preview of the changes.
>
> **CampaignPack** — campaignId, packId, optionChoices {optionId: choiceId} (rules options picked when the pack is attached; see `07`).

**Replace** the encumbrance lines under Campaign settings with:

> - `encumbrance.mode`: `none` | `armour` | `coin` | `slot` (chosen at creation, or preset by a pack option; only the chosen one is shown)
> - `encumbrance.armour`: movement rows [{armour: none | light | heavy, withoutTreasure, withTreasure}]; only treasure weight is tracked, against a max load
> - `encumbrance.coin`: coinsPerUnit, tiers [{label, max, effect, movement?}], maxLoad, miscGearCoin (optional flat weight for small gear)
> - `encumbrance.slot`: baseSlots, slot rules (stack sizes, e.g. coins per slot), tiers [{label, maxSlots, effect, movement?}]
> - `encumbrance.containers`: `add` (app default: containers add capacity) | `hold-only` (containers only hold; max load fixed)

**Add** under Campaign settings:

> - `packOptions`: the resolved effect of every option choice (from `CampaignPack.optionChoices` and the pack's `byOption` rules). The GM can change a choice later where the pack allows it (`changeLater`: allow, warn or lock).

**Replace** the PC extras line with:

> **PC extras** — classes [{classRef, level, xp}] (one entry in R1 screens; several allowed by the model for multi-class, screens in R2), raceRef (optional), xpTotal (computed from awards), heirActorId (later), purse (computed from ledger, hidden), spellBook [{spellRef, listId}], memorized [{spellRef, slotLevel, used}].
>
> Values that come from class progression (hit dice, attack values, saves, spell slots, skills) are written into the actor's `fields` on level-up. They stay editable; a later level-up overwrites them again after a preview. A player can choose manual entry instead (per character setting `levelUp`: `auto` | `manual`).

**Replace** the Container line with:

> **Container** — an inventory line whose item is a container: capacity (coin units or slots); whether it adds to the carrier's capacity follows `encumbrance.containers`. An item with `fixedWeightCoin` (a magic bag) always weighs that amount, and its contents never count. Contents are lines pointing to it.

**Add** to InventoryLine: `chargesRemaining` (optional), `revealedFields[]` (which `gmOnly` fields the GM has revealed to the holder).

**Replace** the Status line with:

> **Status** — label, source (condition library or ad hoc), remaining (optional, in rounds or turns), secret (if true, only the GM sees the remaining time; players see "active"), note. Ticks down with combat rounds and time advance.

**Replace** the LightSource line with:

> **LightSource** — inventory line ref, typeRef (library lightType), lit, remaining (set when lit; a formula duration is resolved from the caster's level at that moment), carrierActorId. A light type with `fuelItemId` consumes one fuel item and resets when it runs out.

**Replace** the LevelThreshold line with:

> **LevelThreshold** — from the class's progression in a pack, or entered per character: [{level, xpRequired}].

---

## 2. `05-features.md`

**Campaigns — replace** the creation bullet with:

> - Creating a campaign: name → attach packs from your library (optional) → pick each pack's rules options (every option shows its choices with the default selected; one tap to accept all defaults) → encumbrance mode (none, armour, coin or slot; preset if a pack option set it) → time lengths (prefilled 6 seconds and 10 minutes, or the pack's values) → invite players by email link.

**Characters — add:**

> - Race is optional and comes from a pack (it fills vision and notes). Characters store a list of classes; R1 screens show one. Multi-class screens are R2.

**XP and levels — replace** the leveling bullet with:

> - Reaching a threshold shows a quiet "Ready to level" badge. Leveling is a **downtime activity**. When the class comes from a pack that has progression data, the app fills the new hit dice, attack values, saves, spell slots and skills and shows them as a preview; the player confirms or edits. The preview overwrites earlier manual edits. A player can switch their character to manual level-up and enter everything themselves. Without pack data the player enters the changes. Either way it's logged. HP rolls stay physical: the player rolls and types the result.

**Inventory and encumbrance — replace** the containers bullet with:

> - Containers hold items. Whether they also raise the carrier's capacity is a campaign setting (default: they add capacity; a pack option can switch it to "hold only"). Magic containers with a fixed weight always weigh the same, however full.
> - **Armour mode:** movement comes from the armour worn (none, light, heavy) and whether the character carries treasure. Only treasure weight is tracked.
> - Items with charges (wands, staves) show what's left; one tap spends a charge, and it's logged.
> - Item fields the pack marks GM-only (a curse, true bonus) stay hidden until the GM reveals them to the holder.

**Add a section** after Inventory:

> ## Spells
>
> - Spells come from packs (or are typed in). Each spell lists the class lists it's on and its level on each.
> - A caster keeps a **spell book** (a list of known spells) and **memorized** spells in their slots. Slots per level come from class progression where the pack has it.
> - Memorized spells can be pinned to "At hand". Casting = one tap; the spell greys out until the next rest, when the player or GM resets all used spells.
> - Spells with formula durations or effects (e.g. "6 + level turns", "level d6") show the worked-out value for that caster. The app never rolls the dice.
> - A spell linked to a condition or a light type offers it in one tap (cast Light → the light starts).

**Expeditions, time and light — add:**

> - Light durations can be formulas (e.g. "6 + level"), worked out from the caster's level when the light is lit. Lanterns burn a separate fuel item.

**Combat tracker — add:**

> - **GM-secret timers:** a status or effect can be marked secret (e.g. a potion's duration the GM rolled). Players see that it's active; only the GM sees what's left.

**GM add-ins — add:**

> - Tables can use two dice read together (e.g. a d4 and a d10 read as 10–49) and can point to another table (terrain → sub-table). The GM types each roll in turn; the app follows the chain.
> - Encounter rows linked to a stat block add that monster to the encounter in one tap.

---

## 3. `07-content-packs.md`

**Replace** the line "Containers: … Containers add capacity to their carrier." with:

> - Containers: `"container": { "capacityCoin": 400, "capacitySlots": 6 }`. Whether containers add capacity is a campaign setting. Optional `"fixedWeightCoin"` for containers that always weigh the same.

**Add a section** after "JSON format (version 1)":

> ## JSON format version 2 (additions)
>
> Version 2 keeps everything in version 1 and adds the kinds and fields below. They were found by converting a complete published system as a private test (2026-10-18). The importer accepts both versions.
>
> **Formulas.** Wherever a number can depend on level, a pack may give `{ "formula": "6 + level" }` instead of a number. Allowed: numbers, `level` (the caster's or owner's level), `+ - * /`, `floor()`, and dice such as `1d6` or `level d6`. The app works out the number or dice expression; it never rolls. Anything else stays text. ◈ Variables other than level are deliberately left open.
>
> **options** (rules choices made when a campaign attaches the pack)
> ```json
> { "id": "lantern-oil", "name": "Lanterns need oil", "default": "on", "changeLater": "allow",
>   "choices": [ { "id": "on", "name": "Yes" }, { "id": "off", "name": "No" } ],
>   "requires": null, "notes": "" }
> ```
> A rules set can then carry `"byOption": { "lantern-oil=off": { ... settings ... } }`, merged over its defaults when that choice is picked.
>
> **races**
> ```json
> { "id": "marsh-folk", "name": "Marsh folk", "abilityMods": { "DEX": 1 }, "vision": "sees in the dark 30 ft",
>   "languages": ["Common", "Reedspeak"], "classes": { "lantern-warden": 8 }, "abilities": [ { "name": "Hold breath", "notes": "Short note" } ] }
> ```
>
> **classes** (new optional fields): `requirements`, `primeXp`, `maxLevel`, `armour`, `weapons`, `languages`, `abilities` [{name, fromLevel, notes}], `spellcasting` {listId, type}, `skills` {codes, byLevel}, and `progression` [{level, xp, hitDice, attack, saves {...}, spellSlots [...]}]. When `progression` is present the app uses it to fill the sheet on level-up.
>
> **spells** and **spellLists**
> ```json
> { "id": "glimmer", "name": "Glimmer", "lists": { "lantern-warden": 1 }, "range": "30 ft",
>   "duration": { "formula": "2 + level", "unit": "turn" }, "lightTypeId": "glimmer-light", "conditionId": null, "notes": "Short note" }
> { "id": "list-lantern-warden", "name": "Warden spells", "levels": [ { "level": 1, "spells": ["glimmer"] } ] }
> ```
>
> **tables** (new shapes)
> - Composite dice: `"die": "d4/d10"` with a `"key"` on each row (e.g. `"3/7"`).
> - Nested: a row's result may name another table, or the table gives `"nextTablePattern": "wild-{result}"`.
> - `"kind": "matrix"` (rows × columns, e.g. level × target) and `"kind": "lookup"` (key → value, no die).
>
> **treasureTypes**
> ```json
> { "id": "tt-k", "letter": "K", "kind": "hoard", "entries": [ { "chance": 40, "amount": "2d6 × 100 sp" }, { "chance": 10, "amount": "1 magic item" } ] }
> ```
>
> **items** (new optional fields): typed blocks `weapon`, `armour`, `animal`, `vehicle`; free-form `fields`; `charges` {initial, rechargeable}; `gmOnly` (list of field names hidden from the holder until revealed); `fuelItemId`; `shareable` (whether the source marks it as open content; informational in R1).
>
> **lightTypes**: `duration` may be a formula; `fuelItemId` names the item consumed when it runs out.
>
> **statBlocks** (new optional fields): `abilities` (list of short notes), `hpAverage`.
>
> **Structured Markdown** stays version 1 in R1 (item, light, class, xp, condition, statblock, field, rules, calendar, table). The new kinds are JSON only.

**Update** the appendix prompt: change `"formatVersion": 1` to `"formatVersion": 2`.

**Update** the IP rules bullet "Keep packs to the mechanical data…" — add:
> Notes are short summaries in your own words: up to three sentences.

---

## 4. `08-roadmap.md`

**Replace** milestone rows (dates per the slip below):

> | M1 | Accounts, campaigns, members, GM-defined fields, characters with portraits (race and class list in the model), Player screen, tablet and phone layouts | Nov 29 | Two test logins can see one party |
> | M3 | Account content library, pack import (JSON v1 and v2, Markdown v1), rules options at campaign creation, in-app editor; `content-pack-converter` skill tested on one real source; the private test pack imports cleanly | Jan 10 | Import the private test pack, pick options, see classes, items and stat blocks |
> | M4 | Inventory, containers (add or hold-only), none/armour/coin/slot encumbrance, tier tracking, item charges, GM-only item fields | Jan 24 | Load bar changes correctly in every mode |
> | M6 | Combat tracker: … (unchanged) …; GM-secret status timers; nested and two-dice tables | Feb 28 | Run a mock fight with hidden monster HP |
> | M7 | XP awards and thresholds, level-up auto-fill from class progression, spell book and memorized spells, hidden purses, party ledger with rollback, Split Loot, editable charter | Mar 21 | Level a pack-built fighter and caster; award XP and split a haul |
> | M9 | … (unchanged) … | Apr 18 | Events tab on a tablet; sheet readable in airplane mode |

**Also move** (slip of 2 weeks, ruled 2026-10-18): M5 Feb 7 → Feb 14; M8 Mar 21 → Apr 4; M10 Apr 18 → May 2; play-tests May 2 → May 16. R1 range becomes Nov 9, 2026 → May 16, 2027. R2–R3 targets move 2 weeks later (Aug 8, 2027 and Oct 31, 2027).

**R2 — replace** "Leveling-up mechanism exploration (guided level-up from class packs) ⚑" with:

> - Multi-class screens (the data model already supports it)
> - Treasure-type rolling helper and encounter XP totals
> - "Acts last" flag (slow weapons, monsters that always lose initiative) and heal-per-round statuses (regeneration)
> - Level drain action (reverses a level-up), subdual damage counter

**R0 — fix** "Clickable mockups of Me, Party, GM console and combat tracker" → "Clickable mockups of Player, Pack, Events, GM console and combat tracker".

---

## 5. `10-open-questions.md`

**Remove** (now ruled): 1 (spells), 2 (vision: race fills the actor's vision field), 9 (level-up automation).
**Remove** 3 (note length: ruled, up to three sentences).
**Add** nothing new: all six questions from this update were ruled.

---

## 6. `09-decisions-log.md` entries

```
- 2026-10-18 — Level-up fills hit dice, attack values, saves, spell slots and skills from class progression when the pack has it; player confirms or edits — less paperwork at the table
- 2026-10-18 — Data model stores a list of classes per character; multi-class screens in R2 — cheap now, costly to retrofit
- 2026-10-18 — Encumbrance adds an "armour" mode (armour worn + carrying treasure) in R1 — common OSR option that fits neither coin nor slot
- 2026-10-18 — Whether containers add capacity is a campaign setting a pack can preset; app default stays "add" — systems differ
- 2026-10-18 — Spell books and memorized spells in R1 — casters are core to play
- 2026-10-18 — Level-scaled values written into packs as small formulas; the app computes, never rolls — keeps players out of the rulebook
- 2026-10-18 — Treasure-type rolling and encounter XP totals in R2 — nice to have, not core
- 2026-10-18 — "Acts last" flag and heal-per-round statuses in R2 — rare, the GM can handle them by hand
- 2026-10-18 — GM-secret timers and GM-only item fields in R1 — part of Hidden means hidden
- 2026-10-18 — The app never rolls in R1; pack dice are shown worked out (e.g. 5d6) and rolled at the table — dice stay physical
- 2026-10-18 — R1 slips about 2 weeks (play-tests May 16, 2027) — pack v2, spells, armour mode and auto-fill added scope
- 2026-10-18 — Re-importing a pack updates entries in place by id after a preview — characters keep working across pack versions
- 2026-10-18 — Level-up auto-fill overwrites earlier edits after a preview; a player can choose manual level-up per character — speed by default, control when wanted
- 2026-10-18 — New pack kinds are JSON only in R1; Structured Markdown stays v1 — keeps the simple importer simple
- 2026-10-18 — Rules notes in packs: up to three short sentences in your own words — tap-for-detail needs more than one; IP stays safe
- 2026-10-18 — Pack format v2 (options, races, spells, treasure types, formulas, two-dice and nested tables, item charges) — needed to model a full OSR system; tested with a private test pack
```

---

## Rulings on this update's questions (2026-10-18)

1. The app never rolls: kept in R1.
2. Schedule: slip about 2 weeks (dates above).
3. Pack re-import: update in place after a preview.
4. Level-up: auto-fill overwrites after a preview; a player can choose manual level-up instead.
5. New pack kinds are JSON only in R1; Markdown stays v1.
6. Rules notes: up to three short sentences in your own words.

---

## 7. Later the same day: Player screen arrangement and pack source line (approved)

**`05-features.md` — Characters, add:**

> - **Arrange this screen** (Player → ⋯ → Arrange): each player shows, hides and reorders sections of their Player screen. Defaults come from the pack's field template where it has one, otherwise: statuses, HP, AC · attack · move, At hand. Saves, spells, class skills, light and coin start hidden. Sections a character can't use (spells for a non-caster) aren't offered. One arrangement per character, the same on every device; tablets lay the same sections out in two columns. Hidden sections stay in the full sheet.
> - **Urgent strip:** even when their section is hidden, a light about to go out, a status ending, or "ready to level" shows as a one-line strip at the top until dealt with.
> - Memorized spells can be pinned to At hand and cast from there.

**`05-features.md` — Inventory, add:**

> - In armour mode, ordinary gear sits in a collapsed "Gear" section (with a count, "not counted for speed"). It stays tracked for light and ration use. The open or closed state is remembered.

**`06-screens-and-design.md`, add:**

> Every rules popup ends with one small source line naming the pack and section (e.g. "From your pack: River Rules · spells").

**`04-data-model.md` — Actor, add field:** `screenLayout` [{section, shown, order}] (per character).

**`09-decisions-log.md`:**

```
- 2026-10-18 — Players arrange their own Player screen (show, hide, reorder) from the ⋯ menu; small default; one layout per character on all devices — keeps screens calm without hiding what a player needs
- 2026-10-18 — Urgent items (light running out, status ending, ready to level) show in a strip even when their section is hidden — nothing important gets lost by hiding
- 2026-10-18 — Gear in armour mode sits in a collapsed section — tracked, out of the way
- 2026-10-18 — Rules popups show a one-line pack source — players and GM can check where a number came from
```

---

## 8. Open-question rulings (approved 2026-10-18 afternoon)

**`05-features.md`**
- Events tab: replace "Link to the full Log tab." with: "**Full log ›** opens a full-screen log (filters, search, verbose view); Back returns to Events. There is no separate Log tab."
- Combat tracker, add: "Individual initiative takes the player's final number; the entry pad shows each character's modifier (e.g. 'Wren +1') as a reminder."
- GM add-ins, add: "Players are never prompted on their screens; the GM asks out loud and types results. GM-secret rolls stay on the GM console."
- Expeditions, time and light, add: "Lanterns burn a separate fuel item. When the light runs out, the carrier gets a one-tap **Refill (N left)** that uses one flask and restarts the timer, or 'Out of oil' if they have none. A GM setting can make the refill automatic (default off). Logged."
- XP and levels, add: "If the pack limits gains to one level per session, the award preview flags anyone it would push past that limit ('Over the one-level cap by 1,100') with **Cap** or **Keep** for the GM. Nothing is cut automatically."
- Characters: in R1 all class skills show their number (GM-rolled skills are R2).

**`06-screens-and-design.md`**
- Bottom navigation is **Player · Events · Pack** (three tabs).
- Events: "Light and dark sight use shape plus colour: a glowing ring with a flame mark for a lit light, a dashed ring with an eye mark for dark sight. No text labels; tap for details; screen readers announce both."

**`08-roadmap.md` R2, add:**
- GM-rolled skills (pack flag; player sees "GM rolls", optionally with the chance; GM console shows real numbers)
- Automatic initiative modifiers (DEX, race) in individual mode

**`10-open-questions.md`:** remove 6 (Log tab), 7 (colour-only cues), 8 (roll prompts). Add ◈ "Screen roll prompts for remote players (R3)."

**`09-decisions-log.md`:**
```
- 2026-10-18 — Log folds into Events: three tabs (Player · Events · Pack); full log one tap from Events — calmer screens, bigger targets
- 2026-10-18 — Events light and dark-sight cues use shape plus colour, no text — calm screen that still works without colour vision
- 2026-10-18 — No roll prompts to players' screens; rolls are called out loud and the GM types the result — keeps eyes off screens
- 2026-10-18 — GM-rolled skills in R2; R1 shows all skill numbers — the GM handles secrecy at the table for now
- 2026-10-18 — Initiative modifiers are a reminder in R1, auto-added in R2 — side initiative is the table's default; avoids double counting
- 2026-10-18 — Lantern fuel in R1 with one-tap refill — otherwise the lantern itself gets consumed
- 2026-10-18 — One-level-per-session cap is a Cap/Keep warning in the XP preview (R1) — visible, never silently removes XP
```

---

## 9. Explore / Fight modes (approved 2026-10-18)

**`05-features.md`, add a section "Explore and Fight":**

> - During Adventure, the GM console has two modes, **Explore** and **Fight**, switched by the GM with one tap. Only one is shown at a time to save screen space.
> - **Explore:** time controls (+1 turn, +1 round, +1 day, undo), reminders (time triggers), the party in marching order with lights and refills, and the wandering check and encounter tables.
> - **Fight:** side initiative pads, the acting side, Next round (ticks status timers), combatants with a damage and heal pad and statuses, a stat block summary for foes, and End fight (optional log line and XP award).
> - Starting a fight from an encounter result switches to Fight; ending it returns to Explore.
> - **The shared Events tab follows the GM's mode.** Explore shows marching order (drag to reorder), where we are in time, lights and the log. Fight shows the party's HP and statuses, initiative with the acting side, foes' damage taken and statuses (never their HP), and the log.

**`06-screens-and-design.md`:** GM console and Events tablet layouts each have Explore and Fight variants (three columns each; the log is always the right-hand column on Events).

**`04-data-model.md`:** Campaign gets `adventureMode`: `explore` | `fight` (GM-set, broadcast to all screens).

**`09-decisions-log.md`:**
```
- 2026-10-18 — GM console and shared Events tab switch between Explore and Fight modes, set by the GM — only one is active at a time, so each gets the whole screen
```

---

## 10. Initiative, wandering checks, Fiat icon (approved 2026-10-18)

**`05-features.md`, Combat tracker — replace the initiative bullets with:**

> - **Initiative.** Dice are rolled at the table.
>   - **Side mode (default):** under **Acting now**, the GM taps **Party** or **Foes**, then taps the other side when its turn comes. No numbers are entered. Players see the acting side on Events. Next round resets the choice.
>   - **Individual mode (campaign option):** the GM (or each player) enters each final number on a big pad; the pad shows each character's modifier as a reminder. Settings for this mode: number range, high or low first, tie-breaker. Missing entries act last; nobody blocks the table.

**`05-features.md`, Expeditions, time and light — add:**

> - Any reminder the GM marks as a **check** (e.g. a wandering check every 2 turns) shows **Hit** and **Miss** on the GM console. Both are logged at once, but players see check results only when the campaign next enters Downtime; until then they appear on the GM's log only. Hit highlights the encounter tables but never starts a fight: not every encounter is a fight, so the GM switches to Fight manually. After either result the next check is scheduled automatically ("next at turn 16"). Other reminders (rest, rations) use **Done**.

**`06-screens-and-design.md`, add:**

> - The Fiat button is a **pointed wizard hat** icon (accent background, labelled "Fiat" for screen readers and on long-press). No text on the button.

**`04-data-model.md`, TimeTrigger:** add `kind`: `reminder` | `check`; check results (`hit` | `miss`) are logged as events.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Side initiative is an "Acting now" choice (Party / Foes); individual mode keeps number entry and its settings — fewer taps, dice stay at the table
- 2026-10-18 — Every check reminder uses Hit / Miss, logged at once and auto-scheduling the next check; Hit never auto-starts a fight — not every encounter is a fight
- 2026-10-18 — Fiat button uses a pointed wizard hat icon — instantly readable, no text
```

**Check results revealed at Downtime (approved 2026-10-18):**
- `04-data-model.md`, Event: add `revealAt` (`now` | `downtime`); check results are written with `downtime` and become visible to players when the GM next switches the campaign to Downtime. The GM always sees them.
- `09-decisions-log.md`: `2026-10-18 — Check results are logged at once but shown to players only at the next Downtime — no spoilers during play, full record afterwards`

---

## 11. Downtime as conversation (principle approved 2026-10-18; scope ⚑ pending)

**`01-product-brief.md`, principles — add:**

> - **Downtime is narrative.** Players propose what they want to do in their own words; the GM explains how it would work; the player accepts, asks for a change, or declines. The app records and carries that conversation; it does not reduce downtime to a menu.

**`05-features.md`, replace the Downtime section with:**

> ## Downtime
> - **Activities are text threads.** A player proposes an activity in free text. The GM replies in text and can attach **terms** (time, cost, what happens at the end, how progress is measured). The player **accepts**, **asks for a change** (text), or **declines**. Every message is logged.
> - **Accepted activities stay active across sessions,** with play sessions in between, until the GM resolves them with a note.
> - **Progress** measures (weeks of downtime, counters like "leads found, 1 of 4", costs charged over time) are **R2**. In R1 the GM and player track progress in the thread's text.
> - GM view groups threads: **Needs your reply · Waiting on players · Active**. Players see their own threads in full; the rest of the party sees only titles and progress.
> - Leveling up stays a downtime activity (with the auto-fill preview).
> - **Revealed this downtime:** check results logged during the last session become visible to players.
> - **Split Loot** ends with a **Treasure XP** step when the pack gives XP for treasure; the app proposes the XP and the GM confirms it in **Award XP** (split preview and one-level cap). Non-GMs running Split Loot see share sizes, never purse balances. Encumbrance does not apply in downtime; carried treasure counts again when the next adventure starts.

**`04-data-model.md` — replace DowntimeRequest with:**

> **DowntimeActivity** — id, campaignId, actorId, title, status (`proposed` | `offered` | `changeRequested` | `active` | `declined` | `resolved` | `abandoned`), messages [{authorUserId, text, terms?, at}], agreedTerms {time, cost, outcome, progress?}, progress {kind: `weeks` | `counter`, current, target, unit}, startedSession, resolvedSession, resolutionNote. Every change is an event.

**Scope (ruled):** in R1, activities stay **active** across sessions with their agreed terms; **progress tracking** (weeks, counters, clocks, costs over time) is **R2**.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Downtime activities are text threads (propose → GM terms → accept / change / decline), logged, and can stay active across sessions — downtime is narrative and open-ended
- 2026-10-18 — Split Loot proposes Treasure XP from the pack; the GM confirms in Award XP — one flow, no double entry
```

**Additions (approved 2026-10-18):**
- `05-features.md`, Downtime, add:
  > - A **Completed** section lists resolved activities, collapsed by default (GM and player views).
  > - **Where money is:** each purse and the party coffers are split into **carried** and **stored**, with named places (a bank, a strongbox, a cache). After a split, shares land in the purse or coffers; players then move coin between places as often as they like **during downtime**. **During an adventure**, taking money out of storage needs the GM's approval and puts it in the player's inventory (where it counts for encumbrance). Stored amounts are private from other players; the GM sees them.
  > - **Bonus XP:** in Award XP the GM can add bonus XP to a character or the party, each with a reason shown in the log. Bonuses sit on top of the split.
- `06-screens-and-design.md`, add:
  > - **Theme:** light or dark, switched from the settings / ⋯ menu (not a button on every screen); saved per device. Automatic switching by ambient light is a later release ◈ (browser support for light sensors is limited; following the device's own light/dark setting is the likely route).
- `04-data-model.md`: LedgerEntry gets `placeId`; new **Place** — id, campaignId, owner (`party` | actorId), name (e.g. "Reedmouth bank"); purse and coffers balances are computed per place, with `carried` as a built-in place.
- `08-roadmap.md`: R3 — "Automatic light/dark theme (device setting or ambient light)."
- `09-decisions-log.md`:
```
- 2026-10-18 — Completed downtime activities kept in a collapsed section — history without clutter
- 2026-10-18 — No encumbrance in downtime; purses and coffers track carried vs stored (named places) — matches how treasure is really handled between delves
- 2026-10-18 — GM can award bonus XP to a character or the party with a reason — rewards play beyond loot and monsters
- 2026-10-18 — Light/dark theme switch in settings in R1; automatic switching later — comfort at the table without extra buttons
```

**Further rulings (2026-10-18):**
- `05-features.md`, Downtime, add:
  > - **Places:** anyone can add a storage place. A new place needs the GM's approval, and the GM can attach a flat fee or an ongoing rate (e.g. a bank charging monthly).
  > - **GM sees what players see.** Everything visible to a player is visible to the GM.
  > - **GM can edit any player sheet as if they were the player** (via fiat), e.g. setting a bank balance to zero after a collapse. Logged with the fiat seal and reversible.
- `04-data-model.md`, Place: add `status` (`pending` | `approved`), `fee` {flat?, rate? {amount, period}}.
- `08-roadmap.md`: R2 — "Downtime progress tracking (weeks, counters, clocks, costs over time)". R3 — "Player-to-player messages and notes hidden from the GM (optional per campaign)".
- `03-roles-permissions.md`: "The GM can view anything a player can view. GM-hidden player-to-player notes are a later release."
- `09-decisions-log.md`:
```
- 2026-10-18 — Downtime progress tracking moves to R2; R1 keeps activities active across sessions with terms in text — scope discipline
- 2026-10-18 — Money moves between places freely in downtime; during an adventure, withdrawals need GM approval and go to inventory — storage means something
- 2026-10-18 — New storage places need GM approval and can carry a flat fee or ongoing rate — banks and caches are part of the world
- 2026-10-18 — GM sees everything a player sees and can edit player sheets via fiat (logged, reversible) — the GM can apply world events directly
```

---

## 12. Place approvals, charter, settings, review step (approved 2026-10-18)

**`05-features.md`, Downtime, replace the Places bullet with:**
> - **Places:** anyone can add a storage place. A new place goes to the GM as an **Approve / Deny** prompt (the GM can attach a flat fee or an ongoing rate). Approved: it works as normal. Denied: the player is notified and can try again after talking it through with the GM. No warning text is shown to players in advance.

**`05-features.md`, Charter, add:**
> - Share distribution is edited with steppers (party fund %, shares per PC, hireling, animal) plus named exceptions. Freeform sections (funerals and heirs, house rules, any others) are plain text. "Save as version N"; earlier versions list with **Restore**, which creates a new version.

**`06-screens-and-design.md`, add:**
> - **Settings (GM):** This device (theme, text size) · Rules (pack options, encumbrance with a change warning, round and turn, initiative side or individual, default level-up mode) · At the table (encounter tables, monster disposition, lantern auto-refill, quiet mode) · People (members, titles, invite) · Data (packs, JSON export, weekly backup). Players see only "This device" and their own options.

**`08-roadmap.md`, R0, add:**
> - After every mockup has its initial approval, all approved boards are assembled into a fresh design canvas for Francis's final review; only then are they approved for the R1 build.

**`04-data-model.md`, Place:** `status` gains `denied`; denial notifies the requester.

**`09-decisions-log.md`:**
```
- 2026-10-18 — New storage places go to the GM as Approve/Deny prompts; denial notifies the player — the GM explains in person, not the app
- 2026-10-18 — Approved mockups get a fresh canvas for final review before R1 approval — a clean, single source for the build
```

---

## 13. Treasurer powers and character creation (approved 2026-10-18)

**`03-roles-permissions.md`, Treasury bundle — change to:**
> | **Treasury** | Split Loot, upkeep/wage payment tools, **manage the party treasure after the split** (move between places, spend, transfer to players) on its own Treasury screen, ledger shown first |

**Add under the bundle table:**
> - The initial disbursal of an adventure's haul stays a communal activity (Split Loot, as designed). Party-treasure management starts after that step.
> - Everyone keeps their existing ledger rights (any member can add, edit or roll back party ledger entries, all logged); the Treasury bundle adds the management screen, not a restriction.
> - Transfers from the party treasure to a player's purse go straight in; the player is notified. No acceptance step.
> - During an adventure, taking party money out of storage needs GM approval (same rule as personal storage).

**`01-product-brief.md`, R1 scope — add:**
> - Character creation: **guided** from the rules pack, or **freeform** for tables without one.

**`05-features.md`, Characters — add:**
> - **Character creation, two paths.**
>   - **Guided (from the pack):** enter ability scores rolled at the table → pick race and class (choices the scores don't allow are greyed out with the reason) → apply allowed ability adjustments → enter rolled starting HP and gold → buy starting gear from the pack's item list against starting gold, or take a ready-made starting kit if the pack has one → alignment, languages, name, portrait → submit.
>   - **Freeform:** name, portrait and the campaign's GM-defined fields.
>   - The app never rolls. New characters need **GM approval** before joining the party (setting, on by default).

**`04-data-model.md`:** Actor gets `approval` (`pending` | `approved`); packs may include `startingKits` [{id, name, classIds?, items[{itemId, qty}], costGp?}] (format v2 addition in `07-content-packs.md`).

**`08-roadmap.md`:** freeform creation in M1; guided creation as a new milestone after M4 (dates per ⚑ below).

**`09-decisions-log.md`:**
```
- 2026-10-18 — Character creation is in R1: guided from the pack or freeform; dice stay physical; GM approval on by default — players start play inside the app
- 2026-10-18 — Treasury power manages party treasure after Split Loot (move, spend, transfer to purses without acceptance); ledger rights stay open to all; withdrawals mid-adventure need GM approval — real role, no new bottleneck
- 2026-10-18 — Starting gear can be bought from the pack list or taken as a pack starting kit — both styles are common
```

---

## 14. Final R1 dates (approved 2026-10-18; supersede the dates in section 4)

**`08-roadmap.md`, R1 table — use these due dates:**

| # | Milestone | Due |
|---|---|---|
| M1 | Accounts, campaigns, members, fields, characters (incl. freeform creation), Player screen | Nov 29 |
| M2 | Command layer, event log, notes, rollback, fiat | Dec 13 |
| M3 | Library, pack import (JSON v1/v2, Markdown v1), rules options, editor, converter skill | Jan 10 |
| M4 | Inventory, containers, none/armour/coin/slot encumbrance, charges, GM-only fields | Jan 24 |
| **M4b** | **Guided character creation from packs, starting kits, GM approval** | **Feb 7** |
| M5 | Explore mode: time, reminders and checks, lights and fuel, marching order | Feb 21 |
| M6 | Fight mode: acting now, damage, statuses, stat blocks, tables | Mar 14 |
| M7 | XP, bonus XP, level-up auto-fill, spells, purses and places, ledger, Split Loot, Treasury screen, charter | Apr 4 |
| M8 | Titles, voting, alerts | Apr 18 |
| M9 | Hirelings and holdings (basic), downtime threads, Events modes, quiet mode, offline, dictation | May 2 |
| M10 | Hardening, export, backups, deploy | May 16 |
| — | Two play-test sessions | May 30 |

R1 range: Nov 9, 2026 → May 30, 2027. R2 target Aug 22, 2027; R3 target Nov 14, 2027 (both tentative).

**`09-decisions-log.md`:**
```
- 2026-10-18 — Added M4b (guided character creation, Feb 7); M5–R3 shift by 1–2 weeks; play-tests May 30, 2027 — character creation is R1 scope
```

---

## 15. Charter by vote, party name and sigil, "Setting rules" wording (approved 2026-10-18)

**Conflict resolved:** `05-features.md` said the charter is edited directly and the app never requires a vote. New ruling wins: **after its founding version, any charter change needs a unanimous vote of the players.**

**`05-features.md`, Charter — replace with:**
> - The **founding version** is written freely when the party forms. After that, any change (including restoring an old version, renaming the party or changing its sigil) is a **proposal** that goes to a vote of all players and passes only if **everyone** agrees. Failed proposals stay in the log; the charter is unchanged.
> - The charter holds the **party name** and **sigil** (an uploaded image). The name and sigil show on the charter, Events and settings.
> - **Share distribution** covers the party fund %, each player character and animals/mounts, plus named exceptions. **Hirelings are paid per their contracts**, not the charter. Freeform sections (funerals and heirs, house rules, others) are plain text.

**`05-features.md`, Voting — replace "Votes are never required by the app…" with:**
> - The app requires a vote in one place only: changing the charter (unanimous). Everywhere else votes are optional.

**Wording (UI copy everywhere):**
- "Rules pack" / "pack" → **"Setting rules"** (e.g. "From your setting: River Rules"). The pack's choices are **"Optional rules"**.
- The file format and developer terms stay as they are (`tabletop-pack`, `07-content-packs.md`); add to `07-content-packs.md`: "In the app's UI a pack is called **Setting rules**, and its options are **Optional rules**."
- `06-screens-and-design.md`: add a wording note with these terms.

**`04-data-model.md`:** Charter gets `partyName`, `sigilAssetId`; CharterVersion gets `proposalVoteId` (null for the founding version).

**`09-decisions-log.md`:**
```
- 2026-10-18 — After founding, charter changes (incl. name and sigil) need a unanimous player vote — the charter is a pact, not a wiki
- 2026-10-18 — Hireling pay comes from contracts, not the charter — one source for each hireling's terms
- 2026-10-18 — Party gets a name and an uploaded sigil, held in the charter — identity for the company
- 2026-10-18 — UI says "Setting rules" for packs and "Optional rules" for their options — plainer words for players
```

---

## 16. Charter vote details and settings wording (approved 2026-10-18)

- `05-features.md`, Charter, add:
  > - The GM can override a charter vote with fiat (sealed, logged, reversible).
  > - Any player writes the founding version during campaign setup, without a vote, until the first session starts.
  > - Only players vote on the charter; the GM and hirelings don't.
- `06-screens-and-design.md`, Settings: the "At the table" group is named **During play** (encounter tables, monster disposition, lantern auto-refill, quiet mode).
- `09-decisions-log.md`:
```
- 2026-10-18 — Charter: founding version free until session 1; players-only unanimous votes after; GM can override by fiat — pact with a safety valve
```

---

## 17. Charter wording, Campaign screen, joining, death, switching (approved 2026-10-18)

**`05-features.md`, Charter:** share lines are **party fund %** and **each charter member** (plus named exceptions). Animals and mounts get no shares; hirelings are paid by contract. The freeform section is titled **House Rules and Customs**.

**`05-features.md`, new section "Campaign (GM)":**
> - One GM screen, **Campaign**, replaces the GM part of Settings. Sections: **Setting rules** (attach, import, update with a preview, optional rules) · **Players and characters** (invite by email or link, approve new characters and set their starting level, see who plays whom) · **Handouts and maps** · **During play** · **Data**.
> - Device preferences (theme, text size) live in a personal menu everyone has.
> - **Handouts and maps (R1):** upload images or PDFs; each is visible to the GM only, everyone, or chosen players; **Reveal** shares it. Revealed items appear in a Handouts list on Events. No fog, tokens or drawing (later release).

**`05-features.md`, Characters — add:**
> - **Joining:** an invite opens the campaign, the player signs in, and character creation starts (guided or freeform). Nobody joins without a character (no spectators in R1). The GM approves and sets the starting level.
> - **Death:** the character is marked dead and logged; its sheet stays readable in the archive. The player gets a calm prompt to make a new character, **Now** or **Later** ("Make a new character" waits in the ⋯ menu). The GM picks the new character's starting level.
> - **Several characters per player, one active.** Switch from the ⋯ menu: instant in downtime; during an adventure the GM must approve. Benched characters earn no party XP; the GM can give them bonus XP.

**`04-data-model.md`:** Actor `status` gains `benched`; Member gets `activeActorId`; new **Handout** — id, campaignId, assetId, kind (`map` | `handout`), name, visibility (`gm` | `all` | userIds[]), revealedAt.

**`08-roadmap.md`:** M1 adds invites with creation on join and character switching; M3 adds the Campaign screen's setting-rules section; M9 adds handouts and maps (uploads, visibility, reveal). Later release: interactive maps (fog, tokens, drawing).

**`09-decisions-log.md`:**
```
- 2026-10-18 — Charter shares: party fund and each charter member only; no animal shares; section renamed House Rules and Customs — simpler, matches how the table plays
- 2026-10-18 — One GM Campaign screen (setting rules, players, handouts and maps, during play, data) replaces GM settings — one place to run the campaign
- 2026-10-18 — Handouts and maps in R1 as uploads with visibility and reveal; interactive maps later — useful now, no screen-staring
- 2026-10-18 — Invites and deaths lead into character creation; GM approves and picks starting level; no spectators — everyone at the table plays
- 2026-10-18 — Several characters per player, one active; switch freely in downtime, GM approval mid-adventure; benched earn no party XP — supports troupe play without confusion
```

---

## 18. Titles rework, Archivist, recurring expenses (approved 2026-10-18)

**Conflict resolved:** `03-roles-permissions.md` and `05-features.md` said anyone creates titles and the GM grants power bundles. New ruling wins.

**`03-roles-permissions.md` — replace the titles and bundles sections with:**
> - Every company starts with two titles: **Treasurer** and **Archivist**. Only these two carry powers in R1.
>   - **Treasurer:** manages the party treasure after Split Loot (Treasury screen: give, spend, move, recurring expenses, dues).
>   - **Archivist:** expanded note powers in the log (pin notes, edit and merge others' notes, write session summaries). Archivist notes appear in a **distinct colour and handwritten script** so they stand out.
> - Players can propose **new titles** (names only, no powers in R1) and propose **who holds** any title. Both go to a vote of charter members.
> - Players **join the company** (become charter members) by vote.
> - The Stash, Library and Marching bundles are dropped. Setting entries are edited by the GM.

**`05-features.md`, Charter — add:** "**Members and titles** (button on the charter): list of charter members and their titles; 'Ask to join the company'; 'Propose holder' per title; '+ Propose a new title'. All go to a vote."

**`05-features.md`, Voting — change the required-vote line to:** "The app requires votes for charter changes (unanimous), joining the company, and creating or assigning titles."

**`05-features.md`, Treasury — add:**
> - **Spend** can repeat: just once, every week of downtime, every month, or every session (e.g. lodging, hireling wages). Recurring expenses show under **Due**, ready to pay in one tap; paying schedules the next one.

**`06-screens-and-design.md`:** voting screens show no explanatory text about open or secret ballots. Archivist notes: handwritten script (e.g. Caveat) at a larger size, in an ink-blue that meets contrast in light and dark.

**`04-data-model.md`:** Title gets `kind` (`treasurer` | `archivist` | `custom`); Note gets `byArchivist` (styling); new **RecurringExpense** — id, campaignId, placeId, amount, period (`week` | `month` | `session`), reason, nextDue, payee?.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Titles managed from the charter; joining, new titles and holders go to a vote; only Treasurer and Archivist carry powers in R1 — fewer mechanics, more table agency
- 2026-10-18 — Archivist gets expanded log-note powers; their notes show in a distinct colour and script — the record keeper's voice stands out
- 2026-10-18 — Treasury spending can recur (weekly, monthly, per session) and shows under Due — lodging and wages without paperwork
- 2026-10-18 — Dropped the Stash, Library and Marching power bundles — scope discipline
```

**Vote thresholds (approved 2026-10-18):**
- `05-features.md`, Voting: "Joining the company, creating titles and choosing title holders pass by **simple majority** of charter members. Charter changes stay **unanimous**."
- Archivist powers confirmed as listed (pin, edit and merge others' notes, session summaries); handwritten script kept.
- `09-decisions-log.md`: `2026-10-18 — Joining and title votes pass by simple majority; charter changes stay unanimous — membership and roles shouldn't stall on one holdout`

---

## 19. Sign-in and the Company page (approved 2026-10-18)

- `02-architecture.md` / `05-features.md`: **R1 sign-in is email link only** (no passwords, no Google). After sign-in, a **campaign picker** lists every campaign with the user's role and active character, pending invites (Join → character creation), and "Start a new campaign (as GM)".
- `06-screens-and-design.md`: a **Company** page opens from the party sigil at the top of Events. It holds the charter (with members and titles), Treasury, hirelings and holdings. The bottom tabs stay Player · Events · Pack.
- `09-decisions-log.md`:
```
- 2026-10-18 — Email-link sign-in only for R1 — simplest for everyone
- 2026-10-18 — Company page (charter, members and titles, Treasury, hirelings, holdings) opens from the party sigil on Events — one tap away without a fourth tab
```

---

## 20. Hirelings vs retainers (approved 2026-10-18)

**`05-features.md`, Hirelings — add:**
> - Wages and recurring expenses can repeat **per day, per adventure, per week, per month or per session**.
> - **Personal recurring expenses:** players can set recurring expenses on their own purse (e.g. a retainer's food and lodging); they show under the player's own Due list.
> - **Groups:** a hireling entry can have a **count** (e.g. "Light footmen ×20") for mercenaries; casualties and desertions lower the count. A campaign **wartime** switch doubles mercenary wages.
> - **Retainer XP (R1):** hirelings marked as retainers join the XP split and level up through the same flow as PCs, with the setting's XP penalty (set by the setting rules). Normal humans choose a class when they first gain XP.

**`08-roadmap.md`:** move "optional XP shares for hirelings" from R2 into M7. Holdings stay basic in R1; strongholds (construction calculator, structure price list, build time, engineers) and domains (patrols, settlers, taxes as recurring income) stay **R2**.

**private test pack (v0.3, private):** add the structure price list, retainer limits and loyalty by CHA (already present), retainer level cap, mercenary wartime multiplier.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Wage and expense periods add per day and per adventure; players get personal recurring expenses — retainer upkeep as the source rules describe it
- 2026-10-18 — Hirelings can be groups with a count; wartime doubles mercenary wages — mercenary companies without a row per soldier
- 2026-10-18 — Retainer XP and leveling move into R1 (M7) using the setting's penalty — retainers grow as the setting intends
- 2026-10-18 — Strongholds and domains stay R2 — scope discipline
```

---

## 21. Rule hooks in setting rules (approved 2026-10-18; new dates pending ⚑)

**`07-content-packs.md`, add a section "Rule hooks (format v2)":**
> Setting rules may include `hooks`: small declarative rules the app interprets. No code runs from a pack. Four kinds:
> - **fill** — set a value from a table or formula (e.g. starting loyalty from the employer's CHA via `abilityModifiers.CHA.loyalty`).
> - **warn** — flag when a value passes a limit (e.g. retainers per PC above the CHA limit; retainer level above employer level).
> - **factor** — multiply or adjust a number (e.g. retainer XP ×0.4; mercenary wages ×3 when the campaign is at war; invented numbers, 2026-10-29).
> - **remind** — prompt at a moment (e.g. after an adventure: a loyalty check for each retainer).
> Hooks use the same formula and lookup evaluator as level-up auto-fill and durations. Warnings never block; GM fiat always wins. The converter skill writes hooks along with the rest of a setting.
> Example (invented):
> ```json
> { "id": "retainer-limit", "kind": "warn", "when": "hireling.added", "scope": "employer",
>   "test": "count(retainers) > lookup('abilityModifiers.CHA', employer.CHA, 'maxRetainers')",
>   "message": "More retainers than this character's CHA allows." }
> ```

**`02-architecture.md`, add under the foundations:** "Rule-hook engine: interprets setting hooks (fill, warn, factor, remind) through the shared formula evaluator; no executable content in packs."

**`08-roadmap.md`:** M3 adds the rule-hook engine (about 1 week). Features then use hooks as they land: M4b (fill), M7 (factor), M9 (warn, remind). New hook kinds only as needs appear (R2+). A shared library of setting rules stays an open question pending IP review.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Setting rules carry declarative rule hooks (fill, warn, factor, remind) interpreted by the app; no code in packs; engine in M3 — setting-specific mechanics without breaking rules-agnosticism or safety
```

---

## 22. Final R1 dates, take 2 (approved 2026-10-18; supersede section 14)

**`08-roadmap.md`, R1 due dates:** M1 Nov 29 · M2 Dec 13 · **M3 Jan 17** (setting rules, rule-hook engine, converter skill) · M4 Jan 31 · M4b Feb 14 · M5 Feb 28 · M6 Mar 21 · M7 Apr 11 (adds retainer XP) · M8 Apr 25 · M9 May 9 · M10 May 23 · play-tests **Jun 6, 2027**. R2 target Aug 29, 2027; R3 target Nov 21, 2027 (tentative). R1 range: Nov 9, 2026 → Jun 6, 2027.

**`09-decisions-log.md`:**
```
- 2026-10-18 — M3 +1 week for the rule-hook engine; M4–R3 shift one week; play-tests Jun 6, 2027 — hooks make every later setting-driven feature cheaper
```

---

## 23. Final-review round fixes (approved 2026-10-18)

**`06-screens-and-design.md`, add:** "No explanatory subheadings under screen titles. Titles stand alone; context lives in the content or one tap away."

**`05-features.md`, GM add-ins / encounter tables — replace the entry flow with:**
> - The GM sees the **whole table** and taps the row that matches the dice rolled at the table (no number pads). Tables that point to another table open it in place, with a "‹ back" crumb.
> - **Where tables come from:** the setting rules (imported JSON/Markdown, usually built by the converter skill from your books), plus tables the GM creates or edits in the in-app editor. Each campaign shows the tables from its attached settings.

**`05-features.md`, Combat tracker — add (R1, M6):**
> - Tap **any** combatant (PC, hireling or foe) to see its details on the right: stat block for foes, a sheet summary for PCs and hirelings.
> - **+ Add a foe or ally** mid-fight: search the setting's stat blocks and add with one tap, or make one up (name, HP, AC). Table results add the same way.

**`05-features.md`, Charter — change:**
> - Tap the **sigil** to upload a new one; tap the **name** to rename. Both are proposals that go to a vote.
> - Shares: only the **party fund %** is set in the charter. Every charter member gets one share unless an exception says otherwise.

**`05-features.md`, Events:** the phone layout follows the GM's mode like the tablet: Explore (marching order with light and dark-sight cues, log) and Fight (acting now, party, foes' damage, log). The party sigil at the top opens the Company page.

**`09-decisions-log.md`:**
```
- 2026-10-18 — No explanatory subheadings under screen titles — screen space for content
- 2026-10-18 — Encounter tables show in full; the GM taps the matching row; tables come from setting rules or the in-app editor — faster than number pads, same physical dice
- 2026-10-18 — Tap any combatant for details; add foes or allies mid-fight from stat blocks or custom, in R1 — the GM never leaves the fight screen
- 2026-10-18 — Charter: tap sigil or name to propose changes; one share per member unless an exception — less chrome, simpler math
```

---

## 24. Adventure packs and encounter tables (approved 2026-10-18)

**`07-content-packs.md`, add:**
> - A pack's `meta.kind` is `setting` (rules, classes, items…) or **`adventure`** (an adventure's encounter tables, new monsters, handouts). Same format, same import, same privacy. A campaign attaches one or more settings and any number of adventures.
> - The converter skill reads adventure PDFs as well as rulebooks.

**`05-features.md`, GM add-ins / encounter tables — add:**
> - **Three sources, one list:** tables from setting rules, from adventure packs, and tables the GM builds.
> - **Quick table builder (R1, M6):** name, die, rows; paste rows straight from a PDF or notes ("1–2 Mire goblins (2d4)", one per line), parsed leniently on format and strictly on meaning; every row editable.
> - **Copy and edit** any table (including pack tables) into the campaign's own version; the original stays untouched.
> - **Current table:** the GM marks which table applies where the party is (e.g. "Sluice gate · level 1"); it opens first in Explore and Fight. The GM can switch it on the fly at any time.

**Round 17 approved** (Events on a phone; Pack in coin and slot modes), with one open item: ⚑ how items are added and equipped (to be designed next).

**`09-decisions-log.md`:**
```
- 2026-10-18 — Adventure packs (meta.kind = adventure) carry module tables, monsters and handouts; imported like settings; converter skill reads adventure PDFs — encounter tables are usually adventure-specific
- 2026-10-18 — Quick table builder with paste, copy-and-edit, and a "current table" the GM can switch on the fly, in R1 (M6) — tables change mid-campaign and must be at hand
```

**`10-open-questions.md`, add:** ⚑ Adding and equipping items (flow, equip rules, AC recalculation, two-handed and armour limits).

---

## 25. Character sheet, spells and items (approved 2026-10-18)

**`05-features.md`, Character sheet — add:**
> - One scrolling sheet, in this order: ability scores (3×2, modifier shown; tap for what each modifier does), experience (with any bonus %), class abilities, race traits, saves, languages, notes.
> - Values the setting calculates (modifiers, XP bonus, saves by level) are **filled automatically by your setting** and say so in their popup; the player can still override. Auto-filled values update when the setting's number changes (level-up, new score) **unless the player has edited them**; an edited value keeps the player's number and shows a small "setting 15" note beneath it, so it never silently goes stale. Clearing the edit returns it to automatic.
> - Abilities with limited uses show use dots and a Use/Undo button; dots refill at the reset the setting names (rest, day, adventure).
> - Abilities from later levels sit in a collapsed "Coming at later levels" row.

**`05-features.md`, Spells — add:**
> - The class's spellcasting type in the setting picks the screen: **book casters** choose from their spell book; **divine casters** choose from the whole class list for their level ("Pray for", ×N for the same spell twice, slots shown as dots).
> - Reversible spells keep one entry; the caster chooses the form when casting.
> - Scrolls show under "Scrolls carried"; one-use, Cast from scroll / Undo; greyed out when the scroll's casting type doesn't match the character's class. Shown on both the spell book (arcane) and prayers (divine) screens.

**`05-features.md`, Items — add:**
> - **Add an item:** search the setting's item list (weight or slots, cost shown), quantity, how it was got (Bought takes the cost from the purse; Found; Given — all logged), and where it goes (worn, in hand, backpack, any container). "Not listed?" makes a one-off item.
> - **Equip:** armour, shield and weapon in hand as switches; AC, damage and move recalculate live.
> - **Gentle warnings from setting hooks:** swapping armour, armour the class can't use (GM can allow), a two-handed weapon with a shield (offers to stow the shield). Warnings never block; the player confirms or keeps things as they are.

**`07-content-packs.md`, add:** items carry `slot` (armour, shield, hand), `hands` (1 or 2), and classes carry `armourAllowed` and `spellcasting` (`book` | `divine` | none); scrolls carry `castingType`. Hooks read these to warn; future setting packs can add their own fields and hooks without app changes.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Character sheet order; auto-filled values update unless edited, edited values show the setting's number beneath — the setting does the math, the player keeps control, nothing goes stale silently
- 2026-10-18 — Spell screen chosen by the class's spellcasting type (book or divine); reversible spells chosen at casting; scrolls by casting type — one app, any setting's casters
- 2026-10-18 — Add/equip flow with live AC and non-blocking hook warnings — resolves the open question on adding and equipping items
```

**`10-open-questions.md`:** mark ⚑ Adding and equipping items as resolved (see decisions log).

**Private test pack v0.3 to-do:** add item `slot` and `hands`, class `armourAllowed` and `spellcasting`, scroll `castingType`.

---

## 26. Final-review feedback, part 1 (approved 2026-10-18)

**Approved:** Level up; all Downtime screens (GM Downtime, Split Loot, Player Downtime); all Company screens (Charter, Vote, Treasury, Hirelings, Holdings).

**`05-features.md`, Level-up — replace the overwrite rule with:**
> - When the setting's new value differs from a value the player edited by hand, the level-up preview asks for that value: "You set Breath to 13 · your setting says 14 · **Use 14** / **Keep 13**". Values the player never edited update automatically after the preview.

**`05-features.md`, GM console — rename:** "Wandering check" becomes **"Encounter check"**; the mode toggle **Explore / Fight** becomes **Explore / Encounter** (Fight is a step inside an encounter; detailed flow to follow in section 27 once questions are settled).

**`01-product-brief.md`, principles — add:**
> - **Homebrew is first-class.** A GM can make a homebrew pack (rules, setting, adventure or anything else) and load it alongside other setting rules. Where they conflict, homebrew wins by default; the GM can change which one wins in Optional rules.

**`09-decisions-log.md`:**
```
- 2026-10-18 — Level-up asks per edited value (use the setting's or keep yours); unedited values update after preview — reconciles auto-fill with player control
- 2026-10-18 — "Encounter check" replaces "wandering check"; GM modes are Explore / Encounter — an encounter is not always a fight
- 2026-10-18 — Homebrew packs load alongside setting rules; homebrew wins conflicts by default, GM can override in Optional rules — robust homebrew support
- 2026-10-18 — Level up, Downtime and Company screens approved for R1
```

---

## 27. Final-review feedback, part 2 (approved 2026-10-18)

**`02-architecture.md` / `05-features.md`, Sign-in — replace the magic link with:**
> - Email **6-digit code** (works inside the installed app on iPhone/iPad, where email links open in the browser instead). Devices stay signed in until the user signs out. No tablet lock.

**`04-data-model.md` — Campaign and Company:**
> - A **Campaign** has its own name and sigil; the **GM** changes them (no vote).
> - A campaign has **zero, one or many Companies**. Each company has its own charter, treasury, titles and votes.
> - A character belongs to **at most one** company at a time.

**`05-features.md`, Player tab:**
> - Attacks, spells and other effects show final numbers with current modifiers already applied ("Short sword +3 · 1d6+1"); tap for the breakdown. Quick reference, no digging.

**`05-features.md`, Character sheet:** a **Backstory** popup (bio, relationships, history) — one free-text block for now.

**`05-features.md`, Add item:** one-off items are saved to the campaign's **homebrew pack** and appear in search from then on.

**`05-features.md`, GM to players:**
> - The GM can send text and pictures (room and monster descriptions, visual aids, maps) to **one player, all players, or the shared screen**. Events (tablet) gets a "From the GM" area.
> - Explore shows the **current location** (hex, room or dungeon area) with its notes, maps and pictures, and a **Reference tables** button (the GM-screen tables from the setting rules, adventures and homebrew).

**`05-features.md`, Encounter flow — replace the old Fight toggle with:**
> - Modes: **Explore / Encounter**.
> - Explore: Encounter check → **Hit** → the encounter tables pop up → the GM taps a row → Encounter mode opens filled in. **Start encounter** skips the check (keyed rooms, story encounters).
> - Encounter: description, relevant rules, the setting's **surprise** and **reaction** tables when it has them (otherwise a Surprised button and a generic reaction choice). Ends with **Fight** or **End encounter** (back to Explore, logged).
> - **Fight** turns the same screen into the fight layout: Acting now, next round, End fight, plus + Add a foe or ally, statuses and stats in the three-column view. The encounter-table panel is replaced by this fight control column.
> - The shared screen shows only what the GM sends. Hidden still means hidden.

**`07-content-packs.md`, Homebrew:**
> - Packs stack in **one priority order** (homebrew on top by default); exceptions rule by rule in Optional rules.
> - Each campaign has an automatic **campaign homebrew pack** holding its one-off items, custom tables and custom foes.
> - Full in-app homebrew editor (classes, rules, spells): **R2**. Until then, the converter skill can build homebrew packs.

**`08-roadmap.md`:** rules lookup and rules-section display are **deferred** (not scheduled).

**`09-decisions-log.md`:**
```
- 2026-10-18 — Email 6-digit code sign-in, stay signed in, no tablet lock — magic links open in the browser, not the installed app
- 2026-10-18 — Campaign has its own name and sigil (GM-edited); zero to many companies per campaign, a character in at most one — not every campaign has exactly one party
- 2026-10-18 — Player tab shows attacks and spells with modifiers applied — quick reference, no digging
- 2026-10-18 — Backstory popup on the full sheet; one-off items saved to the campaign homebrew pack — less clutter, reusable items
- 2026-10-18 — GM sends text and pictures to one player, all, or the shared screen; Explore shows current location and reference tables — the table sees what the GM chooses
- 2026-10-18 — Encounter flow: check → table → Encounter (surprise, reaction) → optional Fight — an encounter is not always a fight
- 2026-10-18 — Homebrew packs in one priority order with per-rule exceptions; campaign homebrew pack automatic; full editor R2 — robust homebrew without blocking R1
- 2026-10-18 — Rules lookup and rules-section display deferred — revisit later
```

**`05-features.md`, Split Loot with companies — add:**
> - **No company:** the haul splits equally among the characters present; no party fund.
> - **Several companies:** the GM sets how much of the haul each company gets; each company's charter then applies to its part.
> - Characters may belong to **no company** (e.g. a newcomer before joining).

**`05-features.md`, GM messages — add:**
> - Messages land in a "From the GM" list on each recipient's Events tab, readable again during the session, then kept in the log.
> - The GM can mark a message **Burn after reading**: it disappears once the recipient closes it and is not kept in the players' log (the GM still sees it was sent).
> - Surprise and reaction results are GM-only unless the GM sends them.

**`09-decisions-log.md` (more):**
```
- 2026-10-18 — Loot: no company = equal split among present; several companies = GM sets each company's portion, then its charter applies — supports any party structure
- 2026-10-18 — GM messages can be "burn after reading"; surprise and reaction results GM-only unless sent — secrets stay secret
```

---

## 28. R1 design approved (2026-10-18)

The final review canvas ("Grimoire R1 Final Review", 26 screens) is **approved as the R1 design**. It may change after testing.

**`06-screens-and-design.md`, add at the top:**
> - **R1 design of record:** the "Grimoire R1 Final Review" canvas (approved 2026-10-18). Where it and these docs differ, the docs' written rules win and the canvas is updated.
> - Not drawn but specified: GM messages on the player's phone Events tab (a "From the GM" list, burn-after-reading supported); Split Loot across several companies (GM sets each company's portion, then each charter applies).
> - The GM tablet encounter-table screen is retired; its jobs moved into the GM console (Explore / Encounter / Fight).

**`09-decisions-log.md`:**
```
- 2026-10-18 — R1 design approved (final review canvas, 26 screens); subject to change after testing — ready to build
```

---

## 29. Final R1 dates, take 3 (approved 2026-10-18, option B; supersedes sections 14 and 22)

**`08-roadmap.md` — replace the milestone dates with:**

| Milestone | Due |
|---|---|
| R0 setup and mockups | Nov 8, 2026 |
| M1 accounts, campaigns (name and sigil), companies data model, characters | Nov 29, 2026 |
| M2 event log, commands, rollback, fiat | Dec 13, 2026 |
| M3 setting rules, rule hooks, homebrew stacking, converter skill | Jan 24, 2027 |
| M4 inventory, add and equip, encumbrance | Feb 7, 2027 |
| M4b guided character creation | Feb 21, 2027 |
| M5 modes, Explore console, location, reference tables, Send (text) | Mar 7, 2027 |
| M6 encounter flow and combat tracker | Apr 4, 2027 |
| M7 XP, level-up, spells, purses, companies' ledgers, Split Loot, charter | Apr 25, 2027 |
| M8 titles, voting, in-app alerts | May 9, 2027 |
| M9 hirelings, holdings, downtime, Events, offline | May 23, 2027 |
| M10 hardening, backups, export, deploy | Jun 6, 2027 |
| R1 complete (two playtests Jun 6–20) | Jun 20, 2027 |
| R2 target (tentative) | Sep 12, 2027 |
| R3 target (tentative) | Dec 5, 2027 |

**`08-roadmap.md`, R2 — add:** pictures in GM messages; maps-and-pictures strip in the Explore location panel; full homebrew editor.

**`09-decisions-log.md`:**
```
- 2026-10-18 — R1 moved to Jun 20, 2027 (option B: +2 weeks); message pictures and the location picture strip deferred to R2 — keeps R1 in June while building the encounter flow and companies
```
