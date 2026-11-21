// Moving on's words and its queue (plan dec-7-linked-spots-screens.md piece 4a; mc-41, mc-42a, dp-4; mockup
// december/01 frames 11, 12, 13, F2, F2b). An invented harbour of linked spots.
import { describe, expect, it } from 'vitest';
import {
  emptyMoveQueue,
  inSentence,
  moveCheckOf,
  moveSheetClosed,
  moveSheetReopened,
  obstacleNameOf,
  placeNameOf,
  obstacleExtraWords,
  obstacleRowWords,
  otherSheetOpen,
  proposalAnswered,
  proposalArrives,
  proposalNotNow,
  proposalOpened,
  proposalWithdrawn,
  queueCountWords,
  shownProposal,
  takesWords,
  thenWords,
  throughCheckOf,
  timeWords,
  waitingProposals,
  type MoveQueue,
} from './moveOn.ts';
import { chainOf, placeCheckOf, type ChainEntry, type RuleSwitch } from './placeRules.ts';

const entry = (entryId: string, name: string, data: Record<string, unknown> = {}): ChainEntry => ({ packId: 'pack-reed', entryId, name, data });
const harbour = entry('harbour', 'The Drowned Harbour', { encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, tableId: 'harbour-encounters' } });
const breakwater = entry('breakwater', 'The breakwater', { parentId: 'harbour', encounterCheck: { chance: { die: 'd6', on: [1, 2] }, tableId: 'harbour-encounters' } });
const wreck = entry('wreck', 'The wreck', { parentId: 'harbour' });
const jetty = entry('jetty', 'The jetty', { parentId: 'harbour' });
const ALL = [harbour, breakwater, wreck, jetty];
const off: RuleSwitch = { packId: 'pack-reed', entryId: 'harbour', ruleId: 'encounterCheck', which: 'inForce', value: false };
const setting = { name: 'Wandering encounters', chance: { die: 'd6', on: [1] } };

describe('the sheet’s words', () => {
  // Purpose: an amount reads as words, one turn singular and any other count plural, 999 included.
  it('says a time in words', () => {
    expect([timeWords(1, 'turn'), timeWords(3, 'turn'), timeWords(0, 'turn'), timeWords(999, 'turns'), timeWords(2, 'hour')]).toEqual(['1 turn', '3 turns', '0 turns', '999 turns', '2 hours']);
  });

  // Purpose: the Takes line adds an obstacle's extra turns and gives the whole; a way in hours adds the turns without a sum.
  it('says how long a move takes, with an obstacle’s extra turns', () => {
    expect(takesWords({ value: 1, unit: 'turn' }, null)).toBe('1 turn.');
    expect(takesWords({ value: 2, unit: 'turn' }, { extraTurns: 2 })).toBe('2 turns, and 2 more for the obstacle: 4 turns.');
    expect(takesWords({ value: 2, unit: 'turn' }, { extraTurns: 0 })).toBe('2 turns.');
    expect(takesWords({ value: 2, unit: 'hour' }, { extraTurns: 1 })).toBe('2 hours, and 1 turn more for the obstacle.');
  });

  // Purpose: the GM's row warns of an obstacle with its extra time and, where the GM decides, "you decide"; the block's
  // first line is the extra time alone.
  it('says an obstacle on the GM’s row and in its block', () => {
    expect(obstacleRowWords({ extraTurns: 2, needsApproval: true }, 'The breakwater’s gap')).toBe('An obstacle, the breakwater’s gap: 2 turns more; you decide.');
    expect(obstacleRowWords({ extraTurns: 1, needsApproval: false })).toBe('An obstacle: 1 turn more.');
    expect(obstacleRowWords({ extraTurns: 0, needsApproval: true })).toBe('An obstacle: you decide.');
    expect(obstacleRowWords({ extraTurns: 0, needsApproval: false })).toBe('An obstacle.');
    expect([obstacleExtraWords({ extraTurns: 2 }), obstacleExtraWords({ extraTurns: 0 })]).toEqual(['2 turns more.', '']);
  });

  // Purpose (pf-12f): an obstacle is named by its own name, else by the place its crossing passes, else not at all
  // (the heading is "Obstacle" alone).
  it('names an obstacle: its own name, else the place it passes, else none', () => {
    expect(obstacleNameOf({ name: 'the breakwater’s gap' }, 'The breakwater')).toBe('the breakwater’s gap');
    expect(obstacleNameOf({ name: null }, placeNameOf(ALL, 'pack-reed', 'breakwater'))).toBe('The breakwater');
    expect(obstacleNameOf({ name: null }, placeNameOf(ALL, 'pack-reed', 'nowhere'))).toBeNull();
    expect(obstacleNameOf({ name: null }, placeNameOf(ALL, 'pack-reed', null))).toBeNull();
    expect(obstacleNameOf({ name: null })).toBeNull();
  });

  // Purpose: a place's name inside a sentence loses only a leading capital "The".
  it('puts a place’s name inside a sentence', () => {
    expect([inSentence('The breakwater'), inSentence('Saltwick Island'), inSentence('Theodora’s steps')]).toEqual(['the breakwater', 'Saltwick Island', 'Theodora’s steps']);
  });
});

