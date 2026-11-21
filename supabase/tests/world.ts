// A small invented test world in the TEST project: a GM, two players, an outsider,
// one campaign, two approved characters and a company. Built with the secret key
// (which skips the access rules), then each person gets their own signed-in client
// so the tests see exactly what that person would see.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adminClient, readTestProject, type TestProject } from './testProject.ts';

export const BUCKET = 'campaign-files';
export const MESSAGE_BUCKET = 'message-files';

export interface Person {
  id: string;
  email: string;
  db: SupabaseClient;
}

export interface World {
  project: TestProject;
  admin: SupabaseClient;
  gm: Person;
  playerA: Person;
  playerB: Person;
  outsider: Person;
  newcomer: Person;
  latecomer: Person;
  campaignId: string;
  otherCampaignId: string;
  wrenId: string; // Player A's approved character
  ashId: string; // Player B's approved character
  companyId: string;
}

const runId = Math.random().toString(36).slice(2, 8);
const password = `T-${crypto.randomUUID()}`;

async function createPerson(project: TestProject, admin: SupabaseClient, label: string): Promise<Person> {
  const email = `${label}-${runId}@grimoire.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient(project.url, project.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The test project limits sign-ins per few minutes; when a run hits it, wait and try again.
  for (let attempt = 1; ; attempt += 1) {
    const signedIn = await db.auth.signInWithPassword({ email, password });
    if (!signedIn.error) break;
    if (signedIn.error.status !== 429 || attempt >= 6) throw signedIn.error;
    await new Promise((resolve) => setTimeout(resolve, 15_000 * attempt));
  }
  return { id: created.data.user.id, email, db };
}

/** Throws with the database's message if a setup step fails. */
export function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error('setup step returned nothing');
  return result.data as NonNullable<T>;
}

export async function buildWorld(): Promise<World> {
  const project = readTestProject();
  const admin = adminClient(project);
  const people = await Promise.all(
    ['gm', 'player-a', 'player-b', 'outsider', 'newcomer', 'latecomer'].map((label) =>
      createPerson(project, admin, label),
    ),
  );
  try {
    return await buildCampaign(project, admin, people);
  } catch (error) {
    // Don't leave test users behind if setup fails partway.
    await Promise.all(people.map((person) => admin.auth.admin.deleteUser(person.id)));
    throw error;
  }
}

async function buildCampaign(project: TestProject, admin: SupabaseClient, people: Person[]): Promise<World> {
  const [gm, playerA, playerB, outsider, newcomer, latecomer] = people as [Person, Person, Person, Person, Person, Person];

  const campaign = must(
    await admin.from('campaigns').insert({ name: 'The Reedmouth Delve', created_by: gm.id }).select().single(),
  );
  // A second campaign run by the same GM, used to check nothing crosses between campaigns.
  const other = must(await admin.from('campaigns').insert({ name: 'The Ash Barrows', created_by: gm.id }).select().single());

  must(
    await admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: playerB.id, base_role: 'player' },
        { campaign_id: other.id, user_id: gm.id, base_role: 'gm' },
      ])
      .select(),
  );

  const company = must(
    await admin.from('companies').insert({ campaign_id: campaign.id, name: 'The Sluice Gate Company' }).select().single(),
  );

  const [wren, ash] = must(
    await admin
      .from('actors')
      .insert([
        {
          campaign_id: campaign.id,
          kind: 'pc',
          name: 'Wren of the Lantern Wardens',
          owner_type: 'user',
          owner_user_id: playerA.id,
          approval: 'approved',
          hp_current: 7,
          hp_max: 9,
        },
        {
          campaign_id: campaign.id,
          kind: 'pc',
          name: 'Ash the Reed Cutter',
          owner_type: 'user',
          owner_user_id: playerB.id,
          approval: 'approved',
          hp_current: 5,
          hp_max: 5,
        },
      ])
      .select(),
  );

  return {
    project,
    admin,
    gm,
    playerA,
    playerB,
    outsider,
    newcomer,
    latecomer,
    campaignId: campaign.id,
    otherCampaignId: other.id,
    wrenId: wren.id,
    ashId: ash.id,
    companyId: company.id,
  };
}

/** Removes everything this run created: campaigns (and all their rows and files), then the users. */
export async function tearDownWorld(world: World | undefined): Promise<void> {
  if (!world) return;
  const { admin } = world;
  const people = [world.gm, world.playerA, world.playerB, world.outsider, world.newcomer, world.latecomer];
  // The world's two campaigns, plus any campaign a test person created during the run.
  const made = await admin.from('campaigns').select('id').in('created_by', people.map((person) => person.id));
  const campaignIds = new Set([world.campaignId, world.otherCampaignId, ...(made.data ?? []).map((row) => row.id as string)]);
  for (const campaignId of campaignIds) {
    // Its files: portraits and the like, and messages' pictures (M5b g4), each in their bucket.
    for (const bucket of [BUCKET, MESSAGE_BUCKET]) {
      const files = await admin.storage.from(bucket).list(campaignId);
      const names = (files.data ?? []).map((file) => `${campaignId}/${file.name}`);
      if (names.length > 0) await admin.storage.from(bucket).remove(names);
    }
    await admin.from('campaigns').delete().eq('id', campaignId);
  }
  for (const person of people) {
    await admin.auth.admin.deleteUser(person.id);
  }
}
