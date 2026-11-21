// An entry of the setting rules in plain words, for the read-only browser (docs/05-features.md, Setting rules).
// Packs vary a lot between systems, so this reads whatever an entry holds: known keys get plain labels, ids
// become the names of the entries they point to, and anything else shows as "Label: value". Formulas stay as
// text; working them out is the formula evaluator's job.
import { packAndPage, titledSource, type SourceTitles } from './sourceTitles.ts';
import { workOut } from './formula.ts';
import type { PackEntry } from './packFile.ts';
import { isRuleTextBlocks, readRuleText, ruleTextWords } from './ruleText.ts';

export interface Line {
  label: string;
  value?: string;
  /** Nested parts (abilities, rows of a table, levels…). */
  lines?: Line[];
}

export interface Described {
  /** The entry's own description and notes, as paragraphs. */
  notes: string[];
  lines: Line[];
}

const LABELS: Record<string, string> = {
  hitDie: 'Hit die',
  xpTableId: 'XP table',
  xp: 'XP',
  primeXp: 'Prime XP',
  maxLevel: 'Highest level',
  weightCoin: 'Weight (coins)',
  fixedWeightCoin: 'Fixed weight (coins)',
  weightEmpty: 'Weight empty',
  weightFull: 'Weight full',
  carryBonus: 'Raises the carry limit by',
  capacityCoin: 'Holds (coins)',
  capacitySlots: 'Holds (slots)',
  stack: 'Per slot',
  hp: 'Hit points',
  hpAverage: 'Average hit points',
  hpVaries: 'Hit dice vary',
  abilityMods: 'Ability changes',
  armourAllowed: 'Armour allowed',
  weaponsAllowed: 'Weapons allowed',
  defaultRounds: 'Rounds by default',
  reversedName: 'Reversed',
  hitDice: 'Hit dice',
  spellSlots: 'Spell slots',
  qty: 'Quantity',
  costGp: 'Cost (gp)',
  gmOnly: 'Hidden from players',
  ac: 'AC',
  aac: 'Ascending AC',
  armourType: 'Armour type',
};

/**
 * The app's own bookkeeping on an entry (sn-1b: `pinnedFrom` names the pack an entry was copied from; links, an image,
 * how a block is turned; an entry's `tags` and a variant's `baseId`, of-7): read by code, never a row a reader sees
 * (test feedback 2026-11-19, A4; ruled 2026-11-20, of-7). One list, shared with the stat block (statBlockLayout.ts),
 * which hides these and the block-only keys it draws elsewhere.
 */
export const BOOKKEEPING_KEYS: readonly string[] = ['pinnedFrom', 'convertedFrom', 'sameAs', 'imageId', 'turnAs', 'tags', 'baseId'];

/**
 * A stat block's behaviour fields (07, Encounters and fights): read by the fight's foe card, never a row of the block's
 * details (of-7, 2026-11-20). Only on a stat block: another kind's `tables` (a kindred's creation tables) still shows.
 */
export const STAT_BLOCK_BEHAVIOUR_KEYS: readonly string[] = ['profile', 'nudges', 'triggers', 'actionMenu', 'tables'];

// `source` shows at the foot of the popup instead (sourceLine).
const SKIP = new Set(['id', 'name', 'notes', 'description', 'source', ...BOOKKEEPING_KEYS]);
/** Keys whose value is the line itself, not "label value", inside a row. */
const PLAIN = new Set(['notes', 'note', 'result', 'effect', 'amount']);
const MAX_DEPTH = 3;

