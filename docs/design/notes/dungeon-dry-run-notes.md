# Paper dry run 4: dungeon exploring (2026-10-30)

The walk-through behind `../rulings/m5-dungeon-2026-10-30.md` (the rulings file and the specs win). Converted from the design agent's notes: aliases and invented names only; the packs' rules and numbers are replaced by "the pack's …" (the private packs hold them).

Setting: classic-advanced (pack 0.6.2). Adventure: the invented test abbey (`mirefen-abbey-test`). Party: Bram (fighter), Wren (caster), Tamsin (scout), Odo (hireling, Bram's). Lights: Bram a torch, Wren a lantern with oil. Goal: enter the abbey's upper level, explore a few rooms over about 10 turns (the M5 gate's own test), meet a wandering check, a rest and a light running out.
Tests what M5 has built (clock, Next turn, hour track, reminders, Hit/Miss, encounter table row) and what's being built (light, marching order, statuses, Act…, places and Send, dungeon exit).

### What both packs need (checked 2026-10-30) — the run must touch each

Topics only; each pack's actual values stay in the private packs.

| Topic | classic-advanced | fae-woodland |
|---|---|---|
| Procedure order | wandering check first, then the party decides, the GM describes, end of turn | the party decides first, then the wandering check, describe, end of turn (lights, spells, rest) |
| Wandering check | on a fixed turn interval at the pack's chance; on a hit the GM picks the table by dungeon level | on a fixed turn interval at the pack's chance; the dungeon's own table (adventure); noise or bright light raise it, quiet rest lowers it (+ Modifier) |
| Movement | the pack's distance per turn | a multiple of speed per turn, a larger one in mapped areas; no mapping while running |
| Rest | one turn of rest every few turns; skipping it gives the pack's penalty | the same rhythm; skipping it makes characters exhausted |
| Activities | secret doors, room traps (a turn, several, secret), listen (free, once per character per door, GM rolls), force a stuck door (free, noisy), check an item for traps | search an area or object (a turn, a few characters, secret, retry costs a turn), listen (a turn, secret), force a stuck door |
| Lights | torches and lanterns with the pack's durations; light spells | torches, candles (dim), hooded and bullseye lanterns |
| Optional dungeon rules | — | a hostile-dungeon option: doors stick and swing shut, denizens see in the dark, lights may gutter at the pack's chance each turn |
| Hazards | text | moulds and other hazards as text |
| Known routes | — | safe paths option: turns worked out from the route's length, lights and wandering checks for those turns, then a summary |
| Camping inside | — | wilderness sleep rules with a fitting season; campfires usually impossible indoors |
| Dungeon exit rule | none in this candidate | none in this candidate |

## Steps

1. **Going in.** Hour track with check, rest and light markers: yes. Players see when rest is due and their own light: yes, with an easy explanation of rest one tap away.
   - **Francis asks:** how does the GM pick a dungeon from a homebrew or adventure pack? ⚑ Start expedition asks the mode and an optional **Where?**: recent places, **Choose from adventures ›** (site → level → room, the M8b location browser), or type a name. A place whose kind is a dungeon picks Dungeon mode by itself.
   - **Francis:** the hour track should persist across the GM's screens. ⚑ During an adventure, a compact time strip (the pips and Next turn) shows on every GM screen, not only Explore.
   - **Francis:** GMs can make ad-hoc wandering checks. ⚑ "Check now" (from the check marker or ⋯) at any time; logged; the regular schedule carries on.
   - **Francis asks:** what if players don't rest? Answer: on the rest pip, Rested / Push on; Push on offers the pack's condition for ticked names (classic-advanced: not rested, a penalty until a turn's rest; fae-woodland: exhausted); resting clears it (05, already ruled). ⚑ ⓘ on the rest marker explains this in the pack's words, for GM and players.
   - **Francis:** marching order needs a minimised view players can tap to rearrange. ⚑ A compact marching-order strip on players' screens; tap opens it to drag (GM lock still applies).
   - **Francis:** the GM sees the place card by default; the narrative description is shareable (and hideable) to the PCs with one GM tap. ⚑ Changes M5-10 ("the player name shows automatically"): players see nothing of a place until the GM taps Show players; Hide takes it back. Fits "Open for the party" (M8b).
2. **Listening at a door.** (Francis's answers reshape this step.)
   - **Francis asks:** will we design a settlement interface (city, town, village)? ⚑ Yes: a settlement view joins M5b's design (fae-woodland's settlement mode: town days, encounters only when out and about, services, lodging and lifestyle as text; shops and NPCs fill in with M8b).
   - **Francis:** picking a wilderness location or hex matters in that mode too. Start expedition's Where? and Move… cover places and hexes (the location browser from M8b).
   - **Francis:** prompt the players to rest at the right time, or let them rest ad hoc. ⚑ Players get the rest prompt on the rest pip and a "Rest this turn" button at any time; the GM's Next turn applies it (the turn counts as rest for those who chose it; checks still run).
   - **Francis:** the GM can advance turns ad hoc. Already there: Next turn, long-press +N, Advance by….
   - **Francis:** don't distract players with the listening; keep them aware of the rules. ⚑ No "Listening…" or activity prompts on players' screens. Players get a collapsible **Things you can do** reference one tap away: the pack's common player actions with their rules (abilities also open their rules from the sheet). Players come up with actions themselves.
   - **Francis's room flow:** the GM narrates the room and rolls the triggered checks; players narrate actions; the GM drives Next turn. ⚑ Entering a room opens its GM layer (description to share, triggered checks, and anything relevant: trap, puzzle, encounter, treasure, stuck or locked doors) plus a quick **GM screen** reference (the pack's rules, one tap away). Most of the room's contents stay narrative (GM notes).
   - ⚑ Parking lot: modelling traps, puzzles, door states (stuck, locked, spiked) and room treasure as structured things.
   - **Francis (corrects):** traps, puzzles, door states and room treasure as structured things belong in **R2 at the latest** (not the open parking lot). What goes to the parking lot is **modelled player actions** such as listening at doors (Act… in turn modes).
   - **Francis (corrects the listen flow):** she says she listens; the GM checks the in-app referee screen for the listening rule, rolls or tells her to, and narrates. No Act… prompt. The block-or-warn question is moot.
   - **Francis:** the key things are tracking time, when checks occur, the prompts and reminders above, and facilitating narration.
   - ⚑ Act… in turn modes (X-2, confirmed 2026-10-29, D25; M5 step 10) moves to the parking lot; day-mode activities stay (dry run 3, D3). The GM screen reference carries the pack's activity rules instead.
3. **The first wandering check.** The check lands at the right point in each pack's order (classic-advanced first, fae-woodland after deciding actions): confirmed.
4. **Torch out and rest due on the same turn.** Gutter check (fae-woodland, hostile-dungeon option): one roll for the whole party's lights, not one per light.
   - **Francis:** parties sometimes split; we need to track separate encounters, exploration and so on, probably through a temporary duplication. A player taps **Split the party** and says who goes with each group. ⚑ (scope: see reply)
   - **Francis:** when the party is in darkness, players' screens temporarily darken (grey for those with darkvision), with a reminder to make light. ⚑
   - **Francis (split):** each party member gets a pop-up to choose which group they go with. One clock for everyone (he'd do this in game anyway). Separate clocks per group: parking lot. **Asks:** can we run multiple fights at a time? It could happen. ⚑ (see reply)
   - **Francis (darkness):** approved, but the darkening lasts only 3–5 seconds, then the screen is readable again.
   - Torch out and rest due on the same turn: clear.
   - **Francis:** several fights in R1 (run one at a time with a switcher, each paused where it was).
5. **Leaving the dungeon.**
   - **Francis:** players can end the session still in the dungeon; the app needs a record of where they ended. **End session** is the GM's button to wrap up. Leaving the dungeon either happens narratively in play, or through a quick **Leave the dungeon** button carrying the optional rules. Escape rolls were by party in his memory, but it varies by setting.
   - **Francis:** players enter their own escape rolls; the GM sees the results, narrates, then sends the results, which pop up on the player's screen.
   - **Francis:** for a doom or mishap result the GM previews it with the chance to change it (fiat), then sends.

## Rulings to confirm (⚑) from the dungeon dry run

**Starting and the clock**
1. **Start expedition** asks the mode and an optional **Where?** (recent places, Choose from adventures › site → level → room, or a typed name); a dungeon place picks Dungeon mode by itself.
2. **A compact time strip** (pips and Next turn) shows on every GM screen during an adventure.
3. **Check now:** ad-hoc wandering checks at any time; the schedule carries on.
4. **Each pack's own procedure order** (classic-advanced checks first, fae-woodland decides first); the check prompts at its step.

**Rest and light**
5. **Rest:** players get the prompt when rest is due and a **Rest this turn** button any time; the GM's Next turn applies it; skipping marks the pack's condition (classic-advanced not rested, fae-woodland exhausted); ⓘ explains it in the pack's words for GM and players.
6. **Lights:** a warning a turn before ("Your torch · 1 turn left"); burnout toast with **Light another (N left)**; fae-woodland's gutter check (hostile-dungeon option on) is one roll for the party's lights each turn.
7. **Darkness on screen:** with no light in their group, a player's screen dims (grey with darkvision) for 3–5 seconds, then is readable again, with a "No light · Light a torch (N left)" reminder; respects reduced motion; can be turned off per device.

**Players' screens**
8. **Marching order:** a compact strip on players' screens; tap to open and drag (GM lock applies).
9. **Places:** only the GM sees the place card by default; **Show players** shares its description, **Hide** takes it back. Changes M5-10 (player name no longer shows automatically).
10. **Things you can do:** a collapsible reference one tap away listing the pack's common player actions with their rules; no activity prompts on players' screens.

**The GM's room flow**
11. **Entering a room opens its GM layer:** description to share, the checks it triggers, and the GM's notes on traps, puzzles, encounters, treasure and doors. **GM screen:** the pack's rules one tap away for reference.
12. **Act… in turn modes moves to the parking lot** (M5 step 10 for dungeons); the GM uses the GM screen, rolls or asks, and narrates. Day-mode activities stay (dry run 3).
13. **R2 at the latest:** traps, puzzles, door states and room treasure as structured things.

**Splitting the party**
14. **Split the party:** each party member chooses a group in a pop-up; each group has its own place, marching order, lights and statuses; one clock for all (the GM switches which group is in focus); wandering checks per group; **Join up** merges them. Separate clocks: parking lot.
15. **Several fights in R1:** each fight its own record; the GM's switcher; one run at a time, the other paused where it was; each player sees only their group's fight.

**Ending**
16. **End session** (GM) can happen with the party still inside; the app records where each group is and resumes there next session.
17. **Leave the dungeon** (quick button) carries the pack's optional rule (escape roll or safe paths); otherwise leaving is narrative (Move… or Where?).
18. **Escape rolls:** players enter their own rolls; the GM sees the results, narrates, previews each outcome with the chance to change it, then **Send** applies it and pops it up on that player's screen. Who rolls (each character or one for the party) comes from the pack: `dungeonExit.who: "each" | "party"`.
19. **dungeonExit format** accepts a save with flat modifiers (fae-woodland) or a die with a chosen starting value, level-gap modifier and limits (the invented sample, `dungeon-exit-sample.md`).

**Not walked, already covered:** movement per turn (information only, M5), safe paths (the Leave the dungeon option and Advance by…), camping inside (camp from dry run 3 with the pack's indoor note), hazards (GM screen text).

**Pack tasks (design agent):** fae-woodland's escape roll structured into dungeonExit (who: each); the invented sample in a private homebrew test pack.
