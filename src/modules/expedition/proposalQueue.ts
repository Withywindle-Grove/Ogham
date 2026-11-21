// The GM's queue of proposed ways (dec-7 piece 4, the logic only; mc-42a, dp-4 in
// docs/design/rulings/dec-mockup-rulings-2026-11-12.md and dec-linked-spots-picks-2026-11-13.md). Players propose a
// way to move on; each proposal reaches the GM as a sheet that opens by itself; several waiting are counted ("1 of 3")
// and worked first in, first out; Not now leaves one as a waiting row. A pure reducer: state and events in, state out.
// It holds only what identifies a proposal and its order: never an obstacle's note, extra time or chance.

/**
 * A proposal as the queue knows it: its id (the request's) and the group that proposed it (one a group at a time).
 * A null group is the whole party, a group of its own (as the requests module's `group: number | null`).
 */
export interface QueuedProposal {
  id: string;
  group: number | null;
  /** Put off with Not now: kept as a waiting row, never opened again by itself. */
  putOff: boolean;
}

export interface ProposalQueue {
  /** Every proposal not yet answered, withdrawn or replaced, in arrival order (put-off ones included). */
  proposals: QueuedProposal[];
  /** The proposal whose sheet is open, or null. */
  openId: string | null;
  /**
   * The other sheets open, by name (they can stack): nothing opens by itself until none is left. A set rather than a
   * bare number, so the same sheet's event seen twice counts once. A sheet with no name is ''.
   */
  otherSheets: string[];
  /**
   * Ids that have left (answered, withdrawn, replaced), and ids withdrawn before their arrival was seen: a late copy
   * of their arrival is not brought back.
   */
  left: string[];
}

export type ProposalQueueEvent =
  | { type: 'arrived'; proposal: { id: string; group: number | null } }
  | { type: 'answered'; id: string }
  // Closing a proposal's sheet by its X is the same event as Not now (the lead, 2026-11-13).
  | { type: 'notNow'; id: string }
  | { type: 'tapped'; id: string }
  | { type: 'withdrawn'; id: string }
  | { type: 'otherSheetOpened'; sheet?: string }
  | { type: 'otherSheetClosed'; sheet?: string };

export const EMPTY_PROPOSAL_QUEUE: ProposalQueue = { proposals: [], openId: null, otherSheets: [], left: [] };

/** The first in line that has not been put off opens, when nothing else is open. */
function openNext(state: ProposalQueue): ProposalQueue {
  if (state.openId !== null || state.otherSheets.length > 0) return state;
  const next = state.proposals.find((p) => !p.putOff);
  return next ? { ...state, openId: next.id } : state;
}

/** Removes the proposals with these ids wherever they are; if the open one went, the next in line opens. */
function remove(state: ProposalQueue, gone: string[]): ProposalQueue {
  if (gone.length === 0) return state;
  const proposals = state.proposals.filter((p) => !gone.includes(p.id));
  const openId = state.openId !== null && gone.includes(state.openId) ? null : state.openId;
  return openNext({ ...state, proposals, openId, left: [...state.left, ...gone] });
}

export function proposalQueue(state: ProposalQueue, event: ProposalQueueEvent): ProposalQueue {
  switch (event.type) {
    case 'arrived': {
      const { id, group } = event.proposal;
      if (state.left.includes(id) || state.proposals.some((p) => p.id === id)) return state;
      // One proposal a group at a time: a new one replaces the last, wherever it was.
      const replaced = state.proposals.filter((p) => p.group === group).map((p) => p.id);
      const without = remove(state, replaced);
      // Joined after the replaced one has left, so it waits at the end; it opens only if nothing else is open.
      return openNext({ ...without, proposals: [...without.proposals, { id, group, putOff: false }] });
    }
    case 'answered':
      // Only the open one is answered (Yes or No on its sheet); anything else changes nothing.
      return state.openId === event.id ? remove(state, [event.id]) : state;
    case 'withdrawn':
      if (state.proposals.some((p) => p.id === event.id)) return remove(state, [event.id]);
      // Withdrawn before its arrival was seen: remember it, so the late arrival never opens.
      return state.left.includes(event.id) ? state : { ...state, left: [...state.left, event.id] };
    case 'notNow': {
      if (state.openId !== event.id) return state;
      const proposals = state.proposals.map((p) => (p.id === event.id ? { ...p, putOff: true } : p));
      return openNext({ ...state, proposals, openId: null });
    }
    case 'tapped': {
      // A waiting row is tapped only when no sheet is open; with one open, or on a row not put off, the tap changes
      // nothing (ruled as built by the lead, 2026-11-13; status file §7).
      if (state.openId !== null || state.otherSheets.length > 0) return state;
      if (!state.proposals.some((p) => p.id === event.id && p.putOff)) return state;
      const proposals = state.proposals.map((p) => (p.id === event.id ? { ...p, putOff: false } : p));
      return { ...state, proposals, openId: event.id };
    }
    case 'otherSheetOpened': {
      const sheet = event.sheet ?? '';
      return state.otherSheets.includes(sheet) ? state : { ...state, otherSheets: [...state.otherSheets, sheet] };
    }
    case 'otherSheetClosed': {
      const sheet = event.sheet ?? '';
      if (!state.otherSheets.includes(sheet)) return state;
      return openNext({ ...state, otherSheets: state.otherSheets.filter((s) => s !== sheet) });
    }
  }
}

/**
 * The count beside the sheet's X ("1 of 3"): the open one's place in arrival order among all not yet answered, put-off
 * ones included in both. Null when nothing is open.
 */
export function proposalCount(state: ProposalQueue): { place: number; total: number } | null {
  if (state.openId === null) return null;
  const index = state.proposals.findIndex((p) => p.id === state.openId);
  return index < 0 ? null : { place: index + 1, total: state.proposals.length };
}

/** The waiting rows: the proposals put off with Not now and not open, in arrival order. */
export function waitingRows(state: ProposalQueue): QueuedProposal[] {
  return state.proposals.filter((p) => p.putOff && p.id !== state.openId);
}
