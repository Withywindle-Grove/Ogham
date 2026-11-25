// A small popup card over the screen (the charges prompt, Recharge). Escape, Cancel or a tap outside it (on the dimmed
// page) closes it, and Tab stays inside it. Focus moves into it on open, for screen readers, but never into a text
// field: that would open the keyboard (ruled 2026-11-01, M5 gate A4, replacing 2026-10-24's "popups open at their
// first field"). So focus goes to its first control when that's a button or a switch, and to the card itself when it's
// a field; a field takes focus on a tap. It opens on the page itself (a portal into the body), so a column that
// scrolls on its own (the Player screen in landscape) never clips or covers it (M5 gate fix).
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from './parts.tsx';
import './Dialog.css';
import './bookFaces.css';

const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

/** Input types that don't open a keyboard (everything else typed into does). */
const NO_KEYBOARD = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden']);

/** Whether focusing this element would open the on-screen keyboard: a text field, a text area, something editable. */
export function opensKeyboard(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NO_KEYBOARD.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * The Sheet (final drafts A7, 2026-11-07: "pop-up" means this): inside a scope that asks for it (character creation,
 * `CreationLeave`), every Dialog that isn't Full screen is a sheet. On a phone (under 700 px) it slides over the
 * dimmed page from the bottom, the full width; on a tablet it opens beside the button that opened it (below it, else
 * above, kept on screen), the page still dimmed. ✕, Escape or a tap outside closes it, as every pop-up does. The rest
 * of the app keeps the centred card for now (A's scope: creation only).
 */
export const SheetScope = createContext(false);

/**
 * The book's type (dec-10 S2; cs-1, ts-2): inside a scope that asks for it (character creation, `BookType` in
 * creation.tsx), a pop-up is drawn in the book's faces too, by the `book-type` class on what it places on the page.
 */
export const BookTypeScope = createContext(false);

/**
 * The book's faces alone (po-3, the lead 2026-11-14; ts-1 to ts-3): Bitter for words and headings, Alegreya Sans SC
 * for small capitals, and nothing else. Unlike `BookTypeScope` it changes no part's behaviour (creation's row lines,
 * its fold chevron, the book format of entries stay creation's). A pop-up opened inside it takes the `book-faces`
 * class. The GM's place page (5b) is the first screen in it; the sweep moves the rest.
 */
export const BookFacesScope = createContext(false);

/**
 * The book's pop-ups (tfb-1, 2026-11-19; page M2, approved 2026-11-19): inside a scope that asks for it (the Player
 * tab), every pop-up takes the book's red heading (`book-heading`) and keeps its own buttons, the band of a pop-up you
 * act in (Hit points, Portrait, the Quiver, an item, a status, Notes, a blocked action). A pop-up you only read says
 * so with `reading` and ends with "Got it" too, inside the scope or out. The card carries `.dialog--book`.
 */
export const BookPopUpScope = createContext(false);

/**
 * Centred pop-ups (fb7-1 to fb7-6, 2026-11-20; page 31, approved 2026-11-20): inside a scope that asks for it (the
 * Player tab's two columns, set in PlayerScreen.tsx beside `BookPopUpScope`), every pop-up that is a card (not Full
 * screen, the drawer, Side, Picture or Table) opens in the middle of the screen on a tablet, either way up, and fits its
 * content between `--popup-width-min` and `--popup-width-max` (`.dialog--centred`). A Sheet in it is never placed beside
 * its button; under 700 px it still comes up from the bottom. A pop-up opened from inside another takes the scope too
 * (a portal keeps its context). The other screens keep "beside its button" until the app sweep (fb7-7, S-24).
 */
export const CentredPopUpScope = createContext(false);

/** Under this width a sheet comes up from the bottom; at it and over, it opens beside its button. */
export const SHEET_PHONE = 700;

// The last thing tapped: a sheet's anchor. iPad Safari doesn't focus a tapped button, so focus alone can't say which
// button opened it; the tap's target can.
let lastTapped: Element | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      lastTapped = target?.closest('button, [role="button"], a, summary') ?? target;
    },
    true,
  );
}

