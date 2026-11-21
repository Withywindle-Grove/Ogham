// "Download a copy": a character saved as a file before it's removed. Restoring from the file comes later;
// the format is labelled and versioned so that can be added without guessing.
import type { Db } from './supabase.ts';
import { loadAlignments, withAlignment } from './alignments.ts';

export interface CharacterCopy {
  format: 'grimoire-character';
  version: 1;
  exportedAt: string;
  campaignName: string;
  /** The character's own details; links to this campaign's people and rows are left out. */
  character: Record<string, unknown>;
}

// Ids that only mean something inside this campaign's database.
const LEFT_OUT = new Set([
  'id',
  'campaign_id',
  'owner_user_id',
  'company_id',
  'portrait_asset_id',
  'created_by',
  'updated_at',
  'review_note',
]);

export function characterCopy(row: Record<string, unknown>, campaignName: string, now = new Date()): CharacterCopy {
  return {
    format: 'grimoire-character',
    version: 1,
    exportedAt: now.toISOString(),
    campaignName,
    character: Object.fromEntries(Object.entries(row).filter(([key]) => !LEFT_OUT.has(key))),
  };
}

/** Null if the character can't be read by this person (or doesn't exist). */
export async function loadCharacterCopy(db: Db, characterId: string, campaignName: string): Promise<CharacterCopy | null> {
  const { data, error } = await db.from('actors').select('*').eq('id', characterId).maybeSingle();
  if (error || !data) return null;
  const alignments = await loadAlignments(db, [data.id]);
  return characterCopy({ ...data, fields: withAlignment(data.fields, alignments.get(data.id)) }, campaignName);
}

/** "Hollis of Reedmouth" on Oct 19, 2026 → "hollis-of-reedmouth-2026-10-19.json". */
export function copyFileName(name: string, now = new Date()): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'character';
  return `${slug}-${now.toISOString().slice(0, 10)}.json`;
}
