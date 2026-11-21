# Tables dry run notes (2026-10-29)

The walk-through of the M6 table builder and viewer. Converted from the design agent's notes: aliases and invented rows only. The approved rulings are at the end; where a spec has absorbed them, the spec wins.

- 1. New table: looks good. Context: prep also means deciding treasure, maybe adding an NPC, and encounter tables often belong to a region rather than a room.
  - Treasure: the treasure-type rolling helper is R2 (roadmap); until then, loot is picked by hand (M6 loot picker).
  - NPCs: adventure NPCs come in M8b; a GM-made NPC outside an adventure pack is worth checking in the M8b design.
  - Region encounter tables: tie to the G-05 design session (hex maps and regions).
  - Access: GM tables easy to reach but not front and centre (the GM ⋯ or a console section), except in a prep mode. Prep mode already exists in M8b (adventure prep); proposal: GM tables, treasure, NPCs and encounter tables all live inside that prep mode, which works for any campaign, not only adventure packs. Check at M8b design.
  - Francis: prep also covers mapping and room design, new item design, trap and treasure design, and planned (non-random) encounter design. "Region" can also mean a group of rooms or areas in a dungeon. → This is bigger than a table builder: a GM prep space ("prep mode for any campaign"). Proposal: fold it into the G-05 design session (hex maps, regions, placing modules), widened to dungeon areas and prep, before M8b's design. Item design already exists (homebrew editor); traps, rooms and planned encounters are new.
- 2. One row per line: should feel natural; needs a real test. Ranges must be settable per row, e.g. 1, 2-4, 5-6. M6-10 already says ranges split evenly and are editable. Add: typing a range at the start of a line ("2-4 Cut the rope bridge") sets it directly, and the app warns (never blocks) on gaps or overlaps.
- 3. Use for: Francis approves all the proposed tags (Reaction, Treasure, Weather, Room dressing, Signs and tracks, Names and NPC traits, Rumours, plus the M6 ones). Some are far more common than others. NEW: keep a running "table of tables", a registry of table uses found in settings and adventures that grows as packs are converted, with a hierarchy so the list collapses.
  - Proposal: dotted use paths (e.g. treasure.trinkets, encounters.lair). Top-level groups shown first and collapsible: Encounters · Fights · Treasure · Places · People · World · Other. Most-used first (by this campaign's tables). The registry lives in the repo (07 or its own file) and the converter playbook adds new uses it meets. A table can have several uses.
- 4. Linking a tactics table: on the monster (as designed). Needs testing once live. Flag for the M6 gate.
- 5. New encounter table: looks good. Taps 4 plus a name.
- 6. Encounter rows with linked monsters: fine for prep (prep can be more detailed). ADD: build a homebrew monster from the row ("New monster…" in Link a monster opens a quick stat block form that saves to the campaign homebrew), and per-row effects and modifiers.
  - What the converted private packs do (a survey of six pack files, about 170 tables and 2,000 rows): most rows carry count dice or a linked stat block; many use composite keys (two dice read as tens and units); some carry notes, tags, nested tables, groups inside a table, several columns, level-by-column matrices, key/value lookups, rumours with a GM-only true/false, or special flags on a row.
  - So the builder covers per row: result text, count dice, link a monster (or make one), link a table (nested), note, tags, GM-only parts, and the Add foes options (Modification, leader, Hidden, Arrives in). Per table: multi-column, groups, composite dice. Matrices and lookups stay pack-only.
- 7. Nested sub-table made in place: looks good.
- 8. Current table: the GM can pull up any table in Explore and in a fight and apply it to the current scene. Places and areas (M8b, G-05) can carry default tables; the GM's choice overrides them. One tap to open "Tables" from both Explore and fight controls.
- 9. Copy vs Edit a pack table: clear.
- 10. Roll tactics in a fight, and the nested encounter in Explore: quick enough.

## Rulings (approved by Francis, 2026-10-29: all 6)
1. Prep space: widen M8b's prep mode into a GM prep space for any campaign; design it in the G-05 session, widened to prep, before M8b's design. Outside prep, GM tables stay one tap away but not front and centre.
2. Row ranges: editable per row; typing a range at the start of a line sets it; gaps and overlaps warn, never block.
3. Table uses: add Reaction, Treasure, Weather, Room dressing, Signs and tracks, Names and NPC traits, Rumours; a growing grouped registry ("table of tables") with dotted paths, collapsible groups, most-used first; the converter adds new uses; several uses per table.
4. Quick builder per row: count, link or create a monster, link a table, note, tags, GM-only parts, Add-foes options. Per table: several columns, groups, tens-and-units dice. Matrices and lookups stay pack-only.
5. Tables apply to the current scene from Explore and the fight controls; places and areas carry default tables; the GM's pick overrides.
6. Tactics tables are linked on the monster; test hands-on at the M6 gate.
