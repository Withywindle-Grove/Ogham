# Plan: M5c slice 1 — a character's magic as state

Written by the design agent, 2026-11-09 (night), on Francis's yes to draft the M5c slice plans. **Draft: not approved, and nothing is built from it before the M5b gate passes and Francis says go.** It makes no rulings. Overview: `docs/plans/magic-in-play.md` (slice 1 and "What the paper test changed").

## The fence (read first)

**No screens.** Storage, commands, events, permissions and their tests, on branch `m5c-1-magic-state`. The Player screen's present Spells section keeps working from the new state, unchanged to the eye (slice 2 removes it). One migration is expected; it **adds** tables or columns and removes nothing, and it waits for Francis's push like any other. If a step seems to need a new screen or a change to an approved one, stop and write a scope check.

## What it delivers

What a caster knows, what is **chosen** for the next rest, what is **ready** today and what has been **cast**, kept apart (mp-2), per kind of magic; the morning window's state (mp-3); and every command that changes them, logged and undoable.

## Rests on

| Read | For |
|---|---|
| 05 Spells (the Magic tab, Cast, Prepare, Getting magic back, Spell lost) | the behaviour the state must carry |
| `design/rulings/m5c-magic-in-play-2026-11-05.md` mp-1 … mp-5, mp-8, mp-9 | chosen then ready; the window; strict after it; no "lost" state |
| `plans/magic-in-play.md`, slice 1 (the builder's read of the code, 2026-11-05) | what exists (the spell book, the prepared list, ability uses) and what is missing |
| 04 (the character's spells and uses); 07 `spellcasting` (`recover`, `reverseAt`, `duplicates`) | fields and what the pack says |
| 03; hard rules 3, 4, 5 | who may change whose magic; everything logged; hidden stays hidden |

## Build order

1. **Chosen and ready apart.** Per character and spell level: the chosen set (ordered, the same spell allowed more than once unless the class says no) and the ready set with a cast mark per slot. The cast mark is written through a database function, as ability uses are, so two devices can't collide.
2. **Commands** (the builder names them; each checks `can()`, writes an event, has allowed and refused permission cases, and a row in `logged_commands`): choose a spell for a level (add one, take one out); same as yesterday; cast a ready spell; undo a cast; the GM fills or changes anyone's chosen or ready spells at any time (mp-4).
3. **The rest.** Both rest paths (the GM's rest prompt and End expedition's full rest) take a per-caster "magic back" answer (mp-5) instead of today's hard-coded ability uses. For a caster marked back: cast marks clear and the morning window opens. Per-day uses return to everyone at the new day; per-rest uses only to those who rested.
4. **The morning window** (mp-3): open per group from the rest until that group's first move or time step. While open: Same as yesterday or a new choice makes the chosen set ready at once. When it closes: yesterday's ready set becomes ready again for anyone who hasn't answered, logged with Undo. **The app never picks a spell:** a slot with no yesterday stays empty; a set too big carries as far as it fits, in the order chosen, and the event names what dropped.
5. **After the window** (mp-4): a player's change to the chosen set is kept for the next rest and never touches today's ready set.
6. **Who reads what.** Prepared and ready spells stay visible to anyone who can read the character, as today (ruled 2026-11-05). No new hidden data in this slice (found spells are slice 7).

## Tests (each purpose as a plain sentence first)

- Choosing a spell changes what is chosen and leaves what is ready today alone.
- A rest marked "magic back" makes the chosen set ready and clears every cast mark; a rest marked "not back" changes nothing for that caster.
- Same as yesterday in the window makes yesterday's set ready in one step.
- When the group moves with the window open, yesterday's set becomes ready for a caster who hasn't answered, and Undo puts the window back.
- A caster with no yesterday keeps empty slots when the window closes; nothing is picked for them.
- A caster with one slot fewer than yesterday keeps the first spells in the order chosen, and the event names the dropped one.
- Casting marks one slot of a spell taken twice, not both; undoing the cast clears that mark.
- Two devices casting the same slot at once: one succeeds, the other is refused with a reason.
- A player can't change another player's spells; the GM can change anyone's; every allowed change writes an event and a refused one writes none.
- A split party has a window per group: one group moving doesn't close the other's.

Invented names only ("Wren", "Mire lamp").

## ⚑ for Francis (collected, not decided)

1. **Fable for this slice** (the overview's ⚑ 8): it sets the read and write rules the later slices lean on.
2. **A split party:** proposed, each group has its own morning window (it closes at that group's first move). The ruling says "the group's first move"; this reads it per group.
3. **The migration** adds state and removes nothing; it still needs your push on the main project, after a backup.

## Estimate

6–9 builder turns (the overview's figure; the builder's read of 2026-11-05 fits it). The Builder confirms it in hours when the slice is claimed.

## Departures

(The builder keeps this current in the same pull request.)
