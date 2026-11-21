// @vitest-environment jsdom
// The Skills heading's roll line and a skill's figure (plan test-feedback-2026-11-19 rows C13 and C14; tfs-2, tfs-3;
// page M1, approved 2026-11-19). On the invented fixture pack (Fen sample), whose Hark is rolled the target or higher on
// a d6; its rules set given a `rolls.skill` here, as no pack carries one yet (E6). Purposes:
//   With `rolls.skill`, the Skills heading's row carries the d6's glyph and "Roll d6: target or higher succeeds.", on the
//   Player tab and on the full sheet's own page; without it, the heading stands alone.
//   Hark, rolled the target or higher on a d6, reads "6+ on", the d6's glyph, "d6": the glyph inside the figure.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { rollWordsOutsideRollRows } from '../testing/rollRowGuard.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const SKILL_LINE = 'Roll d6: target or higher succeeds.';

/** The fixture on a campaign, its rules set carrying `rolls.skill` when asked; Wren, an approved bog folk Lantern Warden, for Sam. */
function skillWorld(skillRoll: boolean) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  const lists: [string, string][] = [['rulesSets', 'rulesSet'], ['races', 'race'], ['classes', 'class'], ['hooks', 'hook'], ['items', 'item'], ['traitLists', 'traitList'], ['fieldTemplates', 'fieldTemplate']];
  for (const [list, kind] of lists)
    for (const data of fenPack[list] ?? []) entry(kind, kind === 'rulesSet' && skillRoll ? { ...data, rolls: { skill: { die: 'd6', pass: 'atOrOver' } } } : data);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (fenPack.fieldTemplates![0]!.fields as { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; from?: string }[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from);
  layout.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type === 'list' && !f.choices?.length ? 'text' : f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, from_list: null, created_at: '2026-10-18T12:00:00Z' }),
  );
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
    level: 1,
    hp_current: 6,
    hp_max: 9,
    race_ref: 'bog-folk',
    fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 },
    classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
  });
  world.addMember(campaign, sam, 'player', wren);
  world.signInAs(sam);
}

/** The Skills heading's row: its rule line's words and its die, or null when the heading stands alone. */
function headingLine() {
  const row = screen.getByRole('heading', { name: 'Skills' }).parentElement!;
  if (!row.classList.contains('rule-heading')) return null;
  const line = row.querySelector('.roll-row--heading')!;
  return { words: line.textContent, die: line.querySelector('.die-glyph')?.getAttribute('data-die') };
}

/** Hark's figure: its parts in order (words, and the glyph by its die), and what a screen reader hears for the row. */
function harkFigure() {
  const hark = within(screen.getByRole('region', { name: 'Skills' })).getByRole('button', { name: /^Hark/ });
  const value = hark.querySelector('.list-row__value')!;
  const parts = [...value.childNodes].map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent : `[d${(n as Element).getAttribute('data-die')}]`));
  return { parts, text: value.textContent, word: value.classList.contains('list-row__value--word') };
}

async function openPlayerTab() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
  return user;
}

describe('the Skills heading carries its roll line (tfs-2, row C13)', () => {
  // Purpose: a rules set with `rolls.skill` gives the Skills heading its line and the d6's glyph, on the Player tab and
  // on the full sheet's own page; the line is a Roll row, so no roll words sit outside one.
  it('shows "Roll d6: target or higher succeeds." with the d6, on the tab and the full sheet', async () => {
    skillWorld(true);
    const user = await openPlayerTab();
    expect(headingLine()).toEqual({ words: SKILL_LINE, die: '6' });
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    expect(headingLine()).toEqual({ words: SKILL_LINE, die: '6' });
  });

  // Purpose: a rules set with no `rolls.skill` shows the Skills heading alone: no line, no glyph in its row.
  it('shows the heading alone without rolls.skill', async () => {
    skillWorld(false);
    await openPlayerTab();
    expect(headingLine()).toBeNull();
    expect(screen.queryByText(SKILL_LINE)).toBeNull();
  });
});

describe('a skill rolled the target or higher reads "6+ on d6" (tfs-3, row C14)', () => {
  // Purpose: Hark, rolled the target or higher on a d6, reads "6+ on", the d6's glyph, "d6", as one figure in the word
  // size, on the Player tab and on the full sheet's own page; with or without the heading's line.
  it('puts the glyph inside the figure', async () => {
    skillWorld(false);
    const user = await openPlayerTab();
    expect(harkFigure()).toEqual({ parts: ['6+ on ', '[d6]', 'd6'], text: '6+ on d6', word: true });
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    expect(harkFigure()).toEqual({ parts: ['6+ on ', '[d6]', 'd6'], text: '6+ on d6', word: true });
  });
});
