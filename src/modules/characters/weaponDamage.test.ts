// The rule that sets every weapon's damage (of-8), pure: which rules set's `attack.weaponDamage` counts, and the
// words for why. Invented rules sets and options only.
import { describe, expect, it } from 'vitest';
import { resolveRules } from '../library/options.ts';
import { ruleWeaponDamage, weaponDamageRule } from './weaponDamage.ts';

describe('ruleWeaponDamage and weaponDamageRule (of-8)', () => {
  const option = {
    kind: 'option',
    packEntryId: 'mire-blades',
    name: 'Blade dice',
    data: { id: 'mire-blades', default: 'one', choices: [{ id: 'one', name: 'One die for all' }, { id: 'own', name: 'Each its own' }] },
  };
  const inSection = { id: 'mire-rules', attack: { byOption: { 'mire-blades=one': { weaponDamage: 'd4' } } } };
  const entry = (data: Record<string, unknown>, name = 'Mire rules') => ({ kind: 'rulesSet', packEntryId: String(data.id), name, data });

  // Purpose: a rule written inside the attack section's own byOption counts like a top-level one, its choice named.
  it('reads a rule set in the attack section’s own byOption, naming the choice', () => {
    const choices = { 'mire-blades': 'one' };
    const sets = [resolveRules(inSection, choices)];
    expect(ruleWeaponDamage(sets)).toBe('d4');
    expect(weaponDamageRule(sets, [entry(inSection), option], choices)).toEqual({ dice: 'd4', reason: 'One die for all' });
    expect(weaponDamageRule([resolveRules(inSection, { 'mire-blades': 'own' })], [entry(inSection), option], { 'mire-blades': 'own' })).toBeNull();
  });

  // Purpose: a rules set that gives the die with no option behind it names the rules set as the reason.
  it('names the rules set when no choice set the die', () => {
    const plain = { id: 'plain-rules', attack: { weaponDamage: 'd6' } };
    expect(weaponDamageRule([plain], [entry(plain, 'Plain rules')], {})).toEqual({ dice: 'd6', reason: 'Plain rules' });
  });

  // Purpose: the highest rules set that names a die wins; a higher one that says nothing about it (or something that isn't words) leaves the lower one's.
  it('the highest rules set that names the die wins', () => {
    expect(ruleWeaponDamage([{ attack: { weaponDamage: 'd6' } }, { attack: { damageScore: 'MUS' } }])).toBe('d6');
    expect(ruleWeaponDamage([{ attack: { weaponDamage: 'd6' } }, { attack: { weaponDamage: '  ' } }, { attack: { weaponDamage: 6 } }])).toBe('d6');
    expect(ruleWeaponDamage([{ attack: { weaponDamage: 'd6' } }, { attack: { weaponDamage: 'd8' } }])).toBe('d8');
  });
});
