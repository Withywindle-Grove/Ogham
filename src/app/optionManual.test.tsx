// @vitest-environment jsdom
// Options the app doesn't apply yet (ex-7, design/rulings/m5b-pack-review-area-2-2026-11-03.md; plan
// m5b-area-2-app build order 5). Invented packs only. What it checks:
//   * the reader keeps `manual: true` and nothing else (a "yes" isn't manual);
//   * a manual option's row says "Run by hand · the app doesn't apply this yet", one tap on it opens its rules (what
//     it does and each choice in words), and a row without `manual` says nothing of the kind;
//   * in campaign set-up the choice of a manual option is still saved on Create;
//   * in Rules for this campaign the row says so too, and a change is still stored (one logged change).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readOptions } from '../modules/library/options.ts';
import type { PackEntry } from '../modules/library/packFile.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { MANUAL_LINK, MANUAL_NOTE, MANUAL_WORDS, RuleRow } from '../ui/ruleRows.tsx';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  world.signInAs(gm);
});

afterEach(() => cleanup());

const WINDS = {
  id: 'reed-winds',
  name: 'Reed winds',
  manual: true,
  default: 'off',
  changeLater: 'allow',
  source: 'p. 40',
  notes: 'Whether the wind over the reeds speeds or slows boats.',
  choices: [
    { id: 'off', name: 'Off', notes: 'Boats go as the oars take them.' },
    { id: 'on', name: 'On', notes: 'Against the wind, a boat goes half as far.' },
  ],
};
const OIL = { id: 'lantern-oil', name: 'Lantern oil', default: 'on', changeLater: 'allow', choices: [{ id: 'off', name: 'Off' }, { id: 'on', name: 'On' }] };

function addFen(): string {
  const id = 'pack-fen';
  world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name: 'Fen Rules, Advanced', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: { id: 'fen-rules', shortName: 'Fen Rules' }, updated_at: '2026-10-20T12:00:00Z' });
  for (const option of [WINDS, OIL]) world.tables.library_entries.push({ id: `${id}-${option.id}`, pack_id: id, kind: 'option', pack_entry_id: option.id, name: option.name, data: option });
  return id;
}

const entry = (data: Record<string, unknown>): PackEntry => ({ kind: 'option', packEntryId: String(data.id), name: String(data.name), data }) as PackEntry;

describe('the reader (ex-7)', () => {
  // Purpose: only `manual: true` marks an option run by hand; a missing or non-true value doesn't.
  it('keeps manual: true and nothing else', () => {
    const [winds, oil, odd] = readOptions([entry(WINDS), entry(OIL), entry({ ...OIL, id: 'odd', manual: 'yes' })]);
    expect(winds?.manual).toBe(true);
    expect(oil?.manual).toBeUndefined();
    expect(odd?.manual).toBeUndefined();
  });
});

describe('a rule row run by hand (ex-7)', () => {
  // Purpose: the row says "Run by hand · the app doesn't apply this yet", and one tap on those words opens the
  // rule's own words and each choice's, while the choice still works; a row without manual has no such line.
  it('says so, opens its rules in one tap, and still takes a choice', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <RuleRow name="Reed winds" about={WINDS.notes} source="Fen Rules, p. 40" choices={WINDS.choices} current="off" defaultChoice="off" onChoose={onChoose} manual />,
    );
    // Only "Run by hand ›" is the link (fl-1, 2026-11-05); "the app doesn't apply this yet" is plain text beside it.
    const link = screen.getByRole('button', { name: MANUAL_LINK });
    expect(link.textContent).toBe('Run by hand ›');
    expect(link.closest('.rule-row__manual-line')?.textContent).toBe(`Run by hand ›, ${MANUAL_NOTE}`);
    expect(screen.queryByRole('button', { name: /doesn.t apply/ })).toBeNull();
    await user.click(link);
    const rules = within(screen.getByRole('dialog', { name: 'Reed winds' }));
    expect(rules.getByText(`${MANUAL_WORDS}.`)).toBeTruthy();
    expect(rules.getByText(WINDS.notes)).toBeTruthy();
    expect(rules.getByText(/Against the wind, a boat goes half as far/)).toBeTruthy();
    await user.click(rules.getByRole('button', { name: /Close/ }));

    await user.click(screen.getByRole('button', { name: 'On' }));
    expect(onChoose).toHaveBeenCalledWith('on');

    rerender(<RuleRow name="Lantern oil" source="Fen Rules" choices={OIL.choices} current="on" defaultChoice="on" onChoose={onChoose} />);
    expect(screen.queryByRole('button', { name: MANUAL_LINK })).toBeNull();
  });
});

describe('campaign set-up (ex-7)', () => {
  // Purpose: in step 3 the manual option is marked, the other isn't, and its choice is stored with the campaign.
  it('marks the manual option and saves its choice on Create', async () => {
    addFen();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick Fen Rules, Advanced' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Optional rules' });

    const winds = within(screen.getByRole('group', { name: 'Reed winds' }));
    expect(winds.getByRole('button', { name: MANUAL_LINK })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Lantern oil' })).queryByRole('button', { name: MANUAL_LINK })).toBeNull();
    await user.click(winds.getByRole('button', { name: 'On' }));
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toMatchObject({ 'reed-winds': 'on' }));
  });
});

describe('Rules for this campaign (ex-7)', () => {
  // Purpose: in play the GM sees the same mark, its rules one tap away, and a change is still stored and logged.
  it('marks the manual option, opens its rules, and stores a change', async () => {
    const packId = addFen();
    const campaignId = world.addCampaign('The Ash Barrows', gm);
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaignId, pack_id: packId, pack_name: 'Fen Rules, Advanced', option_choices: {}, priority: 1 });

    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    const rules = within(await screen.findByRole('region', { name: 'Rules for this campaign' }));
    await user.click(await rules.findByRole('button', { name: /Optional rules: Fen Rules, Advanced, 2 rules/ }));

    const winds = within(rules.getByRole('group', { name: 'Reed winds' }));
    await user.click(winds.getByRole('button', { name: MANUAL_LINK }));
    expect(within(await screen.findByRole('dialog', { name: 'Reed winds' })).getByText(WINDS.notes)).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: 'Reed winds' })).getByRole('button', { name: /Close/ }));

    await user.click(within(rules.getByRole('group', { name: 'Reed winds' })).getByRole('button', { name: 'On' }));
    await waitFor(() => expect(world.tables.campaign_packs.find((l) => l.id === 'link-fen')?.option_choices).toEqual({ 'reed-winds': 'on' }));
    expect(world.tables.events.filter((e) => e.type === 'rules.setOptions')).toHaveLength(1);
  });
});
