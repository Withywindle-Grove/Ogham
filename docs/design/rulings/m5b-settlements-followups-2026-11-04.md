---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Settlements: who sees the town; the overnight summary), docs/07-content-packs.md (settlements: `onGoodRest` on lodgings, lifestyles and the settlement), docs/09-decisions-log.md (2026-11-04), docs/plans/m5b-6-settlements.md (Departures), docs/testing.md (gate check 50)
supersedes: —
---

# Settlements follow-ups: the town's name, and what heals overnight (design ruling, 2026-11-04)

Two questions from Build on the settlement PRs (#418's security review; #431's scope check SC-6e-1). Ruled with Francis, A, B, synthesis. Ids `sf-1`, `sf-2`.

- **sf-1 (synthesis) A town's name reaches players only once the place is shown.** `scene_town` gave players the town's name as soon as one entry (a shop, a lodging) was shown, before the place itself. One rule everywhere (hard rule 5): the town's name and its entries reach players only once the place is shown — in the database, in the review's fix migration. The UI side: when the GM shows an entry in a town not yet shown, the app shows the town too, one tap, logged, toast "Shown: <town> and <entry>" with one Undo. Visibility test: a shown shop in an unshown town stays invisible at the database level. Not taken: documenting the leak as an exception (A).
- **sf-2 (synthesis) What heals overnight in town: camp's shape, offered, never automatic.** `onGoodRest` (the sleep step's effect list, 07) may sit on `downtime.lodgings[]`, on a lifestyle, and as a settlement default (`settlement.overnight.onGoodRest`); the most specific wins; `[]` means no healing (sleeping rough, a poor lifestyle). A rest-day activity may carry the same list, and there its `heal` may be dice (a setting whose rest heals a rolled amount per full day): the app never rolls, so the offer asks for the typed roll, as creation does with HP. A setting with no per-night rule says `settlement.overnight.onGoodRest: []` (technical note, 2026-11-04 evening, for classic-advanced). The morning **offers** it ("Heal 1 HP to: ✓ ✓", one confirm, logged), and the overnight card names the source ("+1 HP · a night at The Lantern Rest"). No new shape, no automatic HP. **Not a gate item:** until built, the card shows the rule as text and the GM's Heal serves; gate check 50 carries a "(to build)" tail. Not taken: a new field applied automatically by the morning move (A; camp's rule is offer, never apply); a GM heal panel each morning (B, paperwork); players healing themselves from the HP pad with nothing logged (C).
