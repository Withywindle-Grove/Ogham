// Who put each thing in the party stash and when, and its last in and last out (K14, pk-4), read from the log.
// Invented names: Ash, Tam and their players, a reed chest, torches, moon opals, the Reed rules' clock.
import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import type { LogEvent } from '../../core/events.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import type { TimeUnits } from '../expedition/clock.ts';
import { moveItem, type CarrierRef } from './inventory.ts';
import { loadStashHistory, stashHistory, whenWords, whoWords, type StashContext } from './stashHistory.ts';

const STASH = 'stash-1';
const GM = 'user-gm';
const ASH = 'actor-ash';
const TAM = 'actor-tam';
/** A day of 24 hours, an hour of 3600 seconds, a turn of 600. */
const units: TimeUnits = { round: 10, turn: 600, hour: 3600, day: 86400 } as TimeUnits;
const DAY = 86400;

let seq = 0;
/** One log event on an inventory line (or another table), in order. */
const ev = (part: Partial<LogEvent> & { targetId: string | null }): LogEvent => {
  seq += 1;
  return {
    id: `event-${seq}`,
    seq,
    type: 'inventory.move',
    level: 'simple',
    actorUserId: 'user-ash',
    targetTable: 'inventory_lines',
    before: null,
    after: null,
    fiat: false,
    reason: null,
    revertsEventId: null,
    requestId: null,
    createdAt: '2026-11-14T10:00:00.000Z',
    ...part,
  };
};
/** The clock moved to `seconds` (from `from`). */
const clock = (from: number, to: number): LogEvent => ev({ targetTable: 'campaign_clocks', targetId: 'clock-1', type: 'time.advance', before: { seconds: from }, after: { seconds: to } });
const ctx = (over: Partial<StashContext> = {}): StashContext => ({
  stashId: STASH,
  lineIds: [],
  gmUserIds: new Set([GM]),
  clock: { seconds: 2 * DAY + 100, units },
  now: '2026-11-14T12:00:00.000Z',
  ...over,
});
const names = new Map([[ASH, 'Ash'], [TAM, 'Tam']]);

