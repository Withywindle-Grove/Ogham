# M4b bug-fix re-test checklist (2026-10-26)

For the tablet and phone, online. One line per check: do this → you should see this. Mark each ✓ / ✗ / note.
Use a fresh character where it says so (Your characters → New character). The GM steps need the GM account.

## Character creation (#122)

1. **Gear after a send-back (ruling 7).** As GM, send a character back. As the player, open it → tap Gear → the shopping opens at once (no "can't be changed here"). Add an item → Resend → the toast says it was sent, and the GM sees it waiting.
2. **The "Sent" landing (ruling 6).** Finish a fresh character → Send → you land on the campaign with "Sent {name} to your GM."
3. **Guided screen (A6).** On the guided step: literacy is shown, and languages have a line saying what to pick. Hit points only appear if the campaign asks for them (Rules for this campaign); turn that on to check.
4. **Phone detail sheets.** On the phone, open a race's detail, then a class's → each has "Back to the list"; the name shows once.
5. **Ability scores.** The class's prime requisite shows "· prime". Lower a score below the class or race minimum → ▲ "Below the minimum". Tap Next → it asks "Why? Your GM sees this." Write a reason → as GM, the character shows "Kept below the minimum" with the reason.
6. **Back between steps.** Each creation step has Back to the one before. "Change" by the class goes to the class step, not the start.
7. **Race filled.** Pick a race → the race field is filled from it, in creation and on the sheet (not blank).
8. **Opening a character.** Your characters → one tap anywhere on a card opens it.
9. **Freeform back.** Choose Freeform → there's a way back to "Which way?".

## GM, rules and Pack (#123)

10. **Fixed level stepper.** Rules for this campaign → starting level → choose "Fixed level" → the stepper sits right under "Fixed level" (not after the last option). Choose another option → the stepper goes.
11. **GM Players lines.** The Players tab lines read plainly ("THAC0 19", no "[attack bonus]" aside). Same on character cards.
12. **Add item.** Pack → Add item on the phone → opens at the top (not scrolled to Ammunition); the back link says "‹ Pack".
13. **Closing a pop-up.** Open a container (a Sack) or any pop-up → tap outside it → it closes. Back/Close still work.
14. **Invite closes.** As GM, Players → "Invite a player" → switch to another tab and back → the invite form is closed.
15. **Full sheet.** Open the full character sheet → under the name, "{Race} {Class}" (e.g. "Elf Lantern Warden"). Fields the setting works out (alignment, movement, literacy, and so on) show their values when left empty. Only one "Combat" heading; movement and weapon proficiencies sit inside it.

## B25 live (slot-test-homebrew's Lantern Warden)

16. Campaign with slot-test-homebrew attached. A Lantern Warden puts on heavy armour → it's allowed, with a toast saying it stops casting, and Undo. The status (the pack's name for it) shows on the card and Player screen; tap it → why. The armour's Pack row says it stops casting. Undo (or take it off) → the status goes.

## Ruling 5b: undoing a give after some was used

17. **What's left comes back.** Give part of a stack (e.g. 6 torches) to another character. That character drops 2. Undo the give from the log → 4 come back, toast "4 of 6 torches came back · {Name} used 2".
18. **Moved inside their own pack.** Give some, the receiver moves them to another container in their pack → Undo → they still come back.
19. **Refused cases** (Undo stays tappable and explains why):
    - they used all of it → "none left";
    - the receiver renamed it → says it was renamed;
    - it was identified or revealed since → says so;
    - charges were spent → says so;
    - the receiver gave it on → "{Receiver} gave them to {Next}";
    - anything else changed → "It's changed since".

## Added 2026-10-27: what merged while you were away

### ⋯ menus (#124)
20. **Menus.** Open any ⋯ menu (campaign, character) → each item has a symbol beside it, rows sit edge to edge, "This device" is below a divider, then Rules library, then Sign out last. The companies item reads "Companies". No "Arrange this screen".
21. **Theme and text size.** In This device, change the theme and the text size → each changes only when you tap it (not just by opening the menu).

### Design rulings (#126)
22. **Pack groups open.** On a device you haven't used the Pack on yet, open the Pack → every group starts open. Close one, leave and come back → it stays closed on that device.
23. **Default race.** Guided creation with a setting that has a default race → the race step offers "Use Human", with "Your setting's default" under it.
24. **Race and class on the iPad.** iPad in landscape → the race and class lists use the full width, the list about 40% and the detail about 60%.
25. **"Saved".** Rules for this campaign → change a setting → about 1.5 seconds later "Saved" appears once (not after every tap).
26. **Field categories.** Character fields → a field's category is a list of the ones in use plus "New category…" (choosing it asks for the name). Tapping anywhere on a field's row opens it.
27. **Tap to explain.** On the sheet, tap HP, AC, attack and Level → each says how it's worked out. Tap an ability score → plain words, no codes.
28. **Plain verbs.** Pack item → "Wear" (armour) or "Hold" (weapon, shield), then "Give…", then "Move to…". Add item → the place list is headed "Where it goes". Everywhere it says "Change rules for this campaign".
29. **"Who they are"** in creation → no ability scores and no auto-filled values there.
30. **GM Players tab.** Each line names the player, with "joined" and the date; a player without a character shows "No character yet".

