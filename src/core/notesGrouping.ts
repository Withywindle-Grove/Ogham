// How the Notes list is grouped (dec-12 D, the logic only; mc-68 in
// docs/design/rulings/dec-mockup-rulings-sets3-5-2026-11-12.md). Pure: it only arranges the notes it is given (the
// ones this person may already read, `loadNotes`), never reads or widens anything. The side chosen on the switch
// (the party, or one character), then a "Pinned" group, then one group a day, newest day first, each with its count;
// today and the day before start open. Tags are not here (mc-68a, after 5 December).
import type { Note } from './notes.ts';

/**
 * A note as the list needs it. `pinned` and `byGm` are given by the caller: notes carry no pin today (no storage is
 * added here), and whether the author is the campaign's GM comes from `loadNoteAuthors`. The screen shows "GM:".
 */
export interface NoteForList extends Pick<Note, 'id' | 'text' | 'aboutActorId' | 'createdAt'> {
  pinned: boolean;
  byGm: boolean;
}

/** Which side of the switch is chosen: the party's notes (about no character), or one character's. */
export type NotesSide = { kind: 'party' } | { kind: 'character'; actorId: string };

export interface NotesGroup<T extends NoteForList = NoteForList> {
  kind: 'pinned' | 'day';
  /** The calendar day, "YYYY-MM-DD", for a day's group; null for Pinned. */
  day: string | null;
  /** How many notes the group holds: always known, shown folded or open. */
  count: number;
  /** Whether the group starts open (Pinned, today and the day before); the rest start folded. */
  open: boolean;
  notes: T[];
}

export interface NotesList<T extends NoteForList = NoteForList> {
  groups: NotesGroup<T>[];
  /** Nothing kept on this side: the screen shows its empty state. */
  empty: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** The calendar day a moment falls on in this device's local time, "YYYY-MM-DD". */
export function localDay(createdAt: string): string {
  const at = new Date(createdAt);
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The calendar day before a "YYYY-MM-DD" day. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d! - 1));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

const onSide = (note: NoteForList, side: NotesSide) => (side.kind === 'party' ? note.aboutActorId === null : note.aboutActorId === side.actorId);
const byTime = (a: NoteForList, b: NoteForList) => Date.parse(a.createdAt) - Date.parse(b.createdAt);

/**
 * What the Notes list shows for one side, as of `today` ("YYYY-MM-DD", the device's day). A note is put on the day
 * it was written (`dayOf`, local time by default); notes carry no in-game day. A pinned note appears once, under
 * Pinned, never also under its day. The notes are the same objects, in new arrays: nothing in them is changed.
 */
export function groupNotes<T extends NoteForList>(notes: readonly T[], side: NotesSide, today: string, dayOf: (createdAt: string) => string = localDay): NotesList<T> {
  const mine = notes.filter((note) => onSide(note, side));
  const groups: NotesGroup<T>[] = [];
  // Pinned: newest first (by when written: a pin carries no time of its own).
  const pinned = mine.filter((note) => note.pinned).sort((a, b) => byTime(b, a));
  if (pinned.length > 0) groups.push({ kind: 'pinned', day: null, count: pinned.length, open: true, notes: pinned });
  const byDay = new Map<string, T[]>();
  for (const note of mine.filter((x) => !x.pinned).sort(byTime)) {
    const day = dayOf(note.createdAt);
    byDay.set(day, [...(byDay.get(day) ?? []), note]);
  }
  const openDays = new Set([today, dayBefore(today)]);
  for (const day of [...byDay.keys()].sort().reverse()) {
    const dayNotes = byDay.get(day)!;
    groups.push({ kind: 'day', day, count: dayNotes.length, open: openDays.has(day), notes: dayNotes });
  }
  return { groups, empty: groups.length === 0 };
}
