# Brief for the Design Studio: the Player screen redesigned for the person playing

Written by the lead on 2026-11-14. You are a worker: mockups and a proposal note only; you report to the lead, never ask Francis for a ruling, never edit rulings, 09 or specs. If unsure, stop and ask the lead; don't guess.

## Read first
- The intent, with Francis's words: `docs/intents/2026-11-14-player-screen-redesign.md`.
- The Player screen as built: bring your worktree's copy of `main` up to date first (read only) and read the screen's source and what it composes; today's gallery pictures of the sheet and the play column. List every part of it before you draw (the last brief showed what a list from pictures alone misses).
- The sheet's rulings: the sheet-order rulings of 2026-11-04 and 2026-11-05 in `docs/09-decisions-log.md` ([sheet]), and `docs/05-features.md` on the sheet's sections; the type rulings ts-1 to ts-3; the standards ds-1 to ds-10 and mc-46 (no line explains what the screen shows), ds-3 (the die glyph wherever a die is named).
- The two settings' printed character sheets (the sheet review's inputs), if they are in your reach, for what the books themselves put first.

## The objective
One proposal for the Player screen, drawn in the book's type so that its restyle and its redesign are one pass (po-2), for this person: **a novice to moderately experienced roleplayer, at the table, who needs what they use most closest to hand, and cues for how to play their character.**

## The two ideas to draw
1. **By how often it is used.** Order and size the screen by frequency at the table, not by the rulebook's order:
   - every few minutes: hit points (with the − and +), the weapon in hand with what to roll (the die glyphs, the bonus, the damage), armour class, the saves with their one line (sv-1: the d20 glyph, "Roll d20: your save's number or higher succeeds.", built from the rules);
   - each fight or scene: the class's and kindred's abilities that can be used now, with their uses; the other weapons at hand; movement when it matters;
   - now and then: the scores and what each changes; skills and checks; languages; load;
   - rarely: level and experience (today at the top of the right column), the party list, how a figure is worked out.
   Rare things stay reachable: further down, folded, or one tap away. Nothing a player can do or read today is removed.
2. **The character as a person.** A small, always-visible part near the name that says how to play them, in the pack's own words and the player's, never invented and never from a language model: the kindred's and the class's one-liners; alignment; background and other trait picks; the Details tables' results (looks, manner, a trinket); motto; the first line of the backstory. Two or three lines at rest, opening to the rest. Show what it says for a character with almost nothing chosen (it must not nag), and for one with a great deal.

## Frames
1. Tablet, landscape (Francis's iPad), dark and light: the screen at rest for a level-2 fighter of a horned kindred with a sword in hand.
2. The phone, the same character: the order top to bottom.
3. The "who you are" part opened.
4. A caster (the Magic tab carries the spells; what this screen says of magic, if anything) and a character with a limited-use ability.
5. Messy data: a very long name; 0 and 999 hit points; six weapons at hand; a character with no saves or no scores in its rules; a character with nothing written about them.
6. One alternative, small: the same content with the person-card at the top of the right column against at the head of the page, if you think the choice is close.

## Format
One HTML page in `docs/design/mockups/december/` on `design-december-mockups` (suggest `14-player-screen-for-the-player.html`), light and dark side by side, buttons as plain blocks, tokens from `docs/06` only (the book's type through the tokens creation already uses), existing parts wherever one exists. PNGs with index rows. A proposal note in `docs/design/notes/`: a table of every part of today's screen → where it sits now → why (its frequency); what you checked (the uiux self-review) and what you could not; the things you are least sure of.

## Boundaries
- A proposal, not ruled, until Francis approves the pictures; mark it so.
- No new behaviour: every control on the page exists today, or is listed for the lead as new with its frame.
- Hidden means hidden; rules-agnostic (invented names: no real game's words); calm (one accent at most; no explainer lines; 44 px targets with 8 px between; nothing under 14 px).
- Francis's usage is tight this week and you run on the dearer model: draw the six frames, one render pass each if you can, one browser at a time, and stop; no extra variants.
- When done, tell the lead the page's path, the commit, and what you are least sure of.
