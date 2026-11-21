# Plan: M5c slice 3 — Cast

Written by the design agent, 2026-11-09 (night). **Its mockup, `design/mockups/magic/05-cast.html`, was approved on 2026-11-10 with mm-3 (`design/rulings/m5c-magic-mockups-2026-11-10.md`). The plan is still a draft: nothing is built before the M5b gate passes and Francis says go.** It makes no rulings. Overview: `docs/plans/magic-in-play.md` (slice 3). Comes after slices 1 and 2.

## What it delivers

One tap casts, with Undo. What the spell brings starts by itself: a light, a condition, a timer. **A spell's target stays narrative (mp-6): Cast never asks who or where.** A small sheet opens only for a choice the app records. A reminder in words follows a cast that needs a roll. (The "spell lost" reminder is no longer in this slice: mm-3 moved it to M6.)

## Rests on

| Read | For |
|---|---|
| Mockup `design/mockups/magic/05-cast.html` (and 04 for the plain one-tap cast) | the screens, once approved |
| 05 Spells: Cast; Spell lost | the behaviour |
| `design/rulings/m5c-magic-in-play-2026-11-05.md` mp-6 … mp-9 | no target sheet; the reminder; timers and Undo; "spell lost" as a toast |
| `design/rulings/sheet-spells-rulings.md` X-3 | timed effects |
| 07 `spellcasting.reverseAt`, `combat.spellDisruption`; a spell's duration, light and conditions | what the pack says |
| 06 Toasts with Undo; Undo over confirm | the toast and its 8 seconds |

## Build order

1. **What a cast starts.** From the spell's own data: a light (shown as the caster's; the GM can move it), a condition on the caster, and **a quiet timer on the track for every spell with a duration**, even when the app tracks nothing else about it (mp-8). A duration given as dice shows "? turns" with **Set** on the GM's screen until the roll is entered; the player is never blocked.
2. **Undo.** The toast's Undo and the log's Undo reverse the cast and everything it started, by the player or the GM, under the log's usual rules.
3. **The cast sheet, for two choices only.** The form, for a class whose `reverseAt` is at casting (the usual form starts picked). The number a conjuring spell brings (a stepper; the dice named in words). The creature itself is slice 10: until then the count is recorded and shown in the log line. Any other spell casts in one tap.
4. **The reminder** (mp-7). After a cast that calls for a roll or a target the toast carries "Roll it at the table and name your target". The player enters nothing; the GM confirms nothing. See ⚑ 1 for how the app knows.
5. ~~Spell lost~~ **Moved to M6 (mm-3, 2026-11-10):** the reminder shows only in a fight, when the caster has not yet acted in the round's initiative order, and where the pack's rule allows it, so it needs the fight's turn order (`plans/m6-fights.md`). This slice builds nothing for it.
6. **Blocked casting.** Gear or a status that stops casting leaves Cast tappable and explains why.
7. **Gallery and layout scenes** for the cast sheet (both choices) and the two toasts (the plain cast, the reminder to roll).

## Tests (each purpose as a plain sentence first)

- Casting a spell with a light adds the light as the caster's and a timer for its duration; Undo removes both and makes the spell ready again.
- Casting a spell with a duration and nothing else the app tracks still puts a timer on the track.
- A spell with a dice duration shows "? turns" to the GM until it is set, and the player's cast is not held up.
- A class that picks the form at casting gets the sheet, with the usual form picked; a class that picks when memorising doesn't.
- No cast, in either setting's fixture, asks for a target.
- Outside a fight, a caster who loses hit points gets no "spell lost" reminder (mm-3; the reminder itself is M6's).
- A caster in gear that stops casting can tap Cast and is told why; nothing is cast.
- A player can cast only their own character's spells; the GM can cast for anyone; each cast writes one event.

## ⚑ for Francis (collected, not decided)

1. **How the app knows a cast "calls for a roll or a target".** No pack field says so today. **A (proposed):** the reminder shows unless the spell's range is the caster alone and it has no save and no dice in its effect; the pack can force it on or off per spell. **B:** the Pack Creator marks each spell. A is less pack work and may remind once too often; B is exact and touches every spell in three packs.
2. ~~A lost spell that wrongly started something~~ Goes with "spell lost" to M6 (mm-3); still ended by hand, for now (mp-9).
3. **mp-22** ("No effect" on the toast) stays parked for the table test; this slice doesn't build it.

## Estimate

7–10 builder turns, less about 1 for "spell lost" now in M6 (the overview's figure; it carries the most unknowns of the first four slices). The Builder confirms it in hours when the slice is claimed.

## Departures

(The builder keeps this current in the same pull request.)
