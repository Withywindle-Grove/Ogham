---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (Camp: Cooking, Campfire talk, Sleep), docs/07-content-packs.md (`camp.sleep.modifiers` `when` names), docs/09-decisions-log.md (2026-11-04), docs/plans/m5b-area-2-app.md (build order 7), docs/testing.md (gate check 25)
supersedes: —
---

# Camp facts on the sleep check (design ruling, 2026-11-04)

Build's scope check SC-a2-7 (`plans/m5b-area-2-app.md`, Departures PR 7; G-110; ga-5 put it in M5b). fae-woodland's night sleep check takes a bonus from a good meal and penalties from a cook's or an entertainer's fumble; the app stored only "campfire talk worked", and cooking stored no result. Ruled with Francis (A, B, synthesis). Ids `sl-1` … `sl-4`.

- **sl-1 Facts.** `camp.sleep.modifiers[].when` may name `campfire-talk` (today), `campfire-talk-fumbled`, `cooking` (a meal that worked) and `cooking-fumbled`. The sleep roll adds each the same way and its line says why ("good meal +1 · the cook fumbled −1", the pack's numbers).
- **sl-2 One row of buttons, no second question.** The Cooking step and the Campfire talk step each end with one button row, **Worked · Didn't work · Fumbled**; on Worked the pot is made (cooking) or the fact recorded (talk). **Fumbled shows only when the pack names a fumble fact** for that step; otherwise the row is the two buttons it has today. No "How did it go?" prompt after the pot (one tap, not two).
- **sl-3 A fumbled cooking does nothing else.** No spoiled portions: that would be a new kind of deletion (hard rule 4) and needs its own ruling. The pack's text may say what the GM does at the table.
- **sl-4 Who and when.** Entered by the cook's (or talker's) player or the GM, as talk is today. **Not a gate item:** built after checks 57, 63 and 64; until then the GM adds the modifier by hand on the sleep roll. Gate check 25 gains a "(to build)" line so it isn't forgotten. One migration (the outcome check gains `fumbled`, a cooking-result function; nothing dropped), test project first. 2–3 turns.
