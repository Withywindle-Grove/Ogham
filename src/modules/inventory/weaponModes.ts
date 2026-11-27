// Weapon modes (ruling m5b-at-hand-actions-2026-11-08, ah-3 and ah-4; G-211; 07 `weapon.modes`): a bow fires one of its
// arrow stacks, a spear is held or thrown, a lance is used normally or to charge. The pack writes one block per weapon,
// `weapon.modes: { button, list: [{ id, name, draws?, qualities?, damage?, toHit?, note? }] }`; the button's word comes
// from a short list (Quiver, Pouch, Grip, Stance; never "Mode"), the first mode is the default, and a mode that `draws`
// a stack spends one of it at each use. Plain functions; the At hand row and its sheets draw them.
import type { InventoryLine } from './inventory.ts';
import { countWords } from './packView.ts';
import type { UseVerb } from '../../core/useWords.ts';
import { withThe } from '../../core/nameWords.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The button's word, from the short list (ah-4). */
export type ModeButton = 'quiver' | 'pouch' | 'grip' | 'stance';
export const MODE_BUTTON_WORDS: Record<ModeButton, string> = { quiver: 'Quiver', pouch: 'Pouch', grip: 'Grip', stance: 'Stance' };

export interface WeaponMode {
  id: string;
  name: string;
  /** The item id of the stack one use spends (its `draws.itemId`); null when nothing is spent. */
  draws: string | null;
  /** The weapon's own qualities that apply in this mode; null: all of them. */
  qualities: string[] | null;
  /** The mode's own damage die, where the book gives one. */
  damage: string | null;
  /** The mode's own to-hit adjustment, a whole number, where the book gives one. */
  toHit: number | null;
  note: string | null;
  /** The mode's own range (a spear's Thrown; as-2, G-219), when the pack gives one the app can read. */
  range: WeaponRange | null;
}

/** A range band (as-2, G-219): its name as the pack writes it, how far it reaches, what it does to the to-hit roll. */
export interface RangeBand {
  name: string;
  upTo: number;
  toHit: number;
}

/** A weapon's range (as-2, G-219; 07 `weapon.range`): the unit, the wilderness's unit when it differs, where the first band starts, the bands. */
export interface WeaponRange {
  unit: string;
  wildernessUnit: string | null;
  from: number | null;
  bands: RangeBand[];
}

/**
 * A range as the pack writes it (G-219: `{ unit, wildernessUnit?, from?, bands: [{ name, upTo, toHit }] }`), or null when
 * there is none or the app can't trust it: no unit, no bands, a band without a name, a figure that isn't a whole number,
 * or bands that don't reach further each time. Null leaves the quality's text to say the range, as before.
 */
export function rangeOf(value: unknown): WeaponRange | null {
  if (!isRecord(value)) return null;
  const unit = text(value.unit);
  if (!unit || !Array.isArray(value.bands) || value.bands.length === 0) return null;
  if (value.wildernessUnit !== undefined && !text(value.wildernessUnit)) return null;
  if (value.from !== undefined && !(Number.isInteger(value.from) && (value.from as number) >= 0)) return null;
  const from = value.from === undefined ? null : (value.from as number);
  const bands: RangeBand[] = [];
  let start = from ?? 0;
  for (const b of value.bands) {
    if (!isRecord(b)) return null;
    const name = text(b.name);
    if (!name || !Number.isInteger(b.upTo) || !Number.isInteger(b.toHit) || (b.upTo as number) < start) return null;
    bands.push({ name, upTo: b.upTo as number, toHit: b.toHit as number });
    start = (b.upTo as number) + 1;
  }
  return { unit, wildernessUnit: text(value.wildernessUnit), from, bands };
}

/** The range an attack uses (as-2): the mode in use's own, else the weapon's, else none. */
export function attackRange(item: Record<string, unknown>, mode: WeaponMode | null): WeaponRange | null {
  return mode?.range ?? rangeOf(isRecord(item.weapon) ? item.weapon.range : null);
}

