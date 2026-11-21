// Tests for the pack checker's G-07 exploration checks and the fields ruled 2026-10-29 (scripts/pack-exploration.mjs,
// scripts/pack-format.mjs; docs/07, "Exploration" and "Characters, XP and spells"), on an invented pack
// (scripts/fixtures/g07-format.fixture.json) and invented snippets. Every name and number here is made up.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCounts, formatNotes } from './pack-format.mjs';
import { ICONS } from './pack-exploration.mjs';
import { optionGateNotes } from './pack-option-gates.mjs';

const fixture = 'scripts/fixtures/g07-format.fixture.json';
const sample = () => JSON.parse(readFileSync(fixture, 'utf8'));

/** A one-rules-set pack around the given exploration modes (and any extra rules-set fields). */
const withModes = (modes, extra = {}) => ({ rulesSets: [{ id: 'r', exploration: { modes }, ...extra }] });

describe('the G-07 exploration checks', () => {
  it('finds nothing to say about a pack that writes every ruled shape the way 07 says, aliases included', () => {
    // The fixture uses notes on a check and summary on a class: both aliases are read without a line.
    expect(formatNotes(sample())).toEqual([]);
  });

  it('counts exploration modes, activities and dungeon exits', () => {
    expect(formatCounts(sample())).toMatchObject({ 'exploration modes': 2, 'exploration activities': 4, 'rules sets with dungeonExit': 1 });
  });

  it('warns about an icon that is not on the closed list, and accepts every listed one', () => {
    const steps = [...ICONS, 'lantern-moth'].map((icon, i) => ({ id: `s${i}`, name: 'Step', icon, kind: 'note' }));
    const notes = formatNotes(withModes([{ id: 'creep', procedure: steps }]));
    expect(notes).toEqual([
      'rulesSets: "r", mode "creep", step "s19": icon "lantern-moth" isn\'t on the symbol list (time, light, listen, door, search, rest, camp, travel, weather, encounter, star, note, watch, describe, course, lost, monster, forage, hunt); it would show a plain dot.',
    ]);
  });

  it('accepts modifiers keyed to the party on checks and activities, and names a party modifier written wrong (ex-2, ga-3)', () => {
    const good = [
      { ifPartyHas: { class: 'reed-witch' }, chance: { on: [1] }, onlyOnTerrain: ['reedbed'] },
      { who: 'self', ifClass: 'mire-stalker', chance: { on: [1] } },
      { ifPartyHas: { skill: 'wade' }, add: -1 },
    ];
    const bad = [{ ifPartyHas: 'reed-witch', add: 1 }, { who: 'all', ifClass: 'mire-stalker', add: 1 }, { ifClass: 'mire-stalker' }, { ifPartyHas: { class: 'x' }, chance: { on: [] }, onlyOnTerrain: 'bog' }];
    const mode = (modifiers) => [{ id: 'trek', checks: [{ id: 'astray', chance: { die: 'd6', on: [1] }, modifiers }], activities: [{ id: 'cut', name: 'Cut', modifiers }] }];
    expect(formatNotes(withModes(mode(good)))).toEqual([]);
    const notes = formatNotes(withModes(mode(bad)));
    for (const words of ['ifPartyHas should be', 'who should be "self"', 'adds (a whole number) or sets the chance', 'chance should be { "on": [faces] }', 'onlyOnTerrain should be a list']) {
      expect(notes.filter((n) => n.includes(words)).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("accepts an activity's skill or list of skills, and names one written wrong (ex-3)", () => {
    // Purpose: `chance.skill: ["hark", "EAR"]` is a ruled shape, so pack:check stays quiet; an empty list or a number isn't.
    const mode = (skill) => [{ id: 'trek', activities: [{ id: 'hark', name: 'Hark', chance: { skill } }] }];
    expect(formatNotes(withModes(mode('hark')))).toEqual([]);
    expect(formatNotes(withModes(mode(['hark', 'EAR'])))).toEqual([]);
    for (const bad of [[], ['hark', 3], 7]) expect(formatNotes(withModes(mode(bad))).some((n) => n.includes('chance.skill names a skill'))).toBe(true);
  });

  it('knows the 19 symbols ruled on 2026-10-29, the seven new ones included', () => {
    expect(ICONS).toHaveLength(19);
    expect(ICONS).toEqual(expect.arrayContaining(['watch', 'describe', 'course', 'lost', 'monster', 'forage', 'hunt']));
  });

  it('names the new shape for each old exploration shape the ruling replaced', () => {
    const notes = formatNotes(withModes([
      { id: 'creep', camp: { procedure: 'roam' },
        procedure: [{ id: 'sky', name: 'Sky', kind: 'roll', tableId: 'byseason' }],
        checks: [{ id: 'c', onHit: { tableId: 'x', column: 'road|wild' } }],
        movement: { kind: 'budget', terrainCostPer: { value: 4, unit: 'mile' }, hexSize: { value: 4, unit: 'mile' } },
        activities: [{ id: 'a', cost: { budget: 'terrain.searchCost' }, requires: { classSkill: 'hear' }, requiresItem: 'a long pole',
          modifiers: [{ ifFullDay: true, add: 1 }], onSuccessTableId: 't', onSuccessTableByTerrain: {}, seasonResult: {}, specialSeasons: {} }] },
      { id: 'roam', camp: { procedure: [] } },
    ], { weather: { option: 'fen-weather' }, specialSeasons: [{ id: 'mist', encounterSwaps: [] }] }));
    const expected = [
      /tableId "byseason" is the old way; write tableBySeason/,
      /onHit.column is the old way: it's read as columns split on "\|"; write onHit.columns/,
      /terrainCostPer is the old name; write costPer/,
      /hexSize is the old way; write costPer/,
      /camp.procedure "roam" is the old way to reuse a camp; write camp: \{ sameAs: "roam" \}/,
      /cost.budget "terrain.searchCost" is the old way; write cost: \{ fromTerrain: "searchCost" \}/,
      /requires.classSkill is the old name; write requires.skill/,
      /requiresItem is the old way; write requires: \{ item/,
      /ifFullDay is the old way; write \{ "when": "fullDay"/,
      /onSuccessTableId is the old name; write tableId/,
      /onSuccessTableByTerrain is the old name; write tableByTerrain/,
      /seasonResult is the old name; write bySeason/,
      /specialSeasons is the old name; write bySpecialSeason/,
      /weather: option is the old name; write onlyWithOption: "fen-weather"/,
      /encounterSwaps is the old name; write encounterSwap/,
    ];
    for (const pattern of expected) expect(notes.some((n) => pattern.test(n)), String(pattern)).toBe(true);
  });

  it('reads onlyIn as modes, and says when a pack still lists terrains there', () => {
    const notes = formatNotes(withModes([
      { id: 'roam', terrain: [{ id: 'marsh', cost: 2 }], activities: [{ id: 'a', onlyIn: ['marsh', 'roam', 'sky'] }] },
    ]));
    expect(notes).toEqual([
      'rulesSets: "r", mode "roam", activity "a": onlyIn lists terrains (marsh); onlyIn means modes now, so write onlyOnTerrain: ["marsh"].',
      'rulesSets: "r", mode "roam", activity "a": onlyIn names "sky", which isn\'t a mode.',
    ]);
  });

  it('checks terrain classes, inline terrain numbers and mounts', () => {
    const notes = formatNotes(withModes([{ id: 'roam',
      terrainClasses: [{ id: 'bog', cost: 3, mounts: 'swim' }],
      terrain: [{ id: 'a', class: 'bog' }, { id: 'b', class: 'heath' }, { id: 'c' }, { id: 'd', cost: 1 }] }]));
    expect(notes).toEqual([
      'rulesSets: "r", mode "roam", terrain class "bog": mounts "swim" isn\'t one of ride, lead, none.',
      'rulesSets: "r", mode "roam", terrain "b": class "heath" isn\'t one of this mode\'s terrainClasses.',
      'rulesSets: "r", mode "roam", terrain "c": names no class and gives no cost; give one or the other.',
    ]);
  });

  it('checks camp.sameAs, onlyWithOption and onHit shapes', () => {
    const pack = withModes([
      { id: 'creep', camp: { sameAs: 'roam' }, checks: [{ id: 'c', onlyWithOption: 'nope', onHit: { tableId: 't', tableChoices: ['u'], regionTables: 'yes' } }] },
      { id: 'roam' },
    ]);
    pack.options = [{ id: 'fen-weather' }];
    const notes = formatNotes(pack);
    expect(notes).toEqual([
      'rulesSets: "r", mode "creep", check "c": onlyWithOption names "nope", which isn\'t an option in this pack (fine if another attached pack has it).',
      'rulesSets: "r", mode "creep", check "c": onHit has both tableId and tableChoices; give one.',
      'rulesSets: "r", mode "creep", check "c": onHit.regionTables is true or left out.',
      'rulesSets: "r", mode "creep": camp.sameAs names "roam", which has no camp.',
    ]);
  });

  it('says when an object has both note and notes', () => {
    expect(formatNotes(withModes([{ id: 'creep', note: 'A', notes: 'B' }]))).toEqual([
      'rulesSets: "r", mode "creep": has both note and notes; note is read, notes can go.',
    ]);
  });

  it('checks the rules-set sections: turnsPerHour, weather, daylight, wildEncounters', () => {
    const notes = formatNotes({ rulesSets: [{ id: 'r', time: { turnsPerHour: 1.5 }, weather: { rollEvery: 2 },
      daylight: { byMonth: [{ month: 'Reedmonth', sunrise: '6am', sunset: '19:45' }] },
      wildEncounters: { typeTableId: 't', lairChance: 'often', moonTable: 'x' } }] });
    expect(notes).toEqual([
      'rulesSets: "r": time.turnsPerHour should be a whole number of 1 or more.',
      'rulesSets: "r" weather: rollEvery should be { value: <number>, unit: "day" }.',
      'rulesSets: "r": daylight.byMonth should be a list like [{ "month": "<name>", "sunrise": "06:30", "sunset": "19:45" }].',
      'rulesSets: "r": wildEncounters.moonTable isn\'t a field 07 knows; it\'s kept but not read.',
      'rulesSets: "r": wildEncounters.lairChance should be a number.',
    ]);
  });

  it('checks dungeonExit', () => {
    const notes = formatNotes({ rulesSets: [{ id: 'r', dungeonExit: { roll: { save: 'breath', check: 'climb' }, modifiers: [{ id: 'map', value: 2 }], depth: { per: 0, value: -1 } } }] });
    expect(notes).toEqual([
      'rulesSets: "r": dungeonExit.roll should be { save: "<save id>" } or { check: "<check id>" } (one of them).',
      'rulesSets: "r": dungeonExit.modifiers should be a list like [{ "id": "map", "name": "Has a map", "value": 2 }].',
      'rulesSets: "r": dungeonExit.depth should be { per: <levels>, value: <number added per that many levels> }.',
      'rulesSets: "r": dungeonExit.onFail should be { table: "<table id>" }.',
    ]);
  });

  // of-5 (G-104): a rule without a roll offers Use safe paths only, so it needs the note and asks no onFail.
  it('accepts a dungeonExit with no roll when it gives safePaths, and says so when it gives neither', () => {
    expect(formatNotes({ rulesSets: [{ id: 'r', dungeonExit: { safePaths: 'Follow the chalk marks back.' } }] })).toEqual([]);
    expect(formatNotes({ rulesSets: [{ id: 'r', dungeonExit: { roll: null, safePaths: 'Follow the chalk marks back.' } }] })).toEqual([]);
    expect(formatNotes({ rulesSets: [{ id: 'r', dungeonExit: {} }] })).toEqual([
      'rulesSets: "r": dungeonExit has no roll, so it offers only Use safe paths; give it safePaths (the pack\'s note on using them), or a roll.',
    ]);
  });

  it('leaves hexGrid, regions and the reference-only sections alone', () => {
    const pack = { regions: [{ id: 'low-fen' }], rulesSets: [{ id: 'r', hexGrid: { size: 6 }, hunger: {}, hazards: {}, lost: {}, defaultSpeed: 120 }] };
    expect(formatNotes(pack)).toEqual([]);
  });
});

describe('the armour block on items (ruled 2026-10-29)', () => {
  it('accepts a plain whole number as the base, and every ruled key in a block', () => {
    const notes = formatNotes({
      rulesSets: [{ id: 'r', attack: { style: 'descending', shieldBonus: 1 } }],
      items: [
        { id: 'bog-iron-coat', name: 'Bog-iron coat', armour: 4 },
        { id: 'reed-mail', name: 'Reed mail', armour: { base: 6, ac: 6, aac: 13, type: 'medium', magicBonus: 1 } },
        { id: 'reed-buckler', name: 'Reed buckler', armour: { acBonus: 1 } },
      ],
    });
    expect(notes).toEqual([]);
  });

  it('warns about unknown keys, naming the new key for the old direction names, and about numbers that are not whole', () => {
    const notes = formatNotes({
      items: [
        { id: 'a', name: 'A', armour: { ascending: 13, descending: 6, weightless: true } },
        { id: 'b', name: 'B', armour: { base: 4.5, acBonus: '1', type: 'thick' } },
        { id: 'c', name: 'C', armour: 'six' },
        { id: 'd', name: 'D', armour: 2.5 },
      ],
    });
    expect(notes).toEqual([
      'items: "a": armour.ascending isn\'t read (write aac); the block takes base, ac, aac, acBonus, type, magicBonus, baseArmour, tier.',
      'items: "a": armour.descending isn\'t read (write ac); the block takes base, ac, aac, acBonus, type, magicBonus, baseArmour, tier.',
      'items: "a": armour.weightless isn\'t read; the block takes base, ac, aac, acBonus, type, magicBonus, baseArmour, tier.',
      'items: "b": armour.base should be a whole number.',
      'items: "b": armour.acBonus should be a whole number.',
      'items: "b": armour.type "thick" isn\'t one of light, medium, heavy.',
      'items: "c": armour should be a whole number (the base AC) or a block { base, ac, aac, acBonus, type, magicBonus, baseArmour, tier }.',
      'items: "d": armour should be a whole number (the base AC) or a block { base, ac, aac, acBonus, type, magicBonus, baseArmour, tier }.',
    ]);
  });

  it('checks the rules set\'s shield bonus and AC style, and counts items with an armour block', () => {
    const file = { rulesSets: [{ id: 'r', attack: { style: 'sideways', shieldBonus: 0.5 } }], items: [{ id: 'a', name: 'A', armour: 3 }, { id: 'b', name: 'B' }] };
    expect(formatNotes(file)).toEqual([
      'rulesSets: "r": attack.shieldBonus should be a whole number.',
      'rulesSets: "r": attack.style "sideways" isn\'t ascending or descending.',
    ]);
    expect(formatCounts(file)).toMatchObject({ 'items with an armour block': 1 });
  });
});

// C3's follow-up (ruled 2026-11-01): attack.damageScore names the score whose modifier adds to weapon damage.
describe('attack.damageScore', () => {
  it('accepts a key the rules set lists as an ability, or any key when it lists none', () => {
    expect(formatNotes({ rulesSets: [{ id: 'r', abilities: [{ key: 'MUS', name: 'Muscle' }, { key: 'NIM', name: 'Nimbleness' }], attack: { damageScore: 'MUS' } }] })).toEqual([]);
    expect(formatNotes({ rulesSets: [{ id: 'r', attack: { damageScore: 'MUS' } }] })).toEqual([]);
  });

  it('warns when it is not a key, or names an ability the rules set does not list', () => {
    expect(formatNotes({ rulesSets: [{ id: 'r', attack: { damageScore: 2 } }] })).toEqual([`rulesSets: "r": attack.damageScore should be an ability's key, like "MUS".`]);
    expect(formatNotes({ rulesSets: [{ id: 'r', abilities: [{ key: 'MUS', name: 'Muscle' }, { key: 'NIM', name: 'Nimbleness' }], attack: { damageScore: 'GRT' } }] })).toEqual([
      `rulesSets: "r": attack.damageScore "GRT" isn't one of the rules set's abilities (MUS, NIM).`,
    ]);
  });
});

describe('the engine rulings of 2026-10-29 in the checker', () => {
  const wander = (extra) => ({ id: 'bog-wander', name: 'Bog lurkers', byTerrain: true, onHit: { tableId: 'lurkers' }, ...extra });
  const mode = (checks, icon = 'monster', more = {}) => ({ id: 'wade', procedure: [{ id: 'w', name: 'Lurkers', icon, kind: 'check', checkId: 'bog-wander' }], checks, ...more });
  const at = 'rulesSets: "r", mode "wade", check "bog-wander"';

  it('accepts a byTerrain check that names its terrainChance, and counts it', () => {
    const file = withModes([mode([wander({ terrainChance: 'lostChance' })], 'lost')]);
    expect(formatNotes(file)).toEqual([]);
    expect(formatCounts(file)).toMatchObject({ 'byTerrain checks naming terrainChance': 1 });
  });

  it('warns when the symbol fallback would be used, naming the chance it would guess', () => {
    expect(formatNotes(withModes([mode([wander({})], 'lost')]))).toEqual([
      `${at}: byTerrain with no terrainChance; the app falls back to guessing lostChance from the step's symbol. Write terrainChance: "lostChance" or "wanderChance".`,
    ]);
    expect(formatNotes(withModes([mode([wander({})], 'travel')]))[0]).toMatch(/guessing wanderChance/);
  });

  it('checks terrainChance values, and that it goes with byTerrain', () => {
    expect(formatNotes(withModes([mode([wander({ terrainChance: 'mireChance' })])]))).toEqual([`${at}: terrainChance "mireChance" isn't one of lostChance, wanderChance.`]);
    expect(formatNotes(withModes([mode([wander({ byTerrain: false, terrainChance: 'wanderChance' })])]))).toEqual([`${at}: terrainChance is only read with byTerrain: true.`]);
  });

  it('checks a mode’s chanceDie and a check’s die', () => {
    expect(formatNotes(withModes([mode([wander({ terrainChance: 'wanderChance' })], 'monster', { chanceDie: 'd10' })]))).toEqual([]);
    expect(formatNotes(withModes([mode([wander({ terrainChance: 'wanderChance', chance: { die: 'six', on: [1] } })], 'monster', { chanceDie: 6 })]))).toEqual([
      `${at}: chance.die should be a die like "d6".`,
      'rulesSets: "r", mode "wade": chanceDie should be a die like "d6" (terrain faces with no die of their own use it).',
    ]);
  });

  it('warns when turnMinutes × turnsPerHour isn’t 60, saying turnsPerHour wins', () => {
    expect(formatNotes({ rulesSets: [{ id: 'r', time: { turnMinutes: 10, turnsPerHour: 6 } }] })).toEqual([]);
    expect(formatNotes({ rulesSets: [{ id: 'r', time: { turnMinutes: 12, turnsPerHour: 6 } }] })).toEqual([
      'rulesSets: "r": time.turnMinutes × time.turnsPerHour is 12 × 6 = 72 minutes, not 60; turnsPerHour wins, so the app\'s hour is 72 minutes.',
    ]);
  });

  it('checks magic armour’s baseArmour: each id an armour item of the pack with its own AC', () => {
    const items = [
      { id: 'reed-coat', name: 'Reed coat', slot: 'armour', armour: { ac: 7, aac: 12, type: 'light' } },
      { id: 'bark-vest', name: 'Bark vest', slot: 'armour', armour: 11 },
      { id: 'buckler', name: 'Buckler', slot: 'shield', armour: { acBonus: 1 } },
      { id: 'glimmer', name: 'Glimmer mail', slot: 'armour', armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'bark-vest'] } } },
    ];
    expect(formatNotes({ items })).toEqual([]);
    expect(formatCounts({ items })).toMatchObject({ 'magic armour with a base to choose': 1 });
    const odd = [
      ...items.slice(0, 3),
      { id: 'dull', name: 'Dull mail', slot: 'armour', armour: { aac: 12, baseArmour: { choose: ['reed-coat', 'buckler', 'moon-plate', 'glimmer'] } } },
      { id: 'flat', name: 'Flat mail', slot: 'armour', armour: { baseArmour: ['reed-coat'] } },
    ];
    expect(formatNotes({ items: odd })).toEqual([
      'items: "dull": armour.baseArmour.choose names "buckler", which isn\'t armour with its own AC (slot "armour" and a base, ac or aac).',
      'items: "dull": armour.baseArmour.choose names "moon-plate", which isn\'t an item in this pack.',
      'items: "dull": armour.baseArmour.choose names "glimmer", which isn\'t an item in this pack.',
      'items: "dull": armour has both baseArmour and its own AC; with baseArmour, AC is the chosen base\'s plus magicBonus.',
      'items: "flat": armour.baseArmour should be { choose: ["<armour item id>", …] }.',
    ]);
  });

  it('names type for the old armour.class and armour.bulk keys', () => {
    expect(formatNotes({ items: [{ id: 'moss', name: 'Moss cloak', slot: 'armour', armour: { aac: 11, class: 'light', bulk: 'heavy' } }] })).toEqual([
      'items: "moss": armour.class isn\'t a format key; write type ("light", "medium", "heavy").',
      'items: "moss": armour.bulk isn\'t a format key; write type ("light", "medium", "heavy").',
    ]);
  });

  it('says the new fields can come off meta.proposedExtensions', () => {
    expect(formatNotes({ meta: { proposedExtensions: ['terrainChance on checks', 'baseArmour for magic armour'] } })).toHaveLength(2);
  });
});

describe('the fields ruled 2026-10-29 (abilities, race, XP, spells, HP)', () => {
  it('checks the rules set\'s abilities list, and notes plain keys', () => {
    const notes = formatNotes({ rulesSets: [{ id: 'r', abilities: ['MUS', { key: 'WIT' }, { key: 'MUS', name: 'Muscle' }, { name: 'No key' }] }] });
    expect(notes).toEqual([
      'rulesSets: "r": abilities lists 1 plain key; { key, name } gives pop-ups and creation a long name.',
      'rulesSets: "r", ability "WIT": needs a name (the long name pop-ups use).',
      'rulesSets: "r", ability "MUS" appears twice.',
      'rulesSets: "r", ability #4: needs a key ("MUS").',
    ]);
    expect(formatNotes({ rulesSets: [{ id: 'r', abilities: { MUS: 'Muscle' } }] })).toEqual([
      'rulesSets: "r": abilities should be a list like [{ "key": "MUS", "name": "Muscle", "short": "MUS" }].',
    ]);
  });

  it('points the old retainer fields at xp.retainerShare and checks it is a fraction', () => {
    const notes = formatNotes({ rulesSets: [{ id: 'r', xp: { retainerShare: 2, retainerXpPenalty: '½' }, retainers: { xpPenalty: 0.5 } }] });
    expect(notes).toEqual([
      'rulesSets: "r": xp.retainerShare should be a fraction from 0 to 1 (0.5 is half a share).',
      'rulesSets: "r": xp.retainerXpPenalty: the format reads xp.retainerShare (a fraction such as 0.5); write it there.',
      'rulesSets: "r": retainers.xpPenalty: Award XP reads xp.retainerShare (a fraction such as 0.5); write it there.',
    ]);
  });

  it('asks for a structured combat.spellDisruption', () => {
    expect(formatNotes({ rulesSets: [{ id: 'r', combat: { spellDisruption: 'Hit casters lose the spell.' } }] })).toEqual([
      'rulesSets: "r": combat.spellDisruption is plain text; write { "lostWhenHit": true, "beforeActing": true, "note": "…" } so the damage pad can offer "Spell lost?".',
    ]);
    expect(formatNotes({ rulesSets: [{ id: 'r', combat: { spellDisruption: { lostWhenHit: 'yes', note: 'x' } } }] })).toEqual([
      'rulesSets: "r": combat.spellDisruption.lostWhenHit is true or false.',
    ]);
  });

  it('checks classes\' race, hpGain and the spell fields, and names the new shape for old ones', () => {
    const notes = formatNotes({
      races: [{ id: 'marsh-folk', name: 'Marsh folk' }],
      classes: [{ id: 'k', name: 'K', race: 'hill-folk', hpAfter10: 2,
        progression: [{ level: 10, hpGain: 2 }],
        abilities: [{ name: 'Glow', usesPerDayPerLevel: 1 }],
        spellcasting: { knownByLevel: [], firstSpells: {}, learnByLevel: [{ level: 2 }], scrollCopy: 'Roll to copy.' } }],
    });
    expect(notes).toEqual([
      'classes: "k", ability "Glow": usesPerDayPerLevel isn\'t a form the format reads; write uses: { byLevel: [{ level, count }], per: "day" }.',
      'classes: "k": race "hill-folk" isn\'t a race in this pack (fine if another attached pack has it).',
      'classes: "k": level 10 hpGain should be { "fixed": <whole number>, "addCon": true | false }.',
      'classes: "k": hpAfter10 isn\'t read; write hpGain: { fixed, addCon } on each progression row with a set gain.',
      'classes: "k": spellcasting.knownByLevel is read as learnByLevel; write spellcasting.learnByLevel: [{ level, count }].',
      'classes: "k": spellcasting.firstSpells should be { choose?: <number>, given?: [spell ids], rollTable?: <table id> | [<table ids>] } (at least one).',
      'classes: "k": spellcasting.learnByLevel should be a list like [{ "level": 2, "count": 1 }].',
      'classes: "k": spellcasting.scrollCopy is plain text; write { "note": "…", "consumesScroll": true }.',
    ]);
  });

  it('warns when a class names a race that no entry has, even in a pack with no races at all', () => {
    expect(formatNotes({ classes: [{ id: 'k', name: 'K', race: 'reed-folk' }] })).toEqual([
      'classes: "k": race "reed-folk" isn\'t a race in this pack (fine if another attached pack has it).',
    ]);
    expect(formatNotes({ races: [{ id: 'reed-folk', name: 'Reed folk' }], classes: [{ id: 'k', name: 'K', race: 'reed-folk' }] })).toEqual([]);
  });

  it('reads summary as blurb, on every kind, and notes when a pack has both', () => {
    const notes = formatNotes({
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', summary: 'Bog lurker' }],
      classes: [{ id: 'k', name: 'K', summary: 'Keeps the lamps lit.', blurb: 'Keeps the lamps lit at night.' }],
    });
    expect(notes).toEqual([
      'classes: "k": has both blurb and summary; blurb is read, summary can go.',
      'statBlocks: "bog-lurker": summary (read as blurb) only repeats the name; say what it does in play.',
    ]);
  });

  it('runs inside npm run pack:check on the invented pack', () => {
    const out = execFileSync(process.execPath, ['scripts/check-pack.mjs', fixture], { encoding: 'utf8' });
    expect(out).toMatch(/exploration modes: 2/);
    expect(out).not.toMatch(/Format notes/);
  });
});

describe('a check\'s alsoWhen (ruled 2026-10-30, D9; four keys, F3)', () => {
  const routes = [{ id: 'causeway', name: 'Causeway' }, { id: 'reed-path', name: 'Reed path' }];
  const terrain = [{ id: 'bog', name: 'Bog', cost: 2 }];
  const withCheck = (alsoWhen, mode = { movement: { kind: 'budget', routes }, terrain }) =>
    withModes([{ id: 'wander', ...mode, checks: [{ id: 'ambush', alsoWhen }] }]);
  const at = 'rulesSets: "r", mode "wander", check "ambush"';

  it('says nothing when each of the four keys names a route id or terrain id the pack\'s modes define, as one event or a list', () => {
    expect(formatNotes(withCheck({ leaveRoute: 'causeway', enterRoute: 'reed-path' }))).toEqual([]);
    expect(formatNotes(withCheck([{ enterTerrain: 'bog' }, { leaveTerrain: 'bog' }]))).toEqual([]);
  });

  it('looks route ids up across every mode in the pack, not only the check\'s own', () => {
    const pack = withModes([
      { id: 'roam', movement: { kind: 'budget', routes } },
      { id: 'wander', checks: [{ id: 'ambush', alsoWhen: { leaveRoute: 'causeway' } }] },
    ]);
    expect(formatNotes(pack)).toEqual([]);
  });

  it('says when a key names an id the pack doesn\'t define, and when the pack defines none so it can\'t tell', () => {
    expect(formatNotes(withCheck({ leaveRoute: 'road', enterTerrain: 'heath' }))).toEqual([
      `${at}: alsoWhen.leaveRoute "road" isn't a route id in this pack (causeway, reed-path); fine if another attached pack has it.`,
      `${at}: alsoWhen.enterTerrain "heath" isn't a terrain id in this pack (bog); fine if another attached pack has it.`,
    ]);
    expect(formatNotes(withCheck({ leaveRoute: 'causeway' }, {}))).toEqual([
      `${at}: alsoWhen.leaveRoute "causeway": this pack's modes define no routes (movement.routes), so the checker can't tell whether it's one (fine if another attached pack has it).`,
    ]);
  });

  it('flags an event 07 doesn\'t know, an empty event, a value that isn\'t an id, and a shape that isn\'t an event or a list', () => {
    expect(formatNotes(withCheck([{ onFullMoon: true }, {}, { enterRoute: 3 }]))).toEqual([
      `${at}: alsoWhen #1.onFullMoon isn't an event 07 knows (leaveRoute, enterRoute, enterTerrain, leaveTerrain); it's kept but not read.`,
      `${at}: alsoWhen #2 names no event (leaveRoute, enterRoute, enterTerrain, leaveTerrain).`,
      `${at}: alsoWhen #3.enterRoute should name a route id.`,
    ]);
    expect(formatNotes(withCheck('causeway'))).toEqual([`${at}: alsoWhen should be an event like { "leaveRoute": "<route id>" }, or a list of them.`]);
    expect(formatNotes(withCheck([]))).toEqual([`${at}: alsoWhen should be an event like { "leaveRoute": "<route id>" }, or a list of them.`]);
  });
});

describe('a check\'s onlyWhen (settlement rulings, 2026-10-30)', () => {
  const withOnlyWhen = (onlyWhen) => withModes([{ id: 'town', checks: [{ id: 'cutpurse', onlyWhen }] }]);

  it('accepts outDay and activeNight, and says when it\'s anything else', () => {
    expect(formatNotes(withOnlyWhen('outDay'))).toEqual([]);
    expect(formatNotes(withOnlyWhen('activeNight'))).toEqual([]);
    expect(formatNotes(withOnlyWhen('market'))).toEqual(['rulesSets: "r", mode "town", check "cutpurse": onlyWhen "market" isn\'t one of outDay, activeNight.']);
    // M5b step 6.0 (sw-1 … sw-4): the plan's own example.
    expect(formatNotes(withOnlyWhen('rainy'))).toEqual(['rulesSets: "r", mode "town", check "cutpurse": onlyWhen "rainy" isn\'t one of outDay, activeNight.']);
  });
});

describe('onlyWithOption names an option the pack defines (ruled 2026-10-30, WA1)', () => {
  const options = [
    { id: 'pipe-smoke', name: 'Pipe smoke', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] },
    { id: 'night-rules', name: 'Night rules', choices: [{ id: 'harsh', name: 'Harsh' }, { id: 'mild', name: 'Mild' }] },
  ];
  const mode = (gate) => ({
    id: 'roam',
    checks: [{ id: 'c', onlyWithOption: gate }],
    activities: [{ id: 'a', name: 'Puff', onlyWithOption: gate }],
    camp: { procedure: [{ id: 's', name: 'Doze', kind: 'note', onlyWithOption: gate }] },
  });

  it('says nothing when an activity, camp step, check and table name a real option and choice', () => {
    const pack = { ...withModes([mode('night-rules:mild')]), options, tables: [{ id: 't', onlyWithOption: 'pipe-smoke' }] };
    expect(formatNotes(pack)).toEqual([]);
  });

  it('notes an unknown option wherever it sits, the pack\'s tables included, even when the pack has no options', () => {
    const pack = { ...withModes([mode('moon-rules')]), tables: [{ id: 't', onlyWithOption: 'moon-rules' }] };
    const unknown = 'onlyWithOption names "moon-rules", which isn\'t an option in this pack (fine if another attached pack has it).';
    expect(formatNotes(pack)).toEqual([
      `rulesSets: "r", mode "roam", check "c": ${unknown}`,
      `rulesSets: "r", mode "roam", camp step "s": ${unknown}`,
      `rulesSets: "r", mode "roam", activity "a": ${unknown}`,
      `tables: "t": ${unknown}`,
    ]);
  });

  // of-4 (G-100): a check's modifier may carry onlyWithOption, checked like the check's own.
  it('checks a check modifier\'s onlyWithOption', () => {
    const withModifier = (gate) => ({ ...withModes([{ id: 'roam', checks: [{ id: 'c', modifiers: [{ weatherTag: 'fog', add: 1, onlyWithOption: gate }] }] }]), options });
    expect(formatNotes(withModifier('pipe-smoke'))).toEqual([]);
    expect(formatNotes(withModifier('pipe-smoke:maybe'))).toEqual([
      'rulesSets: "r", mode "roam", check "c", modifier 1: onlyWithOption names choice "maybe", which isn\'t one of option "pipe-smoke"\'s choices (on, off).',
    ]);
  });

  it('notes a choice the option doesn\'t have, and a bare option id when the option has no "on" choice', () => {
    const pack = { options, tables: [{ id: 't1', onlyWithOption: 'pipe-smoke:maybe' }, { id: 't2', onlyWithOption: 'night-rules' }] };
    expect(formatNotes(pack)).toEqual([
      'tables: "t1": onlyWithOption names choice "maybe", which isn\'t one of option "pipe-smoke"\'s choices (on, off).',
      'tables: "t2": onlyWithOption "night-rules" means its "on" choice, but that option has no "on" choice (harsh, mild); write "night-rules:<choice id>".',
    ]);
  });
});

describe('movement.routes and forced march (ruled 2026-10-30)', () => {
  const withMovement = (movement) => withModes([{ id: 'roam', movement: { kind: 'budget', ...movement } }]);
  const at = 'rulesSets: "r", mode "roam" movement';

  it('says nothing about well-formed routes and either kind of forced march', () => {
    const routes = [{ id: 'causeway', name: 'Causeway', cost: 1, column: 'road', note: 'Dry feet.' }, { id: 'wild', name: 'Wild' }];
    expect(formatNotes(withMovement({ routes, forced: { factor: 1.5, stack: 'once' } }))).toEqual([]);
    expect(formatNotes(withMovement({ forced: { add: 2, stack: 'add', note: 'Weary after.' } }))).toEqual([]);
  });

  it('flags a route with no id, a repeated id, no name, a bad cost or column, and the old roads and tracks', () => {
    const routes = [{ name: 'Nameless' }, { id: 'a', name: 'A' }, { id: 'a', name: 'A again' }, { id: 'b', cost: 1.5, column: 2 }];
    expect(formatNotes(withMovement({ routes, roads: [], tracks: [] }))).toEqual([
      `${at}: roads is the old way; write routes: [{ id, name, cost?, column?, note? }].`,
      `${at}: tracks is the old way; write routes: [{ id, name, cost?, column?, note? }].`,
      `${at}, route "Nameless": has no id (checks name routes by id).`,
      `${at}, route "a": the id is used twice.`,
      `${at}, route "b": has no name.`,
      `${at}, route "b": cost should be a whole number of 0 or more.`,
      `${at}, route "b": column should be an encounter-table column label.`,
    ]);
    expect(formatNotes(withMovement({ routes: 'causeway' }))).toEqual([`${at}: routes should be a list like [{ "id": "<id>", "name": "<name>", "cost"?, "column"?, "note"? }].`]);
  });

  it('flags forced march with both factor and add, with neither, with bad numbers, and with a stack that isn\'t once or add', () => {
    expect(formatNotes(withMovement({ forced: { factor: 2, add: 3 } }))).toEqual([`${at}: forced has both factor and add; give one.`]);
    expect(formatNotes(withMovement({ forced: { stack: 'twice' } }))).toEqual([
      `${at}: forced gives neither factor nor add; give one.`,
      `${at}: forced.stack "twice" isn't one of once, add.`,
    ]);
    expect(formatNotes(withMovement({ forced: { factor: 0 } }))).toEqual([`${at}: forced.factor should be a number above 0 (the day's budget is multiplied by it, rounded down).`]);
    expect(formatNotes(withMovement({ forced: { add: 1.5 } }))).toEqual([`${at}: forced.add should be a whole number of points above 0.`]);
  });
});

describe('camp.sleep (ruled 2026-10-30, D19)', () => {
  const sleep = {
    difficulties: [{ id: 'snug', name: 'Snug', result: 'good' }, { id: 'rough', name: 'Rough', result: 'check', add: -1 }, { id: 'awful', name: 'Awful', result: 'bad' }],
    rows: [
      { season: ['frost'], fire: false, bedding: 'none', difficulty: 'rough' },
      { bedding: { any: ['moss-bedroll', 'oilcloth-tent'] }, difficulty: 'snug' },
      { bedding: { all: ['moss-bedroll'] }, difficulty: 'snug' },
    ],
    beddingItems: [{ id: 'moss-bedroll' }, { id: 'oilcloth-tent', shares: 2 }],
    modifiers: [{ when: 'campfireTalk', add: 1, note: 'Stories help.' }],
    checkAbility: 'WIT',
  };
  const pack = (s, extra = {}) => ({
    ...withModes([{ id: 'roam', camp: { procedure: [], sleep: s, ...extra } }], { seasons: [{ id: 'thaw', name: 'Thaw' }, { id: 'frost', name: 'Frost' }] }),
    items: [{ id: 'moss-bedroll', name: 'Moss bedroll' }, { id: 'oilcloth-tent', name: 'Oilcloth tent' }],
  });
  const at = 'rulesSets: "r", mode "roam" camp.sleep';

  it('says nothing about a sleep block written the way 07 says, with each of the three results', () => {
    expect(formatNotes(pack(sleep))).toEqual([]);
  });

  it('flags a difficulty whose result isn\'t good, check or bad, and names result as the new shape for the old roll', () => {
    const s = { difficulties: [{ id: 'snug', name: 'Snug', result: 'fine' }, { id: 'rough', name: 'Rough' }, { id: 'old', name: 'Old', roll: 'check' }], rows: [] };
    expect(formatNotes(pack(s))).toEqual([
      `${at}, difficulty "snug": result should be one of good, check, bad.`,
      `${at}, difficulty "rough": result should be one of good, check, bad.`,
      `${at}, difficulty "old": roll is the old way; write result: "good", "check" or "bad".`,
    ]);
  });

  it('flags rows that name an unknown difficulty, season or item, odd bedding and fire, and bad bedding items and modifiers', () => {
    const bad = {
      difficulties: [{ id: 'snug', name: 'Snug', result: 'good', add: 0.5 }, { name: 'Nameless', result: 'bad' }],
      rows: [
        { difficulty: 'cosy', season: ['monsoon'], fire: 'yes' },
        { bedding: { any: ['feather-quilt'] }, difficulty: 'snug' },
        { bedding: { any: ['moss-bedroll'], all: ['oilcloth-tent'] } },
      ],
      beddingItems: [{ id: 'oilcloth-tent', shares: 0 }, { id: 'feather-quilt' }, 'moss-bedroll'],
      modifiers: [{ when: 'campfireTalk', add: 'one' }],
    };
    expect(formatNotes(pack(bad))).toEqual([
      `${at}, difficulty "snug": add should be a whole number.`,
      `${at}, difficulty "Nameless": has no id.`,
      `${at}, row #1: difficulty "cosy" isn't one of the sleep difficulties.`,
      `${at}, row #1: season "monsoon" isn't a season.`,
      `${at}, row #1: fire is true or false.`,
      `${at}, row #2: bedding names "feather-quilt", which isn't an item in this pack (fine if another attached pack has it).`,
      `${at}, row #3: names no difficulty.`,
      `${at}, row #3: bedding should be "none", { "any": [<item ids>] } or { "all": [<item ids>] }.`,
      `${at}, bedding item #1: shares should be a whole number of 1 or more (how many characters it covers).`,
      `${at}, bedding item #2: "feather-quilt" isn't an item in this pack (fine if another attached pack has it).`,
      `${at}, bedding item #3: should be { id: "<item id>", shares? }.`,
      `${at}: modifiers should be a list like [{ "when": "<when>", "add": <whole number>, "note"? }].`,
    ]);
  });

  it('names camp.sleep as the new shape for the old camp.bedding and a sleep step\'s difficulty', () => {
    const old = withModes([{ id: 'roam', camp: { bedding: {}, procedure: [{ id: 'nap', name: 'Sleep', kind: 'roll', difficulty: 'rough' }] } }]);
    expect(formatNotes(old)).toEqual([
      'rulesSets: "r", mode "roam", camp step "nap": a sleep step\'s difficulty is the old way; write camp.sleep: { difficulties, rows, … }.',
      'rulesSets: "r", mode "roam": camp.bedding is the old way; write camp.sleep: { difficulties, rows, beddingItems, … }.',
    ]);
  });
});

describe('an item\'s food kind (ruled 2026-10-30)', () => {
  it('accepts fresh, preserved and cooked, and says when it\'s anything else', () => {
    const items = [
      { id: 'reed-bread', name: 'Reed bread', food: 'fresh' },
      { id: 'smoked-eel', name: 'Smoked eel', food: 'preserved' },
      { id: 'bog-stew', name: 'Bog stew', food: 'cooked' },
      { id: 'mystery-jar', name: 'Mystery jar', food: 'pickled' },
    ];
    expect(formatNotes({ items })).toEqual(['items: "mystery-jar": food "pickled" isn\'t one of fresh, preserved, cooked.']);
  });
});

describe('a check\'s routeType modifiers name a route id (ruled 2026-10-30)', () => {
  const withModifiers = (modifiers, routes) => withModes([{ id: 'roam', movement: { kind: 'budget', ...(routes ? { routes } : {}) }, checks: [{ id: 'astray', modifiers }] }]);
  const at = 'rulesSets: "r", mode "roam", check "astray"';
  const routes = [{ id: 'causeway', name: 'Causeway' }];

  it('says nothing when a routeType modifier names a route id from movement.routes', () => {
    expect(formatNotes(withModifiers([{ routeType: 'causeway', never: true }], routes))).toEqual([]);
  });

  it('says when it names an id the pack doesn\'t define, when the pack has no routes, and when it isn\'t an id', () => {
    expect(formatNotes(withModifiers([{ routeType: 'road', never: true }, { routeType: 4 }], routes))).toEqual([
      `${at}: routeType "road" isn't a route id in this pack (causeway); fine if another attached pack has it.`,
      `${at}: a routeType modifier should name a route id.`,
    ]);
    expect(formatNotes(withModifiers([{ routeType: 'causeway', chance: 1 }]))).toEqual([
      `${at}: routeType "causeway": this pack's modes define no routes (movement.routes), so the checker can't tell whether it's one (fine if another attached pack has it).`,
    ]);
  });
});

describe('a table\'s option field (of-3, of-12: any entry may carry option)', () => {
  // Purpose: a table's `option`, one spec or a list of them, is the ruled way since of-3 and of-12, so the checker says
  // nothing about a valid one (it used to call it "the old way"); a choice the option doesn't have is still named,
  // once, by the option-gate check.
  const options = [{ id: 'eel-season', name: 'Eel season', choices: [{ id: 'on', name: 'Yes' }, { id: 'late', name: 'Late' }] }];

  it('says nothing about a valid option on a table, as one spec or as a list', () => {
    const pack = { options, tables: [{ id: 't1', option: 'eel-season' }, { id: 't2', option: 'eel-season=late' }, { id: 't3', option: ['eel-season=on', 'eel-season=late'] }] };
    expect(formatNotes(pack)).toEqual([]);
  });

  it('leaves a choice the option does not have to the option-gate check', () => {
    const pack = { options, tables: [{ id: 't4', option: 'eel-season=early' }] };
    expect(formatNotes(pack)).toEqual([]);
    const entries = [{ kind: 'option', packEntryId: 'eel-season', data: options[0] }, { kind: 'table', packEntryId: 't4', data: pack.tables[0] }];
    expect(optionGateNotes(entries)).toEqual([expect.stringMatching(/"t4": option names choice "early", which isn't one of option "eel-season"'s choices/)]);
  });
});

describe("an activity's yields (G-108, ga-5)", () => {
  // Purpose: dice counting whole items and units counting single pieces of a bundled item are both read without a
  // line; a yields with no count, both counts, a bad count, an item the pack lacks or units on an unbundled item is said.
  it('accepts { item, dice } and { item, units } on a bundled item, and names each yields written wrong', () => {
    const items = [{ id: 'fen-rations', name: 'Fen rations (1 week)', bundle: 7, unitName: 'Ration day' }, { id: 'eel', name: 'Eel' }];
    const activity = (id, yields) => ({ id, name: id, icon: 'forage', cost: { budget: 1 }, yields });
    const good = [activity('a', { item: 'eel', dice: '1d3' }), activity('b', { item: 'fen-rations', units: '1d6' }), activity('c', { item: 'fen-rations', units: 2 })];
    expect(formatNotes({ items, ...withModes([{ id: 'roam', activities: good }]) })).toEqual([]);
    const bad = [
      activity('d', { item: 'eel' }),
      activity('e', { item: 'fen-rations', dice: '1', units: '1d3' }),
      activity('f', { item: 'fen-rations', units: 0 }),
      activity('g', { item: 'moss', dice: 3 }),
      activity('h', { item: 'eel', units: '1d2' }),
      activity('i', 'eel'),
    ];
    const at = (id) => `rulesSets: "r", mode "roam", activity "${id}"`;
    expect(formatNotes({ items, ...withModes([{ id: 'roam', activities: bad }]) })).toEqual([
      `${at('d')}: yields should say how many: dice (whole items) or units (single pieces of a bundled item).`,
      `${at('e')}: yields has both dice and units; write one (units wins: single pieces).`,
      `${at('f')}: yields.units should be dice like "1d3" or a whole number of 1 or more (single pieces of the bundle).`,
      `${at('g')}: yields names "moss", which isn't an item of this pack.`,
      `${at('g')}: yields.dice should be dice or a number written as text, like "1d3".`,
      `${at('h')}: yields counts units of "eel", which has no bundle; units and dice give the same.`,
      `${at('i')}: yields should be { item, dice } (whole items) or { item, units } (single pieces of a bundled item).`,
    ]);
  });
});
