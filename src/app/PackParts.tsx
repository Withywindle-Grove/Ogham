// The Pack's small pieces on creation's standard (plan m5b-players-screens-standard C; mockup players/01), built once
// here so the Pack and the gallery draw the same thing: the card for the items waiting for the GM, the coin line,
// and the foot.
import { createContext, type ReactNode } from 'react';
import { BookType } from '../ui/creation.tsx';
import { Icon } from '../ui/icons.tsx';
import { BookToasts } from '../ui/ToastHost.tsx';
import { WarningLine } from '../ui/parts.tsx';
import { itemCount } from './packHelpers.ts';
import './PackScreen.css';

/**
 * The Pack tab's dress (K29; Francis, 2026-11-24; frames PK1 to PK13 of pack/08, approved 2026-11-14, and page 07's
 * PC1 to PC10, approved 2026-11-13): the book's type (`BookType`: the book's faces, here and in every pop-up opened from
 * the tab), and `.pack-dress` for the Pack's own sizes and gaps (PackScreen.css). Its pop-ups keep the app's plain title
 * (psw-4: an action's sheet, the coin's sheets, PC3, PK4b); a thing's own sheet takes its name as the entry's red
 * heading (PK8; `ItemSheet`). Its toasts take the book's faces (`BookToasts`, PK4b). It adds no box.
 * What is put beside the pack (the load and coin, Add item, the stash's room) is wrapped again where it is placed, since
 * a page's classes do not reach into another column.
 */
export function PackDress({ children }: { children: ReactNode }) {
  return (
    <PackDressScope.Provider value>
      <BookType>
        <BookToasts>
          <div className="pack-dress">{children}</div>
        </BookToasts>
      </BookType>
    </PackDressScope.Provider>
  );
}

/**
 * Inside the Pack's dress (K29's review, finding 1): `ItemSheet` reads it, so a thing's sheet opened from the Pack tab
 * (placed outside the tab's page) takes the frame's look (PK8: no grey panel, 16 px rows), while the same sheet on the
 * Player tab keeps its own (pq-1, as built).
 */
export const PackDressScope = createContext(false);

/**
 * The items waiting for the GM (ruled 2026-10-24: not in the pack, counting for nothing until approved): a card with
 * the warning sign and its words ("2 items waiting for the GM"), their names under it, and a chevron; it opens their
 * list as a sheet.
 */
export function WaitingCard({ names, onOpen }: { names: readonly string[]; onOpen: () => void }) {
  return (
    <button type="button" className="pack__waiting" aria-haspopup="dialog" onClick={onOpen}>
      <span className="pack__waiting-text">
        <WarningLine>{`${itemCount(names.length)} waiting for the GM`}</WarningLine>
        <span className="auth__meta">{names.join(', ')}</span>
      </span>
      <span className="pack__chevron" aria-hidden="true">
        <Icon name="chevron" size={20} />
      </span>
    </button>
  );
}

/**
 * The coin line (K9; pu-1, pu-6; mockup pack/07 PC1, PC2, PC10, approved 2026-11-13): the amounts in the setting's
 * own coin names, bold, then a chevron; "No coin" with none. No line under it (mc-46). The whole row opens the coin's
 * sheet. It sits under the load, between the double rules the groups use.
 */
export function CoinLine({ words, onOpen, isNew = false }: { words: string; onOpen: () => void; isNew?: boolean }) {
  return (
    <button type="button" className="pack__coin" aria-haspopup="dialog" aria-label={`Coin: ${words}${isNew ? ', new' : ''}`} onClick={onOpen}>
      <span className="pack__coin-words">
        {words}
        {isNew && <NewTag />}
      </span>
      <span className="pack__chevron" aria-hidden="true">
        <Icon name="chevron" size={20} />
      </span>
    </button>
  );
}

/**
 * The "New" tag (K20b; pk-5, p45-11; FD1, FD3, FD8b, approved 2026-11-26): the word in a box after a row's name and on
 * the coin line, until Got it. Not a target. The space before it does not break, so it stays with the name's last word.
 */
export function NewTag() {
  return (
    <>
      {' '}
      <span className="pack__new">New</span>
    </>
  );
}

/**
 * The Pack's "Party stash" row (K11; pk-4; mockup pack/08 PK1, PK6, PK7b, approved 2026-11-14): a leading icon (ic-2: a
 * row that opens a screen), the stash's name, what is in it under it ("7 things"; offline, "7 things, as last seen"),
 * and the chevron. The whole row opens the stash's own screen. It sits under the coin line.
 */
export function StashRow({ name, note, onOpen }: { name: string; note: string; onOpen: () => void }) {
  return (
    <button type="button" className="pack__stash-row" onClick={onOpen}>
      <span className="pack__stash-icon" aria-hidden="true">
        <Icon name="open-chest" size={24} />
      </span>
      <span className="pack__stash-words">
        <span className="pack__stash-name">{name}</span>
        <span className="auth__meta">{note}</span>
      </span>
      <span className="pack__chevron" aria-hidden="true">
        <Icon name="chevron" size={20} />
      </span>
    </button>
  );
}

/** The Pack's foot: the count ("20 items"), then Add item, the screen's one accent button (none for a viewer who can't add). */
export function PackFoot({ count, onAdd }: { count: number; onAdd: (() => void) | null }) {
  return (
    <div className="pack__foot">
      <span className="auth__meta">{itemCount(count)}</span>
      {onAdd && (
        <button type="button" className="button-primary pack__add" onClick={onAdd}>
          Add item
        </button>
      )}
    </div>
  );
}
