// Weapon skills (M5b step 0b part A; design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md, 04 PC extras
// weaponSkills, 07 weaponProficiency). Pure: whether the step exists, what's offered (the setting's weapons the class
// may use, grouped by category; restricted ones as reference), how many picks are allowed and unspent, the
// specialisation, and the penalty or bonus the Attack sheet's rolls count (as-4).
import { allows } from '../inventory/equipWarnings.ts';
import { isAmmunition } from '../../core/useWords.ts';
import { layoutKeys, optionSpecOn, specText } from '../library/optionGate.ts';
import type { DamageRule } from './weaponDamage.ts';
import { signedNumber } from './modifierColumns.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const int = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);

export interface WeaponSkill {
  /** The weapon's item id; for a typed Other… (ct-8), the name typed. */
  itemId: string;
  specialised?: true;
  /** A weapon the list doesn't have, typed in (Other…, ct-8): `itemId` holds its name. */
  other?: true;
}

/** The rules set's weaponProficiency for one class category, when its option is on. */
export interface Proficiency {
  note: string;
  start: number;
  gainEvery: number | null;
  penalty: number;
  /** Present when specialisation's option is on and the class's category may specialise. */
  specialisation: { cost: number; attack: number; damage: number; note: string } | null;
  /** Present when the restricted-weapons option is on: forbidden weapons usable with the penalty (pickable, flagged for the GM, R3-5). */
  restricted: { note: string } | null;
}

/**
 * "<option id>", "<option id>=<choice id>" or "<option id>:<choice id>" (07: `option`, written like `byOption` keys): on
 * when the campaign chose that choice (no choice id: its `on` choice). The `=` spelling is the packs' (ct-10, 2026-11-02:
 * a specialisation written "…=on-specialisation" was never on).
 */
export function optionIsOn(spec: unknown, choices: Readonly<Record<string, string>>): boolean {
  // A rule that must name its option (no spec: off); otherwise the shared reader (optionGate.ts, of-3).
  return specText(spec) !== '' && optionSpecOn(spec, choices);
}

/**
 * The class's weapon proficiency: only while the rules set's `weaponProficiency.option` is on and the class names a
 * `weaponProficiencyCategory` that `byCategory` knows (otherwise there's no step). The top rules set that has one wins.
 */
export function proficiencyFor(rulesSets: readonly Record<string, unknown>[], klass: Record<string, unknown>, choices: Readonly<Record<string, string>>): Proficiency | null {
  for (const rules of [...rulesSets].reverse()) {
    const wp = rules.weaponProficiency;
    if (!isRecord(wp)) continue;
    const sp = isRecord(wp.specialisation) ? wp.specialisation : null;
    // Specialising needs the proficiencies: a specialisation choice of the same option ("…=on-specialisation", the
    // packs' shape, ct-10) turns the step on as well as the option's own `on`. A separate specialisation option doesn't.
    const sameOption = !!sp && text(sp.option).replace('=', ':').split(':')[0]!.trim() === text(wp.option).replace('=', ':').split(':')[0]!.trim();
    if (!optionIsOn(wp.option, choices) && !(sameOption && optionIsOn(sp!.option, choices))) return null;
    const category = text(klass.weaponProficiencyCategory);
    const row = isRecord(wp.byCategory) && category ? wp.byCategory[category] : undefined;
    if (!isRecord(row)) return null;
    const start = int(row.start);
    if (start === null || start < 0) return null;
    const every = int(row.gainEvery);
    const spCats = sp && Array.isArray(sp.categories) ? sp.categories.map(String) : [];
    const bonus = sp && isRecord(sp.bonus) ? sp.bonus : {};
    const cost = sp ? int(sp.cost) : null;
    return {
      note: text(wp.note),
      start,
      gainEvery: every !== null && every > 0 ? every : null,
      penalty: int(row.penalty) ?? 0,
      specialisation:
        sp && optionIsOn(sp.option, choices) && spCats.includes(category) && cost !== null && cost > 0
          ? { cost, attack: int(bonus.attack) ?? 0, damage: int(bonus.damage) ?? 0, note: text(sp.note) }
          : null,
      restricted: isRecord(wp.restrictedWeapons) && optionIsOn(wp.restrictedWeapons.option, choices) ? { note: text(wp.restrictedWeapons.note) } : null,
    };
  }
  return null;
}

/** How many picks the level allows: `start`, plus one every `gainEvery` levels after the first. */
export function allowedPicks(p: Proficiency, level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return p.start + (p.gainEvery ? Math.floor((lv - 1) / p.gainEvery) : 0);
}

/** Picks spent: one each, a specialised weapon its `cost` (one pick plus the extra). */
export function picksUsed(skills: readonly WeaponSkill[], p: Proficiency): number {
  return skills.reduce((n, s) => n + (s.specialised && p.specialisation ? p.specialisation.cost : 1), 0);
}

