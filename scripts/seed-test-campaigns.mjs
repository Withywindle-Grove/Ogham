// Builds the seeded test campaigns on the TEST project (docs/plans/test-seed-campaigns.md). Run with
// `npm run seed:test`; add `-- --reset` to remove the "Seed ·" campaigns first, or `-- --dry-run` to only print the plan.
// Characters are made through the app's own commands, signed in as a test GM and two test players.
// No pack content lives here: packs are read from packs/_current/ (or --packs <folder>) when it runs.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createAppRegistry } from '../src/app/commandRegistry.ts';
import { createCampaign, createInvite, redeemInvite, updateCampaign } from '../src/core/campaignCommands.ts';
import { DEFAULT_TIME, startingSettings } from '../src/core/campaignSettings.ts';
import { loadMethodOf } from '../src/app/loadMethod.ts';
import { campaignPresets } from '../src/modules/library/options.ts';
import { runCommand } from '../src/core/commands.ts';
import { loadCurrentUser } from '../src/core/currentUser.ts';
import { forgetCampaignSetting, loadCampaignSetting, choicesInPlay } from '../src/app/campaignSetting.ts';
import { applySheetLayout, loadFieldDefinitions } from '../src/modules/characters/fields.ts';
import { createCharacter, editCharacter, reviewCharacter, sendCharacter } from '../src/modules/characters/commands.ts';
import { isKitContainer } from '../src/modules/characters/kitPlaces.ts';
import { setSpellBook } from '../src/modules/characters/spellBook.ts';
import { carriedLoad, toLoadLine } from '../src/modules/inventory/encumbrance.ts';
import { addItem, loadInventory } from '../src/modules/inventory/inventory.ts';
import { attachPack } from '../src/modules/library/campaignPacks.ts';
import { importPack, loadLibrary, updatePack } from '../src/modules/library/library.ts';
import { readPackJson } from '../src/modules/library/packFile.ts';
import { layoutFields } from '../src/modules/library/sheetLayout.ts';
import { wearKit } from './seed-equip.mjs';
import { copyOf, placeLines, planExtras, resolveLines } from './seed-extras.mjs';
import { heaviestArmour, loadFill, loadPool, planEdgeCases } from './seed-edge.mjs';
import { fieldValuesFor, optionChoices, packIdOf as packMetaId, planFolder, SEED_PREFIX } from './seed-plan.mjs';

const MAIN_PROJECT_REF = 'nplkqwzjdprpgpklatji';

export const EDGE_SUFFIX = ' · edge cases';

export class SeedStop extends Error {}
const stop = (message) => {
  throw new SeedStop(message);
};

/** Stops unless every sign says the TEST project (same rule as db-push-test.mjs, plus the two settings must agree). */
export function checkTestProject(env) {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const secret = env.SUPABASE_SECRET_KEY?.trim() ?? '';
  const dbUrl = env.SUPABASE_TEST_DB_URL?.trim() ?? '';
  if (!url || !key || !secret || !dbUrl) stop('.env.test needs VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY and SUPABASE_TEST_DB_URL.');
  if ([url, dbUrl].some((v) => v.includes(MAIN_PROJECT_REF))) stop('A setting points at the main project. This only runs on the test project.');
  const hosted = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url);
  if (!hosted) stop('VITE_SUPABASE_URL should be just https://<ref>.supabase.co (the hosted test project). Nothing else is accepted.');
  if (!dbUrl.includes(hosted[1])) stop("SUPABASE_TEST_DB_URL isn't the same project as VITE_SUPABASE_URL. Stopping so nothing is guessed.");
  return { url: url.replace(/\/$/, ''), key, secret };
}

/** The three test accounts, from the local env file. */
export function readAccounts(env) {
  const who = (prefix) => ({ email: env[`${prefix}_EMAIL`]?.trim() ?? '', password: env[`${prefix}_PASSWORD`] ?? '' });
  const accounts = { gm: who('SEED_GM'), players: [who('SEED_PLAYER1'), who('SEED_PLAYER2')] };
  const missing = [['SEED_GM', accounts.gm], ['SEED_PLAYER1', accounts.players[0]], ['SEED_PLAYER2', accounts.players[1]]]
    .filter(([, a]) => !a.email || !a.password)
    .map(([name]) => name);
  if (missing.length > 0) stop(`.env.seed is missing ${missing.map((m) => `${m}_EMAIL / ${m}_PASSWORD`).join(', ')}.`);
  return accounts;
}

