# Plan: M5b step 0b — weapon skills and trait lists at creation

Written by the design agent, 2026-11-01, from `design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md`. Read the specs it names; this file makes no rulings. **Qualifies for Fable** for part B (a new player-readable library kind: row-level security). Part A can be built inside #231 or here, the builder's call.

## What this step delivers
**A. Weapon skills** (ruled Now): the creation step, the character's `weaponSkills`, the Skills-block row, the To finish line that returns after a level-up, the owner-adds / GM-changes rule. **B. Trait lists** (⚑ 1, if Now): `traitLists` kept by the importer as a player-readable kind, sheet fields keeping `from`, one creation step per list, Decide later, the owner's later change.

## Already built (verify first)
The creation steps and their shell (#231: why-lines, blurbs, Help me choose, Decide later, To finish card, languages step with Option rows and ✓), `allows()` for `weaponsAllowed`, items' `weapon` blocks and categories, `creation.require`, the Skills block on the full sheet.

## Rests on
- 05 Characters: *Guided creation revisited* (weapon skills, trait lists), *The full character sheet: Skills block*, *Identity: trait fields*.
- 04: *PC extras* (`weaponSkills`, `toFinish`), *traitLists* and sheet field types.
- 06: Components *Weapon skills step*, *Trait list step*, *Option row*, *To finish card*.
- 07: `weaponProficiency`, classes' `weaponProficiencyCategory` and `weaponsAllowed`, `traitLists`, `creation.require`.
- 03: after approval only the GM changes class and race; the same rule for removing a weapon skill.

## Build order
**A — weapon skills**
1. **Data:** `weaponSkills` on the character (migration if the character row is relational here; otherwise the JSON column), derived `allowed` and `unspent`; To finish line while unspent > 0; commands `weaponSkill.add` (owner while unspent > 0, GM any time), `weaponSkill.remove` and `weaponSkill.specialise` (GM; owner before approval), all logged.
2. **The step:** rows from the setting's weapons the class may use, grouped by category; count; Specialise toggle when its option and category apply; the collapsed restricted group when its option is on; Help me choose with carried weapons first; Decide later unless required.
3. **The sheet:** Skills block row with ⓘ (the rule and penalty); the To finish line reopening the step.
4. **Hand-off to M6:** a pure function `weaponPenalty(character, item)` → modifier with source, used by the attack prompt later; tested now.

**B — trait lists** (if ⚑ 1 is Now; Fable)
5. **Kind:** `traitLists` into `PACK_PARTS` and the importer; player-readable through the hooks-readable rule (migration + visibility test as a player).
6. **Fields keep `from`:** field definitions carry it through import and the sheet.
7. **The steps:** one per list the sheet fields point at; Option rows with blurbs and ranges; Decide later; required via `creation.require`; the owner changes the value later from the sheet (logged).

## Tests (purpose first)
- A class with no category, or the option off, has no weapon skills step.
- The count stops picks at `start`; Specialise spends `cost` and gives them back when turned off.
- Restricted weapons are listed but can't be picked.
- A level that grants a pick puts "Weapon skills · 1 to pick" on To finish; the owner can add one, can't remove one; the GM can.
- `weaponPenalty` returns the penalty with its source for an unpicked weapon, the bonus for a specialised one, nothing otherwise.
- (B) A player reads `traitLists` of the campaign's setting and nothing GM-only (database test as a player); a list with a die shows ranges; Decide later lands the list id on To finish.

## Scope checks (write one and stop)
- No weapon groups as picks (G-47, parked).
- No attack-prompt change here (M6 reads the function).
- No sign from a birthday (R3).

## ⚑ for Francis (ask at the start)
1. Trait lists Now (part B here) or Later (M7)? — **Ruled Now, on Fable (2026-11-01).**

## Estimate
A: 8–12 builder turns (Opus). B: 10–15 (Fable for the kind and its rule, then Opus).

## Departures
(The builder keeps this current in the same pull request.)

**Part A was built in #231** (builder, Opus; part B waits on ⚑ 1). What differs:
1. **One command, not three.** The picks are a column on the character (`actors.weapon_skills`, migration `20261101160000_m5b_weapon_skills.sql`) changed through the existing `character.edit`, so they're logged and undone like any edit. Who may change what is held by a database guard: before approval the owner freely; after approval the owner only adds unspecialised picks (every existing pick stays exactly as it was); the GM always. `weaponSkill.add` / `.remove` / `.specialise` would have meant three new logged commands for the same rows.
2. **The count is the app's, not the database's.** How many picks a level allows comes from the pack, the class and the level; the app works it out and refuses past it, and the database holds the shape and the add-only rule. A tampered client could add more than allowed after approval; the log shows it.
3. **The full sheet has no Skills block** (skills show on the Player screen). The weapon skills row ("Weapon skills · Reed spear, Eel knife · specialised", ⓘ with the pack's note, the penalty and the specialisation note) is its own small section near the top of the full sheet; nothing on the Player screen, as ruled.
4. **Help me choose** expands in place (the same part as every other step), not a side panel or sheet; and "carried first" isn't wired yet (the step doesn't read the pack, so nothing is marked "in your pack").
5. **No ⓘ per weapon row** for the item's full entry; the row shows its damage and tags.
6. **`pack:check`'s warning** (the option without a class category) isn't added here: the pack:check session (#230) owns that script.
7. **The review** marks Weapon skills only through To finish (decided later); the picks themselves show on the sheet, not as a review section (the plan: no new review sections).
8. **The step counter** before the class is chosen doesn't count the weapon skills step (it can't know yet); it does from "Who are they?" on.
9. **The specialisation** counts `cost` as the weapon's whole spend (one pick plus the extra), as "spends 2 of your 3 picks" reads.

**Part B was built on Fable** (branch `m5b-0b-traits`, from #231's branch; ⚑ 1 ruled Now 2026-11-01). What differs:
1. **The step's id is the list's id** ("fen-backgrounds"), on To finish as ruled; inside the flow it's carried as `trait:<list id>` so it can't collide with a guide step's name. The To finish card, the review and the sheet show the list's **name**.
2. **Required** is read two ways: `creation.require` naming `"traits"` (every list) or a list's id (that one). The plan said only `creation.require`.
3. **The steps' order** is the sheet fields' order (the layout's, which is the pack's), one step per list even when two fields point at the same list (the first field keeps the pick). The ruling's "in the pack's order" could also mean the `traitLists` part's order; the fields' order is what the sheet shows.
4. **No `gmOnly` handling of its own**: a trait list's `gmOnly` fields are split off by the existing rule for every kind (tested as a player).
5. **Existing campaign fields** made from a layout whose field had a `from` were saved as text (they had no choices); the migration gives them their `from` and makes them list fields, matched by key, with the triggers paused as `20261025190000_m4b_field_fill_links.sql` did (re-filed, not logged). What players typed before stays as typed and shows as typed. The plan didn't say; without it no existing campaign would ever get the step.
6. **The sheet's edit form** offers the list in a select (the same `CampaignFields` part, a list fed by a trait list), not the step; the step opens from To finish. A value the list doesn't have (typed before) stays selectable so a save doesn't lose it.
7. **The homebrew editor can't make a trait list** (not in `EDITABLE`): a list of entries with ranges needs its own editor; packs bring them.
8. **The why-line's fallback** when a list has no `notes`: the pack's `creationGuide.traits` line, else the app's "Choose who your character was before adventuring."
