# M5b gate: the walk, step by step (for Francis)

Written by the design agent, 2026-11-05. One step is one screen: **Do** says where to tap, **Judge** says what to think about. The numbers in brackets are the gate list's checks (`docs/testing.md`, "M5b — gate run, in play order"); the three characters you make are the list's H1, H2 and H3. Campaign and account names: `docs/testing/gate-run-cast.md`.

**How to use it.** Don't hunt. If a control isn't where a step says within about ten seconds, that is a finding: say "can't find <label>" and move on. Say what you think out loud to the Design session as you go; it writes everything down and acts on nothing until the walk is over. The labels below come from the specs and the test notes, not from a fresh look at the screens, so a wrong label here is the script's fault, not yours: say so.

**Not yours to do:** 43 and 66 (the builder: the security advisor, production, migrations), 65 and most of 41 (the tester's script: every seeded sheet opens, nothing scrolls sideways), the `pack:check` lines under 59, 60 and 64 (the builder, in a terminal).

---

## 0 · Before you start

| | |
|---|---|
| Where | The preview link the builder sends (not the live site). The same link on all three devices |
| Devices | **GM:** iPad, landscape. **Player A:** a second iPad. **Player B:** a phone |
| Sign in | On each device type the seed address (`seed-gm@grimoire.test`, `seed-player1@grimoire.test`, `seed-player2@grimoire.test`), tap to get a code, **then** ask the builder for "code for GM / Player 1 / Player 2" and type the six digits |
| Look | Light mode first. Steps marked ★ are repeated in dark at the end (Part 9) |
| Already done for you | The seed rebuilt; the fixture pack imported on "Seed · fae-woodland · defaults"; Player B's account given its own name |

---

## 1 · The library and a new campaign (GM iPad)

**1.1 The Rules library ★ [1]**
- Do: from your campaigns list open **Rules library**.
- Judge: are the packs grouped in a way you'd expect (Setting rules · Adventures · Homebrew)? Does the overlay say what it needs ("Needs: …")? Are Browse, Update and ⋯ obvious on each pack?

**1.2 New campaign, choosing packs [2]**
- Do: back, **New campaign**. Name it "Walk test". On step 2 tick **only the zine overlay**, tap Next. Then also tick classic-advanced, tap Next.
- Judge: with the overlay alone, does the screen say in words why you can't go on? Is it clear what to do?

**1.3 Step 3, the app's own settings [3]**
- Do: on step 3 find **App · N settings** (folded). Open it.
- Judge: are these the settings you'd want to decide at the start (starting level and the rest)? Is anything missing or puzzling?

**1.4 One switch for encumbrance ★ [4]**
- Do: scroll step 3 for the row that sets how load is counted (the pack's own name for it, such as Encumbrance or Carrying). Count how many there are. Tap it and pick a choice.
- Judge: is there exactly one row, with every pack's choices in it ("1 of N ▾")? Would you know from its name that it decides carrying? *(Two rows showed in the tester's pass; the builder's fix should be in the preview.)*

**1.5 A pack's rules stay put ★ [5]**
- Do: open a pack's group of optional rules. Toggle two rules near the bottom. Fold the group, open it again.
- Judge: did the rows stay where they were while you toggled? Does each say "changed (the book: …)"? After reopening, are the changed ones on top? Is that what you'd expect?

**1.6 Rules with several choices ★ [6]**
- Do: find a rule with three choices and one with four. Tap the ⓘ beside one.
- Judge: three choices as a row of segments, four as a button reading "1 of N ▾": does the difference feel natural or arbitrary? Does the ⓘ explain each choice in useful words?

**1.7 Create, and the Rules tab [7]**
- Do: **Create campaign**. Open the **Rules** tab. Find a rule marked "can't change once the campaign starts" and tap it. Scroll to **Retire campaign…**.
- Judge: does the Rules tab match what you just chose? Does the locked rule explain itself? Is Retire where you'd look for it (foot of the campaign's rules, above the Setting rules heading)?

**1.8 Folding the menu [8]**
- Do: on the iPad tap the small pill on the divider beside the side menu, twice. *(On the phone later: there is none.)*
- Judge: is it discoverable? Does the folded menu still tell you where you are?

---

## 2 · Characters

### 2A · A guided character in classic-advanced (Player A's iPad, "Seed · classic-advanced · defaults")

**2.1 Scores, kindred, class [9, 10]**
- Do: **+ Make another character** → **Guided**. Enter six scores, one of them 18. On Race and on Class tap a **name** (not Pick) once, then **Pick**.
- Judge: does 18 fit its tile? The counter reads "Step 1", "Step 2", "Step 3" with no total until the class is picked: does that feel honest or odd? Does Pick moving you on (with Undo on the toast) feel right? Is the entry behind a name worth reading?

**2.2 Who they are [11]**
- Do: on **Who they are** enter a name. Read the hit-points line. Look at the Derived fields. Pick a leaning (alignment); tap an alignment's name.
- Judge: is the hit-points rule one clear line? Is AC a number? Does each alignment show one line, with the full text behind its name? Is "only you and your GM see it" clear?

**2.3 Gear [13]**
- Do: on Gear enter starting money lower than a kit's price, pick that kit, tap Next. Then open **Browse the shop ›**.
- Judge: does it stop you in words, without a dead button? Is money first, then kits, then the shop the right order?

**2.4 Review and send [15]**
- Do: on the review tap **Change ›** on Scores, then on Class (pick another class). Tap **Save and leave**, come back, then **Send**.
- Judge: after changing class, were the hit points cleared and did it say so? Is the review a page you'd trust before sending?

**2.5 The GM approves (GM iPad) [15]**
- Do: **Players** tab → the waiting character → **Approve**.
- Judge: does the approval card show what a GM needs? Anything you'd want to see before saying yes?

### 2B · H3: the add-on class (Player A's iPad, "Seed · classic-advanced + the add-on class · defaults"; a second run in "· options on" for the weapon step)

**2.6 The class reaches its races [H3-16, H3-58]**
- Do: Guided → pick a race the add-on's class allows, then the add-on's class. Then start again with a race it doesn't allow.
- Judge: is the class offered only where the book allows it, with "to level N as …" shown? Does the class show its XP modifier here?

**2.7 Weapon proficiencies [H3-12]** *(in the "options on" campaign)*
- Do: reach the weapon skills step. Pick weapons.
- Judge: "Pick N · 0 of N": is the count clear? Is typing a weapon the list lacks ("Other…") findable?

**2.8 An option flipped off [H3-59]** *(GM iPad, then Player A)*
- Do: GM: Rules tab → switch the weapon-proficiency option off. Player A: open the character's full sheet. GM: switch it on again. Player A: look again.
- Judge: does the field disappear with the option off and come back with its value? *(The tester found a "Weapon proficiencies —" tile left behind; the fix should be in the preview.)*

### 2C · H1: an elf enchanter on the phone (Player B, a scratch fae-woodland campaign with every option on)

**2.9 Class limits [H1-53]**
- Do: Guided. Pick a fairy kindred, then try a mortals-only class. Go back, pick a mortal kindred, pick the enchanter.
- Judge: does Pick explain the refusal in words? Is the mortal enchanter allowed, with "needs the GM's special approval" shown? Would a player understand what happens next?

**2.10 Two glamours, and changing class [H1-54]**
- Do: as an elf enchanter reach the Magic step. On the review tap **Change ›** on the class.
- Judge: are the two glamours labelled kindred and class? Does changing the class reopen Kindred? Is that surprising?

**2.11 Traits, first spells, name, trinket, languages [H1-14, H1-55, H1-56]**
- Do: on the trait-list step read the why-line and pick. On first spells roll at the table and tap the row. **Roll a name**. In Gear find the trinket. Skip **Details** in one tap. Pick languages.
- Judge: does each step say why it matters, in the setting's own words? Is "roll at the table, then tap what it shows" clear on a phone? Is anything too long to read on this screen?

### 2D · H2: a knight of a small kindred (Player B's phone or Player A's iPad, the same scratch campaign)

**2.12 The liege [H2-57a]**
- Do: make a knight. On Who they are find **Liege**; tap a house. *(A fighter isn't asked.)*
- Judge: does tapping a house set the alignment and say why? Is that a good surprise or a bad one?

**2.13 Kit for a small character, a one-off, a bonus [H2-56, H2-57b]**
- Do: pick a kit. Look for a swapped weapon, "10 arrows", and an item marked unusable. On the review and then the sheet look for a bonus from kindred or class.
- Judge: is the swap explained? Is an unusable item labelled so you'd know why you still carry it?

**2.14 A Church class [H2-53]**
- Do: start another character, pick a Church class, look at the alignments offered.
- Judge: Chaotic isn't offered: does the screen say why?

*(Retire the scratch campaign when Part 2 is done: Rules tab → Retire campaign….)*

---

## 3 · Day 1 of the trek (GM iPad, Player A's iPad, Player B's phone; "Seed · fae-woodland · defaults" with the fixture's Fen trek mode)

**3.1 Start the expedition [17]**
- Do: GM: on Scene tap **Start expedition**, choose the day-by-day mode, answer **Where?** with a known place.
- Judge: does the place come back with what was shown there before? Is starting an expedition as light as it should be?

**3.2 Weather ★ [18]**
- Do: both players look at Scene: "Weather due · Roll d…". One of them rolls at the table and enters it.
- Judge: is it obvious who should roll? Does the weather card then show on all three devices in words you'd read aloud?

**3.3 The travel card [19]**
- Do: GM: tap the travel card's figure ("<name> N of N") for its breakdown. Tap **Move…**, choose a route, a terrain and a place name. Then **Undo** on the toast.
- Judge: does the breakdown explain the number? Is Move… quick enough to do while talking?

**3.4 A player's activity [20]**
- Do: Player A: under **Around you** tap **Cut reeds**, enter the roll. Open the Pack: the item is there. Tap Undo. Do it again, use one of the items, then try Undo from the log.
- Judge: is it right that a player does this without the GM? Does the refusal after use explain itself?

**3.5 A secret activity [21, 22]**
- Do: Player B: tap **Scout ahead** (it shows its cost). GM: in **Waiting for you** answer **Yes** with a note. Player B: read the answer. Then open **What we know**.
- Judge: does the player see only what they should? Is the GM's answer quick? Is "What we know" a useful place or an empty one?

**3.6 A forced march [23]**
- Do: Player B: **Force march**.
- Judge: "+N points · rest due this evening" and no prompt yet: clear enough?

**3.7 Make camp [24]**
- Do: GM: time strip **⋯ → Make camp**. Players: the Camp card replaces their buttons. Add firewood, **Cook**, each player taps **Eat**. GM: look for who hasn't eaten; use **Give food** for one.
- Judge: does the camp feel like a shared moment or like paperwork? How many taps before the table can talk again?

**3.8 Sleep and watches [25]**
- Do: on the Sleep step look at Player B's line ("Rest due (forced march)"). Set watches: **+ Add** names, then **Split evenly**. GM: change one character's sleep difficulty.
- Judge: are watches by watch (one box each) easy to read? Is it clear who is a caster? *(Cooking's and Campfire talk's Worked · Didn't work · Fumbled row comes after the gate: for now the GM adds those by hand.)*

**3.9 The night, and the next day [26]**
- Do: GM: **Next day**. It stops at the night check. Mark a hit on the night's table; on the Encounter waiting card answer **Which watch?**. **Next day** again. Then Undo the day from its card, and Next day once more.
- Judge: is stopping at the night first what you'd expect? Does the morning summary say the right things in few words? Does Undo put you back exactly where you were?

---

## 4 · Day 2: lost, then a ruin

**4.1 Lost [27]**
- Do: GM: on the travel card **Mark lost**. Check both players' screens. Then **Found the way**.
- Judge: players see nothing: good? Is the GM's view of "lost" clear at a glance?

**4.2 Too far for today [28]**
- Do: GM: **Move…** to a place beyond the day's points.
- Judge: "Entering <place> · N more tomorrow": does that read right?

**4.3 An encounter from a check [29]**
- Do: GM: strip **⋯ → Encounter check**, mark **Hit**. On **Which table?** tap a table, then a row. On the Encounter waiting card try **View**, **Dismiss** (then Undo), **Start**.
- Judge: is the likely table first? Are rows readable (every row shows words)? Three small buttons on the card: the right ones?

**4.4 Every table shows its rows [29]**
- Do: GM: **Table library ›**. Open a lookup table (wages by type), a name table and a treasure table.
- Judge: any row with nothing on it? Any column you can't make sense of?

**4.5 Into the ruin: pieces [30]**
- Do: GM: switch to the dungeon mode. On the place card **+ Piece** (type a line), tap its **eye**. Add a second, show it. Edit the first. **Remove** one, then Undo.
- Judge: do players see pieces in the order you showed them? Is editing a shown piece quiet enough? Is the eye the right symbol for "shown"?

**4.6 Rest due [31]**
- Do: GM: **Next turn** until the strip reads "Rest due". Each player answers **Rest** or **Push on**. GM: flip one answer, then Next turn.
- Judge: is the prompt in the right place on the players' screens? Does the log line ("next rest due turn N") tell you enough?

**4.7 No light ★ [32]**
- Do: put out the group's light (or let it burn out with Next turn). Look at "◑ No light" on the band and tiles. A player taps **Light a torch**.
- Judge: is darkness impossible to miss without being alarming?

**4.8 A status [33]**
- Do: GM: on a character **+ Status**: pick one from a family, set **Until rest**; then **Other…** and type a custom one. Look at that player's screen.
- Judge: does the player see what the status does, and no + Status of their own?

**4.9 Split the party [34]**
- Do: GM: split the party with Player B's character; look at each group's travel card and prompts; join them again.
- Judge: is it clear on every screen which group you are in? Could a table lose track?

---

## 5 · Day 3 and the GM's tools

**5.1 The GM reference ★ [35]**
- Do: GM: tap the **open book** in the top row. Switch between **From the rules** and **The book's GM pages**. Open two entries.
- Judge: can you find a rule in under ten seconds mid-game? Are values in words, not codes?

**5.2 Messages [36]**
- Do: GM: tap **✉**, write to Player B, **Attach** a picture, **Send**; send a second and Undo it within 8 seconds; send a disappearing one. Player B: reply.
- Judge: is it fast enough to pass a note at the table? Do Attach and Send line up with the text field?

**5.3 Close everywhere ★ [37, 61]**
- Do: open the reference, the log's sheet and any pop-up; close each with the **✕** at the top right.
- Judge: is ✕ always in the same place? Did you ever look for a Close button elsewhere?

**5.4 The strip's menu [38]**
- Do: GM: time strip **⋯**. Read what is there (Encounter check, Advance by…). Tap the mode and turn on the strip to open the procedure.
- Judge: is anything missing from that menu, or there that shouldn't be? Are the due marks on the right turns?

**5.5 End session mid-trek [39]**
- Do: GM: end the session. Players: look. GM: **Resume session**.
- Judge: is "Session paused" enough for players? Would you ever end a session by accident?

**5.6 End expedition [40, 45]**
- Do: GM: strip **⋯ → End expedition**. Read the summary. Undo. End it again. Start a new expedition and check there are no old Encounter waiting cards.
- Judge: is the summary what you'd read out at the end of a night? Too long, too short?

---

## 6 · Day 4: a town

**6.1 Arriving [44]**
- Do: GM: during an expedition **Move…** into a place marked **Safe** (mark it on the place card: Safe or hostile). Check players' screens. Then try a Hostile place.
- Judge: the GM gets an arrival card, players nothing: right? Does the card offer what you'd do on arrival?

**6.2 The town screen [46]**
- Do: GM: open the town's place card: **Places in town**, **Things to do**, **Encounters**. Tap the eye (**Show players**) on one shop; then mark it **Closed**; Undo on the toast.
- Judge: at a town not yet shown, the first shop you show also shows the town ("Shown: <town> and <shop>"): helpful or surprising? Does Player B's Scene list only what you showed?

**6.3 Time in town [47, 48]**
- Do: GM: **Next part of day** through morning, afternoon, night, morning. Strip **⋯**: switch **Out and about today** on, then **Active tonight**.
- Judge: do the two switches make sense by name alone? Do players see too much or too little about them?

**6.4 Buying and selling [49]**
- Do: Player B: on Scene under the places in town **Ask for…** → a shown shop → an item → **Send**. GM: **Waiting for you**: read the price and chances, tap **Hit**, then **In stock**. Player B: **Buy it**. Then Player B: **Sell…** an item; GM makes an offer; Player B **Declines**.
- Judge: is this quicker than doing it by voice and typing the result? Where does it drag?

**6.5 Lodging and the morning [50]**
- Do: Player B: **Where you stay** → pick a shown lodging. GM: Next part of day from night to morning; read the overnight card.
- Judge: is the cost where you'd look for it? *(Healing on a good night's rest comes after the gate; for now the card shows the rule as text.)*

**6.6 Downtime [51]**
- Do: GM: strip **⋯ → Start downtime**; then **⋯ → End downtime**.
- Judge: is it clear a full rest was applied, once? Is the way back obvious?

**6.7 A setting with no town mode [52]**
- Do: GM: in "Seed · classic-advanced · defaults" mark a place Safe and open it.
- Judge: does the town screen still make sense with this setting's own services?

---

## 7 · The sheet, the Player screen and the Pack

**7.1 The full sheet on a tablet [64]** *(Player A's iPad, a character with magic)*
- Do: open **Full character sheet**. Tap each Combat tile; tap a trait chip; switch the Magic tabs; read Advancement.
- Judge: two columns: is the order what you'd reach for in play (Combat, Saves, Movement, Pack load, Skills | Abilities, Traits, Magic, the setting's groups, Advancement)? Does every number explain itself on a tap? Anything shown that doesn't apply to this character?

**7.2 The full sheet on the phone [64, 62]** *(Player B)*
- Do: open the sheet. Open two folded sections, close the sheet, open it again.
- Judge: do the one-line summaries tell you enough to leave sections folded? Did it remember what you opened?

**7.3 Figures and the Player screen [57]** *(Player A)*
- Do: on the Player screen tap a skill, a save and a weapon at hand. The list of traits with uses is headed **Traits**.
- Judge: does each pop-up read the same as the sheet's? Is **Open <item> ›** at the foot of the weapon's breakdown useful?

**7.4 The Pack [60, 64]**
- Do: open **Pack**. Read the load at the top. Open **Tiny things**. In a campaign with slots, look for two bars, the slower saying "sets your speed".
- Judge: do the Pack, the sheet's Movement and the travel card agree on speed? Is "items", "Equipped", "Stowed" the same wording everywhere?

**7.5 Options that behave [59]** *(GM iPad, "· options on" and "· defaults" side by side if you can)*
- Do: Rules tab: turn an option off that has an add-on under it; apply a **preset**, read its preview, Undo it; change the carrying rule and read the question it asks.
- Judge: does an add-on leave with its parent? Is a preset's preview enough to trust it? Is "Run by hand ›" clear about what the app won't do?

---

## 8 · Two sweeps

**8.1 Hidden stays hidden [42]**
- Do: GM first: write a GM-only note on a place, add a piece and leave it unshown, and note which table is GM-only. Then on Player B's phone and Player A's iPad look through Scene, the log, Rules and the reference.
- Judge: can either player see the note, the unshown piece, a GM-only table, a secret check, or the other player's leaning anywhere? One sighting is a failed gate.

**8.2 Underlines and the phone [63, 41]**
- Do: on the phone, through the screens you've used: look for any action drawn as underlined text (allowed: ‹ back links, "… ›" links, Help me choose, a dotted underline on a heading you tap to edit, and Undo on a toast). In the edge-case campaign open the character with the 40-character name and the one with nothing.
- Judge: anything clipped, anything that scrolls sideways, any button too small for a thumb?

---

## 9 · Dark mode (the ★ steps)

Switch the theme (**⋯ → This device → Theme → Dark**) and repeat 1.1, 1.4, 1.5, 1.6, 3.2, 4.7, 5.1 and 5.3.
- Judge: anything hard to read; any colour carrying meaning with no word or shape beside it.

---

## 10 · After the walk

- Retire "Walk test" and the scratch campaign.
- The Design session reads back one grouped list: ruled · needs a ruling · technical. Bugs go to the builder at once; rulings come to you one at a time.
- The builder does 43 and 66; the tester's scripted results are folded into the same list.
