// dec5-gaps piece E (#189; G-228, dg-11, dg-12, dg-16): a send can come from a person. The send's held key, what the
// GM's log says was given away, and the GM's log line "You gave Wren the iron key (Mother Sedge's)." The database's own
// case (seam 4) is supabase/tests/dec5-e-held-send.test.ts. Invented names only (Mother Sedge, The Quay, Wren).
//   Purpose:
//   1. A held key names the person's pack id and the item's bare id (an itemRef loses its pack), and reads back; an id
//      that isn't a pack id makes no key, and a hoard row's key isn't a held one.
//   2. Read from the GM's log at every place: each held key sent, to whom, where and by which send; the latest send of
//      a key wins, an undone send (Take it back) marks nothing, and a hoard's rows aren't held things.
//   3. The GM's log line names the receiver, the thing and whose it was; the party's line is today's, naming neither the
//      person nor where it came from; an unknown person is never printed by id.
//   4. Through the stand-in database: the GM sends a held thing, a player's log never reads the key or the person, the
//      GM's log reads the ruled line, and the send's Undo takes it back so it is no longer marked sent.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames, type LogEvent, type LogNames } from '../../core/events.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { giveFind, heldKey, heldOfKey, sentHeld, sentRows, undoFind } from './findSend.ts';

const registry = createAppRegistry();

describe('1. a held thing’s key', () => {
  // Purpose: the key names the person's pack id and the item's bare id, and reads back to both.
  it('names the person and the bare item, and reads back', () => {
    expect(heldKey('mother-sedge', 'iron-key')).toBe('held:mother-sedge:iron-key');
    expect(heldKey('mother-sedge', 'river-rules:rope-50ft')).toBe('held:mother-sedge:rope-50ft');
    expect(heldOfKey('held:mother-sedge:iron-key')).toEqual({ personId: 'mother-sedge', itemId: 'iron-key' });
  });

  // Purpose: an id that isn't a pack id makes no key (the server would refuse it), and a hoard row's key isn't held.
  it('makes no key from an id that is not a pack id, and reads no hoard row as held', () => {
    expect(heldKey('Mother Sedge', 'iron-key')).toBeNull();
    expect(heldKey('mother-sedge', '')).toBeNull();
    expect(heldKey('x'.repeat(81), 'iron-key')).toBeNull();
    expect(heldOfKey('2:thing')).toBeNull();
    expect(heldOfKey('held:mother-sedge')).toBeNull();
    expect(heldOfKey('held:mother-sedge:iron-key:more')).toBeNull();
  });
});

describe('2. what the GM’s log says she gave away (dg-12)', () => {
  const event = (id: string, request: string, reason: Record<string, unknown> | null, extra: Partial<LogEvent> = {}): LogEvent => ({
    id, seq: Number(id.replace(/\D/g, '')), type: 'find.give', level: 'simple', actorUserId: 'gm', targetTable: 'places', targetId: 'quay', before: null, after: {}, fiat: false,
    reason: reason ? JSON.stringify(reason) : null, revertsEventId: null, requestId: request, createdAt: '2026-11-28T10:00:00Z', ...extra,
  });

  // Purpose: every place's sends count; the latest send of a key wins; a send taken back marks nothing; a hoard's rows
  // and a player's lines (no place, no rows) are not held things.
  it('marks each held key sent, at any place, the latest send winning and a send taken back left out', () => {
    const events = [
      event('e1', 'r1', { find: { to: 'wren', placeId: 'quay', rows: ['held:mother-sedge:iron-key'] } }),
      event('e2', 'r2', { find: { to: 'wren', placeId: 'quay', rows: ['held:mother-sedge:wardens-lantern'] } }),
      event('e3', 'r3', { find: { to: null, placeId: 'mill', rows: ['held:mother-sedge:iron-key'] } }),
      event('e4', 'r4', { find: { to: 'ash', placeId: 'mill', rows: ['held:mother-sedge:rum-bottle'] } }),
      event('e5', 'r5', null, { type: 'find.undo', revertsEventId: 'e4', after: null }),
      event('e6', 'r6', { find: { to: 'ash', placeId: 'quay', rows: ['2:thing'] } }),
      event('e7', 'r7', { find: { to: 'wren' } }, { targetTable: 'inventory_lines' }),
    ];
    expect(Object.fromEntries(sentHeld(events))).toEqual({
      'held:mother-sedge:iron-key': { to: null, placeId: 'mill', eventId: 'e3', seq: 3 },
      'held:mother-sedge:wardens-lantern': { to: 'wren', placeId: 'quay', eventId: 'e2', seq: 2 },
    });
    // A place's hoard marks are unchanged by the held keys beside them: no held key among them.
    expect([...sentRows(events, 'quay').keys()]).toEqual(['2:thing']);
    expect(sentHeld([]).size).toBe(0);
  });
});

