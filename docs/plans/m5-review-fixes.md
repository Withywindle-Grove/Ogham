# M5 review fixes (access rules, before the m5 tag)

The fresh-session review of M5 (2026-11-01, `m4b..main`) found no critical issues, two important ones and five small ones. Francis approved fixing them on Fable (2026-11-01). The builder session wrote this plan; the fixes are technical (closing holes against rules already ruled), with no behaviour or screen changes. Pin each fix with a database test in a new `supabase/tests/m5-review.test.ts`, as M2 and M3 did.

Rules: migrations go to the test project first (`npm run db:push:test`, then only the affected `npm run test:db -- <file>`; the free test project throttles). When replacing a function, start from its **newest** definition (search all migrations). Never edit an applied migration. Nothing here drops or deletes data; if a fix would, stop and ask.

## What to fix
1. **Important: a player can join another group's place (`choose_party_group`, explicit `to_group`).** `20261030231000_m5_party_group_ids.sql:73-80` (or newer). A player can move their own character, or a hireling, into any existing group, which bypasses `groups_together`. `private.in_my_group` then shows them that group's shown place. Fix: for a non-GM, refuse unless the target group is empty or `private.groups_together(campaign, from_group, to_group)`.
   - Test: "A player in group 1 can't move into group 2 while it's in another place, and never sees group 2's place."
2. **Important: players can read the weather table by entering made-up periods (`enter_weather`, `weather_roll_rules`).** `20261031090000_m5b_weather_roll.sql:271-291, 343-367` (or newer).
   - Fix: a non-GM may enter only the period under way, worked out on the server (clock, expedition start, roll every). Refuse any other period.
   - Also refuse a non-GM's re-entry for a period whose entry they undid (no re-rolling by Undo).
   - Tests:
     - "A player's weather entry for any period but the current one is refused, and returns no result."
     - "After undoing their entry, a player can't enter that period again; the GM can."
3. **Small: a player can rewrite a status directly.** `20261031120000_m5_statuses.sql:85-107` (or newer). In `status_rules`, refuse non-GM changes to `undone`, `ended_at`, `end_reason`, `ends_at`, `total_seconds`, `secret`, `name` and `stacks` unless the change comes from the status commands or an undo (a flag, as `party_member_rules` uses `grimoire.regrouping`).
   - Test: "A player's direct update of their own status's end or name is refused; the commands still work."
4. **Small: nobody can withdraw a GM's ask (an escape roll).** `20261101091000_m5_requests_rules.sql:81-90` (or newer). Allow the GM `waiting → withdrawn` on gmAsks rows.
   - Test: "The GM can withdraw an escape-roll ask; a player can't."
5. **Small: a player can annotate an event they can't read (`prepare_note`).** `20261029210000_m5_note_hidden_fix.sql:33-46` (or newer). Refuse a note on an event the caller can't read under their own access rules. Use the same error as for a missing event, so it doesn't reveal that the event exists.
   - Test: "A player's note on a GM-only log line is refused with the same message as a made-up event id."
6. **Small: saving a place can half-save (`place.edit`, `src/modules/expedition/placePlay.ts:170-184`).** Make the description and the notes one write (one RPC), or report plainly that the description was saved.
   - Test: "When the notes write fails, the person isn't told the whole save failed while the description is saved."
7. **Check: a player's undo of their own split leaves a live `group_places` row** (`m5-places.test.ts:194` area). Confirm with a test. If it's true, have the undo clear it.
8. **Test gap (code health item 9):** a test that a message, or a place shown to one group, is never readable by a player outside that group.

Also bring the security advisor's accepted list in `docs/testing.md` up to date for M5's security-definer functions that signed-in users can call: `campaign_calendars`, `campaign_exceptions`, `choose_party_group`, `close_message`, `groups_meeting`, `join_party_groups`, `weather_die`. Give each a line saying who may call it and what it checks, after reading its newest definition. Any that don't check the caller get fixed.

## Ruled 2026-11-01: keep
- `groups_meeting` tells players that groups are in the same place, even when both places are hidden (works as specified in 05). Francis: keep it; "no need to hide that info" (09, [perm] 2026-11-01; the advisor's accepted list says so).

## Not in this step (⚑ for Francis, already asked)
- `20261030220000_m5_weather_tags_readable.sql` moved keys from secret to readable. Closed 2026-11-01: it carried out ruling D1 (2026-10-30, players see weather effects), and nothing was lost (every value moved stayed whole in the readable part).

## Estimate
About 25 turns on Fable. Migrations: one or two new ones (test project only in this step; Francis runs the main push after a backup).

## Departures
- **Three migrations, not one.** `20261101120000_m5_review_fixes.sql` (fixes 1–5) was applied to the test project before item 7's test confirmed the hole, so the split-undo fix is a second migration, `20261101121000_m5_review_split_undo.sql`; and the permission cases then showed that a player's take-back of a GM ask was refused with a plain error where the app says "not allowed", so `20261101122000_m5_review_withdraw_code.sql` gives it the not-allowed code (never edit an applied migration).
- **One permission-case fixture changed** (`supabase/tests/commands.test.ts`, `freshWeather`): its expedition is now day-by-day (`wilderness`), since the rules set's weather is only rolled on those; on a turn-by-turn expedition the database now rightly says the weather isn't rolled.
- **Fix 2 reads the setting on the server.** "The period under way" needs the roll-every length, so the database now reads the setting rules the way the app does (`private.weather_every`: the rules sets with their optional rules applied, the mode by id with the "dungeon"/"wilderness" fallbacks, the weather block's `rollEvery`, the campaign's time lengths, turns per hour, extra lengths and the calendar's week). Known gaps against the app: `byOption` inside a section (the app resolves nested ones; the server only the top level), and the GM's explicit pick of a rules set's modes (the server takes the top set with modes, as the weather card does). A mismatch only refuses a player's entry; the GM's entry is never checked against it, so the GM can always enter the weather.
- **Fix 4 touched the app too.** `request.withdraw`'s `allowed` now matches the database (the GM for a gmAsks row; a player only for their own playerAsks row: before, the app would have let a player try to withdraw an escape-roll ask and the database refuse it). Two permission cases added; no screen change (nothing new to tap).
- **Fix 5 reshaped the events reading rule** into a function (`private.event_readable`) that the policy and `prepare_note` share, so the two can't drift; the rule itself is unchanged.
- **Fix 6 took the second option** (report plainly that the description was saved) rather than a new RPC.
- **Fix 3 refuses exactly the plan's fields** (`undone`, `ended_at`, `end_reason`, `ends_at`, `total_seconds`, `secret`, `name`, `stacks`) on a non-GM's direct update; `level`, `note`, `icon` and the rest stay as they were (the commands set them too). Inserts are untouched.
- **`m5b-weather-roll.test.ts` changed**: its "next step" entry now moves the clock a day first, since a player can only enter the step under way.
