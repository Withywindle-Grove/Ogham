# Plan: M5b creation, the survey's follow-up (cs-1 … cs-7)

Ruling: `docs/design/rulings/m5b-0c-creation-survey-2026-11-03.md`. Surveys: `docs/design/notes/fae-woodland-creation-survey-2026-11-03.md`, `docs/design/notes/classic-advanced-creation-survey-2026-11-03.md`. Mockup: `docs/design/mockups/creation/11-details-step.html`. 07: "Creation rules as data", the survey's fields. Rests on the third test's PR H and PR I (`m5b-0c-creation-rebuild.md`, Follow-up to the third test): build after them.

## What this step delivers
The book's creation for both settings: names, trinkets and details; the kindred's grants and the Magic step; class and alignment limits, hard and soft, and the knight's liege; kindred-classes bound to their kindred; option-switched race fields; size- and race-dependent kits, pick-N, part-bundles, language rolls and who may learn, overlay languages; AC and save bonuses from race and class.

## Build order (each its own pull request, from main)
1. **Limits and options** (cs-3, cs-5; plus rc-1 the `primeXp` reader and fixture moved to the packs' shape, and rc-5's hard / soft entries): one reader for a race's class limits (hard / soft, pg-2 merged in), alignment limits on Who they are, `byOption` on races read after the campaign's choices; `pack:check` warns on the old three places in a pack. 5–7 turns.
2. **Kindred-classes and grants** (cs-2, cs-4): the binding (sets the kindred, replaces traits, Change › reopens Kindred); race `firstSpells` and `startingItems` added to the class's with source labels; the Magic step name; kindred-classes' magic. 6–8 turns.
3. **Names, trinket, Details** (cs-1): the Name field's roll, the trinket in Gear, the optional Details step, growth for its race; all editable from the sheet. 5–7 turns.
4. **Kits, languages, bundles** (cs-6 minus G-87; plus rc-2 entry `money` and `spells.roll`, rc-3 `{ name }` lines as one-off items): `ifSize`, `armourSubstitutes`, `oneOf`, `weaponsAllowed`, `pick { upTo }`, `units`, `{ itemId, qty }` lines, language `roll` and `learnableBy`, overlay languages. 6–9 turns.
5. **Bonuses** (cs-7): race and class AC bonuses with conditions in the AC fill and breakdown, save bonuses; a plain traits section on the full sheet (list and entry, no layout work; the sheet review rules the layout). 3–5 turns.
6. **The knight's liege** (cs-3, G-86, G-89): `fields[].forClasses`, the liege table with `alignment`, Who they are sets the alignment. 2–3 turns (may join PR 1).

## Tests (purpose first)
- A class with `primeXp: standard` shows the rules set's XP modifier at creation; with `rules`, the per-ability thresholds; with `lowest`, the lowest prime decides.
- A background giving "N gp" adds it to starting money; one giving a random cantrip adds a roll to the Magic step.
- A fairy can't take a mortals-only class (hard); a mortal enchanter is pickable and flagged for special approval (soft).
- A Church class offers no Chaotic alignment; a knight's liege sets the alignment and says why.
- With the option's default, a demihuman cleric is allowed; with the NPC-only choice, it isn't.
- An elf enchanter's Magic step asks for two glamours, labelled kindred and class; an elf fighter gets the step for one.
- Picking the elf kindred-class sets the kindred to elf and drops the elf's traits; changing class reopens Kindred.
- The Details step can be skipped and never blocks Send; a picked detail shows on the sheet and can be changed there.
- A Small character's kit gives the swapped weapon; a burrowkin's kit gives the substitute armour.
- "10 arrows from a quiver of 20" gives 10, not 200.
- A thistlekin unarmoured has its kindred's AC bonus in the breakdown; in heavy armour, not.

## Scope checks (write one and stop)
- Any pack field beyond 07's survey fields.
- The traits section's layout beyond a plain list (the sheet review rules it).
- G-87's usage pips (M7).

## ⚑
None open. Pack session: move fae-woodland and classic-advanced to the ruled shapes (one place for limits, `byOption` on races, the creation tables linked) once 07 is merged.

## Estimate
About 27–39 builder turns across 5–6 PRs. The largest risk: the class-limit reader touches every pack's creation; run Part B (both real settings) of the creation checklist after PR 1.

