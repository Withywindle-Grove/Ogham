// The GM's side of a secret activity's request (M5b step 3, build order 3; ruled 2026-10-30, S4-3; Francis's ruling
// of 2026-11-03: Yes / No plus the GM's own Hit / Miss on the pack's chance). The request carries only the activity's
// id, the group, who's acting and the cost; everything secret is read here, on the GM's device, from the pack: the
// chance with its modifiers and sources, the result (by season), the table and what it yields. Nothing of it is
// ever in the request a player reads.
import type { Db } from '../core/supabase.ts';
import { rollPlan, usableActivities, yieldCounted, type RollPlan, type Usable } from '../modules/expedition/activities.ts';
import { FALLBACK_MODES, modeById, readExploration, type Activity } from '../modules/expedition/modes.ts';
import { campaignUnits, loadScene } from '../modules/expedition/play.ts';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import { loadTravelGroups } from '../modules/expedition/travelPlay.ts';
import { readSecretActivityPrompt, type Request, type SecretActivityPrompt } from '../modules/requests/requests.ts';
import { choicesInPlay, type CampaignSetting } from './campaignSetting.ts';
import { terrainOf } from './travelView.ts';
import { loadCampaignSettings } from '../core/campaignCommands.ts';

export interface SecretView {
  prompt: SecretActivityPrompt;
  activity: Activity;
  /** The activity here and now (its result, table and yield after the group's terrain and the season); null when the pack no longer offers it. */
  usable: Usable | null;
  plan: RollPlan;
  /** The table a hit rolls on: the table, 'missing' when the pack names one the setting rules don't carry, or null. */
  table: ReadTable | 'missing' | null;
  /** What it yields, in words ("1d3 Reed bundle"; single pieces "1d6 Ration day (Rations, 1 week)", G-108), or null. */
  yields: string | null;
}

export interface SecretViews {
  /** By request id (requests that aren't secret activities are left out). */
  views: Map<string, SecretView>;
  /** The mode's travel budget words ("Leagues", "points"), for the cost's words; null without one. */
  budget: { name: string; unit: string } | null;
}

/** The secret views of the requests that are secret activities, read from the pack on the GM's device. */
export async function loadSecretViews(db: Db, campaignId: string, setting: CampaignSetting | null, requests: readonly Request[]): Promise<SecretViews> {
  const out = new Map<string, SecretView>();
  const none = { views: out, budget: null };
  const secret = requests.filter((r) => r.kind === 'secretActivity');
  if (secret.length === 0 || !setting) return none;
  const [scene, settings] = await Promise.all([loadScene(db, campaignId), loadCampaignSettings(db, campaignId)]);
  const expedition = scene?.expedition ?? null;
  if (!expedition) return none;
  const exploration = readExploration(setting.rulesSets);
  const mode = modeById(exploration.modes, expedition.mode) ?? modeById(FALLBACK_MODES, expedition.mode);
  if (!mode) return none;
  const rows = await loadTravelGroups(db, campaignId, expedition.id);
  const choices = choicesInPlay(setting);
  const units = campaignUnits(settings ?? null, setting.rulesSets);
  for (const request of secret) {
    const prompt = readSecretActivityPrompt(request.prompt);
    const activity = prompt ? mode.activities.find((a) => a.id === prompt.activityId) : undefined;
    if (!prompt || !activity) continue;
    const terrain = terrainOf(mode, rows?.get(prompt.group)?.terrainId);
    const usable = usableActivities(mode, units, { terrain, choices }).find((u) => u.activity.id === activity.id) ?? null;
    const tableId = usable?.tableId ?? activity.tableId;
    let table: ReadTable | 'missing' | null = null;
    if (tableId) {
      const entry = setting.all.find((e) => e.kind === 'table' && e.packEntryId === tableId);
      table = (entry && readTable(entry.packEntryId, entry.name, entry.data)) || 'missing';
    }
    const yields = usable?.yields ?? activity.yields;
    const itemEntry = yields ? setting.items.find((e) => e.packEntryId === yields.item) : undefined;
    const unitName = typeof itemEntry?.data.unitName === 'string' ? itemEntry.data.unitName : null;
    const itemName = yields ? yieldCounted(yields, itemEntry?.name ?? yields.item, unitName) : null;
    out.set(request.id, {
      prompt,
      activity,
      usable,
      plan: rollPlan(activity, null),
      table,
      yields: yields && itemName ? `${yields.dice} ${itemName}` : null,
    });
  }
  return {
    views: out,
    budget: mode.wild.travel ? { name: mode.wild.travel.name, unit: mode.wild.travel.unit } : null,
  };
}
