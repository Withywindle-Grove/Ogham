# Plan: M5b step 4 — camp

Written by the design agent, 2026-11-01. Read the specs it names; this file makes no rulings. Opus, high (multi-step shared state across players' screens); escalate to Fable only if it fails twice.

## What this step delivers
Camp in the pack's order: **set up → fire, cooking, campfire talk → eat → watches → night check → sleep**, worked through by the players on their own screens, seen whole by the GM, applied by **Next day** as one undoable step with the morning summary. The campfire is a light; eating is per player; watches are shared; sleep difficulty comes from facts. Three option-gated rules last.

## Already built (verify first)
*Re-plan 2026-11-01:* Rest and Push on are the shared rest flow of g6 (answers per character, applied by Next day); camp's sleep step feeds the same record. The players' camp steps live in the g6 view's prompt slot.
The light engine (M5 step 7: lit, remaining, fuel), statuses with stacks and timers (step 9), Rest and Push on, the Encounter waiting card (M5b step 2), the players' screen (step 3), items' `food` kind (M4b/M5).

## Rests on
- 05 Exploration modes: *Camp* (and its Fire, Cooking, Campfire talk, Eating, Watches, Option-gated camp activities, Sleep, No separate Confirm), *Status symbols* (ordered levels), *Rest*.
- 06: *Wilderness on Scene* (during camp the middle of the players' screen swaps to the camp steps), Components: light rows, status symbols.
- 07 Exploration: `camp` (`procedure`, `quick`, `sameAs`, `fire`, `cooking`, `sleep` with `difficulties`, `rows`, `beddingItems`), `lightTypes` with `fuelItemId`, steps `watches`, `check`, `roll` with `onGoodRest`/`onBadRest`, `onlyWithOption`; items' `food`; statuses' `levels`.
- Rulings: `m5b-wilderness-2026-10-30.md` D5, D13–D20, WA1–WA4, S4-5, Q5; `m5-prompts-2026-10-31.md` (statuses and rest as built).

## Build order
1. **Camp state (engine).** Per group: camp open, its step list from the pack's `procedure` (skipping steps the pack leaves out; `sameAs`), each step's state (fire lit, portions, who ate what, watch order, night check result and its watch, sleep difficulty per character and results), applied flag. Commands as intents: `camp.open`, `camp.step.set`, `camp.eat`, `camp.giveFood`, `camp.watches.set`, `camp.sleep.set`, `camp.apply` (by Next day). Players write their own rows (eat, their watch choice, their sleep roll); the GM writes anything. Quick camping (`quick.option`) is one tap when the option is on.
2. **Fire.** "Light the campfire": a party light of the pack's `camp.fire.lightTypeId`, fuelled by firewood: **Add firewood from packs** (bundles, integers) and gathered hours from step 3's yields; burns on the light engine; the night check reads lit or not; the morning summary says "fire out · N bundles used".
3. **Cooking and eating.** The cook picks ingredients (items with `food`), the rule makes portions (`portions`, `bonus` offered like `onGoodRest`); portions are `cooked` food handed out. **Eat**, per player: pick food (cooked, then fresh, then preserved suggested); the GM sees who hasn't eaten; **Give food** to a character with none (an inventory move, logged). The hunger rule shows as text.
4. **Campfire talk.** A camp activity (the pack's entertaining rule) on the activity engine from step 3; its effect is a modifier the sleep check reads.
5. **Watches.** Players set the order (drag; each watch 1–3 characters); the app works out the night's length from the pack's daylight table or the season; it warns about casters on watch; players see their own watch. The night check (the mode's check, once per period) runs at its step; a hit asks **Which watch?** and queues the Encounter waiting card with the watch.
6. **Sleep.** Where `camp.sleep` exists: per character, the difficulty from the rows (season, fire, bedding incl. shared `beddingItems`), shown with reasons, changeable by the GM; `result` good → offer `onGoodRest` effects ("Heal 1 HP to: ✓ ✓", never automatic); `check` → the sleep check with the difficulty's `add` and the other modifiers; `bad` → `onBadRest`. Without `camp.sleep`, the sleep step is the pack's `roll` or a note.
7. **Next day applies camp.** One undoable event with the morning summary: unused points lost, fire out and fuel used, the arrival paid first (shortfall), the Lost card, statuses changed, who didn't eat (the hunger text), rest results. The players' screen returns from the camp steps to the day layout.
8. **Option-gated rules (last; cut at the gate if needed).** `onlyWithOption` everywhere in camp (WA1). **Smoking for clues** (a camp or rest activity: an hour, the pack's check). **Inebriation**: a status with ordered `levels`, the pack's check per drink stepping up and down (WA3; statuses engine). **Falling asleep on watch**: a quiet check per watcher at the night check, with the pack's chance and modifiers (WA4).

## Tests (purpose first)
- Camp follows the pack's order and skips undefined steps; `sameAs` reuses another mode's camp.
- The campfire burns firewood on the light engine; the night check reads lit/unlit.
- A portion counts as the day's food; a player who ate isn't listed as hungry; Give food moves the item and is logged.
- Each watch holds 1–3; the night's length matches the pack; a hit records the watch on the waiting encounter.
- Sleep difficulty follows the rows (season, fire, bedding; a tent shares across N); good rest offers, never applies.
- Next day applies everything as one event; Undo restores the camp state and the budget.
- A player can't write another player's eat or sleep rows (database test).
- Ordered-level statuses step up and down and show the level's name.

## Scope checks (write one and stop)
- Armour on watch stays narrative; spoilage stays text (R1).
- No settlement lodging (deferred); no XP for exploration (M7).
- No separate camp Confirm (D20).

## ⚑ for Francis (ask at the start)
1. Build order 8 (the three option rules) is listed last so it can slip to after the M5b gate if the step runs long. OK to decide at the gate?
2. ~~The cooking rule in 07 is provisional~~ Ruled final 2026-11-01 (engine reconcile ⚑ 1); the pack side (fae-woodland's cooking rule structured) is the pack session's.

## Estimate
45–60 builder turns (the largest M5b step). Consider two pull requests: 1–4 and 5–8.

## Departures
(The builder keeps this current in the same pull request.)

**⚑ 1 ruled by Francis (2026-11-03):** build order 8 (the three option rules) may slip; OK to decide at the gate (09 line added).

**Split (2026-11-03, builder):** two stacked pull requests. Part 1 (`m5b-4-camp`, after #317) is build orders 1–4; part 2 is 5–8 (watches and the night check, sleep, Next day applies camp, the option rules).

### Part 1 (build orders 1–4)

Built: the camp's state and steps (`camp.ts`, `campPlay.ts`), Make camp / Quick camp in the GM's time-strip ⋯, the camp card per group (`CampCard`) with the campfire, cooking, campfire talk and eating; during camp the card takes the players' activity buttons' place. One migration, `20261103160000_m5b_4_camp.sql` (on test, not on main). The `m5b-creation` fixture's Fen trek mode gains a camp (Reed fire burning Reed bundles, Bog eel cooked two portions each, the hunger note).

Choices made where the specs were silent (technical; **all confirmed by Francis, 2026-11-03**):
1. **How a camp step is recognised.** 07 gives the order (D13) but no field saying "this step is the fire". The app reads a step's part from its kind (`watches`; `check` is the night check) or its id (`fire`, `cooking`, `talk`, `eat`, `sleep`, `setup`, with a few aliases); anything else is a note line. A part the camp defines elsewhere (`camp.fire`, `camp.cooking`, campfire talk named by a sleep modifier `campfire-talk` or an activity of that id, eating whenever the setting has food items) but the procedure doesn't list is put in D13's place. *Scope check SC-4-1 below.*
2. **Commands.** The plan's `camp.step.set` is three precise intents: `camp.fuel`, `camp.cook`, `camp.talk`. `camp.giveFood` is the inventory's own move (`inventory.move`, from the giver's pack). `camp.watches.set`, `camp.sleep.set` and `camp.apply` are part 2's.
3. **Portions stay in the camp's pot**, not as item lines: cooking uses the ingredients up (items leaving play, used up: hard rule 4's third exception) and puts N portions in the pot; Eat takes one from the pot (a cooked meal) or one of a food line from the eater's own pack. No item is created, so Undo is the log's own. Leftover portions go with the camp (spoilage stays text, R1).
4. **Who writes.** The GM makes camp from ⋯ for every group in play (one toast; its Undo undoes each); the database also lets a player of the group make camp (no player button yet: D5 names none). A player puts on firewood, cooks, leads the talk and eats for their own characters, from their own packs; the GM for anyone. The database checks the same (`private.may_play`, `private.actor_in_group`).
5. **One meal per character per camp**; the pot can't go below empty; undoing a cooking whose portions were eaten, or a camp with steps done, is refused.
6. **Firewood is items.** "Gathered hours from step 3's yields": an activity's yield (Cut reeds → Reed bundle) is already an item in the finder's pack, so Add firewood from packs takes it. A bundle burns the light type's `duration`; a fire that went out starts again from the next bundle (the light engine's `lightNow`).
7. **Campfire talk** is It worked / It didn't work for the player's first character in the group (the GM's: the group's first); no roll plan is shown (no pack names an entertaining activity yet). Its effect is the `campfire-talk` fact part 2's sleep check reads.
8. **Camp is per evening** (`camps.day`, the expedition's day): once the clock reaches a new day the card goes (part 2 applies it first). Camp shows only in a day-by-day mode with a travel budget (the travel view gives the day); a turn mode's camp (`sameAs`) is read but not offered yet.
9. **The hunger rule** is the rules set's reference-only `hunger` (its `note`), shown under Eat; hidden from players when it's `gmOnly`.

Scope checks (written, not built; for a ruling):
- **SC-4-1 (07 format):** how a camp step names its part. Options: A as built (kind or id; a missing part placed by D13); B a field on the step (`part: "fire"`) that the pack session adds; C a `camp.order` list of parts. Built A, which reads both test packs. **Ruled A by Francis (2026-11-03):** a step's part is read from its kind or id, as built; a missing part goes in D13's place; no 07 field.

Not done in part 1: watches, Which watch?, sleep, the morning summary (part 2); no real-browser layout scene for the camp card (the stand-in database has no camp).

### Part 2 (build orders 5–7; branch `m5b-4-camp-2`, after #318)

**Build order 8 not built:** the step ran long, so the three option rules (smoking for clues, inebriation, falling asleep on watch) stop here, as Francis allowed (⚑ 1, decided at the gate). `onlyWithOption` on camp steps (WA1) is built (part 1); ordered-level statuses already step up and down (M5 step 9).

Built: the watches step (each character's watch, the night's length and the watches it takes, "your watch", casters on watch), Which watch? on a camp night hit's waiting card, the sleep step (difficulty from the facts with reasons, the GM's change, no roll or the check with the ability and modifiers, Slept well / Slept badly with the roll, the good rest's heal offered with one confirm, a bad rest's condition offered to the GM), and Next day applying the evening's camps in the clock's move with a camp line on the card ("Camp · fire out · 2 bundles used · didn't eat: Moss · slept well: Reed"). Migrations (on test, not on main): `20261103170000_m5b_4_camp_night.sql`, and three fixes forward found by the database tests: `20261103171000_m5b_4_camp_rules_fix.sql` (an array literal), `20261103172000_m5b_4_camp_rules_fix_2.sql` (a camps row has no `kind`; Which watch? logged so its Undo works), `20261103173000_m5b_4_camp_sleep_permission.sql` (a player's difficulty change refused as a permission).

Choices made where the specs were silent (technical; **all confirmed by Francis, 2026-11-03**):
10. **The watch order is the group's:** any player of the group, or the GM, sets the whole order (the newest stands; Undo brings back the one before). Players still write only their own eat and sleep rows.
11. **The night's length** is the day less the pack's daylight (daylight.ts, by month or season); without daylight the card says "the night's length is the GM's call" and shows one watch's length. Casters are characters whose class has `spellcasting`.
12. **Which watch?** asks on a hit of a check the camp's night step runs, while the hit's group has an open camp; the answer is words on the card ("2nd watch · Reed, Moss"), GM-only like the card. A hit with no watches set asks nothing.
13. **Sleep:** a difficulty with `good` or `bad` shows its result without a roll and needs no tap; a `check` (or a pack without `camp.sleep`) has a roll box and Slept well / Slept badly. The good rest's `heal` is offered to the player's own characters who are hurt (TickConfirm, then the HP change); a bad rest's `onBadRest` condition is offered to the GM only (players never add a status, C1). Bedding is read from the packs this person can see (a player sees only their own, so a tent another player carries isn't shared on a player's screen; the GM's view is complete).
14. **Next day applies camp** by sending the evening's camps with the clock's move: a second call in the same request, so the move's one Undo takes the apply back too, and an applied camp takes no more steps. The camp's line joins the card's lines; the travel morning (unused points, arrival, the Lost card) stays the travel card's own toast as before, not one combined summary. The morning summary counts only recorded sleep (Slept well / Slept badly), not the no-roll results.

Scope checks (written; for a ruling):
- **SC-4-2 (06 component):** 06's Watches is "ordered list, hold to drag". Built a row of watch chips per character (1st, 2nd…, one tap each) as a stand-in: no drag library is listed (02) and chips meet the 44 px and screen-reader rules. Options: A keep the chips; B build hold-to-drag (designer). **Ruled A by Francis (2026-11-03):** watches are tap chips (up to 3 per watch), not hold-to-drag; 05 and 06 now say so (camp follow-up PR).
- **SC-4-3 (not built):** Force march's rest still opens the group's rest flow at once (m5b-1's workaround). The engine reconcile ruling says it runs in camp's sleep step; doing so changes `force_march` and the rest flow's timing. Options: A move it into the sleep step (a follow-up with a migration); B keep it as is. **Ruled A by Francis (2026-11-03), built in the camp follow-up** (below).

Not done in part 2: build order 8 (above); the D20 single combined morning summary (choice 14); a layout scene for the camp card.

### Follow-up (Francis's rulings of 2026-11-03; branch `m5b-4-camp-followup`, after #321)

- **SC-4-1, SC-4-2:** ruled A (above); docs only. 05 (Watches) and 06 (the Watches row) say tap chips.
- **Choices 1–14:** all confirmed (above).
- **Build order 8** stays for the gate (⚑ 1, already ruled).
- **SC-4-3 built.** Migration `20261103180000_m5b_4_force_march_rest_at_camp.sql` (on test, not on main) replaces `force_march` from its newest (and only) definition, `20261103110000_m5b_1_travel.sql`, without the rest call: a forced march now only adds the points and pays what's owed. The app opens the group's shared rest flow once the group is in camp that evening (`forcedRestGroups` in `restFlow.ts`: today's travel row counts a forced march and the group's camp for that day is open); camp's Sleep step and the rest prompt say "Rest due (forced march)"; the players answer Rest or Push on as for any rest, and Next day applies it (advance_clock's `rest`, unchanged). Undoing the march takes the forced count back and the rest due with it.
- **Departure (technical):** no camp or sleep function was replaced. The brief named the sleep and apply functions as candidates, but the forced count is already on the group's travel row and Next day already sends who is in an open flow, so the opening is worked out on the device, as a due rest is; one function changes. The time band now loads the open camps and travel rows for players too (it loaded the camps for the GM only).
- **Departure (technical):** a player's forced march brings them no log line (travel lines are the GM's), so the march tells the screens to reload on that device (`useLogChanged`, `campaignLog.tsx`). Another player's screen in the same group picks it up at its next reload (any log line they see, or coming back to the app); in play the camp's own log lines do that. Fragile: a march made after camp is up shows on the other players' screens only at that next reload.
- **Not built (⚑ for Francis):** a group that forced the march but never makes camp that evening gets no rest due (the flow opens only in camp). Before, Next day applied the called rest (unanswered counted as Push on).
  **Ruled B by Francis (2026-11-03).** Built in `m5b-close-and-forced-rest` (no migration): when Next day moves the clock past the day a group forced the march and that group has no camp for that day, Next day sends the group's members in the rest it applies, unanswered, so each gets the pack's condition, stacked (Push on), and the card's rest line names them ("pushed on: …"). `forcedWithoutCamp` (`restFlow.ts`) picks the groups: today's travel row counts a forced march, the move reaches a new day, and no camp for that group and day. Undo of Next day puts the rest back (advance_clock's undo, unchanged). The rest prompt doesn't open for them before Next day (nothing to answer: no camp, no Sleep step). Fragile: an answer left on a rest row (answered in camp, the march undone, then marched again with no camp) counts as resting, as the database reads it.
- **Not built (fragile):** answers given while the forced rest was open stay on the rest rows if the march is undone before Next day, so the next rest flow starts with them answered (the same as undoing a called rest, g6).
