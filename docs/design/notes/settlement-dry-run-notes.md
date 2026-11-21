# Paper dry run 5: a settlement (2026-10-30)

Converted from the design agent's notes: aliases and invented names only; the pack's dice, prices and amounts are replaced by "the pack's …". Where `../rulings/m5b-wilderness-2026-10-30.md` or the specs differ, they win.

Rules basis: fae-woodland 0.3.2 settlement mode (day steps: weather, decide actions, day encounter only when out and about, describe, end of day back to lodgings, night encounter only if active at night; activities: earn money, gossip for rumours, a full day of rest that heals, plus healing each night in a settlement, a herbalist who identifies things for a fee; services: herbalist, money changer, used gear at a discount, jeweller; settlement sizes; options: lifestyle expenses, treasure valuation). classic-advanced 0.6.2 has no settlement mode: towns happen in Downtime (natural healing on a full day of rest; retainers and mercenaries are hired in town, M9).
Party: Bram (fighter), Wren (caster), Tamsin (scout), Odo (hireling, Bram's). Town: Hollin Cross (invented market town). Uses session 3's settlement mockup and its 8 rulings as provisional.

## Steps

1. **Arriving in town.** (Francis reframes the whole run.)
   - **Francis:** in town the party may also visit NPCs, investigate the area, repair or buy items, and so on, plus downtime behaviours.
   - **Francis:** reaching a settlement is a **return to safety**, so treasure XP and the like can be earned there. The party arrives and interacts narratively and mechanically with the town (restocking provisions and so on); random encounters apply in settlements too. At some point the **GM engages Downtime**, which cuts over to the downtime menu (with clarifying questions); players then operate from the settlement during downtime (buying things and so on). Most of it is narrative; key activities, including the passing of time, are mechanical.
   - ⚑ Proposed flow: arrive → Settlement mode (adventure continues; town encounters per the out-and-about switches) → quiet "Back in safety" line for the GM (Split loot, Award XP where the pack gives treasure XP) → town business (buy and restock, sell, repair, NPCs, investigate) → GM taps **Start downtime** → clarifying questions → the downtime menu.
   - **Francis (answers):**
     - Time in town passes **morning, afternoon, night**; nothing finer is needed. ⚑ Settlement mode's step is a part of the day (three a day), not a whole day.
     - The app recognises which settlement the party is in, so players reach only that place's shops and related activities. ⚑ Shops, services and town activities are scoped to the current settlement.
     - **The GM decides** "back in safety" (a tap).
     - **Downtime needs its own full design session.** His model for it: players propose activities, the GM sets each duration, and the total downtime comes from those or from a date in the future (set by the party or GM, or random). Until then, all that's needed: split treasure, award XP, and **Start downtime** with a matching **End downtime**.
     - **Start downtime also ends the expedition** (and offers Full rest), like End expedition.
   - ⚑ Roadmap: a downtime design session before M7's downtime work.
2. **Morning in town: buying and selling.**
   - **Francis (buying):** a player asks whether something is in stock; the GM confirms, denies, or raises the price for rarity. The pack's rules (prices) are the default; the GM can override. ⚑ Player "Ask for…" request from the town's list (or Something else…) → GM: In stock (pack price) · Not here · Price… → the player buys or leaves it.
   - **Francis (selling):** the player offers what they want to sell and to whom; the GM confirms a price, which the app suggests from the pack's rule; the player takes it or leaves it. ⚑ Sell… (item, buyer: a service such as used gear or jeweller, or a person) → GM sees the suggested price (the pack's rule) → Offer (changeable) → player Accept / Decline.
   - **Francis (stock odds):** buying often has odds of an item being in stock; prompt them to the GM when deciding. ⚑ The GM's In stock / Not here prompt shows the pack's availability chance (by settlement size or rarity) as Hit / Miss. Pack task: check both books for availability rules.
   - ⚑ Parking lot: automatically generating shop stock from a setting's random tables.
