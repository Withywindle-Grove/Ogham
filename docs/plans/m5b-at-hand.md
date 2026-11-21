# Plan: At hand actions (ah-1 … ah-4)

Ruling: `docs/design/rulings/m5b-at-hand-actions-2026-11-08.md`. Mockup: `docs/design/mockups/players/06-at-hand-actions.html` (on `design-gate-m5b-walk`). Pack field: `weapon.modes` (G-211 in `docs/11-modelling-gaps.md`, registered on `pack-scorecard-2`, #489). M5b, one pull request, branch `m5b-at-hand`.

## Scope
1. **Wield, then Attack** (ah-2): a pinned weapon not in hand shows **Wield** on its At hand row (the existing `inventory.equip`, through the same equip check as the item sheet's Hold: blocked explains, a warning opens the item sheet's warning card); once in hand it shows **Attack**. Toast "<weapon> in hand" with Undo (the log's Undo of that change). One button per row; the state decides which.
2. **The Attack sheet** (ah-1): a Sheet, not a roll: the to-hit and damage parts, each with its source (the Breakdown pattern, `weaponBreakdown`, with the mode's parts); the rules that bear (the mode's qualities, two-handed, the class's weapon rule, the mode's note, the patches' changes); and the line "Rolling the attack here comes with the fight rules, later." With a mode that draws a stack, a **Fire one, N left after** button spends one (`item.use`).
3. **The mode button** (ah-3, ah-4): from `weapon.modes: { button, list }`, the button's word from the short list (Quiver, Pouch, Grip, Stance); none when the pack gives no modes or only one. It sits beside the row's action; the row's line says the mode in use ("Quiver: Arrows ×18", "Grip: Melee").
4. **The mode sheet**: the modes as pick rows (count, damage, qualities, note), the one in use Picked; picking one closes the sheet and the action uses its figures and rules.
5. **The count-down**: each Fire one is an `item.use` of the drawn stack (logged, Undo); the last one leaves the pack (the log keeps it).
6. **When a stack is spent**: the mode disengages ("Quiver: nothing chosen"); Attack stays tappable and its tap explains why and offers the mode sheet.

Wield is `inventory.equip` (logged, undoable already). After Design's ruling on #569: one migration (`20261109120000_m5b_at_hand_weapon_mode.sql`: `inventory_lines.mode_id` and `item.setMode`'s logged row) and the command `item.setMode` with its permission cases.

## ⚑ for Francis / Design (ruled by Design on #569, 2026-11-09)
1. **Where the chosen mode is kept.** Ruled: a shared game fact, logged. Built: `inventory_lines.mode_id` (null: none chosen) and `item.setMode`; a spent mode stays stored (round 3: a fresh weapon's spent default is stored inside `item.use`'s request); the GM's overview reads it; the log reads "Sam chose Short bow: silver arrows".
2. **Inflicted statuses.** Ruled: read `applies.conditionId` (07, G-53) on the weapon or on the mode's stack; "Inflicts: <condition>" with its note; no line when there's none.
3. **Thrown.** Ruled: stays in hand for now, the figures change only; a later ruling, with the fight engine.

## Tests (purpose first)
- A weapon's `modes` block is read as the pack writes it; a weapon with no block, or one mode, has no mode button.
- A mode's stack is found by the item's id or its `baseId`, unless another mode draws that id; counts add across lines.
- With the chosen mode's stack gone the mode is disengaged; the first mode is the default.
- A mode's qualities, damage and to-hit change the weapon's figure and its breakdown.
- A pinned weapon not in hand shows Wield; in hand, Attack.
- Wield puts the weapon in hand (inventory.equip) with an Undo toast; a blocked weapon explains instead.
- The mode button opens the mode sheet; picking a mode changes the row's line.
- Attack opens the Attack sheet with the parts, the rules and the fight-rules line; Fire one spends one through item.use.
- With the stack spent, Attack explains and offers the mode sheet; it is never a disabled button.

## Gallery
A new section, `at-hand-actions` (last, so no approved picture moves): the Wield and Attack rows with mode buttons, the Attack sheet, the mode sheet, the spent state. CI draws its pictures; Design approves.

## Estimate
About 8–12 builder turns.

## Departures
(The builder keeps this current.)

**Builder, 2026-11-09 (`m5b-at-hand`):**
1. ~~The chosen mode is kept on the device~~ (first round). **After Design's rulings on #569 (rounds 2 and 3):** the mode is stored on the line (`mode_id`), set by `item.setMode` (logged, Undo toast "Reed bow: Bone-tipped arrows"). **A fresh weapon** (nothing stored, null) uses its first mode it can: for a Quiver or Pouch the first mode whose stack is in the pack (plain arrows if there are any), so a new bow fires without a trip to the quiver; for a Grip or Stance the first mode. **A spent stack keeps its mode stored** (the smallest sound way, app-side, no second migration): a stored mode with no stack is disengaged ("Quiver: nothing chosen") until another is picked, even with another kind in the pack; when a fresh weapon's default is spent, the use stores that mode on the weapon in the same request (`item.use`'s `keepModeOf`), so it doesn't slide on to the next kind, and one Undo brings back the stack and the fresh weapon. **No stack at all in the pack** reads "Quiver: no reed arrows in the pack" (the first drawing mode's own name), and Attack's sheet is titled "No reed arrows in the pack". Round 2's "a spent stack clears the mode" is replaced. The mode isn't cleared when the weapon changes hands (the new holder's stacks decide whether it's engaged).
2. **Inflicts** (Design on #569): `applies.conditionId` on the weapon, or on the stack the mode in use draws, named from the setting's conditions with the condition's brief effect under it; an id the setting lacks shows as written; no line without one.
3. **Thrown changes the figures only** (missile, the mode's qualities); the weapon stays in hand. Ruled by Design on #569: a later ruling, with the fight engine (M6).
4. **The Attack sheet's parts are the ones the app works out today** (`weaponBreakdown`: the class at this level, the score, the damage and its score, the rule's die, and now the mode's to-hit and the mode's die named as the source). A skill penalty and range bands aren't parts yet: the app has no reader for them outside creation, and they arrive with the fight engine (M6). The rules that bear list the qualities in this mode, Two-handed (`hands: 2`), the mode's note, the class's weapon rule ("By the … rule") and a Not allowed reason.
5. **The Pack tab's At hand rows now show the weapon's figure too** (the Player screen passes the same figure functions to the Pack tab), as the mockup's Pack draws "In hand, 1d6"; before, only the Player screen's At hand had it.
6. **A spent mode's words** are general, by the button: the sheet's title is "Nothing chosen" (the mockup's "No arrows chosen" names the item kind, which the pack doesn't give), the why "<mode> used up. Choose what the <weapon> fires next." (slings for a pouch, uses for a grip or stance), and its accent button "Open the quiver"; with no stack at all, the title "No <first kind> in the pack" and "Add some to the pack, then choose what the <weapon> fires." The last use's toast says what was used up: "Fired the last Bone-tipped arrows. Quiver: nothing chosen"; when it stored a fresh weapon's default, the log line adds "Reed bow: nothing chosen."
7. **A mode with none of its stack in the pack** stays a pick row; a tap explains ("No Ember arrows": add some to the pack first) instead of choosing it.
8. **Fire one closes the Attack sheet** (the item sheet's rule: after an action it closes) and the toast carries Undo.
9. **A weapon already worn** (a weapon on the worn slot) shows Attack, not Wield: Wield would have nothing to do.
10. **Only a character's weapons have a mode** (CI on #569; fix-forward migration `20261109130000_m5b_weapon_mode_characters_only.sql`): the database refuses a mode on a Party stash line, and a weapon put in the stash loses its mode.
11. **Design's last round on #569 (words and order):** an At hand row reads the state first, then the figures, then the mode ("In hand, +0, 1d6, Quiver: Reed arrows ×18") and shows no weight (the Pack row has it); the Attack sheet's parts name the score in full ("Missile, Nimbleness −1"), and its rules are one comma list headed "Qualities:" ("Missile, two-handed, counts as bone"). The mode sheet's Pick buttons were already top-aligned by the creation pick rows' own rule (`.pick-row { align-items: flex-start }`, seen in CI's gallery pictures of run 42641545792), so no CSS changed.
