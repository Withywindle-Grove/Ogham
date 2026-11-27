// The find card as a part (K18b of docs/plans/dec-6-the-whole-pack-tab.md): what another person put in a character's
// pack or purse, for that character's own player, until "Got it". Drawn to page 45 (FD1, FD1c, FD3, FD3b, FD3c, FD4b,
// FD5c, FD9, FD11; approved 2026-11-26, p45-1 to p45-29) over page 08's PK2, PK2b and PK3 (approved 2026-11-14, ap-6);
// where they differ page 45 wins. The words and the shape are K18a's (`findCard`); this part draws them and reads
// nothing: its host (K20b's Pack tab, K18c's other tabs, K18d's prompt slot) hands it K20a's entries, the words, and
// what a tap does.
import { useId, type ReactNode } from 'react';
import { findCard, type FindCardLine, type FindCardWords } from '../modules/characters/findCard.ts';
import type { FindEntry } from '../modules/characters/findsSeen.ts';
import { Icon } from '../ui/icons.tsx';
import { StackedButton } from '../ui/parts.tsx';
import '../ui/bookFaces.css';
import './FindCard.css';

/** FD9's box under the card, after a tap on "Got it" offline (p45-12; PK7b's box, not a toast). */
export const FIND_CARD_OFFLINE = 'You’re offline. Got it waits until you’re back. Your new things are in your pack all the same.';

/**
 * The card, inside its own status region (so its arrival and a line turning quiet are read out), with FD9's offline box
 * under it in the same region. Nothing when there are no entries. A host that must keep one live region of its own
 * across cards (the Scene's prompt slot, as the call card does) passes `live={false}` and wraps it in its region.
 */
export function FindCard({
  entries,
  words,
  onGotIt,
  onMore,
  offlineBox = false,
  live = true,
}: {
  /** K20a's entries for this character (`findsSince`), newest first. */
  entries: readonly FindEntry[];
  words: FindCardWords;
  /** "Got it": the host writes the mark (`markFindsSeen`), or opens the offline box when it can't. */
  onGotIt: () => void;
  /** "and N more" (p45-16): the host opens the Pack at the new rows; it clears nothing. */
  onMore: () => void;
  /** FD9: show the box saying why "Got it" waits. */
  offlineBox?: boolean;
  /** False where the host keeps the live region itself. */
  live?: boolean;
}) {
  const headId = useId();
  const card = findCard(entries, words);
  if (!card) return null;
  // p45-25: a line that turns quiet keeps the room its find took. The card as it was before any Undo (the same entries,
  // none taken back) is drawn under each quiet line, hidden, so the line is never shorter than it was; the same for the
  // "and N more" row when the last things under it are taken back. K18a's order never depends on an Undo, so line i
  // here is line i there.
  const before = findCard(
    entries.map((e) => ({ ...e, takenBack: null })),
    words,
  )!;
  const one = card.lines.length === 1 && card.more === 0 && before.more === 0;
  const gotIt = <StackedButton icon="check-mark" label="Got it" aria-label={`Got it: ${card.head}`} className="find-card__got-it" onClick={onGotIt} />;
  const lines = (
    <ul className="find-card__lines">
      {card.lines.map((line, i) => (
        <li key={i} className={`find-card__line${line.kind === 'back' ? ' find-card__line--back' : ''}`}>
          {line.kind === 'back' ? (
            <>
              <div className="find-card__ghost" aria-hidden="true">
                <FindLineWords line={before.lines[i]!} />
              </div>
              <p className="find-card__back">{line.words}</p>
            </>
          ) : (
            <FindLineWords line={line} />
          )}
        </li>
      ))}
    </ul>
  );
  const body: ReactNode = one ? (
    <div className="find-card__one">
      {lines}
      {gotIt}
    </div>
  ) : (
    <>
      {lines}
      {card.more > 0 ? (
        <button type="button" className="find-card__more" aria-label={`and ${card.more.toLocaleString('en-GB')} more: show them in your pack`} onClick={onMore}>
          <span className="find-card__more-words">and {card.more.toLocaleString('en-GB')} more</span>
          <span className="find-card__chevron">
            <Icon name="chevron" size={20} />
          </span>
        </button>
      ) : (
        before.more > 0 && <div className="find-card__more find-card__more-held" aria-hidden="true" />
      )}
      <div className="find-card__foot">{gotIt}</div>
    </>
  );
  return (
    <div className="find-card-live" role={live ? 'status' : undefined}>
      <section className="find-card book-faces" aria-labelledby={headId}>
        <h3 id={headId} className="find-card__head">
          {card.head}
        </h3>
        {card.once && <p className="find-card__quiet find-card__once">{card.once}</p>}
        {body}
      </section>
      {offlineBox && (
        <div className="find-card find-card--box book-faces">
          <p className="find-card__words">{FIND_CARD_OFFLINE}</p>
        </div>
      )}
    </div>
  );
}

/** A find's line: what arrived in the name's bold, a stack's new count in the plain weight (p45-22), who and when under it. */
function FindLineWords({ line }: { line: FindCardLine }) {
  if (line.kind === 'back') return <p className="find-card__back">{line.words}</p>;
  return (
    <>
      <p className="find-card__what">
        <b className="find-card__name">{line.name}</b>
        {line.now !== null && <span className="find-card__now">, now {line.now}</span>}
      </p>
      {line.quiet && <p className="find-card__quiet">{line.quiet}</p>}
    </>
  );
}