3. **Afternoon and night; back in safety.**
   - **Francis (lodging):** players select lodging from the town's available lodgings with their rates, and send the choice to the GM for approval and narration. ⚑ Lodging list per settlement (name, rate by lifestyle or room) → player picks → GM Approve (cost logged) / Not available.
   - **Francis (town screen):** the GM sees a screen like a town's entry in a printed setting: the town's NPCs, places, activities and random encounters, to help narration and to frame what players might send. Players see a similar screen with only what the GM makes visible (which shops are open and shown, lodging, common-knowledge parts of town), never hidden information. ⚑ The settlement version of the location view: Overview, Places in town (shops, lodgings, temples, others; each with Show players and Open / Closed), People (NPCs), Things to do, Encounters (GM-only), Rumours (M8b data). Players see only what's shown.
   - **Francis:** **Back in safety** opens the town interface, after first triggering the XP and loot screen. A hostile town has no Back in safety; its button reads **Into town** (or the settlement's equivalent) and opens the town interface with no XP or loot step. ⚑ Each settlement place carries Safe (default) / Hostile, set by the GM; arriving offers Back in safety (Split loot → Award XP → town screen) or Into town (town screen only).
   - **Francis:** automatic healing shows in an **overnight summary** to each player. ⚑ Next morning each player gets a short summary card (HP healed and why, statuses changed, lodging cost); it applies with the GM's next part of the day.
4. **Start downtime and End downtime.**
   - **Francis:** a full rest is assumed for downtime; no button needed. End downtime could mean many things; for now it returns to Adventure (more in the downtime design session). Players can still Ask for… and Sell… in town during downtime.

## Rulings to confirm (⚑) from the settlement dry run (replace session 3's 8)

1. **Time in town** moves in parts of the day: morning, afternoon, night ("Next part of day").
2. **Arriving:** each settlement is Safe (default) or Hostile (GM). Safe: **Back in safety** → Split loot → Award XP → the town screen. Hostile: **Into town** → the town screen only.
3. **The town screen** (the settlement version of the location view): Overview; Places in town (shops, lodgings, temples, others, each with Show players and Open / Closed); People; Things to do; Encounters (GM-only); Rumours. Players see only what the GM shows. Everything is scoped to the current settlement. M5b builds the layout and controls with the pack's services and lodging; M8b fills NPCs, named shops and rumours.
4. **Out and about today / Active tonight** switches gate the town's encounter checks (pack field onlyWhen).
5. **Buying:** a player's **Ask for…** → the GM's prompt with the pack's availability chance (Hit / Miss) → In stock (pack price) · Not here · Price… → the player buys or leaves it. Costs are logged as text until purses (M7b).
6. **Selling:** **Sell…** (item, and buyer: a service or a person) → the GM sees a price suggested from the pack's rule → Offer (changeable) → the player Accepts or Declines.
7. **Lodging:** players pick from the town's lodgings with rates → the GM approves (cost logged) or says Not available; the lifestyle option shows its daily cost.
8. **Town activities** for players (from the pack, plus Something else…), rules one tap away; results narrated, or offered (a rest day's heal); money results as text until purses.
9. **Overnight summary** to each player each morning (HP healed and why, statuses changed, lodging cost), applied with the GM's next part of the day.
10. **Start downtime** ends the expedition, applies a full rest automatically (no button) and switches to Downtime; the town screen stays for buying and selling; time moves with +1 day, +1 week or a date.
11. **End downtime** returns to Adventure (more in the downtime design session).
12. **Settings without a settlement mode** (classic-advanced): settlement places still show the town screen, Back in safety and the buying and selling; time moves with the current mode or Downtime.
13. **Parking lot:** generating shop stock from a setting's random tables.
14. **Roadmap:** a downtime design session before M7's downtime work (players propose activities, the GM sets durations, the total comes from those or from a chosen or random date).

**Pack tasks (design agent):** onlyWhen on town checks; availability rules from both books; lodging lists and rates; settlement services structured.