describe('the check a move asks for', () => {
  // Purpose: the place's own check names the move's check while it stands in; switched off, the setting's does; with
  // neither, there is no Then line.
  it('is the place’s own while it stands in, else the setting’s', () => {
    const here = placeCheckOf(chainOf(ALL, 'pack-reed', 'jetty'), []);
    expect(moveCheckOf(here, setting)).toEqual({ name: 'Encounter check', chance: { die: 'd6', on: [1] } });
    expect(moveCheckOf(placeCheckOf(chainOf(ALL, 'pack-reed', 'jetty'), [off]), setting)).toEqual(setting);
    expect(moveCheckOf(null, null)).toBeNull();
    expect(thenWords(null)).toBeNull();
  });

  // Purpose (B9; p2p-19, page 24 WY1a): a place's check with a table and no chance is a roll on that table, so the Move
  // sheet's last line reads "a roll on Encounters in the harbour." by the table's own name; a check with a chance, or
  // a table the caller can't name, keeps today's words.
  it('says a roll on the table for a check with a table and no chance', () => {
    const roll = entry('roll', 'The Anchorage', { encounterCheck: { when: 'eachMove', replacesScheduled: true, tableId: 'harbour-encounters' } });
    const names = (id: string) => (id === 'harbour-encounters' ? 'Encounters in the harbour' : null);
    const check = moveCheckOf(placeCheckOf([roll], [], names), null, names);
    expect(check).toEqual({ name: 'Encounters in the harbour', chance: null, roll: 'Encounters in the harbour' });
    expect(thenWords(check)).toBe('a roll on Encounters in the harbour.');
    expect(thenWords(moveCheckOf(placeCheckOf([roll], []), null))).toBe('Encounter check.');
    expect(moveCheckOf(placeCheckOf(chainOf(ALL, 'pack-reed', 'jetty'), [], names), null, names)).toEqual({ name: 'Encounters in the harbour', chance: { die: 'd6', on: [1] } });
  });

  // Purpose: the Then line names the check and its chance; a way through a place with its own check takes that place's
  // chance, read by placeCheckOf ("with the breakwater's chance", frame 13).
  it('says the check, and the chance of a place the crossing passes', () => {
    const check = moveCheckOf(placeCheckOf(chainOf(ALL, 'pack-reed', 'jetty'), []), null);
    expect(thenWords(check)).toBe('Encounter check, 1 in 6.');
    const through = throughCheckOf(ALL, 'pack-reed', 'breakwater', []);
    expect(through).toEqual({ placeName: 'The breakwater', chance: { die: 'd6', on: [1, 2] } });
    expect(thenWords(check, through)).toBe('Encounter check, with the breakwater’s chance: 2 in 6.');
    expect(thenWords({ name: 'Encounter check', chance: null })).toBe('Encounter check.');
  });

  // Purpose: a place with no check of its own lends no chance (the harbour's above it is the move's check already), and
  // a place not in the entries lends none.
  it('lends no chance from a place without its own check', () => {
    expect(throughCheckOf(ALL, 'pack-reed', 'wreck', [])).toBeNull();
    expect(throughCheckOf(ALL, 'pack-reed', 'nowhere', [])).toBeNull();
    expect(throughCheckOf(ALL, 'pack-reed', null, [])).toBeNull();
  });
});

