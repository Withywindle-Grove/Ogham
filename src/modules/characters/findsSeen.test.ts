// "New until Got it" (K20, pk-13): the seen mark, run through the app's registry on the stand-in database, which acts
// like supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql (supabase/tests/dec-6-k20-finds-seen.test.ts proves
// the real one); and which finds are New. Invented names only.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../core/events.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { toCharacterRef, type CharacterRef } from './commands.ts';
import { loadFindsSeen, markFindsSeen, newFinds } from './findsSeen.ts';

type Row = Record<string, unknown>;
const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let gm: CurrentUser;
let sam: CurrentUser;
let tess: CurrentUser;
let outsider: CurrentUser;
let wren: CharacterRef;
let moss: CharacterRef;
let sketch: CharacterRef;

const refOf = (id: string) => toCharacterRef(world.tables.actors.find((a) => a.id === id) as Parameters<typeof toCharacterRef>[0]);
async function mark(user: CurrentUser, character: CharacterRef) {
  world.signInAs(user.id);
  return runCommand(registry, world.db, user, markFindsSeen, { character });
}
/** The function itself, as a device could call it past the app's own check. */
async function callDirect(user: CurrentUser, characterId: string, extra: Row = {}) {
  world.signInAs(user.id);
  return world.db.rpc('mark_finds_seen' as never, { character: characterId, ...extra } as never) as unknown as Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
}
async function readMark(user: CurrentUser, characterId: string) {
  world.signInAs(user.id);
  return loadFindsSeen(world.db, characterId);
}

beforeEach(() => {
  world = createFakeDb();
  const gmId = world.addPerson('priya@weirs.example', 'Priya');
  const samId = world.addPerson('sam@weirs.example', 'Sam');
  const tessId = world.addPerson('tess@weirs.example', 'Tess');
  const outsiderId = world.addPerson('olm@elsewhere.example', 'Olm');
  campaign = world.addCampaign('The Eel Weirs', gmId);
  const wrenId = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  const mossId = world.addCharacter(campaign, 'Moss', { ownerId: tessId });
  const sketchId = world.addCharacter(campaign, 'Sketch', { ownerId: samId, approval: 'pending' });
  world.addMember(campaign, samId, 'player', wrenId);
  world.addMember(campaign, tessId, 'player', mossId);
  gm = { id: gmId, roles: { [campaign]: 'gm' } };
  sam = { id: samId, roles: { [campaign]: 'player' } };
  tess = { id: tessId, roles: { [campaign]: 'player' } };
  outsider = { id: outsiderId, roles: {} };
  wren = refOf(wrenId);
  moss = refOf(mossId);
  sketch = refOf(sketchId);
});

