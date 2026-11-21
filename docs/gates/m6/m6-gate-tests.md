# M6 gate tests (draft, 2026-10-26)

Tests Francis can run himself once M6 is built, plus what Claude Code automates. The milestone check in 08: "Run a mock fight with hidden monster HP". Private packs: classic-advanced, fae-woodland, and **monster-overlay** (stage 1 of an overlay on classic-advanced; being built).

## A. Pack checks (any time, on the PC)
1. `npm run pack:check -- <monster-overlay's pack file>` (its folder is in packs/README.md) → no errors; the new kinds (overlays, modifications) are recognised.
2. The checker lists each overlay link and whether its target stat block exists in classic-advanced (no dangling links).

## B. monster-overlay with classic-advanced (in the app, tablet, light and dark)
1. Campaign with classic-advanced + monster-overlay. Add foes → Bestiary → Goblin: classic-advanced's numbers (HD, AC, attacks, morale) are shown; the panel says "Behaviour from the overlay" with its source.
2. A linked foe shows its nudges under its name; at the start they're the "start" lines.
3. Drop a goblin group below half → the nudge changes to the "losing" / "below half" line.
4. A foe with a limited ability (e.g. twice a day) shows dots; tapping one marks it used; it resets as the pack says.
5. A trigger (e.g. on death, below a fraction) appears as a ▲ reminder at the right moment; dismissing it does nothing else.
6. Roll tactics appears only on foes whose overlay entry has a tactics table; tapping a row logs it.
7. Add foes → Modifications shows the overlay's modifications (e.g. elite); applying one changes the stats shown and adds its nudges.
8. A foe with no overlay link: Add foes offers "Use the overlay's behaviour for <name>?" when a name matches; confirming links it for the campaign; declining leaves it plain. Nothing links silently.
9. Encounter → Reaction offers the overlay's reaction columns when the foe has a type (feral, general, grandiose, unusual).
10. Players' devices never receive behaviour text, triggers, morale scores or HP (check a player tablet: none visible).

## C. The fight loop (mock fight, from the 08 milestone)
1. Start an encounter from the current table (type the roll), surprise toggles, reaction, Fight.
2. Three characters, one hireling, two foe groups; 5 rounds with Next round (3 taps a round in side mode).
3. Players enter damage to foes (M6-1 on); HP stays hidden; "took N damage" shows; Goblin down from Wren on the GM screen.
4. Morale triggers fire on first death and half down; the check shows its target built from parts; a break sets All flee.
5. A character reaches 0 HP: the death dialog (or Dying with death's door on).
6. End fight summary (time, outcomes, captives, XP waiting, loot to share); separately, a run where the party uses We run (no loot, no XP).
7. Count player taps per round (target: at most one per player per round on average).

## D. Automated (Claude Code)
- Checker unit tests for the new kinds; overlay link resolution; nudge selection by fight state; trigger timing; hidden data never sent to players (the same test style as monster HP); the M6 journeys as click-through tests with budgets.
