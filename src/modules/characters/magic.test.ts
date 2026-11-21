// The full sheet's Magic section (sr-4): who has one, the spells a day, and a tab per kind of magic. Invented data.
import { describe, expect, it } from 'vitest';
import { besidePlayColumn, magicOf, tabLabel } from './magic.ts';
import type { SpellEntry } from './firstSpells.ts';

const spell = (id: string, name: string, data: Record<string, unknown> = {}): SpellEntry => ({ packEntryId: id, name, data: { id, name, ...data } });
const list = (id: string, name: string, levels: { level: number; spells: string[] }[]): SpellEntry => ({ packEntryId: id, name, data: { id, name, levels } });

const SPELLS = [
  spell('glimmer', 'Glimmer', { duration: { value: 3, unit: 'turn' }, range: '40 ft' }),
  spell('reed-whisper', 'Reed whisper', { duration: 'instant', range: 'touch' }),
  spell('mire-grip', 'Mire grip', { duration: { value: 2, unit: 'round' }, range: '70 ft' }),
  spell('dry-boots', 'Dry boots', { duration: 'half a day', range: 'touch' }),
  spell('heron-hush', 'Heron hush', { range: 'self' }),
  spell('moss-knack', 'Moss knack'),
  spell('stray', 'Stray charm'),
];
const LISTS = [
  list('witch-list', 'Reed witch spells', [
    { level: 0, spells: ['dry-boots'] },
    { level: 1, spells: ['glimmer', 'reed-whisper'] },
    { level: 2, spells: ['mire-grip'] },
  ]),
  list('glamours', 'Glamours', [{ level: 1, spells: ['heron-hush'] }]),
  list('knacks', 'Bogling knacks', [{ level: 1, spells: ['moss-knack'] }]),
];
const witch: SpellEntry = { packEntryId: 'reed-witch', name: 'Reed Witch', data: { spellcasting: { listId: 'witch-list', type: 'book', fromLevel: 1, firstSpells: { given: ['glimmer'] } } } };
const fighter: SpellEntry = { packEntryId: 'pike-guard', name: 'Pike Guard', data: {} };
const base = { race: null, level: 3, book: [], prepared: [], slots: [], spells: SPELLS, lists: LISTS };

