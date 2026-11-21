// Fiat: the GM using a player's own power on that player's character is a ruling, logged with the seal and an
// optional reason; only the GM can undo it. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { editCharacter, reviewCharacter, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
import { setHp } from '../../src/modules/characters/hp.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, reason?: string) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input, { reason });
}

async function character(approval: 'approved' | 'pending' = 'approved'): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Hollis', owner_type: 'user', owner_user_id: world.playerA.id, approval, hp_max: 14, hp_current: 11 })
        .select()
        .single(),
    ),
  );
}

type Row = { id: string; type: string; fiat: boolean; reason: string | null; actor_user_id: string | null };
const latest = async (id: string, type: string) =>
  (must(await world.admin.from('events').select('id, type, fiat, reason, actor_user_id').eq('target_id', id).eq('type', type).order('seq', { ascending: false }).limit(1)) as Row[])[0]!;

describe('fiat', () => {
  it("the GM editing a player's sheet or HP is logged as fiat, with the reason", async () => {
    const hollis = await character();
    expect(await as(world.gm, editCharacter, { character: hollis, changes: { notes: 'Marked by the bog' } }, 'Cursed in session 3')).toMatchObject({ ok: true });
    expect(await latest(hollis.id, 'character.edit')).toMatchObject({ fiat: true, reason: 'Cursed in session 3' });
    expect(await as(world.gm, setHp, { character: hollis, hpCurrent: 2 })).toMatchObject({ ok: true });
    expect(await latest(hollis.id, 'character.setHp')).toMatchObject({ fiat: true, reason: null });
  });

  it("the owner's own changes, and the GM's own powers like approving, aren't fiat", async () => {
    const hollis = await character();
    await as(world.playerA, setHp, { character: hollis, hpCurrent: 9 }, 'Ignored');
    expect(await latest(hollis.id, 'character.setHp')).toMatchObject({ fiat: false, reason: null });
    const waiting = await character('pending');
    await as(world.gm, reviewCharacter, { character: waiting, decision: 'approved' }, 'Ignored');
    expect(await latest(waiting.id, 'character.review')).toMatchObject({ fiat: false, reason: null });
  });

  it("only the GM can undo a ruling; the character's owner can't", async () => {
    const hollis = await character();
    await as(world.gm, setHp, { character: hollis, hpCurrent: 3 }, 'Ambushed');
    const ruling = await latest(hollis.id, 'character.setHp');
    const owner = (await loadCurrentUser(asDb(world.playerA)))!;
    expect(
      await undoChange.run(asDb(world.playerA), owner, { campaignId: world.campaignId, eventId: ruling.id, authorUserId: ruling.actor_user_id }),
    ).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: ruling.id, authorUserId: ruling.actor_user_id })).toMatchObject({ ok: true });
  });
});
