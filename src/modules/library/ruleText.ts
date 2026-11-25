// Rule text set out like the book (docs/design/rulings/dec-rule-text-blocks-2026-11-13.md, pf-18 and pf-18a): the one
// reader for a place rule's `text`, an area's `gm.text`, a GM section's `text` (pf-18b), a procedure step's `text`, a
// class's or kindred's trait note, `abilities[].note` (tfb-5), and a common player action's rule,
// `exploration.playerActions[].text` (d5-16); the last two through readWordsOrBlocks.
// The value is either a plain string (always valid, kept as it is) or `{ "blocks": [ … ] }`; a block is an object with
// one marker key:
//   { p }  { h }  { lead, text }  { list: [strings], numbered? }  { table: { title, die?, columns, rows } }
//   { tableRef }  { box: [blocks], title? }  { source }
// One level of nesting: a box holds blocks, never another box; a list holds strings only. Anything the reader can't
// use is left out and named, never thrown and never shown as raw JSON. Pure, shared by the app and the pack checker
// (scripts/pack-rule-text.mjs). How blocks are drawn is another piece (dec-7 piece 6): nothing here is a screen.
import { linksIn, plainLinks, type LinkMark } from './linkMarks.ts';

export type RuleBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'lead'; lead: string; text: string }
  | { kind: 'list'; items: string[]; numbered: boolean }
  | { kind: 'table'; title: string; die: string | null; columns: string[]; rows: string[][] }
  | { kind: 'tableRef'; tableId: string }
  | { kind: 'box'; title: string | null; blocks: RuleBlock[] }
  | { kind: 'source'; text: string };

/** A text as read: the plain string as it is, or its typed blocks. */
export type RuleText = string | { blocks: RuleBlock[] };

export interface RuleTextRead {
  /** Null when there is no text (absent, null, no blocks, or nothing in it could be used). */
  value: RuleText | null;
  /** What was left out and why, one line each ("block 3 (lead) has no text; left out."). */
  leftOut: string[];
}

/** The marker keys, one per block (pf-18). */
export const BLOCK_MARKERS = ['p', 'h', 'lead', 'list', 'table', 'tableRef', 'box', 'source'] as const;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isWords = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const shown = (value: unknown): string => {
  const json = JSON.stringify(value) ?? String(value);
  return json.length > 60 ? `${json.slice(0, 57)}…` : json;
};

/**
 * True when a value is rule text in blocks: an object whose `blocks` is a list (the lead's ruling, 2026-11-13). The one
 * test, used by the reader, the checker and the screens alike. Other data with a `blocks` key that isn't a list (a
 * trouble table's row, `blocks: true`, 07 Downtime) is never rule text; keys beside the list are read past, and named.
 */
export const isRuleTextBlocks = (value: unknown): value is { blocks: unknown[] } => isObject(value) && Array.isArray(value.blocks);

/** A table's cell or header: words as written; a number as its digits. */
const cell = (value: unknown): string | null => (typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : null);

