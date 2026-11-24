import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons.tsx';
import type { SetIconName } from './iconSet.ts';
import { Dialog, SheetScope } from './Dialog.tsx';
import { TextSizeToggle } from './TextSizeToggle.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import './MoreMenu.css';

// The ⋯ button and the small panel it opens. Closes on Escape, a tap outside, or choosing an action in it
// (a setting you switch, like the theme or text size, leaves it open).
export function MoreMenu({
  label,
  startOpen = false,
  children,
  specimen = false,
}: {
  label: string;
  startOpen?: boolean;
  children: ReactNode;
  /** A gallery example only: a tap or click outside leaves it open and goes where it lands. */
  specimen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // A finger's or a pen's tap outside only closes it (06 rule 12, fix-more-menu-tap; as pop-ups, fix-tap-through): the
    // press is remembered and the same tap's click closes it, stopped before it reaches what lies under the finger. A
    // mouse closes it on the press, as before (its click goes where it lands). A press the browser cancels (a scroll) or
    // a key press forgets the remembered one; a click with no press of its own (a key) is let through.
    let downOutside = false;
    const onPointer = (event: PointerEvent) => {
      const outside = !root.current?.contains(event.target as Node);
      const finger = event.pointerType === 'touch' || event.pointerType === 'pen';
      downOutside = outside && finger;
      if (outside && !finger) setOpen(false);
    };
    const onCancel = () => {
      downOutside = false;
    };
    const onClick = (event: MouseEvent) => {
      if (!downOutside) return;
      downOutside = false;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      downOutside = false;
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // A gallery example (`specimen`) has no tap-outside handling: it stays shown open and the tap goes where it lands.
    if (!specimen) {
      document.addEventListener('pointerdown', onPointer);
      document.addEventListener('pointercancel', onCancel);
      document.addEventListener('click', onClick, true);
    }
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, specimen]);

  return (
    <div className="more-menu" ref={root}>
      <button
        ref={button}
        type="button"
        className="more-menu__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          id={panelId}
          className="more-menu__panel"
          onClick={(event) => {
            const chosen = (event.target as HTMLElement).closest('button');
            if (chosen && !chosen.hasAttribute('aria-pressed')) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * ⋯ as a Sheet (plan m5b-players-screens-standard A1; final draft 9's rule, pattern 13): the same button, opening a
 * Sheet named "More" over the dimmed page (from the bottom on a phone, beside the button on a tablet) instead of the
 * small panel. Its children are the screen's own options first, then (where the screen has no drawer) a divider and
 * the app's menu. Choosing an item closes it; a setting that stays on screen (a pressed button: theme, text size)
 * leaves it open, as the panel does.
 */
export function MoreSheet({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <button ref={button} type="button" className="more-menu__button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <SheetScope.Provider value>
          <Dialog label="More" onClose={close}>
            <div
              className="more-sheet"
              onClick={(event) => {
                const chosen = (event.target as HTMLElement).closest('button');
                if (chosen && !chosen.hasAttribute('aria-pressed') && chosen.closest('.more-menu__section--items')) setOpen(false);
              }}
            >
              {children}
            </div>
          </Dialog>
        </SheetScope.Provider>
      )}
    </>
  );
}

// One option in a ⋯ menu (ruled 2026-10-26): a symbol in the accent colour beside the words (never instead of
// them), in a 48 px row with no gap to the next.
/** One ⋯ item: its own icon (B11), its words, and optionally a line under them saying what it does (B7). */
export function MenuItem({
  icon,
  avatar,
  current = false,
  onClick,
  children,
  sub,
}: {
  /** The item's symbol; or, instead, `avatar`: a letter in a ring (a character in the phone's drawer, slice E). */
  icon?: IconName | SetIconName;
  avatar?: string;
  /** Where you are now (the drawer's active character): the Selected wash, and "current" for screen readers. */
  current?: boolean;
  onClick: () => void;
  children: ReactNode;
  sub?: string;
}) {
  const subId = useId();
  return (
    <button
      type="button"
      className={current ? 'more-menu__item more-menu__item--current' : 'more-menu__item'}
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      aria-describedby={sub ? subId : undefined}
    >
      {avatar !== undefined ? (
        <span className="more-menu__avatar" aria-hidden="true">
          {avatar}
        </span>
      ) : (
        <span className="more-menu__symbol">{icon && <Icon name={icon} />}</span>
      )}
      {sub ? (
        <span className="more-menu__words">
          <span>{children}</span>
          <span id={subId} className="more-menu__sub" aria-hidden="true">
            {sub}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** A group of MenuItems; the next group sits below a thin divider. */
export function MenuItems({ children }: { children: ReactNode }) {
  return <div className="more-menu__section more-menu__section--items">{children}</div>;
}

/** This device: the theme and text size, below a divider in every ⋯ menu. */
export function DeviceMenuSection() {
  return (
    <div className="more-menu__section">
      <p className="label">This device</p>
      <p className="auth__meta">Theme</p>
      <ThemeToggle />
      <p className="auth__meta">Text size</p>
      <TextSizeToggle />
    </div>
  );
}
