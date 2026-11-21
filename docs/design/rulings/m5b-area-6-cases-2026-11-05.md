---
status: absorbed
milestone: m5b (the buy card's line after the gate); the rest with M8b
absorbed-into: docs/07-content-packs.md (items: availability), docs/09-decisions-log.md (2026-11-05), docs/plans/m5b-6-settlements.md (after the gate)
supersedes: —
---

# Settlements and treasure: the open cases of pack review area 6 (design ruling, 2026-11-05)

Two cases from the pack session's review of settlements, hirelings, downtime and treasure (`design/notes/area-6-treasure-towns-review-2026-11-05.md`), ruled with Francis (A, B, synthesis). Ids `a6-1`, `a6-2`. A third row is parked, not ruled.

- **a6-1 (B) A cursed shield that forces a fixed AC (G-146).** One item sets its wearer's AC to a fixed poor value whatever armour is worn. **It stays text:** the item's GM note says what the curse does, and the GM uses **Set AC** (a character's AC set by hand, its breakdown reading "Set by hand", with Clear) when the curse shows itself. No new field.
  - *Why:* one item; the tool exists; a curse is usually a secret, and a field that moved the AC line when the shield is worn would tell the player. It comes back as a case if a second item forces a figure.
- **a6-2 (synthesis) Where an item is sold and its chance of being in stock (G-121).** One setting says some gear is sold only in larger settlements, gives herbs and the like a chance of being in stock, and prices drinks by an inn's quality (invented: "Lantern oil: towns and cities. Fen-moss: 3-in-6 in any village."); about a hundred and twenty items carry it as free text.
  1. **Pack, now:** an item may carry **`availability: { where?: [settlement sizes], chance?, rarity?, note? }`**: `where` uses the setting's size names exactly as `settlement.availability.bySize` writes them; `chance` is "x-in-6" or "always"; `rarity` keeps the book's word (common, uncommon, rare) unless the book says what the word means in numbers; anything else (drinks by an inn's quality) stays in `note`. The checker wants `where` to name known sizes.
  2. **App, small, after the M5b gate:** the GM's buy card (Ask for…) shows the item's own line under the settlement's chances ("Towns and cities · 3-in-6"). The GM still decides Hit or Miss; nothing is filtered.
  3. **App, with M8b:** once a place knows its size (G-157), Ask for… says by itself when an item isn't sold in a place that small.
  - *Why:* places have no size in the app until M8b, so structure alone changes nothing on screen; showing the line is the real gain now.

**Parked, not ruled:** training to level up (G-32) goes with the downtime design, as the pack session proposes; neither setting requires it as converted.

Docs to update: 07, 09, `plans/m5b-6-settlements.md`.

09: 2026-11-05 — [items] A cursed item that forces a fixed AC stays text; the GM uses Set AC when the curse shows itself (a6-1, G-146) — One item; the tool exists; a field would give the curse away — `design/rulings/m5b-area-6-cases-2026-11-05.md`
09: 2026-11-05 — [items] An item may carry `availability: { where, chance, rarity, note }`; the GM's buy card shows that line after the M5b gate, and Ask for… uses it by itself once places have sizes (M8b) (a6-2, G-121) — About a hundred and twenty items say where they are sold or how often they are in stock; the GM shouldn't have to remember it — `design/rulings/m5b-area-6-cases-2026-11-05.md`
