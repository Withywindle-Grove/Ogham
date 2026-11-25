// Deleting an account keeps every row it is linked to, on every table (Francis, 2026-11-24, "yes to both questions",
// #77's ⚑ 5; supabase/migrations/20261124160000_account_deletion_keeps_rows.sql). TEST project only; invented
// content. Written in a cloud session, where database tests can't run against Supabase: rehearsed in a local Postgres
// with every migration applied; CI's database job is the first real run.
//   Purpose:
//   1. Every link starts set to the account that made the row (the GM's rows, Player A's character, note, sheet change
//      and the question the GM asked them), so the deletions below have something to empty.
//   2. A link to an account that still stands can't be emptied by hand, by the GM or with the secret key.
//   3. Deleting a player who made a character, a note and a sheet change, and was asked a question, succeeds; each row
//      stays, with its link to them emptied.
//   4. After that player's deletion, the GM's Undo of an earlier change to the player's character still works (the
//      database's own lines for the emptied links are not later changes).
//   5. In a retired campaign, deleting a player whose character is in it succeeds; the character stays, with no player.
//   6. Deleting the GM who created the (retired) campaign and made rows in every area succeeds; every row stays, its
//      link emptied.
//   7. In the retired campaign, every other change is still refused, even with the secret key.
// And the rows a cascade used to take (Francis, 2026-11-25, "2 a, 3 as recommended", on #84's ⚑ 1 and ⚑ 2;
// supabase/migrations/20261125090000_account_deletion_keeps_asks_and_homebrew.sql), in a world of their own:
//   8. A standing account's asker, a message's player, a recipient and a pack's owner can't be emptied by hand, even
//      with the secret key; a request a player asks can't be made without its asker.
//   9. Deleting a player who asked the GM something succeeds: the request stays with no asker, and the messages sent
//      to them (a thread message, and a message's recipient row) stay with no player; their membership goes.
//  10. Deleting the GM keeps the campaign's own homebrew pack and what hangs on it (an entry, its link to the
//      campaign), its owner emptied; the GM's membership and their personal library pack (attached or not) go.
// Not in this file (they need a pack's places, shops, weather or activities set up; rehearsed locally only):
// activity_runs, camps, camp_entries, place_moves, weather_rolls, shop_stock, knowledge_shares, place_rule_switches,
// town_piece_shows. Their guards are skipped by the same WHEN as the tables here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

let world: World;
// The GM's rows: table → [row id, its link column].
const gmRows: Record<string, { id: string; link: string }> = {};
let reed = '';
let note = '';
let sheetChange = '';
let question = '';
let hpChange = '';

const rowOf = async (table: string, id: string, columns: string) =>
  must(await world.admin.from(table).select(columns).eq('id', id)) as unknown as Record<string, unknown>[];
const rowOfIn = async (w: World, table: string, id: string, columns: string) =>
  must(await w.admin.from(table).select(columns).eq('id', id)) as unknown as Record<string, unknown>[];
const profileGone = async (id: string) => expect(must(await world.admin.from('profiles').select('id').eq('id', id))).toEqual([]);

