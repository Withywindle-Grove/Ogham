// The M4b gate's automated check (docs/08, M4b): every class in each private setting pack makes a legal 1st-level
// character through guided creation's own rules (creation.ts, fills.ts). The packs are private and never committed
// (hard rule 2), so on a machine without them (GitHub's) this test is skipped; this file holds no game content.
//   For each class: a creation method that offers it; a race the method allows (or none) that allows the class;
//   scores that meet the race's and class's requirements; then the class is offered (not greyed), and the setting's
//   fills give it values at level 1 (its hit dice, and saves when its progression has them).
import { describe, expect, it } from 'vitest';
import { fillsAtCreation } from '../library/fills.ts';
import { readPackJson, type PackEntry } from '../library/packFile.ts';
import { resolveRules } from '../library/options.ts';
import { newestPerPack } from '../../testing/realPacks.ts';
import { primeXpBonus } from './creationSteps.ts';
import { abilityKeys, classesFor, creationMethods, defaultRace, methodsToPick, raceStep, withRace, type CreationMethod } from './creation.ts';

const files = import.meta.glob<string>('../../../packs/*/*.pack.json', { query: '?raw', import: 'default', eager: true });
const candidates = import.meta.glob<string>('../../../packs/*/build/*candidate-*.pack.json', { query: '?raw', import: 'default', eager: true });
// Each pack's newest build candidate, else its own pack file (told apart by meta.id, never by folder or file name).
const packs = newestPerPack(candidates, files)
  .map(({ raw }) => ({ read: readPackJson(raw) }))
  .filter((p) => p.read.ok && p.read.pack.entries.some((e) => e.kind === 'class'))
  .map((p, i) => ({ ...p, label: `pack ${i + 1}` }));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Scores that meet every requirement given (10 otherwise), for these ability keys. */
function scoresFor(keys: string[], ...requirements: unknown[]): Record<string, number> {
  const scores = Object.fromEntries(keys.map((k) => [k, 10]));
  for (const needs of requirements) {
    if (!isRecord(needs)) continue;
    for (const [ability, minimum] of Object.entries(needs)) if (typeof minimum === 'number') scores[ability] = Math.max(scores[ability] ?? 10, minimum);
  }
  return scores;
}

describe.skipIf(packs.length === 0)('the M4b gate: every class makes a legal 1st-level character (private packs)', () => {
  // The default race (ruled 2026-10-26) can come from another pack in the campaign's stack, as a conversion pack
  // sits on its setting's: every private pack's rules sets, read together.
  const allRules = packs.flatMap(({ read }) => (read.ok ? read.pack.entries.filter((e) => e.kind === 'rulesSet').map((e) => e.data) : []));
  for (const { label, read } of packs) {
    if (!read.ok) continue;
    const entries: PackEntry[] = read.pack.entries;
    const options = entries.filter((e) => e.kind === 'option');
    const methods = creationMethods(options, () => undefined);
    // Every method a player could end up using: the campaign's choice, or each one it lets players pick.
    const allMethods: (CreationMethod | null)[] = methods ? [...new Set([...methods.all.filter((m) => m.methods.length === 0), ...methodsToPick(methods)])] : [null];
    const races = entries.filter((e) => e.kind === 'race');
    const classes = entries.filter((e) => e.kind === 'class');
    const hooks = entries.filter((e) => e.kind === 'hook').map((e) => e.data);
    const rulesSets = entries.filter((e) => e.kind === 'rulesSet').map((e) => resolveRules(e.data, {}));
    const keys = abilityKeys(rulesSets);
    const pack = label;

    it(`${pack}: has classes to check`, () => {
      expect(classes.length).toBeGreaterThan(0);
    });

    // rc-1: the packs’ primeXp shape is the one the app reads. With every score at 13, a class whose primeXp says
    // anything gets an XP modifier (the table’s row may come from another pack’s rules set, as a conversion’s does).
    it(`${pack}: a class with primeXp shows an XP modifier at creation (rc-1)`, () => {
      const withPrimeXp = classes.filter((c) => c.data.primeXp !== undefined);
      if (withPrimeXp.length === 0) return;
      const stack = [...allRules.map((r) => resolveRules(r, {})), ...rulesSets];
      const thirteens = Object.fromEntries([...keys, ...withPrimeXp.flatMap((c) => (Array.isArray(c.data.primeRequisites) ? c.data.primeRequisites.map(String) : []))].map((k) => [k, 13]));
      const modifiers = withPrimeXp.map((c) => primeXpBonus({ packEntryId: c.packEntryId, name: c.name, data: c.data }, stack, thirteens));
      expect(modifiers.some((m) => m !== null), `no class in ${pack} gives a prime XP modifier`).toBe(true);
    });

    for (const klass of classes) {
      it(`${pack}: class ${klass.packEntryId}`, () => {
        // A method that offers the class (its creationMethods), with a race it allows when the method wants one.
        const tries = allMethods.flatMap((method) => {
          const usual = defaultRace(allRules, races);
          const mode = raceStep(method, races, usual !== null);
          const candidates = mode === 'none' ? [null] : mode === 'optional' ? [usual, ...races] : races;
          return candidates.map((race) => ({ method, race }));
        });
        const legal = tries.find(({ method, race }) => {
          const rolled = scoresFor(keys, race?.data.requirements, klass.data.requirements);
          const offered = classesFor([klass], method, race, withRace(rolled, race));
          return offered.length === 1 && offered[0]!.reason === null;
        });
        expect(legal, `no method and race offer ${klass.packEntryId} with scores meeting its requirements`).toBeDefined();

        const rolled = scoresFor(keys, legal!.race?.data.requirements, klass.data.requirements);
        const { filled, skipped } = fillsAtCreation(hooks, rulesSets, { level: 1, scores: withRace(rolled, legal!.race), klass: klass.data, race: legal!.race?.data ?? null });
        expect(skipped).toEqual([]);
        const progression = Array.isArray(klass.data.progression) ? klass.data.progression.filter(isRecord) : [];
        if (progression.length > 0) {
          expect(filled.hitDice ?? klass.data.hitDie, 'hit dice at level 1').toBeTruthy();
          // Saves fill only through the pack's fill hooks; a homebrew stacked on another pack may have none.
          if (isRecord(progression[0]!.saves) && hooks.some((h) => h.kind === 'fill')) expect(Object.keys(filled).some((name) => name.startsWith('saves.'))).toBe(true);
        } else {
          expect(klass.data.hitDie, 'a hit die').toBeTruthy();
        }
      });
    }
  }
});
