// M5b step g4: messaging (supabase/migrations/20261102120000_m5b_g4_messages.sql; M5 gate B3, ruled 2026-11-01; the
// attachment rulings of 2026-11-01: the GM only, up to 10 MB). TEST project only; invented people and words.
//   Hidden means hidden: a message between the GM and Player A never reaches Player B or an outsider, in the
//   database (rows and log lines) and in the bucket (its picture); the GM reads every thread.
//   A player writes to the GM only as their own character, never as another's, and never with a file: the database
//   refuses the row and the bucket refuses the upload.
//   A disappearing message leaves the player (row and picture) once they close it, and stays in the GM's log with its
//   text; a plain one is read on opening and stays.
//   Undo of a send takes the message back from its recipient (and its picture with it).
//   The bucket holds a file to 10 MB: one byte over is refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { ATTACHMENT_MAX_BYTES, attachmentPath, loadMessages, readMessages, sendMessages, unreadCount } from '../../src/modules/messages/messages.ts';
import { buildWorld, MESSAGE_BUCKET, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign: Reed (player A's) and Moss (player B's), both in play; Bree, A's hireling. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Warrens', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pc = (name: string, owner: Person, kind = 'pc') => ({ campaign_id: campaign.id, kind, name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss, bree] = must(
    await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Bree the Lantern Bearer', world.playerA, 'hireling')]).select('id'),
  ) as { id: string }[];
  const ref = (id: string, owner: Person) => ({ id, ownerUserId: owner.id });
  return { campaignId: campaign.id as string, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB), bree: ref(bree!.id, world.playerA) };
}