/** Where the party is, for the range's unit (as-2): on a wilderness expedition, in a dungeon, or not known (no expedition). */
export type RangeWhere = 'wilderness' | 'dungeon' | null;

/**
 * The Range heading (as-2, G-219 as ruled on #588): on a wilderness expedition the wilderness unit ("Range, in yards");
 * elsewhere the unit, with the wilderness's beside it when the party's whereabouts aren't known ("Range, in feet (yards
 * outdoors)"); with no wilderness unit, "Range, in feet" everywhere.
 */
export function rangeHeading(range: WeaponRange, where: RangeWhere = null): string {
  if (!range.wildernessUnit) return `Range, in ${range.unit}`;
  if (where === 'wilderness') return `Range, in ${range.wildernessUnit}`;
  if (where === 'dungeon') return `Range, in ${range.unit}`;
  return `Range, in ${range.unit} (${range.wildernessUnit} outdoors)`;
}

/**
 * Each band's distance and effect (as-2): the first band "5 to 160" when the pack gives where it starts (`from`), else
 * "up to 70"; each later band "up to 320"; its effect "+1 to hit", a zero "+0 to hit" (the mockup's words).
 */
export function rangeBands(range: WeaponRange): { name: string; reach: string; effect: string }[] {
  return range.bands.map((b, i) => ({
    name: b.name,
    reach: i === 0 && range.from !== null ? `${range.from} to ${b.upTo}` : `up to ${b.upTo}`,
    effect: `${b.toHit < 0 ? '−' : '+'}${Math.abs(b.toHit)} to hit`,
  }));
}

export interface WeaponModes {
  button: ModeButton;
  list: WeaponMode[];
}

/**
 * A weapon's modes as the pack writes them (G-211), or null: no `weapon.modes`, a button word not on the short list, or no
 * mode with an id and a name. A mode the app can't read is left out.
 */
export function weaponModesOf(item: Record<string, unknown> | null | undefined): WeaponModes | null {
  const weapon = item && isRecord(item.weapon) ? item.weapon : null;
  const block = weapon && isRecord(weapon.modes) ? weapon.modes : null;
  if (!block) return null;
  const word = text(block.button)?.toLowerCase();
  if (!word || !(word in MODE_BUTTON_WORDS)) return null;
  const list = (Array.isArray(block.list) ? block.list : []).filter(isRecord).flatMap((m): WeaponMode[] => {
    const id = text(m.id);
    const name = text(m.name);
    if (!id || !name) return [];
    const qualities = Array.isArray(m.qualities) ? m.qualities.filter((q): q is string => typeof q === 'string') : null;
    return [
      {
        id,
        name,
        draws: isRecord(m.draws) ? text(m.draws.itemId) : null,
        qualities,
        damage: text(m.damage),
        toHit: typeof m.toHit === 'number' && Number.isInteger(m.toHit) ? m.toHit : null,
        note: text(m.note),
        range: rangeOf(m.range),
      },
    ];
  });
  return list.length > 0 ? { button: word as ModeButton, list } : null;
}

/** A weapon with one mode has no button (ah-4): it needs two or more. */
export const hasModeButton = (modes: WeaponModes | null): modes is WeaponModes => modes !== null && modes.list.length > 1;

/**
 * The lines a mode draws from on one character (G-211): the item with the mode's id, or an item whose `baseId` is that id,
 * unless another mode in the list draws that item by its own id. Only approved lines with some left; the smallest first,
 * so a part-used stack goes before a full one.
 */
export function drawnLines(mode: WeaponMode, modes: WeaponModes, lines: readonly InventoryLine[], actorId: string | null): InventoryLine[] {
  if (!mode.draws || actorId === null) return [];
  const drawnElsewhere = new Set(modes.list.filter((m) => m !== mode && m.draws).map((m) => m.draws));
  return lines
    .filter(
      (l) =>
        l.actorId === actorId &&
        l.approval === 'approved' &&
        l.qty > 0 &&
        (l.sourceEntryId === mode.draws || (l.details.baseId === mode.draws && !(l.sourceEntryId !== null && drawnElsewhere.has(l.sourceEntryId)))),
    )
    .sort((a, b) => a.qty - b.qty || a.id.localeCompare(b.id));
}

