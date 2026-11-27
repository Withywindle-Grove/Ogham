// Moving on between linked spots, as parts (plan dec-7-linked-spots-screens.md piece 4a; mc-36, mc-36a, mc-41, mc-41a,
// mc-42, mc-42a, dp-4; mockup december/01 frames 11, 12, 13, F1, F2, F2b, H4 and its phone frame). Callbacks and props
// only: no request is sent, no proposal is stored and no move is made here (piece 4b). Wired to no screen until the
// redesigned place page (5b); shown in the gallery and on the layout page (`layout.html?moveOn=…`).
//
// - `WayButton`: a way of moving, stacked: its picture where the app has one, else the generic way mark (B16; pf-25,
//   ap-10; d5-11), the action word,
//   its time; every one a list's size (mc-36a).
// - `DestinationRow`: one destination, its ways as way buttons at the right; for the GM and players alike (mc-36,
//   mc-36a). On a narrow row (a phone) the buttons take a line under the name, sharing its width (frame H4, phone).
// - `AreaRows`: rows under their Areas' names where a list mixes Areas, "Elsewhere" for players (sf-9; WT1).
// - `ObstacleBlock`: "Obstacle: <name>", on a slightly different tone (mc-41, mc-41a), the extra time and the book's note.
// - `MoveOnSheet`: the GM's own Move on, the list then one way (frames 11 under the rulings, 12, 13; the way's step
//   redrawn by page 44, PU1 A, sf-15).
// - `ProposalSheet`: a proposed way, the same sheet with who asked and the count beside the ✕ (F2, F2b; mc-42a).
// - `TravelPopUp`: a player's tap on a way (PL4c, redrawn by page 44, PU1 B, sf-15).
import { Fragment, useId, useState, type ReactNode } from 'react';
import { PLAYERS_READ_WORDS } from '../modules/expedition/moveOnRows.ts';
import { keyedName } from '../modules/expedition/placeTree.ts';
import { CentredPopUpScope, Dialog, SheetScope } from './Dialog.tsx';
import { DiceWords } from './dice.tsx';
import { WAY_MARK, wayIconOf } from './iconSet.ts';
import { Icon, StepIcon } from './icons.tsx';
import { ListRow, StackedButton, WarningLine } from './parts.tsx';
import './MoveOnParts.css';

/** One way of moving to a destination, as its button says it. */
export interface WayChoice {
  /** The way's id on the link ("row"); unique within its row. */
  key: string;
  /** Its action word, as the pack names the way ("Rowing"). */
  word: string;
  /** Its time ("1 turn"). */
  time: string;
  /**
   * The way's short id as the pack writes it ("row"): read for its picture where the pack names no icon (pf-25). A row
   * that passes none shows no picture: the GM's rows pass it (`destinationsOf`); the players' rows will once B13's P2
   * wires them to `campaign_ways_on`, which sends it.
   */
  by?: string;
  /** The icon the pack names for this way (pf-25); the GM's read only, no player is sent one. */
  icon?: string;
}

/**
 * A way's button, stacked: its picture, the action word, its time, on three lines (ap-10; page 18, frame PL7), the
 * 2 px edge, every button in a list one size (mc-36a, frame H4). The picture is pf-25's (`wayIconOf`): the way's own
 * `icon`, else the one the app has for its `by`; a way with neither shows its word and time alone (plan
 * scene-point-to-point, B16). It is decoration: the label stays the way's word and its time. `pressed` (the way
 * proposed on a player's row): the Selected wash and a tick before the word, so the state never rests on colour alone,
 * and ", proposed" in its label. Not a toggle: no button carries aria-pressed (a tap proposes; taking it back is the
 * row's Cancel). Never disabled: what a tap does is the caller's.
 */