describe('the queue of proposed ways (mc-42a, dp-4)', () => {
  const p = (id: string) => ({ id, by: id.toUpperCase() });
  type P = ReturnType<typeof p>;
  const arrive = (q: MoveQueue<P>, ...ids: string[]) => ids.reduce((s, id) => proposalArrives(s, p(id)), q);

  // Purpose: the first proposal opens its sheet by itself; later ones wait and are counted ("1 of 3"); answering opens
  // the next, first in first out, and the count follows.
  it('opens by itself and works first in, first out, counted', () => {
    let q = arrive(emptyMoveQueue<P>(), 'wren');
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(queueCountWords(shownProposal(q))).toBeNull();
    q = arrive(q, 'ash', 'tam');
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(queueCountWords(shownProposal(q))).toBe('1 of 3');
    q = proposalAnswered(q, 'wren');
    expect(shownProposal(q)?.proposal.id).toBe('ash');
    expect(queueCountWords(shownProposal(q))).toBe('1 of 2');
    q = proposalAnswered(q, 'ash');
    expect(shownProposal(q)?.proposal.id).toBe('tam');
    q = proposalAnswered(q, 'tam');
    expect(shownProposal(q)).toBeNull();
    expect(waitingProposals(q)).toEqual([]);
  });

  // Purpose (dp-4): a proposal arriving while the GM has another sheet open joins the queue and doesn't open over it;
  // the open proposal is never displaced either, and the count updates; when the other sheet closes, the first in opens.
  it('never covers an open sheet: a new one joins the queue and the count updates', () => {
    let q = otherSheetOpen(emptyMoveQueue<P>(), true);
    q = arrive(q, 'wren', 'ash');
    expect(shownProposal(q)).toBeNull();
    expect(waitingProposals(q).map((x) => x.id)).toEqual(['wren', 'ash']);
    q = otherSheetOpen(q, false);
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(queueCountWords(shownProposal(q))).toBe('1 of 2');
    q = arrive(q, 'tam');
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(queueCountWords(shownProposal(q))).toBe('1 of 3');
  });

  // Purpose: Not now leaves one as a waiting row and goes on to the next; the row opens it again later, at the front.
  it('Not now leaves a waiting row; its row opens it again', () => {
    let q = arrive(emptyMoveQueue<P>(), 'wren', 'ash');
    q = proposalNotNow(q, 'wren');
    expect(shownProposal(q)?.proposal.id).toBe('ash');
    expect(queueCountWords(shownProposal(q))).toBeNull();
    expect(waitingProposals(q).map((x) => x.id)).toEqual(['ash', 'wren']);
    q = proposalAnswered(q, 'ash');
    expect(shownProposal(q)).toBeNull();
    q = proposalOpened(q, 'wren');
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(q.aside).toEqual([]);
  });

  // Purpose: the ✕ closes the sheet and leaves every proposal waiting; nothing opens by itself until the next arrives,
  // which opens the sheet at the first in.
  it('the ✕ leaves them all waiting until the next arrives', () => {
    let q = arrive(emptyMoveQueue<P>(), 'wren', 'ash');
    q = moveSheetClosed(q);
    expect(shownProposal(q)).toBeNull();
    expect(waitingProposals(q).map((x) => x.id)).toEqual(['wren', 'ash']);
    q = otherSheetOpen(otherSheetOpen(q, true), false);
    expect(shownProposal(q)).toBeNull();
    q = arrive(q, 'tam');
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(queueCountWords(shownProposal(q))).toBe('1 of 3');
  });

  // Purpose (ruled 2026-11-13): closing hides nothing and answers nothing: the waiting card's tap opens the sheet again
  // at the first still waiting, the queue first, then one set aside; with nothing waiting it does nothing.
  it('the waiting card reopens the sheet at the first', () => {
    let q = moveSheetClosed(arrive(emptyMoveQueue<P>(), 'wren', 'ash'));
    q = moveSheetReopened(q);
    expect(shownProposal(q)?.proposal.id).toBe('wren');
    expect(queueCountWords(shownProposal(q))).toBe('1 of 2');
    q = moveSheetClosed(proposalAnswered(proposalNotNow(q, 'wren'), 'ash'));
    expect(waitingProposals(q).map((x) => x.id)).toEqual(['wren']);
    expect(shownProposal(moveSheetReopened(q))?.proposal.id).toBe('wren');
    const none = emptyMoveQueue<P>();
    expect(moveSheetReopened(none)).toBe(none);
  });

  // Purpose: a player's Cancel takes their proposal out wherever it waits; if it was open, the next opens.
  it('a withdrawn proposal leaves, and the next opens', () => {
    let q = arrive(emptyMoveQueue<P>(), 'wren', 'ash', 'tam');
    q = proposalNotNow(q, 'wren');
    q = proposalWithdrawn(q, 'wren');
    q = proposalWithdrawn(q, 'ash');
    expect(shownProposal(q)?.proposal.id).toBe('tam');
    expect(waitingProposals(q).map((x) => x.id)).toEqual(['tam']);
  });

  // Purpose: a proposal arriving again with the same id is updated where it stands, never queued twice.
  it('the same proposal again is updated in place', () => {
    let q = arrive(emptyMoveQueue<P>(), 'wren', 'ash');
    q = proposalArrives(q, { id: 'ash', by: 'Ash, again' });
    expect(waitingProposals(q)).toEqual([p('wren'), { id: 'ash', by: 'Ash, again' }]);
    q = proposalNotNow(q, 'wren');
    q = proposalArrives(q, { id: 'wren', by: 'Wren, again' });
    expect(waitingProposals(q).map((x) => x.by)).toEqual(['Ash, again', 'Wren, again']);
    expect(proposalNotNow(q, 'nobody')).toBe(q);
    expect(proposalOpened(q, 'nobody')).toBe(q);
  });
});