/** The element a new sheet opens beside: the button just tapped, else the one with focus (a keyboard), else none. */
function anchorNow(): Element | null {
  const focused = typeof document !== 'undefined' ? document.activeElement : null;
  const candidate = lastTapped?.isConnected ? lastTapped : focused && focused !== document.body ? focused : null;
  return candidate;
}

/**
 * The button that is opening a pop-up, for focus to go back to when it closes: the one with focus (a keyboard, or a tap
 * where a tap focuses), else the one just tapped (Safari doesn't focus a tapped button), else none.
 */
export function openerNow(): HTMLElement | null {
  const focused = typeof document !== 'undefined' ? document.activeElement : null;
  const candidate = focused && focused !== document.body ? focused : lastTapped?.isConnected ? lastTapped : null;
  return candidate instanceof HTMLElement ? candidate : null;
}

/**
 * Where a sheet sits on a tablet: below its anchor with a gap, else above it, else as low as fits; its left edge at
 * the anchor's, kept inside the screen's margins. Null (centred) without an anchor on screen. Pure, for the tests.
 */
export function sheetPlace(anchor: { top: number; bottom: number; left: number; width: number; height: number }, card: { width: number; height: number }, screen: { width: number; height: number }, gap = 8, margin = 16): { top: number; left: number } | null {
  if (anchor.width === 0 && anchor.height === 0) return null;
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - card.height;
  const top = below + card.height <= screen.height - margin ? below : above >= margin ? above : Math.max(margin, screen.height - margin - card.height);
  const left = Math.min(Math.max(anchor.left, margin), Math.max(margin, screen.width - margin - card.width));
  return { top, left };
}

/**
 * Keeps an open sheet on a tablet on screen without placing it again (fix-sheet-replacing-on-ipad): when its foot
 * would pass the screen's bottom margin it moves up just enough (never above the top margin); otherwise it stays
 * exactly where it is, the same object back, so nothing re-renders. It never moves down and never flips to the other
 * side of its button, so a change of its own size can't set off another: on an iPad the sheet jumped on every tap,
 * placed again from scratch each time its content or Safari's toolbar changed its height. Its left edge is kept inside
 * the side margins too, when the card's and the screen's widths are given (review of #666). Pure, for the tests.
 */
export function sheetKeepOnScreen<P extends { top: number; left: number }>(place: P, card: { height: number; width?: number }, screen: { height: number; width?: number }, margin = 16): P {
  const room = screen.height - margin - card.height;
  const top = place.top <= room ? place.top : Math.min(place.top, Math.max(margin, room));
  const left = card.width === undefined || screen.width === undefined ? place.left : Math.min(Math.max(place.left, margin), Math.max(margin, screen.width - margin - card.width));
  return top === place.top && left === place.left ? place : { ...place, top, left };
}

/**
 * The foot's one rule (ft-1, "buttons are right justified"): two or more buttons sit side by side at the right, in
 * code order; when they don't fit one row they stack, each at the right, in the same order. Measured in the row: any
 * button that starts below the first one's foot has wrapped, so the foot stacks (`.dialog__actions--stacked`). The
 * foot's width is the card's, never its buttons', so stacking can't change the answer and set off another measure.
 * A group of stacked buttons (stk-2, `StackedGroup`) is one row that never wraps, so it stacks when it is wider than
 * the foot; stacked, it is one column of buttons at the widest one's width.
 */
export function stackFeet(card: HTMLElement): void {
  for (const foot of card.querySelectorAll<HTMLElement>('.dialog__actions')) {
    foot.classList.remove('dialog__actions--stacked');
    const buttons = [...foot.children];
    const room = foot.getBoundingClientRect().width;
    const groupTooWide = room > 0 && buttons.some((b) => b.classList.contains('stacked-group') && b.children.length > 1 && b.getBoundingClientRect().width > room + 0.5);
    if (groupTooWide) {
      foot.classList.add('dialog__actions--stacked');
      continue;
    }
    if (buttons.length < 2) continue;
    const first = buttons[0]!.getBoundingClientRect();
    if (buttons.some((b) => b.getBoundingClientRect().top >= first.bottom - 0.5 && first.height > 0)) foot.classList.add('dialog__actions--stacked');
  }
}

