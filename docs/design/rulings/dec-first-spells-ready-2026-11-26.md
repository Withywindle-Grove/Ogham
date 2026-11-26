---
status: pending
milestone: December first play (magic in play, the first cut; plan `docs/plans/dec-first-spells-ready.md`, row FS1)
absorbed-into: docs/05-features.md (the Magic tab; Cast; Prepare), docs/09-decisions-log.md (2026-11-26), docs/10-open-questions.md (its block is gone: nothing is open). Pending until row FS1 is built and its migration is on the main database; 04 (`character_play`) and 06 change with the build
supersedes: nothing as a file. fsr-1 amends mp-2 ("chosen is not yet ready", one of mp-1 to mp-5 in `m5c-magic-in-play-2026-11-05.md`) for a character who has not rested yet. That file stands as written
---

# A new caster's first spells are ready at once (2026-11-26)

Francis, 26 November: **"a small fix for magic after character creation any [spellcaster] should be assumed to be rested for their initial spells. I want them to walk into the adventure with spells prepared to cast."**

The driver asked him how. Of the ways put to him he chose the one named **"Pick once, ready"**. The rest of this file's wording is the driver's relay and the designer's; only the words in quotes are his.

Today a newly approved caster has nothing ready. The Magic tab reads "Nothing ready. You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest." In the first cut the only rest is End expedition's, so a new caster would play the whole first expedition with nothing to cast.

Mockup: `docs/design/mockups/december/46-first-spells-ready.html` (frames 46A to 46D; pictures `december/png/46-*`). **Approved under overnight authority (fsr-11, below), not by Francis's own word.** 46A, 46B and 46C were redrawn on 26 November to Home Two's critique; 46D is as first drawn.

## Ruled by Francis

| # | Ruling | Frame |
|---|---|---|
| fsr-1 | **Until a new caster's first rest, what they choose in Prepare is ready at once.** No rest is needed. This amends mp-2 for a character who has not rested yet. | 46B, 46C |
| fsr-2 | **The player picks, as on every later day.** The app still never picks a spell (mp-3), at approval or after. | 46A |
| fsr-3 | **After the first rest the ordinary rule holds:** what is chosen becomes ready at the next rest (mp-1 to mp-5 unchanged). | 46D |

## Approved under overnight authority (26 November)

Francis gave the driver overnight authority on 26 November, until 07:00 ET: **"pre approved like last night"**. Under it a screen is approved on the driver's recommendation after Home Two's review. Home Two ran `impeccable critique` on page 46 as first drawn and scored it **32 of 40** (its comment is on pull request #105).

**Each line below is approved under overnight authority (Francis 26 Nov), on the driver's recommendation after Home Two's critique. None is his own word.** "⚑" is the number the question had on page 46; "Finding" is Home Two's.

| # | What is approved | From | Frame |
|---|---|---|---|
| fsr-4 | **"Not rested yet" belongs to the character:** from its approval to its own first rest. A replacement who joins in session 6 walks in prepared too. A class that gets its first spell at a later level gets the same when that spell arrives, if it has never rested as a caster | ⚑ 1, the lean | 46A |
| fsr-5 | **The GM setting a new caster's spells by hand before play closes the first spells.** The GM has said what is ready; the player's later change waits for a rest, as mp-4 has it. Undo of the GM's set opens them again. (No screen calls the GM's set by hand today; only the rest does) | ⚑ 2, the lean | none |
| fsr-6 | **A new character gets the first spells, whoever made it and whatever came before; an archived character the GM restores keeps its own state** (rested stays rested, and what was ready is still ready) | ⚑ 3, the lean | none |
| fsr-7 | **The first Cast closes the first spells too, and Undo of that cast opens them again.** "Ready at once" lasts from approval to the first cast or the first rest, whichever comes first. Without it a spent spell could be swapped for a fresh one in Prepare all through the first expedition | ⚑ 4, the lean | 46C |
| fsr-8 | **The cast that closes them says so, once.** Its toast gains one sentence: "Mire lamp cast. From now, what you choose is ready after you rest.", with Undo. Every other cast keeps today's "Mire lamp cast". The sentence is 10 words; with a two-word spell the toast is 13 | Finding 1 | 46C |
| fsr-9 | **An empty slot is said before the cast, not found after it.** While the first spells are open and a slot a choice could fill is empty, Prepare's foot reads "Ready as you choose. 1 slot still empty: fill it before you cast." and the tab's Prepare row reads "Ready at once. 1 slot empty" (2: "fill them", "2 slots empty"). A level with nothing to choose and an empty book are not counted, as the built foot counts | Finding 3 | 46A, 46B, 46C |
| fsr-10 | **The words** in the table below. The empty row: "Choose in Prepare. What you choose is ready at once." Prepare's first line, the condition first: "Until your first cast or rest, what you choose is ready at once." **"your" in every line this page writes, never the character's name.** "Ready at once" and "Ready as you choose" are kept | ⚑ 6; findings 2, 4 and 5 | 46A, 46B |
| fsr-11 | **Page 46 is approved as redrawn:** frames 46A, 46B and 46C in their pictures of 26 November (light and dark), and 46D as first drawn | The whole critique | 46A to 46D |
| fsr-12 | **Overtaken the same day by fsr-13.** As approved in the night: row FS1 is for new casters only, and a caster already made is left exactly as it is until ⚑ 5 is answered; FS1's migration changes no stored row and makes none | The driver's split of the plan | none |

