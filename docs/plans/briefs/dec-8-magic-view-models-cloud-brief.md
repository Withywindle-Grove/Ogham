# Brief for a cloud builder: what the Magic tab, Prepare and the rest prompt show, worked out as data (logic only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-8-magic-view-models`. Pull request title: "Magic in play: what the Magic tab, Prepare and the rest prompt show, as tested data (ahead of dec-8 B, C, D)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Why
`docs/plans/dec-8-magic-first-cut.md` has four pieces. Piece A (the state and its commands) is on main: `src/modules/characters/magicState.ts`. Pieces B, C and D are screens, built on the PC from approved pictures. Each of those screens needs the same facts worked out from a character's state and the pack. This piece works those facts out as pure, tested functions, so the screens' builders compose them and write no arithmetic. **You build no screen.**

## Read first
- The plan above, whole (it is short), and its "Left to the table" list: nothing on that list is built here.
- `src/modules/characters/magicState.ts` and its test: what is stored (`prepared`, `chosen`, `spellsCast`), `readySpells`, `nextReady`, `afterRest`, the commands. **Import from it; do not edit it.**
- The rulings: `docs/design/rulings/m5c-magic-in-play-2026-11-05.md` (mp-1 to mp-6, mp-20, mp-21) and `docs/design/rulings/m5c-magic-mockups-2026-11-10.md` (mm-1 to mm-5).
- The approved pictures, as HTML you can read: `docs/design/mockups/magic/04-magic-tab.html` and `06-prepare-and-rest.html`. They are the contract for what each screen shows. Read them for content and order, not for style.
- How the app already works out a caster's slots a level and an ability's uses (`uses.per`) and their dots: find it (the Player screen's spells list and the Traits list use it). **If a function already gives a fact, use it and say so; do not write a second one.**

## The task
One new file beside `magicState.ts` (suggest `magicView.ts`) with its test file. Pure functions: they take the character's state and the pack's data as arguments and return plain data. No React, no words, no database, no command.

1. **The Magic tab's ready spells** (piece B; mm-1, mp-20): the ready spells grouped by spell level, lowest first; **one row per spell**, with how many castings it was prepared with, how many are cast, how many are left, a dot per casting in order (cast ones hollow), whether the row still offers Cast (a casting is left), and whether it is spent (none left: the screen crosses it out and says "cast"). A spell prepared once has no dots (mm-1: read it). The order of rows within a level: as the picture and rulings say; if they do not say, the order the state holds them in, and write the question down.
2. **Prepare** (piece C; mp-1 to mp-4, mm-4): for each spell level the character can prepare, the slots it has, how many are chosen, and whether it is full; for each spell the character may choose from, its count chosen and whether one more may be added or taken away; whether "Same as yesterday" has anything to offer and what it would choose; and, kept apart, what is **chosen for the next rest** and what is **ready today** (the screen tells them apart in words: you return both, clearly named). "Level 1 is full" is a pop-up on the screen: you return the fact that a level is full and which.
3. **The rest prompt** (piece D; mp-5): from the party's characters, the rows the GM's prompt shows: each caster (a character with any spell slots, or anything prepared or chosen) and each character with a power whose uses return at a rest; for each, what a tick would do, as data: the chosen spells that become ready, the casts cleared, the uses that refill. And the refill rule itself: uses with `per: rest` return to those who rested; uses with `per: day` return to everyone at the new day; anything else (a week, a year, once ever, a use a target) is **not** refilled here (the plan leaves those to the table).

## Tests (each with its purpose as a plain sentence first)
At least: a spell prepared three times with one cast (one row, three dots, the first hollow, Cast still offered); all cast (spent); prepared once (no dots); nothing ready (an empty list, not an error); two levels in order; Prepare with a full level and an empty one; a count that cannot go below nought; Same as yesterday with nothing ready yesterday; chosen and ready differing; a rest prompt with a caster, a non-caster with a once-a-rest power, and a character with neither (not listed); a day's uses refilling at the new day for a character who did not rest; a weekly use left alone; messy data (a spell id the pack no longer has: it stays listed by its id and nothing throws; counts of 0 and 99).

## Fences particular to this piece
- No component, no route, no CSS, no words, no new command, nothing under `supabase/`. Do not edit `magicState.ts`, `playState.ts` or any screen.
- Do not decide anything the rulings and pictures leave open: return the facts both ways if needed and write the question at the top of the status file.
- Invented spells, classes and powers in fixtures ("Marsh light", "Reed whisper", "Lantern Warden").
- The status file lists each function with one line on which screen piece (B, C or D) is meant to use it, so the PC builders find them.
