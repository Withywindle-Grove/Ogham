---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (items `baseId`, `carryBonus`, containers `weightEmpty` / `weightFull`; rules set `weaponRules`; classes `forms`; kit rolls `forClasses`; the duplicated survey bullet removed), docs/09-decisions-log.md (2026-11-04), docs/11-modelling-gaps.md (G-123 … G-125), docs/plans/m5b-review-area-3.md
supersedes: G-123's `carryBonusCoin` and G-124's `emptyWeightCoin` proposals (named `carryBonus`, `weightEmpty` / `weightFull`)
---

# Pack review, area 3 (equipment and encumbrance): the re-check's questions (design ruling, 2026-11-04)

From the independent re-check of area 3 (`design/notes/area-3-equipment-review-2026-11-03.md`, PR #374). Ruled one at a time with Francis, each with A — Builder, B — Critic and a synthesis. Ids `eq-1` … `eq-10`.

- **eq-1 (A) Magic weapons and class lists.** A magic weapon or armour carries **`baseId`** (the ordinary item it's made from); a class's list accepts an item whose id or `baseId` is on it. A "chosen" magic armour's base pick fills `baseId`. `pack:check` warns on a magic weapon or armour with no `baseId`.
- **eq-2 (A) Race limits in play.** The equip check (the Pack's Put it) reads the race's `weaponsAllowed` and armour limits as it reads the class's: blocking or warning as the setting says, the source named ("Small kindred can't wield Large weapons").
- **eq-3 (A) Carrying treasure (basic encumbrance).** Treasure in a character's load **suggests** "Carrying treasure" on; the GM can switch it per character (logged, Undo) and the speed follows. "Significant" stays the GM's judgement.
- **eq-4 (A) The same item id in two attached packs.** The pack on top wins (07's existing rule; the shared choice, tf-1, reorders); the entry says "from <pack> · also in <pack>"; the import preview and `pack:check` list the clashes.
- **eq-5 (A) A container's weight by fill.** `weightEmpty` and `weightFull` (the encumbrance unit); its weight scales with how full it is; its contents don't count; the Pack shows "Bag · 300 of 600 · half full". Equal values = always fixed.
- **eq-6 (A) Carry-limit bonuses.** An item's `carryBonus` (in the encumbrance unit) raises its wearer's limit while worn or held; the load breakdown names it.
- **eq-7 (A) Weapons by combat category.** The rules set's `weaponRules: [{ category, classCategories: [...] }]`; the equip check allows an item when the class's own list does **or** a rule for its category includes the class's combat category; blocked, it names the rule.
- **eq-8 (A) Classes with two forms** (G-64). A class's `forms: [{ id, name, weaponsAllowed?, armourAllowed?, note }]`; the character has a current form, switched from the sheet (logged, Undo); the equip check reads its limits; gear that doesn't fit stays carried with a line saying so.
- **eq-9 (A) Quick equipment by class.** One quick kit; its rolls may carry `forClasses`, so a character sees only their class's rolls. *(Note, 2026-11-04 evening, Francis via the pack session: a pack whose kits also hold class-only fixed items keeps one kit per class with `classIds` (the zine-compendium's eleven); `forClasses` filters rolls, not fixed items, so it serves packs with one shared kit. Nothing changes for the builder.)*
- **eq-10 (technical)** 07's duplicated survey bullet (races, around the creation section) removed.
