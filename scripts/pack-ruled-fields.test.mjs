// Tests for the pack checker's notes on three ruled fields (scripts/pack-ruled-fields.mjs): a place's rule kept for
// the GM (pf-12d), an encounter check's name (rp-6), a coin's unitName and pluralName (pf-17). Every name is made up.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';
import { ruledFieldFindings, ruledFieldNotes } from './pack-ruled-fields.mjs';

const place = (extra) => ({ locations: [{ id: 'reed-ford', name: 'Reed ford', ...extra }] });
const coins = (currency) => ({ rulesSets: [{ id: 'fen-rules', name: 'Fen rules', currency }] });

describe("a place's rule id (review of #726: the GM's eye is kept under it)", () => {
  // Purpose: a rule id the GM's switch can't hold (a dot, a space, a double dash, too long) is an error naming the place
  // and the rule; a plain kebab or snake id is silent.
  it('errs on an id with a dot or a space, and is silent for kebab and snake ids', () => {
    const file = place({ rules: [{ id: 'eel-run', name: 'Eel run' }, { id: 'low_tide', name: 'Low tide' }, { id: 'rule.one', name: 'Rule one' }, { id: 'the fog', name: 'Fog' }, { id: 'a--b', name: 'Double' }, { id: 'x'.repeat(121), name: 'Long' }] });
    expect(ruledFieldFindings(file).map((f) => [f.level, f.text.split(':')[1]])).toEqual([
      ['error', ' "reed-ford", rule "rule.one"'],
      ['error', ' "reed-ford", rule "the fog"'],
      ['error', ' "reed-ford", rule "a--b"'],
      ['error', ` "reed-ford", rule "${'x'.repeat(121)}"`],
    ]);
  });
});

describe("a place's rule kept for the GM (pf-12d)", () => {
  // Purpose: a rule marked gmOnly true or false, or not marked at all, is silent.
  it('is silent for gmOnly true, false or absent', () => {
    const file = place({ rules: [{ id: 'sinking-mud', name: 'Sinking mud', text: 'x', gmOnly: true }, { id: 'tolls', name: 'Tolls', text: 'x', gmOnly: false, button: 'coin' }, { id: 'fog', name: 'Fog', text: 'x', button: 'fog' }] });
    expect(ruledFieldFindings(file)).toEqual([]);
  });

  // Purpose: a gmOnly that isn't true or false is an error naming the place and the rule.
  it('errs on a gmOnly that is not true or false', () => {
    const file = place({ rules: [{ id: 'sinking-mud', name: 'Sinking mud', text: 'x', gmOnly: 'yes' }, { name: 'Lantern toll', text: 'x', gmOnly: 1 }] });
    expect(ruledFieldFindings(file)).toEqual([
      { level: 'error', text: 'locations: "reed-ford", rule "sinking-mud": gmOnly is true or false (true keeps the rule from the players).' },
      { level: 'error', text: 'locations: "reed-ford", rule "Lantern toll": gmOnly is true or false (true keeps the rule from the players).' },
    ]);
  });

  // Purpose: a gmOnly rule whose button is null has no button, so it is silent.
  it('is silent for a gmOnly rule whose button is null', () => {
    expect(ruledFieldFindings(place({ rules: [{ id: 'sinking-mud', gmOnly: true, button: null }] }))).toEqual([]);
  });

  // Purpose: a rule kept for the GM that also carries a button gets a warning (players would see a button for a rule they may never read).
  it('warns on a gmOnly rule with a button', () => {
    const file = place({ rules: [{ id: 'sinking-mud', name: 'Sinking mud', text: 'x', gmOnly: true, button: 'warning' }] });
    expect(ruledFieldFindings(file)).toEqual([
      { level: 'warning', text: 'locations: "reed-ford", rule "sinking-mud" is gmOnly but has a button: players would see a button for a rule they may never read.' },
    ]);
  });
});

