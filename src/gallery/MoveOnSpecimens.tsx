// Moving on, as parts (plan dec-7-linked-spots-screens.md piece 4a; mc-36, mc-36a, mc-41, mc-41a, mc-42, mc-42a, dp-4;
// mockup december/01 frames 11, 12, 13, F1, F2, F2b, H4) in the component gallery, and on the layout page
// (`layout.html?moveOn=…`, src/testing/layoutHarness.tsx). An invented harbour of linked spots; its words come from
// the pure helpers (src/modules/expedition/moveOn.ts) as a screen's would. No request is sent and nothing moves: the
// callbacks only change this page's own state. Wired to no screen until the redesigned place page (5b). New pictures
// for Design.
import { useState, type ReactElement, type ReactNode } from 'react';
import type { Barrier } from '../modules/library/routes.ts';
import {
  emptyMoveQueue,
  moveCheckOf,
  moveSheetClosed,
  moveSheetReopened,
  obstacleExtraWords,
  obstacleNameOf,
  obstacleRowWords,
  otherSheetOpen,
  placeNameOf,
  proposalAnswered,
  proposalArrives,
  proposalNotNow,
  proposalOpened,
  queueCountWords,
  shownProposal,
  takesWords,
  thenWords,
  throughCheckOf,
  waitingProposals,
  wayTimeWords,
  type MoveQueue,
} from '../modules/expedition/moveOn.ts';
import { chainOf, placeCheckOf, type ChainEntry } from '../modules/expedition/placeRules.ts';
import { keyedName } from '../modules/expedition/placeTree.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { AreaRows, DestinationRow, MoveOnSheet, ProposalSheet, ProposalsWaiting, WayLine, WhereTo, type GmDestination, type RowProposal, type WayMove } from '../ui/MoveOnParts.tsx';
import { ListRow, RowList } from '../ui/parts.tsx';
import { EndExpeditionRow, RefreshFailedRow, WhereToLine } from '../ui/WhereToParts.tsx';
import { playersDestinationsOf, WHERE_TO_WORDS, type PlayersDestination } from '../modules/expedition/playersWays.ts';
import { PLAYERS_READ_WORDS } from '../modules/expedition/moveOnRows.ts';
import type { WayOn } from '../modules/library/waysOn.ts';

type SpecimenPart = (props: { name: string; children: ReactNode }) => ReactElement;

// ---- An invented harbour (words: names) ----
const PACK = 'pack-reed';
const place = (entryId: string, name: string, data: Record<string, unknown> = {}): ChainEntry => ({ packId: PACK, entryId, name, data });
const HARBOUR = place('harbour', 'The Drowned Harbour', { encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, tableId: 'harbour-encounters' } }); // words: names
const BREAKWATER = place('breakwater', 'The breakwater', { parentId: 'harbour', encounterCheck: { chance: { die: 'd6', on: [1, 2] }, tableId: 'harbour-encounters' } });
const JETTY = place('jetty', 'The jetty', { parentId: 'harbour' });
const PLACES = [HARBOUR, BREAKWATER, JETTY];
const CHECK = moveCheckOf(placeCheckOf(chainOf(PLACES, PACK, 'jetty'), []), null);
const GAP: Barrier = { name: 'the breakwater’s gap', extraTurns: 2, needsApproval: true, through: 'breakwater', note: 'The gap takes a boat only at slack water; otherwise a roll you make.' };
// No name and no place it passes: shown as "Obstacle" alone (pf-12f); not the GM's to decide (needsApproval false).
const WEED: Barrier = { name: null, extraTurns: 1, needsApproval: false, through: null, note: 'The piles are slick with weed.' };
/** An obstacle's name as the sheet shows it (pf-12f): its own, else its place's, else none. */
const nameOf = (b: Barrier) => obstacleNameOf(b, placeNameOf(PLACES, PACK, b.through));

interface Way {
  key: string;
  word: string;
  value: number;
  unit: string;
  barrier?: Barrier;
}
interface Spot {
  id: string;
  number: string | null;
  name: string;
  shown: GmDestination['shown'];
  ways: Way[];
  /** The place it sits in, by its name (sf-9; WT1 A: the GM's heading where the list mixes Areas). */
  area?: string;
  /** Not shown yet: what its players read on their row (WT1 A). */
  players?: string;
}

