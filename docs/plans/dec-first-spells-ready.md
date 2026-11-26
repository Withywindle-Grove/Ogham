# Plan dec-first-spells-ready: a new caster's first spells are ready at once

Written by the designer on 2026-11-26. Its ruling: [`../design/rulings/dec-first-spells-ready-2026-11-26.md`](../design/rulings/dec-first-spells-ready-2026-11-26.md) (fsr-1 to fsr-3; Francis, 26 November: "I want them to walk into the adventure with spells prepared to cast"; he chose "Pick once, ready"). Its page: `docs/design/mockups/december/46-first-spells-ready.html`, frames 46A to 46D, **not approved**; Home Two's `impeccable critique` has not run on it.

Paths and lines are `main`'s at `c61f0f4`. Examples are invented. The row follows `REVIEW.md`, the self-review and hard rules 1 to 9. No new command, no new table, no new dependency. **One add-only migration.**

## Not ready for a builder yet

| Waits on | Why |
|---|---|
| ⚑ 1, 2, 4 and 5 of the ruling | Each changes what is stored or when. The row below is written to the leans; an answer the other way changes the lines marked with its ⚑ |
| Page 46's approval | The words are on screen (mockups first). Until then FS1 is built to its data, rules and tests and **stops before the words**: the tab and Prepare keep today's lines |
| Francis's yes to ⚑ 5 in plain words | The update rewrites stored rows (below). It removes nothing |

## The row

| # | What it builds | Rulings | Mockup |
|---|---|---|---|
| FS1 | **Data and logic:** a character's first spells are *open* while it has never rested and has cast nothing today (⚑ 1, ⚑ 4). While open, a choice in Prepare becomes what is ready, at once, and nothing is left waiting; once closed, a choice waits for the next rest as today. The first rest on ✓ always writes the caster and closes them, changes or not; the GM's set by hand closes them too (⚑ 2). Undo of the cast, of the rest or of the GM's set opens them again. **The words:** the five lines and the log's line in the ruling's table; "Same as yesterday" not offered while open | fsr-1 to fsr-3; mp-2 as amended; mp-3 ("the app never picks") and mp-4 unchanged | Data and logic: none: data and logic only. Words: `december/46-first-spells-ready.html`, 46A to 46D, **approval date: none yet** |

One row, one pull request: branch `dec-first-spells-ready` from `main`, into `main`. Title: "FS1: a new caster's first spells are ready at once (page 46)".

## Where "has rested" is kept

| Candidate | Does it answer the question? |
|---|---|
| The log | No. The rest writes a line only for a caster whose spells change (`nightRest.ts:66`), so a caster who rested with nothing chosen and nothing cast leaves no trace; the rest's line and the GM's set by hand are the same command (`character.setSpells`); and a line can be undone. Reading the log to decide where a choice goes would also add a query to every stepper tap |
| `character_play` as it is | No. `prepared` empty does not mean "never rested" once the first choice is saved (Prepare saves at every tap, so the state must outlast one save); the row is made lazily by pins or Set AC, so its existence says nothing |
| `character_rests` | No. That is the one-turn-in-six rest of an expedition, not a night's rest |
| **A new column on `character_play`** | **Yes: `rested_once boolean not null default false`.** One row a character already; read with the same select the Magic tab makes; the log's Undo restores a `character_play` row as it was (the table is in `undoable_tables`), so undoing the rest brings the mark back with the spells. The builder confirms that with a test rather than taking it from this line |

No new table. **A migration is needed, add-only.**

"Open" is never stored. It is worked out: `!restedOnce && nothing in spellsCast` (⚑ 4; answered no, it is `!restedOnce` alone). So Undo of a cast opens the first spells again with no extra write.

## The migration (add-only; test project first)