describe("a place's rule's button (pf-12e: words, or { icon, words })", () => {
  const at = 'locations: "reed-ford", rule "eel-run"';
  const button = (value) => ruledFieldFindings(place({ rules: [{ id: 'eel-run', name: 'Eel run', text: 'x', button: value }] }));

  // Purpose: words, words that name an icon, an icon of the set with or without words, and no button at all are silent.
  it('is silent for words, an icon with or without words, and no button', () => {
    for (const value of ['The eels are running', 'water-splash', { icon: 'water-splash', words: 'Someone fell in' }, { icon: 'hourglass' }, undefined, null]) expect(button(value)).toEqual([]);
  });

  // Purpose: an empty string, or something that is neither words nor an object, is an error naming the place and the rule.
  it('errs on empty words and on anything not words or an object', () => {
    for (const value of ['', '  ', 7, ['water-splash']]) expect(button(value).map((f) => f.level)).toEqual(['error']);
    expect(button('')[0].text.startsWith(`${at}: button should be words`)).toBe(true);
  });

  // Purpose: an object with no icon name, or with words that aren't words, is an error.
  it('errs on an object with no icon, or with empty words', () => {
    for (const value of [{ words: 'Someone fell in' }, { icon: '' }, { icon: 3 }]) expect(button(value).map((f) => f.level)).toEqual(['error']);
    expect(button({ icon: 'water-splash', words: '' })).toEqual([{ level: 'error', text: `${at}: button.words should be words (leave it out and the rule's name is the button's label).` }]);
  });

  // Purpose: an icon the app's set doesn't have is a note, not an error: the button falls back to the generic mark with
  // its words, and the checker still passes.
  it('notes an unknown icon, and the note prints as "Note:"', () => {
    const found = button({ icon: 'lantern-moth', words: 'The eels are running' });
    expect(found.map((f) => f.level)).toEqual(['note']);
    expect(found[0].text).toContain('button.icon "lantern-moth" isn\'t in the app\'s icon set (trumpet-flag, ');
    expect(ruledFieldNotes(place({ rules: [{ id: 'eel-run', name: 'Eel run', button: { icon: 'lantern-moth' } }] }))[0].startsWith('Note: ')).toBe(true);
  });
});

describe("an encounter check's name (rp-6)", () => {
  // Purpose: a check with a name in words, or with no name, is silent (the app says "Encounter check").
  it('is silent for a named check and for a check with no name', () => {
    expect(ruledFieldFindings(place({ encounterCheck: { name: 'Bog lurker stirs', tableId: 't' } }))).toEqual([]);
    expect(ruledFieldFindings(place({ encounterCheck: { tableId: 't' } }))).toEqual([]);
    expect(ruledFieldFindings(place({ encounterCheck: null }))).toEqual([]);
  });

  // Purpose: a name that is empty or isn't text is an error naming the check's place.
  it('errs on an empty name or one that is not text', () => {
    const file = { locations: [{ id: 'reed-ford', encounterCheck: { name: '  ' } }, { id: 'old-mill', encounterCheck: { name: 3 } }] };
    expect(ruledFieldFindings(file)).toEqual([
      { level: 'error', text: 'locations: "reed-ford": encounterCheck.name should be words; leave it out and the app says "Encounter check".' },
      { level: 'error', text: 'locations: "old-mill": encounterCheck.name should be words; leave it out and the app says "Encounter check".' },
    ]);
  });
});

describe('a place with no encounters (G-27, dg-1)', () => {
  // Purpose: `"none": true`, with or without the pack's sentence, is silent.
  it('is silent for none: true, with a note or without', () => {
    expect(ruledFieldFindings(place({ encounterCheck: { none: true, note: 'The harbour watch keeps the quay quiet.' } }))).toEqual([]);
    expect(ruledFieldFindings(place({ encounterCheck: { none: true } }))).toEqual([]);
  });

  // Purpose: a `none` beside a chance, a table, a table named by id, a schedule or a modifier by track contradicts
  // itself, and a `none` that isn't true doesn't pass quietly (the app reads it as no check at all).
  it('warns on none beside a check’s own parts, and on a none that isn’t true', () => {
    const file = {
      locations: [
        { id: 'the-quay', encounterCheck: { none: true, chance: { die: 'd6', on: [1] }, tableId: 'quay-things' } },
        { id: 'the-steps', encounterCheck: { none: true, tableRef: 'reed:steps', every: { value: 1, unit: 'turn' }, byTrack: [] } },
        { id: 'the-shed', encounterCheck: { none: 'yes' } },
        { id: 'the-slip', encounterCheck: { none: false } },
      ],
    };
    const beside = (id, keys) => ({ level: 'warning', text: `locations: "${id}": encounterCheck says "none" but also gives ${keys}; a "none" check never comes due, so leave them out (or drop "none").` });
    const notTrue = (id) => ({ level: 'warning', text: `locations: "${id}": encounterCheck.none should be true (leave it out for a check that comes due); the app reads this check as no check at all.` });
    expect(ruledFieldFindings(file)).toEqual([beside('the-quay', 'chance, tableId'), beside('the-steps', 'tableRef, every, byTrack'), notTrue('the-shed'), notTrue('the-slip')]);
  });
});

