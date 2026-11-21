// K16a, a hoard's rows from a Treasure piece (docs/plans/dec-6-the-whole-pack-tab.md, K16; pk-1, pf-6, pf-24, pf-24a,
// pk-11, pg-1; the Pack page's frame PK5). Invented coins (crowns, herons, bits), items and places only.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import type { Denomination } from '../inventory/coinWords.ts';
import { hoardRows, type HoardRow } from './hoard.ts';
import { composePackPlace } from './placeFromPack.ts';
import { showPiece } from './placePlay.ts';
import { startExpedition } from './play.ts';

const COINS: Denomination[] = [
  { key: 'crown', label: 'crowns', unitName: 'crown', pluralName: 'crowns' },
  { key: 'heron', label: 'herons', unitName: 'heron', pluralName: 'herons' },
  { key: 'bit', label: 'bits' },
];
const ITEMS = new Set(['moon-opal', 'waxed-pouch']);

/** The stair's treasure: one hoard of four (two coin rows, a known thing, a one-off), and a cup on its own. */
const STAIR = {
  id: 'reed-stair',
  name: 'The Reed Stair',
  treasure: [
    { text: '40 herons in a sock', coins: { heron: 40 }, hoard: 'Under the stair' },
    { text: '200 hn.', coins: { heron: 200 }, coinsReadAs: { printed: 'hn.', note: 'The book prints hn. once and defines no such coin; read as herons.' }, hoard: 'Under the stair' },
    { text: 'Two moon opals', itemId: 'moon-opal', value: { heron: 30 }, hoard: 'Under the stair' },
    { text: 'A silver hook (5 hn.)', value: { heron: 5 }, hoard: 'Under the stair' },
    { text: 'A tin cup', value: { bit: 2 } },
  ],
};
const piece = (text: string) => ({ kind: 'treasure', text });
const kinds = (rows: readonly HoardRow[]) => rows.map((r) => [r.kind, r.text]);

