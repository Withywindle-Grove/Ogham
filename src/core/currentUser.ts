// Loads the signed-in person, their role in each campaign and which campaigns are retired, for can().
import type { BaseRole, CurrentUser } from './commands.ts';
import type { Db } from './supabase.ts';

export async function loadCurrentUser(db: Db): Promise<CurrentUser | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await db
    .from('members')
    .select('campaign_id, base_role, campaigns(retired_at)')
    .eq('user_id', auth.user.id);
  if (error) throw error;
  const roles: Record<string, BaseRole> = {};
  const retired: string[] = [];
  for (const row of data) {
    roles[row.campaign_id] = row.base_role as BaseRole;
    if (row.campaigns?.retired_at) retired.push(row.campaign_id);
  }
  return { id: auth.user.id, roles, retired };
}