describe("a coin's unitName and pluralName (pf-17)", () => {
  // Purpose: a coin with both names, or neither, is silent (with neither the app prints the label as given).
  it('is silent for both names or neither', () => {
    const file = coins([{ key: 'cr', label: 'crowns', valueInBase: 10, unitName: 'crown', pluralName: 'crowns' }, { key: 'bi', label: 'bits', valueInBase: 1 }]);
    expect(ruledFieldFindings(file)).toEqual([]);
  });

  // Purpose: a name that is empty or isn't text is an error naming the coin.
  it('errs on an empty or non-text unitName or pluralName', () => {
    const file = coins([{ key: 'cr', label: 'crowns', valueInBase: 10, unitName: '', pluralName: 'crowns' }, { key: 'he', label: 'herons', valueInBase: 1, unitName: 'heron', pluralName: 2 }]);
    expect(ruledFieldFindings(file)).toEqual([
      { level: 'error', text: 'rulesSets: "fen-rules": currency "cr": unitName should be words (the name for one of "crowns").' },
      { level: 'error', text: 'rulesSets: "fen-rules": currency "he": pluralName should be words (the name for more than one of "herons").' },
    ]);
  });

  // Purpose: one name given without the other is a warning (the app uses them only together, else the label as given).
  it('warns on one name without the other', () => {
    const file = coins([{ key: 'cr', label: 'crowns', valueInBase: 10, unitName: 'crown' }, { key: 'he', label: 'herons', valueInBase: 1, pluralName: 'herons' }]);
    expect(ruledFieldFindings(file)).toEqual([
      { level: 'warning', text: 'rulesSets: "fen-rules": currency "cr" has a unitName and no pluralName; the app uses them only together, so it prints the label "crowns" for every amount.' },
      { level: 'warning', text: 'rulesSets: "fen-rules": currency "he" has a pluralName and no unitName; the app uses them only together, so it prints the label "herons" for every amount.' },
    ]);
  });

  // Purpose: two coins with the same key in one list is an error, named once.
  it('errs on a key listed twice', () => {
    const file = coins([{ key: 'cr', label: 'crowns', valueInBase: 10 }, { key: 'cr', label: 'old crowns', valueInBase: 10 }, { key: 'cr', label: 'again', valueInBase: 10 }, { key: 'bi', label: 'bits', valueInBase: 1 }]);
    expect(ruledFieldFindings(file)).toEqual([
      { level: 'error', text: 'rulesSets: "fen-rules": currency lists the key "cr" more than once; a purse keeps one amount per key.' },
    ]);
  });
});

describe('the checker as a whole', () => {
  // Purpose: each note starts with its level, "Error:" or "Warning:", and reaches the checker's format notes.
  it('prints each finding among the format notes, starting with its level', () => {
    const file = place({ encounterCheck: { name: '' }, rules: [{ id: 'sinking-mud', gmOnly: true, button: 'warning' }] });
    expect(ruledFieldNotes(file)).toEqual([
      'Warning: locations: "reed-ford", rule "sinking-mud" is gmOnly but has a button: players would see a button for a rule they may never read.',
      'Error: locations: "reed-ford": encounterCheck.name should be words; leave it out and the app says "Encounter check".',
    ]);
    for (const note of ruledFieldNotes(file)) expect(formatNotes(file)).toContain(note);
  });

  // Purpose: a pack that uses none of the three fields reports exactly as before: every existing fixture gets no finding.
  it('finds nothing in the existing fixtures', () => {
    const dir = join(import.meta.dirname, 'fixtures');
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      expect(ruledFieldFindings(JSON.parse(readFileSync(join(dir, name), 'utf8'))), name).toEqual([]);
    }
  });

  // Purpose: anything that isn't a pack file (null, a list, Markdown read as nothing) gives no finding and never throws.
  it('is silent on a file that is not an object', () => {
    expect(ruledFieldFindings(null)).toEqual([]);
    expect(ruledFieldFindings([])).toEqual([]);
    expect(ruledFieldFindings({ locations: 'x', rulesSets: 'y' })).toEqual([]);
  });
});

describe('an unidentified item’s words (K22, ⚑ 4 and ⚑ 5)', () => {
  // Purpose: a category's `singular` and an item's `looks` are words when given; absent is silent, and anything else is
  // a warning (the app falls back to the category's name, and shows no look line), never an error.
  it('is silent for words or nothing, and warns on anything else', () => {
    const file = {
      rulesSets: [{ id: 'fen-rules', name: 'Fen rules', itemCategories: [{ id: 'ring', name: 'Rings', singular: 'Ring', unidentified: true }, { id: 'wand', name: 'Wands' }, { id: 'rod', name: 'Rods', singular: 3 }] }],
      items: [{ id: 'bronze-ring', name: 'Ring of the Drowned Bell', category: 'ring', looks: 'A plain band of old bronze.' }, { id: 'ash-wand', name: 'Ash wand' }, { id: 'reed-rod', name: 'Reed rod', looks: '' }],
    };
    const found = ruledFieldFindings(file);
    expect(found.map((f) => f.level)).toEqual(['warning', 'warning']);
    expect(found[0].text).toMatch(/^rulesSets: "fen-rules": itemCategories "rod": singular should be words/);
    expect(found[1].text).toMatch(/^items: "reed-rod": looks should be words/);
  });
});

