// A stat block laid out as its pack says (pf-13, ruled; December 5c, mockup docs/design/mockups/december/06-stat-block):
// one `meta.statBlockLayout` per pack names its descriptor line (labels whose values are joined on one line), its
// groups (each a list of lines, each line a list of labels) and labels never shown; "hp" is the reserved label for hit
// points. The app invents no grouping: a pack that declares none gets one compact group in its own order. Labels are the
// pack's own words, never renamed. Pure: the reader, and the block in the parts the stat block part draws.
import { BOOKKEEPING_KEYS, STAT_BLOCK_BEHAVIOUR_KEYS, describeEntry, type Line } from './describe.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export interface StatBlockLayout {
  /** Labels whose values make the descriptor line ("Medium beast, animal wits, unaligned"). */
  descriptor: string[];
  /** Groups, a rule between each; a group is lines; a line is labels, several pairs to a line. */
  groups: string[][][];
  /** Labels never shown. */
  hide: string[];
}

/** One label and its value, as the block shows it ("Armour" "7"). */
export interface Figure {
  label: string;
  value: string;
}

export interface Ability {
  name: string;
  note: string;
}

/** A stat block in the parts the stat block part draws, in its order. */
export interface StatBlockShown {
  /** Its description and notes, as paragraphs. */
  notes: string[];
  /** The descriptor line, or null when the block has none of its labels. */
  descriptor: string | null;
  /** Groups of lines of figures; never an empty line or group. */
  groups: Figure[][][];
  abilities: Ability[];
  /** Anything else it holds (its sizes, its parts), as the Rules browser's lines. */
  rest: Line[];
  /** The waiting card's stat line: the first group run on, or (with no layout) the first six figures. */
  line: Figure[];
}

/** The label the layout uses for hit points. */
export const HP = 'hp';
const HP_WORDS = 'Hit points';

const labels = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((label) => (typeof label === 'string' && label.trim() ? [label.trim()] : [])) : [];

/** The pack's `meta.statBlockLayout`, or null when it has none. A broken part is left out, never an error. */
export function readStatBlockLayout(meta: unknown): StatBlockLayout | null {
  const raw = isRecord(meta) ? meta.statBlockLayout : undefined;
  if (!isRecord(raw)) return null;
  const groups = (Array.isArray(raw.groups) ? raw.groups : [])
    .map((group) => (Array.isArray(group) ? group.map(labels).filter((line) => line.length > 0) : []))
    .filter((group) => group.length > 0);
  return { descriptor: labels(raw.descriptor), groups, hide: labels(raw.hide) };
}

/** A value as one piece of text: "2d8", 999, "a, b", "D 10, W 11". */
function text(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ') || null;
  if (isRecord(value)) return Object.entries(value).map(([k, v]) => `${k} ${text(v) ?? ''}`.trim()).join(', ') || null;
  return null;
}

/** Saves given as a structure ({ D: 10, W: 11 }) as the books print them: "D10 W11". */
const savesText = (saves: unknown): string | null =>
  isRecord(saves)
    ? Object.entries(saves)
        .flatMap(([k, v]) => (text(v) ? [k.length <= 2 ? `${k}${text(v)!}` : `${k} ${text(v)!}`] : []))
        .join(' ') || null
    : text(saves);

/** The block's figures in the pack's own order, each with the name the layout calls it by ("hp" for hit points). */
function figuresOf(data: Record<string, unknown>): (Figure & { key: string })[] {
  const out: (Figure & { key: string })[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'hp' || (key === 'hpAverage' && data.hp === undefined)) {
      const hp = text(data.hp);
      const average = text(data.hpAverage);
      const shown = hp && average ? `${hp} (${average})` : (hp ?? average);
      if (shown) out.push({ key: HP, label: HP_WORDS, value: shown });
    } else if (key === 'fields' && isRecord(value)) {
      for (const [label, field] of Object.entries(value)) {
        const shown = text(field);
        if (shown) out.push({ key: label, label, value: shown });
      }
    }
  }
  // Saves the pack gives only as a structure still show, as one figure.
  const saves = savesText(data.saves);
  if (saves && !out.some((f) => same(f.key, 'Saves'))) out.push({ key: 'Saves', label: 'Saves', value: saves });
  return out;
}

