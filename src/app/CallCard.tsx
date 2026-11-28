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
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/icons.tsx';
import type { SetIconName } from '../ui/iconSet.ts';
import type { RevealedWords } from '../modules/expedition/reminderPlay.ts';
import { StackedButton } from '../ui/parts.tsx';
import { ENCOUNTER_MARK } from './encounterMark.ts';
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
  return (
    <CardFrame id={id} className={`call-card book-faces${onGotIt ? '' : ' call-card--reopened'}`} promptId={onGotIt ? `call-${send.id}` : undefined} mark={MARK[send.kind]} heading={heading} onGotIt={onGotIt}>
      <p className="call-card__words">{send.body}</p>
      {pays && (
        <p className="call-card__words call-card__pays">
          <span className="book-label">Pays</span>
          {pays}
        </p>
      )}
      {count && <p className="call-card__count">{count}</p>}
    </CardFrame>
  );
}

/**
 * The card's frame, shared by the call card (40A) and its encounter variant (EN5): the mark, then the heading, "Got it"
 * and the text. The order read is heading, "Got it", words, at every width (re-audit finding 1, option b), so a screen
 * reader meets the heading first and once. CallCard.css puts "Got it" back where 40A draws it on a tablet, and floats it
 * under the full-width heading on a phone (finding 2).
 */
function CardFrame({ id, className, promptId, mark, heading, onGotIt, children }: { id?: string; className: string; promptId?: string; mark: IconName | SetIconName; heading: string; onGotIt?: () => void; children: ReactNode }) {
  return (
    <div id={id} className={className} data-prompt-id={promptId}>
      <span className="call-card__mark">
        <Icon name={mark} size={28} />
      </span>
      <div className="call-card__body">
        <h3 className="call-card__heading">{heading}</h3>
        {onGotIt && <StackedButton icon="check-mark" label="Got it" aria-label={`Got it: ${heading}`} className="call-card__got-it" onClick={onGotIt} />}
        <div className="call-card__text">{children}</div>
      </div>
    </div>
  );
}

/**
 * The revealed result on the players' Scene (sf-7b; page 44's EN5, approved 2026-11-26): the call card's encounter
 * variant, in the prompt slot. The crossed swords, "An encounter", the words the GM sent (A1's `revealed_words`: the
 * words and nothing of the check) and a plain "Got it", which puts the card away on this device (sf-23).
 */
export function RevealedCard({ reveal, onGotIt }: { reveal: RevealedWords; onGotIt: () => void }) {
  return (
    <CardFrame className="call-card call-card--encounter book-faces" promptId={`reveal-${reveal.id}`} mark={ENCOUNTER_MARK} heading="An encounter" onGotIt={onGotIt}>
      <p className="call-card__words">{reveal.words}</p>
    </CardFrame>
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
/** No calls yet (the first read still on its way, or none sent): the slot holds its empty live region (last audit, new 1). */
const NO_CALLS: CallsInSlot = { card: null, count: null, folded: [] };

export function CallsInPromptSlot({
  calls: read,
  onGotIt,
  find = null,
}: {
  calls: CallsInSlot | null;
  onGotIt: (send: CallSend) => void;
  /**
   * The find card (K18d; p45-23), drawn with `live={false}`: it shares the calls' one place, one of the two at a time.
   * While it is there the call card waits, and shows after its "Got it". The folded rows stay under it.
   */
  find?: ReactNode;
}) {
  const calls = read ?? NO_CALLS;
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
  // After the find card's "Got it" its button goes: focus, if it fell to the page, moves to the waiting call's "Got it".
  const hadFind = useRef(false);
  useEffect(() => {
    const had = hadFind.current;
    hadFind.current = !!find;
    if (!had || find) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    slot.current?.querySelector<HTMLElement>('.call-card__got-it')?.focus();
  }, [find]);
  const card = find ? null : calls.card;
  const empty = !find && !card && calls.folded.length === 0;
  // The group is named for the calls: with only a find card in the place, there is none to name.
  const grouped = !!card || calls.folded.length > 0;
  // One live region for the slot (audit finding 2, re-audit finding 3): it stays while the cards change, so a new card's
  // words are a change inside a region the screen reader already watches, and the next call is announced. It is empty,
  // and takes no room, when only folded rows are left; a card reopened from its row sits outside it. With no calls at
  // all it is still drawn (Home Two's last audit, new 1), empty and without room or a group to name, so the session's
  // first call is a change inside it too, not a region arriving with its card already in it.
  return (
    <div ref={slot} className={`calls-slot${empty ? ' calls-slot--empty' : ''}`} role={grouped ? 'group' : undefined} aria-label={grouped ? 'Calls to adventure' : undefined}>
      <div className="calls-slot__live" role="status">
        {find}
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
