// Eating in camp, per player (ruled 2026-10-30, D14 and D15; 05 "Exploration modes", Daily rations): after
// cooking, each player taps Eat and picks their food. Cooked food (the portions a cook hands out) comes first and
// counts as the day's food with the pack's bonus, then fresh before preserved (confirmed 2026-10-30). The GM sees
// who hasn't eaten; anyone with no food is flagged, and the party members who could give them some are listed.
// Spoilage stays text. Pure.
import type { Cooking, FoodKind } from './wildPack.ts';

/** A food line in a character's pack (the item's `food`). */
export interface FoodLine {
  lineId: string;
  itemId: string;
  name: string;
  qty: number;
  kind: FoodKind;
}

export interface Eater {
  id: string;
  name: string;
  food: readonly FoodLine[];
  /** Has eaten today. */
  eaten: boolean;
}

export interface FoodChoice {
  kind: FoodKind;
  lineId: string;
  name: string;
  qty: number;
  /** The first choice: what the Eat sheet suggests. */
  suggested: boolean;
  /** Cooked food's bonus effects (the pack's cooking `bonus`, `onGoodRest` shape); empty otherwise. */
  bonus: Record<string, unknown>[];
}

const ORDER: Record<FoodKind, number> = { cooked: 0, fresh: 1, preserved: 2 };

/** What a character can eat, in the order suggested: cooked, then fresh, then preserved (pack order within each). */
export function foodChoices(eater: Eater, cooking: Cooking | null = null): FoodChoice[] {
  return eater.food
    .filter((line) => line.qty > 0)
    .map((line, i) => ({ line, i }))
    .sort((a, b) => ORDER[a.line.kind] - ORDER[b.line.kind] || a.i - b.i)
    .map(({ line }, i) => ({
      kind: line.kind,
      lineId: line.lineId,
      name: line.name,
      qty: line.qty,
      suggested: i === 0,
      bonus: line.kind === 'cooked' ? (cooking?.bonus ?? []) : [],
    }));
}

export interface EatingStatus {
  /** Who hasn't eaten yet (the GM's view). */
  notEaten: Eater[];
  /** Who hasn't eaten and has nothing to eat: the warning, with who could give them food. */
  nothingToEat: { eater: Eater; givers: Eater[] }[];
  allEaten: boolean;
}

const hasFood = (e: Eater) => e.food.some((l) => l.qty > 0);

/** The camp's eating at a glance (D14). Givers are the others with any food left. */
export function eatingStatus(eaters: readonly Eater[]): EatingStatus {
  const notEaten = eaters.filter((e) => !e.eaten);
  const nothingToEat = notEaten.filter((e) => !hasFood(e)).map((eater) => ({ eater, givers: eaters.filter((g) => g.id !== eater.id && hasFood(g)) }));
  return { notEaten, nothingToEat, allEaten: notEaten.length === 0 };
}

/**
 * The portions a cook makes (D15) from the ingredients cooked; they're food of kind `cooked`. A whole number per
 * ingredient gives a count; dice give the dice to roll at the table ("2 × 1d4" for two).
 */
export function cookPortions(cooking: Cooking, ingredients: number): { portions: number | null; roll: string | null; kind: 'cooked' } {
  const used = Math.max(0, ingredients);
  if (typeof cooking.portions === 'number') return { portions: cooking.portions * used, roll: null, kind: 'cooked' };
  if (used === 0) return { portions: 0, roll: null, kind: 'cooked' };
  return { portions: null, roll: used === 1 ? cooking.portions : `${used} × ${cooking.portions}`, kind: 'cooked' };
}