describe('magicOf', () => {
  it('gives a character whose class casts nothing, with no kindred grant and an empty book, no Magic section', () => {
    expect(magicOf({ ...base, klass: fighter })).toBeNull();
    expect(magicOf({ ...base, klass: null })).toBeNull();
  });

  it('gives a divine caster below the level it casts from, with nothing yet, no Magic section', () => {
    const chaplain: SpellEntry = { packEntryId: 'chaplain', name: 'Marsh Chaplain', data: { spellcasting: { listId: 'witch-list', type: 'divine', fromLevel: 2 } } };
    expect(magicOf({ ...base, klass: chaplain, level: 1 })).toBeNull();
  });

  it("reads the spells a day as one entry per level that has any, never the zeros", () => {
    const magic = magicOf({ ...base, klass: witch, slots: [3, 0, 2] })!;
    expect(magic.perDay).toEqual([
      { level: 1, count: 3, title: 'Level 1' },
      { level: 3, count: 2, title: 'Level 3' },
    ]);
  });

  // Purpose (lv-1, pf-22; the lead's (a), 2026-11-14): where the class's list names a level, the spells a day read the
  // list's plural with a capital, as the Magic tab's heading does; a level it doesn't name keeps "Level N".
  it("reads the spells a day in the class's list's words where it names the level, else Level N", () => {
    const named = LISTS.map((l) => (l.packEntryId === 'witch-list' ? { ...l, data: { ...l.data, levelNames: { '1': { one: 'marsh vesper', many: 'marsh vespers' } } } } : l));
    const magic = magicOf({ ...base, lists: named, klass: witch, slots: [3, 2] })!;
    expect(magic.perDay).toEqual([
      { level: 1, count: 3, title: 'Marsh vespers' },
      { level: 2, count: 2, title: 'Level 2' },
    ]);
  });

  it("puts a book caster's spells on a Spell book tab, by level, each with its level, duration and range, the given one tagged", () => {
    const magic = magicOf({ ...base, klass: witch, slots: [3, 2], book: ['mire-grip', 'reed-whisper', 'glimmer', 'dry-boots'] })!;
    const book = magic.tabs[0]!;
    expect(book.title).toBe('Spell book');
    expect(book.rows.map((r) => [r.name, r.facts, r.given])).toEqual([
      ['Dry boots', 'Level 0, half a day, touch', false],
      ['Reed whisper', 'Level 1, instant, touch', false],
      ['Glimmer', 'Level 1, 3 turns, 40 ft', true],
      ['Mire grip', 'Level 2, 2 rounds, 70 ft', false],
    ]);
    // sp-1 (2026-11-10): the level-0 spell is counted apart (lv-1: by its level, the list naming none).
    expect(tabLabel(book)).toBe('Spell book: 3 spells, 1 at level 0');
  });

  it('still shows the section for a caster with no spells picked: an empty Spell book that says so, and Prepared', () => {
    const magic = magicOf({ ...base, klass: witch, level: 1, slots: [2] })!;
    expect(magic.tabs.map((t) => [tabLabel(t), t.empty])).toEqual([
      ['Spell book: 0', 'No spells in your book yet.'],
      ['Prepared: 0', 'Nothing prepared yet.'],
    ]);
  });

  it("gives each other kind of magic its own tab, named as the pack names its list, after the Spell book and Prepared", () => {
    const magic = magicOf({ ...base, klass: witch, slots: [2], book: ['glimmer', 'heron-hush', 'moss-knack'] })!;
    expect(magic.tabs.map(tabLabel)).toEqual(['Spell book: 1', 'Prepared: 0', 'Glamours: 1', 'Bogling knacks: 1']);
  });

  it("shows a known-magic class's own list as a tab even before anything is picked, and a kindred's grant makes a section for a class that casts nothing", () => {
    const wispCaller: SpellEntry = { packEntryId: 'wisp-caller', name: 'Wisp Caller', data: { spellcasting: { listId: 'glamours', fromLevel: 1 } } };
    expect(magicOf({ ...base, klass: wispCaller })!.tabs.map((t) => [tabLabel(t), t.empty])).toEqual([['Glamours: 0', 'No glamours yet.']]);
    const bogling: SpellEntry = { packEntryId: 'bogling', name: 'Bogling', data: { firstSpells: { rollTable: 'knack-roll' } } };
    expect(magicOf({ ...base, klass: fighter, race: bogling, book: ['moss-knack'] })!.tabs.map(tabLabel)).toEqual(['Bogling knacks: 1']);
  });

  it('lists a spell prepared twice once, "×2", untagged, and counts it twice on the tab', () => {
    const magic = magicOf({ ...base, klass: witch, slots: [3, 2], prepared: [{ spell: 'mire-grip', level: 2 }, { spell: 'glimmer', level: 1 }, { spell: 'glimmer', level: 1 }] })!;
    const prepared = magic.tabs.find((t) => t.id === 'prepared')!;
    expect(prepared.rows.map((r) => [r.name, r.times, r.given])).toEqual([
      ['Glimmer', 2, false],
      ['Mire grip', 1, false],
    ]);
    expect(tabLabel(prepared)).toBe('Prepared: 3');
  });

  it("keeps a spell on no list in a book caster's book, and with the other magic for anyone else", () => {
    expect(magicOf({ ...base, klass: witch, book: ['stray'] })!.tabs[0]!.rows.map((r) => r.name)).toEqual(['Stray charm']);
    const bogling: SpellEntry = { packEntryId: 'bogling', name: 'Bogling', data: { firstSpells: {} } };
    expect(magicOf({ ...base, klass: fighter, race: bogling, book: ['stray'] })!.tabs.map(tabLabel)).toEqual(['Other magic: 1']);
  });

  it('names a spell the setting no longer has by its id rather than dropping it', () => {
    expect(magicOf({ ...base, klass: witch, book: ['lost-spell'] })!.tabs[0]!.rows.map((r) => r.name)).toEqual(['lost-spell']);
  });

  // F41 (gate rewalk 2026-11-10): a cantrip whose `lists` names the class (not the list) at level 0, as creation reads
  // it, showed on the sheet as "Level 1". It is a cantrip on the class's own list.
  it("labels a spell keyed to the class at level 0 by its level, as creation does, not Level 1", () => {
    const pondSpark = spell('pond-spark', 'Pond spark', { range: 'touch', lists: { 'reed-witch': 0 } });
    const magic = magicOf({ ...base, klass: witch, spells: [...SPELLS, pondSpark], book: ['glimmer', 'pond-spark'] })!;
    expect(magic.tabs[0]!.rows.map((r) => [r.name, r.facts])).toEqual([
      ['Pond spark', 'Level 0, touch'],
      ['Glimmer', 'Level 1, 3 turns, 40 ft'],
    ]);
  });

  // sp-1 (2026-11-10): cantrips are in the book but are not mistaken for spells.
  it('counts the spell book\'s level-0 spells apart: "Spell book: 1 spell, 3 at level 0", and a book without them keeps one number', () => {
    const extra = [spell('pond-spark', 'Pond spark', { lists: { 'witch-list': 0 } }), spell('newt-call', 'Newt call', { lists: { 'witch-list': 0 } })];
    const withCantrips = magicOf({ ...base, klass: witch, spells: [...SPELLS, ...extra], book: ['glimmer', 'dry-boots', 'pond-spark', 'newt-call'] })!;
    expect(tabLabel(withCantrips.tabs[0]!)).toBe('Spell book: 1 spell, 3 at level 0');
    expect(tabLabel(magicOf({ ...base, klass: witch, book: ['glimmer', 'reed-whisper'] })!.tabs[0]!)).toBe('Spell book: 2');
    expect(tabLabel(magicOf({ ...base, klass: witch, book: ['dry-boots'] })!.tabs[0]!)).toBe('Spell book: 1 at level 0');
  });

  // Review nit 2: with no list for the class in the packs, a spell keyed to the class keeps its level there too.
  it('reads the level of a spell keyed to the class when the class has no list in the packs', () => {
    const pondSpark = spell('pond-spark', 'Pond spark', { range: 'touch', lists: { 'reed-witch': 0 } });
    const listless: SpellEntry = { ...witch, data: { spellcasting: { listId: 'missing-list', type: 'book', fromLevel: 1 } } };
    const magic = magicOf({ ...base, klass: listless, spells: [...SPELLS, pondSpark], book: ['pond-spark'] })!;
    expect(magic.tabs[0]!.rows.map((r) => r.facts)).toEqual(['Level 0, touch']);
  });

  // F45, option B: the powers a known-only class picks at creation land on its list's tab under the list's name.
  it("puts a known-only class's picked powers on its list's tab, named by the list", () => {
    const listener: SpellEntry = { packEntryId: 'ember-listener', name: 'Ember Listener', data: { spellcasting: { listId: 'glamours', fromLevel: 1, known: { byLevel: [{ level: 1, count: 1 }], listLevel: 1 } } } };
    const magic = magicOf({ ...base, klass: listener, book: ['heron-hush'] })!;
    expect(magic.tabs.map((t) => tabLabel(t))).toEqual(['Glamours: 1']);
  });
});

