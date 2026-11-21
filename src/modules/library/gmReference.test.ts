// The GM reference screen's content (M5 gate B4), pure: which panels a pack fills, in which order, what each entry
// carries, and the search across panels and packs. Invented packs only (no real game's words or numbers).
import { describe, expect, it } from 'vitest';
import { buildReference, choiceWords, searchReference, type ReferencePackInput } from './gmReference.ts';
import type { Line } from './describe.ts';
import type { EntryKind, PackEntry } from './packFile.ts';

type Entry = PackEntry & { packId: string };
const entry = (packId: string, kind: EntryKind, id: string, name: string, data: Record<string, unknown>): Entry => ({ packId, kind, packEntryId: id, name, data: { id, name, ...data } });
const pack = (packId: string, name: string, kind: ReferencePackInput['kind'] = 'setting'): ReferencePackInput => ({ packId, name, shortName: name, kind });

const fenRules = entry('fen', 'rulesSet', 'fen-rules', 'Fen rules', {
  initiative: { note: 'Each side rolls; the higher acts first.', source: 'p. 20' },
  morale: { explain: 'Foes flee when their nerve breaks.' },
  procedures: { dungeon: { listen: 'Press an ear to the door for a turn.', trapTrigger: { note: 'Stepping on a loose stone sets it off.' } } },
  exploration: {
    modes: [
      { id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, procedure: ['Move', 'Look around'], note: 'Slow and careful.' },
      { id: 'roam', name: 'Roaming', step: { value: 1, unit: 'day' }, procedure: ['Travel'], note: 'Across the moor.' },
    ],
    playerActions: [
      { id: 'tap', name: 'Tap the walls', group: 'Searching', text: 'Knock for hollow places.', source: 'p. 31' },
      { id: 'pry', name: 'Pry a door', group: 'Doors', text: 'Lever it with a bar.' },
    ],
  },
  itemCategories: [{ id: 'gear', name: 'Adventuring gear', order: 1 }],
  gmReference: [
    { id: 'saints', title: "Saints' days", entries: [{ heading: 'Feast of the Heron', text: 'Markets close at noon.', source: 'p. 90' }] },
    { id: 'empty', title: 'Nothing yet', entries: [] },
  ],
});
const fenEntries: Entry[] = [
  fenRules,
  entry('fen', 'class', 'lantern-warden', 'Lantern Warden', { hitDie: 'd6', notes: 'Keeps the light.' }),
  entry('fen', 'item', 'reed-rope', 'Reed rope', { category: 'gear', costGp: 1 }),
  entry('fen', 'table', 'bog-wanderers', 'Bog wanderers', { die: 'd6', description: 'Who walks the causeway.', rows: [{ min: 1, max: 6, result: 'Bog lurker' }] }),
];