/** "weightCoin" → "Weight coin"; ids ("…Id", "…Ids") lose the suffix. Labels the pack wrote ("AC") stay as they are. */
export function labelOf(key: string): string {
  if (LABELS[key]) return LABELS[key];
  if (!/^[a-z][A-Za-z0-9]*$/.test(key)) return key;
  const bare = key.replace(/Ids?$/, '') || key;
  const words = bare.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (isRecord(value) && Object.keys(value).length === 0) ||
  // Rule text in blocks with nothing to read (no blocks): no line, not a blank one.
  (isRuleTextBlocks(value) && readRuleText(value).value === null);
const plural = (unit: string, amount: unknown) => (amount === 1 ? unit : unit.endsWith('s') ? unit : `${unit}s`);

/** What the describing needs: other entries' names, and the level formulas are worked out at (if any). */
interface Ctx {
  nameOf: (id: string) => string | undefined;
  level?: number;
}

/** One value as a short piece of text, or null when it needs lines of its own. */
function inline(value: unknown, ctx: Ctx): string | null {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return ctx.nameOf(value) ?? value;
  if (Array.isArray(value)) {
    if (value.every((v) => !isRecord(v) && !Array.isArray(v))) return value.map((v) => inline(v, ctx)).join(', ');
    return null;
  }
  // Rule text set out in blocks (pf-18a): its plain words, a paragraph to a line, never its raw parts.
  if (isRuleTextBlocks(value)) return ruleTextWords(readRuleText(value).value);
  if (isRecord(value)) {
    const unit = typeof value.unit === 'string' ? value.unit : '';
    if ('formula' in value) {
      const formula = `${String(value.formula)}${unit ? ` ${plural(unit, 2)}` : ''}`;
      const worked = ctx.level === undefined ? null : workOut(String(value.formula), ctx.level);
      if (!worked) return formula;
      const amount = /^-?\d+$/.test(worked.text) ? Number(worked.text) : 2;
      return `${formula} → ${worked.text}${unit ? ` ${plural(unit, amount)}` : ''}${worked.roundedDown ? ' (rounded down)' : ''}`;
    }
    if ('roll' in value) return `${String(value.roll)}${unit ? ` ${plural(unit, 2)}` : ''} (rolled by the GM)`;
    if ('value' in value && unit) return `${String(value.value)} ${plural(unit, value.value)}`;
  }
  return null;
}

/** A row in a list of rows: its label (name, level, range or chance) and the rest. */
function rowLabel(row: Record<string, unknown>, index: number): [string, string[]] {
  if (typeof row.name === 'string') return [row.name, ['name']];
  if (typeof row.level === 'number') return [`Level ${row.level}`, ['level']];
  if (typeof row.min === 'number' && typeof row.max === 'number') return [row.min === row.max ? String(row.min) : `${row.min}–${row.max}`, ['min', 'max']];
  if (typeof row.chance === 'number') return [`${row.chance}%`, ['chance']];
  for (const key of ['label', 'key', 'letter']) if (typeof row[key] === 'string') return [row[key] as string, [key]];
  return [String(index + 1), []];
}

function linesOf(record: Record<string, unknown>, ctx: Ctx, depth: number, hidden: Set<string>, gm: boolean): Line[] {
  const lines: Line[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (isEmpty(value) || hidden.has(key)) continue;
    if (depth === 0 && SKIP.has(key)) continue;
    if (key === 'gmOnly') {
      if (gm && Array.isArray(value)) lines.push({ label: labelOf(key), value: value.map((k) => labelOf(String(k))).join(', ') });
      continue;
    }
    // Free-form fields ("AC", "Move"…) keep the labels the pack gave them, at the same level as the rest.
    if (key === 'fields' && isRecord(value)) {
      for (const [label, field] of Object.entries(value)) {
        if (isEmpty(field) || hidden.has(label)) continue;
        lines.push(lineOf(label, field, ctx, depth, hidden, gm));
      }
      continue;
    }
    lines.push(lineOf(labelOf(key), value, ctx, depth, hidden, gm));
  }
  return lines;
}

function lineOf(label: string, value: unknown, ctx: Ctx, depth: number, hidden: Set<string>, gm: boolean): Line {
  const text = inline(value, ctx);
  if (text !== null) return { label, value: text };
  if (depth >= MAX_DEPTH) return { label, value: JSON.stringify(value) };
  if (Array.isArray(value)) {
    return {
      label,
      lines: value.map((item, index) => {
        if (!isRecord(item)) return { label: String(index + 1), value: inline(item, ctx) ?? JSON.stringify(item) };
        const [rowName, used] = rowLabel(item, index);
        return rowOf(rowName, item, used, ctx, depth + 1, hidden, gm);
      }),
    };
  }
  if (isRecord(value)) {
    // Money: { gp: 1 } reads "1 gp".
    if (label === 'Value' && Object.values(value).every((v) => typeof v === 'number')) {
      return { label, value: Object.entries(value).map(([k, v]) => `${String(v)} ${k}`).join(', ') };
    }
    // Keys that are ids of other entries ({ "lantern-warden": 1 }) show as those entries' names.
    const renamed = Object.fromEntries(Object.entries(value).map(([k, v]) => [ctx.nameOf(k) ?? k, v]));
    // A few short parts read as one line, not a heading with nothing beside it (ruled 2026-10-24):
    // "Armour: AC 7, AAC 12, Class light".
    const parts = Object.entries(renamed).filter(([key, part]) => !isEmpty(part) && !hidden.has(key));
    const texts = parts.map(([key, part]) => [key, inline(part, ctx)] as const);
    if (parts.length > 0 && parts.length <= 4 && texts.every(([, text]) => text !== null)) {
      return { label, value: texts.map(([key, text]) => `${labelOf(key)} ${text}`).join(', ') };
    }
    return { label, lines: linesOf(renamed, ctx, depth + 1, hidden, gm) };
  }
  return { label, value: String(value) };
}

/** A row reads as one line when its other parts are short: "From level 3. Short note." */
function rowOf(label: string, row: Record<string, unknown>, used: string[], ctx: Ctx, depth: number, hidden: Set<string>, gm: boolean): Line {
  const rest = Object.entries(row).filter(([key, value]) => !used.includes(key) && !isEmpty(value));
  const texts = rest.map(([key, value]) => [key, inline(value, ctx)] as const);
  if (texts.every(([, text]) => text !== null)) {
    const labelled = texts.filter(([key]) => !PLAIN.has(key)).map(([key, text]) => `${labelOf(key)} ${text}`).join(', ');
    const plain = texts.filter(([key]) => PLAIN.has(key)).map(([, text]) => text).join(' ');
    return { label, value: [labelled, plain].filter(Boolean).join('. ') || undefined };
  }
  return { label, lines: linesOf(Object.fromEntries(rest), ctx, depth, hidden, gm) };
}

/**
 * What an entry holds, in plain words. `nameOf` turns another entry's id into its name. Fields the pack marks
 * `gmOnly` are left out unless `gm` (the database sends the whole entry, so this is about not showing them).
 * With a `level`, formulas show their worked value beside them ("2 + level turns → 5 turns").
 */
export function describeEntry(
  entry: PackEntry,
  nameOf: (id: string) => string | undefined,
  { gm = false, level }: { gm?: boolean; level?: number } = {},
): Described {
  const ctx: Ctx = { nameOf, level };
  const data = entry.data;
  const hidden = new Set(!gm && Array.isArray(data.gmOnly) ? data.gmOnly.map(String) : []);
  const notes = ['description', 'notes'].map((key) => data[key]).filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  const shown = entry.kind === 'statBlock' ? Object.fromEntries(Object.entries(data).filter(([key]) => !STAT_BLOCK_BEHAVIOUR_KEYS.includes(key))) : data;
  const lines = linesOf(shown, ctx, 0, hidden, gm);
  // Notes that differ by class ({ "lantern-warden": "…" }) can't be one paragraph; they show as lines.
  if (isRecord(data.notes) && !isEmpty(data.notes)) lines.push(lineOf('Notes', Object.fromEntries(Object.entries(data.notes).map(([k, v]) => [nameOf(k) ?? k, v])), ctx, 0, hidden, gm));
  return { notes, lines };
}

/** Whether an entry has any formula anywhere in it (the browser offers a level only then). */
export function hasFormula(entry: PackEntry): boolean {
  const search = (value: unknown, depth: number): boolean =>
    depth < 8 &&
    (Array.isArray(value)
      ? value.some((item) => search(item, depth + 1))
      : isRecord(value) && ('formula' in value || Object.values(value).some((item) => search(item, depth + 1))));
  return search(entry.data, 0);
}

/**
 * The page reference at the foot of a rules popup (ruled 2026-10-23): "From your setting: <short name> · <page>",
 * or null when the entry has no source. A source keyed by class shows the character's class, or else all of them.
 * With the pack's sources map (07 meta.sourceTitles, G-212; retest 4 T6) a code reads as its book's title, and the
 * short name isn't repeated before a title.
 */
export function sourceLine(source: unknown, shortName: string, nameOf: (id: string) => string | undefined, classId?: string, titles: SourceTitles = {}): string | null {
  let page: string | null = null;
  if (typeof source === 'string') page = source.trim() || null;
  else if (isRecord(source)) {
    const own = classId !== undefined ? source[classId] : undefined;
    page =
      typeof own === 'string'
        ? own
        : Object.entries(source)
            .filter(([, value]) => typeof value === 'string' && value.trim())
            .map(([id, value]) => `${nameOf(id) ?? id} ${String(value)}`)
            .join('; ') || null;
  }
  return page ? `From your setting: ${packAndPage(shortName, titledSource(page, titles), titles)}` : null;
}
