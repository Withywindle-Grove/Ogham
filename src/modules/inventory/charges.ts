// Charges and the tier line (M4 step 5; ruled 2026-10-23; docs/05, 07 "Charges").
// Visible charges: the count is on the line; the holder sets it once (from the roll prompt) and spends one at
// a time. Hidden charges (the pack's magicItems.charges.hidden): the starting total is the GM's alone
// (inventory_line_secrets); the line counts uses, so the holder can always tap "Use a charge"; at zero the
// database marks it spent and the GM gets a quiet note; the holder learns when the GM reveals it. The GM
// recharges any item, even where the pack says not (fiat). The database checks all of this.
// The tier line ("<name> is now <tier>") is the database's: it works the tier out and writes the line once, when a
// change to a character's items ends in another tier (M5 step 4; supabase/migrations/…_m5_intents.sql).
// Changes to a line name the version the person's copy showed (inventory.ts changeLine); the ones that read the line
// first use the version they read, so two taps at once can't both spend the same charge.
import { defineCommand, failed, fromWrite, isGm, ok, requestIdOf, type CommandResult } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { changeLine, mayChangeCarrier, type InventoryLine, type LineRef } from './inventory.ts';

/** What the setting rules say about charges (rulesSets[].magicItems.charges, the part players receive). */
export interface ChargeRules {
  hidden: boolean;
  /** Starting dice by item category ("wand" → "2d10"). */
  dice: Record<string, string>;
  /** Whether items can be recharged, when the item doesn't say; null when the setting rules don't say either. */
  rechargeable: boolean | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads magicItems.charges from the campaign's rules sets (lowest priority first; higher ones fill in). */
export function readChargeRules(rulesSets: Record<string, unknown>[]): ChargeRules {
  const rules: ChargeRules = { hidden: false, dice: {}, rechargeable: null };
  for (const set of rulesSets) {
    const charges = isObject(set.magicItems) && isObject(set.magicItems.charges) ? set.magicItems.charges : null;
    if (!charges) continue;
    for (const [key, value] of Object.entries(charges)) {
      if (key === 'hidden' && typeof value === 'boolean') rules.hidden = value;
      else if (key === 'rechargeable' && typeof value === 'boolean') rules.rechargeable = value;
      else if (typeof value === 'string') rules.dice[key] = value;
    }
  }
  return rules;
}

/**
 * An item's charges as the setting rules and the item describe them: its starting dice, if it has charges at all.
 * Whether it can be recharged (ruled 2026-10-24): the item's own `rechargeable`, then the setting rules', then the
 * campaign setting "Charged items can be recharged" (`campaignDefault`, No unless the GM says).
 */
export function chargesOf(
  line: Pick<InventoryLine, 'category' | 'details'>,
  rules: ChargeRules,
  campaignDefault = false,
): { dice: string; rechargeable: boolean } | null {
  const own = isObject(line.details.charges) ? line.details.charges : null;
  const initial = own?.initial;
  const dice = typeof initial === 'string' || typeof initial === 'number' ? String(initial) : (rules.dice[line.category] ?? null);
  if (dice === null) return null;
  return { dice, rechargeable: typeof own?.rechargeable === 'boolean' ? own.rechargeable : (rules.rechargeable ?? campaignDefault) };
}

/** The starting charges, from the roll: the holder for visible charges (once), the GM for hidden ones. */
export const setCharges = defineCommand({
  name: 'inventory.setCharges',
  target: (input: { line: LineRef; value: number; hidden: boolean; roll?: string }) => ({ carrier: input.line.carrier, hidden: input.hidden }),
  allowed: (user, target) => (target.hidden ? isGm(user, target.carrier.campaignId) : mayChangeCarrier(user, target.carrier)),
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    if (!Number.isInteger(input.value) || input.value < 0) return failed('Charges must be a whole number, 0 or more.');
    if (!input.hidden) {
      const saved = await changeLine<{ charges_left: number | null }>(
        db,
        input.line,
        { charges_left: input.value, charges_hidden: false, last_roll: input.roll ?? null },
        'charges_left',
        requestIdOf(meta),
      );
      return saved.ok ? ok(saved.value.charges_left ?? input.value) : saved;
    }
    const marked = await changeLine<{ id: string }>(db, input.line, { charges_hidden: true }, 'id', requestIdOf(meta));
    if (!marked.ok) return marked;
    const saved = fromWrite(
      await db
        .from('inventory_line_secrets')
        .upsert({ id: input.line.id, campaign_id: input.line.carrier.campaignId, charges_total: input.value, spent: false, last_roll: input.roll ?? null })
        .select('charges_total'),
    );
    return saved.ok ? ok(saved.value.charges_total ?? input.value) : saved;
  },
});

/**
 * Spend one charge (logged). Hidden charges are counted on the line; the GM's total decides when it's spent. Used
 * again with none left, nothing happens: the database marks it spent for the holder (ruled 2026-10-24), and the
 * result says so (`fizzled`).
 */
