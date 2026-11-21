import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from './fields.ts';
import { classEntry, fieldEntries, raceEntry, type EntryContext, type ListedEntry } from './listEntries.ts';

// Invented content only (hard rule 2).
const all: ListedEntry[] = [
  { kind: 'race', packEntryId: 'stone-kin', name: 'Stone kin', packId: 'fen', data: { blurb: 'Slow and sure.', source: 'p. 6', classMaxLevels: { 'lantern-warden': 8 } } },
  { kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', packId: 'fen', data: { blurb: 'Keeps the lights.', source: 'p. 10', hitDie: 'd8' } },
  { kind: 'item', packEntryId: 'eel-knife', name: 'Eel knife', packId: 'fen', data: {} },
  {
    kind: 'traitList',
    packEntryId: 'fen-omens',
    name: 'Birth omens',
    packId: 'fen',
    data: { die: 'd4', source: 'Fen rules p. 16', entries: [{ id: 'heron-at-dawn', name: 'Heron at dawn', min: 1, max: 2, blurb: 'Patient; waits out any ambush.', notes: 'Once a day, wait out a surprise.', items: [{ itemId: 'eel-knife', qty: 1 }] }] },
  },
  {
    kind: 'rulesSet',
    packEntryId: 'fen-rules',
    name: 'Fen rules',
    packId: 'fen',
    data: {},
  },
];
const rulesSets = [
  {
    languages: { common: ['fen-common'], list: [{ id: 'fen-common', name: 'Fen common', blurb: 'What everyone in the fens speaks.', source: 'Fen rules p. 9' }, { id: 'old-lantern', name: 'Old lantern', blurb: 'The wardens’ chant.', note: 'Only wardens learn it.' }] },
    alignmentNotes: { general: 'Which way your character leans when the lights go out.', Lantern: 'Keeps the lights lit for everyone.' },
  },
];
const ctx: EntryContext = { all, rulesSets, packName: (id) => (id === 'fen' ? 'Fen rules' : ''), scores: {}, label: (k) => k, raceRef: 'stone-kin', classRef: 'lantern-warden' };
const field = (key: string, extra: Partial<FieldDefinition> = {}): FieldDefinition => ({ id: key, campaignId: 'c', key, label: key, type: 'text', choices: [], group: '', order: 0, showOnCard: false, hidden: false, fill: null, required: false, from: null, ...extra });

describe('every pack-list value opens its entry (ct3-11, 2026-11-03)', () => {
  it('a tapped moon sign (a trait list value) opens its entry: what it is, what it does, source and page', () => {
    // Purpose: the omen on the sheet opens the same entry the creation step shows, with the list's source.
    const omen = field('omen', { type: 'list', from: 'fen-omens' });
    const [entry] = fieldEntries(ctx, omen, 'heron-at-dawn', [omen]);
    expect(entry).toMatchObject({ name: 'Heron at dawn', meta: 'Fen rules, Fen rules p. 16', lead: 'Patient; waits out any ambush.' });
    expect(entry!.headings).toEqual([
      { label: 'From', text: 'Birth omens' },
      { label: 'Roll', text: '1–2 on d4' },
      { label: 'Rules', text: 'Once a day, wait out a surprise.' },
      { label: 'Starts with', text: 'Eel knife, added to your pack when picked' },
    ]);
    // Saved by its name, it opens the same entry.
    expect(fieldEntries(ctx, omen, 'Heron at dawn', [omen])[0]?.name).toBe('Heron at dawn');
  });

  it('each language the list has opens its own entry; a language of the GM’s own has none', () => {
    // Purpose: languages are tapped one by one; a typed one stays words.
    const entries = fieldEntries(ctx, field('languages'), 'Fen common, Old lantern, Marsh whistle', []);
    expect(entries.map((e) => [e.name, e.meta, e.lead])).toEqual([
      ['Fen common', 'Fen rules p. 9', 'What everyone in the fens speaks.'],
      ['Old lantern', '', 'The wardens’ chant.'],
    ]);
    expect(entries[1]!.headings).toEqual([{ label: 'Note', text: 'Only wardens learn it.' }]);
  });

  it('an alignment opens its line and the setting’s note; one the setting doesn’t list has none', () => {
    // Purpose: the alignment on the sheet explains itself in the pack's words.
    const leaning = field('alignment', { type: 'list', choices: ['Lantern', 'Reed'] });
    expect(fieldEntries(ctx, leaning, 'Lantern', [])).toEqual([{ key: 'alignment:Lantern', name: 'Lantern', meta: '', lead: 'Keeps the lights lit for everyone.', headings: [{ label: 'About', text: 'Which way your character leans when the lights go out.' }] }]);
    expect(fieldEntries(ctx, leaning, 'Mire', [])).toEqual([]);
  });

  it('the kindred and the calling open their entries, by id or by name', () => {
    // Purpose: race and class on the sheet open the creation step's entry, with source and page.
    expect(raceEntry(ctx, 'stone-kin')).toMatchObject({ name: 'Stone kin', meta: 'Fen rules, p. 6', lead: 'Slow and sure.' });
    expect(classEntry(ctx, 'lantern-warden')).toMatchObject({ name: 'Lantern Warden', meta: 'Fen rules, p. 10', lead: 'Keeps the lights.' });
    expect(classEntry(ctx, 'lantern-warden')!.headings).toContainEqual({ label: 'Hit die', text: 'd8' });
    expect(fieldEntries(ctx, field('race'), 'Stone kin', [])[0]?.key).toBe('race:stone-kin');
    expect(raceEntry(ctx, 'mud-giant')).toBeNull();
  });

  it('the kindred and the calling carry their description, so the sheet and the review show it too', () => {
    // Purpose: wherever the class or kindred entry opens, its book paragraphs come with it (ruled 2026-11-07).
    const described: EntryContext = {
      ...ctx,
      all: ctx.all.map((e) => (e.kind === 'class' ? { ...e, data: { ...e.data, description: 'Walks the causeways.\nPaid in oil.' } } : e)),
    };
    expect(classEntry(described, 'lantern-warden')!.description).toEqual(['Walks the causeways.', 'Paid in oil.']);
    expect(raceEntry(described, 'stone-kin')!.description).toEqual([]);
  });

  it('a value that is not from a list has no entry', () => {
    // Purpose: a motto or an empty field is never made tappable.
    expect(fieldEntries(ctx, field('motto'), 'Light first', [])).toEqual([]);
    expect(fieldEntries(ctx, field('omen', { type: 'list', from: 'fen-omens' }), '', [])).toEqual([]);
  });
});