Finding 6 (cast, Undo, cast again follows the casts as they stand) is a test in the plan, not a drawing.

## Ruled by Francis: casters already made (⚑ 5)

Francis, 26 November, asked about the one-off update in plain words: **"Yes, run it"**. This one is his own word, relayed by the driver; it is not under the overnight authority.

| # | Ruling | Frame |
|---|---|---|
| fsr-13 | **Casters already made get the first spells too, by a one-off update.** One with nothing ready gets the open first spells. One whose choice is waiting for a rest, with nothing ready, has that choice made ready. One with spells ready counts as rested and is left as it is. **The update rewrites stored rows and deletes nothing, and the log keeps the change.** It overtakes fsr-12: the plan is one row again, FS1 | none: data only |

**Where it runs:** on the test database first; on the main database only after Home Two's dry run, and **the push to main still needs his "push" when its time comes**. His "Yes, run it" is the yes to the update, not to that push.

**Until FS1 is built and its migration is on the main database, the casters already in the campaign still start with nothing ready.** For 5 December that is likely every character there is.

Nothing is open: page 46's six ⚑ are all answered.

## The words (fsr-10; drawn on page 46)

| Where | Today, and once the first spells are closed | While they are open |
|---|---|---|
| Magic tab, Prepare's second line | For your next rest | Ready at once. With a slot a choice could fill still empty: "Ready at once. 1 slot empty" ("2 slots empty") |
| Magic tab, "Nothing ready", its line | You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest. | Choose in Prepare. What you choose is ready at once. |
| Prepare, the first line | For Wren's next rest. Nothing is ready today. | Until your first cast or rest, what you choose is ready at once. |
| Prepare, the foot | Saved as you go. 1 slot still empty | Ready as you choose. 1 slot still empty: fill it before you cast. ("2 slots still empty: fill them before you cast."; none empty: "Ready as you choose") |
| Prepare, "Same as yesterday" | Offered when something is ready | Not offered: there is no yesterday |
| The cast's toast | Mire lamp cast (Undo) | On the cast that closes them: "Mire lamp cast. From now, what you choose is ready after you rest." (Undo) |
| Prepare, − on a spell not chosen | Wren hasn't chosen Thorn dart for the next rest, so there's none to take out. | Wren hasn't chosen Thorn dart, so there's none to take out. |
| The log's line | Sam chose 2 spells for Wren's next rest | Sam chose 2 spells for Wren, ready at once |

What the first drawing said, for the record: the empty row "Choose in Prepare. Your first spells are ready at once."; Prepare's first line "Wren's first spells. What you choose is ready at once, until the first cast or rest."; the foot "Ready as you choose. 1 slot still empty".

## How it was reasoned

- **A, first pass.** Keep "not rested yet" on the character; while it holds, Prepare writes straight to what is ready. Words change in three places. No new part.
- **B, the critic.** (1) Prepare saves at every stepper tap, so "the first choice" cannot be one save: the open state must last across taps. (2) Then it lasts the whole first expedition, and a cast spell can be swapped for a fresh one: free casts. (3) A rest that changes nothing for a caster writes nothing today, so "has rested" would never be recorded for the caster who chose and never cast. (4) Casters already made sit in exactly the stuck state. (5) "Hasn't rested yet" on screen argues with the fiction (she slept at the inn last night).
- **Synthesis.** The open state lasts until the first cast or the first rest (fsr-7), kept on the character (fsr-4); the first rest always writes, changes or not; casters already made are handled once by an update (⚑ 5); the screen never says "hasn't rested".

**The split (fsr-12), reasoned the same way.**

- **A.** Leave the update out of FS1's migration and build the rest as planned: a mark "has rested once", false for everyone.
- **B.** Then every caster already made reads as "not rested" and gets the first spells at once, with no row rewritten: FS1 would answer ⚑ 5 by itself, and more widely than its lean. Marking the casters already made as rested instead would write a row for each of them, into a table whose every write is logged.
- **Synthesis.** Turn the mark round. The character carries **"first spells open"**, false unless set; it is set when a character becomes approved, and cleared by the first rest or the GM's set by hand. A character already made has no mark, so it reads as closed, as today, and FS1's migration writes nothing. FS1b is then one update that sets the mark for whoever ⚑ 5 names. Every doubtful case (no row, a failed write, an Undo) falls back to today's behaviour. The cost is a write at approval, in the plan.

