// Holes found by the M2 fresh-session review, each pinned by a test. TEST project only.
//   1. Undo could reverse other people's changes by copying their request id.
//   2. A player's undo skipped the normal access rules (and didn't check they could see the entry).
//   3. A note about a hidden character was shown to everyone.
//   4. Players chose their log entries' names and levels.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { taggedDb } from '../../src/core/eventTags.ts';
import { addNote, loadNotes } from '../../src/core/notes.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { editCharacter, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
import { setHp } from '../../src/modules/characters/hp.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function character(owner: Person, extra: Record<string, unknown> = {}): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Hollis', owner_type: 'user', owner_user_id: owner.id, approval: 'approved', hp_max: 14, hp_current: 11, ...extra })
        .select()
        .single(),
    ),
  );
}

type Row = { id: string; type: string; level: string; request_id: string | null; actor_user_id: string | null };
const latest = async (targetId: string) =>
  (must(await world.admin.from('events').select('id, type, level, request_id, actor_user_id').eq('target_id', targetId).order('seq', { ascending: false }).limit(1)) as Row[])[0]!;
const hpOf = async (id: string) => must(await world.admin.from('actors').select('hp_current').eq('id', id).single()).hp_current;
const undoAs = async (person: Person, event: Row) =>
  undoChange.run(asDb(person), await userOf(person), { campaignId: world.campaignId, eventId: event.id, authorUserId: event.actor_user_id });

describe('1. undo only reverses your own changes', () => {
  it("copying the GM's request id onto your own change doesn't let you undo the GM's change", async () => {
    const theirs = await character(world.playerB);
    await runCommand(registry, asDb(world.gm), await userOf(world.gm), setHp, { character: theirs, hpCurrent: 3 });
    const gmChange = await latest(theirs.id);

    const mine = await character(world.playerA);
    const forged = taggedDb(asDb(world.playerA), { type: 'character.setHp', level: 'verbose', requestId: gmChange.request_id! });
    await setHp.run(forged, await userOf(world.playerA), { character: mine, hpCurrent: 7 });
    const myChange = await latest(mine.id);

    expect(await undoAs(world.playerA, myChange)).toMatchObject({ ok: true });
    expect(await hpOf(mine.id)).toBe(11);
    // The GM's change stands.
    expect(await hpOf(theirs.id)).toBe(3);
  });
});

describe("2. a player's undo follows the normal rules", () => {
  it("can't undo your change to a character that's no longer yours", async () => {
    const hollis = await character(world.playerA);
    await runCommand(registry, asDb(world.playerA), await userOf(world.playerA), editCharacter, { character: hollis, changes: { name: 'Hollis the Bold' } });
    const rename = await latest(hollis.id);
    must(await world.admin.from('actors').update({ owner_user_id: world.playerB.id }).eq('id', hollis.id).select());
    expect(await undoAs(world.playerA, rename)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(must(await world.admin.from('actors').select('name').eq('id', hollis.id).single()).name).toBe('Hollis the Bold');
  });

  it("can't undo an entry you can't see, like your own use of an invite", async () => {
    const invite = must(await world.admin.from('invites').insert({ campaign_id: world.campaignId }).select().single());
    expect((await world.newcomer.db.rpc('redeem_invite', { invite_code: invite.code })).error).toBeNull();
    const used = await latest(invite.id);
    expect(used.actor_user_id).toBe(world.newcomer.id);
    expect(await undoAs(world.newcomer, used)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(must(await world.admin.from('invites').select('status').eq('id', invite.id).single()).status).not.toBe('pending');
  });
});

describe('3. a note about a hidden character stays hidden', () => {
  it("a note about a waiting character is seen only by its owner and the GM", async () => {
    const waiting = await character(world.playerA, { approval: 'pending' });
    const made = await runCommand(registry, asDb(world.gm), await userOf(world.gm), addNote, {
      campaignId: world.campaignId,
      text: 'Needs a better backstory.',
      aboutActorId: waiting.id,
    });
    if (!made.ok) throw new Error(made.message);
    const sees = async (person: Person) => ((await loadNotes(asDb(person), world.campaignId)) ?? []).some((n) => n.id === made.value.id);
    expect(await sees(world.playerA)).toBe(true);
    expect(await sees(world.playerB)).toBe(false);
  });

  it("a note about a GM-only character is seen only by the GM", async () => {
    const lurker = toCharacterRef(
      must(
        await world.admin
          .from('actors')
          .insert({ campaign_id: world.campaignId, kind: 'npc', name: 'Bog lurker', owner_type: 'gm', approval: 'pending' })
          .select()
          .single(),
      ),
    );
    const made = await runCommand(registry, asDb(world.gm), await userOf(world.gm), addNote, {
      campaignId: world.campaignId,
      text: 'Waits at the ford.',
      aboutActorId: lurker.id,
    });
    if (!made.ok) throw new Error(made.message);
    for (const player of [world.playerA, world.playerB]) {
      expect(((await loadNotes(asDb(player), world.campaignId)) ?? []).some((n) => n.id === made.value.id)).toBe(false);
      expect(must(await player.db.from('events').select('id').eq('target_id', made.value.id))).toEqual([]);
    }
  });
});

describe('4. the database names log entries', () => {
  it("a player can't label an edit as a GM action, or hide it as verbose", async () => {
    const hollis = await character(world.playerA);
    const mislabelled = taggedDb(asDb(world.playerA), { type: 'character.review', level: 'simple' });
    await editCharacter.run(mislabelled, await userOf(world.playerA), { character: hollis, changes: { notes: 'Totally approved' } });
    expect((await latest(hollis.id)).type).toBe('actors.update');

    const hidden = taggedDb(asDb(world.playerA), { type: 'character.edit', level: 'verbose' });
    await editCharacter.run(hidden, await userOf(world.playerA), { character: hollis, changes: { notes: 'Sneaky' } });
    expect(await latest(hollis.id)).toMatchObject({ type: 'character.edit', level: 'simple' });
  });
});
