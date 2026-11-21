# Paper dry run: one point-to-point session (2026-11-18)

The walk behind `../rulings/scene-point-to-point-2026-11-18.md` (the rulings file and the specs win). Aliases and invented names only: the pack's own places, people, things and sentences are replaced by invented ones or by "the pack's …" (the private pack holds them).

Setting: classic-advanced 0.6.92. Adventure: the island adventure 0.2.11, whose harbour is a place of linked spots (twelve of them; the pack marks the place as travelled point to point, in turns, by rowing or swimming). Party: two characters. Goal: from "the GM opens the app" to "the party makes camp or leaves".
Tests what is live (the Scene's top, the GM's place page, Move on, the Depart sheet) against what Francis found in his live test of the same day; designs what is missing. Francis walked several steps on the live app as we went and sent pictures of it.

Names used below: Saltwick Island (the Region), The Drowned Harbour (the Area), The Anchorage (the unnumbered Location where the party starts), 1. The Jetty, 3. The Breakwater.

## Before the walk

**Francis:** "Departure menu needs cleaning up. Right now I can start at a region, a site, and an area, but only Areas have the ability to 'move on' to other areas. If we are driving by Area, then I should only be able to pick areas. In other words, Move on should always work. Areas should be renamed 'locations.' Sites should be renamed 'Areas.' 'Regions' stay as is."
- ⚑ The words Region, Area, Location (p2p-1). ⚑ The party stands only at a Location (p2p-2).

**Francis asks:** "If player's scene is not built, when will it be built? I thought SCENE was done." What went live is the GM's page and the top for both sides. The players' page was a separate plan marked "not released"; found later in the walk: every frame it waited on was approved on 14 November (page 18), and nobody released it.

**Francis:** "Marching order - 'walk beside' is fine but can we also add drag beside?" Asked at step 7.

## Step 1: the GM taps Depart

1. **At the table:** the group sits down; the GM sets the party off.
2. **The app shows:** the Depart sheet: "Exploring how?" (Dungeon, Wilderness), then "Where? (optional)".
3. **Taps:** two, as today.
4. **Proposed:** "Where?" first, Locations only, grouped under their Area; "Exploration method" filled in from the place, a three-way choice with Point to point; Start.

**Francis:** "Yes"
- ⚑ The Depart sheet (p2p-5). ⚑ Point to point as a third method (p2p-6; his plain yes on the data model came at the compile).

## Step 2: Start and Depart

**Proposed:** Depart's Start also starts the session, so the order does not matter.
**Francis asks:** what is the difference between the two Starts, then what a session does. Answered from 05 and the Scene's plan: a record of the evening, a gate on the facts row and the icon buttons, pause and resume, the quiet XP line at its end; it never moves game time.
**Francis (corrects):** "this is simple, we should not see an option to depart unless we have a session running. so once started, the depart button can appear, but when a session needs resuming or starting, there is no option to depart."
- ⚑ Depart only while a session runs (p2p-4). The proposal is withdrawn.

## Step 3: the party is at The Anchorage; the GM wants to read ahead

1. **At the table:** the GM reads out the starting Location, and wants a look at the next one before the players choose.
2. **The app shows:** the Location's page. The list of the other Locations is on the Area's page only, and its rows do not open.
3. **Proposed:** the list headed "Locations", a row opening that Location to read, the party not moved, a line saying where the party is.

**Francis** sent the live page and the book's own block for the starting Location, with these notes:
- The top: "I think they should be collapsable to save space". ⚑ p2p-20.
- The rule's button and Move on: "buttons should be at right and descriptions at left". A fault against page 11's frame 1b.
- "Where did we originally put calls to adventure? it doesn't belong on a location as it's something that is given before an adventure (though rumors often arrive in settlements)". It was mc-61. Proposed: settlements only. **Francis:** "Yes". ⚑ p2p-15.
- The encounter check's card should give the rule: the pack's check carries that sentence as its note, word for word; the card shows the app's own sentence. ⚑ p2p-14.
- "The map is not automatically loaded (it should be)." Step 6.
- "I dont' need locked marching order". Step 7.
- "I also dont need 'Pieces' as a Header". The description is shown twice; it is not in the book's format; four pieces are missing. Checked in the pack: this one Location carries a single sentence; the rest of the book's block and two pieces sit on the Area; two pieces are nowhere. A pack task. ⚑ p2p-10.
- "Notes: should be fully collapsed, not with partial words showing. Source should be part of notes." ⚑ p2p-12.

**Francis:** "Yes, eyes included, but give me a mockup of how it appears in the scene so i see how we'd access reading ahead"
- ⚑ Reading ahead (p2p-9). The studio drew page 23 (LA1 to LA4).

**Francis:** "you haven't addressed the incorrect icons, and buttons/icons next to each other in a row should be the same height"
- ⚑ One height in a row (p2p-16). The icons: the rule's button is a pack task; the ways' buttons need a format line (p2p-30); the strip was settled later (p2p-7).

