// "New until Got it" (K20, pk-13): the seen mark, run through the app's registry on the stand-in database, which acts
// like supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql (supabase/tests/dec-6-k20-finds-seen.test.ts proves
// the real one); and what is New, read from the log (K20a). Invented names only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { taggedDb } from '../../core/eventTags.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames, type LogEvent } from '../../core/events.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { toCharacterRef, type CharacterRef } from './commands.ts';
import { findsCount, findsSince, loadFindsSeen, markFindsSeen, type FindEntry, type ThingFind } from './findsSeen.ts';

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

// What is New, read from the log (K20a; p45-21, p45-22, p45-25, p45-28). Each road is driven through the stand-in
// database's own functions and table writes (no other module's command is imported: the reader reads event types by
// their string), and read back as Wren's player's device is sent it. Invented names, coins and things only.
describe('what is new, read from the log (K20a)', () => {
  const stash = () => world.tables.locations.find((l) => l.campaign_id === campaign && l.kind === 'stash')!.id as string;
  let minute = 0;
  /** Each step a minute later, so the mark falls between steps (the stand-in stamps lines with the clock). */
  const tick = () => vi.setSystemTime(new Date(Date.UTC(2026, 10, 26, 9, ++minute)));
  const as = (user: CurrentUser, type: string) => {
    tick();
    world.signInAs(user.id);
    return taggedDb(world.db, { type, level: 'simple', requestId: crypto.randomUUID() });
  };
  /** A line already in a pack (a kit at creation: no line in the log). */
  const kit = (actorId: string | null, name: string, qty: number, entry: string | null = null) => {
    const id = `line-${name.toLowerCase().replace(/\W+/g, '-')}-${actorId ?? 'stash'}`;
    world.tables.inventory_lines.push({
      id, campaign_id: campaign, actor_id: actorId, location_id: actorId ? null : stash(), library_entry_id: entry, source_pack_id: entry ? 'pack-reed' : null,
      name, category: 'gear', weight_coin: 1, slots: null, stack: entry ? 10 : 1, per_units: 1, qty, container_line_id: null, equipped: false, how_got: 'found',
      cost: '', notes: '', item_data: {}, approval: 'approved', charges_left: null, charges_hidden: false, charges_used: 0, version: 1, created_at: new Date().toISOString(),
    });
    return id;
  };
  const mustOk = async (call: PromiseLike<{ error: unknown }>) => expect((await call).error).toBeNull();
  const markNow = () => {
    tick();
    return new Date().toISOString();
  };
  /** What Wren's player's device reads: the log it was sent, the lines and Wren's purse it holds. */
  async function newForWren(seenAt: string | null = null): Promise<FindEntry[]> {
    world.signInAs(sam.id);
    const log = await loadLog(world.db, campaign, { verbose: true });
    const rows = (await world.db.from('inventory_lines').select('id, actor_id, name, qty').eq('campaign_id', campaign)).data as Row[];
    const purse = (await world.db.from('purses').select('id').eq('actor_id', wren.id)).data as Row[];
    return findsSince({
      character: { id: wren.id, ownerUserId: sam.id, purseId: (purse[0]?.id as string | undefined) ?? null },
      gmUserIds: new Set([gm.id]),
      events: log!.events,
      lines: rows.map((r) => ({ id: String(r.id), actorId: (r.actor_id as string | null) ?? null, name: String(r.name), qty: Number(r.qty) })),
      seenAt,
    });
  }
  const send = (things: Row[], coins: Record<string, number> = {}) =>
    as(gm, 'find.give').rpc('give_find' as never, { campaign, to_actor: wren.id, place: 'place-stair', things, coins, rows: [] } as never) as unknown as Promise<{ data: unknown; error: unknown }>;
  const sendId = async (things: Row[], coins: Record<string, number> = {}) => {
    const sent = await send(things, coins);
    expect(sent.error).toBeNull();
    return String(sent.data);
  };
  const undo = (user: CurrentUser, eventId: string) => as(user, 'event.undo').rpc('undo_request' as never, { event_id: eventId } as never) as unknown as Promise<{ error: unknown }>;
  const lastLineOf = (type: string) => [...world.tables.events].reverse().find((e) => e.type === type)!;
  const giveWhole = (lineId: string) => as(tess, 'inventory.move').from('inventory_lines').update({ actor_id: wren.id, container_line_id: null, equipped: false }).eq('id', lineId).select('id');
  async function givePart(lineId: string, howMany: number) {
    const db = as(tess, 'inventory.move');
    const made = (await db.rpc('split_inventory_line' as never, { line: lineId, how_many: howMany } as never)) as unknown as { data: string; error: unknown };
    expect(made.error).toBeNull();
    await mustOk(db.from('inventory_lines').update({ actor_id: wren.id }).eq('id', made.data).select('id'));
    return made.data;
  }
  const intoStack = (user: CurrentUser, lineId: string, howMany: number) =>
    as(user, 'inventory.move').rpc('move_into_stack' as never, { line: lineId, how_many: howMany, to_actor: wren.id, to_location: null, to_container: null } as never) as unknown as Promise<{ data: unknown; error: unknown }>;
  const gmAdds = (name: string, qty: number) =>
    as(gm, 'inventory.add').from('inventory_lines').insert({ campaign_id: campaign, actor_id: wren.id, location_id: null, name, category: 'gear', qty, stack: 1, how_got: 'given', approval: 'approved' }).select('id');
  const gmAddsOntoStack = (entry: string, howMany: number) =>
    as(gm, 'inventory.add').rpc('join_added_line' as never, { campaign, actor: wren.id, location: null, container: null, entry, how_many: howMany, made_id: crypto.randomUUID(), how_got: 'given', cost: '', note: '' } as never) as unknown as Promise<{ data: unknown; error: unknown }>;
  const giveCoin = (coins: Record<string, number>) => as(gm, 'purse.add').rpc('purse_add' as never, { campaign, actor: wren.id, location: null, coins } as never) as unknown as Promise<{ error: unknown }>;
  const tessGivesCoin = (coins: Record<string, number>) => as(tess, 'purse.give').rpc('purse_give' as never, { campaign, from_actor: moss.id, to_actor: wren.id, to_location: null, coins } as never) as unknown as Promise<{ error: unknown }>;
  const things = (entries: FindEntry[]) => entries.filter((e): e is ThingFind => e.kind === 'thing');
  const counted = (entries: FindEntry[]) => entries.filter((e) => e.takenBack === null).length;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    minute = 0;
    tick();
    world.tables.packs.push({ id: 'pack-reed', owner_user_id: gm.id, campaign_id: null, name: 'Reed rules', version: '0.1', kind: 'setting' });
    world.tables.library_entries.push(
      { id: 'entry-rules', pack_id: 'pack-reed', kind: 'rulesSet', pack_entry_id: 'reed-rules', name: 'Reed rules', data: { currency: [{ key: 'heron', label: 'herons', valueInBase: 1 }, { key: 'bit', label: 'bits', valueInBase: 10 }] } },
      { id: 'entry-pearl', pack_id: 'pack-reed', kind: 'item', pack_entry_id: 'river-pearl', name: 'River pearls', data: { id: 'river-pearl', name: 'River pearls', category: 'gem', stack: 10 } },
    );
    world.tables.campaign_packs.push({ id: 'link-reed', campaign_id: campaign, pack_id: 'pack-reed', priority: 1, option_choices: {} });
    world.tables.places.push({ id: 'place-stair', campaign_id: campaign, name: 'The Reed Stair', players_name: 'A stair', undone: false, version: 1 });
    // The stand-in makes every purse on its first read, as the database has them from the start.
    world.signInAs(gm.id);
    await world.db.from('purses').select('id');
  });
  afterEach(() => vi.useRealTimers());

  // Purpose: with no mark, a pack of twelve things (her kit) and one find has one new thing, not thirteen.
  it('with no mark, only the find is new, not her whole pack', async () => {
    for (let n = 1; n <= 12; n++) kit(wren.id, `Kit thing ${n}`, 1);
    await sendId([{ name: 'Bronze ring', qty: 1 }]);
    expect((await newForWren()).map((e) => e.kind === 'thing' && [e.name, e.arrived, e.who])).toEqual([['Bronze ring', 1, { kind: 'gm' }]]);
  });

  // Purpose: after the mark, only what arrived later is new; a find at or before the mark was seen.
  it('after the mark, only later arrivals', async () => {
    await sendId([{ name: 'Bronze ring', qty: 1 }]);
    const seenAt = markNow();
    await sendId([{ name: 'Coil of reed rope', qty: 1 }]);
    expect(things(await newForWren(seenAt)).map((e) => e.name)).toEqual(['Coil of reed rope']);
    expect(await newForWren(markNow())).toEqual([]);
  });

  // Purpose: each of the four roads p45-21 names is new: the GM's send, a gift from another character (a thing and
  // coin), the GM's "Give coin…" and the GM's Add item; each names who did it.
  it('counts each of the four roads, naming who', async () => {
    const lamp = kit(moss.id, 'Hooded lamp', 1);
    await sendId([{ name: 'Bronze ring', qty: 1 }]);
    await mustOk(giveWhole(lamp));
    await mustOk(gmAdds('Glow wand', 1));
    world.tables.purses.find((p) => p.actor_id === moss.id)!.coins = { heron: 50 };
    await mustOk(tessGivesCoin({ heron: 5 }));
    const found = await newForWren();
    expect(things(found).map((e) => [e.name, e.who])).toEqual([
      ['Glow wand', { kind: 'gm' }],
      ['Hooded lamp', { kind: 'character', characterId: moss.id }],
      ['Bronze ring', { kind: 'gm' }],
    ]);
    expect(found.find((e) => e.kind === 'coin')).toMatchObject({ coins: { heron: 5 }, who: { kind: 'character', characterId: moss.id } });
    const seenAt = markNow();
    await mustOk(giveCoin({ heron: 40 }));
    expect(await newForWren(seenAt)).toMatchObject([{ kind: 'coin', coins: { heron: 40 }, who: { kind: 'gm' }, takenBack: null }]);
  });

  // Purpose: her own acts are never new: her own Add item, Buy it, a Take from the stash (a thing and coin), and a kit.
  it('never counts her own Add item, Buy it, Take or kit', async () => {
    kit(wren.id, 'Reed basket', 1);
    const rope = kit(null, 'Coil of reed rope', 1);
    await mustOk(as(sam, 'inventory.add').from('inventory_lines').insert({ campaign_id: campaign, actor_id: wren.id, location_id: null, name: 'Fish hook', category: 'gear', qty: 3, stack: 1, how_got: 'bought', approval: 'approved' }).select('id'));
    // Buy it lands the bought line in the reply's own request, the buyer's tap (request.reply, townRequests.ts).
    await mustOk(as(sam, 'request.reply').from('inventory_lines').insert({ campaign_id: campaign, actor_id: wren.id, location_id: null, name: 'Lantern oil', category: 'gear', qty: 1, stack: 1, how_got: 'bought', approval: 'approved' }).select('id'));
    await mustOk(as(sam, 'inventory.move').from('inventory_lines').update({ actor_id: wren.id, location_id: null }).eq('id', rope).select('id'));
    world.tables.purses.find((p) => p.location_id === stash())!.coins = { heron: 9 };
    await mustOk(as(sam, 'purse.take').rpc('purse_take' as never, { campaign, from_actor: null, from_location: stash(), to_actor: wren.id, coins: { heron: 9 } } as never) as unknown as Promise<{ error: unknown }>);
    expect(world.tables.purses.find((p) => p.actor_id === wren.id)!.coins).toEqual({ heron: 9 });
    expect(await newForWren()).toEqual([]);
  });

  // Purpose: the GM's other moves with the same event types are not one of the four roads: an inventory.move from the
  // stash or from another character onto her, and a purse.take onto her from another character or the stash (⚑ in
  // the pull request).
  it("leaves out the GM's moves from the stash or another character", async () => {
    const rope = kit(null, 'Coil of reed rope', 1);
    const lamp = kit(moss.id, 'Hooded lamp', 1);
    await mustOk(as(gm, 'inventory.move').from('inventory_lines').update({ actor_id: wren.id, location_id: null }).eq('id', rope).select('id'));
    await mustOk(as(gm, 'inventory.move').from('inventory_lines').update({ actor_id: wren.id }).eq('id', lamp).select('id'));
    world.tables.purses.find((p) => p.actor_id === moss.id)!.coins = { heron: 9 };
    await mustOk(as(gm, 'purse.take').rpc('purse_take' as never, { campaign, from_actor: moss.id, from_location: null, to_actor: wren.id, coins: { heron: 9 } } as never) as unknown as Promise<{ error: unknown }>);
    world.tables.purses.find((p) => p.location_id === stash())!.coins = { heron: 4 };
    await mustOk(as(gm, 'purse.take').rpc('purse_take' as never, { campaign, from_actor: null, from_location: stash(), to_actor: wren.id, coins: { heron: 4 } } as never) as unknown as Promise<{ error: unknown }>);
    expect(world.tables.purses.find((p) => p.actor_id === wren.id)!.coins).toEqual({ heron: 13 });
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === wren.id)).toHaveLength(2);
    expect(await newForWren()).toEqual([]);
  });

  // Purpose: two pearls onto her six are one entry, arrived 2, now 8 (p45-22); a second find onto the same stack adds
  // its arrivals to that one entry, the count as it now is (⚑ F9's lean), and it is still one.
  it('a find onto her stack: what arrived and the new count, one entry however many finds', async () => {
    kit(wren.id, 'River pearls', 6, 'entry-pearl');
    const mossPearls = kit(moss.id, 'River pearls', 5, 'entry-pearl');
    expect((await gmAddsOntoStack('entry-pearl', 2)).data).toBe('line-river-pearls-' + wren.id);
    expect(things(await newForWren())).toMatchObject([{ name: 'River pearls', arrived: 2, now: 8, who: { kind: 'gm' } }]);
    expect((await intoStack(tess, mossPearls, 3)).data).toBe('line-river-pearls-' + wren.id);
    const found = await newForWren();
    expect(found).toMatchObject([{ kind: 'thing', name: 'River pearls', arrived: 5, now: 11, who: { kind: 'character', characterId: moss.id } }]);
    expect(counted(found)).toBe(1);
  });

  // Purpose: a gift of part of a stack as its own line counts what was handed over; a whole line merged onto her stack
  // names its giver from the log's copy; part of one onto her stack names the giver from the source line's carrier now
  // (ruling "A"; the log's last copy once it is gone), and none once the device holds neither.
  it('a gift by every shape: part as a line, whole onto her stack, part onto her stack', async () => {
    const mossRope = kit(moss.id, 'Coil of reed rope', 4);
    await givePart(mossRope, 1);
    expect(things(await newForWren())).toMatchObject([{ name: 'Coil of reed rope', arrived: 1, now: null, who: { kind: 'character', characterId: moss.id } }]);
    const seenAt = markNow();
    kit(wren.id, 'River pearls', 6, 'entry-pearl');
    const mossPearls = kit(moss.id, 'River pearls', 3, 'entry-pearl');
    await intoStack(tess, mossPearls, 3);
    expect(world.tables.inventory_lines.some((l) => l.id === mossPearls)).toBe(false);
    expect(things(await newForWren(seenAt))).toMatchObject([{ arrived: 3, now: 9, who: { kind: 'character', characterId: moss.id } }]);
    const next = markNow();
    const morePearls = kit(moss.id, 'River pearl', 4, 'entry-pearl');
    await intoStack(tess, morePearls, 1);
    expect(things(await newForWren(next))).toMatchObject([{ arrived: 1, now: 10, who: { kind: 'character', characterId: moss.id } }]);
    world.tables.inventory_lines = world.tables.inventory_lines.filter((l) => l.id !== morePearls);
    expect(things(await newForWren(next))).toMatchObject([{ who: { kind: 'unknown' } }]);
  });

  // Purpose: a send undone before the mark stays, marked taken back by the GM and out of the count, under the name it
  // had (p45-25); after the next mark it is gone, and an Undo after a mark adds nothing (p45-28).
  it('a send the GM undid stays, taken back and not counted, until the next mark', async () => {
    await sendId([{ name: 'Moon opals', qty: 2 }]);
    const ringSend = await sendId([{ name: 'Bronze ring', qty: 1 }], { heron: 240 });
    await mustOk(as(gm, 'find.undo').rpc('undo_find' as never, { event_id: ringSend } as never) as unknown as Promise<{ error: unknown }>);
    const found = await newForWren();
    expect(found.map((e) => [e.kind, e.kind === 'thing' ? e.name : e.coins, e.takenBack?.byGm ?? null])).toEqual([
      ['thing', 'Bronze ring', true],
      ['coin', { heron: 240 }, true],
      ['thing', 'Moon opals', null],
    ]);
    expect(things(found)[0]!.lineId).toBeNull();
    expect(counted(found)).toBe(1);
    const seenAt = markNow();
    expect(await newForWren(seenAt)).toEqual([]);
    const late = await sendId([{ name: 'Glow wand', qty: 1 }]);
    const after = markNow();
    await mustOk(as(gm, 'find.undo').rpc('undo_find' as never, { event_id: late } as never) as unknown as Promise<{ error: unknown }>);
    expect(await newForWren(after)).toEqual([]);
  });

  // Purpose (⚑, the safest reading): an Undo of the other three roads also marks the arrival taken back and leaves it
  // out of the count, saying whether the GM undid it, so a giver's own Undo never reads as the GM's.
  it('an undone gift, "Give coin…" or Add item is taken back too, by whoever undid it', async () => {
    const lamp = kit(moss.id, 'Hooded lamp', 1);
    await mustOk(giveWhole(lamp));
    await mustOk(undo(tess, lastLineOf('inventory.move').id as string));
    await mustOk(giveCoin({ heron: 7 }));
    await mustOk(undo(gm, lastLineOf('purse.add').id as string));
    // An Add item that made a line can't be undone (hard rule 4); one that joined her stack can (sw-4).
    kit(wren.id, 'River pearls', 6, 'entry-pearl');
    await gmAddsOntoStack('entry-pearl', 2);
    await mustOk(undo(gm, lastLineOf('inventory.add').id as string));
    const found = await newForWren();
    expect(found.map((e) => [e.kind === 'thing' ? e.name : e.coins, e.takenBack?.byGm])).toEqual([
      ['River pearls', true],
      [{ heron: 7 }, true],
      ['Hooded lamp', false],
    ]);
    expect(counted(found)).toBe(0);
  });

  // Purpose: an Undo is never itself an arrival, even one that puts something back on her.
  it('an Undo that puts a thing back on her is not new', async () => {
    const basket = kit(wren.id, 'Reed basket', 1);
    await mustOk(as(sam, 'inventory.move').from('inventory_lines').update({ actor_id: moss.id }).eq('id', basket).select('id'));
    await mustOk(undo(gm, lastLineOf('inventory.move').id as string));
    expect(world.tables.inventory_lines.find((l) => l.id === basket)!.actor_id).toBe(wren.id);
    expect(await newForWren()).toEqual([]);
    // Nor were its reversal line named as the line it undoes, and written by another player.
    for (const e of world.tables.events.filter((x) => x.reverts_event_id)) Object.assign(e, { type: 'inventory.move', actor_user_id: tess.id });
    expect(await newForWren()).toEqual([]);
  });

  // Purpose: a join's line holds only a count, so a find onto someone else's stack, undone, never reaches her list;
  // nor does another player's Take from the stash onto her stack (part of a line or all of it).
  it("leaves out joins onto others' stacks and Takes from the stash onto hers", async () => {
    kit(moss.id, 'River pearls', 6, 'entry-pearl');
    await mustOk(as(gm, 'inventory.add').rpc('join_added_line' as never, { campaign, actor: moss.id, location: null, container: null, entry: 'entry-pearl', how_many: 2, made_id: crypto.randomUUID(), how_got: 'given', cost: '', note: '' } as never) as unknown as Promise<{ error: unknown }>);
    await mustOk(undo(gm, lastLineOf('inventory.add').id as string));
    const loose = kit(moss.id, 'River pearl', 2, 'entry-pearl');
    await mustOk(as(tess, 'inventory.move').rpc('move_into_stack' as never, { line: loose, how_many: 1, to_actor: moss.id, to_location: null, to_container: null } as never) as unknown as Promise<{ error: unknown }>);
    await mustOk(undo(tess, lastLineOf('inventory.move').id as string));
    expect(await newForWren()).toEqual([]);
    kit(wren.id, 'Moon opals', 2, 'entry-pearl');
    const stashed = kit(null, 'Moon opals', 4, 'entry-pearl');
    await intoStack(tess, stashed, 1);
    await intoStack(tess, stashed, 3);
    expect(world.tables.inventory_lines.find((l) => l.actor_id === wren.id && l.name === 'Moon opals')!.qty).toBe(6);
    expect(await newForWren()).toEqual([]);
  });

  // Purpose (review fix 1): the GM's find onto Moss's stack stays Moss's, even once that stack is moved onto Wren by a
  // move that is not an arrival (here the GM's own move; her own Take reads the same): it is not new for her.
  it("a GM join onto another's stack is not hers once that stack moves onto her", async () => {
    const mossPearls = kit(moss.id, 'River pearls', 6, 'entry-pearl');
    await mustOk(as(gm, 'inventory.add').rpc('join_added_line' as never, { campaign, actor: moss.id, location: null, container: null, entry: 'entry-pearl', how_many: 2, made_id: crypto.randomUUID(), how_got: 'given', cost: '', note: '' } as never) as unknown as Promise<{ error: unknown }>);
    await mustOk(as(gm, 'inventory.move').from('inventory_lines').update({ actor_id: wren.id }).eq('id', mossPearls).select('id'));
    expect(world.tables.inventory_lines.find((l) => l.id === mossPearls)!.actor_id).toBe(wren.id);
    expect(await newForWren()).toEqual([]);
  });

  // Purpose: a whole-line gift logs no count, so it is read from the row; a find onto that row later is not counted
  // twice: what arrived is never more than the row holds.
  it('never counts more arrived than the row holds', async () => {
    const mossPearls = kit(moss.id, 'River pearls', 5, 'entry-pearl');
    await mustOk(giveWhole(mossPearls));
    await gmAddsOntoStack('entry-pearl', 2);
    expect(things(await newForWren())).toMatchObject([{ name: 'River pearls', arrived: 7, now: null, who: { kind: 'gm' } }]);
  });

  // Purpose: a thing given away or dropped since leaves the list; one put in a container (or merged into a stack in it)
  // stays, as the row it now is.
  it('given away or dropped leaves; put in a container stays', async () => {
    const basket = kit(wren.id, 'Reed basket', 1);
    world.tables.inventory_lines.push({ ...world.tables.inventory_lines.find((l) => l.id === basket)!, id: 'line-pearls-in-basket', name: 'River pearls', qty: 4, stack: 10, library_entry_id: 'entry-pearl', source_pack_id: 'pack-reed', container_line_id: basket });
    await sendId([{ name: 'Bronze ring', qty: 1 }, { name: 'Moon opals', qty: 2 }, { name: 'Glow wand', qty: 1 }]);
    const [ring, opals, wand] = ['Bronze ring', 'Moon opals', 'Glow wand'].map((n) => world.tables.inventory_lines.find((l) => l.name === n)!.id as string);
    await mustOk(as(sam, 'inventory.move').from('inventory_lines').update({ actor_id: moss.id }).eq('id', ring!).select('id'));
    await mustOk(as(sam, 'inventory.remove').from('inventory_lines').delete().eq('id', wand!).select('id'));
    await mustOk(as(sam, 'inventory.move').from('inventory_lines').update({ container_line_id: basket }).eq('id', opals!).select('id'));
    expect(things(await newForWren()).map((e) => [e.name, e.lineId])).toEqual([['Moon opals', opals]]);
    // Pearls sent, then merged by her into the basket's pearls: the find is the basket's stack now, 2 of its 6.
    await sendId([{ libraryEntryId: 'entry-pearl', qty: 2 }]);
    const sent = world.tables.inventory_lines.find((l) => l.actor_id === wren.id && l.name === 'River pearls' && !l.container_line_id)!.id as string;
    await as(sam, 'inventory.move').rpc('move_into_stack' as never, { line: sent, how_many: 2, to_actor: wren.id, to_location: null, to_container: basket } as never);
    expect(things(await newForWren())).toMatchObject([{ name: 'River pearls', lineId: 'line-pearls-in-basket', arrived: 2, now: 6 }, { name: 'Moon opals' }]);
  });

  // Purpose: a send's coin is one entry, and coin from several arrivals is one entry, coin by coin; a stack is one.
  it("a send's coin is one entry; a stack is one", async () => {
    await sendId([{ name: 'Moon opals', qty: 2 }], { heron: 200, bit: 3 });
    await mustOk(giveCoin({ heron: 40 }));
    const found = await newForWren();
    expect(found.filter((e) => e.kind === 'coin')).toMatchObject([{ coins: { heron: 240, bit: 3 }, who: { kind: 'gm' } }]);
    expect(counted(found)).toBe(2);
  });

  // Purpose: an unidentified thing is named by the row as she sees it (its face), never by a line's truth (p45-8).
  it('names a thing by its row as she sees it, never by what a line says of it', () => {
    const event: LogEvent = {
      id: 'e1', seq: 1, type: 'find.give', level: 'simple', actorUserId: gm.id, targetTable: 'inventory_lines', targetId: 'line-ring', before: null,
      after: { actor_id: wren.id, name: 'Ring of the Drowned Reeve', qty: 1 }, fiat: false, reason: null, revertsEventId: null, requestId: 'r1', createdAt: '2026-11-26T09:00:00Z',
    };
    const found = findsSince({
      character: { id: wren.id, ownerUserId: sam.id, purseId: null }, gmUserIds: new Set([gm.id]), events: [event], seenAt: null,
      lines: [{ id: 'line-ring', actorId: wren.id, name: 'Bronze ring', qty: 1 }],
    });
    expect(things(found).map((e) => e.name)).toEqual(['Bronze ring']);
  });
});

