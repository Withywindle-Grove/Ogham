// Tests for the pack checker's notes on a town as the source lays one out (scripts/pack-town.mjs; ruling
// dec-pack-formats-2026-11-11, pf-3 and pf-5). Invented packs only.
import { describe, expect, it } from 'vitest';
import { townNotes } from './pack-town.mjs';
import { formatNotes } from './pack-format.mjs';

/** An invented port town written the way pf-3 and pf-5 say: no notes. */
const good = () => ({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'reed-port', name: 'Reed port', kind: 'adventure' },
  tables: [{ id: 'quay-rumours', name: 'Quay rumours', die: 'd6', rows: [{ min: 1, max: 6, result: 'Eels in the well' }] }],
  statBlocks: [{ id: 'heron-warden', name: 'Heron warden', fields: {} }],
  locations: [
    {
      id: 'reedmouth',
      name: 'Reedmouth',
      identity: 'A river town held by the [[npc:halewyn|Heron Wardens]].',
      facts: [{ lead: 'Rumours', text: '[[table:quay-rumours|Quay rumours]], d6.' }],
      playerView: { text: 'Tarred roofs on stilts.', aspects: [{ lead: 'Sign', text: 'A brass lantern.' }] },
      settlement: { size: 'town', watch: { text: 'Six wardens.', statBlockId: 'heron-warden' } },
    },
  ],
  npcs: [
    { id: 'halewyn', name: 'Halewyn', gm: { leads: [{ lead: 'Demeanour', text: 'Stern.' }, { lead: 'Desires', text: 'Order.' }] } },
    { id: 'marda', name: 'Marda', gm: { leads: [{ lead: 'Demeanour', text: 'Brisk.' }, { lead: 'Desires', text: 'Her son home.' }] } },
  ],
});

describe('a town as the source lays one out (pf-3, pf-5)', () => {
  it('has nothing to say about a pack written as the ruling says', () => {
    expect(townNotes(good())).toEqual([]);
  });

  it('warns on an aspect without a lead', () => {
    const pack = good();
    pack.locations[0].playerView.aspects.push({ text: 'Low beams.' });
    expect(townNotes(pack)).toEqual(['locations: "reedmouth": playerView.aspects 2 has no lead (pf-3: the bold words it starts with).']);
  });

  it("warns on a person whose leads are in another order than an earlier person's", () => {
    const pack = good();
    pack.npcs[1].gm.leads.reverse();
    expect(townNotes(pack)).toEqual(['npcs: "marda": its leads put "Desires" before "Demeanour", the other way round from an earlier person (pf-5: the same order for everyone in the pack).']);
  });

  it('warns on a link that resolves to nothing, and on a kind no link may name; another pack and a rule are left alone', () => {
    const pack = good();
    pack.locations[0].gm = { notes: 'See [[table:eel-weirs|the weirs]], [[shop:x|a stall]], [[table:other-pack:far|far]] and [[rule:buying|buying]].' };
    expect(townNotes(pack)).toEqual([
      'locations[0].gm.notes: the link to table "eel-weirs" resolves to nothing in this pack; the app shows "the weirs" as plain text.',
      'locations[0].gm.notes: the link [[shop:x|a stall]] names "shop", which isn\'t a kind a link may name (place, npc, item, table, statBlock, spell, rule, adventureHook).',
    ]);
  });

  it("warns on a link inside a player's piece", () => {
    const pack = good();
    pack.locations[0].playerView.aspects[0].text = 'A brass lantern, like [[place:reedmouth|the town]] wears.';
    expect(townNotes(pack)).toEqual(["locations[0].playerView.aspects[0].text: a link inside a player's piece; players read its label as plain text, never a tap (pf-5)."]);
  });

  it('reaches the checker through formatNotes', () => {
    const pack = good();
    pack.locations[0].playerView.aspects.push({ text: 'Low beams.' });
    expect(formatNotes(pack)).toContain('locations: "reedmouth": playerView.aspects 2 has no lead (pf-3: the bold words it starts with).');
  });
});
