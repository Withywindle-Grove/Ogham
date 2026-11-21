// The GM reference screen's content (docs/05 "The GM reference screen", ruled 2026-11-01, M5 gate B4; 07
// `gmReference`, G-45): the book itself, as panels of entries, one set of panels per attached pack. Pure: it reads
// the campaign's entries and never changes them. Nothing here is typed by anyone: every line is the pack's.
//
// How the standard panels are filled (also in 06, the GM reference screen row). A panel with nothing behind it is
// left out; so is an entry with no words.
//   Combat          the rules set's `initiative`, `surprise`, `procedures.encounter`, `encounter`, `combat`,
//                   `morale`, `death` and `pursuit`, one entry each, in that order
//   Dungeons        each exploration mode that steps in turns (its procedure, checks, movement, rest), then
//                   `exploration.note`, then each part of `procedures.dungeon` and of the reference-only `dungeon`
//                   section, then the common player actions (`exploration.playerActions`), grouped as the pack
//                   groups them
//   Class abilities each class, as the rules browser shows it (abilities by level and the rest)
//   Equipment       the items, grouped by category (the rules set's `itemCategories` names and order, as Add item)
//   Tables          the pack's tables by name; each opens the table
// Then the pack's own `gmReference` panels (its rules sets', then its top-level ones): "The book's GM pages" in the
// list, after "From the rules" (tf-10; the "pack" tag is gone).
// Values in words, never raw keys (tf-11): an optional rule's "<option>=<choice>" (a `byOption` key, an `option`
// value) reads "<option's name> · <choice's name>" from the campaign's options ("Initiative ties · Roll again").
import { groupActions, readPlayerActions } from '../expedition/playerActions.ts';
import { describeEntry, labelOf, type Line } from './describe.ts';
import type { PackEntry, PackKind } from './packFile.ts';
import { isRuleTextBlocks, readRuleText, ruleTextWords } from './ruleText.ts';

export interface RefEntry {
  /** Unique in its panel. */
  key: string;
  heading: string;
  /** The subheading it sorts under (the player actions' groups, the items' categories); null for none. */
  group: string | null;
  /** The pack's own words, as paragraphs. */
  paragraphs: string[];
  /** The rest of what the pack holds for it, labelled (as the rules browser shows an entry). */
  lines: Line[];
  /** A table it opens. */
  tableId: string | null;
  /** Its page reference, as the pack gives it. */
  source: string | null;
}

export type StandardPanel = 'combat' | 'dungeons' | 'classes' | 'equipment' | 'tables';

export interface RefPanel {
  /** A standard panel's name, or "ref:<the pack's panel id>". */
  id: string;
  title: string;
  /** "rules" for the panels the app builds from the rules (From the rules), "book" for the pack's own (The book's GM pages). */
  from: 'rules' | 'book';
  entries: RefEntry[];
}

export interface RefPack {
  packId: string;
  name: string;
  /** For page tags: "<short name> · p. 34". */
  shortName: string;
  panels: RefPanel[];
}

export const STANDARD_TITLES: Record<StandardPanel, string> = {
  combat: 'Combat',
  dungeons: 'Dungeons',
  classes: 'Class abilities',
  equipment: 'Equipment',
  tables: 'Tables',
};

/** The fight sections, in the panel's order, with their headings. */
const COMBAT_SECTIONS: readonly [path: string[], heading: string][] = [
  [['initiative'], 'Initiative'],
  [['surprise'], 'Surprise'],
  [['procedures', 'encounter'], 'Encounters'],
  // 07 lets a rules set keep its encounter rules at the top level too (reference only); it doesn't say which wins
  // when both are there, so both show, the procedure first (the area-4 re-check, 2026-11-04).
  [['encounter'], 'Encounters'],
  [['combat'], 'Fighting'],
  [['morale'], 'Morale'],
  [['death'], 'Death and dying'],
  [['pursuit'], 'Pursuit'],
];

/** Keys whose words are the entry's own paragraphs, not a labelled line. */
const WORDS = ['note', 'notes', 'explain', 'text', 'description'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
// Words as the pack gives them; rule text set out in blocks (pf-18a) reads as its plain words. A string is unchanged.
const words = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() ? value.trim() : null;
  if (isRuleTextBlocks(value)) return ruleTextWords(readRuleText(value).value) || null;
  return null;
};
const at = (data: Record<string, unknown>, path: string[]): unknown => path.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), data);

