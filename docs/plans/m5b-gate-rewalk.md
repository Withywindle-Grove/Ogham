# Plan: the M5b gate rewalk (live app, fae-woodland)

Written by the design agent, 2026-11-09, night. Draft for Francis ("draft a plan and I'll tell you what's missing"). Rulings behind it: good over perfect (2026-11-09); the walk on the live app, not the seed (Francis, 2026-11-09); the gate list is `docs/testing.md`, "M5b — gate run, in play order" (checks 1–52 and H1–H3), which this plan maps onto a real campaign. The M5b gate covers wilderness, camp, travel and the settlement day; the dungeon walk was M5a's.

## Where and who
- **Where:** the live app (the Vercel address, then tome.withywindlegrove.com at R1), a **fae-woodland campaign with its region pack** (the hex map, roads, settlements, encounter and weather tables: the richest data in hand). Not the test project, not a seed.
- **Who:** Francis as GM on the iPad (landscape); the **Tester** (the agent) as Player A on the PC in Chrome, where it reads the screen and the Log and can hold a second tab; Francis's iPad as Player B when a second player is needed (no phone in the gate; the 375 px checks run on the Tester's narrow window). The Builder watches the Log and the advisors; I keep the list and the findings.
- **When:** after #571, #574, #575 and #576 are live and the packs re-imported; realistic start Tuesday 10 Nov afternoon; ~3 hours of walking, in two sittings if needed.

