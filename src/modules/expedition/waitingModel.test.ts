// The model of "Waiting for you" (S8, st-1, wy-1; page 16, frames T2, T6b, T8b). Invented items only.
import { describe, expect, it } from 'vitest';
import { DRAWN_MOST, openAfterAnswer, waitingItems, waitingView, windowFor, type WaitingInput, type WaitingItem, type WaitingView } from './waitingModel.ts';

const item = (id: string, title: string, ...labels: string[]): WaitingInput => ({ id, title, actions: labels.map((label) => ({ id: `${id}:${label}`, label })) });
const encounter = item('encounter:1', 'An encounter waits', 'Start', 'Dismiss', 'Who is awake…');
const rest = item('rest:1', 'Rest is due', 'Answer…');
const weather = item('weather:1', 'Weather: to roll', 'Enter…');
const reminder = item('reminder:1', 'The tide turns', 'Done');
const ended = item('end:1', 'The expedition has ended', 'Answer…');
const way = item('way:1', 'The causeway to the Reed Market', 'Go');

/** T2's four: the encounter, the rest, the weather, the reminder. */
const four = () => waitingItems({ encounters: [encounter], rests: [rest], weather: [weather], reminders: [reminder] });
/** Seven waiting (T6b). */
const seven = () => waitingItems({ encounters: [encounter], rests: [rest], weather: [weather], reminders: [reminder, item('reminder:2', 'Count the eels', 'Done'), item('reminder:3', 'Light the beacon', 'Done')], ways: [way] });
const ids = (list: readonly WaitingItem[]) => list.map((i) => i.id);
const drawn = (view: WaitingView) => view.entries.map((e) => ('card' in e ? `card:${e.card.id}` : 'row' in e ? `row:${e.row.id}` : `more:${e.more.count}`));

describe('the order', () => {
  // Purpose: what waits comes in the ruled order whatever order the sources arrive in: the end of an expedition, an
  // encounter, a rest, the weather, a reminder, a proposed way; within a kind, as its source gives them.
  it('orders the end of an expedition, an encounter, a rest, the weather, a reminder, then a way', () => {
    const list = waitingItems({ ways: [way], reminders: [reminder, item('reminder:2', 'Count the eels', 'Done')], weather: [weather], rests: [rest], encounters: [encounter], expeditionEnd: [ended] });
    expect(ids(list)).toEqual(['end:1', 'encounter:1', 'rest:1', 'weather:1', 'reminder:1', 'reminder:2', 'way:1']);
    expect(list.map((i) => i.kind)).toEqual(['expeditionEnd', 'encounter', 'rest', 'weather', 'reminder', 'reminder', 'way']);
  });

  // Purpose (the lead's answers 3 and 4): a decision an ended effect leaves and players' items (a one-off, an armour
  // base, a request) sit after the reminder, each in the order its source gives, and before a proposed way.
  it('puts a decision and players\' items after the reminder, in their sources\' order', () => {
    const list = waitingItems({
      ways: [way],
      playerItems: [item('oneoff:1', 'Approve: a reed whistle', 'Approve'), item('base:1', 'Pick the base for the moss coat', 'Pick…'), item('request:1', 'Ash asks to forage', 'Answer…')],
      effects: [{ ...item('effect:2', 'The ward fades: choose who it guards', 'Choose…'), decide: true }],
      reminders: [reminder],
    });
    expect(ids(list)).toEqual(['reminder:1', 'effect:2', 'oneoff:1', 'base:1', 'request:1', 'way:1']);
  });

  // Purpose: ids are unique across everything waiting: a repeat from two sources is renamed "#2" in the panel's order,
  // stably, so every item stays reachable, none is opened twice, and nothing throws.
  it('keeps ids unique: a repeat is renamed "#2", stably', () => {
    const twice = () => waitingItems({ rests: [item('dup', 'Rest is due', 'Answer…')], reminders: [item('dup', 'The tide turns', 'Done'), item('dup#2', 'Count the eels', 'Done'), item('dup', 'Light the beacon', 'Done')] });
    expect(ids(twice())).toEqual(['dup', 'dup#3', 'dup#2', 'dup#4']);
    expect(ids(twice())).toEqual(ids(twice()));
    expect(new Set(ids(twice())).size).toBe(4);
    const view = waitingView(twice(), 'dup#3');
    expect(view.entries.filter((e) => 'card' in e)).toHaveLength(1);
    expect(view.count).toEqual({ open: 2, total: 4 });
  });

  // Purpose: an effect that simply ends is not an item (st-1); only one whose pack asks for a decision is.
  it('leaves out an effect that simply ends, and keeps one that asks for a decision', () => {
    const list = waitingItems({
      effects: [
        { ...item('effect:1', 'The torch is out'), decide: false },
        { ...item('effect:2', 'The ward fades: choose who it guards', 'Choose…'), decide: true },
      ],
    });
    expect(ids(list)).toEqual(['effect:2']);
    expect(waitingItems({ effects: [{ ...item('effect:1', 'The torch is out'), decide: false }] })).toEqual([]);
  });
});

