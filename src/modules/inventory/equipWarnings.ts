// Equip warnings from the setting's hooks (docs/05 "Gentle warnings from setting hooks", 07 "Rule hooks" and
// "What allows() checks"; ruled 2026-10-21): a two-handed weapon with a shield, a second suit of armour. Warnings
// don't block: the player does it anyway (logged), takes the hook's one-tap offer (swap, or stow the other item),
// or keeps things as they are. A hook that can't run is skipped and the GM is told. Armour or a weapon the class
// can't use is blocked instead (equipBlocks; ruled 2026-10-25, A10). Pure.
import { namesIn, parseExpression, testHolds, type Value } from '../library/expression.ts';
import { isAmmunition } from '../../core/useWords.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/**
 * Whether a class rule permits an item (docs/07 "What allows() checks"). armourAllowed: armour passes when its
 * types are "any" or include the item's armourType or its armour.tier (G-65). Magic armour of armourType "chosen" is
 * checked against its `chosenBase` (the base item, added by the caller); before one is chosen, against the bases it
 * offers (`baseOptions`): it passes when one fits, or when none are listed (the GM picks the base), and is blocked
 * when none fits (area 3 re-check, 2026-11-03; docs/plans/m5b-review-area-3.md). A shield when shields
 * is true, or "wood"/"metal" is in its material. weaponsAllowed: by mode any (not excluded), list (named, or a tag
 * in alsoAllowTags) or tags (a tag in allowTags; with oneHandedMelee, any one-handed melee weapon). Optional ids
 * aren't read here: equipBlocks lets them pass.
 */
export function allows(rule: Value, item: Value): boolean {
  if (!isRecord(rule) || !isRecord(item)) return false;
  const id = typeof item.id === 'string' ? item.id : '';
  const tags = strings(item.weaponTags).map((t) => t.toLowerCase());
  if (typeof rule.mode === 'string') {
    const ids = strings(rule.ids);
    if (rule.mode === 'any') return !strings(rule.exclude).includes(id);
    if (rule.mode === 'list') return ids.includes(id) || strings(rule.alsoAllowTags).some((t) => tags.includes(t.toLowerCase()));
    if (rule.mode === 'tags') {
      if (strings(rule.allowTags).some((t) => tags.includes(t.toLowerCase()))) return true;
      return rule.oneHandedMelee === true && item.hands !== 2 && tags.includes('melee');
    }
    return false;
  }
  if (item.slot === 'shield') {
    if (rule.shields === true) return true;
    return (rule.shields === 'wood' || rule.shields === 'metal') && strings(item.material).includes(rule.shields);
  }
  if (rule.types === 'any') return true;
  const types = strings(rule.types);
  const fits = (armour: Record<string, unknown>) => armourTypesOf(armour).some((t) => types.includes(t));
  if (item.armourType !== 'chosen') return fits(item);
  if (fits(item)) return true;
  if (isRecord(item.chosenBase)) return fits(item.chosenBase);
  const bases: unknown[] = Array.isArray(item.baseOptions) ? item.baseOptions.filter(isRecord) : [];
  return bases.length === 0 || bases.some((base) => isRecord(base) && fits(base));
}

/** The armour types an item counts as: its armourType (unless "chosen") and its armour.tier (G-65). */
function armourTypesOf(item: Record<string, unknown>): string[] {
  const tier = isRecord(item.armour) && typeof item.armour.tier === 'string' ? [item.armour.tier] : [];
  return [...(typeof item.armourType === 'string' && item.armourType !== 'chosen' ? [item.armourType] : []), ...tier];
}

/** One of a class's forms (07 `classes[].forms`, eq-8): its own weapon and armour limits, or the class's where it has none. */
export interface ClassForm {
  id: string;
  name: string;
  weaponsAllowed: Value | null;
  armourAllowed: Value | null;
  note: string;
}

const noteOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** A class's forms as the app reads them: each with an id and a name; anything else is left out. */
export function formsOf(cls: Value): ClassForm[] {
  if (!isRecord(cls) || !Array.isArray(cls.forms)) return [];
  return cls.forms.flatMap((f) => {
    if (!isRecord(f) || typeof f.id !== 'string' || !f.id.trim()) return [];
    return [
      {
        id: f.id.trim(),
        name: noteOf(f.name) || f.id.trim(),
        weaponsAllowed: isRecord(f.weaponsAllowed) ? (f.weaponsAllowed as Value) : null,
        armourAllowed: isRecord(f.armourAllowed) ? (f.armourAllowed as Value) : null,
        note: noteOf(f.note),
      },
    ];
  });
}

/**
 * The form a character is in (eq-8): the one kept with the character when the class still has it, else the first the
 * class lists (a character who never switched is in the first form); null for a class without forms.
 */
export function currentForm(cls: Value, formId: Value): ClassForm | null {
  const forms = formsOf(cls);
  if (forms.length === 0) return null;
  return forms.find((f) => f.id === formId) ?? forms[0]!;
}

/** The limits the equip check reads: the current form's own, or the class's where the form has none. */
export function limitsInPlay(cls: Value, formId: Value): { weaponsAllowed: Value; armourAllowed: Value; form: ClassForm | null } {
  const form = currentForm(cls, formId);
  const own = isRecord(cls) ? cls : {};
  return {
    weaponsAllowed: form?.weaponsAllowed ?? (own.weaponsAllowed as Value) ?? null,
    armourAllowed: form?.armourAllowed ?? (own.armourAllowed as Value) ?? null,
    form,
  };
}

/** A rules set's weapon rule (07 `weaponRules`, eq-7) as the app reads it. */
export interface WeaponRule {
  category: string;
  classCategories: string[];
  exceptClasses: string[];
  note: string;
}

/** The weapon rules the app reads: each with a category and a list of class categories; anything else is left out. */
export function weaponRulesOf(rules: Value): WeaponRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((r) => {
    if (!isRecord(r) || typeof r.category !== 'string' || !r.category.trim() || !Array.isArray(r.classCategories)) return [];
    return [{ category: r.category.trim(), classCategories: strings(r.classCategories), exceptClasses: strings(r.exceptClasses), note: noteOf(r.note) }];
  });
}

/**
 * The first weapon rule for an item's category (eq-7): a rule's `category` is a weapon tag the item carries, or the
 * item's own `category`, matched without regard to case. Null when no rule names it.
 */
export function weaponRuleFor(rules: Value, item: Value): WeaponRule | null {
  if (!isRecord(item)) return null;
  const kinds = [...strings(item.weaponTags), ...(typeof item.category === 'string' ? [item.category] : [])].map((t) => t.toLowerCase());
  return weaponRulesOf(rules).find((r) => kinds.includes(r.category.toLowerCase())) ?? null;
}

/**
 * What a weapon rule says about this class using the item (eq-7, mb-4): allowed when the rule's class categories
 * include the class's combat category (`weaponProficiencyCategory`) and the class isn't on `exceptClasses`; a class
 * on `exceptClasses`, or with no combat category, follows its own list alone. Null when no rule names the item's category.
 */
export function weaponRuleVerdict(rules: Value, cls: Value, item: Value): { rule: WeaponRule; allowed: boolean; why: string } | null {
  const rule = weaponRuleFor(rules, item);
  if (!rule || !isRecord(cls)) return null;
  const className = noteOf(cls.name) || 'This class';
  const classId = typeof cls.id === 'string' ? cls.id : '';
  const category = noteOf(cls.weaponProficiencyCategory);
  const note = rule.note ? ` ${rule.note}` : '';
  if (classId && rule.exceptClasses.includes(classId)) {
    return { rule, allowed: false, why: `The ${rule.category} rule doesn't apply to ${className}: its own list decides.${note}` };
  }
  const who = rule.classCategories.length > 0 ? `${listWords(rule.classCategories)} classes` : 'no class';
  if (category && rule.classCategories.includes(category)) return { rule, allowed: true, why: `Allowed by the ${rule.category} rule (${who}).${note}` };
  const own = category ? `${className} is ${category}` : `${className} has no combat category, so its own list decides`;
  return { rule, allowed: false, why: `The ${rule.category} rule allows ${who}; ${own}.${note}` };
}

