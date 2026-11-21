import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import {
  describeEntry,
  groupEntries,
  loadLog,
  loadLogNames,
  packUpdateLists,
  watchLog,
  type LogEntry,
  type LogEvent,
  type LogNames,
} from '../core/events.ts';
import { addNote, editNote, loadNotes, type Note } from '../core/notes.ts';
import { loadParty, type PartyMember } from '../core/party.ts';
import type { Db } from '../core/supabase.ts';
import { cameBackText, mayUndo, undoChange, type CameBack } from '../core/undo.ts';
import { runOfEntry, undoActivity } from '../modules/expedition/activityPlay.ts';
import { denominationsOf } from '../modules/inventory/coinWords.ts';
import { coinAmountIn } from '../modules/inventory/purse.ts';
import { loadCampaignSetting } from './campaignSetting.ts';
import { setPlaceMap } from '../modules/expedition/placeMap.ts';
import { undoAddedMap } from './PlaceMap.tsx';
import { registry } from './services.ts';
import './LogView.css';

/** The run an activity's line made (M5b step 3), not yet undone: its Undo is the activity's own. */
const activityRunOf = (entry: LogEntry): string | null =>
  entry.main.type === 'activity.apply' ? runOfEntry(entry.events) : null;
import { useErrorToast } from '../ui/ToastHost.tsx';

