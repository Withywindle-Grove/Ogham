# The sittings for the test feedback of 19 November 2026

Written by the designer on 2026-11-19 for the driver, who puts these to Francis **one question at a time** and brings his answers back. A sitting is ruled only where its heading says "Held". The plan is [`../../plans/test-feedback-2026-11-19.md`](../../plans/test-feedback-2026-11-19.md); "item 5" is item 5 of his notes, [`../../intents/test-feedback-2026-11-19.md`](../../intents/test-feedback-2026-11-19.md).

**Where this file lives.** The repo has no folder for sitting agendas. Questions gathered for a session with him already live in this folder (`planning-2026-11-11-questions.md`), so this file joins them and no new folder was made.

**How to read a question.** One plain sentence. Then the choices, the recommended one first with its reason, or a line proposed from his own words with "Confirm?". Then what it changes, and whether a mockup follows. Examples are invented.

## The order, and why

Seven sittings, 32 questions, 17 of them "Confirm?". The order unblocks the most building first.

| # | Sitting | Questions | Of them "Confirm?" | What it unblocks |
|---|---|---|---|---|
| 1 | Words | 7 | 6 | **Held 2026-11-19.** Rows B1 to B6 are ready: no mockup needed |
| 2 | The book format and the figures | 5 | 1 | **Held 2026-11-19.** Page M2 (with 3 and 4): the largest build |
| 3 | The weapon's pop-up and the Quiver | 6 | 2 | **Held 2026-11-19.** Page M2 |
| 4 | Skills | 3 | 2 | **Held 2026-11-19.** Pages M2 and M1 |
| 5 | Notices and the head | 2 | 1 | **Held 2026-11-19.** Page M1 (with 4 and 6) |
| 6 | The Player tab's rows | 5 | 3 | **Held 2026-11-19.** Page M1 |
| 7 | The GM's view as the player | 4 | 2 | **Held 2026-11-19**, with a fifth question (7.5). Page M3. New work, and it touches permissions, so last |

After each sitting: one ruling file and one docs pull request (sittings 2 to 7 were answered in one evening and share one pull request). Each ruling ends with its "Docs to update" and its 09 line. His answers, word for word, are in [`test-feedback-2026-11-19-answers.md`](test-feedback-2026-11-19-answers.md).

---

## Sitting 1: Words (7)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-words-2026-11-19.md`](../rulings/dec-test-feedback-words-2026-11-19.md), tfw-1 to tfw-7.** The questions below are kept as they were asked. His answers: 1.1 "Confirm" · 1.2 none of the three: "keep them for character creation where i want more explicit tutorials, drop them elsewhere" · 1.3 to 1.6 "confirm" · 1.7 "keep pack's words. "Missile" capitalized". One question came out of it: does the Armour class pop-up keep its line in character creation (the ruling's ⚑ 1)? Answered the same day, "A": it keeps it (tfw-8, [`dec-test-feedback-words-follow-up-2026-11-19.md`](../rulings/dec-test-feedback-words-follow-up-2026-11-19.md)). Two slips in the questions as asked: 1.1's gate line is creation's, and 1.2's rule is the guide's sixteenth, not its twelfth.

None needs a mockup: each removes or changes words on a pop-up that exists.

**1.1 (item 4).** The Armour class pop-up stops saying "Your GM checks it at the table."
- Proposed from his words: *The Armour class pop-up ends with how the figure is worked out. The line "Your GM checks it at the table." is gone, for a worked figure and for one set by hand.* Confirm?
- Changes: no ruling (the line was carried over from older text). The gate line `docs/testing.md:615` loses those words.
- Mockup after: no.

**1.2 (item 4).** Your rule, "notes should be more about rules than about table dynamics", goes into the words and voice guide. Which of the six lines like it go now?

The six: "Your GM sets the most hit points." (Hit points, with no most recorded) · "Enter the hit points your GM gives you." (creation, a class with no hit dice) · "…Your GM decides what it means at your table." (the end of alignment's note) · "…Ask your GM how yours works." (the end of literacy's note) · "The GM reads the hit from the roll and the foe's armour." (the Attack view, in a setting with a target number) · "The GM rolls for this in secret and tells you what comes of it. The cost applies if the GM says yes." (a secret activity).

- A (recommended): the two closing lines go (alignment, literacy). The other four stay. Why: those four answer "what happens next, and who does it"; without them the screen leaves a gap. The two closers only remind.
- B: all six go.
- C: only the Armour class line now; the rest at the app sweep.
- Changes: 06, Words and voice gains a twelfth rule: *A note says a rule, never how the table runs: no reminder of what the GM does, checks or decides.* No ruling is reversed.
- Mockup after: no.