/** Packs from a folder, as the app reads them. Files that can't be read are reported, not guessed at. */
export function readPacks(folder) {
  let files;
  try {
    // A single pack file may be given instead of a folder.
    files = folder.endsWith('.json') ? [''] : readdirSync(folder).filter((f) => f.endsWith('.pack.json')).sort();
  } catch {
    stop(`Can't read the packs folder "${folder}". Run from the folder that has packs/_current/, or pass --packs <folder>.`);
  }
  const packs = [];
  const unreadable = [];
  for (const file of files) {
    const read = readPackJson(readFileSync(file ? join(folder, file) : folder, 'utf8'));
    if (read.ok) packs.push(read.pack);
    else unreadable.push(`${file}: ${read.message}`);
  }
  return { packs, unreadable };
}

/**
 * --reset: removes only campaigns whose names start with "Seed ·". A direct delete with the test project's service
 * key (the app has no "delete campaign" command; the plan allows this for test-only seed rows, and it is named here).
 */
export async function resetSeedCampaigns(admin, onlyEdgeCases = false) {
  const found = await admin.from('campaigns').select('id, name').like('name', `${SEED_PREFIX}%`);
  if (found.error) stop(`Couldn't list the seed campaigns: ${found.error.message}`);
  const removed = [];
  for (const campaign of found.data.filter((c) => c.name.startsWith(SEED_PREFIX) && (!onlyEdgeCases || c.name.endsWith(EDGE_SUFFIX)))) {
    const gone = await admin.from('campaigns').delete().eq('id', campaign.id);
    if (gone.error) stop(`Couldn't remove "${campaign.name}": ${gone.error.message}`);
    removed.push(campaign.name);
  }
  return removed;
}

async function signIn(url, key, account) {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let attempt = 1; ; attempt += 1) {
    const result = await db.auth.signInWithPassword(account);
    if (!result.error) return db;
    if (result.error.status !== 429 || attempt >= 6) stop(`Couldn't sign in as ${account.email}: ${result.error.message}. Make this account on the test project first.`);
    await new Promise((r) => setTimeout(r, 15_000 * attempt));
  }
}

/** The settings to seed from the packs read: each pack with classes, on top of the packs it needs. */
export const planAll = planFolder;

export function describePlan(plans) {
  const lines = [];
  for (const plan of plans) {
    if (plan.note && plan.campaigns.length > 0) lines.push(`${plan.packName}: ${plan.note}`);
    if (plan.campaigns.length === 0) lines.push(`${plan.packName}: skipped, ${plan.note}`);
    if (plan.campaigns.length > 0 && plan.overlays?.length > 0) lines.push(`${plan.packName}: with ${plan.overlays.map((p) => p.meta.name).join(', ')} attached on top (places)`);
    for (const campaign of plan.campaigns) {
      lines.push(`${campaign.name}: ${campaign.characters.length} characters`);
      for (const c of campaign.characters) lines.push(`  ${c.name}`);
      for (const s of campaign.skipped) lines.push(`  skipped ${s.className}: ${s.reason}`);
      for (const r of campaign.uncovered) lines.push(`  no character could be made for ${r}`);
    }
  }
  return lines;
}

/**
 * The first kit, first spells, first trait entries and languages for a draft, written with the app's own commands
 * (inventory.add, character.edit, creation.spellBook.set) as the draft's owner, like the guided steps. Anything it
 * can't do comes back as a note; the character is still made.
 */
