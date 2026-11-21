// How the Pack screen shows a carrier's items (docs/05-features.md; ruled 2026-10-23): grouped by where things
// are carried (worn and in hand · one group per container · carried loose), not by kind. In armour mode
// treasure stays where it is, marked counted, and ordinary gear sits in a collapsed Gear group. Each row may
// carry a small magic or treasure marker, from the item's category. Plain functions; the screen draws them.
import type { EncumbranceMode } from '../../core/campaignSettings.ts';
import { chargesOf, type ChargeRules } from './charges.ts';
import { bagFill, carriedLoad, fillWords, isTreasure, toLoadLine, type CarriedLoad, type EncumbranceRules } from './encumbrance.ts';
import type { InventoryLine } from './inventory.ts';
import { isAmmunition, oneUpVerb, type UseVerb } from '../../core/useWords.ts';

export interface PackGroup {
  key: string;
  title: string;
  note?: string;
  /** Starts closed (armour mode's Gear). */
  collapsible?: boolean;
  /** In the "Other" section: things that aren't carried, one group per category, outside the load. */
  other?: boolean;
  lines: InventoryLine[];
}

/**
 * Whether a line isn't carried (ruled 2026-10-24): its category is in the rules set's `separateCategories`, or,
 * when the rules set names none, it has an animal or vehicle block. It goes in the Pack's "Other" section and
 * never counts in the load.
 */
