// The options audit (docs/plans/options-audit-2026-11-03.md) against the private packs: every row becomes a test of the
// shared option reader (optionGate.ts, of-3, of-9, of-10), with each pack stacked on its bases as a campaign stacks
// them. Local only: the packs are never committed (hard rule 2), so where packs/ is missing (GitHub) this is skipped,
// as creationOptions.realPacks.test.ts is. This file holds no game content: the option ids come from the audit.
//   For each row's option and each of its choices: every entry gated by that option exists only under the choice it
//   names; every entry's (and rules set's) byOption for that choice gives its fields, a null one removed; every sheet
//   field behind it is hidden while it's off. The "Across all packs" rows X1 … X7 each get their own test, or a todo
//   naming the plan step that builds them.
import { describe, expect, it } from 'vitest';
import audit from '../../docs/plans/options-audit-2026-11-03.md?raw';
import { firstSpellsPlan, firstSpellsProblem, rollRows } from '../modules/characters/firstSpells.ts';
import { checkPrompt } from '../modules/expedition/checks.ts';
import { readExploration } from '../modules/expedition/modes.ts';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { entriesInPlay, entryOptionSpec, optionGate, optionSpecOn, specOptions, specParts } from '../modules/library/optionGate.ts';
import { readOptions, readPresets } from '../modules/library/options.ts';
import { atPath, patchesInPlay, patchMatches, readPatches } from '../modules/library/patches.ts';
import { readPackJson, type PackKind } from '../modules/library/packFile.ts';
import { offeredSources, presetChanges, withExtends, type RuleSource } from '../modules/library/ruleGroups.ts';
import { isEncumbranceMode } from '../core/campaignSettings.ts';
import { loadMethodOf, modesOfferedBy } from './loadMethod.ts';
import { newestPerPack } from '../testing/realPacks.ts';
import { choicesInPlay, settingFrom, type CampaignSetting } from './campaignSetting.ts';

const files = import.meta.glob<string>('../../packs/*/*.pack.json', { query: '?raw', import: 'default', eager: true });
const candidates = import.meta.glob<string>('../../packs/*/build/*candidate-*.pack.json', { query: '?raw', import: 'default', eager: true });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

interface RealPack {
  id: string;
  label: string;
  kind: PackKind;
  bases: string[];
  entries: CampaignEntry[];
}

/** A pack's bases (meta.base, and meta.requires as an overlay names its base: ids, or { packId } objects). */
const basesOf = (meta: unknown): string[] => {
  const list = (value: unknown) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
  const named = isRecord(meta) ? [...list(meta.base), ...list(meta.requires)] : [];
  return named.flatMap((b) => (typeof b === 'string' ? [b] : isRecord(b) && typeof b.packId === 'string' ? [b.packId] : []));
};

const packs: RealPack[] = newestPerPack(candidates, files).flatMap(({ id, raw }, i) => {
  const read = readPackJson(raw);
  if (!read.ok) return [];
  const meta: unknown = (JSON.parse(raw) as { meta?: unknown }).meta;
  return [{ id, label: `pack ${i + 1}`, kind: read.pack.meta.kind, bases: basesOf(meta), entries: read.pack.entries.map((e) => ({ ...e, packId: id })) }];
});
const byId = new Map(packs.map((p) => [p.id, p]));

/** The pack with its bases under it (theirs too), as a campaign would attach them: the pack on top. */
function stackFor(top: RealPack): RealPack[] {
  const out: RealPack[] = [];
  const add = (p: RealPack) => {
    if (out.includes(p)) return;
    out.push(p);
    for (const id of p.bases) if (byId.has(id)) add(byId.get(id)!);
  };
  add(top);
  return out;
}

/** The campaign's setting for that stack, with one option's choice set in the pack that has it. */
function settingWith(stack: RealPack[], choice: { packId: string; optionId: string; choiceId: string } | null): CampaignSetting {
  const links: CampaignPack[] = stack.map((p, i) => ({
    id: `link-${i}`,
    campaignId: 'audit',
    packId: p.id,
    name: p.label,
    shortName: p.label,
    version: '',
    kind: p.kind,
    optionChoices: choice && choice.packId === p.id ? { [choice.optionId]: choice.choiceId } : {},
    priority: stack.length - i,
    overrides: {},
    campaignHomebrew: false,
  }));
  return settingFrom(links, stack.flatMap((p) => p.entries), {});
}

