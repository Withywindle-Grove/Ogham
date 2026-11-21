# Pack review area 4 fixes (2026-11-04)

**Source:** the pack session's review of area 4, fights and monsters (`design/notes/area-4-fights-review-2026-11-04.md`, PR #397; gap rows G-127 … G-135) and the design rulings in `design/rulings/m5b-pack-review-area-4-2026-11-04.md` (fi-1 … ). Technical only: `pack:check`. No new screen, no migration. Order 1 may go before the gate; order 2 goes after it.

**Not here:** the options themselves (unread until M6, `plans/options-audit-2026-11-03.md`); G-127, G-128, G-129, G-131 … G-135 (open gaps, M6/M7 format work).

## Build order

1. **`pack:check` warns on an unpinned stat-block or item clash** (fi-2, G-130). Given the packs a campaign stacks (or the files passed on one command line, in stack order), when two packs share a stat-block id (or an item id) with different stats and no pack above both carries that id, warn once per id, naming both packs: "ghoul is in classic-advanced and fae-woodland with different stats; add it to a conversion pack or put the right one on top". Same stats (deep equal on the entry minus `source`) → no note. One pack alone → no note. Lives beside eq-4's clash list (area-3 build order 12). Tests (purpose first): "two packs with the same ghoul and different HD warn"; "a third pack above both carrying ghoul silences it"; "identical entries don't warn"; "an item id gets the same treatment". Fixture: invented packs in `scripts/fixtures/`. ~1 turn.

2. **`pack:check` validates `overlays` and `modifications`, shape only** (fi-5; roadmap M6-13's checker half). **After the gate's builds, not before Thursday.** The fields 07 (Encounters and fights) lists for both kinds; `meta.requires` present on a pack carrying `overlays`; every `links[].statBlockId` resolves in the required pack or in the files passed in stack order (else a note naming the id); every reaction-table row has a `result`; `keepNumbers` boolean when present; a behaviour `profile` key outside wants / appearance / voice / intelligence / morality / other gets a note (fi-7). Unruled shapes stay notes: G-131 (several result columns), G-132 (`reactionColumn`), G-133 (text `statChanges`, `adds.triggers`). No importer change, no reading in the app (M6). Tests (purpose first): "an overlay whose link names a stat block the required pack lacks gets a note"; "a modification without `statChanges` or `adds` gets a note"; "a clean overlay on an invented base pack passes". Fixture: invented overlay + base in `scripts/fixtures/`. 1–2 turns.

## Scope checks for the builder
- Order 2 touches `scripts/` only; if it needs a change in `src/` (the importer), stop: that is M6-13.
- `pack:check` must accept several files in stack order for this; if it takes one file today, add the list form without changing the one-file form.

## Departures

(none yet)
