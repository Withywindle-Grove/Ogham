# Plan: M6 — encounters and fights (draft)

Written by the design agent, 2026-11-05, on Francis's yes to draft it ahead of the M5b gate. **M6 stays on hold until Francis says start.** This file makes no rulings: it orders what is already ruled into build slices, lists the ⚑ still open, and gives a rough estimate. Each slice gets its own `docs/plans/m6-<n>-<name>.md` when it is claimed.

## What is ruled (read these, in this order)

| File | What it settles |
|---|---|
| `design/rulings/m6-rulings.md` | M6-1 … M6-13: the round, damage, Add foes, death, morale, the encounter flow, layouts, prompts, GM tables, ending a fight, monster behaviours |
| `design/rulings/fight-dry-run-2026-10-29.md` | The paper dry run's changes: the GM records damage to foes, turns end by tap, Delay, the death panel, bonus HP, Down or dead packs open, + Status and Note, We run |
| `design/rulings/m6-gate-alignment-2026-11-01.md` | What the fight screens inherit from the M5 gate (tables screen, the players' table view, header, statuses, weapons at hand) |
| `design/rulings/m6-fight-screens-review-2026-11-01.md` | Francis's screen-by-screen review; the mockup of record is `design/mockups/m6/m6-fight-screens.html` |
| `design/rulings/hedge-audit-2026-11-04.md` | ha-1 (prep-space paper test before the tables slice), ha-2 (three engine hooks from the start) |
| `design/rulings/m5b-pack-review-area-4-2026-11-04.md` | fi-1 (slow weapons always on), fi-2 (shared monster ids), fi-5 (overlay checker), fi-7 (the profile's morality line), fi-8 (regional tables) |
| `design/rulings/m5b-at-hand-breakdown-parts-2026-11-05.md`, `m6-weapon-magic-bonus-2026-11-05.md`, `m6-weapon-magic-bonus-2-2026-11-05.md`, `m7-found-spells-and-rolled-results-2026-11-05.md` | sq-4a, mw-1 … mw-4: a weapon's magic bonus, bonuses against a kind, the ammunition rule and note, hidden until revealed |

Where these differ, the later file wins; 05, 06 and 07 say what is true now.

## Build slices, in order

| # | Slice | Rests on | Model | Rough turns |
|---|---|---|---|---|
| 1 | **HP in its own table**, keyed so one foe may have several pools; read rules for Show each other's HP and for a Down or dead character's pack (the purse part waits for M7b). One migration that moves data: **needs Francis's explicit OK** | 08 M6 "First"; dry run 11; hard rule 5 | Fable | 6–9 |
| 2 | **The fight engine, no screens**: a fight's state (several fights at once), combatants and numbered foes, rounds, turns ended by tap, side and individual initiative rolled each round or once, the same side twice, Delay, and ha-2's three hooks (acts last, a per-actor initiative modifier, a per-round heal status) | dry run 4, 5; ha-2; fi-1 | Fable (multi-fight state) | 8–12 |
| 3 | **Encounter panel**: surprise per side, distance defaulting to the average, reaction through the tables screen, Fight · Talk · Avoid always available, the "No fight" note | M6-7; dry run 1; review 12, 13 | Opus | 5–7 |
| 4 | **Add foes**: Encounters above Bestiary, search that never opens the keyboard by itself, HP choice, modifications, leader, hidden, arrives-in | M6-4; review 14, 15; gate alignment 1; fi-2 | Opus | 5–7 |
| 5 | **The GM's fight screen**: header, three columns, the sequence strip from the pack's own steps, End foes' / End players' turn, the combatant panel | M6-8; review 1–3, 8; gate alignment 3 | Opus | 7–10 |
| 6 | **Damage and healing**: the segmented HP bar, the pad with its stepper inside the target's panel, the GM enters all damage, the player's optional target tap, the GM mirror, bonus HP by hand | M6-3; dry run 2, 3, 10; review 6 | Opus | 6–8 |
| 7 | **Foe cards**: nudges, ability dots, More, + Status with the widened pop-up, Note | M6-2a; dry run 12; gate alignment 4 | Opus | 4–6 |
| 8 | **Down and the death panel**: Down marked quietly, the panel from the pack's death rules, per-round effects by themselves, Take from a Down or dead character's pack | dry run 9, 11; M6-5 | Opus; Fable if the read rules change | 5–8 |
| 9 | **Morale**: the pack's triggers only, the check as a pop-up prompt with the target built from its parts | M6-6; dry run 8; review 4 | Opus | 4–6 |
| 10 | **The players' side**: Scene in a fight on the table view (Foes · Party), the Player tab in a fight (the attack line against the tapped foe, weapons at hand with the magic bonus and specialisation, the ammunition rule or note, ability dots, Use, End turn and Delay in individual initiative), We run with Undo | gate alignment 2, 5; review 9–11, screen 5; sq-4a; mw-1 … mw-4 | Opus | 8–11 |
| 11 | **Prompts**: the attack prompt in the campaign's AC style, called saves, Chance…, crit and fumble only where the rules set has the tables | M6-9; review 5 | Opus | 4–6 |
| 12 | **GM tables, the prep space's first slice** — **after the prep-space paper test** (ha-1) | M6-10 as revised; gate alignment 1; ha-1 | Opus | 6–9 |
| 13 | **Ending a fight**: End fight with its summary (time, foes by outcome, captives, XP waiting, loot), We run resolved by the pack's pursuit rule, Undo back into the fight | M6-11; dry run 13; review 7 | Opus | 6–8 |
| 14 | **Monster data**: the behaviours format in the importer and `pack:check`, the overlay and modifications shape check, the profile's morality line, a row's several stat blocks | M6-13; fi-5, fi-7; G-68 | Sonnet / Opus | 4–6 |
| 15 | **Sweep**: gallery specimens, the layout checks at 375 px and tablet, the gate list for M6 | 06 Components; `docs/testing.md` | Opus | 4–6 |

**Rough total: 82–119 builder turns.** The spread is wide on purpose: slices 2, 5 and 10 carry the most unknowns, and none has been sized against the code.

## What can start before the M5b gate passes

Under the gate workflow (`.claude/README.md`): engine-only pieces with no screens and no migrations, on their own branch, merged only after the gate and its fixes.

- **Slice 2** (the engine and its tests): nothing on screen, no migration. **Francis's yes, 2026-11-05: it may start ahead of the gate, on Fable**, as slice **2a** (`plans/m6-2a-fight-engine.md`: pure logic and tests only); slice **2b** (commands, tables, events, permission cases) follows after the gate.
- **Slice 14's checker parts** (`pack:check` shapes): scripts only.

Everything else touches screens or the database and waits.

## ⚑ for Francis (collected, not decided)

1. **Start:** ruled 2026-11-05: M6's screens come **after magic in play** (08, M5c); its no-screen slices (1, 2a done, 2b) may run in the background on Francis's word. (Slice 2a may start ahead of the gate: ruled 2026-11-05.)
2. **The HP migration** (slice 1) moves every character's HP to a new table: needs your explicit OK, with a backup first.
3. **Fable** for slices 1 and 2 (and 8 if its read rules change): each qualifies under `.claude/README.md`; confirm per slice.
4. **The prep-space paper test** (ha-1): its date. It gates slice 12 only; slices 1–11 don't wait for it.
5. **Casting in a fight:** the Player tab's Cast button (review, screen 5) needs spells in play. Francis, 2026-11-05: real casting, not a stand-in; whether all of magic in play is built before M6 is being sized in `plans/magic-in-play.md` (the order M5b gate → magic → fights is his to rule).
6. **The ammunition on the attack line** (mw-3): a note ("+2 more with <ammunition>") or added by itself when magic ammunition is the ammunition at hand.
7. **How "revealed" is stored for one fact of an item** (mw-1, the unidentified bonus): needs a look at the code first; may be a small design question or purely technical. **What the player sees is RULED AND DEFERRED, 2026-11-10 (id-1, `design/rulings/m5b-evening-rulings-2026-11-10.md`):** "the player sees a weapon's or ammunition's modifier, bonus or curse after using it once in a fight, automatically from the first attack in M6; no GM reveal button before then" (Francis: "wait to do it right the first time, no bridge before combat"). Its name and other powers stay hidden. Until M6 the modifier stays hidden from the player (their sheet reads as if the item were plain) while the GM sees the true figure, as built by as-4; a report of "I used it and still can't see the bonus" before M6 is this ruling, not a fault. Whichever slice first records a weapon's attack in a fight builds it, with a test that the first attack shows it.
8. **Pursuit and evasion rules** aren't in the private packs yet (10, M6): pack work before slices 3 and 13 can be tested for real.
9. ~~Party damage by the GM~~ **Ruled 2026-11-05 (mp-10): players change their own character's hit points, damage and healing alike; the GM can change anyone's.** Slices 6 and 10 follow it: the Player tab keeps its pad; the GM's panel still opens the pad for anyone.
10. ~~A third side in a fight~~ **Ruled 2026-11-05 (ns-1, `design/rulings/m6-named-sides-2026-11-05.md`): named sides**, each with a stance and its own way of taking turns; two-sided fights unchanged. Slice 2a takes it now (3–5 builder turns, the builder's sizing); slices 4 (Add foes' Side choice), 5 (a heading and a turn button per side), 10 (the players' headings) and 13 (outcomes per side) follow it; **a short mockup pass with three sides comes before slices 4, 5 and 10.** Both settings order three or more sides the same way (each side rolls, highest first, every round; the pack session's reading, 2026-11-05); what the books leave open (a tie between two of three sides, one setting's "humans act first on a tie", a side choosing to wait) is covered by the GM tapping the sides in the order they act, so nothing more is modelled.
11. Already listed in 10 and unchanged: room features with states; multi-part monsters (R2; M6 shows parts as notes). ◈ Intents-first rounds stay open.

## From the creature toolkit (2026-11-05, Francis)

Its creatures carry rolled tables. Flavour tables (features, what it's doing, names, lairs) sit on the stat block: the GM taps the row in Add foes or from the foe's card and the result is a note on that foe. **A variant row that changes numbers names a `modifications` entry, and tapping the row applies it**: that link is designed once here, in slice 4, and M7's items reuse it (rr-1). Its creatures have no attack, saves or XP of their own: pairing with a setting's stat line, and a per-setting companion pack for the rest, are still to be ruled (G-196). Turning's help from the encounter (mp-12) reads a stat block's `turnAs` in slices 5 and 10.

## From magic in play (2026-11-05)

A conjured creature (a5-5) that exists when a fight starts, or is cast during one, is a combatant on the party's side, acting with the party (ns-1): slices 2b, 4 and 10 take it. The "spell lost" reminder (mm-3, 2026-11-10: only in a fight, when the caster has not yet acted in the round's initiative order, and where the pack's rule allows it; `design/rulings/m5c-magic-mockups-2026-11-10.md`; it moved here from M5c's slice 3), bonus hit points from a spell and uses that come back at End fight read magic in play's state.

## Not in M6

Subdual damage (R2); players entering damage to foes (parking lot); spells' own effects beyond what a status or note carries (M7); purses in the Take-from sheet (M7b); prepared encounters with rooms (M8b); a rolled result that adds fields to an item (rr-1, M7); foes carrying kinds the app matches for against-a-kind bonuses (later ruling).

## Dates

08's dates aren't changed here. The re-forecast waits for the Sunday check-in (`design/notes/forecast-proposal-2026-11-04.md`).

## Departures

(The builder keeps this current.)