const IN_HARBOUR = 'The Drowned Harbour'; // words: names
const HARBOUR_SPOTS: Spot[] = [
  { id: 'wreck', number: '2', name: 'The wreck', shown: 'shown', area: IN_HARBOUR, ways: [{ key: 'row', word: 'Rowing', value: 1, unit: 'turn' }, { key: 'swim', word: 'Swimming', value: 3, unit: 'turn' }] },
  { id: 'breakwater', number: '3', name: 'The breakwater', shown: 'shown', area: IN_HARBOUR, ways: [{ key: 'row', word: 'Rowing', value: 1, unit: 'turn' }] },
  { id: 'shed', number: '4', name: 'The customs shed', shown: 'unshown', area: IN_HARBOUR, players: `4. ${PLAYERS_READ_WORDS.unexplored}`, ways: [{ key: 'piles', word: 'Along the piles', value: 2, unit: 'turn', barrier: WEED }] },
  { id: 'cave', number: '5', name: 'The sea cave', shown: 'hidden', area: IN_HARBOUR, ways: [{ key: 'row', word: 'Rowing', value: 2, unit: 'turn', barrier: GAP }] },
];
// WT1 A: a way into a second Area the players don't know yet, under its own heading for the GM.
const LANDING: Spot = { id: 'landing', number: '0', name: 'The landing', shown: 'unshown', area: 'The Shingle Beach', players: PLAYERS_READ_WORDS.elsewhere, ways: [{ key: 'row', word: 'Rowing', value: 1, unit: 'turn' }] }; // words: names
const SPOTS: Spot[] = [...HARBOUR_SPOTS, LANDING];
const LONG: Spot = {
  id: 'stair',
  number: '6',
  name: 'The Long Stair of the Drowned Customs House', // words: names
  shown: 'shown',
  area: IN_HARBOUR,
  ways: [
    { key: 'climb', word: 'Climbing', value: 999, unit: 'turn' },
    { key: 'row', word: 'Rowing', value: 1, unit: 'turn' },
    { key: 'wade', word: 'Wading', value: 6, unit: 'turn' },
  ],
};

// A specimen's way is keyed by its short id ("row"), which is also what its picture is read from (B16; pf-25).
const choices = (spot: Spot) => spot.ways.map((w) => ({ key: w.key, word: w.word, time: wayTimeWords(w), by: w.key }));
/** The GM's rows as `destinationsOf` gives them: a heading only where the spots sit in more than one place (WT1 A). */
const gmDestinations = (spots: Spot[]): GmDestination[] => {
  const mixed = new Set(spots.map((s) => s.area)).size > 1;
  return spots.map((spot) => {
    const met = spot.ways.find((w) => w.barrier)?.barrier;
    return { id: spot.id, number: spot.number, name: spot.name, shown: spot.shown, players: spot.players ?? null, area: mixed ? (spot.area ?? null) : null, obstacle: met ? obstacleRowWords(met, nameOf(met)) : null, ways: choices(spot) };
  });
};

/** What one way's move does, in the sheet's words, as a screen would build it from the pure helpers. */
function moveOf(spots: Spot[], id: string, key: string): WayMove {
  const spot = spots.find((s) => s.id === id)!;
  const way = spot.ways.find((w) => w.key === key)!;
  const barrier = way.barrier ?? null;
  const through = barrier ? throughCheckOf(PLACES, PACK, barrier.through, []) : null;
  return {
    title: `${way.word} to ${keyedName(spot.number, spot.name)}`,
    takes: takesWords(way, barrier),
    then: thenWords(CHECK, through),
    obstacle: barrier ? { name: nameOf(barrier), extra: obstacleExtraWords(barrier), note: barrier.note, needsApproval: barrier.needsApproval } : null,
  };
}

const nothing = () => undefined;

/** The GM's own Move on, in place: the list, or one way's step. */
function GmSheet({ opening, spots = SPOTS, preview = true, wayOut = false, onClose = nothing }: { opening?: { id: string; key: string }; spots?: Spot[]; preview?: boolean; wayOut?: boolean; onClose?: () => void }) {
  return (
    <MoveOnSheet
      here="the jetty"
      destinations={gmDestinations(spots)}
      moveOf={(id, key) => moveOf(spots, id, key)}
      onMove={nothing}
      onAnswer={nothing}
      onElsewhere={nothing}
      onEnd={wayOut ? nothing : undefined}
      onClose={onClose}
      opening={opening ?? null}
      preview={preview}
    />
  );
}

