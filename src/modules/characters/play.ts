// The Player screen's figures (ruled 2026-10-26: the glance screen for play): the fields that read as AC and the
// attack figure, the hit-point bar's segments, the class's skills in the pack's own style with their odds both
// ways (CS-5a), and the saves with the pack's short names. Pure; every name and number comes from the pack.
import { conSaveBonus, saveKeyOf, type Filled } from '../library/fills.ts';
import { successChance, type SkillChance } from '../library/skillChance.ts';
import type { FieldDefinition } from './fields.ts';
import { AC_KEY, signed } from './explain.ts';
import { acBonusCounts, armourStateOf, saveBonusesOn, saveBonusLead, type AcBonus } from './bonuses.ts';
import { ruleWeaponDamage } from './weaponDamage.ts';
import { adjustDice } from '../library/patches.ts';
import { skillOdds } from './skillOdds.ts';
import { isAmmunition } from '../../core/useWords.ts';
import type { WeaponSkillModifier } from './weaponSkills.ts';

/**
 * The character's weapon skill for a weapon (weaponPenalty): its modifiers, or one alone. Specialised in a weapon outside
 * the class brings two, "Specialised" and "Not your class’s weapon", netted in the line (as-7).
 */
export type SkillOption = WeaponSkillModifier | readonly WeaponSkillModifier[] | null | undefined;
const skillList = (skill: SkillOption): readonly WeaponSkillModifier[] => (!skill ? [] : Array.isArray(skill) ? skill : [skill as WeaponSkillModifier]);