// The campaign's log: newest first, simple by default, every change with Verbose. Updates live; shows only
// what this person may see (the database's rules decide). It opens from the top row's Log button (2026-10-23);
// Scene shows a few recent lines (`recent`), read only, with no full-log link.
// Anyone writes a note (optionally about a character). Tap a line for its actions: add a note to it, Undo
// (your own lines; the GM's on every line; not for making or deleting things), or edit your note.
export function LogView({
  db,
  user,
  campaignId,
  onChanged,
  recent,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  /** Something changed through the log (an undo), so the screen around it can refresh. */
  onChanged?: () => void;
  /** Only the newest few lines, read only (Scene). */
  recent?: number;
}) {
  const [events, setEvents] = useState<LogEvent[] | null | 'error'>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [party, setParty] = useState<PartyMember[]>([]);
  const [names, setNames] = useState<LogNames | null>(null);
  const [verbose, setVerbose] = useState(false);
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const setProblem = useErrorToast();
  const [writing, setWriting] = useState(() => drafts.has(campaignId));
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    // The newest page, the notes, and fresh names (a new entry may mention a new character or company).
    const load = () =>
      Promise.all([
        loadLog(db, campaignId, { verbose }),
        loadLogNames(db, campaignId, user.id),
        loadNotes(db, campaignId),
        loadParty(db, campaignId),
        // The setting's coin names for the purse lines (December step 6b); without them a coin shows by its key.
        loadCampaignSetting(db, user.id, campaignId).catch(() => null),
      ]).then(
        ([page, found, foundNotes, foundParty, setting]) => {
          if (!current) return;
          // Spells by their pack id (dec-8 B): a cast's line names the spell ("cast Mire lamp for Wren"), from the setting the reader's device has.
          setNames({ ...found, coinAmount: coinAmountIn(denominationsOf(setting?.rulesSets ?? [])), spells: new Map((setting?.all ?? []).filter((e) => e.kind === 'spell').map((e) => [e.packEntryId, e.name])) });
          setNotes(foundNotes ?? []);
          setParty(foundParty ?? []);
          if (!page) return setEvents('error');
          setEvents(page.events);
          setMore(page.more);
        },
        () => current && setEvents('error'),
      );
    void load();
    // One action can write several events at once; wait a moment and refresh once.
    const stop = watchLog(db, campaignId, () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void load(), 250);
    });
    return () => {
      current = false;
      stop();
      if (pending.current) clearTimeout(pending.current);
    };
  }, [db, campaignId, user.id, verbose, version]);

  async function older() {
    if (!Array.isArray(events) || events.length === 0) return;
    setLoadingOlder(true);
    const page = await loadLog(db, campaignId, { verbose, olderThan: events.at(-1)!.seq });
    setLoadingOlder(false);
    if (!page) return;
    setEvents([...events, ...page.events]);
    setMore(page.more);
  }

  /**
   * Runs an action from the log, then refreshes it. A refused action that may still have changed something (`changed`:
   * the log's Undo of a shown map can hide it and then be refused the untie) refreshes too, and keeps its problem text.
   */
  async function act<T>(action: () => Promise<{ ok: boolean; message?: string; value?: T; changed?: boolean }>, done: string | ((value: T | undefined) => string), changesData = false) {
    setBusy(true);
    setNotice(null);
    setProblem(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message ?? 'Something went wrong.');
      if (result.changed) {
        setVersion((v) => v + 1);
        if (changesData) onChanged?.();
      }
      return false;
    }
    setNotice(typeof done === 'function' ? done(result.value) : done);
    setOpen(null);
    setVersion((v) => v + 1);
    if (changesData) onChanged?.();
    return true;
  }

  const gm = isGm(user, campaignId);
  const loaded = Array.isArray(events) ? events : [];
  const eventIds = new Set(loaded.map((e) => e.id));
  // What each undo undid, for its line ("You undid a drop: …").
  const named = names && { ...names, eventTypes: new Map(loaded.map((e) => [e.id, e.type])) };
  const undone = new Set(loaded.flatMap((e) => (e.revertsEventId ? [e.revertsEventId] : [])));
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const mayEdit = (note: Note) => gm || note.authorUserId === user.id;
  // A note added to an entry on this page shows under that entry, not as a line of its own.
  const entries = groupEntries(loaded).filter(
    (entry) => !(entry.main.type === 'note.add' && eventIds.has(String(entry.main.after?.annotates_event_id ?? ''))),
  );

  if (recent !== undefined) {
    const lines = entries.slice(0, recent);
    return (
      <section className="log log--recent" aria-label="Recently">
        <h2 className="log__title">Recently</h2>
        {events === null && <p role="status">Opening…</p>}
        {events === 'error' && (
          <p className="form-error" role="alert">
            Couldn't load the log. Check your connection and try again.
          </p>
        )}
        {Array.isArray(events) && lines.length === 0 && <p className="auth__meta">Nothing logged yet.</p>}
        {lines.length > 0 && names && (
          <ol className="log__list">
            {lines.map((entry) => (
              <li key={entry.main.id} className="log__entry">
                <p className="log__line">{describeEntry(entry, named ?? names)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  return (
    <section className="log" aria-label="Log">
      <div className="log__head">
        <h2 className="log__title">Log</h2>
        <label className="check log__verbose">
          <input type="checkbox" checked={verbose} onChange={(event) => setVerbose(event.target.checked)} />
          <span>Verbose: every change, like each HP tick</span>
        </label>
      </div>

      {writing ? (
        <NoteForm
          label="Note"
          submit="Save note"
          busy={busy}
          about={party}
          initial={drafts.get(campaignId) ?? ''}
          onDraft={(text) => (text ? drafts.set(campaignId, text) : drafts.delete(campaignId))}
          onCancel={() => {
            drafts.delete(campaignId);
            setWriting(false);
          }}
          onSave={async (text, aboutActorId) => {
            if (await act(() => runCommand(registry, db, user, addNote, { campaignId, text, aboutActorId }), 'Note saved.')) {
              drafts.delete(campaignId);
              setWriting(false);
            }
          }}
        />
      ) : (
        <button type="button" className="button-secondary log__write" onClick={() => setWriting(true)}>
          Write a note
        </button>
      )}

      {notice && (
        <p className="log__notice" role="status">
          {notice}
        </p>
      )}
      {events === null && <p role="status">Opening…</p>}
      {events === 'error' && (
        <p className="form-error" role="alert">
          Couldn't load the log. Check your connection and try again.
        </p>
      )}
      {Array.isArray(events) && entries.length === 0 && (
        <p className="auth__meta">The log is blank. What happens at the table is kept here.</p>
      )}
      {entries.length > 0 && names && (
        <ol className="log__list">
          {entries.map((entry) => (
            <LogLine
              key={entry.main.id}
              entry={entry}
              line={describeEntry(entry, named ?? names)}
              open={open === entry.main.id}
              onToggle={() => setOpen(open === entry.main.id ? null : entry.main.id)}
              note={entry.main.targetTable === 'notes' ? noteById.get(entry.main.targetId ?? '') : undefined}
              annotations={notes.filter((n) => entry.events.some((e) => e.id === n.annotatesEventId))}
              names={names}
              undone={entry.events.some((e) => undone.has(e.id))}
              canUndo={
                (gm || entry.main.actorUserId === user.id) && (mayUndo(entry.main.type, entry.events) || activityRunOf(entry) !== null)
              }
              mayEdit={mayEdit}
              busy={busy}
              onUndo={() =>
                act(
                  () => {
                    // An activity (M5b step 3) has its own undo: the yield it made comes out of the pack (D3).
                    const runId = activityRunOf(entry);
                    if (runId) {
                      return runCommand(registry, db, user, undoActivity, { campaignId, runId, authorUserId: entry.main.actorUserId }).then((r) =>
                        r.ok ? { ok: true as const, value: null } : r,
                      );
                    }
                    // A map added to a place: the same path as the toast's Undo, so a map shown since is hidden from the
                    // players again before the place is untied (#958's re-review).
                    const mapId = entry.main.type === setPlaceMap.name ? entry.main.after?.map_asset_id : null;
                    if (typeof mapId === 'string') {
                      // A refusal may come after the hide stood (Hidden, but still tied), so the log and the Scene's
                      // eye read again whatever the outcome; reading again when nothing changed is harmless.
                      return undoAddedMap(db, user, campaignId, mapId, entry.main.id, entry.main.actorUserId).then((outcome) =>
                        outcome?.error ? { ok: false as const, message: outcome.text, changed: true } : { ok: true as const, value: null },
                      );
                    }
                    return runCommand(registry, db, user, undoChange, { campaignId, eventId: entry.main.id, authorUserId: entry.main.actorUserId });
                  },
                  // A give some of which was used: what's left came back, and how much was used (5b).
                  (back: CameBack | null | undefined) => cameBackText(back ?? null) ?? 'Undone.',
                  true,
                )
              }
              onAnnotate={(text) =>
                act(() => runCommand(registry, db, user, addNote, { campaignId, text, annotatesEventId: entry.main.id }), 'Note added.')
              }
              onEdit={(note, text) => act(() => runCommand(registry, db, user, editNote, { note, text }), 'Note saved.')}
            />
          ))}
        </ol>
      )}
      {more && (
        <button type="button" className="button-secondary" aria-busy={loadingOlder} onClick={() => void older()}>
          {loadingOlder ? 'Loading…' : 'Show older'}
        </button>
      )}
    </section>
  );
}

// One line of the log. Tapping it shows what you can do with it.
function LogLine({
  entry,
  line,
  open,
  onToggle,
  note,
  annotations,
  names,
  undone,
  canUndo,
  mayEdit,
  busy,
  onUndo,
  onAnnotate,
  onEdit,
}: {
  entry: LogEntry;
  line: string;
  open: boolean;
  onToggle: () => void;
  /** The note itself, for a "wrote a note" line. */
  note: Note | undefined;
  /** Notes people added to this line. */
  annotations: Note[];
  names: LogNames;
  undone: boolean;
  canUndo: boolean;
  mayEdit: (note: Note) => boolean;
  busy: boolean;
  onUndo: () => Promise<boolean>;
  onAnnotate: (text: string) => Promise<boolean>;
  onEdit: (note: Note, text: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<'menu' | 'annotate' | Note>('menu');
  const actionsId = useId();
  const author = (n: Note) => (n.authorUserId === names.me ? 'You' : (names.people.get(n.authorUserId ?? '') ?? 'Someone'));
  const edited = (n: Note) => n.updatedAt > n.createdAt;

  return (
    <li className="log__entry">
      <button type="button" className="log__line-button" aria-expanded={open} aria-controls={actionsId} onClick={onToggle}>
        <span className="log__line">{line}</span>
        {note && entry.main.type === 'note.add' && <span className="log__note-text">{note.text}</span>}
        {entry.main.fiat && entry.main.reason && <span className="log__reason">Reason: {entry.main.reason}</span>}
        {entry.main.type === 'note.edit' && typeof entry.main.before?.text === 'string' && (
          <span className="log__note-text">Was: {entry.main.before.text}</span>
        )}
        <span className="log__meta">
          <time dateTime={entry.main.createdAt}>{when(entry.main.createdAt)}</time>
          {entry.main.fiat && (
            <span className="log__fiat">
              {', '}
              <Seal /> Fiat
            </span>
          )}
          {entry.main.level === 'verbose' && ', verbose'}
          {undone && ', undone'}
          {note && entry.main.type === 'note.add' && edited(note) && ', edited'}
        </span>
      </button>

      {annotations.length > 0 && (
        <ul className="log__annotations">
          {annotations.map((n) => (
            <li key={n.id} className="log__annotation">
              <span>
                <strong>{author(n)}:</strong> {n.text}
                {edited(n) && <span className="log__meta">, edited</span>}
              </span>
              {mayEdit(n) && (
                <button type="button" className="button-secondary button-secondary--small" aria-label={`Edit note: ${n.text}`} onClick={() => setMode(n)}>
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {(open || typeof mode === 'object') && (
        <div id={actionsId} className="log__actions">
          {mode === 'menu' && (
            <>
              {entry.main.type === 'library.update' && <PackUpdateList entry={entry} />}
              <button type="button" className="button-secondary" aria-label={`Add a note to: ${line}`} onClick={() => setMode('annotate')}>
                Add a note to this
              </button>
              {note && mayEdit(note) && (
                <button type="button" className="button-secondary" aria-label={`Edit note: ${note.text}`} onClick={() => setMode(note)}>
                  Edit note
                </button>
              )}
              {canUndo && !undone && (
                <button type="button" className="button-secondary button-secondary--small" aria-label={`Undo: ${line}`} aria-busy={busy} onClick={() => void onUndo()}>
                  Undo
                </button>
              )}
            </>
          )}
          {mode === 'annotate' && (
            <NoteForm
              label={`Note on: ${line}`}
              submit="Add note"
              busy={busy}
              onCancel={() => setMode('menu')}
              onSave={async (text) => {
                if (await onAnnotate(text)) setMode('menu');
              }}
            />
          )}
          {typeof mode === 'object' && (
            <NoteForm
              label="Edit note"
              submit="Save note"
              initial={mode.text}
              busy={busy}
              onCancel={() => setMode('menu')}
              onSave={async (text) => {
                if (await onEdit(mode, text)) setMode('menu');
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

// A new note's unsaved words, by campaign: closing the log (or Escape) keeps them for next time; Cancel and Save
// clear them (ruled 2026-10-24). Kept on this device until the page reloads.
const drafts = new Map<string, string>();

// Writing or editing a note: the text, and (for a new note) which character it's about, if any.
function NoteForm({
  label,
  submit,
  initial = '',
  about,
  busy,
  onSave,
  onCancel,
  onDraft,
}: {
  label: string;
  submit: string;
  initial?: string;
  about?: PartyMember[];
  busy: boolean;
  onSave: (text: string, aboutActorId?: string) => Promise<void>;
  onCancel: () => void;
  onDraft?: (text: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [aboutId, setAboutId] = useState('');
  // "About…" stays quiet until wanted (ruled 2026-10-24, tentative): one-tap name buttons, the choice as a chip.
  const [picking, setPicking] = useState(false);
  const [explained, setExplained] = useState(false);

  function save(event: FormEvent) {
    event.preventDefault();
    void onSave(text, aboutId || undefined);
  }

  return (
    <form className="log__form" onSubmit={save} noValidate>
      <div className="field">
        <label className="label" htmlFor={`${id}-text`}>
          {label}
        </label>
        <textarea
          id={`${id}-text`}
          className="field__input field__textarea"
          rows={3}
          maxLength={2000}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onDraft?.(event.target.value);
          }}
        />
      </div>
      {about && about.length > 0 && (
        <div className="log__about">
          {aboutId ? (
            <span className="log__chip">
              About {about.find((m) => m.id === aboutId)?.name}
              <button type="button" className="log__chip-clear" aria-label="Not about anyone" onClick={() => setAboutId('')}>
                ×
              </button>
            </span>
          ) : picking ? (
            <div className="log__about-names" role="group" aria-label="About">
              {about.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setAboutId(member.id);
                    setPicking(false);
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setPicking(true)}>
              About…
            </button>
          )}
          <button type="button" className="pack__info" aria-expanded={explained} aria-label="What About does" onClick={() => setExplained(!explained)}>
            ⓘ
          </button>
          {explained && <p className="auth__meta">A note about a character is seen by whoever can see that character.</p>}
        </div>
      )}
      <div className="log__form-actions">
        <button type="submit" className="button-secondary" aria-busy={busy}>
          {busy ? 'Saving…' : submit}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The fiat seal: a small round stamp, always with the word "Fiat" beside it. */
function Seal() {
  return (
    <svg className="log__seal" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="currentColor" />
      <path d="M8 4.2l1.1 2.4 2.6.3-1.9 1.8.5 2.6L8 10l-2.3 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="var(--sheet)" />
    </svg>
  );
}

/** "2:31 PM" today; "Oct 19, 2:31 PM" before that. */
function when(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

/** What a "setting rules updated" line changed, by name (only what this person may see). */
function PackUpdateList({ entry }: { entry: LogEntry }) {
  const lists = packUpdateLists(entry);
  const parts = (['added', 'changed', 'removed'] as const).filter((part) => lists[part].length > 0);
  if (parts.length === 0) return <p className="log__note-text">No entries changed.</p>;
  return (
    <dl className="log__changes">
      {parts.map((part) => (
        <div key={part}>
          <dt>{part[0]!.toUpperCase() + part.slice(1)}</dt>
          <dd>{lists[part].join(', ')}</dd>
        </div>
      ))}
    </dl>
  );
}
