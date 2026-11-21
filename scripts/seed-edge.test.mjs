// Tests for the edge-case seeded campaign (scripts/seed-edge.mjs, design note seed-edge-cases-2026-11-05).
// Invented content only: the fixture pack is scripts/fixtures/m5b-creation.fixture.json. No network.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readPackJson } from '../src/modules/library/packFile.ts';
import { heaviestArmour, loadFill, loadLimit, loadPool, planEdgeCases, xpFor } from './seed-edge.mjs';
import { contextOf, optionChoices } from './seed-plan.mjs';
import { resetSeedCampaigns } from './seed-test-campaigns.mjs';

const here = (file) => resolve(fileURLToPath(new URL('.', import.meta.url)), file);
const entriesOfFixture = () => {
  const read = readPackJson(readFileSync(here('fixtures/m5b-creation.fixture.json'), 'utf8'));
  if (!read.ok) throw new Error(read.message);
  return read.pack.entries;
};
const plan = (entries) => planEdgeCases(entries, optionChoices(entries, 'defaults'));
const letters = (made) => made.characters.map((c) => c.letter);

describe('filling a pack to a load', () => {
  // Purpose: the items added take a character exactly to the limit, or just past it by no more than a tenth.
  const pool = [
    { id: 'anvil', weight: 50 },
    { id: 'pebble', weight: 3 },
  ];

  it('reaches the limit exactly, with heavy items first and a light one to make up the rest', () => {
    const found = loadFill({ base: 120, limit: 1000, goal: 'exact', pool });
    expect(found.total).toBe(1000);
    const weight = found.adds.reduce((sum, a) => sum + a.qty * pool.find((p) => p.id === a.id).weight, 0);
    expect(120 + weight).toBe(1000);
    expect(found.adds[0].id).toBe('anvil');
  });

  it('goes over the limit by at least 1 and no more than a tenth of it', () => {
    const found = loadFill({ base: 0, limit: 1000, goal: 'over', pool });
    expect(found.total).toBeGreaterThan(1000);
    expect(found.total).toBeLessThanOrEqual(1100);
  });

  it('says why when it is already past what it would reach, or has nothing to load with', () => {
    expect(loadFill({ base: 1200, limit: 1000, goal: 'over', pool }).reason).toMatch(/already carries/);
    expect(loadFill({ base: 0, limit: 1000, goal: 'exact', pool: [] }).reason).toMatch(/no ordinary item/);
    expect(loadFill({ base: 0, limit: 1000, goal: 'exact', pool: [{ id: 'weightless', weight: 0 }] }).reason).toMatch(/no ordinary item/);
  });

  it('says why when no whole number of items lands on the limit', () => {
    expect(loadFill({ base: 1, limit: 100, goal: 'exact', pool: [{ id: 'block', weight: 10 }] }).reason).toMatch(/no whole number/);
  });
});

describe('what counts as an ordinary item and the heaviest armour', () => {
  // Purpose: the load is made of plain things a shop sells, not bags, armour, bundles or things marked as treasure.
  const entries = entriesOfFixture();
  const items = entries.filter((e) => e.kind === 'item');
  const encumbrance = { separateCategories: [] };

  it('leaves out armour and bundles from the things used to load a character', () => {
    const names = loadPool(items, encumbrance).map((p) => p.name);
    expect(names).not.toContain('Waxed coat');
    expect(names.length).toBeGreaterThan(0);
    const bundle = { kind: 'item', packEntryId: 'x', name: 'Arrow bundle', data: { weightCoin: 5, bundle: 20, category: 'goods' } };
    expect(loadPool([bundle], encumbrance)).toEqual([]);
    const stolen = { kind: 'item', packEntryId: 'y', name: 'Lost lamp', data: { weightCoin: 5, category: 'vehicles' } };
    expect(loadPool([stolen], { separateCategories: ['vehicles'] })).toEqual([]);
  });

  it('finds the heaviest armour a class may wear, and none for a class that may wear none', () => {
    const wardens = entries.find((e) => e.kind === 'class' && e.name === 'Lantern Warden');
    const heaviest = heaviestArmour(items, { packEntryId: wardens.packEntryId, name: wardens.name, data: wardens.data }, null);
    const worn = items.filter((e) => e.data.slot === 'armour').map((e) => e.data.weightCoin);
    expect(heaviest?.data.weightCoin).toBeLessThanOrEqual(Math.max(...worn));
    expect(heaviestArmour([], { packEntryId: wardens.packEntryId, name: wardens.name, data: wardens.data }, null)).toBeNull();
  });

  it('reads the limit and an XP threshold from the pack, and nothing when there is none', () => {
    expect(loadLimit({ coin: { maxLoadCoin: 1200 } })).toBe(1200);
    expect(loadLimit({ coin: { maxLoadCoin: null } })).toBeNull();
    expect(loadLimit(null)).toBeNull();
    const klass = { data: { xpTableId: 'table-a' } };
    expect(xpFor([{ kind: 'xpTable', packEntryId: 'table-a', data: { levels: [{ level: 2, xp: 100 }] } }], klass, 2)).toBe(100);
    expect(xpFor([], klass, 2)).toBeNull();
  });
});

