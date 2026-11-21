// Access rules (row-level security) for M1's tables, checked against the TEST project.
// Each test signs in as an invented person and checks what the database lets them see and do.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import { BUCKET, buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

/** How many rows of `table` with this id the person can see. */
async function visibleCount(person: Person, table: string, id: string, idColumn = 'id'): Promise<number> {
  const { data, error } = await person.db.from(table).select(idColumn).eq(idColumn, id);
  expect(error).toBeNull();
  return data?.length ?? 0;
}

/** A write was refused: either an error, or the rules filtered it down to zero rows. */
function refused(result: { data: unknown[] | null; error: PostgrestError | null }): boolean {
  return result.error !== null || (result.data?.length ?? 0) === 0;
}

/** Reads a row with the secret key, ignoring the access rules, to see what really changed. */
async function actual(table: string, id: string, idColumn = 'id') {
  return must(await world.admin.from(table).select('*').eq(idColumn, id).single());
}

async function newPendingCharacter(owner: Person, name: string): Promise<string> {
  const row = must(
    await owner.db
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id })
      .select()
      .single(),
  );
  return row.id;
}

describe('campaign visibility', () => {
  it("an outsider can't see the campaign, its members, characters or companies", async () => {
    const { outsider, campaignId } = world;
    expect(await visibleCount(outsider, 'campaigns', campaignId)).toBe(0);
    expect(await visibleCount(outsider, 'members', campaignId, 'campaign_id')).toBe(0);
    expect(await visibleCount(outsider, 'actors', campaignId, 'campaign_id')).toBe(0);
    expect(await visibleCount(outsider, 'companies', campaignId, 'campaign_id')).toBe(0);
  });

  it('members can see their campaign, its members, its companies and approved characters', async () => {
    for (const person of [world.gm, world.playerA, world.playerB]) {
      expect(await visibleCount(person, 'campaigns', world.campaignId)).toBe(1);
      expect(await visibleCount(person, 'members', world.campaignId, 'campaign_id')).toBe(3);
      expect(await visibleCount(person, 'companies', world.companyId)).toBe(1);
      expect(await visibleCount(person, 'actors', world.wrenId)).toBe(1);
      expect(await visibleCount(person, 'actors', world.ashId)).toBe(1);
    }
  });

  it("a player can't see another campaign they're not in", async () => {
    expect(await visibleCount(world.playerA, 'campaigns', world.otherCampaignId)).toBe(0);
  });

  it('members can see the profiles of people in their campaign, and outsiders cannot', async () => {
    expect(await visibleCount(world.playerA, 'profiles', world.playerB.id)).toBe(1);
    expect(await visibleCount(world.outsider, 'profiles', world.playerB.id)).toBe(0);
  });

  it('a person can change their own display name but not anyone else’s', async () => {
    const own = await world.playerA.db.from('profiles').update({ display_name: 'Francine' }).eq('id', world.playerA.id).select();
    expect(refused(own)).toBe(false);
    const other = await world.playerA.db.from('profiles').update({ display_name: 'Mud' }).eq('id', world.playerB.id).select();
    expect(refused(other)).toBe(true);
  });
});