/** The campaign's setting for that stack with each pack's choices given (by pack id). */
function settingWithChoices(stack: RealPack[], choices: Record<string, Record<string, string>>): CampaignSetting {
  const links: CampaignPack[] = stack.map((p, i) => ({
    id: `link-${i}`,
    campaignId: 'audit',
    packId: p.id,
    name: p.label,
    shortName: p.label,
    version: '',
    kind: p.kind,
    optionChoices: choices[p.id] ?? {},
    priority: stack.length - i,
    overrides: {},
    campaignHomebrew: false,
  }));
  return settingFrom(links, stack.flatMap((p) => p.entries), {});
}

/** The stack's rule sources as the Rules screen builds them (of-1's extends applied), with each pack's choices. */
const sourcesOf = (stack: RealPack[], choices: Record<string, Record<string, string>> = {}): RuleSource[] =>
  withExtends(stack.map((p) => ({ packId: p.id, name: p.label, shortName: p.label, kind: p.kind, rules: readOptions(p.entries), choices: choices[p.id] ?? {}, presets: readPresets(p.entries) })));

/** The audit's option rows: each names one or more option ids in its first cell. */
const rows = audit
  .split('\n')
  .filter((line) => /^\| `[^`]+`/.test(line))
  .map((line) => {
    const cells = line.split('|').map((c) => c.trim());
    return { cell: cells[1]!, choice: cells[2]!, options: [...cells[1]!.matchAll(/`([^`]+)`/g)].flatMap((m) => m[1]!.split(' · ').map((s) => s.trim())) };
  });

/** Every field of an override is in the resolved data: a null one is absent, an object's leaves are there, the rest equal. */
function holds(resolved: unknown, override: unknown, where: string): void {
  if (!isRecord(override)) return void expect(resolved, where).toEqual(override);
  expect(isRecord(resolved), where).toBe(true);
  for (const [key, value] of Object.entries(override)) {
    if (value === null) expect(key in (resolved as Record<string, unknown>), `${where}.${key} is off`).toBe(false);
    else holds((resolved as Record<string, unknown>)[key], value, `${where}.${key}`);
  }
}

const GENERIC = new Set(['race', 'rulesSet', 'option']);

