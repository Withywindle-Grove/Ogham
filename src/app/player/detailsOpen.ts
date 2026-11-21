// Whether Details was left open on the Player tab, for each character, on this device (euf-1, ruled 2026-11-19: "B:
// heading, remembered"), in the shape of the folded menu's setting (`src/ui/navCollapsed.ts`). Device state only: not a
// command, not an event, never sent anywhere. Folded is the default: the device keeps the ids of the characters whose
// Details was left open, and a character not kept (or no id, or storage missing, blocked or holding something else)
// starts folded.
import { useState } from 'react';

const STORAGE_KEY = 'grimoire.detailsOpen';

function openIds(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function getDetailsOpen(characterId: string | null | undefined): boolean {
  return characterId ? openIds().includes(characterId) : false;
}

export function setDetailsOpen(characterId: string | null | undefined, open: boolean) {
  if (!characterId) return;
  try {
    const others = openIds().filter((id) => id !== characterId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(open ? [...others, characterId] : others));
  } catch {
    // Not remembered on this device; it still opens or folds until the tab is left.
  }
}

/** Details' fold for this character and its setter (which also remembers it on this device). */
export function useDetailsOpen(characterId: string | null | undefined): [boolean, (open: boolean) => void] {
  const [state, setState] = useState(() => ({ id: characterId, open: getDetailsOpen(characterId) }));
  // Another character in the same place reads its own (the state is per character, not per screen).
  const open = state.id === characterId ? state.open : getDetailsOpen(characterId);
  return [
    open,
    (next: boolean) => {
      setDetailsOpen(characterId, next);
      setState({ id: characterId, open: next });
    },
  ];
}
