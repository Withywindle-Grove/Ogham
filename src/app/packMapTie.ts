// A place whose pack brought its map's picture has the map with no tap (B14; p2p-27, ruled 2026-11-18: "the app ties
// each map to its places"; Francis, 2026-11-24: no "+ Map" where the pack brought the picture).
//
// When: the first time the GM's place page reads the place's map as wanted and the pack keeps the picture (loadPlaceMap's
// `packed`). Not when the pack is attached: a pack's places become rows of the campaign only when the party first
// reaches one (private.place_named), so at attach there is no place to tie the map to, and a copy made then would need
// a new column to be found later. At the first open the place exists, and the tie is the one "+ Map" makes.
//
// How: the same two logged commands as "+ Map" (place.addMap: the campaign's copy, kind map, the GM's alone until its
// eye; place.setMap: tied to the place), from the pack's own picture, already made smaller when the pack was saved.
// Idempotent: once tied, the place (and every other place the map names) reads as having its map, so a second open has
// nothing to tie; two opens at once share one run. A map the GM tied by hand reads as the place's map, so it is never
// replaced.
//
// Fix round (review, 2026-11-24): a tie that stopped part-way (the copy made, the tie refused or lost) is finished, not
// started again: the next open finds that copy, made by place.addMap under the map's name and never tied to any place,
// and ties it; nothing is erased (rule 4), and no second copy is made. The tie itself is tried twice in one run, the
// second time from the place as it stands now (its version, or a tie another device made meanwhile). Another device's
// copy, left untied part-way, is found the same way. Still open: two devices making their copies in the same second.
import { runCommand, failed, ok, type CommandRegistry, type CommandResult, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { addPlaceMap, loadPackPicture, loadPlaceTie, mapCopyName, setPlaceMap, untiedMapCopy } from '../modules/expedition/placeMap.ts';
import type { Place } from '../modules/expedition/placePlay.ts';

/** The pack's picture couldn't be fetched: nothing is added. */
export const PACK_PICTURE_UNREAD_WORDS = "Couldn't fetch the pack's picture. Check your connection and try again.";

// The ties under way, by campaign and the pack's picture: a second open while one runs waits for it.
const running = new Map<string, Promise<CommandResult<string>>>();

/** Gives the campaign its copy of the pack's map, hidden, tied to the place. Gives back the copy's asset id. */
export function tiePackMap(
  registry: CommandRegistry,
  db: Db,
  user: CurrentUser,
  campaignId: string,
  place: Pick<Place, 'id' | 'name' | 'version'>,
  title: string,
  packed: string,
): Promise<CommandResult<string>> {
  const key = `${campaignId}:${packed}`;
  const already = running.get(key);
  if (already) return already;
  const run = (async (): Promise<CommandResult<string>> => {
    let assetId = await untiedMapCopy(db, campaignId, mapCopyName(title, place.name));
    if (!assetId) {
      const image = await loadPackPicture(db, packed);
      if (!image) return failed(PACK_PICTURE_UNREAD_WORDS);
      const added = await runCommand(registry, db, user, addPlaceMap, { campaignId, place, title, image });
      if (!added.ok) return added;
      assetId = added.value;
    }
    const tied = await runCommand(registry, db, user, setPlaceMap, { campaignId, place, assetId });
    if (tied.ok) return ok(assetId);
    // Once more, from the place as it is now: tied meanwhile (another device), it stands; else the tie with its version.
    const now = await loadPlaceTie(db, place.id);
    if (!now) return tied;
    if (now.mapAssetId) return ok(now.mapAssetId);
    const again = await runCommand(registry, db, user, setPlaceMap, { campaignId, place: { id: place.id, version: now.version }, assetId });
    return again.ok ? ok(assetId) : again;
  })().finally(() => running.delete(key));
  running.set(key, run);
  return run;
}

