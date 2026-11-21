// Decide later's "nothing changed" check on a trait list rolled more than once (look-back review of #663; #668's
// review, nit 2). Invented content only.
//   Purpose: the same picks in another order count as unchanged, so re-picking them writes nothing; a different pick,
//   one pick fewer, a second take of an entry, or another spell rolled counts as a change.
import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { traitListsOf, traitSteps, type TraitPick } from '../modules/characters/traitLists.ts';
import { traitUnchanged } from './traitGear.ts';

vi.mock('./services.ts', () => ({ db: null, missingSettings: [], registry: null }));

const field: FieldDefinition = { id: 'mark', campaignId: 'c1', key: 'mark', label: 'mark', type: 'list', choices: [], group: '', order: 0, showOnCard: false, hidden: false, fill: null, required: false, from: 'mire-marks' };
const list = traitListsOf([
  {
    kind: 'traitList',
    packEntryId: 'mire-marks',
    name: 'Mire marks',
    data: {
      die: 'd6',
      rolls: 2,
      entries: [
        { id: 'heron', name: 'Heron feather', min: 1, max: 3 },
        { id: 'eel', name: 'Eel scale', min: 4, max: 6 },
      ],
    },
  },
])[0]!;
const [step] = traitSteps([field], [list]);
const heron: TraitPick = { entryId: 'heron' };
const eel: TraitPick = { entryId: 'eel' };

describe('traitUnchanged', () => {
  it('counts the same picks in another order as unchanged', () => {
    expect(traitUnchanged(step!, [heron, eel], [eel, heron], {}, null)).toBe(true);
    expect(traitUnchanged(step!, [heron, eel], [heron, eel], {}, null)).toBe(true);
  });

  it('counts a different pick, one fewer, or a second take as a change', () => {
    expect(traitUnchanged(step!, [heron, eel], [heron, heron], {}, null)).toBe(false);
    expect(traitUnchanged(step!, [heron, eel], [heron], {}, null)).toBe(false);
    expect(traitUnchanged(step!, [heron], [heron, heron], {}, null)).toBe(false);
  });

  // Purpose (#671 review): typed entries in another order are unchanged; a typed entry whose note changed is a change.
  it('treats typed entries the same way: order does not matter, a changed note does', () => {
    const frog: TraitPick = { other: 'Frog bone', note: 'from a well' };
    const owl: TraitPick = { other: 'Owl at noon', note: '' };
    expect(traitUnchanged(step!, [frog, owl], [owl, frog], {}, null)).toBe(true);
    expect(traitUnchanged(step!, [heron, frog], [frog, heron], {}, null)).toBe(true);
    expect(traitUnchanged(step!, [frog, owl], [{ other: 'Frog bone', note: 'from the river' }, owl], {}, null)).toBe(false);
  });

  it('counts another spell rolled as a change', () => {
    const creation = { traitSpells: { 'mire-marks': { entryId: 'heron', spellId: 'song-hush', roll: 2 } } };
    expect(traitUnchanged(step!, [heron, eel], [eel, heron], creation, { entryId: 'heron', spellId: 'song-hush', roll: 2 })).toBe(true);
    expect(traitUnchanged(step!, [heron, eel], [eel, heron], creation, { entryId: 'heron', spellId: 'song-glow', roll: 1 })).toBe(false);
  });
});
