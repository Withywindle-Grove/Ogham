// The call to adventure reaching a player (row P7 of docs/plans/dec-9-the-players-scene.md; rulings p7-4 to p7-13,
// docs/design/rulings/p7-call-card-2026-11-24.md). Drawn as page 18's PL4b card (approved 2026-11-14, ap-10) under page
// 40 (approved 2026-11-24 as drawn): 40A, the card (its mark, its heading from the send's kind, the words in the book's
// format, one "Pays" line when there is one, "Got it"); 40B, the folded row a "Got it" leaves, a tap reading the card
// again with no button of its own; 40C, one card at a time, "1 of 3" on its quiet line, folded rows under it, newest
// fold first. No source line (p7-6). Mounted last in the players' prompt slot (SceneTime, usePlayerCalls.ts).
// Francis picked the impeccable audit's findings 1 to 6 (24 Nov): focus after "Got it", one live region, the row's
// state said once, the words under "Got it" on a phone, and the lighter edge in dark (CallCard.css). Then Home Two's
// re-audit findings 1 (b) to 4 (24 Nov): the card reads heading, "Got it", words; on a phone the heading has the full
// width; the slot keeps one live region whose text changes with each new card; aria-controls only while open.
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../ui/icons.tsx';
import { StackedButton } from '../ui/parts.tsx';
import { callHeading, type CallSend, type CallsInSlot } from '../modules/library/callCards.ts';
import '../ui/bookFaces.css';
import './CallCard.css';

const MARK = { hook: 'stabbed-note', rumour: 'beer-stein' } as const;

/** The card (40A): with `onGotIt`, its one plain button; without, the card reopened from its row (40B, p7-10). The
 *  live region is the slot's, not the card's (CallsInPromptSlot). */
export function CallCard({ send, count = null, onGotIt, id }: { send: CallSend; count?: string | null; onGotIt?: () => void; /** The reopened card's, for its row's aria-controls. */ id?: string }) {
  const heading = callHeading(send);
  // A rumour never pays (p7-5; 40A): its send's pays is empty, and the card says nothing of it.
  const pays = send.kind === 'hook' ? send.pays.trim() : '';
  // The order read is heading, "Got it", words, at every width (re-audit finding 1, option b), so a screen reader meets
  // the heading first and once. CallCard.css puts "Got it" back where 40A draws it on a tablet, and floats it under the
  // full-width heading on a phone (finding 2).
  return (
    <div id={id} className={`call-card book-faces${onGotIt ? '' : ' call-card--reopened'}`} data-prompt-id={onGotIt ? `call-${send.id}` : undefined}>
      <span className="call-card__mark">
        <Icon name={MARK[send.kind]} size={28} />
      </span>
      <div className="call-card__body">
        <h3 className="call-card__heading">{heading}</h3>
        {onGotIt && <StackedButton icon="check-mark" label="Got it" aria-label={`Got it: ${heading}`} className="call-card__got-it" onClick={onGotIt} />}
        <div className="call-card__text">
          <p className="call-card__words">{send.body}</p>
          {pays && (
            <p className="call-card__words call-card__pays">
              <span className="book-label">Pays</span>
              {pays}
            </p>
          )}
          {count && <p className="call-card__count">{count}</p>}
        </div>
      </div>
    </div>
  );
}

/** A call already seen, folded to one quiet row (40B, p7-7): a tap reads the card again under it; a tap folds it. */
export function CallFoldedRow({ send, startOpen = false }: { send: CallSend; /** The gallery's reopened specimen. */ startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const cardId = useId();
  const heading = callHeading(send);
  // Its name is its heading, open or folded: aria-expanded says the state once (audit finding 3). aria-controls names
  // the card only while it is open: folded, there is none (re-audit finding 4).
  return (
    <>
      <button type="button" className="call-fold" aria-expanded={open} aria-controls={open ? cardId : undefined} data-send-id={send.id} onClick={() => setOpen((o) => !o)}>
        <span className="call-fold__mark">
          <Icon name={MARK[send.kind]} size={24} />
        </span>
        <span className="call-fold__heading">{heading}</span>
        <span className={`call-fold__chevron${open ? ' call-fold__chevron--open' : ''}`}>
          <Icon name="chevron" size={20} />
        </span>
      </button>
      {open && <CallCard send={send} id={cardId} />}
    </>
  );
}

/** The calls in the slot (40C): the oldest unseen card with its count, then each folded row, newest fold first. */
export function CallsInPromptSlot({ calls, onGotIt }: { calls: CallsInSlot; onGotIt: (send: CallSend) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  // The call whose "Got it" was pressed, until it folds (a refused one never does, and focus stays where it is).
  const given = useRef<string | null>(null);
  // Audit finding 1: when the card folds, its button goes, and focus would fall to the page. It moves to the next
  // card's "Got it", else to the row the call folded to; never when the player has moved on elsewhere meanwhile.
  useEffect(() => {
    const id = given.current;
    if (!id || !calls.folded.some((s) => s.id === id)) return;
    given.current = null;
    const root = slot.current;
    const active = document.activeElement;
    if (!root || (active && active !== document.body && !root.contains(active))) return;
    const next = root.querySelector<HTMLElement>('.call-card__got-it') ?? [...root.querySelectorAll<HTMLElement>('.call-fold')].find((row) => row.dataset.sendId === id);
    next?.focus();
  }, [calls]);
  if (!calls.card && calls.folded.length === 0) return null;
  const card = calls.card;
  // One live region for the slot (audit finding 2, re-audit finding 3): it stays while the cards change, so a new card's
  // words are a change inside a region the screen reader already watches, and the next call is announced. It is empty,
  // and takes no room, when only folded rows are left; a card reopened from its row sits outside it.
  return (
    <div ref={slot} className="calls-slot" role="group" aria-label="Calls to adventure">
      <div className="calls-slot__live" role="status">
        {card && (
          <CallCard
            key={card.id}
            send={card}
            count={calls.count}
            onGotIt={() => {
              given.current = card.id;
              onGotIt(card);
            }}
          />
        )}
      </div>
      {calls.folded.map((send) => (
        <CallFoldedRow key={send.id} send={send} />
      ))}
    </div>
  );
}
