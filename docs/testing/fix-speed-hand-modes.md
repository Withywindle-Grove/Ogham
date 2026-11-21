# Manual checks: `fix-speed-hand-modes` (a hand-marked speed drives the modes)

On the pull request's Vercel preview (test project), with a campaign whose layout has a Movement (speed) field.

1. Open a character's sheet, tap **Edit**, open the speed field under Details, type `35`, save. **See:** Movement shows 35, and In a fight (and Exploring, Overland, the folded modes) are worked out from 35 by the pack's own rule, rounded down (with a speed / 3 rule: In a fight 11). Tap In a fight: its breakdown starts "35 is written on the sheet."
2. Tap **Undo** on the toast. **See:** every mode goes back to the rules' figures.
3. With a load tracked, repeat step 1. **See:** the modes follow 35, not the load's speed.
4. Type `35 ft` instead. **See:** Movement shows "35 ft"; the modes stay as the rules give them.

Gallery pictures expected to change: none (no gallery specimen has a speed marked by hand).