describe('3. the log’s words for a held send (dg-16)', () => {
  const gmNames: LogNames = {
    me: 'user-priya',
    people: new Map([['user-priya', 'Priya'], ['user-sam', 'Sam']]),
    characters: new Map([['actor-wren', 'Wren']]),
    companies: new Map(),
    fields: new Map(),
    packs: new Map(),
    items: new Map(),
    places: new Map([['place-stash', 'Party stash']]),
    stashIds: new Set(['place-stash']),
    placeNames: new Map([['place-quay', 'The Quay']]),
    gms: new Set(['user-priya']),
    heldPeople: new Map([['mother-sedge', 'Mother Sedge']]),
  };
  const playerNames: LogNames = { ...gmNames, me: 'user-sam', placeNames: new Map(), heldPeople: undefined };
  let seq = 0;
  const line = (extra: Partial<LogEvent>): LogEvent => {
    seq += 1;
    return {
      id: `event-${seq}`, seq, type: 'find.give', level: 'simple', actorUserId: 'user-priya', targetTable: 'inventory_lines', targetId: `line-${seq}`,
      before: null, after: null, fiat: false, reason: null, revertsEventId: null, requestId: `request-${seq}`, createdAt: '2026-11-28T18:30:00Z', ...extra,
    };
  };
  /** One held send as public.give_find writes it: the party's line (to whom only) and the GM's line (place, key). */
  const heldSend = (to: string | null, thing: Record<string, unknown>, key = 'held:mother-sedge:iron-key') => {
    const party = line({ after: { actor_id: to, location_id: to ? null : 'place-stash', ...thing }, reason: JSON.stringify({ find: { to } }) });
    const gm = line({ targetTable: 'places', targetId: 'place-quay', after: { learned: [] }, reason: JSON.stringify({ find: { to, placeId: 'place-quay', rows: [key] } }), requestId: party.requestId });
    return { party, gm };
  };
  const say = (events: LogEvent[], names: LogNames) => describeEntry(groupEntries(events)[0]!, names);

  // Purpose: the GM's log reads the ruled line, naming the receiver, the thing and whose it was.
  it('reads "You gave Wren the iron key (Mother Sedge’s)." on the GM’s log', () => {
    const { party, gm } = heldSend('actor-wren', { name: 'iron key', qty: 1 });
    expect(say([party, gm], gmNames)).toBe('You gave Wren the iron key (Mother Sedge’s).');
  });

  // Purpose: a player's log reads today's line for the party, naming neither the person nor where it came from.
  it('reads today’s line on a player’s log, with no person and no place', () => {
    const { party } = heldSend('actor-wren', { name: 'iron key', qty: 1 });
    const words = say([party], playerNames);
    expect(words).toBe('Your GM gave Wren iron key.');
    expect(words).not.toContain('Sedge');
    expect(words).not.toContain('Quay');
  });

  // Purpose: to the party stash, and a count of more than one sent whole, read in the same words.
  it('reads the party stash, and a count, in the same words', () => {
    const toStash = heldSend(null, { name: 'iron key', qty: 1 });
    expect(say([toStash.party, toStash.gm], gmNames)).toBe('You put the iron key (Mother Sedge’s) in the party stash.');
    const many = heldSend('actor-wren', { name: 'Rum bottle', qty: 999 }, 'held:mother-sedge:rum-bottle');
    expect(say([many.party, many.gm], gmNames)).toBe('You gave Wren Rum bottle ×999 (Mother Sedge’s).');
  });

  // Purpose: a person the GM's library doesn't have is never printed by id: the line reads as any send does.
  it('never prints an unknown person’s id', () => {
    const { party, gm } = heldSend('actor-wren', { name: 'iron key', qty: 1 }, 'held:old-tobin:iron-key');
    const words = say([party, gm], gmNames);
    expect(words).toBe('Your GM gave Wren iron key, at The Quay.');
    expect(words).not.toContain('tobin');
  });
});

