import { useState, type ReactNode } from 'react';
import { CentredPopUpScope, Dialog, SheetScope } from './Dialog.tsx';

/**
 * A blocked action's pop-up (06: never a disabled button; words, "Blocked action (pop-up)"): the button stays tappable
 * and a tap opens this Sheet, a short title, then why and the way forward. The sweep (plan m5b-players-screens-standard
 * E) made every once-disabled button use it. A title that is the whole reason (tfw-4: "Warden can't use Shortbow")
 * comes with an empty `why`, and the pop-up is its title alone.
 *
 * Variant "To read" (`reading`; the GM's player-only pop-ups, page 32, M3f, M3f2, M3j): "Got it" at its foot, last and
 * plain, with `action` (a plain button: "Go to Waiting for you", "Go to Waiting for approval") before it; its title is
 * `Dialog`'s "Plain title", in ink as M3f draws it (audit fix 4); centred on a tablet wherever it opens (fb7-1), the
 * sheet from the foot on a phone.
 */
export function BlockedSheet({ title, why, onClose, reading = false, action }: { title: string; why: string; onClose: () => void; reading?: boolean; action?: ReactNode }) {
  const dialog = (
    <SheetScope.Provider value>
      <Dialog label={title} onClose={onClose} reading={reading} plainTitle={reading} {...(reading && action ? { readingAction: action } : {})}>
        {why ? <p className="blocked-sheet__why">{why}</p> : null}
      </Dialog>
    </SheetScope.Provider>
  );
  return reading ? <CentredPopUpScope.Provider value>{dialog}</CentredPopUpScope.Provider> : dialog;
}

/** A screen's blocked-action Sheet: `explain(title, why)` opens it; render `sheet` once in the screen. */
export function useBlockedSheet(): { sheet: ReactNode; explain: (title: string, why: string) => void } {
  const [open, setOpen] = useState<{ title: string; why: string } | null>(null);
  return {
    sheet: open ? <BlockedSheet title={open.title} why={open.why} onClose={() => setOpen(null)} /> : null,
    explain: (title, why) => setOpen({ title, why }),
  };
}
