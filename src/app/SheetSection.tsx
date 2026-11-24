// One section of the full character sheet (sr-7, sheet plan order 4; docs/06 "Sheet section"): its small-caps heading
// and what's in it. A section that folds is the inventory's **fold row**, `FoldedGroup` (06's Fold row; plan
// m5b-players-screens-standard D, Design on #558): its bold name across the row with the one-line summary under it,
// and the square at the right edge showing + while folded and − while open; a tap opens it in place and closes it. On a phone every folding
// section folds; beside the Player screen (a landscape tablet) the ones marked `foldWide` fold too, and the ones marked
// `row` are a row with a chevron that opens the section in a Sheet. This device remembers which sections were left
// open, by name, as the Pack tab remembers its folds (Design, 2026-11-05).
import { useState, type ReactNode } from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { FoldedGroup } from '../ui/creation.tsx';
import { Icon } from '../ui/icons.tsx';
import { InfoButton, ListRow, RowList } from '../ui/parts.tsx';
import { RuleHeading } from '../ui/RuleHeading.tsx';
import type { RollLine } from '../modules/library/rolls.ts';
import { usePhone } from './useWide.ts';

const STORAGE_KEY = 'grimoire.sheetOpen';

/** The sections left open on this device, by name (storage blocked: none, so all start folded). */
function openOnDevice(): Record<string, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function rememberOpen(label: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...openOnDevice(), [label]: open }));
  } catch {
    // Not remembered; it starts folded next time.
  }
}

export function SheetSection({
  label,
  summary = '',
  fold = false,
  foldWide = false,
  row = false,
  className,
  labelAction,
  labelLine = null,
  labelInfo,
  children,
}: {
  /** The heading, and what a screen reader calls the section. */
  label: string;
  /** The one line shown while folded: the section's figures or names, in short ("Speed 40, Exploring 120"). */
  summary?: string;
  /** Folds to its fold row on a phone (every section but Combat, Scores and Saves, whose tiles stay in view). */
  fold?: boolean;
  /** Folds on every width (the sheet beside the Player screen: Skills, Traits, Magic; plan D). */
  foldWide?: boolean;
  /** A row with a chevron that opens the section in a Sheet: the Player tab's rows, on a phone too (dec-13 C12; tfr-5). */
  row?: boolean;
  /** More classes on the section (the Pack load's own). */
  className?: string;
  /**
   * A name beside the heading, in the heading's style, that opens its entry (the Patron section: the patron's name;
   * Francis, 2026-11-12). `label` is what a screen reader hears. Only on a section that doesn't fold. The name is
   * plain, with a small ⓘ after it that says it opens (Francis chose this over an underline, 2026-11-12).
   */
  labelAction?: { text: string; label: string; onTap: () => void };
  /**
   * The rule line in the heading's own row (sv-3; `RuleHeading`): the Saves' and the Scores' d20 line, built from the
   * rules set's `rolls`; null for the heading alone. Only on a section that doesn't fold.
   */
  labelLine?: RollLine | null;
  /**
   * An ⓘ at the right of the heading's row, opening its explanation (the Player tab's "Abilities and traits": "Hold to
   * move", pg28-7, frame M4e). `label` is what it explains ("About <label>"). Only on a section that doesn't fold.
   */
  labelInfo?: { label: string; onOpen: () => void };
  children: ReactNode;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(() => openOnDevice()[label] === true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const folds = foldWide || (fold && phone);
  const heading = (
    <h2 className="sheet__label">
      {label}
      {labelAction && (
        <>
          {' '}
          <button type="button" className="sheet__label-tap" aria-label={labelAction.label} onClick={labelAction.onTap}>
            {labelAction.text}
            <Icon name="info" size={18} />
          </button>
        </>
      )}
    </h2>
  );
  if (row) {
    return (
      <section className={['sheet__section', 'sheet__block', className ?? ''].filter(Boolean).join(' ')} aria-label={label}>
        <RowList>
          <ListRow title={label} sub={summary || undefined} openLabel={summary ? `${label}, ${summary}` : label} onOpen={() => setSheetOpen(true)} />
        </RowList>
        {sheetOpen && (
          <Dialog label={label} onClose={() => setSheetOpen(false)} reading>
            {children}
          </Dialog>
        )}
      </section>
    );
  }
  return (
    <section className={['sheet__section', 'sheet__block', folds && !open ? 'sheet__section--folded' : '', className ?? ''].filter(Boolean).join(' ')} aria-label={label}>
      {folds ? (
        // The inventory's one fold row (06's Fold row; Design on #558): `FoldedGroup` itself, as the Pack uses it, its
        // label bold and its one-line summary under it while folded; this section only remembers how it was left.
        <FoldedGroup
          label={label}
          note={!open && summary ? summary : undefined}
          open={open}
          onToggle={(next) => {
            if (next === open) return;
            setOpen(next);
            rememberOpen(label, next);
          }}
        >
          {open && children}
        </FoldedGroup>
      ) : (
        <>
          {labelInfo ? (
            // The heading at the left and its ⓘ at the right of the row (pg28-7), as a rule line sits (`.rule-heading`).
            <div className="rule-heading">
              {heading}
              <InfoButton label={labelInfo.label} onOpen={labelInfo.onOpen} />
            </div>
          ) : (
            <RuleHeading line={labelLine} heading={heading} />
          )}
          {children}
        </>
      )}
    </section>
  );
}
