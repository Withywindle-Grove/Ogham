# Regions: a one-page proposal (2026-11-12)

From the lead, for Francis to rule before anything is built on it. He asked: "Is regions a good way to organize this kind of information in packs/app? Questions, enhancements, alternatives?" Examples are invented; the adventure's own are in the private plan sheet.

## The answer in one line
Yes. A region is a place that holds other places and carries five things of its own. Most of it is already in the pack format; three small additions make it whole.

## What a region is
| A region has | What it is for | In the pack format today |
|---|---|---|
| **Areas** | The places inside it, numbered as its map numbers them | Yes: a location whose `parentId` is the region |
| **A map** | The keyed picture players and GM look at; each number sits where its area is | **New:** the region names its picture with `mapImageId`; the keys live on the picture, `images[].keys: [{ key, x, y }]` (fractions of the picture, so the GM's copy, the players' and any redraw share one set; pf-8) |
| **Knowledge** | Where it is, what is here, who is here, what they know; the passage read out on arrival | Yes, as of pf-5: `identity`, `facts`, `gm.sections`, `playerView.text` and `aspects`. **New:** a section the GM may share whole with one tap is marked `shareable` |
| **Rules** | The rules that apply only here (a hazard of this place), each one tap away, some with a button of their own ("Someone fell in") | **New:** `rules: [{ id, name, text (structured as rt-1), tableId?, button? }]` on the region |
| **Tables** | Its encounter table and when it is rolled; its other tables | Yes: `encounterCheck` and `tableIds`. **New on the check:** `when: "eachMove"` beside the existing ways of timing a check |
| **Its way of travelling** | Linked spots by the turn; or hexes by the day; or rooms and doors | Partly: `routes` with times per way of moving (pt-f1). **New:** the region names its kind of travel and its default ways, `travel: { kind: "points" or "hexes" or "rooms", unit, ways }`, a link carrying its own only where it differs; a link may carry a `barrier` (extra time, the GM's approval, the place it passes through, a note) |
| **Connections** | How one region leads to the next | Yes: a route whose two ends are in different regions |

People who belong to the region but to no one area (a ship's captain) are `npcs` whose place is the region.

## On the Scene
- **The region's page:** its name and one line; its map as the main body, each area a tag; two buttons one tap away, **Knowledge** and **Rules**; its tables; Move on, which follows the region's own way of travelling.
- **An area** opens as the place panel already ruled (mc-15 … mc-17): its text set out as its book sets it out, the description and each part separately revealable; its treasure handed out from there (pk-1); its creatures and people one tap away.
- **Players** see the map, the areas they have been shown, the ways on (mc-28), and whatever knowledge the GM has shared.
- A town is a region too: the port's page and a harbour's page are the same parts with different contents. One thing to build, not two.

## Why this and not something else
- **Chapters of an adventure, flat:** simpler, but rules and travel differ from one part of an adventure to the next (a bay crossed by boat, a beach walked, a keep explored room by room), and a flat list has nowhere to put that.
- **Modes alone** (dungeon, wilderness, settlement): the rules pack's modes say how time moves; they can't hold "the rule for falling in this water". A region picks its mode through `travel.kind` and adds its own rules beside it.
- **Hexes as the only kind of region:** the fae-woodland region works that way, and it fits as one kind among three.

## What it costs
Three additions to 07 (`map`, `rules`, `travel` with `barrier` and `when`), all optional, so old packs are unchanged. In the app: the region page and its two sheets are new; the place panel, the picker, the routes and the move are built or planned. Sizes are with the Builder and the Pack Creator.

## For Francis
1. **How deep may regions nest?** An island holding a harbour holding areas holding the inside of a wreck. Proposed: any depth; the Scene shows where the party is and one level up.
2. **Do a region's rules replace the campaign's, or sit beside them?** Proposed: beside. They are listed one tap away while the party is there; nothing is switched off silently.
3. **What is it called on screen?** Proposed: never "Region": the place's own name and kind from the pack ("The harbour").
