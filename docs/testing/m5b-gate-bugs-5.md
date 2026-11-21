# m5b-gate-bugs-5 — a field whose option is off is hidden in a real campaign (of-9, gate check 59)

The gate found layout fields behind an option still showing on every classic-advanced campaign: "Use this sheet layout" writes each field's key in lower case ("weaponproficiencies"), and the option gates were keyed by the layout's own spelling ("weaponProficiencies"), so they never matched. Feeds gate check 59.

1. **iPad, a classic-advanced "defaults" campaign** (weapon proficiencies at their default, off). Open any character's full sheet. Combat has **no "Weapon proficiencies" tile**.
2. **iPad, same campaign, descending armour class** (the default). Combat shows the attack figure once as the tile, and **no "Attack bonus"** tile.
3. **iPad, a campaign set to ascending armour class** (Rules → the armour class option → ascending). The full sheet's Combat shows **"Attack bonus"**, and no "THAC0 [attack bonus]".
4. **iPad, turn weapon proficiencies on** in that campaign's Rules. Back on the sheet, "Weapon proficiencies" shows, with any value it had before (nothing was erased). Turn it off again: it hides.
5. **iPad, the conversion stack, descending.** The full sheet shows the "Attack" tile and "THAC0 [attack bonus]", and **no "Attack bonus"**. (Two attack rows is a separate question, see the status report's ⚑; not part of this check.)
6. **Phone (375 px), the Player screen** of the defaults campaign: no Weapon proficiencies or Attack bonus on the card either.
