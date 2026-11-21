// The model of "Waiting for you" on the GM's Scene (row S8 of docs/plans/dec-9-the-whole-scene.md, its logic half;
// rulings st-1 and wy-1 in docs/design/rulings/dec-scene-whole-2026-11-14.md; page 16, frames T2, T6b, T8b). Pure: it
// reads nothing and draws nothing. The caller hands it what needs the GM, one input per source (today's strip cards,
// the inventory and requests, the device's reminder card, Move on's proposals), with the words and actions it already
// shows; the model orders them, decides which one is open (the whole card, with the page's accent), which are one-line
// rows, which are held in "N more", and the count ("1 of 4"). The panel that draws it is a later row.
//
// What the rulings and frames left open was ruled by the lead on 2026-11-14 (the #800 round), each kept in one place:
//   PLACE_OF            players' items and a decision an effect leaves sit after the reminder
//   windowFor           an opened item "N more" holds is drawn in the last place before it; the row it displaces goes in
//   openAfterAnswer     the last one answered while open: the first opens
// Ids are unique across everything waiting: a repeat is renamed "<id>#2", "#3"… in arrival order (waitingItems).

/** The kinds of thing that wait, in the order the panel shows them. */
export const WAITING_ORDER = [
  // Ruled (the brief's order, T2 and T8b's drawing): the end of an expedition blocks everything, then the encounter's
  // card, the rest, the weather and the reminder as rows; a proposed way last.
  'expeditionEnd',
  'encounter',
  'rest',
  'weather',
  'reminder',
  // After the reminder (the lead, 2026-11-14): a decision an ended effect leaves (st-1), then players' items (one-offs,
  // armour bases, requests), each in the order its source gives, as today.
  'decision',
  'playerItem',
  'way',
] as const;
export type WaitingKind = (typeof WAITING_ORDER)[number];

/** Where each kind sits: its place in WAITING_ORDER (the brief's six, and the lead's answers for the other two). */
const PLACE_OF: Record<WaitingKind, number> = Object.fromEntries(WAITING_ORDER.map((kind, i) => [kind, i])) as Record<WaitingKind, number>;

/** One of an item's answers: the caller's id for it and its words (each a stacked button with its icon on the screen). */
export interface WaitingAction {
  id: string;
  label: string;
  /** The icon's name from the app's set, when the caller has one. */
  icon?: string;
}

/** One thing that waits, as its source gives it: the words and answers it already shows. */
export interface WaitingInput {
  /**
   * Unique across everything waiting (the caller's own key: "encounter:<id>", "reminder:<id>"…). A repeat is renamed
   * "<id>#2" in the panel's order by waitingItems, never thrown.
   */
  id: string;
  title: string;
  /** The card's words when it is open; a row shows the title alone. */
  words?: string;
  /** Its answers; the first is the row's one button and, when open, the page's accent. */
  actions: readonly WaitingAction[];
}

/** An effect that has just ended (a light out, a condition gone): an item only when the pack says something must then be decided. */
export interface EndedEffect extends WaitingInput {
  /** The pack says something must then be decided; otherwise it is a toast and a log line, never an item (st-1). */
  decide: boolean;
}

/** Everything that needs the GM, by source; any may be empty. */
export interface WaitingSources {
  expeditionEnd?: readonly WaitingInput[];
  encounters?: readonly WaitingInput[];
  rests?: readonly WaitingInput[];
  weather?: readonly WaitingInput[];
  reminders?: readonly WaitingInput[];
  /** Effects that ended: only those whose pack asks for a decision become items. */
  effects?: readonly EndedEffect[];
  /** Players' one-offs to approve, worn armour's bases to pick, requests to answer. */
  playerItems?: readonly WaitingInput[];
  ways?: readonly WaitingInput[];
}

export interface WaitingItem extends WaitingInput {
  kind: WaitingKind;
}

/**
 * Every item, in the panel's order: by kind (WAITING_ORDER), and within a kind in the order its source gives them.
 * An effect that simply ended is not an item (st-1).
 */
export function waitingItems(sources: WaitingSources): WaitingItem[] {
  const of = (kind: WaitingKind, list: readonly WaitingInput[] | undefined): WaitingItem[] => (list ?? []).map(({ id, title, words, actions }) => ({ id, title, ...(words !== undefined ? { words } : {}), actions, kind }));
  const items = [
    ...of('expeditionEnd', sources.expeditionEnd),
    ...of('encounter', sources.encounters),
    ...of('rest', sources.rests),
    ...of('weather', sources.weather),
    ...of('reminder', sources.reminders),
    ...of('decision', (sources.effects ?? []).filter((e) => e.decide)),
    ...of('playerItem', sources.playerItems),
    ...of('way', sources.ways),
  ];
  // A stable sort keeps each kind's own order.
  items.sort((a, b) => PLACE_OF[a.kind] - PLACE_OF[b.kind]);
  // Ids are unique across everything waiting (opening, answering and "N more" go by id). Should two sources ever give
  // the same id, the later one, in the panel's order, is renamed "<id>#2" ("#3"…): stable, so the same input always
  // gives the same ids, and no item is lost or opened twice. A rename never throws at the table.
  const seen = new Map<string, number>();
  const taken = new Set(items.map((i) => i.id));
  return items.map((i) => {
    const times = (seen.get(i.id) ?? 0) + 1;
    seen.set(i.id, times);
    if (times === 1) return i;
    let n = times;
    while (taken.has(`${i.id}#${n}`)) n += 1;
    const id = `${i.id}#${n}`;
    taken.add(id);
    return { ...i, id };
  });
}

