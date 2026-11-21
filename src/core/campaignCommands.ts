// Campaign-level commands: profile, campaign settings, invites, membership and companies.
// Permission rules mirror the database's access rules (supabase/migrations, docs/03-roles-permissions.md).
import { defineCommand, failed, fromWrite, isGm, isMember, notAllowed, ok, type CommandRegistry, type CommandResult, type CurrentUser } from './commands.ts';
import { partyLowest } from './campaignSettings.ts';
import type { Json } from './database.types.ts';
import type { Db } from './supabase.ts';
import { assetPath, FILES_BUCKET, removeAssetFile } from './files.ts';

export const renameProfile = defineCommand({
  name: 'profile.rename',
  log: 'none',
  target: (input: { userId: string; displayName: string }) => ({ userId: input.userId }),
  allowed: (user, target) => user.id === target.userId,
  run: async (db, _user, input) =>
    fromWrite(
      await db.from('profiles').update({ display_name: input.displayName.trim() }).eq('id', input.userId).select('id, display_name'),
    ),
});

/**
 * Anyone signed in may create a campaign and becomes its GM. The database function is the only way
 * in (a GM-licence check would go there later). Returns the new campaign's id; reload the
 * current user afterwards to pick up the new GM role.
 */
export const createCampaign = defineCommand({
  name: 'campaign.create',
  target: () => ({}),
  allowed: () => true,
  run: async (db, _user, input: { name: string }) => {
    const { data, error } = await db.rpc('create_campaign', { campaign_name: input.name });
    return error ? failed<string>(error.message) : ok(data);
  },
});

/** A campaign's saved settings, as they are (for changing one switch and keeping the rest). */
export async function loadCampaignSettings(db: Db, campaignId: string): Promise<Record<string, Json | undefined> | null> {
  const found = await db.from('campaigns').select('settings').eq('id', campaignId).maybeSingle();
  if (found.error) return null;
  const value = found.data?.settings;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : {};
}

/** What making a new character follows here: the campaign's settings and the party's lowest level. Null if unreadable. */
export async function loadNewCharacterRules(db: Db, campaignId: string): Promise<{ settings: Record<string, Json | undefined>; lowest: number } | null> {
  const [settings, party] = await Promise.all([
    loadCampaignSettings(db, campaignId),
    db.from('actors').select('kind, approval, status, level').eq('campaign_id', campaignId).eq('kind', 'pc').eq('approval', 'approved'),
  ]);
  if (!settings || party.error) return null;
  return { settings, lowest: partyLowest(party.data) };
}

export const updateCampaign = defineCommand({
  name: 'campaign.update',
  target: (input: { campaignId: string; name?: string; sigilAssetId?: string | null; settings?: Json }) => ({
    campaignId: input.campaignId,
  }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input) => {
    if (input.name !== undefined && input.name.trim() === '') return failed<{ id: string }>('Give the campaign a name.');
    const patch: { name?: string; sigil_asset_id?: string | null; settings?: Json } = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.sigilAssetId !== undefined) patch.sigil_asset_id = input.sigilAssetId;
    if (input.settings !== undefined) patch.settings = input.settings;
    return fromWrite(await db.from('campaigns').update(patch).eq('id', input.campaignId).select('id'));
  },
});

/** The campaign's sigil: a picture file, an asset row (kind "sigil", visible to all members), and the campaign's link to it. */
export const setSigil = defineCommand({
  name: 'campaign.setSigil',
  target: (input: { campaignId: string; image: Blob }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { campaignId, image } = input;
    const current = await db.from('campaigns').select('name, sigil_asset_id').eq('id', campaignId).maybeSingle();
    const made = fromWrite(
      await db
        .from('assets')
        .insert({ campaign_id: campaignId, kind: 'sigil', name: current.data?.name ?? 'Sigil', visibility: 'all' })
        .select('id'),
    );
    if (!made.ok) return made;
    const assetId = made.value.id;

    const upload = await db.storage
      .from(FILES_BUCKET)
      .upload(assetPath(campaignId, assetId), image, { upsert: true, contentType: image.type || 'image/jpeg' });
    if (upload.error) {
      await db.from('assets').delete().eq('id', assetId);
      return failed("Couldn't upload the picture. Check your connection and try again.");
    }

    const linked = fromWrite(await db.from('campaigns').update({ sigil_asset_id: assetId }).eq('id', campaignId).select('id'));
    if (!linked.ok) {
      await removeAssetFile(db, campaignId, assetId);
      return linked;
    }
    // Tidy up the sigil this one replaced (best effort).
    const previous = current.data?.sigil_asset_id;
    if (previous) await removeAssetFile(db, campaignId, previous);
    return ok(assetId);
  },
});

