---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Characters: Guided creation, rebuilt), docs/06-screens-and-design.md (Creation step shell, Score tiles, the GM's review), docs/07-content-packs.md (`creationGuide.<step>.title`; `ruleKey` add-ons), docs/09-decisions-log.md (2026-11-02), docs/design/mockups/creation/02-race-and-class.html
supersedes: parts of design/rulings/m5b-0c-creation-rebuild-2026-11-01.md (cr-7 Ask the GM; cr-8 and cr-10 Decide later on Race and Class; cr-9 the average's rounding)
---

# Character creation: amendments from slices 1–2 (design ruling, 2026-11-02)

The builder's Departures in `docs/plans/m5b-0c-creation-rebuild.md` (slice 1 item 6, slice 2 items 1–3) and the pack session's doubt in the zine overlay's changelog. Francis ruled them to the builder during the night; this file writes them down. Ids: `ca-1` … `ca-5`.

- **ca-1 The dice average rounds down** (3d6 → 10, 2d8 → 9). Score tiles start there. Amends cr-9; 07 `scores` says so.
- **ca-2 Race and Class have no Decide later.** Every later step needs the class, and the race drives the class list. Race keeps "Use <default race>" where the setting has a default and the method allows it (ruled 2026-10-26). Amends cr-8, cr-10 and the mockup `creation/02`.
- **ca-3 Ask the GM is replaced.** An unmet requirement or a class not open to the race is **not** a Request: the row carries a note, **"Needs the GM's special approval"**, the player can pick it and keep going, and the GM's approval screen **flags the choice** ("Stone kin · needs DEX 9, has 8 · special approval") beside Approve and Send back. The folded "Not open to <race> · N ›" group stays. Supersedes cr-7; the `allowChoice` Request kind and `creation.askAllow` built in slice 1 are retired (the builder removes them in a later slice; nothing to migrate: no request of that kind exists on main).
- **ca-4 The pack names a step's title:** `creationGuide.<step>.title` (optional; "Kindred"). The shell shows it when present, else the app's word. 07 amended.
- **ca-5 Option add-ons carry no `ruleKey`.** An option that `requires` another option is an add-on to that rule, not a rival: it keeps `requires` and drops the `ruleKey`, so it is offered only when the GM has chosen the parent. For the pack session: the zine overlay's STR add-on to item encumbrance.

## Mockup
`creation/02-race-and-class.html` amended in place (Decide later removed from the Race and Class feet; the unmet row and its note show the special-approval wording). No new picture.

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-02 (five lines tagged [characters], [packs]).
