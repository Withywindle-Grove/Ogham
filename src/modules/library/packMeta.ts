// A pack's own id, as other packs name it (07: `meta.id`, a stable slug; "a pack without one falls back to the slug of
// its `shortName`"). One reader for every place that needs it. Pure.
import { slug } from './packMarkdown.ts';

/** The pack file's `meta.id` as written (kept in extra_meta), or null when it has none. */
export function writtenMetaId(extraMeta: unknown): string | null {
  const value = extraMeta && typeof extraMeta === 'object' && !Array.isArray(extraMeta) ? (extraMeta as { id?: unknown }).id : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The id other packs' links name this pack by: its `meta.id`, else the slug of its `shortName`, else of its name
 * (07 Adventure packs §1); null only when none gives one.
 */
export function packRefId(extraMeta: unknown, name: string): string | null {
  const written = writtenMetaId(extraMeta);
  if (written) return written;
  const short = extraMeta && typeof extraMeta === 'object' && !Array.isArray(extraMeta) ? (extraMeta as { shortName?: unknown }).shortName : null;
  return slug(typeof short === 'string' && short.trim() ? short : name) || null;
}
