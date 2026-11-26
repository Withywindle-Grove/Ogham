// K16b, the GM sends a find (pk-12, pk-1, pk-2, pu-9): the command and its Undo through the stand-in database (it
// mirrors supabase/migrations/20261115090000_dec_6_k16b_send_find.sql; the real rules are tested in
// supabase/tests/dec-6-k16b-send-find.test.ts), what a hoard's rows send, and "Sent to <Name>" read from the log.
// Invented coins (herons, bits), items and places only.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames, type LogEvent } from '../../core/events.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import type { HoardRow } from './hoard.ts';
import { giveFind, NOT_NAMED_WORDS, rowKey, sendOf, sentRows, undoFind } from './findSend.ts';

const registry = createAppRegistry();

/** A campaign with the GM (Priya), Sam (Wren) and Tam (Ash), herons and bits for coin, a moon opal, and a place. */
function table() {
  const world = createFakeDb();
  const gmId = world.addPerson('priya@lantern.example', 'Priya');
  const samId = world.addPerson('sam@lantern.example', 'Sam');
  const tamId = world.addPerson('tam@lantern.example', 'Tam');
  const campaign = world.addCampaign('The Sunken Tithe', gmId);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: tamId });
  world.addMember(campaign, samId, 'player', wren);
  world.addMember(campaign, tamId, 'player', ash);
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gmId, campaign_id: null, name: 'Reed rules', version: '0.1', kind: 'setting' });
  world.tables.library_entries.push(
    { id: 'entry-rules', pack_id: 'pack-reed', kind: 'rulesSet', pack_entry_id: 'reed-rules', name: 'Reed rules', data: { currency: [{ key: 'heron', label: 'herons', valueInBase: 1 }, { key: 'bit', label: 'bits', valueInBase: 10 }] } },
    { id: 'entry-opal', pack_id: 'pack-reed', kind: 'item', pack_entry_id: 'moon-opal', name: 'Moon opal', data: { id: 'moon-opal', name: 'Moon opal', category: 'gem', stack: 10 } },
  );
  world.tables.campaign_packs.push({ id: 'link-reed', campaign_id: campaign, pack_id: 'pack-reed', priority: 1, option_choices: {} });
  world.tables.places.push({ id: 'place-stair', campaign_id: campaign, name: 'The Reed Stair', players_name: 'A stair', undone: false, version: 1 });
  const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
  const sam: CurrentUser = { id: samId, roles: { [campaign]: 'player' } };
  const tam: CurrentUser = { id: tamId, roles: { [campaign]: 'player' } };
  return { world, campaign, gm, sam, tam, wren, ash };
}
type Table = ReturnType<typeof table>;
const linesOf = (t: Table, actorId: string) => t.world.tables.inventory_lines.filter((l) => l.actor_id === actorId).map((l) => [l.name, l.qty]);
const coinsOf = (t: Table, actorId: string) => t.world.tables.purses.find((p) => p.actor_id === actorId)?.coins ?? {};
const send = (t: Table, who: CurrentUser, to: string | null, coins: Record<string, number> = { heron: 40 }) => {
  t.world.signInAs(who.id);
  return runCommand(registry, t.world.db, who, giveFind, {
    campaignId: t.campaign, to, placeId: 'place-stair', things: [{ libraryEntryId: 'entry-opal', qty: 2 }, { name: 'A silver hook', qty: 1 }], coins, rows: ['0:coin', '1:thing', '2:thing'],
  });
};
/** The log as this person's device reads it, one line per action, in plain words. */
async function logLines(t: Table, user: CurrentUser): Promise<string[]> {
  t.world.signInAs(user.id);
  const log = await loadLog(t.world.db, t.campaign, { verbose: true });
  const names = { ...(await loadLogNames(t.world.db, t.campaign, user.id)), eventTypes: new Map(log!.events.map((e) => [e.id, e.type])) };
  return groupEntries(log!.events).map((entry) => describeEntry(entry, names));
}

