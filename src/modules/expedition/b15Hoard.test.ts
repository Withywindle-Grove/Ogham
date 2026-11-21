// B15 of docs/plans/scene-point-to-point.md: a hoard as one piece in the book's words, its things with how many of each behind it
// (p2p-28), and a magic item's truth as a piece of its own (p2p-29); page 30, HM1 and HM2, approved 2026-11-20.
// Invented coins, items and places only.
import { describe, expect, it } from 'vitest';
import type { Denomination } from '../inventory/coinWords.ts';
import { sendOf } from './findSend.ts';
import { hoardRows, magicPieceOf, namedThings, thingWords, type ThingRow } from './hoard.ts';
import { composePackPlace, hoardWordsOf, magicItemOf } from './placeFromPack.ts';

const COINS: Denomination[] = [{ key: 'heron', label: 'herons', unitName: 'heron', pluralName: 'herons' }];
const ITEMS = new Set(['moon-opal']);
const WORDS = '240 herons, two moon opals, nine swords and daggers and a hooded lantern, under a rotted sailcloth.';
const NOTICED = 'Cold to the touch; the glass smells of the sea.';
const TRUTH = 'The hooded lantern in the strongbox. Lit, it burns no oil and shows whatever lies under water within ten paces.';

/** The Wreck: a description, an aspect, a hoard with its own words and a magic item in it, and a loose find. */
const WRECK = {
  id: 'the-wreck',
  name: 'The Wreck',
  type: 'area',
  source: 'p. 14',
  playerView: { text: 'A cog on her side on the bar.', aspects: [{ lead: 'Mast', text: 'Gulls quarrel on it.' }] },
  hoards: [{ name: 'Strongbox', text: WORDS }],
  treasure: [
    { text: '240 herons', coins: { heron: 240 }, hoard: 'Strongbox' },
    { text: 'Moon opals', itemId: 'moon-opal', qty: 2, value: { heron: 30 }, hoard: 'Strongbox' },
    { text: 'Swords', qty: 4, hoard: 'Strongbox' },
    { text: 'Daggers', qty: 5, hoard: 'Strongbox' },
    { text: 'Hooded lantern', hoard: 'Strongbox', magicItem: { name: 'Lantern of the Drowned', text: TRUTH, noticed: NOTICED, source: 'p. 14' } },
    { text: 'A tin cup', value: { heron: 2 } },
  ],
};
const entry = (data: Record<string, unknown>) => ({ packId: 'pack-isle', packEntryId: String(data.id), name: String(data.name), data });

describe("a hoard's own words make one piece (p2p-28)", () => {
  // Purpose: a hoard the pack gives words for is one piece, led by the hoard's name, in the book's words, standing where
  // its first thing stands; its things make no piece of their own, and it keeps no value line (pg30-2). A magic item's
  // truth follows as a piece of its own, led by its real name, with nothing in its GM-only column: neither the item's
  // source nor the place's is stored on it (b15f-4), and its noticed is never on the piece (b15f-2); a loose find is as
  // before.
  it('composes the hoard and the magic item as pieces, in order, all hidden', () => {
    const made = composePackPlace(entry(WRECK));
    if (!made.ok) throw new Error(made.message);
    expect(made.parts.pieces.map((p) => [p.kind, p.lead ?? '', p.body])).toEqual([
      ['description', '', 'A cog on her side on the bar.'],
      ['other', 'Mast', 'Gulls quarrel on it.'],
      ['treasure', 'Strongbox', WORDS],
      ['other', 'Lantern of the Drowned', TRUTH],
      ['treasure', '', 'A tin cup'],
    ]);
    const hoard = made.parts.pieces[2]!;
    expect(hoard.gm_value).toBe('');
    const truth = made.parts.pieces[3]!;
    expect([truth.gm_value, truth.gm_trigger, truth.gm_stat_line]).toEqual(['', '', '']);
    expect(JSON.stringify(made.parts.pieces)).not.toContain('p. 14');
    expect(JSON.stringify(made.parts.pieces)).not.toContain(NOTICED);
  });

  // Purpose: words for a hoard no treasure entry names are ignored, and a hoard without words is as before (one piece
  // per thing); a magic item without both a name and words makes no piece.
  it('ignores words with no hoard, and a magic item missing its name or words', () => {
    expect([...hoardWordsOf({ hoards: [{ name: 'Nowhere', text: 'Dust.' }], treasure: [{ text: 'A cup' }] }).keys()]).toEqual([]);
    expect(magicItemOf({ magicItem: { name: 'Lantern of the Drowned' } })).toBeNull();
    expect(magicItemOf({ magicItem: { text: 'It glows.' } })).toBeNull();
    expect(magicItemOf({ magicItem: { name: 'Pale key', text: 'Opens any reed gate.', source: 'p. 9' } })).toEqual({ name: 'Pale key', text: 'Opens any reed gate.', noticed: '' });
    expect(magicItemOf({ magicItem: { name: 'Pale key', text: 'Opens any reed gate.', noticed: 'Damp.', source: 'p. 9' } })).toEqual({ name: 'Pale key', text: 'Opens any reed gate.', noticed: 'Damp.' });
    const plain = composePackPlace(entry({ ...WRECK, hoards: [] }));
    if (!plain.ok) throw new Error(plain.message);
    expect(plain.parts.pieces.filter((p) => p.kind === 'treasure').map((p) => p.body)).toEqual(['240 herons', 'Moon opals', 'Swords', 'Daggers', 'Hooded lantern', 'A tin cup']);
  });
});

