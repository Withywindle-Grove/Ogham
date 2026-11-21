// The Scene top's fold, remembered on the device (B12b; Francis 2026-11-19, "Yes, remember it"; d5-10, 2026-11-20).
// The first time on a device the top starts open, on a phone as on a tablet; after that it opens as the GM left it, when
// the GM leaves the Scene and comes back, starts another expedition or opens the app again. One memory for the device,
// not one for each campaign (as the rail's fold, `src/ui/navCollapsed.ts`, and the Pack's groups, `packOpen.ts`), and
// nothing is sent to the server. The device keeps 'open' or 'folded'; nothing kept reads open. Browser storage may be
// missing or blocked (private browsing): then the top starts open each time and still folds while the Scene is open.
// The GM's alone: the players' Scene has no fold, so nothing there reads this.
import { useState } from 'react';

const STORAGE_KEY = 'grimoire.sceneTopOpen';

/** Whether the top opens: as it was left on this device, else open. */
export function getSceneTopOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'folded';
  } catch {
    return true;
  }
}

export function setSceneTopOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? 'open' : 'folded');
  } catch {
    // Not remembered on this device; the fold still applies until the Scene is left.
  }
}

/** The top's fold and its setter (which also remembers it on this device). */
export function useSceneTopOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(getSceneTopOpen);
  return [
    open,
    (next: boolean) => {
      setSceneTopOpen(next);
      setOpen(next);
    },
  ];
}
