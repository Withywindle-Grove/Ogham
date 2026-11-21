// Use one up's words (Design on #552, 2026-11-07): the verb an At hand row shows for an item, by its kind, and the
// past tense the toast and the log say ("Wren drank a Moss draught, 1 left"). Here in core so the log (events.ts) and
// the inventory module read the same words; it reads only an item's own fields (its category id and `food`, 07).
// The verb comes from the kind for now; a pack's own `verb` field is parked for later (Design, #552).

/** The words of "use one up", and their past tense. */
export type UseVerb = 'Fire' | 'Drink' | 'Eat' | 'Use';
export const USED_WORDS: Record<UseVerb, string> = { Fire: 'Fired', Drink: 'Drank', Eat: 'Ate', Use: 'Used' };

// An item's kind read from what the pack gives: its category's id (packs name their own; these are plain words, a
// guess Design accepted on #552) and its `food` field (07). The app adds no field of its own.
export const AMMUNITION_CATEGORY = /(^|-)(ammunition|ammo|arrows?|bolts?|quarrels?|shot|bullets?)(-|$)/;
export const DRAUGHT_CATEGORY = /(^|-)(potions?|draughts?|drinks?|elixirs?|tonics?|philtres?)(-|$)/;
export const FOOD_CATEGORY = /(^|-)(food|rations?|provisions?)(-|$)/;

/**
 * Ammunition, by its category (the words above): never a weapon in its own right, even when it carries a `weapon` block
 * for its magic bonus (mw-3; the Pack Creator's magic arrows): it is fired from one.
 */
export const isAmmunition = (category: unknown): boolean => typeof category === 'string' && AMMUNITION_CATEGORY.test(category.toLowerCase());

/**
 * The verb of an At hand row that uses one up: Fire for ammunition, Drink for a draught, Eat for food, Use for anything
 * else that counts down (a stack); null for a single thing of no such kind.
 */
export function oneUpVerb(item: { category: string; details: Record<string, unknown>; stack: number; qty: number }): UseVerb | null {
  const category = (item.category || '').toLowerCase();
  if (AMMUNITION_CATEGORY.test(category)) return 'Fire';
  if (DRAUGHT_CATEGORY.test(category)) return 'Drink';
  if (FOOD_CATEGORY.test(category) || typeof item.details.food === 'string') return 'Eat';
  return item.stack > 1 || item.qty > 1 ? 'Use' : null;
}

/** One of the item, as the toast and the log say it: "a Moss draught" with the pack's `unitName`, else its name. */
const unitOf = (details: Record<string, unknown>): string | null => (typeof details.unitName === 'string' && details.unitName.trim() ? details.unitName.trim() : null);

export function oneOf(name: string, details: Record<string, unknown>): string {
  const unit = unitOf(details);
  return unit ? `${/^[aeiou]/i.test(unit) ? 'an' : 'a'} ${unit}` : name;
}

/** What happened, after the person's name: "drank a Moss draught, 1 left", or "drank the last Moss draught". */
export function usedWords(verb: UseVerb, name: string, details: Record<string, unknown>, left: number): string {
  const past = USED_WORDS[verb].toLowerCase();
  return left > 0 ? `${past} ${oneOf(name, details)}, ${left} left` : `${past} the last ${unitOf(details) ?? name}`;
}
