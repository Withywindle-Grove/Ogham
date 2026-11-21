// What's open on the Pack (ruled 2026-10-28, N19, replacing 2026-10-26): "Worn and in hand" is always open. The
// groups that fold (Gear in armour mode, the Party stash below a character's pack) start collapsed when the character
// has something At hand; with nothing At hand, Gear starts open (the useful group first). The items waiting for the
// GM no longer fold: they are a card that opens a sheet (plan m5b-players-screens-standard C). Once someone opens or closes a group, this device remembers how it was left, and that wins. Storage can
// be blocked (private browsing); then they start as above each time.
import { useState } from 'react';

const STORAGE_KEY = 'grimoire.packOpen';

/** The Tiny things section (SC-5-2) always starts collapsed (05: "its own collapsed section"), then is remembered. */
export type Foldable = 'gear' | 'stash' | 'waiting' | 'tiny' | 'derived';
// 'derived': Derived fields on Who they are start folded on every width, then are remembered (cw-7).

function read(): Partial<Record<Foldable, boolean>> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    return saved && typeof saved === 'object' ? (saved as Partial<Record<Foldable, boolean>>) : {};
  } catch {
    return {};
  }
}

/** How the group was left on this device, or undefined when nobody has opened or closed it here. */
export function wasOpen(group: Foldable): boolean | undefined {
  const saved = read()[group];
  return typeof saved === 'boolean' ? saved : undefined;
}

export function rememberOpen(group: Foldable, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [group]: open }));
  } catch {
    // Not remembered; it starts as the rule says next time.
  }
}

/** How a folding group starts when this device hasn't been told (N19): only Gear opens, and only with nothing At hand. */
export function startsOpen(group: Foldable, somethingAtHand: boolean): boolean {
  return group === 'gear' && !somethingAtHand;
}

/** A folding group's remembered state (undefined until it's toggled on this device), and the way to change it. */
export function useFoldOpen(group: Foldable): [boolean | undefined, (open: boolean) => void] {
  const [open, setOpen] = useState(() => wasOpen(group));
  return [
    open,
    (next: boolean) => {
      setOpen(next);
      rememberOpen(group, next);
    },
  ];
}
