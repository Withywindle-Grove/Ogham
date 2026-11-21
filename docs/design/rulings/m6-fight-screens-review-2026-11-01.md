---
status: absorbed
milestone: m6
absorbed-into: docs/05-features.md (Combat tracker: the round, Delay, Who enters what, Morale, Add foes), docs/06-screens-and-design.md (Encounter, Fight layouts), docs/09-decisions-log.md (2026-11-01)
supersedes: M6-1 (revised 2026-10-29) "party damage is the players' job"; M6-6's ▲ line with Check on the foe card; M6-8's players' three columns Foes · Party · You and the You column's controls; M6-7's Skip on Surprise and Distance and the reaction row buttons; M6-4's Bestiary-first order; 06 Fight layouts "Delay beside End turn" on Scene
---

# M6 fight screens: Francis's review of the mockup (ruled 2026-11-01)

Reviewed screen by screen on `../mockups/m6/m6-fight-screens.html` (now redrawn). Rulings, in his order:

**Screen 1, the GM's fight screen**
1. The Fiat button is the **wizard hat** (06 said so; the mockup's top hat was wrong). ⚑ A: hat, not crystal ball.
2. The sequence strip's current step **pops**: display size and a glow, no underline.
3. The strip's steps are **the pack's own combat sequence**; a pack without one shows a single "Actions" step. ("Missiles/Spells/Melee" was an invented example.)
4. A **morale trigger is a pop-up prompt** (the trigger, "check N of M", the chance and target, They hold / They break / Skip), not a ▲ line on the card.
5. Crit · Fumble · Roll tactics only when the rules set carries those tables.
6. **No Damage or heal button**: tap the target — a foe, a character or a hireling — and its panel holds the pad. ⚑ B: **party damage stays with the GM for now**; speed comes from tapping the character or hireling and getting the pad with them named. Players don't enter damage.
7. **We run** is the players' prompt only. Foes that run are marked Fled; if the party gives chase the GM ends the fight and Undo on End fight reopens it. ⚑ D: nothing more is modelled.
8. The GM's turn control reads **End foes' turn / End players' turn** by whose turn it is.

**Screen 2, the players' Scene in a fight**
9. The Scene is a **reference for players and a display for a common tablet**. Players spend the fight on their **Player tab**, which holds everything personal: the attack line against a tapped foe, weapons with bonus and damage (C3), spells and ability dots, **Use** (consumables, triggerable items), **End turn** in individual initiative, and **Delay**. So the Scene's **You column is gone**: two columns, Foes · Party; tapping your own character opens the Player screen.
10. ⚑ C: **Delay** lives on the Player screen only, and only in individual initiative (side initiative needs no tracking).
11. **We run** stays on Scene (any player; Undo until the GM resolves it).

**Screen 3, the encounter panel**
12. **No Skip** on Surprise: "Not surprised" is the answer. **No Skip** on Distance: the field **defaults to the average** of the pack's dice; the GM changes it by tapping (no keyboard until then).
13. **Reaction is a button** that opens the pack's reaction table full screen (B2's screen, modifiers counted); the GM taps the rolled row and it fills the Reaction line.

**Screen 4, Add foes**
14. The search field never opens the keyboard by itself (A4).
15. **Encounters above Bestiary**: the GM picks from a table or searches far more often than browsing.

**Screen 5, the Player tab in a fight** (drawn after the review, 2026-11-01, on Francis's "go"): the fight's time band with a way back to Scene; the attack line for the foe tapped on Scene; weapons at hand with bonus and damage and ammunition counted with Use 1; spells with Cast; abilities as dots with Use; items with Use; hit points read-only (⚑ B); End turn and Delay in individual initiative only. A consequence of ⚑ B written into 05: the Player screen's damage pad is the GM's; a player tapping hit points sees the history.

**Second pass (Francis, 2026-11-01), all ruled:** the popped sequence step a little smaller (24 px); the morale check is a pop-up over the screen, never a resident panel; **More** on a foe card is a button (the rest of its reference: behaviour notes, abilities, the action menu, the tactics table, the source page); the players' Scene shows a foe's **AC once revealed** (CS-8) and carries no "tap for your Player screen" label; **No fight · back to Explore** opens a small prompt for an optional note on how it ended, **Only you** or **In the log**, Done, Undo; the Player tab drops its explanatory notes; **an attack starts from the weapon** — tap a weapon at hand, its prompt opens with that attack type's modifiers and a row of foe chips (AC where revealed), tap a chip for the roll line, a foe tapped on Scene pre-selects its chip (third pass: the prompt is a **pop-up**, closed by ✕, a tap outside or Escape, so an accidental tap costs nothing); **End turn** only in individual initiative; the Player tab's Items section is **At hand** with a quiet **Pack ›** to use something else.

## 09 lines
- 2026-11-01 — [fight] The fight screens reviewed on the mockup: Fiat is the wizard hat; the sequence strip shows the pack's own steps with the current one in the display size and a glow; a morale trigger is a pop-up prompt; no Damage or heal button (tap the target, the panel holds the pad); End foes' / End players' turn by whose turn it is; We run is the players' only, foes run as Fled and Undo on End fight covers a chase; the players' Scene is a reference (Foes · Party, no You column; tap yourself for the Player screen), the personal controls (attack line, weapons, Use, End turn, Delay in individual initiative) live on the Player tab; Surprise and Distance lose Skip and Distance defaults to the average; Reaction is a button opening its table; Add foes puts Encounters above Bestiary and never opens the keyboard — the GM's screen does the bookkeeping, the players' screen stays a view
- 2026-11-01 — [fight] Party damage is entered by the GM for now, from the character's or hireling's panel (supersedes M6-1's "the players' job"); players never enter damage — one hand on the numbers while the table test is young; revisit after M6's gate
