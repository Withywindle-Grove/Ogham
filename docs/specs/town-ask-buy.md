---
status: approved at sitting B, 2026-11-28; tickets #222-#225 (parent #221); rulings sb5-1 to sb5-7 (docs/design/rulings/town-ask-buy-b-2026-11-28.md)
loop: 5a
rulings: docs/design/rulings/loop5-town-2026-11-28.md (l5-1, l5-4; its "To check" and "Technical, for the spec"); the row's own rulings stand as written: ap-14, tn-4, tn-7, tn-8 (2026-11-14), tn-1, ap-8, ap-12 (2026-11-14), bu-1, bu-2a, bu-2b (2026-11-14, 2026-11-15), ap-7 (2026-11-14), #108's three ⚑ (2026-11-26), p45-21 (2026-11-26), the toast's tr-1 to tr-16 (2026-11-25 and 2026-11-26; not the town's tr-1 of 2026-11-14)
intents: none; the row comes from the town's rulings of 2026-11-14 (page 19) and the plan below
plans left: docs/plans/dec-16-town-carry.md (TC13; kept for the record only)
mockups: december/19-the-town-whole.html, frames TW8g (the ask card with the toggle, approved 2026-11-14, ap-14, with its two fixes drawn), TW4a (buying end to end, approved 2026-11-14, ap-8; its card at step 2 is TW8g's), TW4c (Ask for… and Price…, approved 2026-11-14, ap-12), TW8f (the toggle, approved in the stock table 2026-11-14, ap-13; built as TC9). pack/08-the-pack-tab-whole.html, frame PK10b (the toast after a purchase and the Spend sheet filled in, approved 2026-11-14, ap-7). december/43-the-toast-restyled.html, frames 43D and 43H (the toast's dress, approved 2026-11-25). december/52-a-picture-that-fails-to-load.html (approved 2026-11-28 with finding 1, l5-4: the map's words only). Pictures under each page's png/ folder
order (l5-1): loop 5a is TC13 alone, so buying works on 5 December whatever else happens; never cut
---

# Spec: asking and buying in town

Loop 5a of the build loop. Francis typed `/to-spec` on 28 November for loop 5a, which sitting A (l5-1) made TC13 alone: the town's asking and buying, standing on the toggle (TC9) and the at-once answer (TC12), both built. The rest of the town is loop 5b, its own spec. One small row of words joins it (l5-4): the map's failed line says "couldn't load", as page 52 does.

Every piece is visible and has an approved frame, but one: Piece A, which wires the player's Ask for… to the built `town.askFor` and is data and logic only. No piece changes what is stored or who may read it: no migration, no new command, no new permission case (Implementation Decisions).

## Problem Statement

**The GM answers an ask with three buttons and a roll.** When a player asks for a thing, the GM's card in Waiting for you first asks for a Hit or a Miss on the pack's chance, then offers In stock, Price… and Not here. The stock table (loop 5b) answers the same question with one toggle. Two controls for one answer is one too many, and the card's buttons write nothing to the day's stock, so the next player who asks for the same thing reaches the GM again.

**An ask the day's stock has already answered still reaches the GM.** The at-once answer (TC12) is built in the database, but the player's Ask for… still sends a plain request. The GM is asked again for a thing already decided.

**A purchase says nothing about its cost.** After Buy it the toast says "Bought for 1 heron: it's in your pack", with Undo. The coin is not taken, and nothing offers to take it. A player who wants to pay goes to the Pack, opens the purse, and types the amount and what it was for. On the Pack tab the same purchase already offers "Spend 1 heron".

**The map says its failure one way, the place's picture another.** The map's failed line says "didn't load"; page 52 (TC8, loop 5b) says "couldn't load".

## Solution

The GM's ask card carries the thing's place and its chance as the stock table writes it, then "Price…" and "Stocked?" with the three-position toggle, resting on "?" (TW8g). A flip to the right answers the player "In stock" at the pack's price; to the left, "Not here". Each goes at once, with Undo in the toast, and is also the day's stock answer for that thing at that shop: the same record the stock table flips. "Price…" opens TW4c's pop-up for the GM's own price. No Hit, no Miss, no roll button; the card takes no accent.

The player's Ask for… goes through the at-once answer: a thing already decided today is answered by the app at once, and the GM gets no card, only the log's line.

The player's "Buy it" adds the thing to the pack and charges nothing by itself (tn-1). Its toast says so, "Wren bought a coil of rope. Its cost, 1 heron, is not spent yet.", with "Spend 1 heron" and Undo (TW4a, PK10b). "Spend 1 heron" opens the purse's Spend sheet with the amount and "What for" filled in; the player taps Spend there. Undo takes the bought thing back out while nobody has touched it (bu-1). Buy it is the player's own act: no find card, no "New" tag, no count (p45-21).

The map's failed line reads "The map's picture couldn't load."

## User Stories

**The player asks**
1. As a player in town, I want Ask for… to work as it does today (a shop, the setting's items, Something not listed…, "Send to the GM"), so that nothing I know changes (TW4c).
2. As a player, I want a thing the GM has already decided today answered at once, so that I don't wait for the GM to say it again (tn-7).
3. As a player, I want a thing already in stock to reach me as "In stock" at its price with Buy it and Leave it, so that I can buy it straight away.
4. As a player, I want a thing already out to reach me as "Not here" for the thing I asked about only, so that I learn nothing about things I didn't ask for (tn-8).
5. As a player, I want a thing still on "?", one not in the shop's list, or Something not listed… to go to the GM as today, so that the GM decides what the day has not.
6. As a player, I want an ask that went to the GM to keep today's toast and its Undo, so that a mistaken ask can be taken back before the GM answers.
7. As a player whose device is offline, I want Ask for… to fail in plain words with nothing half sent, so that I know to try again.

**The GM answers**
8. As the GM, I want each ask that reaches me as a card in Waiting for you headed "Wren asks for: a coil of rope", so that I see who wants what (TW8g).
9. As the GM, I want the card's next line to give the place by its numbered name ("At 3 The Reed Market.") and then the thing's chance as the stock table writes it (the die's glyph and "4-in-6", or "Always"), so that I can roll at the table if I wish.
10. As the GM, I want a thing with no chance to show its place only, so that the card never shows an empty chance.
11. As the GM, I want "Stocked?" and its toggle at the card's right, the toggle last, resting on "?", so that I answer with the control the stock table uses (ap-14, tn-4).
12. As the GM, I want a flip to the right to answer "In stock" at the pack's price, at once, so that one tap answers the player.
13. As the GM, I want a flip to the left to answer "Not here", at once, so that one tap answers the player.
14. As the GM, I want my flip to set the thing in or out for today at that shop, so that the next player asking for it is answered at once and the stock table (loop 5b) shows the same answer.
15. As the GM, I want my flip's toast to offer Undo, which puts back both the answer and the day's stock, so that a slip of the finger costs nothing.
16. As the GM, I want Undo of my answer refused in plain words once the player has bought, so that I never take back what the player has acted on.
17. As the GM, I want "Price…" beside "Stocked?", opening a pop-up with the pack's price as a line, "Your price, in words" and "Send price", so that I can name my own price (TW4c).
18. As the GM, I want "Send price" with an empty field to tell me what to type, so that I never send an empty price.
19. As the GM, I want no Hit, no Miss and no roll button on the card, so that the card asks one thing (tn-4).
20. As the GM, I want the card never to take the screen's accent, so that "Move on" keeps it (ap-14).
21. As the GM, I want the card only for a thing still on "?" or not listed, so that I am never asked about what is decided (tn-7).
22. As the GM, I want a later flip in the stock table never to unsend an answer given, so that a player's answer stays as it was given (tn-8).
23. As the GM with two asks waiting, I want each card to stand on its own, so that I can answer them in turn.
24. As the GM on a phone at 375 px, I want the heading to wrap and "Price…", "Stocked?" and the toggle to keep one line, right-justified, each target 44 px with at least 8 px between, so that I can answer with a thumb (TW8g).
25. As the GM, I want a failed flip to say so in an error toast and leave the card on "?", so that I can flip it again.

**The player buys**
26. As a player, I want the GM's "In stock" or price to reach me as the answer with Buy it and Leave it, as today, so that I choose.
27. As a player, I want Buy it to add the thing to my pack as bought and charge nothing by itself, so that I decide whether coin changes hands (tn-1).
28. As a player, I want the toast after Buy it to say "Wren bought a coil of rope. Its cost, 1 heron, is not spent yet.", so that I know the coin is still in my purse (TW4a).
29. As a player, I want the toast to offer "Spend 1 heron", so that paying is one tap away (TW4a, PK10b).
30. As a player, I want "Spend 1 heron" to open my purse's Spend sheet with the amount filled in and "What for" filled with the thing's name, so that the log reads "Wren spent 1 heron: a coil of rope" (#108 ⚑ 3).
31. As a player, I want the Spend sheet's own Spend to take the coin, with its own Undo, so that the purchase and the payment are two lines I can each take back.
32. As a player, I want a price the setting's coins can't read ("a favour owed") said in the toast with no "Spend", so that nothing is filled in wrongly (#108 ⚑ 2).
33. As a player, I want the toast's Undo to take the bought thing back out while nobody has touched it, the log keeping a copy, so that a mistaken purchase has a way back (bu-1).
34. As a player, I want that Undo refused in plain words once the thing was touched (used, moved, lit, filled, or changed by the GM), so that nothing I've used vanishes (bu-2a, bu-2b).
35. As a player who spent and then undid the purchase, I want the spend undone on its own, so that each line is taken back by its own Undo (TW4a).
36. As a player, I want no find card, no "New" tag and no count on the Pack's icon for a thing I bought, so that my own act never reads as news (p45-21).
37. As a player, I want the toast in page 43's dress (rounded, solid, 5 seconds, paused while touched; the bar; Action and Undo), so that it looks like every other toast (tr-1 to tr-16).
38. As a player, I want a new toast to replace the one showing, so that the Spend toast follows the Buy toast cleanly (tr-7).
39. As a player, I want Leave it to keep today's toast and Undo, so that nothing changes for leaving a thing.
40. As a player, I want a thing with a very long name to wrap in the toast and on the cards without hiding "Spend" or Undo, so that a long name never costs me a button.
41. As a player, I want a price of 0 coins to offer no Spend, so that I am never asked to spend nothing.
42. As a player, I want a price of 999 coins to read whole in the toast's button and in the Spend sheet, so that a large sum is never cut.

**Who may do it**
43. As the GM, I want only the GM to flip the toggle on an ask card, and a player's flip refused, so that only the GM answers.
44. As a player, I want only the asker to Buy it, Leave it, or undo their own purchase, so that another player can't buy or undo for me.
45. As a player, I want another player's Spend refused on my purse, so that only I spend my coin.
46. As the GM in the GM's view as the player, I want Buy it, Leave it and the purchase's Undo to open the player-only pop-up and write nothing, as today (C15d), so that the view stays a view.

**The map**
47. As the GM or a player, I want a map whose picture failed to say "The map's picture couldn't load." with Try again, so that the app says it one way (l5-4).

## Implementation Decisions

**Pieces, for the tickets.** The plan sized TC13 at 2 / 3 / 5 builder turns; the words row is a fraction of one.

| Piece | Row | What | Frame | Shares a module with |
|---|---|---|---|---|
| A | TC13 | Ask for… through the at-once answer (`town.askFor`) | none: data and logic only (the answer shows on the card as built, TW4a step 3) | B (the requests module's town side) |
| B | TC13 | The GM's ask card: the toggle, the chance, Price… | TW8g, TW4c, TW8f | A, C (the town's request cards) |
| C | TC13 | Buy it's toast: "Spend N" and Undo; the Spend sheet from the Scene | TW4a, PK10b, page 43 (43D, 43H) | B (the town's request cards); the Pack's purchase toast |
| D | l5-4 | The map's failed line's words | page 52 (finding 1) | none; loop 5b's TC8 later changes the shared picture beside it |

A and B go one after the other (same module), C after B (same card file). D runs beside any of them.

**No migration, no command, no permission case.** Every write TC13 makes is a built, logged command: `town.askFor` (TC12), `stock.set`, `request.answer`, `request.reply`, `request.undoBuy`, and the purse's spend. Each already has its allowed and not-allowed cases. No combined command is added, since a new logged command needs a row in `public.logged_commands` and so a migration. If a builder finds TC13 cannot be built without a database change, that is a stop and a report to the driver, not a migration.

**Piece A: Ask for… (tn-7, tn-8; TC12 built)**
- The player's Ask for… for a thing at a shop calls `town.askFor` with the character, the words, the campaign day as the clock counts it (`readClock(...).day`, as `stock.set` does) and the buy prompt, instead of `request.send`. Something not listed… goes the same way; the database leaves it for the GM.
- An ask the database answers at once arrives as an answered request: the player's answer card shows it as it shows any answer. The GM gets no card; the log has the line.
- An ask that waits keeps today's toast and its Undo (the player's withdraw). An ask answered at once raises no toast and no Undo: the answer card is the news (sb5-6; tn-8).
- The GM's view as the player keeps its player-only pop-up on Ask for… (C15d).

**Piece B: the GM's ask card (ap-14, tn-4, TW8g, TW4c)**
- The card, in Waiting for you: the bag's icon; the heading "<who> asks for: <thing>"; one line, "At <place's numbered name>." then the chance as the stock table writes it (the die's glyph and "x-in-y", or "Always"), the chance only where the thing has one. The pack's price line and "Where it's sold" go: the price stands in Price…'s pop-up (TW4c).
- At the right, one row, right-justified: "Price…" (a secondary button with the coins' icon), "Stocked?" and the toggle, the toggle last. The toggle is the built `StockToggle` (TC9), never a copy, resting on "?" (the card shows only for a thing on "?" or not listed, tn-7). At 375 px the heading wraps and the row keeps one line.
- The right half: the request is answered "In stock" at the pack's price (`request.answer`, result in stock), and the day's stock is set in for that thing at that shop (`stock.set`, the same record the stock table flips). The left half: "Not here", and the stock set out.
- The order of the two writes, technical: the stock first, then the answer. A failed stock write sends nothing and leaves the card on "?"; a failed answer after a good stock write leaves the card on "?" with an error toast, and a second flip writes the same stock again and the answer. A thing with no pack id (Something not listed…) or an ask with no shop has no stock record: the flip answers only.
- The toast: today's words ("Wren: a coil of rope, 1 heron"; "Not here: told Wren") with Undo. Undo takes back the answer and, where one was written, the stock line, through the log's built Undo of each, newest first; the request returns to Waiting for you ("Put Wren's request back"). Once the player has replied, the answer's Undo is refused in plain words, as built.
- A thing on "?" with no price to say (Something not listed…, or the pack gives none): the right half opens Price…'s pop-up, and Send price answers and sets the day's stock in (sb5-1).
- "Price…" opens TW4c's pop-up (heading "<who> asks for: <thing>", the close ✕, "The pack's price: <price>" where there is one, "Your price, in words", "Send price" as the pop-up's accent). An empty field keeps its built line asking for the price, beside the field. Send price answers with the GM's price and writes no stock line. Price… is the pop-up TW4c draws, not the built card's inline field (sb5-3).
- No "A note for them": as TW8g draws; the built card's field goes (sb5-2).
- The card takes no accent (ap-14): "Move on" keeps it. No Hit, no Miss, no roll button (tn-4).
- Two asks waiting for the same thing at the same shop: each card answers its own asker; the other stays on "?" (sb5-4).
- 06's Components row "Buy request" says what the card is; its Code column is brought up to the built card in the same pull request.

**Piece C: Buy it's toast (tn-1, ap-7, bu-1, p45-21)**
- Buy it is `request.reply` as built: the thing joins the pack as bought, as a line of its own, its price as text. Nothing is charged.
- The toast is the built `purchaseToast`, the Pack's, never a copy, with the Toast's named variant Action and Undo (06). Its words are TW4a's: "<who> bought <thing>. Its cost, <price>, is not spent yet." The built words say "added"; the part learns the verb "bought" for this caller, the Pack's own words unchanged.
- "Spend <amount>" shows only when the price reads as the setting's coins (`readCost`) and the amount is more than 0; otherwise the toast says the cost and offers no Spend (#108 ⚑ 2).
- "Spend <amount>" opens the purse's Spend sheet (`PurseSheet` in its spend form, PK10b) with the amount and "What for" filled with the thing's name as the toast says it (#108 ⚑ 3). It opens over the Scene, where the player is (sb5-5).
- The toast's Undo is the buyer's own `request.undoBuy` (bu-1), as built: it takes the bought line back out while untouched, refused in plain words after (bu-2a, bu-2b). A spend made from the toast is a line of its own, undone on its own.
- The player's answer card is built as TW4a step 3 draws it (sb5-7): "For you", "In stock: <thing>", the price and the place ("1 heron. At 3 The Reed Market."), Buy it as the accent, and Leave it; the built card's "The GM says" and the ask in quotes go. 06's Components row "Buy request" says so.
- The toast's dress is page 43's (tr-1 to tr-16): nothing new to build.
- Buy it writes no "New": the find card, the tag and the Pack's count read others' acts only (p45-21), and the buyer's own reply is not one. The test proves it; nothing new to build.

**Piece D: the map's words (l5-4)**
- The map card's and the map pop-up's failed line reads "The map’s picture couldn’t load." (the app's curly apostrophes), with Try again and the note under it, as built. Nothing else on the map changes. Loop 5b's TC8 says the place's picture the same way.

## Testing Decisions

The two seams Francis approved (28 Nov, "Yes, two seams"). There is no database seam and no migration: every command is built, and its database tests stand.

| Seam | What it tests | Prior art |
|---|---|---|
| 1. The whole app on the stand-in database (Testing Library) | A player asks for a thing; the GM answers it with the toggle on the ask card; the player sees the answer and taps "Buy it"; the toast offers "Spend N" (opening the Spend sheet with the amount) and Undo; Undo takes the buy back; who may do each step (allowed and not-allowed); "Buy it" brings no find card, no "New" tag, no count (p45-21) | `src/app/townRequests.test.tsx` (the buying journey and the purchase's Undo, refused once touched); `src/app/packPurchase.test.tsx` ("Spend N" and the Spend sheet filled in); `src/modules/requests/askFor.test.ts` (the at-once answer); `src/app/gmViewScene.test.tsx` (the player-only pop-ups, C15d); `src/app/packFinds.test.tsx` (no find card for one's own act); `src/ui/stockToggle.test.tsx`; `src/ui/mapParts.test.tsx` (the map's failed line) |
| 2. The real screen in a browser (layout checks) | The ask card with its toggle and the Buy toast: 375 px and tablet width, light and dark, Larger text, long names, 0 and 999 | `tests/layout/stockToggle.spec.ts`; `tests/layout/packPurchase.spec.ts`; `tests/layout/toastWrap.spec.ts`; `tests/layout/gm-view-scene.spec.ts`; `tests/layout/mapParts.spec.ts` |

- A good test checks what a person sees or what a command returns, never how a part is built inside.
- Each test's purpose is written first, as a plain sentence.
- Seam 1 holds the journey whole: Wren asks for a coil of rope at a shop where it is on "?"; the GM's card shows the place, the chance and the toggle on "?", and no Hit or Miss; the GM flips right; the player's answer shows "In stock" with its price; the GM's card is gone; Buy it puts the rope in Wren's pack and takes no coin; the toast reads "Wren bought a coil of rope. Its cost, 1 heron, is not spent yet." with "Spend 1 heron" and Undo; Spend opens the Spend sheet with 1 heron and "a coil of rope"; Spend there takes the coin with its own line.
- Seam 1 holds the stock: after the flip, a second player asking for the same thing that day is answered at once, with no card for the GM; a flip left answers "Not here", and a second ask is answered "Not here" at once; Something not listed… flipped right answers and writes no stock line.
- Seam 1 holds the Undos: the GM's Undo after a flip puts the request back on "?" and the stock back to undecided; the GM's Undo after the player bought is refused in plain words; the buyer's Undo takes the untouched rope out, and is refused once it is touched; a spend made from the toast stays when the purchase is undone.
- Seam 1 holds who may: a player's flip and a player's Send price are refused; another player can't Buy it, Leave it or undo Wren's purchase, or spend from Wren's purse; in the GM's view as the player, Buy it and the purchase's Undo open the player-only pop-up and write nothing.
- Seam 1 holds the toast's edges: a price the coins can't read ("a favour owed") shows no Spend; a price of 0 shows no Spend; 999 reads whole on Spend's label; Something not listed… priced by the GM's Price… offers Spend when its words read as coins.
- Seam 1 holds p45-21: after Buy it, no find card on any tab, no "New" tag on the rope's line, no count on the Pack's icon.
- Seam 1 holds the failed writes: a failed flip (the stand-in database refusing) leaves the card on "?" with an error toast; a failed Ask for… sends nothing.
- Seam 1 holds the map's words: a failed map picture reads "The map’s picture couldn’t load."; the existing tests' expected words change with it.
- Seam 2 holds at 375 px and tablet width (as the layout suite sets it), light and dark, and Larger text: the card's heading wraps; "Price…", "Stocked?" and the toggle keep one line, right-justified; each target is 44 px with at least 8 px between; the toggle's focus ring is never painted over; the card has no accent. The Buy toast with a long thing's name ("a bundle of tallow candles wrapped in oilcloth for the Lantern Warden") and 999 coins keeps "Spend" and Undo whole, under 600 px full width and from 600 px as wide as its words (tr-13); two asks waiting stack without overlap; a card with no chance and a card with "Always".
- New layout fixtures go in the layout harness as a flag: Waiting for you with an ask on "?" with a chance, one with no chance, one Something not listed…, and one with a long name; the player's Scene after Buy it with a long name and a price of 999.
- Gallery pictures expected to change: the map's failed pictures (`mapParts.spec.ts`), and any picture of the GM's Waiting for you that holds a buy card. Each pull request says which.
- The examples are invented ("Wren", "a coil of rope", "3 The Reed Market", "herons", "the Lantern Warden"): no game IP (hard rule 2).

## Out of Scope

- The rest of the town: TC1 to TC5, TC14, TC10 (the stock table), TC8 (a picture that fails to load): loop 5b (l5-1).
- The stock table's Reset, its find field and its folded rows (TC10).
- A shop's stock list with Buy on a row (tn-1: later); an Order button (none on the night).
- Charging the cost by itself on Buy it (tn-1: never by itself).
- Selling, lodging and town activities: unchanged.
- #178 and #179: separate technical pull requests (l5-6; #179 is the pack checker only).
- The player's Ask for… form itself (TW4c, as built).
- dec-3's ⚑ 2 (a player and the log line of a thing coming in): stays open, the GM's alone; not for the night.

## Further Notes

**Ruled at sitting B (2026-11-28, `docs/design/rulings/town-ask-buy-b-2026-11-28.md`, sb5-1 to sb5-7).** The spec and its four tickets, #222 to #225 (parent #221), were approved ("Yes"). Each ruling was the lean.

| ⚑ | Piece | Ruling | Francis |
|---|---|---|---|
| B1 (sb5-1) | B | A: a thing with no price to say, flipped right, opens Price…'s pop-up; Send price answers and sets the stock in | "A" |
| B2 (sb5-2) | B | A: no "A note for them", as TW8g draws | "A" |
| B3 (sb5-3) | B | A: Price… opens TW4c's pop-up | "A" |
| B4 (sb5-4) | B | A: each card answers its own asker; the other stays on "?" | "A" |
| B5 (sb5-5) | C | A: "Spend N" opens the Spend sheet over the Scene | "A" |
| B6 (sb5-6) | A | A: an ask answered at once raises no toast and no Undo; the answer card is the news | "A" |
| B7 (sb5-7) | C | A: the player's answer card as TW4a step 3 draws it: "For you", "In stock: <thing>", price and place, Buy it as the accent | "A" |

**To check, not to ask** (from the rulings file).
- TC12's migration (`20261125180000_dec16_tc12_ask_answered_at_once.sql`) on the main database: the driver confirms it before TC13 ships. Piece A calls it.
- "Buy it" is the player's own act: no find card, no "New" tag, no count (p45-21). Seam 1 proves it.
- The Buy toast's "Spend N" reuses the built `purchaseToast`; its dress is page 43's.
- Two rulings share the id tr-1: the town's of 14 November (a player reads a place's shown parts, not used here) and the toast's of 25 November (dress D, used here).
- TW4a step 4 draws a "New" tag on the bought line: p45-21 (2026-11-26) is newer, and it wins.

**TC13 and TC10 flip the same record.** The card writes the day's stock with `stock.set`; loop 5b's stock table (TC10) will read and flip the same line. Loop 5a never needs TC10: the record and its commands are built (W12), and the at-once answer already reads them.

**#178 and #179 are not in this spec.** They travel as separate technical pull requests (l5-6).

**The words row (Piece D) stands apart.** It changes one sentence in `MapWait` and its tests; TC8's change to the shared picture (loop 5b) does not wait for it, nor it for TC8.

**Pictures owed.** Pieces B and C show their built screens beside TW8g, TW4a and PK10b in their `pr-text.md`; Piece D beside page 52's words.