export function WayButton({ way, destination, pressed, onTap }: { way: WayChoice; destination: string; pressed?: boolean; onTap: () => void }) {
  const picture = wayIconOf({ by: way.by ?? '', icon: way.icon });
  return (
    <button type="button" className={pressed ? 'way-button way-button--proposed' : 'way-button'} aria-label={`${way.word}, ${way.time}, to ${destination}${pressed ? ', proposed' : ''}`} onClick={onTap}>
      <span className="way-button__icon" aria-hidden="true">
        {picture === WAY_MARK ? <StepIcon name="travel" size={24} /> : <Icon name={picture} size={24} />}
      </span>
      <span className="way-button__word">
        {pressed && (
          <span className="way-button__tick" aria-hidden="true">
            <Icon name="tick" size={16} />
          </span>
        )}
        {way.word}
      </span>
      <span className="way-button__time">{way.time}</span>
    </button>
  );
}

/**
 * A proposal standing on a player's row (01-07b, 01-08b): the caller's own, with Cancel, or another player's in the
 * group, named, with no Cancel (a prop only: who proposed is piece 4b's to read).
 */
export type RowProposal = { wayKey: string; by: 'you'; onCancel: () => void } | { wayKey: string; by: string };

/**
 * One destination (mc-36): its map number and name at the left (the pin before them), a quiet line under the name
 * where it has one, its ways as way buttons at the right. A row with a proposal standing is washed, the proposed way
 * ticked, and a line under it says whose proposal waits.
 */
export function DestinationRow({
  number,
  name,
  sub,
  ways,
  onWay,
  proposal,
}: {
  /** The spot's number on the map's key ("2"), as the key writes it; none for a place without one. */
  number?: string | null;
  name: string;
  /** Under the name: the GM's lines (`GmDestinationLines`) or a player's "Not yet explored." */
  sub?: ReactNode;
  ways: WayChoice[];
  onWay: (key: string) => void;
  proposal?: RowProposal | null;
}) {
  // p2p-3: "3. The Breakwater", the number with its full stop, by the place page's own rule (`keyedName`): a name that
  // already starts with its number isn't doubled, and a name that is only its number stays as it is (no number drawn).
  const full = keyedName(number, name);
  const numbered = !!number && full.startsWith(`${number}. `);
  const rest = numbered ? full.slice(number.length + 2) : full;
  return (
    <div className={`destination-row${proposal ? ' destination-row--proposed' : ''}`} role="group" aria-label={full}>
      <div className="destination-row__main">
        <span className="destination-row__pin" aria-hidden="true">
          <Icon name="pin" size={20} />
        </span>
        <span className="destination-row__text">
          <span className="destination-row__name">
            {numbered && <span className="destination-row__number">{`${number}.`}</span>}
            {rest}
          </span>
          {sub}
        </span>
        <span className="destination-row__ways">
          {ways.map((way) => (
            <WayButton key={way.key} way={way} destination={full} pressed={proposal ? proposal.wayKey === way.key : undefined} onTap={() => onWay(way.key)} />
          ))}
        </span>
      </div>
      {proposal && (
        <div className="destination-row__proposed">
          <p>{proposal.by === 'you' ? 'Proposed by you: waiting for your GM.' : `Proposed by ${proposal.by}.`}</p>
          {'onCancel' in proposal && (
            // ic-1 (P12): the icon above the word, the app's cross in a circle as "Take it off" has it.
            <StackedButton icon="cancel" label="Cancel" onClick={proposal.onCancel} />
          )}
        </div>
      )}
    </div>
  );
}

/** What the players know of a destination, on the GM's row (frame 11). */
export type ShownToPlayers = 'shown' | 'unshown' | 'hidden';

/**
 * The GM's lines under a destination's name (frame 11; sf-9, WT1 A, finding 21): for a place not shown yet, the closed
 * eye and what the players read on their row ("4. Unexplored"; `players`, from `playersLineOf`), its spoken name "Not
 * shown yet. Players read: …"; a place shown has no line. The crossed eye marks a way the GM keeps hidden (ds-2: the
 * GM's alone). A way's obstacle as a warning line (`obstacleRowWords`).
 */
