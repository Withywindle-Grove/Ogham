---
status: absorbed
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, row C1; mockup page M1)
absorbed-into: 05 (the Urgent strip; the weather prompt; "Ready to level"); 06 (the working panels line; the Player screen; Notices box, a new row; the Urgent strip; the Weather card; Darkness; Player screen states); docs/09-decisions-log.md (2026-11-19); `docs/plans/test-feedback-2026-11-19.md` (sections C and D). Where the box sits, the portrait's size and the glow are not in 06: page M1 draws them, and nothing here is built before he approves that page
supersedes: nothing as a file. Inside it: tfn-1 replaces, on the Player tab, the prompts' place above hit points (the urgent strip; 09, 2026-11-09) and the 64 px portrait of dec-13 C2 (frame P1; ps-5 already says "the portrait is larger"); it settles the two open ⚑ of `docs/plans/dec-13-the-player-screen.md` on a banner breaking the level tops
---

# The test feedback of 19 November, sitting 5: notices and the head (ruled 2026-11-19)

The fifth of seven sittings (`docs/intents/test-feedback-2026-11-19.md`, items 1 and 2; the questions in `docs/design/notes/test-feedback-2026-11-19-sittings.md`; his answers in `docs/design/notes/test-feedback-2026-11-19-answers.md`). His words are in quotes; anything else is the designer's reading and says so.

**Nothing here is built yet.** Page M1 draws the head; he approves the page first.

## The rulings

| Id | Ruling | His words | It replaces |
|---|---|---|---|
| tfn-1 | **On the Player tab no notice sits in the columns, so the two columns always start level. The portrait is larger. Beside it is a notices box, its icon glowing when there is something. A tap opens the notices one at a time in a sheet** | "the goal is to use the player tab as a reference sheet so notifications are not the correct use of this tab." (item 1); "we increase the size of the portrait … we fill that gap with a notifications box that when tapped pops up the notifications one at a time in a sheet. the box itself would have an icon that glows when you have notifications." (item 2); "Confirm" (5.1) | The prompts' place above hit points; the 64 px portrait |
| tfn-2 | **Into the box goes what tells you something happened in play or to your sheet. What is about the screen itself stays where it is.** The table below. A notice that asks for an act (the weather roll) keeps its button inside the sheet, and stays on Scene as today | "A" (5.2) | Where each of those lines shows today |

## tfn-2, line by line

| The line | Shows today | Ruled |
|---|---|---|
| "No light" | Above the head, on every tab but Scene | **In the box** |
| "Weather due: roll…", "Weather: waiting for the GM to set the season" | The urgent strip, between the head and hit points | **In the box.** The roll keeps its button in the sheet, and stays on Scene |
| A change waiting for the GM, or refused | In the sheet's own column, above its parts | **In the box** |
| The "To finish" card | In the sheet's own column | **In the box** |
| A status ending; "Ready to level" (ruled, not built) | The urgent strip, once built | **In the box**, when they are built |
| "Opening…"; "Couldn't open this character" with Try again | The top of the tab | **Stays** |
| "Setting rules as of <date>, offline" | Above the head | **Stays** |
| The retired banner | The top of the screen | **Stays** |

Why, as put to him: the box is for news; a screen that can't open has nothing else to show.

## Not settled

1. ⚑ **"No light" on the Pack and Magic tabs.** Today the line shows above every tab but Scene. tfn-1 is about the Player tab. Does the line stay as built on the other two, or does the box show there too? Not asked. Until he rules, the other tabs stay as built.
2. ⚑ **"No light" carries a button ("Light a torch (N left)").** By tfn-2's last sentence it keeps the button inside the sheet. That is the designer's reading from the weather roll; drawn on M1 for him to see.
3. ⚑ **What the box looks like with nothing in it, and whether it shows a count.** His words give the glow. The app's rule is no badge or counter without its own ruling (06), and colour by itself carries a distinction only where he has seen it with the hue taken away. M1 draws the box empty, glowing, glowing with a count, and in grey, for him to pick.

## For page M1

For him to judge, as the question said: two sizes of portrait; where the status rings go; the box on a 375 px phone; the glow with a count beside it, and with its colour taken away; the sheet with one notice, with several (one at a time: how he steps to the next), and the weather roll with its button.

## Honest notes

- **The glow is new for this app.** One motion is ruled today (a GM tab with something to act on). A second, on the player's main screen, is his call on the page.
- **A line in the box is one tap further away than a line on the page.** "No light" and the weather roll are things a player acts on. He chose the level tops and the calm tab over that; the Scene keeps both in the page.
- **Not in the table,** because they are not notices: the Light section's own unlit state (a section of At hand), and the toast when a light burns out. The line shown after an Edit is saved goes with Edit (sitting 6, tfr-4).
- **Not checked:** his pictures.

Docs to update: 05 (the Urgent strip; the weather prompt; "Ready to level"); 06 (the working panels line; the Player screen; Notices box, a new row; the Urgent strip; the Weather card; Darkness; Player screen states); 09; the plan's sections C and D. Done in the same pull request as this file. Not touched here: 06's Portrait sheet row (another open pull request changes that line); the portrait's new size goes there once M1 is approved.

09 lines:
- 2026-11-19 — [ui] On the Player tab no notice sits in the columns, so the two columns always start level; the portrait is larger, and beside it a notices box, its icon glowing when there is something, opens the notices one at a time in a sheet (tfn-1, replacing the prompts' place above hit points and the 64 px portrait; it settles the Player screen plan's open ⚑ on banners). Page M1 draws it before anything is built — Francis: "the goal is to use the player tab as a reference sheet so notifications are not the correct use of this tab."
- 2026-11-19 — [ui] Into the notices box: "No light", the weather lines, a change waiting for the GM or refused, the "To finish" card, and later a status ending and "Ready to level"; staying where they are: "Opening…", "Couldn't open this character", the offline line, the retired banner; a notice that asks for an act keeps its button in the sheet and stays on Scene (tfn-2) — Francis: "A"
