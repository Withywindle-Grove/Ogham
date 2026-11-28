// The pack's ids in a piece's GM-only facts, named as a person would (plan dec-scene-quickfix Q7; F20 c, F21 b).
// Invented names only.
import { describe, expect, it } from 'vitest';
import { composePackPlace } from './placeFromPack.ts';
import { idsInFacts, linesAtHand, namedFacts, pieceNamesFrom, type GmFacts, type HandLine, type LinesAtHand, type PieceNames } from './pieceNames.ts';

const facts = (value = '', statLine = '', trigger = ''): GmFacts => ({ value, trigger, statLine });
const byId = new Map([
  ['item/silver-arrows', 'Silver-tipped arrows'],
  ['npc/mf-npc-oswy', 'Oswy the ferryman'],
  ['statBlock/bog-lurker', 'Bog lurker'],
]);
// A place the GM made by hand, and one made from a pack.
const names: PieceNames = { byId, packId: null };
const packNames: PieceNames = { byId, packId: 'pack-reed' };

describe('the ids a piece names', () => {
  // Purpose: each of the composer's three shapes gives its id with its kind, and words a GM typed give none.
  it('reads an item, a character and a creature, and nothing from typed words', () => {
    expect(idsInFacts(facts('40 gp, Item: silver-arrows'))).toEqual([{ kind: 'item', id: 'silver-arrows' }]);
    expect(idsInFacts(facts('', 'NPC: mf-npc-oswy'))).toEqual([{ kind: 'npc', id: 'mf-npc-oswy' }]);
    expect(idsInFacts(facts('', 'bog-lurker ×6 (asleep)'))).toEqual([{ kind: 'statBlock', id: 'bog-lurker' }]);
    expect(idsInFacts(facts('40 gp', 'Hits hard, flees at half'))).toEqual([]);
    expect(idsInFacts(facts('', 'a creature ×2'))).toEqual([]);
  });
});