**1.3 (item 9).** The Attack view stops saying "Rolling the attack here comes with the fight rules, later."
- Proposed from his words: *The Attack view ends with its rows. The line about the fight rules is gone.* Confirm?
- Changes: supersedes the last clause of ah-1 (`m5b-at-hand-actions-2026-11-08.md`); 06:726.
- Mockup after: no (pictures `players/06` and `players/09` keep the old line as history).

**1.4 (item 10).** When a class can't use a weapon, the pop-up says the rule once.
- Proposed from his words: *The pop-up's title is the rule itself ("Warden can't use Shortbow"). There is no "Can't wield" title and no second line, unless the pack's rule carries a note of its own, which then sits under the title. The same for armour and a shield.* Confirm?
- Changes: for this case, the blocked-action pop-up's "the title and one line of why" (06:583).
- Mockup after: no.

**1.5 (item 23).** A later ability reads "at level 3", not "from level 3".
- Proposed from his words: *In the Abilities and Traits lists an ability gained later reads "at level 3".* Confirm?
- Changes: sr-3's wording (`m5b-sheet-review-2026-11-04.md`). Creation's chips ("lv 3", tc-2) are not touched.
- Mockup after: no.

**1.6 (item 5).** The Attack pop-up stops listing the class's figure twice.
- Proposed from his words: *The row "Written on the sheet" is not shown when its number is the class's own figure. When a figure was typed by hand and differs, its row reads "Set by hand", the words the Armour class pop-up already uses.* Confirm?
- Changes: no ruling asks for the row; 06, Breakdown sheet.
- Mockup after: no.

**1.7 (item 5).** You wrote "Ranged"; the approved frame and the pack say "missile".
- Proposed: *The Attack box's small line keeps the pack's own word: "Melee +2, missile +1".* Confirm?
- Changes: nothing (frame P1, ps-9).
- Mockup after: no.

---

## Sitting 2: The book format and the figures (5)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-book-format-2026-11-19.md`](../rulings/dec-test-feedback-book-format-2026-11-19.md), tfb-1 to tfb-5.** The questions below are kept as they were asked. His answers: 2.1 "Confirm" · 2.2 "A" · 2.3 "A" · 2.4 "A" · 2.5 "A". 2.4's choice A was then checked against the Pack tab's approved frames: no frame draws the levels open, so nothing conflicts.

**2.1 (item 17).** Every pop-up on the Player tab takes the book's format: your "Option 2, all three".
- Proposed from his words: *Every pop-up reachable from the Player tab is in the book's format. An entry from the book stays as it is. A figure explained, and the Abilities and Traits lists, take the book format. A pop-up you act in (Hit points, Portrait, the Quiver, an item, a status, Notes, a blocked action) takes the book's red heading and keeps its own buttons, with no "Got it".* Confirm?
- Changes: the plain figure pop-up approved on 2026-11-14 (frames P7 and P7b; sv-2a); 06:583, 06:606, 06:614. The figure pop-up is one part: it changes on the full sheet's page too.
- Mockup after: **yes, page M2.** It also shows what the sketches left open: the Quiver's chosen kind, the red heading over "Set" with its measured contrast, dark, a phone, long names.

**2.2 (item 17).** Does a pop-up you only read end with "Got it"?
- A (recommended): yes, at the right, as an entry from the book does today. Why: one form for everything you read; the sketch you picked drew it.
- B: no button; the ✕ closes it, as on every other sheet (mc-43a).
- Changes: under A, mc-43a gains an exception for the Player tab's reading pop-ups; under B, nothing.
- Mockup after: yes, M2.

**2.3 (items 11 and 21).** A figure's pop-up stops repeating its figure in bold under the title.
- A (recommended): for every figure that is not a roll: Level, Experience bonus, a movement speed. The pop-up starts with its sentence ("Level 2 Warden."). Saves, scores, armour class and attack keep their figure beside the title, as approved. Why: one rule, and your two notes name the same fault twice.
- B: only Level and Experience bonus.
- Changes: sv-2a's pop-up (frames P7, P7b); 06:606 ("the number … in bold under the head").
- Mockup after: yes, M2.

**2.4 (item 16).** A tap on the burden opens its levels in a pop-up, not in place.
- A (recommended): everywhere the load bar shows (the Player tab, the Pack, the full sheet). Why: one part, changed once; and sv-2 already says a tap on a figure opens one sheet.
- B: on the Player tab only.
- Changes: 06:574 ("the tiers one tap away", opening in place). Not checked against the Pack tab's approved frames.
- Mockup after: yes, M2.