export function GmDestinationLines({ shown, players, obstacle }: { shown: ShownToPlayers; players?: string | null; obstacle?: string | null }) {
  return (
    <>
      {shown === 'hidden' && (
        <span className="destination-row__sub destination-row__sub--hidden">
          <Icon name="eye-off" size={16} />
          Hidden from players
        </span>
      )}
      {shown === 'unshown' && players && (
        <span className="destination-row__sub destination-row__sub--unshown">
          <span className="destination-row__eye" role="img" aria-label={PLAYERS_READ_WORDS.eye}>
            <Icon name="eye-shut" size={16} />
          </span>
          {players}
        </span>
      )}
      {obstacle && (
        <span className="destination-row__sub">
          <WarningLine>{obstacle}</WarningLine>
        </span>
      )}
    </>
  );
}

/**
 * A player's line under a place not explored (sf-9, N3; WT1 B, C): its way in words ("Rowing or swimming."), under
 * "4. Unexplored" or "Unexplored", so the row says no less than it did.
 */
export function WayLine({ children }: { children: ReactNode }) {
  return <span className="destination-row__sub">{children}</span>;
}

/**
 * Rows under their Areas' headings (WT1, ⚑ 8): the rows in the order given, an Area's name (or "Elsewhere") over each
 * run of rows that carry it, in small capitals; rows with no `area` under none (one Area only: WT1 C). `level`: the
 * heading's level under its list's own heading (4 under "Where to?", 3 in the Move on sheet).
 */
export function AreaRows<T extends { id: string; area?: string | null }>({ rows, level, children }: { rows: readonly T[]; level: 3 | 4; children: (row: T) => ReactNode }) {
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <>
      {rows.map((row, i) => (
        <Fragment key={row.id}>
          {row.area && row.area !== rows[i - 1]?.area && <Heading className="move-sheet__area">{row.area}</Heading>}
          {children(row)}
        </Fragment>
      ))}
    </>
  );
}

/** An obstacle on a way, as the GM's sheet shows it (mc-41, mc-41a): its name, its extra time and the book's note. */
export interface ObstacleView {
  /** Its name ("the breakwater’s gap"); none when the pack names none: the heading is "Obstacle" alone. */
  name?: string | null;
  /** "2 turns more." (`obstacleExtraWords`), or empty. */
  extra: string;
  /** The book's note: the GM's to read, never a player's (mc-28a). */
  note: string;
  /** The GM decides whether they get through (`barrier.needsApproval`). */
  needsApproval: boolean;
}

/** The obstacle block: "Obstacle: <name>" on a slightly different tone (mc-41a), then the extra time and the note. */
export function ObstacleBlock({ obstacle }: { obstacle: ObstacleView }) {
  const heading = obstacle.name ? `Obstacle: ${obstacle.name}` : 'Obstacle';
  const words = [obstacle.extra, obstacle.note].filter(Boolean).join(' ');
  return (
    <div className="obstacle-block" role="group" aria-label={heading}>
      <p className="obstacle-block__head">{heading}</p>
      {words && <p className="obstacle-block__words">{words}</p>}
    </div>
  );
}

/** One way's move, as its sheet says it before anything happens (frames 12, 13, F2, F2b; page 24, WY1a). */
export interface WayMove {
  /** The sheet's title, the way and where to: "Row to 1. The Jetty" (WY1a). It says where, so no line repeats it. */
  title: string;
  /** "2 turns, and 2 more for the obstacle: 4 turns." (`takesWords`) */
  takes: string;
  /** "Encounter check, 1 in 6.", "a roll on Encounters in the harbour." (`thenWords`); none when no check is asked. */
  then?: string | null;
  obstacle?: ObstacleView | null;
}

/**
 * The sheet's short lines: who asked, how long, the check after (frame 12's list, less light and rest; page 24, WY1a:
 * no Where line, the title says it).
 */
function MoveSummary({ move, askedBy }: { move: WayMove; askedBy?: string }) {
  const line = (icon: Parameters<typeof Icon>[0]['name'], term: string, value: ReactNode) => (
    <div className="move-summary__line">
      <dt>
        <Icon name={icon} size={20} />
        {term}
      </dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="move-summary">
      {askedBy && line('players', 'Asked by', `${askedBy}.`)}
      {line('hourglass', 'Takes', move.takes)}
      {move.then && line('encounter-check', 'Then', <DiceWords>{move.then}</DiceWords>)}
    </dl>
  );
}

