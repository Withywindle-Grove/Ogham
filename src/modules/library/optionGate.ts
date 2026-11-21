// The one option reader (design/rulings/m5b-options-format-2026-11-03.md, of-3, of-9, of-10; plans/options-gates.md,
// build order 1). Any entry (item, class, race, spell, kit, table, list, field) may carry
//   `option`   "<option id>", "<option id>=<choice id>" (or the older ":<choice id>"; `onlyWithOption` is its alias):
//              the entry exists only while that choice is the campaign's (no choice id: the option's `on` choice);
//              or a list of them, the entry existing while any is chosen (of-12, m5b-options-format-2);
//   `byOption` { "<option id>=<choice id>": { ...fields } }: its fields under that choice, merged over its own in the
//              file's order; a field set to `null` is off (absent) while the choice is made (of-10). A key may list
//              several choices, comma-separated ("energy=exceptional,energy=artefacts"): any of them (of-12).
// `optionGate` answers both questions for one entry, once, when the campaign's setting is read (campaignSetting.ts),
// so every screen that lists entries (Add item, the shop, creation, the rules browser, the GM reference) keeps only
// those in play (`entriesInPlay`), and every screen that reads one (the sheet, the Player screen, the equip check)
// reads its fields as they are now. Entries switched off stay in the setting, marked, so a character who already has
// one still shows it by name. Races keep their own `byOption` reading (raceOptions.ts: limits are replaced, abilities
// added); rules sets keep theirs (options.ts `resolveRules`: byOption in any section). Pure; the app keeps no option ids.

export type Choices = Readonly<Record<string, string>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * An option spec as text: a list's specs joined with commas (of-12: `option` may be a list); '' for none. Anything
 * in a list that isn't words is left out.
 */
export function specText(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(',');
  return text(value);
}

/** One choice a spec names: the option's id and the choice's ('' for the option's `on` choice). */
export interface SpecPart {
  option: string;
  choice: string;
}

/**
 * The choices a spec names, in its order: "<option id>", "<option id>=<choice id>" or "<option id>:<choice id>", or
 * several of them as a list or comma-separated (of-12). Empty parts are left out.
 */
export function specParts(spec: unknown): SpecPart[] {
  return specText(spec)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.search(/[=:]/);
      return { option: (at < 0 ? part : part.slice(0, at)).trim(), choice: at < 0 ? '' : part.slice(at + 1).trim() };
    })
    .filter((part) => part.option !== '');
}

/**
 * Whether an option spec is on for the campaign's choices: "<option id>" (its `on` choice), "<option id>=<choice id>"
 * or "<option id>:<choice id>"; a list of them (or several comma-separated) is on while any is (of-12). No spec is
 * on. An option the campaign doesn't have is off.
 */
export function optionSpecOn(spec: unknown, choices: Choices): boolean {
  const parts = specParts(spec);
  if (parts.length === 0) return true;
  return parts.some((part) => choices[part.option] === (part.choice || 'on'));
}

/** The option ids a spec names ("lantern-oil=off" names "lantern-oil"), once each, in order; none for no spec. */
export function specOptions(spec: unknown): string[] {
  return [...new Set(specParts(spec).map((part) => part.option))];
}

/**
 * Whether a `byOption` key is on: each of its choices written "<option id>=<choice id>" (a key with a part that names
 * no choice is never on, 07), and any of them the campaign's (of-12).
 */
export function byOptionKeyOn(key: string, choices: Choices): boolean {
  const parts = specParts(key);
  return parts.length > 0 && parts.every((part) => part.choice !== '') && parts.some((part) => choices[part.option] === part.choice);
}

/**
 * An option's `requires` (07; A1, bq3-13): `{ optionId: choiceId }` or `{ optionId: [choiceIds] }`, as one shape (each
 * option's choices as a list); empty when it needs none. Anything that isn't words is left out.
 */
export function requiresOf(data: Record<string, unknown>): Record<string, string[]> {
  if (!isRecord(data.requires)) return {};
  const out: Record<string, string[]> = {};
  for (const [option, value] of Object.entries(data.requires)) {
    const ids = (Array.isArray(value) ? value : [value]).map(text).filter(Boolean);
    if (option.trim() && ids.length > 0) out[option.trim()] = ids;
  }
  return out;
}

/** Whether an option's `requires` is met by these choices: every option it names has one of its choices. */
export function requiresOn(requires: Readonly<Record<string, readonly string[]>> | undefined, choices: Choices): boolean {
  return Object.entries(requires ?? {}).every(([option, ids]) => ids.includes(choices[option] ?? ''));
}

/**
 * The choices with every option whose `requires` isn't met at its default (07: "otherwise it's hidden and uses its
 * default"; A1). Followed until nothing changes, so an add-on to an add-on goes too. The same object when none moves.
 */
