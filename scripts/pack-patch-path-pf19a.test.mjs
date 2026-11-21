// pack:check on pf-19a (docs/design/rulings/dec-evening-2026-11-13.md) and the #720 review's nits: a set on a field a
// kind hides by name, or a new rules set section, is an error naming the reason; a patch's sets are planned in its own
// order; a delta on a path a set makes isn't "changes nothing"; a path is read trimmed. Invented names.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { patchLibraryErrors, patchLibraryNotes, patchPathErrors } from './pack-option-gates.mjs';

const metals = { kind: 'option', packEntryId: 'metals', data: { choices: [{ id: 'steel' }, { id: 'bone' }] } };
const entry = (kind, id, data) => ({ kind, packEntryId: id, data: { name: id, ...data } });
const base = {
  name: 'Fen rules',
  entries: [
    metals,
    entry('patron', 'lantern-warden', {}),
    entry('patron', 'reed-mother', { cult: { name: 'Reed singers' } }),
    entry('rulesSet', 'fen-rules', { healing: { perDay: 1 } }),
    entry('item', 'reed-coat', { category: 'armour', armour: { ac: 7 } }),
  ],
  file: {},
};
const overlay = (...patches) => ({ name: 'Mire zine', entries: [], file: { patches: patches.map(([kind, change, ids]) => ({ byOption: 'metals=bone', match: { kind, ...(ids ? { ids } : {}) }, change })) } });

describe('pf-19a in the checker', () => {
  // Purpose: a set that would create a patron's cult or stat block is an error naming the reason, from the one file
  // (the match's kind and the path's first step suffice), and isn't said a second time when checked together.
  it('names a patron’s hidden field created', () => {
    const packs = [base, overlay(['patron', { statBlockId: 'bog-lurker' }, ['lantern-warden']])];
    expect(patchPathErrors(packs[1].file)).toEqual([
      'patches #1: change "statBlockId" is refused: a patch can\'t change "statBlockId" on a patron: it is hidden from players, so it must be in the pack that owns the entry.',
    ]);
    expect(patchLibraryErrors(packs)).toEqual([]);
  });

  // Purpose: a set on a patron that already has a cult is an error too.
  it('names a patron’s hidden field already there', () => {
    expect(patchPathErrors(overlay(['patron', { 'cult.name': 'Bog choir' }, ['reed-mother']]).file)).toEqual([
      'patches #1: change "cult.name" is refused: a patch can\'t change "cult" on a patron: it is hidden from players, so it must be in the pack that owns the entry.',
    ]);
  });

  // Purpose: a set that would add a section a rules set lacks is an error; inside an existing section it is a note.
  it('names a new rules set section, and lists a path made inside an existing one', () => {
    const packs = [base, overlay(['rulesSet', { 'weather.tags': ['fog'], 'healing.perWeek': 7 }])];
    expect(patchLibraryErrors(packs)).toEqual([
      'Mire zine: patches #1: change "weather.tags" is refused on fen-rules: a patch can\'t add "weather" to a rules set that doesn\'t have it: a new section may be hidden from players, so it must be in the pack that owns the entry.',
    ]);
    expect(patchLibraryNotes(packs)).toEqual(['Mire zine: patches #1: change "healing.perWeek": fen-rules: sets a path the entry doesn\'t have: healing.perWeek.']);
  });
});

