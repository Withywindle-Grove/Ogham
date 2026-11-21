// S19's logic half (docs/plans/dec-9-the-whole-scene.md, row S19; ap-11, mm-8, ic-2, ft-1): the card after an
// expedition ends, as data, from what the Scene has already loaded; drawn by the card (src/app/EndCard.tsx, the screen
// half) and the full-rest panel SceneTime shares with Start downtime. Its words are data: the hit-points line ("x of y",
// "—") here; the rest's line from fullRestWords (characters/nightRest.ts), the healing rule from the setting
// (healingText, play.ts) with its source worded here, and the time taken from timeWords (core/timeWords.ts).
import { fullRestWords } from '../characters/nightRest.ts';
import { hpSegments } from '../characters/play.ts';
import { healingText } from './play.ts';

/** A character who went, as loadWhoWent gives it (only what the card reads). */
export interface EndCardCharacter {
  ref: { id: string };
  name: string;
  hpCurrent: number | null;
  hpMax: number | null;
}

/** One row of the card: a character who went, their hit points as words and as the bar's fills, and whether hurt. */
export interface EndCardRow {
  id: string;
  name: string;
  /** "4 of 9"; "—" when the character's hit points are unset (never "0 of N"). */
  hpLine: string;
  /** The same hit points as numbers, for the card to set the figure bold; null when unset (the line is "—"). */
  hp: { now: number; max: number } | null;
  /** The bar's segments, each 0 to 1 (hpSegments), for the hit points the line shows; none when unset. */
  fills: number[];
  hurt: boolean;
}

/**
 * The card's rows, one a character who went, in the order given; and whether everyone is at full hit points (false
 * for nobody: there is no row to be full). A maximum with no current number reads full, as today's panel shows it;
 * a character with no maximum reads "—" and is not counted hurt.
 */
export function endCardRows(went: readonly EndCardCharacter[]): { rows: EndCardRow[]; everyoneFull: boolean } {
  const rows = went.map((w): EndCardRow => {
    if (w.hpMax === null) return { id: w.ref.id, name: w.name, hpLine: '—', hp: null, fills: [], hurt: false };
    const now = w.hpCurrent ?? w.hpMax;
    return { id: w.ref.id, name: w.name, hpLine: `${now} of ${w.hpMax}`, hp: { now, max: w.hpMax }, fills: hpSegments(now, w.hpMax).fills, hurt: now < w.hpMax };
  });
  return { rows, everyoneFull: rows.length > 0 && rows.every((r) => !r.hurt) };
}

/** What the healing rule reads from: the setting's rules sets (lowest first) and its packs, in the setting's order. */
export interface HealingSetting {
  rulesSets: readonly Record<string, unknown>[];
  packs: readonly { kind: string; shortName: string }[];
}

/**
 * The setting's healing rule (healingText) with its source line: "From your setting: <the first pack that isn't
 * homebrew>", word for word as SceneTime's full-rest panel has it inline today; no source when only homebrew is
 * attached. Null when no rules set gives a rule.
 */
export function healingWithSource(setting: HealingSetting | null): { rule: string; source: string | null } | null {
  const rule = healingText(setting?.rulesSets ?? []);
  if (rule === null) return null;
  const from = setting?.packs.find((p) => p.kind !== 'homebrew')?.shortName ?? null;
  return { rule, source: from ? `From your setting: ${from}` : null };
}

/**
 * Who the rest prompt left out (an ✕, mm-8), by name, in the prompt's order: computed each time from the prompt's
 * rows and marks, never stored (storing it needs a migration and a ruling). A row whose name isn't known is left out
 * of the list, so the line never shows an empty name ("except for , Wren").
 */
export function restLeftOut(
  rows: readonly { characterId: string }[],
  marks: Readonly<Record<string, boolean | undefined>>,
  names: ReadonlyMap<string, string>,
): string[] {
  return rows.filter((row) => marks[row.characterId] === false).flatMap((row) => {
    const name = names.get(row.characterId);
    return name ? [name] : [];
  });
}

/**
 * The rest's line as the card draws it (ap-11, T11): a labelled line, "Full rest." its label and the rest of
 * fullRestWords' sentence after it ("Rest and day abilities are back, except for Tam."). The words stay
 * fullRestWords' own, so the end card and Start downtime's panel say the same.
 */
export function restLine(leftOut: readonly string[], notBack: readonly string[] = []): { label: string; words: string } {
  const rest = fullRestWords(leftOut, notBack).replace(/^Full rest: /, '');
  return { label: 'Full rest.', words: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

/**
 * The expedition whose end card is drawn: the GM's alone (hidden means hidden, ap-11). A player gets none, whatever
 * ended expedition is in hand. SceneTime draws and registers the card only for what this returns.
 */
export function endCardFor<T>(gm: boolean, ended: T | null): T | null {
  return gm ? ended : null;
}
