---
status: absorbed
milestone: December first play (a player's feedback on the Player tab, 19 November: `docs/plans/test-feedback-2026-11-19.md`, section P; mockup pages M1, M2 and the new page M4)
absorbed-into: 04 (Character play: pins); 05 (At hand; the new line "Pinned abilities and traits"; a pinned spell); 06 (the Details ledger's Player screen variant; Pinned mark; Pin star); docs/09-decisions-log.md (2026-11-19); docs/10-open-questions.md (Later: three parked items); `docs/plans/test-feedback-2026-11-19.md` (section P, page M4, E7, the ⚑). The pinned list and the blocks are not in 06 as pictures or as parts: page M4 draws them, and nothing here that a person can see is built before he approves that page
supersedes: nothing as a file. Inside it: euf-2 and euf-3 replace, for traits, pin-1's "a pinned one shows in At hand" (`dec-player-screen-2026-11-14.md`) and row C8 of `docs/plans/dec-13-the-player-screen.md` as built ("pinned, the trait leaves Traits and shows in At hand"), and widen pin-2 (`dec-morning-2026-11-15.md`) from a trait with uses to every ability and trait; pin-1 stands for spells (euf-6). euf-1 adds to tfr-1 (`dec-test-feedback-player-rows-2026-11-19.md`) and changes nothing in it
---

# A player's feedback on the Player tab (ruled 2026-11-19)

One short sitting on the evening of 19 November, in chat, from the messages one of Francis's players sent him: [`docs/intents/player-tab-end-user-feedback-2026-11-19.md`](../../intents/player-tab-end-user-feedback-2026-11-19.md) ("message 3" is its message 3). His words are in quotes; anything else is the designer's reading and says so. Each point was first set beside what was ruled or in flight that day (the Studio's ruled-so-far sheet of 19 November, page M1 as approved, the plan's rows), then put to him one at a time.

**Nothing here is built yet.** Page M4 draws the pinned list, the blocks and the rows; he approves it first. Pages M1 and M2 change as the last section says.

## The rulings

| Id | Ruling | His words | It replaces, or leaves standing |
|---|---|---|---|
| euf-1 | **Details, folded, shows its heading alone, as ruled that day; the Player tab remembers, on that device, whether Details was left open.** | The player, in other words: Details reads well when open, but they would like to put the sections in their own order and choose which show when folded (message 1). Put to him: A as ruled; B the heading alone and remembered; C the player picks the lines that stay showing. "B: heading, remembered" | tfr-1 stands. New: today Details opens folded every time |
| euf-2 | **Every ability and trait of a character can be pinned, with uses or without. A pinned one shows in the Player tab's right column, not in At hand on the left.** | The player, in other words: Abilities and Traits two taps deep is hard going; they want to see every trait and ability they can act on, all at once. His take: "at minimum we need to add pinning to abilities and traits so that they can stay expanded and ordered selectively". Put to him: A pins reach every one, shown At hand; B that and the two rows opening in place; C as approved. "I want them pinnable, but on the right column, not the left." | pin-2, widened from a trait with uses to every ability and trait. The two rows at the right column's foot ("Abilities", "Traits": tfr-5, page M1) stand |
| euf-3 | **A pinned ability or trait sits in the right column's list (the list of traits with uses, under Movement), pinned ones first, in the order they were pinned. A pinned trait with uses no longer moves to At hand.** | Put to him: A one rule, every pinned ability or trait in that list on the right, a pinned trait with uses no longer moving to At hand; B only the ones without uses go right. "a" | pin-1 for traits ("a pinned one shows in At hand … and leaves the list it came from") and dec-13's row C8 as built. For spells pin-1 stands (euf-6) |
| euf-4 | **The player puts their pinned ones in their own order by drag and drop.** | "allow the player to drag and drop to reorder pinned items" | New. How a handle behaves is ruled since 2026-10-23 (09: drag handles, friendly to a screen reader; a rearrangement in the detailed log only) |
| euf-5 | **A pinned ability or trait that has something to do or roll (uses to spend, or a roll the pack states) is a block like the weapon in hand's: its name, a short line, its roll with the die's glyph, Use with its pips. One with only something to read is a plain row: the star, its name, a tap opening its text. The rows are designed to sit well beside the blocks.** | The player, in other words, on the weapon in hand's block: it works very well, and they would like the same for Abilities, Traits and Magic (message 2). Put to him: A a block for a pinned one; B a plain row; C a block for every one. "mock up A. i would think that not all abilities and traits make sense for a box and may only need a plain row. how would we distinguish?" The designer's answer: what the ability has decides, as a weapon gets roll lines because it has rolls. "yes, but lets design the rows to look good with the blocks" | New. Ruled in words: page M4 draws it for his approval |
| euf-6 | **A pinned spell stays At hand, on the left, drawn as a block like the weapon in hand's.** Built with the screen half of magic, not before | Put to him: A a pinned spell joins the list on the right; B as ruled, At hand. "spells are more akin to weapons than abilities are, keep them on the left." | pin-1 and 05 ("Memorized spells can be pinned to At hand and cast from there") stand. New: the block |
| euf-7 | **The Player tab's Movement and burden boxes stay as approved.** The idea of one box with the heaviest things beside it is for the Pack tab, at its own sitting; nothing is decided about it | The player, in other words: the box feels wrong; perhaps join it with the burden meter in one box on the left, with a small panel on the right showing the three to five heaviest items (messages 3 and 4). Put to him: A one box; B that, and the three heaviest in the burden's pop-up; C that, and the heaviest on the tab; D as approved. "i dont think we change this on Player Tab, we'll need to figure out a way to implement it on Pack Tab" | ps-2 and frames P1 and M1 stand |
| euf-8 | **Text shown on hover is parked until after 5 December.** | The player, in other words: each with its name and a short description on hover (message 1). "hover text put on the parking lot - we'll want to support pc more in the future but not prior to dec 5" | Nothing: a tap on a name opens its text, as today |
| euf-9 | **Players arranging the sections of their own screen: not now.** It goes on the list for after 5 December; until then the pins and their order are the player's way to arrange the tab | His take: "players also want the ability to reorder their own screen and have it saved to their view." Put to him: A not now, after 5 December; B bring it back now, with its own sitting and mockup. "a" | "Arrange this screen removed" (09, 2026-10-26) stands for now. Its command and log lines are still there (05) |

**The designer's reading of euf-3, said to him before he answered:** At hand then holds what a character carries, and, by euf-6, the pinned spells. The list on the right is headed "Traits" today and would hold abilities too: its word is for the page (⚑ 1).

**The designer's reading of euf-4, said to him and not corrected:** "pinned items" is the pinned abilities and traits in the right column's list. Whether the pinned things At hand take the same handle is ⚑ 2.

## Answered, nothing ruled

| The player's point | The answer given |
|---|---|
| The player, in other words: amused, asked whether the larger gap above the Scores table than above Saves or Movement is on purpose (message 5) | Intended. On a tablet the first row of score boxes starts level with the hit points box (ls-1, 2026-11-17), so the "Scores" heading stands higher above its boxes than the other headings (`src/app/PlayerScreen.css`, "the aligned top"). Page M1 puts the notices box in that corner. The designer looks at the gap again on M1's built pictures |
| The Pack tab's ⓘ (message 6) | Set aside by him: "ignore pack feedback for now". Kept in the intents file for the Pack tab's sitting |

## Why, as put to him

- **euf-1.** The player's wish was to keep some lines in view. Remembering that Details was left open gives that without a stored choice for each character and without changing page M1's picture. The app already remembers the folded menu, the text size and the theme the same way, on the device.
- **euf-5.** A choice of "block or row" for each pin would be one more thing to set on a sheet meant for glancing. What the ability has can decide, and a weapon is already treated so.
- **euf-9.** The Player screen goes live whole and once (po-4, rvw-9). Bringing back arranging would reopen its layout before it has been live at all.

## Not settled

Collected, not decided. Each is asked on the page it rides with, one at a time, not before.

**On page M4**
1. ⚑ **The right column's list's heading.** It reads "Traits" today and holds the traits with uses. With pinned abilities in it, what does it read?
2. ⚑ **Do the pinned things At hand (a pinned item, a pinned spell) take the same drag handle?** Read as no for now: euf-4 is built for the right column's list.
3. ⚑ **A pinned ability or trait leaves the names in its row at the foot** ("Abilities", "Traits"), so each thing shows once (pin-1's own rule). Read as yes; drawn so.
4. ⚑ **An unpinned trait with uses** stays in the list under the pinned ones, with its Use, as today. Is it then a block too (it has something to do), or the row it is today? Drawn both ways.
5. ⚑ **The block's short line.** The weapon's reads "In hand". What does an ability's read: where it comes from ("Warden, level 3"), the pack's own one-line summary, or nothing? After E7.
6. ⚑ **Twenty-four pins at most** (04). With every ability and trait pinnable the limit can be met: the pin stays tappable and a pop-up says why (never a disabled button). Its words are drawn on the page.

**On page M3**
7. ⚑ **In the player's view, may the GM pin, unpin and reorder for the player?** `character.pin` is the owner's or the GM's today (04). Read as yes, logged as the GM's (tfg-1); asked with the page.

**For the Pack tab's sitting**
8. ⚑ **Movement with the burden in one box, and the three to five heaviest things** (euf-7): how, and where, on the Pack tab. With message 6.

**Technical, the builder's or the driver's**
9. How a reorder is stored and logged. `pins` is a list written whole by `character.pin` (04), so the list's own order can be the player's order with no new table. 09 of 2026-10-23 puts a rearrangement in the detailed log only, and `character.pin` is in the simple log: the builder says which in the pull request, and a new command needs its permission cases and its row in `public.logged_commands`.
10. Whether a trait's pin key covers a class's ability without uses as it covers a trait with uses today: not read in the code beyond `pinnedTraits` (`src/modules/characters/playState.ts`), which is given the traits with uses only.

## Honest notes

- **Not opened:** the private packs. How many abilities and traits state a roll or a figure the app can read, and how many say it only inside their text, is not known (pack question E7). One that says it only in its text shows as a plain row until the pack states it.
- **Not checked in a browser:** the gap under "Scores" was read from the stylesheet's own comment and ls-1, not measured.
- **A list that mixes blocks and rows may look uneven.** That is what the page is for: it shows a mixed list with messy data (a long name, no roll, no uses left, many pinned), on a tablet and at 375 px, light and dark.
- **Hover has no meaning on a tablet or a phone,** which is where this app is used first; euf-8 parks it for the PC.
- **Build time:** euf-1 is small. euf-2 to euf-5 are a data-and-logic row and a screen row, the screen sized after page M4. euf-6 waits for magic's screen half.

## What changes for pages M1, M2 and M3

Told to the driver on 2026-11-19, at the sitting.

| Page | What changes |
|---|---|
| M1 (page 25, approved 2026-11-19) | **Nothing drawn changes:** it draws one unpinned trait with uses in the list and no pinned trait At hand. Details' picture is the same (euf-1). The Movement boxes are the same (euf-7). What is new goes on page M4 |
| M2 (page 26, drawn, not yet approved) | **Two spots, for its fix list.** Every ability's and trait's entry (frames M2a, M2b, and the entries M2g's rows open) carries the pin star beside the ✕. Frame M2n's fifth pop-up, "a trait with uses, pinned to At hand", is no longer At hand: the trait sits in the right column's list; the pop-up's content can stand. The burden's levels (M2h) do not change |
| M3 (not drawn) | Nothing drawn changes. ⚑ 7 rides with it |
| **M4 (new)** | The right column's list with pinned abilities and traits: blocks and plain rows together, the star, the drag handle and the way to reorder without dragging, pinned first; the same on a phone. At hand with a pinned spell's block beside the weapon's. ⚑ 1 to 6 |

## Docs to update

Done in this pull request: 04 (Character play: what a pin is and where it shows); 05 (At hand's pins; a new line for pinned abilities and traits; the pinned spell's block); 06 (the Details ledger's Player screen variant; Pinned mark; Pin star); 09 (the lines below); 10 (Later: hover text, arranging the screen, the Pack tab's box); the plan (section P, page M4, E7, the ⚑); the intents file's links.

Not done here, and why: the Studio's ruled-so-far sheet (`docs/design/notes/player-tab-ruled-so-far-2026-11-19.md`) is on the Studio's branch; the driver has the list. `docs/plans/dec-13-the-player-screen.md` row C8 is history for traits from this ruling on, and is not rewritten. The components inventory gains no part until page M4 is approved.

## The `09` lines

- `2026-11-19 — [ui] On the Player tab Details, folded, shows its heading alone (tfr-1 stands) and the tab remembers on the device whether it was left open (euf-1) — a player wanted some lines kept in view; "B: heading, remembered" (Francis) — design/rulings/dec-player-end-user-feedback-2026-11-19.md`
- `2026-11-19 — [sheet] Every ability and trait can be pinned, with uses or without; a pinned one sits in the Player tab's right column's list, pinned first, in the player's own order, set by drag and drop; a pinned trait with uses no longer moves to At hand (euf-2 to euf-4, replacing pin-1 for traits and widening pin-2) — "I want them pinnable, but on the right column, not the left"; "allow the player to drag and drop to reorder pinned items" (Francis); page M4 owed`
- `2026-11-19 — [ui] A pinned ability or trait with something to do or roll is a block like the weapon in hand's; one with only something to read is a plain row, designed to sit well beside the blocks (euf-5); a pinned spell stays At hand on the left, as a block (euf-6; pin-1 stands for spells) — a player wanted the same for Abilities, Traits and Magic (in other words); "spells are more akin to weapons than abilities are, keep them on the left" (Francis); page M4 owed`
- `2026-11-19 — [ui] The Player tab's Movement and burden boxes stay as approved; one box with the heaviest things is for the Pack tab's sitting (euf-7); hover text is parked until after 5 December (euf-8); players arranging the sections of their own screen is not brought back before 5 December (euf-9; "Arrange this screen removed", 2026-10-26, stands) — Francis`
