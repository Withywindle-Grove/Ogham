// The event log's foundations: the database writes an event for every change, in the same transaction,
// tagged with the command that made it; each event has an audience. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { clearSigil, createInvite } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, deleteCharacter, reviewCharacter, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
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

type EventRow = {
  id: string;
  type: string;
  level: string;
  actor_user_id: string | null;
  target_table: string;
  target_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fiat: boolean;
  reason: string | null;
  audience: string;
  request_id: string | null;
};

/** Every event about this row, oldest first (read with the secret key, so nothing is hidden). */
async function eventsAbout(targetId: string): Promise<EventRow[]> {
  return must(
    await world.admin.from('events').select('*').eq('target_id', targetId).order('created_at', { ascending: true }),
  ) as EventRow[];
}

async function approved(owner = world.playerA): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Hollis', owner_type: 'user', owner_user_id: owner.id, approval: 'approved', hp_max: 14 })
        .select()
        .single(),
    ),
  );
}

describe('writing events', () => {
  it('a command writes an event named after it, with who did it and only the values that changed', async () => {
    const character = await approved();
    expect(await as(world.playerA, setHp, { character, hpCurrent: 7 })).toMatchObject({ ok: true });
    const [event, ...more] = (await eventsAbout(character.id)).filter((e) => e.type === 'character.setHp');
    expect(more).toEqual([]);
    expect(event).toMatchObject({
      level: 'verbose',
      actor_user_id: world.playerA.id,
      target_table: 'actors',
      before: { hp_current: null },
      after: { hp_current: 7 },
      fiat: false,
      audience: 'all',
    });
    expect(event?.request_id).toBeTruthy();
  });

  it('a command that changes several rows writes one event per row, all sharing one request', async () => {
    // Approving Player B's first character also makes it their active one (a second row changes).
    const bram = toCharacterRef(
      must(
        await world.admin
          .from('actors')
          .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Bram', owner_type: 'user', owner_user_id: world.latecomer.id, approval: 'pending' })
          .select()
          .single(),
      ),
    );
    must(await world.admin.from('members').insert({ campaign_id: world.campaignId, user_id: world.latecomer.id, base_role: 'player' }).select());
    expect(await as(world.gm, reviewCharacter, { character: bram, decision: 'approved' })).toMatchObject({ ok: true });
    const events = must(
      await world.admin.from('events').select('type, target_table, request_id').eq('type', 'character.review').eq('campaign_id', world.campaignId),
    ) as { type: string; target_table: string; request_id: string }[];
    const request = events.find((e) => e.target_table === 'actors')?.request_id;
    expect(events.filter((e) => e.request_id === request).map((e) => e.target_table).sort()).toEqual(['actors', 'members']);
  });

  it('a refused change writes no event', async () => {
    const character = await approved();
    const other = (await loadCurrentUser(asDb(world.playerB)))!;
    expect(await setHp.run(taggedDb(asDb(world.playerB), { type: 'character.setHp', level: 'verbose' }), other, { character, hpCurrent: 1 })).toMatchObject({ ok: false });
    // Only the character's creation (by the test setup) is logged.
    expect((await eventsAbout(character.id)).map((e) => e.type)).toEqual(['actors.insert']);
  });

  it('a change that changes nothing writes no event', async () => {
    must(await world.admin.from('campaigns').update({ sigil_asset_id: null }).eq('id', world.campaignId).select());
    const before = must(await world.admin.from('events').select('id').eq('type', 'campaign.clearSigil')).length;
    expect(await as(world.gm, clearSigil, { campaignId: world.campaignId })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('events').select('id').eq('type', 'campaign.clearSigil')).length).toBe(before);
  });

  it('a change made without a command is still logged, under a plain name', async () => {
    const character = await approved();
    must(await world.playerA.db.from('actors').update({ notes: 'Scribbled directly' }).eq('id', character.id).select());
    expect((await eventsAbout(character.id)).at(-1)).toMatchObject({ type: 'actors.update', after: { notes: 'Scribbled directly' } });
  });

  it('deleting a character keeps a full copy of it in the event', async () => {
    const made = await as(world.playerA, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc',
      name: 'Old Tobin',
      level: 2,
      backstory: 'Ferryman.',
    });
    if (!made.ok) throw new Error(made.message);
    expect(await as(world.playerA, deleteCharacter, { character: made.value })).toMatchObject({ ok: true });
    const deleted = (await eventsAbout(made.value.id)).find((e) => e.type === 'character.delete');
    expect(deleted?.after).toBeNull();
    expect(deleted?.before).toMatchObject({ name: 'Old Tobin', level: 2, backstory: 'Ferryman.', approval: 'pending' });
  });

  it("only the GM's changes can be marked fiat; a player's claim of fiat is ignored", async () => {
    const character = await approved();
    const player = (await loadCurrentUser(asDb(world.playerA)))!;
    await setHp.run(taggedDb(asDb(world.playerA), { type: 'character.setHp', level: 'verbose', fiat: true, reason: 'I said so' }), player, { character, hpCurrent: 3 });
    const gm = (await loadCurrentUser(asDb(world.gm)))!;
    await setHp.run(taggedDb(asDb(world.gm), { type: 'character.setHp', level: 'verbose', fiat: true, reason: 'The fever breaks' }), gm, { character, hpCurrent: 14 });
    const [byPlayer, byGm] = (await eventsAbout(character.id)).filter((e) => e.type === 'character.setHp');
    expect(byPlayer).toMatchObject({ fiat: false, reason: null });
    expect(byGm).toMatchObject({ fiat: true, reason: 'The fever breaks' });
  });
});

