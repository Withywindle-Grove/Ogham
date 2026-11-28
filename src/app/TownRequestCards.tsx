// The Request card's town kinds (M5b step 6e; ruled 2026-10-30, ST5–ST8; dt-11, st-3; 06 Components "Buy request",
// "Sale offer", "Lodging picker", "Request card"). The GM's side sits in Waiting for you; the player's priced answer
// on their Scene, beside the other answers (PlayerRequests).
//   Buy request (GM; TC13 piece B, ap-14, frame TW8g): who asks for what, at which place, and the thing's chance as
//   the stock table writes it; Price… (TW4c's pop-up), "Stocked?" and the three-position toggle on "?": a flip
//   answers In stock or Not here at once and sets the day's stock (the caller, RequestCard's GmRequestCard).
//   Sale offer (GM): the item, how many and the buyer, the price the pack's sale rule suggests, and Offer
//   (changeable).
//   Somewhere else… (GM): Yes with what it costs, in words, or Not available.
//   Priced answer (player): Buy it / Leave it, or Accept / Decline. Costs are text until purses (M7b).
import { useId, useState } from 'react';
import type { Answer, Request } from '../modules/requests/requests.ts';
import { readBuyPrompt, readSellPrompt, readStayPrompt, readTownActivityPrompt } from '../modules/requests/townRequests.ts';
import { DieGlyph, isDieSize } from '../ui/dice.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { StackedButton, StockToggle } from '../ui/parts.tsx';

/** What the GM's device reads from the pack for a buy or sell request (WaitingForYou, from the campaign's setting). */
export interface TradeView {
  /** Buying: the thing's own chance as its availability writes it ("4-in-6", "always"); '' without one (TW8g). */
  chance: string;
  /** Selling: the suggested price in words, and the share it came from. */
  suggested: string | null;
  share: number | null;
}

type Answering = (answer: Answer, words: string, costText?: string) => void;

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        A note for them
      </label>
      <input id={id} className="field__input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** How a buy request is answered (TC13 piece B): the toggle's flip ('in' or 'out'), or Price…'s price. */
export type BuyAnswering = {
  /** A flip of the toggle: right is In stock at `price` (the pack's, or the GM's from the pop-up), left is Not here. */
  flip: (answer: 'in' | 'out', price: string) => Promise<boolean>;
  /** Send price from Price…: the GM's own price, with no stock line. */
  price: (price: string) => Promise<boolean>;
};

/**
 * A thing's chance as the stock table writes it (TW8g, TW8j): the die's glyph and "x-in-y", or "Always"; null with no
 * chance. A chance of another shape keeps the pack's words, with no glyph.
 */
export function StockChance({ chance }: { chance: string }) {
  const words = chance.trim();
  if (!words) return null;
  if (words.toLowerCase() === 'always') return <span className="stock-chance">Always</span>;
  const sides = Number(/^\d+\s*-?\s*in\s*-?\s*(\d+)$/i.exec(words)?.[1]);
  return (
    <span className="stock-chance">
      {isDieSize(sides) && <DieGlyph die={sides} size={16} />}
      {words}
    </span>
  );
}

/**
 * Price… (TW4c, sb5-3): the pop-up with the pack's price as a line, "Your price, in words" and Send price, the
 * pop-up's accent. An empty field keeps its line asking for the price, beside the field.
 */
function PricePopUp({ heading, packPrice, onSend, onClose }: { heading: string; packPrice: string; onSend: (price: string) => Promise<boolean>; onClose: () => void }) {
  const priceId = useId();
  const [price, setPrice] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Dialog label={heading} onClose={onClose}>
      {packPrice && <p className="auth__meta">{`The pack's price: ${packPrice}`}</p>}
      <div className="field">
        <label className="label" htmlFor={priceId}>
          Your price, in words
        </label>
        <input id={priceId} className="field__input field__input--short" autoComplete="off" value={price} onChange={(e) => setPrice(e.target.value)} />
        {problem && (
          <p className="form-error" role="alert">
            {problem}
          </p>
        )}
      </div>
      <div className="pack__actions request__send">
        <StackedButton
          icon="two-coins"
          label="Send price"
          variant="primary"
          onClick={() => {
            if (!price.trim()) return setProblem('Type the price, such as "12 gp".');
            setProblem(null);
            void onSend(price.trim()).then((sent) => sent && onClose());
          }}
        />
      </div>
    </Dialog>
  );
}

