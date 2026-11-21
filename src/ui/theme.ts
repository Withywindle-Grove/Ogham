// Light/dark theme for this device. 'device' follows the operating system;
// 'light' and 'dark' are manual choices. Saved per device (docs/06).
// The choice is made under "This device" in the ⋯ menu.

export type ThemeChoice = 'device' | 'light' | 'dark';

const STORAGE_KEY = 'grimoire.theme';

export function getThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be blocked (private browsing); fall back to the device.
  }
  return 'device';
}

export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'device') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'device') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Not saved, but still applied for this visit.
  }
  applyThemeChoice(choice);
}

/** The theme actually showing right now, after following the device. */
export function effectiveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'device') return choice;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