1. `alter table public.character_play add column rested_once boolean not null default false`, with a comment saying what it means.
2. **Casters already made (⚑ 5; needs Francis's yes in plain words before it is written):** every row with spells ready is marked rested. A row with nothing ready and a choice waiting has that choice moved to ready and the waiting choice cleared. In plain words: *for a character who chose spells and is still waiting for a rest with nothing to cast, the chosen spells become ready now; nobody loses a spell, a choice or a cast.* Rows with nothing ready and nothing chosen stay as they are (open).
3. `create or replace function public.set_spells(...)`, same four arguments, setting `rested_once = true` in both branches of its upsert (⚑ 2: the rest and the GM's set by hand both go through it). Name the migration it builds on in a comment (`20261113140000_dec_8a_magic_state.sql`).

It drops, renames and deletes nothing. No access rule changes: who reads and writes `character_play` is as it was. After it: `npm run db:push:test`, `npm run test:db`, then `npm run db:types`.

**To check before writing step 2:** `character_play` carries the `log_change` trigger. A data fix inside a migration runs with no command; the builder looks at how an earlier migration backfilled a logged table and does the same, and says in the pull request what the log shows for it.

## Files

| File | What changes |
|---|---|
| `supabase/migrations/<new>_dec_first_spells_ready.sql` | The three steps above |
| `src/modules/characters/playState.ts` (`:33-55`, `:105-116`, `:118-121`) | `CharacterPlay.restedOnce`, read from `rested_once` (false when the row is missing); the select gains the column |
| `src/modules/characters/magicState.ts` | A pure `firstSpellsOpen(play)` beside `nextReady` (`:53-55`), the one place the rule is written. `chooseSpells` (`:83-101`): it reads the row first; open and a list given, it writes `prepared` = the list and `chosen` = null; otherwise as today. The slots check is the same in both. `sameAsYesterday` (`:107-124`) is unchanged; the screen does not offer it while open. `afterRest` (`:58-60`) is unchanged |
| `src/modules/characters/nightRest.ts` (`:66`) | `changes` is also true for a caster on ✓ who has not rested once, so the first rest always writes them (one log line, as for any other caster) |
| `src/app/MagicTab.tsx` (`:22`, `:109`, `:116-120`) | **Words, after page 46 is approved:** Prepare's second line and the empty row's line by `firstSpellsOpen` |
| `src/app/PrepareScreen.tsx` (`:47`, `:50`, `:69`, `:290`, `:301`, `:328`) | **Words, after page 46 is approved:** the first line, the foot, the − pop-up's line, no "Same as yesterday" row while open. While open the steppers start from what is ready (they already do: `nextReady`) |
| `src/core/events.ts` (`:1651-1656`) | The log's line for a choice that changed `prepared`: "chose 2 spells for Wren, ready at once" |
| `src/testing/fakeDb.ts` (`:4559`) | The fake `set_spells` marks rested, as the real one |
| `src/gallery/Gallery.tsx` (`:934`) | With the words: a Prepare specimen with the first spells open, and the tab's empty row in that state; their baselines |
| Docs, same pull request | 04 (Character play: the new column); 05 (the Magic tab and Prepare lines lose "not built"); the ruling's header goes `absorbed`; 10 loses the six ⚑ once answered |
| Not changed | `cast_spell`; `character.review` (approval writes nothing: a missing row and a new row both read as open); creation's `FirstSpellsStep.tsx`; the rest prompt's screen; who may choose |

**A race, looked at and left:** the command reads, then writes. A rest or a cast landing between the two is a matter of milliseconds across two devices; the worst case is one choice made ready just after a rest, which is what a morning choice would be. If a test shows worse, the builder moves the decision into a locked database function, as `cast_spell` does.

## Tests

Each test's purpose is written first as a plain sentence.

| Kind | File | What it proves |
|---|---|---|
| Vitest | `magicState.test.ts` | **A caster who has never rested and has cast nothing: a choice becomes what is ready,** and nothing is left chosen for a rest |
| Vitest | same | **The next tap does the same:** a second choice replaces what is ready again (the state outlasts one save) |
| Vitest | same | **After a cast, a choice waits:** it goes to chosen, and what is ready stays (⚑ 4) |
| Vitest | same | **Undo of that cast opens them again:** the next choice is ready at once |
| Vitest | same | **After a rest, a choice waits,** as today |
| Vitest | same | **A list that does not fit the slots is refused** while open, with today's words, and nothing is written |
| Vitest | same | **Clearing a choice while open** changes nothing that is ready |
| Vitest | same | **A character with no row yet reads as open** |
| Vitest | `nightRest.test.ts` | **A caster's first rest on ✓ is written even with nothing chosen and nothing cast;** on ✕ it is not, and they stay open |
| Vitest | `NightRest.test.tsx` or `restFlow.test.tsx` | **After Apply rest the caster is marked rested; Undo of that line from the log brings the first spells back** |
| Vitest | `magicState.test.ts` | **The GM's set by hand closes them** (⚑ 2), and its Undo opens them |
| Vitest | `events.test.ts` | **The log says which it was:** "…, ready at once" for a choice that became ready; today's line for one that waits |
| Vitest, with the words | `MagicTab` and `PrepareSheet.test.tsx`, `PrepareScreen.test.ts` | **A new caster's tab reads "Ready at once"** and the empty row's new line; after a cast or a rest, today's words. **Prepare's first line and foot** in both states; **no "Same as yesterday" while open**, even with spells ready; the − pop-up's line. No middle dot in any of them |
| Database | `supabase/tests/dec-first-spells-ready.test.ts` | **A new row is not rested.** **`set_spells` marks it rested.** **A player still cannot call `set_spells`.** **Another member reads the row as before; an outsider does not** |
| Database | same, once | **The update for casters already made:** three seeded rows (spells ready; nothing ready with a choice waiting; nothing at all) end as marked rested, made ready, and left open |
| Layout, with the words | `tests/layout/gallery.spec.ts` | The two new specimens at 375 px and tablet width, light and dark: nothing under 14 px, every target 44 px, no overflow with the long name |

## Permission cases (`src/testing/permissionCases.ts`)

No new command, so no new row is owed. The open path writes a different column (`prepared`), so two cases pin it:

| Case | Allowed |
|---|---|
| A player chooses their own unrested character's first spells | yes |
| Another player chooses them for that character | no |

The four `chooseSpells` cases (`:726-729`) and the three `setSpells` cases (`:737-739`) stay as they are.

## Estimate

**2 builder turns**, one fresh worker; **about half a turn more** for the words once page 46 is approved, if they land apart. The migration's data fix and its log check are the uncertain part.

## Honest notes

- **Row-level security already lets an owner write any column of their own `character_play` row**, `prepared` included; the commands are the only guard. This plan neither widens nor closes that: a player with a crafted request could mark themselves unrested, as they could already set what is ready. Closing it (a column guard) would be its own row; said here so the reviewer does not find it as news.
- Nothing hidden is touched: the new column is read by whoever reads the character's play row today.
- An answer other than the lean to ⚑ 2 means `set_spells` needs to know who is asking (a fifth argument, so a new function and the old one dropped): about half a turn more, and a line for the function-lineage reading in the pull request.
- Offline: a choice made offline is decided when it is sent, not when it was tapped. The screen's words follow the last read.
- Not checked by the designer: how the log's Undo treats a column added after a line was written (an old line's picture of the row has no `rested_once`). The builder tests an Undo of a line from before the migration.
