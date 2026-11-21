// Where the destination list starts (B19, ruled 2026-10-25): the last place used for that kind of item, else the
// first place with room. Remembered per device and per action (Put it, Give), by the item's category. Storage can
// be blocked (private browsing); then it's always the first place with room.

const STORAGE_KEY = 'grimoire.lastPlace';

type Places = Record<string, string>;

function read(): Places {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    return saved && typeof saved === 'object' ? (saved as Places) : {};
  } catch {
    return {};
  }
}

const keyOf = (action: 'put' | 'give', category: string) => `${action}:${category || 'other'}`;

/** The place to start on: the last one used for this kind, if it's still offered and has room; else the first with room. */
export function startingPlace(action: 'put' | 'give', category: string, places: { id: string; blocked?: string }[]): string | null {
  const last = read()[keyOf(action, category)];
  const open = places.filter((p) => !p.blocked);
  return open.find((p) => p.id === last)?.id ?? open[0]?.id ?? null;
}

export function rememberPlace(action: 'put' | 'give', category: string, placeId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [keyOf(action, category)]: placeId }));
  } catch {
    // Not remembered; the list starts on the first place with room next time.
  }
}