/**
 * The question at the foot of the sheet's body. A way whose obstacle the GM decides: "Do they get through?", Yes and No
 * equal and plain (frame 13, F2). A proposed way with none: "Do they go?", Yes the accent (F2b). (The GM's own way with
 * none asks nothing: Move is in its foot, PU1 A.)
 */
function Answer({ decide, onAnswer }: { decide: boolean; onAnswer: (yes: boolean) => void }) {
  return (
    <div className="move-sheet__ask">
      <p className="move-sheet__question">{decide ? 'Do they get through?' : 'Do they go?'}</p>
      <div className="move-sheet__two">
        <button type="button" className={decide ? 'button-secondary' : 'button-primary'} onClick={() => onAnswer(true)}>
          Yes
        </button>
        <button type="button" className="button-secondary" onClick={() => onAnswer(false)}>
          No
        </button>
      </div>
    </div>
  );
}

/**
 * A way's sheet body: the obstacle first, then the short lines, then the question where there is one. No line explains
 * what the log keeps (p2p-17: "no explaining lines"; page 24, WY1a). The GM's own step (`onBack`; page 44, PU1 A,
 * sf-15): one foot row, the standard pop-up's, Back at the left and, where the GM decides nothing, Move (the accent,
 * with the footprints) at the right. A proposal's: Not now alone in its foot (`foot`).
 */
function WayBody({ move, askedBy, onMove, onAnswer, onBack, foot }: { move: WayMove; askedBy?: string; onMove: () => void; onAnswer: (yes: boolean) => void; onBack?: () => void; foot?: ReactNode }) {
  const decide = move.obstacle?.needsApproval === true;
  const plain = askedBy === undefined && !decide;
  return (
    <>
      {move.obstacle && <ObstacleBlock obstacle={move.obstacle} />}
      <MoveSummary move={move} askedBy={askedBy} />
      {!plain && <Answer decide={decide} onAnswer={onAnswer} />}
      {onBack ? (
        <div className="dialog__actions move-sheet__split">
          <button type="button" className="button-secondary button-secondary--small" onClick={onBack}>
            Back
          </button>
          {plain && (
            <button type="button" className="button-primary" onClick={onMove}>
              <StepIcon name="travel" size={20} />
              Move
            </button>
          )}
        </div>
      ) : (
        <div className="move-sheet__foot">{foot}</div>
      )}
    </>
  );
}

/** A destination on the GM's Move on list. */
export interface GmDestination {
  id: string;
  number?: string | null;
  name: string;
  shown: ShownToPlayers;
  /** Not shown yet: what its players read on their row ("4. Unexplored"; `playersLineOf`). */
  players?: string | null;
  /** The heading it stands under where the list mixes Areas (WT1 A; `destinationsOf`); none with one Area. */
  area?: string | null;
  /** The warning on its row when one of its ways meets an obstacle (`obstacleRowWords`). */
  obstacle?: string | null;
  ways: WayChoice[];
}

/**
 * The GM's own Move on (frames 11, 12, 13; frame 11's ways under each destination are superseded by mc-36 and mc-36a:
 * one row a destination, its ways stacked buttons at the right; page 24, WY1d). The list first: "From <here>, where
 * to?", a row for each destination, "Somewhere else…", then, at a Location the pack marks a way out, "End expedition"
 * last (p2p-22, B10). No foot line (p2p-17). A tap on a way opens its step (`moveOf` gives what it does): the obstacle
 * and the question where the GM decides, else Move; Back returns to the list. Nothing happens until Move or an answer.
 */