describe('characters', () => {
  it('a pending character is visible only to its owner and the GM', async () => {
    const id = await newPendingCharacter(world.playerA, 'Bram the Unready');
    expect(await visibleCount(world.playerA, 'actors', id)).toBe(1);
    expect(await visibleCount(world.gm, 'actors', id)).toBe(1);
    expect(await visibleCount(world.playerB, 'actors', id)).toBe(0);
    expect(await visibleCount(world.outsider, 'actors', id)).toBe(0);
  });

  it('a player can create a character in their campaign, owned by themselves, and it starts pending', async () => {
    const id = await newPendingCharacter(world.playerB, 'Moss the Ferrywife');
    const row = await actual('actors', id);
    expect(row.owner_user_id).toBe(world.playerB.id);
    expect(row.approval).toBe('pending');
  });

  it("a player can't create a character that is already approved, owned by someone else, or in another campaign", async () => {
    const base = { campaign_id: world.campaignId, kind: 'pc', name: 'Sly Cob', owner_type: 'user', owner_user_id: world.playerA.id };
    const approved = await world.playerA.db.from('actors').insert({ ...base, approval: 'approved' }).select();
    expect(refused(approved)).toBe(true);
    const forOther = await world.playerA.db.from('actors').insert({ ...base, owner_user_id: world.playerB.id }).select();
    expect(refused(forOther)).toBe(true);
    const outside = await world.outsider.db
      .from('actors')
      .insert({ ...base, owner_user_id: world.outsider.id })
      .select();
    expect(refused(outside)).toBe(true);
  });

  it('a player can create companions (hireling, animal, vehicle) but not NPCs or monsters', async () => {
    const base = { campaign_id: world.campaignId, owner_type: 'user', owner_user_id: world.playerA.id };
    for (const kind of ['hireling', 'animal', 'vehicle']) {
      const made = await world.playerA.db.from('actors').insert({ ...base, kind, name: `Companion ${kind}` }).select();
      expect(refused(made)).toBe(false);
    }
    for (const kind of ['npc', 'monster']) {
      const made = await world.playerA.db.from('actors').insert({ ...base, kind, name: `Not allowed ${kind}` }).select();
      expect(refused(made)).toBe(true);
    }
  });

  it("a player can edit their own character but not another player's", async () => {
    const own = await world.playerA.db
      .from('actors')
      .update({ hp_current: 6, backstory: 'Raised on the lantern barges.' })
      .eq('id', world.wrenId)
      .select();
    expect(refused(own)).toBe(false);
    const other = await world.playerA.db.from('actors').update({ hp_current: 1 }).eq('id', world.ashId).select();
    expect(refused(other)).toBe(true);
    expect((await actual('actors', world.ashId)).hp_current).toBe(5);
  });

  it("a player can't approve their own character, give it away or move it to a company", async () => {
    const id = await newPendingCharacter(world.playerA, 'Pip the Hopeful');
    await world.playerA.db.from('actors').update({ approval: 'approved' }).eq('id', id);
    await world.playerA.db.from('actors').update({ owner_user_id: world.playerB.id }).eq('id', id);
    await world.playerA.db.from('actors').update({ company_id: world.companyId }).eq('id', world.wrenId);
    expect((await actual('actors', id)).approval).toBe('pending');
    expect((await actual('actors', id)).owner_user_id).toBe(world.playerA.id);
    expect((await actual('actors', world.wrenId)).company_id).toBeNull();
  });

  it('the GM can edit any character in the campaign and approve or reject pending ones', async () => {
    const edit = await world.gm.db.from('actors').update({ hp_current: 2 }).eq('id', world.ashId).select();
    expect(refused(edit)).toBe(false);

    const toApprove = await newPendingCharacter(world.playerA, 'Tansy the Bold');
    expect(refused(await world.gm.db.from('actors').update({ approval: 'approved' }).eq('id', toApprove).select())).toBe(false);
    expect(await visibleCount(world.playerB, 'actors', toApprove)).toBe(1);

    const toReject = await newPendingCharacter(world.playerA, 'Grub the Doubtful');
    expect(refused(await world.gm.db.from('actors').update({ approval: 'rejected' }).eq('id', toReject).select())).toBe(false);
    // Rejected characters are kept (nothing erased), seen only by the owner and the GM.
    expect(await visibleCount(world.playerA, 'actors', toReject)).toBe(1);
    expect(await visibleCount(world.gm, 'actors', toReject)).toBe(1);
    expect(await visibleCount(world.playerB, 'actors', toReject)).toBe(0);
  });

  it('a player can switch their own active character, but not to someone else’s', async () => {
    const own = await world.playerA.db
      .from('members')
      .update({ active_actor_id: world.wrenId })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id)
      .select();
    expect(refused(own)).toBe(false);
    await world.playerA.db
      .from('members')
      .update({ active_actor_id: world.ashId })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id);
    const row = must(
      await world.admin.from('members').select('*').eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id).single(),
    );
    expect(row.active_actor_id).toBe(world.wrenId);
  });
});