### Player screen (#127)
31. **Layout.** Open a character's Player screen → the HP bar with "N of M", AC and attack at the top, then (only when they have them) Light, Spells, Abilities, At hand, Skills, Saves and coin. Tap a skill or a save → its rules.
32. **Damage pad.** Tap HP → "Damage" and "Heal" (same size), −5 −1 [N] +1 +5 starting at the last amount, then "Take N damage" → HP drops, with an Undo toast. Heal works the same. Tap the number to type a big one.
33. **iPad landscape.** The play column sits beside the full sheet, with nothing shown twice.

### Spells and ability uses (#129, once merged)
34. **Prepare spells.** A caster → Spells → "Prepare spells" → choose from the class's list → the toast says how many, with Undo. They show by level, the highest open; a closed level shows ▸.
35. **Ability uses.** A character with a limited-use ability → Abilities shows its uses as dots. Tap a dot → one used; tap a used one → it comes back. Tap the name → what it does and when uses come back.

### Kit places (#130)
36. **Taking a kit.** Fresh character → Take a kit → wearable armour lands Worn, one weapon or shield In hand while a hand is free, containers first, everything else in the backpack. Armour the class can't cast in, and a stack of weapons, go in the backpack. "Show all" on the kit card groups by those places.

## When done
All ✓ → tell Claude Code "tag m4b". Any ✗ → note what you saw (a screenshot helps) and send the list.

