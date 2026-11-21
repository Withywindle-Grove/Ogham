# Plan: options that behave (of-1 … of-11, the options audit)

Ruling: `docs/design/rulings/m5b-options-format-2026-11-03.md`. Audit: `docs/plans/options-audit-2026-11-03.md` (every option, what it should change, where, and whether it works today). Francis (2026-11-03): every optional rule must behave properly before packs grow more complex. **M5b**, before the gate.

## What this step delivers
One shared option reader every screen uses; the audit's rows become automated tests against the real packs; the format pieces of-1 … of-11.

## Build order (each its own PR, from main)
1. **The shared reader and the tests** (of-3, of-9): one function (`optionGate(entry, campaign)`) answering "does this entry exist" (`option`) and "what are its fields now" (`byOption`, with `null` sections, of-10), used by Add item, the shop, creation, the sheet, the Player screen, the equip check, the GM reference; fields whose option is off hidden, values kept; the option's Rules row says what it adds. **Tests:** one per audit row, against `packs/_current` (local, like `creationOptions.realPacks.test.ts`) plus invented fixtures in CI: each option on and off, its screens checked. 6–9 turns.
2. **Extends and one switch** (of-1, of-2): `extends` options shown as one option with labelled choices; `pack:check` warns on `extends` + `ruleKey`; the empty-level safety net. 3–4 turns.
3. **Lists and patches** (of-12, of-13): `option` lists and comma `byOption` keys in the shared reader; overlay `patches[]` applied to matched base entries, with the reason in breakdowns; `pack:check` warnings. 3–5 turns.
4. **The small ones** (of-4, of-5, of-6, of-7, of-8, of-11): modifiers' `onlyWithOption`; Use safe paths without a roll and the stepper label; any `listLevel`; trait-list `distinct`; `attack.weaponDamage`; pick lines in starting equipment. 4–6 turns.

5. **Requires, later rule changes, presets** (bq3-13, `design/rulings/m5b-builder-questions-3-2026-11-04.md`): an option that `requires` another is offered only once its parent is on, and switching the parent off switches it off (A1, X1); a change of the encumbrance rule mid-campaign re-reads every character's load at once, logged (A3); presets (X2) at set-up and in the Rules tab, applying a bundle of choices with a preview and Undo (A8). Tests: one per audit row (A1, A3, A8), on and off. 3–5 turns, no migration expected. A4 (the attack field follows the AC style) is built with the sheet plan's Combat tiles (`plans/m5b-sheet.md` PR 1); A5 (the proficiency penalty) in M6.
## Scope checks
- Any gate kind beyond `option`, `byOption`, `onlyWithOption`, `forClasses`, `forRaces`.
- An audit row whose expected behaviour needs a design call (write it up; don't guess).

## ⚑
None open. The audit's independent re-check may add rows; they become tests the same way.

## Estimate
About 19–29 builder turns. Pack session: the fields under each ruling's "Pack session" line.

## Departures

**Designer, 2026-11-04 (`design/rulings/m5b-small-questions-2026-11-04.md`):** PR 4's ⚑: the dungeon-exit depth stepper starts at 0 (sq-1); "Use safe paths" gets its log event in a small follow-up PR now, one migration (sq-2).

**Built on `m5b-small-followups` (2026-11-05), sq-1 and sq-2:**
- sq-1: Leave the dungeon's stepper starts at 0 ("0 levels below the first: no change"); 1 is the second level and the per-level modifier reads from there (`depthModifier` already did; only the start moved).
- sq-2: migration `20261105100000_m5b_safe_paths_logged.sql` (test project only): `expeditions.safe_paths` (default false), `public.use_safe_paths(expedition)` (the GM's; refused on an undone or ended expedition) and the `expedition.safePaths` row (Simple, the GM's). The app's command is `leaveBySafePaths` (`play.ts`); the log line reads "<GM> led the party out by safe paths."
- **Silent choices:** the line is written when Use safe paths first shows the note on an expedition; Hide safe paths writes nothing, and showing it again on the same expedition writes no second line (the database gives the expedition back unchanged). Undo is the generic one (toast or log); after End expedition the mark can no longer be undone from the toast ("That's changed since"), as with any change to an ended expedition.
- **Two technical items from the gate notes (no ruling needed), in the same PR:** armour-mode travel speed now reads the database's load line ("Move 120 ft", the armour row's movement) as its first number, the number `speedOf` gives for that load (`speedFromTier`, `travelView.ts`; it was null in armour mode, so the budget asked the GM). The sheet already read it through `loadSpeed` → `speedOf`: unchanged. And the shared table reader (`rangeOf`, `tables.ts`) reads "≤N" as N or less (label "≤N"); `kindredTables.ts` and `firstSpells.ts` read whole `min`/`max` only and weren't changed. **Not done:** the database's weather roll (`20261031090000_m5b_weather_roll.sql`, mirrored in `fakeDb.ts`) doesn't read "≤N": a weather table row written that way would be skipped there; 07 says so. A follow-up migration if a pack needs it.
**Ruled by Francis, 2026-11-04 (build session):** PR 3b's scope check: a patch on a carried line's own weight, slots or stack doesn't change the database-summed load of lines already carried; left until a pack uses such a patch ("ok").