describe('GM secrets', () => {
  it('no player can read actor_secrets, not even for their own character; the GM can read and write them', async () => {
    must(await world.admin.from('actor_secrets').insert({ actor_id: world.wrenId, gm_notes: 'Owes the river hag a favour.' }).select());

    expect(await visibleCount(world.playerA, 'actor_secrets', world.wrenId, 'actor_id')).toBe(0);
    expect(await visibleCount(world.playerB, 'actor_secrets', world.wrenId, 'actor_id')).toBe(0);
    const playerWrite = await world.playerA.db.from('actor_secrets').update({ gm_notes: 'nothing to see' }).eq('actor_id', world.wrenId).select();
    expect(refused(playerWrite)).toBe(true);
    const playerInsert = await world.playerA.db.from('actor_secrets').insert({ actor_id: world.ashId, gm_notes: 'x' }).select();
    expect(refused(playerInsert)).toBe(true);

    expect(await visibleCount(world.gm, 'actor_secrets', world.wrenId, 'actor_id')).toBe(1);
    const monster = must(
      await world.gm.db
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'monster', name: 'Bog lurker', owner_type: 'gm', approval: 'approved' })
        .select()
        .single(),
    );
    const gmWrite = await world.gm.db.from('actor_secrets').insert({ actor_id: monster.id, hp_current: 11, hp_max: 11 }).select();
    expect(refused(gmWrite)).toBe(false);
    expect(await visibleCount(world.playerA, 'actor_secrets', monster.id, 'actor_id')).toBe(0);
  });
});

describe('GM-only campaign changes', () => {
  it('only the GM can rename the campaign or change its sigil or settings', async () => {
    const sigil = must(
      await world.gm.db
        .from('assets')
        .insert({ campaign_id: world.campaignId, kind: 'sigil', name: 'Lantern sigil', visibility: 'all' })
        .select()
        .single(),
    );
    const byPlayer = await world.playerA.db
      .from('campaigns')
      .update({ name: 'Wren’s Game', sigil_asset_id: sigil.id, settings: { lantern: { autoRefill: true } } })
      .eq('id', world.campaignId)
      .select();
    expect(refused(byPlayer)).toBe(true);
    expect((await actual('campaigns', world.campaignId)).name).toBe('The Reedmouth Delve');

    const byGm = await world.gm.db
      .from('campaigns')
      .update({ name: 'The Reedmouth Deep', sigil_asset_id: sigil.id, settings: { lantern: { autoRefill: true } } })
      .eq('id', world.campaignId)
      .select();
    expect(refused(byGm)).toBe(false);
  });

  it('only the GM can create, rename or delete companies', async () => {
    const playerCreate = await world.playerA.db.from('companies').insert({ campaign_id: world.campaignId, name: 'Wren’s Own' }).select();
    expect(refused(playerCreate)).toBe(true);

    const made = await world.gm.db.from('companies').insert({ campaign_id: world.campaignId, name: 'The Reed Cutters' }).select().single();
    expect(made.error).toBeNull();
    const id = made.data.id;

    expect(refused(await world.playerA.db.from('companies').update({ name: 'Mine now' }).eq('id', id).select())).toBe(true);
    expect(refused(await world.playerA.db.from('companies').delete().eq('id', id).select())).toBe(true);
    expect((await actual('companies', id)).name).toBe('The Reed Cutters');

    expect(refused(await world.gm.db.from('companies').update({ name: 'The Reed Guild' }).eq('id', id).select())).toBe(false);
    expect(refused(await world.gm.db.from('companies').delete().eq('id', id).select())).toBe(false);
  });

  it('only the GM can assign characters to companies, and only to a company in the same campaign', async () => {
    const byGm = await world.gm.db.from('actors').update({ company_id: world.companyId }).eq('id', world.ashId).select();
    expect(refused(byGm)).toBe(false);

    const elsewhere = must(
      await world.admin.from('companies').insert({ campaign_id: world.otherCampaignId, name: 'The Barrow Watch' }).select().single(),
    );
    const crossed = await world.gm.db.from('actors').update({ company_id: elsewhere.id }).eq('id', world.ashId).select();
    expect(refused(crossed)).toBe(true);
  });
});

