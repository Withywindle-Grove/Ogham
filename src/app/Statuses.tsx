// Statuses on screen (M5 step 9; docs/05 "Status symbols"; docs/06 "Status symbols", Components; ruled 2026-10-25,
// 2026-10-29 D27, 2026-10-30 WA3; S4-7: pop-ups over nested collapsibles). Each status is a symbol (its first letter
// in a circle) whose ring drains as its timer runs; stacks show a small number; a secret timer shows the symbol
// without the fill to players (they never get its time). Tap one for its name, level, source, rules text, time left
// and how it ends, with Step up / Step down for one with levels and Remove for whoever may (the GM, or the
// character's owner). + Status picks one of the setting's conditions (a pop-up with a search bar) or takes a typed
// name, with an optional timer in rounds, turns, hours or days; the GM can keep it secret (Hide time left). Every
// change happens at once with an Undo toast and is logged. Derived statuses (B25, Can't cast) stay as they are.
// From the M5 gate (B6, ruled 2026-11-01; mockup design/mockups/m5-gate/b6-statuses.html): the pop-up is wide (the
// whole screen on a phone) with the durations on one chip row (1 turn · 1 hour · Until rest · Until removed ·
// Other…), every status row shows its brief effect under its name, conditions sharing a pack `family` sit behind one
// row that opens the kinds, and a custom status (name, What it does, duration, Stacks) is kept in the campaign's
// homebrew as a condition, so it's offered next time.
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import { runCommand, type Command, type CurrentUser } from '../core/commands.ts';
import { describeEntry, loadLogNames, loadTargetLog } from '../core/events.ts';
import { loadCampaignHeading } from '../core/myCampaigns.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { inUnit, toSeconds, type TimeUnits } from '../modules/expedition/clock.ts';
import { loadClockNow } from '../modules/expedition/lightPlay.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import {
  addStatus,
  conditionRows,
  conditionsOf,
  customCondition,
  durationChoices,
  loadStatuses,
  loadStatusSecrets,
  mayAddStatus,
  mayChangeStatus,
  readCondition,
  removeStatus,
  setStatusTime,
  shownName,
  statusEffect,
  sourceWords,
  statusLabel,
  statusTime,
  stepStatus,
  symbolOf,
  timerOf,
  timerSeconds,
  timerUnits,
  type CharacterStatus,
  type Condition,
  type DurationChoice,
  type NewStatus,
  type StatusSecret,
} from '../modules/expedition/statusPlay.ts';
import { saveHomebrewEntry } from '../modules/library/homebrew.ts';
import { BookPopUpScope, Dialog } from '../ui/Dialog.tsx';
import { ButtonRow, Chip, ListRow, RowList, StatusSymbol, Stepper, Switch, ToggleButton } from '../ui/parts.tsx';
import { StatusRing, StatusRingMark, StatusRingMore, StatusRingRow, type RingLayout } from '../ui/StatusRing.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { forgetCampaignSetting, loadCampaignSetting } from './campaignSetting.ts';
import { useSeesAsGm } from './playerView.ts';
import { registry } from './services.ts';
import { ringView } from './statusRings.ts';
import './Statuses.css';

/** The Player screen's head shows every status up to this many; with more, some and "+N" (ps-5: "four in view"). */
export const HEAD_RINGS = 4;

/** Everything a screen needs to show statuses: those on now, the GM's secret timers, the clock, units and conditions. */
export interface StatusBook {
  campaignId: string;
  statuses: CharacterStatus[];
  secrets: ReadonlyMap<string, StatusSecret>;
  now: number;
  units: TimeUnits;
  conditions: Condition[];
}

