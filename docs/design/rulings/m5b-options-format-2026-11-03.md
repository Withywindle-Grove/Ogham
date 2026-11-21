---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (options: `extends`, `option` and `byOption` on any entry, `null` sections, `onlyWithOption` on modifiers; fields `forRaces`; attack `weaponDamage`; `dungeonExit`; `known.listLevel`; trait-list `distinct`; starting-equipment pick lines), docs/09-decisions-log.md (2026-11-03), docs/11-modelling-gaps.md (G-97 … G-105, G-118 … G-120), docs/plans/options-gates.md
supersedes: cs-6's `startingEquipment.pick` as a key (of-11: a line); 07's `listLevel?: 0` (of-6)
---

# The options audit's format questions (design ruling, 2026-11-03)

From the pack session's options audit (`plans/options-audit-2026-11-03.md`, "Format questions" F1 … F7; gaps G-97 … G-105) and today's pack work (G-118 … G-120). Francis asked for every optional rule to behave properly before packs grow more complex. Ruled one at a time, each with A — Builder, B — Critic and a synthesis. Ids `of-1` … `of-11`.

- **of-1 (A) An overlay extending a base option (F4, G-101).** An option may carry `extends: "<base option id>"` with its own choices; the app shows one option, the base's choices plus the overlay's, each labelled with its pack (as tf-1's card). `ruleKey` stays for whole-rule rivals; `pack:check` warns on an option with both. *Pack session:* the zine's fourth encumbrance method as `extends`.
- **of-2 (A) One switch per rule, owned by the book that defines it (F6, G-118).** The duplicate goes (cantrips: the owning pack keeps the option; the other adds its spells to the level). **Safety net:** the app never asks for picks from an empty list level; it skips them and says "No spells at this level in your packs". *Pack session:* settle which book defines cantrips, keep one switch.
- **of-3 (A) Options gate any entry (F5, G-102, G-103, G-105).** Any entry (item, class, race, spell, kit, table, field) may carry `option` (exists only while that option or choice is on) and `byOption` (its fields under a choice), read by every screen that lists or uses it through **one shared reader**; sheet fields add `forRaces` beside `forClasses`; `pack:check` warns on an `option` naming no option. *Pack session:* gun eras and materials on items, class `byOption` for armour and abilities, `forRaces` on the race-only fields.
- **of-4 (A) A modifier behind an option (G-100).** A check's modifier may carry `onlyWithOption`; while off, it doesn't apply and the weather tags show no effect. *Pack session:* the weather effects on the lost check.
- **of-5 (A) Safe paths with no roll (G-104).** `dungeonExit` without a `roll` still offers **Use safe paths** (no roll, logged, the pack's note shown); Leave the dungeon's stepper reads **"levels below the first"** (T3).
- **of-6 (A) Any list level (G-119).** `known.listLevel?: <n>` (default 0); `pack:check` warns only when that level has no spells.
- **of-7 (A) Distinct trait-list rolls (G-120).** A trait list rolled more than once may carry `distinct: true`, as kit rolls (bq-1).
- **of-8 (A) Every weapon's damage from a rule (F1, G-97).** The rules set may carry `attack.weaponDamage: "<dice>"`, usually under `byOption`; while set, every weapon reads that die (at hand, the sheet, the breakdown says so); items untouched.
- **of-9 (A) A field whose option is off (F2, G-98).** Hidden everywhere (creation, the full sheet, the Player screen); its value stays saved and returns with the option; the option's row in Rules says what it adds ("adds a field: …").
- **of-10 (A) A choice removing a section (F3, G-99).** In `byOption`, a section set to `null` is off (`"morale=off": { "morale": null }`); every screen treats it as absent; the reference shows it "Off · the option".
- **of-11 (A) Picks in starting equipment (F7).** A pick is one kind of line in the `startingEquipment` list: `{ "pick": { "tableId": "<id>", "upTo": 3 } }`, beside `{ itemId, qty }` lines; Gear shows each as "Pick up to N · or roll" (ct3-6's picker, fewer allowed).