describe('membership', () => {
  it("a player can't make themselves GM or add members directly", async () => {
    await world.playerA.db
      .from('members')
      .update({ base_role: 'gm' })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id);
    const row = must(
      await world.admin.from('members').select('*').eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id).single(),
    );
    expect(row.base_role).toBe('player');

    const addOther = await world.playerA.db
      .from('members')
      .insert({ campaign_id: world.campaignId, user_id: world.outsider.id, base_role: 'player' })
      .select();
    expect(refused(addOther)).toBe(true);
    const addSelf = await world.outsider.db
      .from('members')
      .insert({ campaign_id: world.campaignId, user_id: world.outsider.id, base_role: 'player' })
      .select();
    expect(refused(addSelf)).toBe(true);
  });
});

describe('invites', () => {
  it('only the GM can create, list or revoke invites', async () => {
    const byPlayer = await world.playerA.db.from('invites').insert({ campaign_id: world.campaignId }).select();
    expect(refused(byPlayer)).toBe(true);

    const invite = must(await world.gm.db.from('invites').insert({ campaign_id: world.campaignId }).select().single());
    expect(invite.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(invite.status).toBe('pending');

    expect(await visibleCount(world.gm, 'invites', invite.id)).toBe(1);
    expect(await visibleCount(world.playerA, 'invites', invite.id)).toBe(0);
    expect(await visibleCount(world.outsider, 'invites', invite.id)).toBe(0);

    expect(refused(await world.playerA.db.from('invites').update({ status: 'revoked' }).eq('id', invite.id).select())).toBe(true);
    expect(refused(await world.gm.db.from('invites').update({ status: 'revoked' }).eq('id', invite.id).select())).toBe(false);
  });

  it('an invited person joins as a player by presenting a valid code, and the code then stops working', async () => {
    const invite = must(await world.gm.db.from('invites').insert({ campaign_id: world.campaignId }).select().single());

    const joined = await world.newcomer.db.rpc('redeem_invite', { invite_code: invite.code });
    expect(joined.error).toBeNull();
    expect(joined.data).toBe(world.campaignId);

    const member = must(
      await world.admin.from('members').select('*').eq('campaign_id', world.campaignId).eq('user_id', world.newcomer.id).single(),
    );
    expect(member.base_role).toBe('player');
    expect((await actual('invites', invite.id)).status).toBe('accepted');
    expect(await visibleCount(world.newcomer, 'campaigns', world.campaignId)).toBe(1);

    const reused = await world.latecomer.db.rpc('redeem_invite', { invite_code: invite.code });
    expect(reused.error).not.toBeNull();
  });

  it("expired, revoked or made-up codes don't let anyone join", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const expired = must(
      await world.admin.from('invites').insert({ campaign_id: world.campaignId, expires_at: past }).select().single(),
    );
    const revoked = must(
      await world.admin.from('invites').insert({ campaign_id: world.campaignId, status: 'revoked' }).select().single(),
    );
    for (const code of [expired.code, revoked.code, 'NOTACODE']) {
      const attempt = await world.latecomer.db.rpc('redeem_invite', { invite_code: code });
      expect(attempt.error).not.toBeNull();
    }
    expect(await visibleCount(world.latecomer, 'campaigns', world.campaignId)).toBe(0);
  });
});