describe("a hoard's rows from a Treasure piece (K16a)", () => {
  // Purpose: a hoard mixing things and coin gives, in the pack's order, a coin row for each entry with coins and a thing
  // row for each thing: a known item by its id, a one-off by its words; a thing's worth stays with it, for the GM.
  it('things and coin, mixed', () => {
    const hoard = hoardRows(piece('Two moon opals'), STAIR, COINS, ITEMS);
    expect(hoard.name).toBe('Under the stair');
    expect(kinds(hoard.rows)).toEqual([
      ['coin', '40 herons in a sock'],
      ['coin', '200 hn.'],
      ['thing', 'Two moon opals'],
      ['thing', 'A silver hook (5 hn.)'],
    ]);
    expect(hoard.rows[2]).toEqual({ kind: 'thing', entry: 2, text: 'Two moon opals', itemId: 'moon-opal', worth: { heron: 30 } });
    expect(hoard.rows[3]).toEqual({ kind: 'thing', entry: 3, text: 'A silver hook (5 hn.)', itemId: null, worth: { heron: 5 } });
  });

  // Purpose: two coin entries in one hoard give two coin rows (pf-6: coin is a row like any other), each with its
  // amounts by denomination in the setting's coin names, and what is sent on is its own coins.
  it('two coin entries in one hoard give two coin rows', () => {
    const coin = hoardRows(piece('40 herons in a sock'), STAIR, COINS, ITEMS).rows.filter((r) => r.kind === 'coin');
    expect(coin).toHaveLength(2);
    expect(coin[0]).toEqual({ kind: 'coin', entry: 0, text: '40 herons in a sock', amounts: [{ key: 'heron', amount: 40, words: '40 herons' }], coins: { heron: 40 }, readAs: null, notCoins: [] });
  });

  // Purpose: an odd coin word is read as the pack says (pf-24a): the row keeps the book's words as printed, carries the
  // pack's note saying how they were read, and sends on the coins the pack stored them under.
  it('a coin word the setting does not define: read as the pack says, the words kept, the note carried', () => {
    const row = hoardRows(piece('200 hn.'), STAIR, COINS, ITEMS).rows[1]!;
    expect(row).toEqual({
      kind: 'coin',
      entry: 1,
      text: '200 hn.',
      amounts: [{ key: 'heron', amount: 200, words: '200 herons' }],
      coins: { heron: 200 },
      readAs: { printed: 'hn.', note: 'The book prints hn. once and defines no such coin; read as herons.' },
      notCoins: [],
    });
  });

  // Purpose: a coins key that is not one of the setting's coins is never guessed nor dropped silently: the row is built
  // from the coins it knows, in the setting's order, and the unknown key comes back as not a coin of this setting.
  it("a coins key the setting doesn't have is reported back, the rest still read", () => {
    const place = { treasure: [{ text: 'A purse of mixed coin', coins: { bit: 7, crown: 2, zz: 9 } }] };
    const row = hoardRows(piece('A purse of mixed coin'), place, COINS, ITEMS).rows[0]!;
    expect(row).toMatchObject({ kind: 'coin', amounts: [{ key: 'crown', amount: 2, words: '2 crowns' }, { key: 'bit', amount: 7, words: '7 bits' }], coins: { crown: 2, bit: 7 }, notCoins: ['zz'] });
  });

  // Purpose: one entry carrying coin and a thing's worth gives a thing row (the worth, the GM's) and a coin row (the cash).
  it('a mixed entry gives a thing row and a coin row', () => {
    const place = { treasure: [{ text: 'A reed chest and the herons in it', itemId: 'waxed-pouch', coins: { heron: 12 }, value: { crown: 1 } }] };
    expect(hoardRows(piece('A reed chest and the herons in it'), place, COINS, ITEMS).rows).toEqual([
      { kind: 'thing', entry: 0, text: 'A reed chest and the herons in it', itemId: 'waxed-pouch', worth: { crown: 1 } },
      { kind: 'coin', entry: 0, text: 'A reed chest and the herons in it', amounts: [{ key: 'heron', amount: 12, words: '12 herons' }], coins: { heron: 12 }, readAs: null, notCoins: [] },
    ]);
  });

  // Purpose: a hoard with no coin gives thing rows only; `value` alone is never coin to hand out (pf-24), and an item
  // id this setting doesn't have is a one-off by its words, the id kept so it isn't lost silently.
  it('a hoard with no coin', () => {
    const place = { treasure: [{ text: 'A tin cup', value: { bit: 2 }, hoard: 'Shelf' }, { text: 'A lantern of eel-glass', itemId: 'eel-lantern', hoard: 'Shelf' }] };
    expect(hoardRows(piece('A tin cup'), place, COINS, ITEMS).rows).toEqual([
      { kind: 'thing', entry: 0, text: 'A tin cup', itemId: null, worth: { bit: 2 } },
      { kind: 'thing', entry: 1, text: 'A lantern of eel-glass', itemId: null, worth: null, unknownItemId: 'eel-lantern' },
    ]);
  });

  // Purpose: a treasure entry with no hoard is a hoard of one: the tapped entry alone.
  it('a treasure with no hoard is a hoard of its own', () => {
    const hoard = hoardRows(piece('A tin cup'), STAIR, COINS, ITEMS);
    expect(hoard).toEqual({ name: null, rows: [{ kind: 'thing', entry: 4, text: 'A tin cup', itemId: null, worth: { bit: 2 } }] });
  });

  // Purpose: a piece with no treasure behind it (another kind, words the place's treasure doesn't have, or a place with
  // none) gives no rows, never an error.
  it('a piece with no treasure', () => {
    expect(hoardRows({ kind: 'exit', text: 'Two moon opals' }, STAIR, COINS, ITEMS)).toEqual({ name: null, rows: [] });
    expect(hoardRows(piece('A heron feather'), STAIR, COINS, ITEMS)).toEqual({ name: null, rows: [] });
    expect(hoardRows(piece('A tin cup'), { name: 'Empty loft' }, COINS, ITEMS)).toEqual({ name: null, rows: [] });
  });

  // Purpose: the Treasure piece is found again by the words it was made from: a long entry split into parts is found
  // from any of its parts, and an entry's link marks read as their words.
  it('finds the entry from a piece made of part of its words, or of its link words', () => {
    const long = `A drowned ledger, ${'its pages swollen with marsh water and reed ink, '.repeat(100)}still legible.`;
    const parts = composePackPlace({ id: 'x', name: 'Ledger room', data: { treasure: [{ text: long, coins: { bit: 3 } }] } } as never);
    if (!parts.ok) throw new Error(parts.message);
    const second = parts.parts.pieces.filter((p) => p.kind === 'treasure')[1]!.body;
    expect(hoardRows(piece(second), { treasure: [{ text: long, coins: { bit: 3 } }] }, COINS, ITEMS).rows).toHaveLength(1);
    const linked = { treasure: [{ text: 'A key to [[location:reed-stair|the stair]]', itemId: 'waxed-pouch' }] };
    expect(hoardRows(piece('A key to the stair'), linked, COINS, ITEMS).rows).toHaveLength(1);
  });

  // Purpose: messy data never throws: odd amounts (a fraction, a negative, words) are left out and reported, a long name
  // is kept whole, and nothing in the pack's entry is changed.
  it('messy data never throws and changes nothing', () => {
    const name = 'A very long-named and much-patched satchel of the eel-wardens of the lower reed marches, waterlogged';
    const place = { treasure: [{ text: name, coins: { heron: 2.5, crown: -1, bit: 'many', zz: 1 }, coinsReadAs: 'odd' }, { text: 7 }, null, 'loose'] };
    const before = JSON.stringify(place);
    const row = hoardRows(piece(name), place as never, COINS, ITEMS).rows[0]!;
    expect(row).toEqual({ kind: 'coin', entry: 0, text: name, amounts: [], coins: {}, readAs: null, notCoins: ['heron', 'crown', 'bit', 'zz'] });
    expect(JSON.stringify(place)).toBe(before);
  });
});

