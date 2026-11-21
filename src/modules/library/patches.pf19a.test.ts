// pf-19a (docs/design/rulings/dec-evening-2026-11-13.md): a patch's set never sets or creates a field its kind hides
// from players by name (a patron's cult and statBlockId), whether or not the entry has it, and never adds a section a
// rules set doesn't have; such a set changes nothing, as before pf-19. Invented names.
import { describe, expect, it } from 'vitest';
import { planSet } from './patchPath.ts';
import { applyPatches, readPatches } from './patches.ts';

const packs = [{ packId: 'zine', name: 'Mire zine', shortName: 'Mire zine' }];
const read = (kind: string, change: Record<string, unknown>) =>
  readPatches([{ kind: 'patch', packId: 'zine', packEntryId: 'patch-1', data: { byOption: 'metals=bone', match: { kind }, change } }], packs);

describe('a field a kind hides by name', () => {
  // Purpose: a set that would create a patron's cult or statBlockId leaves the patron untouched.
  it('never creates a patron’s cult or stat block', () => {
    const patron = { kind: 'patron', packEntryId: 'lantern-warden', data: { name: 'Lantern Warden' } as Record<string, unknown> };
    const done = applyPatches(patron, read('patron', { cult: 'Keepers of the wick', statBlockId: 'bog-lurker', 'cult.name': 'x' }));
    expect(done.data).toBe(patron.data);
    expect(done.lines).toEqual([]);
  });

  // Purpose: a set on a patron that already has a cult leaves it untouched too.
  it('never sets a cult a patron already has', () => {
    const patron = { kind: 'patron', packEntryId: 'lantern-warden', data: { name: 'Lantern Warden', cult: { name: 'Keepers of the wick' } } as Record<string, unknown> };
    const done = applyPatches(patron, read('patron', { cult: 'Reed singers', 'cult.name': 'Reed singers' }));
    expect(done.data).toBe(patron.data);
    expect(done.data.cult).toEqual({ name: 'Keepers of the wick' });
  });

  // Purpose: an ordinary field of a patron is still set, and created, as pf-19 has it.
  it('still sets and creates a patron’s ordinary fields', () => {
    const patron = { kind: 'patron', packEntryId: 'lantern-warden', data: { name: 'Lantern Warden' } as Record<string, unknown> };
    const done = applyPatches(patron, read('patron', { 'favour.gift': 'A lantern that never gutters', name: 'The Lantern Warden' }));
    expect(done.data).toEqual({ name: 'The Lantern Warden', favour: { gift: 'A lantern that never gutters' } });
  });

  // Purpose: a field in an entry's own gmOnly list may still be created (the database hides it by name).
  it('still creates a field in the entry’s own gmOnly list', () => {
    const lamp = { kind: 'item', packEntryId: 'eel-lamp', data: { name: 'Eel lamp', gmOnly: ['notes'] } as Record<string, unknown> };
    expect(applyPatches(lamp, read('item', { notes: 'It hums at night' })).data.notes).toBe('It hums at night');
  });
});

describe('a rules set’s sections', () => {
  const rules = () => ({ kind: 'rulesSet', packEntryId: 'fen-rules', data: { name: 'Fen rules', healing: { perDay: 1 } } as Record<string, unknown> });

  // Purpose: a set that would add a section a rules set doesn't have leaves the rules set untouched.
  it('never adds a section', () => {
    const entry = rules();
    const done = applyPatches(entry, read('rulesSet', { 'weather.tags': ['fog'], monsters: { note: 'x' }, darkness: 'deep' }));
    expect(done.data).toBe(entry.data);
    expect(done.lines).toEqual([]);
  });

  // Purpose: inside a section the rules set has, a set still creates what it lacks, and sets what it has.
  it('still sets and creates inside an existing section', () => {
    const done = applyPatches(rules(), read('rulesSet', { 'healing.perWeek': 7, 'healing.perDay': 2 }));
    expect(done.data.healing).toEqual({ perDay: 2, perWeek: 7 });
  });

  // Purpose: the shared reading says why, in words that keep the reason.
  it('words each refusal', () => {
    expect(planSet({}, 'cult', 'patron')).toMatchObject({ kind: 'refused', reason: 'hidden', text: 'a patch can\'t change "cult" on a patron: it is hidden from players, so it must be in the pack that owns the entry' });
    expect(planSet({ cult: {} }, 'cult.name', 'patron')).toMatchObject({ kind: 'refused', reason: 'hidden' });
    expect(planSet({ name: 'x' }, 'weather.tags', 'rulesSet')).toMatchObject({ kind: 'refused', reason: 'new-section', text: 'a patch can\'t add "weather" to a rules set that doesn\'t have it: a new section may be hidden from players, so it must be in the pack that owns the entry' });
    expect(planSet({ healing: {} }, 'healing.perWeek', 'rulesSet')).toEqual({ kind: 'create', from: 'healing.perWeek' });
    expect(planSet({}, 'cult')).toEqual({ kind: 'create', from: 'cult' });
  });
});

describe('a field a kind hides by name, by any operation (pf-19a, widened)', () => {
  const patron = () => ({ kind: 'patron', packEntryId: 'reed-mother', data: { name: 'Reed mother', cult: { size: 12, dues: 3 }, favour: 2 } as Record<string, unknown> });

  // Purpose: a delta and a multiplier on an existing cult.* path each leave the patron untouched.
  it('never adds to or multiplies a cult’s figures', () => {
    for (const change of [{ 'cult.size': { delta: 3 } }, { 'cult.dues': { times: 2 } }]) {
      const entry = patron();
      const done = applyPatches(entry, read('patron', change));
      expect(done.data).toBe(entry.data);
      expect(done.lines).toEqual([]);
    }
  });

  // Purpose: an ordinary delta on a patron still works.
  it('still applies an ordinary delta', () => {
    expect(applyPatches(patron(), read('patron', { favour: { delta: 1 } })).data.favour).toBe(3);
  });
});