export const clearSigil = defineCommand({
  name: 'campaign.clearSigil',
  target: (input: { campaignId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const current = await db.from('campaigns').select('sigil_asset_id').eq('id', input.campaignId).maybeSingle();
    const previous = current.data?.sigil_asset_id;
    // Always ask the database, even with no sigil set, so a refusal shows as one.
    const unlinked = fromWrite(
      await db.from('campaigns').update({ sigil_asset_id: null }).eq('id', input.campaignId).select('id'),
    );
    if (!unlinked.ok) return unlinked;
    if (previous) await removeAssetFile(db, input.campaignId, previous);
    return ok(null);
  },
});

export const createInvite = defineCommand({
  name: 'invite.create',
  target: (input: { campaignId: string; email?: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input) =>
    fromWrite(
      await db
        .from('invites')
        .insert({ campaign_id: input.campaignId, email: input.email?.trim() || null })
        .select('id, code, expires_at'),
    ),
});

export const revokeInvite = defineCommand({
  name: 'invite.revoke',
  target: (input: { campaignId: string; inviteId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input) =>
    fromWrite(await db.from('invites').update({ status: 'revoked' }).eq('id', input.inviteId).select('id')),
});

/** Anyone signed in may try a code; the database decides whether it's valid. Returns the campaign id. */
export const redeemInvite = defineCommand({
  name: 'invite.redeem',
  target: () => ({}),
  allowed: () => true,
  run: async (db, _user, input: { code: string }) => {
    const { data, error } = await db.rpc('redeem_invite', { invite_code: input.code });
    return error ? failed<string>(error.message) : ok(data);
  },
});

export const setActiveCharacter = defineCommand({
  name: 'member.setActiveCharacter',
  target: (input: {
    campaignId: string;
    character: { id: string; ownerUserId: string | null; approval: string; archived: boolean } | null;
  }) => ({
    campaignId: input.campaignId,
    ownerUserId: input.character?.ownerUserId ?? null,
    approved: input.character?.approval === 'approved' && !input.character.archived,
    clearing: input.character === null,
  }),
  // Only your own approved characters can be active (never a waiting, sent-back or archived one).
  allowed: (user, target) =>
    isMember(user, target.campaignId) && (target.clearing || (target.ownerUserId === user.id && target.approved)),
  run: async (db, user, input) =>
    fromWrite(
      await db
        .from('members')
        .update({ active_actor_id: input.character?.id ?? null })
        .eq('campaign_id', input.campaignId)
        .eq('user_id', user.id)
        .select('id, active_actor_id'),
    ),
});

const NO_COMPANY_NAME = 'Give the company a name.';

export const createCompany = defineCommand({
  name: 'company.create',
  target: (input: { campaignId: string; name: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input) => {
    if (!input.name.trim()) return failed<{ id: string; name: string }>(NO_COMPANY_NAME);
    return fromWrite(await db.from('companies').insert({ campaign_id: input.campaignId, name: input.name.trim() }).select('id, name'));
  },
});

export const renameCompany = defineCommand({
  name: 'company.rename',
  target: (input: { campaignId: string; companyId: string; name: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input) => {
    if (!input.name.trim()) return failed<{ id: string; name: string }>(NO_COMPANY_NAME);
    return fromWrite(await db.from('companies').update({ name: input.name.trim() }).eq('id', input.companyId).select('id, name'));
  },
});

export const deleteCompany = defineCommand({
  name: 'company.delete',
  target: (input: { campaignId: string; companyId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  // Only while no character is in it, archived ones included (the database checks this too).
  run: async (db, _user, input) => {
    const members = await db.from('actors').select('id').eq('company_id', input.companyId).limit(1);
    if (members.error) return failed<{ id: string }>("Couldn't check who is in this company. Try again.");
    if (members.data.length > 0) return failed<{ id: string }>('Move its characters out of this company first.');
    return fromWrite(await db.from('companies').delete().eq('id', input.companyId).select('id'));
  },
});

// Companies belong to the players (rulings 33 and 33b, 2026-10-24): found one (with co-founders, each invited),
// ask to join, invite a character without a company, answer, or take back an ask or invitation. The database
// functions check who may and keep one company per character; the GM can do any of it. All are logged.

/** A character a player acts for: whose it is, so the app can check before asking the database. */
export interface CompanyCharacter {
  id: string;
  ownerUserId: string | null;
}
const actsFor = (user: CurrentUser, campaignId: string, character: CompanyCharacter) =>
  isGm(user, campaignId) || (isMember(user, campaignId) && character.ownerUserId === user.id);

const rpcResult = <T>(result: { data: unknown; error: { code?: string; message: string } | null }, fallback: T): CommandResult<T> =>
  result.error ? (result.error.code === '42501' ? notAllowed<T>() : failed<T>(result.error.message)) : ok(result.data === null || result.data === undefined ? fallback : (result.data as T));

export const foundCompany = defineCommand({
  name: 'company.found',
  target: (input: { campaignId: string; character: CompanyCharacter; name: string; cofounderIds?: string[] }) => input,
  allowed: (user, target) => actsFor(user, target.campaignId, target.character),
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    if (!input.name.trim()) return failed(NO_COMPANY_NAME);
    return rpcResult(await db.rpc('found_company', { actor: input.character.id, company_name: input.name.trim(), cofounders: input.cofounderIds ?? [] }), '');
  },
});

export const askToJoin = defineCommand({
  name: 'company.ask',
  target: (input: { campaignId: string; companyId: string; character: CompanyCharacter }) => input,
  allowed: (user, target) => actsFor(user, target.campaignId, target.character),
  run: async (db, _user, input): Promise<CommandResult<string>> => rpcResult(await db.rpc('ask_or_invite', { company: input.companyId, actor: input.character.id, ask: true }), ''),
});

export const inviteToCompany = defineCommand({
  name: 'company.invite',
  /** member: the inviter has a character in the company (the database checks this too). */
  target: (input: { campaignId: string; companyId: string; characterId: string; member: boolean }) => input,
  allowed: (user, target) => isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.member),
  run: async (db, _user, input): Promise<CommandResult<string>> => rpcResult(await db.rpc('ask_or_invite', { company: input.companyId, actor: input.characterId, ask: false }), ''),
});

export const answerInvitation = defineCommand({
  name: 'company.answer',
  /** mine: it's this person's to answer (their character was invited, or it's an ask to their company). */
  target: (input: { campaignId: string; invitationId: string; accept: boolean; mine: boolean }) => input,
  allowed: (user, target) => isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.mine),
  run: async (db, _user, input): Promise<CommandResult<null>> => rpcResult(await db.rpc('answer_invitation', { invitation: input.invitationId, accept: input.accept }), null),
});

export const cancelInvitation = defineCommand({
  name: 'company.cancel',
  /** sent: this person made it. */
  target: (input: { campaignId: string; invitationId: string; sent: boolean }) => input,
  allowed: (user, target) => isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.sent),
  run: async (db, _user, input): Promise<CommandResult<null>> => rpcResult(await db.rpc('cancel_invitation', { invitation: input.invitationId }), null),
});

/** Retiring a campaign: it stays readable, but nothing in it can change (the database stamps the time). */
export const retireCampaign = defineCommand({
  name: 'campaign.retire',
  target: (input: { campaignId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input) =>
    fromWrite(await db.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', input.campaignId).select('id')),
});

/** Bringing a retired campaign back: the one change a retired campaign allows. */
export const restoreCampaign = defineCommand({
  name: 'campaign.restore',
  target: (input: { campaignId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  whileRetired: true,
  run: async (db, _user, input) =>
    fromWrite(await db.from('campaigns').update({ retired_at: null }).eq('id', input.campaignId).select('id')),
});

export function registerCampaignCommands(registry: CommandRegistry): void {
  for (const command of [
    renameProfile,
    createCampaign,
    updateCampaign,
    setSigil,
    clearSigil,
    createInvite,
    revokeInvite,
    redeemInvite,
    setActiveCharacter,
    createCompany,
    renameCompany,
    deleteCompany,
    foundCompany,
    askToJoin,
    inviteToCompany,
    answerInvitation,
    cancelInvitation,
    retireCampaign,
    restoreCampaign,
  ]) {
    registry.register(command);
  }
}