describe('the eight edge-case characters on the invented pack', () => {
  // Purpose: with a pack that can give every row, all eight characters are planned with the design note's values; a row the pack can't give is left out and said in words.
  const open = () => [
    ...entriesOfFixture().map((e) => {
      // So the uneven scores are allowed: no minimum scores on classes or kindreds.
      if (e.kind === 'class' || e.kind === 'race') return { ...e, data: { ...e.data, requirements: {} } };
      return e;
    }),
    // The fixture has no XP tables: an invented one for the caster classes (levels 5 and 6 at 1,000 and 3,001).
    { kind: 'xpTable', packEntryId: 'witch-xp', name: 'witch-xp', data: { id: 'witch-xp', levels: [{ level: 5, xp: 1000 }, { level: 6, xp: 3001 }] } },
  ];

  it('plans A to H with the names from the design note, the 40-character name included', () => {
    const made = plan(open());
    expect(letters(made).filter((l) => l !== 'A')).toEqual(['B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(made.characters.find((c) => c.letter === 'B').name).toHaveLength(40);
  });

  it('gives A the uneven scores in the pack order, and C a level 5 at half-way between the thresholds, rounded down', () => {
    const made = plan(open());
    const c = made.characters.find((x) => x.letter === 'C');
    expect(c.level).toBe(5);
    expect(c.xp).toBe(2000);
    const a = made.characters.find((x) => x.letter === 'A');
    if (a) expect(Object.values(a.rolled)).toEqual([17, 5, 13, 9, 10, 8].slice(0, Object.keys(a.rolled).length));
  });

  it('puts E over the limit and F exactly at it, in different kindreds, G with nothing and 1 hit point, H at the last level with 999999 XP', () => {
    const made = plan(open());
    const get = (letter) => made.characters.find((c) => c.letter === letter);
    expect(get('E').carry).toEqual({ heavyArmour: true, goal: 'over' });
    expect(get('F').carry).toEqual({ heavyArmour: true, goal: 'exact' });
    expect(get('E').raceId).not.toBe(get('F').raceId);
    expect(get('G').carry).toBe('nothing');
    expect(get('G').hpMax).toBe(1);
    const lastLevel = entriesOfFixture().find((e) => e.kind === 'class' && e.packEntryId === get('H').classId).data.maxLevel;
    expect(get('H').level).toBe(lastLevel);
    expect(get('H').xp).toBe(999999);
  });

  it('gives D the kindred and class whose traits add up to the most of every pair that can be placed', () => {
    const entries = open();
    const d = plan(entries).characters.find((c) => c.letter === 'D');
    const context = contextOf(entries, optionChoices(entries, 'defaults'));
    const count = (entry) => (Array.isArray(entry.data.abilities) ? entry.data.abilities.length : 0);
    const method = context.methods[0] ?? null;
    const totals = context.classes.flatMap((klass) => context.races.filter((race) => !context.attempt(klass, method, race).reason).map((race) => count(klass) + count(race)));
    const mine = count(context.classes.find((k) => k.packEntryId === d.classId)) + count(context.races.find((r) => r.packEntryId === d.raceId));
    expect(mine).toBe(Math.max(...totals));
  });

  it('leaves a row out and says why in words when the pack cannot give it (A and C on the unaltered pack)', () => {
    const made = plan(entriesOfFixture());
    expect(letters(made)).not.toContain('C');
    expect(made.notes.some((n) => n.startsWith('C:'))).toBe(true);
    expect(made.notes.some((n) => /human/.test(n))).toBe(true);
  });
});

describe('resetting only the edge cases', () => {
  // Purpose: with --edge-only a reset removes the edge-case campaigns and none of the fourteen the gate run uses.
  it('deletes only seed campaigns whose name ends with the edge-case words', async () => {
    const deleted = [];
    const admin = {
      from: () => ({
        select: () => ({
          like: async () => ({
            data: [
              { id: 'a', name: 'Seed · One pack · defaults' },
              { id: 'b', name: 'Seed · One pack · edge cases' },
            ],
            error: null,
          }),
        }),
        delete: () => ({ eq: async (_c, value) => (deleted.push(value), { error: null }) }),
      }),
    };
    expect(await resetSeedCampaigns(admin, true)).toEqual(['Seed · One pack · edge cases']);
    expect(deleted).toEqual(['b']);
  });
});