/** A player's Where to? list, as `playersDestinationsOf` gives it, the given proposal standing. */
function PlayersRows({ proposal, rows }: { proposal?: { spot: string; way: string; by: string } | null; rows: PlayersDestination[] }) {
  const [mine, setMine] = useState(proposal ?? null);
  return (
    <WhereTo empty={rows.length === 0}>
      <AreaRows rows={rows} level={4}>
        {(d) => {
          const standing: RowProposal | null = mine && mine.spot === d.id ? (mine.by === 'you' ? { wayKey: mine.way, by: 'you', onCancel: () => setMine(null) } : { wayKey: mine.way, by: mine.by }) : null;
          return <DestinationRow key={d.id} number={d.number} name={d.name} sub={d.wayLine ? <WayLine>{d.wayLine}</WayLine> : undefined} ways={d.ways} onWay={(key) => setMine({ spot: d.id, way: key, by: 'you' })} proposal={standing} />;
        }}
      </AreaRows>
    </WhereTo>
  );
}

// The players' rows, built from their read as a screen builds them (sf-9; WT1 B and C). An invented harbour.
const travel = (key: string, word: string, value: number) => ({ by: key, name: word, value, unit: 'turn' });
const wayOn = (routeId: string, to: WayOn['to'], number: string | null, ways: WayOn['ways'], areaName: string | null, elsewhere = false): WayOn => ({ groupNumber: 1, routeId, to, number, elsewhere, areaName, ways });
const ROW = travel('row', 'Rowing', 1);
const SWIM = travel('swim', 'Swimming', 3);
// WT1 B: the ways lead into the harbour and into an Area the group doesn't know yet ("Elsewhere"); the hidden way isn't sent.
const PLAYERS_TWO_AREAS = playersDestinationsOf(
  [
    wayOn('r-wreck', { placeId: 'wreck', name: 'The wreck' }, '2', [ROW, SWIM], IN_HARBOUR),
    wayOn('r-breakwater', { placeId: 'breakwater', name: 'The breakwater' }, '3', [ROW], IN_HARBOUR),
    wayOn('r-shed', null, '4', [ROW, SWIM], IN_HARBOUR),
    wayOn('r-gate', null, '10', [ROW], IN_HARBOUR),
    wayOn('r-landing', null, null, [ROW], null, true),
  ],
  1,
);
// WT1 C: one Area, so no heading; the last place has no map number.
const PLAYERS_ONE_AREA = playersDestinationsOf(
  [
    wayOn('r-jetty', { placeId: 'jetty', name: 'The jetty' }, '1', [ROW, SWIM], IN_HARBOUR),
    wayOn('r-two', null, '2', [ROW], IN_HARBOUR),
    wayOn('r-three', null, '3', [travel('walk', 'Walking', 2)], IN_HARBOUR),
    wayOn('r-steps', null, null, [travel('walk', 'Walking', 2)], IN_HARBOUR),
  ],
  1,
);
/** One explored spot as a player's row, under no heading. */
const asPlayers = (spot: Spot): PlayersDestination => ({ id: spot.id, name: spot.name, number: spot.number, explored: true, wayLine: null, area: null, ways: choices(spot) });

