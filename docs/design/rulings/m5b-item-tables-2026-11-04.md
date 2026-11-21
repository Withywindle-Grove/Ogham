---
status: absorbed
milestone: m7
absorbed-into: docs/07-content-packs.md (items `refs.tableId`; the table uses registry: `treasure.itemFound`, `treasure.itemUse`), docs/09-decisions-log.md (2026-11-04), docs/11-modelling-gaps.md (G-144)
supersedes: —
---

# Items that carry their own roll table (design ruling, 2026-11-04)

G-144, from the pack session (fourteen classic-advanced items and one fae-woodland item name a table in `refs.tableId`, the shape spells use). Three kinds: rolled once by the GM when the item is found (the result is the item's identity: the figurine's animal, the stone's type); rolled on use (a deck the player draws from, a robe's patch; the GM reads the effect); GM reference read during play. Ruled with Francis, A, B, synthesis. Id `it-1`.

- **it-1 (synthesis)** Items may carry **`refs.tableId`** (07). The table says when it's rolled through its **`uses`** (the table uses registry), not a new field: **`treasure.itemFound`** — the GM rolls at hand-out, the result is written onto the item as its identity, the table is GM-only by nature; **`treasure.itemUse`** — the holder rolls from the item's pop-up, rows may carry GM-only parts the GM reads; or `treasure.itemReference`, read by the GM during play; the new path replaces the plain `treasure` use on these tables (they are not treasure-generation tables, and the paths sit in the Treasure group). `pack:check` warns on an item's table with none of the three. Hard rule 5 holds with what exists: `itemFound` tables are hidden until rolled, `itemUse` tables are the holder's unless row parts are GM-only. **App in M7 (magic items):** the hand-out roll and the pop-up's Roll; until then the GM rolls by hand from the GM reference. Not taken: a `rolledBy: "gm" | "player"` field (overlaps `uses` and `gmOnly`).
- *Pack session:* tag the fifteen tables; G-144 → "ruled 2026-11-04 (it-1), M7".
