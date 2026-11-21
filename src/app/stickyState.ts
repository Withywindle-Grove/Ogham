// State that outlives the screen showing it, for this visit (M5 step 10; DG2): the GM's reminder card stays as it
// was when the GM goes from Scene to Players or a character's pack and back, so the compact time strip's Next turn
// and the full strip on Scene share one card. Kept in memory only, per key (a campaign's id in it), never saved; one
// store per app (StickyProvider in Root), so signing out or a fresh app starts empty.
import { createContext, createElement, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

const Store = createContext<Map<string, unknown> | null>(null);

/** One store for everything kept below it. */
export function StickyProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new Map<string, unknown>());
  return createElement(Store.Provider, { value: store }, children);
}

/** Like useState, but a later screen with the same key (under the same provider) starts from where the last one left it. */
export function useSticky<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(Store);
  const [value, setValue] = useState<T>(() => (store?.has(key) ? (store.get(key) as T) : initial));
  useEffect(() => {
    store?.set(key, value);
  }, [store, key, value]);
  return [value, setValue];
}