export function MoveOnSpecimens({ Specimen }: { Specimen: SpecimenPart }) {
  return (
    <>
      <Specimen name="Move on (the GM, WT1 A): one row a destination, its ways as stacked buttons at the right; two Areas, each its heading; the closed eye and what players read; Somewhere else… last; no foot line">
        <GmSheet />
      </Specimen>
      <Specimen name="Move on (the GM) at a Location the pack marks a way out (page 24, WY1d): End expedition, with the door, last">
        <GmSheet wayOut />
      </Specimen>
      <Specimen name="Move on (the GM): a long name and three ways (999 turns); the list with no ways from here">
        <GmSheet spots={[LONG]} />
        <GmSheet spots={[]} />
      </Specimen>
      <Specimen name="One way chosen, no obstacle: what the move does, then Move (the accent); Back to the list">
        <GmSheet opening={{ id: 'wreck', key: 'row' }} />
      </Specimen>
      <Specimen name="One way chosen, with an obstacle the GM decides: the obstacle first, then Do they get through? Yes and No, plain">
        <GmSheet opening={{ id: 'cave', key: 'row' }} />
      </Specimen>
      <Specimen name="One way chosen, an obstacle with no name and no place it passes (Obstacle alone), not the GM's to decide: its block, then Move">
        <GmSheet opening={{ id: 'shed', key: 'piles' }} />
      </Specimen>
      <Specimen name="A proposed way with an obstacle: who asked, 1 of 3 beside the ✕, Not now in the foot">
        <ProposalSheet id="p-wren" askedBy="Wren" move={moveOf(SPOTS, 'cave', 'row')} count="1 of 3" onAnswer={nothing} onNotNow={nothing} onClose={nothing} preview />
      </Specimen>
      <Specimen name="A proposed way with no obstacle: Do they go? Yes the accent; 2 of 3">
        <ProposalSheet id="p-ash" askedBy="Ash" move={moveOf(SPOTS, 'wreck', 'row')} count="2 of 3" onAnswer={nothing} onNotNow={nothing} onClose={nothing} preview />
      </Specimen>
      <Specimen name="Where to? (players, WT1 B): two Areas, each its heading, Elsewhere last; N. Unexplored and Unexplored, the way under it; a tap proposes (here, this page only)">
        <PlayersRows rows={PLAYERS_TWO_AREAS} />
      </Specimen>
      <Specimen name="Where to? (players, WT1 C): one Area, no heading; a place with no map number reads Unexplored">
        <PlayersRows rows={PLAYERS_ONE_AREA} />
      </Specimen>
      <Specimen name="Where to? (players): proposed by you, with Cancel; proposed by another in the group; a long name with three ways">
        <PlayersRows rows={[asPlayers(SPOTS[0]!)]} proposal={{ spot: 'wreck', way: 'row', by: 'you' }} />
        <PlayersRows rows={[asPlayers(SPOTS[1]!)]} proposal={{ spot: 'breakwater', way: 'row', by: 'Wren' }} />
        <PlayersRows rows={[asPlayers(LONG)]} />
      </Specimen>
      {/* A player's Where to? on the Scene (plan dec-9-the-players-scene P2; page 18, PL2 and PL9; d5-2). */}
      <Specimen name="Where to? (players, PL2): before anything of the place is shown, one quiet line and no ways">
        <WhereTo empty={false}>
          <WhereToLine>{WHERE_TO_WORDS.noneYet}</WhereToLine>
        </WhereTo>
      </Specimen>
      <Specimen name="Where to? (players, PL9; d5-2): a refresh that failed above the list it kept, Try again; End expedition last at a way out">
        <WhereTo empty={false}>
          <RefreshFailedRow words={WHERE_TO_WORDS.stale('turn 13')} onRetry={nothing} />
          <DestinationRow name="The wreck" ways={choices(SPOTS[0]!)} onWay={nothing} />
          <EndExpeditionRow onOpen={nothing} />
        </WhereTo>
      </Specimen>
      {/* Page 12, W1 to W3 (5b): proposals that wait, one card in Waiting for you. Nothing feeds it yet (players
          can't propose until Moving on's second half), so it is shown here only. */}
      <Specimen name="Proposals that wait (page 12, W1): one, with an obstacle; Answer… the accent">
        <ProposalsWaiting accent proposals={[{ id: 'w', who: 'Wren', to: 'the sea cave', way: 'Rowing, 2 turns', obstacle: true }]} onAnswer={() => undefined} />
      </Specimen>
      <Specimen name="Proposals that wait (W1, W3): three, first in first out, a long name; Answer… plain beside another waiting card">
        <ProposalsWaiting
          proposals={[
            { id: 'w', who: 'Wren', to: 'the sea cave', way: 'Rowing, 2 turns', obstacle: true },
            { id: 'a', who: 'Ash', to: 'the wreck', way: 'Rowing, 1 turn', obstacle: false },
            { id: 'b', who: 'Bram, who keeps the long stair down to the drowned customs house', to: 'the breakwater', way: 'Swimming, 999 turns', obstacle: false },
          ]}
          onAnswer={() => undefined}
        />
      </Specimen>
    </>
  );
}

// ---- The layout page (`?moveOn=…`) ----

interface Proposal {
  id: string;
  by: string;
  spot: string;
  way: string;
}
const ARRIVALS: Proposal[] = [
  { id: 'p1', by: 'Wren', spot: 'cave', way: 'row' },
  { id: 'p2', by: 'Ash', spot: 'wreck', way: 'row' },
  { id: 'p3', by: 'Tam', spot: 'breakwater', way: 'row' },
];

/**
 * The queue worked by hand (`?moveOn=queue`): "A proposal arrives" brings the next invented one; "Open another sheet"
 * opens an unrelated sheet, so an arrival joins the queue under it (dp-4). The waiting rows open a proposal from where
 * it waits. The state is the pure `MoveQueue`; nothing is sent.
 */