// A layout's name matches a creature's field exactly, case included (pf-13b, 2026-11-13): "hp" in lower case is the
// reserved name for hit points, and a field spelt "HP" is an ordinary field; hiding one never hides the other.
const same = (a: string, b: string) => a.trim() === b.trim();

function abilitiesOf(value: unknown): Ability[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [{ name: '', note: item.trim() }] : [];
    if (!isRecord(item)) return [];
    const name = text(item.name) ?? '';
    const note = text(item.note) ?? text(item.notes) ?? text(item.effect) ?? '';
    return name || note ? [{ name, note }] : [];
  });
}

// Keys the block's parts draw, and the app's own bookkeeping (behaviour, tags, links), which a reader of the block doesn't need.
// The links, tags and the like are the shared list (describe.ts, A4, of-7), as are the behaviour fields; `gmOnly` is the block's own.
const DRAWN = new Set(['id', 'name', 'description', 'notes', 'source', 'hp', 'hpAverage', 'fields', 'saves', 'abilities', 'groupAbilities']);
const BOOKKEEPING = new Set([...STAT_BLOCK_BEHAVIOUR_KEYS, 'gmOnly', ...BOOKKEEPING_KEYS]);

/**
 * The block laid out by its pack's layout (or, with none, one compact group in its own order). `alsoHide` adds labels
 * and keys left out for this reader (an entry's `gmOnly` fields, for anyone but the GM).
 */
export function layOutStatBlock(
  data: Record<string, unknown>,
  layout: StatBlockLayout | null,
  nameOf: (id: string) => string | undefined = () => undefined,
  alsoHide: readonly string[] = [],
): StatBlockShown {
  const hidden = (label: string) => [...(layout?.hide ?? []), ...alsoHide].some((h) => same(h, label));
  const figures = figuresOf(data).filter((f) => !hidden(f.key) && !hidden(f.label));
  const used = new Set<(typeof figures)[number]>();
  const take = (label: string) => {
    const found = figures.find((f) => !used.has(f) && same(f.key, label));
    if (found) used.add(found);
    return found ? [{ label: found.label, value: found.value }] : [];
  };

  let descriptor: string | null = null;
  let groups: Figure[][][];
  if (layout) {
    descriptor = layout.descriptor.flatMap(take).map((f) => f.value).join(', ') || null;
    groups = layout.groups.map((group) => group.map((line) => line.flatMap(take)).filter((line) => line.length > 0)).filter((group) => group.length > 0);
    const left = figures.filter((f) => !used.has(f)).map(({ label, value }) => ({ label, value }));
    if (left.length > 0) groups.push([left]);
  } else {
    const all = figures.map(({ label, value }) => ({ label, value }));
    groups = all.length > 0 ? [[all]] : [];
  }

  const notes = ['description', 'notes'].map((key) => data[key]).filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  const restData = Object.fromEntries(Object.entries(data).filter(([key]) => !DRAWN.has(key) && !BOOKKEEPING.has(key) && !hidden(key)));
  // Notes kept by class ({ "lantern-warden": "…" }) can't be a paragraph: they show with the rest.
  if (isRecord(data.notes)) restData.notes = data.notes;
  const rest = describeEntry({ kind: 'statBlock', packEntryId: '', name: '', data: restData }, nameOf, { gm: true }).lines;

  const line = layout ? (groups[0] ?? []).flat() : (groups[0] ?? []).flat().slice(0, 6);
  return { notes, descriptor, groups, abilities: [...abilitiesOf(data.abilities), ...abilitiesOf(data.groupAbilities)], rest, line };
}
