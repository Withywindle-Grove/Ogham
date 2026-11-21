// The Request card's town kinds (M5b step 6e; ruled 2026-10-30, ST5–ST8; dt-11, st-3; 06 Components "Buy request",
// "Sale offer", "Lodging picker", "Request card"). The GM's side sits in Waiting for you; the player's priced answer
// on their Scene, beside the other answers (PlayerRequests).
//   Buy request (GM): what's asked for, at which shop, the pack's price; with an availability chance, Hit / Miss
//   first (the pack's chance by town size, the GM's own roll), then In stock (the pack's price) · Price… · Not here.
//   Sale offer (GM): the item, how many and the buyer, the price the pack's sale rule suggests, and Offer
//   (changeable).
//   Somewhere else… (GM): Yes with what it costs, in words, or Not available.
//   Priced answer (player): Buy it / Leave it, or Accept / Decline. Costs are text until purses (M7b).
import { useId, useState } from 'react';
import type { Answer, Request } from '../modules/requests/requests.ts';
import { readBuyPrompt, readSellPrompt, readStayPrompt, readTownActivityPrompt } from '../modules/requests/townRequests.ts';
import { Chip } from '../ui/parts.tsx';

/** What the GM's device reads from the pack for a buy or sell request (WaitingForYou, from the campaign's setting). */
export interface TradeView {
  /** The pack's chance by town size, in words ("Hamlet 0% · Small town 100%"); '' without one. */
  chance: string;
  chanceNote: string;
  /** The item's own availability, as the pack says it ("towns and cities"). */
  itemAvailability: string;
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

/** Ask for… on the GM's side (ST5). */
export function GmBuyCard({ request, who, trade, onAnswer }: { request: Request; who: string; trade: TradeView | null; onAnswer: Answering }) {
  const prompt = readBuyPrompt(request.prompt);
  const priceId = useId();
  const [note, setNote] = useState('');
  const [rolled, setRolled] = useState<'hit' | 'miss' | null>(null);
  const [pricing, setPricing] = useState(false);
  const [price, setPrice] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const item = prompt?.item ?? request.text;
  const packPrice = prompt?.price ?? '';
  const chance = trade?.chance ?? '';
  // With a chance to roll, the GM's Hit or Miss comes first (ST5); without one, the answers straight away.
  const answers = !chance || rolled !== null;
  const send = (result: 'inStock' | 'notHere' | 'price', priced: string) =>
    onAnswer({ kind: 'buy', result, price: priced, note: note.trim() }, result === 'notHere' ? `Not here: told ${who}` : `${who}: ${item}, ${priced}`);
  return (
    <li className="pack__item request request--gm">
      <p className="pack__name">{`${who} asks for ${item}${prompt?.shop ? `, ${prompt.shop}` : ''}`}</p>
      <p className="auth__meta">{packPrice ? `The pack's price: ${packPrice}` : prompt?.itemId ? 'The pack gives no price for it.' : 'Not on the town’s list.'}</p>
      {trade?.itemAvailability && <p className="request__text">{`Where it's sold: ${trade.itemAvailability}`}</p>}
      {chance && (
        <>
          <p className="request__text">{`Chance it's here: ${chance}`}</p>
          {trade?.chanceNote && <p className="request__note">{trade.chanceNote}</p>}
          <div className="request__chips" role="group" aria-label="Your roll">
            <Chip pressed={rolled === 'hit'} onClick={() => setRolled('hit')}>
              {rolled === 'hit' ? '✓ Hit' : 'Hit'}
            </Chip>
            <Chip pressed={rolled === 'miss'} onClick={() => setRolled('miss')}>
              {rolled === 'miss' ? '✓ Miss' : 'Miss'}
            </Chip>
          </div>
        </>
      )}
      {answers && (
        <>
          <NoteField value={note} onChange={setNote} />
          {pricing && (
            <div className="field">
              <label className="label" htmlFor={priceId}>
                Your price, in words
              </label>
              <input id={priceId} className="field__input field__input--short" autoComplete="off" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          )}
          {problem && (
            <p className="form-error" role="alert">
              {problem}
            </p>
          )}
          <div className="pack__actions">
            {pricing ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  if (!price.trim()) return setProblem('Type the price, such as "12 gp".');
                  setProblem(null);
                  send('price', price.trim());
                }}
              >
                Send price
              </button>
            ) : (
              <>
                {rolled !== 'miss' && packPrice && (
                  <button type="button" className="button-secondary" onClick={() => send('inStock', packPrice)}>
                    In stock
                  </button>
                )}
                <button type="button" className={rolled === 'miss' || !packPrice ? 'button-secondary' : 'button-secondary button-secondary--small'} onClick={() => setPricing(true)}>
                  Price…
                </button>
              </>
            )}
            <button type="button" className="button-secondary button-secondary--small" onClick={() => send('notHere', '')}>
              Not here
            </button>
          </div>
        </>
      )}
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
