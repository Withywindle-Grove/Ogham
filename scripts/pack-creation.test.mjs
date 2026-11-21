// Tests for the pack checker's checks of creation rules as data (scripts/pack-creation.mjs; docs/07, "Creation rules
// as data", ruled 2026-11-01 cr-19 … cr-24). Invented packs only.
import { describe, expect, it } from 'vitest';
import { creationCounts, creationNotes } from './pack-creation.mjs';
import { formatCounts, formatNotes } from './pack-format.mjs';

/** An invented setting that writes every creation shape the way 07 says. */
const good = () => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'fen-rules-pack', name: 'Fen rules' },
  options: [{ id: 'soft-start', name: 'Soft start', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] }],
  rulesSets: [{
    id: 'fen-rules',
    name: 'Fen rules',
    abilities: [{ key: 'MUS', name: 'Muscle' }, { key: 'WIT', name: 'Wit' }, { key: 'NERVE', name: 'Nerve' }],
    scores: { dice: '3d6', min: 3, max: 18, startOver: { everyAtMost: 8, countAtMost: { count: 2, value: 6 }, option: 'soft-start', note: 'Poor rolls may be thrown back.' } },
    abilityAdjustment: { lowerBy: 2, raiseBy: 1, lowerable: ['MUS', 'WIT'], raise: 'prime', floor: 9, cap: 13, classExceptions: [{ classId: 'reed-singer', cannotLower: ['MUS'] }], note: 'Trade two for one.' },
    languages: { common: ['fen-speech'], alignment: false, extraFrom: 'WIT', list: [{ id: 'fen-speech', name: 'Fen speech', blurb: 'What everyone in the fens speaks.' }, { id: 'eel-tongue', name: 'Eel tongue', note: 'Hissed, not spoken.' }] },
    abilityModifiers: { WIT: [{ range: '3-8', extraLanguages: 0 }, { range: '9-12', extraLanguages: 0 }, { range: '13-18', extraLanguages: 1 }] },
    alignmentVisibility: 'owner',
  }],
  classes: [{ id: 'reed-singer', name: 'Reed singer', languages: ['eel-tongue'], abilities: [{ name: 'Reed song', kind: 'advantage' }, { name: 'Thin-skinned', kind: 'disadvantage', note: 'Cold bites harder.' }] }],
  races: [{ id: 'fen-folk', name: 'Fen folk', languages: [], abilities: [{ name: 'Webbed feet' }] }],
  fieldTemplates: [{ id: 'fen-sheet', appliesTo: 'pc', fields: [
    { key: 'MUS', label: 'MUS', type: 'number' },
    { key: 'hp', label: 'Hit points', type: 'number' },
    { key: 'AC', label: 'AC', type: 'number', fill: 'ac' },
    { key: 'MV', label: 'Movement', type: 'text', fill: 'movement' },
    { key: 'attack', label: 'Attack', type: 'text', fill: 'attack' },
    { key: 'saveD', label: 'Save vs drowning', type: 'number', fill: 'saves.D' },
    { key: 'title', label: 'Title', type: 'text', fill: 'title' },
    { key: 'literacy', label: 'Literacy', type: 'text', fill: 'abilityModifiers.WIT.literacy' },
    { key: 'skillSwim', label: 'Swim', type: 'number', fill: 'skills.swim' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'band', label: 'Band', type: 'text', atCreation: false },
  ] }],
});

/** The same pack with one change, for the checks that should speak up. */
const withRules = (change) => {
  const file = good();
  change(file.rulesSets[0], file);
  return file;
};