describe('what a hoard sends (K16a rows to K16b)', () => {
  const rows: HoardRow[] = [
    { kind: 'coin', entry: 0, text: '40 herons', amounts: [{ key: 'heron', amount: 40, words: '40 herons' }], coins: { heron: 40 }, readAs: null, notCoins: [] },
    { kind: 'coin', entry: 1, text: '200 hn.', amounts: [{ key: 'heron', amount: 200, words: '200 herons' }], coins: { heron: 200 }, readAs: { printed: 'hn.', note: 'Read as herons.' }, notCoins: [] },
    { kind: 'thing', entry: 2, text: 'Two moon opals', itemId: 'moon-opal', worth: { heron: 30 }, qty: 1, magic: null, noticed: null },
    { kind: 'thing', entry: 3, text: 'A silver hook', itemId: null, worth: { heron: 5 }, qty: 1, magic: null, noticed: null },
  ];

  // Purpose: the rows chosen become one send: a known item by its library entry, a one-off by its words, every coin
  // row's coins added together (an odd coin word sends the coin it is read as), and each row named by its key.
  it('turns chosen rows into things, coins and row keys', () => {
    expect(sendOf(rows, new Map([['moon-opal', 'entry-opal']]))).toEqual({
      things: [{ libraryEntryId: 'entry-opal', qty: 1 }, { name: 'A silver hook', qty: 1 }],
      coins: { heron: 240 },
      rows: ['0:coin', '1:coin', '2:thing', '3:thing'],
    });
    expect(rows.map(rowKey)).toEqual(['0:coin', '1:coin', '2:thing', '3:thing']);
  });

  // Purpose: a known item whose library entry isn't on this device goes as a one-off by its words, never dropped.
  it('sends an item it cannot place as a one-off by its words', () => {
    expect(sendOf([rows[2]!], new Map()).things).toEqual([{ name: 'Two moon opals', qty: 1 }]);
  });
});

describe('"Sent to <Name>", read from the log', () => {
  const event = (id: string, request: string, reason: Record<string, unknown> | null, extra: Partial<LogEvent> = {}): LogEvent => ({
    id, seq: Number(id.replace(/\D/g, '')), type: 'find.give', level: 'simple', actorUserId: 'gm', targetTable: 'inventory_lines', targetId: `line-${id}`, before: null, after: {}, fiat: false,
    reason: reason ? JSON.stringify(reason) : null, revertsEventId: null, requestId: request, createdAt: '2026-11-15T10:00:00Z', ...extra,
  });

  // Purpose: each row a send names reads as sent to its character (or the stash), for this place only; a later send of
  // the same row wins; a send that was undone, and another place's send, mark nothing.
  it('marks each row sent, by place, the latest send winning and an undone send left out', () => {
    const events = [
      event('e1', 'r1', { find: { to: 'wren', placeId: 'stair', rows: ['0:coin', '2:thing'] } }),
      event('e2', 'r2', { find: { to: null, placeId: 'stair', rows: ['3:thing'] } }),
      event('e3', 'r3', { find: { to: 'ash', placeId: 'stair', rows: ['2:thing'] } }),
      event('e4', 'r4', { find: { to: 'ash', placeId: 'weir', rows: ['0:coin'] } }),
      event('e5', 'r5', { find: { to: 'ash', placeId: 'stair', rows: ['1:coin'] } }),
      event('e6', 'r6', null, { type: 'find.undo', revertsEventId: 'e5', after: null }),
      event('e7', 'r7', { find: { to: 'wren', placeId: 'stair' } }, { type: 'purse.add' }),
    ];
    expect(Object.fromEntries(sentRows(events, 'stair'))).toEqual({
      '0:coin': { to: 'wren', eventId: 'e1' },
      '2:thing': { to: 'ash', eventId: 'e3' },
      '3:thing': { to: null, eventId: 'e2' },
    });
    expect(sentRows([], 'stair').size).toBe(0);
  });
});

