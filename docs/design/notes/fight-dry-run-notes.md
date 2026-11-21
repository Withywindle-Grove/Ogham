# Fight dry run notes (2026-10-29)

The walk-through behind `../rulings/fight-dry-run-2026-10-29.md` (the rulings file wins). Converted from the design agent's notes: aliases and invented foes only; the packs' own numbers replaced by "the pack's …".

- 1. Check hit opens Encounters: open by itself. Taps 1.
- 2. Encounter roll: tapping the row is faster than typing. Taps 2.
- 3. How many / Average HP: feels good. Taps 2.
- 4. Hidden archers arriving later: usually set up before the session; on the fly only to escalate. Prepared encounters (rooms in M8b, or a saved group) carry Hidden and Arrives-in. Random encounters matter as much as planned ones.
- 5. Surprise toggle: fine. Don't assume a fight: the encounter panel puts disposition (the reaction roll) up front, Fight is one outcome.
- 6. Reaction roll: the result never limits the choices. The reaction ⓘ explains what each result means at the table (from the pack).
- 7. Outcomes are three, always available: Fight · Talk · Avoid (how it happened in an optional note). We run stays separate (escaping a fight already started, M6-11).
- 8. Acting now: Party (surprise round): good.
- 9. Player attack: players don't keep the books for monsters. Player says the hit and damage aloud; the GM records it. A player may tap the target (optional) to see their roll and the hit target once known; the tap pre-selects the foe on the GM's damage pad. "Players enter damage to foes" → parking lot.
- 10. A Bog lurker down plus the morale prompt: nothing off.
- 11. Casting: the GM never confirms a player's cast. A spell opens a sheet only when the player has a real choice; otherwise it casts at once with Undo, lights and timers start by themselves.
- 12. Miss: skipping the target tap must be fine; the GM can always pick the target and enter damage.
- 13. Morale check (they hold): fine.
- 14. Round flow: turns end by tap (a player ends the party's turn; the GM ends the foes'; individual initiative: each taps Done), the round advances by itself; the GM can always end any turn or the round; Next round stays as override.
- 15. Initiative timing is the setting's rule; the round-start "who won" tap appears only when the rule re-rolls. Delay: a visible flag that clears once the character acts or at their next turn.
- 16. Party damage is the players' job; a hireling's HP belongs to the employer; the GM can override.
- 17. Taking damage: the GM tells Bram how much he takes; Bram records it. Taps 2–3.
- 18. GM mirror: tap a foe then a character to see the foe's attack roll and the number it needs to hit that character.
- 19. Damage to a foe with the target pre-selected: good.
- 20. Half-down morale prompt, they break and flee: the prompts help. Morale prompts come only from the setting's rules (M6-6 triggers), never app-invented.
- 21. Crits: the pack's naturals rule (M6-9), as text; no house-rule automation. Stepper plus tapping to type (M6-3).
- 22. End of round under the new flow: good.
- 23. Odo drops below 0 HP: the app does not announce it over the player; the GM sees it quietly.
- 24a. Temporary HP (G-23): taken before regular HP, a separate band on the bar, ends on its timer or at 0; added mainly from its source (M7), plus a quiet manual entry (M6).
- 24b. Death: no pop-up. Down is marked quietly; tapping opens the death panel built from the setting's death rule (`rulesSets[].death`). The four shapes the candidate packs need were modelled: a plain threshold; death's door with HP lost each round down to a limit and Helped as a wake timer; a plain threshold with HP never below 0; death's door with a death roll each round at the pack's chance and Helped giving HP back plus a random ability loss. Approved for both packs.
- 25. A Down or dead character's pack AND purse open to the other players (a named exception to hidden purses, enforced by RLS on character state, every take logged, closes on recovery). Hireling packs always open to the employer.
- 26–27. Finishing the archer; the dying tick at end of round: good.
- 28. Fled and Down/Dead foes: good. Every foe card has quick + Status and a Note (GM-only by default).
- 29. End fight summary: XP waiting goes to the pot; awarded when the setting says.
- 30. Add loot: one-off items yes; the picker offers Add "<typed>" as a one-off.
- 31. Claim from Loot to share: fine.
- 32. We run: on the fight controls AND the players' screen; the GM resolves with the pack's pursuit rule.

## Rulings (approved by Francis 2026-10-29, all 14, plus: We run can be undone, returning the party to the fight exactly where it left off)
1. Outcomes Fight · Talk · Avoid, always available; the reaction ⓘ explains results. 2. The GM records damage to foes; a player's target tap pre-selects. 3. GM mirror. 4. Turns end by tap; rounds auto-advance; GM override. 5. Initiative follows the setting; Delay flag. 6. Party damage is the players' job; hireling HP to the employer. 7. Casting asks only for real choices. 8. Morale prompts only from the setting. 9. Down marked quietly; death panel from the pack's death rule. 10. Temporary HP (G-23). 11. Down/dead pack and purse open to players (named RLS exception); hireling packs open to the employer. 12. + Status and Note on every foe card. 13. We run on the players' screen too. 14. Planned and random encounters matter equally; prepared encounters carry Hidden and Arrives-in.
