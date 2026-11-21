# Plan: magic in play (draft, for sizing)

Written by the design agent, 2026-11-05, on Francis's yes to draft it. **Ruled 2026-11-05: it is built after the M5b gate and before fights (M6)**; its dates wait for the weekly check-in. Francis asked whether all of magic should move forward, since it keeps coming up; this draft sizes "magic in play" as its own piece of work so he can decide the order **M5b gate → magic → fights (M6)**. It makes no rulings and changes no date in 08.

## Why its own piece

Today magic's build sits inside M7 with XP, levelling, downtime and treasure. But fights lean on it (casting in a fight, a spell lost when hit, conjured creatures, turning, bonus hit points from spells), the sheet's Magic section is being built now with nothing behind its rows, and magic needs nothing from fights. Built first, M6's player-side screens get real casting, with no stand-in to throw away.

## What is ruled (read these, in this order)

| File | What it settles |
|---|---|
| 05 Spells; Abilities (use dots) | The Spells section, rules one tap away, Cast, Prepare, getting spells back, Lost when hit, scrolls, the spell book |
| `design/rulings/m7-rulings.md` M7-3, M7-5 | Spells and ability-use dots as ruled 2026-10-28 |
| `design/rulings/sheet-spells-rulings.md` SP, X-3 | One line per spell; timed effects |
| `design/rulings/m5b-sheet-review-2026-11-04.md` sr-4 | The sheet's Magic section: a tab per kind of magic (book, prepared, glamours, runes, knacks) |
| `design/rulings/m7-uncommon-spells-2026-11-05.md`, `m7-found-spells-and-rolled-results-2026-11-05.md` | us-1, us-2: spells found in play, hidden until given |
| `design/rulings/m5b-packs-g80-g06-2026-11-03.md` pg-1 | A spell list that extends another's |
| `design/notes/area-5-magic-review-2026-11-04.md` | What both settings' books say and what the app reads today; gaps G-137 … G-143 |

## What exists already

Creation's First spells and the spell book; the Player screen's prepared spells and ability dots (read from `spellSlots`); the sheet's Magic section (sheet plan order 3, building now). Not read yet: `reverseAt`, `recover`, `scrollCopy`, `learnByLevel`, turning tables, the settings' general magic rules.

## Build slices, in order

