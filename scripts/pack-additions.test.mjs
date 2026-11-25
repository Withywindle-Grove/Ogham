// Tests for the pack checker's checks of the fields ruled 2026-11-01 from the zine-compendium survey
// (scripts/pack-additions.mjs; docs/07, "Format additions from the zine-compendium survey"). Invented packs only.
import { describe, expect, it } from 'vitest';
import { additionCounts, additionNotes, kitDiceFinding } from './pack-additions.mjs';
import { formatNotes } from './pack-format.mjs';

/** An invented overlay that writes every addition the way 07 says. */
const good = () => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'fen-notes', name: 'Fen notes', requires: [{ packId: 'marsh-rules', minVersion: '0.1' }], sources: [{ part: 'issue 1', pages: '3–9', kinds: ['tables'] }] },
  tables: [
    { id: 'rumours', name: 'Rumours', die: 'd6', rows: [{ min: 1, max: 6, result: 'A lantern seen in the reeds', tableId: 'reed-lights' }] },
    { id: 'reed-lights', name: 'Reed lights', die: 'd4', rows: [{ min: 1, max: 4, result: 'Marsh gas' }] },
    { id: 'inn-doings', name: 'Inn doings', die: 'd3', rows: [{ min: 1, max: 3, result: 'A brawl' }] },
  ],
  traitLists: [{ id: 'trades', name: 'Trades', die: 'd4', entries: [
    { id: 'eel-catcher', name: 'Eel catcher', min: 1, max: 4, items: [{ itemId: 'eel-net' }, { itemId: 'torch', qty: '1d6' }, { name: 'A jar of eels', qty: 2 }],
      spells: { add: ['eel-call'], replace: [{ spellId: 'marsh-light', with: 'eel-call' }] } },
  ] }],
  startingKits: [{ id: 'basic', name: 'Basic kit', items: [{ itemId: 'eel-net', qty: 1 }, { itemId: 'torch', qty: '1d6' }] }],
  classes: [{ id: 'reed-singer', name: 'Reed singer', skills: { mode: 'points', pool: [{ level: 1, points: 4 }], cap: 5 },
    spellcasting: { listId: 'reed-songs', castingType: 'arcane', known: { byLevel: [{ level: 1, count: 2 }], usesPerDay: 1, memorise: 'all', listLevel: 0 } },
    progression: [{ level: 1, armourClass: { ac: 9, aac: 10 }, extra: { 'Unarmed damage': '1d4' } }, { level: 2, armourClass: 8 }] }],
  items: [
    { id: 'eel-net', name: 'Eel net' },
    { id: 'bog-dose', name: 'Bog dose', applies: { conditionId: 'bog-sick', save: 'poison', saveMod: 2, onset: '1d4 rounds', noticed: 'A green sheen on the blade' } },
    { id: 'reed-vest', name: 'Reed vest', armourType: 'reed', armour: { ac: 8, aac: 11, type: 'light', tier: 'leather' } },
  ],
  spells: [{ id: 'eel-call', name: 'Eel call', lists: { 'reed-songs': 0 } }],
  conditions: [{ id: 'bog-sick', name: 'Bog-sick', notes: 'Shaking' }, { id: 'bent', name: 'Bent', appliesTo: 'item', notes: '−1 to hit' }],
  statBlocks: [
    { id: 'reed-wraith', name: 'Reed wraith', fields: { AC: '5 [14]' }, variants: [{ name: 'Small', fields: { HD: '2' }, hp: '2d8', hpAverage: 9 }, { name: 'Large', fields: { HD: '6' } }] },
    { id: 'eel-mother', name: 'Eel mother', fields: {}, parts: [{ name: 'Head', hp: 6, count: '1d3+2' }] },
  ],
  locations: [{ id: 'the-reed-inn', name: 'The Reed Inn', type: 'building', parentId: null, playerView: { text: 'Smoke and eel stew.' }, gm: { notes: 'The keeper fences.' }, tables: ['inn-doings'], encounterCheck: { chance: null, tableId: 'inn-doings' } }],
  gmReference: [{ id: 'eels', title: 'Eels', entries: [{ heading: 'Catching', text: 'A net and patience.', tableId: 'inn-doings' }] }],
  rulesSets: [{ id: 'fen-rules', name: 'Fen rules',
    levelZero: { hitDie: '1d4', attack: { attackBonus: -1 }, note: 'Villagers.' },
    materials: [{ id: 'bone', name: 'Bone', costFactor: 0.5, ac: -1, damage: -1, onNatural1: 'break' }, { id: 'steel', name: 'Steel', costFactor: 1 }],
    encumbrance: { mode: 'items', bands: { equipped: [{ max: 3, effect: 'Fast' }, { max: 6, effect: 'Slow' }], packed: [{ max: 10, effect: 'Fast' }] }, strengthAdjust: { note: 'STR shifts the limits.' } } }],
});

