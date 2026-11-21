// A campaign's companies, for the GM's Companies section and the player's character cards.
import type { Db } from './supabase.ts';

export interface Company {
  id: string;
  name: string;
}

/** Sorted by name. Empty for someone outside the campaign; null if they couldn't be loaded. */
export async function loadCompanies(db: Db, campaignId: string): Promise<Company[] | null> {
  const { data, error } = await db.from('companies').select('id, name').eq('campaign_id', campaignId);
  if (error) return null;
  return data
    .map((row) => ({ id: row.id, name: row.name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** What the Company page needs (rulings 33, 2026-10-24): the companies, who is in which, and what's waiting. */
export interface CompanyBoard {
  companies: (Company & { founderIds: string[] })[];
  /** Approved characters still in play: whose they are and their company. */
  characters: { id: string; name: string; ownerUserId: string | null; companyId: string | null }[];
  /** Open asks and invitations. */
  waiting: { id: string; companyId: string; actorId: string; kind: 'cofounder' | 'invite' | 'ask'; createdBy: string | null }[];
}

export async function loadCompanyBoard(db: Db, campaignId: string): Promise<CompanyBoard | null> {
  const [companies, actors, waiting] = await Promise.all([
    db.from('companies').select('id, name, founder_ids').eq('campaign_id', campaignId),
    db.from('actors').select('id, name, owner_user_id, company_id, status, kind').eq('campaign_id', campaignId).eq('kind', 'pc').eq('approval', 'approved'),
    db.from('company_invitations').select('id, company_id, actor_id, kind, created_by').eq('campaign_id', campaignId).eq('status', 'open'),
  ]);
  if (companies.error || actors.error || waiting.error) return null;
  return {
    companies: companies.data
      .map((row) => ({ id: row.id, name: row.name, founderIds: row.founder_ids ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    characters: actors.data
      .filter((a) => a.status !== 'archived')
      .map((a) => ({ id: a.id, name: a.name, ownerUserId: a.owner_user_id, companyId: a.company_id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    waiting: waiting.data.map((w) => ({ id: w.id, companyId: w.company_id, actorId: w.actor_id, kind: w.kind as 'cofounder' | 'invite' | 'ask', createdBy: w.created_by })),
  };
}

/** "Companies: On / Off" (ruled 2026-10-24): on unless the campaign says off. */
export function companiesOn(settings: unknown): boolean {
  return !(settings && typeof settings === 'object' && (settings as { companies?: unknown }).companies === false);
}
