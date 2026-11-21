---
status: absorbed
milestone: m5b
absorbed-into: docs/09-decisions-log.md (2026-11-05); docs/11-modelling-gaps.md (G-148, by the pack session)
supersedes: —
---

# A price per unit of size (design ruling, 2026-11-05)

One question from the pack session (G-148). Ruled with Francis. Id `pu-1`.

**The case.** One item in classic-advanced is priced by its size, not as a whole: a built raft at a rate per square foot (invented example: **Reed platform, 2 sp per square foot**); its cargo is per square foot too. The pack held a wrong flat price; the pack session replaced it with the printed price as text in the item's vehicle block, so a shop can't sell it.

| | Option | Why not / why |
|---|---|---|
| A | Leave the price as text; the GM adds the item by hand at the agreed price | One item; no new format word, no size picker |
| B | `value: { …, per: "square foot" }` and the buyer picks a size in the shop | A new shape and a picker for one item |

- **pu-1 (A).** The price stays as text; the item carries no `value`, so shops don't offer it and the GM hands it out at the price agreed at the table. G-148 stays in the register as "ruled → pu-1, text; revisit if a second size-priced item appears" (boats come with water travel, R2).

Docs to update: 09; 11 (G-148's row, by the pack session in #397).

09: 2026-11-05 — [items] An item priced per unit of size (a raft per square foot) keeps its price as text and carries no `value`; the GM hands it out at the agreed price; revisit with a second such item (pu-1, G-148) — One item; a per-unit price needs a size picker in the shop — `design/rulings/m5b-price-per-size-2026-11-05.md`
