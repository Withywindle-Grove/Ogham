// The in-app editor's model (docs/07-content-packs.md, In-app editor): each kind's simple form as a list of
// fields that read and write the pack format itself, so an edited entry is exactly what a file would hold.
// Keys a form doesn't know are kept as they are. Pure: the screen (src/app/EntryEditor.tsx) draws these.
import { workOut } from './formula.ts';
import { checkHook } from './hooks.ts';
import type { EntryKind, PackEntry } from './packFile.ts';

export type Field =
  | { key: string; label: string; type: 'text' | 'longText' | 'whole' | 'tags' | 'money' | 'labels' | 'yesNo'; hint?: string }
  /** Labels with whole numbers ({ DEX: 1 }). */
  | { key: string; label: string; type: 'wholeLabels'; hint?: string }
  /** A number or formula with its unit: { value, unit } or { formula, unit }. */
  | { key: string; label: string; type: 'duration'; units: { id: string; name: string }[]; hint?: string }
  /** Other entries of this kind, chosen by name, stored as their ids. */
  | { key: string; label: string; type: 'refList'; kind: EntryKind; hint?: string }
  /** Other entries of this kind, each with a whole number ({ "lantern-warden": 8 }). */
  | { key: string; label: string; type: 'refMap'; kind: EntryKind; numberLabel: string; hint?: string }
  /** One of the ids in a list of this entry's own (an optional rule's default among its choices). */
  | { key: string; label: string; type: 'choiceFrom'; from: string; hint?: string }
  /** A whole number, or a formula using level ("2 + level"), stored as { formula }. */
  | { key: string; label: string; type: 'wholeOrFormula'; hint?: string }
  | { key: string; label: string; type: 'choice'; choices: { id: string; name: string }[]; hint?: string }
  /** The id of another entry of this kind. */
  | { key: string; label: string; type: 'ref'; kind: EntryKind; hint?: string }
  /** A list of rows, each with these columns. */
  | { key: string; label: string; type: 'rows'; columns: Column[]; hint?: string };

export type Column = (
  | { key: string; label: string; type: 'text' | 'whole' | 'yesNo' }
  /** One other entry (chosen from a list), or several (typed by name). */
  | { key: string; label: string; type: 'ref' | 'refList'; kind: EntryKind }
) & { /** May be left empty. */ optional?: boolean };

const NAME: Field = { key: 'name', label: 'Name', type: 'text' };
const UNITS = [
  { id: 'round', name: 'Rounds' },
  { id: 'turn', name: 'Turns' },
  { id: 'hour', name: 'Hours' },
  { id: 'day', name: 'Days' },
];
const NOTES: Field = { key: 'notes', label: 'Notes', type: 'longText' };

