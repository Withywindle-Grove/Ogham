// A place's picture (M5b step 1 follow-up, build order 7; ruled 2026-11-03, m5b-1 ⚑ 2: a campaign homebrew image
// uploaded from the GM's device; Drive images come in M8b; and B on the follow-up's ⚑: players get it only when the
// GM shows the picture itself; supabase/migrations/…_m5b_1b_place_picture.sql and …_m5b_1b_picture_shown_on_its_own.sql).
// The picture is a piece of its own kind, so it's shown and hidden per visit with the pieces' own eye
// (place.showPiece / place.hidePiece), Hide all hides it and a return visit brings it back (place.backAt). Two
// commands set it:
//   place.addPicture uploads the picture: an asset row of kind 'place' (the GM's) and its file in the campaign's
//     bucket. Making a file isn't undone (as with a portrait); nothing is ever deleted once it's in.
//   place.setPicture makes it the place's picture piece (hidden), retiring the one before; with null the place has
//     none. Undo puts the one before back.
import { defineCommand, failed, fromError, fromWrite, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { assetPath, FILES_BUCKET, forgetFileLinks } from '../../core/files.ts';
import type { Place } from './placePlay.ts';

/** A place's picture is shrunk on the device to this many pixels on its longest side (sharp on a tablet, quick to send). */
export const PLACE_PICTURE_SIZE = 2048;

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

export const addPlacePicture = defineCommand({
  name: 'place.addPicture',
  log: 'verbose',
  target: (input: { campaignId: string; place: Place; image: Blob }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    // A refusal (not the GM) says so; anything else is a plain "try again".
    const made = fromWrite(await db.from('assets').insert({ campaign_id: input.campaignId, kind: 'place', name: input.place.name || 'A place', visibility: 'gm' }).select('id'));
    if (!made.ok) return made.reason === 'not-allowed' ? made : failed("Couldn't save the picture. Try again.");
    const assetId = String(made.value.id);
    const upload = await db.storage
      .from(FILES_BUCKET)
      .upload(assetPath(input.campaignId, assetId), input.image, { upsert: true, contentType: input.image.type || 'image/jpeg' });
    if (upload.error) {
      // Nothing uploaded: the empty slot goes (it never held a picture).
      await db.from('assets').delete().eq('id', assetId);
      return failed("Couldn't upload the picture. Check your connection and try again.");
    }
    return ok(assetId);
  },
});

/** The place's picture becomes this asset, hidden until shown (null: the place has none). Gives back its piece's id. */
export const setPlacePicture = defineCommand({
  name: 'place.setPicture',
  log: 'verbose',
  target: (input: { campaignId: string; place: Pick<Place, 'id'>; assetId: string | null }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string | null>> => {
    const { data, error } = await db.rpc('set_place_picture', { place: input.place.id, asset: input.assetId });
    if (error) return fromError(error);
    if (input.assetId) forgetFileLinks(assetPath(input.campaignId, input.assetId));
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    return ok(row?.id ? String(row.id) : null);
  },
});