describe('removing a campaign', () => {
  it('deleting a whole campaign deletes its events with it, without errors', async () => {
    const made = await world.gm.db.rpc('create_campaign', { campaign_name: 'The Short Barrow' });
    const campaignId = made.data as string;
    must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Gone Soon', owner_type: 'gm', approval: 'approved' }).select());
    expect(must(await world.admin.from('events').select('id').eq('campaign_id', campaignId)).length).toBeGreaterThan(0);
    const removed = await world.admin.from('campaigns').delete().eq('id', campaignId).select('id');
    expect(removed.error).toBeNull();
    expect(must(await world.admin.from('events').select('id').eq('campaign_id', campaignId))).toEqual([]);
  });
});

describe('who sees which events', () => {
  it("players see events about approved characters and the campaign, but not invites or another player's waiting character", async () => {
    const invite = await as(world.gm, createInvite, { campaignId: world.campaignId });
    if (!invite.ok) throw new Error(invite.message);
    const waiting = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc', name: 'Sly Cob' });
    if (!waiting.ok) throw new Error(waiting.message);
    const shown = await approved();
    await as(world.playerA, setHp, { character: shown, hpCurrent: 5 });

    const seen = async (person: Person, id: string) => (must(await person.db.from('events').select('id').eq('target_id', id)) ?? []).length > 0;
    for (const [person, invites, waitingOnes] of [
      [world.gm, true, true],
      [world.playerA, false, true],
      [world.playerB, false, false],
      [world.outsider, false, false],
    ] as const) {
      expect(await seen(person, invite.value.id), `invite for ${person.id}`).toBe(invites);
      expect(await seen(person, waiting.value.id), `waiting character for ${person.id}`).toBe(waitingOnes);
      expect(await seen(person, shown.id), `approved character for ${person.id}`).toBe(person !== world.outsider);
    }
  });

  it("nobody writes, changes or erases events directly, not even the GM", async () => {
    const forged = await world.playerA.db
      .from('events')
      .insert({ campaign_id: world.campaignId, type: 'character.setHp', level: 'simple', audience: 'all', target_table: 'actors' })
      .select();
    expect(forged.error).not.toBeNull();
    const any = must(await world.admin.from('events').select('id').eq('campaign_id', world.campaignId).limit(1))[0]!;
    const changed = await world.gm.db.from('events').update({ type: 'rewritten' }).eq('id', any.id).select();
    const erased = await world.gm.db.from('events').delete().eq('id', any.id).select();
    expect(changed.data ?? []).toEqual([]);
    expect(erased.data ?? []).toEqual([]);
    expect(must(await world.admin.from('events').select('type').eq('id', any.id).single()).type).not.toBe('rewritten');
  });
});