describe('the seen mark, on the stand-in database (K20, pk-13)', () => {
  // Purpose: the player sets their own approved character's mark, and reads it back.
  it('the player sets their own character’s mark and reads it', async () => {
    const done = await mark(sam, wren);
    expect(done.ok).toBe(true);
    expect(await readMark(sam, wren.id)).toBe(done.ok ? done.value : null);
  });

  // Purpose: the GM reads the mark, but can't write it, through the command or past it, nor through the table.
  it('the GM reads it and can’t write it', async () => {
    await mark(sam, wren);
    expect(await readMark(gm, wren.id)).not.toBeNull();
    expect((await mark(gm, wren)).ok).toBe(false);
    expect((await callDirect(gm, wren.id)).error?.code).toBe('42501');
    world.signInAs(gm.id);
    const update = (await world.db.from('finds_seen').update({ seen_at: '2026-01-01T00:00:00Z' }).eq('actor_id', wren.id).select('id')) as unknown as { error: { code?: string } | null };
    expect(update.error?.code).toBe('42501');
  });

  // Purpose: another player can't read or write it; neither can an outsider.
  it('another player and an outsider can’t read or write it', async () => {
    await mark(sam, wren);
    for (const who of [tess, outsider]) {
      expect(await readMark(who, wren.id)).toBeNull();
      expect((await mark(who, wren)).ok).toBe(false);
      expect((await callDirect(who, wren.id)).error?.code).toBe('42501');
    }
    world.signInAs(tess.id);
    const insert = (await world.db.from('finds_seen').insert({ campaign_id: campaign, actor_id: moss.id }).select('id')) as unknown as { error: { code?: string } | null };
    expect(insert.error?.code).toBe('42501');
    expect(world.tables.finds_seen.map((r) => r.actor_id)).toEqual([wren.id]);
  });

  // Purpose: a player can't set the mark on their own unapproved character, nor on someone else's.
  it('a player can’t mark an unapproved character, nor someone else’s', async () => {
    expect((await mark(sam, sketch)).ok).toBe(false);
    expect((await callDirect(sam, sketch.id)).error?.code).toBe('42501');
    expect((await mark(sam, moss)).ok).toBe(false);
    expect((await callDirect(sam, moss.id)).error?.code).toBe('42501');
    expect(world.tables.finds_seen).toEqual([]);
  });

  // Purpose: the time is the server's, whatever the device sends; a repeat moves it on.
  it('keeps the server’s time, whatever the device sends', async () => {
    const before = Date.now();
    const sent = await callDirect(sam, wren.id, { seen_at: '1999-01-01T00:00:00Z' });
    expect(sent.error).toBeNull();
    const first = String(world.tables.finds_seen[0]!.seen_at);
    expect(Date.parse(first)).toBeGreaterThanOrEqual(before);
    await mark(sam, wren);
    expect(Date.parse(String(world.tables.finds_seen[0]!.seen_at))).toBeGreaterThan(Date.parse(first));
    expect(world.tables.finds_seen).toHaveLength(1);
  });

  // Purpose: the mark's log line is its player's and the GM's, never another player's; it reads in the character's name.
  it('logs a line its player and the GM read, and another player doesn’t', async () => {
    await mark(sam, wren);
    const line = [...world.tables.events].reverse().find((e) => e.target_table === 'finds_seen')!;
    expect(line).toMatchObject({ type: 'character.seenFinds', level: 'verbose', audience: 'owner', owner_user_id: sam.id });
    for (const [who, sees] of [[sam, true], [gm, true], [tess, false]] as const) {
      world.signInAs(who.id);
      const log = await loadLog(world.db, campaign, { verbose: true });
      const names = await loadLogNames(world.db, campaign, who.id);
      const words = groupEntries(log!.events).map((e) => describeEntry(e, names));
      expect(words.includes('Wren saw the new finds.')).toBe(sees);
    }
  });

  // Purpose (K20 fix round): the function names its own line, so a call made past the app's command (untagged) still
  // logs as character.seenFinds, verbose, read by its player and the GM; never as a plain table line.
  it('names its own line, however it is called', async () => {
    await callDirect(sam, wren.id);
    const line = [...world.tables.events].reverse().find((e) => e.target_table === 'finds_seen')!;
    expect(line).toMatchObject({ type: 'character.seenFinds', level: 'verbose', audience: 'owner', owner_user_id: sam.id });
  });

  // Purpose: a mark is not undone (like a message's read time): the first is a making, a later one isn't undoable.
  it('can’t be undone', async () => {
    await mark(sam, wren);
    await mark(sam, wren);
    const lines = world.tables.events.filter((e) => e.target_table === 'finds_seen');
    for (const line of lines) {
      world.signInAs(sam.id);
      const undone = await runCommand(registry, world.db, sam, undoChange, { campaignId: campaign, eventId: String(line.id), authorUserId: sam.id });
      expect(undone.ok).toBe(false);
    }
  });
});

describe('which finds are New', () => {
  const finds = [
    { id: 'line-rope', createdAt: '2026-11-14T10:00:00Z' },
    { id: 'line-lamp', createdAt: '2026-11-14T12:00:00Z' },
    { id: 'line-net', createdAt: '2026-11-14T14:00:00Z' },
  ];

  // Purpose: with no mark, every find is New.
  it('with no mark, all of them', () => {
    expect(newFinds(finds, null).map((f) => f.id)).toEqual(['line-rope', 'line-lamp', 'line-net']);
  });

  // Purpose: after a mark, only those that came later are New; one at the very time of the mark was seen.
  it('after a mark, only the later ones', () => {
    expect(newFinds(finds, '2026-11-14T12:00:00Z').map((f) => f.id)).toEqual(['line-net']);
    expect(newFinds(finds, '2026-11-14T09:00:00Z').map((f) => f.id)).toEqual(['line-rope', 'line-lamp', 'line-net']);
    expect(newFinds(finds, '2026-11-15T00:00:00Z')).toEqual([]);
  });

  // Purpose: a time that can't be read counts as New, so nothing found is missed.
  it('counts an unreadable time as New', () => {
    expect(newFinds([{ id: 'line-odd', createdAt: 'soon' }], '2026-11-14T12:00:00Z').map((f) => f.id)).toEqual(['line-odd']);
    expect(newFinds(finds, 'not a time')).toHaveLength(3);
  });
});
