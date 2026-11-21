// Every weapon's damage from a rule (of-8; the area-4 re-check, Francis 2026-11-04), through the campaign's setting
// as the screens read it, on the invented fixture scripts/fixtures/weapon-damage-rule.fixture.json: a choice that
// sets `attack.weaponDamage` under `byOption`, and weapons with their own dice. Always runs (no private packs).
import { describe, expect, it } from 'vitest';
import fixture from '../../scripts/fixtures/weapon-damage-rule.fixture.json?raw';
import { weaponFigures } from '../modules/characters/play.ts';
import { weaponDamageRule } from '../modules/characters/weaponDamage.ts';
import { weaponLine } from '../modules/characters/weaponSkills.ts';
import type { CampaignPack } from '../modules/library/campaignPacks.ts';
import { readPackJson } from '../modules/library/packFile.ts';
import { choicesInPlay, settingFrom, type CampaignSetting } from './campaignSetting.ts';
import { lineInPlay } from './campaignSetting.ts';

describe('a rule that sets every weapon’s damage (of-8)', () => {
  const read = readPackJson(fixture);
  if (!read.ok) throw new Error(read.message);
  const entries = read.pack.entries.map((e) => ({ ...e, packId: 'fixture-reed-damage' }));

  /** The fixture as one campaign's only pack, with these choices made (the rest at their defaults). */
  function campaign(optionChoices: Record<string, string> = {}): CampaignSetting {
    const link: CampaignPack = {
      id: 'link-1',
      campaignId: 'c-1',
      packId: 'fixture-reed-damage',
      name: 'Reed damage',
      shortName: 'Reed damage',
      version: '0.1',
      kind: 'setting',
      optionChoices,
      priority: 1,
      overrides: {},
      campaignHomebrew: false,
    };
    return settingFrom([link], entries, {});
  }

  const item = (setting: CampaignSetting, id: string) => setting.items.find((e) => e.packEntryId === id)!;
  const rule = (setting: CampaignSetting) => weaponDamageRule(setting.rulesSets, setting.all, choicesInPlay(setting));
  // An invented class with an attack bonus of +1 at level 1, and a Muscle score whose melee modifier is +1.
  const warden = { progression: [{ level: 1, attackBonus: 1 }] };
  const strong = { 'abilityModifiers.MUS': { melee: 1 } };

  // Purpose: with the choice "All weapons d6" (the default), the campaign's rule is d6, and the reason is the choice's name.
  it('reads the die and its reason from the choice in play', () => {
    expect(rule(campaign())).toEqual({ dice: 'd6', reason: 'All weapons d6' });
  });

  // Purpose: with the other choice ("By weapon") there is no rule and each weapon keeps its own die; with "All weapons d6" its own die is gone.
  it('has no rule when the choice that sets it is off', () => {
    const setting = campaign({ 'reed-damage': 'varied' });
    expect(rule(setting)).toBeNull();
    expect(weaponFigures(item(setting, 'bog-axe').data, strong, warden, 1, setting.rulesSets, { damageReason: null })).toBe('+2, 1d8+1');
    expect(weaponFigures(item(campaign(), 'bog-axe').data, strong, warden, 1, campaign().rulesSets, { damageReason: null })).not.toContain('1d8');
  });

  // Purpose: at hand, an axe whose own die is 1d8 shows d6 in a d6 campaign, the damage score still adding, with the reason after.
  it('at hand, a weapon shows the rule’s die, not its own, with the reason', () => {
    const setting = campaign();
    expect(weaponFigures(item(setting, 'bog-axe').data, strong, warden, 1, setting.rulesSets, { damageReason: rule(setting)?.reason ?? null })).toBe('+2, d6+1, All weapons d6');
  });

  // Purpose: a weapon that is both melee and missile names the rule's die once, with its reason.
  it('a weapon that is both kinds shows the rule’s die once', () => {
    const setting = campaign();
    expect(weaponFigures(item(setting, 'eel-knife').data, {}, warden, 1, setting.rulesSets, { damageReason: rule(setting)?.reason ?? null })).toBe('Melee +1, Missile +1, d6, All weapons d6');
  });

  // Purpose: without the reason passed, the die still follows the rule (every caller that gives the rules sets is right).
  it('the die follows the rules sets even without the reason', () => {
    const setting = campaign();
    expect(weaponFigures(item(setting, 'bog-axe').data, {}, null, 1, setting.rulesSets)).toBe('d6');
  });

  // Purpose: the Weapon skills step's line shows the rule's die and its reason in place of the weapon's own die.
  it('the Weapon skills step’s line follows the rule', () => {
    const setting = campaign();
    expect(weaponLine(item(setting, 'bog-axe'), rule(setting))).toBe('d6 (All weapons d6), melee, one-handed');
    expect(weaponLine(item(campaign({ 'reed-damage': 'varied' }), 'bog-axe'), null)).toBe('1d8, melee, one-handed');
  });

  // Purpose: with the rule "All weapons d6" and a patch on weapons' damage (Bone, −1), the rule's die comes first and the patch's delta after, so a carried axe reads "d6−1", with both lines kept.
  it('applies the rule’s die before a patch’s delta, keeping both lines', () => {
    const setting = campaign({ 'reed-metal': 'bone' });
    const axe = entries.find((e) => e.packEntryId === 'bog-axe')!;
    const now = lineInPlay(setting, { category: 'weapon', details: axe.data, sourceEntryId: 'bog-axe' });
    const shown = [weaponFigures({ ...axe.data, ...now.details }, {}, warden, 1, setting.rulesSets, { damageReason: rule(setting)?.reason ?? null, damageDelta: now.damageDelta }), ...now.lines].join(', ');
    expect(shown).toBe('+1, d6−1, All weapons d6, Damage −1: Bone, Reed damage');
  });

  // Purpose: the items themselves are untouched: the axe's own data still says 1d8 (the rule is read, never written in).
  it('leaves the items’ own damage as the pack has it', () => {
    const setting = campaign();
    expect((item(setting, 'bog-axe').data.weapon as { damage: string }).damage).toBe('1d8');
    expect(rule(setting)?.dice).toBe('d6');
  });
});
