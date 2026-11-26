// The detail row and its one pop-up (06 Components "Detail row"; plan dec-scene-feedback sf-6a; page 44, frames EN1 B,
// D, EN3 and EN4 D, approved 2026-11-26). A creature, a named character or an item at hand, for the GM alone. The whole
// row is the tap, between dotted rules, with no box: the name in bold with its count, a character's kind quiet after
// it, then its stat line (StatLine) or an item's rule; the short form is the name and one quiet line. Its tap opens one
// pop-up, the same for all three: the name is the head, with the X on its line, and no title line over it. Named
// BookDetail* because creation already has a `DetailRow` (the Details step's rows).
import { useState } from 'react';
import type { StatBlockShown } from '../modules/library/statBlockLayout.ts';
import { CentredPopUpScope, Dialog, SheetScope } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { SourceLine } from '../ui/parts.tsx';
import { StatBlock, StatLine } from './StatBlock.tsx';
import './BookDetail.css';
import '../ui/creation.css';

/** What a detail row names and its pop-up shows. */
export interface BookDetail {
  name: string;
  /** How many ("2"): "×2" after the name, "How many: 2" in the pop-up. */
  count?: string | null;
  /** A named character's kind, quiet after the name ("a ferryman"). */
  kind?: string | null;
  /** Its own words laid out as a stat block: a creature's whole block, a character's notes, an item's rule. */
  shown: StatBlockShown;
  source: string | null;
  /** A named character: the stat block they use, under its name; null when the packs have none. Absent otherwise. */
  uses?: { name: string; shown: StatBlockShown } | null;
  /** An item: its rule's first words, for the row. */
  rule?: string | null;
}

/** A named character's line when the packs give them no stat block (frame EN3 D). */
export const NO_STAT_LINE = 'Not in your packs: a stat line for this character.';

/**
 * One detail row: the whole row is one button, "<name>: read it", that opens the detail's pop-up. `short` draws the
 * short form: the name and that one quiet line, no stat line (finding 9).
 */
export function BookDetailRow({ detail, short }: { detail: BookDetail; short?: string }) {
  const [open, setOpen] = useState(false);
  const { uses } = detail;
  const line = short ? (
    <span className="book-detail__quiet">{short}</span>
  ) : uses === null ? (
    <span className="book-detail__quiet">{NO_STAT_LINE}</span>
  ) : uses ? (
    <StatLine figures={uses.shown.line} />
  ) : detail.rule ? (
    <span className="book-detail__rule">{detail.rule}</span>
  ) : (
    <StatLine figures={detail.shown.line} />
  );
  return (
    <>
      <button type="button" className="book-detail" aria-haspopup="dialog" aria-label={`${detail.name}: read it`} onClick={() => setOpen(true)}>
        <span className="book-detail__text">
          <span>
            <span className="book-detail__name">{detail.count ? `${detail.name} ×${detail.count}` : detail.name}</span>
            {detail.kind && <span className="book-detail__quiet">{`, ${detail.kind}`}</span>}
          </span>
          {line}
        </span>
        <Icon name="chevron" size={20} />
      </button>
      {open && <BookDetailPopUp detail={detail} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The one pop-up a detail row opens (frame EN3): how many, then the detail's own words as a stat block; a named
 * character's descriptor first, then the block they use under its name, or one line when the packs have none. A sheet
 * from the foot on a phone and a centred card on a tablet (EN4 D), wherever it is opened from.
 */
export function BookDetailPopUp({ detail, onClose, preview = false }: { detail: BookDetail; onClose: () => void; preview?: boolean }) {
  const { shown, uses } = detail;
  // A character's descriptor stands over their words (EN3 B, D); a creature's under its description (A).
  const character = uses !== undefined;
  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label={detail.name} onClose={onClose} preview={preview} bookHeading>
          <div className="book-detail__body">
            {detail.count && <p className="book-detail__quiet">{`How many: ${detail.count}`}</p>}
            {character && shown.descriptor && <p className="stat-block stat-block__descriptor">{shown.descriptor}</p>}
            <StatBlock shown={character ? { ...shown, descriptor: null } : shown} source={uses === undefined ? detail.source : null} />
            {uses && (
              <>
                <h3 className="book-detail__uses">{uses.name}</h3>
                <StatBlock shown={uses.shown} source={null} />
              </>
            )}
            {uses === null && <p className="book-detail__quiet">{NO_STAT_LINE}</p>}
            {character && detail.source && <SourceLine>{detail.source}</SourceLine>}
          </div>
        </Dialog>
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}