## Re-test notes (2026-10-28, collected; not acted on during the gate)
- N1 (before check 1, phone portrait, sign-in): the title sits low because the sign-in content is centred vertically; when the keyboard opens, the email field and title are covered. Technical (layout).
- N2 (during check 2, phone, guided creation, ability scores): the trade rule isn't enforced. STR raised 8→9 without lowering another score; DEX lowered 7→5 (the rule only lets you lower STR, INT or WIS by 2, and nothing below 9). No ▲ warning shown. Needs a ruling (enforce, or warn and ask why like the minimum) + technical.
- N3 (same screen): the INT label reads "INTb" (a stray "b" after it). Technical.
- N4 (check 2, guided creation, details step): still asked to type Movement, Weapon proficiencies and AC (should be worked out by the setting, not asked). Technical (or ruling if the pack can't supply them).
- N5: Alignment's ⓘ is a good start; Francis wants an example/explanation of each choice (Lawful, Neutral, Chaotic). Needs a ruling (design; content from the pack).
- N6: Secondary skill has no explanation. Literacy's ⓘ says it depends on the setting, but no setting-specific info shows. Francis: if the setting gives no info, don't show the field. Needs a ruling.
- N7: Languages field starts with "Alignment" as a language (placeholder for the alignment language before alignment is chosen?). Technical.
- N8: "Back" and "Later" sit on one row, "Next" alone below; when both exist they should share a line. Technical (layout).
- N9: "Later" returned to the characters page with no in-progress character visible. Francis: remove Later; Back on the first step does that job. Needs a ruling (+ technical: where did the draft go?).
- N10: The check step demands starting money but lets alignment stay empty. Francis: every mandatory field, alignment included, must be filled before going on. Needs a ruling (which fields are mandatory).
- N11: Changed scores (CHA 10 rolled 11, CON 12 rolled 11, STR 12 rolled 11) were never asked for a reason. Technical (ruled: overrides ask why).
- N12: Ability scores show twice on the check step: in Scores and again under Details (with "INTb: 14", which disagrees with INT 11). Technical.
- Check 2 (Sent landing): PASS.
- Check 3: FAIL.
  - N13: Languages is free text. Francis: offer the setting's languages as choices, plus a fillable "Other". Needs a ruling.
  - N14: Literacy: same as N6.
  - N15: There's no "ask for hit points" campaign rule, and the test was wrong to assume one. Francis: hit points are required or not by the setting's rules (classic-advanced requires them, worked out by class); HP belongs in the setting's "use this sheet" spec like ability scores and saves, not a campaign toggle. Guided creation didn't ask for HP (check step said "Not entered yet"). Needs a ruling + technical.
  - N15 (Francis, firm): guided creation must ALWAYS ask for HP when the setting's rules include it (classic-advanced does), prompting the player with the class's die to roll and the CON modifier to add.
  - N15 (refined): show the class's die and modifier, or follow whatever HP rule the setting specifies.
- Check 4: PASS.
- Check 5: first half PASS ("· prime" and ▲ Below the minimum show); second half FAIL / invalid test.
  - N16 (Francis): during the ability-score step a player must not be able to break creation rules at all (ties to N2: block, don't allow). Breaking a rule (override) only happens on the final check/sheet step before sending; that's where the "Why? Your GM sees this." prompt belongs. Needs a ruling (supersedes the current Next-asks-why behaviour).
- Francis paused creation tests: checks 6, 7, 9, 23, 29 skipped (creation is redone in M7, due Dec 6; most creation checks are out of sync with the M7 design). Retest creation at the M7 gate.
- Check 8: PASS.
- Check 10: PASS.
- Check 11: PASS.
- Check 12: PASS.
- Check 13: PASS.
- Check 14: PASS.
- Check 15: PASS.
- Check 16: SKIPPED (Francis).
- Check 17: PASS.
- Check 18: PASS.
- Check 19: PASS.
- Check 20: PASS, except:
  - N17: the ⋯ menu on a character's sheet shows only This device, Rules library and Sign out; the campaign items (Companies etc.) are missing. Francis: while in a campaign, every screen's ⋯ shows the campaign items. Needs a ruling (or technical if already ruled).
  - (seen in the same screenshot) "INTB" on the sheet's ability tile: same as N3. Movement shows "—" on the Player screen (ties to N4).
- Check 21: PASS.
- Check 22: PASS as written, but Francis says the behaviour is wrong:
  - N18: the second "Gear" group is the Party stash's own Gear group (it sits inside Party stash), which reads like a duplicate; and it won't collapse. Technical (collapse) + needs a ruling (how the stash's groups are labelled/shown).
  - N19: Francis's ruling wish: groups start collapsed when At hand has items; otherwise Gear starts expanded. Supersedes the #126 "every group starts open" ruling. Needs a ruling.
  - N18 (Francis): unsure the Party stash should have any groups at all (it reuses the character Pack's grouping: Worn and in hand, In the {container}, Carried, Gear, and the "Other" categories). Needs a ruling.
- Check 24: PASS.
  - N18 (Francis, ruling wish): the Party stash can hold containers (shown as In the {container}), but otherwise has no groups: no Worn, Carried, Gear or Other.
- Check 25: PASS.
  - N20 (Francis): Character fields should be a collapsible section inside Rules for this campaign (shown only when the rules specify fields). Needs a ruling.
  - N21 (Francis): the setting rules list needs one more sentence: "Click and hold to resequence." (words guide: likely "Press and hold to reorder" on touch). Needs a ruling (words).
- Check 26: PASS.
- Check 27: PASS, with:
  - N22: AC should show the setting's default (unarmoured) value when the character wears no armour, not blank. Technical (if the pack gives it) / needs a ruling.
  - N23: explanations for abilities and abbreviations (STR, AC, HP…) should use the long name (Strength, not STR) and add a short description of what it means, from the setting's rules text where the pack has one. Needs a ruling (+ pack content).
- Check 28: PASS. (Check 29 skipped: creation.)
- Check 30: PASS.
- Check 31: FAIL (phone, Oga, Assassin 1, live site).
  - N24: HP shows as a plain "6" tile, not the HP bar with "N of M" (likely no max HP recorded, so it falls back; still should show the bar or say what's missing). AC is missing from the top row (no armour → no value; ties to N22). THAC0 tile is full width alone. Technical.
- Check 32: PASS, with:
  - N25 (Francis): grey out steps that can't be used (e.g. −5 when the amount is 2). Conflicts with hard rule 7 "never a disabled button" (blocked stays tappable and explains). Needs a ruling.
  - N26 (Francis): At hand weapons should show the damage roll with its modifier, and the attack modifier. Needs a ruling (+ pack data).
  - N27 (seen): HP went to −8 after damage (no floor at 0). Check against the setting's death rules. Needs a ruling / technical.
- Check 33: PASS.
- N28 (iPad landscape, creation class/race list, while making a caster for check 34): selecting a race or class far down the list leaves the detail panel scrolled off at the top; the screen should move to (or keep in view) the detail. Technical (creation; may fold into M7).
- Seen in the check 34 screenshot (iPad landscape, Magic-User 1), Claude's observations:
  - N29: the Prepare spells sheet opens as a narrow column over the play column, its title clipped at the top. Technical (layout).
  - N30: on the sheet, Race shows "—" for a new character (check 7 "race filled" not holding), Title shows "Medium". Saves tiles show bare letters "D", "W", "S" (codes, not words; ties to N23). Technical.
- Check 34: FAIL (spell sheet cut off, N29). Francis: retest after spells are fully designed (M7 includes spells).
- Check 35: SKIPPED (ability dots are in M7).
- Check 36: PASS. Re-test finished 2026-10-28.