**After fsr-13, the mark goes back to "has rested once".** With his yes there is nobody to hold closed. A mark that reads "open" would need a row made for every caster who has none, and a write at every approval; a mark that reads "rested" lets a character with no row be open with nothing written, and asks nothing of approval. The update then touches only the rows with nothing ready. The plan is one row again, about a turn smaller than the two.

## Not changed

- A slot gained at a level-up after the first rest waits for the next rest, as today (mp-3).
- The morning window (mp-3) is still not built; nothing here builds it.
- Who may choose: the character's owner or the GM, as today. The GM choosing in the player's view (page 32) follows the same rule and reads the same words.
- Prepared spells stay visible to whoever can read the character (ruled 2026-11-05); nothing new is hidden or shown.
- The built words of the closed state, which name the character ("For Wren's next rest", "Wren hasn't chosen Thorn dart…", "Wren has 2 a day at level 1…").

## Honest notes

- **Nothing in fsr-4 to fsr-12 is Francis's own word;** fsr-13 is. He can reverse any of the first; fsr-7 to fsr-10 are words and one toast, cheap to change before FS1 is built.
- **"Yes, run it" reached the designer by the driver's relay**, as his other words in this file did.
- **A character who is not a caster and has a play row with nothing ready is marked "not rested" by the update too:** the database cannot tell a caster (the class is in the pack). Nothing shows for them; if they gain a first spell later, it is ready at once, as fsr-4 has it.
- **The redrawn frames have not been through a second critique.** Home Two saw the first drawing, in light. The toast in 46C is new since then.
- **"your" against the built pop-ups.** The − pop-up keeps the built line less one clause, and so still names the character, as the full level's pop-up beside it does in both states. Changing those to "you" would change approved, built words; it is left for Francis to see.
- **A long spell name takes the toast past 20 words** (24 with the page's longest, four lines on a phone, in 5 seconds). The 20 words of tr-19 are for error toasts; the added sentence is 10. Drawn in 46C, the third phone.
- **A new caster whose spells the GM sets to nothing** (fsr-5) reads today's empty row, "You haven't chosen since your last rest", before any rest. Rare, and no screen reaches it today.
- The driver's first brief names mp-1; the line amended is mp-2, in the same block. The 09 line says both.
- The toast's dress in 46C is page 43's (tr-1 to tr-18), approved and not built yet; the words do not wait for it.

Docs to update: `docs/05-features.md` (the Magic tab; Cast; Prepare), `docs/09-decisions-log.md` and `docs/10-open-questions.md` now, in this pull request; `docs/04-data-model.md` (Character play) and `docs/06-screens-and-design.md` (the Code column, if a part's words move) with the build.

09 lines:

- 2026-11-26 — [sheet] A new caster's first spells are ready at once: until a character's first rest, what is chosen in Prepare is ready with no rest; the player picks, the app never does; after that rest the ordinary rule holds (fsr-1 to fsr-3; amends mp-2, of mp-1 to mp-5, for a character who has not rested yet) — Francis: "I want them to walk into the adventure with spells prepared to cast"; he chose "Pick once, ready".
- 2026-11-26 — [sheet] The first spells belong to the character, from approval to its own first rest; the GM's set by hand closes them; a new character gets them and a restored one keeps its state; the first Cast closes them and its Undo opens them again (fsr-4 to fsr-7) — approved under overnight authority (Francis 26 Nov), on the driver's recommendation after Home Two's critique.
- 2026-11-26 — [words] The first spells' words: the cast that closes them says "From now, what you choose is ready after you rest." in its toast; an empty slot is said before the cast, in Prepare's foot and on the tab's row; "your", never the character's name (fsr-8 to fsr-10) — approved under overnight authority, as above.
- 2026-11-26 — [ui] Page 46 approved as redrawn (fsr-11) — approved under overnight authority, as above.
- 2026-11-26 — [data] FS1 is for new casters only and changes no stored row; casters already made wait for ⚑ 5 (fsr-12; overtaken the same day by fsr-13) — the driver's split.
- 2026-11-26 — [data] Casters already made get the first spells by a one-off update: nothing ready, the open first spells; a choice waiting for a rest, made ready; spells ready, counts as rested. It rewrites stored rows and deletes nothing, and the log keeps the change; test first, main after Home Two's dry run and on his "push" (fsr-13) — Francis: "Yes, run it".
