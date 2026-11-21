---
status: absorbed
milestone: December first play (the test feedback of 19 November: `docs/plans/test-feedback-2026-11-19.md`, row B1)
absorbed-into: docs/09-decisions-log.md (2026-11-19); docs/10-open-questions.md (the ⚑ removed); `docs/plans/test-feedback-2026-11-19.md` (row B1 and its ⚑ 7). No spec line changes: 06's voice rule 16 already keeps such lines in character creation, and the gate line `docs/testing.md:615` stands as it is
supersedes: nothing. It closes ⚑ 1 of `dec-test-feedback-words-2026-11-19.md` ("Not settled", the Armour class line at character creation); that file is not rewritten
---

# The test feedback of 19 November, sitting 1's follow-up: the Armour class line in creation (ruled 2026-11-19)

Sitting 1 left one question open (`dec-test-feedback-words-2026-11-19.md`, ⚑ 1). The driver put it to Francis the same day; his answer is in `docs/design/notes/test-feedback-2026-11-19-answers.md`.

## The ruling

| Id | Ruling | His words |
|---|---|---|
| tfw-8 | **In character creation the Armour class pop-up keeps its last line, "Your GM checks it at the table."** On the sheet and the Player tab the line is gone, as tfw-1 ruled | Asked: keep it in creation and drop it on the sheet (A), or drop it everywhere (B): "A" |

It is tfw-2's rule applied: outside character creation no line reminds the player what the GM does; in creation such lines stay.

## What it changes

Nothing to build. Row B1 already keeps creation's copy of the line (`creationAcLines`, `src/app/fromSetting.ts`), and its test says so. The words "until ⚑ 7" on that row are now "for good".

Docs to update: 09; 10 (the ⚑ removed); the plan (row B1, ⚑ 7). Done in the same pull request as this file.

09 line:
- 2026-11-19 — [words] In character creation the Armour class pop-up keeps "Your GM checks it at the table."; it stays gone on the sheet and the Player tab (tfw-8, closing the ⚑ of tfw-1; voice rule 16 applied) — Francis: "A"
