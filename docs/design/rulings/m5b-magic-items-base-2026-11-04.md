---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (items: `weapon.baseWeapon`, the base precedence rule, the nearest-item rule; Equipment paragraph; `weaponRules[].exceptClasses`; `slot: "worn"`), docs/09-decisions-log.md (2026-11-04), docs/plans/m5b-review-area-3.md (build order 9)
supersedes: —
---

# Magic items and their base (design ruling, 2026-11-04)

Three questions from the pack session's application of eq-1 (`baseId`) to classic-advanced's magic weapons and armour. Ruled one at a time with Francis (A, B, synthesis). Ids `mb-1` … `mb-5` (mb-4 an eq-7 follow-up, mb-5 an eq-6 follow-up, ruled the same evening).

- **mb-1 (synthesis) A magic weapon with no type** (twenty swords named only by their bonus; the book lets the GM choose or roll the type when one is found). Mirror the armour: **`weapon.baseWeapon: { choose: [<weapon item ids>] }`**. The GM picks the type when the weapon is found ("Pick the type for <weapon>" in Waiting for you, bq3-8's path); the pick fills `baseId`; damage and qualities come from the base. **Unpicked:** carried and equippable, no damage figure, the nudge shown; the class check accepts it when any offered base fits. `pack:check` warns on a `choose` id that isn't a weapon item. Not taken: `baseId` on the ordinary sword with a note (a quiet rules change: every found blade becomes the one type).
- **mb-2 (synthesis) A magic item whose ordinary form the pack lacks** (four tridents; no ordinary trident, no class list names it). `baseId` names the **nearest listed item** (the spear) and the item's `note` says why: "counts as a spear for class lists (the pack lists no ordinary trident)", shown on the item line. The rule is general (07). Not taken: no base and standing checker warnings; an invented ordinary item the book doesn't sell.
- **mb-3 (synthesis) An item's own figure beside a chosen base** (a cursed suit "of any type" with a fixed bad AC). **The item's own figure beats the chosen base's:** `ac`/`aac` beside `baseArmour.choose`, or a weapon's `damage` beside `baseWeapon.choose`, stays; the base sets everything else (type, weight, class lists, the name's look). `pack:check` stops warning on the pair. The owner's Pack line still shows the figure the book shows once worn; a GM who wants a surprise edits the item before handing it out.

- **mb-4 (synthesis) A class's own ban beats a weapon rule** (eq-7 follow-up; a category rule would hand a martial class every firearm, though its class bans missile weapons and the zine says the ban covers firearms). A `weaponRules` entry may carry **`exceptClasses: [<class ids>]`**: for those classes the rule doesn't apply and the class's own list alone decides; the rule's `note` carries the referee's call on other classes and shows in the allowed/blocked explanation. Converted classes with no combat category follow their lists only; nothing is added to the conversion. Not taken: a flag on the class through a cross-pack patch (one line, all-or-nothing); a note alone (the app would allow what the book forbids).

- **mb-5 (synthesis) A `worn` slot.** Items worn without taking a hand or the armour place (gauntlets, rings, cloaks, boots, amulets) carry `slot: "worn"`; any number may be worn; Put it on / Take off as for armour; bonuses and effects (`carryBonus`, eq-6) count while worn. Build's scope check on area-3 order 11 (#435): the gauntlets had no slot, so their bonus never counted. Not taken: `slot: "hand"` (costs a hand; gauntlets and a sword couldn't go together); counting while carried (breaks eq-6, works from the bottom of a pack). Pack session: `slot: "worn"` on gauntlets and the other worn items in both settings.

**Cost:** mb-1 and mb-3 are one-line extensions of area-3 build order 9; mb-4 one line in order 10; mb-5 a few lines in order 11 (07's slot list, Put it on for worn items, a test: gauntlets worn beside a sword and shield raise the limit, in the pack they don't); mb-2 is pack-only.