describe('the GM sends a find, through the stand-in database (pk-12)', () => {
  // Purpose: one action puts the things and the coin on the character, and the log reads it as one find, the amount
  // for the receiver's player and "coin" for another player, who reads no purse line.
  it('sends things and coin as one action, the amount only for those who read the purse', async () => {
    const t = table();
    const sent = await send(t, t.gm, t.wren);
    expect(sent.ok).toBe(true);
    expect(linesOf(t, t.wren)).toEqual([['Moon opal', 2], ['A silver hook', 1]]);
    expect(coinsOf(t, t.wren)).toEqual({ heron: 40 });
    const requests = new Set(t.world.tables.events.filter((e) => e.type === 'find.give').map((e) => e.request_id));
    expect(requests.size).toBe(1);
    // The place isn't shown to Sam's group, so the line names no place (K28).
    expect((await logLines(t, t.sam))[0]).toMatch(/^Your GM gave Wren .*Moon opal.*, A silver hook, 40 heron.*\.$/);
  });

  // Purpose: what another player reads of the send carries no amount, in its words or its stored lines.
  it("another player reads 'coin' and no amount", async () => {
    const t = table();
    await send(t, t.gm, t.wren, { heron: 77 });
    t.world.signInAs(t.tam.id);
    const log = await loadLog(t.world.db, t.campaign, { verbose: true });
    const mine = log!.events.filter((e) => e.type === 'find.give');
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((e) => e.targetTable === 'purses')).toBe(false);
    expect(JSON.stringify(mine)).not.toContain('"coins"');
    const line = (await logLines(t, t.tam))[0]!;
    expect(line).toContain('coin');
    expect(line).not.toContain('77');
  });

  // Purpose (rp-4): no player reads where a find was made or which hoard rows went; the GM reads both, and the log
  // names the place for the GM only.
  it("names the place and the rows on the GM's line alone", async () => {
    const t = table();
    await send(t, t.gm, t.wren);
    for (const player of [t.sam, t.tam]) {
      t.world.signInAs(player.id);
      const read = JSON.stringify((await loadLog(t.world.db, t.campaign, { verbose: true }))!.events);
      expect(read).not.toContain('place-stair');
      expect(read).not.toContain('"rows"');
      expect((await logLines(t, player))[0]).not.toContain('Reed Stair');
    }
    t.world.signInAs(t.gm.id);
    const gmEvents = (await loadLog(t.world.db, t.campaign, { verbose: true }))!.events;
    expect(Object.fromEntries(sentRows(gmEvents, 'place-stair'))).toMatchObject({ '1:thing': { to: t.wren } });
    expect((await logLines(t, t.gm))[0]).toMatch(/, at The Reed Stair\.$/);
  });

  // Purpose: the GM sends to the party stash.
  it('sends to the party stash', async () => {
    const t = table();
    expect((await send(t, t.gm, null, { bit: 3 })).ok).toBe(true);
    expect(t.world.tables.inventory_lines.filter((l) => l.location_id !== null).map((l) => l.name)).toEqual(['Moon opal', 'A silver hook']);
    expect(t.world.tables.purses.find((p) => p.location_id !== null)?.coins).toEqual({ bit: 3 });
  });

  // Purpose: a player can't send, and nothing is written.
  it("a player can't send", async () => {
    const t = table();
    const sent = await send(t, t.sam, t.wren);
    expect(sent.ok).toBe(false);
    expect(linesOf(t, t.wren)).toEqual([]);
  });

  // Purpose (the reviews of #1101): when the send worked but its magic item couldn't be named, the send still answers
  // ok with its log line (so the toast keeps its Undo) and says so, with plain words and no database message; a send
  // with nothing to name says nothing of it.
  it('answers ok with a warning when the item could not be named', async () => {
    const t = table();
    const plain = await send(t, t.gm, t.wren);
    expect(plain.ok && plain.value.notNamed).toBe(false);
    t.world.signInAs(t.gm.id);
    const sent = await runCommand(registry, t.world.db, t.gm, giveFind, {
      campaignId: t.campaign, to: t.wren, placeId: 'place-stair', things: [{ name: 'A silver hook', qty: 1 }], coins: {}, rows: ['2:thing'],
      named: [{ piece: 'piece-gone', thing: 0 }],
    });
    if (!sent.ok) throw new Error(sent.message);
    expect(sent.value.notNamed).toBe(true);
    expect(typeof sent.value.eventId).toBe('string');
    expect(linesOf(t, t.wren)).toContainEqual(['A silver hook', 1]);
    expect(NOT_NAMED_WORDS).toBe('The magic item arrived under its plain name. Tap its eye again.');
  });

  // Purpose (the local review of #10): a thing sent after its magic item's piece was revealed arrives named, even when
  // the piece was shown only to another group and hidden since, and the send shows the piece to nobody new; a thing
  // whose piece was never shown arrives plain, and the send says so.
  it('names a thing sent after the reveal, from any card, and shows nothing', async () => {
    const t = table();
    const piece = (id: string, lead: string) => ({ id, campaign_id: t.campaign, place_id: 'place-stair', kind: 'other', lead, body: 'It hums under water.', position: 9, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false });
    t.world.tables.place_pieces.push(piece('piece-hook', 'Hook of the Deep'), piece('piece-net', 'Net of the Shallows'));
    // Shown to group 2 once, then hidden: revealed.
    t.world.tables.piece_shows.push({ id: 'show-hook', campaign_id: t.campaign, group_place_id: 'visit-group-2', piece_id: 'piece-hook', group_number: 2, shown: false, shown_at: '2026-11-21T10:00:00Z', undone: false });
    t.world.signInAs(t.gm.id);
    const sendNamed = (name: string, pieceId: string) =>
      runCommand(registry, t.world.db, t.gm, giveFind, { campaignId: t.campaign, to: t.wren, placeId: 'place-stair', things: [{ name, qty: 1 }], coins: {}, rows: ['2:thing'], named: [{ piece: pieceId, thing: 0 }] });
    const hook = await sendNamed('A silver hook', 'piece-hook');
    expect(hook.ok && hook.value.notNamed).toBe(false);
    const line = t.world.tables.inventory_lines.find((l) => l.actor_id === t.wren && l.name === 'A silver hook')!;
    expect((line.item_data as Record<string, unknown>).truthPiece).toBe('piece-hook');
    expect(t.world.tables.piece_shows.map((s) => [s.id, s.shown])).toEqual([['show-hook', false]]);
    const net = await sendNamed('A torn net', 'piece-net');
    expect(net.ok && net.value.notNamed).toBe(true);
    const plain = t.world.tables.inventory_lines.find((l) => l.actor_id === t.wren && l.name === 'A torn net')!;
    expect(((plain.item_data ?? {}) as Record<string, unknown>).truthPiece).toBeUndefined();
  });

  // Purpose: the GM's Undo takes the things and the coin back in one step, its lines reversals of the send's.
  it("the GM's Undo takes both back in one step", async () => {
    const t = table();
    const sent = await send(t, t.gm, t.wren);
    if (!sent.ok) throw new Error(sent.message);
    t.world.signInAs(t.gm.id);
    const undone = await runCommand(registry, t.world.db, t.gm, undoFind, { campaignId: t.campaign, eventId: sent.value.eventId });
    expect(undone.ok).toBe(true);
    expect(linesOf(t, t.wren)).toEqual([]);
    expect(coinsOf(t, t.wren)).toEqual({});
    const reversals = t.world.tables.events.filter((e) => e.type === 'find.undo');
    expect(reversals.length).toBe(3);
    expect(reversals.every((e) => typeof e.reverts_event_id === 'string')).toBe(true);
    // The log keeps each removed line whole.
    expect(reversals.filter((e) => e.target_table === 'inventory_lines').map((e) => (e.before as { name: string }).name)).toEqual(['Moon opal', 'A silver hook']);
    // The log reads the Undo as one line, newest first: what was taken back; the amount only for a reader of the purse.
    const gmLines = await logLines(t, t.gm);
    expect(gmLines[0]).toBe('Your GM took back Moon opal ×2, A silver hook, 40 heron.');
    const tamLines = await logLines(t, t.tam);
    expect(tamLines[0]).toMatch(/^Your GM took back /);
    expect(tamLines[0]).not.toContain('40');
  });

  // Purpose: that Undo is refused, nothing changed, once a sent thing changed or the sent coin was spent; a player can't.
  it('is refused once a thing changed or the coin was spent, and for a player', async () => {
    const t = table();
    const sent = await send(t, t.gm, t.wren);
    if (!sent.ok) throw new Error(sent.message);
    t.world.signInAs(t.sam.id);
    expect((await runCommand(registry, t.world.db, t.sam, undoFind, { campaignId: t.campaign, eventId: sent.value.eventId })).ok).toBe(false);
    t.world.tables.purses.find((p) => p.actor_id === t.wren)!.coins = { heron: 10 };
    t.world.signInAs(t.gm.id);
    const spent = await runCommand(registry, t.world.db, t.gm, undoFind, { campaignId: t.campaign, eventId: sent.value.eventId });
    expect(spent).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    expect(linesOf(t, t.wren)).toHaveLength(2);
  });

  // Purpose: as the database, every check comes first: a send the purse can't take (it would hold too much) adds no
  // thing either, and writes no line.
  it('refuses a send the purse cannot hold, adding nothing at all', async () => {
    const t = table();
    t.world.signInAs(t.gm.id);
    await send(t, t.gm, t.wren, {});
    const before = t.world.tables.events.length;
    const lines = linesOf(t, t.wren).length;
    t.world.tables.purses.find((p) => p.actor_id === t.wren)!.coins = { heron: 999_999_999 };
    const sent = await send(t, t.gm, t.wren, { heron: 1 });
    expect(sent.ok).toBe(false);
    expect(linesOf(t, t.wren)).toHaveLength(lines);
    expect(t.world.tables.events.length).toBe(before);
  });

  // Purpose: a player's own things never fall out of a found bag being taken back: the Undo refuses, nothing changed.
  it('is refused while something has been put inside a sent thing', async () => {
    const t = table();
    const sent = await send(t, t.gm, t.wren);
    if (!sent.ok) throw new Error(sent.message);
    const bag = t.world.tables.inventory_lines.find((l) => l.name === 'A silver hook')!;
    t.world.tables.inventory_lines.push({ ...structuredClone(bag), id: 'line-jerky', name: 'Eel jerky', how_got: 'bought', container_line_id: bag.id });
    t.world.signInAs(t.gm.id);
    const undone = await runCommand(registry, t.world.db, t.gm, undoFind, { campaignId: t.campaign, eventId: sent.value.eventId });
    expect(undone).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    expect(linesOf(t, t.wren)).toHaveLength(3);
    expect(coinsOf(t, t.wren)).toEqual({ heron: 40 });
  });
});
