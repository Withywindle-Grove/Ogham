# Brief for the Design Studio: the Pack tab, whole (2026-11-14)

**Blocked means stop and report; never reach the end another way.** If unsure, stop and ask the lead; don't guess. You report to the lead, never ask Francis for a ruling, and edit no ruling, plan, 09 or spec.

Francis put this first in the order of design work: "Priority in design is pack tab, city, map with map as the reach goal".

## Objective
One page that shows the Pack tab **whole and consistent**: the tab, a find arriving, the party stash, the short actions, the GM's hand-out. The Pack was drawn at three different times (the rework, pages 01 to 04; the sweep, 05 and 06; the purse, 07) and the three do not agree. Only the purse (07) carries Francis's approval of its frames. This page brings everything up to every ruling in force, in the swept dress, the current stylesheet and the book's format, so Francis looks once and a builder builds once (po-4).

## Read first
1. `docs/plans/dec-6-the-whole-pack-tab.md`: it is the ruled-so-far sheet for this screen. "Where the drawing stands" says what each page shows and which later ruling changes it; item 1 of "What must be drawn" lists the change each ruling makes; the ⚑ list is the questions the old pages raised that nobody answered.
2. The rulings it names: pk-1 to pk-6, psw-1 to psw-7, pu-1 to pu-11, pf-6, pk-11, pin-1, pg-1, ic-1, ic-2.
3. Your pages `pack/01` to `07` and page 11 (the GM's place page with its Treasure piece).

## Output
- `docs/design/mockups/pack/08-the-pack-tab-whole.html` on `design-december-mockups`, light and dark side by side, pictures in the pack folder's `png/`, a row in the index for each.
- Every caption starts **"Assembled from approved <frame ids>"** (only page 07's frames qualify), **"Brought up to the rulings from <frame ids>"** (name each ruling applied), or **"New, a proposal"**.
- For each ⚑ in the plan that a frame touches: draw your pick, name the question's number in the caption, and where the other answer would look clearly different, show it small beside. End the page with one table of the picks.

## Two sittings
**Sitting 1, what the first night needs. Report to the lead when it is done, before starting sitting 2.**
| # | Frame |
|---|---|
| PK1 | The tab whole on a tablet: whose pack, the facts, the load line, the coin line (07's, as approved), the lists with their heads and folds, the foot; Add item where you place it |
| PK2 | A find has arrived: the card, the count on the Pack's icon, "New" and the row's tag until Got it; several finds merged (pk-5) |
| PK3 | The find card naming coin, and coin landing in the purse (pu-3, pu-5): not drawn anywhere today |
| PK4 | The party stash as its own screen: its facts, the coin row first (pu-3), Take on every row of things (pk-3), the taker's room, the recent lines (pk-4); a single thing taken (toast with Undo and the new load); a stack asking how many |
| PK5 | The GM sends a find, starting from the Treasure piece on page 11's place page (pg-1): a whole hoard or one thing; to a character (then which) or to the party stash; **coin in a hoard** as a row like any other, with the note where a pack's coin word is read as gold (pf-6, pk-11): not drawn anywhere today |
| PK6 | PK1, PK2 and PK4 at 375 px |
| PK7 | The states of PK1 and PK4: empty pack, empty stash, loading, a failed save, offline (a tap that cannot work offline explains why; nothing is disabled) |

**Sitting 2, the rest.**
| # | Frame |
|---|---|
| PK8 | A thing's sheet, a stack's sheet, a container's sheet with its note (psw-4, psw-6); the pin as a star (pin-1) |
| PK9 | Give and Put in as one sheet with its link back; how many (psw-5, psw-6) |
| PK10 | Drop, use one, Empty, each with its toast and Undo; Add item and what it says after a purchase now that purses exist |
| PK11 | The GM's views: the chips, a player's pack as the GM, the GM's stash, Give coin and Take coin (07's, as approved, in place) |
| PK12 | Messy data: sixty things, a very long item name, 0 and 999, over the limit, a purse with five kinds of coin |
| PK13 | The sheets of PK8 to PK10 at 375 px |

Not on this page: a Down character's purse, another player's view, a hireling's purse, Larger text (each "can wait" in the plan); the Player screen's quiver, pouch, wield modes and pins.

## Rules in force (check each frame against these before you report)
- The current stylesheet and the book's format on every frame; compare by eye with a picture of the built app (the purse's as-built pictures or the built place card).
- An icon on every button with its word under it; a row that opens a screen takes a leading icon (ic-1). Icons medieval or fantasy in nature, from the set or its source, credited. Undo's icon is the plain turned-back arrow (ic-2).
- A pair of opposite actions is a toggle. No explainer lines (mc-46). No Close beside an X. A chevron is the one fold mark (psw-1). The die glyph beside a named roll.
- Undo over confirm: a reversible action happens at once with an Undo toast. No disabled button.
- Hidden means hidden: no other living character's purse or its amounts on a player's frame; a find card that names coin is the receiving player's alone; a Treasure piece and its value are the GM's.
- Integers for coin, counts and weights. 44 px targets with 8 px between; one accent a screen. Tokens from 06 only.
- Invented names only (herons, the Lantern Wardens): no game, book or adventure names, no numbers from a book.

## Report to the lead
The file and commit; which pictures you opened after the last render and which you did not; the table of picks; anything you could not check; any place where two rulings disagreed and which you followed (the plan names one: pk-3's Take on every row against pu-3's coin row with no button; read pu-3 as governing the coin row only). Render in sittings and commit after each, as your memory rule says.
