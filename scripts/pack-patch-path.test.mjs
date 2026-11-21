// pack:check on a patch's path (pf-19, design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md): a set that
// creates a path is listed among the notes; a set that would be refused is an error naming the reason. Invented names.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { patchLibraryErrors, patchLibraryNotes, patchPathErrors } from './pack-option-gates.mjs';

const metals = { kind: 'option', packEntryId: 'metals', data: { choices: [{ id: 'steel' }, { id: 'bone' }] } };
const item = (id, data) => ({ kind: 'item', packEntryId: id, data: { name: id, ...data } });
const base = { name: 'Fen rules', entries: [metals, item('reed-coat', { category: 'armour', armour: { ac: 7 }, size: 'Small', ranks: ['plain'] })], file: {} };
const overlay = (change) => ({ name: 'Mire zine', entries: [], file: { patches: [{ byOption: 'metals=bone', match: { kind: 'item', ids: ['reed-coat'] }, change }] } });
const both = (change) => [base, overlay(change)];

describe('a set that creates a path', () => {
  // Purpose: a set on a path the entry lacks is listed among the notes, naming the path, and is no error.
  it('lists a created path as a note', () => {
    expect(patchLibraryNotes(both({ 'armour.tier': 'heavy', 'figures.height.base': 40 }))).toEqual([
      'Mire zine: patches #1: change "armour.tier": reed-coat: sets a path the entry doesn\'t have: armour.tier.',
      'Mire zine: patches #1: change "figures.height.base": reed-coat: sets a path the entry doesn\'t have: figures.height.base.',
    ]);
    expect(patchLibraryErrors(both({ 'armour.tier': 'heavy' }))).toEqual([]);
  });

  // Purpose: a set on a path the entry has is neither a note nor an error.
  it('is silent for a set on an existing path', () => {
    expect(patchLibraryNotes(both({ 'armour.ac': 6 }))).toEqual([]);
    expect(patchLibraryErrors(both({ 'armour.ac': 6 }))).toEqual([]);
  });

  // Purpose: a delta on a path the entry lacks keeps its old note: it changes nothing.
  it('keeps the old note for a delta on a missing path', () => {
    expect(patchLibraryNotes(both({ 'armour.tier': { delta: 1 } }))).toEqual(['Mire zine: patches #1: change "armour.tier": none of the entry it matches has that field, so it changes nothing.']);
  });
});

describe('a set that would be refused', () => {
  // Purpose (pf-19c, widening pf-19): a numeric step under a missing object is a key, not a list index: no error.
  it('takes a numeric step under a missing object as a key', () => {
    expect(patchLibraryErrors(both({ 'levelNames.0': { one: 'Glimmer', many: 'Glimmers' } }))).toEqual([]);
  });

  // Purpose: a list that is there is never set into: an error naming the reason.
  it('errs on a set into a list', () => {
    expect(patchLibraryErrors(both({ 'ranks.0': 'Pup' }))).toEqual([
      'Mire zine: patches #1: change "ranks.0" is refused on reed-coat: "ranks" is a list, not a group of fields; a patch never overwrites it.',
    ]);
  });

  // Purpose: a step that is words, a number or a list is an error naming the reason; nothing is overwritten.
  it('errs on a value in the way', () => {
    expect(patchLibraryErrors(both({ 'size.height': 40, 'armour.ac.base': 3, 'ranks.first': 'x' }))).toEqual([
      'Mire zine: patches #1: change "size.height" is refused on reed-coat: "size" is words, not a group of fields; a patch never overwrites it.',
      'Mire zine: patches #1: change "armour.ac.base" is refused on reed-coat: "armour.ac" is a number, not a group of fields; a patch never overwrites it.',
      'Mire zine: patches #1: change "ranks.first" is refused on reed-coat: "ranks" is a list, not a group of fields; a patch never overwrites it.',
    ]);
  });

  // Purpose: a forbidden or empty step is an error in the one file alone, for any kind of change, and only there.
  it('errs on __proto__, constructor, prototype or an empty step, once', () => {
    const file = { patches: [{ byOption: 'metals=bone', match: { kind: 'item' }, change: { '__proto__.polluted': 1, 'a.constructor': { delta: 1 }, 'prototype': 'x', 'a..b': 2 } }] };
    expect(patchPathErrors(file)).toEqual([
      'patches #1: change "__proto__.polluted" is refused: "__proto__" is a name a patch may never use.',
      'patches #1: change "a.constructor" is refused: "constructor" is a name a patch may never use.',
      'patches #1: change "prototype" is refused: "prototype" is a name a patch may never use.',
      'patches #1: change "a..b" is refused: "a..b" has an empty step.',
    ]);
    expect(patchLibraryErrors(both({ '__proto__.polluted': 1 }))).toEqual([]);
    expect(({}).polluted).toBeUndefined();
  });
});

describe('the existing fixtures', () => {
  // Purpose: no existing fixture has a refused patch path, and the materials pair has no refused set.
  it('report no new error', () => {
    const dir = join(import.meta.dirname, 'fixtures');
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) expect(patchPathErrors(JSON.parse(readFileSync(join(dir, name), 'utf8'))), name).toEqual([]);
  });
});

describe('the command', () => {
  // Purpose: a refused set makes the packs checked together exit 1 with an "Errors" line; a created path alone exits 0.
  it('exits 1 on a refused set and 0 on a created path', () => {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'g07-format.fixture.json'), 'utf8'));
    const pack = (name, extra) => ({ format: fixture.format, formatVersion: fixture.formatVersion, meta: { ...fixture.meta, name }, ...extra });
    const dir = mkdtempSync(join(tmpdir(), 'pf19-'));
    const write = (name, file) => {
      const path = join(dir, name);
      writeFileSync(path, JSON.stringify(file));
      return path;
    };
    const fen = write('fen.pack.json', pack('Fen rules', { options: [{ id: 'metals', name: 'Metals', default: 'steel', choices: [{ id: 'steel', name: 'Steel' }, { id: 'bone', name: 'Bone' }] }], items: [{ id: 'reed-coat', name: 'Reed coat', category: 'armour', size: 'Small', value: { gp: 1 }, weightCoin: 10 }] }));
    const run = (change) => {
      const mire = write('mire.pack.json', pack('Mire zine', { patches: [{ byOption: 'metals=bone', match: { kind: 'item', ids: ['reed-coat'] }, change }] }));
      return spawnSync(process.execPath, [join(import.meta.dirname, 'check-pack.mjs'), fen, mire], { encoding: 'utf8' });
    };
    try {
      const refused = run({ 'size.height': 40 });
      expect(refused.stdout).toContain('Errors (1):');
      expect(refused.stdout).toContain('is refused on reed-coat: "size" is words');
      expect(refused.status).toBe(1);
      const created = run({ 'figures.height': 40 });
      expect(created.stdout).toContain('sets a path the entry doesn\'t have: figures.height.');
      expect(created.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
