// Calls to adventure for the GM (dec-12 piece B; docs/plans/dec-12-calls-to-adventure-and-notes.md; ruled mc-61 to
// mc-64, pf-7, pf-7a; migration 20261113210000). TEST project or CI's local database; invented content. What it checks:
//   * an adventure pack's hooks are kept on import as a GM-only kind, adventureHook: the GM reads them back whole; a
//     player in the campaign never receives one, nor any of its words, nor an outsider (hard rule 5, as a player);
//   * a send to the party is read by every player, in the words as sent (the GM's own words here: the book's never
//     reach them); a send to one character by that character's player only; an outsider reads none;
//   * a second send to the same hearer is refused in words; a player can't send, nor write a send straight through
//     the table; Undo marks the send undone and players no longer read it;
//   * the log: a party send's line is everyone's, a character's its player's;
//   * a link's code never reaches a player (rp-11): a send keeps each link mark as its words only, a quoted label
//     included, and a character send stays unread by the other players, its row and its log line both;
//   * refusals in words (20261113220000): a name empty once its marks are words; two sends at once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { loadCalls, sendHook } from '../../src/modules/library/callsToAdventure.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const LANTERN_WORDS = 'A Lantern Warden never came back from the weirs; the eel-wife keeps his boat';
const BOUNTY_WORDS = 'Nailed to the quay post: a bounty on the Bog lurker, in a shaky hand';
const GM_WORDS = 'Marda asks the party to bring the lantern home.';

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The eel weirs', version: '0.1', kind: 'adventure' },
      locations: [{ id: 'ew-sluice', name: 'The Sluice House', type: 'building', key: '4' }],
      npcs: [{ id: 'ew-marda', name: 'Marda', role: 'eel-wife', locationId: 'ew-sluice' }],
      adventureHooks: [
        { id: 'ew-lost-lantern', name: 'The lost lantern', text: LANTERN_WORDS, pays: 'A boat of your own', giverNpcId: 'ew-marda' },
        { id: 'ew-bog-bounty', name: 'Bounty on the Bog lurker', text: BOUNTY_WORDS, pays: 'Ten silver a head' },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const sendsAs = async (person: Person) => must(await person.db.from('hook_sends').select('*').eq('campaign_id', world.campaignId));

describe("an adventure's hooks are the GM's alone until sent (hard rule 5)", () => {
  // Purpose: an adventure's hooks are stored on import, and the GM reads each back whole, in order, with its giver.
  it('are kept on import, and the GM reads them back with their giver', async () => {
    const calls = await loadCalls(asDb(world.gm), world.campaignId);
    expect(calls?.adventures).toHaveLength(1);
    expect(calls?.adventures[0]?.hooks.map((h) => [h.id, h.text, h.giver?.place ?? null])).toEqual([
      ['ew-lost-lantern', LANTERN_WORDS, '4 The Sluice House'],
      ['ew-bog-bounty', BOUNTY_WORDS, null],
    ]);
  });

  // Purpose: no player in the campaign and no outsider receives a hook, its id or any of its words before it is sent
  // (hard rule 5, ca-1), reading the tables as themselves.
  it('never reach a player in the campaign, nor an outsider, as a player reads the tables', async () => {
    for (const person of [world.playerA, world.playerB, world.outsider]) {
      const raw = JSON.stringify(must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId)));
      expect(raw).not.toContain('ew-lost-lantern');
      expect(raw).not.toContain(LANTERN_WORDS);
      expect(raw).not.toContain(BOUNTY_WORDS);
      expect(await sendsAs(person)).toEqual([]);
      expect((await loadCalls(asDb(person), world.campaignId))?.adventures ?? []).toEqual([]);
    }
  });
});

