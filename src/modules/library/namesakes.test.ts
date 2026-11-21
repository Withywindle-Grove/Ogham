// Same-named entries show their source (sn-1; plan dec-1-creation 1d): the pure readers in namesakes.ts. Every name
// and pack is invented.
import { describe, expect, it } from 'vitest';
import { nameFromWords, namesakeSource, sameNamePairs } from './namesakes.ts';

const entry = (kind: string, packEntryId: string, name: string, packId: string) => ({ kind, packEntryId, name, packId });
const packName = (packId: string) => ({ 'example-a': 'Fen rules', 'example-b': 'Mire zine' })[packId] ?? '';

describe('namesakeSource', () => {
  // Purpose: two classes with the same name from two packs each give their own pack's short name.
  it('gives each of two same-named classes from two packs its own pack', () => {
    const a = entry('class', 'lantern-warden', 'Lantern Warden', 'example-a');
    const b = entry('class', 'mire-warden', 'Lantern Warden', 'example-b');
    const from = namesakeSource([a, b], packName);
    expect([from(a), from(b)]).toEqual(['Fen rules', 'Mire zine']);
  });

  // Purpose: an entry nobody else shares a name with shows nothing, so a one-setting campaign is unchanged.
  it('gives nothing to entries with no namesake', () => {
    const a = entry('class', 'lantern-warden', 'Lantern Warden', 'example-a');
    const b = entry('class', 'reed-witch', 'Reed Witch', 'example-a');
    const from = namesakeSource([a, b], packName);
    expect([from(a), from(b)]).toEqual([null, null]);
  });

  // Purpose: names that differ only in capitals or spaces count as the same name.
  it('counts names that differ only in capitals or spaces as the same', () => {
    const a = entry('race', 'marsh-folk', 'Marsh folk', 'example-a');
    const b = entry('race', 'marsh-folk-2', '  marsh  Folk ', 'example-b');
    expect(namesakeSource([a, b], packName)(a)).toBe('Fen rules');
  });

  // Purpose: the same name on different kinds (a class and a race) is no namesake.
  it('gives nothing when the same name is on a different kind', () => {
    const a = entry('class', 'bog-kin', 'Bog-kin', 'example-a');
    const b = entry('race', 'bog-kin', 'Bog-kin', 'example-b');
    const from = namesakeSource([a, b], packName);
    expect([from(a), from(b)]).toEqual([null, null]);
  });

  // Purpose: two same-named entries inside one pack aren't told apart by the pack's name, so nothing is added.
  it('gives nothing when both same-named entries are in the same pack', () => {
    const a = entry('class', 'lantern-warden', 'Lantern Warden', 'example-a');
    const b = entry('class', 'lantern-warden-old', 'Lantern Warden', 'example-a');
    expect(namesakeSource([a, b], packName)(a)).toBeNull();
  });

  // Purpose: options and patches are each pack's own and never get a source after their name.
  it('leaves options out', () => {
    const a = entry('option', 'lamps', 'Lamps', 'example-a');
    const b = entry('option', 'lamps', 'Lamps', 'example-b');
    expect(namesakeSource([a, b], packName)(a)).toBeNull();
  });
});

describe('nameFromWords', () => {
  // Purpose: a one-line place says the source in brackets with "from", never after a middle dot (words rule 11).
  it('reads " (from <pack>)", or nothing without a source', () => {
    expect(`Lantern Warden${nameFromWords('Fen rules')}`).toBe('Lantern Warden (from Fen rules)');
    expect(nameFromWords(null)).toBe('');
  });
});

