// The pack's ids in a piece's GM-only facts, named as a person would (plan dec-scene-quickfix Q7; F20 c, F21 b).
// Invented names only.
import { describe, expect, it } from 'vitest';
import { composePackPlace } from './placeFromPack.ts';
import { idsInFacts, namedFacts, pieceNamesFrom, type GmFacts, type PieceNames } from './pieceNames.ts';

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