describe('sending a hook (hook.send)', () => {
  // Purpose: a send to the party is read by every player, in the words as sent and never the book's own, and by no
  // outsider; its log line is everyone's (ca-1, ca-3).
  it('to the party: every player reads the words as sent, never the book’s; an outsider reads nothing', async () => {
    const sent = await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-lost-lantern', actorId: null, body: GM_WORDS, pays: 'A boat' });
    expect(sent).toMatchObject({ ok: true, value: { name: 'The lost lantern', body: GM_WORDS, actorId: null } });
    for (const person of [world.playerA, world.playerB]) {
      const rows = await sendsAs(person);
      expect(rows.map((r) => r.body)).toEqual([GM_WORDS]);
      expect(JSON.stringify(rows)).not.toContain(LANTERN_WORDS);
    }
    expect(await sendsAs(world.outsider)).toEqual([]);
    const line = must(await world.admin.from('events').select('audience, owner_user_id').eq('campaign_id', world.campaignId).eq('type', 'hook.send').order('seq', { ascending: false }).limit(1));
    expect(line[0]).toMatchObject({ audience: 'all' });
  });

  // Purpose: a send to one character is read by that character's player and the GM alone, its row and its log line
  // both, never by the other player (ca-2).
  it("to one character: that character's player reads it, the other player doesn't; its line is the player's", async () => {
    const sent = await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-bog-bounty', actorId: world.ashId, body: BOUNTY_WORDS, pays: 'Ten silver a head' });
    expect(sent).toMatchObject({ ok: true });
    expect((await sendsAs(world.playerB)).map((r) => r.hook_key).sort()).toEqual(['ew-bog-bounty', 'ew-lost-lantern']);
    expect((await sendsAs(world.playerA)).map((r) => r.hook_key)).toEqual(['ew-lost-lantern']);
    const line = must(await world.admin.from('events').select('audience, owner_user_id').eq('campaign_id', world.campaignId).eq('type', 'hook.send').order('seq', { ascending: false }).limit(1));
    expect(line[0]).toMatchObject({ audience: 'owner', owner_user_id: world.playerB.id });
    const linesForA = JSON.stringify(must(await world.playerA.db.from('events').select('id, before, after').eq('campaign_id', world.campaignId).eq('target_table', 'hook_sends')));
    expect(linesForA).not.toContain(BOUNTY_WORDS);
    expect(linesForA).not.toContain(world.ashId);
    // And Player A does read the party send's line (the lantern, sent to the party above): the rule hides only what isn't theirs.
    expect(linesForA).toContain(GM_WORDS);
  });

  // Purpose: a second send of one hook to one hearer is refused in words, and nothing is written.
  it('refuses a second send to the same hearer in words, and changes nothing', async () => {
    const again = await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-lost-lantern', actorId: null, body: 'Again.', pays: '' });
    expect(again).toMatchObject({ ok: false, message: "It wasn't sent again: the party already has it. Nothing changed." });
    expect(must(await world.admin.from('hook_sends').select('id').eq('campaign_id', world.campaignId))).toHaveLength(2);
  });

  // Purpose: only the GM sends: a player is refused through the command and the function, and can neither write a
  // send through the table nor change one.
  it("a player can't send, nor write or change a send straight through the table", async () => {
    expect(await as(world.playerA, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-bog-bounty', actorId: null, body: 'Mine.', pays: '' })).toMatchObject({ ok: false });
    const raw = await world.playerA.db.rpc('send_hook', { campaign: world.campaignId, pack: packId, hook_key: 'ew-bog-bounty', body: 'Mine.', pays: '' });
    expect(raw.error?.code).toBe('42501');
    const insert = await world.playerA.db.from('hook_sends').insert({ campaign_id: world.campaignId, pack_id: packId, hook_key: 'ew-bog-bounty', name: 'x', body: 'Mine.' });
    expect(insert.error).not.toBeNull();
    const party = must(await world.admin.from('hook_sends').select('id').eq('hook_key', 'ew-lost-lantern'))[0]!;
    await world.playerA.db.from('hook_sends').update({ body: 'Changed.' }).eq('id', party.id);
    expect(must(await world.admin.from('hook_sends').select('body').eq('id', party.id))[0]?.body).toBe(GM_WORDS);
  });

  // Purpose: Undo marks a send undone (nothing is erased), players stop reading it, and the hook can then be sent
  // to that hearer again.
  it('Undo marks the send undone, and players no longer read it', async () => {
    const line = must(await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', world.campaignId).eq('type', 'hook.send').order('seq', { ascending: false }).limit(1))[0]!;
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('hook_sends').select('undone').eq('hook_key', 'ew-bog-bounty'))[0]?.undone).toBe(true);
    expect((await sendsAs(world.playerB)).map((r) => r.hook_key)).toEqual(['ew-lost-lantern']);
    // Sent again after the Undo: a new send, not refused.
    expect(await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-bog-bounty', actorId: world.ashId, body: BOUNTY_WORDS, pays: '' })).toMatchObject({ ok: true });
  });

  // Purpose: a send keeps each link mark as its words only, so the hearer never gets a link's code (rp-11).
  it("keeps a link mark's words only, so no player gets its code (rp-11)", async () => {
    const hookId = 'ew-bog-bounty';
    expect(await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId, actorId: world.wrenId, body: 'Ask [[npc:ew-marda|"Old" Marda]] at the sluice.', pays: '[[item:ew-boat|A boat]]' })).toMatchObject({ ok: true });
    const rows = await sendsAs(world.playerA);
    const mine = rows.find((r) => r.hook_key === hookId)!;
    expect([mine.body, mine.pays]).toEqual(['Ask "Old" Marda at the sluice.', 'A boat']);
    expect(JSON.stringify(rows)).not.toContain('[[');
    expect(JSON.stringify(rows)).not.toContain('ew-marda');
  });

  // Purpose: a link mark whose label holds a quote reaches the hearer as its words only, never its id, and a player
  // the send didn't go to reads nothing of it (rp-11 with ca-2).
  it('a quoted link label reaches the hearer as words only, and no other player reads the send', async () => {
    const body = 'Find [[npc:old-tom-zq|"Old" Tom]] by the eel traps.';
    expect(await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-lost-lantern', actorId: world.ashId, body, pays: '' })).toMatchObject({ ok: true });
    const hearer = (await sendsAs(world.playerB)).filter((r) => r.actor_id === world.ashId && r.hook_key === 'ew-lost-lantern');
    expect(hearer.map((r) => r.body)).toEqual(['Find "Old" Tom by the eel traps.']);
    expect(JSON.stringify(hearer)).not.toContain('old-tom-zq');
    expect(JSON.stringify(hearer)).not.toContain('[[');
    const other = await sendsAs(world.playerA);
    expect(other.filter((r) => r.actor_id === world.ashId)).toEqual([]);
    expect(JSON.stringify(other)).not.toContain('eel traps');
    expect(JSON.stringify(other)).not.toContain('old-tom-zq');
    const linesForA = JSON.stringify(must(await world.playerA.db.from('events').select('id, before, after').eq('campaign_id', world.campaignId).eq('target_table', 'hook_sends')));
    expect(linesForA).not.toContain('eel traps');
    expect(linesForA).not.toContain('old-tom-zq');
    // And Player A does read the party send's line (the lantern, sent to the party in the third case).
    expect(linesForA).toContain(GM_WORDS);
  });

  // Purpose: a hook whose name is empty once its link marks are words is refused in words, never with the database's
  // own error (20261113220000_dec_12b_send_hook_refusals.sql, refusal b).
  it('refuses, in words, a hook whose name is empty once its link marks are words', async () => {
    must(await world.admin.from('library_entries').insert({ pack_id: packId, kind: 'adventureHook', pack_entry_id: 'ew-nameless', name: '[[npc:]]', data: { text: 'A hook with no name of its own.', pays: '', giver: null, order: 9 } }).select());
    const refused = await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId: 'ew-nameless', actorId: null, body: 'Words.', pays: '' });
    expect(refused).toMatchObject({ ok: false, message: 'This call to adventure has no name the players can read. It needs fixing in its pack.' });
    expect(must(await world.admin.from('hook_sends').select('id').eq('hook_key', 'ew-nameless'))).toEqual([]);
  });

  // Purpose: two sends of one hook to one hearer at the same moment write one send; the other is refused in the
  // approved mockup's words, whether the two overlap (the unique index, 20261113230000) or not, never with the
  // database's own error.
  it('two sends of one hook to the party at once: one is written, the other refused in words', async () => {
    const send = () => world.gm.db.rpc('send_hook', { campaign: world.campaignId, pack: packId, hook_key: 'ew-bog-bounty', body: BOUNTY_WORDS, pays: '' });
    const results = await Promise.all([send(), send()]);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const refusal = results.find((r) => r.error)!.error!.message;
    expect(refusal).toBe("It wasn't sent again: the party already has it. Nothing changed.");
    expect(must(await world.admin.from('hook_sends').select('id').eq('hook_key', 'ew-bog-bounty').is('actor_id', null).eq('undone', false))).toHaveLength(1);
  });
});
