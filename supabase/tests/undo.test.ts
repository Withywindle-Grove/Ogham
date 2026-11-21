// Undo: putting back what a logged change replaced, as a new, linked event. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createCharacter, reviewCharacter, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
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

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

async function approved(owner = world.playerA): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Hollis', owner_type: 'user', owner_user_id: owner.id, approval: 'approved', hp_max: 14, hp_current: 11 })
        .select()
        .single(),
    ),
  );
}

type Row = { id: string; type: string; actor_user_id: string | null; reverts_event_id: string | null; before: unknown; after: unknown };
const lastEvent = async (targetId: string, type: string) =>
  (must(await world.admin.from('events').select('*').eq('target_id', targetId).eq('type', type).order('seq', { ascending: false }).limit(1)) as Row[])[0]!;
const hpOf = async (id: string) => must(await world.admin.from('actors').select('hp_current').eq('id', id).single()).hp_current;
const undo = (person: Person, event: Row) =>
  as(person, undoChange, { campaignId: world.campaignId, eventId: event.id, authorUserId: event.actor_user_id });

describe('undo', () => {
  it('puts back the values a change replaced, and logs a reversing entry linked to it', async () => {
    const character = await approved();
    await as(world.playerA, setHp, { character, hpCurrent: 7 });
    const change = await lastEvent(character.id, 'character.setHp');
    expect(await undo(world.playerA, change)).toMatchObject({ ok: true });
    expect(await hpOf(character.id)).toBe(11);
    expect(await lastEvent(character.id, 'event.undo')).toMatchObject({
      actor_user_id: world.playerA.id,
      reverts_event_id: change.id,
      before: { hp_current: 7 },
      after: { hp_current: 11 },
    });
  });

  it("is refused, in plain words, if the thing changed since", async () => {
    const character = await approved();
    await as(world.playerA, setHp, { character, hpCurrent: 7 });
    const first = await lastEvent(character.id, 'character.setHp');
    await as(world.playerA, setHp, { character, hpCurrent: 5 });
    expect(await undo(world.playerA, first)).toMatchObject({
      ok: false,
      message: "That's changed since. Undo the later change first.",
    });
    expect(await hpOf(character.id)).toBe(5);
  });

  it("only the person who made the change, or the GM, can undo it", async () => {
    const character = await approved();
    await as(world.playerA, setHp, { character, hpCurrent: 7 });
    const change = await lastEvent(character.id, 'character.setHp');
    // Even skipping the app's own check, the database refuses another player.
    const other = (await loadCurrentUser(asDb(world.playerB)))!;
    expect(await undoChange.run(asDb(world.playerB), other, { campaignId: world.campaignId, eventId: change.id, authorUserId: world.playerA.id })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    expect(await hpOf(character.id)).toBe(7);
    expect(await undo(world.gm, change)).toMatchObject({ ok: true });
    expect(await hpOf(character.id)).toBe(11);
  });

  it("can't undo the same change twice", async () => {
    const character = await approved();
    await as(world.playerA, setHp, { character, hpCurrent: 7 });
    const change = await lastEvent(character.id, 'character.setHp');
    expect(await undo(world.playerA, change)).toMatchObject({ ok: true });
    expect(await undo(world.playerA, change)).toMatchObject({ ok: false, message: 'That was already undone.' });
  });

  it("making or deleting something can't be undone", async () => {
    const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc', name: 'Old Tobin' });
    if (!made.ok) throw new Error(made.message);
    const creation = await lastEvent(made.value.id, 'character.create');
    expect(await undo(world.playerA, creation)).toMatchObject({ ok: false, message: "Making or deleting things can't be undone." });
  });

  it('an action that changed several rows is undone all together', async () => {
    // Approving a player's first character also makes it their active one.
    must(await world.admin.from('members').insert({ campaign_id: world.campaignId, user_id: world.latecomer.id, base_role: 'player' }).select());
    const bram = toCharacterRef(
      must(
        await world.admin
          .from('actors')
          .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Bram', owner_type: 'user', owner_user_id: world.latecomer.id, approval: 'pending' })
          .select()
          .single(),
      ),
    );
    expect(await as(world.gm, reviewCharacter, { character: bram, decision: 'approved' })).toMatchObject({ ok: true });
    const approval = await lastEvent(bram.id, 'character.review');
    expect(await undo(world.gm, approval)).toMatchObject({ ok: true });
    expect(must(await world.admin.from('actors').select('approval').eq('id', bram.id).single()).approval).toBe('pending');
    const member = must(
      await world.admin.from('members').select('active_actor_id').eq('campaign_id', world.campaignId).eq('user_id', world.latecomer.id).single(),
    );
    expect(member.active_actor_id).toBeNull();
  });
});