const listWords = (words: string[]) => (words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)!}`);

/**
 * The weapon rule that lets this character use a weapon its class's list (in its current form) lacks, or null: for
 * the Pack row's "By the <category> rule" note (eq-7, mb-4: the rule shows in the allowed explanation too).
 */
export function allowedByRule(character: Value, item: Value, weaponRules: Value): WeaponRule | null {
  if (!isRecord(character) || !isRecord(character.class) || !isRecord(item)) return null;
  if (isAmmunition(item.category) || !(isRecord(item.weapon) || strings(item.weaponTags).length > 0)) return null;
  const list = limitsInPlay(character.class, character.formId ?? null).weaponsAllowed;
  if (!isRecord(list) || allows(list, item)) return null;
  const verdict = weaponRuleVerdict(weaponRules, character.class, item);
  return verdict?.allowed ? verdict.rule : null;
}

/**
 * Why the character's class can't use an item, or nothing (ruled 2026-10-25, A10: equipping against the class's
 * rules is blocked, not warned). Armour and shields by `armourAllowed`, weapons by `weaponsAllowed` (07, allows()),
 * both read from the character's current form when the class has forms (eq-8: `character.formId`; the reason names
 * the form). A class without the rule isn't blocked. `weaponsAllowed.optional.ids` pass: the class reaches here as it
 * is in play, and the setting drops `optional` while its option is off (optionGate.ts; the options audit's arcane
 * staves). A weapon the class's list lacks still passes when a rules set's weapon rule for its category includes the
 * class's combat category (`weaponRules`, eq-7), unless the class is on the rule's `exceptClasses` (mb-4); blocked,
 * the reason names the rule and its note.
 */
export function equipBlocks(character: Value, item: Value, weaponRules: Value = null): string[] {
  return equipBlocksApart(character, item, weaponRules).map(blockWords);
}

/** A block as one written reason: "<rule>. <note> <verdict>" (the Pack's "Not allowed" line, a toast, a kit row). */
export const blockWords = (b: EquipBlock): string => [`${b.rule}.`, b.note, b.why].filter(Boolean).join(' ');

/**
 * One block, in its parts (tfw-4, test feedback 2026-11-19, B5): `rule` is the rule itself, the pop-up's title ("Warden
 * can't use Shortbow", with " in <form>" when a form's rule decides); `note` is the pack's own note on that rule (or the
 * form's), '' without one, shown under the title; `why` is a weapon rule's verdict (eq-7, mb-4), '' without one, which
 * the written reason (equipBlocks) keeps and the pop-up leaves out (tfw-4: nothing else under the title).
 */
export interface EquipBlock {
  rule: string;
  note: string;
  why: string;
}

/** equipBlocks() in its parts: the same blocks, each its rule, its note and a weapon rule's verdict apart. */
export function equipBlocksApart(character: Value, item: Value, weaponRules: Value = null): EquipBlock[] {
  if (!isRecord(character) || !isRecord(character.class) || !isRecord(item)) return [];
  const cls = character.class;
  const className = typeof cls.name === 'string' && cls.name ? cls.name : 'This class';
  const itemName = typeof item.name === 'string' && item.name ? item.name : 'this';
  const limits = limitsInPlay(cls, character.formId ?? null);
  const inForm = limits.form ? ` in ${limits.form.name}` : '';
  // The rule's own note; a form's rule without one falls back to the form's note.
  const because = (rule: Record<string, unknown>, why = ''): EquipBlock => {
    const formRule = limits.form !== null && (rule === limits.form.weaponsAllowed || rule === limits.form.armourAllowed);
    const note = noteOf(rule.note) || (formRule ? limits.form!.note : '');
    return { rule: `${className} can't use ${itemName}${inForm}`, note: note || '', why };
  };
  if (item.slot === 'armour' || item.slot === 'shield') {
    const rule = limits.armourAllowed;
    return isRecord(rule) && !allows(rule, item) ? [because(rule)] : [];
  }
  // Ammunition carries a `weapon` block only for its magic bonus (mw-3): it isn't a weapon the class must allow.
  const isWeapon = !isAmmunition(item.category) && (isRecord(item.weapon) || strings(item.weaponTags).length > 0);
  if (!isWeapon) return [];
  const rule = limits.weaponsAllowed;
  const { classOk, verdict } = classWeaponCheck(cls, limits.weaponsAllowed, item, weaponRules);
  if (!classOk) return [because(rule as Record<string, unknown>, verdict?.why ?? '')];
  // The kindred's weapon limit, read beside the class's (cs-6, G-88: a Small kindred can't wield Large weapons). The
  // character's race is the kindred as the class plays it (a kindred-class replaces its limits, cs-4).
  const race = isRecord(character.race) ? character.race : null;
  const raceRule = race?.weaponsAllowed;
  if (!race || !isRecord(raceRule) || allows(raceRule, item)) return [];
  const raceName = typeof race.name === 'string' && race.name ? race.name : 'Your kindred';
  return [{ rule: `${raceName} can't use ${itemName}`, note: typeof raceRule.note === 'string' ? raceRule.note.trim() : '', why: '' }];
}

