// A pack's link marks (docs/design/rulings/dec-pack-formats-2026-11-11.md, pf-5): `[[kind:id|label]]` anywhere in a
// pack's text, `kind` one of place, npc, item, table, statBlock, spell, rule, adventureHook (pf-5a), and `id` this
// pack's or `packId:id`. The
// marks are never shown raw: the app shows the label as plain text (an unresolved link always; a resolved one too,
// until a tap is cheap where it sits). Pure, shared by the app and the pack checker (scripts/pack-town.mjs).

/** The kinds a link may name (pf-5; `adventureHook`, an adventure's hook, from pf-5a). */
export const LINK_KINDS = ['place', 'npc', 'item', 'table', 'statBlock', 'spell', 'rule', 'adventureHook'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** One link: its kind as written, the pack it names ('' for this pack), the id in that pack, and its label. */
export interface LinkMark {
  kind: string;
  packId: string;
  id: string;
  label: string;
}

/** A run of text: plain words, or a link with its label. */
export type LinkPart = { text: string; link: LinkMark | null };

// `[[kind:id|label]]`, the label optional (`[[kind:id]]` shows the id's words); no brackets or bar inside the parts.
const MARK = /\[\[([A-Za-z]+):([^\]|]+?)(?:\|([^\]]*))?\]\]/g;

/** A link's words when it has no label: its id, dashes as spaces ("the-reed-inn" reads "the reed inn"). */
const idWords = (id: string) => id.replace(/[-_]+/g, ' ').trim();

/** The text cut into plain runs and links, in order; text with no marks is one plain run. */
export function linkParts(value: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let at = 0;
  for (const found of value.matchAll(MARK)) {
    const start = found.index ?? 0;
    if (start > at) parts.push({ text: value.slice(at, start), link: null });
    const [, kind = '', target = '', label] = found;
    const colon = target.indexOf(':');
    const packId = colon >= 0 ? target.slice(0, colon).trim() : '';
    const id = (colon >= 0 ? target.slice(colon + 1) : target).trim();
    const words = (label ?? '').trim() || idWords(id);
    parts.push({ text: words, link: { kind, packId, id, label: words } });
    at = start + found[0].length;
  }
  if (at < value.length) parts.push({ text: value.slice(at), link: null });
  return parts;
}

/** The text with every mark replaced by its label: what any reader sees where a link isn't a tap. */
export const plainLinks = (value: string): string => (value.includes('[[') ? linkParts(value).map((p) => p.text).join('') : value);

/** Every link in the text, in order. */
export const linksIn = (value: string): LinkMark[] => linkParts(value).flatMap((p) => (p.link ? [p.link] : []));
