---
status: pending
milestone: the Scene redesign (after the M5b gate; mockups first, built in small pieces)
absorbed-into: pending, with the redesign's own rulings and build plans (05 expedition, camp and the night; 06 the party circle, the step sequence, the tokens; 07 for rt-1; 01 for the devices); docs/09-decisions-log.md (2026-11-11)
supersedes: nothing yet. "Tablet first, phone supported" in 01 and the name tiles of the marching order in 06 change when this is absorbed
---

# Rulings on the Scene mockups (2026-11-11, small hours)

Francis's answers, one at a time, on the Design Studio's first mockups (`docs/design/mockups/scene/01` … `06`, draft pull request #620), after sitting 1 of the M5b rewalk. Written on 2026-11-11 by the restarted lead from the sitting's record. The redesign's open questions are in `docs/design/notes/scene-redesign-proposal-2026-11-11.md`; nothing here is built.

## The marching order as party circles (`scene/01`)

| Id | Ruling | Francis |
|---|---|---|
| mc-1 | A circle held to be moved takes the Selected wash and its edge **and** lifts (a shadow, a small rise and growth; still under reduced motion). The glow stays reserved for lights. | "Can we give A a lift too?" |
| mc-2 | Statuses sit under the name, each a symbol with its word. | "A" |
| mc-3 | On a phone, in a rank of three, a status drops its word and keeps its symbol and count; the word is a tap away. The iPad and PC always show the word. | "A" |
| mc-4 | No hit points on the circle. They show beside the formation, under each name, as the app's standard pips; the campaign setting "Show each other's HP" (Yes by default) decides whether players see each other's. Monster hit points stay hidden. | "A, but players can see each other's hit points; is there a reason to hide them?"; "HP pips are fine, they are our standard." |
| mc-5 | With no portrait, a circle shows one initial; two characters whose initials clash show two letters each. The party list follows. | "A" |
| mc-6 | A lit circle's halo has its own token and holds still. A flicker was asked for, then withdrawn. | "Yes and flicker", then "Actually still" |

## The standing screens (`scene/02` … `05`)

| Id | Ruling | Francis |
|---|---|---|
| mc-7 | The app's top bar (the campaign's name, messages, the Log, notes, ⋯) hides as the Scene scrolls down and comes back. | "Can we have a way to hide the strip at the top (containing log) dynamically, and bring it back dynamically?"; "The app's top bar." |
| mc-8 | Travel points are not drawn as dots. The day's travel is **one simple illustrative drawing**: the way marked on foot (the morning's tent, the trail, a pennant where the party stands, dusk). It encodes nothing else; the figure and its plain line carry the detail. | "Let's find a way to illustrate movement points without dots"; "do something cool like footsteps or a leaf blowing in the wind"; "Use the on foot way marked. It's illustrative, not informative in all the detail you're trying to cram into it." |
| mc-9 | The app is built **primarily for the iPad and the PC, the phone a distant third.** Mockups show iPad landscape first, then a wide PC window, then the phone. | "We are building primarily for iPad and PC with phone a distant third." |

## Sequences, camp and the night (`scene/06`)

