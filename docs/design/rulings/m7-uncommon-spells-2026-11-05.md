---
status: absorbed
milestone: m7 (the pack shape now; the app in M7)
absorbed-into: docs/07-content-packs.md (spells: uncommon spells), docs/08-roadmap.md (M7), docs/09-decisions-log.md (2026-11-05), docs/10-open-questions.md (M7: one ⚑), docs/08-roadmap.md (M5c), docs/plans/magic-in-play.md (slice 7)
supersedes: —
---

# Spells found in play (design ruling, 2026-11-05)

One question from the pack session (G-149). Ruled with Francis (option A). Id `us-1`.

**The case.** fae-woodland's GM book has sixteen spells of the ordinary kinds of magic that are on no class's list. Each is found at a named place in the region, and a caster may learn or pray for it only after finding it there; one has its own rolled table. Invented example: **Lantern's Hush, rank 3 arcane, found in the drowned chapel**. Today they are text in a GM reference panel: nobody can hold, prepare or cast them.

| | Option | Why not / why |
|---|---|---|
| A | Real spells with their kind and rank, on no class list, marked uncommon with where they're found; the GM gives one to a character when it's found | Keeps "only once found"; the region pack's place can point at the spell |
| B | On the lists behind an option ("uncommon spells allowed") | A new caster could pick one at creation without finding it |
| C | Reference text only | No casting in the app |

- **us-1 (A).**
  1. **The shape.** An uncommon spell is an entry in `spells` with **no `lists`** and in no spell list's `levels`, so nothing that reads the lists (First spells, roll tables, a list's `extends`) ever offers it. It carries **`uncommon: { lists: { <list id>: <rank> }, foundAt: [{ placeId?, hex?, note? }] }`**: the list and rank it joins once found, and where. `foundAt` may be words or a hex until the region pack has the place; then `placeId`.
  2. **Gaining it.** The GM gives the spell to a character when the party finds it, by M7's "learn a spell in play" action (the same path as any spell gained in play); it then behaves as a spell of that list and rank for that character only.
  3. **The region pack's place** may name the spells found there; the link runs both ways once the place has an id.
  4. **`pack:check`** warns on an uncommon spell that also has `lists`, on an unknown list id, and on a `placeId` no attached pack has.
  5. **A spell's own table** uses items' pattern (it-1): the spell names its table, the table's `uses` says when it is rolled.

- **⚑ (10, M7): who can read an uncommon spell before it's found.** `spells` is a player-readable section today, so as written the sixteen would show in the players' Rules library. Proposed: GM-only until given to a character of that player (hidden means hidden); needs Francis's ruling and app work. **Until it is ruled, the pack session does not add the sixteen to `spells`** (they stay in the GM panel).

**Not checked by the designer:** that the app has no in-play "learn a spell" action today (the pack session searched the code; 08 places it in M7).

Docs to update: 07 (spells), 08 (M7), 09, 10.

09: 2026-11-05 — [packs] A spell found in play is an entry in `spells` on no list, carrying `uncommon: { lists, foundAt }`; nothing offers it until the GM gives it to a character (M7's learn-in-play action), after which it is a spell of that list and rank for them; the region's place may point at it (us-1, G-149) — Keeps "only once found"; an option switch would let a new caster pick one unfound — `design/rulings/m7-uncommon-spells-2026-11-05.md`
