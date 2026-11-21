import { useState, type ReactNode } from 'react';
import { Dialog, SheetScope } from './Dialog.tsx';

/**
 * A blocked action's pop-up (06: never a disabled button; words, "Blocked action (pop-up)"): the button stays tappable
 * and a tap opens this Sheet, a short title, then why and the way forward. The sweep (plan m5b-players-screens-standard
 * E) made every once-disabled button use it. A title that is the whole reason (tfw-4: "Warden can't use Shortbow")
 * comes with an empty `why`, and the pop-up is its title alone.
 */
export function BlockedSheet({ title, why, onClose }: { title: string; why: string; onClose: () => void }) {
  return (
    <SheetScope.Provider value>
      <Dialog label={title} onClose={onClose}>
        {why ? <p className="blocked-sheet__why">{why}</p> : null}
      </Dialog>
    </SheetScope.Provider>
  );
}

/** A screen's blocked-action Sheet: `explain(title, why)` opens it; render `sheet` once in the screen. */
export function useBlockedSheet(): { sheet: ReactNode; explain: (title: string, why: string) => void } {
  const [open, setOpen] = useState<{ title: string; why: string } | null>(null);
  return {
    sheet: open ? <BlockedSheet title={open.title} why={open.why} onClose={() => setOpen(null)} /> : null,
    explain: (title, why) => setOpen({ title, why }),
  };
}
