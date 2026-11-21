// The signed-in person's campaigns, for the campaign picker.
import type { BaseRole } from './commands.ts';
import type { Db } from './supabase.ts';

export interface CampaignSummary {
  id: string;
  name: string;
  role: BaseRole;
  playerCount: number;
  /** The person's active character in this campaign, if any. */
  characterName: string | null;
  /** With no active character: one not sent yet, waiting for approval or sent back, if any. */
  waiting: { name: string; approval: 'draft' | 'pending' | 'rejected' } | null;
  companyName: string | null;
  /** The active character's portrait, shown on a player's row (the campaign sigil if none). */
  portraitAssetId: string | null;
  /** The campaign's sigil picture (its first letter if none). */
  sigilAssetId: string | null;
  /** When its GM retired it (read only), or null. */
  retiredAt: string | null;
}

/** Every campaign the person belongs to, sorted by name. Null if it couldn't be loaded. */
export async function loadMyCampaigns(db: Db, userId: string): Promise<CampaignSummary[] | null> {
  const mine = await db.from('members').select('campaign_id, base_role, active_actor_id, campaigns(name, sigil_asset_id, retired_at)').eq('user_id', userId);
  if (mine.error) return null;
  if (mine.data.length === 0) return [];

  const campaignIds = mine.data.map((row) => row.campaign_id);
  const activeIds = mine.data.flatMap((row) => (row.active_actor_id ? [row.active_actor_id] : []));

  const [players, actors, unapproved] = await Promise.all([
    db.from('members').select('campaign_id').in('campaign_id', campaignIds).eq('base_role', 'player'),
    activeIds.length > 0
      ? db.from('actors').select('id, name, company_id, portrait_asset_id').in('id', activeIds)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('actors')
      .select('campaign_id, name, approval, created_at')
      .in('campaign_id', campaignIds)
      .eq('kind', 'pc')
      .eq('owner_user_id', userId)
      .in('approval', ['draft', 'pending', 'rejected']),
  ]);
  if (players.error || actors.error || unapproved.error) return null;
  const newestFirst = [...unapproved.data].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const companyIds = actors.data.flatMap((actor) => (actor.company_id ? [actor.company_id] : []));
  const companies =
    companyIds.length > 0 ? await db.from('companies').select('id, name').in('id', companyIds) : { data: [], error: null };
  if (companies.error) return null;

  const summaries = mine.data.map((row): CampaignSummary => {
    const actor = actors.data.find((a) => a.id === row.active_actor_id);
    const company = companies.data.find((c) => c.id === actor?.company_id);
    const waiting = actor ? undefined : newestFirst.find((a) => a.campaign_id === row.campaign_id);
    return {
      id: row.campaign_id,
      name: row.campaigns?.name ?? 'Untitled campaign',
      role: row.base_role as BaseRole,
      playerCount: players.data.filter((p) => p.campaign_id === row.campaign_id).length,
      characterName: actor?.name ?? null,
      waiting: waiting ? { name: waiting.name, approval: waiting.approval as 'draft' | 'pending' | 'rejected' } : null,
      companyName: company?.name ?? null,
      portraitAssetId: actor?.portrait_asset_id ?? null,
      sigilAssetId: row.campaigns?.sigil_asset_id ?? null,
      retiredAt: row.campaigns?.retired_at ?? null,
    };
  });
  return sortByName(summaries);
}

/** One campaign's name and sigil, for the top of its screens. Null if it couldn't be loaded. */
export async function loadCampaignHeading(
  db: Db,
  campaignId: string,
): Promise<{ name: string; sigilAssetId: string | null } | null> {
  const { data, error } = await db.from('campaigns').select('name, sigil_asset_id').eq('id', campaignId).maybeSingle();
  if (error || !data) return null;
  return { name: data.name, sigilAssetId: data.sigil_asset_id };
}

export function sortByName<T extends { name: string }>(campaigns: T[]): T[] {
  return [...campaigns].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** The letter in a campaign's round sigil until it has an image: "The Drowned Marches" → "D". */
export function sigilLetter(name: string): string {
  const withoutThe = name.trim().replace(/^the\s+/i, '');
  return (withoutThe || name.trim()).charAt(0).toUpperCase();
}

/** The line under a campaign's name: "GM · 3 players" or "Player · Wren · the Sluice Gate Company". */
export function roleLine(campaign: CampaignSummary): string {
  if (campaign.role === 'gm') {
    const players =
      campaign.playerCount === 0
        ? 'No players yet'
        : `${campaign.playerCount} player${campaign.playerCount === 1 ? '' : 's'}`;
    return `GM, ${players}`;
  }
  const character =
    campaign.characterName ??
    (campaign.waiting
      ? `${campaign.waiting.name} (${campaign.waiting.approval === 'pending' ? 'waiting for approval' : campaign.waiting.approval === 'draft' ? 'not sent yet' : 'sent back'})`
      : 'No character yet');
  return ['Player', character, campaign.companyName].filter(Boolean).join(', ');
}
