// The card after an expedition ends (row S19 of docs/plans/dec-9-the-whole-scene.md, its screen half; ap-11, mm-8,
// ic-2, ft-1; page 16, frames 16-T11 to 16-T11d, approved 2026-11-14). An item of "Waiting for you" (kind
// `expeditionEnd`, first of everything waiting): SceneTime registers it and draws this into the panel's open card, or
// where the strip stands while no panel shows (a town keeps today's screen until 5t). It holds exactly today's
// summary, in the new dress:
//   the head: the flag of End expedition, "Expedition ended", and the app's Undo (the turned-back arrow and the
//     underlined word, ic-2) at its right, kept on the card until Done (ap-11: the one exception to "Undo lives in the
//     toast"; the toast carries it too). It undoes the end only, never a heal.
//   "Took 3 hours." (or "No time passed.").
//   "In a safe place?" as the two-sided switch (ds-1d), neither side lit until the first tap (T11b), which it never
//     returns to; after Yes (in town, until Not yet) "Staying a while?" with Start downtime and Not yet (`children`).
//   before the rest, Full rest as a stacked button (the night's sleep), the card's accent; after it, the rest's lines
//     (`RestLines`, shared with Start downtime's panel): the rest's line naming who was left out, the setting's healing
//     rule with its source, and a row a character who went (name; hit points and the bar; Heal with the herbs, opening
//     today's damage-or-heal pad), or "Everyone is at full hit points." when nobody is hurt. Every character a row;
//     the page scrolls (T11c). No "Heal all".
//   "Done", the item's last answer, in place of the ✕: the accent once the rest is taken.
// The GM's alone: SceneTime never draws it, nor registers it, for a player.
import type { ReactNode } from 'react';
import type { EndCardRow } from '../modules/expedition/endCard.ts';
import { BookFaces } from '../ui/BookFaces.tsx';
import { Icon } from '../ui/icons.tsx';
import { HpBar, SkeletonRows, SourceLine, StackedButton } from '../ui/parts.tsx';
import './EndCard.css';

export function EndCard({
  took,
  accent,
  rested,
  onRest,
  onUndo,
  onDone,
  safePlace,
  children,
}: {
  /** "Took 3 hours." or "No time passed." */
  took: string;
  /** The item holds the page's accent: Full rest until the rest is taken, then Done. */
  accent: boolean;
  rested: boolean;
  onRest: () => void;
  onUndo: () => void;
  onDone: () => void;
  /** "In a safe place?" (`SafePlaceQuestion`) and, after Yes, "Staying a while?" (`StayingAWhile`). */
  safePlace: ReactNode;
  /** The rest's lines once the rest is taken (`RestLines`), and anything the card's flow opens (the rest prompt). */
  children?: ReactNode;
}) {
  return (
    <BookFaces>
      <section className="end-card" aria-label="Expedition ended">
        <div className="end-card__head">
          <span className="end-card__mark" aria-hidden="true">
            <Icon name="flag-objective" size={28} />
          </span>
          <h3 className="end-card__title">Expedition ended</h3>
          <button type="button" className="end-card__undo" aria-label="Undo ending the expedition" onClick={onUndo}>
            <Icon name="anticlockwise-rotation" size={20} />
            <span>Undo</span>
          </button>
        </div>
        <p className="end-card__took">{took}</p>
        {safePlace}
        {!rested && (
          <div className="end-card__row end-card__row--end">
            <StackedButton icon="night-sleep" label="Full rest" variant={accent ? 'primary' : 'secondary'} onClick={onRest} />
          </div>
        )}
        {children}
        <div className="end-card__row end-card__row--end">
          <StackedButton icon="check-mark" label="Done" variant={accent && rested ? 'primary' : 'secondary'} onClick={onDone} />
        </div>
      </section>
    </BookFaces>
  );
}

/**
 * A full rest's lines (D23; the end card's and Start downtime's panel's, built once): the rest's line as a labelled
 * line ("Full rest." then who was left out), the setting's healing rule with its source, then a row a character (the
 * name; "6 of 8" with the bar under it, as the marching order draws them; Heal with the herbs), or "Everyone is at
 * full hit points." when nobody is hurt; `none` when nobody went; skeleton rows while the characters load.
 */
export function RestLines({
  line,
  healing,
  rows,
  everyoneFull,
  none,
  onHeal,
}: {
  line: { label: string; words: string };
  healing: { rule: string; source: string | null } | null;
  /** Null while the characters load. */
  rows: readonly EndCardRow[] | null;
  everyoneFull: boolean;
  none: string;
  onHeal: (id: string) => void;
}) {
  return (
    <div className="end-card__rest">
      <div className="end-card__rule">
        <p className="end-card__line">
          <span className="book-label">{line.label}</span> {line.words}
        </p>
        {healing && (
          <>
            <p className="end-card__line">{healing.rule}</p>
            {healing.source && <SourceLine>{healing.source}</SourceLine>}
          </>
        )}
      </div>
      {rows === null ? (
        <SkeletonRows rows={2} label="Loading the characters" />
      ) : rows.length === 0 ? (
        <p className="end-card__row end-card__words">{none}</p>
      ) : everyoneFull ? (
        <p className="end-card__row end-card__words">Everyone is at full hit points.</p>
      ) : (
        <ul className="end-card__went">
          {rows.map((row) => (
            <li key={row.id} className="end-card__who">
              <span className="end-card__name">{row.name}</span>
              <HitPoints row={row} />
              <StackedButton icon="herbs-bundle" label="Heal" aria-label={`Heal ${row.name}`} onClick={() => onHeal(row.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "6 of 8", the figure bold, with the bar under it at the right; "—" with no bar while unset. */
function HitPoints({ row }: { row: EndCardRow }) {
  return (
    <span className="end-card__hp">
      <span className="end-card__hp-words">
        {row.hp ? (
          <>
            <span className="end-card__hp-now">{row.hp.now}</span>
            {` of ${row.hp.max}`}
          </>
        ) : (
          <span className="end-card__hp-now">{row.hpLine}</span>
        )}
      </span>
      <HpBar fills={row.fills} />
    </span>
  );
}
