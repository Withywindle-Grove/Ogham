// The signed-in person's own profile.
import type { Db } from './supabase.ts';

export interface MyProfile {
  id: string;
  displayName: string;
  /** False until they've chosen a name once ("What should we call you?"). */
  named: boolean;
}

export async function loadMyProfile(db: Db, userId: string): Promise<MyProfile | null> {
  const { data, error } = await db.from('profiles').select('id, display_name, named_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, displayName: data.display_name, named: data.named_at !== null } : null;
}