**Designer, 2026-11-04 (`design/rulings/m5b-builder-questions-3-2026-11-04.md`):** audit rows: A1, A3, A8 here (M5b), A4 with the sheet's Combat tiles, A5 in M6 (bq3-13); `forRaces`, "adds a field" on set-up, "Off · the option" in the reference and partial list levels later (bq3-11, 12, 14, 15); patches' library kind as PR 3b now (bq3-16) with of-14's details (bq3-17).
(The builder keeps this current.)

### PR 1, the shared reader (branch `options-gates-1-reader`)
**Built.** `src/modules/library/optionGate.ts`: `optionSpecOn` (the one spec parser), `optionGate(entry, choices)` (`inPlay`, `offBy`, `data` with `byOption` applied, `null` fields removed), `entriesInPlay`, `fieldsOff` / `fieldsInPlay` (of-9), `fieldsAddedBy` / `withFieldsAdded` (the Rules row). Every entry passes it once when the setting is read (`settingFrom` in `campaignSetting.ts`, the pure part of `loadCampaignSetting`); an entry switched off stays in `setting.all` marked `optionOff`, so what a character already has still shows by name, and every list keeps only `entriesInPlay`.

**Old readers folded in:**
- `entryOptionOn` (options.ts, PR D) is now `optionSpecOn(entryOptionSpec(…))`; its per-screen calls (creation's class list, Gear's kits, the Gear step's presence) are `entriesInPlay`.
- `traitLists.optionSpecOn`, `weaponSkills.optionIsOn` (kept: no spec is off there) and the expedition's `modes.optionOn` call the shared parser.
- `resolveRules`' merge is the shared `mergeOver` (a `null` section is off, of-10).
- #336's `withRaceOptions` / `raceInPlay` stay the race branch of the reader (limits replaced, abilities added) and now merge any other field (bq2-1); #365's `classLimits.ts` reads the race as the reader leaves it, unchanged (bq2-2's refusal at Pick unchanged).
- The equip check's "optional ids pass" and Weapon skills' `classMayUse` read the class in play: `weaponsAllowed.optional` is dropped while its option is off (audit A2, arcane staves).
- Rules sets resolve with each pack's own choices over every option's choice in play, defaults filled (audit X5, A6).
- The rules browser in a campaign and the GM reference keep only entries in play (X7), their words as the pack has them (they show the book, X3).

**Not folded:** `GuidedCreation.optionOn` (start-over and re-roll rules): an option the campaign doesn't have counts as on there, a different meaning, kept.

**Silent choices (standing rule 2026-10-31):**
- A race's `byOption` merges any field but the three it reads its own way, so `abilityModifiers: { CHA: 1 }` replaces that score's change rather than adding to it (the base race had none in the case ruled).
- The GM's Add item hides off items too (they don't exist, of-3).
- A field reading from a list switched off is hidden like a field whose own option is off.
- A `byOption` key with no choice (`"lantern-oil"`) is ignored on non-race entries (`<option>=<choice>` only, 07).

**Scope checks (technical, for Francis):**

> **Scope check — fields' `forRaces` (of-3)**
> **What:** of-3 adds `forRaces` beside `forClasses`; `forClasses` isn't read yet (creation survey plan, item 6).
> **Now:** PR 1 · cost half a day · pushes back nothing · redo risk medium (built twice when item 6 reads `forClasses`)
> **Later:** creation survey item 6, both read by one check · cost then the same · we lose nothing (no pack field uses `forRaces` yet)
> **Recommendation:** Later, with `forClasses`. **Options:** A Now · B Later · C R2 · D Drop

> **Scope check — "Adds a field" on the set-up step's rows**
> **What:** the campaign set-up's rules step uses the same rows as Rules for this campaign but has only the options, not the layouts; PR 1 says it on Rules for this campaign only.
> **Now:** PR 1 · cost an hour (pass the layouts to the step) · redo risk low
> **Later:** with build order 2 (extends, which touches the same rows) · we lose the words at set-up until then
> **Recommendation:** Later, in build order 2. **Options:** A Now · B Later · C R2 · D Drop