/** A weapon skill's figures as parts (as-4, as-7): each modifier's to-hit row and damage row, each only when it isn't zero. */
const skillParts = (skill: SkillOption) => ({
  hit: skillList(skill).flatMap((s) => (s.attack !== 0 ? [{ label: s.label, value: s.attack }] : [])),
  damage: skillList(skill).flatMap((s) => (s.damage !== 0 ? [{ label: s.label, value: s.damage }] : [])),
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The fields that read as AC and as the attack figure (a sheet layout's AC, or one linked to the attack fill). */
export function combatFields(fieldDefs: readonly FieldDefinition[]): { ac: FieldDefinition | undefined; attack: FieldDefinition | undefined } {
  const byLabel = (test: (f: FieldDefinition) => boolean) => fieldDefs.find((f) => !f.hidden && test(f));
  return {
    ac: byLabel((f) => /^(ac|armou?r class)$/i.test(f.key) || /^(ac|armou?r class)$/i.test(f.label)),
    attack: byLabel((f) => f.fill === 'attack' || /^(attack|thac0)/i.test(f.label)),
  };
}

/** The most segments the hit-point bar draws; past it, one continuous bar. */
export const HP_SEGMENTS_MOST = 20;

/**
 * The hit-point bar (M6-3, ruled 2026-10-26): one segment per HP up to 12, one per 5 HP above; each segment's
 * fill from 0 to 1 (a part-lost segment fills partly). No segments without a maximum. Past 20 segments (a most
 * above 100) it is one continuous bar, filled to the part left (plan m5b-sheet-revised 13: the pips cap at 20).
 */
export function hpSegments(current: number | null, max: number | null): { per: number; fills: number[] } {
  if (max === null || max < 1) return { per: 1, fills: [] };
  const now = Math.max(0, Math.min(current ?? 0, max));
  if (Math.ceil(max / 5) > HP_SEGMENTS_MOST) return { per: max, fills: [now / max] };
  const per = max > 12 ? 5 : 1;
  const count = Math.ceil(max / per);
  return {
    per,
    fills: Array.from({ length: count }, (_, i) => {
      const size = Math.min(per, max - i * per);
      return Math.max(0, Math.min(1, (now - i * per) / size));
    }),
  };
}

/** The attack sub-line from the scores ("Melee +1 · Missile −1"; CS-8), empty when the setting gives none. */
export function attackLine(filled: Filled): string {
  const parts: string[] = [];
  for (const kind of ['melee', 'missile']) {
    for (const [name, row] of Object.entries(filled)) {
      if (!name.startsWith('abilityModifiers.') || !isRecord(row) || typeof row[kind] !== 'number') continue;
      parts.push(`${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${signed(row[kind] as number)}`);
    }
  }
  return parts.join(', ');
}

/** The class's progression row at a level (the highest at or below it). */
function progressionRow(klass: Record<string, unknown> | null, level: number): Record<string, unknown> | null {
  const rows = (Array.isArray(klass?.progression) ? klass.progression : []).filter(isRecord);
  return rows.filter((r) => typeof r.level === 'number' && r.level <= level).sort((a, b) => (b.level as number) - (a.level as number))[0] ?? null;
}

/**
 * Whether the class's attack figure is a bonus added to the d20, as the weapon's roll lines read it (`weaponRolls`):
 * any AC style but descending, from a class row whose figure is a bonus (`attackBonus`, or `attack` with no `thac0`).
 * The Player screen's Attack tile signs the figure then ("+1", as frame P1 of december/14 reads "+2").
 */
export function attackIsBonus(klass: Record<string, unknown> | null, level: number, direction: AcDirection | null): boolean {
  if (direction === 'descending') return false;
  const row = progressionRow(klass, level);
  return typeof row?.attackBonus === 'number' || (typeof row?.attack === 'number' && row.thac0 === undefined);
}

/** A to-hit part from outside the weapon's own figure: a weapon mode's `toHit` (ah-1, G-211), named by the mode. */
export interface AttackPart {
  label: string;
  value: number;
}

/**
 * A weapon's magic in its figures (mw-1, mw-2, mw-3; rulings m6-weapon-magic-bonus-2026-11-05 and -2): the parts that
 * add to both rolls (the weapon's `magicBonus`, and the drawn ammunition's under `attack.ammunitionBonus: "add"`), and
 * the notes the app shows but never applies (each `bonusVs`: "+3 vs bog lurkers", "damage +4 vs bog lurkers").
 */
export interface WeaponMagic {
  parts: AttackPart[];
  hitNotes: string[];
  damageNotes: string[];
}

export const NO_MAGIC: WeaponMagic = { parts: [], hitNotes: [], damageNotes: [] };

/** The magic's notes for a line under At hand's figure (mw-1): each once, the GM's ammunition note not repeated. */
export const magicNoteLines = (magic: WeaponMagic): string[] => [...new Set([...magic.hitNotes, ...magic.damageNotes])];

/**
 * A weapon's magic as the viewer may see it (mw-1 point 4, the armour rule of 2026-10-24): a bonus on an unidentified or
 * cursed weapon (bonusHidden) is left out of the player's numbers and notes entirely; the GM (`seesHidden`) sees it,
 * marked "(hidden from the player)". The ammunition's bonus (`ammo`: the stack the mode draws, its item data), under the
 * same hidden rule: where a rules set says `attack.ammunitionBonus: "add"` both count (mw-3); with no rule, from a launcher
 * with no magic bonus of its own (none or 0) the ammunition's counts (mw-5, ruling
 * m5b-attack-sheet-skill-and-ammunition-2026-11-10), and from a launcher with one only the launcher's counts and the GM
 * sees the ammunition's as a note (mw-4). A launcher bonus the viewer can't see (unidentified, cursed, negative) counts as
 * none for them. A curse, a negative bonus on the weapon or its ammunition, always counts, whatever the launcher and the
 * rule (as-5, ruling m5b-evening-rulings-2026-11-10), still hidden from the player. The ammunition's own `bonusVs` are
 * notes that name it ("Ember arrows, +3 vs bog lurkers"), never added, shown to whoever may see the ammunition's bonus,
 * under mw-4 too (as-6). An unidentified item's figures stay hidden from the player until it's identified; seeing them
 * after one use in a fight is M6's (id-1, deferred on purpose).
 */
export function weaponMagic(
  weapon: { name: string; data: Record<string, unknown>; category?: string; told?: readonly string[] },
  rulesSets: readonly Record<string, unknown>[],
  seesHidden: boolean,
  ammo: { name: string; data: Record<string, unknown>; category?: string; told?: readonly string[] } | null = null,
): WeaponMagic {
  const magic: WeaponMagic = { parts: [], hitNotes: [], damageNotes: [] };
  const bonusOf = (data: Record<string, unknown>) => {
    const value = isRecord(data.weapon) ? data.weapon.magicBonus : undefined;
    return typeof value === 'number' && Number.isInteger(value) && value !== 0 ? value : null;
  };
  // K22a: a bonus the GM told (the line's revealed fields hold "bonus") is the player's, curse or not.
  const toldOf = (thing: { told?: readonly string[] }) => thing.told?.includes('bonus') === true;
  const hiddenOf = (thing: { data: Record<string, unknown>; category?: string; told?: readonly string[] }) =>
    bonusHidden({ name: '', slot: null, armour: null, category: thing.category ?? text(thing.data.category), cursed: thing.data.cursed === true, told: thing.told }, rulesSets);
  const marked = (hidden: boolean) => (hidden ? ' (hidden from the player)' : '');
  // Each `bonusVs` entry as a note under the roll it changes (mw-2); `named` leads it with the thing's name (the ammunition's).
  const notesVs = (data: Record<string, unknown>, hidden: boolean, named: string) => {
    const vs = isRecord(data.weapon) && Array.isArray(data.weapon.bonusVs) ? data.weapon.bonusVs.filter(isRecord) : [];
    for (const v of vs) {
      const against = text(v.against);
      if (!against) continue;
      if (typeof v.bonus === 'number' && Number.isInteger(v.bonus)) magic.hitNotes.push(`${named}${signed(v.bonus)} vs ${against}${marked(hidden)}`);
      else if (typeof v.damage === 'number' && Number.isInteger(v.damage)) magic.damageNotes.push(`${named}damage ${signed(v.damage)} vs ${against}${marked(hidden)}`);
    }
  };
  const own = bonusOf(weapon.data);
  // A negative bonus is a curse: hidden from the player even where `cursed` is a GM-hidden field their copy lacks (#594 review).
  const ownHidden = !toldOf(weapon) && (hiddenOf(weapon) || (own !== null && own < 0));
  if (!ownHidden || seesHidden) {
    if (own !== null) magic.parts.push({ label: `${weapon.name}, magic${marked(ownHidden)}`, value: own });
    notesVs(weapon.data, ownHidden, '');
  }
  const attack = merged(rulesSets).attack;
  const bonus = ammo ? bonusOf(ammo.data) : null;
  const ammoHidden = ammo ? !toldOf(ammo) && (hiddenOf(ammo) || (bonus !== null && bonus < 0)) : false;
  // The ammunition counts under mw-3 (the rule adds both) or mw-5 (no rule, a launcher with no bonus of its own). A
  // launcher bonus this viewer can't see counts as none, so the missing row doesn't give the bow away (#606 review). A
  // curse (a negative bonus) always counts, whatever the launcher and the rule (as-5); it stays hidden from the player.
  // A cursed launcher isn't "a launcher with a bonus of its own" that silences the ammunition's (Design, 2026-11-10,
  // built not ruled: both count).
  const launcherHas = own !== null && own > 0 && (!ownHidden || seesHidden);
  const ammoCounts = (isRecord(attack) && attack.ammunitionBonus === 'add') || !launcherHas || (bonus !== null && bonus < 0);
  if (ammo && bonus !== null) {
    if (ammoCounts) {
      if (!ammoHidden || seesHidden) magic.parts.push({ label: `${ammo.name}, magic${marked(ammoHidden)}`, value: bonus });
    } else if (seesHidden) {
      // mw-4: with no rule, from a magic launcher, the app adds nothing and notes the ammunition's bonus for the GM.
      const note = `${ammo.name}, magic ${signed(bonus)}. Not added: the rules don’t say.`;
      magic.hitNotes.push(note);
      magic.damageNotes.push(note);
    }
  }
  // The ammunition's bonus against a kind of foe: a note naming it, never added, shown to whoever may see the
  // ammunition's bonus, also where its plain bonus is the GM's mw-4 note (as-6).
  if (ammo && (!ammoHidden || seesHidden)) notesVs(ammo.data, ammoHidden, `${ammo.name}, `);
  return magic;
}

/**
 * A weapon at hand's attack bonus and damage (M5 gate C3, ruled 2026-11-01; 05 At hand): "+2 · 1d8+1", or with a
 * weapon that is both "Melee +2 · 1d4+1 · Missile +0 · 1d4". The bonus is the class's attack bonus at this level (the
 * progression row's `attackBonus`, or its `attack` when the row has no `thac0`; 07 classes) plus the scores' melee
 * or missile modifier (the same rows as the Player screen's "Melee +1 · Missile −1"), by the weapon's Melee and
 * Missile tags. The damage is the pack's `weapon.damage` plus, when the rules set's `attack.damageScore` names a score
 * (C3's follow-up, ruled 2026-11-01; 07), that score's modifier for the weapon's kind (its melee or missile column, so
 * a score with only a melee modifier adds to melee damage alone). Without a class attack bonus, the damage shows
 * alone; without `damageScore`, the die alone; nothing at all for an item that isn't a weapon. With descending AC
 * (`options.direction`, the campaign's `ac-style`; A4, bq3-13) the figure is the class's target number at this level
 * (`thac0`) less the score's modifier, after the attack field's name ("THAC0 19 · 1d8"). A rules set's
 * `attack.weaponDamage` (of-8; weaponDamage.ts) replaces every weapon's own die, and `options.damageReason` (the
 * rule's reason, weaponDamageRule) follows the damage: "+2 · d6+1 · All weapons d6".
 */
export function weaponFigures(
  item: Record<string, unknown> | null | undefined,
  filled: Filled,
  klass: Record<string, unknown> | null,
  level: number,
  rulesSets: readonly Record<string, unknown>[] = [],
  options: { direction?: AcDirection; targetLabel?: string; damageReason?: string | null; damageDelta?: number; attack?: AttackPart | null; magic?: WeaponMagic; skill?: SkillOption } = {},
): string | null {
  const { damageReason = null, damageDelta = 0 } = options;
  // The weapon's magic (mw-1, mw-3) adds to both rolls; its notes (bonusVs) follow the figure, never applied.
  const magic = options.magic ?? NO_MAGIC;
  const magicSum = magic.parts.reduce((n, p) => n + p.value, 0);
  // A weapon skill's bonus or penalty (as-4) counts in both, as on the Attack sheet.
  const skillHit = skillList(options.skill).reduce((n, s) => n + s.attack, 0);
  const skillDamage = skillList(options.skill).reduce((n, s) => n + s.damage, 0);
  const delta = (options.attack?.value ?? 0) + skillHit + magicSum;
  // Ammunition carries a `weapon` block only for its bonus (mw-3): it has no figure of its own.
  if (!item || !isRecord(item.weapon) || isAmmunition(item.category)) return null;
  // A rule that sets every weapon's die (of-8) wins over the weapon's own, then takes the patches' deltas
  // (`damageDelta`, lineInPlay: "d6" with Bone −1 → "d6−1"); the reason follows the damage when given.
  const ruleDie = ruleWeaponDamage(rulesSets);
  const damage = ruleDie ? (damageDelta !== 0 ? (adjustDice(ruleDie, damageDelta) ?? ruleDie) : ruleDie) : text(item.weapon.damage);
  const reason = ruleDie ? damageReason : null;
  const row = progressionRow(klass, level);
  // With descending AC the figure is the target number (`thac0`), which a score's modifier lowers (A4, bq3-13).
  const descending = options.direction === 'descending';
  const target = typeof row?.thac0 === 'number' ? row.thac0 : typeof row?.attack === 'number' && row.attackBonus === undefined ? row.attack : null;
  const classBonus = descending ? target : typeof row?.attackBonus === 'number' ? row.attackBonus : typeof row?.attack === 'number' && row.thac0 === undefined ? row.attack : null;
  const tags = [...(Array.isArray(item.weaponTags) ? item.weaponTags : []), ...(Array.isArray(item.weapon.qualities) ? item.weapon.qualities : [])].map((t) => String(t).toLowerCase());
  const kinds = (['melee', 'missile'] as const).filter((k) => tags.includes(k));
  const scoreBonus = (kind: string) =>
    Object.entries(filled).reduce((sum, [name, value]) => (name.startsWith('abilityModifiers.') && isRecord(value) && typeof value[kind] === 'number' ? sum + (value[kind] as number) : sum), 0);
  const attack = merged(rulesSets).attack;
  const damageScore = isRecord(attack) ? text(attack.damageScore) : '';
  const damageRow = damageScore ? filled[`abilityModifiers.${damageScore}`] : undefined;
  const damageFor = (kind: string | null) => {
    const mod = (kind && isRecord(damageRow) && typeof damageRow[kind] === 'number' ? (damageRow[kind] as number) : 0) + skillDamage + magicSum;
    return damage && mod !== 0 ? `${damage}${signed(mod)}` : damage;
  };
  const bonusFor = (kind: string | null) =>
    classBonus === null ? null : descending ? acNumber(classBonus - (kind ? scoreBonus(kind) : 0) - delta) : signed(classBonus + (kind ? scoreBonus(kind) : 0) + delta);
  if (kinds.length < 2) {
    const kind = kinds[0] ?? null;
    const bonus = bonusFor(kind);
    const parts = [bonus !== null && descending && options.targetLabel ? `${options.targetLabel} ${bonus}` : bonus, damageFor(kind), reason].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  // Both kinds: each with its own bonus; the damage once when it's the same both ways, else beside each.
  const sameDamage = damageFor('melee') === damageFor('missile');
  const parts = kinds.flatMap((k) => {
    const name = k === 'melee' ? 'Melee' : 'Missile';
    const bonus = bonusFor(k);
    if (sameDamage) return bonus === null ? [] : [`${name} ${bonus}`];
    return [bonus === null ? `${name} ${damageFor(k)}` : `${name} ${bonus}`, ...(bonus === null ? [] : [damageFor(k)])];
  });
  const all = [...(sameDamage ? [...parts, damageFor('melee')] : parts), reason];
  const shown = all.filter(Boolean);
  return shown.length > 0 ? shown.join(', ') : null;
}

/**
 * A weapon at hand's breakdown (sq-4, 2026-11-04: its figure opens a breakdown like every other figure): one row per
 * part of the line weaponFigures shows, with the same numbers. The class's figure at this level ("Lantern Warden at
 * level 3 · +2"); then for each of the weapon's kinds the scores' modifier and the attack with it ("Melee · STR +1 ·
 * +3"); then the damage ("Damage · 1d8", or the rule's die named by its reason), and each kind's damage with the
 * `attack.damageScore` modifier ("Damage · MUS +1 · 1d8+1"). Empty for an item that isn't a weapon. A weapon's magic
 * (mw-1, mw-3; `options.magic`) adds a row to each, in the same running way ("Fenblade, magic +1 · +3"); its bonusVs
 * notes follow as rows of their own. A weapon skill's bonus or penalty (as-4; `options.skill`) adds the same way, before the
 * magic ("Specialised +1 · +4").
 */
export function weaponBreakdown(
  item: Record<string, unknown> | null | undefined,
  filled: Filled,
  klass: Record<string, unknown> | null,
  level: number,
  rulesSets: readonly Record<string, unknown>[] = [],
  options: {
    direction?: AcDirection;
    damageReason?: string | null;
    damageDelta?: number;
    klassName?: string | null;
    shortName?: (ability: string) => string;
    /** A weapon mode's own to-hit (ah-1, G-211): its own row, named by the mode. */
    attack?: AttackPart | null;
    /** Where the damage die comes from when it isn't the weapon's own (a mode's die: "Damage, Ember arrows"). */
    damageSource?: string | null;
    /** The weapon's magic as the viewer may see it (weaponMagic). */
    magic?: WeaponMagic;
    /** The character's weapon skill for it (as-4, as-7; weaponPenalty): specialised, a penalty, or both. */
    skill?: SkillOption;
  } = {},
): { label: string; value: string }[] {
  const { damageReason = null, damageDelta = 0, shortName = (a: string) => a } = options;
  const magic = options.magic ?? NO_MAGIC;
  if (!item || !isRecord(item.weapon) || isAmmunition(item.category)) return [];
  const ruleDie = ruleWeaponDamage(rulesSets);
  const damage = ruleDie ? (damageDelta !== 0 ? (adjustDice(ruleDie, damageDelta) ?? ruleDie) : ruleDie) : text(item.weapon.damage);
  const row = progressionRow(klass, level);
  const descending = options.direction === 'descending';
  const target = typeof row?.thac0 === 'number' ? row.thac0 : typeof row?.attack === 'number' && row.attackBonus === undefined ? row.attack : null;
  const classBonus = descending ? target : typeof row?.attackBonus === 'number' ? row.attackBonus : typeof row?.attack === 'number' && row.thac0 === undefined ? row.attack : null;
  const tags = [...(Array.isArray(item.weaponTags) ? item.weaponTags : []), ...(Array.isArray(item.weapon.qualities) ? item.weapon.qualities : [])].map((t) => String(t).toLowerCase());
  const kinds = (['melee', 'missile'] as const).filter((k) => tags.includes(k));
  const mods = (kind: string) =>
    Object.entries(filled).flatMap(([name, value]) => (name.startsWith('abilityModifiers.') && isRecord(value) && typeof value[kind] === 'number' ? [{ ability: name.slice('abilityModifiers.'.length), value: value[kind] as number }] : []));
  const show = (n: number) => (descending ? acNumber(n) : signed(n));
  const kindName = (k: string) => `${k.charAt(0).toUpperCase()}${k.slice(1)}`;
  const rows: { label: string; value: string }[] = [];
  if (classBonus !== null) {
    rows.push({ label: options.klassName ? `${options.klassName} at level ${level}` : `Class at level ${level}`, value: show(classBonus) });
    for (const kind of kinds) {
      const each = mods(kind);
      if (each.length === 0) continue;
      const sum = each.reduce((n, m) => n + m.value, 0);
      rows.push({ label: [kindName(kind), ...each.map((m) => `${shortName(m.ability)} ${signed(m.value)}`)].join(', '), value: show(descending ? classBonus - sum : classBonus + sum) });
    }
    // A mode's own to-hit (ah-1): its row adds to the weapon's one kind (or to the class's figure without one).
    const part = options.attack;
    if (part && part.value !== 0) {
      const sum = kinds.length === 1 ? mods(kinds[0]!).reduce((n, m) => n + m.value, 0) : 0;
      rows.push({ label: `${part.label}, ${signed(part.value)}`, value: show(descending ? classBonus - sum - part.value : classBonus + sum + part.value) });
    }
    // The weapon skill (as-4), then the weapon's magic (mw-1, mw-3): each part adds on, as the figure's line counts it.
    let running = (kinds.length === 1 ? mods(kinds[0]!).reduce((n, m) => n + m.value, 0) : 0) + (part?.value ?? 0);
    for (const m of [...skillParts(options.skill).hit, ...magic.parts]) {
      running += m.value;
      rows.push({ label: `${m.label} ${signed(m.value)}`, value: show(descending ? classBonus - running : classBonus + running) });
    }
    for (const note of magic.hitNotes) rows.push({ label: note, value: 'not counted' });
  }
  if (damage) {
    rows.push({ label: ruleDie && damageReason ? `Damage, ${damageReason}` : !ruleDie && options.damageSource ? `Damage, ${options.damageSource}` : 'Damage', value: damage });
    const attack = merged(rulesSets).attack;
    const damageScore = isRecord(attack) ? text(attack.damageScore) : '';
    const damageRow = damageScore ? filled[`abilityModifiers.${damageScore}`] : undefined;
    for (const kind of kinds) {
      const mod = isRecord(damageRow) && typeof damageRow[kind] === 'number' ? (damageRow[kind] as number) : 0;
      if (mod === 0) continue;
      rows.push({ label: [kinds.length > 1 ? `${kindName(kind)} damage` : 'Damage', `${shortName(damageScore)} ${signed(mod)}`].join(', '), value: `${damage}${signed(mod)}` });
    }
    // The skill (as-4) and the magic (mw-1) add to the damage too, after the score's modifier for a weapon of one kind.
    let running = kinds.length === 1 && isRecord(damageRow) && typeof damageRow[kinds[0]!] === 'number' ? (damageRow[kinds[0]!] as number) : 0;
    for (const m of [...skillParts(options.skill).damage, ...magic.parts]) {
      running += m.value;
      rows.push({ label: `Damage, ${m.label} ${signed(m.value)}`, value: running === 0 ? damage : `${damage}${signed(running)}` });
    }
    for (const note of magic.damageNotes) rows.push({ label: note, value: 'not counted' });
  }
  return rows;
}

/** One part of a roll on the Attack sheet (as-1): its name and its own figure, never a running total. */
export interface RollPart {
  label: string;
  value: string;
}

/**
 * One roll on the Attack sheet (as-1, ruling m5b-attack-sheet-clarity-2026-11-10): the dice the player rolls, the plain
 * line ("Roll 1d20 + 1 to hit", "Roll 1d6 − 1 for damage"), a note under it in words where the roll is read some other
 * way, and its parts as rows, each with its own figure.
 */
export interface AttackRoll {
  roll: 'hit' | 'damage';
  /** The dice as written ("1d20", "1d6", a rule's "d6"): the glyph beside the line is the first die in it. */
  dice: string;
  line: string;
  /**
   * What the line adds to the dice, the sum of its rows' figures (0 when the line adds nothing). Worked out here, once:
   * the Player screen's weapon in hand (dec-13 C14) reads it rather than adding the parts again.
   */
  adds: number;
  /** Which of a weapon's two kinds this roll is for ("in melee", "as a missile"), when it has both and they differ; else null. */
  which: 'melee' | 'missile' | null;
  /**
   * A to-hit read against a target figure (descending AC): its line has no "to hit", and nothing that shows it may add
   * one (as-1: never roll-high-and-add). False for damage and for a to-hit that adds to a bonus.
   */
  againstTarget: boolean;
  /**
   * A line in words just under the roll's line, for the Roll card; null. None is set today: the one there was, on who
   * reads a hit made against a target, went with tfw-2 (2026-11-19; voice rule 16).
   */
  lineNote: string | null;
  /** Lines in words under the parts, never added: a bonus against a kind of foe, the GM's ammunition note (mw-1, mw-4). */
  notes: string[];
  parts: RollPart[];
}

/** What a roll's line adds: nothing for a zero (as-1: "Roll 1d20 to hit"), " + 2", or " − 1" for a negative. */
export const rollAdds = (n: number) => (n === 0 ? '' : n > 0 ? ` + ${n}` : ` − ${-n}`);

/**
 * A weapon's rolls for the Attack sheet (as-1, plan m5b-attack-sheet-clarity): the to-hit roll first, then the damage,
 * each a line carrying the sum and its parts as rows with their own figures (the class at its level, each score's
 * modifier by its full name and score, the mode's own to-hit, the weapon's die, the rules' change to it, the damage
 * score's modifier, or that it doesn't add in words). A weapon both melee and missile has a to-hit roll for each, and a
 * damage roll for each when they differ. With descending AC the class's figure is a target, never added: the line says
 * the die and what the scores add, with no "to hit" and no note under it (tfw-2, 2026-11-19), and the class's row says
 * the target ("hits armour 0 on 19"). No to-hit roll without the class's figure; no damage roll without a die; none for
 * a non-weapon.
 *
 * Each roll's figures are a list of parts summed for its line: a magic weapon's bonus (mw-1) and, where the setting
 * adds it, its ammunition's (mw-3) are parts of both rolls ("Fenblade, magic +1"); a bonus against a kind of foe is a
 * note under the roll it changes, never added (mw-1, mw-2). A weapon skill (as-4) is a part too, before the magic:
 * "Specialised" in both rolls, "Not a weapon skill of yours" or "Not your class’s weapon" to hit.
 */
export function weaponRolls(
  item: Record<string, unknown> | null | undefined,
  filled: Filled,
  klass: Record<string, unknown> | null,
  level: number,
  rulesSets: readonly Record<string, unknown>[] = [],
  options: {
    direction?: AcDirection;
    damageReason?: string | null;
    damageDelta?: number;
    klassName?: string | null;
    /** A score's full name ("Nimbleness"). */
    longName?: (ability: string) => string;
    /** A score's value, shown after its name ("Nimbleness 13") when known. */
    scoreOf?: (ability: string) => number | null;
    /** A weapon mode's own to-hit (ah-1, G-211): its own row, named by the mode. */
    attack?: AttackPart | null;
    /** Where the die comes from when it isn't the weapon's own (a mode's die: "Ember arrows"). */
    damageSource?: string | null;
    /** The weapon's magic as the viewer may see it (weaponMagic). */
    magic?: WeaponMagic;
    /** The character's weapon skill for it (as-4, as-7; weaponPenalty): a row "Specialised" in both rolls, a penalty to hit, or both. */
    skill?: SkillOption;
  } = {},
): AttackRoll[] {
  const magic = options.magic ?? NO_MAGIC;
  const skill = skillParts(options.skill);
  const { damageReason = null, damageDelta = 0, longName = (a: string) => a } = options;
  if (!item || !isRecord(item.weapon) || isAmmunition(item.category)) return [];
  const ruleDie = ruleWeaponDamage(rulesSets);
  const die = ruleDie ?? text(item.weapon.damage);
  const row = progressionRow(klass, level);
  const descending = options.direction === 'descending';
  const target = typeof row?.thac0 === 'number' ? row.thac0 : typeof row?.attack === 'number' && row.attackBonus === undefined ? row.attack : null;
  const classFigure = descending ? target : typeof row?.attackBonus === 'number' ? row.attackBonus : typeof row?.attack === 'number' && row.thac0 === undefined ? row.attack : null;
  const tags = [...(Array.isArray(item.weaponTags) ? item.weaponTags : []), ...(Array.isArray(item.weapon.qualities) ? item.weapon.qualities : [])].map((t) => String(t).toLowerCase());
  const kinds = (['melee', 'missile'] as const).filter((k) => tags.includes(k));
  const each: ('melee' | 'missile' | null)[] = kinds.length > 0 ? kinds : [null];
  const scoreName = (ability: string) => {
    const score = options.scoreOf?.(ability) ?? null;
    return score === null ? longName(ability) : `${longName(ability)} ${score}`;
  };
  const toHitMods = (kind: string | null) =>
    kind === null
      ? []
      : Object.entries(filled).flatMap(([name, value]) =>
          name.startsWith('abilityModifiers.') && isRecord(value) && typeof value[kind] === 'number' ? [{ label: scoreName(name.slice('abilityModifiers.'.length)), value: value[kind] as number }] : [],
        );
  const suffix = (kind: string | null) => (kinds.length < 2 ? '' : kind === 'melee' ? ', in melee' : ', as a missile');
  const rolls: AttackRoll[] = [];
  if (classFigure !== null) {
    const klassRow = options.klassName ? `${options.klassName}, level ${level}` : `Class, level ${level}`;
    for (const kind of each) {
      // The figures that add to the roll, each its own row; the line carries their sum.
      const adds: AttackPart[] = [...(descending ? [] : [{ label: klassRow, value: classFigure }]), ...toHitMods(kind), ...(options.attack ? [options.attack] : []), ...skill.hit, ...magic.parts];
      const sum = adds.reduce((n, p) => n + p.value, 0);
      const parts: RollPart[] = [...(descending ? [{ label: klassRow, value: `hits armour 0 on ${acNumber(classFigure)}` }] : []), ...adds.map((p) => ({ label: p.label, value: signed(p.value) }))];
      rolls.push({
        roll: 'hit',
        dice: '1d20',
        line: descending ? `Roll 1d20${rollAdds(sum)}${suffix(kind)}` : `Roll 1d20${rollAdds(sum)} to hit${suffix(kind)}`,
        adds: sum,
        which: kinds.length < 2 ? null : kind,
        againstTarget: descending,
        lineNote: null,
        notes: magic.hitNotes,
        parts,
      });
    }
  }
  if (die) {
    const attack = merged(rulesSets).attack;
    const damageScore = isRecord(attack) ? text(attack.damageScore) : '';
    const damageRow = damageScore ? filled[`abilityModifiers.${damageScore}`] : undefined;
    const dieRow = ruleDie ? (damageReason ?? 'Every weapon') : (options.damageSource ?? (text(item.name) || 'Weapon'));
    const damage = kinds.length > 0 ? kinds : [null];
    const built = damage.map((kind): AttackRoll => {
      const adds: AttackPart[] = [];
      const parts: RollPart[] = [{ label: dieRow, value: die }];
      if (ruleDie && damageDelta !== 0) adds.push({ label: 'Changed by your rules', value: damageDelta });
      if (isRecord(damageRow)) {
        const mod = kind ? damageRow[kind] : undefined;
        if (typeof mod === 'number') adds.push({ label: scoreName(damageScore), value: mod });
        else if (kind && Object.values(damageRow).some((v) => typeof v === 'number')) parts.push({ label: longName(damageScore), value: kind === 'missile' ? 'not added to a missile' : 'not added in melee' });
      }
      adds.push(...skill.damage, ...magic.parts);
      parts.push(...adds.map((p) => ({ label: p.label, value: signed(p.value) })));
      const sum = adds.reduce((n, p) => n + p.value, 0);
      return { roll: 'damage', dice: die, line: `Roll ${die}${rollAdds(sum)} for damage${suffix(kind)}`, adds: sum, which: kinds.length < 2 ? null : kind, againstTarget: false, lineNote: null, notes: magic.damageNotes, parts };
    });
    // Both kinds alike: one damage roll, without "in melee" or "as a missile".
    const alike = built.length === 2 && JSON.stringify(built[0]!.parts) === JSON.stringify(built[1]!.parts);
    rolls.push(...(alike ? [{ ...built[0]!, line: built[0]!.line.replace(/, in melee$/, ''), which: null }] : built));
  }
  return rolls;
}

export interface Skill {
  code: string;
  name: string;
  /** In the pack's own style: "2-in-6", "35%", or the value as the pack gives it. */
  shown: string;
  /** Both ways ("Succeeds on 5 or 6, 2 in 6"), when the style says how it's rolled. */
  odds: string | null;
  /** Its chance of success, to compare it with another skill (ex-3, ga-4; skillChance.ts); null when the notation doesn't say. */
  chance: SkillChance | null;
  /** The GM rolls it secretly (the class's gmRolls, or the rules set skill's). */
  gmRolls: boolean;
  /** What the race says beside it ("5 when foraging"; fills.ts raceNotes); absent when it says nothing. */
  raceNote?: string;
  /** The race's number is the one that counts (sr-2: a kindred's change shows as a tag). */
  byRace?: boolean;
  /** Everyone's skill (the rules set's `skills`) or the class's own (sr-2). */
  group: 'everyone' | 'class';
  /**
   * What the skill does, in the pack's words (R3-13): the rules set skill's `notes`, else the class's `skills.notes`
   * entry for it (G-210). Absent when the pack says nothing; a class's `skills.notes` written as one string is the
   * class-wide line (`skills.note`), never one skill's text.
   */
  text?: string;
}

export { skillOdds };

/**
 * A character's skills at this level in two groups (sr-2): **everyone's** (the rules set's `skills`, in its order and
 * by its names) and then **the class's own** (the rest, in the order the class names them). Each in the pack's
 * notation (skillOdds) and named as the pack names it, capitals and all, the Player screen too; `notes` what the race
 * says beside each; `byRace` when the race's number is the one that counts.
 */
export function skillsOf(
  filled: Filled,
  klass: Record<string, unknown> | null,
  notes: Readonly<Record<string, string>> = {},
  rulesSets: readonly Record<string, unknown>[] = [],
  refs: { race?: Record<string, unknown> | null; raceRef?: string | null } = {},
): Skill[] {
  const skills = klass && isRecord(klass.skills) ? klass.skills : {};
  const names = isRecord(skills.names) ? skills.names : {};
  const gm = Array.isArray(skills.gmRolls) ? skills.gmRolls.map(String) : [];
  const classWords = isRecord(skills.notes) ? skills.notes : {};
  const listed = merged(rulesSets).skills;
  const everyone = (Array.isArray(listed) ? listed : []).filter(isRecord).filter((d) => text(d.id) !== '');
  const ofEveryone = new Map(everyone.map((d) => [text(d.id), d]));
  const codes = Object.keys(filled).filter((k) => k.startsWith('skills.')).map((k) => k.slice('skills.'.length));
  const classOrder = [...Object.keys(names).filter((c) => codes.includes(c)), ...codes.filter((c) => !(c in names))].filter((c) => !ofEveryone.has(c));
  const raceTargets = isRecord(refs.race?.skillTargets) ? refs.race.skillTargets : {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const one = (code: string, group: Skill['group']): Skill => {
    const def = ofEveryone.get(code);
    const value = filled[`skills.${code}`]!;
    // Everyone's skill reads its own die and roll; the class's own, the class's.
    const scale = def ? { die: def.die ?? skills.die, rollMode: def.rollMode ?? skills.rollMode } : { die: skills.die, rollMode: skills.rollMode };
    const { shown, odds } = skillOdds(value, scale.die, scale.rollMode);
    const raceNote = notes[`skills.${code}`];
    const fill = def && isRecord(def.fill) ? def.fill : {};
    const raceValue = num(raceTargets[code]) ?? (isRecord(fill.races) && refs.raceRef ? num(fill.races[refs.raceRef]) : null);
    const byRace = def !== undefined && raceValue !== null && raceValue === num(value) && raceValue !== num(def.default);
    const words = text(def?.notes) || text(classWords[code]);
    return {
      code,
      name: (def ? text(def.name) : '') || text(names[code]) || code,
      shown,
      odds,
      chance: successChance(value, scale),
      gmRolls: gm.includes(code) || def?.gmRolls === true,
      group,
      ...(raceNote ? { raceNote } : {}),
      ...(byRace ? { byRace } : {}),
      ...(words ? { text: words } : {}),
    };
  };
  return [...[...ofEveryone.keys()].filter((c) => codes.includes(c)).map((c) => one(c, 'everyone')), ...classOrder.map((c) => one(c, 'class'))];
}

/**
 * The class's one line on its skills as a whole (G-210, R3-13): its `skills.note`, else a `skills.notes` written as one
 * string (older packs, until they're rebuilt); '' when the pack has none. Shown muted at the top of the Skills list.
 */
export function classSkillsNote(klass: Record<string, unknown> | null): string {
  const skills = klass && isRecord(klass.skills) ? klass.skills : {};
  return text(skills.note) || text(skills.notes);
}

export interface Save {
  key: string;
  name: string;
  /** The Save tile's word: the pack's short name ("Wands"), else the name's first word, else "Save <key>"; never the bare key. */
  short: string;
  value: string;
  /** The pack's words for this save, if it has any. */
  note: string;
  /** What the race says beside it ("+3 to the roll vs poison"; fills.ts raceNotes); absent when it says nothing. */
  raceNote?: string;
}

/** The rules sets merged, the highest winning. */
const merged = (rulesSets: readonly Record<string, unknown>[]) => Object.assign({}, ...rulesSets) as Record<string, unknown>;

/** The saves at this level, in the setting's order, with its names; `notes` what the race says beside each. */
export function savesOf(filled: Filled, rulesSets: readonly Record<string, unknown>[], notes: Readonly<Record<string, string>> = {}): Save[] {
  const categories = merged(rulesSets).saveCategories;
  const list: Record<string, unknown>[] = Array.isArray(categories)
    ? categories.filter(isRecord)
    : isRecord(categories)
      ? Object.entries(categories).map(([key, c]) => (isRecord(c) ? { key, ...c } : { key, name: c }))
      : [];
  const keys = Object.keys(filled).filter((k) => k.startsWith('saves.')).map((k) => k.slice('saves.'.length));
  const known = (k: string) => list.find((c) => c.key === k || c.id === k);
  const order = [...list.map((c) => String(c.key ?? c.id ?? '')).filter((k) => keys.includes(k)), ...keys.filter((k) => !known(k))];
  return order.map((key) => {
    const c = known(key) ?? {};
    return {
      key,
      name: text(c.name) || `Save ${key}`,
      // The Save tile's word (the 2026-11-09 ruling, gate finding F8): the pack's short name, else the first word of its
      // name ("Death" from "Death ray or poison"), never the bare key; a pack fixes a wrong guess with `short` (G-216).
      // An `abbreviation` no longer than the key ("D") is the key again, so it doesn't count.
      short: text(c.short) || (text(c.abbreviation).length > key.length ? text(c.abbreviation) : '') || (text(c.name).split(/\s+/)[0] ?? '').replace(/[,;:/]+$/, '') || `Save ${key}`,
      value: String(filled[`saves.${key}`] ?? '—'),
      // The setting's short description (N23): `notes` as everywhere in packs, or `note` / `description`.
      note: text(c.notes) || text(c.note) || text(c.description),
      ...(notes[`saves.${key}`] ? { raceNote: notes[`saves.${key}`] } : {}),
    };
  });
}

/** What a save's "Modifiers" read from: the character's filled figures, its kindred and class, and the scores. */
export interface SaveModifierInput {
  filled: Filled;
  rulesSets: readonly Record<string, unknown>[];
  race: Record<string, unknown> | null;
  raceName: string | null;
  klass: Record<string, unknown> | null;
  className: string | null;
  scores: Record<string, number>;
  /** A score's long name ("Lore"). */
  label: (key: string) => string;
}

const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const capital = (words: string) => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/**
 * A save's "Modifiers" (sv-2b, and the lead's ruling on ⚑ 1 of plan dec-player-figure-sheet): each thing that really
 * changes this save for this character, one line each, worded as a score's line is, "<what>: +N from <where>.":
 *  - a save modifier a score drives (`saveModifiers` `{ from, plusRaceField }`): the score's own part, from its filled
 *    row as fills.ts ruleFills reads it ("Spell ward: +1 from Lore."), and the kindred's part (`plusRaceField`) on its
 *    own line ("Spell ward: +2 from Stone kin."). The pack doesn't say which save it belongs to, so every save has it;
 *  - the kindred's bonus by its Constitution row (`saveBonusByCon`) for the saves it names ("Vs poison: +3 from Stone
 *    kin."), and the kindred's and class's `saveBonus` ("To the roll: +2 from Lantern Warden.").
 * A part that gives nothing is left out; none at all means no section. The class-and-level number is where the save
 * comes from, not a modifier, so it is never here. No new arithmetic: each part is a number the pack gives.
 */
export function saveModifierLines(saveKey: string, input: SaveModifierInput): string[] {
  const lines: string[] = [];
  const kindred = input.raceName ?? 'your kindred';
  const klass = input.className ?? 'your class';
  for (const m of (Array.isArray(merged(input.rulesSets).saveModifiers) ? (merged(input.rulesSets).saveModifiers as unknown[]) : []).filter(isRecord).filter(fromScore)) {
    const spec = m.value as Record<string, unknown>;
    const name = capital(text(m.name) || text(m.tag) || text(m.against) || text(m.id));
    const from = String(spec.from);
    const field = typeof spec.plusRaceField === 'string' ? spec.plusRaceField : '';
    const row = input.filled[`abilityModifiers.${from}`];
    const numbers = isRecord(row) ? Object.values(row).filter((v): v is number => typeof v === 'number') : [];
    const fromScoreRow = isRecord(row) && field && typeof row[field] === 'number' ? (row[field] as number) : numbers.length === 1 ? numbers[0]! : null;
    if (fromScoreRow) lines.push(`${name}: ${signed(fromScoreRow)} from ${input.label(from)}.`);
    const fromKindred = field ? whole(input.race?.[field]) : null;
    if (fromKindred) lines.push(`${name}: ${signed(fromKindred)} from ${kindred}.`);
  }
  const byCon = conSaveBonus(input.race, input.scores);
  const table = isRecord(input.race?.saveBonusByCon) ? input.race.saveBonusByCon : null;
  if (byCon && table && Array.isArray(table.saves)) {
    for (const s of table.saves.filter((x): x is string => typeof x === 'string' && x.trim() !== '')) {
      const { key, against } = saveKeyOf(s);
      if (key === saveKey) lines.push(`${saveBonusLead(against)}: ${signed(byCon)} from ${kindred}.`);
    }
  }
  for (const b of saveBonusesOn(input.race, saveKey)) lines.push(`${saveBonusLead(b.against)}: ${signed(b.bonus)} from ${kindred}.`);
  for (const b of saveBonusesOn(input.klass, saveKey)) lines.push(`${saveBonusLead(b.against)}: ${signed(b.bonus)} from ${klass}.`);
  return lines;
}

/** Which way AC runs: higher is better (ascending) or lower is better (descending). */
export type AcDirection = 'ascending' | 'descending';

/**
 * The setting's AC direction: the rules set's `attack.style`, else the campaign's AC-style choice (an option id
 * starting with the style, "descending-…"), else the only style `attack.unarmouredAC` names, else ascending.
 */
export function acDirection(rulesSets: readonly Record<string, unknown>[], chosenStyle: string | null = null): AcDirection {
  return acDirectionStated(rulesSets, chosenStyle) ?? 'ascending';
}

/**
 * The AC direction only when the setting says it (its `attack.style`, the campaign's AC-style choice, or the one
 * style `attack.unarmouredAC` names); null when it doesn't, so the attack figure stays as the class gives it (A4).
 */
export function acDirectionStated(rulesSets: readonly Record<string, unknown>[], chosenStyle: string | null = null): AcDirection | null {
  const attack = merged(rulesSets).attack;
  const read = (style: string): AcDirection | null => (/^desc/i.test(style) ? 'descending' : /^asc/i.test(style) ? 'ascending' : null);
  const said = (isRecord(attack) && read(text(attack.style))) || (chosenStyle ? read(chosenStyle) : null);
  if (said) return said;
  const unarmoured = isRecord(attack) ? (attack.unarmouredAC ?? attack.unarmouredAc) : null;
  const named = isRecord(unarmoured) ? [...new Set(Object.keys(unarmoured).map(read).filter((d): d is AcDirection => d !== null))] : [];
  return named.length === 1 ? named[0]! : null;
}

/**
 * Something worn that sets AC: its name, where it's worn (`slot`: armour, shield, or another slot for a bonus item)
 * and its pack `armour` block; its category and whether it's cursed say whether a magic bonus is hidden.
 */
export interface WornGear {
  name: string;
  slot: unknown;
  armour: unknown;
  category?: string;
  cursed?: boolean;
  /** The facts the GM has told on the item's line (K22b, its `revealedFields`): "bonus" makes its bonus the player's. */
  told?: readonly string[];
  /**
   * Magic armour whose base is picked when it's found (`armour.baseArmour: { choose: [item ids] }`; ruled
   * 2026-10-29): the base armour chosen for this item (its name and its pack armour block), stored per item and
   * logged. Null or missing until it's chosen.
   */
  chosenBase?: { id: string; name: string; armour: unknown } | null;
  /** The chosen base's item id as the line keeps it (resolved to chosenBase from the setting rules). */
  baseArmourId?: string | null;
  /** The item's line, for choosing its base from AC ("Choose base armour"). */
  line?: { id: string; version: number };
  /**
   * An attached pack's patch changed its armour block (of-13, bq3-17 (7)): the block as the pack has it, and a line
   * for each figure changed ("AC −1 · Bronze, Mire zine"), so the breakdown shows the pack's figure, then the patch.
   */
  patched?: { before: unknown; lines: string[] };
}

/** AC worked out from the setting (ruled 2026-10-29, B9): the number, or null when the setting can't say. */
export interface AcWorkedOut {
  /** Null while what's worn is still loading, or when the setting gives no AC for it ("—" and Set AC). */
  value: number | null;
  /** The breakdown, one line each, in the setting's direction: the base, then each modifier. */
  lines: string[];
  /** False until what's worn is known. */
  known: boolean;
  /**
   * Worn magic armour whose base hasn't been chosen yet: its name and the item ids to choose from. While it's set
   * the value is null and AC shows "Choose base armour", not "—" (acEmpty).
   */
  chooseBase?: { item: string; choices: string[] };
}

const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Worn armour's AC in the setting's direction (07, the armour block; ruled 2026-10-29): a plain number is the base;
 * a block gives `aac` (ascending) or `ac` (descending) for the matching direction, else `base` (the rules set's
 * direction).
 */
function armourAc(armour: unknown, direction: AcDirection): number | null {
  if (asNumber(armour) !== null) return asNumber(armour);
  if (!isRecord(armour)) return null;
  return (direction === 'ascending' ? asNumber(armour.aac) : asNumber(armour.ac)) ?? asNumber(armour.base);
}

/** Magic armour's `baseArmour.choose`: the item ids its base is picked from; null when it has none. */
export function baseArmourChoices(armour: unknown): string[] | null {
  if (!isRecord(armour) || !isRecord(armour.baseArmour) || !Array.isArray(armour.baseArmour.choose)) return null;
  const ids = armour.baseArmour.choose.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
  return ids.length ? ids : null;
}

/** Whether an equipped item counts for AC: armour or a shield, or any item whose armour block gives a bonus. */
export function wornForAc(details: Record<string, unknown>): boolean {
  if (details.slot === 'armour' || details.slot === 'shield') return true;
  const armour = details.armour;
  return isRecord(armour) && (asNumber(armour.acBonus) !== null || asNumber(armour.magicBonus) !== null);
}

/**
 * Whether a worn item's magic bonus is hidden from the player (the 2026-10-24 rule, as ruled for AC on 2026-10-29):
 * the item is unidentified, that is in a category the rules set marks `unidentified: true`, or cursed, and the GM hasn't
 * told its bonus (K22a: the line's revealed fields hold "bonus" once told; until then the player's numbers leave it out).
 */
export function bonusHidden(gear: WornGear, rulesSets: readonly Record<string, unknown>[]): boolean {
  if (gear.told?.includes('bonus')) return false;
  if (gear.cursed === true) return true;
  if (!gear.category) return false;
  return rulesSets.some(
    (rules) => Array.isArray(rules.itemCategories) && rules.itemCategories.some((c) => isRecord(c) && c.id === gear.category && c.unidentified === true),
  );
}

/** "−2" for a negative number, else the number. */
export const acNumber = (value: number) => (value < 0 ? `−${-value}` : String(value));

/**
 * AC as players use it (ruled 2026-10-29, B9 and the armour block): the base (worn armour's AC from the pack, else
 * the setting's AC with nothing worn), each shield's bonus (its `armour.acBonus`, else the rules set's
 * `attack.shieldBonus`), any other worn item's `armour.acBonus`, each worn item's `armour.magicBonus`, and each
 * ability modifier the scores give AC. Bonuses make AC better: added when AC ascends, taken off when it descends.
 * A hidden magic bonus (bonusHidden) counts only for those who see hidden things (the GM): the player's numbers
 * leave it out, with no line hinting at it. When the pack gives no number for the base or a shield, the value is
 * null: never a guess.
 */
export function workOutAc(input: {
  rulesSets: readonly Record<string, unknown>[];
  chosenStyle: string | null;
  /** What the character wears; null while it's loading. */
  worn: readonly WornGear[] | null;
  filled: Filled;
  /** An ability's long name. */
  abilityName: (ability: string) => string;
  /** The GM: sees the true AC, hidden magic bonuses included. */
  seesHidden?: boolean;
  /** The kindred's and class's own AC bonuses (cs-7; bonuses.ts acBonusesOf), each counted when its condition holds. */
  bonuses?: readonly AcBonus[];
}): AcWorkedOut {
  if (input.worn === null) return { value: null, lines: [], known: false };
  const direction = acDirection(input.rulesSets, input.chosenStyle);
  const attack = merged(input.rulesSets).attack;
  const better = (bonus: number) => (direction === 'ascending' ? bonus : -bonus);
  const lines: string[] = [];
  const armour = input.worn.find((g) => g.slot === 'armour');
  // Magic armour with baseArmour.choose: AC is the chosen base's plus its magicBonus; until a base is chosen, none.
  const choices = armour ? baseArmourChoices(armour.armour) : null;
  const chosen = choices ? (armour?.chosenBase ?? null) : null;
  const chooseBase = choices && !chosen ? { item: armour!.name, choices } : undefined;
  const base = chooseBase ? null : chosen ? armourAc(chosen.armour, direction) : armour ? armourAc(armour.armour, direction) : unarmouredAc(input.rulesSets, input.chosenStyle);
  const baseName = armour ? (chosen ? `${armour.name} (${chosen.name})` : armour.name) : 'Unarmoured';
  // A patched figure (of-13): the pack's own number on the item's line, then each patch's line; the total is the patched one.
  const patchedArmour = armour && !chosen && !chooseBase && armour.patched && base !== null ? armour.patched : null;
  const shownBase = patchedArmour ? (armourAc(patchedArmour.before, direction) ?? base) : base;
  lines.push(chooseBase ? `${baseName}: choose base armour` : base === null ? `${baseName}: no AC in the setting rules` : `${baseName}: ${acNumber(shownBase!)}`);
  if (patchedArmour) lines.push(...patchedArmour.lines);
  let total = base;
  for (const shield of input.worn.filter((g) => g.slot === 'shield')) {
    const bonus = (isRecord(shield.armour) ? asNumber(shield.armour.acBonus) : null) ?? (isRecord(attack) ? asNumber(attack.shieldBonus) : null);
    if (bonus === null) {
      lines.push(`${shield.name}: no AC bonus in the setting rules`);
      total = null;
      continue;
    }
    const before = shield.patched && isRecord(shield.patched.before) ? asNumber(shield.patched.before.acBonus) : null;
    lines.push(`${shield.name}: ${signed(better(before ?? bonus))}`);
    if (shield.patched && before !== null) lines.push(...shield.patched.lines);
    if (total !== null) total += better(bonus);
  }
  // Other worn items that make AC better (a ring, a cloak): their own acBonus.
  for (const item of input.worn.filter((g) => g.slot !== 'armour' && g.slot !== 'shield')) {
    const bonus = isRecord(item.armour) ? asNumber(item.armour.acBonus) : null;
    if (bonus === null || bonus === 0) continue;
    lines.push(`${item.name}: ${signed(better(bonus))}`);
    if (total !== null) total += better(bonus);
  }
  // Magic bonuses: the player's numbers leave out a hidden one until it's revealed; the GM sees it, marked.
  for (const item of input.worn) {
    const bonus = isRecord(item.armour) ? asNumber(item.armour.magicBonus) : null;
    if (bonus === null || bonus === 0) continue;
    const hidden = bonusHidden(item, input.rulesSets);
    if (hidden && !input.seesHidden) continue;
    lines.push(`${item.name}, magic: ${signed(better(bonus))}${hidden ? ' (hidden from the player)' : ''}`);
    if (total !== null) total += better(bonus);
  }
  for (const [name, row] of Object.entries(input.filled)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row)) continue;
    const ability = name.slice('abilityModifiers.'.length);
    for (const [key, value] of Object.entries(row)) {
      if (!AC_KEY.test(key) || typeof value !== 'number' || value === 0) continue;
      lines.push(`${input.abilityName(ability)}: ${signed(better(value))}`);
      if (total !== null) total += better(value);
    }
  }
  // The kindred's and class's own bonuses (cs-7): counted when the condition holds; the others named, not counted.
  const state = armourStateOf(armour);
  for (const bonus of input.bonuses ?? []) {
    const counts = acBonusCounts(bonus, state);
    const amount = signed(better(bonus.value));
    if (counts === 'counts') {
      lines.push(bonus.when ? `${bonus.source}, ${bonus.when}: ${amount}` : `${bonus.source}: ${amount}`);
      if (total !== null) total += better(bonus.value);
    } else if (counts === 'not-now') lines.push(`${bonus.source}: ${amount} only when ${bonus.when}, not now`);
    else if (counts === 'unknown') lines.push(`${bonus.source}: ${amount} only when ${bonus.when}; the setting doesn't say how heavy ${armour?.name ?? 'the armour'} is, so it isn't counted`);
    else lines.push(`${bonus.source}: ${amount} ${bonus.when}, counted at the table`);
  }
  if (direction === 'descending') lines.push('Lower is better.');
  return chooseBase ? { value: null, lines, known: true, chooseBase } : { value: total, lines, known: true };
}

/** What AC shows with no number: "Choose base armour" while worn magic armour waits for its base, else "—". */
export function acEmpty(worked: AcWorkedOut): string {
  return worked.chooseBase ? 'Choose base armour' : '—';
}

/**
 * The AC to show (ruled 2026-10-29, B9 and Set AC): the character's AC set by hand (Set AC, kept per character);
 * else a value typed in the sheet's AC field; else the worked-out number; else null, shown as "—" with a quiet
 * Set AC.
 */
export function acShown(fieldValue: string | null, worked: AcWorkedOut, setByHand: number | null = null): string | null {
  if (setByHand !== null) return acNumber(setByHand);
  if (fieldValue !== null) return fieldValue;
  return worked.value === null ? null : acNumber(worked.value);
}

/**
 * AC's pop-up: what it's made of (B9), or that it was set by hand (with what Clear brings back), or why there's no
 * number. It ends with how the figure is worked out, never with a line about the GM (tfw-1, 2026-11-19; voice rule 16).
 * Character creation adds its own line after it (creationAcLines).
 */
export function acLines(fieldValue: string | null, worked: AcWorkedOut, setByHand: number | null = null): string[] {
  if (setByHand !== null) {
    const back = fieldValue ?? (worked.value === null ? null : acNumber(worked.value));
    return [`Set by hand: ${acNumber(setByHand)}.`, back === null ? 'Clear it to go back to "—".' : `Clear it to go back to ${back}.`];
  }
  if (fieldValue !== null) return [`Set by hand: ${fieldValue}.`];
  if (!worked.known) return ["Reading what's worn…"];
  if (worked.chooseBase) return [...worked.lines, `Choose the base armour for ${worked.chooseBase.item} to work out AC.`];
  if (worked.value === null) return [...worked.lines, "There's no number to show, so enter it by hand."];
  return worked.lines;
}

/**
 * The setting's AC with nothing worn (N22, ruled 2026-10-28): the rules set's `attack.unarmouredAC`, either one
 * number or one per AC style (`{ "descending": 9, "ascending": 10 }`). The style is the rules set's
 * `attack.style`, else the campaign's AC-style choice (an option id that names the style, "descending-…"), else
 * the only one given, else the first. Null when the setting gives none.
 */
export function unarmouredAc(rulesSets: readonly Record<string, unknown>[], chosenStyle: string | null = null): number | null {
  const attack = merged(rulesSets).attack;
  if (!isRecord(attack)) return null;
  const value = attack.unarmouredAC ?? attack.unarmouredAc;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!isRecord(value)) return null;
  const styles = Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number');
  const named = (style: string) => styles.find(([key]) => style === key || style.startsWith(`${key}-`) || style.startsWith(`${key}_`));
  const found = (text(attack.style) && named(text(attack.style))) || (chosenStyle && named(chosenStyle)) || styles[0];
  return found ? found[1] : null;
}

/** A save modifier that a score drives (its `value.from` names the score; 07 `saveModifiers`, fills.ts ruleFills). */
const fromScore = (m: Record<string, unknown>) => isRecord(m.value) && typeof m.value.from === 'string';

/**
 * How saves are rolled and what changes them, from the rules set (`saveRule`, `saveModifiers`), as plain lines.
 * `scoresApart`: leave out the save modifiers a score drives (a save's sheet shows them under "Modifiers", sv-2b).
 */
export function saveRules(rulesSets: readonly Record<string, unknown>[], { scoresApart = false }: { scoresApart?: boolean } = {}): string[] {
  const all = merged(rulesSets);
  const lines: string[] = [];
  if (text(all.saveRule)) lines.push(text(all.saveRule));
  else if (isRecord(all.saveRule) && text(all.saveRule.text)) lines.push(text(all.saveRule.text));
  const mods = Array.isArray(all.saveModifiers) ? all.saveModifiers.filter(isRecord).filter((m) => !(scoresApart && fromScore(m))) : [];
  for (const m of mods) {
    const name = text(m.name) || text(m.tag) || text(m.against);
    const value = typeof m.value === 'number' ? signed(m.value) : typeof m.modifier === 'number' ? signed(m.modifier) : '';
    if (name || value) lines.push([name, value].filter(Boolean).join(' '));
  }
  return lines;
}
