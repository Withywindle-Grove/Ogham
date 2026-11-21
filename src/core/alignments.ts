// A character's alignment (M5b step 0c, slice 1; docs/07 `alignmentVisibility`, 03): the field "alignment" is
// written on actors.fields like any field, but the database keeps it in its own table, character_alignments, which
// a player reads only as the setting allows (its owner and the GM, or everyone). Readers put it back into `fields`
// so screens see one record; a reader who may not see it simply gets no key.
import type { Db } from './supabase.ts';

export const ALIGNMENT_KEY = 'alignment';

/** The alignments of these characters that this reader may see, by character id. Empty when none (or on an error). */
export async function loadAlignments(db: Db, actorIds: readonly string[]): Promise<Map<string, string>> {
  if (actorIds.length === 0) return new Map();
  const { data } = await db.from('character_alignments').select('actor_id, alignment').in('actor_id', [...actorIds]);
  return new Map((data ?? []).map((row) => [String(row.actor_id), String(row.alignment)]));
}

/** The fields with the alignment put back (when the reader may see it); the fields as they are otherwise. */
export function withAlignment<T>(fields: T, alignment: string | undefined): T {
  if (alignment === undefined) return fields;
  const base = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {};
  return { ...base, [ALIGNMENT_KEY]: alignment } as T;
}

/** The alignments of every character in a campaign this reader may see, by character id. */
export async function loadCampaignAlignments(db: Db, campaignId: string): Promise<Map<string, string>> {
  const { data } = await db.from('character_alignments').select('actor_id, alignment').eq('campaign_id', campaignId);
  return new Map((data ?? []).map((row) => [String(row.actor_id), String(row.alignment)]));
}