export async function seedExtras({ registry, db, setting, fieldDefs, draft, character, baseFields }) {
  const user = await loadCurrentUser(db);
  const choices = choicesInPlay(setting);
  const plan = planExtras({ setting, choices, character, fieldDefs, baseFields });
  const notes = [...plan.notes];
  const done = { items: 0, spells: 0, fields: Object.keys(plan.fields).length };
  const carrier = { campaignId: draft.campaignId, actorId: draft.id, locationId: null, ownerUserId: user.id, archived: false };
  const record = { method: character.method, rolled: character.rolled, scores: character.scores, ...plan.record };
  const bought = [];
  const givenGear = [];
  const traitGear = {};
  const kitLineIds = [];
  let backpack = null;
  try {
    for (const group of plan.items) {
      const { entries, missing } = resolveLines(setting, group.lines);
      if (missing.length > 0) notes.push(`${group.label}: not in the setting: ${missing.join(', ')}`);
      const lines = [];
      for (const { entry, qty } of placeLines(entries)) {
        const box = isKitContainer(entry.data);
        const added = await runCommand(registry, db, user, addItem, {
          carrier,
          item: copyOf(entry),
          qty,
          howGot: group.howGot,
          ...(group.cost ? { cost: group.cost } : {}),
          containerLineId: box ? null : backpack,
          equipped: false,
        });
        if (!added.ok) throw new Error(`${entry.name}: ${added.message}`);
        if (box && backpack === null) backpack = added.value.id;
        lines.push({ id: added.value.id, qty });
        done.items += 1;
      }
      if (group.why === 'kit') {
        bought.push({ label: group.label, price: group.price, lines, kitId: group.kitId, picks: group.picks });
        kitLineIds.push(...lines.map((l) => l.id));
      }
      else if (group.why === 'shop') {
        // Bought in the shop within the starting money; recorded as a purchase, and put on like a kit's things.
        bought.push({ label: group.label, price: group.price, lines });
        kitLineIds.push(...lines.map((l) => l.id));
      } else if (group.why === 'given') givenGear.push(...lines);
      else traitGear[group.listId] = lines;
    }
    if (bought.length > 0) record.bought = bought;
    if (givenGear.length > 0) record.givenGear = givenGear;
    if (Object.keys(traitGear).length > 0) record.traitGear = traitGear;
    if (bought.length > 0 || givenGear.length > 0 || record.startingMoney !== undefined) record.gearDone = true;
    const edited = await runCommand(registry, db, user, editCharacter, { character: draft, changes: { fields: { ...baseFields, ...plan.fields }, creation: record } });
    if (!edited.ok) throw new Error(edited.message);
    if (plan.spellBook && plan.spellBook.length > 0) {
      const book = await runCommand(registry, db, user, setSpellBook, { character: draft, spellIds: plan.spellBook });
      if (!book.ok) throw new Error(`spell book: ${book.message}`);
      done.spells = plan.spellBook.length;
    }
    if (plan.weaponSkills && plan.weaponSkills.length > 0) {
      const skills = await runCommand(registry, db, user, editCharacter, { character: draft, changes: { weaponSkills: plan.weaponSkills } });
      if (!skills.ok) throw new Error(`weapon skills: ${skills.message}`);
      done.weaponSkills = plan.weaponSkills.length;
    }
    // Last, once the sheet and the pack are as they will be: wear the kit's armour and shield, hold its first weapon.
    if (kitLineIds.length > 0) {
      const put = await wearKit({ registry, db, user, setting, draft, carrier, lineIds: kitLineIds });
      done.worn = put.worn.length;
      for (const why of put.refused) notes.push(`not put on: ${why}`);
    }
  } catch (error) {
    notes.push(`stopped: ${error.message}`);
  }
  return { notes, done };
}

/**
 * Loads an edge-case character's pack to a weight (design note seed-edge-cases): the heaviest armour its class may wear,
 * then ordinary items until the load is over the rules set's limit by a little ('over') or exactly at it ('exact').
 * Written with the app's own inventory command; the figure is read back with the app's own load rules. Returns notes.
 */
