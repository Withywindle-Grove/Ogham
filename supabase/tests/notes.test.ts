// Notes: anyone in the campaign writes one (optionally about a character) or adds one to a log entry; you can
// edit your own (the GM any), the old text stays in the log, and notes are never deleted. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { createInvite } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { addNote, editNote, loadNotes } from '../../src/core/notes.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

async function written(person: Person, text: string, extra: { aboutActorId?: string; annotatesEventId?: string } = {}) {
  const made = await as(person, addNote, { campaignId: world.campaignId, text, ...extra });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

const eventsAbout = async (id: string) =>
  must(await world.admin.from('events').select('type, before, after, audience').eq('target_id', id).order('seq')) as {
    type: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    audience: string;
  }[];

describe('notes', () => {
  it('a member writes a note about a character; it is logged with its text and author', async () => {
    const note = await written(world.playerA, '  Wren owes the ferryman a favour. ', { aboutActorId: world.wrenId });
    const notes = (await loadNotes(asDb(world.playerB), world.campaignId)) ?? [];
    expect(notes.find((n) => n.id === note.id)).toMatchObject({
      text: 'Wren owes the ferryman a favour.',
      authorUserId: world.playerA.id,
      aboutActorId: world.wrenId,
      annotatesEventId: null,
    });
    expect(await eventsAbout(note.id)).toEqual([
      expect.objectContaining({ type: 'note.add', audience: 'all', after: expect.objectContaining({ text: 'Wren owes the ferryman a favour.' }) }),
    ]);
  });

  it('a blank note is refused in plain words, and outsiders write nothing', async () => {
    expect(await as(world.playerA, addNote, { campaignId: world.campaignId, text: '   ' })).toMatchObject({ ok: false, message: 'Write something first.' });
    const forged = await world.outsider.db.from('notes').insert({ campaign_id: world.campaignId, text: 'Hello' }).select();
    expect(forged.error).not.toBeNull();
  });

  it("a note added to a log entry can only be seen by people who can see that entry", async () => {
    const invite = await as(world.gm, createInvite, { campaignId: world.campaignId });
    if (!invite.ok) throw new Error(invite.message);
    const inviteEvent = must(await world.admin.from('events').select('id').eq('target_id', invite.value.id).single());

    // A player can't add a note to an entry they can't see…
    const blind = await world.playerA.db
      .from('notes')
      .insert({ campaign_id: world.campaignId, text: 'Who is this for?', annotates_event_id: inviteEvent.id })
      .select();
    expect(blind.error).not.toBeNull();

    // …and the GM's note on it stays with the GM.
    const note = await written(world.gm, 'For the new lamplighter.', { annotatesEventId: inviteEvent.id });
    expect((await loadNotes(asDb(world.playerA), world.campaignId))?.some((n) => n.id === note.id)).toBe(false);
    expect((await loadNotes(asDb(world.gm), world.campaignId))?.find((n) => n.id === note.id)?.annotatesEventId).toBe(inviteEvent.id);
  });

  it('you can edit your own note and the old text stays in the log; another player cannot; the GM can', async () => {
    const note = await written(world.playerA, 'Owes the ferryman.');
    expect(await as(world.playerA, editNote, { note, text: 'Owes the ferryman two silver.' })).toMatchObject({ ok: true });

    const other = (await loadCurrentUser(asDb(world.playerB)))!;
    expect(await editNote.run(asDb(world.playerB), other, { note, text: 'Owes me.' })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await as(world.gm, editNote, { note, text: 'Paid the ferryman.' })).toMatchObject({ ok: true });

    const history = (await eventsAbout(note.id)).filter((e) => e.type === 'note.edit');
    expect(history.map((e) => [e.before?.text, e.after?.text])).toEqual([
      ['Owes the ferryman.', 'Owes the ferryman two silver.'],
      ['Owes the ferryman two silver.', 'Paid the ferryman.'],
    ]);
  });

  it('only the text of a note can change, and notes are never deleted, not even by the GM', async () => {
    const note = await written(world.playerA, 'Keep this.');
    const moved = await world.playerA.db.from('notes').update({ about_actor_id: world.ashId }).eq('id', note.id).select();
    expect(moved.error?.code).toBe('42501');
    const erased = await world.gm.db.from('notes').delete().eq('id', note.id).select();
    expect(erased.data ?? []).toEqual([]);
    expect(must(await world.admin.from('notes').select('text').eq('id', note.id).single()).text).toBe('Keep this.');
  });
});
