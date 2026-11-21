// How `rolls` reads across the December stack (plan dec-13, row C5; pf-20, sv-3, rl-1): the conversion pack, the classic
// rules and the region's setting, in the order the campaign stacks them (its pack priorities, set here explicitly). Local only: the packs are private (hard rule 2),
// so where packs/_current is missing (GitHub) this is skipped, as tableRowShapes.test.tsx is. It holds no game content:
// it reads the packs in place and checks only which roll types the Saves and Scores lines are built from.
import { describe, expect, it } from 'vitest';
import { settingFrom } from '../../app/campaignSetting.ts';
import type { CampaignEntry, CampaignPack } from './campaignPacks.ts';
import { readPackJson } from './packFile.ts';
import { savesLine, scoresLine } from './rolls.ts';

type Fs = { existsSync: (p: string) => boolean; readdirSync: (p: string) => string[]; readFileSync: (p: string, e: 'utf8') => string };

/** The packs in packs/_current, by their meta.id; null when packs/ isn't here. */
async function readCurrent(): Promise<{ read: (id: string) => Pack | null; all: Pack[] } | null> {
  const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs;
  const node = (globalThis as unknown as { process: { env: Record<string, string | undefined>; cwd: () => string } }).process;
  const here = node.cwd().replace(/\\/g, '/');
  const dir = [node.env.PACKS_DIR, `${here}/packs/_current`, `${here}/../../../packs/_current`].find((d): d is string => !!d && fs.existsSync(d));
  if (!dir) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pack.json')).map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'));
  const byId = new Map<string, string>();
  for (const raw of files) {
    const id = (JSON.parse(raw) as { meta?: { id?: unknown } }).meta?.id;
    if (typeof id === 'string') byId.set(id, raw);
  }
  return { read: (id) => (byId.has(id) ? { id, raw: byId.get(id)! } : null), all: [...byId].map(([id, raw]) => ({ id, raw })) };
}

type Pack = { id: string; raw: string };
type Meta = { id?: unknown; kind?: unknown; requires?: unknown };

/**
 * The December stack's three packs, found by their shape, never by name (hard rule 2): the conversion is the pack that
 * requires exactly two setting packs that both carry `rolls`; of those, the classic rules carry a check against a score
 * (`rolls.abilityCheck`) and the woodland setting only the save. Null when they aren't all here.
 */
function decemberPacks(read: (id: string) => Pack | null, all: Pack[]): { conv: Pack; classic: Pack; woodland: Pack } | null {
  const metaOf = (p: Pack) => (JSON.parse(p.raw) as { meta?: Meta }).meta ?? {};
  const rollsOf = (p: Pack) => ((JSON.parse(p.raw) as { rulesSets?: { rolls?: Record<string, unknown> }[] }).rulesSets ?? []).map((r) => r.rolls ?? {});
  for (const conv of all) {
    const requires = metaOf(conv).requires;
    if (!Array.isArray(requires) || requires.length !== 2) continue;
    const bases = requires.map((id) => (typeof id === 'string' ? read(id) : null));
    if (bases.some((b) => !b || metaOf(b).kind !== 'setting')) continue;
    const classic = bases.find((b) => rollsOf(b!).some((r) => r.abilityCheck !== undefined));
    const woodland = bases.find((b) => b !== classic && rollsOf(b!).some((r) => r.save !== undefined && r.abilityCheck === undefined));
    if (classic && woodland) return { conv, classic, woodland };
  }
  return null;
}

function settingOf(stack: Pack[]) {
  const links: CampaignPack[] = [];
  const entries: CampaignEntry[] = [];
  stack.forEach(({ id, raw }, i) => {
    const read = readPackJson(raw);
    if (!read.ok) throw new Error(`${id} did not read`);
    links.push({ id: `link-${i}`, campaignId: 'c', packId: id, name: id, shortName: id, version: '', kind: read.pack.meta.kind, optionChoices: {}, priority: stack.length - i, overrides: {}, campaignHomebrew: false });
    entries.push(...read.pack.entries.map((e) => ({ ...e, packId: id })));
  });
  return settingFrom(links, entries, {});
}

/** The December stack in the order given, top first; null when the packs aren't here (skipped). */
async function stack(order: (p: { conv: Pack; classic: Pack; woodland: Pack }) => Pack[]): Promise<Pack[] | null> {
  const current = await readCurrent();
  const found = current && decemberPacks(current.read, current.all);
  return found ? order(found) : null;
}

describe('rolls across the December stack (the real packs)', () => {
  // Purpose (rl-1, Francis 2026-11-15): read per roll type, by the campaign's pack order. In his December campaign the
  // classic rules sit above the woodland setting (his pack list, 2026-11-15): the Saves line is classic's (at or over)
  // and the Scores line classic's check (at or under).
  it("his order (the conversion, then classic, then the woodland setting): both lines are classic's", async ({ skip }) => {
    const packs = await stack((p) => [p.conv, p.classic, p.woodland]);
    if (!packs) return skip();
    const setting = settingOf(packs);
    expect(savesLine(setting.rulesSets)?.words).toBe("Roll d20: your save's number or higher succeeds.");
    expect(scoresLine(setting.rulesSets)?.words).toBe('Roll d20: your score or lower succeeds.');
  });

  // Purpose: the reverse order (the woodland setting on top) still shows classic's check, since the woodland set carries
  // no check against a score: per roll type, the save comes from the woodland set and the check from classic.
  it("reversed (the woodland setting above classic): the Scores line is still classic's", async ({ skip }) => {
    const packs = await stack((p) => [p.conv, p.woodland, p.classic]);
    if (!packs) return skip();
    const setting = settingOf(packs);
    expect(savesLine(setting.rulesSets)?.words).toBe("Roll d20: your save's number or higher succeeds.");
    expect(scoresLine(setting.rulesSets)?.words).toBe('Roll d20: your score or lower succeeds.');
  });

  // Purpose: the woodland setting alone shows no Scores line (its heading stands alone).
  it('the woodland setting alone: no Scores line', async ({ skip }) => {
    const packs = await stack((p) => [p.woodland]);
    if (!packs) return skip();
    const setting = settingOf(packs);
    expect(savesLine(setting.rulesSets)?.words).toBe("Roll d20: your save's number or higher succeeds.");
    expect(scoresLine(setting.rulesSets)).toBeNull();
  });
});
