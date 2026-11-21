// The M3 health fixes (docs/health/M3.md, items 1, 4 and 8). TEST project only; invented content.
//   1. The database's list of logged commands is a table, and it matches the app's commands: names,
//      log levels, and GM-only ones the app lets only the GM run.
//   4 and 8. Every kind of entry is hidden from players or shown to them exactly as the app's PLAYER_FACING
//      says: reading entries, the campaign log, and the lines a pack update writes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, startHomebrew } from '../../src/modules/library/campaignPacks.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
import { PACK_PARTS, PLAYER_FACING, readPackJson, type EntryKind } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
const KINDS = Object.values(PACK_PARTS) as EntryKind[];
const shown = (kinds: string[]) => kinds.filter((kind) => PLAYER_FACING.includes(kind as EntryKind)).sort();
const hidden = (kinds: string[]) => kinds.filter((kind) => !PLAYER_FACING.includes(kind as EntryKind)).sort();

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

// One entry of every kind, each named after its kind ("Bog lurker statBlock"), so a list of names says which kinds.
function everyKind(version: string, suffix = '') {
  const file: Record<string, unknown> = { format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Every Kind', version } };
  // A patch is player-facing only when the kind its match names is (review of 2026-11-04): this one is on an item.
  // A map is read only with its type, file and alt, and is named by its title (dec-7 5m-1).
  for (const [part, kind] of Object.entries(PACK_PARTS)) file[part] = [{ id: `one-${kind.toLowerCase()}`, name: `${kind}${suffix}`, ...(kind === 'patch' ? { match: { kind: 'item' } } : {}), ...(kind === 'map' ? { type: 'map', file: 'one.webp', alt: 'A plan of one room', title: `${kind}${suffix}` } : {}) }];
  const read = readPackJson(JSON.stringify(file));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

describe('1. the logged commands are a table that matches the app', () => {
  it('every app command that logs is in it at the same level; the others ("none") are not', async () => {
    const rows = must(await world.playerA.db.from('logged_commands').select('name, level, gm_only'));
    const inDatabase = new Map(rows.map((row) => [row.name as string, row.level as string]));
    for (const name of registry.names()) {
      const level = registry.logLevel(name);
      expect([name, inDatabase.get(name)]).toEqual([name, level === 'none' ? undefined : level]);
    }
    // Lines the database writes itself, with no command on any device: the tier line (M5 step 4), and a light burning
    // out as the clock moves (M5 step 7), and a status timer ending and a rest taken with the clock's move (M5 step 9).
    const writtenByTheDatabase = ['load.tier', 'light.burnOut', 'status.timerEnd', 'rest.taken', 'rest.applied'];
    expect([...inDatabase.keys()].filter((name) => !registry.has(name) && !writtenByTheDatabase.includes(name))).toEqual([]);
  });

  it("a GM-only command is one the app doesn't let a player run", async () => {
    const rows = must(await world.playerA.db.from('logged_commands').select('name').eq('gm_only', true));
    expect(rows.length).toBeGreaterThan(10);
    const player = await userOf(world.playerA);
    // A target that fits every command (restoring needs an archived character).
    const target = { campaignId: world.campaignId, archived: true };
    for (const { name } of rows) {
      expect([name, Boolean(registry.can(player, name as string, target))]).toEqual([name, false]);
    }
  });

  it('nobody can change the list', async () => {
    await world.gm.db.from('logged_commands').insert({ name: 'chest.open', level: 'simple', gm_only: false });
    await world.gm.db.from('logged_commands').update({ gm_only: false }).eq('name', 'rules.attach');
    expect(must(await world.admin.from('logged_commands').select('name').eq('name', 'chest.open'))).toEqual([]);
    expect(must(await world.admin.from('logged_commands').select('gm_only').eq('name', 'rules.attach'))).toEqual([{ gm_only: true }]);
  });
});

describe('4 and 8. every kind is shown to players or hidden, as PLAYER_FACING says', () => {
  let packId = '';

  beforeAll(async () => {
    const made = await as(world.gm, importPack, { pack: everyKind('1') });
    if (!made.ok) throw new Error(made.message);
    packId = made.value;
    const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    if (!attached.ok) throw new Error(attached.message);
  });

  it('reading entries: players get only the player-facing kinds; the GM gets all of them', async () => {
    const kinds = async (person: Person) =>
      must(await person.db.from('library_entries').select('kind').eq('pack_id', packId)).map((row) => row.kind as string).sort();
    expect(await kinds(world.playerA)).toEqual(shown(KINDS));
    expect(await kinds(world.gm)).toEqual([...KINDS].sort());
  });

  it("the log: a homebrew entry of a GM-only kind is logged for the GM only", async () => {
    const home = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve' });
    if (!home.ok) throw new Error(home.message);
    const rows = KINDS.map((kind) => ({ pack_id: home.value, kind, pack_entry_id: `own-${kind.toLowerCase()}`, name: `Own ${kind}`, data: kind === 'patch' ? { match: { kind: 'item' } } : {} }));
    const made = must(await world.gm.db.from('library_entries').insert(rows).select('id, kind'));
    const ids = made.map((row) => row.id as string);
    const logged = async (person: Person) =>
      must(await person.db.from('events').select('target_id').eq('target_table', 'library_entries').in('target_id', ids))
        .map((event) => made.find((row) => row.id === event.target_id)!.kind as string)
        .sort();
    expect(await logged(world.playerA)).toEqual(shown(KINDS));
    expect(await logged(world.gm)).toEqual([...KINDS].sort());
  });

  it("a pack update's lines: players' line names only player-facing kinds, the GM's line the rest", async () => {
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: everyKind('2', ' (new)') })).toMatchObject({ ok: true });
    const lines = must(await world.gm.db.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    const changed = (audience: string) => ((lines.find((line) => line.audience === audience)?.after as { changed?: string[] })?.changed ?? []).map((name) => name.replace(' (new)', '')).sort();
    expect(changed('all')).toEqual(shown(KINDS));
    expect(changed('gm')).toEqual(hidden(KINDS));
  });
});
