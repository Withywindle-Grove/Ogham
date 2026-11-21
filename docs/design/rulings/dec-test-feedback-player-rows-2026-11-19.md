---
status: absorbed
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, rows C5, C6, C10 and C11; mockup page M1)
absorbed-into: 05 (Your characters; the Player screen); 06 (the Player screen; the Details ledger's Player screen variant; the List row's level block; Stat tiles); docs/09-decisions-log.md (2026-11-19); `docs/plans/test-feedback-2026-11-19.md` (sections C and D). The redrawn tab and "Your characters" with Edit are not in 06 as pictures: page M1 draws them, and nothing here is built before he approves that page
supersedes: nothing as a file. Inside it: tfr-1 replaces "at rest the first three" of Details (row C4 of `dec-13-the-player-screen.md`; frame P1, ps-9); tfr-2 takes the experience row out of ch-1 (`dec-morning-2026-11-15.md`); tfr-3 reverses fix 3 of 19 Nov 2026 and row C15's "a score with no modifier shows none" (frame P1's note); tfr-4 and tfr-5 replace the heading "Full character sheet" with its Edit on the Player tab (rows C12 and C6 of that plan; frame P1) and 05's "no Change portrait or Open buttons" on a card of "Your characters" as far as Edit goes (frame G4 of december/13 draws no Edit)
---

# The test feedback of 19 November, sitting 6: the Player tab's rows (ruled 2026-11-19)

The sixth of seven sittings (`docs/intents/test-feedback-2026-11-19.md`, items 13, 14, 22 and 24; the questions in `docs/design/notes/test-feedback-2026-11-19-sittings.md`; his answers in `docs/design/notes/test-feedback-2026-11-19-answers.md`). His words are in quotes; anything else is the designer's reading and says so.

**Nothing here is built yet.** Page M1 redraws frames P1 and P2 with these; he approves the page first.

## The rulings

| Id | Ruling | His words | It replaces |
|---|---|---|---|
| tfr-1 | **Folded, Details shows the word "Details" and its chevron, and no lines.** A tap opens all of it in place | "details when collapsed should show only "Details" not the head/face/fur" (item 13); "Confirm" (6.1) | "At rest the first three" lines |
| tfr-2 | **The experience row loses its chevron, and only that row.** The list rows (a skill, Notes, Weapon skills) keep theirs | "Experience doesn't need a chevron as it's not collapsed. Tapping on it to find the rule is app behavior that should be known to the user." (item 14); "A" (6.2) | ch-1, for this one row |
| tfr-3 | **Under each score its modifier always shows; a score that changes nothing reads "+0".** On the full sheet's page too | "abilities with no modifier should show +0" (item 24); "Confirm" (6.3) | "A score modifier of nothing shows none" |
| tfr-4 | **The Player tab has no "Full character sheet" heading and no Edit. On "Your characters" each card carries Edit, with the quill** | "this is out of place. dont put it on this screen. instead add the Edit button with the icon to the "your characters" screen." (item 22); "Confirm" (6.4) | The heading with its Edit in the right column; a card with no buttons |
| tfr-5 | **The rows under that heading (Weapon skills, Abilities, Traits, Patron, Magic, Notes) stay where they are, without the heading.** On a phone they take the place of the "Full character sheet" row | "A" (6.5) | On a phone, the one row "Full character sheet" with its chevron |

Why tfr-2 stops at one row, as put to him: the experience row is a figure, like the tiles, and the tiles carry no chevron. Without a chevron a row of words does not look tappable.

## Not settled

1. ⚑ **Does the page "Full sheet" stay, and what opens it?** After tfr-4 and tfr-5 a player has no row that opens it: its parts are on the Player tab, and Edit is on "Your characters". After sitting 7 the GM's "View sheet" opens the Player tab too (tfg-1). So the read-only page has no door left for anyone. One question: "Is the Full sheet page gone as a place to read, with Edit opening its form straight from the card, or does something still open it?" Until he rules, the page is kept and nothing is removed.
2. ⚑ **Which cards carry Edit:** a character waiting for the GM, one sent back, an archived one? Not read in the code what Edit offers each of them today. Drawn on M1's second frame for him to pick.
3. ⚑ **The experience row still opens how the level is worked out** on a tap; tfr-2 takes only the mark. The row then has nothing that says it can be tapped, which his words accept ("app behavior that should be known to the user"). The self-review will name it on M1 (a control with no sign); his call stands unless he changes it.

## For the builder

- tfr-1: for the GM the hidden fields under their own heading are never folded, as today (06).
- tfr-3: a tile with no modifier is heard today as its name and score alone; with "+0" shown it is heard with its modifier, as the others are. Every tile is one size, as P1's note asks: now because each has a line.
- tfr-3 reverses a test that states today's behaviour (`src/app/player/PlayerP1Fixes.test.tsx`): an ordinary branch, and the driver asks him first, as the plan says.
- tfr-4: the line shown after an Edit is saved, and the "To finish" card, sit on the sheet today. Where "To finish" goes is sitting 5's (tfn-2: the notices box).
- tfr-5: on a phone the order is P2's, with the six rows where the one row was.

## Honest notes

- **tfr-3 undoes a fix made the same day** to bring the screen to frame P1. The frame's note asked for tiles of one size; his note asks for "+0". M1 redraws the tiles.
- **tfr-4 moves Edit two taps away** from the screen it edits (⋯, Your characters, Edit). He chose it: the tab is a reference sheet.
- **Frame G4 of december/13 (approved 2026-11-13) draws a card with no Edit.** M1's second frame redraws that card; G4's other parts stand.
- **Not checked:** his pictures.

Docs to update: 05 (Your characters; the Player screen); 06 (the Player screen; the Details ledger; the List row's level block; Stat tiles); 09; the plan's sections C and D. Done in the same pull request as this file.

09 lines:
- 2026-11-19 — [sheet] On the Player tab: Details, folded, shows its heading and chevron alone (tfr-1, replacing "the first three"); the experience row has no chevron, the list rows keep theirs (tfr-2, an exception to ch-1); a score that changes nothing reads "+0", on the full sheet's page too (tfr-3, reversing fix 3 of 19 Nov). Page M1 draws them before anything is built — Francis: "Confirm"; "A"; "abilities with no modifier should show +0"
- 2026-11-19 — [ui] The Player tab has no "Full character sheet" heading and no Edit; each card of "Your characters" carries Edit, with the quill (tfr-4); the rows that sat under the heading stay where they are, and on a phone take the one row's place (tfr-5). Whether the Full sheet page stays as a place to read is ⚑ — Francis: "this is out of place. dont put it on this screen. instead add the Edit button with the icon to the "your characters" screen."
