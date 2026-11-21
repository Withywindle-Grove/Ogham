# Manual checks: m5b-creation-retest-2

Use the pull request's Vercel preview (test project) on the iPad, upright (820 px) and on its side (1180 px), then on a phone. Sign in as a player in a campaign with your homebrew pack, and start a guided character.

1. **Kindred and Class keep two columns.** On the Kindred step, tap a kindred's name. Its entry opens beside the list. Do the same on Class.
2. **Approval fold.** On Class, pick a kindred that leaves some classes out. You should see the open classes first, then one row at the end, "N more need the GM's approval", with + at its right edge. Tap it: the closed classes show, each with the sign and why. Tap one: its entry offers Ask the GM to allow it. Ask, then come back to Class: the fold is open, with your pick inside.
3. **Adjust shows tiles only.** On Adjust scores there's no "STR 12 INT 8" line at the top: just the lead and the tiles. Kindred and Class still show the line. Lower a score: its tile says "was 12" (its old number) under the value, then the modifier line.
4. **One column.** On Who they are, Magic, Languages, Weapon skills, Gear, Details and the review, there's no second column, upright or on its side. On Who they are, Derived values is the last thing in the column, under the fields. On Gear, the coin left and the load are at the end. On Languages, "You speak" heads the list. On the review, the cards are one under another. The column fills the screen, with no wide empty sides; the lines of text still stop at a comfortable reading width. On its side, the score tiles are four across.
5. **Outlook and languages fold too.** On Who they are, with a class that can't take some outlooks, the closed ones are under "N more need the GM's approval". On Languages, the ones needing the GM's leave, and the ones your kind can never learn, are under one row: "N more: not open to your kind, or need the GM's approval". Each keeps its own reason.
6. **Name tables.** On Who they are, open "Name tables: N", then Open on a table. It opens as a sheet. The first line is the die and "Roll d20 for each part, then tap the row. Or type your own above.", with your table's own die.
7. **A roll made twice is one view.** On Gear, take a kit with a roll made twice. The sequence shows "Step 2 of N: <roll>, twice" with "Roll dX twice at the table, then tap each result." Tap two rows: both get ✓; with a distinct roll, each also shows "Already rolled" in plain words, with no warning sign. Tap a third row: the status line says to take one off first. Tap a ticked one: it comes off.
8. **Change one roll.** With the kit taken, tap its Change. The kit's entry opens with "Rolled at the table": each roll with its die, what it gave and its own Change. Tap Change on one roll: only that roll opens, with Done. Change it and tap Done: you're back on the entry, with the new result, and the pack shows the new thing.
9. **Put back.** Take a kit with rolls, tap a row, then ✕. The toast reads "<kit name> put back" with Undo. Tap Undo: the sequence opens where you were.
10. **Roll rows.** The trinket (before you pick it), every table sheet and the growth table on Details each start with a Roll row. Where the pack names the die, the row has its glyph.
11. **Starting coin.** On Gear, the coin starts with the die and "Roll 3d6 × 10 for starting coin at the table, then enter it." (your pack's dice). Under the box: "Average value, replace with your roll". The word "usual" appears nowhere on the step.
12. **The liege.** As a knight (or any class with a table that sets the alignment), on Who they are the table's heading is its name alone. Under it: the die and "Roll d8 for your liege, then tap the row; it sets your alignment.", then the pack's own line.
13. **Phone (375 px).** Repeat 2, 7, 8 and 11. Nothing runs off the side; the fold's + is at the right edge.

Gallery pictures, for Design. Design approved the run's pictures on condition of three fixes (#555). The approved creation-shell, creation-final and creation-review pictures are now the baselines. These three are left for CI to redraw (phone and tablet, light and dark), since the fixes change them:
- **creation-gear:** starting coin is a Roll row with the average stepper; "Already rolled" has no sign.
- **creation-who:** the liege's Roll row says what it sets; the heading is "Liege" alone.
- **creation-final-d:** the coin's Roll row has the new words.

What the run's pictures showed (approved):
- **creation-shell:** the fold specimen now shows the approval fold.
- **creation-who:** the closed alignment row sits in an approval fold, and the name sheet's Roll row has the new words.
- **creation-gear:** the Roll sequence draws a roll made twice as one step, and there's a new specimen of a taken kit's entry with each roll's Change.
- **creation-review:** the review's cards are one column on a tablet.
- **creation-final:** the Adjust tiles' "was" line, and four tiles across on the tablet picture.
- **creation-final-d:** the language fold.