**2.5 (item 20).** How does a trait's text get its line breaks?
- A (recommended): the packs write a trait's text in blocks, as place rules already are, and the app sets each block on its own line. A trait not yet rewritten shows as today. Why: the breaks are the book's own, never guessed.
- B: the app guesses where a sub-heading starts. No pack work; it will be wrong on some texts.
- Changes: pf-18 (`dec-rule-text-blocks-2026-11-13.md`) widened to traits; 07. Cost under A: pack work on both packs (E5) and a reader in the app.
- Mockup after: no new one (the book entry's approved parts, cs-41); its built picture in the pull request.

---

## Sitting 3: The weapon's pop-up and the Quiver (6)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-weapon-quiver-2026-11-19.md`](../rulings/dec-test-feedback-weapon-quiver-2026-11-19.md), tfh-1 to tfh-6.** The questions below are kept as they were asked. His answers: 3.1 "Confirm" · 3.2 "A", adding "Eventually we'll repurpose attack for actual attacks when we do combat encounters but for now keep as I just ruled" · 3.3 "A" · 3.4 "A" · 3.5 "A" · 3.6 "Confirm". His evening note on grips (item 30) is kept with this sitting as a ⚑.

**3.1 (items 6 and 7).** On the Player tab a weapon opens one short pop-up: your "Yes, B plus Attack".
- Proposed from his words: *On the Player tab a weapon's name opens the two roll boxes and its qualities ("Qualities: Blunt, Melee"), then Give to…, Put in…, Hide from At hand and Drop, drawn as the Pack tab's newer pop-up (frame PK8). No slot, hands, value or weight.* Confirm?
- Changes: 06:727 ("Its name opens the item's sheet") and the Item sheet's rows of details, on this tab.
- Mockup after: **yes, page M2.**

**3.2 (item 7).** Do the weapon's name and its Attack button open the same pop-up?
- A (recommended): yes, one pop-up from both. Why: each thing once. When fights arrive (M6), Attack gets its own job.
- B: the name opens the new pop-up; Attack keeps today's view of the rolls alone.
- Changes: ah-1 (what Attack opens).
- Mockup after: yes, M2.

**3.3 (item 6).** What do the other things At hand open (a wand, a lantern, a pinned thing)?
- A (recommended): the same short shape: what it does now (its uses, its light left), then the quick buttons. No pack facts. Why: your rule was for the tab, not for weapons alone.
- B: weapons only for now; the rest keep today's pop-up until the Pack tab's own is built.
- Changes: 06, Item sheet, on this tab.
- Mockup after: yes, M2.

**3.4 (item 7).** Does the pin star show on a weapon that is in hand?
- A (recommended): yes, always, in its one place beside the ✕. Filled when pinned. Pinned while in hand means it stays At hand when put away. Why: you looked for it and it was not there.
- B: as ruled: no star while in hand; "Hide from At hand" stands in.
- Changes: under A, the ruling of 2026-11-08 and frame P1's note ("In hand has no star: the star means pinned").
- Mockup after: yes, M2.

**3.5 (item 6).** Is this pop-up built now, or with the rest of the Pack tab's second sitting?
- A (recommended): now, for the Player tab, once M2 is approved. Why: it is what players hold during play. Cost: for some weeks an item's pop-up looks one way on the Player tab and another on the Pack tab.
- B: later, both together, with the Pack tab's row K4.
- Changes: the order of building only.
- Mockup after: no (M2 covers it).

**3.6 (item 8).** The Quiver lists only what is carried.
- Proposed from his words: *The Quiver lists only the kinds the character carries. The lines "What the <weapon> fires. Each shot uses one." and "Out of a kind: it leaves the quiver and the pack." are gone. With none carried, one line says so.* Confirm?
- Changes: the list of every kind, built on purpose (`docs/testing/m5b-at-hand.md:10`); the two lines of `players/06` (a page marked "proposed").
- Mockup after: yes, M2 (the words of the empty line are drawn there).
- Beside it, not his to answer: why his arrows did not show is a pack check (E2).

---

## Sitting 4: Skills (3)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-skills-2026-11-19.md`](../rulings/dec-test-feedback-skills-2026-11-19.md), tfs-1 to tfs-3.** The questions below are kept as they were asked. His answers: 4.1 "Confirm" · 4.2 "Confirm" · 4.3 "A".

The pack answers (E6) are asked at the same time; 4.3's choice A does not wait for them.

**4.1 (item 26).** A skill's pop-up opens with what succeeds and what to roll.
- Proposed from his words: *A skill's pop-up starts with one line: "Succeeds on a 5+", the die's glyph, "roll 1d6", and "+N" only when the rules add a number to the roll. The lines "Base chance for everyone", the class's line, "Higher is better" and the kindred's line are gone. The pack's own text and the source line stay.* Confirm?
- Read this way: a better target from a class or a kindred is already inside the "5+", so it is not a modifier. The pop-up then no longer says where the target comes from; a kindred's part still shows under the skill's name on its row ("4 when wading").
- Changes: 05:107 ("the odds both ways"); 06:606; the gate line `docs/testing.md:612`.
- Mockup after: yes, M2.

**4.2 (item 27).** The Skills heading gets a roll line, like Saves.
- Proposed from his words: *The Skills heading's row carries the die's glyph and the pack's rule: for the [fae-woodland] pack, "Roll d6: target or higher succeeds." It is built from the rules set (a new roll type beside the save's), never typed in. A setting with no such rule shows the heading alone. The [classic-advanced] pack's line waits for the Pack Creator.* Confirm?
- Changes: sv-3 and pf-20 widened to skills; 07.
- Mockup after: yes, M1.

