# Plan: M5 step 12 — leaving, and the Request pattern

Written by the design agent, 2026-10-31. Read the specs it names; this file doesn't make rulings.

## What this step delivers
One **Request** record and card for every "a player asks, the GM answers" flow, used here by **Describe what you want to do** and by **escape rolls**; **Leave the dungeon**; **End session mid-dungeon**. The same Request carries M5b's secret activities, buying, selling and lodging, and M7's Ask the GM, with no rework.

## Rests on
- 05 Expeditions: *Requests* (2026-10-31), *Something else…* (Describe… in the dungeon costs turns), *Leave the dungeon* and *Escape rolls* (DG17, DG18), *End expedition* (escape rolls when the rule is on), *Sessions* (End session mid-dungeon, DG16).
- 06 Components: *Request card*, *Waiting list* (extend `WaitingForYou`, never a second list), *Time strip* (Leave the dungeon as a quick button).
- 03: the Requests row (players send and withdraw their own; the GM answers), escape rolls row.
- 07: `rulesSets[].dungeonExit` (the escape roll, its modifiers, `who`, the second roll shape, the doom table, safe paths).
- Rulings: `design/rulings/m5-dungeon-2026-10-30.md` (DG16–DG19), `m5-prompts-2026-10-31.md` (Q6, Q3).
- 02 Architecture: commands as intents with request ids (M5), everything logged.

## Build order
1. **Request core (engine first, no UI).** Table `requests`: campaign, expedition, group, requester (member) and character, `kind` (`describe` · `escapeRoll` · reserved `secretActivity` · `buy` · `sell` · `lodging` · `askGm`), `direction` (`playerAsks` · `gmAsks`), `text`, `costText`, `status` (`waiting` · `answered` · `withdrawn`), `answerKind` (`yesNo` · `hitMissChoice` · `offer`), `answer` (json), who answered and when. Commands (intents with request ids): `request.send`, `request.withdraw`, `request.answer` (Undo writes a reversing event and puts it back to waiting), `request.ask` (GM-started). Database: the requester and the GM read a request; no other player does (hidden means hidden). Rows in `logged_commands`; cases in `permissionCases.ts`.
2. **Request card, both sides.** Player: "Sent to the GM · Cancel" on Scene while waiting; the answer pops up on Scene and goes to the log. GM: the card inside Waiting for you with the answer kind's buttons; only `yesNo` has buttons in this step (`hitMissChoice` and `offer` are typed, their buttons come with M5b). Undo toast on the answer, no confirm. States: waiting, answered, withdrawn, empty (collapses), offline (queued intent, "Will send when back online").
3. **Describe what you want to do → Send to the GM** in Something else…: one line of text; the GM's Yes sets a **cost in turns** (applied to the clock as one advance, undoable) and a note; No says so quietly. The optional chance and the item or status effect (05) come with M5b's activities (⚑1).
4. **Leave the dungeon.** A quick button on the GM's time strip when the pack's `dungeonExit` rule is on; otherwise absent (leaving is narrative). It creates one `escapeRoll` request per character, or one for the party, per `dungeonExit.who`. The player's card shows the save prompt with its modifiers as switches (a map, a known safe route, the depth penalty worked out) and Enter roll. The GM's card previews each outcome, changeable; **Send** applies it and pops it up on that player's screen; a failure opens the pack's doom table (the current-table row) for the GM. **Use safe paths** shows the pack's procedure. End expedition asks the same rolls when the rule is on (05).
5. **End session mid-dungeon.** End session with an expedition running records each group's place, lights and the clock (already stored); Start session next time opens Scene on the same state with one line "Resumed: <place>, turn N". No clock movement.
6. **The gate as a test.** One scripted journey test for the M5 gate: a 10-turn mock delve (start at a place, show it, light burns down, a check, a rest prompt, a Describe… request answered, Leave the dungeon with an escape roll, End expedition). This becomes the regression spine for M5b and M6 (technical item from the 2026-10-31 fresh look).

## Tests (purpose first)
- Another player can't read my request, in the database.
- Withdraw while waiting works; after an answer it's gone, and the card says so.
- Undo on the GM's answer restores waiting and the clock (for a costed Describe…).
- Escape rolls: per character and per party by `who`; the GM's change before Send wins; a failure opens the doom table.
- Leave the dungeon is absent without the rule (never disabled).
- Resume after End session mid-dungeon shows the same place and turn.

## Scope checks (write one and stop)
- No buying, selling, lodging or secret-activity UI (M5b, and the settlement is deferred to the downtime session).
- No GM inbox beyond Waiting for you (M8).
- No Act… in turn modes; Describe… is the only player-initiated action here.
- No separate clocks per group.

## ⚑ for Francis (ask at the start)
1. Describe…'s answer in M5: cost in turns and a note only; the optional chance and the item or status effect land with M5b's activities. OK? — **Ruled 2026-11-01: yes** (09).
2. The gate journey test (build order 6) adds about 4 turns. Keep it in this step or make it the first task of step 13 (the gate)? — **Ruled 2026-11-01: it stays in this step** (09).

Silent choices (standing rule, 2026-10-31; chosen, listed in 09 under 2026-11-01):
- chosen: the GM's escape-roll preview starts at **Out safely** and the GM switches it to Lost below; the pack's save rule is words (`saveRule` text), so the app can't compare the roll with a target.
- chosen: the GM answers from **Waiting for you on Players** (06's home for the Waiting list); the Leave the dungeon toast says "answer them under Players". A link from Scene is a ⚑ for the gate.
- chosen: a party-wide escape roll (`who: party`) has no requester: every player of the campaign reads it and any of them enters the roll.
- chosen: the GM never enters or cancels a player's request (03: players enter their own rolls and withdraw their own).
- chosen: the player's "Enter roll" is a fifth command, `request.enter` (Verbose), beside the four the plan names: the GM-asked escape roll needs the player's part written somewhere before the GM answers.

## Estimate
35–45 builder turns. **Qualifies for Fable** (a migration with RLS and the command/event core): ask Francis in one line before starting build order 1. One migration (`requests`), fix forward only.

## Departures
- Four migrations instead of one, all fix-forward on the test project: `20261101090000_m5_requests.sql` (the table, rules, functions, rows), then `…091000_m5_requests_rules.sql` (the GM could cancel or enter a player's request; refusals now say not allowed), `…092000_m5_requests_grants.sql` (execute grants the access rules need, as step 11 needed), `…093000_m5_requests_ask.sql` (`kind` was ambiguous inside `ask_requests`).
- `src/core/database.types.ts` was extended by hand for `requests` and its five functions: the installed CLI generates a different JSON typing style than the committed file (and main doesn't have the table yet), so a full regeneration would have rewritten unrelated types.
- The GM's outcome preview isn't worked out from the character's save (see silent choices); the GM picks it, Out safely first.
- End expedition with the rule on opens the Leave the dungeon pop-up first, with **End without rolls**, until escape rolls were asked for this expedition; then it ends at once as before.
- Build order 2's offline state ("Will send when back online", a queued intent) isn't built here: offline sending of requests comes with the app-wide offline queue (M9), like every other command.
- Review of #194: the request's prompt carries only what the player needs (the roll, switches, depth); the pack's doom table and safe paths stay on the GM's side (looked up from the rule at Send). `who: each` asks only the characters who went on the expedition. "Resumed: …" shows until the first advance of the session on that device.
- The player's answered card stays on Scene until **Got it** (kept while the app is open, per device) instead of a one-off pop-up, so an answer that arrives while the player is on another tab isn't missed.
