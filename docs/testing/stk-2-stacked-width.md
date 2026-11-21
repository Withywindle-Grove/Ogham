# Manual checks: the stacked button's width (stk-2)

Open the pull request's Vercel preview and add `/gallery.html` to its address. Try a phone width (375 px) and an iPad, in light and dark.

1. Scroll to **The stacked button**. Every button is at least as wide as two fingertips (88 px). "Done" and "Buy" are that width. "Ask for escape rolls" and "Leave the dungeon" sit on **one line** each, and their buttons are wider to fit them. No word is split or cut.
2. Scroll to **The shop's stock rows**. On a phone, the Buy button is wider than before (88 px). The long name ("A very long name for a thing the market sometimes has…") still takes three lines. "999 silver" stays on its row.
3. Find **the Magic tab's spells by level** (in the parts section with Use dots). Cast is 88 px wide. "Hush of the long fen at the hour before the tide turns" still takes two lines.
4. Scroll to the last section, **A sheet's foot**, and look at its last three pop-ups:
   - **Moon opals:** Done (the accent) and Add sit side by side at the right, each the same width (88 px).
   - **Signs of the bog lurker:** "Roll them all at the table" is on one line, and its button is as wide as it needs, at the right.
   - **Storm lantern, 4 herons:** Buy, Leave it and Ask the price are all **one width**, the widest one's. On an iPad they sit in one row at the right. On a phone they stack, each at the right, Buy on top, still one width.
5. Scroll to **A night's rest**. Apply rest is a little wider than before (8 px at each side) and still on one line.

## Gallery pictures expected to change

These were found by comparing pictures of `main` (b0f10cc7) and this branch (fe9e96b9) on one PC, phone and tablet, light and dark. The changes are the same in both themes.

- **`sheet-foot`** (phone and tablet, light and dark): three new pop-ups (point 4); the picture is taller.
- **`stacked-button`** (all four): the captions say "on one line"; the long words no longer wrap; the buttons are at least 88 px wide. The phone picture is taller (Buy goes to its own line) and the tablet one shorter (no two-line words).
- **`stock-rows`** (all four): Buy is 88 px wide; on a phone the names break a word earlier, and the picture is taller.
- **`molecules`** (all four): the Magic tab's Cast is 88 px wide.
- **`night-rest`** (all four): Apply rest has 8 px sides instead of 4.

Left out as known run-to-run noise, after looking at each: `creation-final-d`, `pack-load` and `places` (the skeleton's shimmer), `gm-attention` and `phone-navigation` (the Players tab's glow), and `creation-trait-list` (the dashed "Other…" border).

The four 375 px crops of the longest stock row and spell row, before and after, are on the `pictures-for-approval` branch in `docs/design/pictures-for-approval/stk-2-375/` (commit c6df9961).