| # | Slice | Rests on | Model | Rough turns |
|---|---|---|---|---|
| 0 | **Design, done 2026-11-05** (`design/rulings/m5c-magic-area-5-2026-11-05.md`, `m5c-magic-in-play-2026-11-05.md`; the walk in `design/notes/magic-dry-run-notes.md`). Was: **Design first:** rule area 5's seven cases; a **paper test of magic in play** in both settings (a book caster, a prayer caster, and one of each other kind of magic), then any rulings it raises | area 5; sr-4 | Design, with Francis | — |
| 1 | **A character's magic as state**: what they know, what is prepared today, what is cast or lost, by kind of magic; the commands and events (prepare, cast, lose, undo). **The builder's read of the code (2026-11-05):** the spell book, the prepared list and ability uses are already stored and reusable; missing are a cast or lost mark per prepared slot (written through a database function, as ability uses are, so two devices don't collide), slots coming back on rest (both rest paths are hard-coded to ability uses today), and the pack's uses-per-day for the other kinds; one migration, plus one table only for spells hidden until given | 05 Spells; hard rules 3, 4, 5 | Fable if the read rules are new | 6–9 (the builder's sizing fits) |
| 2 | **The Spells section** on the Player screen and the sheet: one line per spell, a cast one crossed out and last, the rules pop-up with duration and range worked out for this caster, reversed forms by list | M7-3; SP; G-137, G-143 | Opus | 5–7 |
| 3 | **Cast**: one tap with Undo; a sheet only for a real choice (reversed form, targets); what the spell brings starts by itself (a light, a condition, a timer; dice durations set by the GM later) | 05 Cast; X-3; G-113 | Opus | 7–10 |
| 4 | **Prepare**: Same as yesterday; the slot grid; the book for book casters, the whole list for prayer casters; the setting's rules that the screens need (rest before memorising, the same spell twice, when a reversed form is chosen; no pack forbids the same spell twice today, the pack session's finding, 2026-11-05) | 05 Prepare; G-139 | Opus | 6–8 |
| 5 | **Getting magic back**: the pack's recover rule through the GM's rest prompt and End expedition; ability uses back by day, rest and week | 05; M7-5 | Opus | 3–5 |
| 6 | **The other kinds of magic**: uses and pips for powers that aren't spell slots (glamours, runes by level band, knacks) | sr-4; G-87, G-63 | Opus | 5–8 |
| 7 | **Learning in play**: the GM gives a character a spell; uncommon spells hidden until given (row-level security); a list that extends another; a class whose list is chosen | us-1, us-2; pg-1; G-142 | Fable (read rules) | 6–9 |
| 8 | **Scrolls**: Read, Copy into book, the wrong-kind warning | 05 Scrolls | Opus | 4–6 |
| 9 | **Turning** as data and a prompt (two shapes: by table, by roll bands) | G-138 | Opus | 4–6 |
| 10 | **Conjured creatures** (a5-5): casting makes the creature a temporary companion of the caster (a stat block the spell points at, the count entered or worked out, the spell's duration as its timer, a control note), listed with the party, readable by the caster's player; dismissed, timed out or dropped, with Undo. Joining a fight is M6 (about 2–3 turns there). Pack work and the checker beside it. **The builder's read (2026-11-05):** it is a party-side actor owned by the caster's player (a hireling or a new kind), never a monster, with the stat-block fields it needs **copied into the actor at creation**, so the library entry and every other monster stay GM-only with no access rule changed (hard rule 5); its timer is a status on the creature (X-3's timers end statuses, not actors); missing today: a command that makes an actor from a stat block, the link to its caster, dismiss and drop, and Undo for each | a5-5; ns-1 | Fable (it touches who reads what) | 2–3 for the data, 6–9 for play |
| 11 | **Sweep**: gallery, layout checks, the gate list for magic | 06; `docs/testing.md` | Opus | 4–6 |

**Rough total: 58–86 builder turns** (52–77 before conjured creatures in play, a5-5), not sized against the code. Slices 3, 6 and 7 carry the most unknowns. For comparison, the M6 draft is 82–119.

## What the paper test changed (2026-11-05, mp-1 … mp-22)

- **A new slice, the Magic tab** (mp-20), before slice 2: a fourth tab for a character with any magic; slice 2 builds its lists there, not on the Player screen, and removes the Player screen's Spells section. About 3–5 turns; its first pictures before merge.
- **Slice 1** stores chosen and ready apart (mp-2), the morning window's state and the carry-over (mp-3); no "lost" state (mp-9).
- **Slice 3** has no target sheet (mp-6); it adds the reminder in words (mp-7), a timer for every duration (mp-8) and the "spell lost" toast (mp-9).
- **Slice 4** uses steppers and the chosen-then-ready rule (mp-1, mp-2); **slice 5** the ✓ / ✕ rest prompt and the calendar returns (mp-5, mp-16).
- **Slice 8** (scrolls) is the item sheet's Read and Copy only (mp-17): smaller, about 2–4 turns.
- **Slice 9** (turning) is the reference, the Turn button and the use (mp-11, mp-13); the encounter's help (mp-12) is M6.
- **Players change their own hit points** (mp-10): today's Player screen already has − and +; M6 keeps a player's pad.
- **Mockups before the build:** the three rough drafts (`design/mockups/magic/01` … `03`) are redrawn with the rulings (the Magic tab, no target sheet, the rest prompt's marks) before slice 2. **Redrawn 2026-11-09, approved by Francis 2026-11-10 with mm-1 … mm-5 (`design/rulings/m5c-magic-mockups-2026-11-10.md`):** `design/mockups/magic/04-magic-tab.html`, `05-cast.html`, `06-prepare-and-rest.html` (the three drafts are marked superseded in the index).
- **Slice plans, drafted 2026-11-09 (not approved; nothing is built from them before the M5b gate passes):** `plans/m5c-1-magic-state.md` (slice 1), `plans/m5c-2-magic-tab.md` (the Magic tab and slice 2), `plans/m5c-3-cast.md` (slice 3), `plans/m5c-4-prepare-and-rest.md` (slices 4 and 5). Slices 6 to 11 get theirs when these are approved. Their ⚑ are listed in each file; the phone's bar and the tab's symbol are ruled (mm-2), and "spell lost" moved to M6 (mm-3). The one that still shapes a screen is how the app knows a cast calls for a roll.

## What it leaves in M7

Learn a spell at level-up (with levelling), XP and awards, level loss (G-140), magical research, downtime, treasure hand-out with magic items' rolled results (rr-1) and item tables (it-1). **In M6, once magic exists:** the Spell lost? line on the damage pad, bonus hit points from a spell, uses that come back at End fight, conjured creatures joining a fight.

## What can start before the M5b gate passes

Nothing with screens or migrations. Possible now: slice 0's rulings and the paper test (Francis's time only); pack work for slice 10 and the spells' one-line blurbs (M7-4's pack task).

## ⚑ for Francis (collected, not decided)

1. ~~The order~~ **Ruled 2026-11-05 (Francis): M5b gate → magic → fights.** Magic in play is its own piece with its own small gate (08, row M5c).
2. ~~Its name and number in 08~~ **Ruled 2026-11-05 (Francis): M5c · Magic in play**; nothing else is renumbered. Its dates wait for the weekly check-in.
3. ~~A date for the paper test~~ **Walked 2026-11-05.** Was: **A date for the paper test** of magic in play; it comes before slice 1. **Ready for it (2026-11-05):** the pack session's one-pagers per setting (a private survey note) and one-line blurbs on every spell and power; it also walks a turning attempt per setting, the add-on's "command" outcome (ao-3) and one conjured creature.
4. ~~Area 5's seven cases~~ **Ruled 2026-11-05** (`design/rulings/m5c-magic-area-5-2026-11-05.md`, a5-1 … a5-7); turning's shape (a5-2) is decided at the paper test.
5. ~~Turning~~ **Ruled 2026-11-05 (mp-11 … mp-13):** the reference, the Turn button and the use here (slice 9); the encounter's help with M6.
6. ~~Scrolls~~ **Ruled 2026-11-05 (Francis): with magic in play** (slice 8), not with treasure in M7.
7. ~~Who sees a character's prepared spells~~ **Ruled 2026-11-05 (Francis): they stay visible** to anyone who can read the character, as today; no change.
8. **Fable** for slices 1 and 7.
9. ◈ A spell book as an item that can be lost stays open.
10. **Uses that change with the caster's level** (the pack session, 2026-11-05; G-87's detail; to rule before slice 6): one setting's runes are used a number of times per day, per week, per year, once ever, or once per level gained, by the rune's magnitude and the caster's level band. Proposed by the pack session: a `byLevel` row may carry its own `per`; `per: "level"` (back on gaining a level); the table once on the rules set, by magnitude, not on each rune. Until ruled it stays in words.

## Departures

(The builder keeps this current.)