export function MoveOnSheet({
  here,
  destinations,
  moveOf,
  onMove,
  onAnswer,
  onElsewhere,
  onEnd,
  onClose,
  opening = null,
  preview = false,
}: {
  /** Where the party is, inside a sentence ("the jetty"). */
  here: string;
  destinations: GmDestination[];
  moveOf: (destinationId: string, wayKey: string) => WayMove;
  onMove: (destinationId: string, wayKey: string) => void;
  onAnswer: (destinationId: string, wayKey: string, yes: boolean) => void;
  /** The free jump (the place picker), its row after the destinations. */
  onElsewhere: () => void;
  /**
   * Leaving (p2p-22; page 24, WY1d): the last row, "End expedition", with the band's door and a chevron. Given only at
   * a Location the pack marks a way out; absent, there is no such row.
   */
  onEnd?: () => void;
  onClose: () => void;
  /** Opens at one way's step (the gallery and the layout page). */
  opening?: { id: string; key: string } | null;
  /** In place, for the gallery (Dialog's preview). */
  preview?: boolean;
}) {
  const [step, setStep] = useState<{ id: string; key: string } | null>(opening);
  if (step) {
    const move = moveOf(step.id, step.key);
    return (
      // A key per step: the list and each way's step are separate pop-ups to the Dialog, so its focus and Tab trap
      // start again on each (review of #755: focus fell to the page). The step is the standard pop-up, as tall as its
      // words (PU1 A, sf-15): centred on a tablet, a sheet from the foot on a phone (sf-28), never the wide one.
      <SheetScope.Provider key={`${step.id}:${step.key}`} value>
        <CentredPopUpScope.Provider value>
          <Dialog label={move.title} over="Move on" onClose={onClose} preview={preview}>
            <WayBody move={move} onMove={() => onMove(step.id, step.key)} onAnswer={(yes) => onAnswer(step.id, step.key, yes)} onBack={() => setStep(null)} />
          </Dialog>
        </CentredPopUpScope.Provider>
      </SheetScope.Provider>
    );
  }
  return (
    <Dialog key="list" label={`From ${here}, where to?`} over="Move on" onClose={onClose} preview={preview} wide>
      {destinations.length === 0 && <p className="move-sheet__none">No ways on from here in your packs. Somewhere else… takes the party anywhere.</p>}
      <div className="move-sheet__rows">
        <AreaRows rows={destinations} level={3}>
          {(d) => <DestinationRow key={d.id} number={d.number} name={d.name} sub={<GmDestinationLines shown={d.shown} players={d.players} obstacle={d.obstacle} />} ways={d.ways} onWay={(key) => setStep({ id: d.id, key })} />}
        </AreaRows>
      </div>
      <div className="move-sheet__elsewhere">
        <ListRow title="Somewhere else…" onOpen={onElsewhere} />
        {onEnd && <ListRow title="End expedition" icon={<Icon name="exit-door" size={24} />} onOpen={onEnd} />}
      </div>
    </Dialog>
  );
}

/**
 * A proposed way, the sheet that opens by itself for the GM (F2, F2b; mc-42, mc-42a): "<Name> proposes" over the
 * title, the count beside the ✕ when several wait ("1 of 3", `queueCountWords`), the obstacle first if the way has
 * one, who asked, then the answer; Not now in the foot. The queue it works through is `MoveQueue` (moveOn.ts).
 */
export function ProposalSheet({
  id,
  askedBy,
  move,
  count,
  onAnswer,
  onNotNow,
  onClose,
  preview = false,
}: {
  /**
   * The proposal's id: its Dialog's key, so the next proposal after Yes or Not now opens as a pop-up of its own and
   * the focus and the Tab trap start again (the re-review of #755).
   */
  id: string;
  /** Who proposed it ("Wren"). */
  askedBy: string;
  move: WayMove;
  count?: string | null;
  onAnswer: (yes: boolean) => void;
  onNotNow: () => void;
  onClose: () => void;
  /** In place, for the gallery (Dialog's preview). */
  preview?: boolean;
}) {
  return (
    <Dialog key={id} label={move.title} over={`${askedBy} proposes`} onClose={onClose} preview={preview} wide headAction={count ? <span className="move-sheet__count">{count}</span> : undefined}>
      <WayBody
        move={move}
        askedBy={askedBy}
        onMove={() => onAnswer(true)}
        onAnswer={onAnswer}
        foot={
          <button type="button" className="button-secondary button-secondary--small" onClick={onNotNow}>
            Not now
          </button>
        }
      />
    </Dialog>
  );
}

