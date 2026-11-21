// @vitest-environment jsdom
// Two of the figure pop-ups ruled on 2026-11-19 (plan test-feedback-2026-11-19 rows C12 and C4; mockup december/26,
// approved 2026-11-19 with fixes, frames M2c, M2d, M2e, M2f), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Purposes, in plain words:
//   C12: a skill's pop-up starts with one line, "Succeeds on a 6+," in bold, the d6's glyph and "roll 1d6" (tfs-1); it
//   has no line on where the number comes from (no "Base chance for everyone", no class's line, no "is better", no
//   kindred's line), and no number beside its title; the pack's own words and the source stay. A skill rolled another
//   way (a low roll written "1-2", a percentage) keeps today's top line (⚑ 13); the GM's secret roll still says so.
//   C4: the Level and Experience bonus pop-ups do not repeat their figure in bold; each starts with its sentence
//   (tfb-3). A save still shows its number beside its title.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import type { Skill } from '../modules/characters/play.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { SkillSheet } from './FigureSheets.tsx';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/** Reed, a level 1 Lantern Warden of the bog folk, on the Fen sample, signed in as their player. */
function fenWorld(classRef = 'lantern-warden') {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  entry('xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  (pack.fieldTemplates![0]!.fields as LayoutField[])
    .filter((f) => f.key !== 'hp' && !f.from)
    .forEach((f, order) => {
      const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-10-18T12:00:00Z' });
    });
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, race_ref: 'bog-folk', fields: { MUS: 10, NIM: 10 }, classes: [{ classRef, level: 1, xp: 0 }] });
  world.addMember(campaign, me, 'player', reed);
  world.signInAs(me);
}

/** The player's full sheet, from the campaign's menu (the Player tab's row is gone: row C10, tfr-4, tfr-5). */
async function openSheet(): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await openFullSheetFromMenu(user);
  await screen.findByRole('region', { name: 'Level' });
  return user;
}

