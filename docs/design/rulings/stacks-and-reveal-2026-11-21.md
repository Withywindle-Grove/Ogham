---
status: absorbed
milestone: December first play (Francis's tablet feedback, fb-5; B15's sixth flag)
absorbed-into: docs/09-decisions-log.md (2026-11-21); docs/05-features.md (Lights join into one stack, now every stackable thing); docs/plans/test-feedback-2026-11-19.md (section Q, row Q2, ⚑ 33 to 39). The reveal (sw-8) still has to be built into B15's lines of docs/04, 05, 06 and 07 on #10's branch
supersedes: b15f-6 of tablet-feedback-2026-11-20.md (sw-8 reverses it); the rest of that file stands. ⚑ 33 to 38 answer that file's "Not settled" 1 to 6 and widen fb5-1 from lights to every stackable thing
---

# Stacks of every stackable thing, and a revealed name (2026-11-21)

Francis answered ⚑ 33 to 39 in chat on 2026-11-21. The questions are in [`tablet-feedback-2026-11-20.md`](tablet-feedback-2026-11-20.md), "Not settled", and section Q of [`../../plans/test-feedback-2026-11-19.md`](../../plans/test-feedback-2026-11-19.md). Words in quotes are his.

## Rulings

| # | ⚑ | Ruling | His words |
|---|---|---|---|
| sw-1 | 33 | **Every stackable thing joins a same-name stack when added**, not only lights. fb5-1's name match (ignoring capitals and plural) applies to all. | "Yes" |
| sw-2 | 34 | **The join happens only on the same character and in the same place**: the same container, or both loose. The party stash is a place too: things stack inside the stash by the same rule. | "Yes including party stash" |
| sw-3 | 35 | **Two same-name things that differ:** the joined thing takes the figures of the line it joins (the older one). **A lit light, or one partly burnt, is never joined.** | "Yes" |
| sw-4 | 36 | **Undo after the stack changed** reads as the give's Undo (5b, 2026-10-26): it takes back the added count while the stack has at least that many; with fewer left it takes back what's left of the added part and the toast says so; anything else (renamed, given on) refuses with the reason. | "Yes" |
| sw-5 | 37 | **If a max stack size is ever added,** what doesn't fit stays a second stack. | "Yes" |
| sw-6 | 38 | **Gives and moves join too.** A thing given by another character, or moved from the stash or between containers, joins a same-name stack where it lands, under sw-2 to sw-4. | "Yes it joins. For all of this make sure weight is tracked properly" |
| sw-7 | 35, 38 | **Weight.** The carried total (weight, slots, encumbrance) must be right after every join, give, move and Undo, and each has a test for it. Two same-name things of a different weight still join (option A, over "never join"): the joined thing is counted at the stack's weight from then on. Plain case: a stack of 3 torches weighing 3 and a stack of 2 weighing 2 join to weigh 5. Requirement on sw-1 to sw-6. | "A" (his answer to the driver's follow-up); "make sure weight is tracked properly" |
| sw-8 | 39 | **Once the GM reveals a magic item's true name to any group, every player in the campaign sees the real name,** wherever the item is and whoever carries it. Before the GM reveals it, the name stays hidden from all players, as now. This **reverses b15f-6** ("No, group A only"); its edge cases (a), (b), (c) fall away. | "Once it's revealed it's revealed to everyone. Players don't keep this kind of thing secret from one another"; restated by the driver, he answered "Yes" |

## What follows

| Where | Change |
|---|---|
| Lights (fb5-1 to fb5-3) | Stand, now read for every stackable thing. fb5-2's "splits them back" is sw-4's Undo. |
| Hard rule 4 | Not a new deletion: Undo of a join lowers a count and deletes no line. A build that can only add a line and then merge it comes back as a question first (as in the 2026-11-20 ruling). |
| Row Q2 of the plan | Builds sw-1 to sw-7, with the weight tests: after a join, a give, a move and an Undo, in weight mode and in slot mode, the carried total matches. |
| B15 (#10's branch) | A real name and words reach a player once the GM has revealed the piece, whichever group holds the item. The group check of b15f-6 goes. The GM still reads it always. Hidden stays hidden before the reveal; RLS stays the enforcement. |
| p2p-29 | "Wherever it is held" stands as first ruled. |

## Not checked

- Nothing was built or run for this; the answers come from the chat.

## Docs to update
- `docs/09-decisions-log.md`, 2026-11-21 (done here).
- `docs/05-features.md`, lights and stacks line (done here).
- `docs/plans/test-feedback-2026-11-19.md`, section Q (done here).
- B15's lines in 04, 05, 06 and 07: a builder, on #10's branch (not edited here).

## 09 lines
- 2026-11-21 — [items] Every stackable thing joins a same-name stack when added, not only lights; only on the same character and in the same place (the same container, or both loose, the party stash being a place); the joined thing takes the older line's figures, even at a different weight (counted at the stack's weight from then on); a lit or partly burnt light is never joined; gives and moves join where they land; Undo reads as the give's Undo; if a max stack size is ever added, the rest stays a second stack; the carried total must be right after every join, give, move and Undo, each with a test (sw-1 to sw-7, ⚑ 33 to 38) — Francis: "Yes"; "Yes including party stash"; "Yes it joins. For all of this make sure weight is tracked properly"; "A" — `design/rulings/stacks-and-reveal-2026-11-21.md`
- 2026-11-21 — [expedition] [perm] Once the GM reveals a magic item's true name to any group, every player in the campaign sees the real name, wherever the item is and whoever carries it; before the reveal it stays hidden from all players; reverses b15f-6 (sw-8, ⚑ 39) — Francis: "Once it's revealed it's revealed to everyone. Players don't keep this kind of thing secret from one another"; "Yes" — `design/rulings/stacks-and-reveal-2026-11-21.md`
