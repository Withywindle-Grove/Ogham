// The Request card (M5 step 12; ruled 2026-10-31 Q6 and Q3, 2026-10-30 DG17 and DG18; docs/05 "Requests"; docs/06
// Components "Request card"): one card for every "a player asks, the GM answers" flow.
//   PlayerRequests, on players' Scene: "Sent to the GM · Cancel" while a request waits; an escape roll the GM asked
//   for shows its prompt (the save or check, the pack's modifiers as switches, the depth worked out) and Enter roll;
//   the answer shows when it comes (Yes, No, Out safely, Lost below, with the GM's note) until "Got it".
//   GmRequestCard, inside Waiting for you: the GM's side with the answer kind's buttons. Yes / No with a note in M5,
//   for lines sent with Describe… before it was removed (M5 gate, A5; the cost in turns went with it); M5b's kinds
//   add the rest. An escape roll previews its outcome (Out safely, changeable to Lost below) and Send applies it; a failure opens the
//   pack's doom table for the GM. Undo on the answer, no confirm.
//   A secret activity (M5b step 3, S4-3; ruled 2026-11-03): the GM's card shows the secret prompt from the pack (the
//   roll with its modifiers and sources, the result, the table, what it yields) with Hit / Miss, the GM's own roll on
//   the pack's chance, recorded as the GM's secret check (GM-only until Downtime; never in the request); then Yes
//   (the cost comes off the group's budget, one Undo puts both back) or No, with a note.
import { useEffect, useId, useRef, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { activityModifierWords } from '../modules/expedition/activities.ts';
import { depthWords } from '../modules/expedition/dungeonExit.ts';
import { recordCheck } from '../modules/expedition/reminderPlay.ts';
import type { ReadTable } from '../modules/expedition/tables.ts';
import { unitFor } from '../modules/expedition/travel.ts';
import { readClock, type TimeUnits } from '../modules/expedition/clock.ts';
import { loadClockNow } from '../modules/expedition/lightPlay.ts';
import { setStock } from '../modules/requests/shopStock.ts';
import type { SecretView } from './secretActivity.ts';
import {
  answerWords,
  enterRequest,
  escapeRollWords,
  escapeTotal,
  loadRequests,
  mine,
  readEscapeEntry,
  readEscapePrompt,
  signed,
  withdrawRequest,
  answerRequest,
  type Answer,
  type EscapeEntry,
  type EscapePrompt,
  type Request,
} from '../modules/requests/requests.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Chip, Switch } from '../ui/parts.tsx';
import { useErrorToast, useToast } from '../ui/ToastHost.tsx';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { BaseArmourChoice } from './BaseArmour.tsx';
import { pickBaseArmour } from './pickBase.ts';
import { useLogVersion } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { TableRoll } from './EncounterTables.tsx';
import { usePlayerOnly } from './playerOnly.tsx';
import { registry } from './services.ts';
import { useSticky } from './stickyState.ts';
import { GmBuyCard, GmSellCard, GmStayCard, GmTownActivityCard, PricedAnswerCard, waitsForReply, type TradeView } from './TownRequestCards.tsx';
import { replyRequest, undoBuy, readBuyPrompt, readSellPrompt, readStayPrompt, readTownActivityPrompt } from '../modules/requests/townRequests.ts';
import { loadCarriers, loadInventory } from '../modules/inventory/inventory.ts';
import { denominationsOf, readCost } from '../modules/inventory/coinWords.ts';
import { loadPurse, type Coins } from '../modules/inventory/purse.ts';
import { purchaseToast } from './purchaseToast.ts';
import { PurseSheet } from './PurseSheet.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import { copyOf, oneOffCopy } from './AddItem.tsx';
import './RequestCard.css';
import { possessive } from '../core/nameWords.ts';

// The player's side ------------------------------------------------------------------------------------------------

/** `player`: in the GM's view (C15f, pg32-5), whose requests these are; the reader's own elsewhere. */
export function PlayerRequests({ db, user, campaign, setting = null, player = user.id }: { db: Db; user: CurrentUser; campaign: OpenCampaign; setting?: CampaignSetting | null; player?: string }) {
  const logVersion = useLogVersion();
  const show = useToast();
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [version, setVersion] = useState(0);
  // Answers this device has read ("Got it"); kept while the app is open.
  const [seen, setSeen] = useSticky<string[]>(`${user.id}:${campaign.id}:requests:seen`, []);
  // In the GM's view as the player, the player's own answers and Cancel open a pop-up instead (pg32-5, pg32-6).
  const playerOnly = usePlayerOnly();
  // "Spend N" from Buy it's toast (TC13 piece C, sb5-5): the purse's Spend sheet over the Scene, filled in (PK10b).
  const [spending, setSpending] = useState<{ carrier: NamedCarrier; recipients: NamedCarrier[]; coins: Coins; spend: { coins: Coins; whatFor: string } } | null>(null);

  useEffect(() => {
    let current = true;
    void loadRequests(db, campaign.id).then((found) => current && setRequests(found ?? []));
    return () => {
      current = false;
    };
  }, [db, campaign.id, logVersion, version]);

  async function run<I, T, O>(command: Parameters<typeof runCommand<I, T, O>>[3], input: I): Promise<O | null> {
    const result = await runCommand(registry, db, user, command, input);
    setVersion((v) => v + 1);
    if (!result.ok) {
      show({ text: result.message, error: true });
      return null;
    }
    return result.value;
  }

  /**
   * The reply to a priced answer (M5b step 6e): Buy it brings the item in as bought, its price as text (its Undo is the buyer's own, undoBuy; a
   * made line is never undone by the general Undo); Leave it, Accept and Decline have the general Undo.
   */
  async function reply(request: Request, accept: boolean) {
    if (playerOnly.blocked('answerOffer')) return;
    const carrier = request.actorId ? { campaignId: campaign.id, actorId: request.actorId, locationId: null, ownerUserId: user.id, archived: false } : null;
    if (!carrier) return;
    let input: Parameters<typeof replyRequest.run>[2] = { request, accept };
    const price = request.answer && 'price' in request.answer ? request.answer.price : '';
    if (accept && request.kind === 'buy') {
      const prompt = readBuyPrompt(request.prompt);
      const entry = prompt?.itemId ? setting?.items.find((e) => e.packEntryId === prompt.itemId) : undefined;
      input = { ...input, buy: { carrier, item: entry ? copyOf(entry) : oneOffCopy(prompt?.item ?? request.text), cost: price } };
    }
    if (accept && request.kind === 'sell') {
      const prompt = readSellPrompt(request.prompt);
      const line = prompt ? (await loadInventory(db, campaign.id))?.lines.find((l) => l.id === prompt.lineId) : undefined;
      if (!prompt || !line) return show({ text: "That item isn't in your pack any more.", error: true });
      input = { ...input, sell: { line: { id: line.id, carrier, version: line.version }, qty: Math.min(prompt.qty, line.qty), of: line.qty } };
    }
    const done = await run(replyRequest, input);
    if (!done) return;
    setSeen((s) => [...s, request.id]);
    if (accept && request.kind === 'buy') {
      // TC13 piece C (tn-1, TW4a, PK10b): the Pack's purchase toast, "Wren bought a coil of rope. Its cost, 1 heron, is
      // not spent yet.", nothing charged; "Spend 1 heron" where the price reads as the setting's coins, above 0, and
      // the character has a purse: it opens the Spend sheet over the Scene, the amount and What for filled in (sb5-5).
      // bu-1: the buyer's own Undo takes the bought item out while nobody has touched it; refused in plain words after.
      const what = readBuyPrompt(request.prompt)?.item ?? request.text;
      const denominations = setting ? denominationsOf(setting.rulesSets) : [];
      const coins = readCost(denominations, price);
      const [carriers, purse] = await Promise.all([loadCarriers(db, campaign.id), coins ? loadPurse(db, campaign.id, carrier.actorId!) : null]);
      const buyer = carriers?.find((c) => c.actorId === carrier.actorId) ?? null;
      return show(
        purchaseToast({
          who: buyer?.name ?? 'You',
          verb: 'bought',
          what,
          cost: price,
          denominations,
          coins: buyer && purse ? coins : null,
          onSpend: (spend) => buyer && purse && setSpending({ carrier: buyer, recipients: (carriers ?? []).filter((c) => c !== buyer), coins: purse, spend: { coins: spend, whatFor: what } }),
          onUndo: async () => {
            if (playerOnly.blocked('undoPurchase')) return;
            const undone = await run(undoBuy, { request });
            if (!undone) return;
            setSeen((s) => s.filter((id) => id !== request.id));
            setVersion((v) => v + 1);
          },
        }),
      );
    }
    const words = request.kind === 'sell' ? (accept ? `Sold for ${price}` : 'Declined the offer') : accept ? `Bought for ${price}: it's in your pack` : 'Left it';
    show({
      text: words,
      onUndo: async () => {
        const eventId = await latestChange(db, campaign.id, replyRequest.name, user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
        else setSeen((s) => s.filter((id) => id !== request.id));
        setVersion((v) => v + 1);
      },
    });
  }

  // Drawn whatever the cards: once bought, the answer card has gone, and the sheet stays open over the Scene.
  const spendSheet = spending && (
    <PurseSheet
      db={db}
      user={user}
      carrier={spending.carrier}
      recipients={spending.recipients}
      denominations={setting ? denominationsOf(setting.rulesSets) : []}
      coins={spending.coins}
      spend={spending.spend}
      onClose={() => setSpending(null)}
      onChanged={() => setVersion((v) => v + 1)}
    />
  );
  if (!requests) return spendSheet;
  // A listed lodging is answered at once (no GM): nothing to show for it here; Where you stay shows it.
  const shown = mine(requests, player).filter((r) => !(r.kind === 'lodging' && r.answer?.kind === 'stay')).filter((r) => r.status === 'waiting' || waitsForReply(r) || !seen.includes(r.id));
  if (shown.length === 0) return spendSheet;
  return (
    <>
    {spendSheet}
    <section className="requests" aria-label="Your requests" data-prompt-id={shown.map((r) => `${r.id}:${r.status}`).join(' ')}>
      {playerOnly.sheet}
      {shown.map((request) =>
        waitsForReply(request) ? (
          <PricedAnswerCard key={request.id} request={request} words={answerWords(request)} onReply={(accept) => void reply(request, accept)} />
        ) : request.status === 'answered' ? (
          <article key={request.id} className="request request--answered" aria-label="The GM's answer">
            <p className="request__title">The GM says</p>
            <p className="request__answer">{answerWords(request)}</p>
            {request.answer && 'note' in request.answer && request.answer.note && <p className="request__note">{request.answer.note}</p>}
            {request.text && <p className="request__text">{`“${request.text}”`}</p>}
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setSeen((s) => [...s, request.id])}>
              Got it
            </button>
          </article>
        ) : request.kind === 'escapeRoll' ? (
          <EscapeRollCard key={request.id} request={request} onEnter={(entry) => run(enterRequest, { request, entry })} />
        ) : (
          <article key={request.id} className="request request--waiting" aria-label="Sent to the GM">
            <p className="request__title">Sent to the GM</p>
            <p className="request__text">{`“${request.text}”`}</p>
            <button
              type="button"
              className="button-secondary button-secondary--small"
              onClick={async () => {
                if (playerOnly.blocked('takeBackRequest', { request: request.id })) return;
                const gone = await run(withdrawRequest, { request });
                if (gone) show({ text: 'Cancelled your request' });
              }}
            >
              Cancel
            </button>
          </article>
        ),
      )}
    </section>
    </>
  );
}

/**
 * The player's escape roll: the prompt with its switches, and Enter roll; then what was sent. `forName` is the GM's
 * "Enter for <name>" (C7): the same form, worded for the character the GM enters it for.
 */
function EscapeRollCard({ request, onEnter, forName }: { request: Request; onEnter: (entry: EscapeEntry) => Promise<unknown>; forName?: string }) {
  const id = useId();
  const prompt = readEscapePrompt(request.prompt);
  const entry = readEscapeEntry(request.entry);
  const [on, setOn] = useState<string[]>(entry?.on ?? []);
  const [text, setText] = useState(entry ? String(entry.roll) : '');
  const [changing, setChanging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const whose = forName ? possessive(forName) : request.requesterId === null ? "the party's" : 'your';

  if (!prompt) {
    return (
      <article className="request request--waiting" aria-label="Sent to the GM">
        <p className="request__title">The GM asked for a roll</p>
        <p className="request__text">The rule for it couldn't be read. Roll at the table.</p>
      </article>
    );
  }
  const sent = entry && !changing;
  return (
    <article className="request request--waiting" aria-label={`Leave the dungeon: ${whose} escape roll`}>
      <p className="request__title">{`Leave the dungeon: ${whose} escape roll`}</p>
      <p className="request__text">{escapeRollWords(prompt)}</p>
      {sent ? (
        <>
          <p className="request__text">{`Sent to the GM, rolled ${entry.roll}${escapeTotal(prompt, entry).parts.map((p) => ` ${p}`).join('')} = ${escapeTotal(prompt, entry).total}`}</p>
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setChanging(true)}>
            Change roll
          </button>
        </>
      ) : (
        <>
          {prompt.modifiers.map((m) => (
            <Switch key={m.id} label={`${m.name} (${signed(m.value)})`} on={on.includes(m.id)} onChange={(now) => setOn(now ? [...on, m.id] : on.filter((x) => x !== m.id))} />
          ))}
          {prompt.depth !== 0 && <p className="request__note">{`${depthWords(prompt.levelsDown)}: ${signed(prompt.depth)}`}</p>}
          <div className="field">
            <label className="label" htmlFor={id}>
              {forName ? `What did ${forName} roll?` : 'What did you roll?'}
            </label>
            <input id={id} className="field__input field__input--short" inputMode="numeric" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {problem && (
            <p className="form-error" role="alert">
              {problem}
            </p>
          )}
          <button
            type="button"
            className="button-secondary"
            onClick={async () => {
              if (!/^\d{1,3}$/.test(text.trim())) return setProblem('Type the number you rolled.');
              setProblem(null);
              const done = await onEnter({ roll: Number(text.trim()), on });
              if (done) setChanging(false);
            }}
          >
            Enter roll
          </button>
        </>
      )}
    </article>
  );
}

// The GM's side -----------------------------------------------------------------------------------------------------

export function GmRequestCard({
  db,
  user,
  campaign,
  request,
  who,
  doomTable,
  onChanged,
  onLost,
  hirelings = [],
  secret,
  acting,
  budget,
  onTable,
  trade = null,
  units = null,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  request: Request;
  /** Whose it is: the character's name, or "The party". */
  who: string;
  /** The pack's doom table for a failed escape roll (from the rule on the GM's side): the table, 'missing' when the rule names one that isn't attached, or null. */
  doomTable: ReadTable | 'missing' | null;
  onChanged: () => void;
  /** A failed escape roll was sent: the list opens the pack's table (the card itself leaves the list on Send). */
  onLost: (table: ReadTable) => void;
  /** C6 (M5 gate): the hirelings who leave with this character and share their result. */
  hirelings?: string[];
  /** A secret activity's prompt, read from the pack on the GM's side (M5b step 3); null when the pack no longer has it. */
  secret?: SecretView | null;
  /** Who's acting in a secret activity, by name. */
  acting?: string[];
  /** The pack's name and unit for the travel budget ("Leagues", "points"), for the cost's words. */
  budget?: { name: string; unit: string } | null;
  /** Open a table the GM wants to roll on (a secret activity's). */
  onTable?: (table: ReadTable) => void;
  /** A buy or sell request's view from the pack (M5b step 6e): the thing's chance, the sale rule's suggestion. */
  trade?: TradeView | null;
  /** The campaign's time units: a buy request's flip names the campaign day (readClock's), as stock.set does. */
  units?: TimeUnits | null;
}) {
  const show = useToast();
  // A buy request's stock line written by a flip whose answer then failed: the retry's Undo takes it back too.
  const stockLine = useRef<string | null>(null);
  const noteId = useId();
  const [note, setNote] = useState('');
  const [out, setOut] = useState(true);
  const [busy, setBusy] = useState(false);
  // C7 (M5 gate): "Enter for <name>", for a player without a device; the entry is logged as the GM's.
  const [entering, setEntering] = useState(false);

  async function enterFor(entry: EscapeEntry) {
    const result = await runCommand(registry, db, user, enterRequest, { request, entry });
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    setEntering(false);
    show({ text: `Entered ${who === 'The party' ? "the party's" : possessive(who)} roll` });
    onChanged();
    return true;
  }

  // A secret activity: the GM's own Hit / Miss, recorded as a secret check once tapped.
  const [rolled, setRolled] = useState<'hit' | 'miss' | null>(null);

  async function roll(outcome: 'hit' | 'miss') {
    if (busy || !secret) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, recordCheck, {
      campaignId: campaign.id,
      record: {
        checkKey: `activity:${secret.activity.id}:${request.id}`,
        name: `${secret.activity.name}, ${who}`,
        source: 'gm',
        outcome,
        modifiers: secret.plan.modifiers.map((m) => ({ source: m.source, kind: m.source === 'party' ? ('party' as const) : ('hand' as const), label: m.label, add: m.add, replaces: null, never: false, public: false, note: null })),
        secret: true,
      },
    });
    setBusy(false);
    if (!result.ok) return show({ text: result.message, error: true });
    setRolled(outcome);
    show({
      text: `${outcome === 'hit' ? 'Hit' : 'Miss'} recorded for ${secret.activity.name}`,
      onUndo: async () => {
        const eventId = await latestChange(db, campaign.id, 'check.record', user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
        else setRolled(null);
      },
    });
  }

  async function answer(given: Answer, words: string, then?: () => void, costText?: string) {
    if (busy) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, answerRequest, {
      request,
      answer: given,
      ...(costText !== undefined ? { costText } : {}),
      ...(request.kind === 'secretActivity' && secret ? { activity: { spend: secret.prompt.spend } } : {}),
    });
    setBusy(false);
    if (!result.ok) return show({ text: result.message, error: true });
    then?.();
    show({
      text: words,
      onUndo: async () => {
        const eventId = await latestChange(db, campaign.id, 'request.answer', user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
        else show({ text: `Put ${possessive(who)} request back` });
        onChanged();
      },
    });
    onChanged();
  }

  /**
   * A buy request's answer (TC13 piece B; ap-14, tn-4, tn-7; docs/specs/town-ask-buy.md, "Piece B"): a flip of the
   * toggle writes the day's stock for the thing at that shop first (stock.set, the record the stock table flips), then
   * the answer (request.answer); Price…'s Send price writes the answer alone. A failed stock write sends nothing; a
   * failed answer after a good stock write leaves the card on "?" with an error toast, and a second flip writes the same
   * stock again (no new line) and the answer. A thing with no pack id (Something not listed…) or an ask with no shop
   * has no stock record: the flip answers only. The toast's Undo takes back the answer, then the stock line this card
   * wrote, newest first, each by the log's own Undo; refused in plain words once the player has replied.
   */
  async function answerBuy(result: 'inStock' | 'notHere' | 'price', price: string, stock: 'in' | 'out' | null): Promise<boolean> {
    if (busy) return false;
    const prompt = readBuyPrompt(request.prompt);
    const item = prompt?.item ?? request.text;
    setBusy(true);
    const done = await (async () => {
      if (stock && prompt?.serviceId && prompt.itemId) {
        const seconds = units ? await loadClockNow(db, campaign.id) : null;
        if (!units || seconds === null) return "Couldn't read the campaign's clock. Nothing was sent. Try again.";
        const before = await latestChange(db, campaign.id, setStock.name, user.id);
        const set = await runCommand(registry, db, user, setStock, { campaignId: campaign.id, serviceId: prompt.serviceId, itemId: prompt.itemId, day: readClock(seconds, units).day, answer: stock });
        if (!set.ok) return set.message;
        // A stock line made by this flip (none when the day's answer was already this one: nothing changed to undo).
        const after = await latestChange(db, campaign.id, setStock.name, user.id);
        if (after && after !== before) stockLine.current = after;
      }
      const answered = await runCommand(registry, db, user, answerRequest, { request, answer: { kind: 'buy', result, price, note: '' } });
      return answered.ok ? null : answered.message;
    })();
    setBusy(false);
    if (done !== null) {
      show({ text: done, error: true });
      return false;
    }
    const wrote = stockLine.current;
    stockLine.current = null;
    show({
      text: result === 'notHere' ? `Not here: told ${who}` : `${who}: ${item}, ${price}`,
      onUndo: async () => {
        const eventId = await latestChange(db, campaign.id, answerRequest.name, user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
        const back = undone?.ok && wrote ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId: wrote, authorUserId: user.id }) : null;
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
        else if (back && !back.ok) show({ text: back.message, error: true });
        else show({ text: `Put ${possessive(who)} request back` });
        onChanged();
      },
    });
    onChanged();
    return true;
  }

  if (request.kind === 'escapeRoll') {
    const prompt = readEscapePrompt(request.prompt);
    const entry = readEscapeEntry(request.entry);
    const total = prompt && entry ? escapeTotal(prompt, entry) : null;
    return (
      <li className="pack__item request request--gm">
        <p className="pack__name">{`${who}, escape roll`}</p>
        {prompt && <p className="auth__meta">{escapeRollWords(prompt)}</p>}
        <p className="request__text">{entry && total ? `Rolled ${entry.roll}${total.parts.map((p) => ` ${p}`).join('')} = ${total.total}` : `Waiting for ${who === 'The party' ? "the party's" : possessive(who)} roll`}</p>
        {hirelings.length > 0 && <p className="auth__meta">{`${hirelings.join(', ')} ${hirelings.length === 1 ? 'leaves' : 'leave'} with ${who} and ${hirelings.length === 1 ? 'shares' : 'share'} this result.`}</p>}
        {!entry && !entering && (
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setEntering(true)}>
            {`Enter for ${who === 'The party' ? 'the party' : who}`}
          </button>
        )}
        {entering && <EscapeRollCard request={request} forName={who === 'The party' ? 'the party' : who} onEnter={enterFor} />}
        <div className="request__chips" role="group" aria-label="Outcome">
          <Chip pressed={out} onClick={() => setOut(true)}>
            Out safely
          </Chip>
          <Chip pressed={!out} onClick={() => setOut(false)}>
            Lost below
          </Chip>
        </div>
        <div className="field">
          <label className="label" htmlFor={noteId}>
            A note for them
          </label>
          <input id={noteId} className="field__input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="pack__actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              void answer({ kind: 'escape', out, note: note.trim() }, `Sent ${who}: ${out ? 'out safely' : 'lost below'}`, () => {
                if (!out && doomTable === 'missing') show({ text: "The pack's doom table isn't in this campaign's setting rules.", error: true });
                else if (!out && doomTable && doomTable !== 'missing') onLost(doomTable);
              })
            }
          >
            Send
          </button>
        </div>
      </li>
    );
  }

  // M5b step 6e: buying, selling, Somewhere else… and town activities.
  const townAnswer = (given: Answer, words: string, costText?: string) => void answer(given, words, undefined, costText);
  if (request.kind === 'buy' && readBuyPrompt(request.prompt)) return <GmBuyCard request={request} who={who} trade={trade} onAnswer={{ flip: (stock, price) => answerBuy(stock === 'in' ? 'inStock' : 'notHere', price, stock), price: (price) => answerBuy('price', price, null) }} />;
  if (request.kind === 'sell' && readSellPrompt(request.prompt)) return <GmSellCard request={request} who={who} trade={trade} onAnswer={townAnswer} />;
  if (request.kind === 'lodging' && readStayPrompt(request.prompt)) return <GmStayCard request={request} who={who} onAnswer={townAnswer} />;
  if (request.kind === 'askGm' && readTownActivityPrompt(request.prompt)) return <GmTownActivityCard request={request} who={who} onAnswer={townAnswer} />;

  if (request.kind === 'secretActivity') {
    const costWords = request.costText || 'no cost';
    const others = (acting ?? []).filter((name) => name !== who);
    return (
      <li className="pack__item request request--gm">
        <p className="pack__name">{`${who} asks: ${request.text}, ${costWords}`}</p>
        {others.length > 0 && <p className="auth__meta">{`With ${others.join(', ')}.`}</p>}
        {!secret && <p className="request__text">The pack no longer offers this activity here. Answer from what you know; Yes takes no cost.</p>}
        {secret && (
          <>
            {secret.plan.instructions && <p className="request__text">{secret.plan.instructions}</p>}
            {secret.plan.modifiers.length > 0 && (
              <ul className="request__modifiers" aria-label="Modifiers">
                {secret.plan.modifiers.map((m, i) => (
                  <li key={i} className="auth__meta">
                    {activityModifierWords(m)}
                  </li>
                ))}
              </ul>
            )}
            {secret.usable?.result && <p className="request__text">{`On a hit: ${secret.usable.result}`}</p>}
            {secret.yields && <p className="request__text">{`Gives: ${secret.yields} (you add it to their pack)`}</p>}
            {secret.table === 'missing' && <p className="auth__meta">The pack's table for this isn't in this campaign's setting rules.</p>}
            {secret.table && secret.table !== 'missing' && (
              <button type="button" className="button-quiet" onClick={() => onTable?.(secret.table as ReadTable)}>
                {`Open the table: ${secret.table.name}`}
              </button>
            )}
            {secret.activity.chance && (
              <div className="request__chips" role="group" aria-label="Your roll">
                <Chip pressed={rolled === 'hit'} onClick={() => void roll('hit')}>
                  {rolled === 'hit' ? '✓ Hit' : 'Hit'}
                </Chip>
                <Chip pressed={rolled === 'miss'} onClick={() => void roll('miss')}>
                  {rolled === 'miss' ? '✓ Miss' : 'Miss'}
                </Chip>
              </div>
            )}
          </>
        )}
        <div className="field">
          <label className="label" htmlFor={noteId}>
            A note for them
          </label>
          <input id={noteId} className="field__input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="pack__actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              const spend = secret?.prompt.spend ?? 0;
              const cost = spend === 'all' ? `, all of today's ${(budget?.name ?? 'travel points').toLowerCase()}` : spend > 0 ? `, ${spend} ${unitFor(spend, budget?.unit ?? 'points')}` : '';
              void answer({ kind: 'yesNo', yes: true, turns: 0, note: note.trim() }, `Yes to ${who}${cost}`);
            }}
          >
            Yes
          </button>
          <button type="button" className="button-secondary button-secondary--small" onClick={() => void answer({ kind: 'yesNo', yes: false, turns: 0, note: note.trim() }, `No to ${who}`)}>
            No
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="pack__item request request--gm">
      <p className="pack__name">{`${who} asks`}</p>
      <p className="request__text">{`“${request.text}”`}</p>
      <div className="field">
        <label className="label" htmlFor={noteId}>
          A note for them
        </label>
        <input id={noteId} className="field__input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="pack__actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => void answer({ kind: 'yesNo', yes: true, turns: 0, note: note.trim() }, `Yes to ${who}`)}
        >
          Yes
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={() => void answer({ kind: 'yesNo', yes: false, turns: 0, note: note.trim() }, `No to ${who}`)}>
          No
        </button>
      </div>
    </li>
  );
}