// The count on the Pack's icon, and the failed tap's words (K19a; pk-5, p45-10, p45-17, p45-24). Invented things only.
describe('the count, and the failed tap’s words (K19a)', () => {
  const at = '2026-11-26T09:00:00.000Z';
  const thingOf = (name: string, o: Partial<ThingFind> = {}): FindEntry => ({ kind: 'thing', lineId: `line-${name}`, name, arrived: 1, now: null, who: { kind: 'gm' }, at, takenBack: null, ...o });
  const coinOf = (): FindEntry => ({ kind: 'coin', purseId: 'purse-wren', coins: { heron: 240, reed: 3 }, who: { kind: 'gm' }, at, takenBack: null });

  // Purpose: with nothing new the count is 0, so no badge is drawn.
  it('is 0 with nothing new', () => {
    expect(findsCount([])).toBe(0);
  });

  // Purpose: one thing counts as 1.
  it('counts one thing as 1', () => {
    expect(findsCount([thingOf('Bronze ring')])).toBe(1);
  });

  // Purpose: a stack counts as one thing, however many arrived or it now holds.
  it('counts a stack as one', () => {
    expect(findsCount([thingOf('River pearls', { arrived: 12, now: 20 })])).toBe(1);
  });

  // Purpose: coin and things together: all the coin is one, each thing one.
  it('counts coin as one beside the things', () => {
    expect(findsCount([coinOf(), thingOf('Bronze ring'), thingOf('Moon opals', { arrived: 3 })])).toBe(3);
  });

  // Purpose: a find taken back is not counted, and when every find is taken back the count is 0.
  it('leaves out a find taken back', () => {
    const back = { byGm: true, at };
    expect(findsCount([thingOf('Bronze ring', { takenBack: back }), thingOf('Silver key'), coinOf()])).toBe(2);
    expect(findsCount([thingOf('Bronze ring', { takenBack: back })])).toBe(0);
  });

  // Purpose: a tap the server answers without a time says "Couldn't mark these as seen." and no more (p45-24).
  it('says "Couldn’t mark these as seen." when the mark comes back empty', async () => {
    vi.spyOn(world.db, 'rpc').mockResolvedValueOnce({ data: null, error: null } as never);
    const done = await mark(sam, wren);
    expect(done).toMatchObject({ ok: false, reason: 'failed', message: "Couldn't mark these as seen." });
    vi.restoreAllMocks();
  });
});
