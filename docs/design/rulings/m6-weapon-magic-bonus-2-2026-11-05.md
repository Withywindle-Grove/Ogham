---
status: absorbed
milestone: m6 (packs may be filled now; the app reads the fields in M6)
absorbed-into: docs/07-content-packs.md (Equipment: a weapon's magic bonus), docs/09-decisions-log.md (2026-11-05), docs/10-open-questions.md (M6: one ⚑)
supersedes: mw-1's case line "No book splits the attack bonus from the damage bonus" (`m6-weapon-magic-bonus-2026-11-05.md`): one does, against a kind of foe; the rest of mw-1 stands
---

# A weapon's magic bonus, two follow-ups (design ruling, 2026-11-05)

Two cases the pack session found while applying mw-1 (G-147). Ruled one at a time with Francis. Ids `mw-2`, `mw-3`.

- **mw-2 A damage-only bonus against a kind (allowed).** In fae-woodland a rolled special power makes a magic weapon hit harder against one kind of foe without making it more accurate (one power, a row per kind of foe, landing on any magic weapon when the GM rolls it). Invented example: **Fenblade +2, damage +4 vs bog lurkers**. A `bonusVs` entry may carry **`damage`** in place of `bonus`: `{ against, damage }` is the **total damage bonus** against that kind; the attack bonus stays `magicBonus`. An entry has `bonus` or `damage`, never both. In the app (M6) it is a note line like the others ("damage +4 vs bog lurkers"); the attack figure doesn't change. `pack:check` warns on an entry with both or neither.
  - *Why:* written as an ordinary against-a-kind bonus, the attack figure would be too high against that foe. One optional word; nothing already filled changes.
- **mw-3 Missile and launcher bonuses: a setting-level rule.** fae-woodland adds both when magic ammunition is shot from a magic launcher (invented example: a +2 Reed arrow from a +2 Fen bow attacks and damages at +4); classic-advanced says nothing either way (the pack session read the pages). The rules set carries **`attack.ammunitionBonus: "add"`** where the book says both apply. With no such rule the app adds nothing.
  - **For M6's design:** how the attack line knows which ammunition is being shot (a note "+2 more with <ammunition>", or added when magic ammunition is the ammunition at hand).
  - **⚑ (10, M6):** in a setting with no rule, whether the ammunition's bonus shows as a note for the GM (proposed) or not at all.

**Pack session:** fae-woodland's rules set gains `attack.ammunitionBonus: "add"`; the rolled power's rows carry `bonusVs: [{ against, damage }]` in the shape the table rows already use for what a roll gives an item (say which shape in the gap row if none fits). Invented names in anything that reaches the repo.

Docs to update: 07 (Equipment), 09, 10.

09: 2026-11-05 — [items] A `bonusVs` entry may give `damage` in place of `bonus`: the total damage bonus against that kind, the attack bonus unchanged (mw-2; corrects mw-1's "no book splits") — A rolled power in one setting raises only the damage; the attack figure must stay honest — `design/rulings/m6-weapon-magic-bonus-2-2026-11-05.md`
09: 2026-11-05 — [fight] A rules set may say `attack.ammunitionBonus: "add"`: magic ammunition's bonus adds to a magic launcher's; with no rule the app adds nothing; how the attack line knows the ammunition is M6's design (mw-3) — One setting says both apply, the other is silent; a setting-level rule, not an item field — `design/rulings/m6-weapon-magic-bonus-2-2026-11-05.md`