export interface ModeState {
  modes: WeaponModes;
  /**
   * The mode in use (Design on #569, round 3): the stored one (the line's `modeId`), else, fresh, the first mode that
   * draws nothing or has its stack in the pack (a new bow fires the plain arrows it carries; a spear's Melee); null when
   * fresh and no stack at all is in the pack.
   */
  mode: WeaponMode | null;
  /** It is the stored mode (picked, or kept by the use that spent its stack), not the fresh default. */
  chosen: boolean;
  /** It can be used: it draws nothing, or its stack has some left. False: disengaged (ah-3), the action blocked. */
  engaged: boolean;
  /**
   * Why it's disengaged: `spent` (the stored mode's stack is gone: "nothing chosen" until a new one is picked, ah-3) or
   * `empty` (fresh, and no stack the weapon draws is in the pack: "No arrows in the pack"); null when engaged.
   */
  why: 'spent' | 'empty' | null;
  /** The line the next use spends (the smallest of the stacks it draws), or null. */
  stack: InventoryLine | null;
  /** How many uses are left across its stacks. */
  left: number;
}

/**
 * The mode in use and whether it can be used (ah-3; Design on #569, round 3). A stored mode is used whatever is left of
 * it: with its stack gone it is disengaged ("nothing chosen") until a new one is picked; the use that spends the last
 * one stores the mode it spent, so a fresh weapon's default doesn't slide on to the next kind. A fresh weapon (nothing
 * stored) uses its first mode that draws nothing or has its stack in the pack; with none, it's empty.
 */
export function modeState(modes: WeaponModes, chosenId: string | null, lines: readonly InventoryLine[], actorId: string | null): ModeState {
  const stored = chosenId ? modes.list.find((m) => m.id === chosenId) : undefined;
  const leftOf = (m: WeaponMode) => drawnLines(m, modes, lines, actorId).reduce((sum, l) => sum + l.qty, 0);
  const mode = stored ?? modes.list.find((m) => !m.draws || leftOf(m) > 0) ?? null;
  const drawn = mode ? drawnLines(mode, modes, lines, actorId) : [];
  const left = drawn.reduce((sum, l) => sum + l.qty, 0);
  const engaged = mode !== null && (!mode.draws || left > 0);
  return { modes, mode, chosen: stored !== undefined, engaged, why: engaged ? null : stored ? 'spent' : 'empty', stack: drawn[0] ?? null, left };
}

/** How many of a mode's stack are left, in the stack's words ("Arrows ×18"), or null when it draws nothing. */
function stackWords(state: Pick<ModeState, 'stack' | 'left'>): string | null {
  return state.stack ? countWords(state.stack, state.left) : null;
}

/** The mode on the row's line (the mockup): "Quiver: Arrows ×18", "Grip: Melee", or "Quiver: nothing chosen". */
export function modeLine(state: ModeState): string {
  const word = MODE_BUTTON_WORDS[state.modes.button];
  if (state.why === 'empty') return `${word}: ${emptyWords(state.modes).toLowerCase()}`;
  if (!state.engaged || !state.mode) return `${word}: nothing chosen`;
  return `${word}: ${stackWords(state) ?? state.mode.name}`;
}

/** What a use of the mode is called: Fire for what a quiver or pouch holds, Use otherwise (item.use's words). */
export const modeVerb = (button: ModeButton): Extract<UseVerb, 'Fire' | 'Use'> => (button === 'quiver' || button === 'pouch' ? 'Fire' : 'Use');

const doing: Record<ModeButton, string> = { quiver: 'fires', pouch: 'slings', grip: 'uses', stance: 'uses' };

/**
 * The mode sheet's first line, for a grip or a stance ("How the spear is held."). A quiver or a pouch has none: its
 * line "What the <weapon> fires. Each shot uses one." is gone (tfh-6, 2026-11-19; page M2, frame M2o).
 */
