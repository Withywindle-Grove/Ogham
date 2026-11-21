// The GM gives a character to a player, or takes it back (plan dec-give-a-character-to-a-player, gp-1 to gp-6), on
// the stand-in database. The real rules are proved in supabase/tests/dec-give-character-reassign.test.ts.
//   Purpose:
//   1. Only the GM gives, only an approved character still in the campaign, only to a player of the campaign or back
//      to the GM; never to whoever has it now, never to the GM when it is already the GM's, never in a retired campaign.
//   2. A GM-made character given to a player with no character in play is theirs in play at once; one who has a
//      character keeps it in play.
//   3. Taken back by the GM, it leaves play for the player who had it; given on, likewise, and the alignment's owner
//      follows it.
//   4. The stand-in refuses a target who is not a player of the campaign, as the database does.
import { beforeEach, describe, expect, it } from 'vitest';
import { createRegistry, runCommand, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { mayGiveTo, reassignCharacter, toCharacterRef, type CharacterRef } from './commands.ts';
import { fromGmWords, giveSheet, giveEventId, givenToMe, givenWords, notGivenWords } from './giving.ts';

const ref = (over: Partial<CharacterRef> = {}): CharacterRef => ({
  id: 'actor-ash',
  campaignId: 'c',
  ownerType: 'gm',
  ownerUserId: null,
  approval: 'approved',
  archived: false,
  ...over,
});
const gm: CurrentUser = { id: 'user-gm', roles: { c: 'gm' } };
const sam: CurrentUser = { id: 'user-sam', roles: { c: 'player' } };
const toSam = { userId: 'user-sam', role: 'player' as const };
const toGm = { userId: null, role: null };
const may = (user: CurrentUser, character: CharacterRef, to: { userId: string | null; role: 'gm' | 'player' | null }) =>
  reassignCharacter.allowed(user, reassignCharacter.target({ character, to }));

describe('who may give a character, and to whom (gp-1, gp-5)', () => {
  it('the GM gives a GM-made character to a player', () => {
    expect(may(gm, ref(), toSam)).toBe(true);
  });

  it("the GM gives a player's character to another player, or takes it back", () => {
    const wren = ref({ ownerType: 'user', ownerUserId: 'user-sam' });
    expect(may(gm, wren, { userId: 'user-robin', role: 'player' })).toBe(true);
    expect(may(gm, wren, toGm)).toBe(true);
  });

  it('refuses the same owner, the GM for a character already his, a GM target and a non-member', () => {
    expect(may(gm, ref({ ownerType: 'user', ownerUserId: 'user-sam' }), toSam)).toBe(false);
    expect(may(gm, ref(), toGm)).toBe(false);
    expect(may(gm, ref(), { userId: 'user-gm', role: 'gm' })).toBe(false);
    expect(may(gm, ref(), { userId: 'user-stranger', role: null })).toBe(false);
  });

  it('refuses a player, even the owner, and an outsider', () => {
    const wren = ref({ ownerType: 'user', ownerUserId: 'user-sam' });
    expect(may(sam, wren, { userId: 'user-robin', role: 'player' })).toBe(false);
    expect(may(sam, ref(), toSam)).toBe(false);
    expect(may({ id: 'user-x', roles: {} }, ref(), toSam)).toBe(false);
  });

  it('refuses a character not approved, or archived', () => {
    expect(may(gm, ref({ ownerType: 'user', ownerUserId: 'user-robin', approval: 'pending' }), toSam)).toBe(false);
    expect(may(gm, ref({ archived: true }), toSam)).toBe(false);
  });

  it('is refused in a retired campaign', () => {
    const registry = createRegistry();
    registry.register(reassignCharacter);
    expect(registry.can({ ...gm, retired: ['c'] }, 'character.reassign', reassignCharacter.target({ character: ref(), to: toSam }))).toBe(false);
  });

  // Purpose (fix-768-1): a party-owned character (a party hireling) is never given to a player, because the database
  // allows only 'user' or 'gm' as a new owner type, so Undo of that give would be refused.
  it('refuses to give a party-owned character to a player, or to take it back to the GM', () => {
    const hireling = ref({ ownerType: 'party' });
    expect(may(gm, hireling, toSam)).toBe(false);
    expect(may(gm, hireling, toGm)).toBe(false);
  });

  it('mayGiveTo says who the sheet offers', () => {
    expect(mayGiveTo(ref(), toSam)).toBe(true);
    expect(mayGiveTo(ref({ ownerType: 'user', ownerUserId: 'user-sam' }), toSam)).toBe(false);
  });
});

describe('giving on the stand-in database (gp-3)', () => {
  let world: FakeWorld;
  let gmId: string;
  let samId: string;
  let robinId: string;
  let campaign: string;
  let ash: string;
  let wren: string;
  const registry = createRegistry();
  registry.register(reassignCharacter);
  const actor = (id: string) => world.tables.actors.find((a) => a.id === id)!;
  const active = (userId: string) => world.tables.members.find((m) => m.campaign_id === campaign && m.user_id === userId)!.active_actor_id;
  const asGm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } });
  const give = (id: string, to: { userId: string | null; role: 'gm' | 'player' | null }) => {
    world.signInAs(gmId);
    return runCommand(registry, world.db, asGm(), reassignCharacter, { character: toCharacterRef(actor(id) as never), to });
  };

  beforeEach(() => {
    world = createFakeDb();
    gmId = world.addPerson('priya@lantern.example', 'Priya');
    samId = world.addPerson('sam@lantern.example', 'Sam');
    robinId = world.addPerson('robin@lantern.example', 'Robin');
    campaign = world.addCampaign('The Reed Marches', gmId);
    ash = world.addCharacter(campaign, 'Ash');
    wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
    world.addMember(campaign, samId, 'player', wren);
    world.addMember(campaign, robinId, 'player');
    actor(ash).status = 'active';
    actor(wren).status = 'active';
  });

  it('a player with no character in play has the given one in play at once, still approved', async () => {
    const result = await give(ash, { userId: robinId, role: 'player' });
    expect(result.ok).toBe(true);
    expect(actor(ash)).toMatchObject({ owner_type: 'user', owner_user_id: robinId, approval: 'approved' });
    expect(active(robinId)).toBe(ash);
  });

  it('a player who has a character in play keeps it', async () => {
    expect((await give(ash, { userId: samId, role: 'player' })).ok).toBe(true);
    expect(actor(ash).owner_user_id).toBe(samId);
    expect(active(samId)).toBe(wren);
  });

  it('taken back, it is the GM own again and out of play for the player who had it', async () => {
    expect((await give(wren, { userId: null, role: null })).ok).toBe(true);
    expect(actor(wren)).toMatchObject({ owner_type: 'gm', owner_user_id: null, approval: 'approved' });
    expect(active(samId)).toBeNull();
  });

  it('given on to another player, it leaves the first one and is in play for the second', async () => {
    world.tables.character_alignments.push({ actor_id: wren, campaign_id: campaign, owner_user_id: samId, alignment: 'Reed' });
    expect((await give(wren, { userId: robinId, role: 'player' })).ok).toBe(true);
    expect(active(samId)).toBeNull();
    expect(active(robinId)).toBe(wren);
    expect(world.tables.character_alignments.find((a) => a.actor_id === wren)!.owner_user_id).toBe(robinId);
  });

  it('the stand-in refuses someone who is not a player of the campaign, as the database does', async () => {
    const stranger = world.addPerson('odo@lantern.example', 'Odo');
    world.signInAs(gmId);
    const result = await reassignCharacter.run(world.db, asGm(), { character: toCharacterRef(actor(ash) as never), to: { userId: stranger, role: 'player' } });
    expect(result.ok).toBe(false);
    expect(actor(ash).owner_type).toBe('gm');
  });

  // Purpose: the player who was given a character finds when (frame G4), from the hand-over line; every member reads
  // that line (gp-4 as amended), but it gives "From your GM" only to the player it gave the character to.
  it('the receiver reads when it was given to them; another player reads the line but gets no "From your GM"', async () => {
    expect((await give(ash, { userId: robinId, role: 'player' })).ok).toBe(true);
    world.signInAs(robinId);
    expect([...(await givenToMe(world.db, robinId, [ash])).keys()]).toEqual([ash]);
    world.signInAs(samId);
    expect([...(await givenToMe(world.db, samId, [ash])).keys()]).toEqual([]);
  });

  // Purpose: the toast's Undo finds this give's own hand-over line, by its request id, even when another tab gave the
  // same character on within the toast's seconds.
  it("the toast's Undo finds its own give, not a newer one from another tab", async () => {
    const ownLine = giveEventId as (db: Db, campaignId: string, actorId: string, requestId: string) => Promise<string | null>;
    const mine = crypto.randomUUID();
    world.signInAs(gmId);
    const first = await runCommand(registry, world.db, asGm(), reassignCharacter, { character: toCharacterRef(actor(ash) as never), to: { userId: robinId, role: 'player' } }, { requestId: mine });
    expect(first.ok).toBe(true);
    expect((await give(ash, { userId: samId, role: 'player' })).ok).toBe(true);
    const found = await ownLine(world.db, campaign, ash, mine);
    expect(world.tables.events.find((e) => e.id === found)?.request_id).toBe(mine);
  });

  // Purpose: Ash given to Sam, then to Robin, and that second give undone: Sam still reads that Ash came from the GM,
  // because a give that was undone is not where the character came from.
  it('a give that was undone does not count: the earlier give to Sam still shows', async () => {
    const withUndo = createRegistry();
    withUndo.register(reassignCharacter);
    withUndo.register(undoChange);
    expect((await give(ash, { userId: samId, role: 'player' })).ok).toBe(true);
    expect((await give(ash, { userId: robinId, role: 'player' })).ok).toBe(true);
    const toRobin = world.tables.events.filter((e) => e.type === 'character.reassign' && e.target_id === ash).sort((a, b) => Number(b.seq) - Number(a.seq))[0];
    world.signInAs(gmId);
    const undone = await runCommand(withUndo, world.db, asGm(), undoChange, { campaignId: campaign, eventId: String(toRobin!.id), authorUserId: gmId });
    expect(undone.ok).toBe(true);
    expect(actor(ash).owner_user_id).toBe(samId);
    world.signInAs(samId);
    expect([...(await givenToMe(world.db, samId, [ash])).keys()]).toEqual([ash]);
  });

  // Purpose (gp-9, the lead's words, 2026-11-14): Undo of a give that would hand the character back to a player who has
  // LEFT the campaign is refused (the database allows a character only to a player of the campaign), and says why in
  // the player's and the character's names, not "You don't have permission to do that."; the give stays as it is.
  // (Ash was never in play for Sam, who kept Wren; had it been, the in-play mark left with Sam and Undo says "That's
  // changed since", as the database does.)
  it('Undo that would hand a character back to a player who has left says so, and the give stays', async () => {
    const withUndo = createRegistry();
    withUndo.register(reassignCharacter);
    withUndo.register(undoChange);
    expect((await give(ash, { userId: samId, role: 'player' })).ok).toBe(true);
    expect((await give(ash, { userId: robinId, role: 'player' })).ok).toBe(true);
    const toRobin = world.tables.events.filter((e) => e.type === 'character.reassign' && e.target_id === ash).sort((a, b) => Number(b.seq) - Number(a.seq))[0];
    // Sam leaves the campaign.
    world.tables.members.splice(world.tables.members.findIndex((m) => m.campaign_id === campaign && m.user_id === samId), 1);
    world.signInAs(gmId);
    const undone = await runCommand(withUndo, world.db, asGm(), undoChange, { campaignId: campaign, eventId: String(toRobin!.id), authorUserId: gmId });
    expect(undone.ok).toBe(false);
    if (!undone.ok) expect(undone.message).toBe("Sam has left the campaign, so Ash can't go back to them.");
    expect(actor(ash).owner_user_id).toBe(robinId);
  });

  // Purpose (gp-9, the lead's Q1, 2026-11-14): once the leaver shares no campaign with the GM, their name can't be
  // read (the database's rule on profiles), so the toast says "That player"; no migration, and the give stays.
  it("names 'That player' when the leaver's name can no longer be read", async () => {
    const withUndo = createRegistry();
    withUndo.register(reassignCharacter);
    withUndo.register(undoChange);
    expect((await give(ash, { userId: samId, role: 'player' })).ok).toBe(true);
    expect((await give(ash, { userId: robinId, role: 'player' })).ok).toBe(true);
    const toRobin = world.tables.events.filter((e) => e.type === 'character.reassign' && e.target_id === ash).sort((a, b) => Number(b.seq) - Number(a.seq))[0];
    world.tables.members.splice(world.tables.members.findIndex((m) => m.campaign_id === campaign && m.user_id === samId), 1);
    // The stand-in reads every profile; take Sam's away to stand for the one the GM can't read.
    world.tables.profiles.splice(world.tables.profiles.findIndex((p) => p.id === samId), 1);
    world.signInAs(gmId);
    const undone = await runCommand(withUndo, world.db, asGm(), undoChange, { campaignId: campaign, eventId: String(toRobin!.id), authorUserId: gmId });
    expect(undone.ok).toBe(false);
    if (!undone.ok) expect(undone.message).toBe("That player has left the campaign, so Ash can't go back to them.");
    expect(actor(ash).owner_user_id).toBe(robinId);
  });
});

