---
status: pending
milestone: m5b (ruled the morning after sitting 1 of the gate rewalk; built before the m5b tag unless marked)
absorbed-into: pending, with the pull requests that build them (03 who may act in an activity; 05 activities); docs/09-decisions-log.md (2026-11-11)
supersedes: nothing
---

# Rulings of the morning (2026-11-11)

Put to Francis one at a time by the lead, from the findings of sitting 1 and the night's reviews (`docs/design/notes/gate-m5b-rewalk-2026-11-10.md`, F61 … F83).

## Who may act in an activity (F80)

| Id | Ruling | Francis |
|---|---|---|
| ac-1 | In an activity that one character does, a player may name only their own characters (and their hirelings) as the one who acts and the one who finds; the GM may name anyone. An activity the setting has several characters or the whole party do together stays open to the travel group. Enforced on the screen and in the database. | "A" |

**Why:** 03 says a player rolls for their own character; as built, a player could name another player's character and the yield landed in that player's pack (logged and undoable, nothing hidden shown).

**Costs and caveats:** a migration (the Builder's to size; pushed only on Francis's yes); how the app tells a one-character activity from a group one comes from the pack's `who` on the activity, to be confirmed by the Builder against 07.

Docs to update: 03 (activities: who may act), 05 (activities), `src/testing/permissionCases.ts` by the Builder, 09.

## The GM's name for a place not yet shown (F81)

| Id | Ruling | Francis |
|---|---|---|
| fm-2 | The place a group is entering is the GM's until it has been shown to that group, **in the database**: the GM's name for it and its id live in a GM-only row; the travel row players read holds the players' name once shown, else nothing. Players read "Entering the next place, N more tomorrow". Built inside fm-1's migration. | "A" |

**What the migration does to data in play (said to Francis in plain words; his yes covers the design and this move, the push stays his):** for every travel row, the place's name as the GM wrote it and its id are copied into a new GM-only table; on the travel row the id is emptied, and the name is replaced by the players' name if the place has been shown to that group, emptied otherwise. No table or column is dropped, no row deleted.

**Costs and caveats:** the migration (855 lines) has never run anywhere; undoing a travel line written before it may be refused where the Undo would put the GM's name back; the app must go live right after the push (an older app shows the GM a blank name on the card meanwhile); "shown" is decided by group number, as What we know is.

Docs to update: 05 (travel: entering a place; what players read), 04 (the GM-only row), 03 (hidden means hidden: the place being entered), 09.

## Who reads a travel group's lines over time (fm-1, ⚑ 1)

| Id | Ruling | Francis |
|---|---|---|
| fm-3 | A travel group's log line is read by the players who had a character in that group **when it was written**, and by the GM. A later joiner doesn't read the group's earlier lines; a leaver keeps the lines they were there for; a later group given the same number reads none of an earlier one's. | "B" |

**Costs and caveats:** as built in fm-1 (no extra work). A player who joins a group mid-day sees none of that day's earlier travel in their log.

Docs to update: 03 (log audiences: `group`), 05 (the log; travel), 04 (the readers kept on the line), 09.

09 line:
- 2026-11-11 — [perm] A travel group's log lines are read by the players who were in the group when each was written, and the GM (fm-3) — "Whoever is in the group now" would hand a group's past to late joiners and to a later group given the same number — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## fm-1's built-not-ruled choices (its ⚑ 3, 4, 5)

Put together; Francis: "Yes to all three."