describe("a skill's pop-up starts with its one line (C12, tfs-1)", () => {
  it('Hark reads "Succeeds on a 6+," in bold, the d6 glyph, "roll 1d6", then the pack\'s words and the source, and nothing on where 6 comes from', async () => {
    // Purpose: his note on Forage (item 26): one line on what succeeds and what to roll, the four lines gone.
    fenWorld();
    const user = await openSheet();
    await user.click(within(screen.getByRole('region', { name: 'Skills' })).getByRole('button', { name: /^Hark/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Hark' });
    const sheet = within(dialog);
    const top = dialog.querySelector('.breakdown-sheet__figure')!;
    expect(top.textContent).toBe('Succeeds on a 6+, roll 1d6');
    expect(top.querySelector('strong')?.textContent).toBe('Succeeds on a 6+,');
    expect(top.querySelector('.die-glyph')?.getAttribute('data-die')).toBe('6');
    // No number beside the title: the top line is the figure.
    expect(dialog.querySelector('.dialog__figure')).toBeNull();
    for (const gone of [/Base chance for everyone/, /at level 1:/, /is better/, /counts:/, /^Bog folk:/, /\+0/]) expect(sheet.queryByText(gone)).toBeNull();
    expect(sheet.getByText(/^From your setting: /)).toBeTruthy();
    expect(sheet.queryByText(/doesn't describe what this skill does/)).toBeNull();
  });

  it("a stalker's Keen ear, rolled low (\"1-2\"), keeps today's top line and still says the GM rolls it", async () => {
    // Purpose: a skill rolled another way is not given an invented line (⚑ 13); the GM's secret roll is kept.
    fenWorld('mire-stalker');
    const user = await openSheet();
    await user.click(within(screen.getByRole('region', { name: 'Skills' })).getByRole('button', { name: /^Keen ear/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Keen ear' });
    expect(dialog.querySelector('.breakdown-sheet__figure')?.textContent).toBe('1-2, as your setting gives it.');
    expect(dialog.querySelector('.die-glyph')).toBeNull();
    expect(within(dialog).getByText('Your GM rolls this one secretly and tells you what happens.')).toBeTruthy();
    expect(within(dialog).queryByText(/Mire Stalker at level 1/)).toBeNull();
  });

  it('a skill by percentage keeps its odds both ways as its top line, with no glyph', () => {
    // Purpose: "Succeeds on 35 or less on d100, 35 in 100" stays until he rules the words (⚑ 13).
    const skill: Skill = { code: 'lock', name: 'Pick a lock', shown: '35%', odds: 'Succeeds on 35 or less on d100, 35 in 100', chance: null, gmRolls: false, group: 'class', text: 'Open a lock with picks, in quiet.' };
    render(<SkillSheet skill={skill} roll={null} source="Fen sample" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Pick a lock' });
    expect(dialog.querySelector('.breakdown-sheet__figure')?.textContent).toBe('Succeeds on 35 or less on d100, 35 in 100');
    expect(dialog.querySelector('.die-glyph')).toBeNull();
    expect(within(dialog).getByText('Open a lock with picks, in quiet.')).toBeTruthy();
  });

  it('a d20 skill draws the d20 glyph and "roll 1d20"', () => {
    // Purpose: the die named in the line is the skill's own, not always a d6.
    const skill: Skill = { code: 'way', name: 'Find the way', shown: '14+', odds: 'Succeeds on 14 or more', chance: null, gmRolls: false, group: 'everyone' };
    render(<SkillSheet skill={skill} roll={{ target: 14, sides: 20 }} source={null} onClose={() => {}} />);
    const top = screen.getByRole('dialog', { name: 'Find the way' }).querySelector('.breakdown-sheet__figure')!;
    expect(top.textContent).toBe('Succeeds on a 14+, roll 1d20');
    expect(top.querySelector('.die-glyph')?.getAttribute('data-die')).toBe('20');
  });
});

describe('a figure that is not a roll is not repeated (C4, tfb-3)', () => {
  it("Level's pop-up starts with its sentence and shows no number in bold or in its head", async () => {
    // Purpose: his note "Level 2 is duplicative." (item 11): "Level 1 Lantern Warden." is the first line, once.
    fenWorld();
    const user = await openSheet();
    await user.click(within(screen.getByRole('region', { name: 'Level' })).getByRole('button', { name: /^Level 1/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Level' });
    expect(dialog.querySelector('.breakdown-sheet__figure')).toBeNull();
    expect(dialog.querySelector('.dialog__figure')).toBeNull();
    expect(dialog.querySelector('p.reading')?.textContent).toBe('Level 1 Lantern Warden.');
  });

  it("the Experience bonus pop-up starts with its sentence, with no bold figure over it, and keeps its table", async () => {
    // Purpose: his note "Get rid of the first 0% in bold" (item 21): the figure is in the sentence and the table.
    fenWorld();
    const user = await openSheet();
    await user.click(within(screen.getByRole('region', { name: 'Abilities' })).getByRole('button', { name: /^Experience bonus/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Experience bonus' });
    expect(dialog.querySelector('.breakdown-sheet__figure')).toBeNull();
    expect(dialog.querySelector('.dialog__figure')).toBeNull();
    expect(dialog.querySelector('p.reading')?.textContent).toMatch(/^Your prime requisite .+ gives .+ to the experience you earn\.$/);
  });

  it('a save still shows its number beside its title', async () => {
    // Purpose: tfb-3 is for figures that are not rolls; saves, scores, armour class and attack keep theirs (M2f).
    fenWorld();
    const user = await openSheet();
    // The Lantern Warden's one save, mire, at 12 at level 1 (the fixture's progression).
    await user.click(within(screen.getByRole('region', { name: 'Saves' })).getByRole('button', { name: /mire/i }));
    const dialog = await screen.findByRole('dialog', { name: /mire/i });
    expect(dialog.querySelector('.dialog__figure')?.textContent).toBe('12');
  });
});