/** The class side of the weapon check: the list in play (its optional ids pass), else a weapon rule's verdict (eq-7). */
function classWeaponCheck(cls: Value, rule: Value, item: Value, weaponRules: Value): { classOk: boolean; verdict: ReturnType<typeof weaponRuleVerdict> } {
  const optional = isRecord(rule) && isRecord(rule.optional) ? strings(rule.optional.ids) : [];
  const id = isRecord(item) && typeof item.id === 'string' ? item.id : null;
  const listOk = !isRecord(rule) || (id !== null && optional.includes(id)) || allows(rule, item);
  const verdict = listOk ? null : weaponRuleVerdict(weaponRules, cls, item);
  return { classOk: listOk || verdict?.allowed === true, verdict };
}

/**
 * Whether the character's class may use a weapon, as the equip check decides it (equipBlocks' class side): the list of
 * the class's current form (eq-8), its optional ids, and the rules sets' weapon rules (eq-7, mb-4). The kindred's limit
 * isn't the class's, so it isn't read. A character without a class: true. For the Attack sheet's "Not your class’s
 * weapon" (as-4), so the penalty and the equip block never disagree.
 */
export function classAllowsWeapon(character: Value, item: Value, weaponRules: Value = null): boolean {
  if (!isRecord(character) || !isRecord(character.class) || !isRecord(item)) return true;
  return classWeaponCheck(character.class, limitsInPlay(character.class, character.formId ?? null).weaponsAllowed, item, weaponRules).classOk;
}

export interface CastingStop {
  /** The status the pack names ("Can't kindle"), or "Can't cast". */
  statusName: string;
  /** "Chainmail stops divine casting." plus the pack's note. */
  reason: string;
  /** The toast's words: "Chainmail stops divine casting" ("…stops your casting" when the class has no casting type). */
  short: string;
  /** The muted note on the gear's row in the Pack: "Stops divine casting". */
  note: string;
}

/**
 * Whether an item stops the character's casting (docs/07 spellcasting.blockedBy; ruled 2026-10-25, B25): armour of a
 * listed type (or "any"), a shield (true, or of that material), or an item with a listed tag. A rule limited to
 * castingTypes applies only to those. Such gear can still be worn; the character gets the derived status.
 */
