---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (Exploration: checks, activities, budgets, tables; options), docs/plans/pack-review-method.md (conventions), docs/09-decisions-log.md (2026-11-03), docs/11-modelling-gaps.md (G-114)
supersedes: G-114's per-cell table ids (ex-1)
---

# Pack review, area 2 (exploration and time): the re-check's questions (design ruling, 2026-11-03)

From the independent re-check of area 2 (`design/notes/area-2-exploration-review-2026-11-03.md`, PR #350). Ruled one at a time with Francis. Ids `ex-1` … `ex-7`.

- **ex-1 (A) Chaining tables by name.** `nextTablePattern` (07) matches the cell's text **normalised**: lower case, spaces and punctuation as hyphens ("Dense Woods" → `wild-dense-woods`). `pack:check` warns when a cell matches no table. G-114 closes once the packs use the pattern; no per-cell ids.
- **ex-2 (A) Modifiers keyed to the party.** A check's or activity's `modifiers` may carry `ifPartyHas: { class } | { skill }` (applies while someone in the group has it) and `who: "self"` (applies to that character only, as a class surprised less often). The roll line names the source ("−1 · a <class> in the party").
- **ex-3 (A) A skill standing in for another.** An activity's `chance.skill` may be a list; the best target the character has counts, and the roll line names it.
- **ex-4 (A) Optional rules default off** unless the book recommends the rule or presents it as the usual way; then a pack may default it on, with a `note` saying where the book says so.
- **ex-5 (A) When two volumes disagree:** official errata wins; else the volume that is the subject's home (the bestiary for a monster's numbers, the GM's volume for a procedure or table, the players' volume for characters; a summary page loses to the full entry). Recorded twice: a short line in the entry's or table's `notes`, and the review note.
- **ex-6 (A) Naming the day's budget honestly.** A budget is named in points (the pack's own word) unless one point is one mile; "miles" only then. Where the book also gives distances, the travel breakdown shows them as a second line.
- **ex-7 (A) Options the app doesn't apply yet.** Shown, marked **"Run by hand · the app doesn't apply this yet"**, their rules one tap away, the GM's choice saved. The pack marks them `manual: true` until the app reads them; `pack:check` and the options audit list every one.