/**
 * Keeps every foot in this card stacked only while its buttons don't fit one row (ft-1): on open, on a resize, when a
 * button comes or goes or its words change (a foot's buttons can change without the card changing size), and once
 * more when the webfonts have loaded (they change the buttons' widths).
 */
function useStackedFeet(card: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    let open = true;
    const run = () => {
      if (open) stackFeet(el);
    };
    run();
    const size = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    size?.observe(el);
    // Elements and words only, never attributes: the stacked class is ours, so the measure can't set itself off.
    const content = typeof MutationObserver !== 'undefined' ? new MutationObserver(run) : null;
    content?.observe(el, { subtree: true, childList: true, characterData: true });
    void (typeof document !== 'undefined' ? document.fonts?.ready.then(run) : undefined);
    return () => {
      open = false;
      size?.disconnect();
      content?.disconnect();
    };
  }, [card]);
}

/** Whether this pop-up is the newest one open (each opens into the body, so the last in the page is on top). */
function onTop(card: HTMLElement | null): boolean {
  const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return card !== null && open[open.length - 1] === card;
}

/**
 * A pop-up card with its title and Close (✕, top right; tf-8), or (`full`, variant "Full screen", M5b step g3) a whole screen over the page with a bar: the title,
 * an optional quiet `meta` line, and the same Close ✕ at the right (it closes, like Escape; ruled B 2026-11-03, tf-8's
 * scope check). A full screen that is a step inside something (a table opened from a list) also has Back ‹ at the left
 * (`onBack`): that goes back a step; the ✕ closes the whole thing. Variant "Wide" (`wide`, M5b step g6, B6): a wider
 * centred card on a tablet and the whole screen on a phone (the + Status pop-up).
 */
