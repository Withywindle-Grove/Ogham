---
status: absorbed
milestone: December first play (Francis's tablet feedback, fb-5; B15's sixth flag; page M4)
absorbed-into: docs/09-decisions-log.md (2026-11-20); docs/05-features.md (lights, fb5-1 to fb5-3); docs/plans/test-feedback-2026-11-19.md (section Q; section P's page M4 was drawn and approved the same evening, page 28, `page-28-m4-pins-2026-11-20.md`, so P reads as approved); docs/plans/scene-point-to-point.md (row B15). Still to absorb, with #1101's fix push: b15f-6 in #1101's lines of docs/05, docs/04 and docs/07
superseded-in-part-by: stacks-and-reveal-2026-11-21.md (b15f-6 is reversed by sw-8; ⚑ 33 to 39 are answered there)
supersedes: nothing as a file. b15f-6 narrows p2p-29's "wherever it is held" (scene-point-to-point-2026-11-18.md) to the groups the piece was shown to
---

# Joining light stacks, a magic item's name in a split party, page M4 (2026-11-20)

Three answers Francis gave the driver in chat on the evening of 2026-11-20. Each was a pick from options the driver put to him; he took the recommended one each time. The intent behind fb-5 is [`../../intents/francis-tablet-feedback-2026-11-20.md`](../../intents/francis-tablet-feedback-2026-11-20.md).

> ⚑ 33 to 39 below are answered, and b15f-6 is reversed, in [`stacks-and-reveal-2026-11-21.md`](stacks-and-reveal-2026-11-21.md).

## Rulings

| # | Question | Ruling | His words |
|---|---|---|---|
| fb5-1 | His light picker ("Which light?") lists "torch ×2" from character creation and "Torch ×3" as two stacks. When do two lights join? | **Two lights join into one stack when they have the same name, ignoring capitals and plural** ("torch", "Torch" and "Torches" are one name), **even if they came from two different pack entries.** Ruled for lights: the question was asked about lights. | Earlier: "as long as they fit under max stack size (if there is one) agreed". Then: "Same name" |
| fb5-2 | What does Undo of the add do once it has joined a stack? | **Undo puts the stack back as it was before: it splits them back.** The log keeps both. | "Splits them back" |
| fb5-3 | "Under max stack size (if there is one)" | **No item has a max stack size today**, so a join always fits. A pack item's `stack` (07) is how many share one slot, and its `bundle` how many one purchase gives; neither caps a line's count (04, InventoryLine's `qty`). If a max is ever added, what doesn't fit stays a second stack (⚑ 5 below: read from his words, not asked). | As fb5-1 |
| b15f-6 | The GM's eye reveals a magic item's true name to group A; a character in group B carries it. Does B's carrier see the real name? | **No, group A only. B's carrier keeps the plain name until the GM shows the piece to B's group too. Hidden stays hidden.** This narrows p2p-29's "wherever it is held" and changes #1101 (B15), which names the item wherever it is held. | "No, group A only" |
| fb-m4 | Page M4 (pinned abilities, traits and spells on the Player tab; section P of the plan) | **Draw M4 now.** | "Yes, draw M4 now" |

## What fb5-1 and fb5-2 mean in the app

- **When:** a light added to a character (bought, given by the GM, from the creation kit) whose name matches a light that character already has, by fb5-1's rule, joins that stack instead of making a second line. One log line, as an add.
- **Undo** of that add takes the added count back off the stack and leaves it as it was; the log keeps the add and its Undo.
- **The picker** ("Which light?") then shows one row, "Torch ×5". The row's name is the stack's own (fb-1 fixes its capital in its own pull request).
- **In slot mode** a joined stack may take fewer slots than two lines did (07, `stack`: how many share a slot). That follows from one stack; it is not a new rule.
- **Not a new kind of deletion:** the added line never exists on its own, so Undo deletes nothing (hard rule 4's list stays closed). If a builder finds the join can only be built as "add a line, then merge it", that merge's Undo is a deletion and comes back as a question first.

## For #1101's fix builder (b15f-6)

1. A magic item's real name and words reach a player only if the piece was shown to **a group that player has a character in**, at the time of reading. `public.item_truths` checks the reader's group against the groups the piece was shown to, not only that it was shown. The GM reads it always.
2. Showing the piece to group A names the item for A's players wherever A's characters hold it. A character in group B who holds it reads the plain name until the GM shows the piece to B's group.
3. A database test, as a player of group B, that an item held in B whose piece was shown to A alone reads its plain name, with no real name or words in the reply; and that showing it to B then names it.
4. #1101's lines in 05, 04 and 07 that say "wherever it is held" gain "for the groups it was shown to".

## Not settled

Collected, not decided. Numbered as the plan's ⚑ (section Q of `plans/test-feedback-2026-11-19.md`, 33 onwards).

1. ⚑ 33. **Every stackable thing?** fb5-1 is ruled for lights. Should arrows, rations, coins-as-items and the rest join by the same rule?
2. ⚑ 34. **Where the join happens.** Read as: the same character and the same place (the same container, or both loose); a light added to another container stays its own stack.
3. ⚑ 35. **Two lights that differ.** Two pack entries of the same name may differ in burn time, radius, weight or cost. Read as: the joined stack keeps the line it joins (the older one) and its figures. A lit light, or one partly burnt (fuel kept), is never joined.
4. ⚑ 36. **Undo after the stack changed.** Read as the give's Undo (5b, 2026-10-26): Undo takes back the added count while the stack has at least that many; with fewer left, it takes back what's left of the added part and the toast says so; anything else (renamed, given on) refuses with the reason.
5. ⚑ 37. **If a max stack size is ever added:** what doesn't fit stays a second stack (read from "as long as they fit"; not asked).
6. ⚑ 38. **Gives and moves.** fb5-1 was asked about adding. Does a light given by another character, or moved from the stash, join a same-name stack too? Read as no until ruled.
7. ⚑ 39. **b15f-6 at the edges.** (a) A player with characters in both groups: read as named (they were shown it). (b) Groups that join up: read as the joined group's players knowing it if either group was shown it. (c) The item given from an A character to a B character: read as B's carrier seeing the plain name, by the rule.

## Not checked

- The light picker and #1101's built screens were not run for this; the rulings come from the chat and the files named.

## Docs to update
- `docs/09-decisions-log.md`, 2026-11-20 (done here).
- `docs/05-features.md`, lights: fb5-1 to fb5-3 (done here).
- `docs/plans/test-feedback-2026-11-19.md`: section Q, rows Q1 (fb-3) and Q2 (fb-5), ⚑ 33 to 39 (done here). Section P already reads M4 as approved (page 28, 2026-11-20), so fb-m4 needs no line there.
- `docs/plans/scene-point-to-point.md`: row B15's notes (done here).
- #1101's lines in 05, 04 and 07: with its fix push (not edited here, to keep the two from colliding).

## 09 lines
- 2026-11-20 — [items] Two lights join into one stack when they have the same name, ignoring capitals and plural, even from two pack entries; Undo of the add splits them back and the log keeps both; no item has a max stack size, so a join always fits (fb5-1 to fb5-3; ruled for lights, every stackable thing ⚑) — Francis: "as long as they fit under max stack size (if there is one) agreed"; "Same name"; "Splits them back" — `design/rulings/tablet-feedback-2026-11-20.md`
- 2026-11-20 — [expedition] [perm] A magic item's piece shown to one group names the item for that group's players only: a carrier in another group keeps the plain name until the GM shows it to their group too; hidden stays hidden (b15f-6, changes #1101) — Francis: "No, group A only" — `design/rulings/tablet-feedback-2026-11-20.md`
- 2026-11-20 — [process] Page M4 (pinned abilities, traits and spells on the Player tab) is drawn now — Francis: "Yes, draw M4 now" — `plans/test-feedback-2026-11-19.md`, section P
