import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons.tsx';
import type { SetIconName } from './iconSet.ts';
import { Dialog, SheetScope } from './Dialog.tsx';
import { TextSizeToggle } from './TextSizeToggle.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import './MoreMenu.css';

// The ⋯ button and the small panel it opens. Closes on Escape, a tap outside, or choosing an action in it
// (a setting you switch, like the theme or text size, leaves it open).
export function MoreMenu({ label, startOpen = false, children }: { label: string; startOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