/** A page reference: a string as it is; one keyed by class, every class's page. */
function sourceOf(value: unknown, nameOf: (id: string) => string | undefined): string | null {
  if (typeof value === 'string') return words(value);
  if (!isRecord(value)) return null;
  const pages = Object.entries(value).flatMap(([id, page]) => (words(page) ? [`${nameOf(id) ?? id} ${String(page).trim()}`] : []));
  return pages.length > 0 ? pages.join('; ') : null;
}

/** One section of the pack as an entry: its words as paragraphs, the rest as lines. Null when it holds nothing. */
function sectionEntry(key: string, heading: string, value: unknown, nameOf: (id: string) => string | undefined, group: string | null = null): RefEntry | null {
  if (typeof value === 'string') {
    const text = words(value);
    return text ? { key, heading, group, paragraphs: [text], lines: [], tableId: null, source: null } : null;
  }
  if (Array.isArray(value)) value = { list: value };
  if (!isRecord(value)) return null;
  const paragraphs = WORDS.map((k) => words(value[k])).filter((text): text is string => text !== null);
  const rest = Object.fromEntries(Object.entries(value).filter(([k]) => !WORDS.includes(k) || words(value[k]) === null));
  const { lines } = describeEntry({ kind: 'rulesSet', packEntryId: key, name: heading, data: rest }, nameOf, { gm: true });
  if (paragraphs.length === 0 && lines.length === 0) return null;
  return { key, heading, group, paragraphs, lines, tableId: null, source: sourceOf(value.source, nameOf) };
}

/** A whole entry (a class, an item) as the rules browser describes it. */
function wholeEntry(entry: PackEntry, nameOf: (id: string) => string | undefined, group: string | null = null): RefEntry | null {
  const { notes, lines } = describeEntry(entry, nameOf, { gm: true });
  if (notes.length === 0 && lines.length === 0) return null;
  return { key: entry.packEntryId, heading: entry.name, group, paragraphs: notes, lines, tableId: null, source: sourceOf(entry.data.source, nameOf) };
}

const tidied = (id: string) => (id ? `${id.charAt(0).toUpperCase()}${id.slice(1).replace(/[-_]+/g, ' ')}` : 'Other');

/** The campaign's optional rules by id: their names and their choices' names (for values in words, tf-11). */
type OptionWords = Map<string, { name: string; choices: Map<string, string> }>;

function optionWordsOf(entries: readonly PackEntry[]): OptionWords {
  const map: OptionWords = new Map();
  for (const entry of entries.filter((e) => e.kind === 'option')) {
    if (map.has(entry.packEntryId)) continue;
    const choices = new Map<string, string>();
    for (const choice of Array.isArray(entry.data.choices) ? entry.data.choices.filter(isRecord) : []) {
      if (typeof choice.id === 'string') choices.set(choice.id, words(choice.name) ?? tidied(choice.id));
    }
    map.set(entry.packEntryId, { name: entry.name, choices });
  }
  return map;
}

/**
 * "initiative-ties=party" (or "…:party") in words: "<option's name> · <choice's name>"; an option the campaign
 * doesn't have, tidied ("Initiative ties · Party"). Null for anything else (a time like "08:00" stays as it is).
 */
export function choiceWords(text: string, options: OptionWords): string | null {
  const found = /^([a-z0-9][a-z0-9_-]*)([=:])([a-z0-9][a-z0-9_-]*)$/i.exec(text.trim());
  if (!found) return null;
  const [, optionId, mark, choiceId] = found as unknown as [string, string, string, string];
  const option = options.get(optionId);
  if (!option && mark === ':') return null;
  return `${option?.name ?? tidied(optionId)}, ${option?.choices.get(choiceId) ?? tidied(choiceId)}`;
}

/** A section with every option key and value in words (tf-11); `byOption` reads "With optional rules". */
function inWords(value: unknown, options: OptionWords): unknown {
  if (typeof value === 'string') return choiceWords(value, options) ?? value;
  if (Array.isArray(value)) return value.map((v) => inWords(v, options));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key === 'byOption' ? 'With optional rules' : (choiceWords(key, options) ?? key), inWords(v, options)]),
  );
}