function QueuePage() {
  const [q, setQ] = useState<MoveQueue<Proposal>>(emptyMoveQueue());
  const [next, setNext] = useState(0);
  const [other, setOther] = useState(false);
  const shown = shownProposal(q);
  const arrive = () => {
    const p = ARRIVALS[next % ARRIVALS.length]!;
    setQ((s) => proposalArrives(s, { ...p, id: `${p.id}-${next}` }));
    setNext((n) => n + 1);
  };
  const setOtherOpen = (open: boolean) => {
    setOther(open);
    setQ((s) => otherSheetOpen(s, open));
  };
  const waiting = waitingProposals(q);
  return (
    <main className="gallery__move-page">
      <h1>The jetty</h1>
      <div className="gallery__move-tools">
        <button type="button" className="button-secondary" onClick={arrive}>
          A proposal arrives
        </button>
        <button type="button" className="button-secondary" onClick={() => setOtherOpen(true)}>
          Open another sheet
        </button>
      </div>
      <h2 className="label">Waiting for you</h2>
      {waiting.length === 0 ? (
        <p>Nothing waiting.</p>
      ) : (
        <RowList label="Waiting for you">
          {waiting.map((p) => {
            const spot = SPOTS.find((s) => s.id === p.spot)!;
            const way = spot.ways.find((w) => w.key === p.way)!;
            return <ListRow key={p.id} title={`${p.by} proposes: to ${spot.name.replace(/^The /, 'the ')}`} sub={`${way.word}, ${wayTimeWords(way)}.`} onOpen={() => setQ((s) => proposalOpened(s, p.id))} />;
          })}
        </RowList>
      )}
      {!shown && waiting.length > 0 && (
        // A stand-in for the waiting card's tap (the card itself is 5b's to place): the sheet opens at the first.
        <button type="button" className="button-secondary" onClick={() => setQ((s) => moveSheetReopened(s))}>
          Open the waiting proposals
        </button>
      )}
      {shown && (
        <ProposalSheet
          id={shown.proposal.id}
          askedBy={shown.proposal.by}
          move={moveOf(SPOTS, shown.proposal.spot, shown.proposal.way)}
          count={queueCountWords(shown)}
          onAnswer={() => setQ((s) => proposalAnswered(s, shown.proposal.id))}
          onNotNow={() => setQ((s) => proposalNotNow(s, shown.proposal.id))}
          onClose={() => setQ((s) => moveSheetClosed(s))}
        />
      )}
      {other && (
        <Dialog label="Another sheet" onClose={() => setOtherOpen(false)}>
          <p>Something else the GM has open. A proposal that arrives now waits until this closes.</p>
          <button type="button" className="button-secondary" onClick={arrive}>
            A proposal arrives
          </button>
        </Dialog>
      )}
    </main>
  );
}

/**
 * The layout page's Moving on (`?moveOn=gm`, `way`, `obstacle`, `obstacle-plain`, `proposal`, `proposal-plain`,
 * `players`, `players-other`, `queue`): each part over or on a plain page, for the layout checks and the pictures
 * of the built parts.
 */
export function MoveOnLayoutPage({ state }: { state: string }) {
  if (state === 'queue') return <QueuePage />;
  if (state === 'players' || state === 'players-other') {
    const by = state === 'players' ? 'you' : 'Wren';
    return (
      <main className="gallery__move-page">
        <h1>The jetty</h1>
        <PlayersRows rows={[...PLAYERS_TWO_AREAS.slice(0, -1), { ...asPlayers(LONG), area: IN_HARBOUR }, ...PLAYERS_TWO_AREAS.slice(-1)]} proposal={{ spot: 'wreck', way: 'row', by }} />
      </main>
    );
  }
  const opening = state === 'way' ? { id: 'wreck', key: 'row' } : state === 'obstacle' ? { id: 'cave', key: 'row' } : state === 'obstacle-plain' ? { id: 'shed', key: 'piles' } : undefined;
  return (
    <main className="gallery__move-page">
      <h1>The jetty</h1>
      {state === 'proposal' ? (
        <ProposalSheet id="p-wren" askedBy="Wren" move={moveOf(SPOTS, 'cave', 'row')} count="1 of 3" onAnswer={nothing} onNotNow={nothing} onClose={nothing} />
      ) : state === 'proposal-plain' ? (
        <ProposalSheet id="p-ash" askedBy="Ash" move={moveOf(SPOTS, 'wreck', 'row')} count="2 of 3" onAnswer={nothing} onNotNow={nothing} onClose={nothing} />
      ) : (
        <GmSheet opening={opening} spots={[...HARBOUR_SPOTS, LONG, LANDING]} preview={false} wayOut={state === 'way-out'} />
      )}
    </main>
  );
}
