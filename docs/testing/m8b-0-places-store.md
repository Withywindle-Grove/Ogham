# m8b-0-places-store — places from packs, store and link (M8b slice 0, pull request 1; ruled 2026-11-06, ⚑ 1, 3, 5, 7, 8, 10, 11)

No screen changes in this pull request: the picker is pull request 2. What can be checked by hand is the seed and that today's places still work. Invented names only; the preview uses the test project.

1. **iPad, the seed (after Francis has pushed the migration to main and the coordinator has re-seeded, or on the preview's test project after `npm run seed:test`).** Open a seeded fae-woodland campaign as the GM → Settings → Packs. **See:** the region pack listed on top of the setting's rules; Rules for this campaign shows the Encumbrance row as the pack's rules set it (not "Not tracked" by accident).
2. **iPad, Start expedition by name still works.** Scene → Start expedition → Where? type "The Drowned Stair" → Start. **See:** the party at The Drowned Stair, nothing shown to players; the log line "started an expedition at The Drowned Stair".
3. **iPad, Where now? by name still works, and a repeat name is the same place.** Scene → Where now? → "The Moth Gallery" → then back to "The Drowned Stair". **See:** the pieces shown on the first visit come back (the "shown again" line), as before.
4. **Phone, a player sees nothing new.** Sign in as a player with the party at a place and no piece shown. **See:** the Scene says nothing about the place; after the GM shows one piece, the place's name and that piece only.
5. **Log.** After a seed campaign gains places from the pack (pull request 2's picker, or `place.fromPack` run by a test), the log shows "added <place> from a pack (N pieces, unshown)" once per new place, with Undo; Undo removes the place, its notes and its pieces from the GM's cards in one tap.

**Gallery pictures expected to change:** none (no component changed).

**Gate check this feeds:** the trek's Where? / Set place / Move… checks (17–43) become walkable with real places once pull request 2 lands; this pull request lays the store under them.