| Id | Ruling | Francis |
|---|---|---|
| mc-10 | A procedure opens as a panel at the right edge on the iPad and PC, the whole screen on a phone. | "Panel at right" |
| mc-11 | An answer moves on to the next step by itself, with Undo; only a step with several answers has Done. | "Selecting should close the sheet and move to the next step." |
| mc-12 | Camp and the night are two sequences: camp ends at the watches; the night is the GM's. | The split as drawn, with his words for its buttons |
| mc-13 | The button that ends the day reads **"Go to sleep"**; the one that leaves the night reads **"Dawn, Day Four"** (the day's number in words). | "'Go to sleep' not 'Next day'. 'Dawn, Day Four'." |
| mc-14 | In camp a player sees their own steps and a Meanwhile line, not a read-only list of the whole. | "Own steps plus meanwhile" |
| rt-1 | A rule opens one tap from its step, formatted like a page of the book (sub-headings, bold lead-ins, lists, a titled table, its source). The pack format gains structure for rule text; the words stay the book's own. | "A" |

## The pages on the December path (`scene/02`, `07`, `08`, `09`; ruled 2026-11-11, in the planning session)

Put to Francis as one table with the lead's recommendation on each, after he had the pictures (`scene/png/tour/`). His answer: "town b. move on … approve. encounter approve. gm standing approve. yes to all". The proposal's question numbers are in brackets.

| Id | Ruling |
|---|---|
| mc-15 | The town page is variant B, the calmer one: Safety, Out and about today and Active tonight are one fact in the title row that opens a sheet; a place's row keeps its eye only; Open or Closed is set in the place's panel, and a closed place says so in words on its row. [34] |
| mc-16 | A place, a person or a table in town opens in the panel at the right; the town stays on the page. [29] |
| mc-17 | A place's aspects are its pieces, each with its own eye. Needs the pack to carry them apart. [30] |
| mc-18 | No People section on the town: a person sits beside their place and is reached from it or from any mention. Changes 05's ST3. [31] |
| mc-19 | The town's map sits beside the list on a wide window and a tap away elsewhere. [32] |
| mc-20 | The accent colour is also used for a table's title bar, links, the keyed places' numbers and the edge of a person's box. "One accent" stays one accent **button** per screen. [33] |
| mc-21 | One **Move on** for every move; the free jump is its last row. [2] |
| mc-22 | The checks a move will ask for are named before it is made. [20] |
| mc-23 | A way with a problem stays listed with its warning. [21] |
| mc-24 | One **Start session** button that asks only what is needed, the expedition's start inside it. [18] |
| mc-25 | The hour is asked as dawn, noon or dusk where the setting names them. [19] |
| mc-26 | The encounter check opens by itself, as a pop-up, when the day or the move reaches it. [26] |
| mc-27 | The accent button is the first action of Waiting for you; else Move on; else Go to sleep. [1] |

| mc-28 | **Players see the ways on** from where the party is: where each leads, or "not yet explored" for a place they have not found; a link the GM keeps hidden is never sent to them. A player may **tap a way to propose it** to the GM, who makes the move. Changes "GM only" of 2026-10-30. [22] |

| mc-29 | A wilderness expedition can go into a dungeon without ending: when the party is at a place that is a dungeon, or when the GM chooses, **Move on** offers going inside, which switches the expedition to turns; coming out switches back. Built with the redesigned Move on, after the first night of the December campaign (the keep is not on it). | "A" (sitting 2: the party walked to a ruin and could not go in by the turn, F90) |

| mc-30 | **The day drives, for the GM.** When a step of the day's procedure is finished, the next opens by itself in the panel for the GM (after the weather, the course; after a move, its checks; after the day's last move, camp is offered); every sheet has Not now, and the GM can always close one and do something else. **Players get one clear prompt that waits for them**, named plainly; nothing opens by itself on a player's screen. The Scene is where things rest between moves. The GM's standing screen is redrawn around it. | "Your split" (the lead's: A for the GM, B for players), on his own words at sitting 2: "it needs to step the players/GM through the process sheet by sheet, only defaulting back to Scene between moves." |

**How mc-28 came:** "yes to all" did not cover it: the lead's pick in the table was "GM only for 5 December" and Francis had written "move on (players see this too right?)". Put back to him as its own question: "a, one tap away propose".

**Costs and caveats for mc-28:** the links become player-facing under a read rule (a migration, Fable; the Builder sized seeing them at about 2 turns); the proposal is a request to the GM on top of that, not yet sized. Hidden means hidden: a hidden link, and the name of a place not yet shown, never reach a player's device.

## Still open (⚑, not ruled here)

- Where "Go to sleep" doesn't fit (a dungeon's turns, a settlement's parts of the day, downtime): the proposal's question 7.
- Which new camp behaviours come with the redesign (question 17) and which new pieces of the activities page (question 32).
- The values to approve as tokens: the halo, the lift, the panel's widths and veil, the top bar's slide, the pennant's step.
- rt-1's size, from the Pack Creator: a first tranche (the Scene's procedures in classic-advanced) of 1.5 to 2 days of pack work, the whole 6 to 8 days, plus the Builder's part, not yet sized.

