# Plan: two town bugs from the pack session's re-check (fix branch)

Reported by the pack session's re-check on 2026-11-04 and handed to a builder by the coordinating session. **M5b**, one pull request on `fix-town-options-and-stack`, no migration. Tests first (bq-6): the failing tests marked `it.fails` on their own commit, then the fix removes `.fails` and changes nothing else in them.

## 1. Town entries ignore `option`
**Bug.** `readTown` (`src/modules/expedition/town.ts`) read services, lodgings and lifestyles without the shared option reader, and `resolveRules` (`src/modules/library/options.ts`) handles only `byOption`. So fae-woodland's lifestyles (`option: "lifestyle-expenses=on"`) and its valuation service (`option: "treasure-valuation"`; the zine has one too) always showed, and the town's Overview read "Living: Wretched · – a day" with the option off.

**Fix.** Every town entry (service, lodging, lifestyle) carrying `option` (one spec or a list, of-3, of-12) is in play only while its choice is on, through `optionGate.ts`'s `optionGate` (its `byOption` applied as for any entry). `readTown(rulesSets, choices)` takes the campaign's choices (`choicesInPlay`); the town screen, the player's town line, 6e's buy, sell and lodging pickers (TownActions) and the GM's sale card (`townTrade.ts`) read it so. A place the GM showed while its option was on leaves the player's line and pickers when it goes off (`shownInPlay`). Town activities already read `option` (`modes.ts`, `optionSpecOf`).

## 2. A rules overlay hides the base town's services
**Bug.** With the zine overlay (its pack `meta.requires` classic-advanced) the town took the top rules set's `settlement.services` whole, so classic-advanced's five services disappeared.

**Fix (ov-1's list rule only).** The town's lists (services, lodgings, lifestyles) merge across the stack by id when the upper rules set is an overlay's fragment (`extends` a rules set below it): a same id takes the overlay's copy in its place, new ids are appended. Not built here: the rest of ov-1 (the `extends` fragment merged into the whole rules set, scalars, `pack:check`'s list of overrides); after the gate.

## Tests
- `town.test.ts` (pure): an entry only while its option is on (service, lodging, lifestyle); an option list on an entry; an overlay merged by id in the base's order, lodgings by name.
- `townScreen.test.tsx` (the stand-in database): options off, no "Living:" line and no valuer; on, both. A shown place leaves the player's line when its option goes off. Base plus overlay shows the base's services, the overlay's new one, and the overlay's copy of a same id.

## ⚑
None.

## Estimate
3–5 turns.

## Departures
- **Merge only along `extends` (technical; for Francis to confirm).** The task said "merge across the stacked rules sets by id". Built: the merge applies when the upper rules set `extends` one below it (the zine's fragment extends classic-advanced's rules set); two unrelated rules sets stacked keep the old rule (the pack on top wins), as the existing test ("takes the top pack") pins and ov-1 describes (a rules overlay's fragment). Merging two settings' towns would list two of each shop. If you want every stack merged, it is a one-line change, but the old test then needs changing outside a fix branch.
- **Lodgings and lifestyles merge by name.** Neither real pack gives them an `id`; the merge key is the `id`, else the name (as the town's place keys already are, `lodging:<name>`).
- **`readTown`'s choices default to none** (every option off), so a caller that forgets them hides option entries rather than showing them; the existing tests call it without.
