// Messaging (M5b step g4; M5 gate B3, ruled 2026-11-01; docs/05 "Messaging"; docs/03 "Messaging" row;
// supabase/migrations/20261102120000_m5b_g4_messages.sql): one private feature between the GM and a player only.
// The GM sees one thread per character in play; a player sees one thread with the GM (every message about their
// characters). A message is text, a picture from the GM's device (the GM only, up to 10 MB; ruled 2026-11-01), or
// both. "Disappears once read" hides it from its recipient once they close it (the GM's log keeps the text). Only
// the two parties' devices receive a message or its file: the database and the bucket's rules say so. Send has
// Undo (6 s, the toast): a reversing event marks the message undone.
import { defineCommand, failed, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { latestChange } from '../../core/undo.ts';

/** The longest message the database takes. */
export const MESSAGE_MAX = 4000;
/** The largest picture a message carries (ruled 2026-11-01: 10 MB), enforced by the bucket and the record. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Where a message's picture lives, at <campaign id>/<message id>. */
export const MESSAGE_FILES_BUCKET = 'message-files';
export const attachmentPath = (campaignId: string, messageId: string) => `${campaignId}/${messageId}`;

export interface Attachment {
  name: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  campaignId: string;
  /** The character the thread is about. */
  actorId: string;
  /** The character's player when it was sent. */
  playerUserId: string;
  fromGm: boolean;
  senderUserId: string | null;
  body: string;
  attachment: Attachment | null;
  disappears: boolean;
  readAt: string | null;
  sentAt: string;
}

export function toMessage(row: Record<string, unknown>): Message {
  const name = typeof row.attachment_name === 'string' ? row.attachment_name : null;
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    actorId: String(row.actor_id),
    playerUserId: String(row.player_user_id),
    fromGm: row.from_gm === true,
    senderUserId: typeof row.sender_user_id === 'string' ? row.sender_user_id : null,
    body: String(row.body ?? ''),
    attachment: name ? { name, type: String(row.attachment_type ?? 'image/jpeg'), size: Number(row.attachment_size ?? 0) } : null,
    disappears: row.disappears === true,
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    sentAt: String(row.created_at ?? ''),
  };
}

const COLUMNS = 'id, campaign_id, actor_id, player_user_id, from_gm, sender_user_id, body, attachment_name, attachment_type, attachment_size, disappears, read_at, created_at';

/** The messages this person may read in the campaign (the database decides), oldest first. Null if they couldn't be loaded. */
export async function loadMessages(db: Db, campaignId: string): Promise<Message[] | null> {
  const { data, error } = await db.from('messages').select(COLUMNS).eq('campaign_id', campaignId).eq('undone', false).order('created_at', { ascending: true }).limit(500);
  if (error) return null;
  return (data ?? []).map((row) => toMessage(row as Record<string, unknown>));
}

/** Whether this person is the one a message was sent to (the player for the GM's, the GM for a player's). */
export const isRecipient = (message: Message, user: CurrentUser): boolean =>
  message.fromGm ? message.playerUserId === user.id : isGm(user, message.campaignId);

/** Sent to this person and not read yet. */
export const isUnread = (message: Message, user: CurrentUser): boolean => isRecipient(message, user) && message.readAt === null;

/** What the ✉ icon counts. Pure. */
export const unreadCount = (messages: readonly Message[], user: CurrentUser): number => messages.filter((m) => isUnread(m, user)).length;

/**
 * The plain (not disappearing) messages to this person that opening the thread marks read. A disappearing one is
 * read only when its recipient closes it. Pure.
 */
export const toMarkRead = (messages: readonly Message[], user: CurrentUser): string[] =>
  messages.filter((m) => isUnread(m, user) && !m.disappears).map((m) => m.id);

/** Someone a message can be about: a player's character in play. */
export interface Character {
  id: string;
  name: string;
  ownerUserId: string;
}

/** A thread: a character and the messages about it, oldest first. */
export interface Thread {
  character: Character;
  messages: Message[];
  unread: number;
  /** The newest message, for the list's line. */
  latest: Message | null;
}

/**
 * The GM's Messages list: one thread per character in play (an empty one for a character nobody has written to),
 * the newest-written first, then by name. Pure.
 */
export function threadsByCharacter(messages: readonly Message[], characters: readonly Character[], user: CurrentUser): Thread[] {
  const threads = characters.map((character) => {
    const about = messages.filter((m) => m.actorId === character.id);
    return { character, messages: about, unread: unreadCount(about, user), latest: about[about.length - 1] ?? null };
  });
  return threads.sort((a, b) => {
    if (a.latest && b.latest) return b.latest.sentAt.localeCompare(a.latest.sentAt);
    if (a.latest || b.latest) return a.latest ? -1 : 1;
    return a.character.name.localeCompare(b.character.name);
  });
}