describe('the GM facts, named', () => {
  // Purpose: a value with an item reads the item's name; an item alone too; a value alone is unchanged.
  it('names the item, beside its value or alone', () => {
    expect(namedFacts(facts('40 gp, Item: silver-arrows'), names).value).toBe('40 gp, Item: Silver-tipped arrows');
    expect(namedFacts(facts('Item: silver-arrows'), names).value).toBe('Item: Silver-tipped arrows');
    expect(namedFacts(facts('40 herons'), names).value).toBe('40 herons');
  });

  // Purpose: a creature reads its stat block's name and keeps its count and note; a character reads its name.
  it('names a creature with its count and note, and a character', () => {
    expect(namedFacts(facts('', 'bog-lurker ×6 (asleep in the reeds)'), names).statLine).toBe('Bog lurker ×6 (asleep in the reeds)');
    expect(namedFacts(facts('', 'bog-lurker'), names).statLine).toBe('Bog lurker');
    expect(namedFacts(facts('', 'NPC: mf-npc-oswy'), names).statLine).toBe('NPC: Oswy the ferryman');
  });

  // Purpose: on a place made from a pack, an id nobody knows is left out of the line, never printed; a creature then
  // reads "a creature".
  it('leaves an unknown id out on a pack-made place', () => {
    expect(namedFacts(facts('40 gp, Item: no-such-thing'), packNames).value).toBe('40 gp');
    expect(namedFacts(facts('Item: no-such-thing'), packNames).value).toBe('');
    expect(namedFacts(facts('', 'NPC: no-such-person'), packNames).statLine).toBe('');
    expect(namedFacts(facts('', 'no-such-beast ×3 (hungry)'), packNames).statLine).toBe('a creature ×3 (hungry)');
    expect(namedFacts(facts('', 'no-such-beast'), packNames).statLine).toBe('a creature');
  });

  // Purpose: a stat line the GM typed by hand that starts with a lower-case word ("asleep", "wolves ×3") keeps its
  // words when no pack knows that word (review of #109, finding 1).
  it("keeps a GM's typed stat line that no pack knows", () => {
    expect(namedFacts(facts('', 'asleep'), names).statLine).toBe('asleep');
    expect(namedFacts(facts('', 'wolves ×3'), names).statLine).toBe('wolves ×3');
  });

  // Purpose: words a GM typed by hand, and a hazard's trigger, are never changed.
  it('keeps typed words as they are', () => {
    const typed = facts('A heavy purse', 'Hits hard', 'a save, or stuck');
    expect(namedFacts(typed, names)).toEqual(typed);
    expect(namedFacts(typed, packNames)).toEqual(typed);
  });

  // Purpose: on a hand-made place a known id is still named, and an unknown item or character id stays as stored.
  it('names a known id on a hand-made place and keeps an unknown one', () => {
    expect(namedFacts(facts('', 'bog-lurker ×2'), names).statLine).toBe('Bog lurker ×2');
    expect(namedFacts(facts('40 gp, Item: no-such-thing'), names).value).toBe('40 gp, Item: no-such-thing');
    expect(namedFacts(facts('', 'NPC: no-such-person'), names).statLine).toBe('NPC: no-such-person');
  });

  // Purpose: a place made before this fix (the pack's ids stored by the composer) reads by name.
  it('names what the composer stored', () => {
    const made = composePackPlace({
      packId: 'pack-reed',
      packEntryId: 'the-jetty',
      name: 'The jetty',
      data: {
        playerView: { people: [{ description: 'A ferryman mends a net.', npcId: 'mf-npc-oswy' }] },
        treasure: [{ text: 'A quiver under the planks.', itemId: 'silver-arrows', value: { gp: 40 } }],
        contents: [{ statBlockId: 'bog-lurker', count: 6, note: 'asleep', appearance: 'Six humps in the mud.' }],
      },
    });
    if (!made.ok) throw new Error(made.message);
    const lines = made.parts.pieces.map((p) => namedFacts({ value: p.gm_value, trigger: p.gm_trigger, statLine: p.gm_stat_line }, packNames));
    expect(lines.map((l) => l.statLine || l.value)).toEqual(['NPC: Oswy the ferryman', '40 gp, Item: Silver-tipped arrows', 'Bog lurker ×6 (asleep)']);
  });
});

describe('reading the names', () => {
  const entries = [
    { packId: 'pack-b', kind: 'item', packEntryId: 'silver-arrows', name: 'Arrows (second pack)' },
    { packId: 'pack-a', kind: 'item', packEntryId: 'silver-arrows', name: 'Silver-tipped arrows' },
    { packId: 'pack-a', kind: 'statBlock', packEntryId: 'bog-lurker', name: 'bog-lurker' },
    { packId: 'pack-other', kind: 'npc', packEntryId: 'mf-npc-oswy', name: 'Not attached' },
  ];
  const wanted = [facts('Item: silver-arrows', 'bog-lurker ×2'), facts('', 'NPC: mf-npc-oswy')];

  // Purpose: the names come from the campaign's attached packs, the first pack in its order winning, and a name that is
  // only its id counts as unknown.
  it("reads the attached packs' names, in the campaign's order", () => {
    expect([...pieceNamesFrom(entries, ['pack-a', 'pack-b'], wanted, null).byId]).toEqual([['item/silver-arrows', 'Silver-tipped arrows']]);
  });

  // Purpose: where two packs share an id, the place's own pack wins over the campaign's order (review of #109, nit 3).
  it("reads the place's own pack first", () => {
    const found = pieceNamesFrom(entries, ['pack-a', 'pack-b'], wanted, 'pack-b');
    expect(found.byId.get('item/silver-arrows')).toBe('Arrows (second pack)');
    expect(found.packId).toBe('pack-b');
  });
});

