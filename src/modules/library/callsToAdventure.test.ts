// Calls to adventure for the GM (dec-12 piece B; mc-61 to mc-64): what is left to give, a hook's row, who it was
// sent to and when, and the send itself through the stand-in database (the real rules: supabase/tests/
// dec-12b-calls-to-adventure.test.ts). Invented content only.
import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import type { StoredHook } from './adventureHooks.ts';
import { alreadySent, hookNameProblem, hookRowLines, loadCalls, loadHearers, sendHook, sentCount, sentLine, sentWords, type Adventure, type HookSend } from './callsToAdventure.ts';

const hook = (id: string, over: Partial<StoredHook> = {}): StoredHook => ({ id, name: id, text: `The words of ${id}.`, pays: '', giverNpcId: null, giver: null, order: 0, ...over });
const send = (packId: string, hookId: string, actorId: string | null, over: Partial<HookSend> = {}): HookSend => ({
  id: `${packId}/${hookId}/${actorId ?? 'party'}`,
  campaignId: 'c',
  packId,
  hookId,
  actorId,
  name: hookId,
  body: 'Words',
  pays: '',
  clockSeconds: 0,
  createdAt: '2026-12-05T19:00:00Z',
  ...over,
});
const weirs: Adventure = { packId: 'weirs', name: 'The eel weirs', hooks: [hook('lantern'), hook('bounty'), hook('debt')], rumours: [] };
const barrow: Adventure = { packId: 'barrow', name: 'The Lantern Barrow', hooks: [hook('bell')], rumours: [] };

describe('what is left to give (mc-61, frame 2)', () => {
  // Purpose: a hook counts once however many hearers it was sent to, across every adventure; "All sent" only where asked.
  it('counts each hook sent at least once, across the adventures, and says "All sent" for an adventure with none left', () => {
    const sends = [send('weirs', 'lantern', null), send('weirs', 'lantern', 'wren'), send('barrow', 'bell', 'ash')];
    expect(sentCount([weirs, barrow], sends)).toEqual({ sent: 2, of: 4 });
    expect(sentWords(sentCount([weirs, barrow], sends))).toBe('2 of 4 sent');
    expect(sentWords(sentCount([barrow], sends), true)).toBe('All sent');
    expect(sentWords(sentCount([barrow], sends))).toBe('1 of 1 sent');
    expect(sentWords(sentCount([weirs], []), true)).toBe('0 of 3 sent');
    expect(sentWords({ sent: 0, of: 0 }, true)).toBe('0 of 0 sent');
  });
});

describe("a hook's row (mc-63, picture 03-12's right-hand row)", () => {
  // Purpose: the row says what it pays (from a lower-case start) and who gives it and where; a hook with neither says nothing more.
  it('says what it pays and who gives it, where', () => {
    expect(hookRowLines(hook('debt', { pays: 'Nothing; clears what Tam owes', giver: { name: 'Osric Vane', role: 'reed-factor', place: '3 The Reed Market' } }))).toEqual([
      'Pays nothing; clears what Tam owes.',
      'From Osric Vane, at 3 The Reed Market.',
    ]);
    expect(hookRowLines(hook('wreck', { pays: '50 crowns.', giver: { name: 'the Tidewife', role: '', place: '' } }))).toEqual(['Pays 50 crowns.', 'From the Tidewife.']);
    expect(hookRowLines(hook('bare'))).toEqual([]);
  });

  // Purpose: a sent hook says to whom (the party, or the character by name) and on which day of the clock.
  it('says to whom it was sent and on which day', () => {
    const hearers = [{ id: 'wren', name: 'Wren', player: 'Tam' }];
    const dayOf = (seconds: number) => Math.floor(seconds / 86400) + 1;
    expect(sentLine(send('weirs', 'lantern', null), hearers, dayOf)).toBe('Sent to the party, day 1');
    expect(sentLine(send('weirs', 'lantern', 'wren', { clockSeconds: 2 * 86400 + 5 }), hearers, dayOf)).toBe('Sent to Wren, day 3');
    expect(sentLine(send('weirs', 'lantern', 'gone'), hearers, null)).toBe('Sent to a character');
  });

  // Purpose: a second send to the same hearer is caught before it goes; another hearer is not.
  it('knows a hook already sent to that hearer', () => {
    const sends = [send('weirs', 'lantern', null)];
    expect(alreadySent(sends, 'weirs', 'lantern', null)).toBe(true);
    expect(alreadySent(sends, 'weirs', 'lantern', 'wren')).toBe(false);
    expect(alreadySent(sends, 'weirs', 'bounty', null)).toBe(false);
  });
});

describe("a hook's name, checked before it is sent (review of #741)", () => {
  // Purpose: a name empty once its link marks are words, or over 200 characters, is refused in the database's words
  // before anything is sent; a name made of a link's words is fine.
  it('refuses an empty or too long name in words, and passes a link with words', () => {
    expect(hookNameProblem('[[npc:]]')).toBe('This call to adventure has no name the players can read. It needs fixing in its pack.');
    expect(hookNameProblem('   ')).toBe('This call to adventure has no name the players can read. It needs fixing in its pack.');
    expect(hookNameProblem('x'.repeat(201))).toBe("A call to adventure's name is at most 200 characters.");
    expect(hookNameProblem('x'.repeat(200))).toBeNull();
    expect(hookNameProblem('The errand of [[npc:ew-marda|Marda]]')).toBeNull();
  });
});