/**
 * Ask for… on the GM's side (ST5; TC13 piece B: ap-14, tn-4, tn-7, frame TW8g): "<who> asks for: <thing>", "At
 * <place>." and the thing's chance as the stock table writes it; then, right-justified on one line, Price…, "Stocked?"
 * and the built StockToggle, last, resting on "?" (the card shows only for a thing still on "?" or not listed). A flip
 * answers at once (the caller writes the day's stock, then the answer); a right flip with no price to say opens
 * Price… first (sb5-1). No note (sb5-2), no Hit or Miss (tn-4), and no accent: Move on keeps it (ap-14).
 */
export function GmBuyCard({ request, who, trade, onAnswer }: { request: Request; who: string; trade: TradeView | null; onAnswer: BuyAnswering }) {
  const prompt = readBuyPrompt(request.prompt);
  const item = prompt?.item ?? request.text;
  const packPrice = prompt?.price ?? '';
  const heading = `${who} asks for: ${item}`;
  // Price…'s pop-up: 'price' from its button (no stock line), 'in' from a right flip with no price to say (sb5-1).
  const [pricing, setPricing] = useState<'price' | 'in' | null>(null);
  const flip = (answer: 'in' | 'out') => {
    if (answer === 'in' && !packPrice) return setPricing('in');
    void onAnswer.flip(answer, answer === 'in' ? packPrice : '');
  };
  return (
    <li className="pack__item request request--gm request--ask">
      <p className="pack__name">{heading}</p>
      <p className="request__text">
        {prompt?.shop && `At ${prompt.shop}.`}
        {trade?.chance && (
          <>
            {prompt?.shop && ' '}
            <StockChance chance={trade.chance} />
          </>
        )}
      </p>
      <div className="request__stocked">
        <StackedButton icon="two-coins" label="Price…" aria-haspopup="dialog" onClick={() => setPricing('price')} />
        <span className="request__stocked-label" aria-hidden="true">
          Stocked?
        </span>
        <StockToggle thing={item} state="undecided" onChange={flip} />
      </div>
      {pricing && <PricePopUp heading={heading} packPrice={packPrice} onSend={(price) => (pricing === 'in' ? onAnswer.flip('in', price) : onAnswer.price(price))} onClose={() => setPricing(null)} />}
    </li>
  );
}

/** Sell… on the GM's side (ST6): the suggested price from the pack's sale rule, changeable, then Offer. */
export function GmSellCard({ request, who, trade, onAnswer }: { request: Request; who: string; trade: TradeView | null; onAnswer: Answering }) {
  const prompt = readSellPrompt(request.prompt);
  const offerId = useId();
  const [note, setNote] = useState('');
  const [offer, setOffer] = useState(trade?.suggested ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const item = prompt ? `${prompt.item}${prompt.qty > 1 ? ` ×${prompt.qty}` : ''}` : request.text;
  return (
    <li className="pack__item request request--gm">
      <p className="pack__name">{`${who} wants to sell ${item}${prompt?.buyer ? ` to ${prompt.buyer}` : ''}`}</p>
      <p className="auth__meta">
        {trade?.suggested ? `The pack's rule suggests ${trade.suggested}${trade.share !== null ? ` (${trade.share}% of the price)` : ''}.` : 'The pack suggests no price for this.'}
      </p>
      <div className="field">
        <label className="label" htmlFor={offerId}>
          Your offer, in words
        </label>
        <input id={offerId} className="field__input field__input--short" autoComplete="off" value={offer} onChange={(e) => setOffer(e.target.value)} />
      </div>
      <NoteField value={note} onChange={setNote} />
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <div className="pack__actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            if (!offer.trim()) return setProblem('Type an offer, such as "8 gp".');
            setProblem(null);
            onAnswer({ kind: 'offer', price: offer.trim(), note: note.trim() }, `Offered ${who} ${offer.trim()}`);
          }}
        >
          Offer
        </button>
      </div>
    </li>
  );
}

