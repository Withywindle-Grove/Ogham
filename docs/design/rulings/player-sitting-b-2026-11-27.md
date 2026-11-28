---
status: absorbed
milestone: December first play (loop 2, the Player sitting's spec, `docs/specs/player-sitting.md`; pull request #160)
absorbed-into: docs/specs/player-sitting.md ("Ruled at sitting B"); docs/09-decisions-log.md (2026-11-27); docs/05-features.md (Characters, the pinned spell; Player screen, Down)
supersedes: none. Settles the seven readings left open in the spec; psb-4 widens pss-5's "memorized spells" to any spell in the book
---

# Sitting B, loop 2 (2026-11-27)

Francis's answers to the spec's "Readings for sitting B", in the driver's chat. His words are quoted; a bare letter is his whole answer. He also approved the ticket breakdown (#162 to #171: "Breakdown is right") and the spec ("Yes").

## Rulings

| Id | Reading | Ruled | His words | What follows |
|---|---|---|---|---|
| psb-1 | 1: the Down ring's look | A: harm tone, dashed track (no end); its symbol one of the 25 approved. If none fits, no first-letter fallback: the builder stops and Francis selects one | "A", then "If one does not fit we'll select one" | Piece 4; picture of the built screen |
| psb-2 | 2: its place | A: first among the rings; it shows only while the character is Down | "A", then "but obviously when the character is down" | Piece 4 |
| psb-3 | 3: its tap | A: opens the death panel | "A" | Piece 4 |
| psb-4 | 4: which spells take the star | B: any spell in the book, not only ready ones | "B" | Pieces 2 and 3 |
| psb-5 | Follow-up to psb-4: a pinned book spell not ready today | A: its block stays in At hand; the state says "Not memorized" (or the setting's own word, from where the Magic tab gets its words); Cast stays tappable and says in a pop-up why it cannot be cast today. The pin is kept | "A" | Piece 2; `livePins` keeps a pin whose spell is in the book; a pin whose spell has left the book is ignored |
| psb-6 | 5: a spell ready at two levels | A: one block; Cast spends as the Magic tab's Cast would | "A" | Piece 2 |
| psb-7 | 6: the Magic tab after a pin | A: it keeps listing the spell, the star filled | "A" | Pieces 2 and 3 |
| psb-8 | 7: the full sheet with nothing in Details | A: it keeps "Nothing written yet." | "A" | Piece 1: nothing |
