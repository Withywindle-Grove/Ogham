# Plan: M6 slice 2a — the fight engine, logic only

Written by the design agent, 2026-11-05. Francis's yes the same day: this slice may start **before the M5b gate passes**, on **Fable**, in the next free builder slot, behind any gate bug. It makes no rulings. Overview: `docs/plans/m6-fights.md` (slice 2).

## The fence (read first)

This is the gate workflow's "engine-only" work (`.claude/README.md`): **no screens, no migrations, no commands registered, nothing imported by the app yet.** Pure functions and their tests, on branch `m6-2a-fight-engine`, **merged only after the M5b gate passes and its fixes are in**. If a step seems to need a table, a command or a component, stop and write a scope check: that is slice 2b (commands, tables, events, permission cases, the logged-commands row), built after the gate.

It must not touch any file the sheet work touches (`src/app/CharacterSheet.tsx`, `src/modules/characters/`), nor `src/modules/expedition/` beyond reading it.

## What it delivers

A new module folder (suggested `src/modules/fight/`; the builder names it, following 02 Foundation 5) holding **the state of a fight and every step that changes it**, as pure functions `(state, step) → { state, effects }`, so slice 2b can wrap each one in a command and store the event. Nothing rolls dice and nothing decides an outcome: every roll is entered, every result is tapped.

## Rests on

| Read | For |
|---|---|
| 04 Combat (Encounter, Combatant, We run) | the state's fields; several fights, one run at a time, the others paused exactly where they were |
| 05 Explore, Encounter and Fight; Combat tracker: The round, Initiative, Delay | the behaviour |
| 07 Encounters and fights: `initiative` (`rerollEachRound`, `ties`), `death.dying.perRound`, the `initiativeModifier` target | what the pack says |
| `design/rulings/fight-dry-run-2026-10-29.md` 4, 5, 9, 13 | turns end by tap, the round advances by itself, Delay, per-round effects, We run and its Undo |
| `design/rulings/hedge-audit-2026-11-04.md` ha-2; `m5b-pack-review-area-4-2026-11-04.md` fi-1 | the three hooks; slow weapons always on |
| `design/rulings/m6-fight-screens-review-2026-11-01.md` 8, 10 | End foes' / End players' turn; Delay only in individual initiative |

## Build order

1. **The state.** A fight: its group, round, status (under way · paused · escaping · ended), initiative mode (side · individual), the setting's timing (`rerollEachRound`, `ties`), the sides, whose turn, the turns done, minutes on the clock. A combatant: the actor, its side, **its number among foes of the same kind (never reshuffled, never reused)**, the entered initiative, Delayed, the optional target, statuses with round timers, hidden, arrives-in, and its outcome (in the fight · Down · dead · fled · surrendered · captured). Shapes follow 04; where 04 is silent, write the choice in Departures.
2. **Starting and joining.** Start a fight from a group and its foes; add foes mid-fight (numbers continue); a surprised side doesn't act in round 1; hidden foes take no turn until revealed; arrives-in counts down at each round and the foe joins by itself.
3. **Side initiative.** The winner tapped at the start (and at each round start when the rule re-rolls; once otherwise); ties by the pack (`party`, `opponents`, `reroll`, `simultaneous` = both act together); End players' turn (any player) and End foes' turn (the GM); when both are done the next round starts by itself; the same side may act twice in a row; **Next round** as the GM's override at any moment.
4. **Individual initiative.** Entered numbers; high or low first and the tie-breaker from the campaign's settings; missing entries act last and never block; End turn per character and per foe or group; the round advances when every turn is done.
5. **The three hooks (ha-2, with fe-1).** *Acts last:* a combatant flagged from a weapon's `slow` quality or a stat block's `initiative: "last"` goes after everyone else in its round (among several, in their usual order). *Per-actor modifier:* in individual mode the combatant carries its initiative modifier (07's `initiativeModifier` target) **for the pad to show; the order is made from the entered numbers alone, and the engine never adds it** (fe-1). *Per-round heal:* a status carrying a heal amount is applied by the round advance, capped at the maximum, reported as an effect.
6. **The round advance.** One function that: adds the round's minutes, ticks every round timer and ends those at zero, returns the per-round effects in order (dying's automatic loss or its death-roll prompt, per-round heals, arrivals, end-of-round reminders, "initiative again" when the rule re-rolls), clears the turns done, the targets and any Delayed flag that has reached its owner's next normal turn.
7. **Delay.** Only in individual mode; sets the flag on the character whose turn it is and passes the turn; the character may act later, including during the foes' turns; the flag clears when they act or at their next normal turn.
8. **Several fights.** Pause and resume: a paused fight keeps everything; resuming one pauses the one being run; a step sent to a paused fight is refused with a reason.
9. **We run and Undo.** Calling it sets the fight to escaping and changes nothing else; Got away and Caught resolve it (Caught returns to the fight where it was). **Every step returns what is needed to reverse it exactly** (the previous values, or the whole prior state where cheaper), so slice 2b's events can undo any step, We run included, back to the same round, turn, flags, timers and numbers.

## Tests (each purpose as a plain sentence first)