export async function loadUp({ registry, db, setting, draft, carrier, character, user }) {
  const notes = [];
  const rules = setting.encumbrance;
  if (!rules.coin || rules.coin.maxLoadCoin === null) return [`load: the rules give no coin limit, so ${character.name} was not loaded`];
  const entryOf = (id) => setting.items.find((i) => i.packEntryId === id);
  const put = async (entry, qty) => {
    const added = await runCommand(registry, db, user, addItem, { carrier, item: copyOf(entry), qty, howGot: 'found', containerLineId: null, equipped: false });
    if (!added.ok) throw new Error(`${entry.name}: ${added.message}`);
  };
  const loadNow = async () => {
    const inventory = await loadInventory(db, draft.campaignId);
    if (!inventory) throw new Error("couldn't read the pack");
    return carriedLoad(inventory.lines.filter((l) => l.actorId === draft.id).map(toLoadLine), rules, 'coin');
  };
  try {
    const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === character.classId);
    const race = setting.all.find((e) => e.kind === 'race' && e.packEntryId === character.raceId) ?? null;
    const armour = klass ? heaviestArmour(setting.items, klass, race) : null;
    if (character.carry.heavyArmour && armour) await put(armour, 1);
    else if (character.carry.heavyArmour) notes.push(`load: no armour ${character.className} may wear was found`);
    const before = await loadNow();
    if (before.mode !== 'coin' || before.capacity === null) return [...notes, 'load: the limit could not be read'];
    const fill = loadFill({ base: before.load, limit: before.capacity, goal: character.carry.goal, pool: loadPool(setting.items, rules) });
    if (fill.reason) return [...notes, `load: ${fill.reason}`];
    for (const add of fill.adds) await put(entryOf(add.id), add.qty);
    const after = await loadNow();
    notes.push(`loaded to ${after.load} of ${after.capacity} (${character.carry.goal === 'exact' ? 'exactly at the limit' : 'over the limit'})`);
  } catch (error) {
    notes.push(`load stopped: ${error.message}`);
  }
  return notes;
}