describe.skipIf(packs.length === 0)('the options audit, row by row (private packs)', () => {
  it('the audit has option rows', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  for (const row of rows) {
    for (const optionId of row.options) {
      const home = packs.find((p) => p.entries.some((e) => e.kind === 'option' && e.packEntryId === optionId));
      it(`${optionId} (${row.choice}): every entry, section and field it gates follows each of its choices`, () => {
        expect(home, `${optionId} is an option in the packs`).toBeDefined();
        const stack = stackFor(home!);
        const option = home!.entries.find((e) => e.kind === 'option' && e.packEntryId === optionId)!;
        const choiceIds = (Array.isArray(option.data.choices) ? option.data.choices : []).filter(isRecord).map((c) => String(c.id ?? '')).filter(Boolean);
        expect(choiceIds.length).toBeGreaterThan(0);
        for (const choiceId of choiceIds) {
          const setting = settingWith(stack, { packId: home!.id, optionId, choiceId });
          const choices = { [optionId]: choiceId };
          const here = `${optionId}=${choiceId}`;
          for (const entry of setting.all) {
            if (entry.kind === 'option') continue;
            // Exists only under the choice it names (of-3).
            const spec = entryOptionSpec(stack.flatMap((p) => p.entries).find((e) => e.kind === entry.kind && e.packEntryId === entry.packEntryId && e.packId === entry.packId)!.data);
            if (specOptions(spec).includes(optionId)) expect(!entry.optionOff, `${entry.kind} ${entry.packEntryId} with ${here}`).toBe(optionSpecOn(spec, choices));
          }
          // Its byOption fields for the choice, on every entry the generic reader resolves (of-3, of-10).
          for (const raw of stack.flatMap((p) => p.entries)) {
            if (GENERIC.has(raw.kind) || !isRecord(raw.data.byOption)) continue;
            // A key may list several choices (of-12): it applies under any of them.
            const now = setting.all.find((e) => e.kind === raw.kind && e.packEntryId === raw.packEntryId);
            for (const [key, override] of Object.entries(raw.data.byOption)) {
              if (specParts(key).some((p) => p.option === optionId && p.choice === choiceId) && now?.packId === raw.packId) holds(now.data, override, `${raw.kind} ${raw.packEntryId} (${key})`);
            }
          }
          // A rules set's top-level byOption for the choice (a null section is off).
          const sets = stack.flatMap((p) => p.entries).filter((e) => e.kind === 'rulesSet' && e.packId === home!.id && isRecord(e.data.byOption));
          for (const set of sets) {
            const override = (set.data.byOption as Record<string, unknown>)[here];
            const resolved = setting.rulesSets.find((r) => r.id === set.packEntryId || r.name === set.name);
            if (override !== undefined && resolved) for (const [key, value] of Object.entries(override as Record<string, unknown>)) if (value === null) expect(key in resolved, `rules set ${key} is off with ${here}`).toBe(false);
          }
          // Sheet fields behind it are hidden while it's off (of-9).
          for (const layout of setting.all.filter((e) => e.kind === 'fieldTemplate')) {
            for (const field of (Array.isArray(layout.data.fields) ? layout.data.fields : []).filter(isRecord)) {
              if (specOptions(field.option).includes(optionId)) expect(setting.fieldsOff?.has(String(field.key)), `field ${String(field.key)} with ${here}`).toBe(!optionSpecOn(field.option, choices));
            }
          }
        }
      });
    }
  }
});

describe.skipIf(packs.length === 0)('the options audit, across all packs (private packs)', () => {
  // X1 (A1, options-gates build order 5): every add-on, on its own stack, is hidden while its parent hasn't a choice it
  // needs and offered under each one it does; stored on with the parent off, the reader reads it at its default.
  it('X1: an add-on option is offered only once its parent has the needed choice', () => {
    const addOns = packs.flatMap((pack) => readOptions(pack.entries).filter((r) => r.requires).map((rule) => ({ pack, rule })));
    expect(addOns.length, 'some pack has an add-on').toBeGreaterThan(0);
    for (const { pack, rule } of addOns) {
      const stack = stackFor(pack);
      const offered = (choices: Record<string, Record<string, string>>) => offeredSources(sourcesOf(stack, choices)).find((s) => s.packId === pack.id)!.rules.some((r) => r.id === rule.id);
      // Each parent at the first choice it doesn't need (or its default), then at each it does.
      const parents = Object.entries(rule.requires!).map(([optionId, needed]) => {
        const home = sourcesOf(stack).find((s) => s.rules.some((r) => r.id === optionId && !r.extends));
        expect(home, `${rule.id}: its parent ${optionId} is in the stack`).toBeDefined();
        const parent = home!.rules.find((r) => r.id === optionId)!;
        return { home: home!.packId, optionId, needed, other: parent.choices.find((c) => !needed.includes(c.id))?.id };
      });
      const withParents = (pick: (p: (typeof parents)[number]) => string | undefined, own: Record<string, string> = {}) => {
        const choices: Record<string, Record<string, string>> = { [pack.id]: { ...own } };
        for (const p of parents) {
          const id = pick(p);
          if (id !== undefined) choices[p.home] = { ...choices[p.home], [p.optionId]: id };
        }
        return choices;
      };
      for (const p of parents.filter((x) => x.other !== undefined)) {
        const off = withParents((q) => (q === p ? q.other : q.needed[0]), { [rule.id]: rule.choices.find((c) => c.id !== rule.defaultChoice)?.id ?? rule.defaultChoice });
        expect(offered(off), `${pack.label} ${rule.id} with ${p.optionId}=${p.other}`).toBe(false);
        expect(choicesInPlay(settingWithChoices(stack, off))[rule.id], `${rule.id} reads its default`).toBe(rule.defaultChoice);
      }
      for (const p of parents) for (const needed of p.needed) expect(offered(withParents((q) => (q === p ? needed : q.needed[0]))), `${pack.label} ${rule.id} with ${p.optionId}=${needed}`).toBe(true);
    }
  });

  // X2 (A8, options-gates build order 5): every pack's preset names options it has, and using it at set-up gives each
  // named option the preset's choice (unless an add-on it names stays hidden), read so by the shared reader.
  it('X2: option presets set the choices they name', () => {
    const withPresets = packs.filter((p) => readPresets(p.entries).length > 0);
    expect(withPresets.length, 'some pack has presets').toBeGreaterThan(0);
    for (const pack of withPresets) {
      const stack = stackFor(pack);
      const ids = new Set(readPresets(pack.entries).map((p) => p.id));
      for (const rule of readOptions(pack.entries)) for (const id of Object.keys(rule.presets ?? {})) expect(ids.has(id), `${pack.label} ${rule.id} names preset ${id}`).toBe(true);
      for (const preset of readPresets(pack.entries)) {
        const sources = sourcesOf(stack);
        const plan = presetChanges(sources, pack.id, preset.id, { attaching: true })!;
        const choices = Object.fromEntries(plan.changes.map((c) => [c.packId, c.next]));
        const inPlay = choicesInPlay(settingWithChoices(stack, choices));
        const shown = offeredSources(sources.map((s) => ({ ...s, choices: choices[s.packId] ?? s.choices })));
        for (const rule of sources.find((s) => s.packId === pack.id)!.rules) {
          const wanted = rule.presets?.[preset.id];
          if (wanted === undefined || !shown.find((s) => s.packId === pack.id)!.rules.includes(rule)) continue;
          expect(inPlay[rule.id], `${pack.label} ${preset.id}: ${rule.id}`).toBe(wanted);
        }
      }
    }
  });

  // A3 (options-gates build order 5): the load method follows the encumbrance rule's choice, whichever is chosen
  // later: each choice gives the method its rules sets set (when the packs give its data), and the rule matters.
  it("A3: the load method follows each choice of the encumbrance rule", () => {
    const rules = packs.flatMap((pack) => readOptions(pack.entries).filter((r) => r.ruleKey === 'encumbrance').map((rule) => ({ pack, rule })));
    expect(rules.length, 'some pack has an encumbrance rule').toBeGreaterThan(0);
    for (const { pack, rule } of rules) {
      const stack = stackFor(pack);
      const methods = new Set<string>();
      for (const choice of withExtends(sourcesOf(stack)).find((s) => s.packId === pack.id)!.rules.find((r) => r.id === rule.id)!.choices) {
        const setting = settingWith(stack, { packId: pack.id, optionId: rule.id, choiceId: choice.id });
        const own = choicesInPlay(setting);
        const bottomUp = [...stack].reverse().map((p) => ({ entries: p.entries, choices: { ...own, ...(p.id === pack.id ? { [rule.id]: choice.id } : {}) } }));
        const method = loadMethodOf(bottomUp);
        methods.add(method);
        const set = [...setting.rulesSets].reverse().map((r) => (r.encumbrance as { mode?: unknown } | undefined)?.mode).find(isEncumbranceMode);
        if (set && modesOfferedBy(bottomUp).includes(set)) expect(method, `${pack.label} ${rule.id}=${choice.id}`).toBe(set);
      }
      expect(methods.size, `${pack.label} ${rule.id}: its choices give different load methods`).toBeGreaterThan(1);
    }
  });
  it.todo('X3: the GM reference marks the variant in use (by design it shows the book; of-10 marks a null section Off)');

  // X4 (of-9): a field that exists only for an option is hidden on the full sheet too, not only at creation.
  it('X4: every sheet field behind an option is hidden while the option is at its default off', () => {
    for (const pack of packs) {
      const setting = settingWith(stackFor(pack), null);
      const choices = choicesInPlay(setting);
      for (const layout of setting.all.filter((e) => e.kind === 'fieldTemplate')) {
        for (const field of (Array.isArray(layout.data.fields) ? layout.data.fields : []).filter(isRecord)) {
          if (typeof field.option === 'string' && field.option.trim()) expect(setting.fieldsOff?.has(String(field.key)), `${pack.label} ${String(field.key)}`).toBe(!optionSpecOn(field.option, choices));
        }
      }
    }
  });

  // X5: a byOption keyed on an option's default applies even when no choice was stored (the campaign set up before
  // the option came in a pack update).
  it("X5: a rules set's byOption on an option's default applies with no stored choice", () => {
    for (const pack of packs) {
      const setting = settingWith(stackFor(pack), null);
      const choices = choicesInPlay(setting);
      for (const set of pack.entries.filter((e) => e.kind === 'rulesSet' && isRecord(e.data.byOption))) {
        const resolved = setting.rulesSets.find((r) => r.id === set.packEntryId || r.name === set.name);
        for (const [key, override] of Object.entries(set.data.byOption as Record<string, unknown>)) {
          if (!resolved || !optionSpecOn(key, choices) || !isRecord(override)) continue;
          for (const [field, value] of Object.entries(override)) if (value === null) expect(field in resolved, `${pack.label} ${key} ${field}`).toBe(false);
          else expect(resolved[field], `${pack.label} ${key} ${field}`).toBeDefined();
        }
      }
    }
  });

  // X6 (of-1, options-gates PR 2): an overlay's method that `extends` a base option is one option with the base's: its
  // choices on the base's row, labelled with the overlay, no row of its own; and each of its choices, stored on the
  // base option, gives the overlay's rules set its byOption for that choice (keyed on the base option).
  it("X6: an overlay's option that extends a base option joins it, and its choices work from there", () => {
    const extending = packs.flatMap((pack) => pack.entries.filter((e) => e.kind === 'option' && typeof e.data.extends === 'string').map((option) => ({ pack, option })));
    expect(extending.length, 'some pack has an option with extends').toBeGreaterThan(0);
    for (const { pack, option } of extending) {
      const stack = stackFor(pack);
      const baseId = String(option.data.extends);
      const sources = withExtends(stack.map((p) => ({ packId: p.id, name: p.label, shortName: p.label, kind: p.kind, rules: readOptions(p.entries), choices: {} })));
      expect(sources.find((s) => s.packId === pack.id)!.rules.some((r) => r.id === option.packEntryId), `${option.packEntryId} has no row of its own`).toBe(false);
      const base = sources.flatMap((s) => s.rules.filter((r) => r.id === baseId).map((rule) => ({ s, rule })))[0];
      expect(base, `${option.packEntryId}: its base ${baseId} is in the stack`).toBeDefined();
      const own = readOptions([option])[0]!.choices;
      for (const choice of own) {
        expect(base!.rule.choices.find((c) => c.id === choice.id)?.pack, `${baseId} offers ${choice.id}`).toBeDefined();
        const home = packs.find((p) => p.id === base!.s.packId)!;
        const setting = settingWith(stack, { packId: home.id, optionId: baseId, choiceId: choice.id });
        expect(choicesInPlay(setting)[baseId], `${baseId}=${choice.id} is in play`).toBe(choice.id);
        for (const set of pack.entries.filter((e) => e.kind === 'rulesSet' && isRecord(e.data.byOption))) {
          const override = (set.data.byOption as Record<string, unknown>)[`${baseId}=${choice.id}`];
          const resolved = setting.rulesSets.find((r) => r.id === set.packEntryId || r.name === set.name);
          if (override !== undefined && resolved) holds(resolved, override, `rules set ${set.packEntryId} with ${baseId}=${choice.id}`);
        }
      }
    }
  });

  // X7: the rules browser and the GM reference list only the classes, kits and tables in play.
  it('X7: entries switched off by their option are not in the lists', () => {
    for (const pack of packs) {
      const setting = settingWith(stackFor(pack), null);
      const choices = choicesInPlay(setting);
      for (const entry of entriesInPlay(setting.all)) {
        if (entry.kind !== 'option') expect(optionSpecOn(entryOptionSpec(stackFor(pack).flatMap((p) => p.entries).find((e) => e.kind === entry.kind && e.packEntryId === entry.packEntryId && e.packId === entry.packId)?.data ?? {}), choices), `${entry.kind} ${entry.packEntryId}`).toBe(true);
      }
    }
  });

  // of-2's safety net (options-gates PR 2): every caster of every pack, on its own stack with every option that gates
  // its cantrips on: a pick group whose list level is empty in those packs asks for nothing. Filling every other group
  // and roll leaves nothing to do; a level with fewer spells than the count asks for what's there (bq3-15, PR 4).
  it('of-2, bq3-15: no caster is asked for picks a list level can’t give', () => {
    for (const pack of packs) {
      const base = settingWith(stackFor(pack), null);
      for (const klass of entriesInPlay(base.all).filter((e) => e.kind === 'class' && e.packId === pack.id && isRecord(e.data.spellcasting))) {
        const known = (klass.data.spellcasting as Record<string, unknown>).known;
        const gate = isRecord(known) && typeof known.option === 'string' ? (specOptions(known.option)[0] ?? '') : '';
        const choices = { ...choicesInPlay(base), ...(gate ? { [gate]: 'on' } : {}) };
        const plan = firstSpellsPlan(klass, 1, { spells: base.all.filter((e) => e.kind === 'spell'), lists: entriesInPlay(base.all).filter((e) => e.kind === 'spellList'), tables: entriesInPlay(base.all).filter((e) => e.kind === 'table'), choices });
        if (!plan) continue;
        const picks = {
          chosen: (plan.choose?.options ?? []).slice(0, plan.choose?.count ?? 0).map((o) => o.id),
          cantrips: (plan.cantrips?.options ?? []).slice(0, plan.cantrips?.count ?? 0).map((o) => o.id),
          rolled: Object.fromEntries(rollRows(plan).filter((r, i, all) => all.findIndex((x) => x.tableId === r.tableId) === i).map((r) => [r.tableId, r.key])),
        };
        expect(firstSpellsProblem(plan, picks), `${pack.label} ${klass.packEntryId}`).toBeNull();
      }
    }
  });

  // of-4 (options-gates PR 4, G-100): every check modifier behind an option, on its pack's own options: a weather-tag
  // modifier counts on the check's prompt under the option's choice and not under the others. Holds for however many
  // such modifiers the packs have (none before the pack session moves the weather effects' penalty behind its option).
  it('of-4: a check modifier behind an option applies only while it is on', () => {
    for (const pack of packs) {
      const options = new Map(pack.entries.filter((e) => e.kind === 'option').map((o) => [o.packEntryId, o]));
      for (const rules of pack.entries.filter((e) => e.kind === 'rulesSet')) {
        for (const mode of readExploration([rules.data]).modes) {
          for (const check of mode.checks) {
            for (const m of check.modifiers) {
              if (m.kind !== 'weatherTag' || !m.onlyWithOption) continue;
              const part = specParts(m.onlyWithOption)[0]!;
              const option = options.get(part.option);
              if (!option) continue;
              for (const c of (Array.isArray(option.data.choices) ? option.data.choices : []).filter(isRecord)) {
                const choices = { [part.option]: String(c.id ?? '') };
                const prompt = checkPrompt(check, 'travel', null, { weatherTags: [m.tag], choices });
                const counted = prompt.modifiers.some((l) => l.kind === 'weatherTag' && l.label === m.tag);
                expect(counted, `${pack.label} ${check.id} ${m.tag} with ${part.option}=${String(c.id)}`).toBe(optionSpecOn(m.onlyWithOption, choices));
              }
            }
          }
        }
      }
    }
  });

  // of-12 (options-gates PR 3): every entry whose option is a list exists under each choice it lists and under no
  // other, on its own pack's stack. Holds for however many such entries the packs have (none before the pack session
  // writes the energy weapons as lists); the row-by-row tests above check comma byOption keys.
  it('of-12: an entry gated on several choices exists under each of them, and only those', () => {
    for (const pack of packs) {
      const listed = pack.entries.filter((e) => e.kind !== 'option' && specParts(entryOptionSpec(e.data)).length > 1);
      if (listed.length === 0) continue;
      const stack = stackFor(pack);
      const options = stack.flatMap((p) => p.entries.filter((e) => e.kind === 'option').map((o) => ({ pack: p, option: o })));
      for (const optionId of new Set(listed.flatMap((e) => specOptions(entryOptionSpec(e.data))))) {
        const home = options.find((o) => o.option.packEntryId === optionId);
        if (!home) continue;
        for (const c of (Array.isArray(home.option.data.choices) ? home.option.data.choices : []).filter(isRecord)) {
          const choiceId = String(c.id ?? '');
          const setting = settingWith(stack, { packId: home.pack.id, optionId, choiceId });
          // Only the entries gated on this option alone (one gated on another option says nothing about this one).
          for (const entry of listed.filter((e) => specOptions(entryOptionSpec(e.data)).join() === optionId)) {
            const now = setting.all.find((e) => e.kind === entry.kind && e.packEntryId === entry.packEntryId && e.packId === entry.packId);
            if (!now) continue;
            const wanted = specParts(entryOptionSpec(entry.data)).some((p) => p.option === optionId && (p.choice || 'on') === choiceId);
            expect(!now.optionOff, `${pack.label} ${entry.kind} ${entry.packEntryId} with ${optionId}=${choiceId}`).toBe(wanted);
          }
        }
      }
    }
  });

  // of-13 (options-gates PR 3b, bq3-17): every pack's patches, on its own stack, under each choice their byOption names:
  // a removing patch marks every entry it matches off ("Off · <choice>"), and a changing patch leaves a line naming
  // the pack on every matched entry that has the field, with a one-patch delta on a number adding up. Holds for
  // however many patches the packs have (none before the pack session writes the zine's materials as patches).
  it("of-13: an overlay's patches change or remove the matched entries under its choices", () => {
    for (const pack of packs) {
      const raw = pack.entries.filter((e) => e.kind === 'patch');
      if (raw.length === 0) continue;
      const stack = stackFor(pack);
      const patches = readPatches(raw.map((e) => ({ ...e, packId: pack.id })), stack.map((p) => ({ packId: p.id, name: p.label })));
      const options = stack.flatMap((p) => p.entries.filter((e) => e.kind === 'option').map((o) => ({ pack: p, option: o })));
      for (const patch of patches) {
        for (const part of specParts(patch.byOption)) {
          const home = options.find((o) => o.option.packEntryId === part.option);
          if (!home) continue;
          const setting = settingWith(stack, { packId: home.pack.id, optionId: part.option, choiceId: part.choice });
          const inPlay = patchesInPlay(patches, { [part.option]: part.choice });
          for (const before of stack.flatMap((p) => p.entries)) {
            if (!patchMatches(patch, before)) continue;
            const now = setting.all.find((e) => e.kind === before.kind && e.packEntryId === before.packEntryId);
            if (!now || now.packId !== before.packId) continue;
            const where = `${pack.label} ${patch.packEntryId} on ${before.kind} ${before.packEntryId} with ${part.option}=${part.choice}`;
            if (patch.removes) {
              expect(now.optionOff, where).toBeTruthy();
              expect(now.offLabel, where).toMatch(/^Off: /);
              continue;
            }
            for (const { path, change } of patch.changes) {
              const was = atPath(optionGate(before, { [part.option]: part.choice }).data, path);
              if (!was.found) continue;
              const others = inPlay.filter((p) => p !== patch && patchMatches(p, before) && p.changes.some((c) => c.path === path));
              if (change.kind === 'delta' && typeof was.value === 'number' && others.length === 0) expect(atPath(now.data, path).value, where).toBe(was.value + change.by);
              if (change.kind === 'times' && typeof was.value === 'number' && others.length === 0) expect(atPath(now.data, path).value, where).toBe(was.value * change.by);
              if (atPath(now.data, path).value !== was.value) expect((now.patched ?? []).some((l) => l.path === path && l.text.endsWith(`, ${pack.label}`)), `${where}: a line names the pack`).toBe(true);
            }
          }
        }
      }
    }
  });
});
