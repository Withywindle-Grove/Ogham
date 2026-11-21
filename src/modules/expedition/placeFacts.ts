// What the place panel and the town page read from a pack's location (December piece 2c; docs/plans/
// dec-2-3-places-and-port.md; docs/design/rulings/dec-pack-formats-2026-11-11.md, pf-3 … pf-5): the one line of
// identity, the facts as bold lead-ins in the pack's order, the GM's headed prose (`gm.sections`), the place's own
// tables (`tableIds`, plus the tables its text links to), and a settlement's watch. All the GM's: read from the
// pack's entry on the GM's device only (library entries never reach a player's place view), and every field optional,
// so a pack with flat notes reads as the mockup's fallback. Link marks come out as their labels (linkMarks.ts).
// A section's `text` is rule text (pf-18b, docs/design/rulings/dec-place-sections-blocks-2026-11-18.md): a plain
// string, or `{ blocks }` read by the one reader (readRuleText) and turned into the blocks RuleText draws (blocksOfRead).
// Also the fallback for notes: a line that starts with a short label and a colon is set as a bold lead-in.
import { linksIn, plainLinks } from '../library/linkMarks.ts';
import { readRuleText, ruleTextLinks, ruleTextWords, type RuleText, type RuleBlock as TextBlock } from '../library/ruleText.ts';
import { tidyPage } from '../library/sourceTitles.ts';
import { blocksOfRead, ruleBlocks, type RuleBlock } from './placeRules.ts';

/** A line with a bold lead-in ("Ruler", "Warden Halewyn"); `lead` '' for a plain line. */
export interface LeadLine {
  lead: string;
  text: string;
}

/** A heading and its prose (gm.sections). */
export interface PlaceSection {
  heading: string;
  /** Its words, plain, a paragraph to a line (a section in blocks as its plain words, pf-18a). */
  text: string;
  /** Its blocks to draw, when the pack sets the section out in blocks (pf-18b): [] when the app can't read it; null for plain text or an empty section. */
  blocks: RuleBlock[] | null;
}

/** A settlement's watch (pf-5): its box's words, its lead-ins, and the stat block it fights as ('' if none). */
export interface PlaceWatch {
  text: string;
  leads: LeadLine[];
  statBlockId: string;
}

/** The book's own text for the GM about a place (`gm.text`, pf-18's shape; gt-1): its blocks, and its first line folded. */
export interface PlaceBookText {
  blocks: RuleBlock[];
  /** The book's own first words, cut as a folded section's are (mc-40); '' when it opens with no words (a box first). */
  firstLine: string;
}