## Caveats

- None of this has been seen on a device: the hold and drag, the bar's slide and the halo in light mode are judged from pictures.
- mc-9 changes 01's "tablet first, phone supported"; 01 is updated when this is absorbed, not before.

Docs to update: 01 (devices), 05 (expedition, camp, the night, the day's end), 06 (the party circle, the step sequence and its panel, the tokens, the words), 07 (rt-1), 09.

09 lines:
- 2026-11-11 — [ui] The marching order is drawn as party circles in ranks: the portrait or initials in the centre (two letters where initials clash), a still halo with its own token and a ring that empties for a light, statuses under the name (on a phone a rank of three drops the word), a held circle washed and lifted, hit points beside the formation as pips (mc-1 … mc-6) — "The very first concept we had for this app" (Francis, on mockup `scene/01`) — `design/rulings/scene-mockup-rulings-2026-11-11.md`
- 2026-11-11 — [ui] The Scene's procedures run as step sequences in a panel at the right edge (the whole screen on a phone): an answer moves on with Undo, the rule one tap away formatted like the books (rt-1); camp ends at the watches and the night is the GM's, opened by "Go to sleep" and left by "Dawn, Day Four"; players see their own steps and a Meanwhile line; the day's travel is one simple drawing of the way, marked; the top bar hides on scroll (mc-7 … mc-14) — Camp as built was "long and very difficult to digest or understand step by step" (Francis, sitting 1) — `design/rulings/scene-mockup-rulings-2026-11-11.md`
- 2026-11-11 — [ui] The app is built primarily for the iPad and the PC, the phone a distant third (mc-9) — Every player so far used a computer away from the table; Francis, on the Scene mockups — `design/rulings/scene-mockup-rulings-2026-11-11.md`

## The ways on, for players: how and how long (2026-11-12)

Asked of Francis because the first build of mc-28 sent players only where each way leads (the safe side: nothing marks a cost as shown).

| Id | Ruling |
|---|---|
| mc-28a | **Players see how each way is travelled and how long it takes** ("Rowing, 1 turn"; "Swimming, 3 turns"), for every way they are shown. Francis: "B". At a table the GM says this before the party chooses, and choosing between a quick way and a slow one is the point of a place of linked spots. Hidden means hidden still holds: a way the GM keeps hidden is never sent, and a barrier's note and its need for the GM's approval stay the GM's. |

| mc-28b | **No way's far end is named to a group until something of the place they are standing in has been shown to them.** Francis: "a". A known far end ("a way to the jetty") would otherwise tell players where they are before the GM has described it. Until the GM shows a piece of the place, its players see no ways to choose from. |

| mc-28c | **A way the GM keeps hidden stays the GM's until the GM reveals it; once revealed, the players know it** and it is listed for them like any other way. Francis, on leaving the reveal action until after the December campaign's first night: "with caveat - if gm reveals the knowledge, they'd know it." Until the action exists the GM reveals a hidden way by saying so and makes that move from the GM's own Move on. The lead reads the same caveat into mc-28b: "shown" there means anything of the place the GM has revealed to that group (a piece, a shared section, its map). |

**Costs and caveats.** The read of the ways on (hd-2 with step 4's piece e) widens to carry each way's `by`, `name`, `value` and `unit`; not yet sized. The players' ways-on screen is built only from a mockup Francis has approved (planning answer 43). Two questions on the same screen are still open: a way shown later after being hidden, and whether a known far end may be named before anything of the new place has been shown.

Docs to update: 05 (moving between linked places: what players see), 06 (the ways on), `docs/plans/dec-4-point-travel.md` (piece e), 09.

09 line:
- 2026-11-12 — [ui] Players see how each way on is travelled and how long it takes, for every way they are shown; a hidden way and a barrier's note stay the GM's (mc-28a) — At a table the GM says this before the party chooses, and choosing between a quick way and a slow one is the point (Francis, "B") — `design/rulings/scene-mockup-rulings-2026-11-11.md`
