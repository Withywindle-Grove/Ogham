---
status: pending
milestone: December first play (`docs/plans/december-first-play.md`), steps 2, 3, 5 and 6
absorbed-into: pending, with the pull requests that read each field (07 locations, settlements, shops, npcs, tables, links; 05 the town page and the place panel); docs/09-decisions-log.md (2026-11-11)
supersedes: nothing; every field is optional and a pack without them reads as today
---

# Pack format rulings for the December campaign (2026-11-11)

Ruled by the lead as design, on questions from the builders and the Pack Creator, so that the port pack and the app's reader could be built at the same time. Francis's standing instruction behind pf-3 and pf-5 (2026-11-11): "For all inns and taverns and locations in general in the city, follow the formatting from the [fae-woodland] source material and ensure that those elements are defined." Structure only; a pack's words are its own. His to overturn; told to him the same day. (pt-f1 … pt-f3, the routes, are in `dec-point-travel-format-2026-11-11.md`.)

| Id | Ruling |
|---|---|
| pf-2 | A table row's `statBlockIds` entries may each be a plain id (the row's `count` applies to the group, as today) or `{ statBlockId or statBlockRef, count }`, so each creature carries its own count. Where every entry has its own, the row's `count` is ignored; an entry without one takes the row's. |
| pf-3 | A location's `playerView.aspects: [{ lead, text }]`: each aspect becomes one piece with its own eye, hidden until the GM shows it, in the pack's order; `lead` is shown bold before the text (a nullable `lead` on a place's pieces). `playerView.text` stays the short read-aloud. (mc-17.) |
| pf-4 | `settlement.priceMarkup: { percent }`: one value for a town, a GM fact until the app applies prices. The December port's is 0 (Francis: "Book prices"). |
| pf-5 | The shape of a settlement, a place in it and a person, below. |

## pf-5: a town as the source lays one out

**The rule of thumb.** Players get pieces only (`playerView.text`, each aspect, a person's `playerView.description`), each hidden until shown. Everything else is the GM's. A lead-in's word comes from the pack, never from the app; the app sets it bold and keeps the pack's order.

| Where | Field | Who reads it | What it is |
|---|---|---|---|
| Any location | `identity` | GM | The one line under the title |
| | `facts: [{ lead, text }]` | GM | Bold lead-in lines in the pack's order (a town's inhabitants, ruler, religion, rumours; a hamlet may have two) |
| | `gm.sections: [{ heading, text }]` | GM | Headed prose, folded under each heading; `gm.notes` stays for unheaded notes |
| | `tableIds: [ids]` | GM (each table keeps its own visibility) | The place's own tables in page order; encounter tables stay on `encounterCheck` |
| A settlement | `watch: { text, leads: [{ lead, text }], statBlockId? }` | GM | The town watch's box |
| | `lodgings[]` gains `grade?` and `placeId?` | As lodgings are today | The quality word, and the inn that offers it |
| A shop (07 §6) | `services[]` gains `grade?` and `stock?: { die, on }` | GM | The quality word; a chance of being in stock |
| A person (07 §5) | `playerView.description` | Players, as a piece | How they look: the only line players can be shown |
| | `gm.portrait` | GM | The lines at the top of the person's box |
| | `gm.leads: [{ lead, text }]` | GM | The lead-ins, the same leads in the same order for every person in one pack |
| Any text | `[[kind:id|label]]` | As its text | A link: `kind` one of place, npc, item, table, statBlock, spell, rule; `id` this pack's, or `packId:id`. An unresolved link shows its label as plain text. In a player's piece a link is a tap only to what that player can already see; otherwise the label shows plain. The same mark as rt-1's for rule text |

**What the app reads when (the December cut):**
- With the town page and place panel (plan `dec-2-3-places-and-port.md`, piece 2c): `identity`, `facts`, `gm.sections`, `aspects`, `tableIds`, `settlement.watch`, a lodging's `grade` and `placeId`; a link's marks are never shown raw: at the least the label shows as plain text, and a link to a place, a table or a stat block is a tap where that is cheap.
- After the cut line: `shops` and `npcs` as import parts (so services and people stop living in `gm.notes`), per-shop stock, `priceMarkup` applied, the map, Introduce.
- Until then a pack also writes what a place sells and who keeps it into the place's `gm.notes` as label-and-colon lines in the source's order, which the town page sets as bold lead-ins; nothing a player may read lives only in a part the app doesn't import.

**The checker** warns on: an aspect without a `lead`; a person's leads out of the pack's order; a link that resolves to nothing; a link inside a player's piece.

Docs to update: 07 (`locations`, `settlement`, `shops`, `npcs`, table rows, links; the new `patrons` section, owed with #636), 05 (the town page; the place panel), 04 (a piece's `lead`), 09.

09 line:
- 2026-11-11 — [packs] The pack format gains, all optional: a table row's creatures with their own counts (pf-2); a place's aspects as pieces with a bold lead-in (pf-3); a town's price mark-up (pf-4); and a town laid out as the source lays one out: an identity line, facts, headed prose, the watch, lodgings with a grade, a person's portrait and fixed-order leads, and `[[kind:id|label]]` links (pf-5) — "Follow the formatting from the [fae-woodland] source material and ensure that those elements are defined" (Francis, for the December port) — `design/rulings/dec-pack-formats-2026-11-11.md`

## More format rulings (2026-11-11 night and 2026-11-12), agreed by Francis ("Otherwise agree on rulings")

Ruled by the lead on the Pack Creator's sizing of the December plan, then put to Francis.

| Id | Ruling |
|---|---|
| pf-6 | A treasure row may name its `hoard`; rows sharing a name at one place are one hoard, handed out whole or one thing at a time (pk-1); coin is a row like any other. |
| pf-7 | An adventure carries every hook its book offers: `hooks: [{ id, name, text, pays, giverNpcId? }]`, the text in the book's own words, GM-only until sent (Francis: "all hook options available to the GM before starting the adventure should be part of every pack, verbatim"). A rumour row keeps its players' words apart from its truth. |
| pf-8 | A map's keys live on the picture: `images[].keys: [{ key, x, y }]`, x and y as fractions of the picture's width and height; a location names its map with `mapImageId`; locations match by `key`. One set of keys serves the GM's picture, the players' and any redraw. |
| pf-9 | An availability chance: `availability.chance: { die, on }`, shown as a reminder to roll; the text forms stay valid. |
| pf-10 | The same item in two packs: `sameAs: ["packId:id"]` on the later pack's item; the campaign's order of packs decides which shows (for the December campaign: its rules, then the zine, then the region's book for what only it has). No system is named. How a campaign shows its order of packs is a design item (Francis: "that needs to be more clearly represented"). |
| pf-11 | A GM section the GM may share whole with one tap: `gm.sections[].shareable: true`. |
| pf-12 | **A region** is a location with places inside it, and may carry: `mapImageId`; `rules: [{ id, name, text, tableId?, button? }]` (text in the rt-1 block shape; `button` the words of a button that opens that rule); `travel: { kind: points, hexes or rooms; unit; ways: [{ by, name, value, unit }] }`, the ways being the region's defaults, a link carrying its own only where it differs; an encounter check's `when: "eachMove"`; on a link, `barrier: { extraTurns, needsApproval, through?, note }` (`through` names the place a crossing passes, whose own chances then apply); a link between places of two regions takes its ways from the link itself. An area's text uses the rt-1 block shape. People who belong to a region but to no one area are placed on the region. Proposal: `docs/design/notes/regions-proposal-2026-11-12.md`, whose three questions for Francis (nesting depth, regional rules beside the campaign's, no word "Region" on screen) are still open. |

## Maps that draw no links: the converter's standard (ruled with pf-12)
1. Read the book's movement rule first: it decides what a link is.
2. Propose links to each spot's nearest neighbours, never across a drawn wall, cliff or water edge without a way.
3. Anything drawn that blocks a straight line becomes a `barrier` on the links that cross it, never a missing link: nothing is truly impassable.
4. Every keyed spot gets at least one link; one reached only by a climb or a swim gets that way.
5. Entry and exit points come from the book's text.
6. Times are the book's; where it gives none, one turn a link, marked as an estimate.
7. One picture of the proposal for the GM to confirm or change before the pack ships.
8. Each link's note records its origin ("our reading", "accepted by", "added by") and the date.
9. The reading lives in the routes; the book's text is never altered.
10. Not needed for hex maps, square grids, plans with drawn doors and corridors, or a book that prints its own link list or travel table.

Both of the December adventure's first two areas were read this way and confirmed by Francis (the first with five links he added; the second from his own list, with fourteen added by the Pack Creator that he accepted).

09 line:
- 2026-11-12 — [packs] The pack format gains hoards, verbatim hooks, map keys on the picture, an availability chance, `sameAs` for one item in two packs with the campaign's pack order deciding, shareable sections, and regions (a place holding places, with its map, rules, tables, default ways of travelling, a check on each move, and barriers on links); and the converter has a ten-line standard for maps that draw no links (pf-6 … pf-12) — "Is regions a good way to organize this kind of information?" and "will this be always difficult for pack creator?" (Francis) — `design/rulings/dec-pack-formats-2026-11-11.md`

## Two corrections found in building the packs (2026-11-12)

Ruled by the lead on the Pack Creator's questions; told to Francis the same morning, his to overturn. pf-7 and pf-5 stand as written above except for the name and the list of kinds given here.

| Id | Ruling |
|---|---|
| pf-7a | An adventure's hooks are carried as `adventureHooks`, not `hooks`: that name is already the format's rule hooks (07, "Rule hooks"), and the checker read the adventure's as broken ones. Fields as pf-7; `giverNpcId` stays optional (a hook may be posted at a place and shared from a shareable section rather than given by a person). "Call to adventure" is a word for the screen, never for the format. |
| pf-5a | `adventureHook` joins the kinds a `[[kind:id|label]]` link may name (place, npc, item, table, statBlock, spell, rule, adventureHook), with the same fallback: an unread or unresolved link shows its label as plain text. One way to point at a thing: no separate reference field. |

| pf-12a | An area's full text, set out as its book sets it out, is carried in `gm.text` in the same block shape as a rule's `text` (rt-1): the read-aloud as a paragraph, each lead-in with its bold word, sub-points as a list under it, each item or stat box as a titled box, the source line. It is the GM's view; the players' pieces stay `playerView.text` and `aspects`; `gm.notes` and `gm.sections` are unchanged. Names the field pf-12 left unnamed. |

Docs to update: 07 (adventure packs: `adventureHooks`; links: the kinds; locations: `gm.text`), 09.

09 line:
- 2026-11-12 — [packs] An adventure's hooks are carried as `adventureHooks`, not `hooks`, and `adventureHook` is a kind of link (pf-7a, pf-5a) — `hooks` is already the format's rule hooks, and the checker read the adventure's as broken ones (the Pack Creator, building the December adventure) — `design/rulings/dec-pack-formats-2026-11-11.md`

## Regions: the three questions, ruled (2026-11-12; Francis: "Yes to all")

| Id | Ruling |
|---|---|
| rg-1 | Regions nest to any depth (an island holding a harbour holding areas holding the inside of a wreck). The Scene shows where the party is and one level up. |
| rg-2 | A region's rules sit beside the campaign's and never replace them: they are listed one tap away while the party is there; nothing is switched off silently. |
| rg-3 | The word "Region" never appears on screen or in a pack's own text: a region is shown by its own name and kind. |

With these the regions proposal (`docs/design/notes/regions-proposal-2026-11-12.md`) is ruled in full; pf-12 carries its format.

## The specific rule wins (2026-11-12, later the same day; changes rg-2 in one respect)

Asked of Francis because the December adventure rolls for an encounter "each time the party heads for a new spot", while its rules' dungeon mode also rolls every two turns, and pt-f2 would raise both. His answer: "A - adventure and region specific rules trump setting rules in most cases."

| Id | Ruling |
|---|---|
| rg-4 | **An adventure's or a region's own rule takes the place of the setting's rule on the same matter, in most cases.** This changes rg-2's "never replace them": a region's rule may stand in for the campaign's while the party is there. What rg-2 protects stays: nothing is switched off silently. The screen says which rule is in force and whose it is, and the setting's rule is still one tap away. "In most cases" means the pack says so each time (pf-12b); a region rule that says nothing sits beside the setting's, as rg-2 had it. |
| pf-12b | A region's encounter check may carry `replacesScheduled: true`: while the party is in that region, the mode's own scheduled check (every N turns) is not raised, and the region's check is raised as it says (`when: "eachMove"`). This settles pt-f2's "to revisit". The same idea for other matters (a region's rule naming the setting's rule it stands in for) is added when a pack first needs it, not before. |

**Costs and caveats.** The first cut of point-to-point travel (plan `dec-4-point-travel.md`) must read `replacesScheduled`; not yet sized by the Builder. The words on the screen ("Encounter check: on each move, by <the place's name>") need a mockup Francis approves before they are built.

Docs to update: 07 (regions: `replacesScheduled`), 05 (encounter checks: which check is in force), `docs/plans/dec-4-point-travel.md`, 09.

09 line:
- 2026-11-12 — [adventure] An adventure's or a region's own rule takes the place of the setting's rule on the same matter where the pack says so, and the screen says which is in force; first use: a region's encounter check on each move stands in for the mode's scheduled check (rg-4, pf-12b; changes rg-2's "never replace") — "Adventure and region specific rules trump setting rules in most cases" (Francis) — `design/rulings/dec-pack-formats-2026-11-11.md`

09 line:
- 2026-11-12 — [adventure] Regions are the organising model for places: any depth of nesting, a region's rules beside the campaign's, and never the word "Region" on screen (rg-1 … rg-3) — Francis, on the regions proposal — `design/rulings/dec-pack-formats-2026-11-11.md`