/** Somewhere else… on the GM's side (ST7, dt-11): Yes with what it costs, or Not available. */
export function GmStayCard({ request, who, onAnswer }: { request: Request; who: string; onAnswer: Answering }) {
  const prompt = readStayPrompt(request.prompt);
  const costId = useId();
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  return (
    <li className="pack__item request request--gm">
      <p className="pack__name">{`${who} asks to stay: ${prompt?.name ?? request.text}`}</p>
      {prompt?.town && <p className="auth__meta">{`In ${prompt.town}`}</p>}
      <div className="field">
        <label className="label" htmlFor={costId}>
          What it costs, in words
        </label>
        <input id={costId} className="field__input field__input--short" autoComplete="off" placeholder="free" value={cost} onChange={(e) => setCost(e.target.value)} />
      </div>
      <NoteField value={note} onChange={setNote} />
      <div className="pack__actions">
        <button type="button" className="button-secondary" onClick={() => onAnswer({ kind: 'yesNo', yes: true, turns: 0, note: note.trim() }, `Yes to ${who}`, cost.trim())}>
          Yes
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={() => onAnswer({ kind: 'yesNo', yes: false, turns: 0, note: note.trim() }, `Not available: told ${who}`)}>
          Not available
        </button>
      </div>
    </li>
  );
}

/** A town activity on the GM's side (ST8): what they want to do, its rule and cost, then Yes or No with the GM's words. */
export function GmTownActivityCard({ request, who, onAnswer }: { request: Request; who: string; onAnswer: Answering }) {
  const prompt = readTownActivityPrompt(request.prompt);
  const [note, setNote] = useState('');
  const rule = typeof request.prompt.rule === 'string' ? request.prompt.rule : '';
  return (
    <li className="pack__item request request--gm">
      <p className="pack__name">{`${who}: ${prompt?.name || request.text}${request.costText ? `, ${request.costText}` : ''}`}</p>
      {prompt?.townActivity === null && <p className="request__text">{`“${request.text}”`}</p>}
      {rule && <p className="request__note">{rule}</p>}
      <NoteField value={note} onChange={setNote} />
      <p className="auth__meta">Tell them what comes of it: your note goes with the answer. Money is in words until purses.</p>
      <div className="pack__actions">
        <button type="button" className="button-secondary" onClick={() => onAnswer({ kind: 'yesNo', yes: true, turns: 0, note: note.trim() }, `Yes to ${who}`)}>
          Yes
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={() => onAnswer({ kind: 'yesNo', yes: false, turns: 0, note: note.trim() }, `No to ${who}`)}>
          No
        </button>
      </div>
    </li>
  );
}

/** Whether an answered request waits for the player's reply (a priced buy answer, an offer). */
export const waitsForReply = (r: Request): boolean =>
  r.status === 'answered' && r.reply === null && r.answer !== null && (r.answer.kind === 'offer' || (r.answer.kind === 'buy' && r.answer.result !== 'notHere' && r.answer.price !== ''));

/** The player's side of a priced answer: Buy it / Leave it (ST5), Accept / Decline (ST6). */
export function PricedAnswerCard({ request, words, onReply }: { request: Request; words: string; onReply: (accept: boolean) => void }) {
  const sell = request.answer?.kind === 'offer';
  const note = request.answer && 'note' in request.answer ? request.answer.note : '';
  return (
    <article className="request request--answered" aria-label="The GM's answer">
      <p className="request__title">The GM says</p>
      <p className="request__answer">{words}</p>
      {note && <p className="request__note">{note}</p>}
      <p className="request__text">{`“${request.text}”`}</p>
      <div className="pack__actions">
        <button type="button" className="button-secondary" onClick={() => onReply(true)}>
          {sell ? 'Accept' : 'Buy it'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={() => onReply(false)}>
          {sell ? 'Decline' : 'Leave it'}
        </button>
      </div>
    </article>
  );
}
