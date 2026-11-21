// Tests for the seeded test campaigns (scripts/seed-test-campaigns.mjs, docs/plans/test-seed-campaigns.md).
// Invented content only: the fixture pack is scripts/fixtures/m5b-creation.fixture.json. No network.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readPackJson } from '../src/modules/library/packFile.ts';
import { findNames } from './check-names.mjs';
import { checkTestProject, resetSeedCampaigns, run, SeedStop } from './seed-test-campaigns.mjs';
import { planPack, SEED_PREFIX, typicalHitPoints, typicalRoll } from './seed-plan.mjs';

const here = (file) => resolve(fileURLToPath(new URL('.', import.meta.url)), file);
const fixture = here('fixtures/m5b-creation.fixture.json');
const fixturePack = () => {
  const read = readPackJson(readFileSync(fixture, 'utf8'));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

const testEnv = {
  VITE_SUPABASE_URL: 'https://inventedtestref.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_invented',
  SUPABASE_SECRET_KEY: 'sb_secret_invented',
  SUPABASE_TEST_DB_URL: 'postgresql://postgres.inventedtestref:pw@host:5432/postgres',
};

describe('the test-project guard', () => {
  // Purpose: the script stops when pointed at anything but the test project.
  it('accepts a test project whose two settings agree', () => {
    expect(checkTestProject(testEnv).url).toBe('https://inventedtestref.supabase.co');
  });

  it('stops when the address is the main project, in either setting', () => {
    const main = 'nplkqwzjdprpgpklatji';
    expect(() => checkTestProject({ ...testEnv, VITE_SUPABASE_URL: `https://${main}.supabase.co` })).toThrow(SeedStop);
    expect(() => checkTestProject({ ...testEnv, SUPABASE_TEST_DB_URL: `postgresql://postgres.${main}:pw@host/postgres` })).toThrow(/main project/);
  });

  it('stops when the database address is another project than the API address, or a setting is missing', () => {
    expect(() => checkTestProject({ ...testEnv, SUPABASE_TEST_DB_URL: 'postgresql://postgres.otherref:pw@host/postgres' })).toThrow(/same project/);
    expect(() => checkTestProject({ ...testEnv, SUPABASE_SECRET_KEY: '' })).toThrow(SeedStop);
  });

  it('stops before signing in or changing anything when the address is not a hosted project', async () => {
    const env = { ...testEnv, VITE_SUPABASE_URL: 'https://example.com/path' };
    await expect(run({ argv: ['--packs', fixture], env, log: () => {} })).rejects.toThrow(SeedStop);
  });
});

describe('the dry run on the invented fixture pack', () => {
  // Purpose: with the fixture pack, a dry run plans one character per class and covers every race.
  const plan = planPack(fixturePack());
  const classNames = fixturePack().entries.filter((e) => e.kind === 'class').map((e) => e.name);
  const raceNames = fixturePack().entries.filter((e) => e.kind === 'race').map((e) => e.name);

  it('makes a defaults and an options-on campaign, named with the Seed prefix and the pack name', () => {
    expect(plan.campaigns.map((c) => c.name)).toEqual([`${SEED_PREFIX}Invented creation sample · defaults`, `${SEED_PREFIX}Invented creation sample · options on`]);
  });

  it('plans one character per class that is in play, and every kindred or race at least once', () => {
    for (const campaign of plan.campaigns) {
      const perClass = campaign.characters.map((c) => c.className);
      expect(perClass.length).toBeGreaterThanOrEqual(new Set(perClass).size); // extras for coverage may repeat a class
      for (const klass of perClass) expect(classNames).toContain(klass);
      expect(campaign.skipped).toEqual([]);
      expect(campaign.uncovered).toEqual([]);
      for (const race of raceNames) expect(campaign.characters.some((c) => c.raceName === race)).toBe(true);
    }
    const defaults = plan.campaigns[0].characters.map((c) => c.className);
    expect(classNames.filter((n) => !defaults.includes(n))).toHaveLength(1); // the class an option leaves out by default
    const optionsOn = plan.campaigns[1].characters.map((c) => c.className);
    for (const name of classNames) expect(optionsOn).toContain(name);
  });

  it('gives each character fixed typical values that meet the class and the kindred', () => {
    for (const c of plan.campaigns[1].characters) {
      const die = fixturePack().entries.find((e) => e.kind === 'class' && e.packEntryId === c.classId).data.hitDie;
      expect(c.hpMax).toBe(typicalHitPoints(die)); // the die's average, rounded down
      for (const score of Object.values(c.scores)) expect(Number.isInteger(score)).toBe(true);
    }
    expect(typicalRoll('2d8')).toBe(9);
    expect(typicalRoll('3d6')).toBe(10);
    expect(typicalHitPoints('d8')).toBe(4);
    expect(typicalHitPoints('2d6')).toBe(7);
  });

  it('prints the plan from the command line without touching the network or the env files', async () => {
    const lines = [];
    const done = await run({ argv: ['--dry-run', '--packs', fixture], env: {}, log: (l) => lines.push(l) });
    expect(done.dryRun).toBe(true);
    expect(lines.join('\n')).toContain('Bog folk');
  });
});

describe('--reset', () => {
  // Purpose: --reset removes only campaigns whose names start with "Seed ·", and nothing else.
  it('deletes the seed campaigns by id and leaves every other campaign alone', async () => {
    const rows = [
      { id: 'a', name: `${SEED_PREFIX}Invented creation sample · defaults` },
      { id: 'b', name: 'The Reedmouth Delve' },
      { id: 'c', name: 'Seed without the dot' },
      { id: 'd', name: `${SEED_PREFIX}Invented creation sample · options on` },
    ];
    const deleted = [];
    const admin = {
      from: (table) => ({
        select: () => ({ like: async (_column, pattern) => ({ data: rows.filter((r) => r.name.startsWith(pattern.replace('%', ''))), error: null }) }),
        delete: () => ({
          eq: async (column, value) => {
            deleted.push({ table, column, value });
            return { error: null };
          },
        }),
      }),
    };
    const removed = await resetSeedCampaigns(admin);
    expect(deleted).toEqual([
      { table: 'campaigns', column: 'id', value: 'a' },
      { table: 'campaigns', column: 'id', value: 'd' },
    ]);
    expect(removed).toHaveLength(2);
  });

  it('even if the database hands back a non-seed row, it is not deleted', async () => {
    const deleted = [];
    const admin = {
      from: () => ({
        select: () => ({ like: async () => ({ data: [{ id: 'x', name: 'The Ash Barrows' }], error: null }) }),
        delete: () => ({ eq: async (_c, value) => (deleted.push(value), { error: null }) }),
      }),
    };
    expect(await resetSeedCampaigns(admin)).toEqual([]);
    expect(deleted).toEqual([]);
  });
});

describe('no real pack content in the script or its tests', () => {
  // Purpose: nothing from a real pack appears in the script, the plan or these tests. The private list of real
  // names (packs/_design/denylist.txt) is only on Francis's PC, so this test uses it when it is there; the
  // check-names hook runs the same scan on every commit.
  const files = ['seed-test-campaigns.mjs', 'seed-plan.mjs', 'seed-test-campaigns.test.mjs', 'seed-edge.mjs', 'seed-edge.test.mjs'];
  it('finds none of the names on the private list, when the list is present', () => {
    let names = [];
    try {
      names = readFileSync(here('../packs/_design/denylist.txt'), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
    } catch {
      return; // no private list here (CI, a fresh copy): the commit hook does the scan where the list lives
    }
    for (const file of files) expect(findNames(readFileSync(here(file), 'utf8'), names), file).toEqual([]);
  });

  it('keeps pack words out of the plan: the invented fixture is the only content the tests read', () => {
    for (const file of files) expect(readFileSync(here(file), 'utf8')).not.toMatch(/packs\/_current\/[A-Za-z]/);
  });
});