function readBlock(raw: unknown, where: string, inBox: boolean, leftOut: string[]): RuleBlock | null {
  const out = (why: string) => {
    leftOut.push(`${where} ${why}; left out.`);
    return null;
  };
  if (!isObject(raw)) return out(`(${shown(raw)}) isn't a block`);
  const markers = BLOCK_MARKERS.filter((m) => m in raw);
  if (markers.length === 0) return out(`(${shown(raw)}) has no known marker (${BLOCK_MARKERS.join(', ')})`);
  if (markers.length > 1) return out(`has two markers (${markers.join(', ')}); a block has one`);
  const marker = markers[0]!;
  switch (marker) {
    case 'p':
    case 'h':
    case 'source':
      return isWords(raw[marker]) ? { kind: marker, text: raw[marker].trim() } : out(`(${marker}) has no words`);
    case 'lead':
      if (!isWords(raw.lead)) return out('(lead) has no term');
      if (!isWords(raw.text)) return out(`(lead "${raw.lead.trim()}") has no text`);
      return { kind: 'lead', lead: raw.lead.trim(), text: raw.text.trim() };
    case 'list': {
      if (!Array.isArray(raw.list)) return out('(list) should be a list of words');
      const items: string[] = [];
      raw.list.forEach((item: unknown, i: number) => {
        if (isWords(item)) items.push(item.trim());
        else leftOut.push(`${where} (list), item ${i + 1} (${shown(item)}) isn't words; left out.`);
      });
      if (raw.numbered !== undefined && typeof raw.numbered !== 'boolean') leftOut.push(`${where} (list): numbered should be true or false; read as not numbered.`);
      if (items.length === 0) return out('(list) has no items');
      return { kind: 'list', items, numbered: raw.numbered === true };
    }
    case 'table': {
      const t = raw.table;
      if (!isObject(t)) return out('(table) should be { title, die?, columns, rows }');
      if (typeof t.title !== 'string') return out('(table) has no title');
      if (!Array.isArray(t.columns) || t.columns.some((c) => cell(c) === null)) return out(`(table "${t.title.trim()}") columns should be a list of headers`);
      if (!Array.isArray(t.rows) || t.rows.some((r) => !Array.isArray(r) || r.some((c) => cell(c) === null))) return out(`(table "${t.title.trim()}") rows should be a list of rows, each a list of cells`);
      if (t.die !== undefined && typeof t.die !== 'string') leftOut.push(`${where} (table "${t.title.trim()}"): die should be words like "d6"; left out of the table.`);
      return {
        kind: 'table',
        title: t.title.trim(),
        die: isWords(t.die) ? t.die.trim() : null,
        columns: t.columns.map((c) => cell(c)!),
        rows: (t.rows as unknown[][]).map((r) => r.map((c) => cell(c)!)),
      };
    }
    case 'tableRef':
      return isWords(raw.tableRef) ? { kind: 'tableRef', tableId: raw.tableRef.trim() } : out('(tableRef) names no table');
    case 'box': {
      if (inBox) return out('(box) is inside a box; a box holds blocks, never another box');
      if (!Array.isArray(raw.box)) return out('(box) should be a list of blocks');
      if (raw.title !== undefined && typeof raw.title !== 'string') leftOut.push(`${where} (box): title should be words; read as no title.`);
      const blocks = readBlocks(raw.box, `${where} (box),`, true, leftOut);
      if (blocks.length === 0) return out('(box) has no blocks');
      return { kind: 'box', title: typeof raw.title === 'string' ? raw.title.trim() : null, blocks };
    }
  }
}

function readBlocks(list: unknown[], where: string, inBox: boolean, leftOut: string[]): RuleBlock[] {
  return list.flatMap((raw, i) => readBlock(raw, `${where ? `${where} ` : ''}block ${i + 1}`, inBox, leftOut) ?? []);
}

/** Reads a rule text: a string stays a string; `{ blocks }` becomes typed blocks; anything else is left out. */
export function readRuleText(raw: unknown): RuleTextRead {
  const leftOut: string[] = [];
  // No text: absent, or null (as before this reader).
  if (raw === undefined || raw === null) return { value: null, leftOut };
  if (typeof raw === 'string') return { value: raw, leftOut };
  if (!isRuleTextBlocks(raw)) {
    if (!isObject(raw) || !('blocks' in raw)) return { value: null, leftOut: [`The text (${shown(raw)}) is neither words nor { "blocks": [ … ] }; left out.`] };
    return { value: null, leftOut: ['The text\'s blocks should be a list of blocks; left out.'] };
  }
  // Keys beside the list: the blocks are read, the rest is left out and named.
  const others = Object.keys(raw).filter((k) => k !== 'blocks');
  if (others.length > 0) leftOut.push(`The text has keys besides blocks (${others.join(', ')}); they were left out.`);
  const blocks = readBlocks(raw.blocks, '', false, leftOut);
  return { value: blocks.length > 0 ? { blocks } : null, leftOut };
}

/** "Term. text": the term ends with a full stop unless it already ends with a mark of its own. */
const leadWords = (lead: string, text: string) => `${/[.!?:;,]$/.test(lead) ? lead : `${lead}.`} ${text}`;