const FIELDS: Partial<Record<EntryKind, Field[]>> = {
  item: [
    NAME,
    { key: 'category', label: 'Category', type: 'text', hint: 'For example gear, weapon, armour.' },
    { key: 'weightCoin', label: 'Weight (coins)', type: 'whole', hint: 'For campaigns that count weight.' },
    { key: 'slots', label: 'Slots', type: 'whole', hint: 'For campaigns that count slots.' },
    { key: 'stack', label: 'How many fit in one slot', type: 'whole' },
    { key: 'value', label: 'Value', type: 'money', hint: 'Like 1 gp, 5 sp.' },
    // 07 forSale: "—" leaves the usual rule (for sale, except magic items); the GM can make any item buyable or not.
    { key: 'forSale', label: 'For sale in shops', type: 'yesNo', hint: 'Left as —: yes, except magic items.' },
    { key: 'container.capacityCoin', label: 'Holds (coins)', type: 'whole', hint: 'Only for containers.' },
    { key: 'container.capacitySlots', label: 'Holds (slots)', type: 'whole', hint: 'Only for containers.' },
    { key: 'lightTypeId', label: 'Gives light as', type: 'ref', kind: 'lightType' },
    NOTES,
  ],
  statBlock: [
    NAME,
    { key: 'description', label: 'In one line', type: 'text' },
    { key: 'hp', label: 'Hit points', type: 'text', hint: 'A number or dice, like 3d8.' },
    { key: 'hpAverage', label: 'Average hit points', type: 'whole' },
    { key: 'fields', label: 'Stat line', type: 'labels', hint: 'Any labels your game uses, like AC, Move, Attacks.' },
    { key: 'abilities', label: 'Abilities', type: 'rows', columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'note', label: 'What it does', type: 'text', optional: true }] },
    { key: 'tags', label: 'Tags', type: 'tags', hint: 'Separated by commas, like swamp, undead.' },
    NOTES,
  ],
  condition: [NAME, { key: 'defaultRounds', label: 'Rounds by default', type: 'whole' }, NOTES],
  lightType: [
    NAME,
    { key: 'duration', label: 'Lasts', type: 'wholeOrFormula', hint: 'A number, or a formula like 2 + level.' },
    {
      key: 'unit',
      label: 'Counted in',
      type: 'choice',
      choices: [
        { id: 'round', name: 'Rounds' },
        { id: 'turn', name: 'Turns' },
        { id: 'hour', name: 'Hours' },
      ],
    },
    { key: 'radius', label: 'Radius', type: 'text', hint: 'Like 30 ft.' },
    { key: 'warnAt', label: 'Warn when this much is left', type: 'whole' },
    { key: 'fuelItemId', label: 'Burns', type: 'ref', kind: 'item', hint: 'The item used up when it runs out, if any.' },
    NOTES,
  ],
  xpTable: [
    { ...NAME, hint: 'Optional; the class using it is usually enough.' },
    { key: 'levels', label: 'Levels', type: 'rows', columns: [{ key: 'level', label: 'Level', type: 'whole' }, { key: 'xp', label: 'XP', type: 'whole' }] },
  ],
  class: [
    NAME,
    { key: 'hitDie', label: 'Hit die', type: 'text', hint: 'Like d8.' },
    { key: 'xpTableId', label: 'XP table', type: 'ref', kind: 'xpTable' },
    { key: 'maxLevel', label: 'Highest level', type: 'whole' },
    { key: 'requirements', label: 'Requirements', type: 'text' },
    { key: 'languages', label: 'Languages', type: 'tags', hint: 'Separated by commas.' },
    { key: 'fields', label: 'Other details', type: 'labels', hint: 'Anything else your game notes for a class, like Prime stat.' },
    {
      key: 'abilities',
      label: 'Abilities',
      type: 'rows',
      columns: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'fromLevel', label: 'From level', type: 'whole', optional: true },
        { key: 'note', label: 'What it does', type: 'text', optional: true },
      ],
    },
    { key: 'spellcasting.listId', label: 'Casts from', type: 'ref', kind: 'spellList', hint: 'Leave as None for a class without spells.' },
    {
      key: 'spellcasting.type',
      label: 'Spells are',
      type: 'choice',
      choices: [
        { id: 'book', name: 'Kept in a spell book' },
        { id: 'divine', name: 'Granted (prayed for)' },
      ],
    },
    {
      key: 'spellcasting.castingType',
      label: 'Kind of magic',
      type: 'choice',
      choices: [
        { id: 'arcane', name: 'Arcane' },
        { id: 'divine', name: 'Divine' },
      ],
    },
    { key: 'spellcasting.maxSpellLevel', label: 'Highest spell level', type: 'whole' },
    { key: 'spellcasting.fromLevel', label: 'Casts from level', type: 'whole' },
    NOTES,
  ],
  race: [
    NAME,
    { key: 'abilityMods', label: 'Ability changes', type: 'wholeLabels', hint: 'Like DEX +1 or STR -1.' },
    { key: 'vision', label: 'Vision', type: 'text' },
    { key: 'languages', label: 'Languages', type: 'tags', hint: 'Separated by commas.' },
    { key: 'classes', label: 'Classes it can be', type: 'refMap', kind: 'class', numberLabel: 'Up to level' },
    { key: 'abilities', label: 'Abilities', type: 'rows', columns: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'note', label: 'What it does', type: 'text', optional: true }] },
    NOTES,
  ],
  spell: [
    NAME,
    { key: 'lists', label: 'Spell lists', type: 'refMap', kind: 'class', numberLabel: 'Spell level', hint: 'Each class that can cast it, and at what spell level.' },
    { key: 'range', label: 'Range', type: 'text', hint: 'Like 30 ft.' },
    { key: 'duration', label: 'Duration', type: 'duration', units: UNITS, hint: 'A number, or a formula like 2 + level.' },
    { key: 'lightTypeId', label: 'Gives light as', type: 'ref', kind: 'lightType' },
    { key: 'conditionId', label: 'Causes', type: 'ref', kind: 'condition' },
    { key: 'saves', label: 'Saves against it', type: 'tags', hint: 'Separated by commas.' },
    { key: 'reversible', label: 'Can be cast reversed', type: 'yesNo' },
    { key: 'reversedName', label: 'Reversed, it’s called', type: 'text' },
    { key: 'concentration', label: 'Needs concentration', type: 'yesNo' },
    NOTES,
  ],
  spellList: [
    NAME,
    {
      key: 'levels',
      label: 'Levels',
      type: 'rows',
      columns: [
        { key: 'level', label: 'Level', type: 'whole' },
        { key: 'spells', label: 'Spells', type: 'refList', kind: 'spell' },
      ],
      hint: 'Spells by name, separated by commas.',
    },
  ],
  treasureType: [
    { ...NAME, hint: 'Optional; the letter will do.' },
    { key: 'letter', label: 'Letter', type: 'text' },
    { key: 'kind', label: 'Kind', type: 'text', hint: 'Like hoard or individual.' },
    { key: 'averageGp', label: 'Average value', type: 'text' },
    {
      key: 'entries',
      label: 'What it holds',
      type: 'rows',
      columns: [
        { key: 'chance', label: 'Chance (%)', type: 'whole' },
        { key: 'amount', label: 'Amount', type: 'text' },
      ],
    },
  ],
  rulesSet: [
    NAME,
    { key: 'time.roundSeconds', label: 'A round is (seconds)', type: 'whole' },
    { key: 'time.turnMinutes', label: 'A turn is (minutes)', type: 'whole' },
    { key: 'time.dayHours', label: 'A day is (hours)', type: 'whole' },
    {
      key: 'currency',
      label: 'Coins',
      type: 'rows',
      columns: [
        { key: 'key', label: 'Short name', type: 'text' },
        { key: 'label', label: 'Name', type: 'text' },
        { key: 'valueInBase', label: 'Worth (in the base coin)', type: 'whole' },
        { key: 'countsForWeight', label: 'Counts for weight', type: 'yesNo', optional: true },
      ],
    },
    { key: 'startingMoney', label: 'Starting money', type: 'text', hint: 'Like 3d6 × 10 gp.' },
  ],
  option: [
    NAME,
    {
      key: 'choices',
      label: 'Choices',
      type: 'rows',
      columns: [
        { key: 'name', label: 'Choice', type: 'text' },
        { key: 'notes', label: 'What it means', type: 'text', optional: true },
      ],
    },
    { key: 'default', label: 'Default', type: 'choiceFrom', from: 'choices' },
    {
      key: 'changeLater',
      label: 'Once the campaign has started',
      type: 'choice',
      choices: [
        { id: 'allow', name: 'Can change at any time' },
        { id: 'warn', name: 'Can change, but asks first' },
        { id: 'never', name: 'Can’t change' },
      ],
    },
    NOTES,
  ],
  hook: [
    { ...NAME, hint: 'Optional.' },
    { key: 'kind', label: 'Kind', type: 'text', hint: 'Like fill, warn, factor or remind.' },
    { key: 'when', label: 'When', type: 'text', hint: 'An event, like equip or levelUp.' },
    { key: 'test', label: 'Test', type: 'longText', hint: 'Optional. Like item.slot == "armour" and not allows(character.class.armourAllowed, item).' },
    { key: 'message', label: 'Message', type: 'longText', hint: 'For warn and remind. Names in {braces} are filled in, like {item.name}.' },
    { key: 'target', label: 'Target', type: 'text' },
    { key: 'value', label: 'Value', type: 'text', hint: 'For fill: an expression. Use a value or a from, not both.' },
    { key: 'from', label: 'From', type: 'text' },
    { key: 'note', label: 'Note', type: 'longText' },
  ],
  fieldTemplate: [
    { ...NAME, hint: 'Optional.' },
    {
      key: 'appliesTo',
      label: 'For',
      type: 'choice',
      choices: [
        { id: 'pc', name: 'Player characters' },
        { id: 'npc', name: 'Other characters' },
      ],
    },
    {
      key: 'fields',
      label: 'Sheet fields',
      type: 'rows',
      columns: [
        { key: 'key', label: 'Key', type: 'text' },
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'type', label: 'Type', type: 'text', optional: true },
        { key: 'group', label: 'Group', type: 'text', optional: true },
        { key: 'showOnCard', label: 'On the card', type: 'yesNo', optional: true },
      ],
    },
  ],
  startingKit: [
    NAME,
    { key: 'classIds', label: 'For classes', type: 'refList', kind: 'class', hint: 'By name, separated by commas; leave empty for anyone.' },
    {
      key: 'items',
      label: 'Items',
      type: 'rows',
      columns: [
        { key: 'itemId', label: 'Item', type: 'ref', kind: 'item' },
        { key: 'qty', label: 'How many', type: 'whole' },
      ],
    },
    { key: 'costGp', label: 'Cost (gp)', type: 'whole' },
  ],
};

