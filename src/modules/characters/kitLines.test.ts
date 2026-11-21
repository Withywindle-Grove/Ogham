// Gear lines that depend on the character (creation survey PR 4; cs-6, G-83, G-88, G-92; rc-2, rc-3). Invented
// content only. Purposes:
//   A Small character's kit gives the swapped weapon; a Medium one keeps the kit's (ifSize).
//   A kindred's armour substitutes swap the kit's armour (a mire-kin's kit gives the reed mail, not the bog-iron coat).
//   "10 darts from a bundle of 20" gives 10, not 200: units count single pieces and win over qty times the bundle.
//   A oneOf line is a choice with its default ticked, so the kit is taken at once; tapping the other gives it instead.
//   Units given as dice become a roll on the kit, a row per result, each that many single pieces.
//   Single pieces read by their own name ("4 ration days"), and a roll of them is headed so (after-test A1).
//   The setting's given gear reads { itemId, qty } lines and adds up an id named twice; a pick line is read apart, and
//   its table's rows with items are what can be picked.
//   A { name } line is a one-off: no item id, its name kept.
//   The coins trait-list entries add (kept on the record by list) add up; nothing kept is 0.
import { describe, expect, it } from 'vitest';
import {
  entryMoneyOf,
  gearContextOf,
  gearLines,
  kitContents,
  kitRolls,
  kitTaken,
  noRollPicks,
  pickRows,
  piecesName,
  piecesOf,
  piecesWords,
  settleTitle,
  startingEquipment,
  startingPicks,
  unitsDice,
  untappedRoll,
} from './startingGear.ts';

const names: Record<string, string> = { 'long-reed-bow': 'Long reed bow', 'short-reed-bow': 'Short reed bow', 'reed-fiddle': 'Reed fiddle', 'bog-pipe': 'Bog pipe', 'tallow-candles': 'Tallow candles' };
const nameOf = (id: string) => names[id];