> **Scope check — audit rows with no build order**
> **What:** the audit's A1 (`requires`, X1), A3 (encumbrance follows a later change of the rule), A4 (attack field and weapons at hand follow `ac-style`), A5 (proficiency penalty and specialisation at hand), A8 (presets, X2) are in none of this plan's build orders. They are `todo` tests in `optionsAudit.realPacks.test.ts`.
> **Now:** a build order 5 in this plan · cost 2–4 days · redo risk low
> **Later:** M6 (A4, A5 belong with fights) · we lose the add-on rows' correctness (X1) until then
> **Recommendation:** A1 now (small, ruled in 07), the rest Later; a designer call on where each goes. **Options:** A Now · B Later · C R2 · D Drop

> **Scope check — "Off · the option" in the GM reference (of-10)**
> **What:** the reference shows a rules set's `byOption` in words (the book); a `null` section reads as nothing rather than "Off · the option".
> **Later:** with X3 (marking the variant in use) · cost an hour · **Recommendation:** Later. **Options:** A Now · B Later

**The audit against the newest private packs (local):** every row passes except two stale ids: `cantrips` (the base's switch is gone, of-2: the overlay's `zc-i5-opt-cantrips` stays) and `zc-i1-opt-firearms` (now three on/off era options). The audit's rows need the pack session's update; the test names them. The creation table's O7 fails the same way (`creationOptions.realPacks.test.ts`). Not fixed here: `allClasses.test.ts`'s 20 overlay classes (it reads the overlay without its base; `settingFrom` could stack them, not done here) and four `expedition/realPacks.test.ts` tests on one setting pack (they read the raw rules set, not resolved; not this reader).


### PR 2, extends and one switch (branch `options-gates-2-extends`)
**Built.**
- **`extends` (of-1).** `readOptions` reads it. `withExtends` (`ruleGroups.ts`) shows an extending option as one with its base: the base's choices, then the overlay's, each labelled with its pack; the overlay has no row of its own. It is applied wherever a campaign's rule sources are built: the setting (`ruleKey` groups), Rules for this campaign, set-up step 3, Setting rules' "New choice" offer, and the attach and detach checks (`campaignPacks.loadRuleSources`). The choice is stored with the base pack's choices under the base option's id, as the packs already name it (`byOption` keys and `requires` say `encumbrance=items`).
- **The reader.** An extending option has no choice of its own (`choiceInPlay`); a stored choice no attached pack offers any more (its overlay detached) reads as the default, as the Rules row shows. A rules set reads its own pack's options through that check. `campaignPresets` (set-up) reads every pack's choices, so an overlay's `byOption` on its base's option works from the first day.
- **The row.** A rule whose choices come from several packs is never a segmented control; its pop-up lists each pack's choices under the pack's name (the `ruleKey` card's look); the button names an overlay choice in use ("Reed slots · Reed zine"); the `ruleKey` card adds "· from <pack>" to a choice an overlay brought.
- **`pack:check`** notes an option with both `extends` and `ruleKey` (`extendsNotes`).
- **The empty-level safety net (of-2, si-1).** First spells' levels hold only spells in play (the shared reader: a spell an option switches off is on no level). A Pick or Cantrips group whose level is empty shows "No spells at this level in your packs." with no count, and asks for nothing: Next isn't held up by it.

**#376's scope checks 2 and 3 (not ruled, not built).** Build order 2 depends on neither. The set-up step's rows still don't say "Adds a field"; an add-on's `requires` (A1, X1) still isn't read, so the zine's STR add-on to item counts is offered whatever the base's choice.

**Silent choices (standing rule 2026-10-31):**
- An extending option whose base isn't attached is offered nowhere: its `byOption` keys name the base option, so nothing would read its choice.
- Its base is the first pack in stack order, other than its own, with an option of that id that extends nothing itself (in set-up: the order the packs were picked). An option extending an extending option isn't followed.
- An overlay choice whose id the base already has stays the base's; `pack:check` says nothing about it.
- An overlay choice without notes takes its option's notes.
- The base option's `changeLater` governs the whole row.
- The add-pack dialog (Setting rules › add a pack with options) leaves extending options out: they're chosen on the base's row afterwards.
- The empty group's title drops its count ("Spells", "Cantrips") so it doesn't say "pick 2" beside "No spells…".
- The options audit test stacks a pack on its `meta.requires` as well as `meta.base` (the zine names its base that way).

**Scope check (technical, for Francis):**

> **Scope check — a list level with fewer spells than the count**
> **What:** of-2's net covers an empty level. A level with some spells but fewer than the group's count (2 to pick, 1 there) still holds Next up for ever: the count can't be met. None of the newest private packs has such a level today (the real-pack row checks).
> **Now:** this PR · cost an hour (ask for no more than the level has, the line saying how many there are) · redo risk low
> **Later:** with of-6 (`listLevel`, build order 4), which touches the same groups · we lose nothing until a pack has such a level
> **Recommendation:** Later, in build order 4. **Options:** A Now · B Later · C R2 · D Drop

**The audit (local, newest private packs):** X6 is now a test and passes (the zine's item counts on the base's encumbrance row; its rules set's `encumbrance=items` applies). The of-2 row passes: the packs have two empty levels today, and neither holds Next up. The audit file's X6 row still reads "broken": the pack session's file to update. Failing as before PR 2: the stale `cantrips` and `zc-i1-opt-firearms` rows, O7, `allClasses.test.ts` (20) and `expedition/realPacks.test.ts` (4).


### PR 3, lists and patches (branch `options-gates-3-lists`)
**Built (of-12).**
- **The reader.** `optionSpecOn` reads an `option` given as a list (any of its choices) and a spec listing several choices comma-separated; `specParts` names each choice a spec lists, `specOptions` its option ids, `specText` a list as one spec, `byOptionKeyOn` a `byOption` key (every part "<option>=<choice>", any of them chosen). Every reader that took one spec goes through them: entries (`optionGate`, so Add item, the shop, creation, the rules browser and the GM reference), rules sets' `byOption` in any section (`resolveRules`, which split on `=` before), races' `byOption` (`raceInPlay`) and its checker notes, sheet fields and trait lists (`fieldsOff`, `fieldsAddedBy`, `traitListsOf`, `layoutHints`), weapon skills' rules, and exploration parts' `option` (`optionSpecOf`).
- **`pack:check`** (`scripts/pack-option-gates.mjs`): an entry's `option` (one or a list) or `byOption` key (one or comma-separated; a rules set's in any section) naming a choice its option doesn't have; a bare option without an `on` choice; a malformed key; an `option` that isn't words or a list of words. Alone, a pack is checked against its own options; as a library (several files), against every pack's, an extending option's choices counting (of-1), and an option no pack has is noted.

**of-13 (patches): only the checker; the app part stopped (scope checks below).**
- `pack:check` counts `patches`, no longer calls it an unknown part, and notes a patch's shape (byOption, `match { kind, category?, ids? }`, `change` or `option: null`, both, neither, an empty change, a delta that isn't a whole number); as a library, a `match` that finds nothing, an id in `match.ids` no pack has, and a byOption choice no option has.
- The app doesn't read patches yet: importing a pack with them still says "patches isn't a part … left out" and imports the rest. (Built in PR 3b below.)

