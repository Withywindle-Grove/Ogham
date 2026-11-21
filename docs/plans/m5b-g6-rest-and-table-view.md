# Plan: M5b step g6 — the shared rest flow, the players' table view, statuses (B5, B18, B6)

Written by the design agent, 2026-11-01 (M5 gate rulings). Read the specs it names; this file makes no rulings. Opus, high (shared state across players' screens); escalate to Fable if it fails twice. **Last of the redesign steps**: the wilderness players' screen (m5b-3) builds on this view.

## What this step delivers
- **B18:** the players' Scene as **one live table view**: time band (tap for the procedure), marching-order tiles with the **Rest** button under them, then the place; a **prompt slot** between the time band and the order; everything tappable for its explanation; no accent in the steady state.
- **B5:** rest as a shared flow: countdown on every strip; the players' prompt (Rest / Push on / ⓘ) folding to "Resting this turn · Change"; the GM's panel "Rest due · N of M answered" (what each did, tap to flip, Everyone rests / No one rests, Minimise); Next turn applies, one log line; "Rest due · you pushed on" persists; a player's Rest button calls a rest.
- **B6:** the + Status pop-up widened (durations on one row, Until removed), the brief effect under every status, **families** from `conditions[].family`, the custom status with What it does and Stacks.

## Already built (verify first)
`SceneTime`, `MarchingOrder` (compact), `PlaceLine`, `RestPrompt` / `RestRule`, the reminder card's rest line, `Statuses.tsx` (sheet and pop-up), g2's pieces, g4's arrival card.

## Rests on
- 05: *Rest* (B5), *Statuses at the M5 gate* (B6), *Status symbols*.
- 06: *Dungeon on Scene: the players' table view* (B18), *Rest flow* row, *Players' table view* row, *Status symbol* row; mockups b5, b6, b18 in `design/mockups/m5-gate/`.
- 07: `conditions[].family`, `notes` as the effect; `pack:check` warns on a missing `notes`.

## Build order
1. **Table view shell (B18):** the three bands and the prompt slot (space reserved), tiles with "you", lights and statuses in words; the light slot reading **"◑ No light"** (symbol and words) when the group has none, per group on the GM's strip (06, the "in darkness" symbol); tap-for-explanation cards; iPad keeps the order in view when the place overflows; phone stacking. Move the arrival card (g4) and the weather roll into the slot.
2. **Rest answers (B5, engine):** per character per rest period: resting / pushing on / unanswered; a called rest opens a period early and merges with a due one; Next turn applies (rest counts, condition stacked for push-on and unanswered), resets the timer, writes the one log line; Undo reverses the application.
3. **Rest screens:** the strip countdown and persistent "you pushed on"; the players' prompt and fold; the GM's panel with rows, flip, Everyone / No one, Minimise into the marker. Remove Rested / Push on buttons and Rest this turn / Rest today.
4. **Statuses (B6):** widen the pop-up, one chip row, effects under names everywhere, family rows, custom status fields, "Until removed".

## Tests (purpose first)
- A player's answer appears on the GM's panel within one realtime tick and flips when the GM taps the row.
- Next turn with two resting, one pushing on and one unanswered stacks the condition on exactly two and resets the timer.
- A rest called out of turn while one is due produces one flow, not two.
- The pushed-on character's strip keeps "Rest due" until a later rest applies to them.
- The steady-state players' Scene has no accent button; a prompt has exactly one (layout test).
- A pack with `family` groups its kinds; a pack without shows a flat list; the app never shows a kind the pack doesn't carry.

## Scope checks (write one and stop)
- No effect builder on custom statuses.
- No player-initiated statuses (C1).
- No wilderness activities on the view (m5b-3).

## ⚑ for Francis (ask at the start)
None.

## Estimate
30–40 builder turns. After g1–g5; before m5b-1.

## Departures
(The builder keeps this current in the same pull request.)

**Split (2026-11-02, builder):** build orders 1–3 (table view, rest engine, rest screens) are this pull request (`m5b-g6-rest-table-view`); build order 4 (B6 statuses) is a separate, later pull request. The plan's test "a pack with `family` groups its kinds…" goes with it.

Choices made where the specs were silent (technical; Francis to confirm or rule otherwise):
1. **Who calls answers Rest:** the Rest button opens the flow for the caller's whole group and answers Rest for the calling character only (a player with two characters: the first by name). With a flow already open, the button answers Rest for all the player's characters in the group.
2. **A group's countdown after a split and a join:** each character keeps when their countdown last restarted; a group's countdown starts at the latest of its members' (never before the expedition's start).
3. **"You pushed on"** shows for a player while any of their characters in the group pushed on during this expedition and hasn't rested since, and no rest is open.
4. **Advance by…** applies an open flow like Next turn; Downtime, an escape roll's time and Set time apply none.
5. **The GM's flip:** Resting ↔ Pushing on; a waiting row becomes Resting.
6. **The rest answer is logged Verbose** (`rest.answer`); the call (`rest.call`) and the applied rest (`rest.applied`) are Simple.

