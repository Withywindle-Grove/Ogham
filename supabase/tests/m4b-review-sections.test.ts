// The sections the GM ticks when sending a character back (B18, ruled 2026-10-25;
// supabase/migrations/20261026110000_m4b_review_sections.sql). TEST project only; invented.
//   Only the GM writes them; a player's new character starts with none; they stay when the player resends (the GM
//   sees them marked) and clear on approval.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, resubmitCharacter, reviewCharacter } from '../../src/modules/characters/commands.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const sectionsOf = async (id: string) => must(await world.admin.from('actors').select('review_sections').eq('id', id).single()).review_sections;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('ticked review sections', () => {
  it('only the GM ticks them; they stay when resent and clear on approval', async () => {
    const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Moss', level: 1 });
    if (!made.ok) throw new Error(made.message);
    expect(await sectionsOf(made.value.id)).toEqual([]);

    const sent = await as(world.gm, reviewCharacter, { character: made.value, decision: 'rejected' as const, note: 'A gentler name?', sections: ['who', 'story'] });
    if (!sent.ok) throw new Error(sent.message);
    expect(await sectionsOf(made.value.id)).toEqual(['who', 'story']);

    // The player can't clear or change them.
    const sneaky = await world.playerA.db.from('actors').update({ review_sections: [] }).eq('id', made.value.id).select('id');
    expect(sneaky.error).not.toBeNull();
    expect(await sectionsOf(made.value.id)).toEqual(['who', 'story']);

    const resent = await as(world.playerA, resubmitCharacter, { character: sent.value });
    if (!resent.ok) throw new Error(resent.message);
    expect(await sectionsOf(made.value.id)).toEqual(['who', 'story']);

    expect(await as(world.gm, reviewCharacter, { character: resent.value, decision: 'approved' as const })).toMatchObject({ ok: true });
    expect(await sectionsOf(made.value.id)).toEqual([]);
  });

  it("a player's new character can't arrive with sections ticked", async () => {
    const inserted = must(
      await world.playerA.db
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Sedge', owner_type: 'user', owner_user_id: world.playerA.id, review_sections: ['hp'] })
        .select('id'),
    );
    expect(await sectionsOf(inserted[0]!.id)).toEqual([]);
  });
});