export async function run({ argv, env, log = console.log }) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const folderAt = argv.indexOf('--packs');
  const folder = resolve(folderAt >= 0 ? (argv[folderAt + 1] ?? '') : 'packs/_current');
  const { packs, unreadable } = readPacks(folder);
  if (packs.length === 0) stop(`No packs found in ${folder}.`);
  const edgeAt = argv.flatMap((a, i) => (a === '--edge' ? [argv[i + 1]] : []));
  const allPlans = planAll(packs);
  // The edge-case campaign (design note seed-edge-cases): one extra campaign for each pack named with --edge, alone.
  const edgePlans = allPlans.flatMap((plan) => {
    if (plan.chain.length !== 1 || !edgeAt.includes(packMetaId(plan.chain[0]))) return [];
    const choices = optionChoices(plan.entries, 'defaults');
    const made = planEdgeCases(plan.entries, choices);
    const skipped = made.notes.map((n) => ({ className: 'edge case', reason: n }));
    return [{ ...plan, campaigns: [{ name: `${SEED_PREFIX}${plan.packName}${EDGE_SUFFIX}`, mode: 'edge cases', choices, characters: made.characters, skipped, uncovered: [], edge: true }] }];
  });
  if (edgeAt.length > 0 && edgePlans.length === 0) stop(`--edge ${edgeAt.join(', ')}: no single pack in the folder has that id.`);
  const plans = flags.has('--edge-only') ? edgePlans : [...allPlans, ...edgePlans];
  if (flags.has('--dry-run')) {
    for (const line of describePlan(plans)) log(line);
    for (const line of unreadable) log(`unreadable ${line}`);
    return { dryRun: true, plans };
  }

  const project = checkTestProject(env);
  const accounts = readAccounts(env);
  const registry = createAppRegistry();
  const admin = createClient(project.url, project.secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const gmDb = await signIn(project.url, project.key, accounts.gm);
  const playerDbs = [await signIn(project.url, project.key, accounts.players[0]), await signIn(project.url, project.key, accounts.players[1])];

  const summary = { reset: [], campaigns: [], problems: [...unreadable.map((u) => `unreadable ${u}`)] };
  if (flags.has('--reset')) {
    summary.reset = await resetSeedCampaigns(admin, flags.has('--edge-only'));
    log(`Removed ${summary.reset.length} seed campaign(s).`);
  }

  const as = async (db, command, input) => {
    const user = await loadCurrentUser(db);
    return runCommand(registry, db, user, command, input);
  };
  const need = async (db, command, input) => {
    const done = await as(db, command, input);
    if (!done.ok) throw new Error(done.message);
    return done.value;
  };

  const gmUser = await loadCurrentUser(gmDb);
  const library = (await loadLibrary(gmDb, gmUser.id)) ?? stop("Couldn't read the test GM's library.");
  // A pack used by several settings (a base under two overlays) is imported or updated once.
  const imported = new Map();
  const packIdOf = async (pack) => {
    if (!imported.has(pack)) {
      const existing = library.find((p) => p.name === pack.meta.name && p.kind === pack.meta.kind);
      imported.set(pack, existing ? await need(gmDb, updatePack, { packId: existing.id, ownerUserId: gmUser.id, pack }) : await need(gmDb, importPack, { pack }));
    }
    return imported.get(pack);
  };
  for (const plan of plans) {
    if (plan.campaigns.length === 0) {
      summary.problems.push(`${plan.packName}: ${plan.note}`);
      continue;
    }
    if (plan.note) summary.problems.push(`${plan.packName}: ${plan.note}`);
    const packIds = [];
    for (const pack of plan.chain) packIds.push(await packIdOf(pack));
    for (const planned of plan.campaigns) {
      const made = { name: planned.name, characters: [], info: [], skipped: [...planned.skipped.map((s) => `${s.className}: ${s.reason}`), ...planned.uncovered.map((r) => `${r}: no character possible`)] };
      summary.campaigns.push(made);
      try {
        const campaignId = await need(gmDb, createCampaign, { name: planned.name });
        // The base first, then each overlay on top of it; each pack is given the choices for its own options.
        const packChoices = plan.chain.map((pack) => {
          const own = new Set(pack.entries.filter((e) => e.kind === 'option').map((e) => e.packEntryId));
          return { entries: pack.entries, choices: Object.fromEntries(Object.entries(planned.choices).filter(([id]) => own.has(id))) };
        });
        for (const [at] of plan.chain.entries()) await need(gmDb, attachPack, { campaignId, packId: packIds[at], optionChoices: packChoices[at].choices });
        // The place packs that sit on it (a region pack), on top, with their own defaults (M8b slice 0).
        for (const overlay of plan.overlays ?? []) await need(gmDb, attachPack, { campaignId, packId: await packIdOf(overlay) });
        // The load method and the time lengths as New campaign sets them (loadMethod.ts): the packs' rules under these choices.
        const presets = campaignPresets(packChoices);
        await need(gmDb, updateCampaign, { campaignId, settings: startingSettings({ encumbranceMode: loadMethodOf(packChoices), time: { ...DEFAULT_TIME, ...presets.time } }) });
        const layout = layoutFields(plan.entries);
        if (layout.length > 0) await need(gmDb, applySheetLayout, { campaignId, fields: layout });
        for (const db of playerDbs) {
          const invite = await need(gmDb, createInvite, { campaignId });
          await need(db, redeemInvite, { code: invite.code });
        }
        // What each player's screens read: the campaign's setting and fields (loaded as that player, like the app does).
        // One after the other: the app keeps a loaded setting per campaign, so each must be forgotten before the next load.
        const seen = [];
        for (const db of playerDbs) {
          const user = await loadCurrentUser(db);
          forgetCampaignSetting(campaignId);
          seen.push({ setting: await loadCampaignSetting(db, user.id, campaignId), fieldDefs: await loadFieldDefinitions(db, campaignId) });
        }
        for (const [index, c] of planned.characters.entries()) {
          const owner = playerDbs[planned.edge ? 0 : index % 2];
          try {
            const { values } = fieldValuesFor(plan.entries, c);
            const draft = await need(owner, createCharacter, {
              campaignId,
              kind: 'pc',
              name: c.name,
              level: c.level ?? 1,
              ...(c.hpMax ? { hpMax: c.hpMax } : {}),
              fields: values,
              classRef: c.classId,
              raceRef: c.raceId,
              creation: { method: c.method, rolled: c.rolled, scores: c.scores },
              editedFields: [],
              draft: true,
            });
            const mine = seen[planned.edge ? 0 : index % 2];
            const extras = c.carry === 'nothing'
              ? { notes: [], done: {} }
              : mine.setting
              ? await seedExtras({ registry, db: owner, setting: mine.setting, fieldDefs: mine.fieldDefs ?? [], draft, character: c, baseFields: values })
              : { notes: ["the campaign's setting couldn't be read, so no kit, spells, traits or languages"], done: {} };
            if (typeof c.carry === 'object' && mine.setting) {
              const ownerUser = await loadCurrentUser(owner);
              const carrier = { campaignId, actorId: draft.id, locationId: null, ownerUserId: ownerUser.id, archived: false };
              extras.notes.push(...(await loadUp({ registry, db: owner, setting: mine.setting, draft, carrier, character: c, user: ownerUser })));
            }
            for (const note of extras.notes) (note.startsWith('loaded to ') ? made.info : made.skipped).push(`${c.name}: ${note}`);
            const sent = await need(owner, sendCharacter, { character: draft });
            if (sent.approval !== 'approved') await need(gmDb, reviewCharacter, { character: sent, decision: 'approved' });
            // XP has no command yet (awards come with M7): the test project's own row is set with the service key, like reset.
            if (c.xp > 0) {
              const set = await admin.from('actors').update({ classes: [{ classRef: c.classId, level: c.level ?? 1, xp: c.xp }] }).eq('id', draft.id);
              if (set.error) made.skipped.push(`${c.name}: XP not set: ${set.error.message}`);
            }
            made.characters.push({ ...c, extras: extras.done });
          } catch (error) {
            made.skipped.push(`${c.name}: ${error.message}`);
          }
        }
      } catch (error) {
        made.skipped.push(`campaign stopped: ${error.message}`);
      }
    }
  }
  printSummary(summary, log);
  return summary;
}

