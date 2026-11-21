// A pack's top-level `gmReference` (07 G-55) and `locations` in a rules or overlay pack (07 G-58) are kept on import
// (ruled A by Francis, 2026-11-03; bug found the same day: both were dropped as "isn't a part … knows"). Pure: the
// importer's reading, the GM reference screen's merge, and what an Update compares. Invented packs only.
import { describe, expect, it } from 'vitest';
import { BRAND } from '../../brand.ts';
import { packFile } from './exportPack.ts';
import { buildReference } from './gmReference.ts';
import { comparePacks, PLAYER_FACING, readPackJson, type PackEntry } from './packFile.ts';

const UNKNOWN = (part: string) => `"${part}" isn't a part ${BRAND.appName} knows; it was left out.`;

const lanternPanel = { id: 'lantern-lore', title: 'Lantern lore', entries: [{ heading: 'Wick of the Warden', text: 'A warden’s wick burns blue near bog lurkers.', source: 'p. 4' }] };
const reedInn = {
  id: 'the-reed-inn',
  name: 'The Reed Inn',
  type: 'building',
  parentId: null,
  playerView: { text: 'Smoke, eel stew and a low ceiling.' },
  gm: { notes: 'The keeper fences stolen lanterns.' },
};

const overlay = (extra: Record<string, unknown>) =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { name: 'Lantern Wardens', version: '0.1', kind: 'homebrew', requires: [{ packId: 'fen-rules' }] },
    classes: [{ id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6' }],
    ...extra,
  });

const read = (text: string) => {
  const result = readPackJson(text);
  if (!result.ok) throw new Error(result.message);
  return result.pack;
};

const withPack = (entries: PackEntry[], packId = 'wardens') => entries.map((e) => ({ ...e, packId }));

describe('importing a top-level gmReference', () => {
  it('a pack with only a top-level gmReference imports without the "isn\'t a part" note, one panel entry each, named by its title', () => {
    const pack = read(overlay({ gmReference: [lanternPanel] }));
    expect(pack.warnings).not.toContain(UNKNOWN('gmReference'));
    expect(pack.entries.filter((e) => e.kind === 'gmReferencePanel')).toEqual([{ kind: 'gmReferencePanel', packEntryId: 'lantern-lore', name: 'Lantern lore', data: lanternPanel }]);
  });

  it('its panels show in GM reference under that pack, tagged with the pack', () => {
    const pack = read(overlay({ gmReference: [lanternPanel] }));
    const [book] = buildReference([{ packId: 'wardens', name: 'Lantern Wardens', shortName: 'Wardens', kind: 'homebrew' }], withPack(pack.entries));
    expect(book?.name).toBe('Lantern Wardens');
    const panel = book?.panels.find((p) => p.id === 'ref:lantern-lore');
    expect(panel).toMatchObject({ title: 'Lantern lore', from: 'book' });
    expect(panel?.entries).toEqual([expect.objectContaining({ heading: 'Wick of the Warden', paragraphs: ['A warden’s wick burns blue near bog lurkers.'], source: 'p. 4' })]);
  });

  it('a pack with both shows both in one list, merged and tagged with the pack: the rules set\'s panels, then the top-level ones', () => {
    const pack = read(
      overlay({
        rulesSets: [{ id: 'warden-rules', name: 'Warden rules', gmReference: [{ id: 'saints', title: "Saints' days", entries: [{ heading: 'Feast of the Heron', text: 'Markets close at noon.' }] }] }],
        gmReference: [lanternPanel],
      }),
    );
    const [book] = buildReference([{ packId: 'wardens', name: 'Lantern Wardens', shortName: 'Wardens', kind: 'homebrew' }], withPack(pack.entries));
    const own = book?.panels.filter((p) => p.id.startsWith('ref:')) ?? [];
    expect(own.map((p) => [p.title, p.from])).toEqual([
      ["Saints' days", 'book'],
      ['Lantern lore', 'book'],
    ]);
  });

  it('an adventure pack\'s top-level panels are tagged "adventure"', () => {
    const pack = read(JSON.stringify({ format: 'tabletop-pack', meta: { name: 'Mire Tower', kind: 'adventure' }, gmReference: [lanternPanel] }));
    const [book] = buildReference([{ packId: 'mire', name: 'Mire Tower', shortName: 'Mire', kind: 'adventure' }], withPack(pack.entries, 'mire'));
    expect(book?.panels).toEqual([expect.objectContaining({ id: 'ref:lantern-lore', from: 'book' })]);
  });
});

describe('importing locations in a rules or overlay pack', () => {
  it('imports them without the "isn\'t a part" note, kept whole as place entries', () => {
    const pack = read(overlay({ locations: [reedInn] }));
    expect(pack.warnings).not.toContain(UNKNOWN('locations'));
    expect(pack.entries.filter((e) => e.kind === 'location')).toEqual([{ kind: 'location', packEntryId: 'the-reed-inn', name: 'The Reed Inn', data: reedInn }]);
    expect(pack.counts.location).toBe(1);
  });
});

describe('both parts are the GM’s, and an Update keeps them', () => {
  it('neither kind is one players may read', () => {
    expect(PLAYER_FACING).not.toContain('gmReferencePanel');
    expect(PLAYER_FACING).not.toContain('location');
  });

  it('re-importing the same file (Update) keeps them: matched as unchanged, never removed', () => {
    const before = read(overlay({ gmReference: [lanternPanel], locations: [reedInn] })).entries;
    const after = read(overlay({ gmReference: [lanternPanel], locations: [reedInn] })).entries;
    const diff = comparePacks(before, after);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.unchanged).toBe(after.length);
  });

  it('exporting the pack writes them back where they came from (top-level gmReference and locations)', () => {
    const pack = read(overlay({ gmReference: [lanternPanel], locations: [reedInn] }));
    const { file } = packFile(pack.meta, pack.entries);
    expect(file.gmReference).toEqual([lanternPanel]);
    expect(file.locations).toEqual([reedInn]);
  });
});