describe('assets and files', () => {
  async function addAsset(fields: Record<string, unknown>): Promise<{ id: string; path: string }> {
    const row = must(await world.admin.from('assets').insert({ campaign_id: world.campaignId, ...fields }).select().single());
    // The database works out where the file lives: <campaign id>/<asset id>.
    const path: string = row.storage_path;
    expect(path).toBe(`${world.campaignId}/${row.id}`);
    must(await world.admin.storage.from(BUCKET).upload(path, new Blob(['invented file']), { contentType: 'text/plain' }));
    return { id: row.id, path };
  }

  async function canRead(person: Person, asset: { id: string; path: string }): Promise<boolean> {
    const row = (await visibleCount(person, 'assets', asset.id)) === 1;
    const file = (await person.db.storage.from(BUCKET).download(asset.path)).error === null;
    expect(row).toBe(file); // the row and the file always follow the same rule
    return row;
  }

  it('files with visibility "gm" are readable only by the GM', async () => {
    const map = await addAsset({ kind: 'map', name: 'The sunken chapel', visibility: 'gm' });
    expect(await canRead(world.gm, map)).toBe(true);
    expect(await canRead(world.playerA, map)).toBe(false);
    expect(await canRead(world.outsider, map)).toBe(false);
  });

  it('files with visibility "all" are readable by every member, and not by outsiders', async () => {
    const handout = await addAsset({ kind: 'handout', name: 'Ferry timetable', visibility: 'all', revealed_at: new Date().toISOString() });
    for (const person of [world.gm, world.playerA, world.playerB]) expect(await canRead(person, handout)).toBe(true);
    expect(await canRead(world.outsider, handout)).toBe(false);
  });

  it('files shared with a list of users are readable only by those users and the GM', async () => {
    const letter = await addAsset({ kind: 'handout', name: 'The drowned priest’s letter', visibility: 'users', visible_to: [world.playerA.id] });
    expect(await canRead(world.playerA, letter)).toBe(true);
    expect(await canRead(world.gm, letter)).toBe(true);
    expect(await canRead(world.playerB, letter)).toBe(false);
    expect(await canRead(world.outsider, letter)).toBe(false);
  });

  it('portraits and sigils are readable by all members and cannot be hidden', async () => {
    const portrait = await addAsset({ kind: 'portrait', name: 'Wren', visibility: 'all' });
    for (const person of [world.gm, world.playerA, world.playerB]) expect(await canRead(person, portrait)).toBe(true);
    expect(await canRead(world.outsider, portrait)).toBe(false);
    const hidden = await world.gm.db
      .from('assets')
      .insert({ campaign_id: world.campaignId, kind: 'sigil', name: 'Secret sigil', visibility: 'gm' })
      .select();
    expect(refused(hidden)).toBe(true);
  });

  it('a player can upload a portrait; only the GM can add handouts, maps and sigils', async () => {
    const portrait = await world.playerA.db
      .from('assets')
      .insert({ campaign_id: world.campaignId, kind: 'portrait', name: 'Wren, sketched', visibility: 'all' })
      .select()
      .single();
    expect(portrait.error).toBeNull();
    const path = `${world.campaignId}/${portrait.data.id}`;
    const upload = await world.playerA.db.storage.from(BUCKET).upload(path, new Blob(['invented portrait']), { contentType: 'text/plain' });
    expect(upload.error).toBeNull();
    // Player B can't overwrite or upload into Player A's portrait slot.
    const intrude = await world.playerB.db.storage.from(BUCKET).upload(path, new Blob(['scribble']), { upsert: true, contentType: 'text/plain' });
    expect(intrude.error).not.toBeNull();

    for (const kind of ['handout', 'map', 'sigil']) {
      const made = await world.playerA.db
        .from('assets')
        .insert({ campaign_id: world.campaignId, kind, name: `Player ${kind}`, visibility: 'all' })
        .select();
      expect(refused(made)).toBe(true);
    }
  });
});