export function withRequires(options: readonly { id: string; requires?: Readonly<Record<string, readonly string[]>>; defaultChoice?: string }[], choices: Choices): Choices {
  let out = choices;
  for (let pass = 0; pass <= options.length; pass++) {
    let moved = false;
    for (const option of options) {
      if (!option.requires || option.defaultChoice === undefined || requiresOn(option.requires, out) || out[option.id] === option.defaultChoice) continue;
      out = { ...out, [option.id]: option.defaultChoice };
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

/** The option an entry needs to exist: its `option`, else the older `onlyWithOption`; '' when it needs none. */
export function entryOptionSpec(data: Record<string, unknown>): string {
  return specText(data.option) || specText(data.onlyWithOption);
}

/** Deep-merges b over a: objects merge, anything else replaces; a `null` in b removes that field (of-10). */
export function mergeOver(a: unknown, b: unknown): unknown {
  if (!isRecord(a) || !isRecord(b)) return b;
  const out: Record<string, unknown> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (value === null) delete out[key];
    else out[key] = key in out ? mergeOver(out[key], value) : value;
  }
  return out;
}

/** A base with each `byOption` override whose choice the campaign made merged over it, in the file's order. */
export function applyByOption(base: Record<string, unknown>, byOption: unknown, choices: Choices): Record<string, unknown> {
  if (!isRecord(byOption)) return base;
  let resolved = base;
  for (const [key, override] of Object.entries(byOption)) {
    if (!byOptionKeyOn(key, choices)) continue;
    if (isRecord(override)) resolved = mergeOver(resolved, override) as Record<string, unknown>;
  }
  return resolved;
}

/** The kinds whose `byOption` is read elsewhere, with its own meaning (races: raceOptions.ts; rules sets: resolveRules). */
const OWN_BY_OPTION = new Set(['race', 'rulesSet', 'option', 'patch']);

/**
 * A class's optional weapons (`weaponsAllowed.optional: { ids, option }`, 07): kept only while their option is on, so
 * the equip check and Weapon skills read the class as it is in play (the options audit, arcane staves).
 */
function withOptionalWeapons(data: Record<string, unknown>, choices: Choices): Record<string, unknown> {
  const rule = data.weaponsAllowed;
  if (!isRecord(rule) || !isRecord(rule.optional) || !specText(rule.optional.option) || optionSpecOn(rule.optional.option, choices)) return data;
  const rest = { ...rule };
  delete rest.optional;
  return { ...data, weaponsAllowed: rest };
}

export interface Gated {
  /** Whether the entry exists for these choices (its `option`). */
  inPlay: boolean;
  /** The spec that switches it off; '' while it's in play. */
  offBy: string;
  /** Its fields now: its `byOption` for the choices made (null fields removed), without `byOption` itself. */
  data: Record<string, unknown>;
}

/**
 * Does this entry exist, and what are its fields now, for the campaign's choices (of-3). The same object back when
 * nothing changes. Options, races and rules sets keep their own `byOption` (see the head of this file).
 */
export function optionGate(entry: { kind: string; data: Record<string, unknown> }, choices: Choices): Gated {
  const spec = entryOptionSpec(entry.data);
  const inPlay = optionSpecOn(spec, choices);
  let data = entry.data;
  if (!OWN_BY_OPTION.has(entry.kind) && entry.data.byOption !== undefined) {
    const { byOption, ...own } = entry.data;
    data = applyByOption(own, byOption, choices);
  }
  if (entry.kind === 'class') data = withOptionalWeapons(data, choices);
  return { inPlay, offBy: inPlay ? '' : spec, data };
}

/** The entries that exist in the campaign: those not switched off by an option (`optionOff`, set when the setting is read). */
export function entriesInPlay<T extends { optionOff?: string }>(entries: readonly T[]): T[] {
  return entries.filter((e) => !e.optionOff);
}

/**
 * The key a layout field's key becomes on the campaign ("Use this sheet layout", fields.ts keyFromLabel): lower case,
 * "_" for anything else ("swordDrills" → "sworddrills"). '' for a key with no letters or digits.
 */
export function layoutKey(key: string): string {
  return key.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);
}

/**
 * A layout field's key as the campaign's fields may hold it (gate check 59): as the layout writes it (a field a test
 * or the GM made) and as "Use this sheet layout" made it. Every gate keyed by a layout's keys holds both.
 */
export function layoutKeys(key: string): string[] {
  const made = layoutKey(key);
  return made && made !== key ? [key, made] : [key];
}

/** A sheet field as the setting's layouts and lists describe it: the option it needs, and the list it reads from. */
interface FieldOptionSource {
  kind: string;
  packEntryId: string;
  data: Record<string, unknown>;
  optionOff?: string;
}

/**
 * The sheet fields whose option is off (of-9), by key (both forms, `layoutKeys`): a sheet layout's field with an `option` the campaign hasn't
 * chosen, or one that reads from (`from`) a list switched off. Hidden everywhere (creation, the full sheet, the Player
 * screen); their values stay saved and come back with the option.
 */
export function fieldsOff(entries: readonly FieldOptionSource[], choices: Choices): Set<string> {
  const listsOff = new Set(entries.filter((e) => e.kind === 'traitList' && e.optionOff).map((e) => e.packEntryId));
  const off = new Set<string>();
  for (const layout of entries.filter((e) => e.kind === 'fieldTemplate' && !e.optionOff)) {
    for (const field of Array.isArray(layout.data.fields) ? layout.data.fields.filter(isRecord) : []) {
      const key = text(field.key);
      if (!key) continue;
      if (!optionSpecOn(field.option, choices) || (text(field.from) && listsOff.has(text(field.from)))) for (const k of layoutKeys(key)) off.add(k);
    }
  }
  return off;
}

/** The fields of a list (the campaign's field definitions) whose option is on, in their order. */
export function fieldsInPlay<T extends { key: string }>(fields: readonly T[], off: ReadonlySet<string> | undefined): T[] {
  return off && off.size > 0 ? fields.filter((f) => !off.has(f.key)) : [...fields];
}

/**
 * The sheet fields an option's choices add (of-9: the option's row in Rules says "Adds a field: …"), by the field's
 * label in the layout (its key when it has none). An option that adds none gives an empty list.
 */
export function fieldsAddedBy(entries: readonly FieldOptionSource[], optionId: string): string[] {
  const lists = new Set(entries.filter((e) => e.kind === 'traitList' && specOptions(entryOptionSpec(e.data)).includes(optionId)).map((e) => e.packEntryId));
  const names: string[] = [];
  for (const layout of entries.filter((e) => e.kind === 'fieldTemplate')) {
    for (const field of Array.isArray(layout.data.fields) ? layout.data.fields.filter(isRecord) : []) {
      if (!specOptions(field.option).includes(optionId) && !(text(field.from) && lists.has(text(field.from)))) continue;
      const name = text(field.label) || text(field.key);
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

/** An option's words with the fields it adds (of-9): "… Adds a field: Moon mark." ("Adds fields: …" for several). */
export function withFieldsAdded(notes: string, fields: readonly string[]): string {
  if (fields.length === 0) return notes;
  const added = `${fields.length === 1 ? 'Adds a field' : 'Adds fields'}: ${fields.join(', ')}.`;
  return notes.trim() ? `${notes.trim()} ${added}` : added;
}

/**
 * Who a sheet field is for (07 `fields[].forClasses`, `fields[].forRaces`; cs-3, of-3, bq3-11): the class and kindred
 * ids a layout field names. A field naming neither isn't listed. Read once with the setting (campaignSetting.ts).
 */
export interface FieldFor {
  classes: string[];
  races: string[];
}

/** A list of ids as a pack writes it: a list of words, or one word; anything else names none. */
const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : []);

/** The sheet fields only some classes or kindreds are asked, by key (both forms, `layoutKeys`), from the layouts in play (the first layout naming a key wins). */
export function fieldsFor(entries: readonly FieldOptionSource[]): Map<string, FieldFor> {
  const out = new Map<string, FieldFor>();
  for (const layout of entries.filter((e) => e.kind === 'fieldTemplate' && !e.optionOff)) {
    for (const field of Array.isArray(layout.data.fields) ? layout.data.fields.filter(isRecord) : []) {
      const key = text(field.key);
      const gate = { classes: idsOf(field.forClasses), races: idsOf(field.forRaces) };
      if (key && !out.has(key) && (gate.classes.length > 0 || gate.races.length > 0)) for (const k of layoutKeys(key)) if (!out.has(k)) out.set(k, gate);
    }
  }
  return out;
}

/** The character a field is judged for: their class and kindred ids (null while not picked, or freeform). */
export interface FieldWho {
  classRef: string | null;
  raceRef: string | null;
}

/**
 * Whether a field applies to this character (cs-3): its classes, when it lists any, include theirs, and its kindreds
 * theirs. A class or kindred not picked yet (or a freeform character without one) hides nothing: there is nothing to
 * judge by, and the field may still be wanted.
 */
export function fieldForCharacter(gate: FieldFor | undefined, who: FieldWho | null | undefined): boolean {
  if (!gate || !who) return true;
  if (gate.classes.length > 0 && who.classRef && !gate.classes.includes(who.classRef)) return false;
  if (gate.races.length > 0 && who.raceRef && !gate.races.includes(who.raceRef)) return false;
  return true;
}

/**
 * The sheet fields hidden for one character, by key: those whose option is off (of-9) and those not for their class
 * or kindred (cs-3). Hidden everywhere (creation, the full sheet, the Player screen, the cards), their values kept and
 * shown again when they apply (a change of class back). Pass it to `fieldsInPlay`.
 */
export function fieldsOffFor(setting: { fieldsOff?: ReadonlySet<string>; fieldsFor?: ReadonlyMap<string, FieldFor> } | null | undefined, who: FieldWho | null | undefined): ReadonlySet<string> | undefined {
  const optionOff = setting?.fieldsOff;
  const gates = setting?.fieldsFor;
  if (!gates || gates.size === 0 || !who) return optionOff;
  const off = new Set(optionOff ?? []);
  for (const [key, gate] of gates) if (!fieldForCharacter(gate, who)) off.add(key);
  return off;
}