describe('the pack format checks for creation rules as data (cr-19 … cr-24)', () => {
  it('finds nothing wrong with a setting that writes every creation shape the way 07 says', () => {
    expect(creationNotes(good())).toEqual([]);
    // The full checker agrees on these shapes (the invented pack has no blurbs on its class or race, which other checks mention).
    expect(formatNotes(good()).filter((n) => !/blurb/.test(n))).toEqual([]);
  });

  it('counts the creation shapes a pack holds, and the full checker shows them', () => {
    const counts = {
      'rules sets with scores': 1,
      'rules sets with ability adjustment as data': 1,
      'rules sets with a languages list': 1,
      'rules sets hiding alignment': 1,
      'abilities tagged disadvantage': 1,
      'sheet fields with fill': 7,
    };
    expect(creationCounts(good())).toEqual(counts);
    expect(formatCounts(good())).toMatchObject(counts);
  });

  it('asks for a scores block when a rules set has classes to pick from and none', () => {
    const notes = creationNotes(withRules((r) => delete r.scores));
    expect(notes.some((n) => /no scores block/.test(n))).toBe(true);
    // A pack with no classes (a book of tables) is left alone, and so is an overlay that requires a base pack.
    expect(creationNotes(withRules((r, f) => { delete r.scores; f.classes = []; delete r.abilityAdjustment.classExceptions; }))).toEqual([]);
    expect(creationNotes(withRules((r, f) => { delete r.scores; f.meta.requires = [{ packId: 'marsh-rules', minVersion: '0.1' }]; }))).toEqual([]);
  });

  // Purpose (Design, 2026-11-07): creation.kits.pick is a positive whole number; absent is fine (the app reads 1).
  it('notes a kits pick that is not a positive whole number', () => {
    expect(creationNotes(withRules((r) => { r.creation = { kits: { pick: 2 } }; }))).toEqual([]);
    expect(creationNotes(withRules((r) => { r.creation = { kits: { pick: 0 } }; }))).toEqual([expect.stringMatching(/creation\.kits\.pick should be a positive whole number/)]);
    expect(creationNotes(withRules((r) => { r.creation = { kits: { pick: 1.5 } }; }))).toEqual([expect.stringMatching(/creation\.kits\.pick/)]);
  });

  it('checks the scores block: dice, a range and what start-over needs', () => {
    expect(creationNotes(withRules((r) => { r.scores.dice = 'three dice'; }))).toEqual([expect.stringMatching(/scores\.dice should be dice/)]);
    expect(creationNotes(withRules((r) => { r.scores.min = 18; r.scores.max = 3; }))).toEqual([expect.stringMatching(/min no more than max/)]);
    expect(creationNotes(withRules((r) => { r.scores.startOver = { note: 'Sometimes.' }; }))).toEqual([expect.stringMatching(/needs everyAtMost or countAtMost/)]);
    expect(creationNotes(withRules((r) => { r.scores.startOver.option = 'no-such-option'; }))).toEqual([expect.stringMatching(/"no-such-option" isn't an option of this pack/)]);
  });

  it('says that an ability adjustment in words gives no Adjust scores step, and checks the data form', () => {
    expect(creationNotes(withRules((r) => { r.abilityAdjustment = 'Lower two to raise one.'; }))).toEqual([expect.stringMatching(/is words, so creation has no Adjust scores step/)]);
    expect(creationNotes(withRules((r) => { r.abilityAdjustment.lowerable = ['LUCK']; }))).toEqual([expect.stringMatching(/lowerable names "LUCK", not among the rules set's abilities \(MUS, WIT, NERVE\)/)]);
    expect(creationNotes(withRules((r) => { r.abilityAdjustment.lowerable = 'nonPrime'; r.abilityAdjustment.raise = ['WIT']; }))).toEqual([]);
    expect(creationNotes(withRules((r) => { r.abilityAdjustment.cap = 5; }))).toEqual([expect.stringMatching(/cap should be a whole number, no less than floor/)]);
    expect(creationNotes(withRules((r) => { r.abilityAdjustment.classExceptions = [{ classId: 'knight', cannotLower: ['MUS'] }]; }))).toEqual([expect.stringMatching(/class "knight" isn't in this pack/)]);
  });

  it('asks for a languages list when races or classes name languages the step can’t find, and points out the old shapes', () => {
    expect(creationNotes(withRules((r) => delete r.languages))).toEqual([expect.stringMatching(/no languages section/)]);
    expect(creationNotes(withRules((r) => { r.languages = { common: 'Fen speech', learnable: [{ name: 'Eel tongue' }] }; }))).toEqual(expect.arrayContaining([
      expect.stringMatching(/languages\.list is missing \(learnable aren't read\)/),
      expect.stringMatching(/languages\.common should be a list of ids/),
    ]));
    expect(creationNotes(withRules((r) => { r.languages.alignment = 'no'; }))).toEqual([expect.stringMatching(/languages\.alignment should be true or false/)]);
    expect(creationNotes(withRules((r) => { r.languages.extraFrom = 'INT'; }))).toEqual([expect.stringMatching(/extraFrom should be one of the rules set's ability keys \(MUS, WIT, NERVE\)/)]);
    expect(creationNotes(withRules((r) => { r.languages.common = ['marsh-latin']; }))).toEqual([expect.stringMatching(/common names "marsh-latin", which isn't in languages\.list/)]);
  });

  it('matches a race’s or class’s bare language name to the list by name, with a note, and names one that isn’t there', () => {
    expect(creationNotes(withRules((r, f) => { f.classes[0].languages = ['Eel tongue']; }))).toEqual([expect.stringMatching(/classes: "reed-singer": languages names "Eel tongue" by name; write its id \("eel-tongue"\)/)]);
    expect(creationNotes(withRules((r, f) => { f.races[0].languages = ['Heron']; }))).toEqual([expect.stringMatching(/races: "fen-folk": languages names "Heron", which isn't in the rules set's languages list/)]);
  });

  it('names the ability table rows that still say extra languages in words, and a column that isn’t a whole number', () => {
    const notes = creationNotes(withRules((r) => { r.abilityModifiers.WIT = [{ range: '3-12', languages: 'Native' }, { range: '13-18', languages: 'Native + 1' }]; }));
    expect(notes).toEqual([expect.stringMatching(/abilityModifiers\.WIT: rows "3-12", "13-18" say languages in words \("Native"\), the old way; write extraLanguages as a whole number/)]);
    expect(creationNotes(withRules((r) => { r.abilityModifiers.WIT[2].extraLanguages = 'one'; }))).toEqual([expect.stringMatching(/row "13-18": extraLanguages should be a whole number/)]);
  });

  // Gate walk 2026-11-05, bug 2: a text cell that repeats its column's name reads twice on the score tile
  // ("open doors open doors 2-in-6"); the checker names the rows so the pack can hold the value alone.
  it('names ability table rows whose text repeats the column’s own name, and leaves a value alone, numbers and other words be', () => {
    const notes = creationNotes(withRules((r) => { r.abilityModifiers.MUS = [{ range: '3-8', melee: -1, liftGate: 'Lift gate 1-in-6' }, { range: '9-18', melee: 0, liftGate: 'lift  gate 2-in-6' }]; }));
    expect(notes).toEqual([expect.stringMatching(/abilityModifiers\.MUS, column "liftGate": rows "3-8", "9-18" repeat the column's name \("Lift gate 1-in-6"\); the app puts "lift gate" before the value/)]);
    expect(creationNotes(withRules((r) => { r.abilityModifiers.MUS = [{ range: '3-18', melee: 0, liftGate: '2-in-6', note: 'Heavy gates only' }]; }))).toEqual([]);
  });

  // Design's shape (2026-11-05): abilityModifierColumns marks plain-figure columns; the checker knows it, and names
  // a column no row has and a kind it can't read.
  it('accepts abilityModifierColumns naming a column of the table, and names an unknown column or kind', () => {
    const marked = (marks) => withRules((r) => { r.abilityModifiers.WIT[0].lanterns = 2; r.abilityModifierColumns = marks; });
    expect(creationNotes(marked({ lanterns: 'value' }))).toEqual([]);
    expect(creationNotes(marked({ lanterns: 'value', candles: 'value' }))).toEqual([expect.stringMatching(/abilityModifierColumns names "candles", which no row of abilityModifiers has/)]);
    expect(creationNotes(marked({ lanterns: 'plain' }))).toEqual([expect.stringMatching(/abilityModifierColumns "lanterns" is "plain"; write "value"/)]);
    expect(creationNotes(marked(['lanterns']))).toEqual([expect.stringMatching(/abilityModifierColumns should be \{ <column>: "value" \}/)]);
  });

  // Design's shape (2026-11-05): alignmentBlurbs gives each alignment row one line; the checker knows it and names a
  // blurb keyed by a name the setting's alignments don't have.
  it('accepts alignmentBlurbs for the setting’s alignments, and names one keyed by another name or not text', () => {
    const blurbed = (blurbs) => withRules((r) => { r.alignments = ['Lantern', 'Reed']; r.alignmentBlurbs = blurbs; });
    expect(creationNotes(blurbed({ Lantern: 'Keeps the lamps lit.', Reed: 'Bends with the wind.' }))).toEqual([]);
    expect(creationNotes(blurbed({ Lantern: 'Keeps the lamps lit.', Mire: 'Takes what sinks.' }))).toEqual([expect.stringMatching(/alignmentBlurbs names "Mire", which isn't one of the setting's alignments \(Lantern, Reed\)/)]);
    expect(creationNotes(blurbed({ Lantern: 3 }))).toEqual([expect.stringMatching(/alignmentBlurbs "Lantern" should be one line of text/)]);
    expect(creationNotes(blurbed('Keeps the lamps lit.'))).toEqual([expect.stringMatching(/alignmentBlurbs should be \{ <alignment>: "one line" \}/)]);
  });

  it('checks alignmentVisibility and abilities’ kind against their words', () => {
    expect(creationNotes(withRules((r) => { r.alignmentVisibility = 'gm'; }))).toEqual([expect.stringMatching(/alignmentVisibility "gm" isn't one of owner, all/)]);
    expect(creationNotes(withRules((r, f) => { f.races[0].abilities[0].kind = 'quirk'; }))).toEqual([expect.stringMatching(/races: "fen-folk", ability "Webbed feet": kind "quirk" isn't one of advantage, disadvantage/)]);
  });

  it('points out the usual derived sheet fields left without fill, and leaves scores, hit points and free text alone', () => {
    const notes = creationNotes(withRules((r, f) => { for (const field of f.fieldTemplates[0].fields) delete field.fill; }));
    expect(notes).toHaveLength(7);
    expect(notes.map((n) => n.match(/field "([^"]+)" \((\w+)\)/).slice(1, 3))).toEqual([
      ['AC', 'AC'], ['Movement', 'movement'], ['Attack', 'attack'], ['Save vs drowning', 'saves'], ['Title', 'title'], ['Literacy', 'literacy'], ['Swim', 'skills'],
    ]);
  });

  // A sheet field's atCreation (ruled B 2026-11-03) is true or false; anything else is noted, and a field creation
  // never asks gets no "creation will ask for it by hand" note.
  it('accepts atCreation as true or false on a sheet field, notes any other value, and skips the fill note when it is false', () => {
    expect(creationNotes(withRules((r, f) => { f.fieldTemplates[0].fields.push({ key: 'oath', label: 'Oath', type: 'text', atCreation: true }); }))).toEqual([]);
    expect(creationNotes(withRules((r, f) => { f.fieldTemplates[0].fields.at(-1).atCreation = 'no'; }))).toEqual([expect.stringMatching(/field "Band": atCreation should be true or false/)]);
    expect(creationNotes(withRules((r, f) => { const ac = f.fieldTemplates[0].fields[2]; delete ac.fill; ac.atCreation = false; }))).toEqual([]);
  });

  it('lets a caster whose spells start after 1st level say so with an empty given list, and no other', () => {
    const later = good();
    later.classes[0].spellcasting = { listId: 'reed-songs', type: 'divine', fromLevel: 2, firstSpells: { given: [], note: 'Songs come at 2nd level.' } };
    expect(formatNotes(later).filter((n) => /firstSpells/.test(n))).toEqual([]);
    later.classes[0].spellcasting.fromLevel = 1;
    expect(formatNotes(later).filter((n) => /firstSpells/.test(n))).toHaveLength(1);
  });

  it('never throws on an odd file', () => {
    expect(creationNotes(null)).toEqual([]);
    expect(creationNotes({ rulesSets: [{ id: 'x', scores: 7, abilityAdjustment: 3, languages: [] }], fieldTemplates: [{ fields: 'none' }], classes: [{ id: 'y', abilities: 'none', languages: 'all' }] }).length).toBeGreaterThan(0);
    expect(creationCounts('text')).toEqual({});
  });
});

describe('hit points, no shop and given gear (follow-up A, cf-1, cf-2, cf-4)', () => {
  const withGear = (change) =>
    withRules((rules, file) => {
      file.items = [{ id: 'reed-rope', name: 'Reed rope' }];
      rules.hitPoints = { startMinimum: 1, minimumPerDie: 1, reroll: { atMost: 2, option: 'soft-start', note: 'Roll again on a 1 or 2.' }, notes: 'Free reference text.' };
      rules.byOption = { 'soft-start=off': { startingGear: { shop: false }, startingEquipment: ['reed-rope'] } };
      change?.(rules, file);
    });

  it('finds nothing wrong with the named hit-points fields, a re-roll, and no-shop gear set through byOption, and counts them', () => {
    expect(creationNotes(withGear())).toEqual([]);
    expect(creationCounts(withGear())).toMatchObject({ 'rules sets with a hit-points re-roll': 1, 'rules sets with starting equipment': 1, 'rules sets without a shop (some or all of the time)': 1 });
  });

  it('says when the hit-points fields are the wrong shape or the re-roll names an option the pack lacks', () => {
    expect(creationNotes(withGear((r) => (r.hitPoints = 'Roll your hit die.')))).toEqual([expect.stringMatching(/hitPoints should be \{ startMinimum\?/)]);
    expect(creationNotes(withGear((r) => Object.assign(r.hitPoints, { startMinimum: 1.5, minimumPerDie: 'one' })))).toEqual([
      expect.stringMatching(/hitPoints.startMinimum should be a whole number/),
      expect.stringMatching(/hitPoints.minimumPerDie should be a whole number/),
    ]);
    expect(creationNotes(withGear((r) => (r.hitPoints.reroll = { atMost: 0, option: 'no-such', note: 3 })))).toEqual([
      expect.stringMatching(/reroll.atMost should be a whole number of 1 or more/),
      expect.stringMatching(/reroll.option "no-such" isn't an option of this pack/),
      expect.stringMatching(/reroll.note should be words/),
    ]);
    expect(creationNotes(withGear((r) => (r.hitPoints.reroll = 2)))).toEqual([expect.stringMatching(/hitPoints.reroll should be \{ atMost/)]);
  });

  it('says when startingGear.shop is not true or false, or startingEquipment names an item the pack lacks, inside byOption too', () => {
    expect(creationNotes(withGear((r) => (r.byOption['soft-start=off'].startingGear = { shop: 'no' })))).toEqual([expect.stringMatching(/byOption "soft-start=off": startingGear.shop should be true or false/)]);
    expect(creationNotes(withGear((r) => (r.startingEquipment = ['reed-rope', 'ghost-lamp'])))).toEqual([expect.stringMatching(/startingEquipment names "ghost-lamp", not among this pack's items/)]);
    expect(creationNotes(withGear((r) => (r.startingEquipment = 'a rope')))).toEqual([expect.stringMatching(/startingEquipment should be a list of item ids/)]);
    // An overlay may name its base pack's items.
    expect(creationNotes(withGear((r, f) => ((r.startingEquipment = ['base-lamp']), (f.meta.requires = [{ id: 'base' }]))))).toEqual([]);
  });

  // Purpose (creation survey PR 4; cs-6, of-11, G-83, G-92): `{ itemId, qty, units? }` lines and a pick from a table
  // players can read are fine; a pick naming a missing or GM-only table, a bad count, or a table without items is said;
  // a line by name is noted as a one-off (rc-3).
  it('reads { itemId, qty } lines and picks; says what is off with a pick; notes a one-off by name', () => {
    const odds = { id: 'fen-odds', name: 'Fen odds', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 4, result: 'Rope', items: [{ itemId: 'reed-rope' }] }] };
    const withPick = (pick, table = odds) => withGear((r, f) => ((r.startingEquipment = [{ itemId: 'reed-rope', qty: 2 }, { pick }]), (f.tables = table ? [table] : [])));
    expect(creationNotes(withPick({ tableId: 'fen-odds', upTo: 2 }))).toEqual([]);
    expect(creationNotes(withPick({ tableId: 'fen-odds', upTo: 0 }))).toEqual([expect.stringMatching(/a startingEquipment pick should be \{ tableId, upTo \}/)]);
    expect(creationNotes(withPick({ tableId: 'fen-odds', upTo: 2 }, null))).toEqual([expect.stringMatching(/pick names table "fen-odds", not among this pack's tables/)]);
    expect(creationNotes(withPick({ tableId: 'fen-odds', upTo: 2 }, { ...odds, gmOnly: undefined }))).toEqual([expect.stringMatching(/isn't one players can read; write "gmOnly": false/)]);
    expect(creationNotes(withPick({ tableId: 'fen-odds', upTo: 2 }, { ...odds, rows: [{ min: 1, max: 4, result: 'Rope' }] }))).toEqual([expect.stringMatching(/has no row with items/)]);
    expect(creationNotes(withGear((r) => (r.startingEquipment = [{ name: 'Lucky stone' }])))).toEqual([expect.stringMatching(/"Lucky stone" is a one-off by name/)]);
  });
});

// Purpose (creation survey PR 4; cs-6, G-90, G-93): a language's roll and learnableBy in the ruled shapes are fine and
// a wrong one is said; an overlay's list may leave `common` to its base and name the base's ids.
describe('language rolls, who may learn, and an overlay’s list (cs-6)', () => {
  it('reads roll and learnableBy; says when they are off; an overlay needs no common', () => {
    const withList = (extra, change) =>
      withRules((rules, file) => {
        rules.languages.list.push({ id: 'moth-hum', name: 'Moth hum', ...extra });
        change?.(rules, file);
      });
    expect(creationNotes(withList({ roll: { die: 'd6', min: 2, max: 3 }, learnableBy: ['fae'] }))).toEqual([]);
    expect(creationNotes(withList({ learnableBy: { types: [], soft: true } }))).toEqual([]);
    expect(creationNotes(withList({ roll: { die: 'd6', min: 3, max: 2 } }))).toEqual([expect.stringMatching(/"moth-hum": roll should be \{ die: "d6", min, max \}/)]);
    expect(creationNotes(withList({ learnableBy: 'fae' }))).toEqual([expect.stringMatching(/"moth-hum": learnableBy should be a list of creature types/)]);
    expect(creationNotes(withList({ learnableBy: [] }))).toEqual([expect.stringMatching(/"moth-hum": learnableBy names no creature type, so it limits nothing/)]);
    // An overlay: no common, and a class naming the base's language.
    const overlay = withRules((rules, file) => {
      delete rules.languages.common;
      file.meta.requires = [{ id: 'base' }];
      file.classes[0].languages = ['base-tongue'];
    });
    expect(creationNotes(overlay).filter((n) => /languages/.test(n))).toEqual([]);
  });
});

describe('prime XP in the packs’ shape (rc-1)', () => {
  const withClass = (primeXp, change = () => {}) => withRules((r, f) => {
    r.primeRequisiteXp = [{ range: '3-8', xp: -10 }, { range: '9-12', xp: 0 }, { range: '13-18', xp: 5 }];
    f.classes[0].primeRequisites = ['MUS', 'WIT'];
    f.classes[0].primeXp = primeXp;
    change(r, f);
  });

  it('finds nothing wrong with "standard" over the rules set’s table, "rules" thresholds and "lowest"', () => {
    expect(creationNotes(withClass({ type: 'standard' }, (r) => { r.primeRequisiteRule = 'lowest'; }))).toEqual([]);
    expect(creationNotes(withClass({ type: 'rules', rules: [{ any: { MUS: 13, WIT: 13 }, bonus: 5 }, { all: { MUS: 16, WIT: 16 }, bonus: 10 }] }))).toEqual([]);
  });

  it('names the old app shape ({ any | all: [{ min, bonus }] }) and says what to write instead', () => {
    expect(creationNotes(withClass({ any: [{ min: 13, bonus: 5 }] }))).toEqual([expect.stringMatching(/classes: "reed-singer": primeXp is the old shape; write \{ "type": "standard" \} or \{ "type": "rules"/)]);
  });

  it('says when a "rules" entry isn’t { all | any: { ability: minimum }, bonus }, or the type is unknown', () => {
    expect(creationNotes(withClass({ type: 'rules', rules: [{ all: [{ min: 13 }], bonus: 5 }] }))).toEqual([expect.stringMatching(/primeXp\.rules\[0\] should be/)]);
    expect(creationNotes(withClass({ type: 'house' }))).toEqual([expect.stringMatching(/primeXp\.type "house" isn't "standard" or "rules"/)]);
  });

  it('says when "standard" has no table to read, unless the pack sits on another pack', () => {
    expect(creationNotes(withClass({ type: 'standard' }, (r) => delete r.primeRequisiteXp))).toEqual([expect.stringMatching(/"standard" reads the rules set's primeRequisiteXp, and no rules set here has one/)]);
    expect(creationNotes(withClass({ type: 'standard' }, (r, f) => { delete r.primeRequisiteXp; f.meta.requires = [{ packId: 'marsh-rules' }]; }))).toEqual([]);
  });

  it('says when primeRequisiteRule is words instead of "lowest", or the table’s rows aren’t { range, xp }', () => {
    expect(creationNotes(withClass({ type: 'standard' }, (r) => { r.primeRequisiteRule = 'The lower score counts.'; }))).toEqual([expect.stringMatching(/primeRequisiteRule should be "lowest"/)]);
    expect(creationNotes(withClass({ type: 'standard' }, (r) => { r.primeRequisiteXp[0] = { min: 3, bonus: -10 }; }))).toEqual([expect.stringMatching(/primeRequisiteXp\[0\] should be \{ range, xp \}/)]);
  });
});

describe('races’ save bonus by CON, optional abilities, skill targets and magic resistance (07 Races, 2026-11-03)', () => {
  /** The invented pack with a CON score, two saves, a "lifted" option and a race writing every shape the way 07 says. */
  const withRace = (change) => {
    const file = good();
    const rules = file.rulesSets[0];
    rules.abilities.push({ key: 'CON', name: 'Constancy' });
    rules.saveCategories = [{ key: 'R', name: 'Rot' }, { key: 'M', name: 'Mire' }];
    rules.saveModifiers = [{ id: 'spell-ward', name: 'Spell ward', value: { from: 'WIT', plusRaceField: 'magicResistance' } }];
    file.options.push({ id: 'kin-limits', name: 'Kin limits', choices: [{ id: 'kept', name: 'Kept' }, { id: 'lifted', name: 'Lifted' }] });
    Object.assign(file.races[0], {
      saveBonusByCon: { saves: ['R(rot)', 'M'], byCon: [{ con: '6 or lower', bonus: 0 }, { con: '7-14', bonus: 2 }, { con: '15 or more', bonus: 3 }] },
      optionalAbilities: { whenOption: 'kin-limits=lifted', abilityModifiers: { MUS: 1 }, abilities: [{ name: 'Lucky', note: 'Once a day.' }] },
      skillTargets: { delve: 5, swim: { value: 4, when: 'wading' } },
      magicResistance: 2,
    });
    change?.(file.races[0], file);
    return file;
  };

  it('finds nothing wrong when each is written the way 07 says, and counts them', () => {
    expect(creationNotes(withRace())).toEqual([]);
    expect(creationCounts(withRace())).toMatchObject({ 'races with a save bonus by CON': 1, 'races with optional abilities behind an option': 1, 'races with a skill target in a situation': 1 });
  });

  it('warns when the save bonus is the wrong shape, names an unknown save, or the setting has no CON', () => {
    expect(creationNotes(withRace((r) => (r.saveBonusByCon = { saves: 'R' })))).toEqual([expect.stringMatching(/saveBonusByCon should be \{ saves/)]);
    expect(creationNotes(withRace((r) => (r.saveBonusByCon.saves = ['Q(rot)'])))).toEqual([expect.stringMatching(/saveBonusByCon.saves names "Q", not among/)]);
    expect(creationNotes(withRace((r) => r.saveBonusByCon.byCon.push({ con: 'very high', bonus: 1.5 })))).toEqual([expect.stringMatching(/byCon row .* should be \{ con: a score range/)]);
    expect(creationNotes(withRace((r, f) => (f.rulesSets[0].abilities = f.rulesSets[0].abilities.filter((a) => a.key !== 'CON'))))).toEqual([expect.stringMatching(/reads the CON score, and the rules sets have no CON ability/)]);
  });

  it('warns when the optional abilities name an option or choice the pack lacks, or are the wrong shape', () => {
    expect(creationNotes(withRace((r) => (r.optionalAbilities.whenOption = 'no-such=on')))).toEqual([expect.stringMatching(/whenOption names "no-such", not an option of this pack/)]);
    expect(creationNotes(withRace((r) => (r.optionalAbilities.whenOption = 'kin-limits=gone')))).toEqual([expect.stringMatching(/names choice "gone", not a choice of option "kin-limits"/)]);
    expect(creationNotes(withRace((r) => (r.optionalAbilities = { abilities: [] })))).toEqual([expect.stringMatching(/optionalAbilities should be \{ whenOption/)]);
    expect(creationNotes(withRace((r) => (r.optionalAbilities.abilityModifiers = { MUS: 'one' })))).toEqual([expect.stringMatching(/optionalAbilities.abilityModifiers should be/)]);
    expect(creationNotes(withRace((r) => (r.optionalAbilities.abilities = [{ note: 'no name' }])))).toEqual([expect.stringMatching(/optionalAbilities.abilities should be a list of \{ name/)]);
    // An overlay may name its base pack's option.
    expect(creationNotes(withRace((r, f) => ((r.optionalAbilities.whenOption = 'base-rule=on'), (f.meta.requires = [{ id: 'base' }]))))).toEqual([]);
  });

  it('warns on a skill target that is neither a number nor { value, when }, and on magic resistance nothing reads', () => {
    expect(creationNotes(withRace((r) => (r.skillTargets.swim = { value: 4 })))).toEqual([expect.stringMatching(/skillTargets "swim" should be a whole number, or \{ value/)]);
    expect(creationNotes(withRace((r) => (r.skillTargets = [5])))).toEqual([expect.stringMatching(/skillTargets should be \{/)]);
    expect(creationNotes(withRace((r) => (r.magicResistance = '2')))).toEqual([expect.stringMatching(/magicResistance should be a whole number/)]);
    expect(creationNotes(withRace((r, f) => delete f.rulesSets[0].saveModifiers))).toEqual([expect.stringMatching(/magicResistance is read through a rules set's saveModifiers/)]);
  });
});

// The kindred's and class's own bonuses (cs-7): acBonus with an armour `when`, progression acBonus, saveBonus.
const bonusRules = { id: 'burr-rules', saveCategories: [{ key: 'R', name: 'Rot' }, { key: 'M', name: 'Mire' }] };
const thistleKin = { id: 'thistle-kin', name: 'Thistle kin', acBonus: { value: 1, when: 'unarmoured or Light armour' }, saveBonus: [{ vs: 'spores or poison', bonus: 4 }, { vs: 'all other', bonus: 2 }] };
const hedgeAbbot = { id: 'hedge-abbot', name: 'Hedge Abbot', progression: [{ level: 1, acBonus: 2 }], saveBonus: { bonus: 1, saves: ['M'] } };

describe('pack:check on the bonuses', () => {
  // Purpose: a bonus in the wrong shape, a condition the app can't count and an unknown save key are each named.
  it('names bad shapes and conditions it can’t read', () => {
    const notes = creationNotes({
      rulesSets: [bonusRules],
      races: [{ id: 'a', name: 'A', acBonus: { value: 1, when: 'vs Large' } }, { id: 'b', name: 'B', acBonus: 'one', saveBonus: [{ vs: 'rot', bonus: 'two' }] }],
      classes: [{ id: 'c', name: 'C', progression: [{ level: 1, acBonus: 1.5 }], saveBonus: { bonus: 1, saves: ['Q'] } }],
    }).filter((n) => /Bonus|acBonus/.test(n));
    expect(notes.some((n) => n.startsWith('races: "a": acBonus when "vs Large"'))).toBe(true);
    expect(notes.some((n) => n.startsWith('races: "b": acBonus should be'))).toBe(true);
    expect(notes.some((n) => n.startsWith('races: "b": saveBonus'))).toBe(true);
    expect(notes.some((n) => n.startsWith('classes: "c": progression acBonus'))).toBe(true);
    expect(notes.some((n) => n.startsWith('classes: "c": saveBonus.saves names "Q"'))).toBe(true);
  });

  // Purpose: the shapes 07 gives pass quietly.
  it('says nothing about the ruled shapes', () => {
    expect(creationNotes({ rulesSets: [bonusRules], races: [thistleKin], classes: [hedgeAbbot] }).filter((n) => /Bonus/.test(n))).toEqual([]);
  });
});