beforeAll(async () => {
  world = await buildWorld();
  const c = world.campaignId;
  const gm = world.gm.db;
  const make = async (table: string, link: string, values: Record<string, unknown>) => {
    const made = must(await gm.from(table).insert({ campaign_id: c, ...values }).select('id').single()) as { id: string };
    gmRows[table] = { id: made.id, link };
    return made.id;
  };
  await make('sessions', 'started_by', { number: 1 });
  const expedition = await make('expeditions', 'started_by', { mode: 'dungeon' });
  const place = await make('places', 'created_by', { name: 'The Drowned Stair' });
  const visit = await make('group_places', 'created_by', { expedition_id: expedition, group_number: 1, place_id: place });
  const piece = await make('place_pieces', 'created_by', { place_id: place, kind: 'exit', body: 'An archway to the east' });
  await make('piece_shows', 'created_by', { group_place_id: visit, piece_id: piece, group_number: 1 });
  await make('travel_groups', 'created_by', { expedition_id: expedition, group_number: 1, day: 0, total: 8 });
  await make('group_lost', 'created_by', { expedition_id: expedition, group_number: 1, since_day: 0 });
  await make('reminders', 'created_by', { label: 'Wandering eels', every_value: 2, every_unit: 'turns' });
  const check = await make('check_results', 'created_by', { check_key: 'eels', name: 'Eel check', outcome: 'hit' });
  await make('waiting_encounters', 'created_by', { check_result_id: check });
  await make('table_pins', 'created_by', { table_id: 'bog-things' });
  await make('table_reads', 'created_by', { table_id: 'bog-things', roll: '3', row_text: 'A heron' });
  await make('expedition_places', 'created_by', { expedition_id: expedition, name: 'The Drowned Stair', mode: 'dungeon' });
  await make('gm_messages', 'created_by', { body: 'The water rises.' });
  question = await make('requests', 'created_by', { kind: 'askGm', direction: 'gmAsks', actor_id: world.wrenId, requester_id: world.playerA.id });
  // A change to Player A's character, made by the GM before the player's account goes.
  must(await gm.from('actors').update({ hp_current: 6 }).eq('id', world.wrenId).select('id'));
  hpChange = (must(await world.admin.from('events').select('id').eq('target_id', world.wrenId).eq('type', 'actors.update').eq('actor_user_id', world.gm.id).order('seq', { ascending: false }).limit(1))[0] as { id: string }).id;
  // Player A's own rows.
  const a = world.playerA.db;
  reed = (must(await a.from('actors').insert({ campaign_id: c, kind: 'pc', name: 'Reed the Eel-Catcher', owner_type: 'user', owner_user_id: world.playerA.id }).select('id').single()) as { id: string }).id;
  note = (must(await a.from('notes').insert({ campaign_id: c, text: 'The eels follow the lantern.' }).select('id').single()) as { id: string }).id;
  const asked = await a.rpc('request_sheet_change', { actor: world.wrenId, field: 'hpMax', label: 'Max HP', to_value: 12 });
  if (asked.error) throw asked.error;
  sheetChange = (must(await world.admin.from('sheet_changes').select('id').eq('actor_id', world.wrenId))[0] as { id: string }).id;
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('deleting an account keeps every row it is linked to', () => {
  it('every link starts set to the account that made the row', async () => {
    for (const [table, row] of Object.entries(gmRows)) {
      expect([table, (await rowOf(table, row.id, row.link))[0]?.[row.link]]).toEqual([table, world.gm.id]);
    }
    expect(await rowOf('actors', reed, 'owner_user_id, created_by')).toEqual([{ owner_user_id: world.playerA.id, created_by: world.playerA.id }]);
    expect(await rowOf('notes', note, 'created_by')).toEqual([{ created_by: world.playerA.id }]);
    expect(await rowOf('sheet_changes', sheetChange, 'requester_id, created_by')).toEqual([{ requester_id: world.playerA.id, created_by: world.playerA.id }]);
    expect(await rowOf('requests', question, 'requester_id')).toEqual([{ requester_id: world.playerA.id }]);
  });

  it("a standing account's link can't be emptied by hand, by the GM or with the secret key", async () => {
    const place = gmRows.places!.id;
    expect((await world.gm.db.from('places').update({ created_by: null }).eq('id', place).select('id')).error).not.toBeNull();
    expect((await world.admin.from('places').update({ created_by: null }).eq('id', place).select('id')).error).not.toBeNull();
    expect((await world.admin.from('sessions').update({ started_by: null }).eq('id', gmRows.sessions!.id).select('id')).error).not.toBeNull();
    expect((await world.admin.from('requests').update({ requester_id: null }).eq('id', question).select('id')).error).not.toBeNull();
    expect(await rowOf('places', place, 'created_by')).toEqual([{ created_by: world.gm.id }]);
  });

  it('deleting a player who made a character, a note and a sheet change, and was asked a question, succeeds; each row stays', async () => {
    expect((await world.admin.auth.admin.deleteUser(world.playerA.id)).error).toBeNull();
    await profileGone(world.playerA.id);
    expect(await rowOf('actors', reed, 'name, owner_user_id, created_by')).toEqual([{ name: 'Reed the Eel-Catcher', owner_user_id: null, created_by: null }]);
    expect(await rowOf('actors', world.wrenId, 'owner_user_id')).toEqual([{ owner_user_id: null }]);
    expect(await rowOf('notes', note, 'text, created_by')).toEqual([{ text: 'The eels follow the lantern.', created_by: null }]);
    expect(await rowOf('sheet_changes', sheetChange, 'to_value, requester_id, created_by')).toEqual([{ to_value: 12, requester_id: null, created_by: null }]);
    expect(await rowOf('requests', question, 'requester_id, created_by')).toEqual([{ requester_id: null, created_by: world.gm.id }]);
  });

  it("after that player's deletion, the GM's Undo of an earlier change to their character still works", async () => {
    await profileGone(world.playerA.id);
    expect((await world.gm.db.rpc('undo_request', { event_id: hpChange })).error).toBeNull();
    expect(await rowOf('actors', world.wrenId, 'hp_current')).toEqual([{ hp_current: 7 }]);
  });

  it('in a retired campaign, deleting a player whose character is in it succeeds; the character stays with no player', async () => {
    must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', world.campaignId).select('id'));
    expect((await world.admin.auth.admin.deleteUser(world.playerB.id)).error).toBeNull();
    await profileGone(world.playerB.id);
    expect(await rowOf('actors', world.ashId, 'name, owner_user_id')).toEqual([{ name: 'Ash the Reed Cutter', owner_user_id: null }]);
  });

  it('deleting the GM who created the retired campaign and made rows in every area succeeds; every row stays, its link emptied', async () => {
    expect((await world.admin.auth.admin.deleteUser(world.gm.id)).error).toBeNull();
    await profileGone(world.gm.id);
    expect(await rowOf('campaigns', world.campaignId, 'name, created_by')).toEqual([{ name: 'The Reedmouth Delve', created_by: null }]);
    for (const [table, row] of Object.entries(gmRows)) {
      expect([table, await rowOf(table, row.id, row.link)]).toEqual([table, [{ [row.link]: null }]]);
    }
  });

  it('in the retired campaign every other change is still refused, even with the secret key', async () => {
    expect((await world.admin.from('places').update({ name: 'Elsewhere' }).eq('id', gmRows.places!.id).select('id')).error).not.toBeNull();
    expect((await world.admin.from('campaigns').update({ name: 'Elsewhere' }).eq('id', world.campaignId).select('id')).error).not.toBeNull();
    expect((await world.admin.from('actors').update({ name: 'Elsewhere' }).eq('id', world.ashId).select('id')).error).not.toBeNull();
    expect(await rowOf('places', gmRows.places!.id, 'name')).toEqual([{ name: 'The Drowned Stair' }]);
  });
});

describe("deleting an account keeps a player's requests, the messages sent to them and the campaign's homebrew", () => {
  let second: World;
  let asked = '';
  let thread = '';
  let recipient = '';
  let homebrew = '';
  let homebrewEntry = '';
  let library = '';

  beforeAll(async () => {
    second = await buildWorld();
    const c = second.campaignId;
    const sent = await second.playerA.db.rpc('send_request', { campaign: c, actor: second.wrenId, kind: 'describe', body: 'Wade across the eel pool.' });
    if (sent.error) throw sent.error;
    asked = (must(await second.admin.from('requests').select('id').eq('campaign_id', c).eq('direction', 'playerAsks'))[0] as { id: string }).id;
    const toWren = await second.gm.db.rpc('send_messages', { campaign: c, to_characters: [second.wrenId], body: 'The eels are watching you.' });
    if (toWren.error) throw toWren.error;
    thread = (must(await second.admin.from('messages').select('id').eq('campaign_id', c).eq('actor_id', second.wrenId))[0] as { id: string }).id;
    const note = await second.gm.db.rpc('send_message', { campaign: c, body: 'A cold wind off the marsh.', kind: 'text', keep: false, burn: false, to_characters: [second.wrenId] });
    if (note.error) throw note.error;
    recipient = (must(await second.admin.from('message_recipients').select('id').eq('campaign_id', c).eq('actor_id', second.wrenId))[0] as { id: string }).id;
    // The campaign's own homebrew pack, with an entry and its link to the campaign.
    homebrew = (must(await second.admin.from('packs').insert({ owner_user_id: second.gm.id, campaign_id: c, name: 'Homebrew', kind: 'homebrew' }).select('id').single()) as { id: string }).id;
    homebrewEntry = (must(await second.admin.from('library_entries').insert({ pack_id: homebrew, kind: 'item', pack_entry_id: 'bog-lantern', name: 'Bog lantern' }).select('id').single()) as { id: string }).id;
    must(await second.admin.from('campaign_packs').insert({ campaign_id: c, pack_id: homebrew, option_choices: {}, priority: 50 }).select('id'));
    // A pack in the GM's own library, attached to the campaign too.
    const made = await second.gm.db.rpc('import_pack', {
      meta: { name: 'Marsh lore', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
      entries: [{ kind: 'adventureHook', pack_entry_id: 'ew-reed-flute', name: 'The lost reed flute', data: { text: 'A flute in the reeds.', pays: 'A song', giver: null, order: 0 } }],
      replace_pack_id: null,
    });
    if (made.error) throw made.error;
    library = made.data as string;
    must(await second.admin.from('campaign_packs').insert({ campaign_id: c, pack_id: library, option_choices: {}, priority: 49 }).select('id'));
  }, 300_000);

  afterAll(async () => {
    await tearDownWorld(second);
  }, 60_000);

  it("a standing account's asker, a message's player, a recipient and a pack's owner can't be emptied by hand", async () => {
    const admin = second.admin;
    expect((await admin.from('requests').update({ requester_id: null }).eq('id', asked).select('id')).error).not.toBeNull();
    expect((await second.gm.db.from('requests').update({ requester_id: null }).eq('id', asked).select('id')).error).not.toBeNull();
    expect((await admin.from('messages').update({ player_user_id: null }).eq('id', thread).select('id')).error).not.toBeNull();
    expect((await admin.from('message_recipients').update({ user_id: null }).eq('id', recipient).select('id')).error).not.toBeNull();
    expect((await admin.from('packs').update({ owner_user_id: null }).eq('id', homebrew).select('id')).error).not.toBeNull();
    expect((await admin.from('packs').update({ owner_user_id: null }).eq('id', library).select('id')).error).not.toBeNull();
    const noAsker = await admin.from('requests').insert({ campaign_id: second.campaignId, actor_id: second.wrenId, kind: 'describe', direction: 'playerAsks', text: 'Nobody asked this.' }).select('id');
    expect(noAsker.error).not.toBeNull();
    expect(await rowOfIn(second, 'requests', asked, 'requester_id')).toEqual([{ requester_id: second.playerA.id }]);
  });

  it.fails('deleting a player who asked the GM something succeeds; the request and the messages sent to them stay, with no player', async () => {
    expect((await second.admin.auth.admin.deleteUser(second.playerA.id)).error).toBeNull();
    expect(must(await second.admin.from('profiles').select('id').eq('id', second.playerA.id))).toEqual([]);
    expect(await rowOfIn(second, 'requests', asked, 'text, direction, requester_id')).toEqual([{ text: 'Wade across the eel pool.', direction: 'playerAsks', requester_id: null }]);
    expect(await rowOfIn(second, 'messages', thread, 'body, player_user_id, sender_user_id')).toEqual([{ body: 'The eels are watching you.', player_user_id: null, sender_user_id: second.gm.id }]);
    expect(await rowOfIn(second, 'message_recipients', recipient, 'actor_id, user_id')).toEqual([{ actor_id: second.wrenId, user_id: null }]);
    expect(must(await second.admin.from('members').select('user_id').eq('campaign_id', second.campaignId).eq('user_id', second.playerA.id))).toEqual([]);
  });

  it.fails("deleting the GM keeps the campaign's homebrew pack and what hangs on it; their membership and library pack go", async () => {
    expect((await second.admin.auth.admin.deleteUser(second.gm.id)).error).toBeNull();
    expect(must(await second.admin.from('profiles').select('id').eq('id', second.gm.id))).toEqual([]);
    expect(await rowOfIn(second, 'packs', homebrew, 'name, campaign_id, owner_user_id')).toEqual([{ name: 'Homebrew', campaign_id: second.campaignId, owner_user_id: null }]);
    expect(await rowOfIn(second, 'library_entries', homebrewEntry, 'name')).toEqual([{ name: 'Bog lantern' }]);
    expect(must(await second.admin.from('campaign_packs').select('pack_id').eq('campaign_id', second.campaignId))).toEqual([{ pack_id: homebrew }]);
    expect(await rowOfIn(second, 'packs', library, 'id')).toEqual([]);
    expect(must(await second.admin.from('library_entries').select('id').eq('pack_id', library))).toEqual([]);
    expect(must(await second.admin.from('members').select('user_id').eq('campaign_id', second.campaignId).eq('user_id', second.gm.id))).toEqual([]);
    expect(await rowOfIn(second, 'messages', thread, 'sender_user_id')).toEqual([{ sender_user_id: null }]);
  });
});