describe('kit lines read for the character (cs-6)', () => {
  const kit = {
    items: [
      { itemId: 'long-reed-bow', qty: 1, ifSize: { Small: { itemId: 'short-reed-bow' } } },
      { itemId: 'bog-iron-coat', qty: 1 },
    ],
  };

  it("a Small character's kit gives the swapped weapon; a Medium one keeps the kit's", () => {
    expect(kitContents(kit, gearContextOf({ size: 'Small' })).map((l) => l.itemId)).toEqual(['short-reed-bow', 'bog-iron-coat']);
    expect(kitContents(kit, gearContextOf({ size: 'medium' })).map((l) => l.itemId)).toEqual(['long-reed-bow', 'bog-iron-coat']);
    // Any case: "small" matches the pack's "Small".
    expect(kitContents(kit, gearContextOf({ size: 'small' }))[0]!.itemId).toBe('short-reed-bow');
    expect(kitContents(kit)[0]!.itemId).toBe('long-reed-bow');
  });

  it("a kindred's armour substitutes swap the kit's armour", () => {
    const mireKin = { size: 'Small', armourSubstitutes: { 'bog-iron-coat': 'reed-mail' } };
    expect(kitContents(kit, gearContextOf(mireKin)).map((l) => l.itemId)).toEqual(['short-reed-bow', 'reed-mail']);
    // In a roll's rows too.
    const rolled = { rolls: [{ name: 'Armour', die: 'd6', rows: [{ min: 1, max: 6, items: [{ itemId: 'bog-iron-coat' }] }] }] };
    expect(kitTaken(rolled, [[0]], gearContextOf(mireKin))).toEqual([{ itemId: 'reed-mail', qty: 1 }]);
  });

  it('"10 darts from a bundle of 20" gives 10, not 200: units win over qty times the bundle', () => {
    const [line] = gearLines([{ itemId: 'reed-darts', qty: 1, units: 10 }]);
    expect(line).toEqual({ itemId: 'reed-darts', qty: 1, units: 10 });
    expect(piecesOf(line!, 20)).toBe(10);
    // Without units a line counts whole bundles, as before.
    expect(piecesOf(gearLines([{ itemId: 'reed-darts', qty: 2 }])[0]!, 20)).toBe(40);
  });

  it('a oneOf line is a choice with its default ticked, so the kit is taken at once; the other one swaps', () => {
    const bard = { items: [{ itemId: 'rope-reed' }, { itemId: 'reed-fiddle', oneOf: ['reed-fiddle', 'bog-pipe'], qty: 1 }] };
    const ctx = gearContextOf(null, nameOf);
    const [choice] = kitRolls(bard, ctx);
    expect(choice).toMatchObject({ choice: true, preset: 0, name: 'Reed fiddle or Bog pipe' });
    expect(settleTitle(choice!)).toBe('Choose one: Reed fiddle or Bog pipe');
    // The kit's own items leave the choice out; the choice gives the default until another is tapped.
    expect(kitContents(bard, ctx).map((l) => l.itemId)).toEqual(['rope-reed']);
    const picks = noRollPicks(bard, ctx);
    expect(untappedRoll(bard, picks, ctx)).toBeNull();
    expect(kitTaken(bard, picks as number[][], ctx).map((l) => l.itemId)).toEqual(['rope-reed', 'reed-fiddle']);
    expect(kitTaken(bard, [[1]], ctx).map((l) => l.itemId)).toEqual(['rope-reed', 'bog-pipe']);
  });

  it('units given as dice become a roll on the kit: a row per result, each that many single pieces', () => {
    const kit = { items: [{ itemId: 'tallow-candles', qty: 1, units: '1d6' }], rolls: [{ name: 'Weapons', die: 'd4', rows: [{ min: 1, max: 4, items: [{ itemId: 'eel-knife' }] }] }] };
    const rolls = kitRolls(kit, gearContextOf(null, nameOf));
    // The kit's own roll first, so a saved pick keeps its place.
    expect(rolls.map((r) => r.name)).toEqual(['Weapons', 'Tallow candles']);
    expect(rolls[1]!.die).toBe('1d6');
    expect(rolls[1]!.rows.map((r) => r.min)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(kitTaken(kit, [[0], [3]])).toEqual([{ itemId: 'eel-knife', qty: 1 }, { itemId: 'tallow-candles', qty: 1, units: 4 }]);
    // Until it's tapped, the kit waits for it.
    expect(untappedRoll(kit, [[0], [undefined]])).toBe('tallow-candles');
    expect(unitsDice('2d6')).toEqual({ count: 2, sides: 6 });
    expect(unitsDice('d100')).toBeNull();
    expect(unitsDice(10)).toBeNull();
  });

  it('single pieces read by their own name: "4 ration days", "Candle ×4" without a plural, the item\'s name without either', () => {
    expect(piecesWords('Iron rations (7 days)', { unitName: 'ration day', pluralName: 'ration days' }, 4)).toBe('4 ration days');
    expect(piecesWords('Iron rations (7 days)', { unitName: 'ration day', pluralName: 'ration days' }, 1)).toBe('ration day');
    expect(piecesWords('Tallow candles (10)', { unitName: 'Candle' }, 4)).toBe('Candle ×4');
    expect(piecesWords('Dry rations', {}, 4)).toBe('Dry rations ×4');
    // A roll of pieces is headed by the pieces' name, not the bundle's.
    const kit = { items: [{ itemId: 'tallow-candles', qty: 1, units: '1d6' }] };
    const pieces = (id: string) => (id === 'tallow-candles' ? (piecesName({ unitName: 'candle', pluralName: 'candles' }) ?? undefined) : undefined);
    expect(kitRolls(kit, gearContextOf(null, nameOf, undefined, pieces))[0]!.name).toBe('Candles');
    expect(piecesName({})).toBeNull();
  });

  it('a { name } line is a one-off: no item id, its name kept', () => {
    expect(gearLines([{ name: 'Lucky eel tooth' }, { name: '  ' }])).toEqual([{ itemId: '', qty: 1, name: 'Lucky eel tooth' }]);
  });
});

describe("the setting's given gear (cs-6, of-11)", () => {
  it('reads { itemId, qty } lines and adds up an id named twice; plain ids still work', () => {
    const rules = [{ startingEquipment: [{ itemId: 'dry-rations', qty: 2 }, 'rope-reed', { itemId: 'dry-rations' }, { pick: { tableId: 'fen-odds', upTo: 2 } }] }];
    expect(startingEquipment(rules)).toEqual([
      { itemId: 'dry-rations', qty: 3 },
      { itemId: 'rope-reed', qty: 1 },
    ]);
    expect(startingPicks(rules)).toEqual([{ tableId: 'fen-odds', upTo: 2 }]);
    // A pick without a table or a count isn't one.
    expect(startingPicks([{ startingEquipment: [{ pick: { tableId: 'fen-odds' } }, { pick: { upTo: 2 } }] }])).toEqual([]);
  });

  it("a pick's rows are the table's rows with items, read for the character", () => {
    const table = { rows: [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 2, result: 'Nothing' }, { min: 3, max: 4, result: 'Coat', items: [{ itemId: 'bog-iron-coat' }] }] };
    const rows = pickRows(table, gearContextOf({ armourSubstitutes: { 'bog-iron-coat': 'reed-mail' } }));
    expect(rows.map((r) => [r.min, r.max, r.items[0]!.itemId])).toEqual([
      [1, 1, 'rope-reed'],
      [3, 4, 'reed-mail'],
    ]);
  });
});

describe("trait-list entries' coins (rc-2)", () => {
  it('the coins kept on the record by list add up; nothing kept is 0', () => {
    expect(entryMoneyOf({ traitMoney: { 'fen-backgrounds': 50, 'fen-omens': 5 } })).toBe(55);
    expect(entryMoneyOf({ traitMoney: { odd: 'lots' } })).toBe(0);
    expect(entryMoneyOf({})).toBe(0);
    expect(entryMoneyOf(null)).toBe(0);
  });
});
