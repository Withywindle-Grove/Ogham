# Cloud brief: special seasons hidden whole when a rules set marks them GM-only (sps-1)

If a guard, a hook or a permission check blocks you, stop and say so in the pull request. Do not reach the same end another way: not with another tool, another branch, another session or another command. After a combined command is refused you may run its ordinary parts one at a time as plain commands, leaving out anything that deletes, restores or reaches outside your folder (gd-4); a plain part refused means stop.

**For:** a cloud builder. **Output:** one pull request with one new add-only migration, its database tests, the stand-in database's matching change and a status file. **You apply the migration nowhere:** the Builder runs the test database and the main database through its own session. **Logic only:** nothing a person can see.

## The ruling (Francis, sps-1, 2026-11-14)
He was asked: "A pack can mark parts of its rules as GM-only. If a pack marks its special seasons that way, players still see the seasons' names today; only the start chance and encounter changes are hidden. I'd make an explicit GM-only mark hide the seasons entirely. Without the mark, players keep seeing the names, as you ruled in October. Hide them whole when a pack marks them GM-only: yes or no?" He answered: "Yes". Recorded in `docs/design/rulings/dec-town-ask-card-2026-11-14.md`.

## What changes, and nothing more
- In `private.visible_of` (newest definition `supabase/migrations/20261030160000_m5_weather_tags.sql`, lines 99 to 131; confirm nothing later replaces it and say what you found), the `specialSeasons` branch (lines 112 to 116) gains the same `gmOnly` test the `weather` (117 to 123) and `exploration` (124 to 130) branches have. So where a rules set's `gmOnly` list names `specialSeasons`, the players' version (`private.special_seasons_for_players`, `20261030140000`, about line 69) is no longer added back: nothing of the special seasons reaches a player's readable data, `weatherTableId` included.
- Where `gmOnly` does NOT name `specialSeasons`, nothing changes: players get the seasons without `start` and `encounterSwap`, as ruled 2026-10-30.
- **Untouched:** the GM's read, every write rule, every other key, `private.special_seasons_for_players` itself, and `private.hidden_keys` (newest `20261111130000`, about line 39).
- **One NEW add-only migration**, fix forward: a timestamp later than every migration on main (check before naming; `20261115003000` is taken). It replaces that one function from its newest definition with only that change. No applied migration is edited. Name the file and the replaced definition in the pull request.
- **The stand-in database** (`src/testing/fakeDb.ts`, about lines 416 to 437) copies the split and takes the same change.
- **If it needs more than that one change, STOP** and say so in the pull request.

## The split is stored: no re-file
`private.split_hidden_fields` (`20261023160000`, lines 32 to 60) writes the players' part when a library entry is inserted or updated, so the change affects only rows written after it. Do NOT add a step that rewrites stored rows. In the status file, write the exact read-only query that counts rules-set rows whose hidden part's `gmOnly` names `specialSeasons`; the Builder runs it on the test database, and anything but zero stops the work for Francis. The pull request says plainly: "applies to rows written after this migration; none existed that it would have changed" (to be confirmed by that count).

## The override route: read and report, do not widen
`overrides_for_players` (`20261030160000`, about lines 55 to 57) has its own special-seasons path for `byOption` overrides. Read it and report whether a rules set whose `gmOnly` names `specialSeasons` can still give a player a season's name or `weatherTableId` through an override. If yes, STOP and say so; do not change it.

## Tests (database, as a player; the stand-in the same)
1. A rules set with `gmOnly: ['specialSeasons']`: the key is ABSENT from what a player reads (not an empty array): no names, no `weatherTableId`, no `start`, no `encounterSwap`.
2. A rules set without that mark: a player reads exactly today's players' version.
3. A rules set whose `gmOnly` lists other keys but not `specialSeasons`: unchanged.
4. The GM reads the seasons whole in every case.
5. A player in another campaign reads nothing.
6. A row saved after the change (re-split by the trigger) reads as ruled.
7. The override case above, as you find it.
8. The weather fix (wl-1, `20261114235500`) still refuses a player's weather entry for a table named only in a hidden special season; `supabase/tests/m5-calendar-followups.test.ts` still passes.
You cannot run the database tests in a cloud session; CI's database job is their first run. Say so in the status file.

## Paperwork
- It replaces one function and no policy: run `npm run docs:gen` and commit the result only if the generated docs change.
- No line in `docs/09-decisions-log.md` (the lead has written sps-1's). `docs/03`'s line is worded by the lead after merge.
- A status file `docs/status/<date>-<branch>.md`: what you found for each "confirm" above, who may call `weather_die` and `weather_read`, which `src/` readers of special seasons serve players, the count query, and what you could not check.
- One push when done. The main database: Francis's yes covers the push only if the Builder's dry run shows that one function and nothing else.

If unsure, stop and say what you need in the pull request's description; don't guess.