describe('the open item and the accent', () => {
  // Purpose: the first is open by default: the whole card, with its words and every answer; the others are one-line
  // rows with their mark (kind), title and one button; the open item's first answer is the page's accent.
  it('opens the first by default, as the whole card holding the accent', () => {
    const view = waitingView(four(), null);
    expect(drawn(view)).toEqual(['card:encounter:1', 'row:rest:1', 'row:weather:1', 'row:reminder:1']);
    const card = 'card' in view.entries[0]! ? view.entries[0].card : null;
    expect(card?.actions.map((a) => a.label)).toEqual(['Start', 'Dismiss', 'Who is awake…']);
    expect(view.entries[1]).toEqual({ row: { id: 'rest:1', kind: 'rest', title: 'Rest is due', button: { id: 'rest:1:Answer…', label: 'Answer…' }, number: 2 } });
    expect(view.accent).toEqual({ itemId: 'encounter:1', actionId: 'encounter:1:Start' });
  });

  // Purpose: a row opened becomes the card in its own place, the first becomes a row, and the accent goes with it:
  // exactly one item is open.
  it('moves the card and the accent to the row opened, leaving exactly one open', () => {
    const view = waitingView(four(), 'weather:1');
    expect(drawn(view)).toEqual(['row:encounter:1', 'row:rest:1', 'card:weather:1', 'row:reminder:1']);
    expect(view.entries.filter((e) => 'card' in e)).toHaveLength(1);
    expect(view.accent).toEqual({ itemId: 'weather:1', actionId: 'weather:1:Enter…' });
  });

  // Purpose: an open item with no answer gives no accent (it falls to Move on on the page); an id no longer waiting
  // opens the first.
  it('gives no accent to an item without an answer, and opens the first for an id gone', () => {
    const quiet = waitingItems({ reminders: [item('reminder:9', 'Wind from the east')] });
    expect(waitingView(quiet, null).accent).toBeNull();
    expect(waitingView(four(), 'reminder:gone').openId).toBe('encounter:1');
  });
});

