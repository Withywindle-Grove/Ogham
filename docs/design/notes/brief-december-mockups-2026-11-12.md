# Brief for the Design Studio: the December mockups (2026-11-12)

From the lead. Read this first; start from it and the files it names, not from history. **If unsure, stop and ask me; don't guess.**

## Why
Francis ruled today: "I want mockups that I approve before we build anything visual in the app" (planning answer 43). Every December piece below has a visible part and no approved picture, so none of it can be built until you have drawn it, I have reviewed it and he has said yes. You are now the pace-setter for the build.

## Output and format
- One HTML file per proposal in `docs/design/mockups/` (a new folder `december/`), light and dark side by side on the same page, buttons as plain blocks, tokens from `docs/06` only, words by 06's voice guide. Invented examples only (a harbour of linked spots, "the jetty", "the wreck", "Someone fell in"); no real game, book or adventure names.
- Each page also as a PNG in `docs/design/mockups/december/png/`, with a row in `docs/design/mockups/index.md`, pushed to your branch so I can give Francis a GitHub link (he reads on an iPad).
- The iPad and the PC first, the phone a distant third (mc-9); a 375 px width is still checked.
- **Work in the order below and report after each set**, so I can put a set to him while you draw the next. A report says: the files, the open questions as a numbered list with your pick for each, your self-review (Nielsen's ten; every state: empty, loading, partial, overflow, error, offline; contrast; 44 px targets with 8 px between; 375 px; messy data: long names, 0 and 999; no disabled buttons; Undo over confirm; one accent button a screen; never colour alone), and what you could not check.
- Stay consistent with the pages he has approved on your branch: `scene/07` (Move on), `scene/08` (the encounter check as a pop-up), `scene/09` (the town page and the place panel), and the Pack pages.

## Set 1: a place of linked spots (the plan sheet's rows 20, 21, 26, 27, 29, 30, 31)
What is ruled: `docs/design/notes/regions-proposal-2026-11-12.md` ("On the Scene"); rg-1 to rg-4 and pf-11, pf-12, pf-12b in `docs/design/rulings/dec-pack-formats-2026-11-11.md`; mc-21, mc-22, mc-28, mc-28a, mc-28b, mc-28c in `scene-mockup-rulings-2026-11-11.md`; planning answer 39.
Draw:
1. **The page of a place that holds places**, for the GM: its name and one line; where the party is and one level up (rg-1); its areas; its map; **Knowledge** and **Rules** one tap away; its tables; its people who belong to no one area. Never the word "Region" (rg-3).
2. **The map shown whole** in a pop-up (the key is part of the picture: no tappable tags), for the GM and, once shared, for players. Its states: not shared yet, loading, a picture that failed to load.
3. **The Knowledge sheet**: the facts and headed sections; a section shared whole with one tap (pf-11) and how a shared one is marked.
4. **The Rules sheet**: the place's own rules beside the campaign's (rg-2); a rule with a button of its own; a rule's text set out like a page of the book (rt-1); **the line that says which encounter check is in force and whose** when the place's check stands in for the setting's (rg-4), with the setting's rule still one tap away.
5. **Move on between linked spots**, the GM's sheet: each way with how it is travelled and how long; a way with a barrier (extra time, the GM approves); the checks the move will ask for, named first (mc-22).
6. **The players' view**: the ways on with how and how long (mc-28a); the state before anything of the place has been shown (mc-28b: nothing to choose from, said plainly, never a disabled button); tapping a way to propose it, and "proposed" waiting for the GM.

## Set 2: the turn as a guided flow (row 34; mc-30)
For the GM, when a step of the setting's sequence of play is finished the next opens by itself, each sheet with Not now; players get one plainly named prompt that waits, and nothing opens by itself for them; the Scene is where things rest between moves. Draw the steps of one turn in a place explored turn by turn, in the order the rules pack gives them (an invented four-step order will do), with: a rest coming due, a light burning down, a check that hits (hand over to `scene/08`), and the same turn inside a place whose own check stands in (rg-4). Show Not now, and how the GM gets back to a step put off.

## Set 3: the call to adventure, and what players keep (rows 1, 2, 33; tb-1, pf-7, pf-7a)
1. The GM's sheet of an adventure's hooks and a table of rumours: where it lives (propose two places and pick), each hook in its book's words with what it pays, edit before sending, send to a character or the party; a rumour's truth always the GM's.
2. The same hook posted at a place (a shareable section on a public board) and shared from there.
3. What the player sees on receiving one, and where it is kept: kept items in notes, private or the party's, each able to take sub-notes. This is the first piece of Notes: keep it small, and say what you left for the full Notes design.

## Set 4: small pieces
1. **The caller** (planning answer 35): the players name one for the session; players or the GM may change it; where it shows; the caller's tap is the one that proposes a way.
2. **A person's name** (nm-1): the box starts empty; "A player" until one is chosen; changing it later from the menu.
3. **Shop stock for the day** (planning answer 38): a place's list with what is in stock today; the GM marks each thing in or out, or taps to see its chance and rolls at the table (the app never rolls). **Draw both variants so Francis can choose from pictures:** only the GM sees stock; players see today's stock at a place shown to them.
4. **An Undo that is refused** (ud-1, ud-2): the words naming what stands in the way ("Undo the move to the jetty first.").
5. **Importing a pack that has pictures**: picking several files at once; a picture the pack names but the files lack.

## Not in this brief
Magic in play (its own brief, after sizing); the Pack rework and the hand-out (drawn and ruled); the encounter pop-up (`scene/08`); lasting changes to a character and the keep (after the 5th).

## Files to read
The rulings named above; `docs/design/notes/planning-2026-11-11-answers.md` answers 33 to 46; `docs/plans/dec-4-point-travel.md` and `dec-2-3-places-and-port.md`; `docs/06-screens-and-design.md` (tokens, components, words); `docs/05-features.md` only for the section a page touches.

## Boundaries
Mockups and proposal notes only. You report to the lead and never ask Francis for a ruling. You do not edit rulings, 09 or specs. No workers of your own. Where a ruling is silent, draw your pick, mark it as a question, and go on; where two rulings seem to disagree, stop and ask.
