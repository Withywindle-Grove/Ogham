// The one roll prompt's rules (docs/02-architecture.md, "Dice entry"). The app never rolls: a person rolls real
// dice and types the result. Every roll is kept with its dice, the result, who entered it and how ("manual"
// for now), so digital dice can later be a campaign setting without changing any screen.
import { defineCommand, failed, fromWrite, isGm, isMember, ok, type CommandResult } from './commands.ts';
import { shownWords, STORED_SEPARATOR } from './storedWords.ts';

export type RollPurpose = 'hp' | 'charges' | 'initiative' | 'table' | 'money';

/** The lowest and highest a dice expression can give: "2d10" → 2–20, "1d6+1" → 2–7, "3" → 3–3. */
export function diceRange(expression: string): { min: number; max: number } | null {
  const text = expression.replace(/\s+/g, '').toLowerCase();
  if (!text || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(text)) return null;
  let min = 0;
  let max = 0;
  for (const [, sign, term] of text.matchAll(/([+-]?)(\d*d\d+|\d+)/g)) {
    const flip = sign === '-' ? -1 : 1;
    const dice = /^(\d*)d(\d+)$/.exec(term!);
    const [low, high] = dice ? [Number(dice[1] || 1), Number(dice[1] || 1) * Number(dice[2])] : [Number(term), Number(term)];
    if (dice && (Number(dice[2]) < 1 || Number(dice[1] || 1) < 1)) return null;
    min += flip === 1 ? low : -high;
    max += flip === 1 ? high : -low;
  }
  return { min, max };
}

/** A typed roll: a whole number the dice could give, or a plain message saying what's wrong. */
export function readRoll(text: string, expression: string): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) return { ok: false, message: 'Type the number you rolled.' };
  const value = Number(trimmed);
  const range = diceRange(expression);
  if (range && (value < range.min || value > range.max)) {
    return { ok: false, message: `${expression} gives ${range.min} to ${range.max}.` };
  }
  return { ok: true, value };
}

/**
 * A draft's rolls stay visible to the GM, labelled with the draft (ruled 2026-10-26): the draft hides the unfinished
 * character, not the dice.
 */
// Saved on the roll: the old format, kept (the sweep's review, #561); shown through `shownRollLabel`.
export const draftRollLabel = (name: string) => `draft${STORED_SEPARATOR}${name.trim()}`.slice(0, 120);

/**
 * A roll's label as shown: "draft · Wren" (as saved) shows "draft, Wren" (no middle dot, words rule 11). No screen
 * shows a roll's label yet; whatever shows one reads it through here.
 */
export const shownRollLabel = (label: string) => shownWords(label);

/** Keep a roll. Rolls only the GM may see (a hidden item's charges) can only be entered by the GM. */
export const recordRoll = defineCommand({
  name: 'roll.record',
  log: 'none',
  target: (input: { campaignId: string; expression: string; result: number; purpose: RollPurpose; gmOnly: boolean; label?: string }) => input,
  allowed: (user, target) => (target.gmOnly ? isGm(user, target.campaignId) : isMember(user, target.campaignId)),
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const read = readRoll(String(input.result), input.expression);
    if (!read.ok) return failed(read.message);
    const saved = fromWrite(
      await db
        .from('rolls')
        .insert({ campaign_id: input.campaignId, expression: input.expression.trim(), result: read.value, purpose: input.purpose, gm_only: input.gmOnly, method: 'manual', label: (input.label ?? '').slice(0, 120) })
        .select('id'),
    );
    return saved.ok ? ok(saved.value.id as string) : saved;
  },
});
