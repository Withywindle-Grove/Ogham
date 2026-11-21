// What the GM's review of a new character shows of how it was made (docs/06 "Character creation and review";
// ruled 2026-10-25): guided or freeform, the class and race, the scores ("16 (rolled 14)"), the starting gear,
// and "Over by N gp" when the shopping went over.
import { coinsOf, entryMoneyOf, showMoney, type Coin } from '../modules/characters/startingGear.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import type { CampaignSetting } from './campaignSetting.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ReviewDetails {
  way: 'guided' | 'freeform';
  kinds: string[];
  scores: string | null;
  gear: string | null;
  over: string | null;
}

export function reviewDetails(
  setting: CampaignSetting | null,
  character: { id: string; classRef: string | null; raceRef: string | null; creation: unknown },
  lines: readonly InventoryLine[],
): ReviewDetails {
  const named = (kind: string, id: string | null) => (id ? (setting?.all.find((e) => e.kind === kind && e.packEntryId === id)?.name ?? id) : null);
  const creation = isRecord(character.creation) ? character.creation : {};
  const scores = isRecord(creation.scores) ? creation.scores : {};
  const rolled = isRecord(creation.rolled) ? creation.rolled : {};
  const scoreText = Object.entries(scores)
    .map(([key, value]) => `${key} ${String(value)}${rolled[key] !== undefined && rolled[key] !== value ? ` (rolled ${String(rolled[key])})` : ''}`)
    .join(', ');
  const gear = lines.filter((l) => l.actorId === character.id).map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name));
  let over: string | null = null;
  const coin = isRecord(creation.moneyCoin) ? creation.moneyCoin : null;
  if (coin && typeof creation.spentBase === 'number' && typeof creation.startingMoney === 'number' && typeof coin.valueInBase === 'number') {
    const unit: Coin = { key: String(coin.key ?? 'gp'), label: String(coin.key ?? 'gp'), valueInBase: coin.valueInBase };
    const beyond = creation.spentBase - (creation.startingMoney + entryMoneyOf(creation)) * unit.valueInBase;
    if (beyond > 0) over = `Over by ${showMoney(beyond, setting ? coinsOf(setting.rulesSets) : [], unit)}`;
  }
  return {
    way: character.classRef ? 'guided' : 'freeform',
    kinds: [named('class', character.classRef), named('race', character.raceRef)].filter((n): n is string => !!n),
    scores: scoreText || null,
    gear: gear.length > 0 ? gear.join(', ') : null,
    over,
  };
}
