// npm run pack:check's notes on gates with several choices (of-12) and overlay patches (of-13), ruled 2026-11-03
// (docs/design/rulings/m5b-options-format-2-2026-11-03.md). Every name is invented.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fieldGateNotes, optionGateNotes, patchLibraryNotes, patchNotes } from './pack-option-gates.mjs';

const sparks = { kind: 'option', packEntryId: 'sparks', data: { choices: [{ id: 'none' }, { id: 'common' }, { id: 'rare' }] } };
const item = (id, data) => ({ kind: 'item', packEntryId: id, data });

describe('option gates on several choices (of-12)', () => {
  // Purpose: a list or a comma key whose choices all exist gives no note.
  it('known choices give no note', () => {
    expect(optionGateNotes([sparks, item('spark-lance', { option: ['sparks=common', 'sparks=rare'], byOption: { 'sparks=common,sparks=rare': { cost: 5 } } })])).toEqual([]);
  });

  // Purpose: a choice the option doesn't have is named, in a list and in a comma key alike.
  it('an unknown choice is named', () => {
    const notes = optionGateNotes([sparks, item('spark-lance', { option: ['sparks=rare', 'sparks=relics'], byOption: { 'sparks=rare,sparks=relix': {} } })]);
    expect(notes).toEqual([
      `items: "spark-lance": option names choice "relics", which isn't one of option "sparks"'s choices (none, common, rare).`,
      `items: "spark-lance": byOption "sparks=rare,sparks=relix" names choice "relix", which isn't one of option "sparks"'s choices (none, common, rare).`,
    ]);
  });

  // Purpose: a bare option id means its `on` choice; one without an `on` choice is noted.
  it('a bare option without an on choice is noted', () => {
    expect(optionGateNotes([sparks, item('spark-lance', { option: 'sparks' })])[0]).toMatch(/with no choice, which means its "on" choice, but it has none/);
  });

  // Purpose: a byOption key with a part naming no choice, or an empty part, is never read and says so.
  it('a malformed key is noted', () => {
    expect(optionGateNotes([sparks, item('spark-lance', { byOption: { 'sparks=rare,': {}, 'sparks=rare,moss': {} } })])).toHaveLength(2);
  });

  // Purpose: an option that isn't a spec or a list of specs is noted.
  it('an option that is not words or a list of words is noted', () => {
    expect(optionGateNotes([item('spark-lance', { option: [] })])).toEqual([`items: "spark-lance": option should be "<option>=<choice>" or a list of them (any of them, 07 of-12).`]);
  });

  // Purpose: checked alone, an overlay naming its base's option says nothing; checked as a library, a missing option
  // is noted, and a choice an extending option adds (of-1) counts.
  it("an option another pack has: silent alone, checked in a library, extends' choices count", () => {
    const lance = item('spark-lance', { option: ['sparks=rare', 'sparks=wild'] });
    expect(optionGateNotes([lance])).toEqual([]);
    expect(optionGateNotes([lance], true)[0]).toMatch(/names option "sparks", which isn't in any of these packs/);
    const wild = { kind: 'option', packEntryId: 'wild-sparks', data: { extends: 'sparks', choices: [{ id: 'wild' }] } };
    expect(optionGateNotes([sparks, wild, lance], true)).toEqual([]);
  });

  // Purpose: a rules set's byOption keys in any section are checked; a race's are left to its own checker.
  it("rules sets' sections are checked; races are not double-noted", () => {
    const rules = { kind: 'rulesSet', packEntryId: 'fen-rules', data: { light: { byOption: { 'sparks=lots': {} } } } };
    expect(optionGateNotes([sparks, rules])).toEqual([`rulesSets: "fen-rules": light.byOption "sparks=lots" names choice "lots", which isn't one of option "sparks"'s choices (none, common, rare).`]);
    expect(optionGateNotes([sparks, { kind: 'race', packEntryId: 'moss-folk', data: { byOption: { 'sparks=lots': {} } } }])).toEqual([]);
  });
});

describe('overlay patches (of-13)', () => {
  const ok = { byOption: 'metals=bronze,metals=bone', match: { kind: 'item', category: 'armour' }, change: { weight: { delta: -1 } } };

  // Purpose: a well-formed patch, changing or removing, gives no shape note.
  it('a well-formed patch gives no note', () => {
    expect(patchNotes({ patches: [ok, { byOption: 'metals=stone', match: { kind: 'item', ids: ['reed-coat'] }, option: null }] })).toEqual([]);
  });

  // Purpose: each shape mistake gets its own plain line.
  it('shape mistakes are named', () => {
    const notes = patchNotes({ patches: [{ byOption: 'metals', match: { kind: 'items', ids: [] }, change: { weight: { delta: 0.5 } } }, { match: {}, option: false, change: {} }, 'x'] });
    expect(notes).toEqual([
      'patches #1: byOption "metals" should be written "<option>=<choice>", several comma-separated.',
      expect.stringMatching(/^patches #1: match\.kind should be an entry kind \(/),
      'patches #1: match.ids should be a list of entry ids.',
      'patches #1: change "weight": delta should be a whole number.',
      'patches #2: byOption should name the choices it applies under, like "<option>=<choice>" (several comma-separated).',
      expect.stringMatching(/^patches #2: match\.kind should be an entry kind/),
      "patches #2: option should be null (the matched entries don't exist under these choices), or left out.",
      'patches #2: has both change and option: null; keep one.',
      'patches #2: change is empty, so it changes nothing.',
      'patches #3 should be { byOption, match, change } or { byOption, match, option: null }.',
    ]);
    expect(patchNotes({ patches: {} })).toEqual(['patches should be a list of { byOption, match, change } (07, of-13).']);
  });

  // Purpose: against the library, a match that finds nothing, an id nobody has and an unknown choice are noted.
  it('a match finding nothing is noted in a library', () => {
    const metals = { kind: 'option', packEntryId: 'metals', data: { choices: [{ id: 'steel' }, { id: 'bronze' }, { id: 'bone' }] } };
    const base = { name: 'Fen rules', entries: [metals, item('reed-coat', { category: 'armour', weight: 10 })], file: {} };
    const overlay = (patches) => ({ name: 'Mire zine', entries: [], file: { patches } });
    expect(patchLibraryNotes([base, overlay([ok])])).toEqual([]);
    expect(patchLibraryNotes([base, overlay([{ ...ok, match: { kind: 'item', category: 'shield' } }])])).toEqual(['Mire zine: patches #1: match finds nothing in these packs (item, category "shield"), so it changes nothing.']);
    expect(patchLibraryNotes([base, overlay([{ ...ok, match: { kind: 'item', ids: ['reed-coat', 'bog-helm'] } }])])).toEqual(['Mire zine: patches #1: match.ids names "bog-helm", which no item in these packs has.']);
    expect(patchLibraryNotes([base, overlay([{ ...ok, byOption: 'metals=stone' }])])).toEqual([`Mire zine: patches #1: byOption "metals=stone" names choice "stone", which isn't one of option "metals"'s choices (steel, bronze, bone).`]);
  });

  // Purpose: a change naming a field the matched entries lack changes nothing, and the checker says so (bq3-17 (2)); a
  // delta on words that aren't dice, or a multiplier on words, neither; `times` must be a whole number.
  it('a field the matched entries lack, or one that cannot take the change, is noted', () => {
    const metals = { kind: 'option', packEntryId: 'metals', data: { choices: [{ id: 'steel' }, { id: 'bronze' }] } };
    const base = { name: 'Fen rules', entries: [metals, item('reed-coat', { category: 'armour', armour: { ac: 7 }, weight: 'heavy' }), item('bog-helm', { category: 'armour', weight: 'light' })], file: {} };
    const overlay = (patches) => ({ name: 'Mire zine', entries: [], file: { patches } });
    const on = (change) => [base, overlay([{ byOption: 'metals=bronze', match: { kind: 'item', category: 'armour' }, change }])];
    expect(patchLibraryNotes(on({ 'armour.ac': { delta: 1 } }))).toEqual(['Mire zine: patches #1: change "armour.ac": bog-helm has no such field, so nothing changes there.']);
    expect(patchLibraryNotes(on({ 'weapon.damage': { delta: -1 } }))).toEqual(['Mire zine: patches #1: change "weapon.damage": none of the 2 entries it matches has that field, so it changes nothing.']);
    expect(patchLibraryNotes(on({ weight: { delta: 1 } }))).toEqual([`Mire zine: patches #1: change "weight": delta needs a number or dice, which reed-coat, bog-helm don't have there, so nothing changes there.`]);
    expect(patchLibraryNotes(on({ weight: { times: 2 } }))).toEqual([`Mire zine: patches #1: change "weight": times needs a number, which reed-coat, bog-helm don't have there, so nothing changes there.`]);
    expect(patchLibraryNotes(on({ weight: 'light' }))).toEqual([]);
    expect(patchNotes({ patches: [{ byOption: 'metals=bronze', match: { kind: 'item' }, change: { price: { times: 1.5 }, weight: { delta: 1, times: 2 } } }] })).toEqual([
      'patches #1: change "price": times should be a whole number.',
      'patches #1: change "weight": has both delta and times; keep one (or write two patches).',
    ]);
  });

  // Purpose: the 3b fixture (the app's patch tests) checks clean but for its deliberate note (a field the knife lacks) and
  // the base's armour without an armour block; the overlay's winning copy of the coat counts as having the field.
  it('the materials fixture gives only its deliberate notes', () => {
    const run = (...files) => {
      try {
        return execFileSync(process.execPath, ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });
      } catch (error) {
        return String(error.stdout);
      }
    };
    const out = run('scripts/fixtures/options-gates.fixture.json', 'scripts/fixtures/options-gates-3b-materials.fixture.json');
    expect(out).toMatch(/patches: 8/);
    expect(out).toMatch(/Mire materials: patches #8: change "armour.ac": none of the entry it matches has that field, so it changes nothing\./);
    expect(out).toMatch(/patches #1: change "armour.ac": bog-iron-coat has no such field/);
    expect(out).not.toMatch(/waxed-coat/);
    expect(out).not.toMatch(/patches #[3-7]: change/);
    expect(out).not.toMatch(/"patch-4": option should be/);
  });

  // Purpose: the checker itself counts patches, keeps the "isn't a part" line out, and adds the library notes.
  it('npm run pack:check reads both fixture packs together', () => {
    const run = (...files) => {
      try {
        return execFileSync(process.execPath, ['scripts/check-pack.mjs', ...files], { encoding: 'utf8' });
      } catch (error) {
        return String(error.stdout);
      }
    };
    const out = run('scripts/fixtures/options-gates.fixture.json', 'scripts/fixtures/options-gates-3-patches.fixture.json');
    expect(out).toMatch(/patches: 2/);
    expect(out).not.toMatch(/"patches" isn't a part/);
    expect(out).toMatch(/Mire zine: patches #2: match finds nothing in these packs/);
    expect(out).toMatch(/items: "spark-lance": option names choice "relics"/);
  });
});

describe('sheet fields for some classes or kindreds (cs-3)', () => {
  const classes = [{ kind: 'class', packEntryId: 'lantern-warden', data: {} }];
  const races = [{ kind: 'race', packEntryId: 'bog-folk', data: {} }];
  const layout = (fields) => ({ kind: 'fieldTemplate', packEntryId: 'fen-sheet', data: { fields } });
  const table = (gmOnly) => ({ kind: 'table', packEntryId: 'fen-lodges', data: { ...(gmOnly === undefined ? {} : { gmOnly }), rows: [] } });

  // Purpose: known ids and a shared table give no note.
  it('gives no note for known ids and a table players can read', () => {
    expect(fieldGateNotes([...classes, ...races, table(false), layout([{ key: 'oath', forClasses: ['lantern-warden'], forRaces: 'bog-folk', from: 'fen-lodges' }])])).toEqual([]);
  });

  // Purpose: an unknown class, a bad shape and a table players can't read are each a note; an overlay without classes isn't checked alone.
  it('notes an unknown id, a bad shape and a hidden table', () => {
    const notes = fieldGateNotes([...classes, table(undefined), layout([{ key: 'oath', forClasses: ['lantern-wardn'], forRaces: 3, from: 'fen-lodges' }])]);
    expect(notes).toContain('fieldTemplates: "fen-sheet": field "oath": forClasses names "lantern-wardn", which isn\'t a class in this pack; the field is hidden from everyone else.');
    expect(notes).toContain('fieldTemplates: "fen-sheet": field "oath": forRaces should be a list of kindred ids.');
    expect(notes.some((n) => n.includes('players can\'t read'))).toBe(true);
    expect(fieldGateNotes([layout([{ key: 'oath', forClasses: ['lantern-warden'] }])])).toEqual([]);
    expect(fieldGateNotes([layout([{ key: 'oath', forClasses: ['lantern-warden'] }])], true)[0]).toMatch(/isn't a class in any of these packs/);
  });
});

describe('a patch on a GM-only kind (fresh-session review of 2026-11-04)', () => {
  // Purpose: a patch whose match.kind players never read (a stat block, a table, a location) reaches only the GM,
  // so the checker says so; one on a kind players read gets no such note.
  it('warns that it reaches only the GM', () => {
    const note = (kind) => patchNotes({ patches: [{ byOption: 'metals=bronze', match: { kind, ids: ['x'] }, change: { hp: { delta: 1 } } }] });
    expect(note('statBlock')).toEqual(['patches #1: match.kind "statBlock" isn’t a kind players read, so this patch reaches only the GM.']);
    expect(note('table')).toHaveLength(1);
    expect(note('location')).toHaveLength(1);
    expect(note('item')).toEqual([]);
    expect(note('rulesSet')).toEqual([]);
  });
});

describe('a patch on a field players never read (look-back review of #437, 2026-11-10)', () => {
  // Purpose: a patch that changes a rules set's GM-only section (monsters, magic items, procedures, the GM reference)
  // or an entry's gmOnly list reaches only the GM, so the checker says so; one on an open section gets no such note.
  it('warns about a rules set GM-only section or a gmOnly list', () => {
    const note = (kind, path) => patchNotes({ patches: [{ byOption: 'metals=bronze', match: { kind }, change: { [path]: { delta: 1 } } }] });
    expect(note('rulesSet', 'monsters.bog-lurker.hd')).toEqual([expect.stringMatching(/^patches #1: change "monsters\.bog-lurker\.hd" .*reaches only the GM\.$/)]);
    expect(note('rulesSet', 'gmReference.ambush')).toHaveLength(1);
    expect(note('item', 'gmOnly')).toEqual([expect.stringMatching(/^patches #1: change "gmOnly" .*reaches only the GM\.$/)]);
    expect(note('rulesSet', 'encumbrance.maxLoadCoin')).toEqual([]);
  });

  // Purpose: against the library, a patch that changes a field an entry it matches keeps GM-only reaches only the GM
  // (by id or by category), so the checker names the entry; a patch on an open field gets no such note.
  it('warns about a field a matched entry keeps GM-only', () => {
    const metals = { kind: 'option', packEntryId: 'metals', data: { choices: [{ id: 'steel' }, { id: 'bronze' }] } };
    const base = { name: 'Fen rules', entries: [metals, item('eel-lamp', { category: 'gear', cost: 5, curse: 'Smells of eels', gmOnly: ['curse'] }), item('bog-lantern', { category: 'gear', cost: 3 })], file: {} };
    const overlay = (patches) => ({ name: 'Mire zine', entries: [], file: { patches } });
    const notes = (match, change) => patchLibraryNotes([base, overlay([{ byOption: 'metals=bronze', match, change }])]).filter((n) => n.includes('reaches only the GM'));
    expect(notes({ kind: 'item', ids: ['eel-lamp'] }, { curse: 'Smells of mud' })).toEqual([expect.stringMatching(/^Mire zine: patches #1: change "curse": eel-lamp .*reaches only the GM\.$/)]);
    expect(notes({ kind: 'item', category: 'gear' }, { curse: 'Smells of reeds' })).toHaveLength(1);
    expect(notes({ kind: 'item', category: 'gear' }, { cost: { delta: 1 } })).toEqual([]);
  });
});
