// Spec scene-pack, piece B (#205; sf-6b, ⚑ 9 "Home Two's fix"; page 44, DT1, DT2): what feeds the rule of piece A
// (`linesAtHand`) for one place's card, from the pieces' GM facts and the place's pack entry. Seam 1, pure functions.
// Invented names only (the Wreck, the Ferryman, Mud crab, Old Harl, Lamp oil, Eel). In plain words:
//   1. A piece names a creature, a character or a thing by its pack id; a creature keeps the piece's count.
//   2. A place the GM made by hand keeps its typed words ("asleep", "wolves ×3"): a word no pack knows is no row.
//   3. The place's own pack names more: its creatures, its treasure's things and the people whose place it is; those no
//      piece names stand in the fold, so no row is lost (DT1: Old Harl, whom no piece names).
//   4. A character who uses the Ferryman's block gets the short row; one with a block of their own keeps their own line.
//   5. Each row has a name, never a machine id; a thing the packs lack on a pack-made place says so.
import { describe, expect, it } from 'vitest';
import type { Piece } from '../modules/expedition/placePlay.ts';
import { cardLinesAtHand, pieceRefsOf, type AtHandRead } from './placeLinesAtHand.ts';

const PACK = 'pack-reed';
const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) => ({ packId: PACK, kind, packEntryId: id, name, data: { id, name, ...data } });
const ferryman = entry('statBlock', 'reed-ferryman', 'Ferryman', { fields: { Level: '1', Armour: '9' } });
const crab = entry('statBlock', 'reed-mud-crab', 'Mud crab', { fields: { Level: '1', Armour: '8' } });
const eel = entry('statBlock', 'reed-eel', 'Eel', { fields: { Level: '2' } });
const oil = entry('item', 'reed-lamp-oil', 'Lamp oil', { description: 'One flask fills a lantern once.' });
const ring = entry('item', 'reed-bronze-ring', 'Bronze ring', { description: 'A plain band.' });
const harl = entry('npc', 'reed-old-harl', 'Old Harl', { role: 'a ferryman', locationId: 'the-wreck', statBlockId: 'reed-ferryman' });
const elsewhere = entry('npc', 'reed-mother-sedge', 'Mother Sedge', { locationId: 'customs-shed', statBlockId: 'reed-ferryman' });
const read: AtHandRead = { packs: [{ packId: PACK, shortName: 'Reed', statBlockLayout: null }], entries: [ferryman, crab, eel, oil, ring, harl, elsewhere] };

let n = 0;
const piece = (kind: Piece['kind'], text: string, gm: Partial<Piece['gm']> = {}, shown = false): Piece => ({
  id: `piece-${++n}`,
  kind,
  text,
  shown,
  shownAt: null,
  gm: { value: '', trigger: '', statLine: '', ...gm },
  version: 1,
});
// Frame DT1's place, "2. The Wreck": the description, Sailcloth (the Ferryman ×3), Hold (Mud crab ×4), the crate (Lamp
// oil); the pack also lists an Eel no piece shows, the Bronze ring in a hoard, and Old Harl, who lives here.
const wreckPieces = [
  piece('description', 'A cog on her side on the bar.', {}, true),
  piece('person', 'Three men sleep under a sailcloth.', { statLine: 'reed-ferryman ×3 (asleep)' }),
  piece('person', 'Black water to the knee.', { statLine: 'reed-mud-crab ×4' }),
  piece('treasure', 'Eight flasks of lamp oil, dry.', { value: 'Item: reed-lamp-oil' }, true),
];
const wreck = { packId: PACK, entryId: 'the-wreck', data: { contents: [{ statBlockId: 'reed-ferryman', count: 3, appearance: 'Three men' }, { statBlockId: 'reed-eel', count: 1 }], treasure: [{ text: 'Bronze ring', hoard: 'Ring', itemId: 'reed-bronze-ring' }] } };

describe('1, 2. what a piece names', () => {
  // Purpose: a creature's piece names its stat block with the piece's count; a character and a thing are named alone.
  it('reads a creature with its count, a character and a thing', () => {
    const known = () => true;
    expect(pieceRefsOf({ value: '', trigger: '', statLine: 'reed-ferryman ×3 (asleep)' }, true, known)).toEqual([{ ref: 'statBlock/reed-ferryman', count: '3' }]);
    expect(pieceRefsOf({ value: '', trigger: '', statLine: 'reed-ferryman ×1d4' }, true, known)).toEqual([{ ref: 'statBlock/reed-ferryman', count: '1d4' }]);
    expect(pieceRefsOf({ value: '', trigger: '', statLine: 'NPC: reed-old-harl' }, true, known)).toEqual([{ ref: 'npc/reed-old-harl', count: null }]);
    expect(pieceRefsOf({ value: '40 gp, Item: reed-lamp-oil', trigger: '', statLine: '' }, true, known)).toEqual([{ ref: 'item/reed-lamp-oil', count: null }]);
  });

  // Purpose: on a place made by hand, a typed word no pack knows ("asleep", "wolves ×3") is no row, so the card never
  // says "Not in your packs" over the GM's own words.
  it("leaves a hand-made place's typed words alone", () => {
    const none = () => false;
    expect(pieceRefsOf({ value: '', trigger: '', statLine: 'asleep' }, false, none)).toEqual([]);
    expect(pieceRefsOf({ value: '', trigger: '', statLine: 'wolves ×3' }, false, none)).toEqual([]);
    expect(pieceRefsOf({ value: '', trigger: '', statLine: 'NPC: someone' }, false, none)).toEqual([]);
  });
});