## Before the walk (Francis, ~30 min)
1. Re-import: fae-woodland 0.3.72, fae-woodland-region 0.5.9 (it already carries the full sources sweep: 1,779 entries with page and section), homebrew-tables 0.1.2, classic-advanced 0.6.85, zine-compendium 0.5.53, the conversion 0.2.62 (the last three for the classic checks 9–13 and 52).
2. A **fresh fae-woodland campaign** (so set-up checks 1–8 run for real): fae-woodland + region attached; the app's defaults; two optional rules flipped on for the walk (the one with a 3-way segment and one 4-way ▾).
3. Four characters: a knight (H2), an enchanter (H1), a friar and a hunter (their exploration abilities: forage, tracking, the kindred's); the Tester plays one as Player A on the PC, Francis's iPad one as Player B; approve them. (Checks 9–16 and H1–H3 run here; the classic-advanced ones in Francis's existing classic campaign.)
4. The Tester restarted with the live account and the gate list; the Builder's `:07/:52` check-ins running; a main backup taken (`npm run db:backup`) before the walk, since it writes to the live database.

## The walk, mapped to the list (checks keep their numbers)
**Sitting 1 (~1½ h): set-up, characters, day 1.**
- 1–8 Library and the new campaign (fae-woodland, region; the overlay checks 2 and 4 run with the zine in the classic campaign).
- 9–16, H1–H3 Characters (the classic ones in the classic campaign; "Add to homebrew" on an Other… pick).
- 17–26 Day 1 on the region's roads: Start expedition at a known settlement; the weather roll; a Move… along a road to a hex with a place; the activities (the region's forage and the kindred's); Scout ahead secret; Force march; Make camp; sleep and watches; Next day with the night check.

**Sitting 2 (~1½ h): day 2, the GM's tools, the town.**
- 27–34 Day 2: Mark lost; a Move… past the budget; an encounter from the region's table (rows, stat blocks, the waiting card); a ruin as a place with pieces (the region has several); rest prompts; No light; + Status (a ring now); split and rejoin.
- 35–43 The GM's tools: the reference, messages, Close, the strip's ⋯, End session / Resume, End expedition, the 375 px sweep (Player B), hidden stays hidden (42: a GM note and an unshown piece first), the advisors (43, the Builder).
- 44–52 Day 4, a town: Move… into a region settlement (Safe), the arrival card, End expedition then Not yet, the town screen with its shops and lodgings, Next part of day, Out and about / Active tonight, Ask for… and Sell…, lodging and the overnight card; **the walk ends on Start downtime** (the button and its log line; downtime itself is not modelled yet); 52 in the classic campaign.

**Added for this walk:** folded into the gate list on 2026-11-09 as **checks 68–73** (section 8; 53–67 were already taken): the Players glow, the full sheet and its approval, At hand, a long table, the T8 class, sources.

## What counts
- **Pass:** every ★ check passes; the rest pass or have a logged finding that doesn't block play.
- **Blocks play** (fix before the tag): a crash, a wrong figure the rules depend on, lost data, hidden data shown, a dead end with no way back.
- **Doesn't block** (post-gate batch): wording, spacing, a missing nicety, a pack gap the book can fill.
- Findings go in `docs/design/notes/gate-m5b-rewalk-2026-11-10.md` as they happen; I group them after each sitting (ruled · needs a ruling · technical), as at the 3.3 walk.

## After the pass
**What holds the tag** (gt-1, gt-2, 2026-11-11, `design/rulings/m5b-morning-rulings-2026-11-11.md`): `m5b` is tagged only once both hidden-data fixes are live (the pack cache and patches, hd-1; the place being entered, fm-2) and F86 and F87 are understood and fixed; the walk can pass before them.

Tag `m5b`, CHANGELOG entry, the fresh-session review and the security advisor (testing.md), the code health check; then the post-gate queue in order: creation retest batch; thief expertise and fighter talents (G-207/208); At hand coatings; the tablet-panels mockup and play test; the Notes, alchemy and demonology sessions; patrons; the converter plan (below).

## Design note from Francis (2026-11-09) and the converter plan
Francis: fae-woodland's settlements, tables and hex maps are the gold standard, so all of it needs presence in the app; his real live campaign will run on classic-advanced, so the converter must work. Two consequences, both post-gate, to plan properly:
1. **fae-woodland as the reference for region data.** Every kind the region pack carries (settlements with services and lodgings, hex places, roads and travel points, encounter tables by terrain, weather by season, rumour and name tables, factions) must have a home on a screen; the gate walk is the first audit of that. I'll write the gap list from the walk.
2. **The converter (fae-woodland → classic-advanced rules) must carry the region's tables into a classic campaign.** Plan to write with the Pack Creator after the gate: which tables convert as-is (names, rumours, trinkets, weather), which need the rules mapped (encounters' stat blocks, treasure, prices), and which are setting-bound. **Francis prioritises which tables convert first**; I'll bring him the inventory to rank.

## Francis's answers (2026-11-09 night)
1. Four characters: knight, enchanter, friar, hunter.
2. Several sittings; collect all feedback, then process; break to build only for something big.
3. The Tester on the PC in Chrome; Francis's iPad is Player B; no phone in the gate (375 px checks on the Tester's narrow window).
4. Region pack: 0.5.9 already has the full sources sweep; Update the campaign to it before the walk.

**Standard (ruled):** what is modelled, designed and approved in fae-woodland is the template and standard for every pack; the homebrew pack's description and trinket tables follow fae-woodland's shape when plugged into classic-advanced.

## Estimate
Prep 30 min (Francis) + 30 min (Builder: backup, Tester restart, check-ins); the walk ~3 h; my grouping ~1 h per sitting.

## Where it stands (2026-11-11, morning)
- **Sitting 1 is done** (steps 7 to 10, checks 17 to 26). Results and findings F61 … F83: `docs/design/notes/gate-m5b-rewalk-2026-11-10.md`. Ruled after it: the gate is finished on function; the Scene tab's redesign is its own next step (09, 2026-11-10).
- **Before sitting 2** (this evening): #617 (the day's Undo keeps the forced march) and #619 (the night check's plain faults) live; a second player account; Francis's rulings on F80 and F81.
- **Sitting 2 adds to the list above:** "Which watch?" at the day-2 camp; food given to a character who has none; the forced march's line and Undo if fm-1 is live.
