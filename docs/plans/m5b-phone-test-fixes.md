# m5b-phone-test-fixes: two fixes from Francis's phone test (2026-11-09)

Relayed by Design through the coordinating session; built on `m5b-retest-4-fixes` (#570), which reworked the roll
sequences. No ⚑. Estimate: 1.5 hours.

1. **Roll sequence, a row rolled more than once.** It shows one ✓ per time at the right (✓✓ for twice, three for three
   times), with no count in words ("twice", "Picked ×2"). The − square that puts one back stays (retest 4 T3). The
   sequence's foot keeps its list. Test: the twice row has two marks and no "twice" in its text.
2. **Rules tab, a group tapped open.** Opening an "Optional rules: <pack>" group landed mid-group. It scrolls the
   group's heading to the top, under the sticky top row, so the first item shows. Fixed in the shared part for every
   group of that list. Tests: a unit test (the scroll is asked for, with `block: 'start'`) and a WebKit layout check
   (after opening, the heading's top is at the top row's bottom).

Not in scope: the "Run by hand ›" links and the source codes ("i1 p. 29"); other pull requests cover them.

## Departures

- Item 1 was first briefed the other way round (", twice" in the words, one ✓); the coordinator corrected it to ✓✓
  mid-build, and that's what's built.
- The cause of item 2 isn't `FoldedGroup`: the Rules tab's groups are `RulesForThisCampaign`'s own toggles (topic
  groups and `RuleSourceGroup`). On a phone one group is open at a time, so the open group above folds as the tapped
  one opens and the page kept its scroll position. The fix is in `RulesForThisCampaign`, so it covers the GM's Rules
  tab and campaign set-up's Optional rules step. `FoldedGroup` is unchanged.
- Added after review (Design's ruling on the ⚑): a row rolled two or more times is named "… picked twice" ("… picked
  three times") for a screen reader, read aloud only.
- This plan file was written by the builder from the brief (there was none for the step).