export function printSummary(summary, log = console.log) {
  log('');
  log('Seed summary');
  if (summary.reset.length > 0) log(`  Removed first: ${summary.reset.join('; ')}`);
  for (const campaign of summary.campaigns) {
    const byClass = new Map();
    const byRace = new Map();
    for (const c of campaign.characters) {
      byClass.set(c.className, (byClass.get(c.className) ?? 0) + 1);
      byRace.set(c.raceName ?? '(no kindred or race)', (byRace.get(c.raceName ?? '(no kindred or race)') ?? 0) + 1);
    }
    log(`  ${campaign.name}: ${campaign.characters.length} characters`);
    log(`    classes: ${[...byClass].map(([k, n]) => `${k} ×${n}`).join(', ') || 'none'}`);
    log(`    kindreds or races: ${[...byRace].map(([k, n]) => `${k} ×${n}`).join(', ') || 'none'}`);
    const total = (key) => campaign.characters.reduce((n, c) => n + (c.extras?.[key] ?? 0), 0);
    log(`    added: ${total('items')} pack lines (kits, given gear, trait gear), ${total('worn')} worn or held, ${total('spells')} spells in books, ${total('weaponSkills')} weapon skills, ${total('fields')} trait and language values`);
    for (const i of campaign.info ?? []) log(`    ${i}`);
    for (const s of campaign.skipped) log(`    left out: ${s}`);
  }
  for (const p of summary.problems) log(`  note: ${p}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = { ...process.env };
  const load = (file, required) => {
    try {
      process.loadEnvFile(file);
    } catch {
      if (required) {
        console.error(`seed:test stopped: ${file} not found (see docs/testing.md, Seeded test campaigns).`);
        process.exit(1);
      }
    }
  };
  if (!process.argv.includes('--dry-run')) {
    load('.env.test', true);
    load('.env.seed', true);
  }
  run({ argv: process.argv.slice(2), env: { ...env, ...process.env } }).catch((error) => {
    console.error(`seed:test stopped: ${error instanceof SeedStop ? error.message : (error.stack ?? error)}`);
    process.exit(1);
  });
}
