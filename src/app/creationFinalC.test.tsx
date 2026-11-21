// @vitest-environment jsdom
// Creation's final drafts, slice C (plan m5b-creation-final-drafts C; mockups creation/final/02 and 03), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Purpose:
//   Who they are on a tablet (A10, C): the second column has a job. With nothing open it holds Derived values; a name
//   table opened from its row shows there, beside the step, with no sheet; under 700 px the table is a sheet and
//   Derived values stay folded under the step.
//   The name table opened has one tab per part and no number box; a tapped row fills that part of the name.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;
const had = window.matchMedia;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  window.matchMedia = had;
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };

/** The fixture on a campaign (as creationFinalA.test.tsx sets it up). */
function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const o of pack.options ?? []) entry('option', o);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const s of pack.spellLists ?? []) entry('spellList', s);
  for (const s of pack.spells ?? []) entry('spell', s);
  for (const t of pack.tables ?? []) entry('table', t);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen');
  layout.forEach((f, order) => {
    const fromList = f.key === 'background' ? 'fen-backgrounds-bog-folk' : null;
    const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
  });
  world.signInAs(me);
}

/** A window `width` px wide: min-width and max-width queries answered for it (jsdom has no layout). */
function windowOf(width: number) {
  const matches = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  };
  window.matchMedia = ((query: string) => ({ matches: matches(query), media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';

/** Guided creation to Who they are as a stone kin warden (stone kin have a name table). */
async function toWho(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Kindred, then calling' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Scores' });
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Stone kin' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Lantern Warden' }));
  if (heading() === 'Adjust scores') await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Who they are' });
}

describe('Who they are on a tablet and a phone (final drafts A10, C)', () => {
  // Purpose (retest 2, 2026-11-07): at 820 Who they are is one column: no second column, Derived values under the
  // fields at the end of the step, and an opened name table is a sheet.
  it('at 820, one column: Derived values under the fields at the end, and an opened name table is a sheet', async () => {
    windowOf(820);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(document.querySelector('.creation-step__side')).toBeNull();
    const content = document.querySelector('.creation-step__content')!;
    const derived = screen.getByText('Derived values').closest('details')!;
    expect(content.contains(derived)).toBe(true);
    // After every field the player fills: nothing but sheets follows it in the column.
    const fields = [...content.querySelectorAll('input, textarea')];
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) expect(field.compareDocumentPosition(derived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    expect(screen.getByRole('dialog', { name: 'Stone kin names' }).classList.contains('dialog--sheet')).toBe(true);
    // Its only box is the typed roll (any table with a die, #571 round 3).
    const names = within(screen.getByRole('dialog', { name: 'Stone kin names' }));
    expect(names.getAllByRole('textbox').map((box) => box.id)).toEqual([names.getByLabelText('What you rolled').id]);
  });

  it('at 375, the name table is a sheet and Derived values stay folded under the step, with no second column', async () => {
    windowOf(375);
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(document.querySelector('.creation-step__side')).toBeNull();
    expect(screen.getByText('Derived values').closest('.creation-step__content')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    expect(screen.getByRole('dialog', { name: 'Stone kin names' }).classList.contains('dialog--sheet')).toBe(true);
  });
});
