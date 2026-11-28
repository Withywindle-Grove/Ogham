// What the GM's device reads from the pack for a buy or sell request (M5b step 6e; 07 Settlements, st-2): the item's
// own chance as its availability writes it (TC13 piece B, TW8g: the stock table's figure), and for a sale the price the
// pack's sale rule suggests. The requests carry only ids and names; the rules stay on the GM's side.
import { readTown } from '../modules/expedition/town.ts';
import type { Request } from '../modules/requests/requests.ts';
import { readAvailability } from '../modules/requests/shopStock.ts';
import { readBuyPrompt, readSellPrompt, saleShare, suggestedSale } from '../modules/requests/townRequests.ts';
import { choicesInPlay, type CampaignSetting } from './campaignSetting.ts';
import type { TradeView } from './TownRequestCards.tsx';

export function tradeViewOf(request: Request, setting: Pick<CampaignSetting, 'rulesSets' | 'items' | 'all' | 'packs'>): TradeView | null {
  const rulesSets = setting.rulesSets;
  if (request.kind === 'buy') {
    const prompt = readBuyPrompt(request.prompt);
    if (!prompt) return null;
    const entry = prompt.itemId ? setting.items.find((e) => e.packEntryId === prompt.itemId) : undefined;
    return { chance: readAvailability(entry?.data.availability)?.chance ?? '', suggested: null, share: null };
  }
  if (request.kind === 'sell') {
    const prompt = readSellPrompt(request.prompt);
    if (!prompt) return null;
    const service = prompt.serviceId ? readTown(rulesSets, choicesInPlay(setting))?.services.find((s) => s.id === prompt.serviceId) : undefined;
    const share = saleShare(rulesSets, prompt.serviceId, service?.rate ?? null);
    const entry = prompt.itemId ? setting.items.find((e) => e.packEntryId === prompt.itemId) : undefined;
    return { chance: '', suggested: entry ? suggestedSale(entry.data.value, prompt.qty, share, rulesSets) : null, share };
  }
  return null;
}