describe('buildReference: the standard panels', () => {
  it('a pack fills the standard panels in the fixed order, then its own panels', () => {
    const [book] = buildReference([pack('fen', 'Fen rules')], fenEntries);
    expect(book!.panels.map((p) => p.title)).toEqual(['Combat', 'Dungeons', 'Class abilities', 'Equipment', 'Tables', "Saints' days"]);
  });

  it('a pack with no fight section shows no Combat panel', () => {
    const rules = entry('quiet', 'rulesSet', 'quiet-rules', 'Quiet rules', { exploration: { playerActions: [{ id: 'a', name: 'Hum', group: 'Light', text: 'Hum a tune.' }] } });
    const [book] = buildReference([pack('quiet', 'Quiet rules')], [rules]);
    expect(book!.panels.map((p) => p.id)).toEqual(['dungeons']);
  });

  it('Combat holds the fight sections as the pack words them, with their pages', () => {
    const combat = buildReference([pack('fen', 'Fen rules')], fenEntries)[0]!.panels.find((p) => p.id === 'combat')!;
    expect(combat.entries.map((e) => e.heading)).toEqual(['Initiative', 'Morale']);
    expect(combat.entries[0]).toMatchObject({ paragraphs: ['Each side rolls; the higher acts first.'], source: 'p. 20' });
    expect(combat.entries[1]!.paragraphs).toEqual(['Foes flee when their nerve breaks.']);
  });

  it('Dungeons holds the turn modes (not the day ones), the dungeon procedures, then the player actions in their groups', () => {
    const dungeons = buildReference([pack('fen', 'Fen rules')], fenEntries)[0]!.panels.find((p) => p.id === 'dungeons')!;
    expect(dungeons.entries.map((e) => e.heading)).toEqual(['Creeping', 'Listen', 'Trap trigger', 'Tap the walls', 'Pry a door']);
    expect(dungeons.entries.map((e) => e.group)).toEqual([null, null, null, 'Searching', 'Doors']);
    expect(dungeons.entries.find((e) => e.heading === 'Tap the walls')).toMatchObject({ paragraphs: ['Knock for hollow places.'], source: 'p. 31' });
  });

  it('Equipment groups items under the rules set’s category names; Tables lists each table, which opens it', () => {
    const panels = buildReference([pack('fen', 'Fen rules')], fenEntries)[0]!.panels;
    expect(panels.find((p) => p.id === 'equipment')!.entries[0]).toMatchObject({ heading: 'Reed rope', group: 'Adventuring gear' });
    expect(panels.find((p) => p.id === 'tables')!.entries[0]).toMatchObject({ heading: 'Bog wanderers', tableId: 'bog-wanderers', paragraphs: ['Who walks the causeway.'] });
  });

  it('a setting with nothing to show gives no packs at all ("No reference in this setting")', () => {
    expect(buildReference([pack('bare', 'Bare rules')], [entry('bare', 'rulesSet', 'bare-rules', 'Bare rules', { time: { turnMinutes: 10 } })])).toEqual([]);
    expect(buildReference([], [])).toEqual([]);
  });
});

describe('buildReference: the packs’ own panels (gmReference)', () => {
  it('a gmReference panel shows after the standard ones with its source tag; an empty one is left out', () => {
    const [book] = buildReference([pack('fen', 'Fen rules')], fenEntries);
    const last = book!.panels[book!.panels.length - 1]!;
    expect(last).toMatchObject({ id: 'ref:saints', title: "Saints' days", from: 'book' });
    expect(last.entries[0]).toMatchObject({ heading: 'Feast of the Heron', paragraphs: ['Markets close at noon.'], source: 'p. 90' });
    expect(book!.panels.some((p) => p.title === 'Nothing yet')).toBe(false);
  });

  it("an adventure pack's panel is tagged adventure, and its entry's table opens that table", () => {
    const abbey = entry('abbey', 'rulesSet', 'ab-rules', 'Flooded abbey', {
      gmReference: [{ id: 'tide', title: 'Flood tide', entries: [{ heading: 'High water', text: 'The crypt floods at dusk.', tableId: 'ab-tide' }, { source: 'p. 4' }] }],
    });
    const [book] = buildReference([pack('abbey', 'Flooded abbey', 'adventure')], [abbey]);
    expect(book!.panels).toHaveLength(1);
    expect(book!.panels[0]).toMatchObject({ title: 'Flood tide', from: 'book' });
    // The entry with neither heading nor words is left out.
    expect(book!.panels[0]!.entries).toEqual([expect.objectContaining({ heading: 'High water', tableId: 'ab-tide' })]);
  });
});

describe('several packs, and the search', () => {
  const overlay = entry('mire', 'rulesSet', 'mire-rules', 'Mire overlay', { pursuit: { note: 'Bog lurkers give up at the treeline.' } });
  // The stack is given top first: the overlay sits on the base rules.
  const book = buildReference([pack('mire', 'Mire overlay'), pack('fen', 'Fen rules')], [...fenEntries, overlay]);

  it('each pack gets its own panels, the base rules first', () => {
    expect(book.map((p) => p.name)).toEqual(['Fen rules', 'Mire overlay']);
    expect(book[1]!.panels.map((p) => p.title)).toEqual(['Combat']);
  });

  it('search finds an entry in any panel and in any attached pack, by heading or by words, ignoring case', () => {
    const where = (query: string) => searchReference(book, query).map((hit) => `${hit.pack.name} › ${hit.panel.title} › ${hit.entry.heading}`);
    expect(where('TREELINE')).toEqual(['Mire overlay › Combat › Pursuit']);
    expect(where('heron')).toEqual(["Fen rules › Saints' days › Feast of the Heron"]);
    expect(where('hollow')).toEqual(['Fen rules › Dungeons › Tap the walls']);
    expect(where('  ')).toEqual([]);
  });
});

