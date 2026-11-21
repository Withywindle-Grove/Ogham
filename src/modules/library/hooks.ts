// Rule hooks as the spec settles them (docs/07-content-packs.md, "Rule hooks"): the kinds, events and the names
// each event provides, targets, fill sources and one-tap offers, and a check of a hook's fields in plain words.
// The importer lists what the check finds (lenient: the pack still imports); the editor asks for fixes first.
// New events, targets and functions are added here when a milestone needs them (a scope check), never by a pack.
import { checkExpression, FUNCTIONS, namesIn, parseExpression } from './expression.ts';

export const HOOK_KINDS = ['fill', 'warn', 'factor', 'remind'] as const;

/** Each event and the names a test or message can use (docs/07, Events). */
export const HOOK_EVENTS: Record<string, readonly string[]> = {
  characterCreated: ['character'],
  abilityScoreChanged: ['character'],
  levelUp: ['character', 'fromLevel', 'toLevel'],
  levelLoss: ['character', 'fromLevel', 'toLevel'],
  xpAwarded: ['character', 'amount'],
  equip: ['character', 'item', 'equipped'],
  useItem: ['character', 'item'],
  hire: ['employer', 'hireling'],
  wageDue: ['employer', 'hireling', 'wage'],
  turnAdvanced: ['campaign', 'expedition', 'turns'],
  lightBurning: ['light', 'carrier'],
  adventureEnded: ['campaign', 'party'],
};

/** Every event also provides `campaign` (its flags: 04, "readable by hooks as campaign.flags.<id>"; 07's examples). */
export const EVERY_EVENT = ['campaign'];

/** Events whose hooks run on a player's device, which can't read the GM's data (ruled 2026-10-23). */
export const PLAYER_DEVICE_EVENTS = ['characterCreated', 'abilityScoreChanged', 'levelUp', 'levelLoss', 'xpAwarded', 'equip', 'useItem'];

export const APPLIES_TO = ['pc', 'retainer', 'mercenary', 'specialist', 'any'];
export const FILL_TARGETS = ['abilityModifiers', 'hitDice', 'attack', 'saves', 'spellSlots', 'skills', 'title'];
export const FACTOR_TARGETS = ['xp', 'wage', 'share'];
export const FILL_SOURCES = ['abilityModifiers', 'classProgression'];
export const OFFERS = ['swap', 'stowOther'];
export const REMIND_UNITS = ['round', 'turn', 'hour', 'day', 'week'];
/** The rules set's sections only the GM reads (as the database splits them). */
export const GM_SECTIONS = ['monsters', 'magicItems', 'procedures'];
const MAX_TEST = 300;

/** What the rest of the pack says, for checks that look beyond the hook itself. */
export interface HookContext {
  /** Campaign field keys from the pack's sheet layouts (a fill may target one). */
  fieldKeys?: readonly string[];
  /** Ids of the pack's tables (GM-only). */
  tableIds?: readonly string[];
  /** The rules set's sections marked GM-only, beyond the usual ones. */
  gmSections?: readonly string[];
}

export interface HookCheck {
  /** It can't run as written: the editor asks for these first. */
  problems: string[];
  /** It runs, but something is worth knowing (a blank placeholder, a read players' devices can't make). */
  warnings: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (words: readonly string[]) => words.join(', ');
const placeholders = (message: string) => [...message.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]!.trim());

