---
status: pending
milestone: December first play (encounters: `docs/plans/dec-5-encounters.md`, piece 5c, pull request #642; the sweep of the app's type)
absorbed-into: pending, with #642 and the sweep; 06 (type, the stat block part, the book's label colour), 07 (`statBlockLayout`); docs/09-decisions-log.md (2026-11-12)
supersedes: the stat block as a plain list of label and value rows (m5b); 06's type pair for the screens the sweep reaches (ts-1, ts-2)
---

# The stat block's layout and the book's type (2026-11-12)

Ruled by Francis on the afternoon of 2026-11-12, on the Design Studio's pages `docs/design/mockups/december/06-stat-block.html` and `07-type-everywhere.html` (branch `design-december-mockups`). Written down late; the later rulings that cite these ids (sb-1a, sb-1b, ts-3, cr-c1, cr-c2) are in their own files. Examples are the mockups' invented ones.

## The stat block
| Id | Ruling | His words |
|---|---|---|
| sb-1 | A creature's stat block follows the layout of the best-formatted of the setting's books: under the description a descriptor line in small capitals (kind, wits, alignment, as the pack gives them); the core figures as a compact block, each label followed at once by its value, several to a line, in the groups the pack's layout declares, with a dotted rule between groups; then the abilities as paragraphs, each with its name as a bold lead-in; the source last. Saves and abilities are always there. A die named anywhere carries its glyph (ds-3). Labels are the pack's own words. | "missing saves and abilities … copy that format" |
| sb-2 | The labels are coloured at the regular weight, not bold; light mode has a label colour of its own (cr-c2). | "coloured labels: show me without bold … agreed they're busy but let's keep them. Saves are fine." |
| sb-3 | The waiting encounter's card carries each creature's stat line; the full block opens from it. Companions on a row are approved as drawn. | "can we add the statlines for any creatures in the encounter?"; "Companions approved" |
| sb-4 | A creature a table names that no attached pack carries reads "Not in your packs: <name> (<pack id>)". | (the Builder's words, accepted) |
| pf-13 | A pack may carry `meta.statBlockLayout`: `{ descriptor: [field…], groups: [[field…]…], hide: [field…] }`, the fields named as the pack's creatures name them; `"hp"` is reserved for hit points with their dice. With no layout the app draws one group in the creature's own order. A figure the layout neither places nor hides is drawn after the groups (sb-1a). | |

## The type
| Id | Ruling | His words |
|---|---|---|
| ts-1 | The book's type is a pair, the closest free match to the setting's books: Bitter for text, names and titles; Alegreya Sans SC for the small-capitals lines (descriptors, small labels). | "yes comparison - let's see how closely we can match fonts for free" |
| ts-2 | The pair goes everywhere in the app, in one change, at the sweep after the December mockups; until then the stat block (and, by cs-1, character creation) carry it through tokens of their own. | "b, but i'm not sure why i wouldnt want it everywhere"; "B: the pair everywhere, done with the sweep after the mockups." |
| ts-3 | With the pair the app's figures take a plain zero (the face has no slashed one); figures still line up in columns. | "accept plain zero" |

## Undo that is refused
| Id | Ruling |
|---|---|
| ud-2a | An Undo that cannot be done says what was not undone and what to undo first ("Next day wasn't undone. Undo the move to the jetty first."), with "Show it in the log". The Design Studio's wording, approved with set 4. |

## Honest notes
- The pair adds about 119 KB to what the app keeps for offline use.
- Contrast of the label colours was worked from token values and judged by Francis on the pictures in colour and with the hue taken away; it was not measured on a screen.
- Two colours used by the book format still need names in 06: the sub-heading's and the box's ground.