export function modeIntro(button: ModeButton, weaponName: string): string | null {
  if (button === 'quiver' || button === 'pouch') return null;
  return button === 'grip' ? `How ${withThe(weaponName)} is held.` : `How ${withThe(weaponName)} is used.`;
}

/**
 * The modes the mode sheet lists (tfh-6, 2026-11-19: "only what is in pack should appear here"): each mode that draws
 * nothing (a grip, a stance), and each that draws a stack the character carries. A kind with none in the pack is not
 * listed, the one last in use too once its stack is gone.
 */
export function carriedModes(modes: WeaponModes, lines: readonly InventoryLine[], actorId: string | null): WeaponMode[] {
  return modes.list.filter((m) => !m.draws || drawnLines(m, modes, lines, actorId).length > 0);
}

/** The mode sheet's one line when it lists nothing (tfh-6; page M2, frame M2o): "Nothing to fire in your pack." */
export const noneCarriedWords = (button: ModeButton) => `Nothing to ${modeVerb(button).toLowerCase()} in your pack.`;

const lowerFirst = (s: string) => (s.length > 1 && s.charAt(1) === s.charAt(1).toLowerCase() ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * A blocked Attack's words (ah-3: "the blocked tap says so"): the title, why, and the button that opens the mode sheet.
 * A chosen stack now gone is used up; the first mode with none in the pack never was there.
 */
export function spentWords(state: ModeState, weaponName: string): { title: string; why: string; open: string } {
  const word = MODE_BUTTON_WORDS[state.modes.button];
  const verb = doing[state.modes.button];
  const open = `Open the ${word.toLowerCase()}`;
  if (state.why === 'empty') return { title: emptyWords(state.modes), why: `Add some to the pack, then choose what ${withThe(weaponName)} ${verb}.`, open };
  const why = state.mode ? `${state.mode.name} used up. Choose what ${withThe(weaponName)} ${verb} next.` : `Choose what ${withThe(weaponName)} ${verb}.`;
  return { title: 'Nothing chosen', why, open };
}

/** No stack the weapon draws is in the pack (Design on #569, round 3), in the first such mode's own noun: "No reed arrows in the pack". */
export function emptyWords(modes: WeaponModes): string {
  const first = modes.list.find((m) => m.draws) ?? modes.list[0]!;
  return `No ${lowerFirst(first.name)} in the pack`;
}

/**
 * One mode's pick row line (the Quiver of page M2, frame M2o, approved 2026-11-19): how many of its stack the pack
 * holds ("18 in the pack": the row's name says the kind; "None in the pack" where none, a row the sheet no longer
 * lists, tfh-6), its damage (its own, else the weapon's), its to-hit, its qualities where it names them, its note.
 */
export function modeBlurb(mode: WeaponMode, modes: WeaponModes, lines: readonly InventoryLine[], actorId: string | null, weaponDamage: string | null): string {
  const drawn = drawnLines(mode, modes, lines, actorId);
  const left = drawn.reduce((sum, l) => sum + l.qty, 0);
  const stack = mode.draws ? (drawn[0] ? `${left} in the pack` : 'None in the pack') : null;
  const toHit = mode.toHit !== null && mode.toHit !== 0 ? `${mode.toHit > 0 ? '+' : '−'}${Math.abs(mode.toHit)} to hit` : null;
  return [stack, mode.damage ?? weaponDamage, toHit, mode.qualities && mode.qualities.length > 0 ? mode.qualities.join(', ') : null, mode.note].filter(Boolean).join(', ');
}

/**
 * The item as the mode makes it, for the figure and its breakdown (ah-3: "the action then uses that mode's figures and
 * rules"): the mode's qualities in place of the weapon's (a quality the mode leaves out leaves `weaponTags` too, so a
 * thrown spear reads as missile only), and the mode's damage in place of the weapon's. The line's copy is not changed.
 *
 * Under a grip (C16, ⚑ 9, Francis 2026-11-20: "Yes to grip"), a quality written with figures after its first word
 * ("Missile 5-10/11-20/21-30", "Missile (70/140/210)") also stands for the tag of that word, so with the grip "Melee"
 * chosen the weapon keeps no missile tag and shows that grip's roll lines alone. A tag a kept quality still names stays;
 * a quality whose next word is not a figure ("Cold iron") stands for itself alone. Other modes match whole names only.
 */
export function withMode(item: Record<string, unknown>, mode: WeaponMode | null): Record<string, unknown> {
  if (!mode || !isRecord(item.weapon)) return item;
  const weapon: Record<string, unknown> = { ...item.weapon };
  let tags = item.weaponTags;
  if (mode.qualities) {
    const all = (Array.isArray(weapon.qualities) ? weapon.qualities : []).map((q) => String(q).toLowerCase());
    const kept = new Set(mode.qualities.map((q) => q.toLowerCase()));
    const grip = weaponModesOf(item)?.button === 'grip';
    // A quality's names: itself, and under a grip its first word when figures follow ("missile 5-10/…" → "missile").
    const names = (qs: Iterable<string>) => new Set([...qs].flatMap((q) => [q, ...(grip ? (q.match(/^([^\s(,]+)[\s,]*\(?\d/)?.slice(1, 2) ?? []) : [])]));
    const keptNames = names(kept);
    const dropped = new Set([...names(all.filter((q) => !kept.has(q)))].filter((n) => !keptNames.has(n)));
    weapon.qualities = mode.qualities;
    if (Array.isArray(tags)) tags = tags.filter((t) => !dropped.has(String(t).toLowerCase()));
  }
  if (mode.damage) weapon.damage = mode.damage;
  return { ...item, weapon, ...(tags !== undefined ? { weaponTags: tags } : {}) };
}

/** A condition as the Attack sheet names it: its name and its brief effect (07 `conditions[].notes`). */
export interface InflictedCondition {
  name: string;
  note: string | null;
}

/**
 * What an attack inflicts (ah-1; Design on #569, 2026-11-09): `applies.conditionId` (07, G-53) on the weapon, or on the
 * stack the mode in use draws, each named from the setting's conditions (an id the setting doesn't know shows as
 * written). Each once; none when neither says.
 */
export function inflictedBy(
  item: Record<string, unknown>,
  stack: Pick<InventoryLine, 'details'> | null,
  conditions: readonly { id: string; name: string; note: string | null }[],
): InflictedCondition[] {
  const ids = [item, stack?.details ?? {}].flatMap((d) => {
    const id = isRecord(d.applies) ? text(d.applies.conditionId) : null;
    return id ? [id] : [];
  });
  return [...new Set(ids)].map((id) => {
    const known = conditions.find((c) => c.id === id);
    return known ? { name: known.name, note: known.note } : { name: id, note: null };
  });
}

/**
 * The rules that bear on an attack (ah-1), in order: the weapon's qualities in this mode, two-handed, the mode's note,
 * then what the screen adds (the class's weapon rule, a patch's change). Each a short phrase.
 */
export function attackRules(item: Record<string, unknown>, mode: WeaponMode | null, extra: readonly (string | null | undefined)[] = []): string[] {
  const weapon = isRecord(item.weapon) ? item.weapon : {};
  const qualities = (Array.isArray(weapon.qualities) ? weapon.qualities : []).filter((q): q is string => typeof q === 'string' && q.trim() !== '');
  // One comma list (Design on #569): "Missile, two-handed, counts as bone"; the sheet heads it "Qualities:". The app's own
  // "two-handed" only when no quality already says it, whatever its case (as-3).
  const saysTwoHanded = qualities.some((q) => /\btwo[-\s]?handed\b/i.test(q));
  return [...qualities, item.hands === 2 && !saysTwoHanded ? 'two-handed' : null, mode?.note ?? null, ...extra].filter((r): r is string => typeof r === 'string' && r.trim() !== '');
}