export function Dialog({
  label,
  onClose,
  children,
  preview = false,
  noClose = false,
  full = false,
  wide = false,
  meta,
  onBack,
  drawer = false,
  side = false,
  table = false,
  headAction,
  bookHeading = false,
  picture = false,
  over,
  figure,
  reading = false,
  readingAction,
  plainTitle = false,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  preview?: boolean;
  /**
   * No ✕ (cs-27: a pop-up has an X or buttons, never both): a two-answer dialog whose buttons are the ways out
   * ("Pick a patron first", "Start over?"). Escape and a tap on the dimmed page still close it.
   */
  noClose?: boolean;
  full?: boolean;
  wide?: boolean;
  meta?: string;
  /**
   * A step back inside it (Back ‹ at the left of the bar or the head): full screen, or a sheet opened from a list in
   * another sheet (Roll for a name's tables, R3-1); without it only the ✕.
   */
  onBack?: () => void;
  /**
   * Variant "Drawer" (the phone's navigation, final drafts A11, slice E): the whole height at the left, over the dimmed
   * page; the title and ✕ at its top. A tap outside, ✕ or Escape closes it, as every pop-up does.
   */
  drawer?: boolean;
  /**
   * Variant "Side" (plan dec-9 piece B, ds-6a; pictures december/08-01 to 08-03): the drawer's twin at the right, the
   * whole height over the dimmed page on a tablet, the whole screen on a phone; its head and ✕ stay in view while what
   * is under them scrolls in its own body (`.dialog__side-body`; content that fills it may scroll a part of itself, as
   * "About this app" does). Notes reuse it. A tap outside, ✕ or Escape closes it.
   */
  side?: boolean;
  /**
   * Variant "Table" (T4, retest 4): a table sheet (a describing table, names, a kit's rolls) takes the screen's width
   * on a tablet, up to the page's; on a phone it is the sheet from the bottom.
   */
  table?: boolean;
  /** A button beside ✕ in the head (the drawer's gear, for the GM). */
  headAction?: ReactNode;
  /** The title as a book's heading (dec-10 S3, cs-4): an entry in the book format, inside creation's book type. */
  bookHeading?: boolean;
  /**
   * Variant "Picture" (dec-7 piece 5a, mc-43; mockup december/01 frames 2, M3 to M6): a picture shown whole, the
   * widest centred card (up to 1,120 px) and the screen's height, its body filling what the head leaves; the whole
   * screen on a phone. The map pop-up (`MapPopup`).
   */
  picture?: boolean;
  /** A small line over the title, saying whose it is ("Reedmouth" over "The map"; mockup december/01, M3). */
  over?: string;
  /**
   * Variant "Figure head" (plan dec-player-figure-sheet, the lead's ruling on ⚑ 2; mockup december/14 frames P7, P7b):
   * a figure's sheet (a save, a score, armour class, attack) carries its number large at the right of the head, level
   * with the title, before ✕. The title wraps; the number never breaks. Only the figure sheets pass it.
   */
  figure?: ReactNode;
  /**
   * Variant "Book, to read" (tfb-1, tfb-2, 2026-11-19; page M2 frames M2c to M2g): a pop-up you only read (a figure
   * explained, the Abilities and Traits lists). The book's red heading, and at its foot "Got it" at the right, a plain
   * button that closes it (tfb-2's exception to mc-43a and cs-27: the ✕ stays too). Wherever it opens.
   */
  reading?: boolean;
  /**
   * A plain button before "Got it" in a reading pop-up's foot (G-208, ex-6; mockup december/29 X6: the GM's Move points
   * on a skill's sheet). Only with `reading`.
   */
  readingAction?: ReactNode;
  /**
   * Variant "Plain title" (page 32, M3f, M3f2, M3j; audit fix 4, 2026-11-24): the title in ink and sentence case at the
   * Sheet's title size, as M3f draws it, never the book's red heading, even with `reading` or inside `BookPopUpScope`.
   * The GM's player-only pop-ups ("Only Sam can …", `BlockedSheet`'s "To read").
   */
  plainTitle?: boolean;
}) {
  const head = figure !== undefined && figure !== null && figure !== '' ? <span className="dialog__figure">{figure}</span> : null;
  const card = useRef<HTMLDivElement>(null);
  useStackedFeet(card);
  const sheet = useContext(SheetScope) && !full && !preview && !drawer && !picture && !side;
  // Centred on the Player tab (fb7-1): no anchor, so a Sheet there is never placed beside its button. It reads the
  // centred scope alone, not `SheetScope`: every pop-up in the tab's columns is centred whatever its Sheet setting, which
  // is safe today because no `SheetScope.Provider value={false}` sits inside them, and a pop-up opened from a pop-up has
  // its own layout check (player-popups-centred.spec.ts). Wide keeps its own 720 px (and the phone's whole screen), so
  // it is never fitted to its content.
  const centred = useContext(CentredPopUpScope) && !full && !preview && !drawer && !picture && !side && !table && !wide;
  const anchored = sheet && !centred;
  const faces = useContext(BookFacesScope);
  const book = useContext(BookTypeScope) ? ' book-type' : faces ? ' book-faces' : '';
  // The book's pop-ups (tfb-1): the red heading on a card (never the navigation drawer or a full screen's bar), and
  // "Got it" at the foot of one to read (tfb-2).
  const bookPopUp = (useContext(BookPopUpScope) || reading) && !full && !drawer;
  const titled = (bookHeading || bookPopUp) && !plainTitle;
  const bookCard = bookPopUp ? ' dialog--book' : '';
  // The sheet's anchor, read once as it opens (before focus moves into it).
  const [anchor] = useState(() => (anchored ? anchorNow() : null));
  // `top` and `left` where it sits; `capTop` where it opened, which caps its height (`--sheet-top`, T2) and never
  // changes while it's open, so a move can't change its height and set off another move.
  const [place, setPlace] = useState<{ top: number; left: number; capTop: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchored) return;
    // The place last applied: placed once, beside its button as it opens; after that only kept on screen. `placedWidth`
    // is the screen's width it was placed at: turned (an iPad from sideways to upright), it is placed again, once.
    let placed: { top: number; left: number; capTop: number } | null = null;
    let placedWidth = 0;
    const measure = () => {
      if (!card.current) return;
      // On a phone it comes up from the bottom; turned back to a tablet it opens beside its button again, once.
      if (window.innerWidth < SHEET_PHONE) {
        placed = null;
        return setPlace(null);
      }
      const screenSize = { width: window.innerWidth, height: window.innerHeight };
      const c = card.current.getBoundingClientRect();
      if (!placed || screenSize.width !== placedWidth) {
        placedWidth = screenSize.width;
        if (!anchor?.isConnected) {
          placed = null;
          return setPlace(null);
        }
        // Placed again after a turn, it is placed from its whole height (its content's), not the height its old cap
        // (`--sheet-top`, still the old place's) had cut it down to: else a short sheet opened low and turned stayed
        // a sliver (second review of #666).
        const size = placed ? { width: c.width, height: Math.max(c.height, card.current.scrollHeight) } : c;
        const at = sheetPlace(anchor.getBoundingClientRect(), size, screenSize);
        placed = at && { ...at, capTop: at.top };
        return setPlace(placed);
      }
      // Its content or the screen changed (T2, retest 4: a roll tapped adds lines, and the foot went under the bottom
      // of an iPad's screen): up just enough to stay on screen, never placed again from its button (that made it jump
      // between below and above on every tap, fix-sheet-replacing-on-ipad); only a turn of the screen places it again.
      const next = sheetKeepOnScreen(placed, c, screenSize);
      if (next === placed) return;
      placed = next;
      setPlace(next);
    };
    measure();
    window.addEventListener('resize', measure);
    const watch = typeof ResizeObserver !== 'undefined' && card.current ? new ResizeObserver(measure) : null;
    if (watch && card.current) watch.observe(card.current);
    return () => {
      window.removeEventListener('resize', measure);
      watch?.disconnect();
    };
  }, [anchored, anchor]);
  // The latest onClose, so a re-render doesn't run the opening effect again.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  // Whether the tap now under way began on the dimmed page (fix-tap-through).
  const downOutside = useRef(false);
  const gotIt = reading && !full && !drawer ? <GotItFoot onClose={() => close.current()} action={readingAction} /> : null;

  useEffect(() => {
    if (preview) return;
    // The first control, past the ✕ (tf-8): Close sits first, at the top right, but focus starts on the content.
    const first = [...(card.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find((el) => !el.hasAttribute('data-close')) ?? null;
    (first && !opensKeyboard(first) ? first : card.current)?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      // A pop-up opened from inside another (Where now? from the location view's sheet) takes the keys: Escape closes
      // the top one only, and Tab stays in it.
      if (!onTop(card.current)) return;
      if (event.key === 'Escape') close.current();
      else if (event.key === 'Tab' && card.current) {
        const stops = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
        if (stops.length === 0) return;
        const at = document.activeElement;
        // From the card itself (a pop-up that opened on a field), Shift+Tab goes round to the last stop.
        if (event.shiftKey && (at === stops[0] || at === card.current)) {
          event.preventDefault();
          stops[stops.length - 1]!.focus();
        } else if (!event.shiftKey && at === stops[stops.length - 1]) {
          event.preventDefault();
          stops[0]!.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  // The "preview" variant (the component gallery): the open card in place, without the dimmed page or the focus trap.
  if (preview) {
    return (
      <div ref={card} className={`dialog dialog--preview${drawer ? ' dialog--drawer' : ''}${side ? ' dialog--side' : ''}${table ? ' dialog--table' : ''}${picture ? ' dialog--picture' : ''}${bookCard}${book}`} role="group" aria-label={`${label} (preview)`}>
        <div className={`dialog__head${head ? ' dialog__head--figure' : ''}`}>
          <Title label={label} over={over} bookHeading={titled} plain={plainTitle} />
          {head}
          {headAction}
          {!noClose && <CloseButton onClose={onClose} />}
        </div>
        {side ? (
          <div className="dialog__side-body">
            {children}
            {gotIt}
          </div>
        ) : (
          <>
            {children}
            {gotIt}
          </>
        )}
      </div>
    );
  }

  if (full) {
    return createPortal(
      <div className={`dialog__backdrop dialog__backdrop--full${book}`}>
        <div ref={card} className="dialog dialog--full" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
          <div className="dialog__bar">
            {onBack && (
              <button type="button" className="dialog__back" aria-label="Back" onClick={onBack}>
                <span aria-hidden="true">‹</span>
              </button>
            )}
            <h2 className="dialog__title dialog__title--bar">{label}</h2>
            {meta && <span className="dialog__meta">{meta}</span>}
            <CloseButton onClose={() => close.current()} />
          </div>
          <div className="dialog__body">{children}</div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    // A tap on the dimmed page closes it, never one that started inside the card (selecting text, a drag). It only
    // closes (06 rule 12, fix-tap-through): a finger's or a pen's tap closes it on its click, so the dimmed page is still
    // there to take that click and the tap never also lands on what lies under it; a mouse closes it on the press, as
    // before (its click doesn't fall through).
    <div
      className={`dialog__backdrop${wide || picture ? ' dialog__backdrop--wide' : ''}${sheet ? ' dialog__backdrop--sheet' : ''}${drawer ? ' dialog__backdrop--drawer' : ''}${side ? ' dialog__backdrop--side' : ''}${book}`}
      onPointerDown={(event) => {
        const outside = event.target === event.currentTarget;
        const finger = event.pointerType === 'touch' || event.pointerType === 'pen';
        downOutside.current = outside && finger;
        if (outside && !finger) close.current();
      }}
      onPointerCancel={() => {
        downOutside.current = false;
      }}
      onClick={(event) => {
        if (downOutside.current && event.target === event.currentTarget) close.current();
        downOutside.current = false;
      }}
    >
      <div
        ref={card}
        className={`dialog${wide ? ' dialog--wide' : ''}${picture ? ' dialog--picture' : ''}${table ? ' dialog--table' : ''}${sheet ? ' dialog--sheet' : ''}${centred ? ' dialog--centred' : ''}${place ? ' dialog--anchored' : ''}${drawer ? ' dialog--drawer' : ''}${side ? ' dialog--side' : ''}${bookCard}`}
        style={place ? ({ top: place.top, left: place.left, '--sheet-top': `${place.capTop}px` } as CSSProperties) : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={over ? `${over}: ${label}` : label}
        tabIndex={-1}
      >
        <div className={`dialog__head${head ? ' dialog__head--figure' : ''}`}>
          {onBack && (
            <button type="button" className="dialog__back" aria-label="Back" onClick={onBack}>
              <span aria-hidden="true">‹</span>
            </button>
          )}
          <Title label={label} over={over} bookHeading={titled} plain={plainTitle} />
          {head}
          {headAction}
          {!noClose && <CloseButton onClose={() => close.current()} />}
        </div>
        {side ? (
          <div className="dialog__side-body">
            {children}
            {gotIt}
          </div>
        ) : (
          <>
            {children}
            {gotIt}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * A reading pop-up's foot (tfb-2, 2026-11-19; page M2: "Got it" is the plain button, approved 2026-11-19): "Got it" at
 * the right over the foot's rule, as an entry from the book ends today. It closes the pop-up, as ✕ does.
 */
export function GotItFoot({ onClose, action }: { onClose: () => void; /** A plain button before Got it (the GM's Move points). */ action?: ReactNode }) {
  return (
    <div className="dialog__actions dialog__got-it">
      {action}
      <button type="button" className="button-secondary" onClick={onClose}>
        Got it
      </button>
    </div>
  );
}

/** The head's title; with `over`, the small line over it (the picture pop-up's place name), read as one heading. */
function Title({ label, over, bookHeading, plain = false }: { label: string; over?: string; bookHeading: boolean; plain?: boolean }) {
  const title = <h2 className={`dialog__title${bookHeading ? ' book-heading' : ''}${plain ? ' dialog__title--plain' : ''}`}>{label}</h2>;
  if (!over) return title;
  return (
    <div className="dialog__titles">
      <p className="dialog__over">{over}</p>
      {title}
    </div>
  );
}