describe('4. a held send through the stand-in database', () => {
  function table() {
    const world = createFakeDb();
    const gmId = world.addPerson('priya@quay.example', 'Priya');
    const samId = world.addPerson('sam@quay.example', 'Sam');
    const campaign = world.addCampaign('The Low Quay', gmId);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
    world.addMember(campaign, samId, 'player', wren);
    world.tables.places.push({ id: 'place-quay', campaign_id: campaign, name: 'The Quay', players_name: 'A quay', undone: false, version: 1 });
    const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
    const sam: CurrentUser = { id: samId, roles: { [campaign]: 'player' } };
    return { world, campaign, gm, sam, wren };
  }
  const read = async (t: ReturnType<typeof table>, user: CurrentUser, heldPeople?: Map<string, string>) => {
    t.world.signInAs(user.id);
    const log = await loadLog(t.world.db, t.campaign, { verbose: true });
    const names = { ...(await loadLogNames(t.world.db, t.campaign, user.id)), eventTypes: new Map(log!.events.map((e) => [e.id, e.type])), heldPeople };
    return { events: log!.events, lines: groupEntries(log!.events).map((entry) => describeEntry(entry, names)) };
  };

  // Purpose: the GM sends a held thing; a player never reads the key or the person; the GM reads the ruled line; the
  // send's Undo (Take it back) takes it back, and the log no longer marks it sent.
  it('sends, hides the person from a player, and takes it back', async () => {
    const t = table();
    const key = heldKey('mother-sedge', 'iron-key')!;
    t.world.signInAs(t.gm.id);
    const sent = await runCommand(registry, t.world.db, t.gm, giveFind, { campaignId: t.campaign, to: t.wren, placeId: 'place-quay', things: [{ name: 'iron key', qty: 1 }], coins: {}, rows: [key] });
    expect(sent.ok).toBe(true);
    const player = await read(t, t.sam);
    expect(JSON.stringify(player.events)).not.toContain('held:');
    expect(JSON.stringify(player.events)).not.toContain('mother-sedge');
    expect(player.lines[0]).toBe('Your GM gave Wren iron key.');
    const gm = await read(t, t.gm, new Map([['mother-sedge', 'Mother Sedge']]));
    expect(gm.lines[0]).toBe('You gave Wren the iron key (Mother Sedge’s).');
    expect(sentHeld(gm.events).get(key)).toMatchObject({ to: t.wren, placeId: 'place-quay' });
    if (!sent.ok) return;
    t.world.signInAs(t.gm.id);
    expect((await runCommand(registry, t.world.db, t.gm, undoFind, { campaignId: t.campaign, eventId: sent.value.eventId })).ok).toBe(true);
    expect(t.world.tables.inventory_lines.some((l) => l.actor_id === t.wren && l.name === 'iron key')).toBe(false);
    expect(sentHeld((await read(t, t.gm)).events).has(key)).toBe(false);
  });

  // Purpose: a key that isn't a held key's shape is refused, as the server refuses it.
  it('refuses a key of the wrong shape', async () => {
    const t = table();
    t.world.signInAs(t.gm.id);
    const sent = await runCommand(registry, t.world.db, t.gm, giveFind, { campaignId: t.campaign, to: t.wren, placeId: 'place-quay', things: [{ name: 'iron key', qty: 1 }], coins: {}, rows: ['held:Mother Sedge:iron-key'] });
    expect(sent.ok).toBe(false);
  });
});