export function castingStoppedBy(character: Value, item: Value): CastingStop | null {
  if (!isRecord(character) || !isRecord(character.class) || !isRecord(item)) return null;
  const casting = character.class.spellcasting;
  if (!isRecord(casting) || !isRecord(casting.blockedBy)) return null;
  const rule = casting.blockedBy;
  const castingType = typeof casting.castingType === 'string' ? casting.castingType : '';
  const types = strings(rule.castingTypes);
  if (types.length > 0 && !types.includes(castingType)) return null;
  let stops = false;
  if (item.slot === 'armour') {
    stops = rule.armour === 'any' || (typeof item.armourType === 'string' && strings(rule.armour).includes(item.armourType));
  } else if (item.slot === 'shield') {
    stops = rule.shields === true || ((rule.shields === 'wood' || rule.shields === 'metal') && strings(item.material).includes(rule.shields));
  }
  const tags = [...strings(item.weaponTags), ...strings(item.tags)].map((t) => t.toLowerCase());
  if (!stops) stops = strings(rule.tags).some((t) => tags.includes(t.toLowerCase()));
  if (!stops) return null;
  const itemName = typeof item.name === 'string' && item.name ? item.name : 'This';
  const note = typeof rule.note === 'string' && rule.note.trim() ? ` ${rule.note.trim()}` : '';
  const what = castingType ? `${castingType} casting` : 'your casting';
  const short = `${itemName} stops ${what}`;
  return {
    statusName: typeof casting.statusName === 'string' && casting.statusName.trim() ? casting.statusName.trim() : "Can't cast",
    reason: `${short}.${note}`,
    short,
    note: `Stops ${what}`,
  };
}

/** The derived status from everything worn or held: its name and the reasons, or null when casting is free. */
export function castingStatus(character: Value, equipped: readonly Value[]): { statusName: string; reasons: string[] } | null {
  const stops = equipped.flatMap((item) => {
    const stop = castingStoppedBy(character, item);
    return stop ? [stop] : [];
  });
  return stops.length === 0 ? null : { statusName: stops[0]!.statusName, reasons: stops.map((s) => s.reason) };
}

export interface EquipWarning {
  id: string;
  message: string;
  offer: 'swap' | 'stowOther' | null;
  /** What's in the way, by where it's worn or held (armour, shield, hand): what the offer takes off first. */
  inTheWay: string[];
}

/** A `{character.class.name}` placeholder filled from the names; an unknown one is blank (docs/07). */
function fill(message: string, names: Record<string, Value>): string {
  return message.replace(/\{([^{}]*)\}/g, (_, path: string) => {
    let value: Value = names as Value;
    for (const part of path.trim().split('.')) value = isRecord(value) ? (value[part] ?? null) : null;
    return value === null || typeof value === 'object' ? '' : String(value);
  });
}

/**
 * The equip warnings the setting's hooks give for putting an item on: `names` are the event's (character, item,
 * equipped). Hooks whose test can't run are named in `skipped`.
 */
export function equipWarnings(hooks: readonly Record<string, unknown>[], names: { character: Value; item: Value; equipped: Value }): { warnings: EquipWarning[]; skipped: string[] } {
  const warnings: EquipWarning[] = [];
  const skipped: string[] = [];
  const scope = { names: names as Record<string, Value>, functions: { allows: ([rule, item]: Value[]) => allows(rule ?? null, item ?? null) } };
  for (const hook of hooks.filter((h) => h.kind === 'warn' && h.when === 'equip')) {
    if (hook.appliesTo !== undefined && hook.appliesTo !== 'pc' && hook.appliesTo !== 'any') continue;
    const id = String(hook.id ?? 'a warning');
    if (typeof hook.test === 'string') {
      const holds = testHolds(hook.test, scope);
      if (holds === null) {
        skipped.push(id);
        continue;
      }
      if (!holds) continue;
    }
    const offer = hook.offer === 'swap' || hook.offer === 'stowOther' ? hook.offer : null;
    // What the offer moves: the equipped slots the test looks at (equipped.shield, equipped.hand…).
    const inTheWay =
      offer && typeof hook.test === 'string'
        ? [...new Set(namesIn(parseExpression(hook.test)).paths.filter((p) => p.startsWith('equipped.')).map((p) => p.split('.')[1]!))]
        : [];
    warnings.push({ id, message: fill(typeof hook.message === 'string' ? hook.message : '', names as Record<string, Value>), offer, inTheWay });
  }
  return { warnings, skipped };
}
