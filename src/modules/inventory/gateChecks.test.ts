// The M4 gate's hand-worked load checks, run through the real engine (docs/testing.md, M4 gate). The checks
// and the packs they use are private: each packs/<your-pack>/gate-checks.json names its pack file, the optional
// rules chosen, the items carried and the numbers worked out by hand. They are never committed (hard rule 2), so
// on a machine without them (GitHub's) this test is skipped; this file holds no game content of its own.
import { describe, expect, it } from 'vitest';
import type { EncumbranceMode } from '../../core/campaignSettings.ts';
import { readPackJson } from '../library/packFile.ts';
import { resolveRules } from '../library/options.ts';
import { carriedLoad, combineEncumbrance, toLoadLine } from './encumbrance.ts';

interface GateCheck {
  name: string;
  mode: EncumbranceMode;
  choices?: Record<string, string>;
  items: { id: string; qty?: number; equipped?: boolean }[];
  expect: { load?: number; capacity?: number; tier?: string; effect?: string; movement?: string; carriesTreasure?: boolean };
}

const files = import.meta.glob<string>('../../../packs/*/*.json', { query: '?raw', import: 'default', eager: true });
const checkFiles = Object.entries(files).filter(([path]) => path.endsWith('/gate-checks.json'));

describe.skipIf(checkFiles.length === 0)('the M4 gate: hand-worked loads in every mode (private packs)', () => {
  for (const [path, raw] of checkFiles) {
    const { pack: packFile, checks } = JSON.parse(raw) as { pack: string; checks: GateCheck[] };
    const packRaw = files[path.replace(/gate-checks\.json$/, packFile)];
    const read = packRaw ? readPackJson(packRaw) : null;

    for (const check of checks) {
      it(check.name, () => {
        if (!read?.ok) throw new Error(`Couldn't read ${packFile} beside ${path}.`);
        const rulesSets = read.pack.entries.filter((e) => e.kind === 'rulesSet');
        const rules = combineEncumbrance(rulesSets.map((e) => resolveRules(e.data, check.choices ?? {}).encumbrance));
        const lines = check.items.map((carried, index) => {
          const entry = read.pack.entries.find((e) => e.kind === 'item' && e.packEntryId === carried.id);
          if (!entry) throw new Error(`No item "${carried.id}" in ${packFile}.`);
          const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) ? value : null);
          return toLoadLine({
            id: `line-${index}`,
            name: entry.name,
            category: typeof entry.data.category === 'string' ? entry.data.category : '',
            qty: carried.qty ?? 1,
            weightCoin: whole(entry.data.weightCoin),
            slots: whole(entry.data.slots),
            stack: whole(entry.data.stack) ?? 1,
            containerLineId: null,
            equipped: carried.equipped ?? false,
            details: entry.data,
          });
        });
        const load = carriedLoad(lines, rules, check.mode);
        const seen: Record<string, unknown> = {};
        if ('load' in load) seen.load = load.load;
        if ('capacity' in load) seen.capacity = load.capacity;
        if ('tier' in load) {
          seen.tier = load.tier?.label;
          seen.effect = load.tier?.effect;
        }
        if (load.mode === 'armour') {
          seen.movement = load.movement;
          seen.carriesTreasure = load.carriesTreasure;
        }
        expect(Object.fromEntries(Object.keys(check.expect).map((key) => [key, seen[key]]))).toEqual(check.expect);
      });
    }
  }
});