const TABLE_HEAD: Field[] = [NAME, { key: 'die', label: 'Die', type: 'text', hint: 'Like d6 or d4/d10.' }];

/** A table's form depends on its kind: ranges for a plain table, keys for a lookup; a matrix's rows aren't in the form. */
function tableFields(data: Record<string, unknown>): Field[] {
  if (data.kind === 'matrix') return [...TABLE_HEAD, NOTES];
  if (data.kind === 'lookup') {
    return [
      NAME,
      { key: 'rows', label: 'Rows', type: 'rows', columns: [{ key: 'key', label: 'Key', type: 'text' }, { key: 'value', label: 'Value', type: 'text', optional: true }] },
      NOTES,
    ];
  }
  return [
    ...TABLE_HEAD,
    {
      key: 'rows',
      label: 'Rows',
      type: 'rows',
      columns: [
        { key: 'min', label: 'From', type: 'whole', optional: true },
        { key: 'max', label: 'To', type: 'whole', optional: true },
        { key: 'result', label: 'Result', type: 'text' },
        { key: 'count', label: 'How many', type: 'text', optional: true },
        { key: 'statBlockId', label: 'Monster', type: 'ref', kind: 'statBlock', optional: true },
      ],
    },
    NOTES,
  ];
}

/** The kinds the editor can make and change, in the order they're offered: all of them (calendars come in R3). */
export const EDITABLE: EntryKind[] = [
  'item', 'statBlock', 'condition', 'lightType', 'xpTable',
  'class', 'race', 'spell', 'spellList', 'startingKit',
  'table', 'treasureType', 'rulesSet', 'option', 'hook', 'fieldTemplate',
];