/** The players' characters in play in the campaign (the people messages are about). Null if they couldn't be loaded. */
export async function loadCharactersInPlay(db: Db, campaignId: string): Promise<Character[] | null> {
  const { data, error } = await db
    .from('actors')
    .select('id, name, owner_user_id')
    .eq('campaign_id', campaignId)
    .eq('kind', 'pc')
    .eq('approval', 'approved')
    .eq('status', 'active')
    .eq('owner_type', 'user')
    .order('name');
  if (error) return null;
  return (data ?? []).filter((a) => a.owner_user_id).map((a) => ({ id: String(a.id), name: String(a.name), ownerUserId: String(a.owner_user_id) }));
}

/** A line for the list and the card: the text's first words, or the picture's name. Pure. */
export function messageLine(message: Message, max = 80): string {
  const text = message.body.trim() || (message.attachment ? `📎 ${message.attachment.name}` : '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** What Send carries. */
export interface Draft {
  body: string;
  disappears: boolean;
  /** A picture from the device (the GM only). */
  attachment: { blob: Blob; name: string } | null;
}

/**
 * Send (message.send): to one or more characters (the GM), or to the GM as one of the player's own characters; a
 * message to several lands in each one's thread. The picture, if any, is uploaded next to each message made; if that
 * fails the send is taken back and the person told. Undo (6 s) marks the messages undone.
 */
export const sendMessages = defineCommand({
  name: 'message.send',
  log: 'simple',
  target: (input: { campaignId: string; to: { id: string; ownerUserId: string }[]; draft: Draft }) => ({
    campaignId: input.campaignId,
    attaching: input.draft.attachment !== null,
    owners: input.to.map((c) => c.ownerUserId),
  }),
  // The GM writes to anyone; a player only as their own character, without a file (the database says the same).
  allowed: (user: CurrentUser, target: { campaignId: string; attaching: boolean; owners: string[] }) =>
    isGm(user, target.campaignId) || (isMember(user, target.campaignId) && !target.attaching && target.owners.length > 0 && target.owners.every((owner) => owner === user.id)),
  run: async (db, user, input): Promise<CommandResult<Message[]>> => {
    const { draft } = input;
    const attachment = draft.attachment;
    if (attachment && attachment.blob.size > ATTACHMENT_MAX_BYTES) return failed('That picture is too large. Choose one under 10 MB.');
    const { data, error } = await db.rpc('send_messages', {
      campaign: input.campaignId,
      to_characters: input.to.map((c) => c.id),
      body: draft.body.trim(),
      disappears: draft.disappears,
      ...(attachment ? { attachment: { name: attachment.name.slice(0, 200) || 'Picture', type: attachment.blob.type || 'image/jpeg', size: attachment.blob.size } } : {}),
    });
    if (error) return fromError(error);
    const made = (Array.isArray(data) ? data : []).map((row) => toMessage(row as Record<string, unknown>));
    if (attachment) {
      for (const message of made) {
        const upload = await db.storage
          .from(MESSAGE_FILES_BUCKET)
          .upload(attachmentPath(message.campaignId, message.id), attachment.blob, { upsert: false, contentType: attachment.blob.type || 'image/jpeg' });
        if (upload.error) {
          // Take the send back (the same reversing event as Undo), so no message points at a picture that never came.
          const eventId = await latestChange(db, input.campaignId, 'message.send', user.id);
          if (eventId) await db.rpc('undo_request_said', { event_id: eventId });
          return failed("Couldn't upload the picture. Check your connection and try again.");
        }
      }
    }
    return ok(made);
  },
});

/**
 * Read (message.read): the recipient has read these. `recipient` is the app's copy of who may; the real gate is
 * public.read_messages, which marks only the caller's own unread ones and refuses anyone else.
 */
export const readMessages = defineCommand({
  name: 'message.read',
  log: 'verbose',
  target: (input: { campaignId: string; messageIds: string[]; recipient: boolean }) => ({ campaignId: input.campaignId, recipient: input.recipient }),
  allowed: (user: CurrentUser, target: { campaignId: string; recipient: boolean }) => isMember(user, target.campaignId) && target.recipient,
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    const { data, error } = await db.rpc('read_messages', { message_ids: input.messageIds });
    if (error) return fromError(error);
    return ok(typeof data === 'number' ? data : 0);
  },
});

export const MESSAGE_COMMANDS = [sendMessages, readMessages] as const;
