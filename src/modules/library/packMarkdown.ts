// Reading a structured-Markdown pack (docs/07-content-packs.md, "Structured Markdown format") into the same
// entries a JSON pack gives. Deterministic, no AI. Lenient on format (key case, extra spaces, trailing
// punctuation, units written after numbers); strict on meaning (no guessing synonyms). Anything it doesn't
// understand is listed as a warning, never dropped silently; unknown keys on a stat block become its stats.
import { readPackJson, type ReadResult } from './packFile.ts';
import { BRAND } from '../../brand.ts';

/** "## <kind>: <name>" kinds, and the part of a pack file each becomes. */
const KINDS = {
  item: 'items',
  light: 'lightTypes',
  class: 'classes',
  xp: 'xpTables',
  condition: 'conditions',
  statblock: 'statBlocks',
  field: 'fieldTemplates',
  rules: 'rulesSets',
  calendar: 'calendars',
  table: 'tables',
} as const;
type Kind = keyof typeof KINDS;

const TIME_UNITS: Record<string, string> = {
  round: 'round', rounds: 'round', turn: 'turn', turns: 'turn', minute: 'minute', minutes: 'minute',
  hour: 'hour', hours: 'hour', day: 'day', days: 'day',
};

/** Reads a pack file of either kind: Markdown if it's named .md/.markdown or starts with "#", otherwise JSON. */
export function readPackFile(fileName: string, text: string): ReadResult {
  const markdown = /\.(md|markdown)$/i.test(fileName) || text.trimStart().startsWith('#');
  return markdown ? readPackMarkdown(text) : readPackJson(text);
}

/** "Rope, 50 ft" → "rope-50-ft" */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cleanKey = (key: string) => key.trim().replace(/[.,;:!]+$/, '').replace(/\s+/g, ' ').toLowerCase();
const cleanValue = (value: string) => value.trim().replace(/[.,;]+$/, '').trim();

/** "50", "50 coins", "6 turns", "1 gp" → the number and the word after it (if any). */
function amount(value: string): { n: number; unit: string } | null {
  const match = /^(-?\d[\d,]*(?:\.\d+)?)\s*([a-z]+)?$/i.exec(cleanValue(value));
  if (!match) return null;
  return { n: Number(match[1]!.replace(/,/g, '')), unit: (match[2] ?? '').toLowerCase() };
}

interface Section {
  kind: Kind;
  name: string;
  pairs: { key: string; rawKey: string; value: string }[];
  rows: { min: number; max: number; result: string }[];
  notes: string[];
}

export function readPackMarkdown(text: string): ReadResult {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim() !== '');
  const title = first === -1 ? null : /^#\s*pack\s*:\s*(.+?)\s*$/i.exec(lines[first]!.trim());
  if (!title) return { ok: false, message: 'A Markdown pack starts with a "# Pack: name" line.' };

  const warnings: string[] = [];
  const meta: Record<string, string> = { name: title[1]! };
  const sections: Section[] = [];
  let current: Section | null = null;
  let skipping = false;

  for (const raw of lines.slice(first + 1)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^##\s*([a-z]+)\s*:\s*(.+?)\s*$/i.exec(line);
    if (heading) {
      const kind = heading[1]!.toLowerCase();
      if (kind in KINDS) {
        current = { kind: kind as Kind, name: heading[2]!, pairs: [], rows: [], notes: [] };
        sections.push(current);
        skipping = false;
      } else {
        warnings.push(`"${kind}" isn't a kind of entry ${BRAND.appName} knows; "${heading[2]!}" was left out.`);
        current = null;
        skipping = true;
      }
      continue;
    }
    if (skipping) continue;
    const row = /^(\d+)(?:\s*[-–]\s*(\d+))?\s*:\s*(.+)$/.exec(line);
    if (current && row && (current.kind === 'xp' || current.kind === 'table')) {
      current.rows.push({ min: Number(row[1]), max: Number(row[2] ?? row[1]), result: cleanValue(row[3]!) });
      continue;
    }
    const pair = /^([^:]+?)\s*:\s*(.*)$/.exec(line);
    if (!current) {
      if (pair) meta[cleanKey(pair[1]!)] = cleanValue(pair[2]!);
      else warnings.push(`"${line}" before the first entry was left out.`);
      continue;
    }
    if (pair && pair[2]!.trim() !== '') current.pairs.push({ key: cleanKey(pair[1]!), rawKey: pair[1]!.trim(), value: pair[2]! });
    else current.notes.push(line);
  }

  const file: Record<string, unknown> = {
    format: 'tabletop-pack',
    formatVersion: 1,
    meta: { name: meta.name, version: meta.version ?? '', source: meta.source ?? '', kind: meta.kind ?? 'setting', notes: meta.notes ?? '' },
  };
  const templateFields: Record<string, unknown>[] = [];
  for (const section of sections) {
    const built = build(section, warnings);
    if (section.kind === 'field') {
      templateFields.push(built);
      continue;
    }
    const part = KINDS[section.kind];
    ((file[part] ??= []) as unknown[]).push(built);
  }
  if (templateFields.length > 0) {
    file.fieldTemplates = [{ id: `${slug(meta.name!)}-fields`, name: `${meta.name!} fields`, appliesTo: 'pc', fields: templateFields }];
  }

  const read = readPackJson(JSON.stringify(file));
  if (!read.ok) return read.message === 'The pack has no entries to import.' ? read : { ok: false, message: read.message };
  read.pack.warnings.unshift(...warnings);
  return read;
}