describe('sameNamePairs (pack:check)', () => {
  const pack = (name: string, ...entries: { kind: string; packEntryId: string; name: string }[]) => ({ name, entries });
  const e = (kind: string, packEntryId: string, name: string) => ({ kind, packEntryId, name });

  // Purpose: every kind is listed (a class, a race, a spell, an item), each pair once with both packs and ids.
  it('lists a same-named pair of every kind, with both packs and their ids', () => {
    const pairs = sameNamePairs([
      pack('Fen rules', e('class', 'lantern-warden', 'Lantern Warden'), e('race', 'marsh-folk', 'Marsh folk'), e('spell', 'glimmer', 'Glimmer'), e('item', 'reed-lamp', 'Reed lamp')),
      pack('Mire zine', e('class', 'mire-warden', 'Lantern Warden'), e('race', 'mire-folk', 'Marsh folk'), e('spell', 'mire-glimmer', 'Glimmer'), e('item', 'mire-lamp', 'Reed lamp')),
    ]);
    expect(pairs.map((p) => p.kind)).toEqual(['class', 'race', 'spell', 'item']);
    expect(pairs[0]).toEqual({ kind: 'class', name: 'Lantern Warden', found: [{ pack: 'Fen rules', id: 'lantern-warden' }, { pack: 'Mire zine', id: 'mire-warden' }] });
  });

  // Purpose: a shared id is the stack's case (one entry, the pack on top wins), so it isn't listed here; nor are options.
  it('leaves out a shared id, options, and a name in only one pack', () => {
    const pairs = sameNamePairs([
      pack('Fen rules', e('item', 'reed-lamp', 'Reed lamp'), e('option', 'lamps', 'Lamps'), e('class', 'a', 'Twice'), e('class', 'b', 'Twice')),
      pack('Mire zine', e('item', 'reed-lamp', 'Reed lamp'), e('option', 'lamps', 'Lamps')),
    ]);
    expect(pairs).toEqual([]);
  });

  // Purpose: two same-named ids inside one pack are not a pair on their own, even when a second pack shares the id
  // (the different ids must come from different packs).
  it('leaves out two same-named ids in one pack, and a second pack sharing an id with each', () => {
    expect(sameNamePairs([pack('Fen rules', e('class', 'warden-a', 'Lantern Warden'), e('class', 'warden-b', 'Lantern Warden'))])).toEqual([]);
    expect(
      sameNamePairs([
        pack('Fen rules', e('class', 'warden-a', 'Lantern Warden')),
        pack('Mire zine', e('class', 'warden-a', 'Lantern Warden')),
        pack('Reed notes', e('class', 'warden-a', 'Lantern Warden')),
      ]),
    ).toEqual([]);
  });

  // Purpose: once two of the ids sit in different packs it is a pair, listing every pack and id found, since both
  // stay in play (here Fen's warden-b and Mire's warden-a, which wins warden-a's place in the stack).
  it('lists two ids in one pack when another pack has one of them', () => {
    const pairs = sameNamePairs([
      pack('Fen rules', e('class', 'warden-a', 'Lantern Warden'), e('class', 'warden-b', 'Lantern Warden')),
      pack('Mire zine', e('class', 'warden-a', 'Lantern Warden')),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.found).toEqual([
      { pack: 'Fen rules', id: 'warden-a' },
      { pack: 'Fen rules', id: 'warden-b' },
      { pack: 'Mire zine', id: 'warden-a' },
    ]);
  });
});

describe('namesakeSource: a pinned copy names the pack it was pinned from (sn-1b)', () => {
  const pinned = (kind: string, packEntryId: string, name: string, packId: string, pinnedFrom?: string) => ({ kind, packEntryId, name, packId, data: pinnedFrom ? { pinnedFrom } : {} });
  // The campaign's packs: Fen rules (meta id fen-rules) and the Mire zine (meta id mire-zine).
  const packs = [
    { packId: 'example-a', metaId: 'fen-rules' },
    { packId: 'example-b', metaId: 'mire-zine' },
  ];

  // Purpose: inside one pack, the pinned class reads as the pack it was pinned from, and its twin as its own pack.
  it('a pinned class and its same-named twin in one pack each show a pack: the pinned one Fen, the twin Mire', () => {
    const copy = pinned('class', 'lantern-warden', 'Lantern Warden', 'example-b', 'fen-rules');
    const own = pinned('class', 'mire-warden', 'Lantern Warden', 'example-b');
    const from = namesakeSource([copy, own], packName, packs);
    expect([from(copy), from(own)]).toEqual(['Fen rules', 'Mire zine']);
  });

  // Purpose: a race is read the same way as a class.
  it('a pinned race and its twin each show a pack', () => {
    const copy = pinned('race', 'marsh-folk', 'Marsh folk', 'example-b', 'fen-rules');
    const own = pinned('race', 'mire-folk', 'Marsh folk', 'example-b');
    const from = namesakeSource([copy, own], packName, packs);
    expect([from(copy), from(own)]).toEqual(['Fen rules', 'Mire zine']);
  });

  // Purpose: the reader finds the pinned mark on the pool's copy when the entry it is asked about has no fields.
  it('reads pinnedFrom from the pool when the entry asked about carries no fields', () => {
    const copy = pinned('class', 'lantern-warden', 'Lantern Warden', 'example-b', 'fen-rules');
    const own = pinned('class', 'mire-warden', 'Lantern Warden', 'example-b');
    const from = namesakeSource([copy, own], packName, packs);
    expect(from({ kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', packId: 'example-b' })).toBe('Fen rules');
  });

  // Purpose: pinnedFrom may also name the pack by its id in the campaign.
  it('matches a pack by its id in the campaign too', () => {
    const copy = pinned('class', 'lantern-warden', 'Lantern Warden', 'example-b', 'example-a');
    const own = pinned('class', 'mire-warden', 'Lantern Warden', 'example-b');
    expect(namesakeSource([copy, own], packName, packs)(copy)).toBe('Fen rules');
  });

  // Purpose: when the pack it names isn't attached, the pinned entry is its own pack's, as before: no line inside one pack.
  it('the named pack not attached: its own pack, so nothing shows inside one pack', () => {
    const copy = pinned('class', 'lantern-warden', 'Lantern Warden', 'example-b', 'reed-notes');
    const own = pinned('class', 'mire-warden', 'Lantern Warden', 'example-b');
    const from = namesakeSource([copy, own], packName, packs);
    expect([from(copy), from(own)]).toEqual([null, null]);
    // No packs given at all: as before.
    expect(namesakeSource([copy, own], packName)(copy)).toBeNull();
  });

  // Purpose: other kinds are unchanged: a pinned stat block or item keeps its own pack.
  it('a pinned stat block or item keeps its own pack', () => {
    for (const kind of ['statBlock', 'item']) {
      const copy = pinned(kind, 'bog-lurker', 'Bog lurker', 'example-b', 'fen-rules');
      const own = pinned(kind, 'mire-lurker', 'Bog lurker', 'example-b');
      const from = namesakeSource([copy, own], packName, packs);
      expect([from(copy), from(own)]).toEqual([null, null]);
      // With a namesake in another pack, the pinned item still names its own pack.
      const elsewhere = pinned(kind, 'fen-lurker', 'Bog lurker', 'example-a');
      expect(namesakeSource([copy, elsewhere], packName, packs)(copy)).toBe('Mire zine');
    }
  });

  // Purpose: two same-named entries in one pack with no pinnedFrom stay as before (no line); a pinned entry with no namesake shows nothing.
  it('no pinnedFrom inside one pack, or no namesake at all: nothing', () => {
    const a = pinned('class', 'warden-a', 'Lantern Warden', 'example-b');
    const b = pinned('class', 'warden-b', 'Lantern Warden', 'example-b');
    expect(namesakeSource([a, b], packName, packs)(a)).toBeNull();
    const alone = pinned('class', 'reed-witch', 'Reed Witch', 'example-b', 'fen-rules');
    expect(namesakeSource([alone, a], packName, packs)(alone)).toBeNull();
  });

  // Purpose: the pinned copy and the pack it names, both in play, are told apart from the twin and agree with each other.
  it('the pinned copy beside the named pack’s own class of another id: each names its pack', () => {
    const copy = pinned('class', 'lantern-warden', 'Lantern Warden', 'example-b', 'fen-rules');
    const own = pinned('class', 'mire-warden', 'Lantern Warden', 'example-b');
    const fenOther = pinned('class', 'lantern-warden-old', 'Lantern Warden', 'example-a');
    const from = namesakeSource([copy, own, fenOther], packName, packs);
    expect([from(copy), from(own), from(fenOther)]).toEqual(['Fen rules', 'Mire zine', 'Fen rules']);
  });
});

describe('sameNamePairs: a pinned copy is listed with the pack it was pinned from (sn-1b)', () => {
  const e = (kind: string, packEntryId: string, name: string, pinnedFrom?: string) => ({ kind, packEntryId, name, data: pinnedFrom ? { pinnedFrom } : {} });

  // Purpose: a pair inside one pack where one is pinned is listed, the pinned one under the pack it was pinned from.
  it('lists a pinned copy and its twin inside one pack, the copy under the pack it names', () => {
    const pairs = sameNamePairs([
      { name: 'Fen rules', id: 'fen-rules', entries: [e('class', 'lantern-warden', 'Lantern Warden')] },
      { name: 'Mire zine', id: 'mire-zine', entries: [e('class', 'lantern-warden', 'Lantern Warden', 'fen-rules'), e('class', 'mire-warden', 'Lantern Warden')] },
    ]);
    expect(pairs).toEqual([
      { kind: 'class', name: 'Lantern Warden', found: [{ pack: 'Fen rules', id: 'lantern-warden', pinnedIn: 'Mire zine' }, { pack: 'Mire zine', id: 'mire-warden' }] },
    ]);
    // Without the named pack among the files, both sit in one pack: that pack's own business, not listed.
    const alone = sameNamePairs([{ name: 'Mire zine', id: 'mire-zine', entries: [e('class', 'lantern-warden', 'Lantern Warden', 'fen-rules'), e('class', 'mire-warden', 'Lantern Warden')] }]);
    expect(alone).toEqual([]);
  });

  // Purpose: the pinned copy is listed even when the named pack holds no class of that name, saying where it sits.
  it('says which pack the pinned copy sits in', () => {
    const pairs = sameNamePairs([
      { name: 'Fen rules', id: 'fen-rules', entries: [e('class', 'reed-witch', 'Reed Witch')] },
      { name: 'Mire zine', id: 'mire-zine', entries: [e('race', 'marsh-folk', 'Marsh folk', 'fen-rules'), e('race', 'mire-folk', 'Marsh folk')] },
    ]);
    expect(pairs).toEqual([{ kind: 'race', name: 'Marsh folk', found: [{ pack: 'Fen rules', id: 'marsh-folk', pinnedIn: 'Mire zine' }, { pack: 'Mire zine', id: 'mire-folk' }] }]);
  });

  // Purpose: a pinned item is not regrouped: inside one pack it is that pack's own business, as before.
  it('a pinned item inside one pack is not listed', () => {
    expect(
      sameNamePairs([
        { name: 'Fen rules', id: 'fen-rules', entries: [] },
        { name: 'Mire zine', id: 'mire-zine', entries: [e('item', 'reed-lamp', 'Reed lamp', 'fen-rules'), e('item', 'mire-lamp', 'Reed lamp')] },
      ]),
    ).toEqual([]);
  });
});
