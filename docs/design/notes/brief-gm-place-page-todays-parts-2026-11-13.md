# Brief for the Design Studio: the GM's place page with everything today's card holds

Written by the lead on 2026-11-13 (evening). You are a worker: mockups and a proposal note only; you report to the lead, never ask Francis for a ruling, never edit rulings, 09 or specs. If unsure, stop and ask the lead; don't guess.

## Why
Francis moved the redesigned place page up the queue this evening (po-1, `docs/design/rulings/dec-evening-2026-11-13.md`): he had seen rules, the rule button and the calls line placed on today's card first and asked why they are done twice. The builder of the page (`docs/plans/dec-7-linked-spots-screens.md`, piece 5) then stopped, rightly: **set 1's page (01-01) does not say where the things on today's GM place card go.** Frame 18 only says "the buttons to add are there". Nothing is built on the GM's page until Francis has approved a picture that places them.

## The objective
Draw the GM's place page of set 1 with **every part of today's GM place card placed on it**, so a builder can build it without inventing a screen. The rule the lead holds you to (the same as cs-30 for creation): **the redesign dresses the built screen; it removes nothing the build shows.** If you think a part should go, draw it placed and say in the note why you would drop it; the lead takes that to Francis.

## What today's card holds (place each one)
From the built screen (pictures below), the GM's place card carries: the place's name and its line; the pieces, each with its eye; "+ Piece" and Edit on a piece; "Hide all"; "+ Picture" and the picture; "Players see" with Rename; Notes; "Checks here"; for a town, its sections; "Around them"; "Change place"; the **Rules** button and its sheet (built this week); the **calls-to-adventure line** (built this week; its picture on a town card is set 3's 03-01); and, coming, a rule's icon button (mc-49, mc-52).

## Frames to draw
1. **The GM's page at a place of linked spots, with its map**, tablet: every part above placed. "Change place" sits in Move on's slot with today's words and the secondary look (Move on itself is a later piece; no accent button with nothing behind it).
2. **The same place with no map** (a pack with no picture; a place the GM made by hand): what the page's body is then.
3. **A town** on the same page (its sections, the calls line with Knowledge and Rules beside it, as 03-01).
4. **The phone**, frames 1 and 2.
5. **Before anything is shown to players** (the players' side keeps its right column in place and empty, mc-50): what the GM's page shows of that state, if anything differs.
6. **Messy data**: a long place name, twelve pieces, a piece with long words, 0 and 41 calls sent.

Do **not** draw the facts row (Weather, Light, Rest, Encounter check): it has no plan piece yet and stays out of this page for now; leave its place free and say where it would sit.

## New behaviour: list it, do not design it
Set 1 already draws two things the app cannot do today. Do not redraw them; in your note, list each with the frame that shows it, so the lead can plan and rule them:
- the GM's eye on the map (sharing the map with players; frame 3);
- "Spots here" with an eye on each spot (showing a spot to players; 01-01, frame 19).
Add any other thing set 1's page shows that today's app has no command for.

## Output and format
- One HTML page in `docs/design/mockups/december/` on your branch `design-december-mockups` (suggest `11-gm-place-page-todays-parts.html`), light and dark side by side on the same page, buttons as plain blocks, tokens from `docs/06` only, the existing december.css parts.
- PNGs in `december/png/` with rows in `docs/design/mockups/index.md`, so Francis can open them on an iPad.
- A short proposal note in `docs/design/notes/`: a table of each part of today's card → where it sits on the new page → why; the new-behaviour list; what you checked and what you could not (the uiux self-review: Nielsen's ten; every state; contrast; 44 px targets with 8 px between; 375 px; messy data; no disabled buttons; one accent button a screen; never colour alone).

## Files to read
- Set 1's pages and finals on your own branch: 01-01 (variant A), 01-10, 01-11, frames 3, 18, 19 and 22; set 3's 03-01.
- Today's GM place card as built, branch `pictures-for-approval`: `docs/design/pictures-for-approval/dec-7-3/png/*-1-gm-place-card-rules-button.png` (and its README), `dec-12-b/png/*-1-line.png`, `dec-7-2/png/`.
- The rulings the page rests on: `docs/design/rulings/dec-mockup-rulings-2026-11-12.md` (mc-31 to mc-50, ds-1 to ds-3), `dec-mockup-rulings-set2-2026-11-12.md` (mc-49a, mc-51, mc-52), `dec-evening-2026-11-13.md` (rp-10, rp-12, po-1).

## Boundaries
- No new behaviour, no new words beyond a label a placed part already has. Anything you must invent to make a frame hold together is marked ⚑ for the lead in the note.
- The players' page is not in this brief (it has its own frames, and piece 5c builds it from them), except where placing a GM part changes what players see: then say so.
- When done, tell the lead (the Conductor) with the page's path, the commit, and the three things you are least sure of.