/** A kind's fields; a table's depend on the table itself. */
export const fieldsOf = (kind: EntryKind, data: Record<string, unknown> = {}): Field[] => (kind === 'table' ? tableFields(data) : (FIELDS[kind] ?? []));

/** Kinds with no name of their own in the pack format (a letter or id stands in). */
const NAMELESS: EntryKind[] = ['xpTable', 'treasureType', 'hook', 'fieldTemplate'];

/** An optional rule's choices with an id for each (made from its name if it has none), so a default can be picked. */
export function withChoiceIds(choices: unknown): Record<string, unknown>[] {
  if (!Array.isArray(choices)) return [];
  const used = new Set<string>();
  return choices.map((choice) => {
    const row = isRecord(choice) ? choice : {};
    const id = typeof row.id === 'string' && row.id !== '' ? row.id : newEntryId(String(row.name ?? ''), used);
    used.add(id);
    return { ...row, id };
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isBlank = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.keys(value).length === 0);

/** The value at a key like "container.capacityCoin". */
export function valueAt(data: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((at, part) => (isRecord(at) ? at[part] : undefined), data);
}

/** A copy with the value at `key` set; an empty value removes the key (and any object it leaves empty). */
export function setAt(data: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const [first, ...rest] = key.split('.') as [string, ...string[]];
  const copy = { ...data };
  if (rest.length === 0) {
    if (isBlank(value)) delete copy[first];
    else copy[first] = value;
    return copy;
  }
  const inner = setAt(isRecord(copy[first]) ? copy[first] : {}, rest.join('.'), value);
  if (isBlank(inner)) delete copy[first];
  else copy[first] = inner;
  return copy;
}

/** "1 gp, 5 sp" → { gp: 1, sp: 5 }; blank → undefined; anything else → null. */
export function readMoney(text: string): Record<string, number> | undefined | null {
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const money: Record<string, number> = {};
  for (const part of parts) {
    const match = /^(\d+)\s*([a-z]{1,8})$/i.exec(part);
    if (!match) return null;
    money[match[2]!.toLowerCase()] = Number(match[1]);
  }
  return money;
}

export const showMoney = (value: unknown) =>
  isRecord(value) ? Object.entries(value).map(([key, amount]) => `${String(amount)} ${key}`).join(', ') : '';

/** "swamp, river" → ["swamp", "river"]; blank → undefined. */
export function readTags(text: string): string[] | undefined {
  const tags = text.split(',').map((tag) => tag.trim()).filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** An id for a new entry from its name ("Bog lurker" → "bog-lurker"), not one already used. */
export function newEntryId(name: string, used: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry';
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const whole = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isInteger(value));
const readable = (formula: unknown) => typeof formula === 'string' && workOut(formula, 1) !== null;
/** A value given separately for each class ({ "cleric": { value: 6, unit: "turn" } }): kept as it is. */
const byClass = (value: unknown) =>
  isRecord(value) && !('value' in value || 'formula' in value || 'roll' in value) && Object.values(value).length > 0 && Object.values(value).every(isRecord);

/** "Glimmer, Mire light" → the ids of the entries of this kind with those names (or ids); names not found. */
export function namesToIds(text: string, kind: EntryKind, entries: PackEntry[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const name of text.split(',').map((part) => part.trim()).filter(Boolean)) {
    const found = entries.find((e) => e.kind === kind && (e.name.toLowerCase() === name.toLowerCase() || e.packEntryId === name));
    if (!found) unknown.push(name);
    else if (!ids.includes(found.packEntryId)) ids.push(found.packEntryId);
  }
  return { ids, unknown };
}

const words = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/** The parts of an entry its form doesn't show (kept exactly as they are when saving), in plain words. */
export function keptAsIs(kind: EntryKind, data: Record<string, unknown>): string[] {
  const fields = fieldsOf(kind, data);
  const covered = new Set(fields.map((field) => field.key.split('.')[0]));
  const kept: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id' || isBlank(value)) continue;
    const field = fields.find((f) => f.key === key);
    if (!covered.has(key)) kept.push(words(key));
    else if (field && (field.type === 'text' || field.type === 'longText') && typeof value !== 'string') {
      kept.push(`${field.label.toLowerCase()} (${kind === 'spell' ? 'differs by class' : 'more detailed than this form'})`);
    } else if (field?.type === 'duration' && byClass(value)) kept.push(`${field.label.toLowerCase()} (differs by class)`);
  }
  return kept;
}

/** What's wrong with an entry before saving, in plain words; empty when it's fine. */
export function checkEntry(kind: EntryKind, data: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (typeof data.id !== 'string' || !ID.test(data.id)) problems.push('The id must be lowercase letters, digits and dashes.');
  if (!NAMELESS.includes(kind) && (typeof data.name !== 'string' || data.name.trim() === '')) problems.push('Give it a name.');
  for (const field of fieldsOf(kind, data)) {
    const value = valueAt(data, field.key);
    // Packs may write "none" as null; it's the same as leaving it out.
    if (value === undefined || value === null) continue;
    if (field.type === 'whole' && !whole(value)) problems.push(`${field.label} must be a whole number.`);
    if (field.type === 'money' && !(isRecord(value) && Object.values(value).every((amount) => whole(amount)))) {
      problems.push(`${field.label} should look like 1 gp, 5 sp.`);
    }
    if (field.type === 'wholeOrFormula') {
      // Text that isn't a number or a formula ("permanent") stays text.
      const fine = whole(value) || typeof value === 'string' || (isRecord(value) && readable(value.formula));
      if (!fine) problems.push(`${field.label} must be a whole number or a formula using level (like 2 + level).`);
    }
    if (field.type === 'duration') {
      const fine =
        typeof value === 'string' ||
        byClass(value) ||
        (isRecord(value) && ('formula' in value ? readable(value.formula) : 'roll' in value || (value.value !== undefined && whole(value.value))));
      if (!fine) problems.push(`${field.label} must be a whole number or a formula using level (like 2 + level).`);
    }
    if (field.type === 'yesNo' && typeof value !== 'boolean') problems.push(`${field.label} must be yes or no.`);
    if (field.type === 'wholeLabels' && isRecord(value)) {
      for (const [label, amount] of Object.entries(value)) if (!whole(amount)) problems.push(`${field.label}: ${label} must be a whole number.`);
    }
    if (field.type === 'refMap' && isRecord(value) && !Object.values(value).every((amount) => whole(amount))) {
      problems.push(`${field.label}: each needs a whole number.`);
    }
    if (field.type === 'refList' && !Array.isArray(value)) problems.push(`${field.label} has a name that isn’t in these setting rules.`);
    if (field.type === 'rows' && Array.isArray(value)) {
      value.forEach((row, index) => {
        for (const column of field.columns) {
          const cell = isRecord(row) ? row[column.key] : undefined;
          if (cell === undefined || cell === '') {
            if (!column.optional) problems.push(`${field.label}, row ${index + 1}: ${column.label} is missing.`);
          } else if (column.type === 'yesNo' && typeof cell !== 'boolean') problems.push(`${field.label}, row ${index + 1}: ${column.label} must be yes or no.`);
          else if (column.type === 'whole' && !whole(cell)) problems.push(`${field.label}, row ${index + 1}: ${column.label} must be a whole number.`);
          else if (column.type === 'refList' && !Array.isArray(cell)) {
            problems.push(`${field.label}, row ${index + 1}: ${column.label} has a name that isn’t in these setting rules.`);
          }
        }
      });
    }
  }
  // A hook must run as written (docs/07); what's only worth knowing doesn't stop the save.
  if (kind === 'hook') problems.push(...checkHook(data).problems);
  if (kind === 'option') {
    const choices = Array.isArray(data.choices) ? data.choices : [];
    if (choices.length < 2) problems.push('Give it at least two choices.');
    else {
      choices.forEach((choice, index) => {
        const id = isRecord(choice) ? choice.id : undefined;
        if (typeof id !== 'string' || !ID.test(id)) problems.push(`Choices, row ${index + 1}: the id must be lowercase letters, digits and dashes.`);
      });
      if (!choices.some((choice) => isRecord(choice) && choice.id === data.default)) problems.push('The default must be one of its choices.');
    }
  }
  return problems;
}
