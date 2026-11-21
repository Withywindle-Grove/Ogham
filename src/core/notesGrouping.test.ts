// How the Notes list is grouped (dec-12 D, logic only; mc-68). Invented notes only.
import { describe, expect, it } from 'vitest';
import { dayBefore, groupNotes, localDay, type NoteForList } from './notesGrouping.ts';

const TODAY = '2026-12-05';
let n = 0;
/** A note written on `day` at `time` (local), about no character unless said; the day is read as written. */
const note = (day: string, time: string, extra: Partial<NoteForList> = {}): NoteForList => ({
  id: `n${++n}`,
  text: `Note ${n}`,
  aboutActorId: null,
  createdAt: `${day}T${time}:00`,
  pinned: false,
  byGm: false,
  ...extra,
});
// The tests read the day straight from the stamp, so they never depend on the machine's time zone.
const dayOf = (createdAt: string) => createdAt.slice(0, 10);
const party = { kind: 'party' } as const;
const ids = (notes: readonly { id: string }[]) => notes.map((x) => x.id);

describe('the Notes list, grouped (mc-68)', () => {
  it("the party's side holds only notes about no character; a character's side only that character's", () => {
    const a = note(TODAY, '09:00');
    const b = note(TODAY, '09:05', { aboutActorId: 'lantern-warden' });
    const c = note(TODAY, '09:10', { aboutActorId: 'bog-lurker' });
    const onParty = groupNotes([a, b, c], party, TODAY, dayOf);
    expect(onParty.groups.flatMap((g) => ids(g.notes))).toEqual([a.id]);
    const onWarden = groupNotes([a, b, c], { kind: 'character', actorId: 'lantern-warden' }, TODAY, dayOf);
    expect(onWarden.groups.flatMap((g) => ids(g.notes))).toEqual([b.id]);
  });

  it('a Pinned group comes first, open, its notes newest first', () => {
    const old = note('2026-11-20', '10:00', { pinned: true });
    const plain = note(TODAY, '08:00');
    const recent = note('2026-12-01', '10:00', { pinned: true });
    const list = groupNotes([old, plain, recent], party, TODAY, dayOf);
    expect(list.groups[0]).toMatchObject({ kind: 'pinned', day: null, count: 2, open: true });
    expect(ids(list.groups[0]!.notes)).toEqual([recent.id, old.id]);
  });

  it('then one group a day, newest day first, each with its count and its notes in the order they were written', () => {
    const d1a = note('2026-12-01', '18:00');
    const d1b = note('2026-12-01', '09:00');
    const d3 = note('2026-12-03', '12:00');
    const list = groupNotes([d1a, d3, d1b], party, TODAY, dayOf);
    expect(list.groups.map((g) => [g.kind, g.day, g.count])).toEqual([
      ['day', '2026-12-03', 1],
      ['day', '2026-12-01', 2],
    ]);
    expect(ids(list.groups[1]!.notes)).toEqual([d1b.id, d1a.id]);
  });

  it('today and the day before start open; older days start folded', () => {
    const list = groupNotes([note(TODAY, '08:00'), note('2026-12-04', '08:00'), note('2026-12-03', '08:00')], party, TODAY, dayOf);
    expect(list.groups.map((g) => [g.day, g.open])).toEqual([
      [TODAY, true],
      ['2026-12-04', true],
      ['2026-12-03', false],
    ]);
  });

  it('the day before is the calendar day before, across a month and a year', () => {
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    const list = groupNotes([note('2026-11-30', '23:00')], party, '2026-12-01', dayOf);
    expect(list.groups[0]?.open).toBe(true);
  });

  it('a day with nine notes is one group counting nine, all of them in order', () => {
    const nine = Array.from({ length: 9 }, (_, i) => note('2026-12-02', `1${i}:00`));
    const list = groupNotes([...nine].reverse(), party, TODAY, dayOf);
    expect(list.groups).toHaveLength(1);
    expect(list.groups[0]).toMatchObject({ day: '2026-12-02', count: 9, open: false });
    expect(ids(list.groups[0]!.notes)).toEqual(ids(nine));
  });

  it('a note pinned and written today appears once, under Pinned, and not under today', () => {
    const pinnedToday = note(TODAY, '10:00', { pinned: true });
    const plainToday = note(TODAY, '11:00');
    const list = groupNotes([pinnedToday, plainToday], party, TODAY, dayOf);
    expect(list.groups.flatMap((g) => ids(g.notes))).toEqual([pinnedToday.id, plainToday.id]);
    expect(list.groups[1]).toMatchObject({ kind: 'day', day: TODAY, count: 1 });
  });

  it('a day whose only notes are pinned has no day group', () => {
    const list = groupNotes([note(TODAY, '10:00', { pinned: true })], party, TODAY, dayOf);
    expect(list.groups.map((g) => g.kind)).toEqual(['pinned']);
  });

  it("the GM's flag is carried through on the note, words untouched", () => {
    const gm = note(TODAY, '10:00', { byGm: true, text: 'The ferryman lied.' });
    const list = groupNotes([gm], party, TODAY, dayOf);
    expect(list.groups[0]!.notes[0]).toMatchObject({ byGm: true, text: 'The ferryman lied.' });
  });

  it('nothing kept: an empty list the screen shows as its empty state', () => {
    expect(groupNotes([], party, TODAY, dayOf)).toEqual({ groups: [], empty: true });
    // Notes only on the other side: this side is empty too.
    expect(groupNotes([note(TODAY, '10:00', { aboutActorId: 'bog-lurker' })], party, TODAY, dayOf).empty).toBe(true);
  });

  it('long names and long words come through untouched, and the notes given are not changed', () => {
    const long = 'Ser Aldric of the Thousand Lanterns and the Drowned Causeway, Warden of the Reedmarch '.repeat(4);
    const given = [note(TODAY, '10:00', { text: long, aboutActorId: 'lantern-warden' })];
    const before = JSON.stringify(given);
    const list = groupNotes(given, { kind: 'character', actorId: 'lantern-warden' }, TODAY, dayOf);
    expect(list.groups[0]!.notes[0]!.text).toBe(long);
    expect(JSON.stringify(given)).toBe(before);
  });

  it('by default a note is put on the calendar day it was written in local time', () => {
    const at = new Date(2026, 11, 5, 23, 30).toISOString();
    expect(localDay(at)).toBe('2026-12-05');
    expect(groupNotes([note('x', 'y', { createdAt: at })], party, '2026-12-05').groups[0]?.day).toBe('2026-12-05');
  });
});