/**
 * A player's tap on a way (PL4c, redrawn by page 44, PU1 B and E; sf-15, finding 23): the title says the way and the
 * place as the row names it (`wayTapWords`), then "Takes 1 turn." labelled as the GM's line is, the built sentence, and
 * a plain "Got it" at the foot's right (a pop-up to read), so it no longer ends in a sentence with only the ✕. Centred on
 * a tablet, a sheet from the foot on a phone (sf-28). Nothing is proposed (pw-1).
 */
export function TravelPopUp({ title, time, words, onClose, preview = false }: { title: string; time: string; words: string; onClose: () => void; preview?: boolean }) {
  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label={title} onClose={onClose} preview={preview} reading plainTitle>
          <MoveSummary move={{ title, takes: time }} />
          <p className="travel-pop__words">{words}</p>
        </Dialog>
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}

/**
 * The players' list of destinations under "Where to?" (mc-36a), a row each; nothing at all when there are none. The
 * heading is a card's sub-heading in the book's faces, as "Activities" beside it (page 18, PL1; st-8).
 */
export function WhereTo({ children, empty }: { children: ReactNode; empty: boolean }) {
  const id = useId();
  if (empty) return null;
  return (
    <section className="where-to" aria-labelledby={id}>
      <h3 id={id} className="where-to__heading">
        Where to?
      </h3>
      <div className="move-sheet__rows">{children}</div>
    </section>
  );
}

/** A proposed way waiting for the GM, as "Waiting for you" lists it (page 12, W1 to W3). */
export interface WaitingProposal {
  id: string;
  /** Who proposed it ("Wren"). */
  who: string;
  /** Where to, as the GM's list names it ("the sea cave"). */
  to: string;
  /** The way and its time, as the GM's list says them ("Rowing, 2 turns"). */
  way: string;
  /** The way meets an obstacle: "An obstacle." with the warning sign (the sheet says which, before the GM answers). */
  obstacle: boolean;
}

/**
 * Proposals that wait (page 12, W1 to W3; mc-42a): when the GM closes a proposal's sheet without answering, it waits
 * here, one card in "Waiting for you". One waiting: "<who> proposes: to <where>", then the way and its time and whether
 * it meets an obstacle. Several: "N ways proposed", each a numbered line in the order it came. One button, "Answer…",
 * reopens the sheet at the first of them (the queue's own order); the answer is never given on the card. The accent when
 * nothing else on the screen has it (`accent`). Nothing at all when none wait.
 */
export function ProposalsWaiting({ proposals, accent = false, onAnswer }: { proposals: readonly WaitingProposal[]; accent?: boolean; onAnswer: () => void }) {
  if (proposals.length === 0) return null;
  const one = proposals.length === 1 ? proposals[0]! : null;
  const title = one ? `${one.who} proposes: to ${one.to}` : `${proposals.length} ways proposed`;
  const obstacle = (p: WaitingProposal) =>
    p.obstacle && (
      <>
        {' '}
        <WarningLine>An obstacle.</WarningLine>
      </>
    );
  return (
    <section className="proposals-waiting" aria-label={title}>
      <Icon name="pin" size={20} />
      <div className="proposals-waiting__body">
        <h3 className="proposals-waiting__title">{title}</h3>
        {one ? (
          <p className="proposals-waiting__line">
            {`${one.way}.`}
            {obstacle(one)}
          </p>
        ) : (
          <ol className="proposals-waiting__list">
            {proposals.map((p) => (
              <li key={p.id} className="proposals-waiting__line">
                <strong>{`${p.who}:`}</strong>
                {` to ${p.to}. ${p.way}.`}
                {obstacle(p)}
              </li>
            ))}
          </ol>
        )}
        <div className="proposals-waiting__foot">
          <button type="button" className={accent ? 'button-primary' : 'button-secondary'} onClick={onAnswer}>
            Answer…
          </button>
        </div>
      </div>
    </section>
  );
}
