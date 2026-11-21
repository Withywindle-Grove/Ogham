# Manual checks: m5b-sheet-revised

**Before you start:** this pull request has a database change (`sheet_changes`). It is on the test project already;
the preview uses the test project, so these checks work there. The main project gets it from your push before the
merge (backup first, `npm run db:backup`, then `npm run db:push`).

Open the pull request's Vercel preview, sign in as a player with an approved character, and open the campaign. Use an
iPad first (both ways round), then a phone. A second browser (or a private window) signed in as the GM helps for 9–12.

1. **The left column (iPad, portrait, from the Player screen's "Full character sheet").** At the top left: the avatar,
   the name in large type, then one line "<Title>, <Class> <level>, <Kindred>" (the title only if your class has one).
   Under it the HP box with − and + (the same as the Player screen), then two tiles, AC and Attack, and the line
   "Tap a figure for where it comes from". Nothing else on the left.
2. **The right column, in order.** Level with its experience bar; Saves (five tiles) with one muted line under them,
   the first sentence of your setting's save rule; Scores (six tiles, each with its plain modifier like "+2") and
   "Tap a score for everything it changes"; Movement as two cards side by side (your speed, and the load tier with
   its bar and "… of … coins"); Languages as boxes; Skills, Abilities and Traits as rows (name left, figure large at
   the right, a dotted line between rows, no arrows); Magic if the character has any; Details and backstory (labels
   in a grey column, values beside, the backstory with a large first letter); then a Notes button with "N notes,
   last one …".
3. **What's gone.** No Combat heading, no hit dice tile, no "Wisdom vs magic"-style tile, no Advancement block, no
   "Worn and in hand / In the Backpack / Carried" rows, no "Change details" button.
4. **Every row opens its rule.** Tap a skill: its breakdown Sheet. Tap an ability and a trait: its entry with the
   pack's text. Tap "Experience bonus": a Sheet with the prime-score table, your band marked. Tap a language box:
   the pack's text for it, where it came from and the source. Tap the title by the name: how it's worked out.
5. **Phone.** The same, in one column: the left column's parts first, then the right's.
6. **Landscape iPad, beside the Player screen.** The play column on the left now starts its line with the title; the
   sheet on the right begins with "Full character sheet", Edit and the Level row (no second HP box).
7. **Edit, details.** Tap Edit. The screen shows Scores, Hit points (Max HP with − and +), Level ("Level N, your GM
   changes it"), then Details as rows. Tap a detail (e.g. a looks row), change the words, Save: the toast says
   "<Label> saved" with Undo, and the row shows the new words. Tap Undo: the old words come back.
8. **Edit, a score.** Tap a score tile: a Sheet with − and +; raise it by one and tap Done. The tile now reads the new
   figure with "was 16" under it, and the foot says "2 changes, 1 needs approval" (your numbers). Tap **Send to the
   GM** (the one dark button). Back on the sheet: the score tile still shows the old figure with "17 waiting", and a
   line at the top reads "Waiting for your GM: Muscle 16 → 17. Sent today…" with **Take back**.
9. **Take back.** Tap Take back: the line goes, the toast says "Took back …", the tile loses "waiting". Send it again
   for the next steps.
10. **The GM approves.** As the GM, open Players: under "Waiting for approval" a card reads "<Character> asks: Muscle
    16 → 17", "From <player>, sent today", with Approve and Refuse; the Players tab's count includes it. Tap Approve:
    the toast says "Approved: …". On the player's sheet (it may take a moment, or reopen it) the score reads 17 and a
    toast says "Your GM approved Muscle 17."
11. **The GM refuses.** Have the player ask again (Max HP this time). As the GM tap Refuse, type a reason, tap Refuse.
    The player's sheet shows "Your GM refused Max HP 8 → 9: <reason>" with OK, and a toast; OK puts it away.
12. **The GM's own edit.** As the GM, open the player's sheet (Players → View sheet → Edit), change a score and tap
    Save: it applies at once, no waiting line.
13. **Notes.** Tap Notes: a Sheet lists the character's notes newest first, each "Today, by you" or "from your GM";
    type a note and tap Add: it appears at the top and the button's line counts it. (If the old sheet had words in
    its Notes box, they show last as "On the sheet".)
14. **The GM's Players tab on an iPad (landscape).** Scroll to the very end: the last row (Inventory) is fully
    visible with some room under it.
15. **A big most HP** (optional, as the GM set Max HP to 150 on a test character): the bar under the HP figure is one
    continuous bar instead of many small segments.

Gallery pictures: no existing section changes. A new section, **sheet-revised** (Sheet rows, language boxes, the
details ledger, the sheet change lines and card, the Notes sheet, the HP box past 20 segments), has no pictures yet:
CI draws them for Design. No baselines were deleted.
