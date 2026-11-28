// The lit light's row when its own item is At hand itself with charges (Player sitting piece 9, frame 47-3; pss-17, C2,
// D1): one row, the light's, with the charges' words at the end of its line and Use a charge beside its ring. At hand
// draws the light in this one place (`PackScreen`), with this Use or without; the item's own row is left out.
import type { ReactNode } from 'react';
import { isGm, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { chargesOf, type ChargeRules } from '../modules/inventory/charges.ts';
import { mayChangeCarrier, type InventoryLine, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { atHandAction } from '../modules/inventory/packView.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { lineInPlay, offReasonOf, type CampaignSetting } from './campaignSetting.ts';
import { ItemAction } from './ItemAction.tsx';
import type { LightUse } from './LightSection.tsx';
import { chargeWords, type Run } from './packHelpers.ts';
import { usePlayerView } from './playerView.ts';
import { useSpendCharge } from './spendCharge.ts';

export function LitLightUse({
  rows,
  line: raw,
  carrier,
  setting,
  hidden,
  charges,
  rechargeDefault,
  db,
  user,
  campaign,
  busy,
  run,
  onNote,
}: {
  /** The light's rows (`LightInAtHand`), given the charges' words and Use. */
  rows: (use: LightUse) => ReactNode;
  /** The lit light's pack line, as stored: read here as the campaign's patches make it, as its row would (of-13). */
  line: InventoryLine;
  carrier: NamedCarrier;
  setting: CampaignSetting | null;
  /** The hidden charge counts the GM sees, by line. */
  hidden: ReadonlyMap<string, { total: number | null; spent: boolean }>;
  charges: ChargeRules;
  rechargeDefault: boolean;
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  busy: boolean;
  run: Run;
  onNote: (text: string) => void;
}) {
  // In the GM's view as the player the row is the player's: no hidden count (pg32-3, pg32-4).
  const view = usePlayerView();
  const gmHere = isGm(user, campaign.id) && view === null;
  const now = lineInPlay(setting, raw);
  const line = now.details === raw.details ? raw : { ...raw, details: now.details };
  const spend = useSpendCharge({ db, user, campaign, line, carrier, busy, run, offReason: offReasonOf(line.name, now.off), onNote, gmHere });
  const words = chargesOf(line, charges, rechargeDefault) ? chargeWords(line, gmHere ? (hidden.get(line.id) ?? null) : null) : '';
  // Use once the count is known, and only for someone who may change the carrier (as the item's own row).
  const mayUse = mayChangeCarrier(user, carrier) && atHandAction(line, charges, rechargeDefault) === 'charge' && (line.chargesHidden || line.chargesLeft !== null);
  const button = mayUse ? <ItemAction key="use" word="Use" wordAsButton="Use a charge" hidden={`of ${line.name}`} stacked onClick={spend} /> : null;
  return rows({ words, button });
}