describe('an unidentified or cursed item’s id (Francis, 2026-11-22, "A", finding 2 of the review of #40)', () => {
  // Purpose: an item that starts unidentified (its category is marked so) or cursed reaches a player's device by its id,
  // so the checker warns when the id shares a word of three letters or more, common words aside, with its true name; an
  // id that hints at nothing, and any id on an ordinary item, are silent.
  it('warns on an id that shares a word with the true name, and only for an unidentified or cursed item', () => {
    const file = {
      rulesSets: [{ id: 'fen-rules', name: 'Fen rules', itemCategories: [{ id: 'ring', name: 'Rings', unidentified: true }] }],
      items: [
        { id: 'ring-of-the-drowned-bell', name: 'Ring of the Drowned Bell', category: 'ring' },
        { id: 'ring-07', name: 'Ring of the Drowned Bell', category: 'ring' },
        { id: 'cursed-blade-of-sorrow', name: 'Sorrow blade', category: 'weapon', cursed: true },
        { id: 'blade-12', name: 'Grim edge', category: 'weapon', weapon: { magicBonus: -1 } },
        { id: 'grim-hook', name: 'Grim hook', category: 'weapon', weapon: { magicBonus: -2 } },
        { id: 'the-fenblade', name: 'Fenblade', category: 'weapon', weapon: { magicBonus: 1 } },
      ],
    };
    const ids = ruledFieldFindings(file).map((f) => f.text.match(/^items: "([^"]+)" starts unidentified/)?.[1]).filter(Boolean);
    expect(ids).toEqual(['ring-of-the-drowned-bell', 'cursed-blade-of-sorrow', 'grim-hook']);
    // A word the face shows anyway (the category's "ring") is no hint; the rest are named.
    expect(ruledFieldFindings(file).find((f) => f.text.includes('ring-of-the-drowned-bell'))?.text).toContain('shares "drowned", "bell" with');
  });

  // Purpose (#176): an id that spells an unidentified item's true name is warned about with or without an apostrophe
  // in the name, typographic (’) or straight ('), and whatever its case or hyphens; an id that hints at nothing stays silent.
  it('warns on an id that spells a true name with an apostrophe, ’ or \'', () => {
    const file = {
      rulesSets: [{ id: 'fen-rules', name: 'Fen rules', itemCategories: [{ id: 'lamp', name: 'Lamps', singular: 'Lamp', unidentified: true }] }],
      items: [
        { id: 'wardens-lamp', name: 'Warden’s lamp', category: 'lamp' },
        { id: 'Wardens-Lantern', name: "Warden's Lamp", category: 'lamp' },
        { id: 'bogwardens-lamp', name: 'Bog-warden’s lamp', category: 'lamp' },
        { id: 'lamp-07', name: 'Warden’s lamp', category: 'lamp' },
      ],
    };
    const ids = ruledFieldFindings(file).map((f) => f.text.match(/^items: "([^"]+)" starts unidentified/)?.[1]).filter(Boolean);
    expect(ids).toEqual(['wardens-lamp', 'Wardens-Lantern', 'bogwardens-lamp']);
    expect(ruledFieldFindings(file).find((f) => f.text.includes('"wardens-lamp"'))?.text).toContain('shares "wardens" with');
  });
});

describe('the command’s exit code', () => {
  // Purpose: a ruled-field error makes `npm run pack:check` exit 1; a warning alone leaves it at 0.
  it('exits 1 on an error and 0 on a warning alone', () => {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'g07-format.fixture.json'), 'utf8'));
    const pack = (extra) => ({ format: fixture.format, formatVersion: fixture.formatVersion, meta: { ...fixture.meta, name: 'Fen sample' }, ...extra });
    const dir = mkdtempSync(join(tmpdir(), 'pack-ruled-'));
    const run = (name, file) => {
      const path = join(dir, name);
      writeFileSync(path, JSON.stringify(file));
      return spawnSync(process.execPath, [join(import.meta.dirname, 'check-pack.mjs'), path], { encoding: 'utf8' });
    };
    try {
      const error = run('error.pack.json', pack({ locations: [{ id: 'reed-ford', name: 'Reed ford', encounterCheck: { name: '' } }] }));
      expect(error.stdout).toContain('Error: locations: "reed-ford": encounterCheck.name should be words');
      expect(error.status).toBe(1);
      const warning = run('warning.pack.json', pack({ locations: [{ id: 'reed-ford', name: 'Reed ford', rules: [{ id: 'sinking-mud', name: 'Sinking mud', text: 'x', gmOnly: true, button: 'warning' }] }] }));
      expect(warning.stdout).toContain('Warning: locations: "reed-ford", rule "sinking-mud" is gmOnly but has a button');
      expect(warning.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
