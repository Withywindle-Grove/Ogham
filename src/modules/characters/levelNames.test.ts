// lv-1 (Francis, 2026-11-14) and pf-22 (the lead, 2026-11-14): a spell list may name its levels, `levelNames`, a map
// from a level to `{ one, many }`; the app writes the list's own word for a level, and its approved fallback words where
// the list gives none ("Level 0"; levels 1 and up keep today's words). Invented lists and words only. In plain words:
//   * a list's `levelNames` is read for any level (0, 2), the singular and the plural; a level it doesn't name, a list
//     without any, a malformed entry (no `one` or no `many`, a key that isn't a whole number of 0 or more): no name;
//   * an add-on names a level on another pack's list with an ordinary patch (`levelNames.0`), and the patched list is
//     what is read; on a list that names other levels already, and on one with no names at all;
//   * every use's word: the heading and a count ("Glimmers: pick 2", "2 Glimmers"), a single spell ("Glimmer"), with
//     their fallbacks: "Level 0", "2 level 0 spells", "3 at level 0", "level 0 spell"; levels 1 and up keep today's
//     words where nothing names them ("Level 1", "level 2 spell", "1", and a count of spells).
import { describe, expect, it } from 'vitest';
import { applyPatches, readPatches } from '../library/patches.ts';
import { levelNameOf, levelWord, startCapital } from './levelNames.ts';

const list = (levelNames?: unknown) => ({ packEntryId: 'list-fen-witch', name: 'Fen witch spells', data: { levels: [{ level: 0, spells: ['frog-chorus'] }], ...(levelNames === undefined ? {} : { levelNames }) } as Record<string, unknown> });
const GLIMMER = { one: 'Glimmer', many: 'Glimmers' };

describe('a list’s names for its levels (pf-22)', () => {
  // Purpose: the list's own words for a level, any level, singular and plural.
  it('reads the names a list gives, for any level', () => {
    const named = list({ '0': GLIMMER, '2': { one: 'Deep rite', many: 'Deep rites' } });
    expect(levelNameOf(named, 0)).toEqual(GLIMMER);
    expect(levelNameOf(named, 2)).toEqual({ one: 'Deep rite', many: 'Deep rites' });
    expect(levelNameOf(named, 1)).toBeNull();
  });

  // Purpose: no list, a list without names, and malformed names give no name (the fallback words apply).
  it('no name without a list, without names, or with a malformed entry', () => {
    expect(levelNameOf(null, 0)).toBeNull();
    expect(levelNameOf(list(), 0)).toBeNull();
    expect(levelNameOf(list({ '0': { one: 'Glimmer' } }), 0)).toBeNull();
    expect(levelNameOf(list({ '0': { many: 'Glimmers' } }), 0)).toBeNull();
    expect(levelNameOf(list({ '0': { one: ' ', many: 'Glimmers' } }), 0)).toBeNull();
    expect(levelNameOf(list({ '0': 'Glimmer' }), 0)).toBeNull();
    expect(levelNameOf(list(['Glimmer']), 0)).toBeNull();
  });
});

describe('patched-in names (pf-22 with pf-19)', () => {
  const packs = [{ packId: 'fen-zine', name: 'Fen zine', shortName: 'Fen zine' }];
  const patch = (change: Record<string, unknown>) =>
    readPatches([{ kind: 'patch', packId: 'fen-zine', packEntryId: 'patch-glimmers', data: { byOption: 'fen-glimmers=on', match: { kind: 'spellList', ids: ['list-fen-witch'] }, change } }], packs);

  // Purpose: an add-on names level 0 on another pack's list that names no level yet; the patched list is what's read.
  it('a patch names a level on a list with no names', () => {
    const done = applyPatches({ kind: 'spellList', ...list() }, patch({ 'levelNames.0': GLIMMER }));
    expect(levelNameOf({ data: done.data }, 0)).toEqual(GLIMMER);
  });

  // Purpose: on a list that names another level already, the patch adds its level and keeps the other.
  it('a patch names a level beside one the list names', () => {
    const done = applyPatches({ kind: 'spellList', ...list({ '2': { one: 'Deep rite', many: 'Deep rites' } }) }, patch({ 'levelNames.0': GLIMMER }));
    expect(levelNameOf({ data: done.data }, 0)).toEqual(GLIMMER);
    expect(levelNameOf({ data: done.data }, 2)).toEqual({ one: 'Deep rite', many: 'Deep rites' });
  });
});