**Francis asks** (of the mockup): what does a tap on the Area or the Region in the trail do? Checked in the code: it moves the party there, which is the dead end of his test.
**Francis (corrects):** "remove the locations button, the trail is sufficient and never moves the party. the popup is good". Then "Yes" to: the Area's tap opens the panel, the Area itself its first row; the Region's tap opens a panel of its Areas.
- ⚑ The trail reads and never moves (p2p-8).
**Francis:** "APPROVED" (page 23, LA1 to LA4, with the fixes listed in the rulings file).

## Step 4: the players say "we row to 1. The Jetty"

1. **At the table:** the party picks a way; the GM rolls for an encounter as they row, then describes the new Location.
2. **The app shows:** Move on, the destination, the way and its time; the clock moves; the place's check lands in "Waiting for you".
3. **Taps:** three (Move on, the way, Move).

**Francis** moved on in the live app and sent the Move sheet, the new Location and the check's card:
- "ik-…-check is machine text, i want human readable." The app makes that name when the pack's check has none. ⚑ p2p-18.
- "I dont need the 'one step in the log' descriptions - we agreed to avoid that kind of overexplaining." ⚑ p2p-17.
- The heading: a full stop after the number, title case. ⚑ p2p-3.
- "I dont need the 'players see' strip nor rename for players"; then "Yes, everywhere". ⚑ p2p-11.
- "Notes is just restating what I already see two other times". A pack task.
- "Here the Pieces are formatted properly and complete. if they continue in this fashion i dont need the 'from the book' section at all." ⚑ p2p-13.
- The treasure: the pack's two entries make two pieces, so the magic blade stands out. He wants one line in the book's words, and a separate piece for the magic item with its eye. ⚑ p2p-28, p2p-29.
- **Francis asks:** how is the hoard shared out? Today a words-only entry is handed out as one thing named by its words; an entry with an item is that item, its real name and powers the GM's. What he describes needs counts behind one piece.
- The check's card: "there is no hit or miss, or modifies, it's always a hit. So it's really not a 'Check' it's a 'Pick from table'". The pack's table has a result on every row. ⚑ p2p-19.

**Proposed:** a strip of four steps for point to point.
**Francis (corrects):** "Step 2 originates from the caller player if i remember design properly, not the GM." Right (mc-28, mc-36, mc-42); not built; pw-1 put it after 5 December.
**Francis:** "the order is correct in broad strokes"; later "for point to point use our generic process flow strip as opposed to wilderness or dungeon."
- ⚑ The app's own five steps (p2p-7). The four steps are withdrawn.

**Proposed:** the strip lights the step in play.
**Francis:** "keep the 14th ruling. strip lights was not my lack of guidance. i meant the whole page was overwhelming but i think my feedback is reducing the noise. keep the strip plain for now, we can talk about adding effects to it after the 5th."
- pw-1 kept (p2p-26). The lit strip is withdrawn; parking lot: effects on the strip.

## Step 5: the GM shows two pieces; what the player sees

1. **The app shows (player):** page 18's PL1, approved 14 November and not built. It draws only the description on the player's card; other shown pieces sit behind "What everyone knows".
2. **Proposed:** each shown piece appears on the player's card as its eye is tapped.

**Francis:** "Yes". ⚑ p2p-24.
**The cut for 5 December** (must, next in line, after). **Francis:** "Yes, that's the right cut". ⚑ p2p-25.

## Step 6: the map

**Proposed:** pick the pack's pictures once at import.
**Francis (corrects):** "when I upload a pack, I also upload the pictures. I'd rather not have to select a folder for each packs pictures. could we not put the pictures and the pack in the same folder by default and the app recognizes to pull the pictures from the folder (with a check to make sure there are none missing?"
Answered: a web app is handed one file and cannot look beside it. A: one bundled file. B: pick the folder (a computer only).
**Francis:** "a". ⚑ p2p-27.

## Step 7: the marching order

**Proposed:** with the lock gone, every player and the GM may rearrange the order at any time (said to him as a change to who may do what).
**Francis:** "Yes". ⚑ p2p-21.
Drag beside: next in line, a must, or after? **Francis:** "after the fifth". mo-3 stands.

## Step 8: the night ends

**Proposed:** a Leave button offered only at a way out; Make camp anywhere; End session in the menu. (Said from the approved drawing's three icon buttons; his live page showed one. **Francis asks:** "What band is this?")
**Francis (corrects):** "Make Camp should be a player choice at any time where a location allows it (not during encounters obviously). Leave is just another way to say 'Move On' so we can use that button to leave the area… End Session stays with the GM." And: "Gm should also be able to 'end expedition' from anywhere - this reflects the reality that sometimes we just want to wrap things up and assume palyers get home safel."
- ⚑ Leaving is Move on (p2p-22). The Leave button is withdrawn.
Make camp: A (the GM taps it) or B (the players' own request)? **Francis:** "b and after the 5th". ⚑ p2p-23.
**Francis asks:** can the harbour's last two Locations move to the next Area? Checked in the pack: yes, each links to that Area's first four Locations.

## Parking lot

- Effects on the strip; the day's guided flow (mc-30).
- The caller proposing a way, and the players' request to make camp.
- Holding one circle to drag it beside another.
- What a shown magic-item piece does to the item in a pack or the stash (today: nothing; the item keeps its plain appearance).

## Roadmap

- A dungeon session, then a wilderness session, each walked the same way.
