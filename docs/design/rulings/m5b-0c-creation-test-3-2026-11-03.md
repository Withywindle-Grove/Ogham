---
status: absorbed
milestone: m5b
absorbed-into: docs/09-decisions-log.md (2026-11-03), docs/plans/m5b-0c-creation-rebuild.md (Follow-up to the third test), docs/testing.md (to be added by the builder with the PR)
supersedes: PR D's "four tiles on the first row in landscape" (ct3-2); the full sheet's "How it's worked out" link (ct3-9)
---

# Creation, third test: a fae-woodland fighter (design ruling, 2026-11-03)

Francis made a fighter in fae-woodland on the iPad (2026-11-03) and sent 12 notes, collected then processed one at a time. The pack already carries several things the app doesn't read (a kindred's skill targets and magic resistance, its abilities with notes, a trait list's roll line and `excludeRaces`). Ids `ct3-1` … `ct3-12` follow his numbering.

## Technical (builder, no ruling)
- **ct3-1** Re-rolling a weak character (`startOver`) puts the tiles back at the dice average (ca-1), never empty.
- **ct3-4** A trait-list step shows the list's roll line from its `notes` / `die` ("Roll 1d100 at the table, then tap the range — or pick one.").
- **ct3-4b** A trait list's `excludeRaces` is honoured: an excluded kindred never gets the step (a duskcat was offered moon signs).
- **ct3-5** In creation the top row's back goes to the previous step, and a **Back** button sits beside Next on every step after the first.
- **ct3-7** The Player screen's left column (vitals, at hand, saves) shrinks with the open menu on an iPad in landscape; nothing is cut off.
- **ct3-8** Help me choose explains only the current step's list (a list's `help` on its own step).
- **ct3-10** Movement on the full sheet is worked out from the pack (one figure per exploration mode plus combat, 05 Movement), never blank when the pack has it.
- **ct3-12a** A kindred's `skillTargets` set the character's skills (Listen 5 for a duskcat) and its `magicResistance` shows on the sheet.

## Ruled
- **ct3-2 (A)** The score tiles are 3 + 3 in iPad landscape too (supersedes PR D's 4 + 2).
- **ct3-3 (ruled while collecting)** Affiliation stays on the sheet, is not asked at creation, and gets an ⓘ saying what it's for. *Pack task:* a help line for the field.
- **ct3-6 (A)** Two rolls on the same table show as one table, "Roll d4 twice · pick 2": the player taps two rows; the same row twice where the book allows.
- **ct3-9 (A)** The full sheet loses "How it's worked out"; every worked-out figure (hit points, AC, attack, each save, movement, level) is tappable and opens its own breakdown, as AC and Attack already do.
- **ct3-11 (A)** Every value that comes from a pack list (languages, moon sign, alignment, background, kindred, class) is tappable on the sheet and in creation and opens its entry: what it is, what it does, source and page. *Pack task:* blurbs where missing.
- **ct3-12 (pack survey, then a design session)** The rest of the book's creation (the kindred's abilities shown at creation and on the sheet, name tables, glamours, the trinket table, the background mapping per kindred, optional appearance and personality rolls, the book's step-by-step page) waits for a pack survey of the book's creation chapter against the pack and the app for every class, then a design session.