function combatPanel(rulesSets: Record<string, unknown>[], nameOf: (id: string) => string | undefined): RefEntry[] {
  // rulesSets come here already in words (inWords).
  return rulesSets.flatMap((rules, i) =>
    COMBAT_SECTIONS.flatMap(([path, heading]) => sectionEntry(`${i}:${path.join('.')}`, heading, at(rules, path), nameOf) ?? []),
  );
}

function dungeonsPanel(rulesSets: Record<string, unknown>[], nameOf: (id: string) => string | undefined): RefEntry[] {
  const entries: RefEntry[] = [];
  rulesSets.forEach((rules, i) => {
    const exploration = isRecord(rules.exploration) ? rules.exploration : {};
    const modes = Array.isArray(exploration.modes) ? exploration.modes.filter(isRecord) : [];
    for (const mode of modes.filter((m) => isRecord(m.step) && m.step.unit === 'turn')) {
      const { procedure, checks, movement, rest, note, source } = mode;
      const name = words(mode.name) ?? words(mode.id) ?? 'Exploring';
      const entry = sectionEntry(`${i}:mode:${String(mode.id)}`, name, { note, procedure, checks, movement, rest, source }, nameOf);
      if (entry) entries.push(entry);
    }
    const note = sectionEntry(`${i}:exploration.note`, 'Exploring', exploration.note, nameOf);
    if (note) entries.push(note);
    for (const path of [['procedures', 'dungeon'], ['dungeon']]) {
      const section = at(rules, path);
      if (typeof section === 'string') {
        const entry = sectionEntry(`${i}:${path.join('.')}`, 'Dungeons', section, nameOf);
        if (entry) entries.push(entry);
        continue;
      }
      if (!isRecord(section)) continue;
      for (const [key, value] of Object.entries(section)) {
        if (key === 'source' || key === 'gmOnly') continue;
        const entry = sectionEntry(`${i}:${path.join('.')}.${key}`, labelOf(key), value, nameOf);
        if (entry) entries.push({ ...entry, source: entry.source ?? sourceOf(section.source, nameOf) });
      }
    }
  });
  // The common player actions (DG10, A5): the top rules set that lists any wins, grouped as the pack groups them.
  for (const group of groupActions(readPlayerActions(rulesSets))) {
    for (const action of group.actions) {
      if (!action.text) continue;
      entries.push({ key: `action:${action.id}`, heading: action.name, group: group.name, paragraphs: [action.text], lines: [], tableId: null, source: action.source });
    }
  }
  return entries;
}

