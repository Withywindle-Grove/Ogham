// Character portraits: a picture file in the campaign's storage, an asset row (kind "portrait", visible to all
// members), and the character's link to it. The owner or the GM sets or removes it.
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult } from '../../core/commands.ts';
import { gmRuling, isOwner, type CharacterRef } from './commands.ts';
import { assetPath, FILES_BUCKET, removeAssetFile } from '../../core/files.ts';

export const setPortrait = defineCommand({
  name: 'character.setPortrait',
  target: (input: { character: CharacterRef; image: Blob }) => input.character,
  allowed: (user, character) => !character.archived && (isGm(user, character.campaignId) || isOwner(user, character)),
  fiat: gmRuling,
  run: async (db, user, input): Promise<CommandResult<string>> => {
    const { character, image } = input;
    const current = await db.from('actors').select('name, portrait_asset_id').eq('id', character.id).maybeSingle();
    if (current.error || !current.data) return failed("Couldn't find that character.");
    // Ask whether this person may change the character before making anything, so a refusal leaves nothing
    // behind (a write that changes nothing isn't logged).
    const mayChange = fromWrite(
      await db.from('actors').update({ portrait_asset_id: current.data.portrait_asset_id }).eq('id', character.id).select('id'),
    );
    if (!mayChange.ok) return mayChange;

    // Reuse the picture slot this person uploaded before; otherwise make a new one.
    let assetId = current.data.portrait_asset_id;
    let fresh = false;
    if (assetId) {
      const asset = await db.from('assets').select('uploaded_by').eq('id', assetId).maybeSingle();
      if (asset.data?.uploaded_by !== user.id) assetId = null;
    }
    if (!assetId) {
      const made = await db
        .from('assets')
        .insert({ campaign_id: character.campaignId, kind: 'portrait', name: current.data.name, visibility: 'all' })
        .select('id')
        .single();
      if (made.error) return failed("Couldn't save the picture. Try again.");
      assetId = made.data.id;
      fresh = true;
    }

    const upload = await db.storage
      .from(FILES_BUCKET)
      .upload(assetPath(character.campaignId, assetId), image, { upsert: true, contentType: image.type || 'image/jpeg' });
    if (upload.error) {
      if (fresh) await db.from('assets').delete().eq('id', assetId);
      return failed("Couldn't upload the picture. Check your connection and try again.");
    }

    if (fresh) {
      const linked = fromWrite(
        await db.from('actors').update({ portrait_asset_id: assetId }).eq('id', character.id).select('id'),
      );
      if (!linked.ok) {
        await removeAssetFile(db, character.campaignId, assetId);
        return linked;
      }
      // Tidy up the picture this one replaced, where this person may (best effort).
      const previous = current.data.portrait_asset_id;
      if (previous) await removeAssetFile(db, character.campaignId, previous);
    }
    return ok(assetId);
  },
});

export const clearPortrait = defineCommand({
  name: 'character.clearPortrait',
  target: (input: { character: CharacterRef }) => input.character,
  allowed: (user, character) => !character.archived && (isGm(user, character.campaignId) || isOwner(user, character)),
  fiat: gmRuling,
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const { character } = input;
    const current = await db.from('actors').select('portrait_asset_id').eq('id', character.id).maybeSingle();
    if (current.error || !current.data) return failed("Couldn't find that character.");
    const previous = current.data.portrait_asset_id;
    // Always ask the database, even with no picture set, so a refusal shows as one.
    const unlinked = fromWrite(
      await db.from('actors').update({ portrait_asset_id: null }).eq('id', character.id).select('id'),
    );
    if (!unlinked.ok) return unlinked;
    if (previous) await removeAssetFile(db, character.campaignId, previous);
    return ok(null);
  },
});
