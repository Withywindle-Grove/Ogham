// Use a charge, wherever it appears (At hand's row, the light's row, the item's sheet): one way to spend it, say so and
// take it back (finding 9 of frame 47-3, ruled "A" by Francis, 28 Nov 2026: a toast with Undo everywhere).
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { seemsSpent, useCharge } from '../modules/inventory/charges.ts';
import type { InventoryLine, NamedCarrier } from '../modules/inventory/inventory.ts';
import { shownName } from '../modules/inventory/packView.ts';
import { useToast } from '../ui/ToastHost.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import type { Run } from './packHelpers.ts';
import { registry } from './services.ts';

/** The words of Use a charge's toast. Never a count: hidden charges stay hidden (hard rule 5). */
function chargeUsedWords(name: string, spent: boolean): string {
  return spent ? `Nothing happens. ${shownName(name)} seems spent.` : `Used a charge of ${shownName(name)}.`;
}

/**
 * Use a charge's tap: an item that is off, or with no charges left, says why (never a disabled button); otherwise
 * `inventory.useCharge` (logged 'simple'), then a toast with Undo, the log's Undo of this person's newest use. With hidden
 * charges and none left, nothing happens and the holder is told it seems spent (ruled 2026-10-24), with the same Undo.
 */
export function useSpendCharge({
  db,
  user,
  campaign,
  line,
  carrier,
  busy,
  run,
  offReason,
  onNote,
  gmHere,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  line: InventoryLine;
  carrier: NamedCarrier;
  busy: boolean;
  run: Run;
  offReason: string | null;
  onNote: (text: string) => void;
  /** The GM outside the view as the player: they see the hidden count already, so "seems spent" isn't theirs. */
  gmHere: boolean;
}): () => void {
  const toast = useToast();
  const undo = () =>
    void run(async () => {
      const eventId = await latestChange(db, campaign.id, useCharge.name, user.id);
      if (!eventId) return { ok: false as const, message: 'There was nothing to undo.' };
      return runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id });
    });
  return () => {
    if (busy) return;
    if (offReason) return onNote(offReason);
    if (!line.chargesHidden && (line.chargesLeft ?? 0) <= 0) return onNote(`${line.name} has no charges left.`);
    void (async () => {
      const ref = { id: line.id, carrier, version: line.version };
      const done = await run(() => runCommand(registry, db, user, useCharge, { line: ref, hidden: line.chargesHidden }));
      if (!done) return;
      const spent = line.chargesHidden && !gmHere && (await seemsSpent(db, line.id));
      toast({ text: chargeUsedWords(line.name, spent), onUndo: undo });
    })();
  };
}
