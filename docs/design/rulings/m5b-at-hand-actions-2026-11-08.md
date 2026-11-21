---
status: pending
milestone: m5b
absorbed-into: pending (05 Pack and Player: At hand; 06 At hand row; 07 weapon modes; 09; 10 parking lot; 11 G-case for modes)
supersedes: the 2026-11-07 At hand ruling's Attack line ("its sheet until M6 wires the attack") is kept and filled out; the ammunition link parked in 10 on 2026-11-07 is answered here
---

# At hand actions: the mini session (2026-11-08, night)

Francis asked how the At hand action buttons should work. Three kinds of action were proposed (state, spend, roll) and three questions ruled.

| # | Question | Ruling |
|---|---|---|
| ah-1 | Attack now or at M6? | **At M6, done right once.** Until then Attack opens the weapon's sheet, which must show: every modifier to attack and to damage with its source (class at level, the score, the weapon, a skill penalty, two-handed, range), the rules that bear (the weapon's qualities, the class's rule), any status the weapon inflicts from the pack, and one line: "Rolling the attack here comes with the fight rules, later." |
| ah-2 | Wield as an At hand action? | **Yes.** A pinned weapon not in hand shows **Wield** (in hand, logged, Undo; the Attack figure and the Player's At hand follow); in hand it shows **Attack**. One button per row; the state decides which. |
| ah-3 | Ammunition | **Weapon modes.** A weapon with modes gets a mode button beside its action; the pack names it from a short list: **Quiver** (a stack it fires), **Grip** (how it is held: melee / thrown, one- / two-handed; the default with no stack), **Stance** (a fighting style), the list growing by ruling, never "Mode" (Francis: too mechanical). Tapping it opens a sheet of the modes; the player picks one; the action then uses that mode's figures and rules. A mode with limited uses (an arrow stack) counts down by itself at each use (`item.use`), and the stack leaves the pack when empty. All uses gone: the mode disengages and the action is blocked until a new mode is chosen (the blocked tap says so: "No arrows left. Choose from the quiver."). Examples: a bow's modes are its arrow types; a spear's are melee and thrown; a versatile weapon's are one- and two-handed. |

**Kinds of action (for the inventory):** state (Light / Put out, Wield / Stow), spend (Fire, Drink, Eat, Use a charge, Use: one used up, Undo), roll (Attack: the sheet now, the fight engine at M6). Every At hand row carries one action; a second lives in the item's sheet; the mode button (Quiver, Grip, Stance) sits beside the action where the weapon has modes.

**ah-4, the short list (approved 2026-11-08):** Quiver (bows and crossbows: the stack they fire), Pouch (a sling's stones or bullets), Grip (melee / thrown / braced: dagger, hand axe, spear), Stance (normal / braced, normal / charge: pole arm, trident, lance). One button per weapon even when its modes mix axes (the spear's Grip lists Melee, Thrown, Braced); a weapon with one mode has no button; charged magic items are a spend, not a mode.

**ah-5, coatings (ruled 2026-11-09, built after the M5b gate):** a poison, an oil or a spell can be applied to a weapon: from the source's sheet (or the cast), **Apply to a weapon** picks an in-hand weapon, spends one dose (`item.use`), and the weapon gains the coating with its uses or duration (logged, Undo). The row's sub-line says "Coated: <name>, 3 hits left"; the Attack sheet's Inflicts line names the status and its note; a use or hit counts it down; it ends when spent or when its time runs out, and the sub-line says so. Pack side: the item's existing `applies` plus `coat: { uses | duration }`; a coating spell carries the same.

**Pack side (Pack Creator):** a weapon's `modes` (name, the item or stack it draws from, the figures and rules it changes, whether uses are limited; the button's word) as a registered G-case, with the button's word from the short list; the bow → arrows link is a mode, not a separate field. Pack Creator fills the two settings' weapons that have modes.

**Parking lot (10):** recovering ammunition after an encounter (GM side, most likely with the fight engine at M6: a "Recover arrows" prompt that returns a share of the stack).

## 09 lines
- 2026-11-08 — [items] At hand's Attack stays a sheet until M6 (every attack and damage modifier with its source, the rules that bear, inflicted statuses, a line that rolling comes with the fight rules later); a pinned weapon not in hand shows Wield, in hand Attack; weapons with modes get a Mode button beside the action (the pack's word, "Quiver"), the chosen mode feeds the action, limited uses count down by themselves and the mode disengages when spent, the action blocked until a new mode is chosen; ammunition recovery after an encounter parked for M6 — Francis, the At hand session.
