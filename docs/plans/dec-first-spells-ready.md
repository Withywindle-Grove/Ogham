# Plan dec-first-spells-ready: a new caster's first spells are ready at once

Written by the designer on 2026-11-26. Its ruling: [`../design/rulings/dec-first-spells-ready-2026-11-26.md`](../design/rulings/dec-first-spells-ready-2026-11-26.md).

| Rulings | Whose word |
|---|---|
| fsr-1 to fsr-3 | Francis, 26 November: "I want them to walk into the adventure with spells prepared to cast"; he chose "Pick once, ready" |
| fsr-4 to fsr-11 | Approved under overnight authority (Francis 26 Nov), on the driver's recommendation after Home Two's critique. Not his own word |
| fsr-13 | Francis, 26 November, on the update for casters already made: "Yes, run it" |

Its page: `docs/design/mockups/december/46-first-spells-ready.html`, frames 46A to 46D. **Approved 2026-11-26 under overnight authority (fsr-11)**, after Home Two's `impeccable critique` (32 of 40); 46A to 46C redrawn to its findings.

Paths and lines are `main`'s at `c6cfbd7` (the code files named are as they were at `c61f0f4`). Examples are invented. The row follows `REVIEW.md`, the self-review and hard rules 1 to 9. No new command, no new table, no new dependency. **One migration: it adds a column and rewrites stored rows once; it deletes nothing.**

**One row again.** In the night the plan was split in two (FS1 for new casters, FS1b held for ⚑ 5: fsr-12). Francis answered ⚑ 5 the same day, so the update is back inside FS1: one migration, one pull request, about a turn less than the two rows.

## The row

| # | What it builds | Rulings | Mockup | Ready for a builder |
|---|---|---|---|---|
| FS1 | **Data and logic:** a character's first spells are *open* while it has never rested and has cast nothing today. While open, a choice in Prepare becomes what is ready, at once, and nothing is left waiting; once closed, a choice waits for the next rest as today. The first rest on ✓ always writes the caster and closes them, changes or not; the GM's set by hand closes them too. Undo of the cast, of the rest or of the GM's set opens them again. **Casters already made** get them by a one-off update in the migration (fsr-13). **The words:** the lines, the toast's sentence and the log's line in the table below; "Same as yesterday" not offered while open | fsr-1 to fsr-11, fsr-13; mp-2 as amended; mp-3 ("the app never picks") and mp-4 unchanged | Data and logic: none: data and logic only. Words: `december/46-first-spells-ready.html`, 46A to 46D, **approved 2026-11-26** (overnight authority, fsr-11) | **Yes**, once this plan is on `main` |

One pull request: branch `dec-first-spells-ready` from `main`, into `main`. Title: "FS1: a new caster's first spells are ready at once (page 46)".

## Where the migration runs, and whose yes each step has

| Step | Whose yes |
|---|---|
| Written, and pushed to the **test** database (`npm run db:push:test`, `npm run test:db`) | Francis: "Yes, run it" (fsr-13) |
| **Home Two's dry run** on main: a read-only count of the rows of each kind the update would change (the query is in the pull request's text) | No write: none needed |
| A backup of main (`npm run db:backup`), then the push to the **main** database | **Still needs his "push" when its time comes.** "Yes, run it" is not that yes |

**Until the migration is on main, the casters already in the campaign still start with nothing ready.** For 5 December that is likely every existing character.

## Where "has rested" is kept

