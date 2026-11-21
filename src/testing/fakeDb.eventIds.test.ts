// The stand-in database's log lines (the layout page's duplicate-key warning `event-5`, #741's pictures): a line the
// stand-in writes never takes the id or number of one already in its log, even when a page seeded lines by hand
// first (src/testing/layoutHarness.tsx writes event-1 to event-5). The real database's ids are uuids and its numbers a
// sequence, so this is the stand-in's own fault. Invented content.
import { describe, expect, it } from 'vitest';
import { createFakeDb } from './fakeDb.ts';

describe("the stand-in's log lines", () => {
  // Purpose: after lines seeded by hand, a line the stand-in writes takes the next free number and an id no other
  // line has, so a list keyed by the line's id never sees two alike.
  it('never reuses a seeded line’s id or number', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('gm@weirs.example', 'Priya');
    const campaign = world.addCampaign('The Eel Weirs', gm);
    for (const seq of [1, 2, 3, 5]) world.tables.events.push({ id: `event-${seq}`, seq, campaign_id: campaign, type: 'character.edit', level: 'simple', audience: 'all' });
    world.signInAs(gm);
    world.addCharacter(campaign, 'Wren');
    // Any write the stand-in logs: renaming the campaign, three times.
    for (const name of ['The Eel Weirs I', 'The Eel Weirs II', 'The Eel Weirs III']) {
      const { error } = await world.db.from('campaigns').update({ name }).eq('id', campaign).select();
      expect(error).toBeNull();
    }
    const ids = world.tables.events.map((e) => String(e.id));
    expect(new Set(ids).size).toBe(ids.length);
    const seqs = world.tables.events.map((e) => Number(e.seq));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(world.tables.events.length).toBeGreaterThan(4);
  });
});
