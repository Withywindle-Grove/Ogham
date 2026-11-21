// Every weapon's damage from a rule (of-8, design/rulings/m5b-options-format-2026-11-03.md; 07 "Options that
// behave"): a rules set's `attack.weaponDamage: "<dice>"`, usually under `byOption`, sets the die every weapon reads
// (at hand, the Weapon skills step); the items themselves are untouched, and the line names the reason
// ("d6 · All weapons d6"). The rules browser and the GM reference keep the book's die (X3). Pure.
import { byOptionKeyOn, specParts } from '../library/optionGate.ts';

export interface DamageRule {
  /** The die every weapon reads ("d6"). */
  dice: string;
  /** Why, in words: the choice that set it ("All weapons d6"), else the rules set's name. */
  reason: string;
}

interface EntryLike {
  kind: string;
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * The every-weapon die from the rules sets as the campaign's options leave them (`setting.rulesSets`, lowest first,
 * `byOption` already applied): the highest rules set whose `attack.weaponDamage` is words. Null when none says it.
 */
export function ruleWeaponDamage(rulesSets: readonly Record<string, unknown>[]): string | null {
  for (let i = rulesSets.length - 1; i >= 0; i -= 1) {
    const attack = rulesSets[i]?.attack;
    const dice = isRecord(attack) ? words(attack.weaponDamage) : null;
    if (dice) return dice;
  }
  return null;
}

/** A `byOption` key's chosen parts in words: each choice's name ("All weapons d6"), else its option's name. */
function choiceNames(key: string, entries: readonly EntryLike[], choices: Readonly<Record<string, string>>): string {
  const names = specParts(key)
    .filter((part) => part.choice && choices[part.option] === part.choice)
    .map((part) => {
      const option = entries.find((e) => e.kind === 'option' && e.packEntryId === part.option);
      const choice = (Array.isArray(option?.data.choices) ? option.data.choices : []).find((c: unknown) => isRecord(c) && c.id === part.choice);
      return (isRecord(choice) ? words(choice.name) : null) ?? option?.name ?? part.option;
    });
  return [...new Set(names)].join(', ');
}

/**
 * The rule with its reason: the die (ruleWeaponDamage), and the choice whose `byOption` set it, read from the
 * campaign's rules-set entries as the pack has them (`setting.all`: a rules set keeps its `byOption` there), at the
 * top level (`{ attack: { weaponDamage } }`) or in the attack section's own (`{ weaponDamage }`). A die the rules set
 * gives with no option behind it names the rules set. Null when no rules set says it.
 */
export function weaponDamageRule(rulesSets: readonly Record<string, unknown>[], entries: readonly EntryLike[], choices: Readonly<Record<string, string>>): DamageRule | null {
  const dice = ruleWeaponDamage(rulesSets);
  if (!dice) return null;
  const sets = entries.filter((e) => e.kind === 'rulesSet');
  for (const set of sets) {
    const attack = isRecord(set.data.attack) ? set.data.attack : {};
    const keyed: [string, unknown][] = [
      ...(isRecord(set.data.byOption) ? Object.entries(set.data.byOption).map(([key, over]): [string, unknown] => [key, isRecord(over) && isRecord(over.attack) ? over.attack.weaponDamage : undefined]) : []),
      ...(isRecord(attack.byOption) ? Object.entries(attack.byOption).map(([key, over]): [string, unknown] => [key, isRecord(over) ? over.weaponDamage : undefined]) : []),
    ];
    const found = keyed.find(([key, value]) => words(value) === dice && byOptionKeyOn(key, choices));
    if (found) {
      const reason = choiceNames(found[0], entries, choices);
      if (reason) return { dice, reason };
    }
  }
  const own = sets.find((s) => isRecord(s.data.attack) && words(s.data.attack.weaponDamage) === dice);
  return { dice, reason: own?.name ?? 'Setting rules' };
}
