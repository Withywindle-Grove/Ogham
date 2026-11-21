// The party: every approved character still in play in a campaign, with its player, company and level.
// Members can see approved characters; others' waiting and archived ones stay hidden.
import type { Db } from './supabase.ts';

export interface PartyMember {
  id: string;
  campaignId: string;
  name: string;
  level: number;
  /** The player's chosen name. */
  playerName: string;
  ownerUserId: string | null;
  companyName: string | null;
  portraitAssetId: string | null;
}

/** Sorted by character name. Empty for someone outside the campaign; null if it couldn't be loaded. */
export async function loadParty(db: Db, campaignId: string): Promise<PartyMember[] | null> {
  const [actors, members, companies] = await Promise.all([
    db
      .from('actors')
      .select('id, campaign_id, name, level, owner_user_id, company_id, portrait_asset_id, status')
      .eq('campaign_id', campaignId)
      .eq('kind', 'pc')
      .eq('approval', 'approved'),
    db.from('members').select('user_id, profiles!members_user_id_fkey(display_name)').eq('campaign_id', campaignId),
    db.from('companies').select('id, name').eq('campaign_id', campaignId),
  ]);
  if (actors.error || members.error || companies.error) return null;
  return actors.data
    .filter((actor) => actor.status !== 'archived')
    .map((actor) => ({
      id: actor.id,
      campaignId: actor.campaign_id,
      name: actor.name,
      level: actor.level,
      playerName:
        members.data.find((m) => m.user_id === actor.owner_user_id)?.profiles?.display_name ?? 'Unknown player',
      ownerUserId: actor.owner_user_id,
      companyName: companies.data.find((c) => c.id === actor.company_id)?.name ?? null,
      portraitAssetId: actor.portrait_asset_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
