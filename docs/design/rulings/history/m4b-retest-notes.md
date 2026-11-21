---
status: absorbed
milestone: m4b
absorbed-into: docs/design/rulings/m4b-retest-design-rulings.md and m4b-retest-rulings.md (these are the gate notes they came from)
supersedes: —
---

# M4b re-test: notes collected (2026-10-26)

Collected during the re-test without acting (gate workflow). Grouped at the end.

## Results
- Test 1 A1 (no Ogham saying): ✓ pass (iPad).
- Test 2 A4 (Join, Which way? choice cards): ✓ pass.
- Test 3 A7 (player ⋯ order): ✓ pass (iPhone, dark).
- Test 4 A12 ★ (live updates, incl. after lock): ✓ pass.
- Test 5 A2 (New campaign, three steps): ✓ pass.
- Test 6 A3 (hold to drag character fields): ✓ pass for dragging. (My checklist line wrongly said a tap opens a field; here Edit opens it, the row itself does nothing.) Edit: ✓ pass.
- Test 7 B15 (Rules for this campaign first, collapsed groups, source tags): ✓ pass.
- Test 8 Ruling 4 ★ new (optional rules in one place; Setting rules read-only): ✓ pass.
- Test 9 Ruling 1 ★ new (GM ⋯: Companies, This device; "Players · N waiting"): ✓ pass.
- Test 10 B21 ★ (Fixed level capped per class): ✓ pass.
- Test 11 A5 (one short instruction per guided step): ✓ pass (the guiding lines were right). Many creation problems found, below.
- Test 12 B17 (race and class, list and detail; ▲ not allowed): ✓ pass with design notes.
- Test 13 A6 (guided heading and lines): partial. ✓ heading "<Race> <Class>"; ✓ alignment line. ✗ no hit points on the screen (so no line); ✗ literacy not on the screen; ✗ languages have no guiding line.
- Test 14 A9 (score messages on Next): ✓ pass.
- Test 15 B21 ★ (player sees start level: Party's lowest, Player proposes): ✓ pass.
- Test 16 Ruling 6 ★ new (draft, "Not sent yet · tap to continue", reopens at gear): ✓ pass. ✗ after Send it landed on Your characters with no "Sent … to your GM" toast (expected: the campaign with the toast).
- Test 17 Ruling 9 ★ new (GM sees nothing of a draft): ✓ pass.
- Test 18 A6 (GM waiting card, review layout): ✓ pass.
- Test 19 B18 (send back with ticked sections; full-screen review, pinned note): ✓ pass.
- Test 20 Ruling 7 ★ new (Gear reopens the shopping): ✗ fail. First tap on Gear showed the old "can't be changed here. Ask your GM" message; later Gear opened the shopping and adding an item worked; then "Resend to the GM" did nothing (maybe a light tap; to retest on my side).
- Test 21 Ruling 8 ★ new (refund when removing a purchase before approval): ✓ pass.
- Test 22 B18 (Resend pop-up: still to do, Fix …, Resend anyway): ✓ pass.
- Test 23 A8 (Your characters, one tap opens; sent-back opens its review): ✓ pass. Note: opening a character from Your characters felt finicky; it took several taps in different spots before it opened.
- Test 24 B20, A13 (full sheet: Combat first, ability tiles, no "From your setting" heading): ✓ pass.
- Test 25 B25 (gear that stops casting): not testable live: the magic-user can't equip plate (A10 blocks it, correctly), and no real pack has a case where gear is allowed but stops casting. Covered by automated tests; Francis suggests it can wait for a later release.
- Test 26 A10 ★ (equip against class rules blocked, pop-up with reason and source): ✓ pass.
- Test 27 A10 ★ (two-handed weapon with a shield → Stow the shield): ✓ pass, both buying straight to At hand and moving from the backpack to hand.
- Test 28 B19 (Add item's Put it list: groups, room left, Full, button names the place): ✓ pass.
- Test 29 B24, B19 ★ new (how many + destination list; Give and Put it remember the last place for that kind): ✓ pass.
- Test 30 B23, Ruling 5 ★ new (partial give: toast Undo merges back; refused once the given part changed): ✓ pass.
- Test 31 B23 + Undo twice ★ (drop toast Undo; log Undo; second Undo refused, nothing doubles): ✓ pass.
- Test 32 A11 (errors as toasts, offline): ✓ pass.
- Test 33 B16, Ruling 2 ★ new (buttons; Companies ⓘ without titles): ✓ pass.

## Feedback
- Design: GM Players screen (iPad landscape): a big gap between the player column and the character lines. Francis suggests naming the player in each character's line instead of a separate player column.
- Technical (spotted in the screenshot): GM Players character lines read "THAC0 [attack bonus] 19"; #103 ("Card line: bracketed asides dropped") was meant to drop the bracketed aside. Check whether this line uses a different path.
- Needs a ruling / likely bug: Freeform creation has no way back to "Which way?" to switch to Guided (no back link).
- Design (question): Arrange this screen feels extraneous; Francis asked whether it applies to one screen or each. (Answer: the Player screen only, one arrangement per character, same on every device.) Keep it?
- Design: the Player screen looks unfinished: the stat line and HP ("Not set", − / +) are plain and not useful. Wants it designed (mockups in the Project).
- Design: the ⋯ menus (player and GM) have too much space between items; add a symbol to the left of each item (Companies, Your characters, …) so they pop. Mockups in the Project.
- Small fix: GM's "Invite a player" panel stays open after switching to Rules and back to Players; Francis wants it to close when you leave the tab.
- Question: on Character fields, should tapping the row open the field (as in Arrange this screen), or is Edit enough?
- Design: field editor's category (group) is free text; Francis wants to pick from the categories already in use, or add a new one.
- Fix: "New characters start at": the Fixed level stepper shows below the last option (Player proposes, GM approves); it should sit right under "Fixed level". Screenshot: iPad dark, stepper at 4 sits after the Player proposes card (~/.claude/uploads/.../758d3d49-image.png).
- Words: the button "Change in Rules for this campaign" becomes "Change rules for this campaign".
- Needs a ruling: rules save at once with no sign they saved; Francis wants a small "Saved" toast, delayed after the last tap (e.g. tapping + ten times) so it shows once the entry is done. Note B23 says "other actions stay silent": this would add a confirmation toast for settings.
- Creation (iPhone, guided, setting-1 pack), Francis: "still a lot of problems with character creation":
  - Bug: the class detail sheet on phone has no way out (no close or back) to look at other classes once one is opened. Also the class name shows twice (sheet title and heading). Screenshot: ~/.claude/uploads/.../e20b1a78-image.png.
  - Bug: ability scores still don't show the prime requisite, and still let a score go below a class or race minimum.
  - Bug: no back link between creation steps; "Change" beside the class goes back to the start of creation instead of the class choice.
  - Design (previously asked): the "Who they are" step still shows abilities and the auto-filled values; Francis wants those hidden until the character screen.
  - Missing: no explanation or steps for weapon proficiency, languages, or secondary skill.
  - Bug: Race shows blank even though it should be filled (and so hidden).
- Design (iPad landscape, Player tab with the full sheet open on the right): everything about the character on the left (Player screen) is repeated on the right (full sheet). Francis: what's the benefit of the left? Use all the space for the sheet. Screenshot: ~/.claude/uploads/.../29fb15fd-image.png.
- Design (iPad landscape): race and class selection are squeezed into the middle; give both columns (list and detail panel) more room. Screenshot: ~/.claude/uploads/.../0a540bcf-image.png.
- Bug (iPhone portrait): once a race is opened (detail sheet) there's no way back to pick a different race; same as the class sheet.
- Noticed in the screenshots (to check): an ability reads "INTb" / "INTB" on the Player line and sheet tile (a field label typed during testing?); HP and AC show "—" on the sheet; the race detail shows the Choose button above the details, and only Languages as detail.
- Design: Starting kits on phone are cramped and hard to read (name and price squeezed into a narrow column beside the contents); only one kit is ever listed. Unless a rule limits a class to one kit, offer a choice of kits. Screenshot: ~/.claude/uploads/.../bbd89f2b-image.png (kit 69 gp with 40 gp left).
- To check: closing the app on iPhone asked for a new sign-in code; after signing in it opened the campaign, not creation. The iPhone browser looks to be in private mode (the icon in the address bar), which forgets the sign-in; check on a normal tab before calling it a bug.
- Bug/needs check: changing a score against the rules (override) before Send didn't ask for a reason for the GM.
- Needs a ruling / plan: the creation shopping ("Buy an item" box) does not use the Add item interface the Pack uses (search, categories, the destination list). Francis expected them to match. Not in 05 or the roadmap as far as I can find.
- Words: the ability tile explanations read like machine data, not plain words a novice understands.
- Bug/check: the tap target for opening a character from Your characters is unreliable (needed several taps in different places).
- Design: on the full sheet, tapping Hit points, AC, THAC0 and Level should explain each, including the modifiers that make it up (today only the ability tiles open, and "How it's worked out" is separate).
- Gaps: the full character sheet is missing things Francis expected: class isn't shown; race is blank. Screenshot ~/.claude/uploads/.../b13b1fec-image.png (iPad dark) also shows Alignment, Movement, Weapon proficiencies, Secondary skill and Literacy as "—", and a second "Combat" heading (Movement, Weapon proficiencies) lower down besides the Combat block at the top.
- Design: on the Pack, gear groups start collapsed; at least At hand and Worn should start open (today an extra tap before anything useful).
- Bug: opening a container's sheet by accident (Sack, while aiming for Plate mail) left no way out except one of its options; tapping outside or a back control should close it.
- Needs a ruling (Francis): when a character has no race, default to Human for most settings; a pack could name another default. Checked the private packs: neither setting-1 nor setting-2 names a default race (no such field in 07 yet), so this needs a pack field (e.g. `defaultRace`) or an app default. Also check why this character has none (made before the race step, or freeform?).
- Words: "Put it…" on an item feels obscure when you want to equip it; think of other words (e.g. separate "Wear" / "Hold" / "Move to…").
- Bug: Add item on iPhone opens scrolled down (starting at Ammunition); the categories above (Weapons) were off-screen. It should open at the top. Screenshot: ~/.claude/uploads/.../ff3a2bc5-image.png. Also, there the back link reads "‹ Test Gate", not "‹ Pack" as 05 describes.

## Grouped list for the design Project (2026-10-26)

**Results:** 33 tests. 28 pass, 2 partial (13 A6 guided lines; 16 draft lands without the "Sent" toast), 1 fail (20 ruling 7, sent-back Gear), 1 not testable live (25 B25, automated only), plus test 6's tap-to-open line was my mistake. All five gate failures now pass: equip (26, 27), start level (10, 15), undo twice (31), partial give (30), live updates (4).

**Bugs against what's already ruled (Claude Code fixes; no ruling needed):**
1. Ruling 7: sent-back Gear first showed "can't be changed here"; Resend after adding gear did nothing (test 20).
2. Ruling 6: after Send, lands on Your characters with no "Sent {name} to your GM" toast (test 16).
3. A6: hit points not on the guided screen; literacy missing; languages have no guiding line (test 13).
4. Creation sheets on phone (race and class detail) have no way out to pick another.
5. Ability scores: prime requisite not shown; a score can go below a minimum; an override doesn't ask for a reason for the GM.
6. No back between creation steps; "Change" by the class goes to the start, not the class choice.
7. Race shows blank (on the sheet and in creation) when it should be filled and hidden.
8. Fixed level stepper sits after the last option instead of under "Fixed level".
9. GM Players lines still read "THAC0 [attack bonus] 19" (#103 meant to drop asides).
10. Add item opens scrolled to Ammunition, not the top; its back link reads "‹ Test Gate", not "‹ Pack".
11. A container's sheet (Sack) can't be closed by tapping outside or back.
12. Opening a character from Your characters needs several taps.
13. "Invite a player" stays open after leaving the Players tab.
14. Full sheet: class not shown; alignment, movement, weapon proficiencies, secondary skill, literacy blank; a second "Combat" heading.
15. Freeform has no way back to "Which way?".

**Needs a ruling (design):**
1. GM Players screen: drop the player column; name the player in each character's line (removes the big gap).
2. Player screen beside the full sheet on a landscape iPad repeats the same things; give the sheet the whole width? And the Player screen itself looks unfinished (stat line, HP "Not set").
3. Race and class selection on a landscape iPad: wider columns.
4. ⋯ menus: tighter spacing and a symbol beside each item (mockups).
5. Arrange this screen: keep it? Francis finds it extraneous.
6. A "Saved" toast for rules that save at once, shown after the last tap (B23 says other actions stay silent).
7. Character field editor: pick a category already in use, or add one. And should tapping a field row open it?
8. Starting kits: readable layout on phone, and a choice of kits unless a rule limits it.
9. Creation shopping should use the Add item interface (search, categories, destination list)? Not in 05 or the roadmap.
10. "Who they are" step: hide abilities and auto-filled values until the character screen (asked before).
11. Guided steps for weapon proficiency, languages and secondary skill.
12. Default race when none is chosen: Human, unless the pack names one (needs a pack field such as `defaultRace`; neither private pack has one).
13. Full sheet: tapping Hit points, AC, THAC0 and Level explains each with its modifiers; ability explanations in plain words.
14. Pack: At hand and Worn start open.
15. Words: "Change in Rules for this campaign" → "Change rules for this campaign"; "Put it…" → clearer words for equipping.
16. B25 live test can wait for a later release (no real pack case).

**Technical:**
- Not a bug: the sign-in request was in private mode (Francis confirmed, 2026-10-26).
- "INTb": Francis made it in a test; not a bug.
