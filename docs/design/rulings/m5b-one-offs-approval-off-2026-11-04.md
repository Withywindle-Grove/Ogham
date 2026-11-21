---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (character creation, GM approval), docs/09-decisions-log.md (2026-11-04)
supersedes: —
---

# Creation one-offs when character approval is Off (design ruling, 2026-11-04)

The builder's ⚑ on #393 (bq3-6, `plans/m5b-0c-one-offs.md`): a player's one-off on their own unapproved character comes in approved. With **Characters need approval: Off** and **One-off items need approval: On**, a new character's creation one-offs (a kindred table's trinket, a kit's or background's `{ name }` line, a one-off bought on the draft) therefore join with no GM look at all.

- **oo-1 (A) As built.** Off means the GM has chosen to trust creation; the one-offs creation produces are pack data, not invented, except a one-off typed on a draft. 05 says it in one line so the GM knows what Off means: with character approval Off, creation one-offs join at once; the one-off setting applies from the first session on.
  - Not taken: (B) creation one-offs wait when character approval is Off: one setting read in the guard, but it puts every new character's trinket and kit lines on Waiting for you, the paperwork Off was meant to remove. Telling typed one-offs from pack lines would need a new data field and a second migration for a case with both settings off their defaults.
  - Revisit only if a real table abuses it; the fix then is B's setting read.
