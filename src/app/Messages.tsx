// Messaging (M5b step g4; M5 gate B3, ruled 2026-11-01; docs/05 "Messaging"; docs/06 Components "Messages";
// mockup design/mockups/m5-gate/b3-messaging.html). One private feature between the GM and a player only:
//   Messaging, the provider: loads the messages this person may read (live, with the log), keeps the unread count,
//   and opens the Messages screen full screen (the same panel as the log) for the ✉ button, the arrival card and
//   the Hit panel's Message….
//   MessagesButton, in the top row: ✉ with the unread count (in words for screen readers; a number, never a colour
//   alone). GM and players.
//   MessagesScreen: the list (GM: one thread per character in play; a player goes straight to their one thread with
//   the GM), a thread (newest at the bottom, the text field never takes focus by itself, A4; Attach, GM only; the
//   Disappears once read switch; Send, the accent button, Undo 6 s), and New message (the GM picks one or more
//   characters; a message to several lands in each thread; no Everyone).
//   MessageCard: the silent arrival card over a player's Scene ("✉ Message from the GM · Open"), no preview; it
//   stays until opened.
//   Offline, a send waits on this device ("Sends when back online") and goes when the connection is back; M9's queue
//   will take this over.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { fileLinks } from '../core/files.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import {
  ATTACHMENT_MAX_BYTES,
  attachmentPath,
  isRecipient,
  isUnread,
  loadCharactersInPlay,
  loadMessages,
  MESSAGE_FILES_BUCKET,
  MESSAGE_MAX,
  messageLine,
  readMessages,
  sendMessages,
  threadsByCharacter,
  toMarkRead,
  unreadCount,
  type Character,
  type Draft,
  type Message,
} from '../modules/messages/messages.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { Chip, Switch } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { LogPanel, useLogVersion } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import './Messages.css';

/** Where the screen opens: the list, a character's thread (the GM) or the one thread (a player), or a new message. */
export type MessagesView = { kind: 'list' } | { kind: 'thread'; actorId: string | null } | { kind: 'new'; text: string };

/** A send waiting for the connection to come back. */
interface Pending {
  id: string;
  to: Character[];
  draft: Draft;
}

interface MessagingValue {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  messages: Message[] | null;
  characters: Character[] | null;
  unread: number;
  pending: Pending[];
  reload: () => void;
  open: (view?: MessagesView) => void;
  /** Sends now, or keeps it for when the connection is back. Gives back whether it went (null: kept). */
  send: (to: Character[], draft: Draft) => Promise<boolean | null>;
}

const Context = createContext<MessagingValue | null>(null);

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export function Messaging({ db, user, campaign, children }: { db: Db; user: CurrentUser; campaign: OpenCampaign; children: ReactNode }) {
  const show = useToast();
  const logVersion = useLogVersion();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<MessagesView | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let current = true;
    void Promise.all([loadMessages(db, campaign.id), loadCharactersInPlay(db, campaign.id)]).then(([found, people]) => {
      if (!current) return;
      setMessages(found);
      setCharacters(people);
    });
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion, version]);

  const sendNow = useCallback(
    async (to: Character[], draft: Draft): Promise<boolean> => {
      const result = await runCommand(registry, db, user, sendMessages, { campaignId: campaign.id, to, draft });
      reload();
      if (!result.ok) {
        show({ text: result.message, error: true });
        return false;
      }
      const names = to.map((c) => c.name);
      show({
        text: user.roles[campaign.id] === 'gm' ? `Sent to ${names.join(', ') || 'the character'}` : 'Sent to the GM',
        onUndo: async () => {
          const eventId = await latestChange(db, campaign.id, 'message.send', user.id);
          const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
          reload();
          if (!undone?.ok) show({ text: undone?.message ?? 'Nothing to undo.', error: true });
        },
      });
      return true;
    },
    [db, user, campaign.id, reload, show],
  );

  const send = useCallback(
    async (to: Character[], draft: Draft): Promise<boolean | null> => {
      if (!online()) {
        setPending((p) => [...p, { id: crypto.randomUUID(), to, draft }]);
        show({ text: 'Sends when back online' });
        return null;
      }
      return sendNow(to, draft);
    },
    [sendNow, show],
  );

  // Back online: what waited goes, in order; whatever fails stays and the person is told.
  const waiting = useRef(pending);
  useEffect(() => {
    waiting.current = pending;
  }, [pending]);
  useEffect(() => {
    const flush = async () => {
      for (const item of waiting.current) {
        const went = await sendNow(item.to, item.draft);
        if (went) setPending((p) => p.filter((x) => x.id !== item.id));
      }
    };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [sendNow]);

  const value = useMemo<MessagingValue>(
    () => ({
      db,
      user,
      campaign,
      messages,
      characters,
      unread: messages ? unreadCount(messages, user) : 0,
      pending,
      reload,
      open: (next) => setView(next ?? { kind: 'list' }),
      send,
    }),
    [db, user, campaign, messages, characters, pending, reload, send],
  );

  return (
    <Context.Provider value={value}>
      {children}
      {view && (
        <LogPanel onClose={() => setView(null)} label="Messages">
          <MessagesScreen start={view} onClose={() => setView(null)} />
        </LogPanel>
      )}
    </Context.Provider>
  );
}