describe('the sheet and the toast (page 13)', () => {
  const players = [
    { userId: 'user-sam', name: 'Sam', plays: 'Wren' },
    { userId: 'user-robin', name: 'Robin', plays: 'Tam' },
    { userId: 'user-kit', name: 'Kit', plays: null },
  ];

  it("a GM-made character: every player, no owner's line, no GM row", () => {
    expect(giveSheet({ name: 'Ash', ownerType: 'gm', ownerUserId: null }, players)).toEqual({
      hasLine: null,
      gmRow: false,
      rows: [
        { userId: 'user-sam', name: 'Sam', summary: 'plays Wren' },
        { userId: 'user-robin', name: 'Robin', summary: 'plays Tam' },
        { userId: 'user-kit', name: 'Kit', summary: 'no character yet' },
      ],
    });
  });

  it("a player's character: their line with the tick, You, the GM, and the others (gp-5)", () => {
    const sheet = giveSheet({ name: 'Wren', ownerType: 'user', ownerUserId: 'user-sam' }, players);
    expect(sheet.hasLine).toBe('Sam has Wren now.');
    expect(sheet.gmRow).toBe(true);
    expect(sheet.rows.map((r) => r.name)).toEqual(['Robin', 'Kit']);
  });

  it('the words', () => {
    expect(givenWords('Ash', 'Sam')).toBe('Ash given to Sam.');
    expect(givenWords('Wren', null)).toBe('Wren is yours again.');
    expect(notGivenWords('Ash', 'Sam')).toBe("Ash wasn't given: Sam is no longer in this campaign. Nothing changed.");
    expect(fromGmWords('2026-11-14T05:00:00Z', new Date('2026-11-14T06:00:00Z'))).toBe('From your GM, today');
    expect(fromGmWords('2026-11-02T12:00:00Z', new Date('2026-11-14T12:00:00Z'))).toMatch(/^From your GM, /);
  });
});