**PR 4b (added by design, 2026-11-04, `design/rulings/m5b-builder-questions-3-2026-11-04.md` bq3-6):** #386 merged without the one-off handling, so a small follow-up: the trinket and kit or background `{ name }` lines become one-off items **without waiting for the GM** (rc-3: created at creation, no weight or price), visible to the owner and the GM like any item. A database change touching who can see items: test project first, Fable-qualifying; Francis is asked before it starts. 2–3 turns.

**Added by design, 2026-11-04 (`design/rulings/m5b-pack-review-area-4-2026-11-04.md` fi-4), with PR 5:** the Gear step's kit area shows one line when the class has no kit (or the setting has none): "No quick kit for <class>: buy from the shop". Test: "a class with no kit sees the line, not an empty area". Under 1 turn.

## Departures
**Ruled by Francis, 2026-11-04 (build session):** the follow-up's ⚑: a background's rolled spell (`traitSpells`) stays with its pick, not in the spell book, until M7's known spells (G-49, G-63) ("ok").

**Designer, 2026-11-04 (`design/rulings/m5b-builder-questions-3-2026-11-04.md`):** glamours counted twice: a pack fix (bq3-5 A); the trinket and `{ name }` lines wait for the GM, handled with PR 4 (bq3-6); details and trinket storage confirmed (bq3-7); a background's spell roll under its pick (bq3-18 A); dice money later with a checker note (bq3-19 B).

**Designer, 2026-11-03 (`design/rulings/m5b-builder-questions-2-2026-11-03.md`):** PR 1's scope check ruled A — read `abilityModifiers` (any field) in a race's `byOption` (bq2-1); "Hard: Next explains" built as Pick refusing with a toast, confirmed (bq2-2).

**Designer, 2026-11-03 (`design/rulings/m5b-seed-input-2026-11-03.md` si-2):** PR 4 (kits) also: a kit item the class can't use is taken carried, never worn or held, and the kit row says "<item> · your class can't use it · carried" at the Take.
(The builder keeps this current.)

