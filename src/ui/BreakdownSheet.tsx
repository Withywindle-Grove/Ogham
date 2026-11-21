import type { ReactNode } from 'react';
import { Dialog, SheetScope } from './Dialog.tsx';
import { RollRow, type DieSize } from './dice.tsx';
import { Breakdown, SourceLine } from './parts.tsx';
import './BreakdownSheet.css';

/**
 * The breakdown sheet (plan m5b-players-screens-standard B; 06's Breakdown, as a Sheet variant): a tapped figure's
 * "where this number comes from" (M4b, sr-8, bq-2), the same piece for a score, a save, AC, attack and a skill. One
 * sheet, the rule shown at once (sv-2, sv-2a; plan dec-player-figure-sheet, mockup 14 frames P7 and P7b): the figure
 * (a roll's number in the head; a skill's top line, "Succeeds on a 5+," the glyph, "roll 1d6", tfs-1; none for a
 * figure that is not a roll, whose sentence says it, tfb-3); the roll's one line with its die (sv-1, a save's
 * own number in it); "Modifiers", what a score changes (sv-2a, sv-2b); the parts as `Breakdown` draws them (rows, or
 * worked-out lines; the to-hit row); anything the figure adds (AC's Clear); the rule's lines in the pack's words, with
 * no heading and no row that opens a second sheet; the source line at the foot. No new arithmetic: every part comes
 * from the caller, worked out where it always was. In the book's format, a pop-up to read: the red heading and "Got it"
 * at the foot (tfb-1, tfb-2, 2026-11-19; page M2 frames M2c to M2f), on the Player tab and the full sheet's page alike.
 */
export function BreakdownSheet({
  title,
  figure,
  figureHead = false,
  roll,
  modifiers,
  rows,
  lines,
  toHit,
  ending,
  empty,
  rule,
  source,
  children,
  onClose,
  preview = false,
  footAction,
}: {
  title: string;
  /**
   * The figure: a roll's number, or a skill's top line (tfs-1). None for a figure that is not a roll (Level, the
   * Experience bonus, a movement speed): its first line says it, so it is not repeated in bold (tfb-3, 2026-11-19).
   */
  figure?: ReactNode;
  /**
   * The figure large in the sheet's head, beside the title (the Dialog's "Figure head" variant; the lead's ruling on
   * ⚑ 2, mockup december/14 P7, P7b): a save, a score, armour class and attack. Off: the figure in bold under the head
   * (a skill's top line, its lead in bold).
   */
  figureHead?: boolean;
  /** The roll's one line (sv-1): its die's glyph and the words, built from the rules set's `rolls` (pf-20). None: no line. */
  roll?: { die: DieSize; words: string } | null;
  /** What changes the figure, one line each, under the heading "Modifiers" (sv-2a, sv-2b). None or empty: no heading. */
  modifiers?: readonly string[];
  rows?: { label: string; value: string }[];
  lines?: readonly string[];
  toHit?: { ac: number; roll: number }[] | null;
  ending?: string;
  empty?: string;
  /** The setting's words on how this works, one paragraph each, shown on the sheet itself (sv-2). None: nothing. */
  rule?: readonly string[];
  /** The pack it comes from ("From your setting: Fen sample"). */
  source?: string | null;
  /** Rows the figure adds after its parts (AC set by hand: Clear). */
  children?: ReactNode;
  onClose: () => void;
  /** The gallery's open card in place. */
  preview?: boolean;
  /** A plain button beside Got it (G-208, ex-6: the GM's Move points on a skill's sheet). */
  footAction?: ReactNode;
}) {
  const hasParts = (rows?.length ?? 0) > 0 || (lines?.length ?? 0) > 0 || (toHit?.length ?? 0) > 0 || !!ending || !!empty;
  return (
    <SheetScope.Provider value>
      <Dialog label={title} onClose={onClose} preview={preview} reading readingAction={footAction} {...(figureHead ? { figure } : {})}>
        <div className="breakdown-sheet">
          {!figureHead && figure !== undefined && figure !== null && figure !== '' && <p className="breakdown-sheet__figure">{figure}</p>}
          {roll && <RollRow die={roll.die}>{roll.words}</RollRow>}
          {modifiers && modifiers.length > 0 && (
            <section className="breakdown-sheet__modifiers" aria-label="Modifiers">
              <h3 className="breakdown-sheet__heading">Modifiers</h3>
              {modifiers.map((line, i) => (
                <p key={`${i}:${line}`} className="reading">
                  {line}
                </p>
              ))}
            </section>
          )}
          {hasParts && <Breakdown {...(rows ? { rows } : {})} {...(lines ? { lines } : {})} {...(toHit !== undefined ? { toHit } : {})} {...(ending ? { ending } : {})} {...(empty ? { empty } : {})} />}
          {children}
          {rule && rule.length > 0 && (
            <div className="breakdown-sheet__rule">
              {rule.map((line, i) => (
                <p key={`${i}:${line}`} className="reading">
                  {line}
                </p>
              ))}
            </div>
          )}
          {source && <SourceLine>From your setting: {source}</SourceLine>}
        </div>
      </Dialog>
    </SheetScope.Provider>
  );
}
