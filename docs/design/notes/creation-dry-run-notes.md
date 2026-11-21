# Character creation — paper dry run notes (2026-11-01)

Setting A: classic-advanced 0.5.8 · Setting B: fae-woodland 0.2.10 (aliases; the packs stay private). Walked by the design agent with Francis, one step per message, a mockup per step in `../mockups/creation/`. Rulings compiled in `../rulings/m5b-0c-creation-rebuild-2026-11-01.md` (cr-1 … cr-25). Invented examples only.

## Setup
Two runs over the same steps: A — a demihuman fighter with the weapon-skills option on, then a book caster; B — a non-human kindred with its background list and the sign option on, then a caster. Topics the packs handle differently: ability adjustment (both prose), languages (A: a table and race lists; B: an ad-hoc object), weapon skills (A only), trait lists (A: one; B: per-kindred backgrounds and signs), starting money (A: dice; B: an option), kits (5 vs 9; B rolls them without its buy option), derived sheet fields (both layouts list AC, movement and attack as plain fields).

## Steps and answers
**0 · The flow.** Francis: Back retains values, editable; Next checks for missing data or an illegal state. First spells before gear; Who they are after Class ("a name is the cherry on top of a random character"); counter in words.
**1 · Method and Scores.** Francis: tiles, starting at the average so + / − reach the roll quickly; no digital roll (a later release: parking lot); the pack must always say the dice and range.
**2 · Race and Class.** Francis: an unmet requirement offers Ask the GM; keep the "Not open to …" group because of it; the six entry headings are right.
**3 · Adjust scores.** Francis: the 07 shape approved; change the undo-trade icon (a labelled Undo); Back to Class resets all trades; no Decide later.
**4 · Who they are.** Francis: hit points here; alignment visibility per pack; derived fields all come from the pack; the section is called **Derived fields** (options offered: From the rules · Your sheet so far · Set by your picks · Already filled in).
**5 · First spells.** Francis: a duplicate roll is rolled again; cantrips on the same step; the spell book as a list; tapping a spell opens its full rules — generalised to every pick row (row = entry with Pick; ✓ slot = pick).
**6 · Gear.** Francis: kit and shop together; unusable items listed and explained; load tier live.
**7 · Languages.** Francis: the shape approved with an **Other…** row; skip the step when nothing to pick (the full sheet shows the given ones); the alignment tongue follows a later change.
**8 · Weapon skills and trait lists.** Francis: roll-then-tap or pick; Other… with an optional note; option-gated lists absent when off.
**9 · Review.** Francis: **Send to the GM**; Save and leave only on the review; add a First spells section.

## Findings about the packs (not design)
Both packs keep creation rules as prose where the app needs data: ability adjustment, score dice and range, the languages list and INT count (A: "Native + 1"), start-over and re-roll thresholds (option text). Neither has `creationGuide` or `firstSpells`. Both layouts lack `fill` on AC, movement and attack, which is why the old step asked for them. Setting A's secondary skills have no text in the source. The zine overlay's encumbrance options lack `ruleKey`, which is why two packs asked about encumbrance at campaign creation.

## Parking lot
"Roll for me" (a digital roll in creation) — a later release.
