# Paper dry run 3: a wilderness travel day (2026-10-30)

The walk-through behind `../rulings/m5b-wilderness-2026-10-30.md` (the rulings file and the specs win). Converted from the design agent's notes: aliases and invented names only; the pack's dice, chances and modifiers are replaced by "the pack's …" (the private pack holds them).

Setting: fae-woodland (pack 0.3.2). Party: Bram (fighter), Wren (caster), Tamsin (scout, with the pack's wayfinding skill), Odo (hireling, Bram's). Season summer, weather effects on. Starting place: Old Ford (meadow). Goal: travel into tangled forest, forage, camp for the night.
Uses session 1's mockups (wilderness day, Move…, location views) as provisional; their 7 rulings were still pending.

## Steps

1. **Weather.** Proposed: the GM gets the weather prompt (enter the pack's roll, the row lights, Use). **Francis:** players roll the weather: prompt them. GM and players both see the result with all its details (effects included), then it shrinks to a tappable icon beside the day and date.
   - ⚑ This changes 05 ("players see the result and the season, never the table or its tags") and reverses Claude Code's pending fix hiding weather.tags from players. Hold that fix.
   - Proposed shape: a campaign setting "Weather rolled by: Players (default) / GM"; any player can enter the roll (first entry wins, logged with who); the GM can enter it instead; the result card shows the name and each effect in plain words to everyone, then folds to an icon beside the date (tap to reopen). The table itself stays unshown.
   - **Francis (confirmed):** players see the results and their effects; they never need the table itself.
   - **Francis:** hiding weather effects makes no sense: if it's raining, they're standing in it.
2. **Decide the course / Move….** Players narrate; the GM inputs. As modelled works: moving during "Decide the course", before the lost check (yes); "Tangled forest (unnamed)" for a place with no name is OK.
   - **Francis asks:** directions aren't always cardinal ("go left, go right"). Can the app work out every connecting space and offer buttons describing the open ways?
   - Answer: yes where map data exists (hex neighbours from the grid; routes and room exits from adventure packs, with exits linked to locations), no for unmapped places (Move… stays). ⚑ "Ways on" list (see step 2 reply) for G-05/M8b.
   - **Francis:** add an "Other…" form-fillable choice in case the app missed something or the players come up with something new. Players never see a list of ways on: they navigate narratively and the GM fills in directions and responses (a list would take away from their creativity). So "Ways on" is GM-only, ending in **Other…**.
3. **Lost check.** **Francis:** prompt the players for a roll without telling them what it's for. While lost, players keep narrating; the GM fills in where they really go.
   - ⚑ "Ask a player to roll" on any secret check: the GM picks a player (or anyone); the player sees "The GM asks you to roll" and the die, with no purpose; the number lands in the GM's prompt, which lights the outcome for the GM to confirm.
   - ⚑ No "believed vs true position" in the app: Move… is always the GM's real move; players see where they really are (terrain, place name if given; hex numbers stay hidden by default). Lost is a GM-only status with the pack's recovery reminder.
   - **Francis (revises step 3):** no "Roll it myself / Ask a player" in the app. The GM asks a player out loud, without distracting them with a screen. The prompt only gives the GM the rolling instructions and how to enter the result. (Withdraws the "Ask a player to roll" ⚑.)
4. **Wandering monsters (day).** Prompt = instructions plus Enter roll (no who-rolls choice), per Francis.
   - **Francis:** check right after moving: yes. On a hit, the encounter may happen during the move, after it, or later in the day; what matters is that the result is **queued up**. ⚑ A hit becomes a queued "Encounter waiting" card on the GM console that the GM starts when it suits (no "Later today" for the check itself).
   - **Francis:** the GM selects from the possible encounter tables rather than the app picking one. ⚑ The prompt lists the candidate tables (route column, place default, terrain, region, special-season swap) for the GM to choose; the old order (2026-10-29) becomes only the order of the list.
5. **Find food.** Flow (chip → skill roll → yield roll → where it goes) works; food defaults to the finder's pack.
   - **Francis:** Find food is a button players can press too: a reminder for them to ask for it. The player enters the roll and sees the result; the GM sees it too. If the day is spent looking, that choice must show in travel points.
   - ⚑ Player-facing activity chips (non-secret pack activities) on the players' wilderness screen: tap → the instructions and Enter roll → result and yield → to the finder's pack (Undo); the GM sees it live and can undo. Secret activities (search) stay GM-only.
   - ⚑ "Spend the day looking" (with the pack's bonus) uses up the day's remaining travel points (the party stays put), shown on the budget card.
6. **Second move and shortfall.** No extra checks on a second move: yes, **unless a rule triggers one** (leaving a road, or anything else in the rules). "Entering Swamp · N more tomorrow" is clear; arriving automatically tomorrow is right. Francis would have them camp in the transition space.
   - ⚑ Event-triggered checks: fae-woodland's lost check also runs "when the party leaves a road" (today only text in the note). Pack field (e.g. checks[].alsoWhen: { leaveRoute: "road" }) plus the engine prompting it on a Move… from road to wild. Pack task + build.
   - ⚑ While "Entering…", camp and the night check use the place the party is in (the edge they camp on), not the one being entered.
   - **Francis asks:** when do players get to force march? (It was only on the GM's budget card.) **Francis:** players decide to force march, not the GM; they should understand the effects one tap away.
   - ⚑ Force march is a player button on the wilderness screen (and on the shortfall line); a player taps it and it applies at once (no GM accept), the effects one tap away (ⓘ: the pack's extra travel points, longer day and rest-or-exhausted rule); the GM sees it and can undo; the rest reminder is set automatically.
7. **Eat.** Just before camp: yes.
   - **Francis:** each player taps Eat and picks the ration or food for their own character. Some rules (fae-woodland) let the party cook a meal together, which makes portions: the cook hands them out.
   - ⚑ Eat per player: pick the food (fresh before preserved suggested); the GM sees who hasn't eaten; a character with none can be given food by another player.
   - ⚑ Cooking: a camp activity that turns ingredients into portions; the cook hands portions to party members; a portion counts as that day's food (plus any pack bonus, e.g. to sleep). Pack task: structure the pack's cooking rule (what it uses, what it makes, the check, the bonus), in our own words.
8. **Camp set-up.** Players do set-up from their own screens, the GM has visibility and sets a number only when the pack is vague (yes). Fire as visible state ("Fire: lit · N hours") is useful.
   - **Francis:** Make camp comes **before** eating; fae-woodland's order is roughly make camp, gather firewood, light a fire, (forage), cook, and so on. Firewood can come from packs, not just gathering.
   - Pack order (0.3.2): set up (campsite, firewood, water) → fire, cooking, company → watches → night check → sleep. ⚑ Eat moves inside camp, after cooking. Foraging isn't a camp step in the pack (it's a travel activity); pack task: check the book's camp procedure and add it if the book has it.
   - ⚑ The campfire is a party light using the M5 light engine: firewood is its fuel (the pack's firewood bundle is already a light type with a burn time, consumed). "Add firewood from packs" offers bundles carried; gathered hours add to the same fire.
9. **Watches.** Players set the watch order, GM sees it (yes). The ▲ caster warning and the app working out the night's length: "helpful in the right kind of way".
   - **Francis:** fae-woodland has a "tell a story" step too; call it "Campfire talk".
   - ⚑ Camp activities include **Campfire talk** (the pack's entertaining rule: a check whose success helps sleep, with a risk on a bad roll), beside Cooking. The app's label "Campfire talk" names the slot; the pack's own wording shows in its rules.
10. **Night check.** Choosing the table from a list, with the fire choosing the suggestion: yes. "Which watch?" recording who's awake: useful.
    - **Francis:** this shows several characters can share a watch. It's also the moment to remind sleeping players of the disadvantages of waking to fight (including not sleeping in armour, he assumes).
    - ⚑ Watches hold 1–3 characters each (rows, like marching order).
    - ⚑ Sleep and armour: at the Sleep step each player chooses Keep armour on / Take it off (the pack's rule one tap away); taking it off unequips it (AC follows). When a night encounter starts, sleepers get a reminder card: asleep, armour off, the pack's waking and arming rules, with "Put armour on" (time per the pack). Pack task: check the book for sleeping in armour and for waking or arming time; nothing assumed until then.
    - **Francis:** keep armour narrative only; don't model it unless a rule exists. (Withdraws the sleep-and-armour ⚑; watches holding 1–3 characters stays.)
11. **Sleep.** One confirm at the end for the whole camp: fine. The GM rolls difficulty where it's rolled, but **Francis:** some settings use facts (fire, rain…), not rolls.
    - Checked: fae-woodland's sleep difficulty is exactly that, a lookup by season, fire and bedding, no roll, and bedding is per character. The run's "roll the difficulty" was wrong.
    - ⚑ Difficulty from facts: the app looks up each character's difficulty from the season, the fire (lit or not, from the camp light) and that character's bedding (from their pack), shows it with its reasons ("Easy · fire, bedroll"), and the GM can change any. The easiest level is good rest with no roll; middle levels ask the pack's check per character; the hardest means no good rest. Pack task: give the lookup's rows structured conditions (fire, bedding) instead of text labels.
12. **Next morning.** Summary looks good for now; the GM narrates too.
    - **Francis:** the camp's Confirm duplicates Next day; just have the GM tap Next day. ⚑ Camp and sleep results show as they come in and are applied by Next day (one undoable step); no separate Confirm.

## Rulings to confirm (⚑) from the wilderness dry run

1. **Weather rolled by players** (campaign setting "Weather rolled by: Players (default) / GM"): any player enters the roll; everyone sees the result and its effects in plain words; the card folds to an icon beside the date (tap to reopen); the table is never shown. Changes 05; weather tags become player-readable as effects (reverses the pending weather.tags hiding fix).
2. **Check prompts are instructions plus Enter roll only.** The GM asks players out loud; no who-rolls choice in the app.
3. **Ways on** (G-05/M8b): a GM-only list from hex neighbours, routes and linked room exits, ending in **Other…** (a short form: describe, route, terrain, cost). Players never see options. Pack format: room exits link to the room they lead to.
4. **No believed-vs-true position.** Move… is always the GM's real move; Lost is a GM-only status with the pack's recovery reminder (the wayfinding skill's chance).
5. **Encounter hits queue** as an "Encounter waiting" card the GM starts when it suits.
6. **The GM picks the encounter table** from a list of candidates (route column, fire column, place, terrain, region, special-season swap, Other…), the likely one marked as the suggestion.
7. **Players get the activity buttons** (non-secret pack activities): they enter their own rolls and see results; yields go to the finder's pack; the GM sees it live and can undo. Secret activities stay GM-only.
8. **Spending the day looking** uses up the day's remaining travel points.
9. **Event-triggered checks:** a check may also run on an event (fae-woodland's lost check when leaving a road): pack field plus the engine prompting it on that Move….
10. **While entering a place,** camp and the night check use the place the party is in.
11. **Force march belongs to the players:** a player button (also on the shortfall line), applied at once, effects one tap away; the GM can undo; the rest reminder is set automatically.
12. **Eating is per player, inside camp after cooking:** each player picks their food; the GM sees who hasn't eaten; anyone can give food to a character with none.
13. **Cooking** makes portions the cook hands out; a portion counts as the day's food, plus any pack bonus.
14. **Camp follows the pack's order** (set up → fire, cooking, campfire talk → eat → watches → night check → sleep); players work through it on their own screens, the GM sees all and sets a number only where the pack is vague (a wet fire's chance).
15. **The campfire is a party light** fuelled by firewood: bundles from packs and gathered hours both feed it; the night check reads whether it's lit.
16. **Campfire talk** is a camp activity (the pack's entertaining rule).
17. **Watches:** players set the order; each watch holds 1–3 characters; the app works out the night's length and warns about casters on watch; a night hit asks "Which watch?" so the waiting encounter knows who's awake. Armour stays narrative.
18. **Sleep difficulty from facts** where the pack says so: per character from season, fire and that character's bedding, with reasons, changeable by the GM; the easiest level needs no roll.
19. **No separate camp Confirm:** results show as they come in and Next day applies them as one undoable step.
20. **The morning summary** as walked through (unused points lost, fire out and fuel used, arrival paid first, Lost recovery prompt, statuses shown).

Withdrawn during the run: "Ask a player to roll" (step 3), modelling sleep in armour (step 10).

**Pack tasks (design agent, no app change until the format rulings):** activity `yields`; the cooking rule structured; sleep lookup rows as conditions (fire, bedding); `alsoWhen: { leaveRoute }` on the lost check; check the book's camp procedure for foraging; room exits linked to rooms (adventure format).