export const useCharge = defineCommand({
  name: 'inventory.useCharge',
  target: (input: { line: LineRef; hidden: boolean }) => input.line.carrier,
  allowed: mayChangeCarrier,
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    // Read fresh, and saved only if nothing changed in between (two taps at once spend two charges, never one).
    const found = fromWrite(await db.from('inventory_lines').select('charges_left, charges_used, version').eq('id', input.line.id));
    if (!found.ok) return found;
    const fresh = { id: input.line.id, version: found.value.version };
    if (input.hidden) {
      const saved = await changeLine<{ charges_used: number }>(db, fresh, { charges_used: found.value.charges_used + 1 }, 'charges_used', requestIdOf(meta));
      return saved.ok ? ok(saved.value.charges_used) : saved;
    }
    const left = found.value.charges_left;
    if (left === null) return failed('Set the charges first.');
    if (left <= 0) return failed('No charges left.');
    const saved = await changeLine<{ charges_left: number | null }>(db, fresh, { charges_left: left - 1 }, 'charges_left', requestIdOf(meta));
    return saved.ok ? ok(saved.value.charges_left ?? left - 1) : saved;
  },
});

/** The GM adds charges through the roll prompt ("2d6 → 7", kept with the count), wherever the item is. */
export const recharge = defineCommand({
  name: 'inventory.recharge',
  target: (input: { line: LineRef; amount: number; hidden: boolean; roll?: string }) => input.line.carrier,
  allowed: (user, carrier) => isGm(user, carrier.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    if (!Number.isInteger(input.amount) || input.amount < 1) return failed('Add a whole number of charges, 1 or more.');
    if (!input.hidden) {
      const found = fromWrite(await db.from('inventory_lines').select('charges_left, version').eq('id', input.line.id));
      if (!found.ok) return found;
      const saved = await changeLine<{ charges_left: number | null }>(
        db,
        { id: input.line.id, version: found.value.version },
        { charges_left: (found.value.charges_left ?? 0) + input.amount, spent_shown: false, last_roll: input.roll ?? null },
        'charges_left',
        requestIdOf(meta),
      );
      return saved.ok ? ok(saved.value.charges_left ?? input.amount) : saved;
    }
    const secret = fromWrite(await db.from('inventory_line_secrets').select('charges_total').eq('id', input.line.id));
    if (!secret.ok) return secret;
    const saved = fromWrite(
      await db
        .from('inventory_line_secrets')
        .update({ charges_total: (secret.value.charges_total ?? 0) + input.amount, spent: false, last_roll: input.roll ?? null })
        .eq('id', input.line.id)
        .select('charges_total'),
    );
    if (!saved.ok) return saved;
    const shown = await changeLine<{ id: string }>(db, { id: input.line.id }, { spent_shown: false }, 'id', requestIdOf(meta));
    return shown.ok ? ok(saved.value.charges_total ?? input.amount) : shown;
  },
});

/**
 * The GM's Reveal (ruled 2026-10-24): the holder sees how many charges are left from now on, like visible charges.
 * The line's count becomes visible, with what's left of the GM's total.
 */
export const revealCharges = defineCommand({
  name: 'inventory.revealCharges',
  target: (input: { line: LineRef; left: number }) => input.line.carrier,
  allowed: (user, carrier) => isGm(user, carrier.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<number>> => {
    if (!Number.isInteger(input.left) || input.left < 0) return failed('Charges must be a whole number, 0 or more.');
    const saved = await changeLine<{ charges_left: number | null }>(
      db,
      input.line,
      { charges_hidden: false, charges_left: input.left, spent_shown: false },
      'charges_left',
      requestIdOf(meta),
    );
    return saved.ok ? ok(saved.value.charges_left ?? input.left) : saved;
  },
});

/** Whether a hidden-charge item now shows as spent to its holder (after a use with none left). */
export async function seemsSpent(db: Db, lineId: string): Promise<boolean> {
  const found = await db.from('inventory_lines').select('spent_shown').eq('id', lineId).maybeSingle();
  return found.data?.spent_shown === true;
}

/** The GM tells the holder a hidden-charge item is spent. */
export const revealSpent = defineCommand({
  name: 'inventory.revealSpent',
  target: (input: { line: LineRef }) => input.line.carrier,
  allowed: (user, carrier) => isGm(user, carrier.campaignId),
  run: async (db, _user, input, meta): Promise<CommandResult<boolean>> => {
    const saved = await changeLine<{ spent_shown: boolean }>(db, input.line, { spent_shown: true }, 'spent_shown', requestIdOf(meta));
    return saved.ok ? ok(true) : saved;
  },
});

/** The GM's hidden charge totals for the lines they can see (line id → total and spent). */
export async function loadHiddenCharges(db: Db, campaignId: string): Promise<Map<string, { total: number | null; spent: boolean }>> {
  const found = await db.from('inventory_line_secrets').select('id, charges_total, spent').eq('campaign_id', campaignId);
  return new Map((found.data ?? []).map((row) => [row.id, { total: row.charges_total, spent: row.spent }]));
}