const text = (body: string, disappears = false) => ({ body, disappears, attachment: null });
const picture = (bytes: number, name = 'ledger.png') => ({ blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }), name });
const bodies = async (person: Person, campaignId: string) => (await loadMessages(asDb(person), campaignId))?.map((m) => m.body) ?? null;
const seenTables = async (person: Person, campaignId: string) =>
  must(await person.db.from('events').select('target_table').eq('campaign_id', campaignId)).map((e) => e.target_table as string);
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const canOpen = async (person: Person, path: string) => {
  const { data } = await person.db.storage.from(MESSAGE_BUCKET).createSignedUrl(path, 60);
  if (!data?.signedUrl) return false;
  const response = await fetch(data.signedUrl);
  return response.ok;
};

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('hidden means hidden (B3, 03)', () => {
  it('a message between the GM and Player A never reaches Player B or an outsider, in rows, log lines or the bucket; the GM reads every thread', async () => {
    const t = await freshTable();
    const sent = await ok(as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed, t.moss], draft: { body: 'You alone notice the lectern has been moved.', disappears: false, attachment: picture(300) } }));
    expect(sent.map((m) => [m.actorId, m.fromGm, m.attachment?.name]).sort()).toEqual(
      [
        [t.reed.id, true, 'ledger.png'],
        [t.moss.id, true, 'ledger.png'],
      ].sort(),
    );
    const reeds = sent.find((m) => m.actorId === t.reed.id)!;
    const mosses = sent.find((m) => m.actorId === t.moss.id)!;
    // Each player reads their own thread only; the GM both.
    expect((await loadMessages(asDb(world.playerA), t.campaignId))?.map((m) => m.id)).toEqual([reeds.id]);
    expect((await loadMessages(asDb(world.playerB), t.campaignId))?.map((m) => m.id)).toEqual([mosses.id]);
    expect((await loadMessages(asDb(world.gm), t.campaignId))?.map((m) => m.id).sort()).toEqual([reeds.id, mosses.id].sort());
    expect(await loadMessages(asDb(world.outsider), t.campaignId)).toEqual([]);
    expect(must(await world.outsider.db.from('messages').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    // Log lines: Player B's never carry Reed's message.
    const bLines = must(await world.playerB.db.from('events').select('target_id').eq('campaign_id', t.campaignId).eq('target_table', 'messages'));
    expect(bLines.map((e) => e.target_id)).toEqual([mosses.id]);
    // The picture: its two parties open it; the other player and an outsider can't (no link, or a refused fetch).
    const reedsPath = attachmentPath(t.campaignId, reeds.id);
    expect(await canOpen(world.gm, reedsPath)).toBe(true);
    expect(await canOpen(world.playerA, reedsPath)).toBe(true);
    expect(await canOpen(world.playerB, reedsPath)).toBe(false);
    expect(await canOpen(world.outsider, reedsPath)).toBe(false);
    // Player A wrote back; the GM has one unread, Player B none of it.
    await ok(as(world.playerA, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: text('Is the figure moving at all?') }));
    expect(unreadCount((await loadMessages(asDb(world.gm), t.campaignId))!, await userOf(world.gm))).toBe(1);
    expect(await bodies(world.playerB, t.campaignId)).toEqual(['You alone notice the lectern has been moved.']);
  });

  it("a player writes only as their own character, never as another's, and never with a file (the row and the bucket both refuse)", async () => {
    const t = await freshTable();
    const asMoss = await as(world.playerA, sendMessages, { campaignId: t.campaignId, to: [t.moss], draft: text('Sneaky words.') });
    expect(asMoss).toMatchObject({ ok: false, reason: 'not-allowed' });
    // Straight at the database, as Moss: refused by the row's rule.
    const direct = await world.playerA.db.rpc('send_messages', { campaign: t.campaignId, to_characters: [t.moss.id], body: 'Sneaky words.' });
    expect(direct.error?.code).toBe('42501');
    // A hireling is nobody's thread.
    const toBree = await world.gm.db.rpc('send_messages', { campaign: t.campaignId, to_characters: [t.bree.id], body: 'Psst.' });
    expect(toBree.error?.message).toBe("Messages go to a player's character in play.");
    // A file from a player: the app refuses, the database refuses the row, and the bucket refuses an upload even
    // for a message the player did write.
    const withFile = await as(world.playerA, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: { body: 'Look.', disappears: false, attachment: picture(10) } });
    expect(withFile).toMatchObject({ ok: false, reason: 'not-allowed' });
    const directFile = await world.playerA.db.rpc('send_messages', { campaign: t.campaignId, to_characters: [t.reed.id], body: 'Look.', attachment: { name: 'x.png', type: 'image/png', size: 10 } });
    expect(directFile.error?.message).toBe('Only the GM can attach a file.');
    const own = await ok(as(world.playerA, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: text('A plain line.') }));
    const upload = await world.playerA.db.storage.from(MESSAGE_BUCKET).upload(attachmentPath(t.campaignId, own[0]!.id), picture(10).blob, { contentType: 'image/png' });
    expect(upload.error).not.toBeNull();
    // Nor can Player B upload a picture onto the GM's message to Reed, nor replace the GM's.
    const gms = await ok(as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: { body: '', disappears: false, attachment: picture(20) } }));
    const path = attachmentPath(t.campaignId, gms[0]!.id);
    expect((await world.playerB.db.storage.from(MESSAGE_BUCKET).upload(path, picture(10).blob, { upsert: true, contentType: 'image/png' })).error).not.toBeNull();
    expect((await world.playerA.db.storage.from(MESSAGE_BUCKET).update(path, picture(10).blob, { contentType: 'image/png' })).error).not.toBeNull();
  });
});

