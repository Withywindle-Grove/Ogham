// The travel card for one group of the party (M5b step 1; ruled 2026-10-30, S1–S7, D4, D7–D10, S2-5, S4-6; docs/05
// "Movement", "Lost"; docs/06 "Wilderness day", "Wilderness on Scene"). The GM's **budget card** ("<the pack's name>
// 3 of 8" with the weather change, pips to 12 then a bar, the breakdown behind the number, On foot / Riding / Cart,
// the GM's own number), **Move…** (route, terrain, an optional place name; the cost, the check chances and what the
// move sets off; Undo on the toast), the **shortfall** line ("Entering <place> · N more tomorrow"), **Spend the day
// looking**, and **Lost** (mark by hand; the Lost card: the chance, the roll, Found the way / Still lost). The GM's
// device starts each day's budget by itself when the clock reaches a new day (yesterday's shortfall paid first; "N
// unused points lost" on the toast and in the log). A player's card: the points left, the shortfall, the ground
// around them (Q1), **Force march** with ⓘ (applied at once; the GM can undo), and, while Getting lost is Open, the
// Lost status and the roll line. Everything written goes through travelPlay.ts's commands.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { checkPrompt, type CheckPrompt } from '../modules/expedition/checks.ts';
import { moveCheckLines } from '../modules/expedition/card.ts';
import { iconForCheck } from '../modules/expedition/eventChecks.ts';
import { isLostCheck } from '../modules/expedition/checks.ts';
import type { Terrain } from '../modules/expedition/modes.ts';
import {
  applyMove,
  budgetText,
  dayBudget,
  forceMarch as forcedMarchOf,
  placeLabel,
  previewMove,
  remaining,
  unitFor,
  type DayBudget,
  type Pace,
  type TravelDay,
} from '../modules/expedition/travel.ts';
import { enterLostRoll, forceMarch, resolveLost, setLost, setTravelBudget, spendTravelDay, startTravelDay, travelMove, type TravelGroup } from '../modules/expedition/travelPlay.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { ButtonRow, Chip, InfoButton, Note } from '../ui/parts.tsx';
import { TRAVEL_PLACE_WORDS } from '../core/travelWords.ts';
import { loadPackPlaceEntry, loadPackPlaces, type Place } from '../modules/expedition/placePlay.ts';
import { wordsFor, type PackPlace } from '../modules/expedition/placeTree.ts';
import { Icon } from '../ui/icons.tsx';
import { PlacePickerBody, placeWords, type PickedPlace } from './PlacePicker.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogChanged } from './campaignLog.tsx';
import { useSendToSceneCard } from './sceneCard.tsx';
import { registry } from './services.ts';
import { dayStartFor, dayStartWords, terrainOf, travelDayNow, type TravelView } from './travelView.ts';
import './TravelCard.css';

export interface TravelCardProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  group: number;
  /** The group's name when the party is split ("Group 2"), else null. */
  groupLabel: string | null;
  view: TravelView;
  gm: boolean;
  /** One of this person's characters is in the group (Force march, the recovery roll). */
  mine: boolean;
  /** The campaign's places named or picked before, newest first (the picker's Recently visited). */
  recent: readonly Place[];
  /** The rules sets' regional encounter tables (⚑ 7): a picked place remembers its region. */
  regionalTables?: Record<string, unknown>;
  onChanged: () => void;
  /**
   * The players' activity buttons (M5b step 3), given today's row: they share the button group with Force march
   * (docs/06 "Wilderness on Scene": one group, laid out evenly by count). Null or nothing: Force march alone.
   */
  activities?: (row: TravelGroup) => ReactNode;
}

const PIPS_MAX = 12;