- A fight with one side surprised gives that side no turn in round 1 and a normal turn in round 2.
- With side initiative rolled once, the winner acts first every round and the winner is asked for only at the start.
- With initiative re-rolled each round, the round advance asks again, and the same side can act twice in a row.
- A simultaneous tie lets both sides act and the round still advances after both are done.
- The round advances by itself when the last turn ends, and Next round advances it early.
- In individual mode a missing number acts last and nobody is blocked.
- A combatant with a slow weapon acts after everyone, whatever number was entered (ha-2, fi-1).
- An initiative modifier is carried with the combatant and never changes the order: two actors entering the same number, one with a modifier, are ordered by the tie-breaker alone (fe-1).
- A per-round heal restores its amount at each round and never past the maximum (ha-2).
- A status with a three-round timer ends at the third advance; one with no timer stays.
- A Delayed character can act during the foes' turn, and the flag clears when they do.
- Foes added mid-fight continue the numbering; a dead foe's number is not reused.
- A foe arriving in two rounds joins at the second advance; a hidden foe takes no turn.
- A paused fight is unchanged by time passing in the other fight; a step sent to it is refused.
- Undo of any step, and of We run, returns exactly the prior state (property test over random step sequences).
- Nothing in the module rolls a die or imports from the app, the core's storage, or another module.

Invented names only in fixtures ("Bog lurker 1", "Wren").

## ⚑ for Francis (collected, not decided)

1. ~~The initiative modifier~~ **Ruled 2026-11-05 (fe-1):** a reminder beside the pad; the entered number is final.
2. ~~Minutes per round with no pack value~~ **Ruled 2026-11-05 (fe-2):** no time per round; the fight takes one turn in all, added at its end (the round advance adds minutes only when the pack gives a round's length; ending the fight returns the turn to add as an effect). Test: a fight of five rounds with no round length adds exactly one turn at End fight and none before; with a round length it adds the rounds' time.

## Estimate

5–8 Fable turns. Fragile parts: the exact-undo property (step 9) and the Delay flag's "next normal turn" (step 7).

## Departures

Built 2026-11-05 on `m6-2a-fight-engine` (`src/modules/fight/`: `types.ts`, `order.ts`, `engine.ts`, `fights.ts`, `index.ts`, `fixtures.ts`). No scope check was needed: no step needed a table, a command or a component. **Ruled by Design 2026-11-05** (through the coordinator, on PR #484): 6 and 8 changed as below; 4 left as built (a third side is on M6's open list for Francis); 3, 7, 10, 11, 12 and the rest fine as built.

1. **fe-1, fe-2 ruled** mid-build (#481) and built to: the modifier is carried on the combatant for the pad and never touches the order; with no `roundSeconds` the clock stays at zero and End fight (and Got away) return `{ kind: 'fight-time', turns: 1 }` as an effect, else `{ seconds }`. The clock is kept in seconds (integer, 07 `time.roundSeconds`); `minutesElapsed()` derives the minutes 05 shows.
2. **Status and paused are two fields,** as 04 has them (`status`: under way, escaping, ended; `paused`: true or false), not the plan's four-way status: a paused fight keeps its status, so resuming an escaping fight resumes it escaping.
3. **HP on the combatant** (`hp: { current, max } | null`) is a mirror for the engine's own arithmetic (the heal cap and the dying loss). HP's home is slice 1's table; slice 2b fills the mirror from it, writes the result back, and never sends a foe's to players (hard rule 5).
4. **Sides:** 04's `sides [{ name, order, actorIds }]` is kept as `side: 'party' | 'foes'` on each combatant (an ally joins the party's side) plus `sideOrder` for the round; nothing needs a named third side.
5. **Arrival keeps the Hidden flag as the foe was added** (05: "added hidden, with a reminder and Reveal on that round"): the arrival effect carries `hidden` so 2b can show Reveal; a foe added visible with an arrives-in joins visible, as the plan says.
6. **The Delayed flag clears when the character acts, or when their own next normal turn begins** (ruled by Design 2026-11-05, as dry run 5 and 05 Delay say; first built as clearing at the round advance). The round advance leaves it; after every step, if whose turn it is now is a Delayed combatant, their flag clears. So a character who delayed and hasn't acted keeps the flag into the next round and may still act during the turns before theirs. It also clears on `act` and on their own End turn.
7. **End side turn while the winner tap is awaited is refused** ("Tap which side won first."); in a simultaneous tie either side may end first. In individual mode End turn is taken for any acting combatant whose turn isn't done, in any order (nobody blocks the table).
8. **The individual tie-breaker is an input** (`FightRules.individualTies`, ruled by Design 2026-11-05): the campaign's own setting (05: number range, high or low first, tie-breaker), which slice 2b passes in; null means the pack's `ties` applies. `party` / `opponents` pick the side; `simultaneous` leaves the list order; `reroll` leaves the list order and returns a `reroll-tie` effect naming the tied numbers when one is entered. Within one side the list order stands.
9. **The dead point is reported, never applied:** the dying loss effect carries `atDeadPoint`; only the GM marks a character dead (05).
10. **While escaping, only Got away and Caught are taken;** every other step is refused with a reason (review 11: Undo until the GM resolves it).
11. **A minimal `end-fight` step** (status ended, the fight-time effect) is included because fe-2's test needs it; slice 13 builds End fight's summary on top of it.
12. **Marking an outcome also lets the round advance** when it leaves no turn undone (a last foe marked dead before ending its turn), so a round never sits finished waiting for Next round.
13. **A per-round heal is reported even when it restores 0** (the combatant is at full), so the log can say so; a combatant without an HP mirror gets the effect with 0.
14. **The property test uses a small seeded generator written in the test** (no new dependency, hard rule 9): 300 seeds × 40 random steps across random rules; every accepted step is undone exactly and no step changes its input.
15. **Not built (by the fence):** nothing is registered, stored or shown; `fights.ts` holds the several-fights set as a pure value for 2b.
