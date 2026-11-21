// M5b step 3: activities (supabase/migrations/20261103130000_m5b_3_activities.sql; ruled 2026-10-30, D3, S4-8).
// TEST project only; invented places, characters and items.
//   An activity's cost comes off the group's budget and its yield lands in the finder's pack, in one request; Undo
//   (by the player who did it, or the GM) takes the yield out and puts the points back, logged as an undo. A player
//   can't run an activity for a group they aren't in, nor name a character from another group; another group's
//   player reads none of the runs. Undo is refused once the yield was used.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { applyActivity, undoActivity, type ApplyActivityInput } from '../../src/modules/expedition/activityPlay.ts';
import { loadTravelGroups, startTravelDay } from '../../src/modules/expedition/travelPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign with an invented item ("Reed bundle") in its setting rules, Reed (A's) and Moss (B's), a day started. */
async function freshTrail() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Crossing', created_by: world.gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen gear' }).select('id').single()).id as string;
  const entry = must(
    await world.admin
      .from('library_entries')
      .insert({ pack_id: pack, kind: 'item', pack_entry_id: 'reed-bundle', name: 'Reed bundle', data: { id: 'reed-bundle', name: 'Reed bundle', category: 'gear', weightCoin: 10 } })
      .select('id')
      .single(),
  ).id as string;
  // Its exploration (ac-1): reeds are gathered by several together, roots dug by one.
  must(
    await world.admin
      .from('library_entries')
      .insert({
        pack_id: pack,
        kind: 'rulesSet',
        pack_entry_id: 'fen-ways',
        name: 'Fen ways',
        data: {
          id: 'fen-ways',
          name: 'Fen ways',
          exploration: {
            modes: [
              {
                id: 'wilderness',
                name: 'Wading',
                step: { value: 1, unit: 'day' },
                activities: [
                  { id: 'gather-reeds', name: 'Gather reeds', who: 'several' },
                  { id: 'dig-roots', name: 'Dig roots', who: 'one' },
                ],
              },
            ],
          },
        },
      })
      .select('id'),
  );
  must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: pack, option_choices: {}, priority: 1 }).select());
  const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'wilderness', place: 'The Reed Jetty' }));
  await ok(as(world.gm, startTravelDay, { campaignId, group: 1, day: 0, total: 8, pace: 'foot' as const, gmPerDay: null }));
  return { campaignId, expeditionId: trip.id, entry, reed: reed!.id, moss: moss!.id };
}

type Trail = Awaited<ReturnType<typeof freshTrail>>;
/** Each character's player: Reed is A's, Moss is B's. */
const ownerOf = (t: Trail, actor: string) => (actor === t.reed ? world.playerA.id : actor === t.moss ? world.playerB.id : null);