/** The campaign's statuses as this person may see them (a player's device never gets secret timers). */
export function useStatusBook(db: Db, user: CurrentUser, campaignId: string, refresh: number): { book: StatusBook | null | 'error'; reload: () => void } {
  const [book, setBook] = useState<StatusBook | null | 'error'>(null);
  const [version, setVersion] = useState(0);
  // The GM's view as the player reads no secret timers: it shows the player's statuses exactly (pg32-3).
  const gm = useSeesAsGm(user, campaignId);
  useEffect(() => {
    let current = true;
    void Promise.all([
      loadStatuses(db, campaignId),
      gm ? loadStatusSecrets(db, campaignId) : Promise.resolve(new Map<string, StatusSecret>()),
      loadClockNow(db, campaignId),
      loadCampaignSettings(db, campaignId),
      loadCampaignSetting(db, user.id, campaignId),
    ]).then(([statuses, secrets, now, settings, setting]) => {
      if (!current) return;
      if (!statuses || !secrets || now === null) return setBook('error');
      setBook({
        campaignId,
        statuses,
        secrets,
        now,
        units: campaignUnits(settings ?? null, setting?.rulesSets ?? []),
        conditions: conditionsOf(setting?.all ?? []),
      });
    });
    return () => {
      current = false;
    };
  }, [db, user.id, campaignId, gm, refresh, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { book, reload };
}

/** A status's symbol as this viewer sees it: the ring drains with its timer, unless the timer is hidden from them. */
export function OneStatusSymbol({ status, book, viewer }: { status: CharacterStatus; book: StatusBook; viewer: 'gm' | 'player' }) {
  const time = statusTime(status, book.secrets, book.now, book.units, viewer);
  const fill = time.shown?.fillPercent ?? null;
  return <StatusSymbol name={shownName(status)} symbol={symbolOf(status)} left={fill} of={fill === null ? undefined : 100} stacks={status.stacks} label={statusLabel(status, time)} />;
}

/**
 * The symbols of one character's statuses, read only (inside the marching order's character button): up to `limit`,
 * then "+N". Nothing when there are none.
 */
export function StatusMarks({ book, actorId, viewer, limit = 2 }: { book: StatusBook | null | 'error'; actorId: string; viewer: 'gm' | 'player'; limit?: number }) {
  if (!book || book === 'error') return null;
  const mine = book.statuses.filter((s) => s.actorId === actorId);
  if (mine.length === 0) return null;
  const more = mine.length - limit;
  return (
    <span className="status-marks">
      {mine.slice(0, limit).map((s) => (
        <OneStatusSymbol key={s.id} status={s} book={book} viewer={viewer} />
      ))}
      {more > 0 && <span className="status-marks__more" aria-label={`${more} more ${more === 1 ? 'status' : 'statuses'}`}>{`+${more}`}</span>}
    </span>
  );
}

/** "Weary ×2, Dazed": one character's statuses in words, for a screen reader's label (empty without any). */
export function statusWordsOf(book: StatusBook | null | 'error', actorId: string): string {
  if (!book || book === 'error') return '';
  return book.statuses
    .filter((s) => s.actorId === actorId)
    .map((s) => `${shownName(s)}${s.stacks > 1 ? ` ×${s.stacks}` : ''}`)
    .join(', ');
}

/** Who a status screen is about. */
export interface StatusCharacter {
  id: string;
  campaignId: string;
  name: string;
  ownerUserId: string | null;
}

/**
 * One character's statuses: each a tappable symbol (or, `list`, a row with its words), then + Status for whoever may.
 * The Player screen's header, the character overview.
 */
export function CharacterStatuses({
  db,
  user,
  book,
  character,
  onChanged,
  list = false,
  rings = false,
  inView,
  extra,
  onOpenLog,
}: {
  db: Db;
  user: CurrentUser;
  book: StatusBook | null | 'error';
  character: StatusCharacter;
  onChanged: () => void;
  list?: boolean;
  /**
   * The Player screen's Statuses row (plan m5b-creation-retest-3 F, R3-6): each status a Status ring under the heading
   * "Statuses"; with none (and no `extra`), neither the row nor its heading is drawn.
   */
  rings?: boolean;
  /**
   * The Player screen's head (dec-13 C2, ps-5; frames P1 and P2): with `rings`, the rings sit beside the portrait with
   * no heading. Up to four show; with more, this many show and "+N" opens every status. One or two read their name and
   * time in words beside the ring; three or more are the ring alone.
   */
  inView?: number;
  /** Rings drawn before the statuses in the row (the derived casting status); in the head, drawn in the given layout. */
  extra?: ReactNode | ((layout: RingLayout) => ReactNode);
  /** The sheet's log line opens the log (the Player screen's Log); without it the line has no chevron. */
  onOpenLog?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // The head's "+N" sheet: every status, each a tile that opens its own sheet (dec-13 C2).
  const [all, setAll] = useState(false);
  // The GM's time-left taps, one after another, so quick taps land in the order they were made.
  const timeTaps = useRef<Promise<unknown>>(Promise.resolve());
  const show = useToast();
  // In the GM's view as the player, the player's statuses and words (pg32-3); his acts there still run as his.
  const viewer = useSeesAsGm(user, character.campaignId) ? 'gm' : 'player';
  const may = mayChangeStatus(user, character);
  // + Status is the GM's only (C1): a player asks aloud. Not in the GM's view as the player, as the player's (M3c).
  const mayAdd = viewer === 'gm' && mayAddStatus(user, character);

  if (book === null) return list ? <p className="auth__meta">Loading…</p> : null;
  if (book === 'error') return list ? <p className="auth__meta">Couldn't load the statuses. Check your connection and try again.</p> : null;
  const mine = book.statuses.filter((s) => s.actorId === character.id);
  const opened = mine.find((s) => s.id === open) ?? null;

  /** Runs a status command; on success an Undo toast (the same Undo as the log). */
  async function act<I, T, O>(command: Command<I, T, O>, input: I, words: string): Promise<boolean> {
    const result = await runCommand(registry, db, user, command, input);
    onChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    show({
      text: words,
      onUndo: async () => {
        const eventId = await latestChange(db, character.campaignId, command.name, user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: character.campaignId, eventId, authorUserId: user.id }) : null;
        onChanged();
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
      },
    });
    return true;
  }

  const sheets = (
    <>
      {opened && (
        <StatusSheet
          status={opened}
          book={book}
          viewer={viewer}
          may={may}
          character={character}
          db={db}
          user={user}
          onOpenLog={
            onOpenLog
              ? () => {
                  setOpen(null);
                  onOpenLog();
                }
              : undefined
          }
          onClose={() => setOpen(null)}
          onStep={async (step) => {
            const last = step === -1 && (opened.level ?? 0) <= 0;
            const next = opened.levels?.[(opened.level ?? 0) + step]?.name;
            if (await act(stepStatus, { character, status: opened, step }, last ? `${shownName(opened)} ended on ${character.name}` : `${character.name} is ${next ?? 'changed'} now`)) {
              if (last) setOpen(null);
            }
          }}
          onRemove={async () => {
            if (await act(removeStatus, { character, status: opened }, viewer === 'gm' ? `Ended ${shownName(opened)} on ${character.name}` : `Removed ${shownName(opened)} from ${character.name}`)) setOpen(null);
          }}
          onSetTime={(secondsLeft, words) => {
            const next = timeTaps.current.then(() => act(setStatusTime, { character, status: opened, secondsLeft }, `${shownName(opened)} on ${character.name}: ${words}`));
            timeTaps.current = next;
            return next;
          }}
        />
      )}
      {adding && (
        <AddStatus
          book={book}
          gm={viewer === 'gm'}
          who={character.name}
          onClose={() => setAdding(false)}
          onAdd={async (status) => {
            const before = mine.find((s) => (status.condition ? s.conditionId === status.condition.id : s.conditionId === null && s.name.toLowerCase() === status.name.trim().toLowerCase()));
            const name = status.condition?.name ?? status.name.trim();
            const words = before?.stacking ? `${name} ×${before.stacks + 1} on ${character.name}` : before?.levels ? `${character.name} steps up: ${name}` : before ? `${character.name} has ${name} already` : `Added ${name} to ${character.name}`;
            if (await act(addStatus, { target: { campaignId: character.campaignId, characters: [character], secret: status.secret }, status }, words)) setAdding(false);
          }}
          onCustom={async (custom) => {
            // Kept in the campaign's homebrew as a condition (offered next time), then given like one.
            const data = customCondition(book.conditions, custom.name, custom.does, custom.stacks);
            const saved = await saveCustomStatus(db, user, character.campaignId, data);
            if (!saved.ok) return show({ text: saved.message, error: true });
            const condition = readCondition(saved.value, data);
            if (!condition) return show({ text: "Couldn't keep that status. Try again.", error: true });
            const status: NewStatus = { name: condition.name, condition, timer: custom.timer, secret: custom.secret, note: custom.does.trim() || null, untilRest: custom.untilRest };
            if (await act(addStatus, { target: { campaignId: character.campaignId, characters: [character], secret: status.secret }, status }, `Added ${condition.name} to ${character.name}`)) setAdding(false);
          }}
        />
      )}
    </>
  );

  const addButton = mayAdd && (
    <button type="button" className="button-secondary button-secondary--small char-statuses__add" onClick={() => setAdding(true)} aria-label={`Add a status to ${character.name}`}>
      + Status
    </button>
  );

  const ringOf = (s: CharacterStatus, layout: RingLayout, onOpen = () => setOpen(s.id)) => {
    const view = ringView(s, book, viewer);
    return (
      <StatusRing
        key={s.id}
        layout={layout}
        name={view.name}
        icon={view.icon}
        tone={view.tone}
        fraction={view.fraction}
        endless={view.endless}
        words={view.words}
        label={`${statusLabel(s, statusTime(s, book.secrets, book.now, book.units, viewer))}. Details`}
        onOpen={onOpen}
      />
    );
  };
  const extraOf = (layout: RingLayout) => (typeof extra === 'function' ? extra(layout) : extra);

  if (rings && inView !== undefined) {
    // The Player screen's head (dec-13 C2, ps-5; frames P1 and P2): the rings beside the portrait, no heading. Up to
    // four in view; with more, `inView` of them and "+N", which opens every status. The derived casting status leads,
    // so it is always in view (and stays out of the "+N" sheet, which would otherwise open a sheet over a sheet).
    const extraCount = extra ? 1 : 0;
    const count = mine.length + extraCount;
    if (count === 0 && !addButton) return null;
    const shown = count <= HEAD_RINGS ? count : Math.min(inView, count);
    // One or two: the name and time in words beside the ring (P2); three or more: the ring alone (P1).
    const layout: RingLayout = count <= 2 ? 'beside' : 'bare';
    return (
      <div className="char-statuses char-statuses--head">
        {count > 0 && (
          <StatusRingRow>
            {extraOf(layout)}
            {mine.slice(0, Math.max(0, shown - extraCount)).map((s) => ringOf(s, layout))}
            {count > shown && <StatusRingMore count={count - shown} onOpen={() => setAll(true)} />}
          </StatusRingRow>
        )}
        {addButton}
        {all && (
          <Dialog label="Statuses" onClose={() => setAll(false)}>
            <StatusRingRow>
              {mine.map((s) =>
                ringOf(s, 'tile', () => {
                  setAll(false);
                  setOpen(s.id);
                }),
              )}
            </StatusRingRow>
          </Dialog>
        )}
        {sheets}
      </div>
    );
  }

  if (rings) {
    // Encumbrance is not a status (R3-6): the Pack's load bar tracks it, so nothing here adds one.
    const any = mine.length > 0 || Boolean(extra);
    if (!any && !addButton) return null;
    return (
      <section className="char-statuses char-statuses--rings" aria-labelledby={any ? `statuses-${character.id}` : undefined}>
        {any && (
          <>
            <h2 id={`statuses-${character.id}`} className="play-block__title">
              Statuses
            </h2>
            <StatusRingRow>
              {extraOf('tile')}
              {mine.map((s) => ringOf(s, 'tile'))}
            </StatusRingRow>
          </>
        )}
        {addButton}
        {sheets}
      </section>
    );
  }

  return (
    <div className={list ? 'char-statuses char-statuses--list' : 'char-statuses'}>
      {list && mine.length === 0 && <p className="overview__words">No statuses</p>}
      {list ? (
        <ul className="char-statuses__rows">
          {mine.map((s) => {
            const time = statusTime(s, book.secrets, book.now, book.units, viewer);
            const effect = statusEffect(s, book.conditions);
            return (
              <li key={s.id}>
                <button type="button" className="char-statuses__row" onClick={() => setOpen(s.id)} aria-label={`${statusLabel(s, time)}${effect ? `. ${effect}` : ''}. Details`}>
                  <OneStatusSymbol status={s} book={book} viewer={viewer} />
                  <span className="char-statuses__words">
                    <span>{`${shownName(s)}${s.stacks > 1 ? ` ×${s.stacks}` : ''}`}</span>
                    {/* B6: the brief effect under the name, for the GM and the player. */}
                    {effect && <span className="char-statuses__effect">{effect}</span>}
                    <span className="auth__meta">{time.words ?? time.ends}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        mine.map((s) => (
          <button key={s.id} type="button" className="char-statuses__symbol" onClick={() => setOpen(s.id)} aria-label={`${statusLabel(s, statusTime(s, book.secrets, book.now, book.units, viewer))}. Details`}>
            <OneStatusSymbol status={s} book={book} viewer={viewer} />
          </button>
        ))
      )}
      {addButton}
      {sheets}
    </div>
  );
}

/** Who put a status on and its newest log line, from its own history (null while loading or when it can't be read). */
function useStatusLog(db: Db, user: CurrentUser, campaignId: string, status: CharacterStatus): { setBy: string | null; line: string | null } | null {
  const [log, setLog] = useState<{ setBy: string | null; line: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([loadTargetLog(db, campaignId, 'character_statuses', status.id), loadLogNames(db, campaignId, user.id)]).then(([entries, names]) => {
      if (!live || !entries || entries.length === 0) return;
      const first = entries.at(-1)!.main.actorUserId;
      const setBy = !first ? null : first === user.id ? 'You' : (names.people.get(first) ?? null);
      setLog({ setBy, line: describeEntry(entries[0]!, names) });
    });
    return () => {
      live = false;
    };
  }, [db, user.id, campaignId, status.id, status.version]);
  return log;
}

/**
 * A status tapped (plan m5b-creation-retest-3 F, R3-6; mockup players/02): the big ring, "<n> of <m> <units> left",
 * how it ends, what it does, Source, Set by, its log line (a chevron to the log where the screen has one), then the
 * one action: Step up / Step down for one with levels; Remove for the character's player; End it now for the GM. A
 * GM-only change is named in a line, not offered. The GM's sheet adds the time-left stepper for a timed status
 * (`TimeLeftStepper`, status.setTime; follow-up to the rings).
 */
function StatusSheet({
  status,
  book,
  viewer,
  may,
  character,
  db,
  user,
  onOpenLog,
  onClose,
  onStep,
  onRemove,
  onSetTime,
}: {
  status: CharacterStatus;
  book: StatusBook;
  viewer: 'gm' | 'player';
  may: boolean;
  character: StatusCharacter;
  db: Db;
  user: CurrentUser;
  onOpenLog?: () => void;
  onClose: () => void;
  onStep: (step: 1 | -1) => void;
  onRemove: () => void;
  /** The GM's stepper: the new time left in seconds and in words; true when it went through. */
  onSetTime?: (secondsLeft: number, words: string) => Promise<boolean>;
}) {
  const time = statusTime(status, book.secrets, book.now, book.units, viewer);
  const view = ringView(status, book, viewer);
  const rules = statusEffect(status, book.conditions);
  const levels = status.levels;
  const at = status.level ?? 0;
  const log = useStatusLog(db, user, character.campaignId, status);
  const timed = time.words !== null;
  const bookLines = useContext(BookPopUpScope);
  return (
    // The status's word as the title; whose it is on the first line (Design on #553, 2026-11-07).
    <Dialog label={shownName(status)} onClose={onClose}>
      <div className="status-sheet">
        <div className="status-sheet__head">
          <StatusRingMark name={view.name} icon={view.icon} tone={view.tone} fraction={view.fraction} endless={view.endless} big />
          <div>
            <p className="status-sheet__line">{character.name}</p>
            {view.count && <p className="status-sheet__line status-sheet__count">{view.count}</p>}
            {levels && <p className="status-sheet__line">{`${status.name}, level ${at + 1} of ${levels.length}`}</p>}
            {status.stacks > 1 && <p className="status-sheet__line">{`${status.stacks} stacks`}</p>}
            <p className="auth__meta">{time.ends}</p>
          </div>
        </div>
        {levels && (
          <ol className="status-sheet__levels" aria-label="Levels, in order">
            {levels.map((l, i) => (
              <li key={l.id} aria-current={i === at ? 'step' : undefined} className={i === at ? 'status-sheet__level status-sheet__level--now' : 'status-sheet__level'}>
                {i === at ? `${l.name} (now)` : l.name}
              </li>
            ))}
          </ol>
        )}
        {rules && <p className="status-sheet__rules">{rules}</p>}
        {status.note && status.note !== rules && <p className="status-sheet__rules">{status.note}</p>}
        {bookLines ? (
          // In the book's pop-ups (tfb-1; page M2, frame M2k): "Source" and "Set by" as the book's labelled lines, the
          // log line a row that leads to the log; no line on who changes the time left (voice rule 16, tfw-2; his fix
          // of 2026-11-19).
          <>
            <p className="book-line">
              <span className="book-label">Source</span> {sourceWords(status)}
            </p>
            {log?.setBy && (
              <p className="book-line">
                <span className="book-label">Set by</span> {log.setBy}
              </p>
            )}
            {log?.line && <RowList label="About this status">{onOpenLog ? <ListRow title={log.line} onOpen={onOpenLog} openLabel={`Log: ${log.line}. Open the log`} /> : <ListRow title={log.line} />}</RowList>}
          </>
        ) : (
          <>
            <RowList label="About this status">
              <ListRow label title="Source" sub={sourceWords(status)} />
              {log?.setBy && <ListRow label title="Set by" sub={log.setBy} />}
              {log?.line && (onOpenLog ? <ListRow label title="Log" sub={log.line} onOpen={onOpenLog} openLabel={`Log: ${log.line}. Open the log`} /> : <ListRow label title="Log" sub={log.line} />)}
            </RowList>
            {viewer === 'player' && timed && <p className="auth__meta">Only the GM changes the time left.</p>}
          </>
        )}
        {viewer === 'gm' && may && onSetTime && <TimeLeftStepper status={status} book={book} onSetTime={onSetTime} />}
        <div className="dialog__actions status-sheet__actions">
          {may && levels && (
            <>
              <button type="button" className="button-secondary" onClick={() => onStep(1)}>
                Step up
              </button>
              <button type="button" className="button-secondary" onClick={() => onStep(-1)}>
                {at <= 0 ? 'Step down (ends it)' : 'Step down'}
              </button>
            </>
          )}
          {may && (
            <button type="button" className="button-secondary" onClick={onRemove}>
              {viewer === 'gm' ? 'End it now' : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** The most the time-left stepper goes to, in the status's own unit. */
const TIME_LEFT_MAX = 999;

/**
 * The GM's time-left stepper (follow-up to the status rings; plan m5b-creation-retest-3 F): − N + in the status's own
 * unit ("turns left"), each tap at once with an Undo toast. Shown only for a timer the GM can read in a unit the clock
 * has (a secret one too: it stays in the GM's table). A tap at 1 or at the top stays tappable and says why: ending it
 * is End it now.
 */
function TimeLeftStepper({ status, book, onSetTime }: { status: CharacterStatus; book: StatusBook; onSetTime: (secondsLeft: number, words: string) => Promise<boolean> }) {
  const timer = timerOf(status, book.secrets, book.now);
  const left = timer && timer.remaining !== null ? inUnit(timer.remaining, timer.unit, book.units) : null;
  const live = left?.value ?? null;
  // The number tapped to, shown while the book still holds the time it was tapped from (or until the step fails).
  const [pending, setPending] = useState<{ from: number; to: number } | null>(null);
  const [limit, setLimit] = useState<'min' | 'max' | null>(null);
  if (!left || live === null) return null;
  const unitWord = (n: number) => `${left.unit}${n === 1 ? '' : 's'}`;
  const value = pending && pending.from === live ? pending.to : live;
  const change = (to: number) => {
    setLimit(null);
    const seconds = toSeconds({ value: to, unit: left.unit }, book.units);
    if (seconds === null || seconds < 1) return;
    setPending({ from: live, to });
    void onSetTime(seconds, `${to} ${unitWord(to)} left`).then((done) => {
      if (!done) setPending(null);
    });
  };
  return (
    <div className="status-sheet__time">
      <p className="status-sheet__time-label" aria-hidden="true">
        Time left
      </p>
      <div className="status-sheet__time-row">
        <Stepper label={`${left.unit}s left`} value={value} min={1} max={TIME_LEFT_MAX} onChange={change} onLimit={setLimit} />
        <span aria-hidden="true">{unitWord(value)}</span>
      </div>
      {limit && (
        <p className="auth__meta" role="status">
          {limit === 'min' ? `It can't go under 1 ${left.unit}. To end it now, tap End it now.` : `The stepper stops at ${TIME_LEFT_MAX} ${left.unit}s.`}
        </p>
      )}
    </div>
  );
}

const UNIT_LABEL: Record<string, string> = { round: 'Rounds', turn: 'Turns', hour: 'Hours', day: 'Days' };

/** Saves a custom status into the campaign's homebrew as a condition (the GM's; logged as homebrew.save). */
async function saveCustomStatus(db: Db, user: CurrentUser, campaignId: string, data: Record<string, unknown>) {
  const campaignName = (await loadCampaignHeading(db, campaignId))?.name.trim() || 'Campaign';
  const saved = await runCommand(registry, db, user, saveHomebrewEntry, { campaignId, campaignName, kind: 'condition', data });
  if (saved.ok) forgetCampaignSetting(campaignId);
  return saved.ok ? { ok: true as const, value: saved.value } : { ok: false as const, message: saved.message };
}

/** What the custom status's form gives: a name, what it does, Stacks, and how long. */
export interface CustomStatus {
  name: string;
  does: string;
  stacks: boolean;
  timer: { seconds: number; unit: string } | null;
  untilRest: boolean;
  secret: boolean;
}

/** "Dazed → Reeling → Out cold · 3 levels", "stacks", "3 rounds": what a condition's row says beside its name. */
function conditionMeta(c: Condition): string {
  if (c.levels) return `${c.levels.map((l) => l.name).join(' → ')}, ${c.levels.length} levels`;
  return [c.stacks ? 'stacks' : '', c.defaultRounds ? `${c.defaultRounds} ${c.defaultRounds === 1 ? 'round' : 'rounds'}` : ''].filter(Boolean).join(', ');
}

/** The letter in a circle for a row of the pop-up (no timer yet; the screen reader hears the row's words instead). */
const RowSymbol = ({ name }: { name: string }) => (
  <span className="add-status__symbol" aria-hidden="true">
    <StatusSymbol name={name} symbol={(name.trim().charAt(0) || '•').toUpperCase()} />
  </span>
);

/**
 * + Status (M5 gate B6; a wide pop-up, the whole screen on a phone): How long on one chip row, then the setting's
 * conditions, each with its brief effect and Add; a family row opens its kinds; + Custom status… gives a name, What
 * it does, how long and Stacks. The search field never takes focus by itself (A4). A condition's own default rounds
 * win over the chips. For the GM, Hide time left when it has a timer.
 */
function AddStatus({
  book,
  gm,
  who,
  onClose,
  onAdd,
  onCustom,
}: {
  book: StatusBook;
  gm: boolean;
  who: string;
  onClose: () => void;
  onAdd: (status: NewStatus) => Promise<void> | void;
  onCustom: (custom: CustomStatus) => Promise<void> | void;
}) {
  const [view, setView] = useState<{ kind: 'list' } | { kind: 'family'; name: string } | { kind: 'custom' }>({ kind: 'list' });
  const [typed, setTyped] = useState('');
  const [duration, setDuration] = useState<DurationChoice>('removed');
  const units = timerUnits(book.units);
  const [unit, setUnit] = useState<string>(units[0] ?? 'turn');
  const [amount, setAmount] = useState('');
  const [secret, setSecret] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // One add at a time: a second tap while the first is saving does nothing (it would stack twice).
  const [busy, setBusy] = useState(false);
  async function once(run: () => Promise<void> | void) {
    if (busy) return;
    setBusy(true);
    try {
      await run();
    } finally {
      setBusy(false);
    }
  }
  const [customName, setCustomName] = useState('');
  const [does, setDoes] = useState('');
  const [stacks, setStacks] = useState(false);
  const rows = useMemo(() => conditionRows(book.conditions, typed), [book.conditions, typed]);
  const choices = durationChoices(book.units);
  const timed = duration === 'turn' || duration === 'hour' || duration === 'other';

  /** The chosen length: a timer, until rest, or none; a problem in words when Other… can't be read. */
  function chosenTime(condition: Condition | null): { timer: { seconds: number; unit: string } | null; untilRest: boolean } | string {
    if (condition?.defaultRounds && units.includes('round')) {
      const seconds = timerSeconds(condition.defaultRounds, 'round', book.units);
      if (seconds) return { timer: { seconds, unit: 'round' }, untilRest: false };
    }
    if (duration === 'removed') return { timer: null, untilRest: false };
    if (duration === 'rest') return { timer: null, untilRest: true };
    const [value, inUnit] = duration === 'other' ? [Number(amount), unit] : [1, duration];
    const seconds = duration !== 'other' || /^\d+$/.test(amount.trim()) ? timerSeconds(value, inUnit, book.units) : null;
    if (seconds === null) return `How many ${UNIT_LABEL[inUnit]?.toLowerCase() ?? inUnit}? A whole number from 1 to 9999.`;
    return { timer: { seconds, unit: inUnit }, untilRest: false };
  }

  function add(condition: Condition) {
    const time = chosenTime(condition);
    if (typeof time === 'string') return setProblem(time);
    void once(() => onAdd({ name: condition.name, condition, timer: time.timer, untilRest: time.untilRest, secret: gm && secret && time.timer !== null }));
  }

  function addCustom(event: FormEvent) {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return setProblem('Give the status a name.');
    if (name.length > 80) return setProblem('Keep the name to 80 characters.');
    const known = book.conditions.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (known) return setProblem(`${known.name} is in the list already: add it from there.`);
    const time = chosenTime(null);
    if (typeof time === 'string') return setProblem(time);
    void once(() => onCustom({ name, does: does.trim(), stacks, timer: time.timer, untilRest: time.untilRest, secret: gm && secret && time.timer !== null }));
  }

  const howLong = (
    <div className="add-status__how-long">
      <span className="label" id="add-status-how-long">
        How long
      </span>
      {/* One row, never wrapping: it scrolls sideways on a phone. */}
      <div className="add-status__durations" role="group" aria-labelledby="add-status-how-long">
        {choices.map((c) => (
          <Chip
            key={c.value}
            pressed={duration === c.value}
            onClick={() => {
              setDuration(c.value);
              setProblem(null);
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      {duration === 'other' && (
        <>
          <ButtonRow
            label="Timer"
            options={units.map((u) => ({ value: u, label: UNIT_LABEL[u] ?? u }))}
            value={unit}
            onChange={(value) => {
              setUnit(value);
              setProblem(null);
            }}
          />
          <label className="field">
            <span className="label">{`How many ${UNIT_LABEL[unit]?.toLowerCase() ?? unit}`}</span>
            <input className="field__input field__input--short" inputMode="numeric" value={amount} maxLength={4} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
          </label>
        </>
      )}
      {gm && timed && <Switch label="Hide time left from players" on={secret} onChange={setSecret} />}
    </div>
  );

  const errorLine = problem && (
    <p className="form-error" role="alert">
      {problem}
    </p>
  );

  const conditionRow = (c: Condition) => {
    const meta = conditionMeta(c);
    return (
      <li key={c.id} className="add-status__row">
        <RowSymbol name={c.name} />
        <span className="add-status__words">
          <span className="add-status__row-name">{c.levels ? meta : meta ? `${c.name}, ${meta}` : c.name}</span>
          {c.note && <span className="add-status__effect">{c.note}</span>}
        </span>
        <button type="button" className="button-secondary add-status__add" aria-label={`Add ${c.name}`} onClick={() => add(c)}>
          Add
        </button>
      </li>
    );
  };

  const back = (title: string, meta?: string) => (
    <div className="add-status__back">
      <button
        type="button"
        className="dialog__back"
        aria-label="Back to the list"
        onClick={() => {
          setView({ kind: 'list' });
          setProblem(null);
        }}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <h3 className="add-status__title">{title}</h3>
      {meta && <span className="auth__meta">{meta}</span>}
    </div>
  );

  const close = (
    <div className="dialog__actions">
      <button type="button" className="button-secondary button-secondary--small" onClick={onClose}>
        Cancel
      </button>
    </div>
  );

  if (view.kind === 'custom') {
    return (
      <Dialog label={`Add a status to ${who}`} onClose={onClose} wide>
        <form className="add-status" onSubmit={addCustom} noValidate>
          {back('Custom status')}
          <label className="field">
            <span className="label">Name</span>
            <input className="field__input" value={customName} maxLength={80} placeholder="Soaked" onChange={(e) => {
                setCustomName(e.target.value);
                setProblem(null);
              }}
            />
          </label>
          <label className="field">
            <span className="label">What it does</span>
            <input className="field__input" value={does} maxLength={200} placeholder="Can't light a fire until dried off." onChange={(e) => setDoes(e.target.value)} />
          </label>
          {howLong}
          <ToggleButton label="Stacks" on={stacks} onChange={setStacks} />
          {errorLine}
          <div className="dialog__actions">
            <button type="submit" className="button-primary">
              {busy ? 'Saving…' : `Add to ${who}`}
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    );
  }

  const family = view.kind === 'family' ? rows.flatMap((r) => (r.kind === 'family' && r.name === view.name ? [r] : []))[0] : undefined;
  if (view.kind === 'family' && family) {
    return (
      <Dialog label={`Add a status to ${who}`} onClose={onClose} wide>
        <div className="add-status">
          {back(family.name, `${family.kinds.length} kinds`)}
          <ul className="add-status__list" aria-label={`Kinds of ${family.name}`}>
            {family.kinds.map(conditionRow)}
          </ul>
          {/* The duration chosen on the first screen carries over (mockup b6, panel 2). */}
          {errorLine}
          {close}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog label={`Add a status to ${who}`} onClose={onClose} wide>
      <div className="add-status">
        <label className="field">
          <span className="label">Find a status</span>
          <input
            className="field__input"
            type="search"
            value={typed}
            maxLength={80}
            placeholder="Search statuses…"
            onChange={(e) => {
              setTyped(e.target.value);
              setProblem(null);
            }}
          />
        </label>
        {howLong}
        <ul className="add-status__list" aria-label="Statuses">
          {rows.slice(0, 40).map((r) =>
            r.kind === 'condition' ? (
              conditionRow(r.condition)
            ) : (
              <li key={`family-${r.name}`}>
                <button type="button" className="add-status__family" aria-label={`${r.name}, ${r.kinds.length} kinds`} onClick={() => setView({ kind: 'family', name: r.name })}>
                  <RowSymbol name={r.name} />
                  <span className="add-status__words">
                    <span className="add-status__row-name">{`${r.name}, ${r.kinds.length} kinds`}</span>
                    <span className="add-status__effect">{r.kinds.map((k) => k.name).join(', ')}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ),
          )}
          {rows.length > 40 && <li className="auth__meta">{`${rows.length - 40} more: type to narrow it down.`}</li>}
          {rows.length === 0 && <li className="auth__meta">{typed.trim() ? `No status called “${typed.trim()}”. Make it a custom status below.` : 'This setting has no statuses of its own. Make a custom one below.'}</li>}
          <li>
            <button
              type="button"
              className="add-status__family"
              onClick={() => {
                setCustomName(typed.trim());
                setProblem(null);
                setView({ kind: 'custom' });
              }}
            >
              <span className="add-status__symbol add-status__symbol--plus" aria-hidden="true">
                +
              </span>
              <span className="add-status__words">
                <span className="add-status__row-name">Custom status…</span>
                <span className="add-status__effect">A name, what it does, how long.</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
        {errorLine}
        {close}
      </div>
    </Dialog>
  );
}
