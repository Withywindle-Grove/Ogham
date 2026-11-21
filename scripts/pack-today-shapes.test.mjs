// Tests for the pack checker's notes on today's shapes (scripts/pack-today-shapes.mjs; after-m5b-gate.md, "pack:check
// learns today's shapes"). Every name and number is made up.
import { describe, expect, it } from 'vitest';
import { formatNotes, USES_PER } from './pack-format.mjs';
import { todayShapeLibraryNotes, todayShapeNotes } from './pack-today-shapes.mjs';

const notesOf = (file, sizes) => todayShapeNotes(file, USES_PER, sizes);

describe('a caster class: duplicates and a choice of spell lists', () => {
  // Purpose: the shapes ruled in a5-3 and a5-6 give no note; a mistyped duplicates or a doubled list does.
  it('accepts duplicates: false and a list of spell list ids, and notes the slips', () => {
    const ok = { classes: [{ id: 'wisp', spellcasting: { listId: ['glow', 'murk'], duplicates: false } }] };
    expect(notesOf(ok)).toEqual([]);
    const bad = { classes: [{ id: 'wisp', spellcasting: { listId: ['glow', 'glow'], duplicates: 'no' } }, { id: 'lone', spellcasting: { listId: ['glow'], duplicates: true } }, { id: 'odd', spellcasting: { listId: [3] } }] };
    expect(notesOf(bad)).toEqual([
      'classes: "wisp": spellcasting.duplicates is true or false (false when the same spell can\'t be prepared twice).',
      'classes: "wisp": spellcasting.listId lists the same spell list twice.',
      'classes: "lone": spellcasting.listId is a list of one; write the id alone (a list is a choice picked at creation).',
      'classes: "odd": spellcasting.listId as a list should hold spell list ids, like ["list-a", "list-b"].',
    ]);
  });
});