describe('in and out (pk-4)', () => {
  // Purpose: the stash's recent lines (K11) read every move in and out, oldest first, each with the event that made it
  // (for its Undo) and the person who did it (whose own line keeps Undo).
  it('lists every move, oldest first, with its event and the person who did it', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-chest', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-chest', actorUserId: 'user-tam', before: { actor_id: null, location_id: STASH }, after: { actor_id: TAM, location_id: null } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: [] }));
    expect(h.moves.map((m) => [m.direction, m.eventId, m.userId])).toEqual([
      ['in', 'event-1', 'user-ash'],
      ['out', 'event-2', 'user-tam'],
    ]);
  });

  // Purpose: a Put in (a line made straight on the stash, inventory.add) may not be undone from Recently, by the log's
  // own Undo rule; a take (inventory.move), whole or part, may (review of #66, finding 1).
  it('a Put in is not undoable; a take, whole or part, is', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-basket', type: 'inventory.add', requestId: 'req-1', before: null, after: { id: 'line-basket', actor_id: null, location_id: STASH, name: 'Reed basket', qty: 1 } }),
      ev({ targetId: 'line-chest', before: { actor_id: null, location_id: STASH }, after: { actor_id: TAM, location_id: null } }),
      ev({ targetId: 'line-part', requestId: 'req-3', before: null, after: { id: 'line-part', actor_id: null, location_id: STASH, name: 'Torches', qty: 2 } }),
      ev({ targetId: 'line-part', requestId: 'req-3', before: { actor_id: null, location_id: STASH }, after: { actor_id: TAM, location_id: null } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-basket'] }));
    expect(h.moves.map((m) => [m.lineId, m.direction, m.type, m.undoable])).toEqual([
      ['line-basket', 'in', 'inventory.add', false],
      ['line-chest', 'out', 'inventory.move', true],
      ['line-part', 'out', 'inventory.move', true],
    ]);
  });

  // Purpose: a thing moved from a character into the stash reads who put it in (that character) and when, on its row
  // and as the stash's last thing in.
  it('a thing put in reads who and when, on its row and as the last in', () => {
    seq = 0;
    const events = [ev({ targetId: 'line-chest', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } })];
    const h = stashHistory(events, ctx({ lineIds: ['line-chest'] }));
    expect(whoWords(h.rows.get('line-chest')!.who, names)).toBe('Ash');
    expect(h.lastIn).toMatchObject({ lineId: 'line-chest', direction: 'in' });
    expect(h.lastOut).toBeNull();
  });

  // Purpose: a thing taken out reads who took it (the character it went to) as the stash's last thing out, and no longer has a row.
  it('a thing taken out is the last out, with the taker, and has no row', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-torch', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-torch', actorUserId: 'user-tam', before: { actor_id: null, location_id: STASH }, after: { actor_id: TAM, location_id: null } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: [] }));
    expect(whoWords(h.lastOut!.who, names)).toBe('Tam');
    expect(h.lastIn?.lineId).toBe('line-torch');
    expect(h.rows.size).toBe(0);
  });

  // Purpose: a partial take from a stack (the part split off on the stash, then moved to a character) is an "out" of
  // that many; the split itself is not an "in", and the stack's own row keeps its put-in.
  it('a partial take is an out of that many, never an in', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-torches', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-part', actorUserId: 'user-tam', requestId: 'req-2', before: null, after: { id: 'line-part', actor_id: null, location_id: STASH, name: 'Torches', qty: 2 } }),
      ev({ targetId: 'line-part', actorUserId: 'user-tam', requestId: 'req-2', before: { actor_id: null, location_id: STASH }, after: { actor_id: TAM, location_id: null } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-torches'] }));
    expect(h.lastOut).toMatchObject({ lineId: 'line-part', qty: 2, name: 'Torches' });
    expect(whoWords(h.lastOut!.who, names)).toBe('Tam');
    expect(h.lastIn?.lineId).toBe('line-torches');
    expect(whoWords(h.rows.get('line-torches')!.who, names)).toBe('Ash');
  });

  // Purpose: a part split off a character's stack and put in counts as an "in" of that many.
  it('a part of a stack put in is an in of that many', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-half', requestId: 'req-1', before: null, after: { id: 'line-half', actor_id: ASH, location_id: null, name: 'Moon opals', qty: 2 } }),
      ev({ targetId: 'line-half', requestId: 'req-1', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
    ];
    expect(stashHistory(events, ctx({ lineIds: ['line-half'] })).rows.get('line-half')).toMatchObject({ qty: 2, name: 'Moon opals', direction: 'in' });
  });

  // Purpose: an undone move counts for nothing, nor does the undo itself: the row keeps the put-in before it.
  it('an undone move counts for nothing', () => {
    seq = 0;
    const first = ev({ targetId: 'line-chest', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } });
    const take = ev({ targetId: 'line-chest', actorUserId: 'user-tam', before: { actor_id: null, location_id: STASH }, after: { actor_id: TAM, location_id: null } });
    const undo = ev({ targetId: 'line-chest', actorUserId: 'user-tam', revertsEventId: take.id, before: { actor_id: TAM, location_id: null }, after: { actor_id: null, location_id: STASH } });
    const h = stashHistory([first, take, undo], ctx({ lineIds: ['line-chest'] }));
    expect(h.lastOut).toBeNull();
    expect(h.rows.get('line-chest')?.seq).toBe(first.seq);
  });

  // Purpose: what the GM did reads "Your GM", whoever's pack it came from; a line the GM made straight on the stash is an in.
  it('the GM reads "Your GM"', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-opals', actorUserId: GM, before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-ewer', actorUserId: GM, type: 'inventory.add', before: null, after: { id: 'line-ewer', actor_id: null, location_id: STASH, name: 'Silver ewer', qty: 1 } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-opals', 'line-ewer'] }));
    expect(whoWords(h.rows.get('line-opals')!.who, names)).toBe('Your GM');
    expect(whoWords(h.rows.get('line-ewer')!.who, names)).toBe('Your GM');
    expect(h.lastIn).toMatchObject({ lineId: 'line-ewer', name: 'Silver ewer' });
  });

  // Purpose: coin counts toward neither fact: its own table's changes are not moves.
  it('coin counts toward neither fact', () => {
    seq = 0;
    const events = [ev({ targetTable: 'purses', targetId: 'purse-stash', type: 'purse.give', before: { coins: {} }, after: { location_id: STASH, coins: { heron: 40 } } })];
    expect(stashHistory(events, ctx())).toEqual({ rows: new Map(), lastIn: null, lastOut: null, moves: [] });
  });

  // Purpose: a thing that left play straight from the stash (dropped, used up) has no row, and IS the stash's last out,
  // with who did it (the lead's answer 3, 2026-11-14): the GM reads "Your GM"; a player's character the log can't name.
  it('a thing that left play has no row and is the last out, with who did it', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-oil', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-oil', type: 'inventory.remove', actorUserId: GM, before: { id: 'line-oil', actor_id: null, location_id: STASH, name: 'Lamp oil', qty: 3 }, after: null }),
    ];
    const h = stashHistory(events, ctx({ lineIds: [] }));
    expect(h.rows.size).toBe(0);
    expect(h.lastOut).toMatchObject({ lineId: 'line-oil', direction: 'out', leftPlay: true, name: 'Lamp oil', qty: 3 });
    expect(whoWords(h.lastOut!.who, names)).toBe('Your GM');
    const [put, drop] = events as [LogEvent, LogEvent];
    const byPlayer = stashHistory([put, { ...drop, actorUserId: 'user-tam' }], ctx({ lineIds: [] }));
    expect(byPlayer.lastOut).toMatchObject({ leftPlay: true, who: { gm: false, characterId: null } });
    expect(whoWords(byPlayer.lastOut!.who, names)).toBeNull();
  });

  // Purpose: one of a stack on the stash used up (counted down, the line stays) is a last out of 1, and the line keeps
  // its row from its put-in.
  it('one used up from a stack on the stash is a last out of 1', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-oil', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-oil', type: 'item.use', actorUserId: GM, before: { qty: 3 }, after: { qty: 2 } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-oil'] }));
    expect(h.lastOut).toMatchObject({ lineId: 'line-oil', leftPlay: true, qty: 1 });
    expect(h.rows.get('line-oil')).toMatchObject({ direction: 'in', who: { gm: false, characterId: ASH } });
  });

  // Purpose: part of a stack given away outside the party from the stash (split off, then removed, in one request) is
  // an out of that many, never an in.
  it('part of a stack given away from the stash is an out of that many, never an in', () => {
    seq = 0;
    const r = 'request-give';
    const events = [
      ev({ targetId: 'line-oil', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-oil', requestId: r, type: 'inventory.giveAway', before: { qty: 5 }, after: { qty: 3 } }),
      ev({ targetId: 'line-part', requestId: r, type: 'inventory.giveAway', before: null, after: { id: 'line-part', actor_id: null, location_id: STASH, name: 'Lamp oil', qty: 2 } }),
      ev({ targetId: 'line-part', requestId: r, type: 'inventory.giveAway', before: { given_to: null }, after: { given_to: 'the ferryman' } }),
      ev({ targetId: 'line-part', requestId: r, type: 'inventory.giveAway', before: { id: 'line-part', actor_id: null, location_id: STASH, name: 'Lamp oil', qty: 2, given_to: 'the ferryman' }, after: null }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-oil'] }));
    expect(h.lastIn).toMatchObject({ lineId: 'line-oil' });
    expect(h.lastOut).toMatchObject({ lineId: 'line-part', leftPlay: true, qty: 2, name: 'Lamp oil' });
  });

  // Purpose: a thing that left play from a character's pack, never the stash, counts toward neither fact.
  it('a thing that left play from a pack is not the stash’s last out', () => {
    seq = 0;
    const events = [ev({ targetId: 'line-rope', type: 'inventory.remove', before: { id: 'line-rope', actor_id: ASH, location_id: null, name: 'Reed rope', qty: 1 }, after: null })];
    expect(stashHistory(events, ctx()).lastOut).toBeNull();
  });

  // Purpose: an undone drop from the stash counts for nothing (the thing is back).
  it('an undone drop from the stash is not the last out', () => {
    seq = 0;
    const drop = ev({ targetId: 'line-oil', type: 'inventory.remove', before: { id: 'line-oil', actor_id: null, location_id: STASH, name: 'Lamp oil', qty: 1 }, after: null });
    const undo = ev({ targetId: 'line-oil', type: 'event.undo', revertsEventId: drop.id, before: null, after: { id: 'line-oil', actor_id: null, location_id: STASH, name: 'Lamp oil', qty: 1 } });
    expect(stashHistory([drop, undo], ctx({ lineIds: ['line-oil'] })).lastOut).toBeNull();
  });
});

describe('when: "today" and "day N"', () => {
  // Purpose: "when" is the campaign's day from the clock's changes in the log: a put-in on day 2, the clock now on day
  // 3, reads "day 2"; one on the clock's current day reads "today".
  it('reads "day 2" and "today" from the clock in the log', () => {
    seq = 0;
    const events = [
      clock(0, DAY + 600),
      ev({ targetId: 'line-reeds', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      clock(DAY + 600, 2 * DAY + 100),
      ev({ targetId: 'line-ewer', before: { actor_id: TAM, location_id: null }, after: { actor_id: null, location_id: STASH } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-reeds', 'line-ewer'] }));
    expect(whenWords(h.rows.get('line-reeds')!.when)).toBe('day 2');
    expect(whenWords(h.rows.get('line-ewer')!.when)).toBe('today');
  });

  // Purpose: before the clock's first change in the log, the day is the clock's reading before that change.
  it('reads the day before the first clock change from that change', () => {
    seq = 0;
    const events = [ev({ targetId: 'line-reeds', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }), clock(0, 2 * DAY + 100)];
    expect(whenWords(stashHistory(events, ctx({ lineIds: ['line-reeds'] })).rows.get('line-reeds')!.when)).toBe('day 1');
  });

  // Purpose: without a clock, "when" is the event's date: "today" on the same date, else the date.
  it('falls back to the date without a clock', () => {
    seq = 0;
    const events = [
      ev({ targetId: 'line-a', createdAt: '2026-11-14T08:00:00.000Z', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
      ev({ targetId: 'line-b', createdAt: '2026-11-02T08:00:00.000Z', before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
    ];
    const h = stashHistory(events, ctx({ lineIds: ['line-a', 'line-b'], clock: null }));
    expect(whenWords(h.rows.get('line-a')!.when)).toBe('today');
    expect(h.rows.get('line-b')!.when).toMatchObject({ day: null, today: false });
    expect(whenWords(h.rows.get('line-b')!.when)).not.toMatch(/today|day/);
  });

  // Purpose: the date fallback reads the same on every device, the day then the month ("2 Nov"), whatever the device's
  // language. (Midday, so the reader's own calendar day is the 2nd in any time zone the table plays in.)
  it('gives the date in one form, the day then the month', () => {
    expect(whenWords({ day: null, date: '2026-11-02T12:00:00.000Z', today: false })).toBe('2 Nov');
  });
});

describe('the read, page by page', () => {
  // Purpose: the database sends at most 1,000 rows a request, so a long log must be read page by page: with 2,500
  // lines, the newest put-in (past the first page) is still the stash's last in, and its row's put-in.
  it('reads past the database’s 1,000-row limit', async () => {
    seq = 0;
    const log = Array.from({ length: 2500 }, (_, i) =>
      ev({ targetId: `line-${i}`, before: { actor_id: ASH, location_id: null }, after: { actor_id: null, location_id: STASH } }),
    );
    const asked: [number, number][] = [];
    /** A stand-in for the API that, like the real one, sends at most 1,000 rows a request. */
    const query = (rows: Record<string, unknown>[]) => {
      let range: [number, number] = [0, 999];
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        range: (from: number, to: number) => {
          asked.push([from, to]);
          range = [from, to];
          return q;
        },
        then: (done: (r: { data: Record<string, unknown>[]; error: null }) => unknown) =>
          Promise.resolve({ data: rows.slice(range[0], Math.min(range[1] + 1, range[0] + 1000)), error: null }).then(done),
      };
      return q;
    };
    const rows = log.map((e) => ({ id: e.id, seq: e.seq, type: e.type, level: 'simple', actor_user_id: e.actorUserId, target_table: e.targetTable, target_id: e.targetId, before: e.before, after: e.after, fiat: false, reason: null, reverts_event_id: null, request_id: null, created_at: e.createdAt }));
    const db = { from: (table: string) => query(table === 'events' ? rows : [{ user_id: GM, base_role: 'gm' }]) } as unknown as Parameters<typeof loadStashHistory>[0];
    const h = await loadStashHistory(db, 'campaign-1', { stashId: STASH, lineIds: ['line-2499'], clock: null, now: '2026-11-14T12:00:00.000Z' });
    expect(asked.length).toBeGreaterThan(2);
    expect(h?.lastIn).toMatchObject({ lineId: 'line-2499' });
    expect(h?.rows.get('line-2499')).toMatchObject({ who: { gm: false, characterId: ASH } });
  });
});

describe('through the stand-in database, as a player', () => {
  /** A GM, two players (Ash's and Tam's), an approved character each, the stash, and a stack of torches on Ash. */
  const setUp = () => {
    const world = createFakeDb();
    const gmId = world.addPerson('gm@reeds.example', 'Moss');
    const ashPlayer = world.addPerson('ash@reeds.example', 'Ash’s player');
    const tamPlayer = world.addPerson('tam@reeds.example', 'Tam’s player');
    const campaign = world.addCampaign('The Reed Marches', gmId);
    world.addMember(campaign, ashPlayer, 'player');
    world.addMember(campaign, tamPlayer, 'player');
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: ashPlayer });
    const tam = world.addCharacter(campaign, 'Tam', { ownerId: tamPlayer });
    const stash = world.tables.locations.find((l) => l.campaign_id === campaign && l.kind === 'stash')!.id as string;
    world.tables.inventory_lines.push({ id: 'line-torches', campaign_id: campaign, actor_id: ash, location_id: null, container_line_id: null, name: 'Torches', category: 'gear', qty: 6, stack: 1, approval: 'approved', item_data: {}, source_entry_id: null, version: 1, how_got: 'bought' });
    const carrier = (actorId: string | null, owner: string | null): CarrierRef => ({ campaignId: campaign, actorId, locationId: actorId ? null : stash, ownerUserId: owner, archived: false });
    const as = (id: string): CurrentUser => ({ id, roles: { [campaign]: 'player' } });
    return { world, campaign, stash, ash, tam, ashPlayer, tamPlayer, carrier, as };
  };

  // Purpose: run through the stand-in database as a player, the loader reads the log as that player may (its read rule),
  // and finds Ash's put-in and Tam's partial take, with the campaign's GMs from the members it already reads.
  it('reads the put-in and a partial take, as another player', async () => {
    const { world, campaign, stash, ash, tam, ashPlayer, tamPlayer, carrier, as } = setUp();
    world.signInAs(ashPlayer);
    const put = await moveItem.run(world.db, as(ashPlayer), { line: { id: 'line-torches', carrier: carrier(ash, ashPlayer) }, to: carrier(null, null), qty: 6, of: 6 });
    expect(put.ok).toBe(true);
    world.signInAs(tamPlayer);
    const take = await moveItem.run(world.db, as(tamPlayer), { line: { id: 'line-torches', carrier: carrier(null, null) }, to: carrier(tam, tamPlayer), qty: 2, of: 6 });
    expect(take.ok).toBe(true);

    const h = await loadStashHistory(world.db, campaign, { stashId: stash, lineIds: ['line-torches'], clock: null, now: new Date().toISOString() });
    expect(h).not.toBeNull();
    expect(whoWords(h!.rows.get('line-torches')!.who, new Map([[ash, 'Ash'], [tam, 'Tam']]))).toBe('Ash');
    expect(h!.lastOut).toMatchObject({ qty: 2, name: 'Torches' });
    expect(whoWords(h!.lastOut!.who, new Map([[tam, 'Tam']]))).toBe('Tam');
  });

  // Purpose: a player reads nothing they couldn't already read: what the loader finds is exactly what that player's
  // own read of the log gives, and a line the log keeps from them (here a GM-only one) never reaches the history.
  it('a player reads nothing the log keeps from them', async () => {
    const { world, campaign, stash, ash, ashPlayer, tamPlayer, carrier, as } = setUp();
    world.signInAs(ashPlayer);
    expect((await moveItem.run(world.db, as(ashPlayer), { line: { id: 'line-torches', carrier: carrier(ash, ashPlayer) }, to: carrier(null, null), qty: 6, of: 6 })).ok).toBe(true);
    // A line of the log the players may not read, about the stash: only the GM sees it.
    const moved = world.tables.events.find((e) => e.target_table === 'inventory_lines' && e.target_id === 'line-torches')!;
    moved.audience = 'gm';
    world.signInAs(tamPlayer);
    const own = await world.db.from('events').select('id').eq('campaign_id', campaign).in('target_table', ['inventory_lines']);
    expect(own.data).toEqual([]);
    const h = await loadStashHistory(world.db, campaign, { stashId: stash, lineIds: ['line-torches'], clock: null, now: new Date().toISOString() });
    expect(h).toEqual({ rows: new Map(), lastIn: null, lastOut: null, moves: [] });
  });
});