**4.3 (item 28).** A skill's figure reads "5+ on d6".
- A (recommended): wherever the pack's rule is "the target or higher" on one die: "5+ on", the die's glyph, "d6". A pack that rolls another way (a low roll, a percentage) keeps its own style until the Pack Creator answers. Why: your format fits one kind of roll; the other kinds need the book's own words first.
- B: your format for every pack now, the other kinds worded by Design before the answer.
- Changes: 05:107 and CS-5a ("each pack's skills in that pack's own style"); the glyph moves from before the odds to after the number (row C13 of the Player screen's plan).
- Mockup after: yes, M1.

---

## Sitting 5: Notices and the head (2)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-notices-2026-11-19.md`](../rulings/dec-test-feedback-notices-2026-11-19.md), tfn-1 and tfn-2.** The questions below are kept as they were asked. His answers: 5.1 "Confirm" · 5.2 "A".

**5.1 (items 1 and 2).** Notices leave the columns for a box beside a larger portrait.
- Proposed from his words: *On the Player tab no notice sits in the columns, so the two columns always start level. The portrait is larger. Beside it is a notices box, its icon glowing when there is something. A tap opens the notices one at a time in a sheet.* Confirm?
- Changes: the prompts' place above hit points (06:29, the urgent strip; 09, 2026-11-09); ps-5's 64 px portrait. It settles the open ⚑ of `dec-13-the-player-screen.md:139` and `:141`.
- Mockup after: **yes, page M1.** It shows, for him to judge: two sizes of portrait; where the status rings go; the box on a phone; the glow with a count beside it, and with its colour taken away.

**5.2 (item 1).** Which lines go into the box?
- A (recommended): what tells you something happened in play or to your sheet: "No light", the weather lines, a change waiting for the GM or refused, the "To finish" card; later, a status ending and "Ready to level". What is about the screen itself stays where it is: "Opening…", "Couldn't open this character", the offline line, the retired banner. Why: the box is for news; a screen that can't open has nothing else to show.
- B: only the two play notices ("No light", the weather). The rest stay as built.
- C: everything, the offline line and the retired banner too.
- A notice that asks for an act (the weather roll) keeps its button inside the sheet, and stays on Scene as today.
- Changes: 06, the Urgent strip and the Weather card's rows; C11's waiting-change line.
- Mockup after: yes, M1.

---

## Sitting 6: The Player tab's rows (5)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-player-rows-2026-11-19.md`](../rulings/dec-test-feedback-player-rows-2026-11-19.md), tfr-1 to tfr-5.** The questions below are kept as they were asked. His answers: 6.1 "Confirm" · 6.2 "A" · 6.3 "Confirm" · 6.4 "Confirm" · 6.5 "A".

**6.1 (item 13).** Details, folded, shows its heading alone.
- Proposed from his words: *Folded, Details shows the word "Details" and its chevron, and no lines. A tap opens all of it in place.* Confirm?
- Changes: "At rest the first three" (plan row C4; frame P1, ps-9).
- Mockup after: yes, M1. (It is a removal; see the plan's ⚑ 2.)

**6.2 (item 14).** Which rows lose their chevron?
- A (recommended): the experience row only. Why: it is a figure, like the tiles, and the tiles carry none. The list rows (a skill, Notes, Weapon skills) keep theirs: with no chevron a row of words does not look tappable.
- B: every row that opens a pop-up. A chevron then means only "this unfolds in place" (Details).
- Changes: ch-1 (`dec-morning-2026-11-15.md`), for one row under A, for the whole tab under B.
- Mockup after: yes, M1.

**6.3 (item 24).** A score with no modifier shows "+0".
- Proposed from his words: *Under each score its modifier always shows; a score that changes nothing reads "+0".* Confirm?
- Changes: fix 2 of 19 Nov 2026 and row C15 ("a score with no modifier shows none", from frame P1's note). The score tiles are one part: the full sheet's page shows "+0" too.
- Mockup after: yes, M1.

**6.4 (item 22).** "Full character sheet" and its Edit leave the Player tab; Edit moves to "Your characters".
- Proposed from his words: *The Player tab has no "Full character sheet" heading and no Edit. On "Your characters" each card carries Edit, with the quill.* Confirm?
- Changes: plan rows C12 and C6 (frame P1); 05:94 ("no Change portrait or Open buttons" on a card); frame G4 of december/13 (approved 2026-11-13).
- Mockup after: yes, M1 (a second frame for "Your characters").

**6.5 (item 22).** What becomes of the rows under that heading (Weapon skills, Abilities, Traits, Patron, Magic, Notes)?
- A (recommended): they stay where they are, without the heading; on a phone they take the place of the "Full character sheet" row. Why: they are reference, and you want this tab to be the reference sheet.
- B: they leave too; a character's card on "Your characters" opens everything else.
- Changes: plan row C12.
- Mockup after: yes, M1.

---

## Sitting 7: The GM's view as the player (4)

**Held on 2026-11-19. Ruled: [`dec-test-feedback-gm-view-2026-11-19.md`](../rulings/dec-test-feedback-gm-view-2026-11-19.md), tfg-1 to tfg-5.** The questions below are kept as they were asked. His answers: 7.1 "Add scene as well" (so the players' Scene is part of it: the last line of the proposal below is reversed) · 7.2 "A" · 7.3 "A" · 7.4 "Confirm" · 7.5, asked after the read and not written below (which of four player-only actions open to the GM: all four, the requests only, or none), "C": none. The read was made before the sitting ([`test-feedback-2026-11-19-sitting7-gm-read.md`](test-feedback-2026-11-19-sitting7-gm-read.md)); the ruling checks it again and finds five more such actions.

From [`../../intents/gm-view-as-player-2026-11-19.md`](../../intents/gm-view-as-player-2026-11-19.md). **Before it is put to him**, a builder reads which of the player's own commands refuse the GM today (the plan's ⚑ 5). docs/03 says the GM "edits anything, sees everything", so no hidden-data line should move; if a command does refuse the GM, opening it is a change to docs/03 and is asked as one more question, for his yes in words.

**7.1.** From the Players list, the GM opens a character as its player sees it, and acts there.
- Proposed from his words: *In the GM's Players list, "View sheet" opens that character's Player tab as its player sees it. "Pack" opens the Pack as the player sees it. Magic opens the same way. The GM can act there as the player can. The players' Scene is not part of it.* Confirm?
- Changes: 05 and 06 (the Players list's row; today "View sheet" opens the page "Full sheet").
- Mockup after: **yes, page M3.**

**7.2.** Does Magic show for a character with no magic?
- A (recommended): no. The button shows only for a character who has a Magic tab, as the player has none either. Why: each part shows only when the character has it (09, 2026-10-26), and the row is crowded on a phone.
- B: always; for a character with no magic a tap explains in a pop-up.
- Changes: nothing ruled.
- Mockup after: yes, M3.

**7.3.** In the log, whose act is it?
- A (recommended): the GM's, on that character, as every GM act is today. Why: the log says who tapped.
- B: the player's, as if they had done it.
- Changes: nothing under A. B would change hard rule 4's reading and docs/03.
- Mockup after: no.

**7.4.** Where does the GM's Edit go, once "View sheet" opens the Player tab?
- Proposed, following 6.4: *The GM's Edit sits on the Players list, with View sheet, Pack and Magic, as the player's sits on "Your characters".* Confirm?
- Asked after 6.4; if 6.4 is not confirmed, Edit stays on the Player tab for both.
- Changes: 06, the Players list's row.
- Mockup after: yes, M3 (whether it is a fourth button or in the row's ⋯ is drawn there for him to pick).

---

## Not asked

- The pack checks (E1 to E6 in the plan): the Pack Creator's.
- The eight build-now rows (A1 to A8): they bring the screen to what is already ruled.
- His seven questions already answered in the notes (items 1, 3, 5, 7, 12, 18, 19).
