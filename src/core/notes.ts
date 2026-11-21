// Notes: free text from anyone in the campaign, optionally about a character or added to a log entry. They're
// logged like every change (note.add, note.edit; an edit keeps the old text in the log) and never deleted.
// A note on a log entry is seen only by people who can see that entry (the database copies its audience).
import { defineCommand, failed, fromWrite, isGm, isMember, ok, type CommandResult } from './commands.ts';
import type { Db } from './supabase.ts';

export interface Note {
  id: string;
  campaignId: string;
  authorUserId: string | null;
  text: string;
  aboutActorId: string | null;
  annotatesEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteRef = Pick<Note, 'id' | 'campaignId' | 'authorUserId'>;

const MAX = 2000;

/** The text to save, or a plain-words problem. */
function cleanText(text: string): { ok: true; text: string } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: 'Write something first.' };
  if (trimmed.length > MAX) return { ok: false, message: `Keep a note under ${MAX} characters.` };
  return { ok: true, text: trimmed };
}

type NoteRow = {
  id: string;
  campaign_id: string;
  created_by: string | null;
  text: string;
  about_actor_id: string | null;
  annotates_event_id: string | null;
  created_at: string;
  updated_at: string;
};
const COLUMNS = 'id, campaign_id, created_by, text, about_actor_id, annotates_event_id, created_at, updated_at';
const toNote = (row: NoteRow): Note => ({
  id: row.id,
  campaignId: row.campaign_id,
  authorUserId: row.created_by,
  text: row.text,
  aboutActorId: row.about_actor_id,
  annotatesEventId: row.annotates_event_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** The notes this person may see in the campaign, oldest first. Null if they couldn't be loaded. */
export async function loadNotes(db: Db, campaignId: string): Promise<Note[] | null> {
  const { data, error } = await db.from('notes').select(COLUMNS).eq('campaign_id', campaignId).order('created_at', { ascending: true });
  return error ? null : (data as NoteRow[]).map(toNote);
}

/** The campaign's people by name, and which of them are its GM: who wrote each note ("by Priya", "from your GM"). */
export async function loadNoteAuthors(db: Db, campaignId: string): Promise<{ names: Map<string, string>; gms: Set<string> }> {
  const { data } = await db.from('members').select('user_id, base_role, profiles!members_user_id_fkey(display_name)').eq('campaign_id', campaignId);
  const rows = (data ?? []) as unknown as { user_id: string; base_role: string; profiles: { display_name: string | null } | null }[];
  return { names: new Map(rows.map((m) => [m.user_id, m.profiles?.display_name ?? 'someone'])), gms: new Set(rows.filter((m) => m.base_role === 'gm').map((m) => m.user_id)) };
}

export const addNote = defineCommand({
  name: 'note.add',
  target: (input: { campaignId: string; text: string; aboutActorId?: string; annotatesEventId?: string }) => ({
    campaignId: input.campaignId,
  }),
  allowed: (user, target) => isMember(user, target.campaignId),
  run: async (db: Db, _user, input): Promise<CommandResult<Note>> => {
    const text = cleanText(input.text);
    if (!text.ok) return failed(text.message);
    const saved = fromWrite(
      await db
        .from('notes')
        .insert({
          campaign_id: input.campaignId,
          text: text.text,
          about_actor_id: input.aboutActorId ?? null,
          annotates_event_id: input.annotatesEventId ?? null,
        })
        .select(COLUMNS),
    );
    return saved.ok ? ok(toNote(saved.value as NoteRow)) : saved;
  },
});

export const editNote = defineCommand({
  name: 'note.edit',
  // The edit shows in the verbose log, with the old text; the note itself shows its new text.
  log: 'verbose',
  target: (input: { note: NoteRef; text: string }) => input.note,
  // Your own notes; the GM's, any.
  allowed: (user, note) => isMember(user, note.campaignId) && (isGm(user, note.campaignId) || note.authorUserId === user.id),
  run: async (db: Db, _user, input): Promise<CommandResult<Note>> => {
    const text = cleanText(input.text);
    if (!text.ok) return failed(text.message);
    const saved = fromWrite(await db.from('notes').update({ text: text.text }).eq('id', input.note.id).select(COLUMNS));
    return saved.ok ? ok(toNote(saved.value as NoteRow)) : saved;
  },
});