Scope checks (written, not built; for a ruling):
- **SC-g6-1 (docs disagree):** 06 says the players' table view has "nothing else" in the steady state; 05 (Scene tab) still lists the log, and the Scene showed the hour track's public events and the player-facing procedure reference. *Kept as they were, below the place,* until ruled. Options: A keep below the place (as built); B remove from the players' Scene (the log stays on its own screen). **Ruled A by Francis (2026-11-03).**
- **SC-g6-2 (not built):** the "in darkness" symbol on the marching-order tiles (05 names it there too; the mockup doesn't show it). Built on the time band only. **Ruled B by Francis (2026-11-03):** build it.
- **SC-g6-3 (not built):** "next rest due turn N" in the log line (mockup b5, panel 4): the database doesn't know the mode's rest period, so the line can't name the turn. Options: A leave it out (as built); B have Next turn send the next due time with the answers. **Ruled B by Francis (2026-11-03).**
- **SC-g6-4 (simplified):** the prompt slot orders prompts by kind (rest, request, message, No light, weather), not newest on top. **Ruled B by Francis (2026-11-03):** newest on top.

### Build order 4 (PR #302, branch `m5b-g6-statuses`, after #298, merged)

Built: the wide + Status pop-up (the Wide `Dialog` variant), How long on one chip row, the brief effect under every status name (pop-up, overview rows, the sheet), family rows from `conditions[].family`, the custom status (Name, What it does, How long, Stacks), and **Until rest** (one migration, `20261102350000_m5b_g6_until_rest.sql`: a `until_rest` column, `add_status` with a 13th argument, resting ends it in `apply_rest_flow`; on test, not on main).

Choices made where the specs were silent (technical; **all eight confirmed by Francis, 2026-11-03**):
1. **Until rest** ends when the rest flow applies a rest to that character (Next turn, answered Rest). Pushing on, Downtime and Set time don't end it. Undoing the time move puts it back.
2. **A family needs two kinds:** conditions sharing a `family` group behind one row only when two or more share it; a family of one is a plain row. Family names match in any case.
3. **The family row's second line** lists the kinds' names (the mockup's "The pack's poisons: …" line is invented; the pack has no family description).
4. **Typing searches flat:** with words typed, the matching conditions show one row each (matching their name or their family's), not grouped.
5. **A custom status is a homebrew condition:** saved first (`homebrew.save`, logged), then given (`status.add`) with What it does as its note. The toast's Undo takes the status off; the homebrew entry stays (it's "offered next time"). A name the setting already has is refused: "<Name> is in the list already: add it from there."
6. **The typed-name path is now the custom status:** typing a name that isn't in the list offers Custom status… (prefilled), so every hand-made status is kept in the homebrew. Before, a typed status was stored on its own and not offered again.
7. **A condition's own `defaultRounds` wins** over the chips (mockup b6, panel 2), as before.
8. **The family view** has no How long row: the choice on the first screen carries over (mockup b6, panel 2).

Scope checks (written, not built; for a ruling):
- **SC-g6-5 (not built):** **This fight** (05, mockup b6) isn't on the chip row: there are no fights in the app until M6, so nothing could end it. Options: A add it with M6's fights (as built: hidden until then); B show it now as a timer of the pack's default fight length (no such field in 07). **Ruled A by Francis (2026-11-03):** This fight arrives with M6 (no build now).
- The plan's two scope checks hold: no effect builder on custom statuses (What it does is words only); no player-initiated statuses (+ Status stays the GM's, C1).

### Follow-up (rulings of 2026-11-03)

Branch `m5b-g6c-rulings` (PR #306), from main after #304. One migration, `20261103120000_m5b_g6c_next_rest_due.sql` (on test, not on main).

Built:
- **SC-g6-1 (A):** no code change. 05 (Scene tab) and 06 (the players' table view) now say what sits below the place: the hour track with its public events, then the recent log lines.
- **SC-g6-2 (B):** each marching-order tile of a group in darkness reads **"◑ No light"** (symbol and words; the tile's spoken label says "no light"), on the players' table view: the time strip passes which groups are dark (`darkGroup`) through `PartyGroups` to `MarchingOrder`'s `dark`. The compact tiles show only on the players' table view, so that's the one place.
- **SC-g6-3 (B):** Next turn sends `rest.nextDue` (`{at, unit, number}`: the countdown restarts where the move starts, so the next rest falls due a rest period later, counted as the strip counts) with the answers. `apply_rest_flow` keeps it on each row in the flow (`character_rests.next_due`, GM-only in `rest_rules`), so the `rest.applied` events carry it and the log line ends "· next rest due turn 7". Lines from before (no `next_due`) read as they did. Replaced from their newest definitions: `apply_rest_flow` (20261102350000), `rest_rules` (20261102330000); `advance_clock` is unchanged (it passes `rest` through).
- **SC-g6-4 (B):** the prompt slot (`PromptSlot`) puts the newest prompt on top.
- **SC-g6-5 (A):** nothing built; 05 says This fight arrives with M6.
- **Ruled by Francis (2026-11-03, via the coordinator), a bug fix:** every "turn N" the app shows now counts as the time strip does (`elapsedSteps`). "next at turn N" on the reminder card and in the Miss toast, and the encounter tables' turn line, used `stepAt`, one lower; `stepAt` is gone. Test: a check that says "next at turn 5" falls due when the strip reads turn 5 (`sceneReminders.test.tsx`). m5b-2's Departures item 9 notes it.

Choices made where the rulings were silent (technical; Francis to confirm or rule otherwise):
1. **"Newest" is arrival on this device.** The slot notes when each prompt first shows on this screen and puts the latest on top. The prompts come from different clocks (the game clock for a rest or No light; real time for a request or message), so there is no shared "when" to sort by. What is already there when the screen opens (its first second, while the parts load) keeps the fixed order (rest, request, message, No light, weather). A reload goes back to the fixed order.
2. **A new prompt of the same kind goes back on top**: a new request or an answer to one, a new message, a rest called after a due one (they name themselves with `data-prompt-id`). A prompt that goes and comes back (No light again) comes back on top.
3. **Nothing moves while the player's focus is inside the slot** (typing an escape roll, say); the order catches up when focus leaves, so a card never jumps from under a finger or a screen reader.
4. **The "procedure reference"** in SC-g6-1 is the procedure list that opens from the time band (tap the mode and turn) and the hour track's public events; there's no separate procedure band below the place on the players' Scene, so 05 and 06 name the hour track and the log below the place and the reference on the time band.
5. **Day modes** read "next rest due day N" (the mode's step word), as the strip counts days.
