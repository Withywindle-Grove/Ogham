// The call to adventure reaching a player (row P7 of docs/plans/dec-9-the-players-scene.md; rulings p7-4 to p7-13,
// docs/design/rulings/p7-call-card-2026-11-24.md). Drawn as page 18's PL4b card (approved 2026-11-14, ap-10) under page
// 40 (approved 2026-11-24 as drawn): 40A, the card (its mark, its heading from the send's kind, the words in the book's
// format, one "Pays" line when there is one, "Got it"); 40B, the folded row a "Got it" leaves, a tap reading the card
// again with no button of its own; 40C, one card at a time, "1 of 3" on its quiet line, folded rows under it, newest
// fold first. No source line (p7-6). Mounted last in the players' prompt slot (SceneTime, usePlayerCalls.ts).
import { useState } from 'react';
import { Icon } from '../ui/icons.tsx';
import { StackedButton } from '../ui/parts.tsx';
import { callHeading, type CallSend, type CallsInSlot } from '../modules/library/callCards.ts';
import '../ui/bookFaces.css';
import './CallCard.css';

const MARK = { hook: 'stabbed-note', rumour: 'beer-stein' } as const;

/** The card (40A): with `onGotIt`, its one plain button; without, the card reopened from its row (40B, p7-10). */
export function CallCard({ send, count = null, onGotIt }: { send: CallSend; count?: string | null; onGotIt?: () => void }) {
  const heading = callHeading(send);
  // A rumour never pays (p7-5; 40A): its send's pays is empty, and the card says nothing of it.
  const pays = send.kind === 'hook' ? send.pays.trim() : '';
  return (
    <div className={`call-card book-faces${onGotIt ? '' : ' call-card--reopened'}`} role="status" data-prompt-id={onGotIt ? `call-${send.id}` : undefined}>
      <span className="call-card__mark">
        <Icon name={MARK[send.kind]} size={28} />
      </span>
      <div className="call-card__body">
        <h3 className="call-card__heading">{heading}</h3>
        <p className="call-card__words">{send.body}</p>
        {pays && (
          <p className="call-card__words call-card__pays">
            <span className="book-label">Pays</span>
            {pays}
          </p>
        )}
        {count && <p className="call-card__count">{count}</p>}
      </div>
      {onGotIt && <StackedButton icon="check-mark" label="Got it" aria-label={`Got it: ${heading}`} onClick={onGotIt} />}
    </div>
  );
}

/** A call already seen, folded to one quiet row (40B, p7-7): a tap reads the card again under it; a tap folds it. */
export function CallFoldedRow({ send, startOpen = false }: { send: CallSend; /** The gallery's reopened specimen. */ startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const heading = callHeading(send);
  return (
    <>
      <button type="button" className="call-fold" aria-expanded={open} aria-label={`${heading}: ${open ? 'fold away' : 'read it again'}`} onClick={() => setOpen((o) => !o)}>
        <span className="call-fold__mark">
          <Icon name={MARK[send.kind]} size={24} />
        </span>
        <span className="call-fold__heading">{heading}</span>
        <span className={`call-fold__chevron${open ? ' call-fold__chevron--open' : ''}`}>
          <Icon name="chevron" size={20} />
        </span>
      </button>
      {open && <CallCard send={send} />}
    </>
  );
}

/** The calls in the slot (40C): the oldest unseen card with its count, then each folded row, newest fold first. */
export function CallsInPromptSlot({ calls, onGotIt }: { calls: CallsInSlot; onGotIt: (send: CallSend) => void }) {
  if (!calls.card && calls.folded.length === 0) return null;
  return (
    <div className="calls-slot" role="group" aria-label="Calls to adventure">
      {calls.card && <CallCard key={calls.card.id} send={calls.card} count={calls.count} onGotIt={() => onGotIt(calls.card!)} />}
      {calls.folded.map((send) => (
        <CallFoldedRow key={send.id} send={send} />
      ))}
    </div>
  );
}
