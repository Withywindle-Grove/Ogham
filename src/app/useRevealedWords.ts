// The revealed result on a player's Scene (sf-7b; page 44's EN5, approved 2026-11-26): the words the GM showed the
// players (A1's read, `revealed_words`: the reveal's id, the words and when, nothing of the check), read again whenever
// the live log moves (a show and a take-back each write a line players read, so a card comes and goes without
// reloading). "Got it" is remembered on this device only (sf-23, "On the device"): no table, no command, nothing sent.
// The device keeps the ids of the reveals put away; browser storage may be missing or blocked (private browsing), and
// then "Got it" still puts the card away until the Scene is left. A failed read keeps the last good one, and a read
// belongs to its campaign: another campaign's words are never shown.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Db } from '../core/supabase.ts';
import { loadRevealedWords, type RevealedWords } from '../modules/expedition/reminderPlay.ts';

const STORAGE_KEY = 'grimoire.revealsGotIt';
/** How many put-away reveals the device keeps (the newest); older ids are long taken back or answered. */
const KEEP = 200;

/** The reveals put away on this device ("Got it"), oldest first. Empty when storage is missing or unreadable. */
export function readRevealsGotIt(): string[] {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(kept) ? kept.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberGotIt(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readRevealsGotIt().filter((x) => x !== id), id].slice(-KEEP)));
  } catch {
    // Not remembered on this device; the card stays put away until the Scene is left.
  }
}

/** The words to show as cards (newest first; none for the GM or while loading) and "Got it". */
export function useRevealedWords(db: Db, campaignId: string, on: boolean, reloadKey: number): { cards: RevealedWords[]; gotIt: (id: string) => void } {
  const [read, setRead] = useState<{ campaignId: string; words: RevealedWords[] } | null>(null);
  const [put, setPut] = useState<ReadonlySet<string>>(() => new Set(readRevealsGotIt()));

  useEffect(() => {
    if (!on) return;
    let current = true;
    void loadRevealedWords(db, campaignId).then((words) => {
      if (current && words) setRead({ campaignId, words });
    });
    return () => {
      current = false;
    };
  }, [db, on, campaignId, reloadKey]);

  const cards = useMemo(() => (on && read?.campaignId === campaignId ? read.words.filter((w) => !put.has(w.id)) : []), [on, read, campaignId, put]);

  const gotIt = useCallback((id: string) => {
    rememberGotIt(id);
    setPut((was) => new Set(was).add(id));
  }, []);

  return { cards, gotIt };
}