function equipmentPanel(items: PackEntry[], categories: Map<string, { name: string; order: number }>, nameOf: (id: string) => string | undefined): RefEntry[] {
  const categoryOf = (item: PackEntry) => (typeof item.data.category === 'string' ? item.data.category : '');
  const order = [...new Set(items.map(categoryOf))]
    .map((id) => ({ id, name: categories.get(id)?.name ?? tidied(id), order: categories.get(id)?.order ?? 1000 }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return order.flatMap((category) =>
    items
      .filter((item) => categoryOf(item) === category.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((item) => wholeEntry(item, nameOf, category.name) ?? []),
  );
}

/**
 * The pack's own panels (07 `gmReference`): each rules set's, then the pack's top-level ones (kept as
 * `gmReferencePanel` entries; G-55), merged into one list. Entries with a heading or words; panels with none left
 * out; a panel id seen twice keeps the first.
 */
function extraPanels(rulesSets: Record<string, unknown>[], topLevel: Record<string, unknown>[]): RefPanel[] {
  const panels: RefPanel[] = [];
  const lists = [...rulesSets.map((rules) => (Array.isArray(rules.gmReference) ? rules.gmReference.filter(isRecord) : [])), topLevel];
  for (const listed of lists) {
    listed.forEach((panel, p) => {
      const id = words(panel.id) ?? String(p);
      const title = words(panel.title) ?? words(panel.name);
      if (!title) return;
      const entries = (Array.isArray(panel.entries) ? panel.entries.filter(isRecord) : []).flatMap((entry, e): RefEntry[] => {
        const heading = words(entry.heading);
        const text = words(entry.text);
        if (!heading && !text) return [];
        return [{ key: `${id}:${e}`, heading: heading ?? '', group: null, paragraphs: text ? [text] : [], lines: [], tableId: words(entry.tableId), source: words(entry.source) }];
      });
      if (entries.length > 0 && !panels.some((known) => known.id === `ref:${id}`)) panels.push({ id: `ref:${id}`, title, from: 'book', entries });
    });
  }
  return panels;
}

export interface ReferencePackInput {
  packId: string;
  name: string;
  shortName: string;
  kind: PackKind;
}

/**
 * Every attached pack's panels, base rules first (the stack is given top first). A pack with nothing to show is
 * left out, so "No reference in this setting" is an empty list. `entries` are the campaign's, each with its pack.
 */
export function buildReference(packs: readonly ReferencePackInput[], entries: readonly (PackEntry & { packId: string })[]): RefPack[] {
  const names = new Map<string, string>();
  for (const entry of entries) if (!names.has(entry.packEntryId)) names.set(entry.packEntryId, entry.name);
  const options = optionWordsOf(entries);
  const nameOf = (id: string) => names.get(id) ?? choiceWords(id, options) ?? undefined;
  // Item categories' names and order come from every rules set (higher packs win), as Add item does.
  const categories = new Map<string, { name: string; order: number }>();
  for (const pack of [...packs].reverse()) {
    for (const rules of entries.filter((e) => e.packId === pack.packId && e.kind === 'rulesSet')) {
      for (const category of Array.isArray(rules.data.itemCategories) ? rules.data.itemCategories.filter(isRecord) : []) {
        const name = words(category.name);
        if (typeof category.id === 'string' && name) categories.set(category.id, { name, order: typeof category.order === 'number' ? category.order : 999 });
      }
    }
  }

  return [...packs].reverse().flatMap((pack): RefPack[] => {
    const own = entries.filter((entry) => entry.packId === pack.packId);
    const worded = <T extends PackEntry>(entry: T): T => ({ ...entry, data: inWords(entry.data, options) as Record<string, unknown> });
    const of = (kind: PackEntry['kind']) => own.filter((entry) => entry.kind === kind);
    const rulesSets = of('rulesSet').map((entry) => inWords(entry.data, options) as Record<string, unknown>);
    const tables = of('table')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((table): RefEntry => ({ key: table.packEntryId, heading: table.name, group: null, paragraphs: words(table.data.description) ? [words(table.data.description)!] : [], lines: [], tableId: table.packEntryId, source: sourceOf(table.data.source, nameOf) }));
    const standard: [StandardPanel, RefEntry[]][] = [
      ['combat', combatPanel(rulesSets, nameOf)],
      ['dungeons', dungeonsPanel(rulesSets, nameOf)],
      ['classes', of('class').sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => wholeEntry(worded(entry), nameOf) ?? [])],
      ['equipment', equipmentPanel(of('item').map(worded), categories, nameOf)],
      ['tables', tables],
    ];
    const panels: RefPanel[] = [
      ...standard.filter(([, list]) => list.length > 0).map(([id, list]): RefPanel => ({ id, title: STANDARD_TITLES[id], from: 'rules', entries: list })),
      ...extraPanels(rulesSets, of('gmReferencePanel').map((entry) => entry.data)),
    ];
    return panels.length > 0 ? [{ packId: pack.packId, name: pack.name, shortName: pack.shortName, panels }] : [];
  });
}

/** Every word an entry shows, for the search. */
function textOf(entry: RefEntry): string {
  const flat = (lines: Line[]): string[] => lines.flatMap((line) => [line.label, line.value ?? '', ...flat(line.lines ?? [])]);
  return [entry.heading, entry.group ?? '', ...entry.paragraphs, ...flat(entry.lines)].join(' ').toLowerCase();
}

export interface RefHit {
  pack: RefPack;
  panel: RefPanel;
  entry: RefEntry;
}

/** The search across every panel of every pack (B4: it searches every panel): entries whose words hold the query. */
export function searchReference(packs: readonly RefPack[], query: string): RefHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return packs.flatMap((pack) => pack.panels.flatMap((panel) => panel.entries.filter((entry) => textOf(entry).includes(needle)).map((entry) => ({ pack, panel, entry }))));
}