describe('the count (wy-1)', () => {
  // Purpose: the count names which one is open of how many: "1 of 4".
  it('reads 1 of 4 with the first open', () => {
    expect(waitingView(four(), null).count).toEqual({ open: 1, total: 4 });
  });

  // Purpose: a row opened takes its number: the third opened reads "3 of 4".
  it('reads 3 of 4 with the third opened', () => {
    expect(waitingView(four(), 'weather:1').count).toEqual({ open: 3, total: 4 });
  });

  // Purpose: one answered, the next opens and the total drops: item 1 of 4 answered reads "1 of 3", the next open.
  it('answering the open one opens the next and drops the total', () => {
    const before = four();
    const open = openAfterAnswer(before, null, 'encounter:1');
    const after = before.filter((i) => i.id !== 'encounter:1');
    const view = waitingView(after, open);
    expect(view.openId).toBe('rest:1');
    expect(view.count).toEqual({ open: 1, total: 3 });
    // The third open and answered: the one after it opens, now third of three.
    const third = openAfterAnswer(before, 'weather:1', 'weather:1');
    expect(third).toBe('reminder:1');
    expect(waitingView(before.filter((i) => i.id !== 'weather:1'), third).count).toEqual({ open: 3, total: 3 });
  });

  // Purpose: answering a row that isn't open leaves the open one open; the total drops and its number may move.
  it('answering another row keeps the open one open', () => {
    const before = four();
    const open = openAfterAnswer(before, 'weather:1', 'rest:1');
    expect(open).toBe('weather:1');
    expect(waitingView(before.filter((i) => i.id !== 'rest:1'), open).count).toEqual({ open: 2, total: 3 });
  });

  // Purpose: with one waiting there is no count.
  it('has no count with one waiting', () => {
    const view = waitingView(waitingItems({ rests: [rest] }), null);
    expect(view.count).toBeNull();
    expect(drawn(view)).toEqual(['card:rest:1']);
  });
});

describe('past four (T2, T6b)', () => {
  // Purpose: past four, the fourth place is "N more", holding the rest (T6b: seven waiting, the first whole, two rows,
  // "4 more"); the count's total counts them all ("1 of 7").
  it('draws three and "N more", and the total counts all', () => {
    const view = waitingView(seven(), null);
    expect(drawn(view)).toEqual(['card:encounter:1', 'row:rest:1', 'row:weather:1', 'more:4']);
    expect(view.count).toEqual({ open: 1, total: 7 });
    expect(view.entries.length).toBe(DRAWN_MOST);
    const more = view.entries[3]!;
    expect('more' in more && more.more.ids).toEqual(['reminder:1', 'reminder:2', 'reminder:3', 'way:1']);
  });

  // Purpose: exactly four waiting are all drawn, no "N more"; five draw three and "2 more".
  it('draws four as they are, and five as three and "2 more"', () => {
    expect(drawn(waitingView(four(), null))).toEqual(['card:encounter:1', 'row:rest:1', 'row:weather:1', 'row:reminder:1']);
    const five = waitingItems({ encounters: [encounter], rests: [rest], weather: [weather], reminders: [reminder], ways: [way] });
    expect(drawn(waitingView(five, null))).toEqual(['card:encounter:1', 'row:rest:1', 'row:weather:1', 'more:2']);
  });

  // Purpose (the lead's answer 2): opening an item "N more" holds draws it whole in the last place before "N more", the
  // row it displaces going into "N more", so exactly one open item is always drawn; its count is its place of all ("6 of 7").
  it('draws an opened held item in the last place before "N more", the displaced row held', () => {
    const view = waitingView(seven(), 'reminder:3');
    expect(drawn(view)).toEqual(['row:encounter:1', 'row:rest:1', 'card:reminder:3', 'more:4']);
    expect(view.count).toEqual({ open: 6, total: 7 });
    expect(windowFor(7, 5)).toEqual([0, 1, 5]);
    // The row it displaces (the weather) is held in "N more" with the others.
    const more = view.entries[3]!;
    expect('more' in more && more.more.ids).toEqual(['weather:1', 'reminder:1', 'reminder:2', 'way:1']);
  });
});

describe('nothing waits', () => {
  // Purpose: with nothing waiting the model says so (the panel reads "Nothing waits."): no count, no entries, no accent.
  it('says nothing waits when empty', () => {
    expect(waitingView(waitingItems({}), null)).toEqual({ empty: true, count: null, openId: null, entries: [], accent: null });
    expect(openAfterAnswer([rest].map((r) => ({ ...r, kind: 'rest' as const })), null, 'rest:1')).toBeNull();
  });
});
