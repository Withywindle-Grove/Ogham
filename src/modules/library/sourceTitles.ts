// A pack's sources map (07 `meta.sourceTitles`, G-212, ruled 2026-11-09; creation retest 4 T6): the app never prints a
// bare code ("i3 p. 8"). A pack whose `source` strings start with a short code for one of its books says what each code
// is: `{ "<code>": "<the book's own title>" }`, the key "" being the pack's own book for a bare page ("p. 12").
// Pure: the reader, one source turned into "<title>, <page>", every `source` in an entry's data, and the
// "pack, page" line that no longer repeats the pack's name when the source names its book already.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Code → the book's own title. */
export type SourceTitles = Readonly<Record<string, string>>;

/** `meta.sourceTitles` as the pack gives it: text keys to non-empty text titles; anything else is left out. */
export function readSourceTitles(meta: unknown): SourceTitles {
  const raw = isRecord(meta) ? meta.sourceTitles : undefined;
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([code, title]) => (typeof title === 'string' && title.trim() ? [[code.trim(), title.trim()]] : [])));
}

/** A page as the book prints it: "p96", "p.116" and "p 96" become "p. 96"; "pp22–23" becomes "pp. 22–23". */
export function tidyPage(page: string): string {
  return page.trim().replace(/^(pp?)\.?\s*(?=\d)/i, (_, p: string) => `${p.toLowerCase()}. `);
}

/** Whether a page reference starts the text ("p. 12", "p96", "pp. 3–4"). */
const isPage = (text: string) => /^pp?\.?\s*\d/i.test(text.trim());

/** One part of a source ("i3 p. 8"): the longest code it starts with, as "<title>, <page>"; else as written. */
function titledPart(part: string, titles: SourceTitles, codes: readonly string[]): string {
  const text = part.trim();
  for (const code of codes) {
    if (!text.startsWith(code)) continue;
    const after = text.slice(code.length);
    // The code ends where a word does: "i3" isn't the start of "i30".
    if (/^[A-Za-z0-9]/.test(after) && !isPage(after)) continue;
    const rest = after.replace(/^[\s,:]+/, '');
    return rest ? `${titles[code]}, ${tidyPage(rest)}` : titles[code]!;
  }
  if (titles[''] && isPage(text)) return `${titles['']}, ${tidyPage(text)}`;
  return part;
}

/** A `source` with its codes turned into the books' titles; one no code matches stays as written. */
export function titledSource(source: string, titles: SourceTitles): string {
  const codes = Object.keys(titles)
    .filter((code) => code !== '')
    .sort((a, b) => b.length - a.length);
  if (codes.length === 0 && !titles['']) return source;
  return source
    .split(/;\s*/)
    .map((part) => titledPart(part, titles, codes))
    .join('; ');
}

/**
 * An entry's data with every `source` (a string, or one keyed by class) titled; the same object when nothing changes.
 * Nested lists and objects too (a trait list's entries, a rules set's reference panels), a few levels down.
 */
export function titledData<T>(data: T, titles: SourceTitles, depth = 0): T {
  if (depth > 6 || Object.keys(titles).length === 0) return data;
  if (Array.isArray(data)) {
    let changed = false;
    const next = data.map((item) => {
      const titled = titledData(item, titles, depth + 1);
      if (titled !== item) changed = true;
      return titled;
    });
    return (changed ? next : data) as T;
  }
  if (!isRecord(data)) return data;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    let titled: unknown = value;
    if (key === 'source' && typeof value === 'string') titled = titledSource(value, titles);
    else if (key === 'source' && isRecord(value)) titled = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === 'string' ? titledSource(v, titles) : v]));
    else if (typeof value === 'object' && value !== null) titled = titledData(value, titles, depth + 1);
    if (key === 'source' && JSON.stringify(titled) === JSON.stringify(value)) titled = value;
    if (titled !== value) changed = true;
    next[key] = titled;
  }
  return (changed ? next : data) as T;
}

/**
 * "Fen rules, p. 12": the pack's short name and the page; the page alone when it names its book already ("The Heron
 * Almanac, p. 8", from the sources map), so the line never says the pack twice over.
 */
export function packAndPage(shortName: string, page: string, titles: SourceTitles = {}): string {
  const named = Object.values(titles).some((title) => page === title || page.startsWith(`${title},`) || page.startsWith(`${title};`));
  return named ? page : [shortName, page].filter(Boolean).join(', ');
}