export const unspentPicks = (skills: readonly WeaponSkill[], p: Proficiency, level: number) => allowedPicks(p, level) - picksUsed(skills, p);

/** A character's picks as saved (the database keeps them well formed; this reads anything safely). */
export function weaponSkillsOf(value: unknown): WeaponSkill[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((v) => {
    if (!isRecord(v) || !text(v.itemId) || seen.has(text(v.itemId))) return [];
    seen.add(text(v.itemId));
    return [{ itemId: text(v.itemId), ...(v.specialised === true ? { specialised: true as const } : {}), ...(v.other === true ? { other: true as const } : {}) }];
  });
}

interface ItemLike {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

/**
 * Whether a sheet field is the one the weapon skills step fills (a layout's `weaponProficiencies` field, in either form
 * a campaign holds it, optionGate.ts `layoutKeys`): while the step is in play, Who they are doesn't ask it again. The
 * weapon setup names no field of its own, so the layout's key is the link.
 */
export const isWeaponSkillsField = (key: string): boolean => layoutKeys('weaponProficiencies').includes(key);

/**
 * Whether the weapon skills own this field (after-test A13): it's the layout's weapon proficiencies field and the
 * weapon setup applies to the character, so creation doesn't ask it and the sheet doesn't show it (the Weapon skills
 * line does). Shared by creation's Who they are and the full sheet.
 */
export const ownedByWeaponSkills = (key: string, setupApplies: boolean): boolean => setupApplies && isWeaponSkillsField(key);

/** A weapon is an item with a `weapon` block (07), ammunition aside (its block only carries its magic bonus, mw-3). */
export const isWeapon = (item: ItemLike) => isRecord(item.data.weapon) && !isAmmunition(item.data.category);

/**
 * The class may use it: its `weaponsAllowed` passes the weapon (allows(), 07), or names it among its optional weapons
 * (`optional.ids`: the setting keeps them only while their option is on, optionGate.ts); a class without the rule may
 * use any.
 */
export function classMayUse(klass: Record<string, unknown>, item: ItemLike): boolean {
  if (klass.weaponsAllowed === undefined) return true;
  const optional = isRecord(klass.weaponsAllowed) && isRecord(klass.weaponsAllowed.optional) ? klass.weaponsAllowed.optional.ids : undefined;
  if (Array.isArray(optional) && optional.includes(item.packEntryId)) return true;
  return allows(klass.weaponsAllowed as never, { ...item.data, id: item.packEntryId } as never);
}

/**
 * The row's one line: the weapon's damage and tags from the pack ("d6 · melee, one-handed"); with a rule that sets
 * every weapon's die, that die and its reason ("d6 · All weapons d6 · melee, one-handed").
 */
export function weaponLine(item: ItemLike, rule: DamageRule | null = null): string {
  const w = isRecord(item.data.weapon) ? item.data.weapon : {};
  // A rule that sets every weapon's die (of-8, weaponDamage.ts) replaces the weapon's own, and says why.
  const damage = rule ? `${rule.dice} (${rule.reason})` : text(w.damage);
  const tags = (Array.isArray(item.data.weaponTags) ? item.data.weaponTags : []).map((t) => text(t).toLowerCase()).filter(Boolean);
  if (item.data.hands === 2) tags.push('two-handed');
  else if (item.data.hands === 1) tags.push('one-handed');
  return [damage, tags.join(', ')].filter(Boolean).join(', ');
}

/**
 * Whether a weapon item is not a weapon type of its own (R3-12, 2026-11-08), so never a skill pick: a variant, which
 * carries `baseId` (its base type's skill covers it), or an improvised weapon (`weapon.improvised: true`, 07). The one
 * check for both.
 */
export function isNotAWeaponType(item: ItemLike): boolean {
  const weapon = isRecord(item.data.weapon) ? item.data.weapon : null;
  return text(item.data.baseId) !== '' || weapon?.improvised === true;
}

/** The item id a weapon skill for this weapon is kept under: a variant's base type (R3-12), else its own. */
export const skillIdOf = (item: ItemLike): string => text(item.data.baseId) || item.packEntryId;

/**
 * What the step offers: the weapon types the class may use (never a variant or an improvised weapon, R3-12), grouped
 * by the pack's item category; and those it may not.
 */
export function weaponChoices(
  items: readonly ItemLike[],
  klass: Record<string, unknown>,
  categoryName: (id: string) => { name: string; order: number } | undefined,
): { groups: { name: string; items: ItemLike[] }[]; restricted: ItemLike[] } {
  const weapons = items.filter((w) => isWeapon(w) && !isNotAWeaponType(w));
  const usable = weapons.filter((w) => classMayUse(klass, w));
  const byCat = new Map<string, ItemLike[]>();
  for (const w of usable) {
    const cat = text(w.data.category);
    byCat.set(cat, [...(byCat.get(cat) ?? []), w]);
  }
  const groups = [...byCat.entries()]
    .map(([id, list]) => ({ id, name: categoryName(id)?.name ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Weapons'), order: categoryName(id)?.order ?? 999, items: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ name, items: list }) => ({ name, items: list }));
  return { groups, restricted: weapons.filter((w) => !classMayUse(klass, w)).sort((a, b) => a.name.localeCompare(b.name)) };
}

/** Whether the owner may make this change after approval: only adding unspecialised picks (the database agrees). */
export function ownerMayChange(before: readonly WeaponSkill[], after: readonly WeaponSkill[]): boolean {
  const same = (a: WeaponSkill, b: WeaponSkill) => a.itemId === b.itemId && !!a.specialised === !!b.specialised;
  return before.every((b) => after.some((a) => same(a, b))) && after.filter((a) => !before.some((b) => b.itemId === a.itemId)).every((a) => !a.specialised);
}

/** One modifier a weapon skill brings to a weapon's rolls (weaponPenalty): its figures, its source and its row's label. */
export interface WeaponSkillModifier {
  attack: number;
  damage: number;
  source: 'specialised' | "not your class's weapon" | 'not a weapon skill of yours';
  /** The part row's label on the Attack sheet (as-4): "Specialised", "Not a weapon skill of yours", "Not your class’s weapon". */
  label: string;
}

/**
 * The modifiers a weapon brings to the rolls (as-4, ruling m5b-attack-sheet-skill-and-ammunition-2026-11-10; as-7,
 * m5b-evening-rulings-2026-11-10), each with its source, in the order the Attack sheet shows them. A weapon the class may
 * not use carries the penalty, picked or not: a GM-approved exception is "usable with the penalty" (R3-5). A specialised
 * weapon its bonus, and when it is also outside the class both rows, netted in the line (as-7). One not picked (inside
 * the class), the penalty; a picked one, nothing. A variant (`baseId`) counts as skilled, and specialised, through its
 * base type (R3-12). Empty: nothing to add.
 */
export function weaponPenalty(
  skills: readonly WeaponSkill[],
  item: ItemLike,
  klass: Record<string, unknown>,
  p: Proficiency | null,
  /** The equip check's verdict on the class (classAllowsWeapon: the form in play, the weapon rules), when known. */
  classOk?: boolean,
): WeaponSkillModifier[] {
  if (!p) return [];
  const outside = classOk === undefined ? !classMayUse(klass, item) : !classOk;
  const classPenalty: WeaponSkillModifier[] = p.penalty !== 0 && outside ? [{ attack: p.penalty, damage: 0, source: "not your class's weapon", label: 'Not your class’s weapon' }] : [];
  const pick = skills.find((s) => s.itemId === item.packEntryId || s.itemId === skillIdOf(item));
  if (pick?.specialised && p.specialisation) {
    const { attack, damage } = p.specialisation;
    const special: WeaponSkillModifier[] = attack === 0 && damage === 0 ? [] : [{ attack, damage, source: 'specialised', label: 'Specialised' }];
    return [...special, ...classPenalty];
  }
  if (classPenalty.length > 0 || pick || p.penalty === 0) return classPenalty;
  return [{ attack: p.penalty, damage: 0, source: 'not a weapon skill of yours', label: 'Not a weapon skill of yours' }];
}

/**
 * The class penalty in words, for the sheet's Weapon skills line and the GM's exception card (as-8): "usable at −2 to
 * hit"; '' when the rules set has none.
 */
export const penaltyWords = (p: Pick<Proficiency, 'penalty'>): string => (p.penalty === 0 ? '' : `usable at ${signedNumber(p.penalty)} to hit`);

/** What a non-class weapon's flag says when the pack gives no rule text of its own (R3-5). */
export const NOT_CLASS_WEAPON = "Not one of your class's weapons";

/**
 * The weapon skills the GM must approve specially (R3-5, ruled 2026-11-08, the closed class's path): each pick of a
 * weapon the class may not use (restricted weapons on), with the pack's rule text as the why.
 */
export function weaponApprovals(picks: readonly WeaponSkill[], restricted: readonly { packEntryId: string; name: string }[], p: Pick<Proficiency, 'restricted'>): { step: 'weaponSkills'; entryId: string; name: string; requirement: string }[] {
  if (!p.restricted) return [];
  return picks.flatMap((pick) => {
    const weapon = restricted.find((w) => w.packEntryId === pick.itemId);
    return weapon ? [{ step: 'weaponSkills' as const, entryId: weapon.packEntryId, name: weapon.name, requirement: p.restricted!.note || NOT_CLASS_WEAPON }] : [];
  });
}