export function isSeparate(line: Pick<InventoryLine, 'category' | 'details'>, rules: Pick<EncumbranceRules, 'separateCategories'>): boolean {
  if (rules.separateCategories.length > 0) return rules.separateCategories.includes(line.category);
  return isObject(line.details.animal) || isObject(line.details.vehicle);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isContainer = (line: InventoryLine) => isObject(line.details.container);

export function groupPack(
  all: InventoryLine[],
  mode: EncumbranceMode,
  rules: EncumbranceRules,
  categoryName: (id: string) => string = (id) => id,
  { stash = false }: { stash?: boolean } = {},
): PackGroup[] {
  // Items sort A–Z within each group (ruled 2026-10-24; no other sorts).
  const byName = (a: InventoryLine, b: InventoryLine) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  if (stash) return stashGroups(all, byName);
  const lines = all.filter((l) => !isSeparate(l, rules));
  const apart = all.filter((l) => isSeparate(l, rules));
  const ids = new Set(lines.map((l) => l.id));
  const containers = lines.filter(isContainer);
  const inside = (container: InventoryLine) => lines.filter((l) => !l.equipped && l.containerLineId === container.id);
  const loose = lines.filter((l) => !l.equipped && (l.containerLineId === null || !ids.has(l.containerLineId)));
  const note = rules.containers === 'add' ? 'adds capacity' : 'holds things; doesn’t add capacity';
  const armour = mode === 'armour';
  const keep = (l: InventoryLine) => !armour || isTreasure(l, rules);

  const groups: PackGroup[] = [
    { key: 'worn', title: 'Worn and in hand', lines: lines.filter((l) => l.equipped) },
    ...containers.map((c) => ({ key: c.id, title: `In the ${c.name}`, note, lines: inside(c).filter(keep) })),
    { key: 'carried', title: 'Carried', lines: loose.filter(keep) },
  ];
  if (armour) {
    groups.push({ key: 'gear', title: 'Gear', collapsible: true, lines: lines.filter((l) => !l.equipped && !isTreasure(l, rules)) });
  }
  // The "Other" section: one group per category name, at the end, hidden when empty.
  const others = [...new Set(apart.map((l) => l.category))]
    .map((category) => ({ key: `other:${category}`, title: categoryName(category), other: true, lines: apart.filter((l) => l.category === category) }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...groups, ...others]
    .filter((g) => g.lines.length > 0)
    .map((g) => ({ ...g, lines: [...g.lines].sort(byName) }))
    .map((g) => (armour && g.key !== 'gear' ? { ...g, note: undefined } : g));
}

/**
 * The Party stash (ruled 2026-10-28, N18): nothing in it is worn or carried, so it has no Worn, Carried, Gear or
 * Other groups. Its loose things come first as one plain list (no heading), then one "In the …" group per
 * container in it.
 */
function stashGroups(all: InventoryLine[], byName: (a: InventoryLine, b: InventoryLine) => number): PackGroup[] {
  const ids = new Set(all.map((l) => l.id));
  const groups: PackGroup[] = [
    { key: 'loose', title: '', lines: all.filter((l) => l.containerLineId === null || !ids.has(l.containerLineId)) },
    ...all.filter(isContainer).map((c) => ({ key: c.id, title: `In the ${c.name}`, lines: all.filter((l) => l.containerLineId === c.id) })),
  ];
  return groups.filter((g) => g.lines.length > 0).map((g) => ({ ...g, lines: [...g.lines].sort(byName) }));
}

/** A small marker for magic or treasure: treasure by isTreasure (bq3-9), magic from the category. */
export function markerOf(line: InventoryLine, rules: EncumbranceRules): 'magic' | 'treasure' | null {
  if (isTreasure(line, rules)) return 'treasure';
  return /(^|-)magic(-|$)/.test(line.category) ? 'magic' : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What a row shows on the right, in the campaign's mode: weight or slots, or a dash for nothing. A bag that weighs
 * by how full it is (eq-5) shows what it weighs now of its full weight and how full it is ("300 of 600, half
 * full"), from the carrier's `lines`; with equal weights it's a fixed weight ("600 coins").
 */
export function amountText(
  line: InventoryLine,
  mode: EncumbranceMode,
  rules: EncumbranceRules,
  lines: readonly InventoryLine[] = [],
  { tiny = false }: { tiny?: boolean } = {},
): string {
  if ((mode === 'coin' || mode === 'slot') && isContainer(line)) {
    const bag = toLoadLine(line);
    const fill = bagFill(bag, [bag, ...lines.filter((l) => l.id !== line.id).map(toLoadLine)], mode);
    if (fill) {
      return bag.container!.weightEmpty === bag.container!.weightFull
        ? mode === 'coin' ? plural(fill.weight, 'coin', 'coins') : plural(fill.weight, 'slot', 'slots')
        : `${fill.weight} of ${fill.full}, ${fillWords(fill.fill)}`;
    }
  }
  // A weightless tiny thing (SC-5-2, Design 2026-11-05) shows the dash every other weightless row shows, not "0 coins".
  if (tiny && (mode === 'coin' ? (line.weightCoin ?? 0) === 0 : mode === 'slot' && (line.slots ?? 0) === 0)) return '—';
  if (mode === 'coin') return line.weightCoin === null ? '—' : plural(Math.round((line.weightCoin * line.qty) / Math.max(1, line.perUnits)), 'coin', 'coins');
  if (mode === 'slot') return line.slots === null ? '—' : plural(line.slots * Math.ceil(line.qty / Math.max(1, line.stack)), 'slot', 'slots');
  if (mode === 'armour' && isTreasure(line, rules)) {
    const each = line.weightCoin ?? rules.treasureWeights[line.category] ?? 0;
    return `${each * line.qty} coins’ weight, counted`;
  }
  return '';
}

/**
 * Whether an item's slot is worn rather than held: armour (one at a time), or `worn` (mb-5, ruled 2026-11-04:
 * gloves, rings, belts; any number, taking no hand and not the armour place).
 */
export const isWornSlot = (slot: unknown) => slot === 'armour' || slot === 'worn';

/** The slots an item can be put on in: armour, shield, hand, and worn (mb-5). */
export const EQUIP_SLOTS = ['armour', 'shield', 'hand', 'worn'] as const;

/** "Worn" or "In hand" for an equipped item (armour and `worn` items are worn; anything else is held). */
export function wornText(line: InventoryLine): string {
  if (!line.equipped) return '';
  return isWornSlot(line.details.slot) ? 'Worn' : 'In hand';
}

/** Only stackable things show a count (arrows, rations); single items don't. */
export const stackable = (line: InventoryLine) => line.stack > 1 || line.qty > 1;

/**
 * At hand fills itself (ruled 2026-10-23): what's in hand, and anything worn or held that has charges; worn
 * armour stays on the Pack tab. The player can hide one of those ("Hide from At hand").
 */
export function showsAtHandByItself(line: InventoryLine, charges: ChargeRules): boolean {
  return line.equipped && (wornText(line) === 'In hand' || chargesOf(line, charges) !== null);
}

/**
 * An item's name as rows and sheets show it: the first letter a capital, the rest as stored ("torch" shows "Torch").
 * Display only: the stored name, its key and the log keep what they have. A line can be stored in lower case when the
 * database names a bundle's single pieces by the pack's `unitName` ("torch"; 07 bundle, M4), or by an older build.
 */
export function shownName(name: string): string {
  const first = name.trimStart();
  return first ? first.charAt(0).toLocaleUpperCase() + first.slice(1) : name;
}

/**
 * Some of a stack in words (words batch 1, ruled 2026-10-26): the pack's `unitName` for one and `pluralName` for
 * more ("1 torch", "3 torches"); without them, the item's name, with "×N" for more than one ("Torch ×3").
 */
export function countWords(line: Pick<InventoryLine, 'name' | 'details'>, n: number): string {
  const word = (key: 'unitName' | 'pluralName') => (typeof line.details[key] === 'string' && String(line.details[key]).trim() ? String(line.details[key]).trim() : null);
  if (n === 1) return word('unitName') ?? shownName(line.name);
  const many = word('pluralName');
  return many ? `${n} ${many}` : `${shownName(line.name)} ×${n}`;
}

/**
 * Room left in a container in the campaign's mode (B19: each destination row shows it): its capacity less what's
 * inside, in coins or slots. Null when the container doesn't say, or in a mode that doesn't count room.
 */
export function roomLeft(container: InventoryLine, lines: readonly InventoryLine[], mode: EncumbranceMode): { left: number; of: number } | null {
  const block = container.details.container as { capacityCoin?: unknown; capacitySlots?: unknown } | undefined;
  const capacity = mode === 'slot' ? block?.capacitySlots : mode === 'coin' ? block?.capacityCoin : undefined;
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0) return null;
  const inside = lines.filter((l) => l.containerLineId === container.id && !l.equipped);
  const used = inside.reduce(
    (sum, l) => sum + (mode === 'slot' ? (l.slots ?? 0) * Math.ceil(l.qty / Math.max(1, l.stack)) : Math.round(((l.weightCoin ?? 0) * l.qty) / Math.max(1, l.perUnits))),
    0,
  );
  return { left: Math.max(0, capacity - used), of: capacity };
}

/**
 * What At hand shows, in pack order: what fills itself (unless hidden) and what's pinned, each once, and only what has
 * an action (Francis, 2026-11-07, on #552): a thing with nothing to do stays in its own group.
 */
export function atHandLines(lines: InventoryLine[], charges: ChargeRules): InventoryLine[] {
  return lines.filter((l) => (l.pinned || (!l.atHandHidden && showsAtHandByItself(l, charges))) && atHandAction(l, charges) !== null);
}

// Use one up's words live in core (the log reads them too): the verb by the item's kind, and its past tense.
export { oneUpVerb, USED_WORDS, type UseVerb } from '../../core/useWords.ts';

/** A weapon (its `weapon` block, 07, or a weapon category): with nothing to count its At hand action is Attack. */
export const isWeapon = (line: Pick<InventoryLine, 'category' | 'details'>) =>
  !isAmmunition(line.category) &&
  ((typeof line.details.weapon === 'object' && line.details.weapon !== null) || /(^|-)weapons?(-|$)/.test((line.category || '').toLowerCase()));

/**
 * What an At hand row's button does (Francis, 2026-11-07, on #552), in this order: Use a charge (a charged item), Light
 * or Put out (a light), use one up (Fire, Drink, Eat, Use), then for a weapon with nothing to count Wield while it isn't
 * in hand and Attack once it is (ah-2, ruling m5b-at-hand-actions-2026-11-08: one button, the state deciding which;
 * until M6 Attack opens the Attack sheet, ah-1); null when the item has no action, and then it isn't At hand.
 */
export function atHandAction(line: InventoryLine, charges: ChargeRules, rechargeDefault = false): 'charge' | 'light' | UseVerb | 'Wield' | 'Attack' | null {
  if (chargesOf(line, charges, rechargeDefault) !== null) return 'charge';
  if (typeof line.details.lightTypeId === 'string') return 'light';
  const verb = oneUpVerb(line);
  if (verb) return verb;
  if (!isWeapon(line)) return null;
  // Worn counts as ready (a blade on the worn slot): Wield would have nothing to do.
  return line.equipped ? 'Attack' : 'Wield';
}

/**
 * What one character carries as the load sees it (bq-5, ga-1): their approved lines, not the ones kept apart
 * (animals, vehicles), in the campaign's mode. The Pack tab, the sheet's Movement and travel all read this.
 */
export function actorLoad(lines: readonly InventoryLine[], actorId: string, rules: EncumbranceRules, mode: EncumbranceMode): CarriedLoad {
  return carriedLoad(lines.filter((l) => l.actorId === actorId && l.approval === 'approved' && !isSeparate(l, rules)).map(toLoadLine), rules, mode);
}

/**
 * Whether a line is tiny (05 "Equipped, stowed and tiny"; 07 `unencumbering`): the item, or its category in the rules
 * set, is marked `unencumbering: true`. The full sheet's Pack load shows them as their own group (sr-9).
 */
export function isTiny(line: Pick<InventoryLine, 'category' | 'details'>, tinyCategories: ReadonlySet<string>): boolean {
  return line.details.unencumbering === true || tinyCategories.has(line.category);
}

/**
 * The full sheet's Pack load groups (sr-9, sheet plan order 5): the Pack's groups (worn and in hand, each container,
 * carried; armour mode's Gear), without the tiny things, which come last as "Tiny things". Lines kept apart
 * (animals, vehicles) are outside the load and left out; so are a container's own group when only tiny things are in it.
 */
export function loadGroups(lines: InventoryLine[], mode: EncumbranceMode, rules: EncumbranceRules, tinyCategories: ReadonlySet<string>): PackGroup[] {
  const carried = lines.filter((l) => !isSeparate(l, rules));
  // A tiny container still holds its group's things: only the tiny lines that aren't containers leave their group.
  const tiny = carried.filter((l) => isTiny(l, tinyCategories) && !isContainer(l));
  const tinyIds = new Set(tiny.map((l) => l.id));
  const groups = groupPack(carried, mode, rules)
    .map((g) => ({ ...g, lines: g.lines.filter((l) => !tinyIds.has(l.id)) }))
    .filter((g) => g.lines.length > 0);
  const byName = (a: InventoryLine, b: InventoryLine) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  return tiny.length > 0 ? [...groups, { key: 'tiny', title: 'Tiny things', lines: [...tiny].sort(byName) }] : groups;
}

/**
 * The Pack tab's groups with the tiny things folded into their own section (05 "Equipped, stowed and tiny"; 06 Pack
 * summary; SC-5-2, ruled 2026-11-05): the sheet's `loadGroups` (tiny things last), then the "Other" section's groups
 * (things not carried), as `groupPack` gives them. Without a tiny thing it's `groupPack` as before.
 */
export function packGroupsWithTiny(
  lines: InventoryLine[],
  mode: EncumbranceMode,
  rules: EncumbranceRules,
  tinyCategories: ReadonlySet<string>,
  categoryName: (id: string) => string = (id) => id,
): PackGroup[] {
  const all = groupPack(lines, mode, rules, categoryName);
  if (!lines.some((l) => !isSeparate(l, rules) && !isContainer(l) && isTiny(l, tinyCategories))) return all;
  return [...loadGroups(lines, mode, rules, tinyCategories), ...all.filter((g) => g.other)];
}

/** Whether the tiny things add nothing to the load in this mode (their slots or weight are all 0 or none). */
export function tinyCountsNothing(tiny: readonly InventoryLine[], mode: EncumbranceMode): boolean {
  if (mode === 'slot') return tiny.every((l) => (l.slots ?? 0) === 0);
  if (mode === 'coin') return tiny.every((l) => (l.weightCoin ?? 0) === 0);
  return true;
}