describe('a spell: reversed and conjures', () => {
  // Purpose: a reversed form with its own figures, and a conjures row whose statBlockId is a list (a choice), are fine.
  it('accepts reversed { name, range, duration } and conjures with a list as a choice', () => {
    const ok = { spells: [{ id: 'mend', reversed: { name: 'Wither', range: 'Touch', duration: '1 turn' } }, { id: 'call', conjures: [{ statBlockId: ['bog-lurker', 'reed-hound'], count: '1d4', note: 'Obeys, then flees' }, { statBlockId: 'mist-owl', count: 2 }] }] };
    expect(notesOf(ok)).toEqual([]);
  });

  // Purpose: a reversed form with no name, a conjures that is not a list of rows, an empty id list and a count that is
  // neither a figure nor words each get a note.
  it('notes a nameless reversed form and a conjures row with no creature or a bad count', () => {
    const bad = { spells: [{ id: 'mend', reversed: { range: 'Touch' } }, { id: 'call', conjures: [{ statBlockId: [], count: 0 }, { note: 'x' }] }, { id: 'swarm', conjures: 'bog-lurker' }] };
    expect(notesOf(bad)).toEqual([
      'spells: "mend": reversed needs a name.',
      'spells: "call", conjures 1: statBlockId should be a stat block id, or a list of them (the caster picks one at casting).',
      'spells: "call", conjures 1: count should be a whole number, dice ("1d4") or a formula in the caster\'s level.',
      'spells: "call", conjures 2: statBlockId should be a stat block id, or a list of them (the caster picks one at casting).',
      'spells: "swarm": conjures should be a list like [{ statBlockId, count?, note? }].',
    ]);
  });

  // Purpose: only the stack can say a conjured creature is missing; one file alone stays quiet, the stack names it.
  it('says a conjured stat block is missing only when the packs are checked together', () => {
    const a = { name: 'A', id: 'a', file: { spells: [{ id: 'call', conjures: [{ statBlockId: 'bog-lurker' }, { statBlockId: 'ghost-crab' }] }] } };
    const b = { name: 'B', id: 'b', file: { statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker' }] } };
    expect(notesOf(a.file)).toEqual([]);
    expect(todayShapeLibraryNotes([a, b], USES_PER)).toEqual(['A: spells: "call": conjures names stat block "ghost-crab", which none of these packs has.']);
  });
});

describe('stat blocks: casterLevel variants, turnAs and a drain', () => {
  // Purpose: variants picked by the caster's level are fine, an open-ended top range included; overlaps and bad
  // numbers are noted; a variant without a casterLevel next to ones with it is noted once.
  it('checks casterLevel ranges', () => {
    const ok = { statBlocks: [{ id: 'steed', variants: [{ name: 'Young', casterLevel: { min: 1, max: 4 } }, { name: 'Grown', casterLevel: { min: 5 } }] }] };
    expect(notesOf(ok)).toEqual([]);
    const bad = { statBlocks: [{ id: 'steed', variants: [{ name: 'Young', casterLevel: { min: 1, max: 5 } }, { name: 'Grown', casterLevel: { min: 5 } }, { name: 'Odd', casterLevel: { min: 0 } }, { name: 'Plain' }] }] };
    expect(notesOf(bad)).toEqual([
      'statBlocks: "steed", variant "Odd": casterLevel should be { min: <whole number, 1 or more>, max?: <whole number, not under min> }.',
      'statBlocks: "steed", variant "Young" and statBlocks: "steed", variant "Grown": their casterLevel ranges overlap; one level would pick two variants.',
      'statBlocks: "steed": only some variants have a casterLevel; the others are never picked by level.',
    ]);
  });

  // Purpose: a drain's own levelLoss.xp is midpoint or minimum wherever a stat block or an item carries it.
  it("checks a drain's levelLoss.xp on a stat block ability and on an item", () => {
    const file = { statBlocks: [{ id: 'wraith', abilities: [{ name: 'Drain', levelLoss: { xp: 'minimum' } }, { name: 'Sap', levelLoss: { xp: 'half' } }], turnAs: 7 }], items: [{ id: 'ring', levelLoss: { xp: 'midpoint' } }, { id: 'cup', levelLoss: 'minimum' }] };
    expect(notesOf(file)).toEqual([
      'statBlocks: "wraith".abilities[2]: levelLoss.xp "half" isn\'t one of midpoint, minimum.',
      'items: "cup": levelLoss should be { xp: "midpoint" | "minimum" }.',
      'statBlocks: "wraith": turnAs should be the name of the turning table\'s column.',
    ]);
  });
});

describe('a turning ability and uses.per', () => {
  // Purpose: a turning block with outcome words and a per-turn limit is fine; a missing outcomes list, an unknown key
  // and an unknown per are noted.
  it('checks the turning block of a class ability', () => {
    const ok = { classes: [{ id: 'warden', abilities: [{ name: 'Turn', turningTableId: 'turning', turning: { outcomes: ['turned', 'banished'], uses: { count: 3, per: 'turn' }, note: 'Special case' } }] }] };
    expect(notesOf(ok)).toEqual([]);
    const bad = { classes: [{ id: 'warden', abilities: [{ name: 'Turn', turning: { uses: { count: 3, per: 'moon' }, extra: 1 } }] }] };
    expect(notesOf(bad)).toEqual([
      'classes: "warden", ability "Turn": turning.outcomes should be a list of words for the log\'s chips, like ["turned", "destroyed"].',
      'classes: "warden", ability "Turn": turning.uses.per "moon" isn\'t one of day, rest, fight, week, turn, year, ever.',
      'classes: "warden", ability "Turn": turning.extra isn\'t a field the format reads (outcomes, uses, note).',
    ]);
  });

  // Purpose: uses.per of turn, year and ever (mp-13, mp-16) are accepted by the format check; an unknown one is not.
  it('accepts uses.per of turn, year and ever', () => {
    const ability = (per) => ({ classes: [{ id: 'k', abilities: [{ name: 'A', uses: { count: 1, per } }] }] });
    for (const per of ['turn', 'year', 'ever']) expect(formatNotes(ability(per))).toEqual([]);
    expect(formatNotes(ability('moon'))).toHaveLength(1);
  });
});

describe('items, the content note and places', () => {
  const rules = { rulesSets: [{ id: 'r', settlement: { availability: { bySize: [{ size: 'hamlet', chance: '2-in-6' }, { size: 'city', chance: 'always' }] } } }] };

  // Purpose: an item's availability in the setting's own size names, with "x-in-6" or "always" for chance, is fine.
  it('accepts availability that uses the setting\'s sizes and notes the rest', () => {
    const file = { ...rules, items: [{ id: 'a', availability: { where: ['city'], chance: '3-in-6', rarity: 'rare' } }, { id: 'b', availability: { where: ['village'], chance: 'often' } }, { id: 'c', availability: 'city' }] };
    expect(notesOf(file)).toEqual([
      'items: "b": availability.where names "village", which isn\'t a size of the setting\'s settlement.availability.bySize (hamlet, city).',
      'items: "b": availability.chance should be "x-in-6" (any number in any number) or "always".',
      'items: "c": availability should be { where?: [settlement sizes], chance?: "x-in-6" | "always", rarity?, note? }.',
    ]);
  });

  // Purpose: the content note is words and short; a long one (three lines) gets a note.
  it('notes a content note that is not words or runs past two lines', () => {
    expect(notesOf({ meta: { contentNote: 'One line.' } })).toEqual([]);
    expect(notesOf({ meta: { contentNote: 3 } })).toEqual(['meta.contentNote should be one or two lines of words.']);
    expect(notesOf({ meta: { contentNote: 'a\nb\nc' } })).toHaveLength(1);
  });

  // Purpose: a place's settlement needs a size from the setting's list and a whole population; a size in another pack
  // is only checked once the stack is.
  it("checks a place's settlement.size against the sizes, alone and across the stack", () => {
    const place = (size, population) => ({ locations: [{ id: 'mere', name: 'Mere', settlement: { size, population } }] });
    expect(notesOf({ ...rules, ...place('hamlet', 120) })).toEqual([]);
    expect(notesOf({ ...rules, ...place('town', 1.5) })).toEqual([
      'locations: "mere": settlement.size "town" isn\'t a size of the setting\'s settlement.availability.bySize (hamlet, city).',
      'locations: "mere": settlement.population should be a whole number.',
    ]);
    expect(notesOf(place('town', 5))).toEqual([]);
    const together = todayShapeLibraryNotes([{ name: 'Setting', id: 's', file: rules }, { name: 'Region', id: 'r', file: place('town', 5) }], USES_PER);
    expect(together).toEqual(['locations: "mere": settlement.size "town" isn\'t a size of the setting\'s settlement.availability.bySize (hamlet, city).']);
  });

  // Purpose: a tableRef is "<pack>:<table>", never with a tableId, names a required pack, and the stack finds the table.
  it("checks an encounter check's tableRef, alone and across the stack", () => {
    const region = (check, requires = [{ packId: 'fen-rules' }]) => ({ meta: { id: 'fen-region', requires }, locations: [{ id: 'mere', name: 'Mere', encounterCheck: check }] });
    expect(notesOf(region({ tableRef: 'fen-rules:wander' }))).toEqual([]);
    expect(notesOf(region({ tableRef: 'fen-rules:wander', tableId: 'own' }))).toEqual(['locations: "mere": encounterCheck.tableRef: the check has tableId as well; use one or the other, never both.']);
    expect(notesOf(region({ tableRef: 'wander' }))).toEqual(['locations: "mere": encounterCheck.tableRef should be "<meta.id>:<table id>".']);
    expect(notesOf(region({ tableRef: 'fen-rules:wander' }, []))).toEqual(['locations: "mere": encounterCheck.tableRef names pack "fen-rules", which isn\'t in meta.requires.']);
    const rulesPack = { name: 'Fen rules', id: 'fen-rules', file: { meta: { id: 'fen-rules' }, tables: [{ id: 'wander' }] } };
    const regionPack = (ref) => ({ name: 'Fen region', id: 'fen-region', file: region({ tableRef: ref }) });
    expect(todayShapeLibraryNotes([rulesPack, regionPack('fen-rules:wander')], USES_PER)).toEqual([]);
    expect(todayShapeLibraryNotes([rulesPack, regionPack('fen-rules:gone')], USES_PER)).toEqual(['Fen region: locations: "mere": encounterCheck.tableRef names table "gone", which pack "fen-rules" doesn\'t have.']);
    expect(todayShapeLibraryNotes([regionPack('fen-rules:wander'), { name: 'Other', id: 'other', file: {} }], USES_PER)).toEqual(['Fen region: locations: "mere": encounterCheck.tableRef names pack "fen-rules", which isn\'t among the files checked together.']);
  });
});