/** How many entries the panel draws before "N more" takes the last place (T2: "past four, the fourth row is 'N more'"). */
export const DRAWN_MOST = 4;

/**
 * The positions drawn (indexes into the items), in order, given how many wait and which is open. Up to four, all of
 * them; past four, three and then "N more" (T6b: seven waiting, the first whole, two rows, "4 more").
 * An open item that "N more" would hold (the lead, 2026-11-14): it is drawn in the last place before "N more", and the
 * row it displaces goes into "N more", so exactly one open item is always drawn. This function is the one place to change.
 */
export function windowFor(total: number, open: number): number[] {
  if (total <= DRAWN_MOST) return Array.from({ length: total }, (_, i) => i);
  const shown = DRAWN_MOST - 1;
  const first = Array.from({ length: shown }, (_, i) => i);
  return open < shown ? first : [...first.slice(0, shown - 1), open];
}

/** A one-line row: the mark (by kind), the title, its one button. */
export interface WaitingRow {
  id: string;
  kind: WaitingKind;
  title: string;
  /** The row's one button: the item's first answer; null when it has none. */
  button: WaitingAction | null;
  /** Its place among all that wait, from 1 (what the count reads when it is opened). */
  number: number;
}

/** The open item, drawn whole: its title, its words and every answer. */
export interface WaitingCard extends WaitingRow {
  words: string | null;
  actions: readonly WaitingAction[];
}

/** What the panel draws, top to bottom. */
export type WaitingEntry = { card: WaitingCard } | { row: WaitingRow } | { more: { count: number; ids: string[] } };

export interface WaitingView {
  /** Nothing waits: the panel reads "Nothing waits." and holds nothing else. */
  empty: boolean;
  /** Which one is open of how many (wy-1); null with one waiting, or none. */
  count: { open: number; total: number } | null;
  /** The id of the open item; null when nothing waits. */
  openId: string | null;
  entries: WaitingEntry[];
  /**
   * The page's one accent: the open item's first answer (mc-27, as accentOwner gives "Waiting for you" the accent while
   * anything waits). Null when nothing waits, or the open item has no answer: the accent then falls to Move on.
   */
  accent: { itemId: string; actionId: string } | null;
}

/**
 * The panel, given everything waiting (in order, from waitingItems) and the item the GM opened (null, or an id no
 * longer waiting: the first is open, as by default). Exactly one item is open while anything waits; it is the whole
 * card, in its own place; the others are rows; past four, "N more" holds the rest. The count reads the open item's
 * place of all that wait, the ones "N more" holds included.
 */
export function waitingView(items: readonly WaitingItem[], openId: string | null): WaitingView {
  if (items.length === 0) return { empty: true, count: null, openId: null, entries: [], accent: null };
  const found = openId === null ? -1 : items.findIndex((item) => item.id === openId);
  const open = found < 0 ? 0 : found;
  const openItem = items[open]!;
  const drawn = windowFor(items.length, open);
  const rowOf = (item: WaitingItem, index: number): WaitingRow => ({ id: item.id, kind: item.kind, title: item.title, button: item.actions[0] ?? null, number: index + 1 });
  const entries: WaitingEntry[] = drawn.map((index) => {
    const item = items[index]!;
    const row = rowOf(item, index);
    return index === open ? { card: { ...row, words: item.words ?? null, actions: item.actions } } : { row };
  });
  const held = items.filter((_, index) => !drawn.includes(index));
  if (held.length > 0) entries.push({ more: { count: held.length, ids: held.map((item) => item.id) } });
  const first = openItem.actions[0];
  return {
    empty: false,
    count: items.length > 1 ? { open: open + 1, total: items.length } : null,
    openId: openItem.id,
    entries,
    accent: first ? { itemId: openItem.id, actionId: first.id } : null,
  };
}

/**
 * Which item is open after one is answered (wy-1: "one answered, the next opens and the total drops"). `before` is the
 * list as it was, `openId` the open one then. The open one answered: the one after it opens. Another answered: the open
 * one stays open. The open one answered when it was the last: the first opens, as by default (the lead, 2026-11-14).
 * Null when nothing is left.
 */
export function openAfterAnswer(before: readonly WaitingItem[], openId: string | null, answeredId: string): string | null {
  const after = before.filter((item) => item.id !== answeredId);
  if (after.length === 0) return null;
  const openNow = openId === null || !before.some((item) => item.id === openId) ? before[0]!.id : openId;
  if (openNow !== answeredId) return openNow;
  const at = before.findIndex((item) => item.id === answeredId);
  return (after[at] ?? after[0]!).id;
}
