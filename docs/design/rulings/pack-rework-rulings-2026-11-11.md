---
status: pending
milestone: December first play, step 6 (`docs/plans/december-first-play.md`); the Pack tab rework
absorbed-into: pending, with the build plan for step 6 and its pull requests (05 inventory, the party stash, giving; 06 the Pack tab's parts); docs/09-decisions-log.md (2026-11-11)
supersedes: nothing yet; the pieces of 05 and 06 it changes are named per ruling when absorbed
---

# Rulings on the Pack tab rework (2026-11-11)

Francis's answers, one at a time, on the Design Studio's Pack mockups (`docs/design/mockups/pack/01` … `04`, draft pull request #632; pictures in `docs/design/mockups/pack/png/`). The proposal and its open questions: `docs/design/notes/pack-rework-proposal-2026-11-11.md`. Nothing here is built.

## Handing out what the party finds

| Id | Ruling | Francis |
|---|---|---|
| pk-1 | A find is treasure found at a place. On the Scene, at a place, the GM has that place's treasure in front of them on the place panel. Tapping a treasure, as a whole or one thing in it, opens a pop-up sheet with two ways to send it: **to a character** (the sheet then asks which), or **to the party stash**. | "By a find do you mean treasure found in a location? DM should have that information readily available in the Scene screen when at a location, and should click the treasure/item either as a whole or individually with the option send to character (then prompts character) or send to party stash? This should be in pop-up sheets." |

| pk-2 | A find sent to a character, and a thing taken from the party stash, lands loose in what the character carries; the player puts it away in a container when they like. The app no longer asks where it goes each time. | "A. It lands loose in what the character carries, and the player puts it away in a container when they like." |

| pk-3 | Every row of the party stash ends in **Take**: a single thing is taken at once with Undo and a line saying what it did to the taker's load; a stack asks how many. Replaces the four steps through the item's sheet and Give to…. | "a" |

| pk-4 | The party stash is a screen of its own for players, opened from the Pack tab: a title, three facts (what is in it, the last thing in, the last thing out, each with who and when), the lists as 05 rules them, every row saying who put the thing in and when; beside the lists, the taker's room and the stash's recent lines. Replaces the fold at the foot of each player's Pack. | "a" |

| pk-5 | A find is announced to the player: a card wherever they are, a count on the Pack's icon, and the Pack tab's New fact and a tag on the row until Got it. A thing sent to the party stash is announced to all, more quietly. Several finds at once merge into one card. | "a" |

| pk-6 | **A first-cut purse is built for December.** Each character has coin by denomination, as the setting names them (integers), read only by its owner and the GM (and by the others while the character is Down or dead, as ruled 2026-10-29). The GM gives and takes coin; a player spends it and gives it to another character or to the party stash, which holds coin too. Every change is logged, with Undo. A coin line on the Pack tab, with a small sheet. | "yes" |

**Not in the first cut (the rest of M7b, later):** coin's weight in the load; prices charged on buying and change made across denominations; treasure shares and the party fund. On the first night a price is taken off a purse by hand.

**Confirmed by Francis:** "then prompts character" means the sheet asks which character.

**The lead's reading:** Anything not written for the place (a thing from a table's row, something the GM makes up) is reached from the same sheet's "Something else…", which searches the adventure's pack first. Handing out a table row's things in one tap is a second way, built if time allows.

**Costs and caveats:** needs the place picked from the pack (December step 2) and the adventure pack carrying each place's treasure as items; not sized.

Docs to update: 05 (giving items: the GM hands out a find from the place), 06 (the place panel's treasure rows; the hand-out sheet), 09.

09 line:
- 2026-11-11 — [items] The GM hands out a find from the place itself: the place panel on the Scene lists its treasure, and tapping a treasure whole or one thing in it opens a sheet to send it to a character (then which) or to the party stash (pk-1) — "DM should have that information readily available in the Scene screen when at a location" (Francis, on the Pack mockups) — `design/rulings/pack-rework-rulings-2026-11-11.md`

## Sending a table's row: rumours (ruled later the same day, in the planning session)

| Id | Ruling | Francis |
|---|---|---|
| tb-1 | The standard way to give a rumour: the GM taps the row that was rolled, and a pop-up sheet asks who it goes to, as for treasure: **a character**, or **the party**. The rumour's words are recorded in notes, that character's or the party's. Whether it is true or false is hidden: it is the GM's, and is never sent to a player's device. | "Standard procedure for rumours should be to tap the table row to send the rumour (pop-up sheet to target like treasure (character or party)). It gets recorded in notes (individual or party). True or false is hidden." |

**Why:** for the December campaign each player rolls a rumour at the meet-up (planning answer of the same day); today a table opened from the Tables list is read-only, so the GM would retype each one into a message.

**Costs and caveats:** new work, not sized (December step 5, piece 5e). It rests on what Notes is in the app today for a character and for the party: the Builder says before building; if the party has no notes of its own yet, that is a ⚑ back to the lead. The row's GM-only parts (its truth, any GM note) need a test as a player proving they are not in what is sent or stored for players.

Docs to update: 05 (tables: sending a row; notes), 06 (the send sheet shared with the hand-out), 07 (a rumour row's GM-only truth), 09.

09 line:
- 2026-11-11 — [adventure] A rumour is given by tapping its row: a sheet asks whether it goes to a character or the party, its words are recorded in that character's or the party's notes, and whether it is true stays the GM's (tb-1) — Each player rolls a rumour at the first night's meet-up; a table opened from the list was read-only (Francis, planning session) — `design/rulings/pack-rework-rulings-2026-11-11.md`

