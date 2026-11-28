// The place panel's facts from its pack (December piece 2c; docs/plans/dec-2-3-places-and-port.md; rulings pf-3 …
// pf-5 and mc-15 … mc-20; mockup design/mockups/scene/09-place-and-settlement.html, variant B and frames 10 and 13):
//   the one line of identity under the title; the facts as bold lead-ins in the pack's order (a hamlet may have two);
//   "About the town" (or the place): the GM's headed prose, each heading folding its text; the place's tables as rows
//   that open the table; and a settlement's watch in its own box. A part with nothing in it isn't drawn (frame 13).
//   A section the pack sets out in blocks (pf-18b, page 22, approved 2026-11-18) draws with the rule text's one look
//   (RuleText); a plain-string section reads paragraph by paragraph with the same gap; an empty one opens to nothing;
//   one the app can't read keeps its heading and says so in one muted line.
//   NoteLines: the GM's notes read as the pack carries them today (frame 10): a line that starts with a label and a
//   colon gets a bold lead-in, page numbers stay text, nothing is a tap.
// All the GM's: the GM's device reads the pack's entry; a player's place view never receives any of it. Links show as
// their labels; a table a link names is a tap through the Tables rows (a tap inside the prose would be under 44 px).
import { useId, useState } from 'react';
import type { RuleBlock } from '../modules/expedition/placeRules.ts';
import type { ReadTable, TableRow } from '../modules/expedition/tables.ts';
import { leadWords, noteLines, sectionFirstLine, type LeadLine, type PlaceBookText, type PlaceFacts as Facts, type PlaceSection } from '../modules/expedition/placeFacts.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { SkeletonRows } from '../ui/parts.tsx';
import { TableListItem, TableRows } from './EncounterTables.tsx';
import { RuleText } from '../ui/RuleText.tsx';
import type { HandRow } from '../modules/expedition/pieceNames.ts';
import { BookHandRow, type BookDetail } from './BookDetail.tsx';
import { ON_THEIR_ROWS } from './placeLinesAtHand.ts';
import './PlaceFacts.css';

/** One line with its bold lead-in ("Ruler. Warden Halewyn"); a plain line when it has none. */
export function LeadText({ line, className = 'place-facts__line' }: { line: LeadLine; className?: string }) {
  return (
    <p className={className}>
      {line.lead && <strong>{leadWords(line.lead)}</strong>}
      {line.lead && line.text ? ' ' : ''}
      {line.text}
    </p>
  );
}

/** The identity line, under the place's name in the card's head (frame 1b). */
export function PlaceIdentity({ identity }: { identity: string }) {
  return identity ? <p className="place-facts__identity">{identity}</p> : null;
}

/** The facts as bold lead-ins, in the pack's order. */
export function PlaceFactLines({ facts }: { facts: Facts }) {
  if (facts.facts.length === 0) return null;
  return (
    <div className="place-facts__facts" role="group" aria-label="Facts">
      {facts.facts.map((line, i) => (
        <LeadText key={`${i}:${line.lead}`} line={line} />
      ))}
    </div>
  );
}

/**
 * The rest of what the pack gives: About the town (headed prose, folded; one heading alone stays open), the tables
 * (each opens full screen; `tables` null while they load), the watch's box. `town` names the section for a settlement.
 */
export function PlaceFactsBody({
  facts,
  town,
  tables,
  watchFightsAs,
  onOpenTable,
}: {
  facts: Facts;
  town: boolean;
  tables: ReadonlyMap<string, ReadTable> | null;
  /** The watch's stat block's name, '' when unknown (the id is never shown). */
  watchFightsAs: string;
  onOpenTable: (table: ReadTable) => void;
}) {
  const found = tables ? facts.tableIds.flatMap((id) => (tables.get(id) ? [tables.get(id)!] : [])) : [];
  return (
    <>
      {facts.sections.length > 0 && (
        <div className="place-facts__about">
          <h4 className="label">{town ? 'About the town' : 'About the place'}</h4>
          {facts.sections.map((s, i) => (
            <SectionFold key={`${i}:${s.heading}`} section={s} open={facts.sections.length === 1} />
          ))}
        </div>
      )}
      {facts.tableIds.length > 0 && (
        <div className="place-facts__tables">
          <h4 className="label">Tables</h4>
          {tables === null ? (
            <SkeletonRows rows={Math.min(3, facts.tableIds.length)} label="Loading the tables" />
          ) : found.length === 0 ? (
            <p className="place-card__hint">The tables it names aren't in your packs.</p>
          ) : (
            <div className="table-list">
              {found.map((t) => (
                <TableListItem key={t.id} table={t} tag={t.die ?? ''} onOpen={() => onOpenTable(t)} />
              ))}
            </div>
          )}
        </div>
      )}
      {facts.watch && (
        <div className="place-facts__watch" role="group" aria-label="The watch">
          <h4 className="place-facts__watch-title">The watch</h4>
          {facts.watch.text && <p className="place-facts__line">{facts.watch.text}</p>}
          {facts.watch.leads.map((line, i) => (
            <LeadText key={`${i}:${line.lead}`} line={line} />
          ))}
          {watchFightsAs && <LeadText line={{ lead: 'In a fight', text: watchFightsAs }} />}
        </div>
      )}
    </>
  );
}

/**
 * One headed section of the GM's prose, folded under its heading (`open` to start open; a tap opens and closes it, and
 * opening one never closes another). `firstLine`: while folded, the book's own first line shows under the heading
 * (mc-40, the Knowledge sheet). A section the pack sets out in blocks (pf-18, pf-18b) is drawn by the shared rule-text
 * part, plain text as its paragraphs through the same part; an empty one opens to nothing, one the app can't read says so
 * (sectionWords). A section with no heading is its text alone.
 */
