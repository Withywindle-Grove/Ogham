# Plan: m5b-pack-update-reaches-items (gate finding F27)

Approved by Francis via Design on 2026-11-10 (option 1: build now, one small pull request). There was no plan file for this step: the coordinator's brief was the plan, and it is recorded here so the chain stays whole.

## The bug

After a pack update (fae-woodland 0.3.72 → 0.3.74 added `weapon.modes`), a character's existing longbow shows no Quiver. A carried line keeps its own copy of its item (`src/modules/inventory/inventory.ts`, top). The Pack read `{ ...entry.data, ...line.details }` (`src/app/CarrierItems.tsx`): the copy's own `weapon` object replaced the entry's whole, so new keys inside it (`modes`, `range`) never got through. The character overview read `line.details` alone.

## Scope (reading only: no migration, nothing rewritten in the database)

- For a pack item (a line whose `sourcePackId` and `sourceEntryId` find its entry in the campaign), read the play blocks `weapon` and `armour` from the current entry and lay the line's own block over them key by key (one level in). The entry's new keys come through; the line's own keys still win. Everything else stays as today.
- One helper (`src/modules/inventory/lineItem.ts`, `withEntryBlocks`), used through `lineInPlay` (`src/app/campaignSetting.ts`) by every reader: the Pack (`CarrierItems`, which hands the line to the row and the item sheet), the character overview, and the worn-armour reader (`EquipWarning`). The patches in play (of-13) keep working.
- Folded in (gate check 73): the item sheet's source line passes the pack's `meta.sourceTitles`, so it names the book, not its code.

## Not in scope

A value the pack corrects on a key the line already has (a damage die) still doesn't reach an item already owned, because the line's key wins. That is option 2: a design ruling after the gate.

## ⚑

None raised by the plan.

## Estimate

One small pull request, no migration.

## Departures

- The patches are applied to the line's own copy first and the entry's blocks merged after, not "merge, then patch": the entry in the campaign's setting is patched already, so merging first would patch a key that came from the entry twice. A patch line for a key that came from the entry is taken from the entry's own patch lines, so it still shows once.
- The entry is used only when it is the line's own pack's copy (the pack it was copied from wins the campaign's stack). When another pack's copy wins, the line reads its own copy as before.
- Not changed: the base-armour choices for magic armour (`pickBase.ts`, `WaitingForYou.tsx`, `EquipWarning.tsx` `asItem`) still read the line's copy alone; they have no campaign setting at hand. `armour.baseArmour` is also kept out of the merge, because the database checks a base pick against the line's own copy (review of #596). See the status file.
- AC's worn gear is worked out by a pure `wornGearOf` (`EquipWarning.tsx`), which decides what counts for AC from the merged block, so a ring's AC bonus that a pack update added counts (review of #596).
