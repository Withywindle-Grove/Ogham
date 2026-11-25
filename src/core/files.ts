// Private campaign files (portraits, sigils, later handouts): where they live, removing one, and showing them
// through short-lived signed links. The storage rules decide who may get a link; links are cached for a while
// so lists don't re-ask for each picture.
import type { Db } from './supabase.ts';

export const FILES_BUCKET = 'campaign-files';

/** A pack's pictures, kept with the pack in the GM's library (B14, p2p-27): <pack id>/<map id>. Its owner's to write;
 *  read by its owner and by the GM of a campaign that uses the pack; never a player's (hard rule 5). */
export const PACK_FILES_BUCKET = 'pack-files';
export const packPicturePath = (packId: string, mapId: string) => `${packId}/${mapId}`;

/** Whether a storage write was refused by the bucket's access rules (Storage answers 403, "…row-level security…"),
 *  rather than lost on the way: the first is "not allowed", the second "try again". */
export function storageRefused(error: { message?: string; statusCode?: string | number; status?: number } | null): boolean {
  if (!error) return false;
  return String(error.statusCode ?? '') === '403' || error.status === 403 || /row-level security/i.test(error.message ?? '');
}

/** The database works out each file's place: <campaign id>/<asset id>. */
export const assetPath = (campaignId: string, assetId: string) => `${campaignId}/${assetId}`;

/**
 * Removes a picture's file and its asset row. Best effort: returns false if either was refused
 * (for example a portrait the GM uploaded, which only the GM can remove).
 */
export async function removeAssetFile(db: Db, campaignId: string, assetId: string): Promise<boolean> {
  const file = await db.storage.from(FILES_BUCKET).remove([assetPath(campaignId, assetId)]);
  const row = await db.from('assets').delete().eq('id', assetId).select('id');
  return !file.error && !row.error && (row.data?.length ?? 0) === 1;
}
const LINK_SECONDS = 60 * 60;
// Reuse a link until 10 minutes before it would stop working.
const REUSE_MS = (LINK_SECONDS - 10 * 60) * 1000;

const cache = new Map<string, { url: string; until: number }>();

/** Forget cached links (after a picture changes, or between tests). */
export function forgetFileLinks(path?: string): void {
  if (path) cache.delete(path);
  else cache.clear();
}

/**
 * Signed links for these file paths (<campaign id>/<asset id>); paths the person can't see are left out. `bucket`
 * picks another private bucket with the same shape of path (a message's picture, M5b g4).
 */
export async function fileLinks(db: Db, paths: string[], now = Date.now(), bucket = FILES_BUCKET): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const missing: string[] = [];
  const key = (path: string) => (bucket === FILES_BUCKET ? path : `${bucket}:${path}`);
  for (const path of new Set(paths)) {
    const hit = cache.get(key(path));
    if (hit && hit.until > now) links.set(path, hit.url);
    else missing.push(path);
  }
  if (missing.length > 0) {
    const { data } = await db.storage.from(bucket).createSignedUrls(missing, LINK_SECONDS);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        links.set(item.path, item.signedUrl);
        cache.set(key(item.path), { url: item.signedUrl, until: now + REUSE_MS });
      }
    }
  }
  return links;
}
