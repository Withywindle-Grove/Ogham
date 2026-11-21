// Invite codes: reading them from links and typing, and looking one up before joining.
import type { Db } from './supabase.ts';

export interface InvitePreview {
  campaignId: string;
  campaignName: string;
  gmName: string;
  alreadyMember: boolean;
}

/** Capitals and letters/digits only, so "k7qm 2xpa" and "K7QM-2XPA" both work. */
export function normalizeInviteCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The code in an invite link's path ("/join/K7QM2XPA"), or null if the path isn't an invite. */
export function inviteCodeFromPath(pathname: string): string | null {
  const match = /^\/join\/([^/]+)\/?$/.exec(pathname);
  const code = match?.[1] ? normalizeInviteCode(decodeURIComponent(match[1])) : '';
  return code || null;
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/join/${code}`;
}

/**
 * Shows which campaign a code is for, without joining or using it up.
 * Null means the code isn't valid (unknown, expired, revoked or used); 'error' means it couldn't be checked.
 */
export async function peekInvite(db: Db, code: string): Promise<InvitePreview | null | 'error'> {
  const { data, error } = await db.rpc('peek_invite', { invite_code: code });
  if (error) return 'error';
  const row = data[0];
  if (!row) return null;
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    gmName: row.gm_name,
    alreadyMember: row.already_member,
  };
}