| Candidate | Does it answer the question? |
|---|---|
| The log | No. The rest writes a line only for a caster whose spells change (`nightRest.ts:66`), so a caster who rested with nothing chosen and nothing cast leaves no trace; the rest's line and the GM's set by hand are the same command (`character.setSpells`); and a line can be undone. Reading the log to decide where a choice goes would also add a query to every stepper tap |
| `character_play` as it is | No. `prepared` empty does not mean "never rested" once the first choice is saved (Prepare saves at every tap, so the state must outlast one save); the row is made lazily by pins or Set AC, so its existence says nothing |
| `character_rests` | No. That is the one-turn-in-six rest of an expedition, not a night's rest |
| A mark that reads "first spells open", set at approval (the night's split) | Not needed now. It kept the casters already made closed; with fsr-13 nobody is held closed, and it would cost a write at every approval and a row made for every caster who has none |
| **A new column on `character_play`** | **Yes: `rested_once boolean`.** One row a character already; read with the same select the Magic tab makes; a character with no row reads as not rested, so nothing is written for them. The log's Undo restores a `character_play` row's changed values (the table is in `undoable_tables`), so undoing the rest brings the mark back with the spells. The builder confirms that with a test rather than taking it from this line |

"Open" is never stored. It is worked out: `!restedOnce && nothing in spellsCast`. So a cast closes the first spells and its Undo opens them again with no extra write (fsr-7), and cast, Undo, cast again follows the casts as they stand (Home Two's finding 6).

## The migration (test project first)

1. **The column.** `alter table public.character_play add column rested_once boolean not null default true`, then `alter column rested_once set default false`, with a comment saying what it means. Every row already there reads "rested" without being rewritten, and nothing is logged for it: **a caster with spells ready counts as rested** (fsr-13) with no write at all. A row made from now on starts not rested.
2. **The one-off update (fsr-13).** For every row already there with **nothing ready**, outside a retired campaign: `rested_once = false` and `spells_cast = '{}'`; and where a choice with a spell in it is waiting, `prepared` = that choice and `chosen = null`. In plain words: *a character with nothing to cast gets the open first spells; one who chose spells and is still waiting for a rest has those spells ready now; nobody loses a spell, a choice or a cast.* A row with spells ready is not touched. A character with no row needs nothing: it reads as open.
3. `create or replace function public.set_spells(...)`, same four arguments, setting `rested_once = true` in both branches of its upsert (the rest and the GM's set by hand both go through it: fsr-5). Name the migration it builds on in a comment (`20261113140000_dec_8a_magic_state.sql`).

It drops, renames and deletes nothing. No access rule changes: who reads and writes `character_play` is as it was. After it: `npm run db:push:test`, `npm run test:db`, then `npm run db:types`.

**To check while writing step 2:**

- **The log keeps the change** (fsr-13). `character_play` carries the `log_change` trigger, and a data fix inside a migration runs with no command. The builder looks at how an earlier migration backfilled a logged table, then says in the pull request how the update's lines read in the log, and to whom. A line that reads badly to a player is shown to Francis before the push to main; it is not hidden by switching the log off.
- **A retired campaign is read-only:** the table's guard (`refuse_when_retired`) refuses any write there, so the update leaves its rows alone, or the migration fails.
- **It runs once.** Run again later it would reopen a caster who has rested and has nothing ready. It lives in the migration only.
- **The database cannot tell a caster** (the class is in the pack), so a play row with nothing ready is marked not rested whoever it belongs to. Nothing shows for a character with no spells.

## Files

| File | What changes |
|---|---|
| `supabase/migrations/<new>_dec_first_spells_ready.sql` | The three steps above |
| `src/modules/characters/playState.ts` (`:33-55`, `:105-116`, `:118-121`) | `CharacterPlay.restedOnce`, read from `rested_once` (false when the row is missing); the select gains the column |
| `src/modules/characters/magicState.ts` | A pure `firstSpellsOpen(play)` beside `nextReady` (`:53-55`), the one place the rule is written. `chooseSpells` (`:83-101`): it reads the row first; open and a list given, it writes `prepared` = the list and `chosen` = null; otherwise as today. The slots check is the same in both. `sameAsYesterday` (`:107-124`) is unchanged; the screen does not offer it while open. `afterRest` (`:58-60`) is unchanged |
| `src/modules/characters/nightRest.ts` (`:66`) | `changes` is also true for a caster on ✓ who has not rested once, so the first rest always writes them (one log line, as for any other caster) |
| `src/app/PrepareScreen.tsx` (`:47`, `:50`, `:69`, `:290`, `:301`, `:328`) | The first line and the foot by `firstSpellsOpen` (new pure `openLine`, `openFootLine(empty)` beside `forLine` and `footLine`); the − pop-up's line without "for the next rest"; no "Same as yesterday" row while open. **The count of empty slots a choice could fill moves to one exported function** (today it is worked out inline at `:328`), so the tab's row and the foot cannot differ. While open the steppers start from what is ready (they already do: `nextReady`) |
| `src/app/MagicTab.tsx` (`:22`, `:88`, `:109`, `:116-120`) | Prepare's second line ("Ready at once", "Ready at once. 1 slot empty") and the empty row's line by `firstSpellsOpen`; **the toast** (`:88`): when the first spells were open before a cast that succeeded, its text is `` `${name} cast. From now, what you choose is ready after you rest.` ``, with the same Undo |
| `src/core/events.ts` (`:1651-1656`) | The log's line for a choice that changed `prepared`: "chose 2 spells for Wren, ready at once" |
| `src/testing/fakeDb.ts` (`:4559`) | The fake `set_spells` marks rested, as the real one |
| `src/gallery/Gallery.tsx` (`:934`) | A Prepare specimen with the first spells open and a slot empty; the tab's empty row in that state; their baselines |
| Docs, same pull request | 04 (Character play: the new column); 05 (the Magic tab, Cast and Prepare lines lose "not built"); 06 (the Code column, if a part's words move); the ruling's header goes `absorbed` once the migration is on main |
| Not changed | `cast_spell`; `character.review` (approval writes nothing: a missing row and a new row both read as open); creation's `FirstSpellsStep.tsx`; the rest prompt's screen; who may choose; the built words of the closed state |

**A race, looked at and left:** the command reads, then writes. A rest or a cast landing between the two is a matter of milliseconds across two devices; the worst case is one choice made ready just after a rest, which is what a morning choice would be. If a test shows worse, the builder moves the decision into a locked database function, as `cast_spell` does.

## The words (page 46, fsr-8 to fsr-10)

| Where | While the first spells are open |
|---|---|
| Magic tab, Prepare's second line | Ready at once. A slot a choice could fill still empty: "Ready at once. 1 slot empty", "Ready at once. 2 slots empty" |
| Magic tab, "Nothing ready", its line | Choose in Prepare. What you choose is ready at once. |
| Prepare, the first line | Until your first cast or rest, what you choose is ready at once. |
| Prepare, the foot | "Ready as you choose. 1 slot still empty: fill it before you cast." · "Ready as you choose. 2 slots still empty: fill them before you cast." · none empty: "Ready as you choose" |
| Prepare, − on a spell not chosen | Wren hasn't chosen Thorn dart, so there's none to take out. |
| The cast's toast, on the cast that closes them | Mire lamp cast. From now, what you choose is ready after you rest. |
| The log's line | Sam chose 2 spells for Wren, ready at once |

Once closed, every line is today's. The new lines say "your" and never name the character; the two pop-ups keep their built form.

## Tests

Each test's purpose is written first as a plain sentence.

| Kind | File | What it proves |
|---|---|---|
| Vitest | `magicState.test.ts` | **A caster who has never rested and has cast nothing: a choice becomes what is ready,** and nothing is left chosen for a rest |
| Vitest | same | **The next tap does the same:** a second choice replaces what is ready again (the state outlasts one save) |
| Vitest | same | **After a cast, a choice waits:** it goes to chosen, and what is ready stays (fsr-7) |
| Vitest | same | **Undo of that cast opens them again:** the next choice is ready at once |
| Vitest | same | **Cast, Undo, cast again:** open, closed, open, closed, following the casts as they stand (finding 6) |
| Vitest | same | **After a rest, a choice waits,** as today |
| Vitest | same | **A list that does not fit the slots is refused** while open, with today's words, and nothing is written |
| Vitest | same | **Clearing a choice while open** changes nothing that is ready |
| Vitest | same | **A character with no row yet reads as open** |
| Vitest | `nightRest.test.ts` | **A caster's first rest on ✓ is written even with nothing chosen and nothing cast;** on ✕ it is not, and they stay open |
| Vitest | `NightRest.test.tsx` or `restFlow.test.tsx` | **After Apply rest the caster is marked rested; Undo of that line from the log brings the first spells back** |
| Vitest | `magicState.test.ts` | **The GM's set by hand closes them** (fsr-5), and its Undo opens them |
| Vitest | `events.test.ts` | **The log says which it was:** "…, ready at once" for a choice that became ready; today's line for one that waits |
| Vitest | `MagicTab` | **A new caster's tab reads "Ready at once. 2 slots empty"** and the empty row's line; with one of two chosen, "Ready at once. 1 slot empty"; with none empty, "Ready at once"; after a cast or a rest, today's words |
| Vitest | same | **The cast that closes the first spells says so in its toast, and only that cast:** the second cast's toast is today's; after Undo, the next cast says it again; a caster already closed never sees it |
| Vitest | `PrepareSheet.test.tsx`, `PrepareScreen.test.ts` | **Prepare's first line and foot** in both states, the foot with 0, 1 and 2 empty; a level with nothing to choose and an empty book are not counted, on the tab as in the foot; **no "Same as yesterday" while open**, even with spells ready; the − pop-up's line. No middle dot in any of them, and no character's name in the new lines |
| Database | `supabase/tests/dec-first-spells-ready.test.ts` | **A new row is not rested.** **`set_spells` marks it rested.** **A player still cannot call `set_spells`.** **Another member reads the row as before; an outsider does not** |
| Database, once | The test project, before and after the push; shown in the pull request's text | **The update for casters already made:** seeded rows of four kinds (spells ready; nothing ready with a choice waiting; nothing at all; nothing ready in a retired campaign) end as left alone and rested; made ready, the choice cleared, not rested; not rested; left alone. **The log holds a line for each row it changed** |
| Layout | `tests/layout/gallery.spec.ts` | The two new specimens at 375 px and tablet width, light and dark: nothing under 14 px, every target 44 px, no overflow with the long spell |

## Permission cases (`src/testing/permissionCases.ts`)

No new command, so no new row is owed. The open path writes a different column (`prepared`), so two cases pin it:

| Case | Allowed |
|---|---|
| A player chooses their own unrested character's first spells | yes |
| Another player chooses them for that character | no |

The four `chooseSpells` cases (`:726-729`) and the three `setSpells` cases (`:737-739`) stay as they are.

## Estimate

**About 3 builder turns**, one fresh worker (the first draft said 2, and half a turn for the words; the night's two rows came to about 4).

| Turn | What |
|---|---|
| 1 | The migration with its update, pushed to the test project; the database tests; the seeded rows shown |
| 2 | The logic and its tests |
| 3 | The words, the toast, the slot count shared by the tab and the foot, the two specimens and their pictures |

Half a turn more if the update's log lines need work: that is the uncertain part. Home Two's dry run and the push to main are not builder turns.

## Honest notes

- **Nothing reaches the players already in the campaign until the migration is on main,** and that push waits for the dry run and Francis's "push".
- **The update rewrites stored rows on the main database.** It deletes nothing and the log keeps each change, but it is not undone by rolling the code back: the backup before the push is the way back.
- **Row-level security already lets an owner write any column of their own `character_play` row**, `prepared` included; the commands are the only guard. This plan neither widens nor closes that: a player with a crafted request could mark themselves unrested, as they could already set what is ready. Closing it (a column guard) would be its own row; said here so the reviewer does not find it as news.
- Nothing hidden is touched: the new column is read by whoever reads the character's play row today.
- **A long spell name takes the first cast's toast past 20 words** (page 46, 46C, the third phone). Not shortened here.
- The toast's new dress (plan `dec-17-toast-restyle.md`) is separate: FS1 changes the words only, in whichever dress is built.
- Offline: a choice made offline is decided when it is sent, not when it was tapped. The screen's words follow the last read.
- Not checked by the designer: how the log's Undo treats a column added after a line was written (an old line's picture of the row has no `rested_once`), and what Undo of one of the update's own lines does. The builder tests an Undo of a line from before the migration.