/** The Messages screen's opener, for the Hit panel's Message… (null outside a campaign). */
export function useMessaging(): MessagingValue | null {
  return useContext(Context);
}

// The ✉ button ----------------------------------------------------------------------------------------------------

/** The top row's ✉ with the unread count, inside a campaign, for the GM and players (not spectators). */
export function MessagesButton() {
  const messaging = useContext(Context);
  if (!messaging) return null;
  const role = messaging.user.roles[messaging.campaign.id];
  if (role !== 'gm' && role !== 'player') return null;
  const { unread } = messaging;
  return (
    <button type="button" className="log-button messages-button" aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'} onClick={() => messaging.open()}>
      <Icon name="messages" />
      {unread > 0 && (
        <span className="messages-button__count" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

// The arrival card ------------------------------------------------------------------------------------------------

/** A player's silent card on Scene while a message from the GM waits: no preview, stays until opened. */
export function MessageCard() {
  const messaging = useContext(Context);
  if (!messaging || messaging.unread === 0 || messaging.user.roles[messaging.campaign.id] === 'gm') return null;
  const { unread } = messaging;
  return (
    <article className="request message-card" aria-label="Message from the GM" data-prompt-id={`message-${unread}`}>
      <p className="request__title">{unread === 1 ? '✉ Message from the GM' : `✉ ${unread} messages from the GM`}</p>
      <button type="button" className="button-primary" onClick={() => messaging.open({ kind: 'thread', actorId: null })}>
        Open
      </button>
    </article>
  );
}

// The screen ------------------------------------------------------------------------------------------------------

export function MessagesScreen({ start, onClose }: { start: MessagesView; onClose: () => void }) {
  const messaging = useContext(Context);
  const gm = messaging ? messaging.user.roles[messaging.campaign.id] === 'gm' : false;
  // A player has one thread, so the list and New message both open it.
  const [view, setView] = useState<MessagesView>(() => (gm ? start : start.kind === 'new' ? start : { kind: 'thread', actorId: null }));
  if (!messaging) return null;
  const { messages, characters } = messaging;

  if (messages === null || characters === null) {
    return (
      <section className="messages" aria-label="Messages">
        <h2 className="messages__title">Messages</h2>
        <p className="messages__note">{messages === null && characters === null ? 'Loading…' : "Couldn't load the messages. Check your connection."}</p>
      </section>
    );
  }

  if (view.kind === 'new') {
    return <NewMessage text={view.text} onBack={() => (gm ? setView({ kind: 'list' }) : onClose())} onSent={() => (gm ? setView({ kind: 'list' }) : setView({ kind: 'thread', actorId: null }))} />;
  }

  if (view.kind === 'thread') {
    const character = view.actorId ? characters.find((c) => c.id === view.actorId) : undefined;
    const thread = view.actorId ? messages.filter((m) => m.actorId === view.actorId) : messages;
    // A player writes as their one character in play; with several, as the one picked (the first to start).
    const own = gm ? (character ? [character] : []) : characters.filter((c) => c.ownerUserId === messaging.user.id);
    return (
      <Thread
        title={gm ? (character?.name ?? 'A character') : 'The GM'}
        messages={thread}
        as={own}
        onBack={gm ? () => setView({ kind: 'list' }) : onClose}
      />
    );
  }

  const threads = threadsByCharacter(messages, characters, messaging.user);
  return (
    <section className="messages" aria-label="Messages">
      <div className="messages__bar">
        <h2 className="messages__title">Messages</h2>
        <span className="messages__meta">{messaging.campaign.name}</span>
        <button type="button" className="button-secondary" onClick={() => setView({ kind: 'new', text: '' })}>
          New message
        </button>
      </div>
      {threads.length === 0 ? (
        <p className="messages__note">No messages yet. Messages go to a player's character in play; nobody has one yet.</p>
      ) : (
        <ul className="messages__list">
          {threads.map((t) => (
            <li key={t.character.id}>
              <button type="button" className="messages__row" onClick={() => setView({ kind: 'thread', actorId: t.character.id })}>
                <span className="messages__row-text">
                  <span className="messages__name">{t.character.name}</span>
                  {t.latest ? <span className="messages__line">{`${t.latest.fromGm ? 'You' : t.character.name}: ${messageLine(t.latest)}`}</span> : <span className="messages__line messages__line--none">No messages yet</span>}
                </span>
                {t.unread > 0 && <span className="messages__count">{`${t.unread} unread`}</span>}
                <span className="messages__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A thread ------------------------------------------------------------------------------------------------------------

function Thread({ title, messages, as, onBack }: { title: string; messages: Message[]; as: Character[]; onBack: () => void }) {
  const messaging = useContext(Context)!;
  const { db, user, campaign, pending } = messaging;
  const show = useToast();
  const gm = user.roles[campaign.id] === 'gm';
  const [asId, setAsId] = useState<string | null>(as[0]?.id ?? null);
  const writingAs = as.find((c) => c.id === asId) ?? as[0] ?? null;
  const end = useRef<HTMLDivElement>(null);

  // Opening the thread reads the plain messages sent to me; a disappearing one waits for its Close.
  const toRead = toMarkRead(messages, user);
  const toReadKey = toRead.join(',');
  useEffect(() => {
    if (!toReadKey) return;
    void runCommand(registry, db, user, readMessages, { campaignId: campaign.id, messageIds: toReadKey.split(','), recipient: true }).then((result) => {
      if (result.ok) messaging.reload();
    });
    // The provider's reload is stable; only new unread ids should read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toReadKey, db, user, campaign.id]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending.length]);

  async function close(message: Message) {
    const result = await runCommand(registry, db, user, readMessages, { campaignId: campaign.id, messageIds: [message.id], recipient: true });
    if (!result.ok) show({ text: result.message, error: true });
    messaging.reload();
  }

  const mine = pending.filter((p) => (writingAs ? p.to.some((c) => c.id === writingAs.id) : true));
  return (
    <section className="messages" aria-label={`Messages with ${title}`}>
      <div className="messages__bar">
        {gm && (
          <button type="button" className="button-quiet messages__back" onClick={onBack}>
            ‹ Messages
          </button>
        )}
        <h2 className="messages__title">{title}</h2>
      </div>
      {messages.length === 0 && mine.length === 0 && <p className="messages__note">No messages yet.</p>}
      <ol className="messages__thread">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} name={m.fromGm ? (gm ? 'You' : 'The GM') : gm ? (as.find((c) => c.id === m.actorId)?.name ?? messaging.characters?.find((c) => c.id === m.actorId)?.name ?? 'A character') : 'You'} onClose={() => void close(m)} />
        ))}
        {mine.map((p) => (
          <li key={p.id} className="messages__bubble messages__bubble--mine">
            <span className="messages__who">You, waiting</span>
            {p.draft.body && <p className="messages__body">{p.draft.body}</p>}
            {p.draft.attachment && <p className="messages__attachment-line">{`📎 ${p.draft.attachment.name}`}</p>}
            <span className="messages__meta">Sends when back online</span>
          </li>
        ))}
        <div ref={end} />
      </ol>
      {writingAs ? (
        <>
          {!gm && as.length > 1 && (
            <div className="messages__chips" role="group" aria-label="Write as">
              {as.map((c) => (
                <Chip key={c.id} pressed={c.id === writingAs.id} onClick={() => setAsId(c.id)}>
                  {`${c.id === writingAs.id ? '✓ ' : ''}${c.name}`}
                </Chip>
              ))}
            </div>
          )}
          <Composer to={[writingAs]} onSent={() => undefined} />
        </>
      ) : (
        <p className="messages__note">{gm ? 'This character is no longer in play.' : 'You can write to the GM once you have a character in play.'}</p>
      )}
    </section>
  );
}

/** One message: who and when, the text, the picture (a thumbnail; tap for the full size), and its marks. */
function Bubble({ message, name, onClose }: { message: Message; name: string; onClose: () => void }) {
  const messaging = useContext(Context)!;
  const { db, user } = messaging;
  const mine = !isRecipient(message, user);
  const unreadDisappearing = message.disappears && isUnread(message, user);
  const [link, setLink] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const attachment = message.attachment;
  useEffect(() => {
    if (!attachment) return;
    let current = true;
    const path = attachmentPath(message.campaignId, message.id);
    void fileLinks(db, [path], Date.now(), MESSAGE_FILES_BUCKET).then((links) => current && setLink(links.get(path) ?? null));
    return () => {
      current = false;
    };
  }, [db, attachment, message.campaignId, message.id]);
  const marks = [
    message.disappears ? 'Disappears once read' : '',
    mine ? (message.readAt ? 'read' : 'unread') : '',
  ].filter(Boolean);
  return (
    <li className={mine ? 'messages__bubble messages__bubble--mine' : 'messages__bubble'}>
      <span className="messages__who">{`${name}, ${when(message.sentAt)}`}</span>
      {message.body && <p className="messages__body">{message.body}</p>}
      {attachment && (
        <button type="button" className="messages__attachment" onClick={() => setFull(true)} aria-label={`Open the picture ${attachment.name}`}>
          {link ? <img className="messages__thumb" src={link} alt="" /> : <span className="messages__thumb messages__thumb--empty" aria-hidden="true" />}
          <span className="messages__attachment-name">{attachment.name}</span>
        </button>
      )}
      {marks.length > 0 && <span className="messages__meta">{marks.join(', ')}</span>}
      {unreadDisappearing && (
        <span className="messages__close">
          <span className="messages__meta">Gone from this device once you close it.</span>
          <button type="button" className="button-secondary" aria-label="Close the message" onClick={onClose}>
            Close
          </button>
        </span>
      )}
      {full && attachment && (
        <Dialog label={attachment.name} onClose={() => setFull(false)}>
          {link ? <img className="messages__full" src={link} alt={attachment.name} /> : <p className="messages__note">The picture isn't available right now.</p>}
        </Dialog>
      )}
    </li>
  );
}

function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// New message (the GM) --------------------------------------------------------------------------------------------------

function NewMessage({ text, onBack, onSent }: { text: string; onBack: () => void; onSent: () => void }) {
  const messaging = useContext(Context)!;
  const show = useToast();
  const characters = messaging.characters ?? [];
  const gm = messaging.user.roles[messaging.campaign.id] === 'gm';
  const own = gm ? characters : characters.filter((c) => c.ownerUserId === messaging.user.id);
  const [to, setTo] = useState<Character[]>(own.length === 1 ? [own[0]!] : []);
  const picked = (id: string) => to.some((c) => c.id === id);
  const toggle = (c: Character) => setTo((now) => (now.some((x) => x.id === c.id) ? now.filter((x) => x.id !== c.id) : gm ? [...now, c] : [c]));
  return (
    <section className="messages" aria-label="New message">
      <div className="messages__bar">
        {gm && (
          <button type="button" className="button-quiet messages__back" onClick={onBack}>
            ‹ Messages
          </button>
        )}
        <h2 className="messages__title">New message</h2>
      </div>
      {own.length === 0 ? (
        <p className="messages__note">{gm ? 'Nobody to write to yet: no player has a character in play.' : 'You can write to the GM once you have a character in play.'}</p>
      ) : (
        <div className="messages__chips" role="group" aria-label={gm ? 'To' : 'Write as'}>
          {own.map((c) => (
            <Chip key={c.id} pressed={picked(c.id)} onClick={() => toggle(c)}>
              {`${picked(c.id) ? '✓ ' : ''}${c.name}`}
            </Chip>
          ))}
        </div>
      )}
      {gm && <p className="messages__note">Pick one or more characters: a message to several lands in each one's thread. What everyone hears, say aloud.</p>}
      <Composer
        to={to}
        initial={text}
        onSent={onSent}
        before={() => {
          if (to.length === 0) {
            show({ text: gm ? 'Pick at least one character.' : 'Pick the character you write as.', error: true });
            return false;
          }
          return true;
        }}
      />
    </section>
  );
}

// The composer ----------------------------------------------------------------------------------------------------------

function Composer({ to, initial = '', before, onSent }: { to: Character[]; initial?: string; before?: () => boolean; onSent: () => void }) {
  const messaging = useContext(Context)!;
  const show = useToast();
  const field = useId();
  const gm = messaging.user.roles[messaging.campaign.id] === 'gm';
  const [body, setBody] = useState(initial);
  const [disappears, setDisappears] = useState(false);
  const [attachment, setAttachment] = useState<{ blob: Blob; name: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  function pick(file: File | undefined) {
    setAttaching(false);
    if (!file) return;
    if (!file.type.startsWith('image/')) return show({ text: "That isn't a picture. Choose a photo or image file.", error: true });
    if (file.size > ATTACHMENT_MAX_BYTES) return show({ text: 'That picture is too large. Choose one under 10 MB.', error: true });
    setAttachment({ blob: file, name: file.name });
  }

  async function send() {
    if (busy) return;
    if (before && !before()) return;
    if (!body.trim() && !attachment) return show({ text: 'Write something to send.', error: true });
    setBusy(true);
    const went = await messaging.send(to, { body, disappears, attachment });
    setBusy(false);
    if (went === false) return;
    setBody('');
    setAttachment(null);
    setDisappears(false);
    onSent();
  }

  return (
    <div className="messages__composer">
      <div className="messages__write">
        <label className="field messages__field" htmlFor={field}>
          <span className="label">Message</span>
          <textarea id={field} className="field__input field__textarea" rows={3} maxLength={MESSAGE_MAX} placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {/* Attach and Send together, their foot on the field's foot, wrapping under it on a phone (tf-9). */}
        <div className="messages__send">
          {gm && (
            <button type="button" className="button-secondary" onClick={() => setAttaching(true)}>
              Attach
            </button>
          )}
          <button type="button" className="button-primary" onClick={() => void send()}>
            Send
          </button>
        </div>
      </div>
      {attachment && (
        <p className="messages__attachment-line">
          {`📎 ${attachment.name}`}{' '}
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setAttachment(null)}>
            Remove
          </button>
        </p>
      )}
      <div className="messages__options">
        <Switch label="Disappears once read" on={disappears} onChange={setDisappears} />
        <span className="messages__meta">This message disappears once they've read it.</span>
      </div>
      <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {attaching && (
        <Dialog label="Attach" onClose={() => setAttaching(false)}>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setAttaching(false);
              show({ text: 'No handouts yet: Handouts come with M8b. Attach a file for now.' });
            }}
          >
            Handouts
          </button>
          <button type="button" className="button-secondary" onClick={() => picker.current?.click()}>
            A file
          </button>
          <p className="messages__note">A picture from this device, up to 10 MB. From the adventure comes with M8b.</p>
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setAttaching(false)}>
            Cancel
          </button>
        </Dialog>
      )}
    </div>
  );
}