describe('the pack format checks (2026-11-01 additions)', () => {
  it('finds nothing wrong with an overlay that writes every addition the way 07 says', () => {
    // rc-3 (2026-11-03): a line by name is allowed and noted, so the pack prefers an item id.
    expect(additionNotes(good())).toEqual([`traitLists: "trades", "eel-catcher", item 3: "A jar of eels" is a one-off by name (no weight or price; it joins the new character's pack at once, covered by the character's approval); give an itemId if the pack has the item.`]);
    // The full checker agrees (the pack has no blurbs or descriptions to complain about beyond these).
    expect(formatNotes(good()).filter((n) => !/description|blurb|notes|one-off by name/.test(n))).toEqual([]);
  });

  it('counts the additions a pack holds', () => {
    expect(additionCounts(good())).toEqual({
      'rows that open a sub-table': 1,
      'trait-list entries with gear': 1,
      'trait-list entries that change spells': 1,
      'gear lines with rolled quantities': 2,
      'classes with spells known': 1,
      'classes with level-scaled features': 1,
      'classes with point-buy skills': 1,
      'items that put on a condition': 1,
      'armour with a tier': 1,
      'damaged-item states': 1,
      'stat blocks with variants': 1,
      'stat blocks with parts': 1,
      'rules sets with level zero': 1,
      'rules sets with materials': 1,
      'rules sets with item-count encumbrance': 1,
    });
  });

  it('says meta.overlays is not a key and that meta.sources uses part, not issue', () => {
    const pack = good();
    pack.meta.overlays = 'marsh-rules';
    pack.meta.sources = [{ issue: 1, pages: '3' }, 'issue 2'];
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/meta.overlays isn't a format key/),
      expect.stringMatching(/meta.sources, entry 1: "issue" is the old key; write part/),
      expect.stringMatching(/meta.sources, entry 2 should be \{ part, pages\?, kinds\? \}/),
    ]));
  });

  it('checks a row that opens a sub-table names a table in the pack and keeps its result', () => {
    const pack = good();
    pack.tables[0].rows[0].tableId = 'nowhere';
    pack.tables[0].rows.push({ min: 7, max: 7, tableId: 'reed-lights' });
    const notes = additionNotes(pack);
    expect(notes).toContain('tables: "rumours", row 1: tableId "nowhere" isn\'t a table in this pack.');
    expect(notes).toContain('tables: "rumours", row 2: a row with tableId keeps its own result text (the sub-table opens from it).');
  });

  it('checks gear lines: an itemId or name, a whole or dice qty, and unknown ids only when no pack is required', () => {
    const pack = good();
    pack.traitLists[0].entries[0].items = [{ qty: 2 }, { itemId: 'ghost', qty: 'lots' }, { itemRef: 'marsh-rules:net' }];
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/"eel-catcher", item 1 needs an itemId or a name/),
      expect.stringMatching(/item 2: qty should be a whole number of 1 or more, or dice like "1d6"/),
      expect.stringMatching(/item 3: itemRef isn't read on a gear line/),
    ]));
    expect(notes.some((n) => /itemId "ghost" isn't an item in this pack/.test(n))).toBe(false);
    delete pack.meta.requires;
    expect(additionNotes(pack).some((n) => /itemId "ghost" isn't an item in this pack/.test(n))).toBe(true);
  });

  // Purpose (G-212, retest 4 T6): meta.sourceTitles is code → the book's title; anything else says what to write.
  it('checks meta.sourceTitles', () => {
    const pack = good();
    pack.meta.sourceTitles = { i1: 'The Fen Almanac, issue 1', '': 'Fen notes' };
    expect(additionNotes(pack).filter((n) => /sourceTitles/.test(n))).toEqual([]);
    pack.meta.sourceTitles = { i1: 4 };
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/meta.sourceTitles "i1" should be the book's title in words/)]));
    pack.meta.sourceTitles = ['i1'];
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/meta.sourceTitles should be \{ "<code>"/)]));
  });

  // Purpose (G-213, retest 4 T9): a trait-list entry's abilities take the classes' shape; uses and spellId are checked,
  // a spell from a required pack is allowed.
  it("checks a trait-list entry's abilities", () => {
    const pack = good();
    pack.traitLists[0].entries[0].abilities = [{ name: 'Still water', note: 'Stand unseen.', uses: { count: 2, per: 'day' }, spellId: 'eel-call' }, { name: 'Patience' }];
    expect(additionNotes(pack).filter((n) => /ability/.test(n))).toEqual([]);
    pack.traitLists[0].entries[0].abilities = [{ note: 'No name.' }, { name: 'Odd', uses: { count: 0 } }, { name: 'Far', spellId: 'elsewhere' }];
    let notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([expect.stringMatching(/ability 1 should be \{ name, note/), expect.stringMatching(/ability 2 \("Odd"\): uses should be/)]));
    expect(notes.some((n) => /spellId "elsewhere"/.test(n))).toBe(false);
    delete pack.meta.requires;
    notes = additionNotes(pack);
    expect(notes.some((n) => /spellId "elsewhere" isn't a spell in this pack/.test(n))).toBe(true);
    pack.traitLists[0].entries[0].abilities = 'lots';
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/abilities should be a list/)]));
  });

  it('checks a trait-list entry\'s spell changes', () => {
    const pack = good();
    pack.traitLists[0].entries[0].spells = { add: ['nope'], replace: [{ spellId: 'marsh-light' }], drop: [] };
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/spells.drop isn't read/),
      expect.stringMatching(/spells.add names "nope", which isn't a spell in this pack/),
      expect.stringMatching(/spells.replace, entry 1 should be \{ spellId/),
    ]));
  });

  // Purpose: an entry's money as dice (rc-2) isn't added by the app (bq3-19 B), so the checker says so and what the
  // player is told; a whole number says nothing.
  it("notes a trait-list entry's money as dice, and not a whole number", () => {
    const pack = good();
    pack.traitLists[0].entries[0].money = '2d6';
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/money as dice \("2d6"\) isn't added by the app: the entry's pop-up says to roll it at the table and the GM adds it/)]));
    pack.traitLists[0].entries[0].money = 50;
    expect(additionNotes(pack).some((n) => /money/.test(n))).toBe(false);
  });

  // Purpose: an entry's spell roll (rc-2, bq3-18) is read now, so the checker no longer says it isn't; it still names a
  // roll of the wrong shape, and a list the pack doesn't have when no required pack could hold it.
  it('reads a trait-list entry\'s spell roll and checks its list', () => {
    const pack = good();
    pack.traitLists[0].entries[0].spells = { roll: { listId: 'reed-songs', level: 0 } };
    expect(additionNotes(pack).filter((n) => /spells/.test(n))).toEqual([]);
    pack.traitLists[0].entries[0].spells = { roll: { listId: 'base-list', level: 0 } };
    expect(additionNotes(pack).filter((n) => /spells/.test(n))).toEqual([]);
    delete pack.meta.requires;
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/spells.roll: listId "base-list" isn't a spell list in this pack/)]));
    pack.traitLists[0].entries[0].spells = { roll: { listId: 'reed-songs', level: -1 } };
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/spells.roll should be \{ listId/)]));
    expect(additionNotes(pack).some((n) => /roll isn't read/.test(n))).toBe(false);
  });

  it('says type "known" is not a type and checks spellcasting.known', () => {
    const pack = good();
    pack.classes[0].spellcasting = { type: 'known', known: { byLevel: [{ level: 1 }], usesPerDay: 0, memorise: 'some', listLevel: 1 } };
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/spellcasting.type "known" isn't a type; write spellcasting.known/),
      expect.stringMatching(/known.byLevel should be a list like/),
      expect.stringMatching(/known.usesPerDay should be a whole number of 1 or more/),
      expect.stringMatching(/known.memorise should be "all" or a whole number/),
    ]));
  });

  // of-6 (G-119): any list level is fine; the checker speaks only when the class's list has no spells there.
  it('takes any listLevel the class list has, and notes one with no spells or one that is not a level', () => {
    const at = (listLevel, spells) => {
      const pack = good();
      pack.classes[0].spellcasting.known.listLevel = listLevel;
      if (spells) pack.spells = spells;
      return additionNotes(pack).filter((n) => /listLevel/.test(n));
    };
    expect(at(0)).toEqual([]);
    expect(at(1, [{ id: 'eel-call', name: 'Eel call', lists: { 'reed-songs': 1 } }])).toEqual([]);
    expect(at(2)).toEqual([`classes: "reed-singer": spellcasting.known.listLevel 2: the class's spell list has no spells at that level in this pack, so creation asks for none.`]);
    expect(at(-1)).toEqual(['classes: "reed-singer": spellcasting.known.listLevel should be a list level: a whole number, 0 (the default) or more.']);
    // The list in another pack (an overlay's base): nothing to say.
    expect(at(3, [])).toEqual([]);
  });

  it('names the old progression columns and checks armourClass, extra and point-buy skills', () => {
    const pack = good();
    pack.classes[0].progression = [{ level: 1, mentalPowers: '3', naturalArmourClass: '6 [13]', armourClass: '9 [10]', extra: 'none' }];
    pack.classes[0].skills = { mode: 'dice', pool: 'four', cap: 0 };
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/level 1: mentalPowers isn't a progression field; write spellcasting.known/),
      expect.stringMatching(/level 1: naturalArmourClass isn't a progression field; write armourClass/),
      expect.stringMatching(/level 1: armourClass should be a whole number or \{ ac, aac \}/),
      expect.stringMatching(/level 1: extra should map a label to a value/),
      expect.stringMatching(/skills.mode "dice" isn't read/),
    ]));
    pack.classes[0].skills = { mode: 'points', pool: 'four', cap: 0 };
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/skills.pool should be a list like/), expect.stringMatching(/skills.cap should be a whole number/)]));
  });

  it("checks a class's skills.notes: a map keyed like names and byLevel, or the older single line", () => {
    // Purpose: a converter that writes skill words the wrong way, or keys one to a skill the class lacks, is told so (G-210, R3-13).
    const pack = good();
    const at = (skills) => {
      pack.classes[0].skills = skills;
      return additionNotes(pack).filter((n) => /skills\.notes/.test(n));
    };
    const base = { names: { snare: 'Set a snare' }, byLevel: [{ level: 1, snare: 2, creep: 1 }] };
    // A map keyed by names and byLevel, with the class-wide note beside it: nothing to say.
    expect(at({ ...base, notes: { snare: 'Catching small game.', creep: 'Moving unheard.' }, note: 'Reed singers learn these young.' })).toEqual([]);
    // The older form, one string: read as the class-wide line, so no note.
    expect(at({ ...base, notes: 'Reed singers learn these young.' })).toEqual([]);
    expect(at({ ...base, notes: { snare: 'Catching small game.', fly: 'Not a skill here.' } })).toEqual([
      `classes: "reed-singer": skills.notes names "fly", not a skill in this class's skills.names or skills.byLevel; the sheet shows no words for it.`,
    ]);
    expect(at({ ...base, notes: { snare: 3 } })).toEqual([`classes: "reed-singer": skills.notes "snare" should be words (what the skill does).`]);
    expect(at({ ...base, notes: ['Catching small game.'] })).toEqual([
      `classes: "reed-singer": skills.notes should map a skill key to its words, like { "snare": "Catching small game." } (the class-wide line is skills.note).`,
    ]);
  });

  it('checks an item that puts on a condition, and an armour tier', () => {
    const pack = good();
    pack.items[1].applies = { conditionId: 'gone', saveMod: 'high', onset: 3 };
    pack.items[2].armour.tier = 'reed';
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/applies.conditionId "gone" isn't a condition in this pack/),
      expect.stringMatching(/applies.save should name the save/),
      expect.stringMatching(/applies.saveMod should be a whole number/),
      expect.stringMatching(/applies.onset should be words/),
      expect.stringMatching(/armour.tier repeats the item's own armourType/),
    ]));
    // The full checker takes tier as an armour key (no "isn't read" line).
    expect(formatNotes(good()).some((n) => /armour.tier isn't read/.test(n))).toBe(false);
  });

  it('checks conditions\' appliesTo and the stat-block variants and parts', () => {
    const pack = good();
    pack.conditions[1].appliesTo = 'weapon';
    pack.statBlocks[0].fields = { Sizes: 'small / large', AC: '5 [14] / 3 [16]' };
    pack.statBlocks[0].variants.push({ fields: 'big' });
    pack.statBlocks[1].fields = { 'Head hp': '6 each' };
    pack.statBlocks[1].parts = [{ name: 'Head', hp: '6', count: 'some' }];
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/appliesTo "weapon" isn't one of character, item/),
      expect.stringMatching(/a "Sizes" field isn't read; write variants/),
      expect.stringMatching(/variant 3 needs a name/),
      expect.stringMatching(/a "Head hp" field isn't read; write parts/),
      expect.stringMatching(/part 1: hp should be a whole number/),
      expect.stringMatching(/part 1: count should be a whole number or dice/),
    ]));
    pack.statBlocks[0].variants.pop();
    expect(additionNotes(pack)).toEqual(expect.arrayContaining([expect.stringMatching(/field "AC" still lists one value per size/)]));
  });

  it('checks locations and top-level panels in a rules pack', () => {
    const pack = good();
    pack.locations.push({ id: 'the-reed-inn', type: 'tavern', parentId: 'nowhere', encounterCheck: { tableId: 'lost' }, tables: ['lost'] });
    pack.locations.push({ id: 'the-cellar', name: 'The cellar', type: 'room', playerView: null });
    pack.gmReference.push({ id: 'p2', title: 'Two', entries: [{ heading: 'A', text: 'B', tableId: 'lost' }] });
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/locations: "the-reed-inn" appears twice/),
      expect.stringMatching(/"the-reed-inn" has no name/),
      expect.stringMatching(/type "tavern" isn't one of region, site, area, floor, room, building/),
      expect.stringMatching(/encounterCheck.tableId "lost" isn't a table in this pack/),
      expect.stringMatching(/tables names "lost", which isn't a table in this pack/),
      expect.stringMatching(/parentId "nowhere" isn't a place in this pack/),
      expect.stringMatching(/gmReference: "p2", "A": tableId isn't a table in this pack/),
    ]));
    expect(notes.some((n) => /the-cellar/.test(n))).toBe(false);
  });

  // Purpose (B18; p2p-31): a Location's "no camp here" mark is `noCamp: true`. A pack that writes it rightly gets no
  // note; one that writes words or a number is told what the app reads; one that marks an Area or a Region is told
  // the mark is that place's alone, since the app reads it only on the Location the party is at.
  it('checks the "no camp here" mark on a location', () => {
    const pack = good();
    pack.locations.push({ id: 'the-wreck', name: 'The Wreck', type: 'area', noCamp: true });
    pack.locations.push({ id: 'the-jetty', name: 'The Jetty', type: 'area', noCamp: false });
    expect(additionNotes(pack).some((n) => /noCamp/.test(n))).toBe(false);
    pack.locations.push({ id: 'the-hulk', name: 'The Hulk', type: 'area', noCamp: 'yes' });
    pack.locations.push({ id: 'the-bar', name: 'The Bar', type: 'site', noCamp: true });
    expect(additionNotes(pack).filter((n) => /noCamp/.test(n))).toEqual([
      'locations: "the-hulk": noCamp should be true or false (true marks "no camp here"; 07 Adventure packs §2).',
      'locations: "the-bar": noCamp marks this place alone, not the Locations in it: mark each Location where there is no camp.',
    ]);
  });

  // Purpose (B10; p2p-22, p2p-31): a Location's "way out" mark is `wayOut: true`. A pack that writes it rightly gets no
  // note; one that writes words is told what the app reads; one that marks an Area or a Region is told the mark is that
  // place's alone, since the app reads it only on the Location the party is at.
  it('checks the "way out" mark on a location', () => {
    const pack = good();
    pack.locations.push({ id: 'the-anchorage', name: 'The Anchorage', type: 'area', wayOut: true });
    pack.locations.push({ id: 'the-jetty', name: 'The Jetty', type: 'area', wayOut: false });
    expect(additionNotes(pack).some((n) => /wayOut/.test(n))).toBe(false);
    pack.locations.push({ id: 'the-hulk', name: 'The Hulk', type: 'area', wayOut: 'yes' });
    pack.locations.push({ id: 'the-bar', name: 'The Bar', type: 'region', wayOut: true });
    expect(additionNotes(pack).filter((n) => /wayOut/.test(n))).toEqual([
      'locations: "the-hulk": wayOut should be true or false (true marks "a way out"; 07 Adventure packs §2).',
      'locations: "the-bar": wayOut marks this place alone, not the Locations in it: mark each Location the party can leave from.',
    ]);
  });

  // Purpose (pf-2, December 5b): a row's statBlockIds may be plain ids (the row's count) or { statBlockId |
  // statBlockRef, count }; an entry with no count where the row has none either is named, as is a broken entry.
  it('checks several creatures on one table row', () => {
    const pack = {
      tables: [{ id: 'harbour-night', name: 'Harbour by night', rows: [
        { min: 1, max: 1, result: 'Lurkers', count: '2d4', statBlockIds: ['bog-lurker', { statBlockRef: 'fen-rules:eel-mother', count: 1 }] },
        { min: 2, max: 2, result: 'A crowd', statBlockIds: [{ statBlockId: 'drowned-acolyte', count: '1' }, 'bog-lurker', { statBlockRef: 'fen-rules:salt-hag' }, { count: 2 }, { statBlockId: 'a', statBlockRef: 'b:a', count: 1 }] },
        { min: 3, max: 3, result: 'Odd', statBlockIds: 'bog-lurker' },
        { min: 4, max: 4, result: 'Bad counts', statBlockIds: [{ statBlockId: 'bog-lurker', count: 0 }, { statBlockId: 'eel-mother', count: 'lots' }, { statBlockId: 'drowned-acolyte', count: '2' }] },
      ] }],
    };
    expect(additionNotes(pack)).toEqual([
      'tables: "harbour-night", row 2, creature 2 ("bog-lurker") has no count, and the row has none either.',
      'tables: "harbour-night", row 2, creature 3 ("fen-rules:salt-hag") has no count, and the row has none either.',
      'tables: "harbour-night", row 2, creature 4 should be a stat block id or { "statBlockId" | "statBlockRef", "count" }.',
      'tables: "harbour-night", row 2, creature 5: give statBlockId (this pack) or statBlockRef (another pack), not both.',
      "tables: \"harbour-night\", row 2: some creatures have a count and 2 don't, so each of those takes the row's count; give each creature its own count.",
      'tables: "harbour-night", row 3: statBlockIds should be a list of stat block ids or { "statBlockId" | "statBlockRef", "count" }.',
      'tables: "harbour-night", row 4, creature 1: count should be dice ("1d4") or a whole number of 1 or more.',
      'tables: "harbour-night", row 4, creature 2: count should be dice ("1d4") or a whole number of 1 or more.',
    ]);
  });

  // Purpose (December step 4, piece a; pt-f1): an adventure's routes written as 07 says, with one amount or a list of
  // ways of moving, raise nothing; a route without its places or with a broken way of moving is named, line by line.
  it('checks an adventure pack\'s routes, both shapes of travel', () => {
    const pack = {
      meta: { name: 'Mire Tower', kind: 'adventure' },
      locations: [{ id: 'mt-jetty', name: 'The jetty' }, { id: 'mt-islet', name: 'The reed islet' }],
      routes: [
        { id: 'mt-jetty-islet', from: 'mt-jetty', to: 'mt-islet', type: 'river', hidden: false, oneWay: false, travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }] },
        { id: 'mt-islet-jetty', from: 'mt-islet', to: 'mt-jetty', hidden: true, oneWay: true, travel: { value: 2, unit: 'hour' } },
      ],
    };
    expect(additionNotes(pack)).toEqual([]);
    pack.routes.push(
      { id: 'mt-jetty-islet', from: 'mt-tower', type: 'tunnel', hidden: 'yes', travel: [{ by: 'row', value: 1.5, unit: 'turn' }, { by: 'row', name: 'Rowing again', value: 1, unit: 'league' }, 'swim'] },
      { id: 'mt-nowhere', from: 'mt-jetty', to: 'mt-islet' },
      { id: 'mt-empty', from: 'mt-jetty', to: 'mt-islet', travel: [] },
    );
    expect(additionNotes(pack)).toEqual([
      'routes: "mt-jetty-islet" appears twice.',
      'routes: "mt-jetty-islet": from "mt-tower" isn\'t a place in this pack.',
      'routes: "mt-jetty-islet" has no to (a place\'s id), so the app can\'t use it.',
      'routes: "mt-jetty-islet": type "tunnel" isn\'t one of path, road, river, door, stairs, secret, other.',
      'routes: "mt-jetty-islet": hidden should be true or false.',
      'routes: "mt-jetty-islet": travel, way 1 has no name, so the app shows its id.',
      'routes: "mt-jetty-islet": travel, way 1: value should be a whole number, 0 or more.',
      'routes: "mt-jetty-islet": travel, way 2: by "row" appears twice; the app keeps the first.',
      'routes: "mt-jetty-islet": travel, way 2: unit should be one of round, turn, hour, day, week.',
      'routes: "mt-jetty-islet": travel, way 3 should be { "by", "name", "value", "unit" }.',
      'routes: "mt-nowhere" has no travel, so moving along it takes no time.',
      'routes: "mt-empty": travel is an empty list; give at least one way of moving.',
    ]);
  });

  // Purpose (dec-7 piece 4a; pf-12): a route's barrier written as pf-12 says raises nothing; a barrier with a broken
  // extra time, approval flag or place, or with no note, is named, line by line. A missing extra time or approval
  // flag is fine (07: they default to 0 and false; review of #755).
  it('checks a route\'s barrier (the obstacle)', () => {
    const route = (barrier) => ({ id: 'mt-jetty-islet', from: 'mt-jetty', to: 'mt-islet', travel: { value: 1, unit: 'turn' }, barrier });
    const pack = (barrier) => ({
      meta: { name: 'Mire Tower', kind: 'adventure' },
      locations: [{ id: 'mt-jetty', name: 'The jetty' }, { id: 'mt-islet', name: 'The reed islet' }, { id: 'mt-weir', name: 'The weir' }],
      routes: [route(barrier)],
    });
    expect(additionNotes(pack({ extraTurns: 2, needsApproval: true, through: 'mt-weir', note: 'The weir takes a boat only at slack water.' }))).toEqual([]);
    expect(additionNotes(pack({ name: 'Slippery stones', extraTurns: 0, needsApproval: false, note: 'Footing is poor.' }))).toEqual([]);
    expect(additionNotes(pack(null))).toEqual([]);
    expect(additionNotes(pack('a wall'))).toEqual(['routes: "mt-jetty-islet": barrier should be { "name"?, "extraTurns"?, "needsApproval"?, "through"?, "note" }.']);
    expect(additionNotes(pack({ extraTurns: 1.5, needsApproval: 'yes', through: 'mt-tower' }))).toEqual([
      'routes: "mt-jetty-islet": barrier: extraTurns should be a whole number, 0 or more; the app leaves the barrier out.',
      'routes: "mt-jetty-islet": barrier: needsApproval should be true or false.',
      'routes: "mt-jetty-islet": barrier: through "mt-tower" isn\'t a place in this pack.',
      'routes: "mt-jetty-islet": barrier has no note, so the GM reads nothing about it.',
    ]);
    expect(additionNotes(pack({ through: 7, note: 'A gap.' }))).toEqual([
      'routes: "mt-jetty-islet": barrier: through should be a place\'s id.',
      'routes: "mt-jetty-islet": barrier has no name and no through, so it shows as "Obstacle" alone.',
    ]);
  });

  // Purpose (pf-12f): a barrier's name is optional; with neither a name nor a place it passes, the checker notes that
  // it will show as "Obstacle" alone (a note, not a fault); a name that isn't words is named.
  it('notes a barrier with no name and no place it passes', () => {
    const pack = (barrier) => ({
      meta: { name: 'Mire Tower', kind: 'adventure' },
      locations: [{ id: 'mt-jetty', name: 'The jetty' }, { id: 'mt-islet', name: 'The reed islet' }],
      routes: [{ id: 'mt-jetty-islet', from: 'mt-jetty', to: 'mt-islet', travel: { value: 1, unit: 'turn' }, barrier }],
    });
    const base = { extraTurns: 1, needsApproval: true, note: 'Reeds choke the channel.' };
    expect(additionNotes(pack({ ...base, name: 'the reed choke' }))).toEqual([]);
    expect(additionNotes(pack({ ...base, through: 'mt-islet' }))).toEqual([]);
    expect(additionNotes(pack(base))).toEqual(['routes: "mt-jetty-islet": barrier has no name and no through, so it shows as "Obstacle" alone.']);
    expect(additionNotes(pack({ ...base, name: 3 }))).toEqual(['routes: "mt-jetty-islet": barrier: name should be words.']);
  });

  // Purpose (p2p-6; B8's Departures, handed to the checker's next holder): an exploration mode whose id starts "app:"
  // is one of the app's own, and the app leaves such a mode out of a rules set. The checker says so in a plain line,
  // whatever the capitals; a mode with any other id gets no such line.
  it('says when a rules set gives an exploration mode one of the app’s own ids', () => {
    const pack = good();
    pack.rulesSets[0].exploration = { modes: [{ id: 'creep', name: 'Creeping' }, { id: 'app:point-to-point', name: 'Hopping' }, { id: 'App:Reed-Road', name: 'Reed road' }] };
    expect(additionNotes(pack).filter((n) => /app:/i.test(n))).toEqual([
      'rulesSets: "fen-rules": exploration mode "app:point-to-point": ids starting "app:" are the app\'s own, so the app leaves this mode out. Give it another id.',
      'rulesSets: "fen-rules": exploration mode "App:Reed-Road": ids starting "app:" are the app\'s own, so the app leaves this mode out. Give it another id.',
    ]);
    pack.rulesSets[0].exploration = { modes: [{ id: 'creep', name: 'Creeping' }, { id: 'mapping', name: 'Mapping' }] };
    expect(additionNotes(pack).some((n) => /the app's own/.test(n))).toBe(false);
  });

  it('checks levelZero, materials and item-count encumbrance on a rules set', () => {
    const pack = good();
    pack.rulesSets[0].levelZero = { hitDie: 'd4ish' };
    pack.rulesSets[0].materials = [{ id: 'bone', name: 'Bone', costFactor: 0, ac: 'worse', onNatural1: 'shatter' }, { id: 'bone', name: 'Bone again', costFactor: 1 }];
    pack.rulesSets[0].encumbrance = { mode: 'items', bands: { equipped: [{ max: 3, effect: 'Fast' }, { max: 2, effect: 'Slow' }], packed: [{ max: 'ten' }] }, strengthAdjust: 'yes' };
    const notes = additionNotes(pack);
    expect(notes).toEqual(expect.arrayContaining([
      expect.stringMatching(/levelZero.hitDie should be dice/),
      expect.stringMatching(/levelZero has no attack/),
      expect.stringMatching(/materials, "bone": costFactor should be a number above 0/),
      expect.stringMatching(/materials, "bone": ac should be a whole number/),
      expect.stringMatching(/onNatural1 "shatter" isn't one of bend, break/),
      expect.stringMatching(/materials, "bone" appears twice/),
      expect.stringMatching(/bands.equipped should go up/),
      expect.stringMatching(/bands.packed should be a list like/),
      expect.stringMatching(/strengthAdjust should be an object/),
    ]));
  });

  it('tells a kit line\'s dice quantity from a real mistake in the editor\'s finding', () => {
    const kit = { items: [{ itemId: 'torch', qty: '1d6' }, { itemId: 'eel-net', qty: 1 }] };
    expect(kitDiceFinding(kit, 'Items, row 1: How many must be a whole number.')).toBe(true);
    expect(kitDiceFinding({ items: [{ itemId: 'torch', qty: 'lots' }] }, 'Items, row 1: How many must be a whole number.')).toBe(false);
    expect(kitDiceFinding(kit, 'Name is required.')).toBe(false);
  });

  // Purpose (creation survey PR 4; cs-6, G-88, G-92): kit lines with ifSize, oneOf and units in the ruled shapes are
  // fine on a kit's own items; dice units or a choice in a roll's row are said (the app gives the default there), as are
  // unknown ids and a kindred's armour substitutes naming items the pack lacks.
  it("reads a kit line's ifSize, oneOf and units, and a kindred's armour substitutes", () => {
    const file = {
      items: [{ id: 'long-bow' }, { id: 'short-bow' }, { id: 'fiddle' }, { id: 'pipe' }, { id: 'candles' }, { id: 'mail' }, { id: 'reed-mail' }],
      startingKits: [
        {
          id: 'kit',
          name: 'Kit',
          items: [{ itemId: 'long-bow', ifSize: { Small: { itemId: 'short-bow' } } }, { itemId: 'fiddle', oneOf: ['fiddle', 'pipe'] }, { itemId: 'candles', units: '1d6' }, { itemId: 'candles', units: 3 }, { itemId: 'candles', units: '3d20' }],
          rolls: [{ name: 'Odds', die: 'd6', rows: [{ min: 1, max: 6, items: [{ itemId: 'candles', units: '1d4' }, { itemId: 'fiddle', oneOf: ['pipe', 'harp'] }] }] }],
        },
      ],
      races: [{ id: 'mire-kin', name: 'Mire-kin', armourSubstitutes: { mail: 'reed-mail', plate: 'bark-plate' } }],
    };
    expect(additionNotes(file)).toEqual([
      // Review of #386: dice with too many results fall back to one bundle, and the checker says so.
      'startingKits: "kit", line 5: units "3d20" has too many results to tap (one to three dice of up to 20 sides, at most 30 results, no + or −); the line gives one bundle.',
      'startingKits: "kit", roll 1, row 1, line 1: units as dice are read on a kit\'s own items only; here the line gives one bundle.',
      'startingKits: "kit", roll 1, row 1, line 2: oneOf names "harp", which isn\'t an item in this pack.',
      'startingKits: "kit", roll 1, row 1, line 2: oneOf is read on a kit\'s own items only; here the line gives its itemId.',
      'races: "mire-kin": armourSubstitutes names "plate", which isn\'t an item in this pack.',
      'races: "mire-kin": armourSubstitutes names "bark-plate", which isn\'t an item in this pack.',
    ]);
  });

  it('never throws on odd input', () => {
    for (const odd of [null, 4, 'pack', [], { meta: 3, tables: 'x', traitLists: [null], classes: [{ progression: 'x', spellcasting: 'x' }], items: [null], statBlocks: [{ variants: 'x', parts: 'x' }], locations: 'x', gmReference: 'x', rulesSets: [{ levelZero: 'x', materials: 'x', encumbrance: { mode: 'items' } }] }]) {
      expect(() => additionNotes(odd)).not.toThrow();
      expect(() => additionCounts(odd)).not.toThrow();
    }
  });
});

describe("a treasure entry's coins and how an odd coin word is read (pf-24, pf-24a; K16a)", () => {
  /** An invented pack with its own coins (herons, bits) and a place whose treasure is given. */
  const withTreasure = (treasure) => ({
    format: 'tabletop-pack',
    formatVersion: 3,
    meta: { id: 'reed-stair', name: 'The Reed Stair', kind: 'setting' },
    rulesSets: [{ id: 'reed-rules', name: 'Reed rules', currency: [{ key: 'heron', label: 'herons', valueInBase: 1 }, { key: 'bit', label: 'bits', valueInBase: 10 }] }],
    locations: [{ id: 'reed-stair', name: 'The Reed Stair', treasure }],
  });
  const treasureNotes = (file) => additionNotes(file).filter((n) => /coins/.test(n));

  // Purpose (B15, p2p-28, p2p-29; b15f-1, b15f-2): a hoard's words, a qty and a magic item (with its noticed) written as
  // 07 says give no note; words for a hoard nothing names, a qty that isn't a whole number of 1 or more, a magic item
  // missing its name or words, and a noticed that isn't text are each named; `count` is no longer read (no alias).
  it('checks hoards, qty and magic items', () => {
    const good = { ...withTreasure([{ text: 'Swords', qty: 4, hoard: 'Strongbox' }, { text: 'Hooded lantern', hoard: 'Strongbox', magicItem: { name: 'Lantern of the Drowned', text: 'Lit, it burns no oil.', noticed: 'Cold to the touch; the glass smells of the sea.', source: 'p. 14' } }]) };
    good.locations[0].hoards = [{ name: 'Strongbox', text: 'Four swords and a hooded lantern.' }];
    const b15 = (file) => additionNotes(file).filter((n) => /hoard|qty|count|magicItem/.test(n));
    expect(b15(good)).toEqual([]);
    const bad = withTreasure([{ text: 'Swords', qty: 0, hoard: 'Strongbox' }, { text: 'Hooded lantern', magicItem: { name: 'Lantern of the Drowned' } }, { text: 'Pale key', magicItem: { name: 'Pale key of reeds', text: 'Opens any reed gate.', noticed: 3 } }]);
    bad.locations[0].hoards = [{ name: 'Sea chest', text: 'Nothing.' }];
    const notes = b15(bad);
    expect(notes.some((n) => /no treasure entry here names the hoard "Sea chest"/.test(n))).toBe(true);
    expect(notes.some((n) => /qty should be a whole number of 1 or more, not 0/.test(n))).toBe(true);
    expect(notes.some((n) => /magicItem should be \{ name, text, noticed\?, source\? \}: text is missing/.test(n))).toBe(true);
    expect(notes.some((n) => /noticed should be text/.test(n))).toBe(true);
    // The old word is not an alias: a count on a treasure entry is neither read nor noted.
    expect(b15(withTreasure([{ text: 'Swords', count: 0 }]))).toEqual([]);
  });

  // Purpose (b15f-2): a magicItem's noticed is the players' to read, so the leak check notes one that draws a
  // conclusion (magic, cursed, +N) or names the item, and says nothing of one that tells only the senses.
  it("runs the leak check on a magic item's noticed", () => {
    const leaky = (noticed) => additionNotes(withTreasure([{ text: 'Hooded lantern', magicItem: { name: 'Lantern of the Drowned', text: 'Lit, it burns no oil.', noticed } }])).filter((n) => /leak/.test(n));
    expect(leaky('Cold to the touch.')).toEqual([]);
    expect(leaky('It feels magical.')).toHaveLength(1);
    expect(leaky('A cursed chill, +2 to something.')).toHaveLength(1);
    expect(leaky('Scratched on the hood: lantern of the drowned.')).toHaveLength(1);
  });

  // Purpose: coins written the way 07 says (the setting's coin keys, whole numbers of 0 or more; coinsReadAs with both
  // its words, beside coins) and a thing's value alone give no note.
  it('says nothing of coins and coinsReadAs written as 07 says', () => {
    const file = withTreasure([
      { text: '40 herons', coins: { heron: 40, bit: 0 }, hoard: 'Under the stair' },
      { text: '200 hn.', coins: { heron: 200 }, coinsReadAs: { printed: 'hn.', note: 'The book prints hn. once; read as herons.' } },
      { text: 'A silver hook', value: { heron: 5 } },
    ]);
    expect(treasureNotes(file)).toEqual([]);
  });

  // Purpose: a coins key that isn't one of the setting's coin ids is named, so the pack can store it under the coin it
  // is read as.
  it("names a coins key that isn't one of the setting's coins", () => {
    expect(treasureNotes(withTreasure([{ text: '9 hx.', coins: { hx: 9 } }]))).toEqual([
      'locations: "reed-stair": treasure 1: coins names "hx", which isn\'t one of this setting\'s coins (heron, bit); store the amount under the coin it is read as and say how in coinsReadAs (pf-24a).',
    ]);
  });

  // Purpose: an amount that isn't a whole number of 0 or more is named (hard rule 8), whatever coin it is under.
  it('names an amount that is not a whole number of 0 or more', () => {
    expect(treasureNotes(withTreasure([{ text: 'Odd coin', coins: { heron: 2.5, bit: -1 } }]))).toEqual([
      'locations: "reed-stair": treasure 1: coins "heron" should be a whole number of 0 or more, not 2.5.',
      'locations: "reed-stair": treasure 1: coins "bit" should be a whole number of 0 or more, not -1.',
    ]);
  });

  // Purpose: a key that isn't one of the setting's coins and whose amount isn't whole gets both notes at once, so a
  // second run finds nothing new once the first is fixed (rv-3 review).
  it('names an unknown key and its odd amount together', () => {
    expect(treasureNotes(withTreasure([{ text: 'Odd hx.', coins: { hx: 1.5 } }]))).toEqual([
      'locations: "reed-stair": treasure 1: coins names "hx", which isn\'t one of this setting\'s coins (heron, bit); store the amount under the coin it is read as and say how in coinsReadAs (pf-24a).',
      'locations: "reed-stair": treasure 1: coins "hx" should be a whole number of 0 or more, not 1.5.',
    ]);
  });

  // Purpose: a coin key written with a stray space is named as that, not as an unknown coin; the app reads keys exactly,
  // so it would not hand that coin out until the space goes (rv-3 review).
  it('names a coins key with a stray space as that', () => {
    expect(treasureNotes(withTreasure([{ text: '4 herons', coins: { ' heron': 4 } }]))).toEqual([
      'locations: "reed-stair": treasure 1: coins key " heron" has spaces around it; write "heron" (the app reads the key exactly).',
    ]);
  });

  // Purpose: coinsReadAs with no coins beside it reads nothing (the amount must be stored under coins), so it is named.
  it('names coinsReadAs without coins', () => {
    expect(treasureNotes(withTreasure([{ text: '200 hn.', coinsReadAs: { printed: 'hn.', note: 'Read as herons.' } }]))).toEqual([
      'locations: "reed-stair": treasure 1: coinsReadAs without coins: store the amount under the coin it is read as, in coins (pf-24a).',
    ]);
  });

  // Purpose: coinsReadAs missing its printed word or its note is named, each once.
  it('names coinsReadAs missing printed or note', () => {
    expect(treasureNotes(withTreasure([{ text: '200 hn.', coins: { heron: 200 }, coinsReadAs: { note: 'Read as herons.' } }, { text: '9 hx.', coins: { heron: 9 }, coinsReadAs: { printed: 'hx.' } }]))).toEqual([
      'locations: "reed-stair": treasure 1: coinsReadAs should be { printed, note }: printed is missing.',
      'locations: "reed-stair": treasure 2: coinsReadAs should be { printed, note }: note is missing.',
    ]);
  });

  // Purpose: a pack with no coins of its own (an adventure, whose coins are its setting's) can't name a key it doesn't
  // know: only the amounts and coinsReadAs are checked there; the keys are checked against a pack that has coins.
  it("checks a coins key only against a pack's own coins", () => {
    const file = withTreasure([{ text: '9 hx.', coins: { hx: 9, heron: 1.5 } }]);
    delete file.rulesSets;
    expect(treasureNotes(file)).toEqual(['locations: "reed-stair": treasure 1: coins "heron" should be a whole number of 0 or more, not 1.5.']);
  });
});
