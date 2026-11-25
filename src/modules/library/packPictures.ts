// A pack's pictures, kept with the pack (plan scene-point-to-point B14; p2p-27; Francis's storage ruling, 2026-11-22;
// supabase/migrations/20261122160000_b14_pack_files.sql). A bundle's map pictures are stored once, with the pack in
// its owner's library, at <pack id>/<map id> in the private bucket `pack-files`: written by the pack's owner only;
// read by the owner and by the GM of a campaign that uses the pack; never by a player (hard rule 5). A map reaches a
// place as the campaign's own GM-only copy (place.addMap), so it stays the GM's until its eye.
import { defineCommand, failed, notAllowed, ok, type CommandResult } from '../../core/commands.ts';
import { PACK_FILES_BUCKET, packPicturePath, storageRefused } from '../../core/files.ts';

/** Stores (or replaces) the picture of one of your own pack's maps. Not logged, as the import itself isn't. */
export const addPackPicture = defineCommand({
  name: 'library.addPicture',
  log: 'none',
  target: (input: { packId: string; ownerUserId: string; mapId: string; image: Blob }) => ({ ownerUserId: input.ownerUserId }),
  allowed: (user, target) => target.ownerUserId === user.id,
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const upload = await db.storage
      .from(PACK_FILES_BUCKET)
      .upload(packPicturePath(input.packId, input.mapId), input.image, { upsert: true, contentType: input.image.type || 'image/jpeg' });
    // A refusal by the bucket's rules (not the pack's owner) says so; anything else is a plain "try again".
    if (storageRefused(upload.error)) return notAllowed();
    return upload.error ? failed("Couldn't save the picture. Check your connection and try again.") : ok(null);
  },
});