const gather = (t: Trail, actors: string[], qty = 3, group = 1): ApplyActivityInput => ({
  target: { campaignId: t.campaignId, group, mine: true, who: 'several', ownersNamed: actors.map((a) => ownerOf(t, a)) },
  activity: { id: 'gather-reeds', name: 'Gather reeds' },
  actorIds: actors,
  finderId: actors[0] ?? null,
  rolls: actors.map((actorId, i) => ({ actorId, roll: 4 + i })),
  outcome: 'worked',
  spend: 2,
  yield: { item: { libraryEntryId: t.entry, name: 'Reed bundle', category: 'gear', weightCoin: 10, slots: null, stack: 1 }, qty },
});
const spentOf = async (t: { campaignId: string; expeditionId: string }, group = 1) => (await loadTravelGroups(asDb(world.gm), t.campaignId, t.expeditionId))?.get(group)?.spent;
const bundlesOf = async (actorId: string) => must(await world.admin.from('inventory_lines').select('id, qty, how_got').eq('actor_id', actorId).eq('name', 'Reed bundle'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('activities (D3, S4-8)', () => {
  it("an activity's cost comes off the group's budget and its yield lands in the finder's pack; the player's Undo reverses both", async () => {
    const t = await freshTrail();
    const run = await ok(as(world.playerA, applyActivity, gather(t, [t.reed, t.moss])));
    expect([run.spent, run.yieldQty, run.finderId]).toEqual([2, 3, t.reed]);
    expect(await spentOf(t)).toBe(2);
    expect((await bundlesOf(t.reed)).map((l) => [l.qty, l.how_got])).toEqual([[3, 'found']]);
    // One log line: everyone in the party reads it.
    const lines = must(await world.playerB.db.from('events').select('id, type').eq('campaign_id', t.campaignId).eq('type', 'activity.apply').eq('target_table', 'activity_runs'));
    expect(lines.length).toBe(1);
    // Player B (not the author) can't undo it; player A can.
    expect((await as(world.playerB, undoActivity, { campaignId: t.campaignId, runId: run.id, authorUserId: world.playerB.id })).ok).toBe(false);
    const undone = await ok(as(world.playerA, undoActivity, { campaignId: t.campaignId, runId: run.id, authorUserId: world.playerA.id }));
    expect(undone.undone).toBe(true);
    expect(await spentOf(t)).toBe(0);
    expect(await bundlesOf(t.reed)).toEqual([]);
    // Logged as an undo, each change linked to the one it reverses (the log keeps the line's copy).
    const reversals = must(await world.admin.from('events').select('type, target_table, reverts_event_id, before').eq('campaign_id', t.campaignId).not('reverts_event_id', 'is', null));
    expect(reversals.map((e) => [e.type, e.target_table]).sort()).toEqual([['activity.undo', 'activity_runs'], ['activity.undo', 'inventory_lines'], ['activity.undo', 'travel_groups']]);
    expect((reversals.find((e) => e.target_table === 'inventory_lines')?.before as Record<string, unknown>).qty).toBe(3);
    // Twice is refused.
    expect((await as(world.playerA, undoActivity, { campaignId: t.campaignId, runId: run.id, authorUserId: world.playerA.id })).ok).toBe(false);
  });

  it('the GM can undo a player’s activity; Undo is refused once the yield was used', async () => {
    const t = await freshTrail();
    const first = await ok(as(world.playerA, applyActivity, gather(t, [t.reed])));
    await ok(as(world.gm, undoActivity, { campaignId: t.campaignId, runId: first.id, authorUserId: world.playerA.id }));
    expect(await spentOf(t)).toBe(0);
    const second = await ok(as(world.playerA, applyActivity, gather(t, [t.reed])));
    const [line] = await bundlesOf(t.reed);
    must(await world.admin.from('inventory_lines').update({ qty: 1 }).eq('id', line!.id).select('id'));
    const refused = await as(world.playerA, undoActivity, { campaignId: t.campaignId, runId: second.id, authorUserId: world.playerA.id });
    expect(refused.ok).toBe(false);
    expect(await spentOf(t)).toBe(2);
  });

  it("a player can't run an activity for another group or name its characters, and never reads another group's runs", async () => {
    const t = await freshTrail();
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: { id: t.moss, campaignId: t.campaignId, ownerUserId: world.playerB.id }, group: null }));
    await ok(as(world.gm, startTravelDay, { campaignId: t.campaignId, group: mossGroup, day: 0, total: 6, pace: 'foot' as const, gmPerDay: null }));
    // Player B isn't in group 1; player A can't name Moss (group 2) in group 1's activity.
    expect((await as(world.playerB, applyActivity, { ...gather(t, [t.reed]), target: { ...gather(t, [t.reed]).target, mine: true } })).ok).toBe(false);
    expect((await as(world.playerA, applyActivity, gather(t, [t.reed, t.moss]))).ok).toBe(false);
    const run = await ok(as(world.playerA, applyActivity, gather(t, [t.reed])));
    expect(must(await world.playerB.db.from('activity_runs').select('id').eq('id', run.id))).toEqual([]);
    expect(must(await world.playerA.db.from('activity_runs').select('id').eq('id', run.id)).length).toBe(1);
    // Nothing was written by the refused calls.
    expect(await spentOf(t, 1)).toBe(2);
    expect(await spentOf(t, mossGroup)).toBe(0);
  });

  // ac-1 (ruled 2026-11-11): in an activity one character does, a player names only their own characters.
  it("in an activity one character does, a player names only their own characters, even if the device says otherwise; the GM names anyone", async () => {
    const t = await freshTrail();
    const dig = (actor: string, ownersNamed = [ownerOf(t, actor)]): ApplyActivityInput => ({
      ...gather(t, [actor], 0),
      activity: { id: 'dig-roots', name: 'Dig roots' },
      yield: null,
      target: { campaignId: t.campaignId, group: 1, mine: true, who: 'one', ownersNamed },
    });
    // The app refuses; and a device that claims Moss is A's is refused by the database, which reads `who` itself.
    expect((await as(world.playerA, applyActivity, dig(t.moss))).ok).toBe(false);
    expect((await as(world.playerA, applyActivity, dig(t.moss, [world.playerA.id]))).ok).toBe(false);
    expect(await spentOf(t)).toBe(0);
    // A player's own character, and the GM naming anyone, go through.
    await ok(as(world.playerA, applyActivity, dig(t.reed)));
    await ok(as(world.gm, applyActivity, { ...dig(t.moss), target: { ...dig(t.moss).target, mine: false } }));
    expect(await spentOf(t)).toBe(4);
  });

  it('an activity the setting rules don’t name reads as one character’s', async () => {
    const t = await freshTrail();
    const unknown = { ...gather(t, [t.moss], 0), activity: { id: 'not-in-the-rules', name: 'Hum' }, yield: null };
    // The device claims a group activity; the database finds none and reads it as one character's.
    expect((await as(world.playerA, applyActivity, { ...unknown, target: { ...unknown.target, ownersNamed: [world.playerA.id] } })).ok).toBe(false);
  });
});
