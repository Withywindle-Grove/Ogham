# Plan: the path to first play on 5 December 2026

Rewritten by the lead on 2026-11-12 on the tightened scope and Francis's accepted ranking. It replaces the plan of 2026-11-11 (its decisions 1 to 11 are answers 1 to 23 of `docs/design/notes/planning-2026-11-11-answers.md`). The row-by-row sheet, with real names, sizes and status, is Francis's private copy; this file is its names-neutral summary and the rules of the road. Where they differ on a size, the sheet is newer.

## The night
**How it opens (fno-2, 2026-11-15):** as the app works today: Start session; Depart with the town way and the port; the port's own page under the expedition's top; to leave, End expedition, then Depart. The town's top during such a stay waits until after 5 December.

Saturday **5 December**: the party meets in a port town, buys, takes a call to adventure, sails, and plays the first two places of an island adventure, each a place of linked spots moved between by the turn. Level-2 characters are made in the app in the days before. Rules: classic-advanced, with the campaign's other packs. Encounters are rolled and read in the app; **fights are on paper**. Wilderness travel, camp, Notes proper, the adventure's keep and its ending come after the 5th (answers 24 to 36).

## Rules of the road
| Rule | Where ruled |
|---|---|
| Everything is modelled in the plan; only what falls below the line after ranking is run by hand | answer 37 |
| **Nothing visual is built without a mockup Francis approved.** No mockup: data, rules and tests only, then stop. Pieces already built are approved from pictures of the real screen | answers 43, 45 |
| No migration is merged or pushed without Francis's yes; one batched TEST turn, a backup, then main, in stamp order | db-2 |
| A migration that an unmerged pull request needs may be on the databases first, where no app code reaches it | 12 Nov session |
| One question at a time to Francis; updates held while one is open | answer 42 |
| Town details come after anything that touches the build | 12 Nov |

## The order of work (tiers from the ranked sheet)
Sizes are builder turns left, from the Builder's sizing of 12 November. "Picture" says whether Francis has approved a mockup or a picture of the built screen.

### Tier 1: needed for the night
| Piece | State on 12 Nov | Picture | Left |
|---|---|---|---|
| Creation at level 2: the patron step, the spell learned at level 2, same-named classes show their source, closed classes | Built; patrons' migration live, its pull request held | Waiting (pictures of the built screens) | 1–2 |
| A person's name never the front of an email (nm-1) | To build | Set 4 | 1–2 |
| The port from the pack: the place picker, the town page, its places and people | Picker merging; town page fixing CI; people local | Picker and town page approved; people waiting | 2–3 |
| A place of linked spots: its page, knowledge, rules, map, people | To design | Set 1 | 5–8 with the map |
| Moving between linked spots by the turn; the players' ways on; the caller proposes | Routes live; the move and the ways on built, held | Move on approved; players' view in set 1 | 5–8 |
| A place's own check standing in for the setting's (rg-4) | Ruled | Set 1 (the words) | 2–3 |
| The encounter check after a move; the table's row; the stat block | Built; held for pictures | Pop-up approved; details waiting | 1–2 |
| The turn as a guided flow (mc-30) | To design | Set 2 | 5–8 |
| The call to adventure; rumours; what players keep (tb-1) | To design | Set 3 | 6–8 |
| Finds handed to a character or the stash (pk-1 … pk-5) | Drawn and ruled | Approved (the Pack pages) | 3–5 |
| A purse: coin given, spent, shared (pk-6) | Its data live; the rest to build | The coin line: to confirm | 4–5 |
| Spells cast and abilities with limited uses, a first cut | To size and design; the packs now carry uses | Not briefed | 6–10 (rough) |
| The M5b tag-holders: the hidden-data fixes, the travel day with the clock | One merged; three built, awaiting CI and the second database session | None needed (two cleared by answer 46) | 0–1 |

### Tier 2: wanted for the night
The map shown whole and imported with its pack (3–5); shop stock for the day (3–6, by who sees it); availability as a reminder to roll (½–1); the same item in two books and how a campaign shows its order of packs (1–2, a mini design session); the refreshed Pack screen and the stash as its own screen (5–8); a caller named for the session (1–2); hidden information on an item (2–3); the ship's calls read from the pack (2–3); the second place's barrier on a way (1–2).

### Tier 3: if there is room
One Start session that asks only what is needed (2–3); the town's size (2–4); the pre-made characters read by the app (2); lasting changes to a character (after a design session).

### After the 5th
The keep in two stages (going inside, keys, timed chances, switches); the ending; Notes proper; wilderness and camp on the new screens; fights; the reveal of a hidden way (mc-28c).

## Packs (the Pack Creator; all builds held until Francis approves a batch)
Done for the 5th: the rules pack checked against its book; abilities' uses; the same-item marks; the port reworked from his fuller file with its new quarter and board; the adventure's first two places with their full text, rules, hooks, rumours, maps and pre-mades. Open with Francis: the port's drafts and working names, place by place.

## Dates
| Date | What |
|---|---|
| Fri 27 Nov | **Cut line.** A tier-1 piece without an approved picture and a started build is run by hand on the 5th, and the preparedness script says how |
| Tue 1 Dec | Creation is live; the preparedness script for the night is with Francis |
| Wed 2 or Thu 3 Dec | Dress rehearsal on the live app: Francis as GM, the Tester as two players, on the night's own packs |
| Fri 4 Dec | Nothing merges; packs imported; the campaign set up |
| Sat 5 Dec | First play |

## What paces the plan now
1. **Mockups.** Four sets are briefed (`docs/design/notes/brief-december-mockups-2026-11-12.md`); each needs Francis's yes before its build starts.
2. **Database sessions.** Each batch of migrations needs Francis at his PC for about a quarter of an hour.
3. **One CI lane**, 30 to 40 minutes a run; merges queue behind each other.
4. **Francis's answers**, one at a time.

## Risks
- The mockup rule arrived after ten pieces were built; some may be turned down and rebuilt.
- Tier 1 alone is about 40 to 65 builder turns left (the lead's sum of the column above, not the Builder's), with three weeks and two usage resets; the guided flow, the place of linked spots and magic in play are the three large unknowns, and all three still need a design.
- A Scene that is part new and part old on the night (accepted, answer 11 of the first plan).
- Magic in play has no brief, no size and no plan yet.

## How we know it works
Each piece: its pull request's tests and local review, its manual checks in `docs/testing/<branch>.md`, and Francis's yes on its picture. The dress rehearsal walks the night end to end; whatever fails goes on a "by hand on the 5th" sheet.
