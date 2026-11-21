---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (kit rolls `distinct`), docs/testing.md (the test guard), docs/09-decisions-log.md (2026-11-03), docs/plans/m5b-0c-creation-rebuild.md, docs/plans/m5b-1-travel.md, docs/plans/m5b-0d-library-and-campaign-rules.md, docs/plans/process-sdlc-1.md (Departures)
supersedes: PR E's "the row's text picks too" for alignment rows (bq-2); lr-9's Set time (bq-7, covered); P5's "the failing test on its own commit" as written (bq-6)
---

# Open questions from the builders (design ruling, 2026-11-03)

Eight questions from the builder sessions (PR I #352, #353, #328, PR H #333, #347, the 0d.1 scope check, #336). Ruled one at a time with Francis. Ids `bq-1` … `bq-8`.

- **bq-1 (A) Repeats on a twice-rolled kit.** The same row may be picked twice by default ("Twice ✓✓"); a roll may carry `distinct: true` where the book says two different ones, and a second tap on a picked row then says "Pick a different one". 07 line; the pack session sets it where a book forbids repeats.
- **bq-2 (A) PR I's readings, and tappable everywhere.** Confirmed: alignment rows open their entry with Pick at the foot (as ct-1; PR E's "the row's text picks too" is superseded), and figures no sheet field showed sit in the full sheet's Combat grid. Extended: **every worked-out figure is tappable wherever it appears** (the Player screen's vitals and play column, creation's Derived fields, the full sheet), opening the same breakdown; HP keeps its own tap (the damage pad for the GM, HP history for a player).
- **bq-3 G-114's city / settled split:** already ruled, ga-2 (`next.byTerrain`); the matching is #353's.
- **bq-4 (A) The location view's two missing pieces** (m5b-1 build order 7): the phone sheet and the empty state **"Where are we? · Set place"** (not "Somewhere unnamed") are built in M5b, before the gate.
- **bq-5 (A) Speed follows the load.** In M5b the sheet's Movement (speed, exploring, overland) reads the same speed the travel budget uses (the load tier; under the basic option, armour type and treasure), with a breakdown naming the reason; ga-1's slot bands change the one shared function later.
- **bq-6 (A) Tests first, made possible.** On a `fix-` branch the first commit adds the failing test marked `test.fails` (the check passes because it fails); the fix commit removes `.fails` and changes nothing else in the test, which must now pass. The guard (`scripts/guard-tests.mjs`) allows exactly that edit on a `fix-` branch and checks the pattern. Nothing is bypassed; the history proves the test failed first.
- **bq-7 (A) lr-9's Set time is dropped as covered** by B13's **Set start time ›** under the date (GM only, until the clock moves). Nothing to build.
- **bq-8 (recorded) #336's ⚑ A** (Francis, 2026-11-03): a race's save bonus by CON shows beside the save ("+3 to the roll"), not added into it.
