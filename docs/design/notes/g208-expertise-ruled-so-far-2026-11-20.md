# G-208 expertise points: ruled so far (2026-11-20)

Compiled before drawing, for the G-208 design sitting. Every ruling in force for creation's skill steps, level-up and the sheet's skills, newest first per part, with its source. Invented examples only; the books' figures stay in the private packs.

## The gap and its format
| Part | In force | Source |
|---|---|---|
| The gap | A class spends points on its skills: each skill starts at the same small chance on one die; points at 1st level and more each level, each point raises one skill by one step, up to a cap | 11 G-208 (proposed 2026-11-08, open) |
| Format, first ruled | `classes[].skills: { mode: "points", pool: [{ level, points }], cap }`; "the spend step follows the weapon skills pattern (count, To finish while unspent)" | 11 G-66; 07 Point-buy skills; 09 2026-11-01 (zine gaps) |
| Format, proposed | Under the option, the class's skills `byOption` with `base`, `die`, `max` and `points: { atStart, perLevel }`; creation and level-up ask where the points go | 11 G-208 (2026-11-08) — not ruled; **reconcile with G-66** |
| When it is built | After the M5b gate, first in the post-gate queue, with G-207 (fighter talents) | 09 2026-11-08, 2026-11-09; rulings R3-11 |
| An option the app can't apply | `manual: true` → "Run by hand" on the campaign rules page; the choice is saved | 07 (ex-7, 2026-11-03) |
| Options at creation | A creation-relevant option appears in creation when on, is absent when off; a test per option (on → present, off → absent); "thief expertise" named | ct-10, 2026-11-02 |
| Where an option changes a class | Any entry may carry `byOption` (its fields under a choice); a pack may `patches[]` entries in attached packs (a dotted path, objects only) | 07 of-3 (2026-11-03), of-13, of-14, pf-19 |

## Both books, as the private packs hold them (described, no figures)
- **The zine** (overlay on classic-advanced): an option, off by default, `manual: true`. Under it the base book's thief rolls its skills on a d6 instead of percentages, gains one more skill from 1st level, every skill starts at the same low x-in-6 chance, points at creation and a smaller number each level, each point +1 step, a cap below certainty. The base thief's skills are percentages by level today.
- **fae-woodland**: an option "Customising class skills", off by default, `manual: true`; three classes (bard, hunter, thief). The skills are a target on a d6 rolled **equal or over**: each starts at the highest target and each point **lowers** it by one, to a floor. Points at creation and each level differ by class. Same idea, the other direction.

## Creation step (the pattern to follow)
| Part | In force | Source |
|---|---|---|
| Step order | The pack's `creationGuide` order, then the app's | 09 2026-11-01 |
| Shell | Creation step shell: why-line (≤ 12 words, from the pack's `creationGuide.<step>.why`), Help me choose (pack's `help`), Decide later (quiet) unless `creation.require`, Back · Next on one row, Next the one accent, always tappable, saying what's missing | cr-1, cr-2, N10, ct-9, 06 |
| A count | "1 of 2 picked" beside the heading; foot says what's left ("1 spell to go") | ct-8, sweep E (2026-11-12) |
| Several to one row | A row picked more than once shows its count with − to put one back ("Picked ×2"); the heading counts every pick; Undo per pick | R3-8 (2026-11-08) |
| Limits | Never greyed; a tap at the limit explains (`Stepper` `onLimit`) | 06 Components, bq3-4; hard rule 7 |
| Row text | Tapping the row's words opens the entry (here: the skill's breakdown, the pack's `notes`) | ct-1, cr-16, R3-13 |
| Decide later | Puts the step on the To finish card | M7-4, 2026-11-01 |
| Review | One card per step walked with Change | cr-18, cw-11 |

## After creation and levels (weapon skills, the precedent G-66 names)
| Part | In force | Source |
|---|---|---|
| Where picks live | On the character (they grow with levels), not the creation record | m5b-0 §2 (2026-11-01); 04 PC extras `weaponSkills` |
| Allowed | Derived from the level; unspent = allowed − used | same |
| To finish | "Weapon skills · N to pick" while unspent > 0, at creation and after each level-up that grants one; the line reopens the step | same; 06 To finish card |
| Who changes | Before approval: owner, freely. After: owner **adds** while unspent (logged); removing or swapping is the GM's (fiat, logged) | same |
| Level-up preview | M7-2's preview (Roll tiles, What changes, Learn a spell · Choose ›) is **not built**; M7 lists To finish items | 06 XP and level up; 08 M7 |

## The sheet's skills
| Part | In force | Source |
|---|---|---|
| Skills block | Everyone's skills, then the class's (named after the class), each a List row: name, value in the pack's style ("2-in-6" or "5+"), chevron; > 4 folds | sr-2, plan players-screens-standard D, 06 |
| Breakdown | Each skill opens its sheet: the pack's words (rules set's `notes`, then the class's), odds both ways ("Succeeds on 5 or 6 · 2 in 6") | R3-13, CS-5a |
| Heading | Die glyph and the rules set's roll line (`rolls.skill`), page M1 owed | tfs-2, tfs-3 (2026-11-19) |
| Hidden data | Skills are not hidden data; a sheet shows what that viewer may see today | 03 |

## Not settled (the sitting's questions)
1. The format: G-66's `mode: "points"` or G-208's `byOption` shape — one shape for both books.
2. Where the points are spent in creation, and at level-up while the preview is unbuilt.
3. What the sheet shows of the points.
4. Re-spend and Undo: before and after approval.
5. What the GM sees and may change.
6. fae-woodland's three classes now or later.