| Id | Ruling |
|---|---|
| fm-4 | Travel lines written before fm-1 stay the GM's alone: they don't record who was there and hold the GM's names for places. |
| fm-5 | Only the five travel commands' lines are the group's (the start of the day, Move…, the day's budget, Spend the day looking, the forced march, and their undo). An activity's cost and a secret activity's cost on the same budget keep the GM's line. |
| fm-6 | A marcher who has left the group can't undo their forced march; they still read the line, and the GM can undo it. |

Docs to update: 05 (the log; the forced march's Undo), 03, 09.

09 line:
- 2026-11-11 — [expedition] In fm-1: travel lines from before it stay the GM's; only the five travel commands' lines are the group's (an activity's cost keeps the GM's line); a marcher who has left the group can't undo the march (fm-4 … fm-6) — Built where the rulings were silent; confirmed by Francis — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## The hidden-data fix and an older test (F83)

| Id | Ruling | Francis |
|---|---|---|
| hd-1 | Players can't read a pack patch aimed at an item no pack contains. The older database test that expected otherwise is updated to the stricter behaviour (Francis's yes to changing an existing test, in the hidden-data fix's pull request). | "A" |

Docs to update: 03 (hidden means hidden: pack patches), 09. The Builder notes the test's change in the pull request's status file.

09 line:
- 2026-11-11 — [perm] Players can't read a pack patch aimed at an item no pack contains; the older database test is updated to match (hd-1) — The hidden-data fix after the look-back reviews (F58, F83) — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## The hidden-data fixes and the m5b tag (F58, F81)

| Id | Ruling | Francis |
|---|---|---|
| gt-1 | M5b is not tagged until both hidden-data fixes are pushed and live: the hidden-data fix (the pack cache and patches, F58, hd-1) and the place being entered (fm-2, in fm-1). The gate walk can pass before them. | "A" |

**Costs and caveats:** the tag may follow the walk by a day or more: both need db-1's script, a TEST turn each and Francis's push; fm-1's migration is large and has not run anywhere.

Docs to update: `docs/plans/m5b-gate-rewalk.md` (After the pass), 09.

09 line:
- 2026-11-11 — [testing] M5b is tagged only once both hidden-data fixes are live (the pack cache and patches; the place being entered, fm-2); the walk can pass before them (gt-1) — "Hidden data shown" blocks the tag in the gate plan, and one of the two was live — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## A reveal belongs to its campaign (F58)

| Id | Ruling | Francis |
|---|---|---|
| hd-2 | A reveal of a hidden pack entry belongs to the campaign it was made in: players of another campaign on the same pack read nothing new, and taking the reveal back needs to reach only its own campaign. | "A" |

**Costs and caveats:** not sized. The Builder says whether the written hidden-data fix covers it or it needs its own migration; if large, the size comes back to Francis before it is built.

Docs to update: 03 (hidden means hidden: reveals), 04 if the reveal's row gains a campaign, 09.

09 line:
- 2026-11-11 — [perm] A reveal of a hidden pack entry belongs to the campaign it was made in (hd-2) — A reveal in one campaign opened the entry in every campaign on the same pack (look-back review of #554) — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## The Encounter check and the hour (F76)

| Id | Ruling | Francis |
|---|---|---|
| nc-1 | **Encounter check** (Check now) respects the hour: at night it puts in play only the checks for the night and those with no time limit; by day only the day's and those with none. A table for the other half of the day is opened from Tables. | "A" |

**Why:** at sitting 1's night stop the button offered the day's check beside the night's; the day one was answered, so a "(day)" table opened, "Which watch?" never showed and the night check was still due the next day.

**Costs and caveats:** changes DG3 (2026-10-30), which made Check now an ad-hoc check of everything at any time. Not sized; no migration expected (the Builder confirms). #619 already fixes the odds line and counts a night check answered this way.

Docs to update: 05 (Check now; the night check first), 09.

09 line:
- 2026-11-11 — [expedition] Encounter check (Check now) respects the hour: at night only the night's checks and those with no time limit, by day only the day's (nc-1; changes DG3 of 2026-10-30) — At the night stop the day's check was answered in the night's place, so "Which watch?" never showed (rewalk, sitting 1) — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## Which table a night check suggests (F76)

| Id | Ruling | Francis |
|---|---|---|
| nc-2 | When a night check hits at a place that has its own encounter tables, the most specific table is suggested first: the place's own night table; failing that, the terrain's night table. The others stay one tap away in Which table?. | "a" |

**Costs and caveats:** not sized; what the app suggests today at such a place was not traced beyond the walk (the Builder reads it before building, with nc-1).

Docs to update: 05 (Which table?: the order at night), 09.

09 line:
- 2026-11-11 — [expedition] A night check that hits at a place with its own tables suggests that place's night table first, else the terrain's (nc-2) — The pack wrote the place's night table for that moment; at the walk a "(day)" table opened — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## What counts as night (for nc-1)

| Id | Ruling | Francis |
|---|---|---|
| nc-3 | Night runs from sunset to sunrise where the setting gives its daylight; a setting that gives none uses the clock's night hours (22:00 to 06:00). The night stop after the day ends always counts as night. No Day / Night switch. | "a" |

| nc-3a | In a mode whose step is a day or longer, the clock's hour doesn't decide: it is day until the night stop, which is night. Turn and hour modes read sunset and sunrise as nc-3 says. | The lead's reading of nc-3, told to Francis the same morning; his to overturn. |

**Why nc-3a:** a campaign's clock starts at 00:00 until the GM saves a start time, and a day mode moves in whole days, so by the hour alone such a campaign would be night at every check (the Builder, building nc-1).

**Not built with these (held):** nc-2 needs the place the party is at wired into the time strip's checks, which nothing does yet (07 gives a place check's `atNight` to M8b). The Builder's scope check recommends M8b; it goes to Francis with the December planning. Until then a place's night table is opened from Tables. The setting's two trek checks get `onlyAt` day and night in the pack once nc-1 and nc-3 are live (held build).

**Costs and caveats:** a party still travelling after sunset gets the night's checks. Which packs give sunset and sunrise was not checked; one that doesn't falls back to the clock. Built with nc-1 and nc-2 (TypeScript only, per the Builder's sizing of nc-1).

Docs to update: 05 (encounter checks: day and night), 09.

09 line:
- 2026-11-11 — [expedition] Night, for encounter checks, runs from the setting's sunset to its sunrise, else 22:00 to 06:00 by the clock; the night stop always counts as night; no switch (nc-3) — Nothing told the Scene it was night, so every check counted as a day check (the Builder, sizing nc-1) — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## Two technical rulings on how the held migrations move

| Id | Ruling | Francis |
|---|---|---|
| tg-1 | The hd-1 test change (an existing test changed by ruling, which the fix-branch test guard refuses) is made on a non-fix branch cut from the fix branch, keeping its tests-first commits; that branch becomes the pull request. The guard is not bypassed. | "a" |
| db-2 | fm-1, the hidden-data fix and ac-1 are pushed once committed and get their first database proof from CI's local database. TEST then gets one batched turn after CI is green, checked with Francis first, and his main push follows. Merging stays held for his yes. For these three only, the trial's "TEST first" timing is set aside; "TEST before main" holds. | "a" |

Docs to update: 09. Project Review is told of db-2 as evidence for the DB-test trial's assessment.

09 line:
- 2026-11-11 — [testing] For fm-1, the hidden-data fix and ac-1, the first database proof is CI's local database; TEST gets one batched turn after CI is green and before main (db-2); an existing test changed by ruling on a fix branch moves to a non-fix branch cut from it (tg-1) — TEST was blocked by two unmerged pull requests' migrations, and each pull request gets a CI run anyway — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## TEST ahead of the open pull requests (F82, technical)

| Id | Ruling | Francis |
|---|---|---|
| db-1 | The TEST push script accepts migrations TEST already has from other open pull requests, so a branch can push its own migration while another's waits unmerged. It rules the method only: each TEST turn is still checked with Francis first. | "A" |

**Costs and caveats:** the script change is the Builder's to size and to describe before it is used; nothing is deleted from TEST and nothing merges.

Docs to update: `docs/testing.md` (database changes on TEST), 09.

09 lines:
- 2026-11-11 — [testing] The TEST push script accepts migrations TEST already holds from other open pull requests (db-1); each TEST turn is still checked with Francis first — TEST held two unmerged pull requests' migrations and refused every other branch's (F82) — `design/rulings/m5b-morning-rulings-2026-11-11.md`
- 2026-11-11 — [expedition] The place a group is entering is the GM's until shown to that group, in the database: the GM's name and the place's id are kept in a GM-only row and players read "the next place" (fm-2, in fm-1's migration) — The GM's name for an unshown place was stored where the group's players read it until morning (look-back review of #528) — `design/rulings/m5b-morning-rulings-2026-11-11.md`
- 2026-11-11 — [perm] In an activity one character does, a player names only their own characters as the one who acts and finds (the GM names anyone); an activity several or the whole party do stays open to the travel group; enforced in the database (ac-1) — A player could act for another player's character and put the yield in their pack (found by the Builder after sitting 1) — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## A person's name is never the front of their email (F73; ruled later the same day)

| Id | Ruling | Francis |
|---|---|---|
| nm-1 | The "What do we call you?" box starts empty and asks for a name; an account that never chose one shows as "A player" until it does (the stored email-front names of such accounts are replaced); a person can change their name later from the menu. Built before character creation opens for the December campaign (1 December). | "a" |

**What it does to data (said to Francis; the push stays his):** for accounts whose stored name is still the front of their email address, that name is replaced by none, shown as "A player"; names people chose are untouched. A migration; nothing is deleted but those defaulted names.

**Costs and caveats:** not sized (the Builder named four parts: the box, a migration, the stored names, the words for no name); how the app tells a defaulted name from one a person typed that happens to equal their email front is for the Builder to say before building.

Docs to update: 05 (accounts: the name), 06 (words: "A player"; the menu's Change your name), 04 if a column changes, 09.

09 line:
- 2026-11-11 — [core] A person's name is never the front of their email: the name box starts empty, an account with no chosen name shows as "A player", and a name can be changed later from the menu (nm-1) — A player showed to the table as the front of an email address (rewalk, sitting 1, F73); players asked to change their name later — `design/rulings/m5b-morning-rulings-2026-11-11.md`

## After sitting 2 (ruled the same evening)

| Id | Ruling | Francis |
|---|---|---|
| gt-2 | M5b is not tagged until two faults from sitting 2 are understood and fixed: no Rest day card at camp after a forced march that paid off a move (F86), and the clock and the travel day out of step after an Undo of the day and a new Next day (F87). They join gt-1's two hidden-data fixes. | "Yes" |
| db-3 | The Builder may read two records of the live database, read-only, for the gate-test campaign only (its travel record and its camp record), to trace F86 and F87. Nothing is changed. | "A" |

Docs to update: `docs/plans/m5b-gate-rewalk.md` (what holds the tag), 09.

09 lines:
- 2026-11-11 — [testing] M5b is not tagged until F86 (no Rest card at camp after a forced march that paid off a move) and F87 (the clock and the travel day out of step after an Undo and a new Next day) are understood and fixed (gt-2) — Each loses track of something the rules depend on (sitting 2) — `design/rulings/m5b-morning-rulings-2026-11-11.md`
- 2026-11-11 — [process] The Builder may read two records of the live database, read-only, for the gate-test campaign, to trace F86 and F87 (db-3) — Francis's OK; production reads are refused by default — `design/rulings/m5b-morning-rulings-2026-11-11.md`

| Id | Ruling | Francis |
|---|---|---|
| ws-1 | Watches stay shared, as built: any player of the group may put any character on or take them off a watch, and the GM anyone. A stated exception to ac-1 (a player acts for their own characters): arranging the watches is the party's matter. | "B" |

09 line:
- 2026-11-11 — [perm] Watches stay shared: any player of the group arranges anyone's watch, an exception to ac-1 (ws-1) — At a table one person writes down what the group agreed (Francis, after sitting 2) — `design/rulings/m5b-morning-rulings-2026-11-11.md`