/** The pips (to 12) or the bar with ticks above it (S3). */
function BudgetPips({ total, left, name }: { total: number; left: number; name: string }) {
  if (total <= 0) return null;
  if (total <= PIPS_MAX) {
    return (
      <div className="travel__pips" role="img" aria-label={`${left} of ${total} ${name} left`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`travel__pip${i < left ? ' travel__pip--full' : ''}`} aria-hidden="true" />
        ))}
      </div>
    );
  }
  return (
    <div className="travel__bar" role="img" aria-label={`${left} of ${total} ${name} left`}>
      <span className="travel__bar-fill" style={{ width: `${Math.round((left / total) * 100)}%` }} aria-hidden="true" />
    </div>
  );
}

const chanceWords = (prompt: CheckPrompt) => prompt.chanceText ?? (prompt.always ? 'always' : prompt.ruledOut ? 'no roll' : 'your call');

export function TravelCard({ db, user, campaign, group, groupLabel, view, gm, mine, recent, regionalTables, onChanged, activities }: TravelCardProps) {
  const show = useToast();
  const sendToCard = useSendToSceneCard();
  const logChanged = useLogChanged();
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const [byHand, setByHand] = useState<'hand' | 'mounted' | 'vehicle' | null>(null);
  const [forcedInfo, setForcedInfo] = useState(false);
  const [lostRoll, setLostRoll] = useState('');
  const started = useRef<string | null>(null);
  const { travel, mode, rules, tags, weatherTags, day } = view;
  const row = view.rows.get(group) ?? null;
  const lost = view.lost.get(group) ?? null;
  const travellers = view.travellers.get(group) ?? [];
  const who = groupLabel ?? 'the party';
  const pace: Pace = row?.pace ?? 'foot';
  const budget: DayBudget = dayBudget(travel, tags, { travellers, pace, weatherTags, forced: row?.forced ?? 0, gmPerDay: row?.gmPerDay ?? null });
  const dayRow: TravelDay = row ?? { total: budget.total, spent: 0, pending: null, forced: 0 };
  const left = remaining(dayRow);
  const text = budgetText(dayRow, budget);
  const weatherDelta = budget.lines.filter((l) => l.kind === 'weather').reduce((sum, l) => sum + l.amount, 0);
  const terrainNow: Terrain | null = terrainOf(mode, row?.terrainId);
  const stale = gm && (!row || row.day < day);
  const forcedNow = row ? forcedMarchOf(mode, row, budget) : null;
  const activityButtons = !gm && row && activities ? activities(row) : null;

  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    onChanged();
    // As after the move itself: the time strip reads the party's ground again.
    logChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  // The GM's device starts a group's first day, and, as a fallback, a day the clock reached without starting it (Next
  // day starts each group's day with its own move, fix F86/F87; Set the time… and an older copy of the app don't):
  // yesterday's shortfall paid first. A day already started is left as it is.
  useEffect(() => {
    if (!stale || busy) return;
    // The row's version is in the key: a day started, then put back by Undo, starts again with a fresh request (the
    // same request would only give back the start that was undone).
    const key = `${view.expeditionId}:${group}:${day}:${row?.version ?? 0}`;
    if (started.current === key) return;
    started.current = key;
    const before = row;
    const total = dayStartFor(view, group).total;
    // The clock read again first: right after another device's Undo, this view can hold the old clock with the new
    // rows, and would start the day just put back (review of #617). A day that no longer matches waits for the reload.
    void travelDayNow(db, campaign.id, view).then((now) => {
      if (now !== null && now !== day) {
        started.current = null;
        return null;
      }
      return runCommand(registry, db, user, startTravelDay, { campaignId: campaign.id, group, day, total, pace, gmPerDay: row?.gmPerDay ?? null }, { requestId: requestIdFor(key) });
    }).then((result) => {
      if (!result) return;
      onChanged();
      if (!result.ok) return show({ text: result.message, error: true });
      if (!before) return;
      show({ text: dayStartWords(travel, who, day, before, result.value) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, day, group, view.expeditionId]);

  // The number worked out again (the weather came in, the pace or the GM's number changed): the row follows it.
  const synced = useRef<string | null>(null);
  useEffect(() => {
    if (!gm || !row || stale || busy || budget.ask !== null || budget.total === row.total) return;
    const key = `${row.id}:${row.version}:${budget.total}`;
    if (synced.current === key) return;
    synced.current = key;
    void runCommand(registry, db, user, setTravelBudget, { campaignId: campaign.id, row, total: budget.total, pace, gmPerDay: row.gmPerDay }).then(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gm, row?.id, row?.version, row?.total, budget.total, budget.ask, stale]);

  async function setPace(next: Pace) {
    if (!row || busy) return;
    if (next === pace) return;
    if (next === 'riding' && travel.mounted === null && row.gmPerDay === null) return setByHand('mounted');
    if (next === 'cart' && travel.vehicle === null && row.gmPerDay === null) return setByHand('vehicle');
    const total = dayBudget(travel, tags, { travellers, pace: next, weatherTags, forced: row.forced, gmPerDay: row.gmPerDay }).total;
    await write(setTravelBudget, { campaignId: campaign.id, row, total, pace: next, gmPerDay: row.gmPerDay }, `${paceWords(next)}, ${travel.name} ${total}`);
  }

  async function setNumber(value: number | null, asPace: Pace) {
    if (!row || busy) return;
    const total = dayBudget(travel, tags, { travellers, pace: asPace, weatherTags, forced: row.forced, gmPerDay: value }).total;
    setByHand(null);
    await write(setTravelBudget, { campaignId: campaign.id, row, total, pace: asPace, gmPerDay: value }, value === null ? `${travel.name} worked out again: ${total}` : `${travel.name} set to ${total}`);
  }

  async function write<I>(command: typeof setTravelBudget | typeof spendTravelDay | typeof travelMove | typeof forceMarch, input: I, done: string) {
    setBusy(true);
    const result = await runCommand(registry, db, user, command as never, input as never);
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: done, onUndo: () => void undoLatest(command.name) });
  }

  async function move(input: { routeId: string | null; terrainId: string | null; placeName: string; cost: number; picked: PickedPlace | null }) {
    if (!row) return;
    const preview = previewMove(mode, rules, row, { ...input }, { from: { routeId: row.routeId, terrainId: row.terrainId }, pace, weatherTags, switches: view.switches, party: view.party?.get(group), choices: view.choices });
    const applied = applyMove(row, preview, input.cost);
    setMoving(false);
    const lines = [applied.arrived ? `Moved into ${preview.placeName}, ${input.cost} ${unitFor(input.cost, travel.unit)}` : `Entering ${preview.placeName}, ${applied.day.pending?.owed} more tomorrow`];
    if (applied.logLine) lines.push(applied.logLine);
    setBusy(true);
    // A place picked from a pack (pull request 2): made or found in the move's own request (one line, one Undo).
    const picked = input.picked;
    const entry = picked?.kind === 'pack' ? await loadPackPlaceEntry(db, picked.place.packId, picked.place.entryId) : null;
    if (picked?.kind === 'pack' && !entry) {
      setBusy(false);
      return show({ text: "That place isn't in an attached pack any more.", error: true });
    }
    const result = await runCommand(registry, db, user, travelMove, {
      campaignId: campaign.id,
      row,
      cost: input.cost,
      terrainId: input.terrainId,
      routeId: input.routeId,
      placeName: picked?.kind === 'place' || picked?.kind === 'pack' ? null : input.placeName.trim() || null,
      placeId: picked?.kind === 'place' ? picked.place.id : null,
      packEntry: entry,
      regionalTables,
    });
    setBusy(false);
    onChanged();
    // The time strip's checks read the party's ground from the travel row (their terrain odds): tell it to reload.
    logChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    // Build order 8 (D9): the checks the move sets off go on the time strip's card as Hit / Miss lines; Undo takes the
    // move back and the lines with it. Without the card (no time strip here), the toast names them as before.
    const checkLines = moveCheckLines(preview.triggered, groupLabel ? group : null);
    const onCard = sendToCard({ add: checkLines });
    if (preview.triggered.length > 0) lines.push(`${onCard ? 'On the card' : 'Check'}: ${preview.triggered.map((t) => t.name).join(', ')}`);
    show({
      text: lines.join(', '),
      onUndo: () => {
        if (onCard) sendToCard({ remove: checkLines.map((l) => l.key) });
        void undoLatest(travelMove.name);
      },
    });
  }

  async function spendDay() {
    if (!row) return;
    if (left === 0) return show({ text: `Nothing left today: ${travel.name} 0 of ${row.total}.` });
    await write(spendTravelDay, { campaignId: campaign.id, row }, `Spent the day looking: ${left} ${unitFor(left, travel.unit)}`);
  }

  async function forced() {
    if (!row || !forcedNow) return;
    if (forcedNow.added === 0) return show({ text: `${capital(who)} already forced the march today: the pack lets it count once.` });
    const target = { campaignId: campaign.id, group, mine };
    setBusy(true);
    const result = await runCommand(registry, db, user, forceMarch, { target, row, added: forcedNow.added });
    setBusy(false);
    onChanged();
    // The time band's rest flow reads the forced count (camp's Sleep step: rest due tonight): tell it at once, without
    // waiting for the march's log line to arrive.
    logChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    const parts = [`Forced march, +${forcedNow.added} ${unitFor(forcedNow.added, travel.unit)}`];
    // A player's row names the place only once it has been shown to their group (fm-1): else "the next place".
    if (forcedNow.arrived) parts.push(TRAVEL_PLACE_WORDS.arrived(forcedNow.arrived.placeName || null));
    parts.push('rest due this evening');
    // Whoever marched can take it back (fm-1; Undo over confirm): the same Undo as the log line's. The database
    // refuses, and the toast says why, once the points are spent or the day has moved on.
    show({ text: parts.join(', '), onUndo: () => void undoLatest(forceMarch.name).then(logChanged) });
  }

  async function markLost() {
    setBusy(true);
    const result = await runCommand(registry, db, user, setLost, { campaignId: campaign.id, group, day });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `${capital(who)} is lost`, onUndo: () => void undoLatest(setLost.name) });
  }

  async function enterRoll() {
    if (!lost || !lostRoll.trim()) return show({ text: 'What did the dice show?', error: true });
    setBusy(true);
    const result = await runCommand(registry, db, user, enterLostRoll, { target: { campaignId: campaign.id, group, mine, gettingLost: view.gettingLost }, lost, roll: lostRoll.trim() });
    setBusy(false);
    setLostRoll('');
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `Recovery roll: ${result.value.roll}` });
  }

  async function resolve(outcome: 'found' | 'still') {
    if (!lost) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, resolveLost, { campaignId: campaign.id, lost, outcome, day });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: outcome === 'found' ? `${capital(who)} found the way` : `${capital(who)} is still lost`, onUndo: () => void undoLatest(resolveLost.name) });
  }

  // The lost check's chance here (the pack's recovery chance is the same check, ruled S2-5: each morning until found).
  const lostCheck = mode.checks.find((c) => isLostCheck(c, iconForCheck(mode, c.id)));
  const lostPrompt = lostCheck ? checkPrompt(lostCheck, iconForCheck(mode, lostCheck.id), rules, { terrain: terrainNow, routeType: row?.routeId ?? null, weatherTags, party: view.party?.get(group), choices: view.choices }) : null;
  const lostOpen = gm || view.gettingLost === 'open';

  // A player's card before the GM's device has started the day: nothing to count yet.
  if (!gm && !row) {
    return (
      <section className="travel" aria-label={`${capital(who)}'s travel`}>
        <p className="travel__ground">{`${travel.name}: waiting for the GM to start the day`}</p>
      </section>
    );
  }

  return (
    <section className="travel" aria-label={`${capital(who)}'s travel`}>
      <div className="travel__head">
        <button type="button" className="travel__number" onClick={() => setBreakdown(true)} aria-label={`${text.line}: how it's worked out`}>
          {text.line}
        </button>
        {weatherDelta !== 0 && <span className="travel__delta">{`${weatherDelta > 0 ? '+' : '−'}${Math.abs(weatherDelta)} weather`}</span>}
        {lost && lostOpen && (
          <span className="travel__lost" role="status">
            <span aria-hidden="true">⟲</span> Lost
          </span>
        )}
      </div>
      <BudgetPips total={dayRow.total} left={left} name={travel.name} />
      {gm && budget.ask !== null && row?.gmPerDay === null && (
        <Note tone="info">
          {budget.ask === 'speed'
            ? `No speed known for anyone in ${who}: set today's ${travel.name.toLowerCase()} by hand.`
            : budget.ask === 'formula'
              ? `The pack gives no way to work out ${travel.name.toLowerCase()}: set them by hand.`
              : `The pack gives no ${budget.ask === 'mounted' ? 'riding' : 'cart'} speed: set today's ${travel.name.toLowerCase()} by hand.`}
        </Note>
      )}
      {text.shortfall && (
        <p className="travel__shortfall">
          <span>{text.shortfall}</span>
          {!gm && forcedNow && (
            <button type="button" className="button-secondary button-secondary--small" onClick={() => void forced()}>
              Force march
            </button>
          )}
        </p>
      )}
      {terrainNow && !gm && <p className="travel__ground">{`Around you: ${terrainNow.name}`}</p>}
      {gm && row && (
        <>
          <ButtonRow<Pace>
            label="How the group travels"
            options={[
              { value: 'foot', label: 'On foot' },
              { value: 'riding', label: 'Riding' },
              { value: 'cart', label: 'Cart' },
            ]}
            value={pace}
            onChange={(next) => void setPace(next)}
          />
          <div className="travel__actions">
            <button type="button" className="button-secondary" onClick={() => setMoving(true)}>
              Move…
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => void spendDay()}>
              Spend the day looking
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setByHand('hand')}>
              Set by hand…
            </button>
            {!lost && (
              <button type="button" className="button-secondary button-secondary--small" onClick={() => void markLost()}>
                Mark lost
              </button>
            )}
          </div>
        </>
      )}
      {!gm && row && (activityButtons || (forcedNow && !text.shortfall)) && (
        <div className="travel__buttons travel__buttons--group" role="group" aria-label="What you can do">
          {activityButtons}
          {forcedNow && !text.shortfall && (
            <span className="travel__button-with-info">
              <button type="button" className="button-secondary" onClick={() => void forced()}>
                Force march
              </button>
              <InfoButton label="About forced marches" onOpen={() => setForcedInfo(true)} />
            </span>
          )}
        </div>
      )}
      {lost && lostOpen && (
        <div className="travel__lost-card" role="group" aria-label="Lost">
          <p className="travel__lost-line">
            {`Lost since day ${lost.sinceDay + 1}${lost.attempts > 0 ? `, still lost ${lost.attempts === 1 ? 'one morning' : `${lost.attempts} mornings`}` : ''}`}
            {lostPrompt && `, finding the way: ${chanceWords(lostPrompt)}`}
          </p>
          {lost.note && <p className="travel__lost-note">{lost.note}</p>}
          <div className="travel__roll">
            {lost.roll ? (
              <span className="travel__rolled">{`Rolled ${lost.roll}`}</span>
            ) : (
              <>
                <label className="travel__roll-label" htmlFor={`lost-roll-${group}`}>
                  Roll
                </label>
                <input id={`lost-roll-${group}`} className="travel__roll-input" inputMode="numeric" value={lostRoll} onChange={(e) => setLostRoll(e.target.value)} />
                <button type="button" className="button-secondary" onClick={() => void enterRoll()}>
                  Enter roll
                </button>
              </>
            )}
          </div>
          {gm && (
            <div className="travel__actions">
              <button type="button" className="button-secondary" onClick={() => void resolve('found')}>
                Found the way
              </button>
              <button type="button" className="button-secondary button-secondary--small" onClick={() => void resolve('still')}>
                Still lost
              </button>
            </div>
          )}
        </div>
      )}

      {breakdown && (
        <Dialog label={`${travel.name} today`} onClose={() => setBreakdown(false)}>
          {budget.lines.length === 0 ? (
            <p className="travel__note">{row?.gmPerDay !== null && row ? `Set by the GM: ${row.total}.` : `No number yet: ${budget.ask === 'speed' ? 'no speed is known' : 'the pack gives none'}.`}</p>
          ) : (
            <ul className="travel__lines">
              {budget.lines.map((line, i) => (
                <li key={i}>
                  <span>{line.label}</span>
                  <span className="travel__amount">{`${line.amount > 0 && line.kind !== 'base' ? '+' : ''}${line.amount}`}</span>
                </li>
              ))}
              <li className="travel__lines-total">
                <span>Today</span>
                <span className="travel__amount">{dayRow.total}</span>
              </li>
              {dayRow.spent > 0 && (
                <li>
                  <span>Spent</span>
                  <span className="travel__amount">{`−${dayRow.spent}`}</span>
                </li>
              )}
            </ul>
          )}
          {travel.note && <p className="travel__note">{travel.note}</p>}
        </Dialog>
      )}

      {byHand && row && (
        <NumberDialog
          label={byHand === 'hand' ? `Today's ${travel.name.toLowerCase()}` : byHand === 'mounted' ? 'Riding today' : 'By cart today'}
          hint={
            byHand === 'hand'
              ? `A whole number of ${travel.unit} for ${who} today. Clear it to work it out from the pack again.`
              : `The pack gives no ${byHand === 'mounted' ? 'riding' : 'cart'} speed: how many ${travel.unit} does ${who} get today?`
          }
          value={row.gmPerDay}
          allowClear={byHand === 'hand'}
          onClose={() => setByHand(null)}
          onSave={(value) => void setNumber(value, byHand === 'hand' ? pace : byHand === 'mounted' ? 'riding' : 'cart')}
        />
      )}

      {forcedInfo && (
        <Dialog label="Forced march" onClose={() => setForcedInfo(false)}>
          <p className="travel__note">
            {travel.forced?.note ?? 'The group pushes on past the day’s travel: more ground today, and rest falls due this evening.'}
            {` Today it adds ${forcedNow?.added ?? 0} ${unitFor(forcedNow?.added ?? 0, travel.unit)}.`}
          </p>
        </Dialog>
      )}

      {moving && row && (
        <MoveDialog
          view={view}
          row={row}
          who={who}
          recent={recent}
          db={db}
          campaignId={campaign.id}
          current={null}
          onMove={(input) => void move(input)}
          onClose={() => setMoving(false)}
        />
      )}
    </section>
  );
}

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const paceWords = (pace: Pace) => (pace === 'foot' ? 'On foot' : pace === 'riding' ? 'Riding' : 'By cart');