describe('disappears once read, and Undo', () => {
  it("a disappearing message leaves the player, row and picture, once they close it; the GM's log keeps its text; a plain one is read on opening and stays", async () => {
    const t = await freshTable();
    const [gone] = await ok(as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: { body: 'The idol is hollow.', disappears: true, attachment: picture(40) } }));
    const [kept] = await ok(as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: text('Bring the lantern.') }));
    const path = attachmentPath(t.campaignId, gone!.id);
    expect(await bodies(world.playerA, t.campaignId)).toEqual(['The idol is hollow.', 'Bring the lantern.']);
    expect(await canOpen(world.playerA, path)).toBe(true);
    // The disappearing one makes no line of the player's; the plain one does.
    const aLines = must(await world.playerA.db.from('events').select('target_id').eq('campaign_id', t.campaignId).eq('target_table', 'messages'));
    expect(aLines.map((e) => e.target_id)).toEqual([kept!.id]);
    // Opening the thread reads the plain one; it stays.
    expect(await ok(as(world.playerA, readMessages, { campaignId: t.campaignId, messageIds: [kept!.id], recipient: true }))).toBe(1);
    expect((await loadMessages(asDb(world.playerA), t.campaignId))?.map((m) => [m.body, m.readAt !== null])).toEqual([
      ['The idol is hollow.', false],
      ['Bring the lantern.', true],
    ]);
    // Closing the disappearing one: gone from the player, with its picture; the GM still reads both and the text is in the GM's log.
    expect(await ok(as(world.playerA, readMessages, { campaignId: t.campaignId, messageIds: [gone!.id], recipient: true }))).toBe(1);
    expect(await bodies(world.playerA, t.campaignId)).toEqual(['Bring the lantern.']);
    expect(await canOpen(world.playerA, path)).toBe(false);
    expect(await canOpen(world.gm, path)).toBe(true);
    expect(await bodies(world.gm, t.campaignId)).toEqual(['The idol is hollow.', 'Bring the lantern.']);
    const gmLines = must(await world.gm.db.from('events').select('after').eq('campaign_id', t.campaignId).eq('target_table', 'messages').eq('type', 'message.send'));
    expect(gmLines.map((e) => (e.after as { body?: string }).body)).toContain('The idol is hollow.');
    // A repeat changes nothing; Player B can't read Reed's.
    expect(await ok(as(world.playerA, readMessages, { campaignId: t.campaignId, messageIds: [kept!.id], recipient: true }))).toBe(0);
    expect((await world.playerB.db.rpc('read_messages', { message_ids: [kept!.id] })).error?.code).toBe('42501');
  });

  it('Undo of a send takes the message back from its recipient, and its picture with it', async () => {
    const t = await freshTable();
    const [sent] = await ok(as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: { body: 'You hear chanting.', disappears: false, attachment: picture(30) } }));
    const path = attachmentPath(t.campaignId, sent!.id);
    expect(await bodies(world.playerA, t.campaignId)).toEqual(['You hear chanting.']);
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: await latestEvent(t.campaignId, 'message.send'), authorUserId: world.gm.id }));
    expect(await bodies(world.playerA, t.campaignId)).toEqual([]);
    expect(await bodies(world.gm, t.campaignId)).toEqual([]);
    expect(await canOpen(world.playerA, path)).toBe(false);
    expect(await seenTables(world.playerA, t.campaignId)).toContain('messages');
    // A player takes back their own too.
    await ok(as(world.playerA, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: text('Never mind.') }));
    await ok(as(world.playerA, undoChange, { campaignId: t.campaignId, eventId: await latestEvent(t.campaignId, 'message.send'), authorUserId: world.playerA.id }));
    expect(await bodies(world.gm, t.campaignId)).toEqual([]);
  });

  it('the bucket takes a picture up to 10 MB and refuses one byte more; the record refuses the same', async () => {
    const t = await freshTable();
    const [sent] = await ok(as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: { body: '', disappears: false, attachment: picture(ATTACHMENT_MAX_BYTES, 'map.png') } }));
    expect(sent!.attachment).toEqual({ name: 'map.png', type: 'image/png', size: ATTACHMENT_MAX_BYTES });
    expect(await canOpen(world.playerA, attachmentPath(t.campaignId, sent!.id))).toBe(true);
    const tooBig = await as(world.gm, sendMessages, { campaignId: t.campaignId, to: [t.reed], draft: { body: '', disappears: false, attachment: picture(ATTACHMENT_MAX_BYTES + 1) } });
    expect(tooBig).toMatchObject({ ok: false, message: 'That picture is too large. Choose one under 10 MB.' });
    // Straight at the bucket, past the app: a row that claims 10 MB and a file one byte larger.
    const row = must(await world.gm.db.rpc('send_messages', { campaign: t.campaignId, to_characters: [t.reed.id], body: '', attachment: { name: 'big.png', type: 'image/png', size: ATTACHMENT_MAX_BYTES } }));
    const over = await world.gm.db.storage.from(MESSAGE_BUCKET).upload(attachmentPath(t.campaignId, (row as { id: string }[])[0]!.id), picture(ATTACHMENT_MAX_BYTES + 1).blob, { contentType: 'image/png' });
    expect(over.error?.message ?? '').toMatch(/exceeded|too large|size/i);
    const claimed = await world.gm.db.rpc('send_messages', { campaign: t.campaignId, to_characters: [t.reed.id], body: '', attachment: { name: 'big.png', type: 'image/png', size: ATTACHMENT_MAX_BYTES + 1 } });
    expect(claimed.error?.message).toBe('That picture is too large. Choose one under 10 MB.');
  }, 120_000);
});
