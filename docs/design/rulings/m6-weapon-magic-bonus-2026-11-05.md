---
status: absorbed
milestone: m6 (packs filled now; the app reads the fields in M6)
absorbed-into: docs/07-content-packs.md (Equipment: a weapon's magic bonus), docs/08-roadmap.md (M6), docs/09-decisions-log.md (2026-11-05), docs/05-features.md (At hand: the weapon breakdown, mw-1), docs/11-modelling-gaps.md (G-147)
supersedes: —
---

# A weapon's magic bonus (design ruling, 2026-11-05)

One question from the pack session (G-147), the field sq-4a needs before M6. Ruled with Francis (A, B, synthesis). Id `mw-1`.

**The case.** Magic weapons give a whole-number bonus to both attack and damage, a minus when cursed; some give a larger bonus against one kind of foe. Invented example: **Fenblade +1, +3 vs bog lurkers**. Today the bonus is only text (`fields.Bonus`) on about 94 items across the packs, so the attack figure can't count it. No book splits the attack bonus from the damage bonus.

| | Option | Why not / why |
|---|---|---|
| A | `weapon.magicBonus` (a whole number, as `armour.magicBonus`) and `weapon.bonusVs: [{ against, bonus }]`, the second a note until foes carry kinds | Right shape; says nothing about unidentified weapons, about "+3 instead of +1", or about text and number drifting apart |
| B | `magicBonus` only; the against-a-kind bonus stays text | The commonest special case stays invisible |
| C | Separate attack and damage bonuses | No book needs it |

- **mw-1 (synthesis).**
  1. **`weapon.magicBonus`**: a whole number, negative when cursed, counted in **attack and damage** alike. No split.
  2. **`weapon.bonusVs: [{ against, bonus }]`**: `against` is plain words ("bog lurkers"); `bonus` is the **total** against that kind, replacing `magicBonus`, never added to it.
  3. **In the app (M6):** the At hand figure and its breakdown count `magicBonus` ("Fenblade · magic +1"); each `bonusVs` entry is a **note line** under it ("+3 vs bog lurkers"), never applied by the app until foes carry kinds it can match (a later ruling).
  4. **Hidden means hidden:** an unidentified weapon follows the armour rule (2026-10-24): the bonus doesn't change the player's numbers, and isn't sent to them, until it is revealed; the GM sees the true figure.
  5. **`pack:check`** warns when a weapon's bonus text (`fields.Bonus`) and its `magicBonus` disagree, and on a stray top-level `bonus` key.
  6. **Pack session, now:** fill both fields from the text by script, re-check every item by hand against the books (the scrutiny standard), remove the stray key. G-147's row: "ruled → mw-1, app in M6".

**Not checked by the designer:** how the app stores "revealed" for a single fact of an item; whether stat blocks carry a kind the app could match (a short search of 07 found none). Both go to M6's plan.

Docs to update: 07 (Equipment), 08 (M6), 09.

09: 2026-11-05 — [items] A weapon's `magicBonus` (whole number, negative when cursed) counts in attack and damage; `bonusVs: [{ against, bonus }]` is the total against a kind of foe, shown as a note until foes carry kinds; an unidentified weapon's bonus stays hidden from the player's numbers as armour's does; `pack:check` compares the bonus text with the number; packs filled now, the app in M6 (mw-1, G-147) — One shape mirroring `armour.magicBonus`; no book splits attack from damage; the hidden rule already exists for armour — `design/rulings/m6-weapon-magic-bonus-2026-11-05.md`
