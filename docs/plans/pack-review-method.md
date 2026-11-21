# Pack review: method and order (pack session, 2026-11-03)

Francis ruled on 2026-11-03 that the review standard used for character creation applies to **every part of the rules**, and that each review gets an **independent re-check** by a fresh agent. "Pack drives everything, so there can be no room for error or missed rules." The private packs keep the books' exact wording (09, 2026-11-03, [ip]); the copy check is information only.

## The method, per area and per pack
1. **Map.** List the book's chapters for the area, the pack parts that hold them, and the app modules that read them.
2. **Full read.** Every chapter in the area, appendices included, plus the printed sheet and the GM's book wherever they touch the area.
3. **Values by script.** Every table, list and per-level column compared with the book row by row. Ranges and coverage for rolled tables. Quantities against bundles. Ids resolved.
4. **Rules, book × pack × app.** For each rule: is it in the pack, in the right field, and does the app read it (grep before saying "unread")? Watch for soft limits written as hard ones, conditions, option-gated rules, and "roll or choose".
5. **Options audit** (Francis, 2026-11-03). For every option and choice in the area: what the book says it changes, the pack data that carries it, every screen it should change (creation, sheet fields that exist only because of it, Player screen, Pack tab, Scene and play, GM reference, pack:check), and whether that is true today (works, partly, broken or unread). Its rows join `options-audit-2026-11-03.md` (or its successor).
6. **Fix and log.** Fix plain data errors in existing shapes at once, with a new candidate version, its changelog and the sync to `_current` and Drive. Everything that needs a format or app change goes to `docs/11-modelling-gaps.md` as a GAP row.
7. **Second pass,** with fresh eyes on the risky claims, then **further passes until one comes back clean.**
8. **Independent re-check.** A fresh session runs the `pack-reviewer` agent (`.claude/agents/pack-reviewer.md`) with the area, the packs, the books and the note. It works from the books first and reads the note last. The pack session reconciles every disagreement (fix, or explain in the note) and re-runs the checks.
9. **Report.** A note `docs/design/notes/<pack>-<area>-review-<date>.md` (shapes only; tallies; per-entry tables; format fields needed; rulings pressed on; the passes and the re-check), GAP rows, a docs PR, and a paste-ready prompt for the designer.

## Conventions (ruled 2026-11-03, `design/rulings/m5b-pack-review-area-2-2026-11-03.md`)
- **Optional rules default off** unless the book recommends them; then on, with a `note` saying where (ex-4).
- **Two volumes disagree:** errata, then the subject's home volume; a summary page loses to the full entry. A line in the entry's `notes` and in the review note (ex-5).
- **Budgets are named honestly:** points unless one point is one mile (ex-6).
- **Options the app doesn't apply yet** carry `manual: true` and are listed in the options audit (ex-7).

## The sheet review (ruled 2026-11-04, `design/rulings/m5b-sheet-review-2026-11-04.md` sr-10)
1. List the printed sheet's fields (every page). 2. Map each to the app: on the full sheet, one tap away (the Player screen and the Pack tab count), or missing; write `sheetFields`. 3. Check seeded characters on screen (`npm run seed:test`), every class, with the options on and off. 4. Check, recheck, then a fresh session's pass until clean. The first run: `design/notes/sheet-review-2026-11-03.md`.

**Areas 4–7 (Francis A, 2026-11-04):** reviewed and ruled after the M5b gate work, then **planned** in their own milestone (M6, M7, M8b) and built there; only a fix to something already in play is built at once.

## The areas, in order (ruled 2026-11-03)
In-use areas first (an error there affects play now), then by the milestone that reads them.

| # | Area | What it covers | Packs | Why this order |
|---|---|---|---|---|
| 1 | Creation | Scores, races and kindreds, classes, first spells, kits, languages, sheet | classic-advanced, fae-woodland, zine overlay, deathcaster-class | **Done** (#331, #332); re-check pending |
| 2 | Exploration and time | Modes, movement, light, rests and camp, travel, hazards, checks, weather, encounter tables | classic-advanced, fae-woodland (+ the wilderness add-on) | Built in M5 and M5b, in play now |
| 3 | Equipment and encumbrance | Items (cost, weight, slots, bundles, armour and weapon stats, containers), kits, encumbrance methods, money | all setting packs, zine overlay | Used now (purses, packs, loads) |
| 4 | Fights and monsters | Initiative, attacks, morale, death, statuses, every stat block's values, behaviours and modifications | classic-advanced, fae-woodland, monster overlay, zine overlay | **Done** 2026-11-04 (`design/notes/area-4-fights-review-2026-11-04.md`); re-check pending |
| 5 | Magic and advancement | Every spell's fields, lists, casting and memorising, turning, XP, level-up, training, spell books | all setting packs, zine overlay, deathcaster-class | M7 |
| 6 | Settlements, hirelings, downtime, treasure | Services, lodgings, money changers, retainers and wages, treasure types, downtime activities | all setting packs, zine overlay, downtime-reference | M7 (downtime converts at M7 step 1) |
| 7 | Adventures | Locations, NPCs, factions, routes, tables | the adventure packs | M8b |

## Estimate
About one pack session per area per setting, plus one reviewer session each. Areas 2 and 3 first, because they're in use; the rest just before their milestone.

## New packs (ruled 2026-11-03)
Every new pack conversion follows the same method, area by area, before its first candidate is handed over. That means the full read, values by script, book × pack × app, passes until clean, and the independent `pack-reviewer` re-check. The converter skill (`skills/content-pack-converter/SKILL.md`, `PLAYBOOK.md`) points here. A conversion isn't done until the re-check is reconciled.

## First run
The reviewer's first run is on area 1 (creation), to calibrate it.
