// The find card's words and shape (K18a of docs/plans/dec-6-the-whole-pack-tab.md; page 45, p45-5 to p45-8, p45-15,
// p45-22, p45-25; ⚑ F3 built to its lean; F8, ruled 2026-11-26: keep as drawn). Data and logic only: the card itself
// is K18b. It reads K20a's entries (`findsSince`); the words for coin and for a day come in from the caller, so no new
// link between modules.
import { findsCount, type FindEntry, type FindWho } from './findsSeen.ts';

/** ⚑ F3's lean: a find is "just now" for under an hour, read when the card is drawn (no ticking clock). */
export const JUST_NOW_MS = 60 * 60 * 1000;

export interface FindCardWords {
  /** Character id → name, for a gift's giver. */
  names: ReadonlyMap<string, string>;
  /** The setting's words for an amount of coin ("240 herons"). */
  coinWords: (coins: Record<string, number>) => string;
  /** K14's words for an older time ("today", "day 3"). */
  when: (at: string) => string;
  /** Now (ISO), when the card is drawn. */
  now: string;
}

/** A line: a find (its name in bold, then ", now N" in the plain weight, then the quiet line) or a quiet taken-back line. */
export type FindCardLine =
  | { kind: 'find'; name: string; now: string | null; quiet: string | null; entry: FindEntry }
  | { kind: 'back'; words: string; entry: FindEntry };

export interface FindCard {
  head: string;
  /** The giver and time every line shares, said once under the head (p45-7); else null. */
  once: string | null;
  lines: FindCardLine[];
  /** "and N more": 0 for none. */
  more: number;
}

const n = (x: number) => x.toLocaleString('en-GB');
const nameOf = (e: FindEntry, w: FindCardWords) =>
  e.kind === 'coin' ? w.coinWords(e.coins) : e.arrived > 1 || e.now !== null ? `${e.name} ×${n(e.arrived)}` : e.name;
const whenOf = (at: string, w: FindCardWords) => (Date.parse(w.now) - Date.parse(at) < JUST_NOW_MS ? 'just now' : w.when(at));
const giverOf = (who: FindWho, w: FindCardWords) => (who.kind === 'character' ? (w.names.get(who.characterId) ?? null) : null);

/** Who and when, as a sentence. Not drawn beyond the GM and one gift: "them" for several, "Given to you" with no name. */
function whoWords(who: FindWho, when: string, many: boolean, w: FindCardWords): string {
  if (who.kind === 'gm') return `From your GM, ${when}.`;
  const giver = giverOf(who, w);
  const it = many ? 'them' : 'it';
  return giver ? `${giver} gave ${it} to you, ${when}.` : `Given to you, ${when}.`;
}

/**
 * F8, ruled 2026-11-26 (keep as drawn; p45-25): "Your GM took back the Bronze ring."; coin takes no "the", nor a name that starts with "The".
 * A giver's own Undo names the giver; with no name to give, "Taken back: …" (neither drawn).
 */
function backWords(e: FindEntry, w: FindCardWords): string {
  const name = nameOf(e, w);
  const what = e.kind === 'coin' || /^the\s/i.test(name) ? name : `the ${name}`;
  const by = e.takenBack!.byGm ? 'Your GM' : giverOf(e.who, w);
  return by ? `${by} took back ${what}.` : `Taken back: ${what}.`;
}

/** The card for a character's new finds (newest first, as `findsSince` gives them); null when there are none. */
export function findCard(entries: readonly FindEntry[], w: FindCardWords): FindCard | null {
  if (entries.length === 0) return null;
  // p45-6: coin first, then the newest first (the sort is stable).
  const all = [...entries].sort((a, b) => (a.kind === 'coin' ? 0 : 1) - (b.kind === 'coin' ? 0 : 1));
  // p45-5: up to four lines; from five, three and "and N more". Judged on every entry, taken back or not, so an Undo
  // never moves a line (p45-25); N and a counting head follow what is left (the plan's F8 row), so N can reach 1 or 0
  // (F8's ruling of 2026-11-26 does not say whether N may read 1 against p45-5: still asked).
  const counted = all.length >= 5;
  const shown = counted ? all.slice(0, 3) : all;
  const live = findsCount(all);
  const head = all.every((e) => e.kind === 'coin')
    ? 'New in your coin'
    : !counted || live === 0
      ? 'New in your pack'
      : `${n(live)} new ${live === 1 ? 'thing' : 'things'}`;
  // p45-7: said once when every entry (the hidden ones and the taken back too) has the same giver and the same words for when.
  const key = (e: FindEntry) => `${e.who.kind === 'character' ? e.who.characterId : e.who.kind}|${whenOf(e.at, w)}`;
  const shared = all.length > 1 && all.every((e) => key(e) === key(all[0]!));
  const once = shared ? whoWords(all[0]!.who, whenOf(all[0]!.at, w), true, w) : null;
  const lines = shown.map((e): FindCardLine => {
    if (e.takenBack) return { kind: 'back', words: backWords(e, w), entry: e };
    const mine = once ? null : whoWords(e.who, whenOf(e.at, w), e.kind === 'thing' && e.arrived > 1, w);
    // Coin among things adds "In your coin." (FD5b); coin alone does not (FD4, FD4b).
    const coin = e.kind === 'coin' && head !== 'New in your coin' ? 'In your coin.' : null;
    const quiet = [mine, coin].filter(Boolean).join(' ') || null;
    return { kind: 'find', name: nameOf(e, w), now: e.kind === 'thing' && e.now !== null ? n(e.now) : null, quiet, entry: e };
  });
  const more = all.slice(shown.length).filter((e) => e.takenBack === null).length;
  return { head, once, lines, more };
}
