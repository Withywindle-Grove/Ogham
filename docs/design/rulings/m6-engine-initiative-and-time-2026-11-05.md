---
status: absorbed
milestone: m6
absorbed-into: docs/05-features.md (Combat tracker: Initiative, the fight's time), docs/09-decisions-log.md (2026-11-05), docs/plans/m6-2a-fight-engine.md (build order 5, 6; tests)
supersedes: ha-2's "a per-actor initiative modifier added to the roll" (`hedge-audit-2026-11-04.md`): the modifier is shown, not added; the rest of ha-2 stands
---

# The fight engine: the initiative modifier and the fight's time (design ruling, 2026-11-05)

The two open questions of the engine slice's plan (`plans/m6-2a-fight-engine.md`). Ruled by Francis. Ids `fe-1`, `fe-2`.

- **fe-1 The initiative modifier is a reminder.** In individual initiative the GM or the player enters each **final** number, as 05 says; the pad shows the actor's modifier beside the field ("NIM +1") so nobody forgets it. The app never adds it. The engine carries the modifier with the combatant only so the pad can show it; the order is made from the entered numbers alone.
  - *Why:* dice stay at the table and the number said aloud is the number entered; adding it in the app would count it twice for a player who already did.
- **fe-2 A fight takes one turn unless the pack says otherwise.** When the pack gives no length for a round, no time passes round by round: the fight as a whole takes **one turn** of the setting's exploration time, added between its start and its end (at End fight, and at We run's result). Round timers still count rounds. A pack that gives a round's length keeps M6-11's rule (the rounds' time, topped up to the pack's fight length).
  - *Why:* one calm default; lights and turn-based reminders move once per fight, not by a guessed number of minutes.

Docs to update: 05 (Combat tracker), 09, `plans/m6-2a-fight-engine.md`.

09: 2026-11-05 — [fight] In individual initiative the entered number is final and the actor's modifier is only shown beside the pad (fe-1; corrects ha-2's "added to the roll") — The number said at the table is the number entered; adding it again would count it twice — `design/rulings/m6-engine-initiative-and-time-2026-11-05.md`
09: 2026-11-05 — [fight] With no round length in the pack, a fight takes one turn in all, added at its end; round timers still count rounds (fe-2) — One calm default; lights and reminders move once per fight, not by guessed minutes — `design/rulings/m6-engine-initiative-and-time-2026-11-05.md`
