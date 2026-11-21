---
status: absorbed
milestone: m6
absorbed-into: docs/05-features.md (Explore, Encounter and Fight), docs/06-screens-and-design.md (Key journeys), docs/08-roadmap.md (M6)
supersedes: —
---

# M6 design plan: PROPOSAL v2 (2026-10-26)

M6 (due Nov 22): encounters and fights. 05 already rules the outline: Encounter → Fight on the GM console; side and individual initiative; hidden monster HP with public damage and statuses; GM-secret timers; tap any combatant; add foes mid-fight; stat block panel; End fight; loot strip; the Scene follows the GM's mode; CS-8 (monster AC learned in play); X-3 timed effects.

This plan adds the moment-to-moment design, shaped by the influences in `m6-influences.md`. Rulings are taken one at a time, with light and dark mockups where text can't show it, and the uiux checklist before each.

## Principles for every M6 ruling
1. **The table talks; the app keeps score.** No step asks a player to tap during someone else's turn.
2. **Foes are creatures, not bags of HP.** Their style, goal and next move are visible to the GM every round, and showable to players.
3. **Fighting is one way out of many.** Parley, bribe, evade, sneak past, surrender and retreat are first-class endings.
4. **Dice in the open; the app never rolls.** It shows the chance, records the result, and never decides an outcome.
5. **Hidden means hidden.** Monster HP, morale scores, secret timers and GM-only results never reach players' devices.
6. **Short and calm.** A fight should take minutes; the GM's screen shows only what each foe actually has.
7. **The pack decides the rules,** in its own words, with generic fallbacks.

## Rulings
| # | Ruling | Status |
|---|---|---|
| M6-1 | **Who enters what:** "Players enter damage to foes" (On by default); players always enter their own damage taken; the GM can enter anything for anyone; every entry logged with who, GM can undo; a player's damage on a foe counts as a confirmed hit for AC; "Goblin 2 down · from Wren" on the GM's screen | **RULED 2026-10-26** |
| M6-2 | **The round** and **foe nudges** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-3 | **Damage and healing** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-4 | **Adding foes** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-5 | **Down, dying, dead, fled, surrendered** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-6 | **Morale** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-7 | **Encounter flow** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-8 | **Layouts** (see m6-rulings.md; canvas "M6 fight layouts") | **RULED 2026-10-26** |
| M6-9 | **Prompts** (see m6-rulings.md) | **RULED 2026-10-26** |
| M6-10 | **GM add-ins** (see m6-rulings.md; first version, dry run pending) | **RULED (first version) 2026-10-26** |
| M6-11 | **Ending** (see m6-rulings.md) | **RULED (first version) 2026-10-26** |
| M6-12 | **Journeys and dry runs:** fight round, damage a foe, add foes, morale, tactics roll, end fight; tap and screen-change budgets and click-through tests; **paper dry runs:** a scripted 5-round fight (target: at most one tap per player per round on average) and creating GM add-ins (tables, a tactics table) | |
| M6-13 | **Monster behaviours format** (see m6-rulings.md) | **RULED 2026-10-26** |

## Not in M6
- ⚑ Room features with states (chandelier, brazier): M8b (adventure rooms) or R2.
- ⚑ A saved list of rulings ("Keep as a ruling"): R2.
- Multi-part monsters with HP per part: R2 (M6 shows parts as notes).
- Facing, arcs and areas: text only, no map.
- A "caller" title: with the company titles (M8).

## Pack work alongside (private, not app work)
- An invented starter **tactics** table (and crit and fumble tables) in the private homebrew test pack, for testing M6.
- overlay-1's source book as a private pack, staged after M6-13 fixes the format: stage 1 the encounter tools, reaction table, upgrades and about 20 monsters; later stages the rest.

## 09 line (M6-1)
- 2026-10-26 — Players enter damage to foes (campaign setting, On by default); players always enter their own damage; the GM can enter anything; every entry logged, GM can undo; a player's damage counts as the confirmed hit for AC — spreads the work, keeps HP hidden