/** The GM's facts about a place, as its pack writes them; empty parts are left out by the screen. */
export interface PlaceFacts {
  identity: string;
  facts: LeadLine[];
  sections: PlaceSection[];
  /** The place's tables in page order, then any other table its GM text links to (this pack's ids), each once. */
  tableIds: string[];
  watch: PlaceWatch | null;
  /** The book's text for the GM (gt-1): the place page's folded row, never the Knowledge sheet's; null when none. */
  text: PlaceBookText | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const leadLines = (value: unknown): LeadLine[] =>
  list(value).flatMap((line) => {
    if (!isObject(line)) return text(line) ? [{ lead: '', text: plainLinks(text(line)) }] : [];
    const body = plainLinks(text(line.text));
    const lead = plainLinks(text(line.lead));
    return body || lead ? [{ lead, text: body }] : [];
  });

/** The facts a location's entry gives (its `data`); a location without them reads as all empty. */
export function readPlaceFacts(data: Record<string, unknown>): PlaceFacts {
  const gm = isObject(data.gm) ? data.gm : {};
  const settlement = isObject(data.settlement) ? data.settlement : {};
  const sections = list(gm.sections).flatMap((s): PlaceSection[] => {
    if (!isObject(s)) return [];
    const heading = plainLinks(text(s.heading));
    // Plain words (or no text): as before pf-18b.
    if (typeof s.text === 'string' || s.text === undefined || s.text === null) {
      const body = plainLinks(text(s.text));
      return heading || body ? [{ heading, text: body, blocks: null }] : [];
    }
    // Blocks, or a text the reader can't use: the one reader, strictly (pf-18a); empty is judged on the blocks drawn,
    // not on what the pack wrote. With nothing to draw, a section keeps its heading: `blocks: []` when the reader left
    // something out (the app can't read it: pick 1's muted line), else it is an empty section (Francis, 2026-11-18).
    const { value: read, leftOut } = readRuleText(s.text);
    const blocks = drawable(blocksOfRead(read));
    if (blocks.length === 0) return heading ? [{ heading, text: '', blocks: leftOut.length > 0 ? [] : null }] : [];
    return [{ heading, text: ruleTextWords(read), blocks }];
  });
  const watchData = isObject(settlement.watch) ? settlement.watch : null;
  const watch: PlaceWatch | null = watchData ? { text: plainLinks(text(watchData.text)), leads: leadLines(watchData.leads), statBlockId: text(watchData.statBlockId) } : null;
  // Tables the GM's text links to, after the place's own (07: `tableIds` in page order); this pack's ids only.
  // A text in blocks (a section's, the book's text for the GM) is read by one rule wherever it sits (the lead, S14): its
  // link marks, and any table it names by id.
  const gmTexts = [text(data.identity), ...list(data.facts).map((f) => (isObject(f) ? text(f.text) : text(f))), text(gm.notes), watchData ? text(watchData.text) : ''];
  const richTexts = [...list(gm.sections).map((s) => (isObject(s) ? s.text : null)), gm.text].map((t) => readRuleText(t).value);
  const linked = [...gmTexts.flatMap((t) => linksIn(t)), ...richTexts.flatMap(ruleTextLinks)].filter((l) => l.kind === 'table' && !l.packId && l.id).map((l) => l.id);
  const named = richTexts.flatMap(tablesById);
  const own = list(data.tableIds).map(text).filter(Boolean);
  return {
    identity: plainLinks(text(data.identity)),
    facts: leadLines(data.facts),
    sections,
    tableIds: [...new Set([...own, ...linked, ...named])],
    watch: watch && (watch.text || watch.leads.length || watch.statBlockId) ? watch : null,
    text: bookText(gm.text),
  };
}

/**
 * The blocks a section draws, less any box that would open empty: one with no title whose blocks draw nothing (a box
 * holding only a table by id). Such a section is an empty one (pf-18b; the review's nit 1, #978).
 */
function drawable(blocks: RuleBlock[]): RuleBlock[] {
  return blocks.flatMap((b): RuleBlock[] => {
    if (b.kind !== 'box') return [b];
    const inner = drawable(b.blocks);
    return inner.length === 0 && !b.title ? [] : [{ ...b, blocks: inner }];
  });
}

/** A place's `gm.text`, a plain string or blocks (pf-18), as its blocks and first line; null when it holds no words. */
function bookText(value: unknown): PlaceBookText | null {
  if (value === undefined || value === null) return null;
  const blocks = ruleBlocks(value);
  const words = ruleTextWords(readRuleText(value).value);
  if (blocks.length === 0 || !words.trim()) return null;
  return { blocks, firstLine: sectionFirstLine(words) };
}

/** The tables a text names by id (pf-18's `tableRef`), boxes included, in reading order. */
function tablesById(value: RuleText | null): string[] {
  if (value === null || typeof value === 'string') return [];
  const ids = (blocks: readonly TextBlock[]): string[] => blocks.flatMap((b) => (b.kind === 'tableRef' ? [b.tableId] : b.kind === 'box' ? ids(b.blocks) : []));
  return ids(value.blocks);
}

/** Whether there's anything to show from the pack beyond the pieces (an empty part isn't drawn). */
export const hasPlaceFacts = (f: PlaceFacts): boolean => !!f.identity || f.facts.length > 0 || f.sections.length > 0 || f.tableIds.length > 0 || f.watch !== null;

// A label is a few words before a colon at the very start of a line ("Ruler:", "Arrival on the scene:"), not a
// sentence that happens to hold a colon later on.
const LABEL = /^([^:.!?\n]{1,40}):\s+(.+)$/;

/**
 * Notes as the GM reads them (the mockup's honest fallback, frame 10): each line, a line that starts with a label and
 * a colon set as a bold lead-in; blank lines dropped; link marks as their labels.
 */
export function noteLines(notes: string): LeadLine[] {
  return notes
    .split('\n')
    .map((line) => plainLinks(line.trim()))
    .filter(Boolean)
    .map((line) => {
      const found = LABEL.exec(line);
      return found ? { lead: found[1]!.trim(), text: found[2]!.trim() } : { lead: '', text: line };
    });
}

/** A lead-in as it sits before its text: as written, with a full stop added when it ends without punctuation. */
export const leadWords = (lead: string): string => (/[.:!?]$/.test(lead) ? lead : `${lead}.`);

// The longest first line a folded section shows before it is cut (mc-40, frame 7: about two lines of the panel).
const FIRST_LINE_MAX = 100;

/**
 * A folded section's first line (mc-40; mockup december/01 frame 7): the book's own words, from the start of its
 * first paragraph. When more follows, it is cut at the last break of a sentence or clause (. ; : , ! ?) within about
 * two lines, else at a space, and ends "…"; a section that is one short line shows whole. Never words of the app's.
 */
export function sectionFirstLine(text: string): string {
  const paragraphs = text
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
  const first = paragraphs[0] ?? '';
  if (first.length <= FIRST_LINE_MAX && paragraphs.length <= 1) return first;
  const room = first.slice(0, FIRST_LINE_MAX + 1);
  const breaks = [...room.matchAll(/[.;:,!?](?=\s|$)/g)].map((m) => m.index);
  const at = breaks.length > 0 ? breaks[breaks.length - 1]! : room.lastIndexOf(' ') > 0 ? room.lastIndexOf(' ') : FIRST_LINE_MAX;
  const cut = first.length <= FIRST_LINE_MAX ? first.replace(/[.;:,!?]+$/, '') : first.slice(0, at).trimEnd();
  return `${cut}…`;
}

/**
 * The Knowledge sheet's source line (frame 7; the lead's ruling 3, 2026-11-14): "From your adventure: The Reed
 * Marches, p. 38." The pack's name always; the entry's own `source` only where it carries one, tidied as the book
 * prints a page. `from` is the kind of pack ("adventure", "setting").
 */
export function knowledgeSourceLine(from: string, packName: string, source: unknown): string | null {
  const name = packName.trim();
  if (!name) return null;
  const page = text(source);
  const words = page ? `${name}, ${tidyPage(page)}` : name;
  return `From your ${from}: ${words}${/[.!?]$/.test(words) ? '' : '.'}`;
}