export function SectionFold({ section, open, firstLine = false, note = null }: { section: PlaceSection; open: boolean; firstLine?: boolean; note?: string | null }) {
  const body = sectionWords(section);
  // `note`: one quiet line under the heading and its first line, folded or open (the Knowledge sheet's "Shared with the
  // players, turn 9.", frame 7b).
  const noteLine = note && <span className="place-facts__first place-facts__note">{note}</span>;
  if (!section.heading)
    return (
      <div>
        {body}
        {noteLine}
      </div>
    );
  const first = firstLine ? sectionFirstLine(section.text) : '';
  return (
    <details className="place-facts__fold" open={open}>
      <summary className="place-card__summary">
        <span className="place-card__chevron" aria-hidden="true">
          ›
        </span>
        <span className="place-card__summary-words">
          {firstLine ? <span className="place-facts__fold-heading">{section.heading}</span> : section.heading}
          {first && <span className="place-facts__first">{first}</span>}
          {noteLine}
        </span>
      </summary>
      {body}
    </details>
  );
}

/**
 * What an opened section holds (pf-18b; page 22, approved 2026-11-18; Francis's three fixes, 2026-11-18): its blocks in
 * the book's look; a plain string's paragraphs through the same part, so they keep its gap between paragraphs; nothing
 * for an empty section (no words, no `text`); one muted line only for a section the app can't read (pick 1, as a place
 * rule with no words).
 */
/** A section's words, opened (the players' shared section, P4, draws them by the same rule as the GM's sheet). */
export function SectionWords({ section }: { section: PlaceSection }) {
  return sectionWords(section);
}

function sectionWords(section: PlaceSection) {
  if (section.blocks === null) return section.text ? <RuleText blocks={plainBlocks(section.text)} /> : null;
  if (section.blocks.length > 0) return <RuleText blocks={section.blocks} />;
  return <p className="auth__meta">The pack gives no words for this section.</p>;
}

/** Plain prose as paragraphs, one at each line end, for RuleText. */
const plainBlocks = (value: string): RuleBlock[] =>
  value
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ kind: 'p', lead: '', text }));

const BOOK_TEXT_HEADING = 'From the book, for the GM';

/**
 * The book's own text for the GM about a place (gt-1; mockup december/15 BT1, home B): one row under the place's
 * description, "From the book, for the GM", folded to the book's first line, with the chevron at the right (down
 * folded, up open); no crossed eye (Francis, F17, 2026-11-25: the heading's own words say whose it is); a tap opens the
 * whole text in place, drawn by the shared rule-text part (its lists and boxed asides, nothing trimmed, mc-34; F18:
 * the section stays whole), and folds it again. Starts folded on every place.
 */
export function BookTextFold({ text, atHand = null }: { text: PlaceBookText | null; atHand?: FoldRows | null }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const statLines = atHand?.statLines ?? [];
  const items = atHand?.items ?? [];
  return (
    <div className="book-text">
      <button type="button" className="book-text__row" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="book-text__words">
          <span className="book-text__heading">{BOOK_TEXT_HEADING}</span>
          {!open && text?.firstLine && <span className="book-text__first">{text.firstLine}</span>}
        </span>
        <span className={`book-text__chevron${open ? ' book-text__chevron--open' : ''}`} aria-hidden="true">
          <Icon name="chevron" size={20} />
        </span>
      </button>
      {open && (
        <section id={id} className="book-text__body" aria-label={BOOK_TEXT_HEADING}>
          {text && <RuleText blocks={text.blocks} />}
          {/* sf-6b (spec scene-pack, piece B; DT1, DT2): the rows no piece carries, then the quiet line (sf-24). */}
          <FoldGroup heading={statLines.length === 1 ? 'Stat line' : 'Stat lines'} rows={statLines} />
          <FoldGroup heading="Items" rows={items} />
          {atHand?.onPieces && <p className="book-text__quiet">{ON_THEIR_ROWS}</p>}
        </section>
      )}
    </div>
  );
}

/** The rows piece A leaves for the fold (sf-6b), and whether pieces carry lines (the quiet line). */
export interface FoldRows {
  statLines: readonly HandRow<BookDetail>[];
  items: readonly HandRow<BookDetail>[];
  onPieces: boolean;
}

/** One group of the fold's rows under its heading, in the book's heading look; nothing when it has none. */
function FoldGroup({ heading, rows }: { heading: string; rows: readonly HandRow<BookDetail>[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      <h4 className="rule-text__heading">{heading}</h4>
      <ul className="book-detail__list" aria-label={heading}>
        {rows.map((row, i) => (
          <li key={i}>
            <BookHandRow row={row} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** The GM's notes read with their lead-ins (frame 10); nothing when they're empty. */
export function NoteLines({ notes }: { notes: string }) {
  const lines = noteLines(notes);
  if (lines.length === 0) return null;
  return (
    <div className="place-facts__notes">
      {lines.map((line, i) => (
        <LeadText key={i} line={line} />
      ))}
    </div>
  );
}

/** A table opened from the place, full screen, for reading (nothing is recorded): its rows, each row's note. */
export function PlaceTable({ table, onClose }: { table: ReadTable; onClose: () => void }) {
  const [lit, setLit] = useState<number | null>(null);
  return (
    <Dialog full label={table.name} meta={table.die ? `Roll ${table.die}` : undefined} onClose={onClose}>
      <TableRows table={table} trail={[table.name]} column={null} lit={lit} describe={(row: TableRow) => row.note} leadsTo={() => null} onTap={(tap) => setLit(table.rows.indexOf(tap.row))} />
    </Dialog>
  );
}
