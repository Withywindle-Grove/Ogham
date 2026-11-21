# Plan: M5c slices 4 and 5 — Prepare, the morning window, getting magic back

Written by the design agent, 2026-11-09 (night). **Its mockup, `design/mockups/magic/06-prepare-and-rest.html`, was approved on 2026-11-10 with mm-4 and mm-5 (`design/rulings/m5c-magic-mockups-2026-11-10.md`). The plan is still a draft: nothing is built before the M5b gate passes and Francis says go.** It makes no rulings. Overview: `docs/plans/magic-in-play.md` (slices 4 and 5, planned together because the morning window joins them). Comes after slice 1; it can be built beside slice 3.

## What it delivers

The Prepare screen with steppers (mp-1); the words that say chosen is not yet ready (mp-2); the caster's morning prompt and the GM's line (mp-3); the GM's rest prompt with a ✓ or ✕ mark on every caster (mp-5); uses that come back by the day, the rest and the calendar (mp-16).

## Rests on

| Read | For |
|---|---|
| Mockup `design/mockups/magic/06-prepare-and-rest.html` | the screens, once approved |
| 05 Spells: Prepare; Getting magic back | the behaviour |
| `design/rulings/m5c-magic-in-play-2026-11-05.md` mp-1 … mp-5, mp-16 | steppers; chosen then ready; the window; strict after it; the marks; the calendar |
| `plans/m5c-1-magic-state.md` | the state and commands this slice puts on screen |
| 07 `spellcasting` (`recover`, `duplicates`, `reverseAt`); 05 Abilities (use dots) | what the pack says; the uses that already exist |
| `design/rulings/m5b-camp-facts-sleep-2026-11-04.md` sl-1 … sl-4 | what a broken night is, where the camp records it |

## Build order

1. **Prepare.** A sub-screen (the ← bar). First line: whose next rest it is for, and what is ready today. **Same as yesterday** as one tap, its button reading **Pick** (mm-4). Then each level: "Level 1, 2 a day. 2 chosen", and each spell with a **− N + stepper**. Book casters see their book; prayer casters their whole list for the level, chosen first and the rest folded. A name opens the rules sheet (slice 2's). Changes save as made; the foot says what is still empty.
2. **A full level** answers + with a pop-up ("Level 1 is full", and how to make room). Nothing is swapped; no button is disabled.
3. **The form when memorising:** for a class whose `reverseAt` is at memorising, a row under the chosen spell opens the two forms.
4. **The caster's morning prompt** on the Magic tab while the window is open: "Your spells are back", then mm-5's line ("Choose before the party moves on, or yesterday's spells will be selected by default", and their names), **Same as yesterday** (the accent) and **Choose**. With no yesterday: the words say the slots stay empty, and Choose is the accent.
5. **The GM's line** while a window is open: who hasn't answered and how many slots are empty, with Choose to do it for them. It blocks nothing. When the window closes, the log lines from slice 1 show with Undo.
6. **The GM's rest prompt.** The rest (and End expedition's full rest) asks once, listing every caster and every character with a once-a-rest power, each with a mark and its word (✓ Magic back, ✕ Not back), tapped to switch. A caster whose night was broken starts on ✕ with the reason in words (see ⚑ 2).
7. **Uses by the calendar** (mp-16): weekly and yearly uses return when the campaign's date passes that mark, by themselves, with a log line. A "once ever" use stays spent (the GM can restore it); the spent power leaves the Magic tab and is listed on the full sheet under "Spent for good".
8. **Gallery and layout scenes:** Prepare (book and prayer, 375 px and a tablet with the tapped spell's rules beside the list), the morning prompt (both endings), the rest prompt.

## Tests (each purpose as a plain sentence first)

- Tapping + on a spell adds one to what is chosen and changes nothing that is ready today.
- Tapping + on a full level opens the pop-up and changes nothing.
- A class that forbids the same spell twice explains itself at the second +; a class that allows it counts to two.
- A prayer caster's list shows chosen spells first and folds the rest with their count.
- The morning prompt shows only while the window is open and only to a caster marked "magic back".
- The GM's line names exactly the casters who haven't answered, and goes when the last one answers or the window closes.
- A caster on watch during a night encounter starts the rest prompt on ✕ with the reason; the GM's tap switches it.
- A once-a-week use spent on day 3 is back when the date passes the week's mark, with one log line; a once-ever use is not.
- A 79-character spell name wraps beside its stepper at 375 px, and both − and + stay 44 px.

## ⚑ for Francis (collected, not decided)

1. **Prepare on a tablet:** proposed as creation's pick lists (the list on the left, the tapped spell's rules beside it). Described in the mockup's notes, not drawn.
2. **What starts a caster on ✕.** Proposed: the camp's own record of a broken night for that character (sl-1 … sl-4, being built now); where the camp recorded nothing, everyone starts on ✓ and the GM taps. The ruling gives the mark and the reason but not where the reason comes from.
3. **The GM choosing for a player** opens that character's Prepare, as the GM. Proposed; mp-4 says the GM can fill or change anyone's spells but not on which screen.

## Estimate

6–8 builder turns for Prepare and 3–5 for getting magic back (the overview's figures). The Builder confirms it in hours when the slice is claimed.

## Departures

(The builder keeps this current in the same pull request.)