describe("a Treasure piece's value stays the GM's (pg-1, \"Value stays yours\")", () => {
  // Purpose: a place made from the pack keeps each treasure's value as the GM's; a player reads no place piece, and the
  // shown treasure reaches them as its words alone, through the stand-in database's player read (scene_pieces).
  it('nothing the players read carries the value', async () => {
    const world = createFakeDb();
    const registry = createAppRegistry();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    const samId = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Sunken Tithe', gmId);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
    world.addMember(campaign, samId, 'player', wren);
    const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
    world.signInAs(gmId);
    const started = await runCommand(registry, world.db, gm, startExpedition, { campaignId: campaign, mode: 'dungeon', place: 'The Reed Stair' });
    if (!started.ok) throw new Error(started.message);
    const visit = world.tables.group_places.find((g) => g.campaign_id === campaign && !g.undone)!;
    // The pieces as a pack's place makes them: the opals' value and item the GM's.
    const made = composePackPlace({ id: 'reed-stair', name: 'The Reed Stair', data: STAIR } as never);
    if (!made.ok) throw new Error(made.message);
    const opals = made.parts.pieces.find((p) => p.kind === 'treasure' && p.body === 'Two moon opals')!;
    expect(opals.gm_value).toContain('30 heron');
    world.tables.place_pieces.push({ id: 'piece-opals', campaign_id: campaign, place_id: visit.place_id, kind: 'treasure', body: opals.body, position: 1, gm_value: opals.gm_value, gm_trigger: '', gm_stat_line: '', undone: false, version: 1 });
    const shown = await runCommand(registry, world.db, gm, showPiece, { campaignId: campaign, row: { id: String(visit.id) }, piece: { id: 'piece-opals' } });
    if (!shown.ok) throw new Error(shown.message);

    world.signInAs(samId);
    const secret = /30 heron|moon-opal/;
    expect((await world.db.from('place_pieces').select('*')).data ?? []).toEqual([]);
    const seen = (await world.db.rpc('scene_pieces', { campaign })).data as { body: string }[];
    expect(seen.map((s) => s.body)).toContain('Two moon opals');
    expect(JSON.stringify(seen)).not.toMatch(secret);
  });
});