describe('sending (hook.send), through the stand-in database', () => {
  const setUp = () => {
    const world = createFakeDb();
    const gmId = world.addPerson('gm@weirs.example', 'Priya');
    const tamId = world.addPerson('tam@weirs.example', 'Tam');
    const campaign = world.addCampaign('The Eel Weirs', gmId);
    world.addMember(campaign, tamId, 'player');
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: tamId });
    world.addCharacter(campaign, 'Sketch', { ownerId: tamId, approval: 'pending' });
    world.tables.packs.push({ id: 'weirs', owner_user_id: gmId, campaign_id: null, name: 'The eel weirs', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.packs.push({ id: 'rules', owner_user_id: gmId, campaign_id: null, name: 'Fen rules', kind: 'setting', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-weirs', campaign_id: campaign, pack_id: 'weirs', option_choices: {}, priority: 2 });
    world.tables.campaign_packs.push({ id: 'cp-rules', campaign_id: campaign, pack_id: 'rules', option_choices: {}, priority: 1 });
    world.tables.library_entries.push(
      { id: 'e2', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'bounty', name: 'Bounty on the Bog lurker', data: { text: 'Nailed to the quay post.', pays: 'Ten silver a head', giver: null, order: 1 } },
      { id: 'e1', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'lantern', name: 'The lost lantern', data: { text: 'A Lantern Warden never came back.', pays: 'A boat', giver: { name: 'Marda', role: '', place: '' }, order: 0 } },
    );
    const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
    return { world, gmId, tamId, campaign, wren, gm };
  };

  // Purpose: the GM reads the campaign's adventures (packs of kind adventure with a hook), the hooks in the book's
  // order, and a player's characters in play as the hearers.
  it('reads the adventures, their hooks in order, and the characters in play', async () => {
    const { world, campaign, gmId } = setUp();
    world.signInAs(gmId);
    const calls = await loadCalls(world.db, campaign);
    expect(calls?.adventures.map((a) => [a.name, a.hooks.map((h) => h.name)])).toEqual([['The eel weirs', ['The lost lantern', 'Bounty on the Bog lurker']]]);
    expect(await loadHearers(world.db, campaign, gmId)).toEqual([{ id: expect.any(String), name: 'Wren', player: 'Tam' }]);
  });

  // Purpose: the characters a hook can go to say whose they are: the player's name, or "you" for a character the GM
  // plays, who stays in the list (SC-1, approved 2026-11-13); a character not yet approved isn't offered.
  it('names each character\'s player, and "you" for the GM\'s own character', async () => {
    const { world, campaign, gmId } = setUp();
    world.addCharacter(campaign, 'Ash', { ownerId: gmId });
    world.signInAs(gmId);
    expect((await loadHearers(world.db, campaign, gmId))?.map((h) => [h.name, h.player])).toEqual([
      ['Ash', 'you'],
      ['Wren', 'Tam'],
    ]);
  });

  // Purpose: a send to the party is kept with the words as sent (the GM's own here, never the pack's), logged for
  // everyone, and a second send to the party is refused in words; a player reads the party's send but never a hook.
  it('sends to the party with the words as sent, refuses a second send to the party, and a player reads only the send', async () => {
    const { world, campaign, gmId, tamId, gm } = setUp();
    world.signInAs(gmId);
    const sent = await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'lantern', actorId: null, body: ' Marda asks for her lantern back. ', pays: 'A boat' });
    expect(sent).toMatchObject({ ok: true, value: { hookId: 'lantern', actorId: null, name: 'The lost lantern', body: 'Marda asks for her lantern back.' } });
    expect(world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern')?.data).toMatchObject({ text: 'A Lantern Warden never came back.' });
    const again = await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'lantern', actorId: null, body: 'x', pays: '' });
    expect(again).toMatchObject({ ok: false, message: "It wasn't sent again: the party already has it. Nothing changed." });
    expect(world.tables.events.find((e) => e.target_table === 'hook_sends')?.audience).toBe('all');

    world.signInAs(tamId);
    const theirs = await world.db.from('hook_sends').select('body');
    expect(theirs.data?.map((r) => r.body)).toEqual(['Marda asks for her lantern back.']);
    const hooks = await world.db.from('library_entries').select('kind, data').eq('kind', 'adventureHook');
    expect(hooks.data).toEqual([]);
  });

  // Purpose: a send to one character goes to that character's player alone; a character not in play is refused.
  it("sends to one character, read by that character's player only, and refuses a character not in play", async () => {
    const { world, campaign, gmId, wren, gm } = setUp();
    const otherId = world.addPerson('ash@weirs.example', 'Ash');
    world.addMember(campaign, otherId, 'player');
    world.signInAs(gmId);
    expect(await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'bounty', actorId: wren, body: 'A bounty.', pays: '' })).toMatchObject({ ok: true });
    expect(world.tables.events.find((e) => e.target_table === 'hook_sends')).toMatchObject({ audience: 'owner' });
    const pending = world.tables.actors.find((a) => a.name === 'Sketch')!.id as string;
    expect(await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'bounty', actorId: pending, body: 'A bounty.', pays: '' })).toMatchObject({
      ok: false,
      message: "Send it to a player's character in play, or to the party.",
    });
    world.signInAs(otherId);
    expect((await world.db.from('hook_sends').select('body')).data).toEqual([]);
  });

  // Purpose: a link's code never reaches a player (rp-11): the GM reads a hook's words with each link as its words,
  // and a send keeps only the words, whatever the device sent.
  it('reads and sends a hook with each link mark as its words only', async () => {
    const { world, campaign, gmId, gm } = setUp();
    world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern')!.data = { text: 'Ask [[npc:ew-marda|Marda]] at the sluice.', pays: '[[item:ew-boat|A boat]]', giver: null, order: 0 };
    world.signInAs(gmId);
    const lantern = (await loadCalls(world.db, campaign))!.adventures[0]!.hooks[0]!;
    expect([lantern.text, lantern.pays]).toEqual(['Ask Marda at the sluice.', 'A boat']);
    await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'lantern', actorId: null, body: 'Ask [[npc:ew-marda|Marda]].', pays: '[[item:ew-boat]]' });
    expect(world.tables.hook_sends[0]).toMatchObject({ body: 'Ask Marda.', pays: 'ew boat' });
  });

  // Purpose: the stand-in refuses a hook whose name is empty once its marks are words, as the database does.
  it('refuses a nameless hook in words', async () => {
    const { world, campaign, gmId, gm } = setUp();
    world.tables.library_entries.find((e) => e.pack_entry_id === 'bounty')!.name = '[[npc:]]';
    world.signInAs(gmId);
    expect(await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'bounty', actorId: null, body: 'x', pays: '' })).toMatchObject({ ok: false, message: 'This call to adventure has no name the players can read. It needs fixing in its pack.' });
    expect(world.tables.hook_sends).toEqual([]);
  });

  // Purpose: only the GM may send (the app's rule); a hook of a pack the campaign doesn't use is refused.
  it('lets only the GM send, and only a hook of an attached adventure', async () => {
    const { world, campaign, gmId, tamId, gm } = setUp();
    expect(sendHook.allowed(gm, { campaignId: campaign })).toBe(true);
    expect(sendHook.allowed({ id: tamId, roles: { [campaign]: 'player' } }, { campaignId: campaign })).toBe(false);
    world.signInAs(gmId);
    expect(await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'elsewhere', hookId: 'lantern', actorId: null, body: 'x', pays: '' })).toMatchObject({
      ok: false,
      message: "That call to adventure isn't in an adventure this campaign uses.",
    });
  });
});