describe("the hoard behind its piece, with how many of each (p2p-28, b15f-1; HM2)", () => {
  // Purpose: a tap on the hoard's piece finds the hoard by its name (the lead), so its words may be changed; its things
  // come one row each with the pack's qty, the magic item a row like any other under its plain name, its noticed kept
  // with the thing as found (b15f-2) and nothing else's.
  it('finds the hoard by its name and carries each qty', () => {
    const hoard = hoardRows({ kind: 'treasure', text: 'Words the GM changed.', lead: 'Strongbox' }, WRECK, COINS, ITEMS);
    expect(hoard.name).toBe('Strongbox');
    expect(hoard.words).toBe(WORDS);
    const things = hoard.rows.filter((r): r is ThingRow => r.kind === 'thing');
    expect(things.map(thingWords)).toEqual(['Moon opals ×2', 'Swords ×4', 'Daggers ×5', 'Hooded lantern']);
    expect(things.map((r) => r.magic)).toEqual([null, null, null, 'Lantern of the Drowned']);
    expect(things.map((r) => r.noticed)).toEqual([null, null, null, NOTICED]);
    expect(hoard.rows.filter((r) => r.kind === 'coin')).toHaveLength(1);
  });

  // Purpose: a qty that isn't a whole number of 1 or more counts as one, never 0 and never a fraction; the old word
  // `count` is not read (b15f-1: no alias).
  it('reads a bad qty as one, and ignores count', () => {
    const odd = { treasure: [{ text: 'Cups', qty: 0, hoard: 'Box' }, { text: 'Jars', qty: 2.5, hoard: 'Box' }, { text: 'Pots', qty: 999, hoard: 'Box' }, { text: 'Pans', count: 3, hoard: 'Box' }], hoards: [{ name: 'Box', text: 'Pots and pans.' }] };
    const rows = hoardRows({ kind: 'treasure', text: 'Pots and pans.', lead: 'Box' }, odd, COINS, ITEMS).rows as ThingRow[];
    expect(rows.map(thingWords)).toEqual(['Cups', 'Jars', 'Pots ×999', 'Pans']);
  });

  // Purpose: what a send carries: each thing as many as its qty, the magic item by its plain words, never its real name.
  it('sends each thing at its qty, the magic item under its plain name', () => {
    const rows = hoardRows({ kind: 'treasure', text: WORDS, lead: 'Strongbox' }, WRECK, COINS, ITEMS).rows;
    const sent = sendOf(rows, new Map([['moon-opal', 'lib-opal']]));
    expect(sent.things).toEqual([
      { libraryEntryId: 'lib-opal', qty: 2 },
      { name: 'Swords', qty: 4 },
      { name: 'Daggers', qty: 5 },
      { name: 'Hooded lantern', qty: 1 },
    ]);
    expect(JSON.stringify(sent)).not.toContain('Drowned');
    expect(JSON.stringify(sent)).not.toContain(NOTICED);
    expect(sent.coins).toEqual({ heron: 240 });
  });
});

describe("a magic item's piece and its thing (p2p-29)", () => {
  // Purpose: the magic item's piece (led by the real name) is tied back to its treasure entry; no other piece is.
  it('ties the piece to its thing by the real name', () => {
    expect(magicPieceOf({ kind: 'other', lead: 'Lantern of the Drowned' }, WRECK)).toEqual({ entry: 4, name: 'Lantern of the Drowned' });
    expect(magicPieceOf({ kind: 'other', lead: 'Mast' }, WRECK)).toBeNull();
    expect(magicPieceOf({ kind: 'treasure', lead: 'Lantern of the Drowned' }, WRECK)).toBeNull();
    expect(magicPieceOf({ kind: 'other', lead: null }, WRECK)).toBeNull();
    expect(magicPieceOf({ kind: 'other', lead: 'Lantern of the Drowned' }, { name: 'Empty loft' })).toBeNull();
  });
});

describe('a send names every revealed magic item in it (HM3; the local reviews of #1101 and #10)', () => {
  // Purpose: with two magic items in one hoard and both pieces revealed (shown to some group, whichever card the send is
  // made from), a send of the whole hoard names both, each by its own piece and its place among the send's things; one
  // never revealed arrives plain, and a hoard without magic names none.
  it('names each thing whose piece is revealed, not only the first', () => {
    const two = {
      ...WRECK,
      treasure: [...WRECK.treasure, { text: 'Bone whistle', hoard: 'Strongbox', magicItem: { name: 'Whistle of the Tide', text: 'Blown, it calls the gulls.' } }],
    };
    const rows = hoardRows({ kind: 'treasure', text: WORDS, lead: 'Strongbox' }, two, COINS, ITEMS).rows;
    const pieces = [
      { id: 'p-lantern', kind: 'other', lead: 'Lantern of the Drowned' },
      { id: 'p-whistle', kind: 'other', lead: 'Whistle of the Tide' },
    ];
    const both = new Set(['p-lantern', 'p-whistle']);
    // Things in the send: opals, swords, daggers, lantern (3), whistle (4).
    expect(namedThings(rows, pieces, two, both)).toEqual([
      { piece: 'p-lantern', thing: 3 },
      { piece: 'p-whistle', thing: 4 },
    ]);
    expect(namedThings(rows, pieces, two, new Set(['p-lantern']))).toEqual([{ piece: 'p-lantern', thing: 3 }]);
    expect(namedThings(rows, pieces, two, new Set())).toEqual([]);
    const plain = hoardRows({ kind: 'treasure', text: WORDS, lead: 'Strongbox' }, { ...WRECK, treasure: WRECK.treasure.slice(0, 4) }, COINS, ITEMS).rows;
    expect(namedThings(plain, pieces, WRECK, both)).toEqual([]);
  });
});
