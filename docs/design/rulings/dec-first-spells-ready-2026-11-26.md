---
status: pending
milestone: December first play (magic in play, the first cut; plan `docs/plans/dec-first-spells-ready.md`, row FS1)
absorbed-into: docs/05-features.md (the Magic tab; Prepare), docs/09-decisions-log.md (2026-11-26), docs/10-open-questions.md (A new caster's first spells). Pending until its six ⚑ are answered, page 46 is approved and row FS1 is built; 04 (`character_play`) and 06 change with the build
supersedes: nothing as a file. fsr-1 amends mp-2 ("chosen is not yet ready", one of mp-1 to mp-5 in `m5c-magic-in-play-2026-11-05.md`) for a character who has not rested yet. That file stands as written
---

# A new caster's first spells are ready at once (2026-11-26)

Francis, 26 November: **"a small fix for magic after character creation any [spellcaster] should be assumed to be rested for their initial spells. I want them to walk into the adventure with spells prepared to cast."**

The driver asked him how. Of the ways put to him he chose the one named **"Pick once, ready"**. The rest of this file's wording is the driver's relay and the designer's; only the words in quotes are his.

Today a newly approved caster has nothing ready. The Magic tab reads "Nothing ready. You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest." In the first cut the only rest is End expedition's, so a new caster would play the whole first expedition with nothing to cast.

Mockup: `docs/design/mockups/december/46-first-spells-ready.html` (frames 46A to 46D; pictures `december/png/46-*`). **Not approved.** Home Two's `impeccable critique` has not run on it. A ruling in words is not an approval of a screen.

## Ruled

| # | Ruling | Frame |
|---|---|---|
| fsr-1 | **Until a new caster's first rest, what they choose in Prepare is ready at once.** No rest is needed. This amends mp-2 for a character who has not rested yet. | 46B, 46C |
| fsr-2 | **The player picks, as on every later day.** The app still never picks a spell (mp-3), at approval or after. | 46A |
| fsr-3 | **After the first rest the ordinary rule holds:** what is chosen becomes ready at the next rest (mp-1 to mp-5 unchanged). | 46D |

## ⚑ For Francis, each with a lean

Not decided here. The numbers match page 46.

| ⚑ | Question | Lean | Why |
|---|---|---|---|
| 1 | Is "not rested yet" tied to **the character** (no rest since it was approved) or to **the campaign's first expedition**? | The character | A replacement who joins in session 6 should walk in prepared too. A class that gets its first spell at a later level gets the same when that spell arrives, if it has never rested as a caster |
| 2 | If **the GM sets a new caster's spells by hand** before play (mp-4), does that close the first spells? | Yes | The GM has said what is ready; the player's later change waits for a rest, as mp-4 has it. Undo of the GM's set opens them again. No screen calls the GM's set by hand today; only the rest does |
| 3 | What does **a caster made again after an archive** get? | A new character gets it. An archived character the GM restores keeps its own state | A new character is a new approval, whoever made it. A restored one comes back as it left: rested stays rested, and what was ready is still ready |
| 4 | Does **the first Cast** close the first spells too? | Yes | Without it a new caster can cast, swap the spent spell for a fresh one in Prepare, and cast again, for the whole first expedition. With it, "ready at once" lasts from approval to the first cast or the first rest, whichever comes first; Undo of that cast opens it again |
| 5 | **Casters already made.** Who gets it? | One with nothing ready gets it; one whose choice is waiting for a rest, with nothing ready, has that choice made ready by the update; one with spells ready counts as rested | These are the casters stuck today. It rewrites stored rows (moves a waiting choice to "ready", removes nothing), so it needs his yes in plain words before the migration is written |
| 6 | **The words** (below) | As drawn | "First spells" is creation's own name for them; "Ready as you choose" echoes "Saved as you go" |

## The words (drawn on page 46; not approved)

| Where | Today, and once the first spells are closed | While they are open |
|---|---|---|
| Magic tab, Prepare's second line | For your next rest | Ready at once |
| Magic tab, "Nothing ready", its line | You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest. | Choose in Prepare. Your first spells are ready at once. |
| Prepare, the first line | For Wren's next rest. Nothing is ready today. | Wren's first spells. What you choose is ready at once, until the first cast or rest. (⚑ 4 answered no: "…, until the first rest.") |
| Prepare, the foot | Saved as you go. 1 slot still empty | Ready as you choose. 1 slot still empty |
| Prepare, "Same as yesterday" | Offered when something is ready | Not offered: there is no yesterday |
| Prepare, − on a spell not chosen | Wren hasn't chosen Thorn dart for the next rest, so there's none to take out. | Wren hasn't chosen Thorn dart, so there's none to take out. |
| The log's line | Sam chose 2 spells for Wren's next rest | Sam chose 2 spells for Wren, ready at once |

## How it was reasoned

- **A, first pass.** Keep "not rested yet" on the character; while it holds, Prepare writes straight to what is ready. Words change in three places. No new part.
- **B, the critic.** (1) Prepare saves at every stepper tap, so "the first choice" cannot be one save: the open state must last across taps. (2) Then it lasts the whole first expedition, and a cast spell can be swapped for a fresh one: free casts. (3) A rest that changes nothing for a caster writes nothing today, so "has rested" would never be recorded for the caster who chose and never cast. (4) Casters already made sit in exactly the stuck state. (5) "Hasn't rested yet" on screen argues with the fiction (she slept at the inn last night).
- **Synthesis.** The open state is "never rested, and nothing cast today" (⚑ 4), kept on the character (⚑ 1); the first rest always writes, changes or not; casters already made are handled once by the update (⚑ 5); the screen says "first spells", never "hasn't rested".

## Not changed

- A slot gained at a level-up after the first rest waits for the next rest, as today (mp-3).
- The morning window (mp-3) is still not built; nothing here builds it.
- Who may choose: the character's owner or the GM, as today. The GM choosing in the player's view (page 32) follows the same rule.
- Prepared spells stay visible to whoever can read the character (ruled 2026-11-05); nothing new is hidden or shown.

## Honest notes

- The driver's brief names mp-1; the line amended is mp-2, in the same block. The 09 line says both.
- ⚑ 1, 2, 4 and 5 change what is stored and when; row FS1 is not handed to a builder until they are answered.
- The words are on screen, so they wait for page 46's approval; the data and logic do not.

Docs to update: `docs/05-features.md` (the Magic tab; Prepare) and `docs/10-open-questions.md` now, in this pull request; `docs/04-data-model.md` (Character play) and `docs/06-screens-and-design.md` (the Code column, if a part's words move) with the build.

09 line: 2026-11-26 — [sheet] A new caster's first spells are ready at once: until a character's first rest, what is chosen in Prepare is ready with no rest; the player picks, the app never does; after that rest the ordinary rule holds (fsr-1 to fsr-3; amends mp-2, of mp-1 to mp-5, for a character who has not rested yet) — Francis: "I want them to walk into the adventure with spells prepared to cast"; he chose "Pick once, ready".
