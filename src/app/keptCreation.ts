// Picks kept on this device when a player leaves guided creation before Who they are (cw-13, Francis 2026-11-06): the
// method, the scores as typed, the kindred, the class and the trades, keyed by the signed-in player AND the campaign,
// so a shared device never shows one player's picks to another. Device-only: no command, no log, nothing leaves the
// device. Forgotten when the character reaches Who they are (the real draft takes over), on Start again, and on
// sign-out. Storage can be blocked (private browsing); then nothing is kept and Leave behaves as before.
import type { Trade } from '../modules/characters/creationSteps.ts';

const PREFIX = 'grimoire.creationKept.';

/** A pick kept by its id and the name it had, so a pick the packs no longer have can still be named. */
export interface KeptEntry {
  id: string;
  name: string;
}

export interface KeptPicks {
  /** The step the player left from (GuidedStep). */
  step: 'method' | 'scores' | 'race' | 'class' | 'patron' | 'adjust';
  method: string | null;
  /** The scores as typed, by ability key. */
  typed: Record<string, string>;
  race: KeptEntry | null;
  klass: KeptEntry | null;
  trades: Trade[];
  /** When it was kept (ISO), for Continue's "on Thursday" (final drafts F); older picks have none. */
  savedAt?: string;
  /** The scores the player has touched (final drafts A5); left out by an older version: all of them, as rolled. */
  touched?: string[];
  /** The patron picked on the Patron step (pt-10); left out by an older version: none. */
  patron?: KeptEntry | null;
  /** The patron put off with Decide later. */
  patronLater?: boolean;
}

const keyOf = (userId: string, campaignId: string) => `${PREFIX}${userId}.${campaignId}`;

const isEntry = (value: unknown): value is KeptEntry =>
  typeof value === 'object' && value !== null && typeof (value as KeptEntry).id === 'string' && typeof (value as KeptEntry).name === 'string';

/** The picks this player left in this campaign on this device, or null. */
export function readKept(userId: string, campaignId: string): KeptPicks | null {
  try {
    const raw = localStorage.getItem(keyOf(userId, campaignId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<KeptPicks> | null;
    if (!saved || typeof saved !== 'object' || typeof saved.typed !== 'object' || saved.typed === null) return null;
    const steps = ['method', 'scores', 'race', 'class', 'patron', 'adjust'] as const;
    return {
      step: steps.includes(saved.step as (typeof steps)[number]) ? (saved.step as KeptPicks['step']) : 'scores',
      method: typeof saved.method === 'string' ? saved.method : null,
      typed: Object.fromEntries(Object.entries(saved.typed).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
      race: isEntry(saved.race) ? saved.race : null,
      klass: isEntry(saved.klass) ? saved.klass : null,
      trades: Array.isArray(saved.trades) ? saved.trades.filter((t): t is Trade => !!t && (t.kind === 'lower' || t.kind === 'raise') && typeof t.key === 'string') : [],
      ...(typeof saved.savedAt === 'string' ? { savedAt: saved.savedAt } : {}),
      ...(Array.isArray(saved.touched) ? { touched: saved.touched.filter((k): k is string => typeof k === 'string') } : {}),
      ...(isEntry(saved.patron) ? { patron: saved.patron } : {}),
      ...(saved.patronLater === true ? { patronLater: true } : {}),
    };
  } catch {
    return null;
  }
}

/** Keeps the picks; false when the device won't store them. */
export function keepPicks(userId: string, campaignId: string, picks: KeptPicks): boolean {
  try {
    localStorage.setItem(keyOf(userId, campaignId), JSON.stringify({ ...picks, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function forgetKept(userId: string, campaignId: string): void {
  try {
    localStorage.removeItem(keyOf(userId, campaignId));
  } catch {
    // Nothing kept to forget.
  }
}

/** Sign-out: every player's kept picks on this device go. */
export function forgetAllKept(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * When the picks were kept, in words (final drafts F, mockup creation/final/08): "today", "yesterday", "on Thursday"
 * within the week, else "on 3 November"; '' when the time isn't known.
 */
export function keptWhen(savedAt: string | undefined, now: Date = new Date()): string {
  const at = savedAt ? new Date(savedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  const day = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  const ago = day(now) - day(at);
  if (ago <= 0) return 'today';
  if (ago === 1) return 'yesterday';
  if (ago < 7) return `on ${DAYS[at.getDay()]}`;
  return `on ${at.getDate()} ${at.toLocaleString('en-GB', { month: 'long' })}`;
}

/** "Scores · Stone kin · Reed Witch": what Continue brings back (mockup creation/13). */
export function keptWords(picks: KeptPicks, methodName?: string): string {
  return [methodName, Object.keys(picks.typed).length > 0 ? 'Scores' : undefined, picks.race?.name, picks.klass?.name, picks.patron?.name].filter(Boolean).join(', ');
}