describe('besidePlayColumn', () => {
  // Purpose: beside the play column (a landscape tablet) the Magic section has no Prepared tab, since the Magic tab
  // shows the same spells one column away (mp-21); every other kind keeps its tab, in order, the Spell book first.
  it('drops Prepared and keeps the Spell book and every other list, in order', () => {
    const magic = magicOf({ ...base, klass: witch, slots: [2], book: ['glimmer', 'heron-hush'], prepared: [{ spell: 'glimmer', level: 1 }] })!;
    expect(magic.tabs.map(tabLabel)).toEqual(['Spell book: 1', 'Prepared: 1', 'Glamours: 1']);
    const beside = besidePlayColumn(magic)!;
    expect(beside.tabs.map(tabLabel)).toEqual(['Spell book: 1', 'Glamours: 1']);
    expect(beside.perDay).toEqual(magic.perDay);
    // Opened on its own, the sheet keeps it: the section given is untouched.
    expect(magic.tabs.map((t) => t.id)).toContain('prepared');
  });

  // Purpose: beside the play column a section that would be empty is not shown: spells ready, but no slots a day and no
  // other kind of magic (the review of #787). With slots a day it stays, its pips alone.
  it('gives no section when only Prepared was in it and there are no slots; keeps the pips when there are', () => {
    const prayer: SpellEntry = { packEntryId: 'fen-chaplain', name: 'Fen Chaplain', data: { spellcasting: { listId: 'witch-list', type: 'divine', fromLevel: 1 } } };
    const readyOnly = magicOf({ ...base, klass: fighter, prepared: [{ spell: 'glimmer', level: 1 }] })!;
    expect(readyOnly.tabs.map((t) => t.id)).toEqual(['prepared']);
    expect(besidePlayColumn(readyOnly)).toBeNull();
    const withSlots = besidePlayColumn(magicOf({ ...base, klass: prayer, slots: [2], prepared: [{ spell: 'glimmer', level: 1 }] })!)!;
    expect(withSlots.tabs).toEqual([]);
    expect(withSlots.perDay).toEqual([{ level: 1, count: 2, title: 'Level 1' }]);
  });
});