- **PR 1, rc-1 built early** (2026-11-03, bug fix `fix-prime-xp`): the `primeXp` reader in the packs' shape (`standard` over `primeRequisiteXp`, `rules` with `all` / `any`, `primeRequisiteRule: "lowest"`), penalties shown ("−10% XP"), the fixture's `primeXp` / `primeRequisiteXp` / `primeRequisiteRule` keys moved to that shape, and `pack:check` lines for the old shape, a bad row or rule, a `standard` class with no table, and a `primeRequisiteRule` other than `"lowest"`. PR 1 no longer carries rc-1. The failing tests were written first and left untouched, but share the fix's commit: the pre-commit `npm run check` refuses a commit whose tests fail.
- ⚑ 1 ruled: defer to the pack — `primeRequisiteRule` decides; without it the highest prime (Francis 2026-11-03); ⚑ 2 ruled A: a class with no `primeXp` shows no XP line (the old reader fell back to the rules set's table). A score off the table shows none.
- **PR 1, limits and options** (2026-11-03, `m5b-0c-survey-1-limits`, #365; rc-1 had gone in #347, which hadn't merged after an hour, so the branch has it merged in: merge #347 first):
  - **One reader:** `src/modules/library/classLimits.ts` (`raceClassLimit`, `classAlignmentLimit`); the class offer, the fit line, both entries' headings, the level cap and the level explainer read it, so nothing reads `classMaxLevels` on its own. pg-2's `withClassReach` is reused, not copied.
  - **Order on the load-time path:** `withRaceOptions` (the race's `byOption`, then `optionalAbilities`) now runs **before** `withClassReach`, so a choice that lifts a race's limits (`classMaxLevels: {}`) stays lifted after the classes' reach is merged.
  - **How `byOption` changes a race** (07 names the fields, not how they merge): `npcOnlyClasses` and `classMaxLevels` are replaced (so `{}` lifts the limits); `abilities` are added by name, as `optionalAbilities` adds them. Other fields under it aren't read, and `pack:check` names them.
  - **Hard on the Class step:** a class a hard limit closes stays in "Not open to …"; its Pick (row or entry) picks nothing and the toast says why ("… isn't open to stone kin. Pick another class, or go back."), and Next says the same if one is held. This supersedes, for race limits only, 2026-11-02's "a class not open to the race is picked with special approval" (cs-3). A class the **method** leaves out is unchanged: picked with special approval.
  - **Soft on Who they are:** an alignment outside a soft limit is saved as a special approval with `step: "alignment"` (the type gained the step). Changed from the review, the draft's record is re-read and the flag set or cleared; a redo of the race or class keeps it until Who they are is saved again (fragile: a class change that isn't walked through Who they are keeps a stale flag; both real settings ask hit points, so Who they are is walked).
  - **A limit that names no row:** a class's `alignments` that match none of the campaign's alignment rows hides nothing (a pack mismatch shouldn't empty the group).
  - **Fixture:** a soft entry (bog folk's Fen Cantor), the option **Kindred limits** (`fen-kin-limits`: kept · chaplains-npc · lifted) with `byOption` on both kindreds, Marsh Chaplain's hard `alignments` and Mire Stalker's soft ones.
  - **Scope check (open, Francis rules — technical):**
    > **Scope check — a race's `byOption` changing `abilityModifiers`**
    > **What:** classic-advanced's Human carries `byOption: { "race-limits=lifted": { abilities, abilityModifiers: { CHA: 1, CON: 1 } } }`; 07 (cs-5) lists only `npcOnlyClasses`, `classMaxLevels` and `abilities`, so the score changes aren't read (pack:check says so). The abilities are.
    > **Now:** goes in this PR · cost under an hour (the same add-up `optionalAbilities` does) · pushes back nothing · chance of redoing work low
    > **Later:** the pack session moves the Human's score changes to `optionalAbilities.abilityModifiers` (already read) · what we lose: a lifted Human gets no score changes until then
    > **Signals:** touches the pack format (cheaper now); rare at the table
    > **Recommendation:** A Now, adding `abilityModifiers` to 07's list for a race's `byOption`, because the pack already uses it and the reader is one line
    > **Options:** A Now · B Later (pack moves it) · C R2 · D Drop
  - **Real packs:** `classMaxLevels` as a word (classic-advanced's Human, `"all-non-demihuman-unlimited"`) reads as no limits, as before, and pack:check now notes it (a pack task).
- **PR 2, kindred-classes and grants** (2026-11-04, `m5b-0c-survey-2-kindred`; after #376, whose shared option reader it uses; #365's class-limit reader unchanged):
  - **Built:** a kindred-class (`classes[].race`) is listed on the Class step **under its own kindred only**, with "replaces your kindred's traits" on its row; under another kindred it is in neither the open list nor "Not open to …" (cs-4's "lists it under its own kindred only"; this also stops classic-advanced's Human being offered the race-classes, #365's finding). Picking another kindred unpicks it (Undo puts both back). Picking it sets the kindred (`kindredOf`): on the kindred-as-class path the draft's race is now the class's kindred, so languages and the race's tables follow it. Changing the class away from a kindred-class on a redo (Change › from the review) goes to the Kindred step first, once, with "<class> picked · your kindred's own traits are back: check your kindred, then Next."
  - **Traits replaced:** one reader, `raceAsPlayed` / `raceDataAsPlayed` (creation.ts). The kindred keeps who they are (`KINDRED_KEEPS`: name, blurb, source, notes, languages, tables, size, creatureType, age, height, weight, lifespan); everything else (abilities, optional abilities, score changes, skills, saves, AC, vision, weapon limits, first spells, starting items, class limits) comes from the class. Read by the fills and the sheet's figures (fromSetting.ts: the sheet, the Player screen's limited abilities, the explainers), the Class step's fit line and level cap, the Magic step and Gear's given items.
  - **Grants:** a race's `firstSpells` (`given`, `rollTable`) is added after the class's, each group headed "From your class · …" / "From your kindred · …" (only when the kindred grants something); a kindred and its class may roll the same table (two rolls: an elf enchanter's two glamours). A non-caster gets the step for its kindred's grant alone (an elf fighter). A race's `startingItems` join Gear's Given group, each row "from your kindred" (the group's line: "from your kindred", or "what you start with" beside the setting's). The step is named **Magic** when it holds a kindred's grant or a class part that is neither `book` nor `divine` (glamours, runes, knacks); the foot then says "All picked · N yours", not "in your book". A kindred-class's own `spellcasting.firstSpells` is rolled like any class's.
  - **pack:check:** a race's `firstSpells` shape and its roll tables (shared, spells on every row, as a class's), `startingItems` ids, a class's `replacesRaceTraits` not true / false.
  - **Silent choices (standing rule 2026-10-31):**
    - `replacesRaceTraits` absent counts as **true** for a class whose `race` is the character's kindred; only `false` keeps the kindred's traits beside the class's. Without this, classic-advanced's race-classes (which name their race but not the field) would add their race's saves and abilities to the class's once the kindred is set.
    - A kindred's own class table doesn't limit its kindred-class (classic-advanced's races don't list their race-classes).
    - On the kindred-as-class path the scores take no kindred changes (the Kindred step is skipped, as before).
    - The group headings use the table's name ("From your kindred · roll dN · <table>"), not cs-2's example's "1 <spell>" (the app has no word for one spell of a list).
    - A race's `firstSpells.choose` isn't read: a kindred has no spell list to pick from. pack:check says so (neither real pack uses it).
  - **Not done, fragile:** the equip check (EquipWarning.tsx) and the full rest's refills (SceneTime.tsx) still read the kindred's own fields (sibling PRs' files): a kindred-class's equip check also reads its kindred's `weaponsAllowed` until a follow-up. The To finish card and the GM's card still call the step "First spells" (or the pack's title). A kindred item given at Gear stays in the pack if the kindred is changed later (cf-4: given gear is never taken back here).
  - **Scope check (open, Francis rules — design):**
    > **Scope check — a class's `known` glamours beside its rolls**
    > **What:** fae-woodland's enchanter and the glamour kindred-classes carry both `firstSpells.rollTable` (the book's random glamours and rune) and `spellcasting.known` (a set number known at level 1, `listLevel` 1). The step reads `known` as a "Cantrips · pick 1" group, so an enchanter is asked to roll and also to pick one glamour: one more than the book gives. This was so before this PR (the enchanter); the kindred-classes now show it too.
    > **Now:** this PR · cost an hour (a class with a `rollTable` doesn't add a pick for `known`; or the pack drops `known` at level 1) · pushes back nothing · chance of redoing work low
    > **Later:** the sheet's known-spells work in M7 (G-49, G-63), which reads `known` properly · what we lose: an extra pick on these classes until then
    > **Signals:** touches the pack format (whether `known` counts the rolls); every fae-woodland caster with glamours hits it
    > **Recommendation:** A Now as the pack's fix (the pack session leaves `known` for M7's level-up and keeps the rolls at creation), because the app reading `known` beside rolls is right for the zine compendium's cantrips
    > **Options:** A Now (pack) · B Now (app: rolls fill `known`) · C Later (M7) · D Drop
- **PR 3, names, trinket and Details** (2026-11-04, `m5b-0c-survey-3-names`; no migration):
  - **Reading:** `src/modules/characters/kindredTables.ts`: a race's `tables { names, trinket, details, growth }` read from the campaign's tables **in play** (optionGate.ts `entriesInPlay`), as the class plays the kindred (`raceAsPlayed`, cs-4: a kindred-class keeps its kindred's tables); age, height and weight from the race's own words with dice.
  - **Name:** "Roll a name · <kindred> ›" under the Name field on Who they are and in the sheet's Edit; the table sheet has one group per column, and a cell tapped in each fills the Name box at once; Clear puts back what was typed.
  - **Trinket:** a Trinket group in Gear (one Detail row) opens the table; a long table (more than 12 rows) has a "What you rolled" box that picks the row the number lands on. The row's words become a **one-off item** (no library entry), found, with the table and roll in its note; Change swaps it, Undo on the toast puts the old one back. A kindred with a trinket table gives the Gear step even with no money, kit or given gear.
  - **Details:** the optional step, **always last before the review** (whatever a pack's `creationGuide` order), only for a kindred with detail tables, a growth or age / height / weight dice; four detail rows shown, the rest folded; the growth for its kindred only; Age · Height · Weight folded with the dice under each box; Skip · leave blank; Next saves; from the review no Skip. `details` is a step name for `creationGuide` (07, pack:check).
  - **The sheet:** the details join the sheet's Details block (the fields with no group) with **Change details ›** (Fill in details › when blank), which opens the same step (no counter, Done) for the owner or the GM, before and after approval.
  - **pack:check:** a race's `tables` shape and keys, unknown table ids, tables players can't read (`gmOnly` not false: a player's device never gets them), a name table's rows without one cell per column, age / height / weight not words. Counted: "races with creation tables".
  - **Silent choices (standing rule 2026-10-31):**
    - **Where they're kept, without a migration:** the details on the character's `fields` under `_details` (a key no campaign field uses; `character.edit` gained a `details` change), so the owner changes them after approval as any field (the creation record is the GM's once approved); the trinket on the creation record (`trinket`), beside the kit, so `creation.redo` takes it out with the gear on a **change of kindred** only (a class change alone keeps it). 04 says so.
    - A tapped row on a short table closes the table sheet (one tap fewer than the mockup's Done); Done and Clear stay; a long table stays open while typing.
    - Next on Gear never waits for the trinket; a pack's `creation.require` naming `details` doesn't make it required (cs-1: never blocks Send).
    - A detail table's row shows its table's name without the kindred's ("Stone kin looks" → "Looks").
    - A saved detail from a table the kindred no longer has (after a change of kindred) isn't shown, but stays saved.
  - **Fixture:** the **stone kin** carry the tables (names, a d30 trinket, two detail tables, a growth, the dice), so the bog folk walks in earlier tests are unchanged. Five earlier tests changed: three stone kin walks tap Skip · leave blank on the new Details step, and two "no other table" checks now leave out the stone kin's shared tables (still checking that no GM-only table reaches a player).
  - **Not done, fragile:** the GM's approval card doesn't show the details (the sheet does); the growth at later levels is M7; fae-woodland already carries `tables` in this shape, classic-advanced has none.
  - **Scope check (ruled B, 2026-11-04, bq3-6; built as `m5b-0c-one-offs`, `plans/m5b-0c-one-offs.md`):**
    > **Scope check — a trinket waits for the GM like any one-off**
    > **What:** the trinket is a one-off item (a table row is no library item), and the database makes a player's one-off wait for the GM's approval unless the campaign's one-off approval is off. So a new character's trinket shows as waiting in the pack and on the GM's list, beside the character's own approval.
    > **Now:** a migration (a player's one-off on a draft character, or from a shared table row, comes in approved) · cost 1–2 hours · pushes back nothing · chance of redoing work low; this PR has no migration, so it would be its own small PR
    > **Later:** with PR 4's `{ name }` lines (rc-3, also one-offs), which meet the same rule · what we lose: one extra tap for the GM per new character
    > **Signals:** touches row-level security on items (the guard on players' lines)
    > **Recommendation:** B Later, with PR 4, because rc-3's one-off kit lines hit the same guard and one migration can cover both
    > **Options:** A Now (own PR) · B Later (with PR 4) · C Leave it (the GM approves it)
- **PR 4, kits, languages, bundles** (2026-11-04, `m5b-0c-survey-4-kits`; no migration):
  - **Kit lines** (`startingGear.ts` `gearLines`, one reader for kits, roll rows, trait-list entries and `startingEquipment`): `ifSize` by the kindred's `size` as the class plays it (any case), then the kindred's `armourSubstitutes`; `units` (a whole number) wins over `qty` × the bundle (G-92); a `{ name }` line is a one-off item (rc-3).
  - **Settled on the step:** a kit's own `oneOf` line is a **Choose one · A or B** group under the kit, its `itemId` ticked, so one tap still takes the kit and a tap on the other swaps it in the pack (tapping the ticked one says "Tap another to change it."); a kit's own dice `units` ("1d6" torches) is a **Roll 1d6 · Torches** group, a row per result, tapped like the kit's rolls (the kit waits for it). Both follow the kit's own rolls, so saved picks keep their place.
  - **si-2:** a kit item the class or kindred can't use is placed carried (never worn or held, as before), the take's toast and the kit row say "<item> · your class can't use it · carried"; the entry pop-up keeps its "goes in the backpack: <reason>" line.
  - **Given gear:** `startingEquipment` lines `{ itemId, qty, units? }` (ids still read); a pick line `{ pick: { tableId, upTo } }` (of-11) is a **Pick up to N · <table>** group after Given ("0 of N picked · roll d20 or choose"): each tapped row's items go into the pack at once as no cost, with Undo, a tap again takes them out, a full count says "N of N picked · unpick one first."; kept on the record (`givenPicks`), never refunded by a redo (like `givenGear`).
  - **Kindred weapon limits:** `equipBlocks` reads the race's `weaponsAllowed` after the class's ("<Kindred> can't use <item>. <note>"); the equip context now reads the kindred as the class plays it (PR 2's note on EquipWarning.tsx, closed).
  - **Languages:** an overlay's `languages.list` merges into its base's by id (stack order; `common`, `alignment`, `extraFrom` from the top one that says); `roll` rows read range first ("2–3 · Reedspeak"), rolled ones first in the die's order, the group's meta adds "roll d6 or choose"; a hard `learnableBy` leaves the language out for other creature types with one line ("1 language your kind can't learn is left out."); a soft one is offered with "Usually learnt only by fairy kinds" (or "Only with the GM's leave") and "Needs the GM's special approval", and picking it saves a special approval with `step: "languages"` (kept through a redo until Languages is saved again; set only before approval).
  - **Entry money (rc-2):** a whole-number `money` is kept on the record at the trait pick (`traitMoney`, by list; a new pick replaces it, Undo of the gear keeps it), counted in Gold to spend, the review's money line ("… · N gp from your picks") and the over-check; the toast says "N added to your starting money."; the entry pop-up says "Adds N to your starting money".
  - **pack:check:** `startingEquipment` lines and picks (table missing, not shared, no rows with items, bad count); a language's `roll` and `learnableBy` shapes; an overlay's list may leave out `common` and name its base's ids; kit lines' `units`, `oneOf`, `ifSize` (unknown ids; dice units or a choice in a roll's row say the app gives one bundle or the default); a kindred's `armourSubstitutes`; entry `money`; each `{ name }` line noted (rc-3).
  - **Silent choices (standing rule 2026-10-31):**
    - A kindred with no `creatureType` isn't limited by `learnableBy` (a pack that doesn't say shouldn't empty the list).
    - A choice's default is ticked (one tap fewer); dice `units` and `oneOf` in a roll's row give the default / one bundle (no pack uses them there).
    - A pick's rows are each picked once (the book's "up to N items"); rows without items aren't offered.
    - The si-2 words say "your class" also when the kindred's weapon limit is the reason (the ruled words).
    - The overlay merge applies to every stacked rules set with `languages`, so a converted setting that only repeats its base's list keeps one copy per id.
  - **Fixture:** no change to the shared file; the new tests patch a copy (a Small bog folk with an armour substitute, the warden's kit with a swap, a choice, dice units, a part-bundle, a one-off and a sling the warden can't use; a shared pick table; rolled and limited languages; a background giving 50), so earlier walks and the gallery are unchanged.
  - **From the CI review:** a hard `learnableBy` naming no type limits nothing (it would have hidden the language from everyone), and pack:check says so; dice `units` with too many results to tap (more than three dice, over 20 sides or over 30 results) give one bundle, and pack:check says so; invented names replace two setting names in code comments. Un-picking a given pick row takes out what that row put in, by line id, only as many as it added (a line given away since is skipped), as Put back does.
  - **Tied to PR 3's open scope check (the trinket's approval):** kit and entry `{ name }` lines are one-off items and wait for the GM like any player's one-off (today's behaviour, no migration). The same migration would cover them. **Done** in `m5b-0c-one-offs` (2026-11-04): they come in approved on the draft.
  - **Not done, fragile:** the fae-woodland pick table (`starting-adventuring-items`) isn't marked `"gmOnly": false`, so its pick doesn't show until the pack session marks it (pack:check says so). An old purchase saved before a kit gained a `oneOf` line keeps what it put in the pack, but its row words leave the choice out.
  - **Scope check (open, Francis rules — design):**
    > **Scope check — a background's spell roll comes after the Magic step**
    > **What:** rc-2 puts `spells.roll { listId, level }` as a roll "added to the Magic step". Both settings order the steps Magic (spells) → Gear → Languages → traits (the background), so the background isn't picked when the Magic step is walked; the roll would only show when the Magic step is reopened from the review. Not built; the zine overlay's two backgrounds with a roll stay pack:check notes.
    > **Now:** this PR · cost 2–3 hours · pushes back nothing · chance of redoing work medium (where the roll sits is a design call)
    > **Later:** with M7's known-spells work (G-49, G-63) · what we lose: those two backgrounds' cantrip roll at creation (the GM adds it)
    > **Signals:** touches the creation flow's order; two entries in one overlay hit it
    > **Recommendation:** A, the roll unfolds under the background's pick on its own step ("From your background · roll dN for one cantrip"), saved into the book, because it works in any step order and kit rolls already unfold under their kit
    > **Options:** A Under the pick (trait step) · B Magic step moves after traits when a background has a roll · C Later (M7) · D Drop
  - **Scope check (open, Francis rules — design):**
    > **Scope check — a background's money as dice**
    > **What:** rc-2 allows `money` as dice "rolled at the table and typed". The trait step has no box to type a number, and Gear (where the money is typed) comes before the background. Not built: the entry's pop-up says "Roll NdN at the table: your GM adds it to your starting money"; pack:check notes it. Neither real pack uses dice money.
    > **Now:** this PR · cost 1–2 hours · pushes back nothing · chance of redoing work low
    > **Later:** with the scope check above (the same "under the pick" place) · what we lose: nothing today
    > **Signals:** no pack uses it
    > **Recommendation:** B Later, with the spell roll's ruling, because the same place answers both
    > **Options:** A Now (a box under the pick) · B Later · C Drop (whole numbers only)
- **PR 5, bonuses** (2026-11-04, `m5b-0c-survey-5-bonuses`; no migration):
  - **One reader:** `src/modules/characters/bonuses.ts`. `acBonusesOf` gives the race's `acBonus` (as the class plays it: a kindred-class's own replaces its kindred's, cs-4), the class's own `acBonus`, and the class's progression `acBonus` at the level (the latest row at or below it). `workOutAc` counts each while its condition holds; `characterFigures` passes them, so the full sheet, the Player screen and creation's AC (`withCreationAc`, `creationAcParts`: "unarmoured, DEX +0, Thistlekin +1") read the same.
  - **The breakdown's words:** counted "<kindred>, unarmoured or Light armour: +N"; not now "<kindred>: +N only when unarmoured or Light armour, not now"; armour with no `type` "…; the setting doesn't say how heavy <armour> is, so it isn't counted"; a situational one "<kindred>: +N vs <size>, counted at the table"; by level "<class> at level N: +N".
  - **Save bonuses** (`saveBonus`, race and class): shown beside each save, never added in, as bq-8 rules for `saveBonusByCon` (a save's figure is the number to roll): "+N to the roll vs <a named hazard>; +N to the roll otherwise". A save's breakdown names who says each ("Burrowkin: …", "<class>: …"; `FigureContext.classNotes`).
  - **Traits section:** after Abilities on the full sheet (and beside the Player screen), a plain list of every kindred trait then every class trait (`traitsOf`), each a Tap value opening its entry (`traitEntry`: the note; From · Your kindred · <name>; When · From level N; Kind · A drawback; the pack and page). A trait with an `option` that's off is left out (optionGate.ts `entryOptionSpec`, `optionSpecOn`). No grouping, pips or folds: the sheet plan's build order 2 (sr-3) restyles it.
  - **pack:check:** `acBonus` and `saveBonus` shapes on races and classes, a progression `acBonus` that isn't whole, `saveBonus.saves` keys not among the saves, and an AC `when` the app can't read as armour.
  - **Silent choices (standing rule 2026-10-31):**
    - **`when` is read from the pack's words** (07 names no shape for it; both real packs write text): unarmoured, light, medium or heavy armour, joined by "or" or commas, against the worn armour's `type` (or a magic armour's chosen base's). Anything else is situational: named, not counted. No new pack field.
    - Armour worn with no `type` doesn't count an armour-conditioned bonus (no guess), and says why.
    - A class's progression `acBonus` has no condition and always counts (the real class with one can't wear armour).
    - `saveBonus` reads `{ bonus | value, vs | against | when, saves? }`; `vs: "all other"` (or "other", "others") reads "otherwise".
    - Every trait shows, later-level ones too (cs-7: "every kindred and class trait"), with When in its entry.
  - **Not done, fragile:** a fill hook that already gives `ac` at creation keeps its own number (bonuses aren't added to it, as before for ability modifiers). Many traits make a long list until the sheet plan folds it after 6 (sr-3). The XP bonus (M7) and retainer loyalty (M9) aren't read (cs-7). Usage pips (G-87, M7) aren't built.
- **PR 6, the knight's liege** (2026-11-04, `m5b-0c-survey-6-liege`; no migration):
  - **One gate, the shared reader:** `optionGate.ts` `fieldsFor` reads the layouts' `forClasses` and `forRaces` (bq3-11: `forRaces` comes with `forClasses`, one check) once with the setting (`CampaignSetting.fieldsFor`); `fieldsOffFor(setting, { classRef, raceRef })` gives one set of keys hidden for a character, an option off (of-9) or not for their class or kindred, passed to `fieldsInPlay` by creation, the full sheet, the Player screen and the character cards. The sheet plan's "Liege shows only when it applies" reads the same function.
  - **Values kept, as of-3:** a hidden field's value stays saved: the sheet's Save, the sent-back review and creation (Who they are, from the review or after a class change) send it back unchanged; creation's inputs keep every field's saved value.
  - **A field from a table** (07: a text field whose layout `from` names a table players can read): on Who they are, a group "<label> · roll dN" with the field's help line and one Detail row that opens the table sheet (the trinket's parts); the row tapped is saved as the field's words. A row carrying `alignment` sets the character's: the group's meta says "it sets your alignment", the toast says "Alignment: Lawful, your liege's." with Undo (both put back), and the alignment group then offers only that row with the line "A knight's alignment is their liege's: House … (Lawful)."; Next refuses another ("… pick Lawful, or another liege.").
  - **pack:check:** fields' `forClasses` / `forRaces` shape and unknown ids (alone only when the pack has that kind; with several files, against all), and a field `from` a table players can't read.
  - **Silent choices (standing rule 2026-10-31):**
    - A character with no class or kindred yet (before the Class step, or freeform) is asked every field: there is nothing to judge by.
    - The value saved for a field from a table is the row's words ("House <name> (<alignment>)"), as the trinket's; the sheet shows and edits it as text.
    - Only a text field is asked from its table (a list field `from` stays a trait list's, a number or Yes/No never).
    - The liege's line and toast come before the alignment group (the group sits above it on Who they are), so cause reads before effect.
    - Clearing the liege leaves the alignment as it was and reopens every row.
  - **Not done, fragile:** the sheet's Edit asks a table-fed field as text (no table there); a class's hard alignment limit that closes a house's alignment isn't checked against the house rows (no pack has one: Next explains); the GM's approval card shows the liege only as a field.


## Follow-up: background spell roll and checker notes (branch m5b-0c-survey-followups)

Rulings: `design/rulings/m5b-builder-questions-3-2026-11-04.md` bq3-18 (A) and bq3-19 (B); 07 of-3 and of-12 (`option` on any entry, as a list). One PR, no migration. 2–4 turns.

**Build order**
1. **bq3-18:** a trait-list entry's `spells.roll { listId, level }` opens under the entry's pick, on the entry's own step: "From <entry> · roll dN for one cantrip" (or "level N spell"), the level's spells in play numbered for the die in the setting's order, tapped or typed in What you rolled. Next asks for the roll while the level has spells. Kept with the pick on the creation record (`traitSpells.<list id>`: the entry, the spell, the number), shown on the review (a line under the pick, its check) and on the sheet beside the trait's value and in its entry ("Rolled"). `pack:check` reads `roll` (its shape; its list in the pack, unless the pack requires another) and no longer says it isn't read.
2. **bq3-19:** dice `money` stays as built (the entry's pop-up says roll it and the GM adds it); `pack:check` already noted it (PR 4); its words now say the same as the pop-up, and a test covers it.
3. **pack:check fix:** `tableOptionNotes` (scripts/pack-exploration.mjs) no longer calls a table's `option` "the old way"; an option or choice that doesn't exist stays with `pack-option-gates.mjs` (#383), not repeated.

**Tests (purpose first):** an entry's roll is read and numbered for the die, option-off spells and other levels left out; a typed number picks its row or says why not; the roll is kept only for the entry it was rolled for, shown on the review (or due, as the step's check) and on the sheet; a race or class change takes it off; on the step it opens under the pick, Next asks for it, a tap or a typed number records it and Next saves both, another pick drops it; the checker reads `roll`, notes dice money, and says nothing about a valid table `option`.

### Departures
- **Not in the spell book.** The ruling's recommendation said "saved into the book"; the roll is kept with the pick instead (the brief's words), because the Magic step rewrites the book from its own picks (a background's spell would be lost on the next Magic save) and a non-caster has no book. Moving it into the book (or the known spells) belongs with M7's known-spells work (G-49, G-63). Technical choice, flagged for Francis.
- **The heading names the entry**, not "your background": "From <entry> · roll dN for one cantrip", because a trait list may be a background, a sign or an affiliation and the app has no word for which.
- **What you rolled is always shown** under the roll (the ruling: "rolls or types"), not only for lists over 12 rows as on the table sheet. The box was lifted out of `TableSheet` as `RolledNumber` (one part, two places; 06 updated).
- **Where the roll can be skipped:** the sheet's edit form (`CampaignFields`, a list field fed by a trait list) sets a background without its roll; the review then says "Cantrip not rolled yet" and stops Send at that step. The To finish card uses the step and asks for it.
- **A race or class change** takes the rolled spells off with the trait picks (`redo.ts`), as it already did for the trait gear.
- **Checker:** an overlay's roll is never checked against its base's lists (the checker sees one pack); dice money's note now repeats the pop-up's words.
