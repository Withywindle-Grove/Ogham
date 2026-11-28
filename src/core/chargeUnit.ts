// A count's words (G-233, piece C of docs/specs/dec5-gaps.md; dg-5, dg-6, dg-8, dg-18, dgb-2): the unit an item's
// `charges` names ("portion", "portions"), read from the line's own copy of the item, so a holder who may not know the
// unit (an unidentified face, a count the setting keeps for the GM, a line handed out before the pack named one) reads
// "charge" and "charges". Here in core so the log (events.ts), the inventory module and the screens say the same words.

/** What a count counts: the singular, the plural, and whether the item names it (else "charge", "charges"). */
export interface ChargeUnit {
  one: string;
  many: string;
  named: boolean;
}

const CHARGE: ChargeUnit = { one: 'charge', many: 'charges', named: false };

/** Words: letters, with spaces, hyphens and apostrophes between them; never a figure ("3 cups"). */
const WORDS = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

const wordsOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return WORDS.test(trimmed) ? trimmed : null;
};

const chargesBlock = (details: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
  const charges = details?.charges;
  return typeof charges === 'object' && charges !== null && !Array.isArray(charges) ? (charges as Record<string, unknown>) : null;
};

/** The unit of an item's `charges` (dg-5): its `unit`, trimmed; `units`, else the unit plus "s"; else "charge(s)". */
export function chargeUnitOf(details: Record<string, unknown> | null | undefined): ChargeUnit {
  const charges = chargesBlock(details);
  const one = wordsOf(charges?.unit);
  if (!one) return CHARGE;
  return { one, many: wordsOf(charges?.units) ?? `${one}s`, named: true };
}

/** Starts that sound as a consonant though spelt with a vowel, and words whose "h" is silent (dgb-2). */
const A_BEFORE = /^(uni|use|eu|one)/;
const AN_BEFORE = /^(hour|honour)/;

/** "a portion", "an ounce" (dg-18 finding 2): "an" before a vowel, "a" before any other letter, with dgb-2's list. */
export function aUnit(word: string): string {
  const lower = word.toLowerCase();
  const an = AN_BEFORE.test(lower) || (/^[aeiou]/.test(lower) && !A_BEFORE.test(lower));
  return `${an ? 'an' : 'a'} ${word}`;
}

/** "1 portion", "2 portions": the count with the unit's singular for 1 and its plural for every other count. */
export const countOf = (n: number, unit: ChargeUnit): string => `${n} ${n === 1 ? unit.one : unit.many}`;

/** A label's word: the first letter in upper case ("Portions"). */
export const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** The full count, when the pack's `initial` is a whole number of 1 or more; null for dice ("2d4") or none. */
export function fullCountOf(details: Record<string, unknown> | null | undefined): number | null {
  const initial = chargesBlock(details)?.initial;
  const n = typeof initial === 'number' ? initial : typeof initial === 'string' && /^\s*\d+\s*$/.test(initial) ? Number(initial) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** Use a charge's words in the item's unit: "Use a portion", "Use an ounce", "Use a charge" (dg-6). */
export const spendOneWords = (unit: ChargeUnit): string => `Use ${aUnit(unit.one)}`;
