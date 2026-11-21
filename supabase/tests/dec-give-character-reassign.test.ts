// December: the GM gives a character to a player (supabase/migrations/20261114120000_dec_give_character_reassign.sql;
// docs/plans/dec-give-a-character-to-a-player.md, gp-1 to gp-6). TEST project only; invented names.
//   Purpose:
//   1. The GM gives a GM-made character to a player: it stays approved, the player owns it, and it is theirs in play
//      when they had none. Their purse read follows: the new owner reads it; another player and an outsider don't.
//   2. The GM gives a player's character to another player: the first player no longer has it in play nor reads its
//      purse; the log lines that were the old owner's alone stay theirs (the new owner never reads them) (gp-4).
//   3. The hand-over line is read by every member of the campaign (gp-4 as the lead amended it, 2026-11-14), a third
//      player too; an outsider reads nothing. The alignment row's copy of the owner moves with the character.
//   4. The GM takes a character back ("You, the GM", gp-5): it is the GM's own again and out of the player's play.
//   5. Undo gives it back to whoever had it, and only the owner moves: what the receiver changed meanwhile stays
//      (gp-6); the in-play mark the give set comes off, the one it took off comes back.
//   6. Refused: a target who isn't a player of the campaign (an outsider, the GM as a 'user' owner), the owner giving
//      their own character away, another player taking one.
//   7. (gp-8, the #774 look-back) The alignment row's copy line a give writes is read by the new owner and the GM only,
//      as the alignment log's rule is built (private.log_audience_character_alignments): not the old owner, another
//      player or an outsider. The real undo_request treats a newer give as the stand-in does: Undo of the older give
//      is refused ("That's changed since. Undo the later change first.") and neither give is reverted.
//   8. (gp-9) Undo that would hand a character back to a player who has left the campaign is refused by the
//      database's owner rule, and the app says so ("That player" when their name can't be read); the give stays.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { CurrentUser } from '../../src/core/commands.ts';
import type { Db } from '../../src/core/supabase.ts';
import { reassignCharacter, toCharacterRef, type GiveTo } from '../../src/modules/characters/commands.ts';
import { undoChange } from '../../src/core/undo.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let users: { gm: CurrentUser; playerA: CurrentUser; playerB: CurrentUser };

const actor = async (values: Record<string, unknown>) =>
  must(await world.admin.from('actors').insert({ campaign_id: world.campaignId, kind: 'pc', approval: 'approved', status: 'active', ...values }).select('id').single()).id as string;
const row = async (id: string) =>
  must(await world.admin.from('actors').select('id, campaign_id, owner_type, owner_user_id, approval, status, backstory').eq('id', id).single());
const activeOf = async (person: Person) =>
  must(await world.admin.from('members').select('active_actor_id').eq('campaign_id', world.campaignId).eq('user_id', person.id).single()).active_actor_id as string | null;
const setActive = async (person: Person, id: string | null) =>
  must(await world.admin.from('members').update({ active_actor_id: id }).eq('campaign_id', world.campaignId).eq('user_id', person.id).select('id'));
const readsPurse = async (person: Person, id: string) => must(await person.db.from('purses').select('id').eq('actor_id', id)).length === 1;
const readsEvent = async (person: Person, eventId: string) => must(await person.db.from('events').select('id').eq('id', eventId)).length === 1;

/** Runs character.reassign as this person, tagged as the app tags it. */
async function give(by: 'gm' | 'playerA' | 'playerB', id: string, to: GiveTo) {
  const person = world[by];
  const db = taggedDb(person.db as unknown as Db, { type: 'character.reassign', level: 'simple', requestId: crypto.randomUUID() });
  return reassignCharacter.run(db, users[by], { character: toCharacterRef(await row(id)), to });
}
const toPlayer = (person: Person): GiveTo => ({ userId: person.id, role: 'player' });
const handOver = async (id: string) =>
  must(await world.admin.from('events').select('id').eq('target_id', id).eq('type', 'character.reassign').eq('target_table', 'actors').order('seq', { ascending: false }).limit(1).single()).id as string;

