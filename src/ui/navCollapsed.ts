// The left-hand menu folded to icons on a landscape tablet (M5 gate B15, ruled 2026-11-01): the divider handle on its
// edge folds and opens it, remembered per device. Only the landscape tablet's left column folds; tabs at the top or
// bottom never do (the CSS applies the fold only there).
// Folded is the default (mn-1, Francis 2026-11-14: "I keep the icon rail collapsed generally, that should be the
// default mode"): the device keeps 'yes' for folded and 'no' for opened, and anyone who has not chosen (nothing kept)
// sees it folded. Browser storage may be missing or blocked: then the menu starts folded too.
import { useState } from 'react';

const STORAGE_KEY = 'grimoire.navCollapsed';

export function getNavCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'no';
  } catch {
    return true;
  }
}

export function setNavCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'yes' : 'no');
  } catch {
    // Not remembered on this device; the choice still applies until the page is left.
  }
}

/** The fold and its setter (which also remembers it on this device). */
export function useNavCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(getNavCollapsed);
  return [
    collapsed,
    (next: boolean) => {
      setNavCollapsed(next);
      setCollapsed(next);
    },
  ];
}