describe('a level’s word, each use (lv-1)', () => {
  // Purpose: with a name, every use takes the list's own word: the plural for a heading and for several, the singular
  // for one.
  it('named: the list’s own word in every use', () => {
    expect(levelWord(GLIMMER, 0, 'title')).toBe('Glimmers');
    expect(levelWord(GLIMMER, 0, 'spell')).toBe('Glimmer');
    expect(levelWord(GLIMMER, 0, 'value')).toBe('Glimmer');
    expect(levelWord(GLIMMER, 0, 'aSpell')).toBe('Glimmer');
    expect(levelWord(GLIMMER, 0, { count: 1 })).toBe('1 Glimmer');
    expect(levelWord(GLIMMER, 0, { count: 2 })).toBe('2 Glimmers');
    expect(levelWord(GLIMMER, 0, { inBook: 1 })).toBe('1 Glimmer');
    expect(levelWord(GLIMMER, 0, { inBook: 3 })).toBe('3 Glimmers');
  });

  // Purpose: at level 0 with no name, the approved fallback words (the lead, 2026-11-14, words 1 to 6); under a "Level"
  // label the number alone (the lead's answer (a), 2026-11-14).
  it('level 0 unnamed: "Level 0", "2 level 0 spells", "3 at level 0", "level 0 spell"; "0" under a label', () => {
    expect(levelWord(null, 0, 'title')).toBe('Level 0');
    expect(levelWord(null, 0, 'spell')).toBe('Level 0');
    expect(levelWord(null, 0, 'value')).toBe('0');
    expect(levelWord(null, 0, 'aSpell')).toBe('level 0 spell');
    expect(levelWord(null, 0, { count: 1 })).toBe('1 level 0 spell');
    expect(levelWord(null, 0, { count: 2 })).toBe('2 level 0 spells');
    expect(levelWord(null, 0, { inBook: 3 })).toBe('3 at level 0');
  });

  // Purpose (lv-1, the Builder's addition 1): a pack stores the words as printed mid-sentence, so a lower-case name
  // takes a capital where it starts a title or a line ('title', 'spell', 'value'), and stays as stored inside a
  // sentence ('aSpell', a count).
  it('a lower-case name: a capital at the start of a title or a line, as stored inside a sentence', () => {
    const lesser = { one: 'lesser glimmer', many: 'lesser glimmers' };
    expect(levelWord(lesser, 0, 'title')).toBe('Lesser glimmers');
    expect(levelWord(lesser, 0, 'spell')).toBe('Lesser glimmer');
    expect(levelWord(lesser, 0, 'value')).toBe('Lesser glimmer');
    expect(levelWord(lesser, 0, 'aSpell')).toBe('lesser glimmer');
    expect(levelWord(lesser, 0, { count: 3 })).toBe('3 lesser glimmers');
    expect(levelWord(lesser, 0, { inBook: 1 })).toBe('1 lesser glimmer');
    expect(startCapital('lesser glimmers')).toBe('Lesser glimmers');
    expect(startCapital('Ærin rite')).toBe('Ærin rite');
    expect(startCapital('')).toBe('');
  });

  // Purpose: levels 1 and up keep today's words where nothing names them, and take a name where one is given.
  it('levels 1 and up: today’s words unnamed, the name where given', () => {
    expect(levelWord(null, 1, 'title')).toBe('Level 1');
    expect(levelWord(null, 1, 'spell')).toBe('Level 1');
    expect(levelWord(null, 1, 'value')).toBe('1');
    expect(levelWord(null, 2, 'aSpell')).toBe('level 2 spell');
    expect(levelWord(null, 1, { count: 2 })).toBe('2 level 1 spells');
    expect(levelWord(null, 1, { inBook: 3 })).toBe('3 at level 1');
    expect(levelWord({ one: 'Deep rite', many: 'Deep rites' }, 2, 'title')).toBe('Deep rites');
    expect(levelWord({ one: 'Deep rite', many: 'Deep rites' }, 2, 'value')).toBe('Deep rite');
  });
});
