// The pack's ids in a piece's GM-only facts, named as a person would (plan dec-scene-quickfix Q7; F20 c, F21 b).
// Invented names only.
import { describe, expect, it } from 'vitest';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { composePackPlace } from './placeFromPack.ts';
import { idsInFacts, loadPieceNames, namedFacts, type GmFacts } from './pieceNames.ts';

const facts = (value = '', statLine = '', trigger = ''): GmFacts => ({ value, trigger, statLine });
const names = new Map([
  ['item/silver-arrows', 'Silver-tipped arrows'],
  ['npc/mf-npc-oswy', 'Oswy the ferryman'],
  ['statBlock/bog-lurker', 'Bog lurker'],
]);

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

  // Purpose: an id nobody knows is left out of the line, never printed.
  it('leaves an unknown id out', () => {
    expect(namedFacts(facts('40 gp, Item: no-such-thing'), names).value).toBe('40 gp');
    expect(namedFacts(facts('Item: no-such-thing'), names).value).toBe('');
    expect(namedFacts(facts('', 'NPC: no-such-person'), names).statLine).toBe('');
    expect(namedFacts(facts('', 'no-such-beast ×3 (hungry)'), names).statLine).toBe('×3 (hungry)');
  });

  // Purpose: words a GM typed by hand, and a hazard's trigger, are never changed.
  it('keeps typed words as they are', () => {
    const typed = facts('A heavy purse', 'Hits hard', 'a save, or stuck');
    expect(namedFacts(typed, names)).toEqual(typed);
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
    const lines = made.parts.pieces.map((p) => namedFacts({ value: p.gm_value, trigger: p.gm_trigger, statLine: p.gm_stat_line }, names));
    expect(lines.map((l) => l.statLine || l.value)).toEqual(['NPC: Oswy the ferryman', '40 gp, Item: Silver-tipped arrows', 'Bog lurker ×6 (asleep)']);
  });
});

describe('reading the names', () => {
  // Purpose: the names come from the campaign's attached packs, the first pack in its order winning, and a name that is
  // only its id counts as unknown.
  it("reads the attached packs' names, in the campaign's order", async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Reed Marches', gm);
    world.signInAs(gm);
    world.tables.campaign_packs.push({ campaign_id: campaign, pack_id: 'pack-b', priority: 2 }, { campaign_id: campaign, pack_id: 'pack-a', priority: 1 });
    world.tables.library_entries.push(
      { id: 'e1', pack_id: 'pack-b', kind: 'item', pack_entry_id: 'silver-arrows', name: 'Arrows (second pack)', data: {} },
      { id: 'e2', pack_id: 'pack-a', kind: 'item', pack_entry_id: 'silver-arrows', name: 'Silver-tipped arrows', data: {} },
      { id: 'e3', pack_id: 'pack-a', kind: 'statBlock', pack_entry_id: 'bog-lurker', name: 'bog-lurker', data: {} },
      { id: 'e4', pack_id: 'pack-other', kind: 'npc', pack_entry_id: 'mf-npc-oswy', name: 'Not attached', data: {} },
    );
    const found = await loadPieceNames(world.db, campaign, [facts('Item: silver-arrows', 'bog-lurker ×2'), facts('', 'NPC: mf-npc-oswy')]);
    expect([...found]).toEqual([['item/silver-arrows', 'Silver-tipped arrows']]);
  });
});
