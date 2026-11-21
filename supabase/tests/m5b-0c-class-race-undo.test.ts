// fix-class-race-undo-after-approval: the class-and-race guard of follow-up C (private.guard_class_race, newest copy
// 20261102312000_m5b_0c_class_race_guard_before_approval.sql) lets every Undo through (grimoire.reverting). An Undo is
// still held to the rule, because the first guard on those two columns (private.guard_race_and_classes,
// 20261020130000_m1_race_and_classes.sql) has no such opening. These tests keep it that way: dropping the older guard
// as a duplicate would let an owner's Undo change an approved character's class or race. TEST project only (CI: a
// local Supabase); invented content.
//   Purpose:
//   1. Once the GM approves a character, the owner's Undo of a class and race change made while it waited is refused
//      (only the GM changes an approved character's class or race), and the class and race stay as approved.
//   2. The GM's Undo of that same change goes through (the GM always may).
//   3. While the character still waits, the owner's Undo of their own class and race change goes through.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

const warden = [{ classRef: 'lantern-warden', level: 1, xp: 0 }];

/** A waiting character of player A's, whose owner set its class and race while it waited (party.test.ts: allowed). */
async function waitingWithClass(name: string) {
  const id = must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: world.playerA.id, approval: 'pending' })
      .select('id')
      .single(),
  ).id as string;
  const set = await world.playerA.db.from('actors').update({ classes: warden, race_ref: 'marsh-folk' }).eq('id', id).select('id');
  expect(set.error).toBeNull();
  const line = must(
    await world.admin
      .from('events')
      .select('id, actor_user_id')
      .eq('campaign_id', world.campaignId)
      .eq('target_id', id)
      .eq('actor_user_id', world.playerA.id)
      .eq('type', 'actors.update')
      .order('seq', { ascending: false })
      .limit(1),
  )[0]!;
  const classAndRace = async () => must(await world.admin.from('actors').select('classes, race_ref').eq('id', id).single());
  const approve = async () => must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', id).select('id'));
  const undoBy = (person: Person) => as(person, undoChange, { campaignId: world.campaignId, eventId: line.id as string, authorUserId: line.actor_user_id as string });
  expect(await classAndRace()).toEqual({ classes: warden, race_ref: 'marsh-folk' });
  return { id, classAndRace, approve, undoBy };
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the Undo of a class or race change after approval', () => {
  it("1. the owner's Undo of a change made while the character waited is refused once it is approved", async () => {
    const c = await waitingWithClass('Wren of the Reeds');
    await c.approve();
    expect(await c.undoBy(world.playerA)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await c.classAndRace()).toEqual({ classes: warden, race_ref: 'marsh-folk' });
  });

  it("2. the GM's Undo of the owner's change from before the approval goes through", async () => {
    const c = await waitingWithClass('Bree Damplight');
    await c.approve();
    expect(await c.undoBy(world.gm)).toMatchObject({ ok: true });
    expect(await c.classAndRace()).toEqual({ classes: [], race_ref: null });
  });

  it("3. while the character still waits, the owner's Undo of their own change goes through", async () => {
    const c = await waitingWithClass('Odo Lanternwick');
    expect(await c.undoBy(world.playerA)).toMatchObject({ ok: true });
    expect(await c.classAndRace()).toEqual({ classes: [], race_ref: null });
  });
});