/** A request id a device can repeat without starting the same day twice (the same key gives the same id). */
function requestIdFor(key: string): string {
  // A stable UUID-shaped id from the key (the database wants a uuid): the key's bytes, folded.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    h1 = Math.imul(h1 ^ key.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ key.charCodeAt(i), 0x811c9dc5) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** A whole number, or cleared (back to the pack's reckoning). */
function NumberDialog({
  label,
  hint,
  value,
  allowClear,
  onClose,
  onSave,
}: {
  label: string;
  hint: string;
  value: number | null;
  allowClear: boolean;
  onClose: () => void;
  onSave: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const show = useToast();
  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (allowClear) return onSave(null);
      return show({ text: 'A whole number is needed.', error: true });
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return show({ text: 'A whole number, 0 or more.', error: true });
    onSave(n);
  };
  return (
    <Dialog label={label} onClose={onClose}>
      <p className="travel__note">{hint}</p>
      <input className="travel__roll-input travel__roll-input--wide" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} aria-label={label} />
      <div className="travel__actions">
        <button type="button" className="button-primary" onClick={save}>
          Save
        </button>
        <button type="button" className="button-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

/**
 * Move… (S1): the route (the pack's), the terrain (the mode's), an optional place name; the cost and what's left,
 * the check chances for where the party goes, what the move sets off (alsoWhen, D9) and the GM's warnings (never a
 * block). Move is the sheet's one accent.
 */
function MoveDialog({
  view,
  row,
  who,
  recent,
  db,
  campaignId,
  current,
  onMove,
  onClose,
}: {
  view: TravelView;
  row: TravelGroup;
  who: string;
  recent: readonly Place[];
  db: Db;
  campaignId: string;
  /** Where the group is now (the picker's Near here and "here now"). */
  current: Place | null;
  onMove: (input: { routeId: string | null; terrainId: string | null; placeName: string; cost: number; picked: PickedPlace | null }) => void;
  onClose: () => void;
}) {
  const { mode, rules, travel } = view;
  const show = useToast();
  const [routeId, setRouteId] = useState<string | null>(row.routeId);
  const [terrainId, setTerrainId] = useState<string | null>(row.terrainId ?? mode.terrain[0]?.id ?? null);
  // The place (pull request 2): picked in the picker (a step inside this sheet), its words for the preview.
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [packPlaces, setPackPlaces] = useState<readonly PackPlace[] | null | 'error'>(null);
  useEffect(() => {
    if (!picking || packPlaces !== null) return;
    let live = true;
    void loadPackPlaces(db, campaignId).then((found) => live && setPackPlaces(found ?? 'error'));
    return () => {
      live = false;
    };
  }, [picking, packPlaces, db, campaignId]);
  const list = packPlaces && packPlaces !== 'error' ? packPlaces : [];
  const placeName = picked?.kind === 'other' ? picked.name : picked?.kind === 'place' ? placeWords(picked.place, list) : picked?.kind === 'pack' ? wordsFor(list, picked.place) : '';
  const pickPlace = (p: PickedPlace) => {
    setPicked(p.kind === 'unnamed' ? null : p);
    setPicking(false);
    // A pack's place pre-fills the terrain it names, when the mode has it.
    if (p.kind === 'pack' && p.place.terrain && mode.terrain.some((t) => t.id === p.place.terrain)) setTerrainId(p.place.terrain);
    if (p.kind === 'place' && p.place.terrainId && mode.terrain.some((t) => t.id === p.place.terrainId)) setTerrainId(p.place.terrainId);
  };
  const [ownCost, setOwnCost] = useState('');
  const gmCost = ownCost.trim() ? Number(ownCost) : null;
  const preview = previewMove(mode, rules, row, { routeId, terrainId, placeName, gmCost: Number.isInteger(gmCost) ? gmCost : null }, { from: { routeId: row.routeId, terrainId: row.terrainId }, pace: row.pace, weatherTags: view.weatherTags, switches: view.switches, party: view.party?.get(row.group), choices: view.choices });
  const cost = preview.cost;
  const go = () => {
    if (cost === null) return show({ text: 'How much does it cost? The pack gives no cost for this: write one.', error: true });
    onMove({ routeId, terrainId, placeName, cost, picked });
  };
  const moveForm = (
    <>
      {travel.routes.length > 0 && (
        <div className="travel__pick">
          <span className="label">Route</span>
          <div className="travel__chips" role="group" aria-label="Route">
            {travel.routes.map((r) => (
              <Chip key={r.id} pressed={routeId === r.id} onClick={() => setRouteId(routeId === r.id ? null : r.id)}>
                {`${routeId === r.id ? '✓ ' : ''}${r.name}${r.cost !== null ? `, ${r.cost}` : ''}`}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {mode.terrain.length > 0 ? (
        <div className="travel__pick">
          <span className="label">Terrain</span>
          <div className="travel__chips" role="group" aria-label="Terrain">
            {mode.terrain.map((t) => (
              <Chip key={t.id} pressed={terrainId === t.id} onClick={() => setTerrainId(t.id)}>
                {`${terrainId === t.id ? '✓ ' : ''}${t.name}${t.cost !== null ? `, ${t.cost}` : ''}`}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <p className="travel__note">The pack names no terrain: write the cost below.</p>
      )}
      <div className="travel__pick">
        <span className="label">Place (optional)</span>
        <div className="place-pick__line">
          <button type="button" className="button-secondary place-pick__row" aria-label="Place (optional)" onClick={() => setPicking(true)}>
            <Icon name="pin" size={20} />
            <span className="place-pick__words">{placeName || placeLabel(null, preview.terrain)}</span>
          </button>
          {picked && (
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setPicked(null)}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="travel__pick">
        <label className="label" htmlFor="travel-cost">
          {preview.costFrom === 'gm' ? 'Your cost' : 'Other cost'}
        </label>
        <input id="travel-cost" className="travel__roll-input" inputMode="numeric" value={ownCost} onChange={(e) => setOwnCost(e.target.value)} aria-describedby="travel-cost-hint" />
        <span id="travel-cost-hint" className="travel__hint">
          {preview.costFrom === 'route' ? `The route's cost: ${cost}` : preview.costFrom === 'terrain' ? `The terrain's cost: ${cost}` : preview.costFrom === 'gm' ? 'Your own number' : 'No cost known: write one'}
        </span>
      </div>
      <ul className="travel__preview">
        <li>{cost === null ? 'Cost: —' : `Cost ${cost}, ${preview.remainingAfter} of ${row.total} left after`}</li>
        {preview.shortfallLine && <li>{preview.shortfallLine}</li>}
        {row.pending && <li>{TRAVEL_PLACE_WORDS.dropped(row.pending.owed, row.pending.placeName || null)}</li>}
        {preview.checks.map((c) => (
          // A modifier keyed to the party says why the chance is what it is (ga-3: "· a Reed Witch in the party").
          <li key={c.checkId}>{[`${c.name}: ${chanceWords(c)}`, ...c.modifiers.filter((m) => m.kind === 'trait' && !m.actor).map((m) => m.label)].join(', ')}</li>
        ))}
        {preview.triggered.map((t) => (
          <li key={`t:${t.checkId}`}>{`${t.reason}: ${t.name} (${chanceWords(t)})`}</li>
        ))}
        {preview.column && <li>{`Encounter table column: ${preview.column}`}</li>}
      </ul>
      {preview.warnings.map((w) => (
        <Note key={w} tone="warning">
          {w}
        </Note>
      ))}
      <div className="travel__actions">
        <button type="button" className="button-primary" onClick={go}>
          Move
        </button>
        <button type="button" className="button-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </>
  );
  // The picker is a step inside this sheet (the same Dialog, so focus and Escape stay as they were).
  const picker = (
    <>
      <PlacePickerBody places={packPlaces} recent={recent} current={current} onPick={pickPlace} />
      <div className="travel__actions">
        <button type="button" className="button-secondary" onClick={() => setPicking(false)}>
          Back to the move
        </button>
      </div>
    </>
  );
  return (
    <Dialog label={picking ? `Move ${who} where?` : `Move ${who}`} onClose={onClose} wide>
      {picking ? picker : moveForm}
    </Dialog>
  );
}