describe('where a line stands on a place\'s card (sf-6b, ⚑ 9 "Home Two\'s fix")', () => {
  // A detail stands in for the row's BookDetail: the rule never reads it, only carries it.
  const ferryman: HandLine<string> = { ref: 'statBlock/ferryman', kind: 'statBlock', name: 'Ferryman', line: 'statBlock/ferryman', detail: 'ferryman block' };
  const crab: HandLine<string> = { ref: 'statBlock/mud-crab', kind: 'statBlock', name: 'Mud crab', line: 'statBlock/mud-crab', detail: 'crab block' };

  // Purpose: a creature a piece names stands on that piece, in full, with the piece's count, and not in the fold.
  it('puts a named creature on its piece and not in the fold', () => {
    const atHand = linesAtHand([[{ ref: 'statBlock/ferryman', count: '3' }]], [ferryman]);
    expect(atHand.pieces).toEqual([[{ form: 'full', kind: 'statBlock', name: 'Ferryman', count: '3', detail: 'ferryman block' }]]);
    expect(atHand.fold).toEqual({ statLines: [], items: [] });
  });

  const harl: HandLine<string> = { ref: 'npc/old-harl', kind: 'npc', name: 'Old Harl', line: 'statBlock/ferryman', detail: 'harl, uses the ferryman' };
  const ring: HandLine<string> = { ref: 'item/bronze-ring', kind: 'item', name: 'Bronze ring', line: 'item/bronze-ring', detail: 'ring rule' };
  const oil: HandLine<string> = { ref: 'item/lamp-oil', kind: 'item', name: 'Lamp oil', line: 'item/lamp-oil', detail: 'oil rule' };
  // Frame DT1's place, "2. The Wreck": Sailcloth names the Ferryman, Hold the Mud crab, two pieces the ring and the
  // oil; the book's words name Old Harl, whom no piece names, and who uses the Ferryman's block.
  const wreck = [[{ ref: 'statBlock/ferryman', count: '3' }], [{ ref: 'statBlock/mud-crab', count: '4' }], [{ ref: 'item/bronze-ring' }], [{ ref: 'item/lamp-oil' }], []];
  const wreckLines = [ferryman, crab, harl, ring, oil];
  const rows = (atHand: LinesAtHand<string>) => [...atHand.pieces.flat(), ...atHand.fold.statLines, ...atHand.fold.items];

  // Purpose: a line no piece names stays in the fold, in full, under its group: a stat line under "Stat lines", an
  // item under "Items".
  it('keeps an unnamed line in the fold, in its group', () => {
    const atHand = linesAtHand([[{ ref: 'statBlock/ferryman', count: '3' }]], [ferryman, crab, ring]);
    expect(atHand.fold.statLines).toEqual([{ form: 'full', kind: 'statBlock', name: 'Mud crab', count: null, detail: 'crab block' }]);
    expect(atHand.fold.items).toEqual([{ form: 'full', kind: 'item', name: 'Bronze ring', count: null, detail: 'ring rule' }]);
  });

  // Purpose: a character who uses another's block gets the short row, and the block's line stands once on the card
  // (DT1: Old Harl in the fold, the Ferryman's line on Sailcloth).
  it("gives a character who uses another's block the short row", () => {
    const atHand = linesAtHand(wreck, wreckLines);
    expect(atHand.fold.statLines).toEqual([{ form: 'short', kind: 'npc', name: 'Old Harl', count: null, detail: 'harl, uses the ferryman', words: 'Same stat line as the Ferryman.' }]);
    expect(rows(atHand).filter((r) => r.form === 'full' && r.detail.includes('ferryman'))).toHaveLength(1);
  });

  // Purpose: a named character with a block of their own keeps their own full line (DT1 C).
  it('keeps a character with a block of their own in full', () => {
    const ownHarl = { ...harl, line: 'npc/old-harl', detail: 'harl, his own block' };
    const atHand = linesAtHand(wreck, [ferryman, crab, ownHarl, ring, oil]);
    expect(atHand.fold.statLines).toEqual([{ form: 'full', kind: 'npc', name: 'Old Harl', count: null, detail: 'harl, his own block' }]);
  });

  // Purpose: two pieces naming one thing give one full row, on the first, and one short row, each with its own count.
  it('gives two pieces naming one thing one full row and one short', () => {
    const atHand = linesAtHand([[{ ref: 'statBlock/ferryman', count: '3' }], [{ ref: 'statBlock/ferryman', count: '1' }], [{ ref: 'item/bronze-ring' }], [{ ref: 'item/bronze-ring' }]], [ferryman, ring]);
    expect(atHand.pieces.map((p) => p.map((r) => [r.form, r.count]))).toEqual([[['full', '3']], [['short', '1']], [['full', null]], [['short', null]]]);
    expect(atHand.pieces[1]![0]).toMatchObject({ name: 'Ferryman', words: 'Same stat line as the Ferryman.' });
    expect(atHand.pieces[3]![0]).toMatchObject({ name: 'Bronze ring', words: 'Same item as the Bronze ring.' });
  });

  // Purpose: the same line under two names on two pieces is one full row and one short, keyed by the line, not the
  // name; a character first goes by name alone in the quiet line.
  it('keys the short row by the identical line, not by the name', () => {
    const atHand = linesAtHand([[{ ref: 'npc/old-harl' }], [{ ref: 'statBlock/ferryman', count: '2' }]], [ferryman, harl]);
    expect(atHand.pieces).toEqual([
      [{ form: 'full', kind: 'npc', name: 'Old Harl', count: null, detail: 'harl, uses the ferryman' }],
      [{ form: 'short', kind: 'statBlock', name: 'Ferryman', count: '2', detail: 'ferryman block', words: 'Same stat line as Old Harl.' }],
    ]);
  });

  // Purpose: a place whose every line stands on a piece leaves no group in the fold.
  it('leaves the fold empty when every line is on a piece', () => {
    const atHand = linesAtHand([...wreck.slice(0, 4), [{ ref: 'npc/old-harl' }]], wreckLines);
    expect(atHand.fold).toEqual({ statLines: [], items: [] });
  });

  // Purpose: no row is dropped: every line given stands on the card, the rows out are one a piece's mention plus one a
  // line no piece names, and each identical line is printed in full exactly once.
  it('drops no row and prints no line twice', () => {
    const atHand = linesAtHand(wreck, wreckLines);
    const out = rows(atHand);
    expect(out).toHaveLength(4 + 1);
    expect(new Set(out.map((r) => (r.form === 'missing' ? r.words : r.name)))).toEqual(new Set(wreckLines.map((l) => l.name)));
    const fulls = out.filter((r) => r.form === 'full').map((r) => wreckLines.find((l) => l.detail === r.detail)!.line);
    expect(fulls.sort()).toEqual([...new Set(wreckLines.map((l) => l.line))].sort());
  });

  // Purpose: a machine id never reaches the words, and a line the packs lack reads "Not in your packs: <name>"; an id
  // a piece names that no line names reads by its kind ("a creature"), never by the id.
  it('names, never ids, and says what the packs lack', () => {
    const lurker: HandLine<string> = { ref: 'statBlock/salt-hag', kind: 'statBlock', name: 'Salt hag', line: 'statBlock/salt-hag', detail: null };
    const atHand = linesAtHand([[{ ref: 'statBlock/salt-hag', count: '2' }], [{ ref: 'statBlock/no-such-beast' }], [{ ref: 'item/no-such-thing' }]], [...wreckLines, lurker]);
    expect(atHand.pieces.map((p) => p[0])).toEqual([
      { form: 'missing', kind: 'statBlock', count: '2', words: 'Not in your packs: Salt hag' },
      { form: 'missing', kind: 'statBlock', count: null, words: 'Not in your packs: a creature' },
      { form: 'missing', kind: 'item', count: null, words: 'Not in your packs: a thing' },
    ]);
    const words = JSON.stringify(rows(atHand).map((r) => (r.form === 'missing' ? r.words : [r.name, r.form === 'short' ? r.words : ''])));
    for (const id of ['ferryman', 'mud-crab', 'old-harl', 'bronze-ring', 'lamp-oil', 'salt-hag', 'no-such-beast', 'no-such-thing']) expect(words).not.toContain(id);
  });
});
