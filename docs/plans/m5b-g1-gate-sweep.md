# Plan: M5b step g1 — the gate sweep (removals, small items, the ⚑)

Written by the design agent, 2026-11-01 (M5 gate rulings; order approved by Francis the same day). Read the specs it names; this file makes no rulings. Opus, medium. Removals first, so the later redesign steps add onto a clean console.

## What this step delivers
Everything the M5 gate ruled that needs no new screen: the **R3 audit removals**, the **small items B7–B17**, the **⚑ C1, C3, C5–C7 and B13**, the **A4 autofocus sweep**, and the **A6 +N removal**.

## Rests on
- `design/rulings/m5-gate-rulings-2026-11-01.md` (A, B7–B17, C) and `design/rulings/m5-r3-audit-2026-11-01.md` (items 8, 15, 21/36, 38).
- 05: *M5 gate small items (B7–B17)*; *Darkness on screen: the dim is removed*; *Something else… and Describe…: removed*; *Next turn* (no +N); *Statuses at the M5 gate* (C1 only here); *At hand* (C3); *Requests* (C5, C7); *Leave the dungeon* (C6); the weather card's fold (tap only).
- 06: *M5 gate small items*; *Top row*; *Explore* (Advance by…, Encounter check); *Hour track*; navigation (collapsible left column); *Never open the keyboard automatically*.
- 03: the two new rows (statuses, escape rolls / enter a roll).

