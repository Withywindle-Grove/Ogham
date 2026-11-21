// @vitest-environment jsdom
// A class with no kit of its own (after-test A4, ruled by Francis 2026-11-06), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json with one more class, the Eel Herder, that no kit names. Every name and
// number is invented. Purposes:
//   A class with no kit of its own is offered every kit in play, each row saying "▲ Needs the GM's special approval".
//   Picking one keeps it on the creation record as a special pick (step gear); taking it off clears it.
//   The review lists it as needing the GM's special approval.
//   A class that has kits still sees only its own, with no special-approval line.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

type Entry = Record<string, unknown>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[] };

/** The fixture with the Eel Herder: the warden's twin with no kit, no weapon skills and its own name. */
function packWithHerder(): Record<string, Entry[]> {
  const pack = JSON.parse(fixture) as Record<string, Entry[]>;
  const warden = pack.classes!.find((c) => c.id === 'lantern-warden')!;
  const herder: Entry = { ...warden, id: 'eel-herder', name: 'Eel Herder', blurb: 'Drives the eels to market.', source: 'Fen rules p. 22' };
  delete herder.startingKits;
  delete herder.weaponProficiencyCategory;
  pack.classes!.push(herder);
  // Open to bog folk (a class the kindred's limits don't name is closed to it).
  const bogFolk = pack.races!.find((r) => r.id === 'bog-folk')!;
  bogFolk.classMaxLevels = { ...(bogFolk.classMaxLevels as Entry), 'eel-herder': 8 };
  return pack;
}

function fenWorld(pack: Record<string, Entry[]>) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Entry) => world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.tables!) entry('table', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => !['background', 'languages', 'hp', 'alignment'].includes(f.key));
  layout.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, created_at: '2026-10-18T12:00:00Z' }),
  );
  world.signInAs(me);
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;
const specials = () => ((tam().creation as { specialApprovals?: { step: string; name: string }[] }).specialApprovals ?? []).filter((s) => s.step === 'gear');
// The row, with its lines under the name (dec-10 A, cs-5).
const kitRow = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) }).closest('.pick-row') as HTMLElement;

async function toGear(user: User, className: string) {
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  await next(user);
  await pick(user, className);
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await next(user);
  await screen.findByRole('heading', { name: 'Gear' });
  await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
  await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '100');
}

describe('a class with no kit of its own (after-test A4)', () => {
  it('is offered every kit in play, each needing the GM’s special approval; a pick is kept as special, Take it off clears it', async () => {
    fenWorld(packWithHerder());
    const user = userEvent.setup();
    await toGear(user, 'Eel Herder');
    for (const name of ["Warden's kit", "Witch's kit"]) expect(kitRow(name).querySelector('.warning-line')?.textContent).toBe("Needs the GM's special approval");
    await pick(user, "Witch's kit");
    // A kit with rolls opens its Roll sequence; one without is taken at once.
    const sequence = screen.queryByRole('dialog', { name: "Witch's kit" });
    if (sequence) {
      const roll = within(sequence);
      for (let n = 0; n < 6 && screen.queryByRole('dialog', { name: "Witch's kit" }); n++) {
        const rows = roll.queryAllByRole('radio');
        const choices = roll.queryAllByRole('checkbox');
        if (rows.length > 0 && !rows.some((r) => r.getAttribute('aria-checked') === 'true')) await user.click(rows[0]!);
        else if (choices.length > 0 && !choices.some((r) => r.getAttribute('aria-checked') === 'true')) await user.click(choices[0]!);
        await user.click(roll.queryByRole('button', { name: 'Done' }) ?? roll.getByRole('button', { name: 'Next' }));
      }
    }
    await waitFor(() => expect(specials()).toEqual([expect.objectContaining({ step: 'gear', name: "Witch's kit" })]));
    // Picked ✓ takes it off: the special pick goes with it.
    await user.click(screen.getByRole('checkbox', { name: "Pick Witch's kit" }));
    await waitFor(() => expect(specials()).toEqual([]));
  });

  it('the review lists the special kit as needing the GM’s special approval', async () => {
    fenWorld(packWithHerder());
    const user = userEvent.setup();
    await toGear(user, 'Eel Herder');
    const plain = screen.getAllByRole('checkbox').find((b) => /^Pick .*(kit|bundle)/i.test(b.getAttribute('aria-label') ?? '') && !screen.queryByRole('dialog'))!;
    const name = (plain.getAttribute('aria-label') ?? '').replace(/^Pick /, '');
    await user.click(plain);
    for (let n = 0; n < 12 && screen.queryByRole('dialog', { name }); n++) {
      const dialog = within(screen.getByRole('dialog', { name }));
      const rows = [...dialog.queryAllByRole('radio'), ...dialog.queryAllByRole('checkbox')];
      // A roll made twice is one step with two taps (retest 2): "1 of 2 tapped" asks for another row.
      const more = /\d+ of \d+ tapped/.test(dialog.queryByRole('status', { name: 'Roll status' })?.textContent ?? '');
      if (rows.length > 0 && !rows.some((r) => r.getAttribute('aria-checked') === 'true')) await user.click(rows[0]!);
      else if (more) await user.click(rows.find((r) => r.getAttribute('aria-checked') !== 'true') ?? rows[0]!);
      await user.click(dialog.queryByRole('button', { name: 'Done' }) ?? dialog.getByRole('button', { name: 'Next' }));
    }
    await waitFor(() => expect(specials().map((s) => s.name)).toEqual([name]));
    for (let n = 0; n < 8 && !screen.queryByRole('button', { name: 'Send to the GM' }); n++) {
      const now = heading();
      await user.click(screen.queryByRole('button', { name: 'Decide later' }) ?? screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(!!screen.queryByRole('button', { name: 'Send to the GM' }) || heading() !== now).toBe(true));
    }
    // Final drafts D: the review's last card lists every exception under the sign.
    expect(within(screen.getByRole('region', { name: /needs? the GM's special approval$/ })).getByText(name)).toBeTruthy();
  });

  it('a class that has kits still sees only its own, with no special-approval line', async () => {
    fenWorld(packWithHerder());
    const user = userEvent.setup();
    await toGear(user, 'Lantern Warden');
    expect(kitRow("Warden's kit").textContent).not.toContain('special approval');
    expect(screen.queryByRole('button', { name: /^Witch's kit/ })).toBeNull();
  });
});
