// The full sheet's own parts (plan m5b-sheet-revised A, B, C; mockup players/05, approved 2026-11-08): the language
// boxes, the details ledger (look A), the sheet changes' waiting lines, and the Notes button with its Sheet. Each is
// drawn once here and composed by the sheet; the rows are the List row's Sheet row variant (parts.tsx).
import { useEffect, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { addNote, loadNoteAuthors, loadNotes, type Note } from '../core/notes.ts';
import type { Db } from '../core/supabase.ts';
import { changeWords, type SheetChange } from '../modules/characters/sheetChanges.ts';
import type { PatronLadder } from '../modules/characters/patrons.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { ListRow, RowList, WarningSign } from '../ui/parts.tsx';
import { registry } from './services.ts';

/** "today", "yesterday", else the day and month ("6 Nov"): when a note or a change was made. */
export function whenWords(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const day = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  const ago = day(now) - day(then);
  if (ago <= 0) return 'today';
  if (ago === 1) return 'yesterday';
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Languages as boxes (44 px, 8 px apart), each the tap to the pack's text for it; a language the pack doesn't list
 * is a plain box (words only, nothing to open).
 */
export function LanguageBoxes({ languages }: { languages: { key: string; name: string; onOpen?: () => void }[] }) {
  return (
    <div className="sheet__boxes">
      {languages.map((l) =>
        l.onOpen ? (
          <button key={l.key} type="button" className="sheet__box" aria-label={`${l.name}: what it is`} onClick={l.onOpen}>
            {l.name}
          </button>
        ) : (
          <span key={l.key} className="sheet__box sheet__box--still">
            {l.name}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * Details and backstory, look A (ruled 2026-11-08, evening): the labels in a muted column, the values in Garamond
 * beside them, then the backstory as a paragraph with a drop capital. Nothing written: one quiet line.
 */
export function DetailsLedger({ rows, story }: { rows: { key: string; label: string; value: ReactNode }[]; story: string }) {
  if (rows.length === 0 && !(story ?? '').trim()) return <p className="auth__meta">Nothing written yet.</p>;
  return (
    <>
      {rows.length > 0 && (
        <dl className="sheet__ledger">
          {rows.map((r) => (
            <div key={r.key} className="sheet__ledger-row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(story ?? '').trim() && <p className="sheet__story">{(story ?? '').trim()}</p>}
    </>
  );
}

/**
 * The Patron section's body (Francis, 2026-11-12): the book's layout as far as the pack carries it, its words as they
 * stand (mc-34). Each field a paragraph opening with a bold lead-in ("Prayer:"); "Holy garb", "Alternative spells" and
 * "Marks" under small bold sub-headings, the garb and the marks each a bulleted list, one line per tier opening with
 * its tier in bold (Francis, 2026-11-12). Every tier shows, each said "(reached)" or "(to come)" for this character: words, not colour.
 */
export function PatronLadderView({ ladder }: { ladder: PatronLadder }) {
  const when = (reached: boolean) => (reached ? ' (reached)' : ' (to come)');
  const field = (key: string, label: string, body: ReactNode) => (
    <p key={key}>
      <b>{label}:</b> {body}
    </p>
  );
  const byKey = (key: string) => ladder.lines.find((l) => l.key === key);
  const symbol = byKey('symbol');
  return (
    <div className="sheet__patron">
      {symbol && field(symbol.key, symbol.label, symbol.value)}
      {ladder.garb.length > 0 && (
        <>
          <h3 className="sheet__patron-head">Holy garb</h3>
          <ul className="sheet__patron-list">
            {ladder.garb.map((t, n) => (
              <li key={n}>
                <b>{t.words}:</b> {`${t.text}${when(t.reached)}`}
              </li>
            ))}
          </ul>
        </>
      )}
      {ladder.lines.filter((l) => l.key !== 'symbol').map((l) => field(l.key, l.label, l.value))}
      {(ladder.spells.length > 0 || ladder.spellsNote) && (
        <>
          <h3 className="sheet__patron-head">Alternative spells</h3>
          {ladder.spellsNote && <p>{ladder.spellsNote}</p>}
          {ladder.spells.length > 0 && (
            <ul className="sheet__patron-list">
              {ladder.spells.map((s) => (
                <li key={s.text}>{`${s.text}${when(s.reached)}`}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {ladder.marks.length > 0 && (
        <>
          <h3 className="sheet__patron-head">Marks</h3>
          <ul className="sheet__patron-list">
            {ladder.marks.map((m, n) => (
              <li key={n}>
                <b>{m.words}:</b> {`${m.text}${when(m.reached)}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * The sheet changes waiting for the GM, one line each, at the top of the sheet (plan B6): "Waiting for your GM: Muscle
 * 16 → 17. Sent today." with Take back (for the player); a refused one says why until it's put away (OK). The GM
 * reads the same lines, without the buttons (they answer from Players).
 */
export function SheetChangeLines({
  changes,
  onTakeBack,
  onDismiss,
}: {
  changes: SheetChange[];
  onTakeBack?: (change: SheetChange) => void;
  onDismiss?: (change: SheetChange) => void;
}) {
  if (changes.length === 0) return null;
  return (
    <div className="sheet__changes" role="status">
      {changes.map((c) =>
        c.status === 'waiting' ? (
          <div key={c.id} className="sheet__change">
            <WarningSign />
            <p className="sheet__change-text">
              <b>Waiting for your GM:</b> {changeWords(c)}. <span className="auth__meta">Sent {whenWords(c.createdAt)}. The sheet shows the old figure until it is approved.</span>
            </p>
            {onTakeBack && (
              <button type="button" className="button-secondary button-secondary--small" aria-label={`Take back ${changeWords(c)}`} onClick={() => onTakeBack(c)}>
                Take back
              </button>
            )}
          </div>
        ) : (
          <div key={c.id} className="sheet__change">
            <WarningSign />
            <p className="sheet__change-text">
              <b>Your GM refused</b> {changeWords(c)}
              {c.reason ? `: ${c.reason}` : '.'}
            </p>
            {onDismiss && (
              <button type="button" className="button-secondary button-secondary--small" aria-label={`Put away the refusal of ${changeWords(c)}`} onClick={() => onDismiss(c)}>
                OK
              </button>
            )}
          </div>
        ),
      )}
    </div>
  );
}

/** The notes' count line beside the button: "3 notes, last one today"; "No notes yet". */
export function notesLine(notes: readonly { createdAt: string }[], now: Date = new Date()): string {
  if (notes.length === 0) return 'No notes yet';
  const last = notes.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}, last one ${whenWords(last.createdAt, now)}`;
}

/** Who wrote a note, as the Notes sheet says it: "by you", "from your GM", "by Priya". */
export function noteAuthor(note: Pick<Note, 'authorUserId'>, me: string, gmIds: ReadonlySet<string>, names: ReadonlyMap<string, string>): string {
  if (note.authorUserId === me) return 'by you';
  if (note.authorUserId && gmIds.has(note.authorUserId)) return 'from your GM';
  return `by ${names.get(note.authorUserId ?? '') ?? 'someone'}`;
}

/** A note as the Notes sheet lists it. */
export interface ListedNote {
  id: string;
  when: string;
  who: string;
  text: string;
}

/**
 * The Notes sheet (plan C, the minimum): the character's notes newest first, each with when and who (the GM's notes
 * to the player included; GM-only notes never reach this device), then a field and Add (the sheet's accent).
 */
export function NotesSheet({ notes, onAdd, onClose, preview = false }: { notes: ListedNote[]; onAdd: (text: string) => Promise<boolean>; onClose: () => void; /** The gallery's open card in place. */ preview?: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function add() {
    if (busy) return;
    if (!text.trim()) return setProblem('Write the note first.');
    setBusy(true);
    setProblem(null);
    const done = await onAdd(text);
    setBusy(false);
    if (done) setText('');
  }
  return (
    <Dialog label="Notes" onClose={onClose} preview={preview}>
      {notes.length === 0 ? (
        <p className="auth__meta">No notes yet. What you write here stays with this character.</p>
      ) : (
        <ul className="sheet__notes">
          {notes.map((n) => (
            <li key={n.id} className="sheet__note">
              <span className="auth__meta">{`${capital(n.when)}, ${n.who}`}</span>
              <span className="sheet__text">{n.text}</span>
            </li>
          ))}
        </ul>
      )}
      <label className="label" htmlFor="sheet-note-new">
        A new note
      </label>
      <textarea
        id="sheet-note-new"
        className="field__input field__textarea sheet__note-new"
        rows={3}
        maxLength={2000}
        placeholder="Write a note…"
        value={text}
        onChange={(event) => {
          if (busy) return;
          setText(event.target.value);
        }}
      />
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <div className="dialog__actions">
        <button type="button" className="button-primary" aria-busy={busy} onClick={() => void add()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </Dialog>
  );
}

/**
 * The Notes button at the foot of the sheet with its line ("3 notes, last one today"), opening the Notes sheet. The
 * notes are the campaign's notes about this character (the existing notes data); the words once kept on the sheet
 * itself (its old Notes box) come first when there are any, so nothing written there is lost from view.
 */
export function SheetNotes({ db, user, campaignId, characterId, sheetNotes, asRow = false }: { db: Db; user: CurrentUser; campaignId: string; characterId: string; sheetNotes: string; /** Beside the Player screen (dec-13 C12): a summary row with a chevron, "Notes" and its line, opening the same sheet. */ asRow?: boolean }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [members, setMembers] = useState<{ names: Map<string, string>; gms: Set<string> }>({ names: new Map(), gms: new Set() });
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const toast = useToast();
  useEffect(() => {
    let live = true;
    void Promise.all([loadNotes(db, campaignId), loadNoteAuthors(db, campaignId)]).then(([found, people]) => {
      if (!live) return;
      setNotes((found ?? []).filter((n) => n.aboutActorId === characterId && !n.annotatesEventId));
      setMembers(people);
    });
    return () => {
      live = false;
    };
  }, [db, campaignId, characterId, version]);
  const mine = [...(notes ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const listed: ListedNote[] = [
    ...mine.map((n) => ({ id: n.id, when: whenWords(n.createdAt), who: noteAuthor(n, user.id, members.gms, members.names), text: n.text })),
    ...((sheetNotes ?? '').trim() ? [{ id: 'on-the-sheet', when: 'on the sheet', who: 'kept from before', text: (sheetNotes ?? '').trim() }] : []),
  ];
  async function add(text: string): Promise<boolean> {
    const result = await runCommand(registry, db, user, addNote, { campaignId, text, aboutActorId: characterId });
    if (!result.ok) {
      toast({ text: result.message, error: true });
      return false;
    }
    setVersion((v) => v + 1);
    toast({ text: 'Note added.' });
    return true;
  }
  return (
    <section className="sheet__section sheet__block" aria-label="Notes">
      {asRow ? (
        <RowList>
          <ListRow title="Notes" sub={notes === null ? 'Opening…' : notesLine(mine)} openLabel="Notes" onOpen={() => setOpen(true)} />
        </RowList>
      ) : (
      <div className="sheet__notes-row">
        <button type="button" className="button-secondary" onClick={() => setOpen(true)}>
          Notes
        </button>
        <span className="auth__meta">{notes === null ? 'Opening…' : notesLine(mine)}</span>
      </div>
      )}
      {open && <NotesSheet notes={listed} onAdd={add} onClose={() => setOpen(false)} />}
    </section>
  );
}