describe("a hook's name counted in characters, as Postgres's length() counts them (#741 follow-up)", () => {
  const OTTER = '\u{1F9A6}';

  // Purpose: a name of 150 emoji is 150 characters (300 UTF-16 units), under the limit; 201 characters are over it.
  it('counts an emoji as one character', () => {
    expect(OTTER.repeat(150).length).toBe(300);
    expect(hookNameProblem(OTTER.repeat(150))).toBeNull();
    expect(hookNameProblem(OTTER.repeat(201))).toBe("A call to adventure's name is at most 200 characters.");
    expect(hookNameProblem('x'.repeat(201))).toBe("A call to adventure's name is at most 200 characters.");
  });

  // Purpose: the stand-in database counts the same way: a 150-emoji name is sent, a 201-character one refused.
  it('the stand-in sends a 150-emoji name and refuses a 201-character one', async () => {
    const world = createFakeDb();
    const gmId = world.addPerson('gm@weirs.example', 'Priya');
    const campaign = world.addCampaign('The Eel Weirs', gmId);
    world.tables.packs.push({ id: 'weirs', owner_user_id: gmId, campaign_id: null, name: 'The eel weirs', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-weirs', campaign_id: campaign, pack_id: 'weirs', option_choices: {}, priority: 1 });
    world.tables.library_entries.push(
      { id: 'e1', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'otters', name: OTTER.repeat(150), data: { text: 'Otters on the weir.', pays: '', giver: null, order: 0 } },
      { id: 'e2', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'long', name: 'x'.repeat(201), data: { text: 'A long name.', pays: '', giver: null, order: 1 } },
    );
    const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
    world.signInAs(gmId);
    expect(await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'otters', actorId: null, body: 'Otters.', pays: '' })).toMatchObject({ ok: true });
    expect(await sendHook.run(world.db, gm, { campaignId: campaign, packId: 'weirs', hookId: 'long', actorId: null, body: 'Long.', pays: '' })).toMatchObject({ ok: false, message: "A call to adventure's name is at most 200 characters." });
  });
});