describe('3, 4. where each line stands on the Wreck', () => {
  const atHand = cardLinesAtHand(wreckPieces, wreck, read);

  // Purpose: each piece carries the line it names, in full, with its count; the description carries none.
  it('puts each named line on its piece', () => {
    expect(atHand.pieces.map((rows) => rows.map((r) => [r.form, r.form === 'missing' ? r.words : r.name, r.count]))).toEqual([
      [],
      [['full', 'Ferryman', '3']],
      [['full', 'Mud crab', '4']],
      [['full', 'Lamp oil', null]],
    ]);
  });

  // Purpose: the fold keeps what no piece names: the Eel, Old Harl (short: he uses the Ferryman's block, which already
  // stands on Sailcloth) and the hoard's Bronze ring; a person who lives elsewhere is not on this card.
  it('keeps the rest in the fold, Old Harl as the short row', () => {
    expect(atHand.fold.statLines.map((r) => [r.form, r.form === 'missing' ? r.words : r.name])).toEqual([
      ['full', 'Eel'],
      ['short', 'Old Harl'],
    ]);
    const harlRow = atHand.fold.statLines[1]!;
    expect(harlRow.form === 'short' && harlRow.words).toBe('Same stat line as the Ferryman.');
    expect(atHand.fold.items.map((r) => r.form !== 'missing' && r.name)).toEqual(['Bronze ring']);
    expect(atHand.onPieces).toBe(true);
  });

  // Purpose: Old Harl's row says who he is and carries the block he uses; a thing's row carries its rule.
  it('builds each detail from the pack entry', () => {
    const harlRow = atHand.fold.statLines[1]!;
    expect(harlRow.form !== 'missing' && harlRow.detail.kind).toBe('a ferryman');
    expect(harlRow.form !== 'missing' && harlRow.detail.uses?.name).toBe('Ferryman');
    const oilRow = atHand.pieces[3]![0]!;
    expect(oilRow.form !== 'missing' && oilRow.detail.rule).toBe('One flask fills a lantern once.');
  });

  // Purpose: a character with a block of their own keeps their own full line (DT1 C).
  it('keeps a character with a block of their own in full', () => {
    const own = entry('statBlock', 'reed-old-harl-stats', 'Old Harl', { fields: { Level: '2' } });
    const ownHarl = { ...harl, data: { ...harl.data, statBlockId: 'reed-old-harl-stats' } };
    const mine = cardLinesAtHand(wreckPieces, wreck, { ...read, entries: [ferryman, crab, eel, oil, ring, ownHarl, own] });
    expect(mine.fold.statLines.map((r) => [r.form, r.form === 'missing' ? r.words : r.name])).toEqual([
      ['full', 'Eel'],
      ['full', 'Old Harl'],
    ]);
  });

  // Purpose: the rows in equal the rows out, and no row carries a machine id.
  it('drops no row and shows no id', () => {
    const rows = [...atHand.pieces.flat(), ...atHand.fold.statLines, ...atHand.fold.items];
    expect(rows).toHaveLength(6);
    const words = rows.map((r) => (r.form === 'missing' ? r.words : `${r.name} ${r.form === 'short' ? r.words : ''} ${r.detail.kind ?? ''}`));
    expect(words.join(' ')).not.toMatch(/reed-/);
  });
});

describe("3b. a hoard's things (44-5 B: the Crate carries Lamp oil ×8)", () => {
  // Purpose: a hoard's piece, led by the hoard's name, carries its things' rows with their counts, so they don't fall
  // to the fold.
  it("puts a hoard's things on the hoard's piece, with their counts", () => {
    const crate = { ...piece('treasure', 'Eight flasks of lamp oil, dry.', {}), lead: 'Crate' };
    const place = { packId: PACK, entryId: 'the-wreck', data: { hoards: [{ name: 'Crate', text: 'Eight flasks of lamp oil, dry.' }], treasure: [{ text: 'Lamp oil', qty: 8, hoard: 'Crate', itemId: 'reed-lamp-oil' }] } };
    const atHand = cardLinesAtHand([crate], place, read);
    expect(atHand.pieces[0]!.map((r) => [r.form, r.form === 'missing' ? r.words : r.name, r.count])).toEqual([['full', 'Lamp oil', '8']]);
    expect(atHand.fold.items).toEqual([]);
  });
});

describe('5. the edges', () => {
  // Purpose: on a pack-made place, a creature the packs lack says so on its piece, never its id.
  it("says a missing creature isn't in your packs", () => {
    const lost = [piece('person', 'Something in the reeds.', { statLine: 'reed-no-such-beast ×2' })];
    const atHand = cardLinesAtHand(lost, { ...wreck, data: {} }, read);
    expect(atHand.pieces[0]).toEqual([{ form: 'missing', kind: 'statBlock', count: '2', words: 'Not in your packs: a creature' }]);
  });

  // Purpose: a place the GM made by hand (no pack) gives the fold nothing, and its typed words give no row.
  it('reads nothing more on a hand-made place', () => {
    const typed = [piece('person', 'Wolves at the treeline.', { statLine: 'wolves ×3' })];
    const atHand = cardLinesAtHand(typed, null, read);
    expect(atHand).toEqual({ pieces: [[]], fold: { statLines: [], items: [] }, onPieces: false });
  });

  // Purpose: a place whose pieces name no line and whose pack names none has an empty fold and no quiet line.
  it('gives an empty fold when nothing is named', () => {
    const atHand = cardLinesAtHand([piece('description', 'Mud.')], { ...wreck, entryId: 'nowhere', data: {} }, read);
    expect(atHand).toEqual({ pieces: [[]], fold: { statLines: [], items: [] }, onPieces: false });
  });
});