/** One entry's data from its lines. */
function build(section: Section, warnings: string[]): Record<string, unknown> {
  const label = `${section.kind} "${section.name}"`;
  const data: Record<string, unknown> =
    section.kind === 'field' ? { key: section.name, label: section.name } : { id: slug(section.name), name: section.name };
  const unknownKey = (key: string) => warnings.push(`${label}: "${key}" isn't a key ${BRAND.appName} knows; it was left out.`);
  const notUnderstood = (key: string, value: string, why: string) =>
    warnings.push(`${label}: ${key} "${cleanValue(value)}" ${why}; it was left out.`);
  const whole = (key: string, value: string, field: string, units: string[] = []) => {
    const got = amount(value);
    if (!got || !Number.isInteger(got.n) || (got.unit && !units.includes(got.unit))) return notUnderstood(key, value, "isn't a whole number");
    data[field] = got.n;
  };

  for (const { key, rawKey, value } of section.pairs) {
    switch (section.kind) {
      case 'item':
        if (key === 'category') data.category = cleanValue(value);
        else if (key === 'weight') {
          const got = amount(value);
          if (!got || (got.unit && !['coin', 'coins', 'cn'].includes(got.unit))) notUnderstood(key, value, "isn't in coins");
          else data.weightCoin = got.n;
        } else if (key === 'slots') whole(key, value, 'slots', ['slot', 'slots']);
        else if (key === 'stack') whole(key, value, 'stack');
        else if (key === 'value' || key === 'cost') {
          const got = amount(value);
          if (!got || !got.unit) notUnderstood(key, value, 'needs an amount and a coin, like "1 gp"');
          else data.value = { [got.unit]: got.n };
        } else if (key === 'light') data.lightTypeId = slug(value);
        else unknownKey(key);
        break;
      case 'light':
        if (key === 'duration') {
          const got = amount(value);
          const unit = got ? TIME_UNITS[got.unit] : undefined;
          if (!got || !unit) notUnderstood(key, value, 'needs a number and a unit, like "6 turns"');
          else Object.assign(data, { duration: got.n, unit });
        } else if (key === 'radius') data.radius = cleanValue(value);
        else if (key === 'warn' || key === 'warn at') whole(key, value, 'warnAt', Object.keys(TIME_UNITS));
        else if (key === 'fuel') data.fuelItemId = slug(value);
        else unknownKey(key);
        break;
      case 'class':
        if (key === 'hit die') data.hitDie = cleanValue(value);
        else if (key === 'xp' || key === 'xp table') data.xpTableId = slug(value);
        else unknownKey(key);
        break;
      case 'condition':
        if (key === 'rounds' || key === 'duration') whole(key, value, 'defaultRounds', ['round', 'rounds']);
        else unknownKey(key);
        break;
      case 'statblock':
        if (key === 'hp') {
          const hp = /^(.+?)\s*\((\d+)\)$/.exec(cleanValue(value));
          if (hp) Object.assign(data, { hp: hp[1], hpAverage: Number(hp[2]) });
          else data.hp = cleanValue(value);
        } else if (key === 'tags') data.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
        // Any other key is one of the creature's stats, as written.
        else ((data.fields ??= {}) as Record<string, string>)[rawKey] = cleanValue(value);
        break;
      case 'field':
        if (key === 'type') data.type = cleanValue(value).toLowerCase();
        else if (key === 'group' || key === 'category') data.group = cleanValue(value);
        else if (key === 'card' || key === 'on card') data.showOnCard = /^(yes|true|y)$/i.test(cleanValue(value));
        else if (key === 'choices') data.choices = value.split(',').map((choice) => choice.trim()).filter(Boolean);
        else unknownKey(key);
        break;
      case 'rules':
        if (key === 'encumbrance' && ['none', 'armour', 'coin', 'slot'].includes(cleanValue(value).toLowerCase())) {
          data.encumbrance = { mode: cleanValue(value).toLowerCase() };
        } else if (key === 'round') whole(key, value, 'roundSeconds', ['second', 'seconds']);
        else if (key === 'turn') whole(key, value, 'turnMinutes', ['minute', 'minutes']);
        else if (key === 'day') whole(key, value, 'dayHours', ['hour', 'hours']);
        else unknownKey(key);
        break;
      case 'calendar':
        if (key === 'days per week') whole(key, value, 'daysPerWeek', ['day', 'days']);
        else unknownKey(key);
        break;
      case 'table':
        if (key === 'die') data.die = cleanValue(value);
        else unknownKey(key);
        break;
      case 'xp':
        unknownKey(key);
        break;
    }
  }

  // Time lengths in a rules set sit together, like a JSON pack's.
  if (section.kind === 'rules') {
    const time: Record<string, unknown> = {};
    for (const field of ['roundSeconds', 'turnMinutes', 'dayHours']) {
      if (field in data) {
        time[field] = data[field];
        delete data[field];
      }
    }
    if (Object.keys(time).length > 0) data.time = time;
  }
  if (section.kind === 'xp') data.levels = section.rows.map((row) => ({ level: row.min, xp: Number(row.result.replace(/,/g, '')) }));
  if (section.kind === 'table') data.rows = section.rows;
  if (section.notes.length > 0) data.notes = section.notes.join('\n');
  return data;
}
