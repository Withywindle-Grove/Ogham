# Plan: ac-1, a player acts only for their own characters (M5b, before the tag's fixes)

Written by the lead, 2026-11-11, from ruling ac-1 (`docs/design/rulings/m5b-morning-rulings-2026-11-11.md`) and the Builder's read-only sizing of the same morning. Finding: F80 in `docs/design/notes/gate-m5b-rewalk-2026-11-10.md`.

## What changes
In an activity that **one** character does, a player may name only their own characters and their hirelings as the one who acts and the one who finds. The GM may name anyone. An activity that **several** characters or the **party** do stays open to the travel group, as today.

The kind comes from the pack: the activity's `who` (`one`, `several`, `party`; a missing value reads as `one`).

| Who asks | `who: one` | `who: several` or `party` |
|---|---|---|
| A player, naming their own character or hireling | allowed | allowed |
| A player, naming another player's character | **refused** | allowed (a member of the travel group) |
| The GM | allowed | allowed |

## Steps
1. **Screen** (the activity pop-up): for `who: one` and a player, the actor and finder choices list only the player's own characters and hirelings. Nothing is shown disabled: the others are simply not offered. For the GM, and for group activities, the list is as today.
2. **Command** (`can`): the same rule, so a refused case explains itself if it is ever reached ("Only <name>'s player or the GM can do this for them.": words to confirm with the lead before the pictures).
3. **Database:** one migration replacing the function that applies an activity. It looks the activity up in the campaign's own pack data (modes and town activities both) to read `who`; it never trusts a flag sent by the client. It then checks ownership as in the table above.
4. **Tests:** permission cases both ways in `src/testing/permissionCases.ts` (a player names another's character in a one-character activity: refused; the GM: allowed; a group activity: open); the stand-in database; the database test for activities; a screen test that the choices are the player's own.

## Boundaries
- No change to what an activity costs, gives or logs, nor to Undo.
- No change to requests (a secret activity already names the asking player's character); say so if the code shows otherwise.
- The migration is built and held: no TEST turn and no push without Francis's word through the lead. It is stamped after fm-1's and the hidden-data fix's.

## ⚑
1. Does a hireling carry its employer's owner, so "their hirelings" needs no extra rule? (The Builder confirms while building; if not, stop and ask.)
2. The refusal's words (step 2), for the lead.
3. An activity present in a campaign's data with no `who`: read as `one` (as 07 says). Confirm no pack in `_current` relies on the old openness; ask the Pack Creator through the lead if one does.

## Estimate
Medium: about 60 to 90 lines of SQL, about 30 of TypeScript, plus tests; 4 to 6 builder turns. One picture round only if the pop-up's gallery specimen changes.

## Departures
(The builder keeps this current in the same pull request.)
- ⚑1 answered in the code: a hireling carries its player as `owner_user_id` (the same field as their characters; `requests.ts` loadHirelingsByPlayer, the regroup in `20261030230000_m5_party_groups.sql`), so "their hirelings" needs no extra rule.
- Step 2: commands have no refusal words of their own; a refused command shows the one shared message ("You don't have permission to do that."). The screen never offers the case, so it is reached only by a device that skips the screen. Ruled by the lead (⚑2, 2026-11-11): the shared message stays, no change to the command core.
- The database reads `who` from the highest rules set with a readable mode (as the app's `readExploration` and `weather_every` pick), any of its modes; town activities are modes' activities too, so one lookup covers both.
- ⚑3 answered: every activity in the packs in `_current` states its `who`, so nothing relied on the old openness.
- "A group activity: open" (step 4) is proven in the database test, not as a permission case: the case world's setting has no activities, so its activity reads as one character's. `m5b-3-activities.test.ts`'s first test has Player A name Player B's Moss in Gather reeds, which its setting marks `several`, and the database accepts it; `activityPlay.test.ts` checks the app's rule.
- The 09 line is in the lead's docs pull request (from the rulings file), not here; 03 and 05 are updated here.