describe('the review’s nits', () => {
  // Purpose: a patch's sets are planned in its own order, as the app applies them: a number set at "figures" refuses
  // "figures.height" after it, and no "sets a path" note is given for it.
  it('plans a patch’s sets in order', () => {
    const packs = [base, overlay(['item', { figures: 5, 'figures.height': 40 }, ['reed-coat']])];
    expect(patchLibraryErrors(packs)).toEqual([
      'Mire zine: patches #1: change "figures.height" is refused on reed-coat: "figures" is a number, not a group of fields; a patch never overwrites it.',
    ]);
    expect(patchLibraryNotes(packs)).toEqual(['Mire zine: patches #1: change "figures": reed-coat: sets a path the entry doesn\'t have: figures.']);
  });

  // Purpose: a set made earlier in the same patch is there for a later set inside it: a note, not an error.
  it('lets a later set use a path an earlier one made', () => {
    const packs = [base, overlay(['item', { figures: {}, 'figures.height': 40 }, ['reed-coat']])];
    expect(patchLibraryErrors(packs)).toEqual([]);
  });

  // Purpose: a delta on a path another patch's set makes isn't "changes nothing".
  it('does not call a delta after a making set "changes nothing"', () => {
    const packs = [base, overlay(['item', { weight: 30 }, ['reed-coat']], ['item', { weight: { delta: 5 } }, ['reed-coat']])];
    expect(patchLibraryNotes(packs)).toEqual(['Mire zine: patches #1: change "weight": reed-coat: sets a path the entry doesn\'t have: weight.']);
  });

  // Purpose: a path with spaces round it is read trimmed, as everywhere else.
  it('reads a path trimmed', () => {
    const packs = [base, overlay(['item', { ' armour.tier ': 'heavy' }, ['reed-coat']])];
    expect(patchLibraryNotes(packs)).toEqual(['Mire zine: patches #1: change " armour.tier ": reed-coat: sets a path the entry doesn\'t have: armour.tier.']);
    expect(patchLibraryErrors(packs)).toEqual([]);
  });
});

describe('a field a kind hides by name, by any operation (pf-19a, widened)', () => {
  // Purpose: a delta and a multiplier on an existing cult.* path are each named by the checker, from the one file.
  it('names a delta and a multiplier on a cult from one file', () => {
    expect(patchPathErrors(overlay(['patron', { 'cult.size': { delta: 3 }, 'cult.dues': { times: 2 }, favour: { delta: 1 } }, ['reed-mother']]).file)).toEqual([
      'patches #1: change "cult.size" is refused: a patch can\'t change "cult" on a patron: it is hidden from players, so it must be in the pack that owns the entry.',
      'patches #1: change "cult.dues" is refused: a patch can\'t change "cult" on a patron: it is hidden from players, so it must be in the pack that owns the entry.',
    ]);
  });
});

describe('the command, on a patron’s hidden field (pf-19a)', () => {
  // Purpose: pack:check names a set, a delta and a multiplier on a patron's cult or stat block from the overlay alone, and
  // once when it is checked with the pack that has the patron; either way it exits 1.
  it('names each from one file and together, once, and exits 1', () => {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'g07-format.fixture.json'), 'utf8'));
    const pack = (name, extra) => ({ format: fixture.format, formatVersion: fixture.formatVersion, meta: { ...fixture.meta, name }, ...extra });
    const dir = mkdtempSync(join(tmpdir(), 'pf19a-'));
    const write = (name, file) => {
      const path = join(dir, name);
      writeFileSync(path, JSON.stringify(file));
      return path;
    };
    const fen = write('fen.pack.json', pack('Fen rules', { options: [{ id: 'metals', name: 'Metals', default: 'steel', choices: [{ id: 'steel', name: 'Steel' }, { id: 'bone', name: 'Bone' }] }] }));
    const mire = write('mire.pack.json', pack('Mire zine', { patches: [{ byOption: 'metals=bone', match: { kind: 'patron' }, change: { statBlockId: 'bog-lurker', 'cult.size': { delta: 3 }, 'cult.dues': { times: 2 } } }] }));
    const check = (...files) => spawnSync(process.execPath, [join(import.meta.dirname, 'check-pack.mjs'), ...files], { encoding: 'utf8' });
    try {
      for (const run of [check(mire), check(fen, mire)]) {
        for (const path of ['statBlockId', 'cult.size', 'cult.dues']) {
          expect(run.stdout.split(`change "${path}" is refused`).length - 1).toBe(1);
        }
        expect(run.stdout).toContain('it is hidden from players, so it must be in the pack that owns the entry');
        expect(run.status).toBe(1);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
