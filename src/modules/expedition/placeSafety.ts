// Safe or Hostile on a place: kept for the log only (m8b-0 delivery 5, ruled 2026-11-06). Safety is no longer a
// property of a place but one question at End expedition ("In a safe place?"), so nothing in the app writes
// places.safety any more; the command stays registered so the GM's older lines ("marked X safe") still read and
// undo, as place.show did. The column stays (supabase/migrations/20261104130000_m5b_6b_safe_places.sql), unwritten;
// the town screen still reads it (a place marked before the ruling keeps its town) until towns come from a pack's
// settlement (m8b-0, pull request 2). Players never read the column (places is the GM's).
import { defineCommand, fromWrite, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { toPlace, type Place, type Safety } from './placePlay.ts';

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** Safe / Hostile on a place (place.setSafety, Verbose; Undo puts the old value back). Log only: nothing calls it. */
export const setPlaceSafety = defineCommand({
  name: 'place.setSafety',
  log: 'verbose',
  target: (input: { campaignId: string; place: Place; safety: Safety }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<Place>> => {
    const written = fromWrite(
      await db.from('places').update({ safety: input.safety, version: input.place.version }).eq('id', input.place.id).select('id, campaign_id, name, description, version, safety, town'),
    );
    if (!written.ok) return written;
    return ok({ ...toPlace(written.value as Record<string, unknown>, null), notes: input.place.notes, notesVersion: input.place.notesVersion });
  },
});

export const PLACE_SAFETY_COMMANDS = [setPlaceSafety] as const;
