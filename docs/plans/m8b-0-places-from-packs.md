# Plan: M8b slice 0 — places from packs (pulled forward, 2026-11-06)

Written by the design agent, 2026-11-06. **Scope approved by Francis, 2026-11-06 (option C):** build this slice now; the M5b gate keeps the trek and the ruin, walked with real places from the picker, on fae-woodland alone with its region pack and no fixture; the town (checks 44–52) leaves the M5b gate and is tested once, with real shops, in M8b. The ⚑ list below is still open: the builder starts a pull request only when its ⚑ are answered. Francis asked for it during the M5b gate walk ("the app itself reads the pack's places and offers them in a list… let's build it now"). This file makes no rulings; its ⚑ list goes to Francis one at a time. The builder's read of today's code (asked 2026-11-06) may change "Already built".

## Why now
The gate walk stopped at the trek: Where?, Set place and + Piece are free text, the seed has no places, and the real packs carry hundreds (`locations`, 07 Adventure packs §2) that the importer drops today. Francis wants to judge the Scene as real play looks.

## Already built (the builder's read of main, 2026-11-06; verify first)
- The importer **already keeps `locations`** as library entries of kind `location` ("kept until the prep space reads them"); only the import preview reads them. Routes, NPCs, factions, shops, tracks, timeline and pre-mades are dropped with a warning.
- Where? at Start, Set place and Move… are free text with up to five recent chips, matched by name; Move… always sends no place id. There is no "create place" command: a name becomes a place inside `expedition.start`, `place.set` and `travel.move`.
- Pieces come from `place.addPiece`; safety from `place.setSafety` (`places.safety`); `places.terrain_id` exists but nothing reads or writes it; terrain in play is the group's.
- 07 (Places in play) says dropping pack places into play "is designed with the prep space (before M8b)": this slice does part of that ahead of the prep-space session.
- A gap found on the way: per-region encounter tables never load (the situation's region is never set), so a hit gives the type table only. A picked place knows its region: see ⚑ 7.

## What this slice delivers
1. **Pack `locations` are safe to keep:** proven GM-only (a database test as a player on kind `location`), fixed if they aren't.
2. **A place picker** wherever a place is named today (Where? at Start expedition, Set place, Move…'s place): a button opening a pop-up with a search field, **Recently visited**, the attached packs' places as a tree (region → site → area or floor → room or building, folded), and **Other…** (free text, as today).
3. **Picking a pack's place makes the campaign's place from it:** its name, its terrain (pre-filling Move…'s terrain), its GM notes, and its pieces, all **unshown**: the description (`playerView.text`), exits, people as described, each `contents[]` and `hazards[]` appearance, treasure and clues as GM-side pieces. Nothing reaches players until the eye. Coming back to the place finds the same place.
4. **+ Piece opens a pop-up:** the pack's pieces for this place not yet on the card, then "Type a piece…" (kind and one line, as today), with ✕.

5. **Safety is a question, not a property** (ruled 2026-11-06). Nothing during an expedition needs a safe place.
   - The place card's **Safe or hostile** row goes; the GM's **arrival card** goes (and with it "a split party is back when every group is somewhere Safe"). Hostile goes.
   - **End expedition** ends at once, as today; **the summary's first line asks "In a safe place?"** · **Yes** · **No** (ruled 2026-11-06: A; no extra tap, no pop-up; it comes after any leave-the-dungeon rolls). Unanswered: no downtime offer yet. The log shows the end and a Yes as one line ("… ended the expedition in a safe place"). **Yes:** the summary offers **Start downtime** · **Not yet**, as today (XP and the treasure split hang off this Yes in M7 and M7b). **No:** the expedition ends, no downtime offer. The app doesn't try to know what a settlement is here: the GM answers Not yet in a cleared room. One log line as today; Undo puts the expedition back and forgets the answer.
   - **No gate on towns:** the town screen shows on a place **picked from a pack that marks it a settlement** (the region pack's `settlement`), with the setting's services as today. A typed place has no town screen until the prep space or M8b's shops (a known gap; the town's checks left the M5b gate).
   - `places.safety` stays, unwritten; `place.setSafety` stays registered so old log lines still read (as `place.show` did).
   - **The answer is stored** (ruled 2026-11-06: A): one additive database change (a stored value on the expedition's end; nothing dropped). The log can read "… ended the expedition in a safe place"; the Start downtime offer survives a reload; M7's XP hangs off the recorded Yes.
   - The builder's read: End expedition has **no confirm** today (it ends at once; the summary shows with Undo and Full rest); the only pop-up on that path is the Leave the dungeon dialog. The town side (the town screen, the players' town view, a listed lodging) reads "safety is set" as "this is a settlement" in the app and the database: **left as built** until pull request 2 switches it to "picked from a pack settlement" with its migration. ⋯ Start downtime stays offered as today.

6. **Up and down from the current place** (Francis, 2026-11-06). On the GM's place card, for a place made from a pack: a line **"Part of <parent> ›"** (its parent, up to the hex and the region) and a folded list **"Here · N places"** (its children: a hex's sites, a site's buildings, a building's rooms), each named as in the picker. The picker opens at the current place's level (its siblings and children first). **A tap on a related place moves the party there at once, with an Undo toast** (ruled 2026-11-06: A; moving inside a hex costs no travel points). **No "›" on these lines** (Francis: "I hate the caret arrows, would prefer an icon or image"): up and down carry an icon from 06's set, with the words; the mockup shows them. Pull request 2 or 3.

## Not in this slice (stay M8b)
Shops, stock and prices from packs; NPCs and Introduce; routes and travel time; tracks, rosters and the timeline; maps, images and Handouts; pre-mades; prep mode and the GM prep space (the G-05 session); encounter checks on locations; the hex map; the dungeon model (exits as moves, doors). A place's safe or hostile state stays as built unless ⚑ 2 rules otherwise.

## Rests on
- 05 *Adventures (M8b)*: location browser, two layers, who sees what. 05 *The room's GM layer*, *Places for players* (the pieces model, B1).
- 07 *Adventure packs* §2 `locations`; *Pieces for Show players*.
- 04 *Adventures (M8b)*: campaign state is never written into the pack.
- `docs/plans/m5-11-places.md`, `docs/plans/m5b-g2-place-pieces.md` (and its Departures 1–3: pieces are the GM's alone; players read through `scene_pieces`; shown is per visit).
- 03 and hard rule 5: hidden means hidden, by row-level security.

## Debate (short)
- **A — Builder.** Import locations as library entries; on pick, copy one into the campaign's `places` and `place_pieces` through the existing commands; the picker is a new organism on top.
- **B — Critic.** (1) 05's M8b text says "one open location at a time" with a whole player view; the built model is pieces shown one by one per visit: the slice must follow the built model and 05's M8b lines need a ruling to match. (2) Hundreds of places: a tree three levels deep on a phone needs search first, tree second. (3) Copy-on-pick means a pack update doesn't change places already visited: right for edits, but say so. (4) A GM-only library kind needs its own visibility test as a player; the importer today refuses these parts by name, so the import preview and `pack:check` change too. (5) The G-05 prep session and the dungeon-model session haven't happened: anything about prep, exits as moves or maps would be guessed. Keep them out.
- **Synthesis.** As A, limited to the four deliveries above, following the pieces model; search-first picker; copy on first pick with a link back to the pack's location id (so the picker can mark "visited" and + Piece can offer what's left); 05's M8b lines updated by ruling, not by the builder.

## Build order (three pull requests)
1. **Store and link** (migration, RLS). The stored `location` entries proven GM-only by a database test as a player (and fixed if not); a link column from a campaign place to its pack location; a command that makes or reuses a place from a pack location with its unshown pieces (usable outside an expedition only if ⚑ 8 says so). *Qualifies for Fable (RLS and data).*
2. **The picker.** One `PlacePicker` organism (06 inventory row) used at Start, Set place and Move…; search, Recently visited, the tree, Other…; picking creates or reuses the campaign place with its unshown pieces, through commands, one log line, Undo.
3. **+ Piece as a pop-up.** The offered pieces, "Type a piece…", ✕; the card otherwise unchanged.
4. **Safety as a question** (delivery 5). Independent of 1–3 except its last bullet (the town screen on a pack settlement), which lands after pull request 1's link: **may start now** without that bullet, which joins pull request 2. 10–15 turns.

## The builder's review, folded in (2026-11-06, against main ebb33998)
Corrections to the above: the importer never refused `locations` (the Debate's B4 is wrong); kind `location` is **already GM-only** in the database (left out of `private.player_facing`), so delivery 1 is a test, not a fix; format 3 files import with an "unknown version" warning and read as 1 or 2; `add_place_piece` needs no expedition (only the name functions do); `travel_move` already takes a place id; `place_pieces` already has unused `gm_value`, `gm_trigger`, `gm_stat_line`; there is no general GM notes column (`place_notes`: five headings, 4000 characters each); the GM's device loads every entry of every attached pack (the region pack is 1.9 MB).

Changes of shape for pull request 1:
1. **Names collide.** One place per name per campaign today, and the region pack reuses about a hundred names. A place made from a pack is identified by its link, not its name: the name rule stays for typed places only, and Start and Set place get id-taking forms (⚑ 10).
2. **The link is (the GM's pack id, the pack's entry id),** not a foreign key to the library row (a pack update deletes entries no longer in the file); unique while the place isn't undone.
3. **One request, one log line, one Undo:** a single new function writes the place, its pieces and its notes (the made-by-request pattern); Undo marks them undone, so no deletion ruling is needed. It checks `can` itself.
4. **Field limits:** some GM notes exceed 4000 characters (split across headings or cut with "… see the book, p. N": ⚑ 11); most region places have no player text, so no description piece; only one has a players' name (⚑ 3).
5. **The seed** attaches the region pack for the gate campaign and sets the load method as New campaign does.

Hidden stays hidden, on two conditions the build must keep: **GM-side facts never go in a piece's body** (secrets, a treasure's value and stat lines go to the `gm_*` columns or the notes; a body is shown the moment the eye is tapped), and **the place's name reaches players with its first shown piece** (⚑ 3).

## The mockup (approved by Francis, 2026-11-06)
`docs/design/mockups/places/01-place-picker.html` (picture: `places/png/01-place-picker.png`): the place card for a place picked from a pack ("Players see: …" with Rename for players; "Part of …" and "Here · N places", no "›"), the picker (search, Near here, Recently visited, one folded group per pack with its tree, Other…), search with shared names, the phone's full-screen sheet, the other states (no packs with places, nothing found, loading, offline), and + Piece as a pop-up that stays open while adding. A tap on a place's name picks it at once (toast with Undo); the square button at a row's right only unfolds or folds (plus, minus). Hexes show their map number in the tree. Pull requests 2 and 3 build from it; where it and this plan differ, ask.

## Tests (purpose first)
- A player can't read any pack location, its GM layer or an unshown piece made from it (database tests as a player).
- Picking the same pack place twice gives one campaign place.
- A place made from a pack shows nothing to players until an eye is tapped.
- Updating the pack doesn't change a place the campaign already has.
- The picker with 0 packs' places shows Other… alone; with 900 it searches in under a second and scrolls.
- 375 px: the picker is a full-screen sheet; rows 44 px; long names wrap.

## Scope checks (write one and stop)
Anything in "Not in this slice". Any change to what players see of a place beyond today's pieces.

## ⚑ for Francis (one at a time)
1. ~~Which packs feed the picker~~ **Answered 2026-11-06: A.** Every adventure and region pack attached to the campaign. **Places are sorted by source: one collapsible group per pack** (folded to start), the pack's own tree inside it; search runs across all of them and names the source on each result. **Addendum (Francis):** if players are ever expected to choose locations, it becomes B (only the packs the GM switches on). In this slice the picker is the GM's alone (every place command is GM-only and pack places never reach a player's device), so A holds.
2. ~~Safe or hostile~~ **Answered 2026-11-06 (after C was reconsidered): Safe and Hostile go as a property of a place; safety is one question at End expedition; build it now** (delivery 5, pull request 4). Supersedes ST2, dt-9's arrival card, SC-6b-1 and bq3-1 ("Safe or Hostile makes a settlement").
3. ~~The players' name for a place~~ **Answered 2026-11-06: C.** The pack's name is the default (its `playerView.name` when it has one), with a "Players see: …" line on the card the GM can change before showing anything. (Supersedes "Unknown place until the GM names it" for this slice.)
4. ~~05's "one open location at a time" against the pieces model~~ **Answered 2026-11-06: A.** The pieces model stands: a pack's place arrives as pieces, all hidden, shown one at a time; the older "open a location" wording (2026-10-24) is superseded.
5. ~~A migration during the gate~~ **Answered 2026-11-06: yes.** A link column and, if needed, tighter visibility rules; nothing dropped, renamed or deleted; the test project first, then Francis's push to main after a backup.
7. ~~The region on a picked place~~ **Answered 2026-11-06: A.** In this slice a picked place sets the region, so the region's own encounter tables are offered first after a hit (pull request 1 or 2, the builder's call).
8. ~~Places before play~~ **Answered 2026-11-06: A.** In this slice the picker works only where places are named today (Start expedition, Set place, Move…); browsing or preparing places with no expedition running waits for the prep space.
9. **The order in 07:** it says pack places in play are designed with the prep space, before M8b. This slice goes ahead of that session: confirm.
10. ~~Names~~ **Answered 2026-11-06: A, with name + type.** Places made from a pack are told apart by their link, so two may share a name; typed places keep one per name. A shared name shows its **type in words** after it ("Oath Isle (Hex)", "Oath Isle (Site)"); when name and type still match, the parent follows, **without the map key** (Francis's wording: "The Groaning Loch (Site), in Harrowmoor Keep"; "Fish Market (Building), in Blackeswell"). Only if name, type and parent all match does the map key show. The type's words come from the location's `type` (area with a hex → Hex; site; building; floor; room; region).
12. **Zoom out and drill down** (Francis, 2026-11-06, new): "Oath Isle (Hex) can quickly link to all of the sites within that hex; vice versa, the Ditchway can easily roll up into its town. That navigation should feel seamless, especially within a hex, where the party may move rapidly." In the plan as delivery 6; its one open point (what a tap does) is with Francis.
11. **Long GM notes (technical):** over the 4000-character limit, split across the notes' headings in the pack's order, never cut. OK?
6. **The gate:** the walk resumes on a build with this slice, on fae-woodland with its region pack and no fixture; the walk script is regenerated then. Until then the M5b gate stays open.

## Estimate
**60–85 builder turns** by the builder's review (1: 25–35, Fable; 2: 25–35; 3: 8–12; the design agent's first figure was 40–60), plus one design turn for the picker's mockup (light and dark, phone and tablet) before pull request 2. Uncertain: the importer's present handling of version 3 parts, and how the region pack's size behaves in the library on a phone.

## Departures
(The builder keeps this current in the same pull request.)

**Pull request 1, `m8b-0-places-store` (2026-11-06).**
1. **The link's columns.** `places.pack_id` is a plain uuid, not a foreign key to `packs`: the place outlives the pack (a re-import gets a new pack id; the campaign's place stays as it was). With it `pack_entry_id`, and the pack's `pack_type`, `pack_parent_id` and `pack_key` (for ⚑ 10's names in pull request 2), `players_name` (⚑ 3, C), `region_id` (⚑ 7) and the existing `terrain_id`. One place per (campaign, pack, entry) while not undone; `places_one_per_name` now covers typed places only (an index replaced; no data touched).
2. **Who composes.** The GM's device turns the location into pieces and notes (`placeFromPack.ts`, unit-tested on invented rooms); the database (`make_place_from_pack`) checks the GM, that the pack is attached, that the entry is one of its locations, every limit, and takes the name from the entry itself. Hidden stays hidden: only the GM's device holds the entry, and every row written is GM-only.
3. **⚑ 11 as applied.** The notes (the GM's words, then secrets, creatures and hazards with no appearance, quotes, the encounter check, the hidden mark, the page) fill the headings in their order, Traps first, spilling into the next when a heading is full; never cut; refused with a plain message past the five headings' 20 000 characters (the region pack's longest is 5 200). A general note under "Traps" reads oddly: ⚑ for Francis below.
4. **A typed name beside pack places (⚑ 10).** A typed name finds a typed place first; failing that, the one pack place of that name; two or more pack places of that name: a new typed place. So "Oath Isle" typed with one Oath Isle from the pack is that place; with two, the picker is the way.
5. **The region (⚑ 7).** Stored on the place at the pick: the rules set's `wildEncounters.regionalTables` key whose table the location's `encounterCheck.tableRef` names (every one of the region pack's 12 references matches a key). Setting the situation's `region` from the group's place waits for pull request 2: it lives in the scene's situation builder, beside the other builder's work.
6. **Move… arrives by id.** `travel_move` already took a place id but arrived by name (`group_goes_to`), which with two places of one name landed on a new typed place; it and `pay_owed` now arrive by id when one was given (`group_goes_to_id`; a fix-forward migration grants its execute, as the travel helpers got on 2026-11-03).
7. **Two lines for a new pick.** Pull request 2's picker will call `place.fromPack` (one line, its Undo) and then Start or Where now? by id (its own line, as today): a new place is two lines, a known one is one. Folding them is pull request 2's call (⚑ below).
8. **The seed.** A pack of places with no classes that `requires` a seeded setting (the region pack) is attached on top of that setting's campaigns; the campaign's load method and time lengths are set as New campaign sets them (`loadMethodOf`, `campaignPresets`), which the seed didn't do before.
9. **Not here, by the plan:** the picker, + Piece's pop-up, the town screen on a pack settlement, `sit.region`, and any UI: this pull request has no screen change.

**⚑ raised by pull request 1 (for Francis, through Design):**
- ⚑ 11's first heading: the GM's own notes land under Traps (the first heading). Keep, or start at a chosen heading, or add a sixth "Notes" heading (a column) in pull request 2?
- ~~A new pick being two log lines (Departure 7)~~ Folded by pull request 2 (the plan's rule): one line, one Undo.

**Pull request 2, `m8b-0-places-picker` (2026-11-06).**
1. **One line, one Undo.** Start expedition, Where now? and Move… take the picked pack place (`packEntry`) and make or find it in their own request before their own write: the log has one line ("started an expedition at …", "put the party at …", the move), and Undo marks the place, its notes, its pieces and the move undone together. `place.fromPack` stays for the seed and tests. Pull request 1's Departure 7 is closed.
2. **The picker's data.** The attached packs' places are read as a few fields per entry (`loadPackPlaces`: the pack, the entry's id, name, type, parent, map key, hex, terrain, the settlement mark), never the GM side, once per campaign; the tree renders only what is unfolded and shows 40 rows a level before "Show N more". The pick itself reads that one entry whole (`loadPackPlaceEntry`). The region pack's 885 places come to about 90 KB this way.
3. **Where? at Start** is a button opening the picker (its words replace the field; Clear takes them off), with the mode-picking of a recent place kept (by name, from the places an expedition started at). The typed field and its chips are gone (the mockup: Other… inside the picker). The screen tests type through the picker now (`src/testing/pickPlace.ts`).
4. **Move…** renders the picker as a step inside its own sheet (the same Dialog: focus and Escape stay as they were), with "Back to the move"; a pack place pre-fills the terrain it names. Near here is absent on Move… (the move's sheet doesn't know the group's current place today; a small follow-up).
5. **The card's words.** The heading is the place's words (type, hex number); the meta line is "<pack> · <terrain> · N of M pieces shown". The bottom button reads "Change place" with the pin (the mockup puts it in the head; it stays in the actions row beside Hide all, where "Where now?" was, so the card's layout doesn't move). The Safe or hostile row went with #527 (safety is asked at End expedition), merged in here.
6. **The settlement (delivery 5's last bullet).** `places.settlement` (`{ size, population? }`, from the location's `settlement`, immutable with the link); `scene_town` and `request_rules` key off "marked by the pack, or Safe or Hostile" so every town made before keeps working; the town overview says "Town · 400 people" for a pack settlement. Migration `20261106150000`.
7. **The region (⚑ 7).** The scene reads the first group's current place's region (`loadRegionNow`) into the situation, so `hitPlan` offers the region's own table first; the engine was ready (checks.ts), only the situation was never set.
8. **The seed** is unchanged here (pull request 1 attaches the region pack).
9. **Not here:** + Piece as a pop-up (pull request 3); ⚑ 11's heading (unruled); the mockup's "Near here" on Move…; `WherePicker` (the old field with chips) is removed from the card and Start.

**Scope checks:** none. **⚑ raised by pull request 2:** none new.

**Pull request 4, `m8b-0-safety-at-end` (2026-11-06).** Moved here from its status report (`docs/status/2026-11-06-m8b-0-safety-at-end.md`, section 7: the plan file wasn't on main then), on the #527 look-back, 2026-11-11.
1. "Survives a reload" covers the stored answer and the log, not the summary itself.
2. The folded log line keeps the time it took: "ended the expedition in a safe place after 3 days".
3. The answer's own Verbose line reads "said the party ended in a safe place" or "said the party ended somewhere not safe". This wording is the builder's.
4. The answer is its own Verbose line; the Simple log folds a Yes into End's line (stands as built; listed for Francis). Since `cleanup-lookback-nits` (2026-11-11) the fold goes only into an End that wasn't undone: after End, Undo, End again and Yes, the first End says nothing of safety.
