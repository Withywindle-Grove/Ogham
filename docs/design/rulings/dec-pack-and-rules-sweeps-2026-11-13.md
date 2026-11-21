---
status: pending
milestone: December first play (the sweep of the Pack and Rules tabs, after `docs/plans/dec-10-creation-sweep.md`; the Tester's creation walk)
absorbed-into: pending, with the plan for the Pack and Rules sweeps (not yet written) and with 05 and 06; 07 (`patrons`; `traitLists` `rolls`, with its pull request); docs/09-decisions-log.md (2026-11-13)
supersedes: nothing. The approved Pack rework (coin, the stash screen) is not part of this sweep and stands as ruled
---

# The Pack and Rules sweeps, and what the creation walk found (2026-11-13)

Francis asked for the creation sweep's process to be repeated for the Pack and Rules tabs ("After completing this process do the the same for pack and rules tabs"), with the lead's changes pre-approved and each batch still shared with him ("Actually pre approval stands but still share the mock ups"). The Design Studio drew four batches **from pictures of the built screens** (cs-30: the sweep dresses what is built, removes nothing it shows, adds nothing it lacks). Pages, on branch `design-december-mockups`: `docs/design/mockups/pack/05-sweep-a-pack-tab.html`, `pack/06-sweep-b-actions.html`, `library/06-sweep-a-library.html`, `library/07-sweep-b-entries.html`. Behaviour, rules, ruled words and scope stayed questions for him.

## The Pack tab (batches A and B)
| Id | Ruling |
|---|---|
| psw-1 | Group heads are small capitals; a chevron is the one fold mark; an open fold drops its summary line. "At hand" and "Worn and in hand" stay as built (ruled words). The GM's chips stay chips; a long name's chip is never cut. |
| psw-2 | A weight is a bare figure at the right under a **"Weight"** head on the group's line; the unit is said once, on the load's line. (Bare figures without the head read as a second quantity.) |
| psw-3 | The foot counts each carried thing once ("11 items"), not by quantity. |
| psw-4 | **The coloured capitals heading is for an entry** (a thing, a place, a class, a spell, a table). A sheet that does something (Give, Drop, Put in, Add item) keeps the app's title and names the thing once, under it. |
| psw-5 | On the action sheets: a weight reads "Weight 50 coins"; coin reads in the pack's coin words ("4 silver"); the toast draws its running bar; one way out of a sheet (ds-9); "Bought / No cost" is the two-sided switch (ds-1d); the cost sits above its button. |
| psw-6 | Two cures of built faults, drawn and flagged for the Builder: Give and Put in are one sheet with a link back; a container's note opens under its head. A taken kit's entry that mislabels its lines is a fault, not a design. |
| psw-7 | The tablet's empty right column stays as built until the Pack rework. |

## The Rules tab (batches A and B)
| Id | Ruling |
|---|---|
| rsw-1 | The library, the import card, a pack opened (kinds as folds), About this file, search and the campaign's rules page are dressed as built. The import list of mc-78 is approved and not built: it is not drawn in. About this file shows no id and gains no Version line. |
| rsw-2 | On the campaign's rules page a fold's state sits on its own line under its name. "Add more setting rules" keeps one line: "Newer additions sit on top, under any homebrew." A pack's kind is said in the pack's own word everywhere. |
| rsw-3 | **An entry in the Rules browser is the same entry creation opens** for that kind (cs-4), without the character's parts (no "you have 13 ✓") and without "Pick". The browser never prints raw fields or ids. |
| rsw-4 | A class's entry shows in words everything the build shows: the level table (cs-16), a second table "Attack and saves by level", weapon proficiency, each ability's uses, and its creation methods and starting kits as named lines. On a phone the second table is two ("Attack by level", "Saves by level"). |
| rsw-5 | A spell's level line names its list. A table's entry is headed by its own title bar (the name once, ds-8). A condition's parts as drawn. A creature is the stat block of sb-1. |
| rs-1 | **A rules set's page is a contents page**: about twelve chapters, each a fold, each opening in the book format. Francis, on the proposal (`docs/design/notes/rules-set-entry-proposal-2026-11-12.md`): "Right direction." Still his to rule: whose names the chapters carry, whether players see a rules set, and whether a first step with only the chapters that are already clean is acceptable. New work, not yet sized. |

## What the creation walk found
The Tester made 24 characters in a test campaign with the December packs at a fixed starting level of 2. All were created. Not covered: the second human, the fae-woodland kindreds and classes, twin classes, a kit taken through its steps (a second, shorter walk follows the conversion's next build).

| Id | Finding | Ruling |
|---|---|---|
| wk-1 | A class with a hard alignment limit was offered every patron; picking one its alignment can't follow left no alignment to pick. | A patron whose followers' alignments can't meet the class's limit is **closed**: a row with the warning sign and "Not open to <class>", no Pick, its entry saying why. Outside a soft limit the patron goes to the GM with the reason. The Patron step shows only when a patron is open; a class whose patrons are all closed is not held. Closed patrons get a fold of their own, "Not open to <class>", not the fold for what needs the GM's approval, since approval can't open them. |
| pf-16 | Tables the book rolls twice on gave one pick. | A trait list may carry `rolls: N` (roll or pick N times at creation; absent means 1) and `distinct: true` (no result twice). Francis: "A". The words on the step are the Builder's, approved by the lead with one cut. |
| wk-2 | After Create the app showed the character played before. | The joined toast carries an action, "Play as <name>". No automatic switch. |
| wk-3 | The spells step's foot was out of date. | "1 roll and 2 cantrips to go", naming rolls and picks apart. The head line is the pack's guide text and is reworded there. |
| wk-4 | A kindred with two classes was asked for one. | Not modelled (G-64, unchanged): the GM notes the second class by hand. |

Also found, and not a ruling: on an iPad a table's sheet re-placed itself in a loop after a tap. A sheet on a tablet is placed once as it opens and afterwards only moves up to stay on screen (a fix, with tests; proof on Francis's iPad).

## Honest notes
- The lead opened about half of the final pictures of the four batches, and almost none in light mode.
- Nothing here is planned or sized yet: the plan for these sweeps is owed, and each piece names its picture.
- rs-1 is a direction, not an approved screen.

Docs to update: 07 (`patrons`, done here; `traitLists` `rolls`, with its pull request), 05 and 06 (with the sweeps' plan), `docs/plans/dec-10-creation-sweep.md` (the closed patrons' fold), 09.

09 lines:
- 2026-11-13 — [ui] The Pack and Rules tabs are swept from pictures of the built screens, as creation was: a "Weight" head over the weights, the foot counting things once, the coloured capitals heading for an entry only, and a Rules entry the same as the one creation opens (psw-1 … psw-7, rsw-1 … rsw-5) — "After completing this process do the the same for pack and rules tabs" (Francis) — `design/rulings/dec-pack-and-rules-sweeps-2026-11-13.md`
- 2026-11-13 — [ui] A rules set's page is a contents page of chapters, each a fold opening in the book format (rs-1; a direction, three questions still open) — "Right direction" (Francis) — `design/rulings/dec-pack-and-rules-sweeps-2026-11-13.md`
- 2026-11-13 — [sheet] A patron a class's alignment can't follow is closed with its reason, in a fold of its own, and never leaves a dead end; the joined toast offers "Play as <name>"; the spells foot names rolls and picks apart (wk-1 … wk-4) — The Tester's walk of 24 characters found a paladin with no alignment left to pick — `design/rulings/dec-pack-and-rules-sweeps-2026-11-13.md`
- 2026-11-13 — [packs] A trait list may carry `rolls: N` and `distinct` (pf-16) — "A" (Francis): tables the book rolls twice on gave one pick — `design/rulings/dec-pack-and-rules-sweeps-2026-11-13.md`