// tf-11: the reference shows values in words, never raw keys ("initiative-ties=party").
describe('buildReference: values in words (tf-11)', () => {
  const ties = entry('fen', 'option', 'initiative-ties', 'Initiative ties', { choices: [{ id: 'again', name: 'Roll again' }, { id: 'party', name: 'The party wins' }] });
  const keyed = entry('fen', 'rulesSet', 'fen-rules', 'Fen rules', {
    initiative: { note: 'Each side rolls.', byOption: { 'initiative-ties=again': 'Roll until one side wins.', 'initiative-ties=party': { note: 'The party acts first.' } } },
    death: { note: 'At zero you fall.', byOption: { 'last-breath=on': 'One more round.' } },
    weaponDrill: { option: 'initiative-ties=party' },
    daylight: { sunrise: '08:00' },
  });

  it('no line of any built panel prints a raw option key; the option and choice names show instead', () => {
    const [book] = buildReference([pack('fen', 'Fen rules')], [keyed, ties]);
    const flat = (lines: Line[]): string[] => lines.flatMap((l) => [l.label, l.value ?? '', ...flat(l.lines ?? [])]);
    const text = book!.panels.flatMap((p) => p.entries.flatMap((e) => [e.heading, ...e.paragraphs, ...flat(e.lines)]));
    expect(text.filter((t) => /[a-z0-9]=[a-z0-9]/i.test(t))).toEqual([]);
    expect(text).toContain('Initiative ties, Roll again');
    expect(text).toContain('Initiative ties, The party wins');
    // An option the campaign doesn't have is tidied: "Last breath · On".
    expect(text.some((t) => t.includes('Last breath, On'))).toBe(true);
  });

  it('choiceWords leaves anything else alone (a time keeps its colon)', () => {
    const none = new Map();
    expect(choiceWords('08:00', none)).toBeNull();
    expect(choiceWords('Roll again', none)).toBeNull();
    expect(choiceWords('initiative-ties=party', none)).toBe('Initiative ties, Party');
  });
});

describe('buildReference: a rules set’s top-level encounter (the area-4 re-check)', () => {
  // Purpose: a rules set that keeps its encounter rules at the top level (`encounter`, reference only in 07) shows them in Combat as Encounters, in the fight sections' order.
  it('shows a top-level encounter section in Combat', () => {
    const glade = entry('glade', 'rulesSet', 'glade-rules', 'Glade rules', {
      initiative: { note: 'The quicker side acts first.' },
      encounter: { note: 'Glade folk speak before they strike.', distance: 'A stone’s throw', source: 'p. 41' },
      morale: { note: 'Glade folk melt away when hurt.' },
    });
    const combat = buildReference([pack('glade', 'Glade rules')], [glade])[0]!.panels.find((p) => p.id === 'combat')!;
    expect(combat.entries.map((e) => e.heading)).toEqual(['Initiative', 'Encounters', 'Morale']);
    expect(combat.entries[1]).toMatchObject({ paragraphs: ['Glade folk speak before they strike.'], source: 'p. 41' });
    expect(combat.entries[1]!.lines.length).toBeGreaterThan(0);
  });

  // Purpose: a rules set with both `procedures.encounter` and a top-level `encounter` shows both (07 doesn't say one wins), the procedure first.
  it('shows both when a rules set has procedures.encounter and encounter', () => {
    const both = entry('both', 'rulesSet', 'both-rules', 'Both rules', {
      procedures: { encounter: { note: 'Roll for distance, then surprise.' } },
      encounter: { note: 'Strangers in the reeds are wary.' },
    });
    const combat = buildReference([pack('both', 'Both rules')], [both])[0]!.panels.find((p) => p.id === 'combat')!;
    expect(combat.entries.map((e) => e.paragraphs[0])).toEqual(['Roll for distance, then surprise.', 'Strangers in the reeds are wary.']);
    expect(new Set(combat.entries.map((e) => e.key)).size).toBe(2);
    expect(searchReference(buildReference([pack('both', 'Both rules')], [both]), 'wary')).toHaveLength(1);
  });
});