/** Checks one hook's fields against the spec. */
export function checkHook(hook: Record<string, unknown>, context: HookContext = {}): HookCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  const kind = hook.kind;
  const when = hook.when;
  if (typeof kind !== 'string' || !(HOOK_KINDS as readonly string[]).includes(kind)) problems.push(`Its kind must be one of ${list(HOOK_KINDS)}.`);
  const given = typeof when === 'string' ? HOOK_EVENTS[when] : undefined;
  const names = given ? [...new Set([...given, ...EVERY_EVENT])] : undefined;
  if (typeof when !== 'string' || !when) problems.push('It needs a "when" (an event, like equip).');
  else if (!names) problems.push(`"${when}" isn't an event the app knows (${list(Object.keys(HOOK_EVENTS))}).`);
  if (hook.appliesTo !== undefined && !(typeof hook.appliesTo === 'string' && APPLIES_TO.includes(hook.appliesTo))) {
    problems.push(`"appliesTo" must be one of ${list(APPLIES_TO)}.`);
  }

  // An expression's names must come from the event; its functions from the fixed list.
  const onDevice = typeof when === 'string' && PLAYER_DEVICE_EVENTS.includes(when);
  const gmOnly = new Set([...GM_SECTIONS, ...(context.gmSections ?? []), ...(context.tableIds ?? [])]);
  const expression = (label: string, text: unknown, maxLength?: number) => {
    if (typeof text === 'number') return;
    if (typeof text !== 'string' || text.trim() === '') return problems.push(`${label} must be an expression.`);
    if (maxLength && text.length > maxLength) problems.push(`${label} is longer than ${maxLength} characters.`);
    const wrong = checkExpression(text);
    if (wrong) return problems.push(`${label} can't be read: ${wrong}`);
    const used = namesIn(parseExpression(text));
    for (const fn of used.functions) {
      if (!(FUNCTIONS as readonly string[]).includes(fn)) problems.push(`${label} calls ${fn}(), which isn't one of ${list(FUNCTIONS)}.`);
    }
    // In a formula, level stands for the character's level.
    for (const path of used.paths) {
      const root = path.split('.')[0]!;
      if (names && !names.includes(root) && root !== 'level') warnings.push(`${label} reads "${path}", but ${String(when)} doesn't provide "${root}" (it has ${list(names)}); it will read as nothing.`);
    }
    // lookup("table.key", …) on a player's device can't reach GM-only data.
    if (onDevice) {
      for (const match of text.matchAll(/lookup\(\s*"([^"]+)"/g)) {
        const section = match[1]!.split('.')[0]!;
        if (gmOnly.has(section)) warnings.push(`${label} looks up "${match[1]}", which only the GM can read; on a player's device the hook will be skipped.`);
      }
    }
  };
  if (hook.test !== undefined) expression('Its test', hook.test, MAX_TEST);

  const message = hook.message;
  if (kind === 'warn' || kind === 'remind') {
    if (typeof message !== 'string' || message.trim() === '') problems.push('It needs a message to show.');
  }
  if (typeof message === 'string' && names) {
    for (const name of placeholders(message)) {
      if (!names.includes(name.split('.')[0]!)) warnings.push(`Its message has {${name}}, which ${String(when)} doesn't provide; it will show blank.`);
    }
  }
  if (hook.offer !== undefined) {
    if (kind !== 'warn') warnings.push('Only a warn hook has an offer; it will be ignored.');
    else if (!(typeof hook.offer === 'string' && OFFERS.includes(hook.offer))) problems.push(`Its offer must be one of ${list(OFFERS)}.`);
  }

  if (kind === 'fill') {
    const targets = Array.isArray(hook.target) ? hook.target : [hook.target];
    if (hook.target === undefined || targets.length === 0) problems.push('A fill needs a target.');
    else {
      for (const target of targets) {
        if (typeof target !== 'string') problems.push('Each target must be a name.');
        else if (!FILL_TARGETS.includes(target) && !(context.fieldKeys ?? []).includes(target)) {
          warnings.push(`"${target}" isn't a fill target (${list(FILL_TARGETS)}) or a field of the pack's sheet layout.`);
        }
      }
    }
    if ((hook.value === undefined) === (hook.from === undefined)) problems.push('A fill needs either a value or a from, not both.');
    if (hook.value !== undefined) expression('Its value', hook.value);
    if (hook.from !== undefined && !(typeof hook.from === 'string' && FILL_SOURCES.includes(hook.from))) {
      problems.push(`"from" must be one of ${list(FILL_SOURCES)}.`);
    }
    if (hook.respectEdited !== undefined && typeof hook.respectEdited !== 'boolean') problems.push('"respectEdited" must be true or false.');
  }
  if (kind === 'factor') {
    if (!(typeof hook.target === 'string' && FACTOR_TARGETS.includes(hook.target))) problems.push(`A factor's target must be one of ${list(FACTOR_TARGETS)}.`);
    if (hook.multiplier === undefined) problems.push('A factor needs a multiplier.');
    else expression('Its multiplier', hook.multiplier);
  }
  if (kind === 'remind' && hook.every !== undefined) {
    const every = hook.every;
    if (!(isRecord(every) && Number.isInteger(every.value) && (every.value as number) > 0 && typeof every.unit === 'string' && REMIND_UNITS.includes(every.unit))) {
      problems.push(`"every" must look like {"value": 3, "unit": "turn"} (units: ${list(REMIND_UNITS)}).`);
    }
  }
  return { problems, warnings };
}

/** The context for checking a pack's hooks, from the rest of its entries. */
export function hookContext(entries: readonly { kind: string; packEntryId: string; data: Record<string, unknown> }[]): HookContext {
  const fieldKeys: string[] = [];
  const gmSections: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'fieldTemplate' && Array.isArray(entry.data.fields)) {
      for (const field of entry.data.fields) if (isRecord(field) && typeof field.key === 'string') fieldKeys.push(field.key);
    }
    if (entry.kind === 'rulesSet') {
      for (const [key, value] of Object.entries(entry.data)) if (isRecord(value) && value.gmOnly === true) gmSections.push(key);
    }
  }
  return { fieldKeys, gmSections, tableIds: entries.filter((e) => e.kind === 'table').map((e) => e.packEntryId) };
}