/**
 * The GM's nudge for worn magic armour whose base isn't picked yet (bq3-8, ruled 2026-11-04): the Request card's GM
 * side, with the bases as Base armour choice rows. Picking keeps the base on the line (logged, Undo on the toast);
 * a base the wearer's class can't wear takes the armour off, carried, and the toast says why.
 */
export function GmBasePickCard({
  db,
  user,
  line,
  carrier,
  choices,
  nameOf,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  line: InventoryLine;
  carrier: NamedCarrier;
  choices: readonly string[];
  nameOf: (id: string) => string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const setProblem = useErrorToast();
  const [busy, setBusy] = useState(false);
  async function pick(id: string) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const result = await pickBaseArmour(db, user, { line, carrier, baseId: id });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return onChanged();
    }
    onChanged();
    toast({
      text: result.value.cameOff ?? `${line.name}: ${nameOf(id)}`,
      onUndo: async () => {
        const eventId = await latestChange(db, line.campaignId, 'inventory.setBaseArmour', user.id);
        if (eventId) await runCommand(registry, db, user, undoChange, { campaignId: line.campaignId, eventId, authorUserId: user.id });
        onChanged();
      },
    });
  }
  return (
    <li className="pack__item request request--gm">
      <p className="pack__name">{`Pick the base for ${line.name} (worn by ${carrier.name})`}</p>
      <p className="auth__meta">Its armour class waits for the base. If their class can't wear the base you pick, the armour comes off.</p>
      <BaseArmourChoice choices={choices} nameOf={nameOf} selected={null} onPick={(id) => void pick(id)} />
    </li>
  );
}

/** The pack's doom table for a failed escape roll, opened by the Waiting list once Send has gone through. */
export function LostBelowDialog({ table, who, onClose }: { table: ReadTable; who: string; onClose: () => void }) {
  return <TableDialog table={table} title={`Lost below: ${table.name}`} intro={`${who} failed the escape roll. Roll on the pack's table.`} onClose={onClose} />;
}

/** A pack table the GM rolls on from the Waiting list (a secret activity's, S4-8: the table pops up for the GM). */
export function TableDialog({ table, title, intro, onClose }: { table: ReadTable; title: string; intro: string; onClose: () => void }) {
  const show = useToast();
  return (
    <Dialog label={title} onClose={onClose}>
      <p className="auth__meta">{intro}</p>
      <TableRoll table={table} column={null} onRead={(reading) => show({ text: reading.result })} />
    </Dialog>
  );
}

export type { EscapePrompt };