## Build order
*Amended 2026-11-01:* the builder's **#217** (`docs/plans/m5-r3-removals.md`) already did the removals of item 1 (dim, Something else… and Describe…, Revealed this downtime, the weather fold) and the A4 sweep of item 6; verify against its status report and skip what it covered. The "in darkness" symbol is **not** this step's: it is the "◑ No light" mark on the time band, built with B18 in g6. The town's **Something not listed…** (buying, ST5) stays as a Request under its new name.
1. **Remove:** the darkness dim (keep the in-darkness symbol), the weather card's 8-second fold, Something else… and Describe… (and the cost-in-turns answer), long-press +N, "Revealed this downtime" (B17), "Only you see this" (B16).
2. **Rename and fold:** Check now → Encounter check; Set time… into Advance by… (B12); "None" → "Until removed" (C2); "Your notes" → Notes, expandable (B16).
3. **Small behaviours:** Resume session collapse and the two End labels (B7); due marks mean the turn being played (B8); + Reminder and an icon per reminder (B9); Keep lit as a pressed toggle with ⓘ (B10); procedure steps in plain words, opened from the strip (B14; the Procedure buttons go); collapsible left column on iPad landscape (B15); start time default 06:00 and "Day 14 · Month 3" without a calendar (B13).
4. **Icons over letters (B11):** one inline SVG set for the strip, hour track and ⋯ items; letters only where no clear icon exists. Draw the set once (`src/ui/icons.tsx` or the existing place), list it in 06 Components.
5. **⚑:** players can't add statuses to their own characters (C1; permission cases); weapons at hand show attack bonus and damage (C3); "N waiting · Players ›" on the console (C5); hirelings share their employer's escape result (C6); "Enter for <name>" on a waiting roll (C7, logged as the GM's).
6. **A4 sweep:** every `autoFocus` and focus-on-open goes, app-wide; a layout test asserts no focused input on opening any screen.

## Tests (purpose first)
- No screen focuses an input on open (layout test, every route).
- A group with no light shows the symbol and the reminder, never a dimmed page.
- The hour track's check mark sits on the turn being played, and Encounter check runs once per tap.
- A player's + Status is absent on their own character; the GM's is present (permission cases).
- Weapons at hand show bonus and damage from the pack's data; a pack without a formula shows the die alone.
- "N waiting · Players ›" appears only while a request waits.

## Scope checks (write one and stop)
- Nothing from B1–B6 or B18 (their own steps).
- No new icon library dependency (02).
- No change to what players can see (RLS untouched).

## ⚑ for Francis (ask at the start)
None; the gate ruled them all. Departures go in the section below.

## Estimate
25–35 builder turns. Build order 2 of M5b.

## Departures
(The builder keeps this current in the same pull request.)

Built in PR #233 ("M5b step g1: the gate sweep"), 2026-11-01.

1. **Removals (build order 1) and the A4 sweep (6) came from #217**, as the amended plan says; this step added only long-press +N (A6) and "Only you see this" (B16). #217 was stuck behind main, so its branch was merged into this one before it landed; once #217 merged, `origin/main` was merged too, and its commits drop out of this PR's diff.
2. **B13: the start time is not built (scope check below).** The date part is: without a pack calendar the strip reads "Day 14 · Month 3 · 08:10". Silent choice: from the second year it adds "· Year 2" (twelve months to a year, so a year has to show somewhere).
3. **B8:** a mark sits on the turn its prompt shows (the turn being played); a check, rest or reminder brought due by the last advance shows on the current pip, and the next one ahead. Consequence: one due exactly as the hour turns over belongs to the next hour's first pip, so on the last turn of an hour it isn't shown ahead (⚑ 2). The card's heading reads **Due now** after an advance (was "Due · Next turn").
4. **B7:** "paused or ended" is read as: no session running and one played before (also in Downtime after End session; a brand-new campaign still shows Start session). Resume session starts the next session. The End session / End expedition lines live under the ⋯ items (`MenuItem`'s new `sub`).
5. **B9:** the reminders' empty hint ("None yet…") went with the old list; + Reminder is self-explaining. A reminder's icon: blades for an Encounter check, a magnifier for another check, a note for a reminder; a stopped one has a dotted ring. Reminders sit in the controls row, so they aren't shown while the End expedition summary is up (they come back with Downtime's controls).
6. **B11:** the icons are the same placeholder family as the navigation icons (`src/ui/icons.tsx`), drawn inline; a letter stays only for a symbol the app has no icon for. The ⋯ items got their own icons (encounter check, darkness, advance, end expedition, end session).
7. **B14:** a step with no note in the pack shows its name alone. The procedure opens from the strip's mode and turn for the GM, and for players only when the setting shares it (as their Procedure button did).
8. **B15:** the player's landscape column folds too (players use iPads, R2); the GM's folded column hides the campaign heading and banner beside the icons.
9. **C3:** the attack bonus is the class's progression `attackBonus` (or `attack` when the row has no `thac0`) plus the scores' `melee` / `missile` modifier, by the weapon's Melee / Missile tags (both shown for a weapon that is both); the damage is the item's `weapon.damage`. **Damage modifiers aren't added**: 07 has no field saying which score adds to damage (⚑ 3).
10. **C6:** the database already asked player characters only (M5 step 12). The GM's card now says "Tobb leaves with Wren and shares this result."; hirelings are matched to their employer by the player who owns them, until hirelings carry `employerActorId` (04).
11. **C7:** "Enter for <name>" is on what the GM asked (escape rolls), not on a player's own ask; migration `20261101141000_m5b_g1_gm_enters_roll.sql` lets the GM set the entry.
12. **C1:** a player still removes and steps their own statuses (03's remove half); only adding is the GM's. Migration `20261101140000_m5b_g1_status_gm_only.sql`, with a fix forward, `20261101142000_m5b_g1_status_rules_fixtures.sql`: its refusal had also caught rows written with no signed-in user (the service role's test fixtures; CI's database job found it). 03's older row "Add or remove a status on a character (M5)" still says "✅ own" for players; the new C1 row is the rule (⚑ 4 asks the designer to tidy it).
13. **A4 test:** the layout test checks every screen in its scene list (not literally every route) for a focused text field on open; #217's source scan covers the rest. The layout test "the status picker fits on the Player screen" now checks the player has no + Status (C1).
14. **Test project:** another session's migrations (20261101150000, 151000, 160000) were already on the test project, so this step's three were applied out of order (`db push --include-all` with empty stand-ins for theirs, removed afterwards). The main project gets them in timestamp order.

> **Scope check — B13 start time**
> **What:** the GM sets the start time of the adventure's first day (default 06:00), in Rules for this campaign.
> **Now:** goes in M5b g1 · cost 0.5–1 day · pushes back nothing else · chance of redoing work med
> **Later:** goes in g6 or with the calendar work · cost then the same · what we lose by waiting: the clock still starts at 00:00 on new campaigns
> **Signals:** touches foundations (the clock and the database's day-based rules: the weather roll works out the step under way from the clock); the ruling doesn't say what the setting does to a clock that has already moved.
> **Recommendation:** Now, once ruled: the setting moves a clock that hasn't moved yet (Day 1, no expedition, no advances) to the chosen time, logged; once the clock has moved it only shows, and changing the time then is Advance by… → To a time. The alternative, a display offset, would put the app's days out of step with the database's.
> **Options:** A Now (as recommended) · B Now, as a display offset · C Later · D Drop

## ⚑ raised by the build
1. B13 start time: the scope check above. **Ruled 2026-11-01: A, Now as recommended.** The GM sets the first day's start time (default 06:00) in Rules for this campaign; the setting moves a clock that hasn't moved yet (Day 1, no expedition, no advances) to that time, logged; once the clock has moved it only shows, and changing the time is Advance by… → To a time. No display offset. Built in g1b.
2. B8: a check or rest due exactly as the hour turns over isn't on the last turn's track ahead of time (it shows on the next hour's first pip once due). Fine, or show the next hour's first pip on the last turn? **Ruled 2026-11-01: B.** It shows ahead on that hour's last turn, at the edge of the hour track. Built in g1b.
3. C3: a pack field for which score adds to damage (07), so weapons at hand can show "1d6+1"? **Ruled 2026-11-01: A, a pack field** (07) naming the ability score whose modifier adds to weapon damage, for packs whose rules have one (absent means the die alone, as now); weapons at hand then show e.g. "+1 · 1d8+1"; `pack:check` accepts it; the private packs' conversion fills it later. Built in g1b (`attack.damageScore`).
4. 03: the old row "Add or remove a status on a character (M5)" still gives players "✅ own"; the C1 row says they never add. Reword the old row to "remove" (designer)? **Ruled 2026-11-01:** reword it to match C1 (already ruled at the gate); a docs fix applying a ruling, no new ruling. Done by the designer in #237 (the row split in two), which landed while g1b was open.

## Departures (g1b: start time, due marks ahead, damage modifier)

Built in the follow-up pull request "M5b step g1b: start time, due marks ahead, damage modifier", 2026-11-01, from the four rulings above. Migration `20261102140000_m5b_g1b_start_time.sql` (two rows: `time.start` as a logged command and an undoable deletion; no function changes).

1. **B13, one command:** `time.start` saves `settings.startTime` (`{ hour, minute }`, 04) and, through `set_clock`, the clock, as one log entry ("Priya set the first day's start time to 07:30, and the clock with it.") that one Undo puts back. It reads the campaign's settings afresh before writing, so nothing else in them is lost.
2. **B13, "hasn't moved":** read as: the clock is on Day 1, no expedition was started (or all were undone), and no move of the clock (Next turn, Advance by…, Downtime, To a time) stands in the log un-undone. Setting the start time isn't a move, so it can be set again until the clock moves. The app checks it, before the form shows and again when the command runs; the database doesn't (the GM may set the clock anyway).
3. **B13, where:** the Time and calendar group now shows for every campaign (it held only Calendar start, so it was hidden without a pack calendar); its summary reads "Starts at 06:00 (the default)" or "Starts at 07:30", then the calendar's. The button is secondary (Set the date stays the group's one primary). Once moved, the form gives way to "The first day started at 07:30." and a line pointing to Advance by… → To a time on Scene.
4. **B13, hours:** the start time is in this campaign's hours (an hour of `turnsPerHour` turns when the setting gives one), so the hour runs to the day's length and the minute to the hour's.
5. **B8:** the extra pip is `Pip.next` (turn 1 of the next hour), only on the hour's last turn and only when something falls due exactly as the hour turns over; it sits past a dashed rule, its dot dashed (shape, not colour), and is read as "Next hour, turn 1: …". The GM's Encounter check button can sit on it. Effects ending and lights out at that moment show there too (they're the same track events).
6. **C3:** the field is the rules set's `attack.damageScore` (07, beside `attack.shieldBonus` and `attack.style`; one pack already uses `attack.damage` as a free-text note, so that name was taken). The modifier is the named score's `melee` or `missile` column by the weapon's tags, the columns the attack bonus reads, so a score with only a melee modifier adds to melee damage alone. A weapon that is both shows its damage beside each kind when they differ ("Melee +2 · 1d4+1 · Missile +0 · 1d4"). Without an attack bonus in the pack, the damage still adds the modifier. `pack:check` warns when it isn't a key or names an ability the rules set's `abilities` doesn't list.
7. **03:** #237 split the row (Add is the GM's; Remove or step stays the player's own) while this was open, so g1b took that wording and drops its own; its 09 line is #237's. 03 now has two "Add a status" rows (73 and the C1 row further down), left for the designer. g1's three ⚑ left in 10 are removed (ruled).

> **Scope check — the default 06:00 on a campaign whose GM never sets it**
> **What:** a new campaign's clock starts at 06:00 without the GM opening Rules (B13's "default 06:00, never 00:00").
> **Now:** goes in g1b · cost 0.5 day · pushes back nothing · chance of redoing work med
> **Later:** goes in g6 · cost the same · what we lose by waiting: until the GM taps Set start time, a new campaign's clock still reads 00:00 (Rules shows 06:00 as the default the button would set)
> **Signals:** touches foundations (the clock is made by the database with the campaign, before any setting rules are attached, and an hour's length comes from the setting rules' `turnsPerHour`, so the database can't know where 06:00 is); the ruling says what the setting does when saved, not when nobody saves it.
> **Recommendation:** Now, as A: a quiet **Set start time ›** beside "Day 1 · Month 1 · 00:00" on the GM's strip while the clock hasn't moved, like Set date › for the calendar (it opens the same form); nothing moves by itself.
> **Options:** A Set start time › on the strip (as recommended) · B the first Start expedition on an unmoved clock moves it to the start time first, logged with it · C leave it: the GM sets it in Rules · D the database makes new clocks at 06:00 in one-hour terms (wrong for a setting with `turnsPerHour`)
>
> **Ruled 2026-11-01: A.** While the clock hasn't moved, the GM's strip shows a quiet **Set start time ›** (like Set date ›); it opens the same start-time form (`StartTimeForm`, in a "Start time" pop-up) and runs the same `time.start` command, with Undo on its toast ("The first day starts at 06:30"). Built in g1b: the GM's full strip only (not the compact strip, not players), shown in Downtime with no expedition under way; it asks the log once per clock change (`clockHasMoved`) and goes when the clock moves. Setting it doesn't count as a move, so the link stays until the clock moves.
