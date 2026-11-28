// The detail row and its one pop-up (06 Components "Detail row"; plan dec-scene-feedback sf-6a; page 44, frames EN1 B,
// D, EN3 and EN4 D, approved 2026-11-26). A creature, a named character or an item at hand, for the GM alone. The whole
// row is the tap, between dotted rules, with no box: the name in bold with its count, a character's kind quiet after
// it, then its stat line (StatLine) or an item's rule (a character with no stat block: the name alone); the short form is the name and one quiet line. Its tap opens one
// pop-up, the same for all three: the name is the head, with the X on its line, and no title line over it. Named
// BookDetail* because creation already has a `DetailRow` (the Details step's rows).
import { useState, type ReactNode } from 'react';
import type { HandRow } from '../modules/expedition/pieceNames.ts';
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
  /** How many ("2", "1d4"): "×2" or ", 1d4" after the name, "How many: 2" in the pop-up. */
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
 * The row's name with its count: a fixed count after "×" ("Bog lurker ×2"), a dice count after a comma ("Bog lurker,
 * 1d4"; Francis, 2026-11-26, PR #111).
 */
export function countedName(name: string, count?: string | null): string {
  if (!count) return name;
  return /\d*d\d/i.test(count) ? `${name}, ${count}` : `${name} ×${count}`;
}

/**
 * One detail row: the whole row is one button, "<name>: read it", that opens the detail's pop-up. `short` draws the
 * short form: the name and that one quiet line, no stat line (finding 9). A character the packs give no stat block
 * shows the name alone; the pop-up says why (Francis, 2026-11-26, PR #111).
 */
export function BookDetailRow({ detail, short, under }: { detail: BookDetail; short?: string; under?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { uses } = detail;
  const line = short ? (
    <span className="book-detail__quiet">{short}</span>
  ) : uses === null ? null : uses ? (
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
            <span className="book-detail__name">{countedName(detail.name, detail.count)}</span>
            {detail.kind && <span className="book-detail__quiet">{`, ${detail.kind}`}</span>}
          </span>
          {under}
          {line}
        </span>
        <Icon name="chevron" size={20} />
      </button>
      {open && <BookDetailPopUp detail={detail} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * One row of a place's card as piece A places it (sf-6b; page 44, DT1): a full row, the short row (the name and its
 * quiet line), or a line the packs lack, said in its place with the count and no tap. `under`: a line under the name
 * (a person's Carries line on a phone, page 50, finding 5).
 */
export function BookHandRow({ row, under }: { row: HandRow<BookDetail>; under?: ReactNode }) {
  if (row.form === 'missing') return <span className="book-detail__missing">{countedName(row.words, row.count)}</span>;
  return <BookDetailRow detail={{ ...row.detail, count: row.count }} short={row.form === 'short' ? row.words : undefined} under={under} />;
}

/**
 * The one pop-up a detail row opens (frame EN3): how many, then the detail's own words as a stat block; a named
 * character's descriptor first, then the block they use under its name, or one line when the packs have none. A sheet
 * from the foot on a phone and a centred card on a tablet (EN4 D), wherever it is opened from.
 */
export function BookDetailPopUp({ detail, onClose, preview = false }: { detail: BookDetail; onClose: () => void; preview?: boolean }) {
  const { shown, uses } = detail;
  // "p." never parts from its page (finding 12).
  const source = detail.source?.replace(/\bp\. /g, 'p.\u00a0') ?? null;
  // A character's descriptor stands over their words (EN3 B, D); a creature's under its description (A).
  const character = uses !== undefined;
  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label={detail.name} onClose={onClose} preview={preview} bookHeading>
          <div className="book-detail__body">
            {detail.count && <p className="book-detail__quiet">{`How many: ${detail.count}`}</p>}
            {character && shown.descriptor && <p className="stat-block stat-block__descriptor">{shown.descriptor}</p>}
            <StatBlock shown={character ? { ...shown, descriptor: null } : shown} source={uses === undefined ? source : null} />
            {uses && (
              <>
                <h3 className="book-detail__uses">{uses.name}</h3>
                <StatBlock shown={uses.shown} source={null} />
              </>
            )}
            {uses === null && <p className="book-detail__quiet">{NO_STAT_LINE}</p>}
            {character && source && <SourceLine>{source}</SourceLine>}
          </div>
        </Dialog>
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}