function blockParagraphs(block: RuleBlock): string[] {
  switch (block.kind) {
    case 'p':
    case 'h':
    case 'source':
      return [block.text];
    case 'lead':
      return [leadWords(block.lead, block.text)];
    case 'list':
      return block.items.map((item, i) => (block.numbered ? `${i + 1}. ${item}` : item));
    case 'table':
      return block.title ? [block.title] : [];
    case 'tableRef':
      return [];
    case 'box':
      return [...(block.title ? [block.title] : []), ...block.blocks.flatMap(blockParagraphs)];
  }
}

/**
 * A text as plain words in reading order (pf-18a), one paragraph each: headings, lead-ins as "Term. text", list
 * items, a table's title, a box's title and words, the source last. Link marks show as their labels. A plain string
 * is one paragraph. A table by id adds nothing (its name lives in the table).
 */
export function ruleTextParagraphs(value: RuleText | null): string[] {
  if (value === null) return [];
  if (typeof value === 'string') return value.trim() ? [plainLinks(value.trim())] : [];
  const blocks = value.blocks.filter((b) => b.kind !== 'source');
  const sources = value.blocks.filter((b) => b.kind === 'source');
  return [...blocks, ...sources].flatMap(blockParagraphs).map(plainLinks);
}

/** The same words as one string, a paragraph to a line. */
export const ruleTextWords = (value: RuleText | null): string => ruleTextParagraphs(value).join('\n');

/** Rule text that is in blocks, as read. */
export type RuleTextBlocks = { blocks: RuleBlock[] };

/**
 * A text that is words or blocks, as read (tfb-5 for a trait's note; d5-16 for a common player action's rule): its words
 * for a line, a row or a search, and its blocks for where it is set out whole.
 */
export interface WordsOrBlocks {
  /** The words: plain words as written (trimmed); words in blocks as their plain words on one line. '' for none. */
  words: string;
  /** The blocks, to set out one by one; null when the text is plain words, absent or unreadable. */
  blocks: RuleTextBlocks | null;
}

/**
 * A text a pack may write as plain words or as pf-18's `{ blocks }`, read by the one reader: a class's or a kindred's
 * trait note (`abilities[].note`; tfb-5, 2026-11-19) and a common player action's rule (`exploration.playerActions[].text`;
 * d5-16, 2026-11-20). Plain words come back exactly as before (trimmed, link marks untouched), so a text not yet
 * rewritten reads as today everywhere. Blocks give their plain words (pf-18a, the paragraphs joined by a space) for a
 * row, a chip, a line or a search, and the blocks for where the text is set out. Never throws; never the raw object.
 */
export function readWordsOrBlocks(raw: unknown): WordsOrBlocks {
  if (typeof raw === 'string') return { words: raw.trim(), blocks: null };
  const { value } = readRuleText(raw);
  if (value === null || typeof value === 'string') return { words: '', blocks: null };
  return { words: ruleTextParagraphs(value).join(' '), blocks: value };
}

/** A class's or a kindred's trait note (`abilities[].note`; tfb-5): the one reader, readWordsOrBlocks. */
export const readTraitNote = readWordsOrBlocks;

/** A trait note's words alone (readTraitNote), where it is read as a line. */
export const traitNoteWords = (raw: unknown): string => readTraitNote(raw).words;

/** Every string a block holds, in reading order (for its links). */
function blockStrings(block: RuleBlock): string[] {
  switch (block.kind) {
    case 'p':
    case 'h':
    case 'source':
      return [block.text];
    case 'lead':
      return [block.lead, block.text];
    case 'list':
      return block.items;
    case 'table':
      return [block.title, ...block.columns, ...block.rows.flat()];
    case 'tableRef':
      return [];
    case 'box':
      return [...(block.title ? [block.title] : []), ...block.blocks.flatMap(blockStrings)];
  }
}

/**
 * Every link a text carries, in reading order: its kind as written, the pack it names ('' for this pack), the id and
 * the label. The same for blocks and plain strings. Nothing here decides who may tap one (rp-5): that is a later piece.
 */
export function ruleTextLinks(value: RuleText | null): LinkMark[] {
  if (value === null) return [];
  if (typeof value === 'string') return linksIn(value);
  return value.blocks.flatMap(blockStrings).flatMap(linksIn);
}
