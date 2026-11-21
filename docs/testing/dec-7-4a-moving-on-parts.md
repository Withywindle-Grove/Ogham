# Manual checks: dec-7-4a-moving-on-parts

Moving on, as parts (plan `dec-7-linked-spots-screens.md` piece 4a). These parts aren't on any screen yet: you see them on the pull request's Vercel preview, in the gallery and on the layout page. Check on an iPad and a phone, in light and dark.

1. Open `<preview>/gallery.html` and scroll to the last section, **Moving on: where to, the obstacle, one sheet**. You should see the GM's Move on list:
   - one row for each place;
   - each way as a button at the right, with the word over its time ("Rowing / 1 turn");
   - "Hidden from players" with the crossed eye on the sea cave, and its yellow obstacle line;
   - "Somewhere else…" last;
   - "Each move asks for Encounter check (die 1 in 6), after it." in the foot.
2. On the same page, check three sheets:
   - **The obstacle sheet** shows "Obstacle: the breakwater's gap" in a slightly darker box first, then Where, Takes ("4 turns"), Then ("with the breakwater's chance: 2 in 6"), then "Do they get through?" with Yes and No the same size, neither coloured.
   - **The proposed way with no obstacle** says "ASH PROPOSES", "2 of 3" beside the ✕, "Do they go?", with Yes coloured.
3. Still in the gallery, tap a way button on a players' row. The row turns washed, the button gets a tick (a screen reader hears "…, proposed"), and "Proposed by you: waiting for your GM." appears with Cancel. Tap **Cancel**: the row goes plain again.
4. Open `<preview>/layout.html?moveOn=gm`. Tap **Rowing** on "2 The wreck". You should see what the move does, then **Move** (coloured). With a keyboard, press Tab a few times: the focus moves round the step's buttons and never onto the page behind it. Tap **Back**: the list returns, and Tab still stays inside the pop-up.
5. Open `<preview>/layout.html?moveOn=queue` and check the queue:
   - Tap **Open another sheet**, then, inside it, **A proposal arrives**. The proposal must NOT cover the sheet. Wren's proposal shows under "Waiting for you".
   - Close the other sheet with the ✕. Wren's sheet opens by itself.
   - Tap **A proposal arrives** again. The count shows "1 of 2".
   - Tap **Yes**. Ash's sheet opens next.
   - Tap **Not now**. Ash becomes a waiting row; tap that row to open it again.
   - Tap **A proposal arrives** twice, then close the sheet with the ✕. Nothing is answered: both proposals are still listed. Tap **Open the waiting proposals** (a stand-in for the waiting card 5b will place). The sheet opens at the first, with "1 of 2".
6. Open `<preview>/layout.html?moveOn=obstacle-plain`. The block is headed "Obstacle" alone, because this barrier has no name and no place it passes. There's no "Do they get through?", just **Move**, because the GM doesn't decide this one.
7. Open `<preview>/layout.html?moveOn=players-other`. The wreck's row says "Proposed by Wren." with no Cancel.
8. In the GM's list, only one line separates "Somewhere else…" from the foot, not two.
9. On a phone (375 px), open `<preview>/layout.html?moveOn=players`. Every row's buttons sit on their own line under the name, sharing its width. "999 turns" fits, and nothing scrolls sideways.

Gallery pictures expected to change: only the new section `move-on-parts` (phone and tablet, light and dark). It has no approved picture yet.