beforeAll(async () => {
  world = await buildWorld();
  const roles = { [world.campaignId]: 'player' as const };
  users = {
    gm: { id: world.gm.id, roles: { [world.campaignId]: 'gm' } },
    playerA: { id: world.playerA.id, roles },
    playerB: { id: world.playerB.id, roles },
  };
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('1. a GM-made character given to a player', () => {
  it('stays approved, is theirs in play when they had none, and its purse follows', async () => {
    await setActive(world.playerA, null);
    const moss = await actor({ name: 'Moss', owner_type: 'gm', owner_user_id: null });
    expect(await readsPurse(world.playerA, moss)).toBe(false);
    const given = await give('gm', moss, toPlayer(world.playerA));
    expect(given.ok, given.ok ? '' : given.message).toBe(true);
    expect(await row(moss)).toMatchObject({ owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved' });
    expect(await activeOf(world.playerA)).toBe(moss);
    expect(await readsPurse(world.playerA, moss)).toBe(true);
    expect(await readsPurse(world.playerB, moss)).toBe(false);
    expect(await readsPurse(world.outsider, moss)).toBe(false);
  });

  it('a player who has a character in play keeps it', async () => {
    await setActive(world.playerB, world.ashId);
    const sedge = await actor({ name: 'Sedge', owner_type: 'gm', owner_user_id: null });
    expect((await give('gm', sedge, toPlayer(world.playerB))).ok).toBe(true);
    expect(await activeOf(world.playerB)).toBe(world.ashId);
  });
});

describe('2 and 3. given on from one player to another', () => {
  it("the old owner's own lines stay theirs; the hand-over line is read by every member (gp-4 as amended), not an outsider; the alignment's owner follows", async () => {
    // A third player, so the hand-over line is seen to be every member's, not only the three named in gp-4.
    must(await world.admin.from('members').insert({ campaign_id: world.campaignId, user_id: world.latecomer.id, base_role: 'player' }).select('id'));
    // Fen is Player A's, waiting: lines about it are Player A's alone (and the GM's).
    const fen = await actor({ name: 'Fen', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'pending' });
    must(await world.playerA.db.from('actors').update({ backstory: 'Raised on the barges.' }).eq('id', fen).select('id'));
    const own = must(await world.admin.from('events').select('id, audience, owner_user_id').eq('target_id', fen).eq('target_table', 'actors').order('seq', { ascending: false }).limit(1).single());
    expect(own).toMatchObject({ audience: 'owner', owner_user_id: world.playerA.id });
    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', fen).select('id'));
    // Its alignment, kept with a copy of its owner (character_alignments.owner_user_id).
    must(await world.admin.from('actors').update({ fields: { alignment: 'Reed' } }).eq('id', fen).select('id'));
    const alignmentOwner = async () =>
      must(await world.admin.from('character_alignments').select('owner_user_id').eq('actor_id', fen).single()).owner_user_id as string | null;
    expect(await alignmentOwner()).toBe(world.playerA.id);
    await setActive(world.playerA, fen);
    await setActive(world.playerB, null);

    expect((await give('gm', fen, toPlayer(world.playerB))).ok).toBe(true);
    expect(await activeOf(world.playerA)).toBeNull();
    expect(await activeOf(world.playerB)).toBe(fen);
    expect(await readsPurse(world.playerA, fen)).toBe(false);
    expect(await readsPurse(world.playerB, fen)).toBe(true);
    // gp-4: the old owner's own line stays theirs.
    expect(await readsEvent(world.playerA, own.id as string)).toBe(true);
    expect(await readsEvent(world.playerB, own.id as string)).toBe(false);
    // The hand-over line.
    const line = await handOver(fen);
    for (const reader of [world.gm, world.playerA, world.playerB, world.latecomer]) expect(await readsEvent(reader, line)).toBe(true);
    expect(await readsEvent(world.outsider, line)).toBe(false);
    expect(await alignmentOwner()).toBe(world.playerB.id);
  });
});

describe('4 and 5. taken back, and Undo', () => {
  it('the GM takes a character back; Undo gives it back and puts it in play again', async () => {
    const reed = await actor({ name: 'Reed', owner_type: 'user', owner_user_id: world.playerB.id });
    await setActive(world.playerB, reed);
    expect((await give('gm', reed, { userId: null, role: null })).ok).toBe(true);
    expect(await row(reed)).toMatchObject({ owner_type: 'gm', owner_user_id: null, approval: 'approved' });
    expect(await activeOf(world.playerB)).toBeNull();
    expect(await readsPurse(world.playerB, reed)).toBe(false);

    const undone = await world.gm.db.rpc('undo_request_said', { event_id: await handOver(reed) });
    expect(undone.error).toBeNull();
    expect(await row(reed)).toMatchObject({ owner_type: 'user', owner_user_id: world.playerB.id });
    expect(await activeOf(world.playerB)).toBe(reed);
  });

  it('Undo moves the owner only: what the receiver changed meanwhile stays (gp-6)', async () => {
    await setActive(world.playerA, null);
    const bram = await actor({ name: 'Bram', owner_type: 'gm', owner_user_id: null });
    expect((await give('gm', bram, toPlayer(world.playerA))).ok).toBe(true);
    expect(await activeOf(world.playerA)).toBe(bram);
    must(await world.playerA.db.from('actors').update({ backstory: 'Kept the ferry.' }).eq('id', bram).select('id'));

    const undone = await world.gm.db.rpc('undo_request_said', { event_id: await handOver(bram) });
    expect(undone.error).toBeNull();
    expect(await row(bram)).toMatchObject({ owner_type: 'gm', owner_user_id: null, backstory: 'Kept the ferry.', approval: 'approved' });
    expect(await activeOf(world.playerA)).toBeNull();
  });
});

describe('6. refused', () => {
  it('a target who is not a player of the campaign, even through the database directly', async () => {
    const tam = await actor({ name: 'Tam', owner_type: 'gm', owner_user_id: null });
    const outsider = await give('gm', tam, { userId: world.outsider.id, role: 'player' });
    expect(outsider.ok).toBe(false);
    if (!outsider.ok) expect(outsider.reason).toBe('not-allowed');
    // The GM as a player's owner of a character: not a player of the campaign.
    const himself = await give('gm', tam, { userId: world.gm.id, role: 'player' });
    expect(himself.ok).toBe(false);
    expect(await row(tam)).toMatchObject({ owner_type: 'gm', owner_user_id: null });
  });

  it('the owner giving their own character away, and another player taking one', async () => {
    const kit = await actor({ name: 'Kit', owner_type: 'user', owner_user_id: world.playerA.id });
    expect((await give('playerA', kit, toPlayer(world.playerB))).ok).toBe(false);
    expect((await give('playerB', kit, toPlayer(world.playerB))).ok).toBe(false);
    expect(await row(kit)).toMatchObject({ owner_type: 'user', owner_user_id: world.playerA.id });
  });
});

describe('7. after a give: the alignment copy line, and Undo of an older give (gp-8)', () => {
  it("the alignment row's copy line is read by the new owner and the GM only, as built", async () => {
    const isMember = async (person: Person) =>
      must(await world.admin.from('members').select('id').eq('campaign_id', world.campaignId).eq('user_id', person.id)).length === 1;
    // A third player (section 2 may have added them already).
    if (!(await isMember(world.latecomer))) {
      must(await world.admin.from('members').insert({ campaign_id: world.campaignId, user_id: world.latecomer.id, base_role: 'player' }).select('id'));
    }
    const lark = await actor({ name: 'Lark', owner_type: 'user', owner_user_id: world.playerA.id });
    must(await world.admin.from('actors').update({ fields: { alignment: 'Reed' } }).eq('id', lark).select('id'));
    expect((await give('gm', lark, toPlayer(world.playerB))).ok).toBe(true);
    const request = must(await world.admin.from('events').select('request_id').eq('id', await handOver(lark)).single()).request_id as string;
    const copies = must(await world.admin.from('events').select('id').eq('request_id', request).eq('target_table', 'character_alignments'));
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of copies) {
      for (const reader of [world.gm, world.playerB]) expect(await readsEvent(reader, copy.id as string)).toBe(true);
      for (const other of [world.playerA, world.latecomer, world.outsider]) expect(await readsEvent(other, copy.id as string)).toBe(false);
    }
  });

  it('Undo of an older give, after a newer one, is refused and reverts neither', async () => {
    await setActive(world.playerA, null);
    await setActive(world.playerB, null);
    const wick = await actor({ name: 'Wick', owner_type: 'gm', owner_user_id: null });
    expect((await give('gm', wick, toPlayer(world.playerA))).ok).toBe(true);
    const first = await handOver(wick);
    expect((await give('gm', wick, toPlayer(world.playerB))).ok).toBe(true);
    const undone = await world.gm.db.rpc('undo_request_said', { event_id: first });
    expect(undone.error?.message).toContain("That's changed since. Undo the later change first.");
    expect(await row(wick)).toMatchObject({ owner_type: 'user', owner_user_id: world.playerB.id });
    expect(await activeOf(world.playerA)).toBeNull();
    expect(await activeOf(world.playerB)).toBe(wick);
  });
});

describe('8. Undo to a player who has left (gp-9)', () => {
  it('is refused, says so in their names, and the give stays', async () => {
    // The latecomer has a character, never in play for them, then leaves after the GM gives it on.
    if (!(must(await world.admin.from('members').select('id').eq('campaign_id', world.campaignId).eq('user_id', world.latecomer.id)).length === 1)) {
      must(await world.admin.from('members').insert({ campaign_id: world.campaignId, user_id: world.latecomer.id, base_role: 'player' }).select('id'));
    }
    const sorrel = await actor({ name: 'Sorrel', owner_type: 'user', owner_user_id: world.latecomer.id });
    await setActive(world.playerA, world.ashId);
    expect((await give('gm', sorrel, toPlayer(world.playerA))).ok).toBe(true);
    const line = await handOver(sorrel);
    must(await world.admin.from('members').delete().eq('campaign_id', world.campaignId).eq('user_id', world.latecomer.id).select('id'));
    const undone = await undoChange.run(world.gm.db as unknown as Db, users.gm, { campaignId: world.campaignId, eventId: line, authorUserId: world.gm.id });
    expect(undone.ok).toBe(false);
    // The latecomer shares no other campaign with the GM, so their name can't be read: "That player" (the lead's Q1).
    if (!undone.ok) expect(undone.message).toBe("That player has left the campaign, so Sorrel can't go back to them.");
    expect(await row(sorrel)).toMatchObject({ owner_type: 'user', owner_user_id: world.playerA.id });
  });
});
