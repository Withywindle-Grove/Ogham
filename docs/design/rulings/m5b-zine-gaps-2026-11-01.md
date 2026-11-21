---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (Format additions from the zine-compendium survey; pointers at tables, traitLists, startingKits, spellcasting, conditions, statBlocks, References §13), docs/08-roadmap.md (M6, M7, M8b rows; R2; Later / maybe), docs/09-decisions-log.md (2026-11-01, twelve lines), docs/11-modelling-gaps.md (G-42, G-48 to G-67)
supersedes: —
---

# Zine-compendium gaps: G-42 and G-48 to G-67 (design ruling, 2026-11-01)

From the pack specialist's survey and stages 0–5 of the zine-compendium overlay (private detail in `packs/zine-compendium/GAP-REPORT.md` and `open-items.md`). Francis ruled each item from A/B/C options, one at a time. The format is written in 07 in one new section so the pack is written once; the build releases are in 08 and the register.

| # | Rows | Ruled | Francis |
|---|---|---|---|
| 1 | G-55 overlay shape | Panels and options allowed both at the pack's top level and on a rules-set entry; the reference switcher merges them; `meta.sources[]`; `meta.requires` is the only overlay link | C |
| 2 | G-42 row + sub-table | `rows[].tableId` beside `result`, rolled on tap; M8b | A |
| 3 | G-48, G-57 gear from lists and kits | `entries[].items` in the kit shape; dice `qty`; cross-pack `itemId` through `meta.requires` | A |
| 4 | G-49, G-63 known casters | `spellcasting.known` (byLevel, usesPerDay, memorise, listLevel 0); slots, known or both; M7 | A |
| 5 | G-53, G-52 items that act and items that break | `items[].applies`; damaged states as conditions with `appliesTo: item`; repair later | A |
| 6 | G-58 drop-in places | `locations` in rules packs, region optional; flow with the prep session | A |
| 7 | G-59, G-60 stat-block shapes | `parts` and `variants` in 07; variants at M6; part pools an M6 follow-up | A |
| 8 | G-61, G-65 class features | `progression[].armourClass` + `extra`; `armour.tier` as an `armourType` id | A |
| 9 | G-62 cults | Trait-list entries carry `spells: { add, replace }`; no deities kind | A |
| 10 | G-50 level 0 | Built in M7 (path + GM's Graduate); format now | B |
| 11 | G-51 materials | Format now, built after R1 | B |
| 12 | G-54 downtime projects | Deferred to the downtime design session, with G-32 | A |
| 13 | G-56 XP as split | M7: Award XP "as the treasure was split" | A |
| 14 | G-64 two-class race | Out of scope; text on the race; wontfix | A |
| 15 | G-66 point-buy skills | Format now, built after R1 | B |
| 16 | G-67 item-count encumbrance | Format now, built after R1 | B |
| 17 | Confirmations 22–26 | All kept: poison families by route; cantrips level 0 + rune list, no fallback; `appearance` refresh at M8b; maps wait for the B1 test; the toad reference stays | keep all |

## For the pack session
Re-shape the pack once: move nothing out of `zc-overlay-rules` (both places are legal) but drop `meta.overlays`; replace `meta.proposedExtensions` with the fields named in 07's new section (`rows[].tableId`, `entries[].items` and `spells`, dice `qty`, `spellcasting.known` in place of `type: known`, `items[].applies`, item conditions with `appliesTo`, inns as `locations`, `variants` and `parts` in place of slashes and "Head hp", `progression[].armourClass` + `extra`, `armour.tier`, `levelZero`, `materials`, `skills.mode: points`, `encumbrance.mode: items`); `pack:check` learns the shapes in the same PR. G-54 and G-64 stay as text.

## Caveats
- Every field here is format-only until its release; the importer must keep unknown fields (it does for reference sections; the pack session confirms for kinds) — otherwise the preview shows them as text.
- The M6 additions (G-53 damage pad, G-60 Add foe) land on screens reviewed three times; both are one line in an existing pop-up, not new screens.
- `meta.overlays` was dropped on a technical ground (name clash with the `overlays` kind), not ruled separately; say if you want it kept.