**#376's scope checks 2 and 3, the area-2 fields and build order 4: not built.**

**Silent choices (standing rule 2026-10-31):**
- An `option` written as one string may list several choices comma-separated too (one reader for `option` and `byOption` keys).
- A rules set's `byOption` key may now be written with `:` as well as `=` (the shared reader's two spellings); none of the newest private packs does.
- A list's parts that aren't words are left out; an empty list gates nothing (`pack:check` notes it). A part with no choice means the option's `on` choice, as a single spec does; in a `byOption` key, such a part makes the whole key never apply (07: "<option>=<choice>").
- An entry switched off by a list is marked with its specs joined by commas (`optionOff`); nothing shows that text.
- `pack:check` checks a table's `option` as any entry's (beside the existing "old way" note); a table's `onlyWithOption` stays `pack-exploration.mjs`'s; races' `byOption` keys stay `raceOptionNotes`'.
- `ruleGroups.ts` reads no option specs, so it is unchanged.

**Scope check (technical, for Francis):**

> **Scope check — patches need a library entry kind (of-13)**
> **What:** a pack's `patches[]` can only reach the app as a stored entry: `library_entries`' kind check has no `patch` kind (newest in `20261103150000`), and players' devices need patches (an armour's AC, a weapon's damage), so `private.player_facing` would add it too: a migration touching row-level security (qualifies for Fable). Then the import, the campaign's entries, the reader (applied to the matched entries when the setting is read) and the reason in breakdowns.
> **Now:** a PR 3b in this plan, after the design call below · cost 1–2 days · pushes back nothing else in M5b · redo risk low once the design call is made
> **Later:** with G-06's rules-set patches (after R1) · we lose the zine's weaker materials (the pack session is writing them as patches now; until then they don't apply, and `pack:check` says nothing is wrong)
> **Recommendation:** Now, as PR 3b, once the design call below is ruled. **Options:** A Now · B Later · C R2 · D Drop

> **Scope check — what a patch does where the ruling is silent (design call)**
> **What:** of-13 rules the shape, not these: (1) the field a `change` names: an entry's top-level field only, or a path (an armour's AC sits inside `armour`, `{ base, ac, aac }`); (2) a `delta` on a dice field (a weapon's damage "1d8" under bone: "1d8−1"? one die step down?) or on a field the entry doesn't have; (3) two patches, from one overlay or two, changing the same field (both deltas add? the higher pack's wins?); (4) the order against the entry's own `byOption` (patch first or last); (5) whether a patch reaches its own pack's entries and a homebrew pack's winning copy; (6) an entry a patch removes (`option: null`): marked switched off like an option-gated entry, so a character who carries one still sees its name; (7) which breakdowns name the reason today (the AC breakdown at hand, the weapon's damage) and the words for a field that isn't AC.
> **Now:** a `designer` session before PR 3b · cost an hour · redo risk high if built without it
> **Later:** with PR 3b, whenever it is scheduled · we lose nothing until then
> **Recommendation:** Now, a short design call (one ruling, of-14). **Options:** A Now · B Later · C R2 · D Drop

**The audit (local, newest private packs).** The of-12 row (an entry gated on several choices exists under each, and only those) is a test and passes: the packs have no lists or comma keys yet (zine-compendium 0.5.11), so it waits on the pack session. The row-by-row tests now read comma `byOption` keys. of-13 is a `todo` naming the scope check. `pack:check` on the newest packs finds one real note: the zine's material cost table names its four-choice option with no choice (`option` "<id>", read as its `on` choice, which it hasn't: the table is never in play). Failing as before: the stale `cantrips` and `zc-i1-opt-firearms` rows, O7, `allClasses.test.ts` (20) and `expedition/realPacks.test.ts` (4).


### PR 3b, patches applied in the app (branch `options-gates-3b-patches`; Fable, approved 2026-11-04)
**Built (of-13, of-14 = bq3-16, bq3-17).**
- **The kind.** Migration `20261104150000_m5b_patches_kind.sql`: `patch` joins `library_entries`' kinds and `private.player_facing` (so the read rule, the log's audience and the campaign's exceptions follow), and `import_pack`'s copy of the list. Applied to the test project; drops, renames and deletes nothing. `PACK_PARTS.patches = 'patch'`, `PLAYER_FACING` too; a patch without an `id` is `patch-<n>` (its place in the list), named by what it does ("mire-metals=bronze · item armour"). Importing a pack keeps its `patches`; `fakeDb` accepts the kind.
- **The reader** (`src/modules/library/patches.ts`): `readPatches` (each pack's, with its words and rank in the stack; malformed ones left to `pack:check`), `patchesInPlay` (byOption as a key: any of its choices; the choice made kept for the words), `patchMatches` (kind, category, ids), `applyPatches` (bq3-17 exactly: dotted paths; `delta` on a number adds, on dice adjusts the modifier, "1d8" −1 → "1d8−1"; `times` multiplies; a path the entry lacks changes nothing; several patches on one path: deltas add, multipliers stack, a set value follows the pack on top; a set `null` removes the field; `option: null` marks the entry removed). Every figure changed gets a line "AC −1 · Bronze, <pack>" (`figureName`: AC, Damage, Price, Weight, Slots, else the field).
- **Where it's applied.** `settingFrom` reads the attached packs' patches once, after each entry's own `byOption`, on every pack's entries (the winning copy included: `resolveStack` keeps patches out of the stacking, like options); the entry carries `patched` (its lines) and, when removed, `optionOff` with `offLabel` "Off · <choice>" (`choiceWords`: the choice's `short`, else its name). `setting.patches` holds the patches in play. `lineInPlay(setting, line)` applies the same patches to a carried line's own copy of its item (never changed in the database), so: the Pack row and At hand (`CarrierItems`) read the patched details, show "Off · <choice>" first in the row's sub-line, Put on and Use a charge explain instead ("<name> is off under <choice>: it can't be worn, held or used."), the weapon line gets the lines after it ("+1 · 1d4−1 · Damage −1 · Bone, Mire materials"), the item sheet says "Changed by your rules: …"; `useWornGear` passes the patched armour block with `patched: { before, lines }`, and `workOutAc` shows the pack's figure on the armour's (or shield's) line, then each patch's line, the total following the patch.
- **`pack:check`**: `times` must be a whole number, not with `delta`; as a library, a `change` path the matched entries lack (all of them: "changes nothing"; some: named), a delta on words that aren't dice or a multiplier on words; a patch's own `byOption` / `option: null` are no longer read as an entry's gate. The same id in two packs counts as having the field when any copy has it (eq-4).
- **Tests**: `patches.test.ts` (13), `optionPatches.test.ts` (9, on the new invented overlay `scripts/fixtures/options-gates-3b-materials.fixture.json` over the Fen options fixture), `packFile.test.ts` (+1), `pack-option-gates.test.mjs` (+2), `supabase/tests/m5b-patches-kind.test.ts` (2: a player in the campaign reads the patches whole and never the stat block; a player of another campaign and an outsider read none; the GM all; the update line for players names a changed patch); the audit's of-13 `todo` is a real test (holds for every patch the private packs have: none yet).

**Silent choices (standing rule 2026-10-31):**
- "Multipliers add" (bq3-17 (3)) is read as each multiplier applying (×2 and ×3 → ×6): the only reading under which each patch does what it says. On a number the order is set, ×times, +delta.
- A set value from the pack on top; among that pack's own patches, the later one in the file.
- A `set` on a path the entry lacks changes nothing too (07 says it of any path); a `delta` on words that aren't dice, or `times` on words, changes nothing (`pack:check` notes both).
- The words for a choice are its `short`, else its `name`, as the pack writes them ("Bronze"); a patch in play under several of its choices names the ones chosen.
- An entry an option switches off (of-3) gets the same `offLabel` and the same row marker as a patch's removal: one marker, one meaning ("Off · Wheel guns").
- Patches reach only item lines in the Pack (a line's copy); other carried things (spells known, a class) read the setting's patched entries directly, as before.
- The breakdown's line for a set value reads "<Figure> <value> · <choice>, <pack>"; for a removed field, "<Figure> off · …".

**Scope check (technical, for Francis):**

> **Scope check — a patch on a line's own columns (weight, slots, stack)**
> **What:** a carried line keeps its weight, slots and stack as columns the database copied when it was added; the load is summed from them (the Pack's total, travel). A patch on `weightCoin` or `slots` reaches the setting's entries (Add item, the shop, new lines) and the line's details, but not those columns, so a line already carried keeps its old weight in the load. The 3b fixture patches none of these; the zine's materials (of-13) change AC and damage.
> **Now:** this PR · cost half a day (the Pack and the load read patched weights from `lineInPlay`; the database's load sums can't) · redo risk medium
> **Later:** when a pack patches a weight · we lose nothing until then
> **Recommendation:** Later. **Options:** A Now · B Later · C R2 · D Drop

**The audit (local, newest private packs).** of-13 passes trivially: no pack has `patches` yet (the pack session's materials wait on this PR). Failing as before: the stale `cantrips` and `zc-i1-opt-firearms` rows, O7, `allClasses.test.ts` (20) and `expedition/realPacks.test.ts` (4).


### PR 5, requires, later rule changes, presets (branch `options-gates-5-requires`; bq3-13: A1, A3, A8)
**Built.**
- **`requires` (A1, X1).** `readOptions` reads `requires` (`{ id: choice }` or `{ id: [choices] }`, one shape: `requiresOf`, `optionGate.ts`) and `presets`. The shared reader: `choicesInPlay` reads an add-on whose parent hasn't a choice it needs at its default, whatever is stored (`withRequires`, followed until nothing moves, so an add-on to an add-on goes too); every screen reading choices through it (creation, the sheet, the setting's gates and rules sets) follows. The rows (`ruleGroups.ts`): `offeredSources` leaves a hidden add-on out (set-up step 3 and Rules for this campaign; the count line counts only rules on offer); `changesWith` turns one edit into every pack's change, each add-on it hides back to its default. The parent is read from the add-on's own pack first, else the first pack (top of the stack) with an option of that id; an overlay's choice joined by `extends` counts (the zine's STR add-on to `encumbrance=items`).
- **One logged change (A1, A3).** `rules.setOptions` takes the other packs' choices (`others`) and the load method (`encumbranceMode`) and writes them in the same command, so the log has one line ("… changed the optional rules of Fen Rules and Reed Zine; the load method is now Slots."). Undo is the same command with what each had before. No migration: the command's name and its `logged_commands` row are unchanged.
- **The load method follows (A3).** `loadMethodOf` (`src/app/loadMethod.ts`) reads the method the packs' rules sets set for the choices, as the set-up's Encumbrance row does (now through the same function). When a change moves it (before and after differ), the campaign's `settings.encumbrance.mode` moves in the same change; every load (the Pack, the overview, travel speed) reads the setting, so it is read again at once. The "asks first" dialog says "The load method becomes Coin weight: every character's load is read again." and names each add-on that goes back with it.
- **Presets (A8, X2).** `readPresets` reads a pack's rules sets' `optionPresets`; `presetChanges` plans one: each of that pack's rules naming the preset takes its choice, the rest stay; once the campaign has started a locked rule stays and is named; then the add-ons it hides go back (A1). `RulePresets` ("Presets · First night in the fen", quiet buttons) sits first in the pack's open source group at set-up and in Rules for this campaign; `RulePresetPreview` lists each rule it changes ("Carrying: Not tracked → By coin weight"), the load method it moves and the rules it leaves, with **Use <preset>** and **Not now** (05: a preview and a confirm); applied at once with Undo. Retired: explains, changes nothing.
- **Tests:** `optionRequires.test.ts` (9: the reader and the plans), `loadMethod.test.ts` (3), `optionRequiresFixture.test.ts` (4, on the new invented fixtures `scripts/fixtures/options-gates-5-requires.fixture.json` and `options-gates-5-overlay.fixture.json`), `optionRequires.test.tsx` (4: Rules for this campaign, A1 both ways with one request id and Undo, A3 with Undo, A8 preview and Undo), `campaignSetup.test.tsx` (+1: set-up), `events.test.ts` (+1: the log line); the audit's X1 and X2 `todo`s and a new A3 row are real tests (`optionsAudit.realPacks.test.ts`, local).

**Silent choices (standing rule 2026-10-31):**
- Switching a parent off **writes** the add-on's default into its pack's stored choices (not only reads it so), so the log shows both and Undo restores both; a character who relied on the add-on is in the same place as when the GM switches the add-on off directly (of-3: entries it gated stay by name, marked off). No new design call needed.
- The cascade moves an add-on whatever its own `changeLater` (07: hidden "uses its default"); a "warn" add-on moved by its parent makes the change ask first, as a warn rule does. No private pack has a locked add-on.
- A preset reaches only its own pack's options (by preset id); an overlay's option naming the base's preset id isn't included. None of the newest private packs does it.
- A preset sets only the options that name it; the others keep their choice (not reset to the default).
- The load method moves only when the setting's method under the new choices differs from under the old ones, so a method the GM chose at set-up against the pack's survives unrelated changes. A method the packs give no data for (the zine's item counts) reads "Not tracked", as at set-up.
- A pack whose every rule is a hidden add-on shows "· none" with nothing to open until its parent is on (the existing look for a pack without rules).
- The Undo of a change and the change itself are each one `rules.setOptions`; partial failure mid-command (one pack written, the next refused) isn't rolled back, as `rules.detach` isn't.

**Departures:**
- 05 said presets sit "in the Optional rules ⋯"; that menu went with lr-7's rebuild. They sit first in the pack's open source group (05 updated). No mockup existed; the layout is the existing quiet-button row.
- Test-only fix: the audit's of-12 row checked entries gated on another option alone against each option's choices (a false failure on zine 0.5.22's material cost table). It now checks only entries gated on that option alone.

**Scope checks:** none.

**The audit (local, newest private packs).** X1, X2 and A3 pass. Failing, not from this PR: audit rows naming ids the newest packs no longer have (the audit file is the pack session's to update): `age-lifespan`, `advanced-hit-dice`, `high-level-play`, `slow-weapons`, `cantrips`, `zc-i1-opt-firearms`.

### of-8 (build order 4, one item), done on `fix-area-4-recheck` (2026-11-04)
**Built.** `attack.weaponDamage` only: the die every weapon shows at hand and on the Weapon skills step, read from the rules sets after `byOption` (`src/modules/characters/weaponDamage.ts`), the line naming the choice ("d6 · All weapons d6"). Details and departures: `plans/m5b-fix-area-4-recheck.md`. The rest of build order 4 (of-4, of-5, of-6, of-7, of-11) is not built.

### PR 4, the small ones (branch `options-gates-4-small`; of-4, of-5, of-6 with bq3-15, of-7, of-11; of-8 was #412)
**Built.**
- **of-4, a modifier behind an option.** A check's modifier keeps its `onlyWithOption` (or `option`; `modes.ts` `readModifier`, the shared reader's spec). `checkPrompt` applies only the modifiers whose option is on for the campaign's choices (`CheckContext.choices`), so the prompt neither counts nor lists one that's off. The choices reach every prompt: the procedure (Next step, Check now), the travel card's lost check and each Move…'s preview. An option the campaign doesn't have counts as off. `pack:check` checks a modifier's `onlyWithOption` like a check's own.
- **of-5, safe paths without a roll.** `readDungeonExit` reads a `dungeonExit` with no `roll` (absent or `null`) but a `safePaths` note as safe paths only (`roll: null`): Leave the dungeon is there; its pop-up says "Your rules have no escape roll: the party leaves by safe paths." with **Use safe paths** (the one accent) showing the pack's note; no stepper and no Ask for escape rolls. End expedition then ends at once (nothing to ask first). A choice can make a rule safe paths only through the rules set's `byOption` (`"<option>=<choice>": { "dungeonExit": { "roll": null, "onFail": null } }`). The stepper reads **levels below the first** (T3), and so do its line and the escape roll's words on the player's card and in the GM's list ("1 level below the first: −1", "−1 (1 level below the first)"). `pack:check`: a rule without a roll needs `safePaths` and no `onFail`.
- **of-6, any list level; bq3-15.** `known.listLevel` is any whole number of 0 or more (anything else reads as 0). A pick group (Pick N, or the known spells) whose level has some spells but fewer than its count asks for what's there: its count is the spells there, `wanted` keeps the pack's, and the group says "Only 1 spell at this level in your packs (your class gets 2): pick it." Next isn't held up. An empty level keeps of-2's words. `pack:check` no longer says `listLevel` must be 0: it notes a value that isn't a level, or a level the class's list has no spells at in the pack (nothing when the list is in another pack).
- **of-7, trait-list `distinct`:** only `pack:check` (true or false). See the scope check below.
- **of-11, pick lines:** already built by creation survey PR 4 (`startingPicks`; the Gear step's "Pick up to N · <table>", "roll dN or choose"). Verified, and tested through the shared reader: a pick line under the rules set's `byOption` exists only under its choice, and a pick table switched off by its `option` makes no group (`optionGatesSmall.test.ts`).

**Tests:** `modifierOption.test.ts` (6), `dungeonExit.test.ts` (+4), `requests.test.tsx` (+3: the stepper's words, a no-roll rule's pop-up, End expedition with it), `firstSpells.test.ts` (+3), `optionGatesSmall.test.ts` (3), `pack-exploration.test.mjs` (+2), `pack-additions.test.mjs` (+1), `pack-format.test.mjs` (+1). The audit's of-2 row now covers bq3-15 (its skip for short levels is gone), and a new of-4 row checks every weather-tag modifier behind an option in the private packs (none yet).

**Silent choices (standing rule 2026-10-31):**
- A `dungeonExit` whose `roll` is there but unreadable stays off (as before); only a missing or `null` roll means safe paths.
- A no-roll rule's pop-up has no End without rolls: End expedition doesn't open it.
- A short group's line names the class ("your class gets 2"), for the Pick group and the known spells alike.
- A short level's spell that a roll already gave can still leave the group one short ("Already yours · pick another"); no pack has such a case.

**⚑ for Francis:**
1. The depth stepper's start: it starts at 1 as before, which now reads "1 level below the first" (a −1 under a per-level rule). Start at 0 (the first level) instead? A one-line change.

**Scope checks (for Francis):**

> **Scope check — "logged" for Use safe paths (of-5)**
> **What:** of-5 says Use safe paths is logged. Today the button shows the pack's note and writes nothing (as it does beside a roll). Logging it needs a new event type: a command, a database function writing the event, and its `logged_commands` row: a migration, and this PR has none.
> **Now:** a small follow-up PR with one migration (an event "Left by safe paths", with Undo) · cost half a day · redo risk low
> **Later:** with M6's leaving-the-dungeon work · we lose the log line until then (End expedition is logged either way)
> **Recommendation:** Now, as a follow-up. **Options:** A Now · B Later · C R2 · D Drop

> **Scope check — a trait list rolled more than once (of-7, design call)**
> **What:** of-7 rules `distinct: true` "on a trait list rolled more than once", but nothing rolls a trait list more than once: a sheet field takes one entry, the step offers one pick, and 07 has no count for a list (a "roll twice" lives only in a list's notes). Reading `distinct` needs that first: a count on the list or the field, a field holding several entries, and how the step and the sheet show them.
> **Now:** a `designer` call, then a builder PR · cost a day after the call · redo risk high if built without it
> **Later:** when a pack needs more than the notes · we lose nothing new (the GM re-rolls duplicates by hand, as today)
> **Recommendation:** a short design call (where the count lives, the multi-pick field), then build. **Options:** A Now · B Later · C R2 · D Drop

**Noticed, not in this build order:** kit rolls' `distinct` (bq-1, "Pick a different one") isn't read by the app either.

**The audit (local, newest private packs).** The of-2/bq3-15 and of-4 rows pass (no pack has a short level or a modifier behind an option yet). Failing, on entry gating this PR doesn't touch: the stale rows `cantrips`, `zc-i1-opt-firearms`, `age-lifespan`, `advanced-hit-dice`, `high-level-play`, `slow-weapons` ("is an option in the packs: expected undefined"), and of-12 (the zine's material cost table under the energy-weapons option's `none`): the pack session's files.
