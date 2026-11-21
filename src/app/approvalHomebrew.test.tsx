// @vitest-environment jsdom
// The GM's approval card and Add to homebrew (M5b step 0c, follow-up C, cf-6), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   The card lists what the player typed with Other… (a language, a trait entry) under "Typed by <player>", each with Add to homebrew.
//   Add to homebrew on a language puts it in the campaign's own homebrew pack ("Campaign languages", after the setting's list)
//   and the row then says it is in the homebrew.
//   Add to homebrew on a trait entry puts it on a homebrew version of that trait list, with its note.
//   A character with nothing typed shows no "Typed by" block.
//   A weapon skill typed with Other… (PR G) is listed as a weapon skill with Add to homebrew; adding it puts a weapon
//   item in the campaign's homebrew; a weapon picked from the pack gets no such row.
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

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };

/** A waiting guided character (Hollis, bog folk warden) in the fixture's setting; `fields` is what the player wrote. */
function waitingGuided(fields: Record<string, string>, weaponSkills: Record<string, unknown>[] = []) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const player = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, player, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'hp' && f.key !== 'omen');
  layout.forEach((f, order) => {
    const fromList = f.key === 'background' ? 'fen-backgrounds-bog-folk' : null;
    const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
  });
  const hollis = world.addCharacter(campaign, 'Hollis', { ownerId: player, approval: 'pending' });
  Object.assign(world.tables.actors.find((a) => a.id === hollis)!, {
    level: 1,
    classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
    race_ref: 'bog-folk',
    creation: { method: null, rolled: { MUS: 10, NIM: 10, GRT: 9, WIT: 12, LORE: 10, CHARM: 10 }, scores: { MUS: 10, NIM: 10, GRT: 9, WIT: 12, LORE: 10, CHARM: 10 } },
    fields,
    weapon_skills: weaponSkills,
  });
  world.signInAs(gm);
  return { campaign };
}

async function openCard() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await screen.findByText('New character waiting: Hollis');
  return user;
}

describe('Add to homebrew on the approval card (cf-6)', () => {
  it('lists the typed language and trait entry under "Typed by Sam"; Add to homebrew on the language puts it in the campaign’s own pack after the setting’s four', async () => {
    const { campaign } = waitingGuided({ languages: 'Fen common, Deep croak, Old lantern, Heron-call', background: 'Mud diver — knows the flats' });
    const user = await openCard();
    const block = within(await screen.findByRole('group', { name: 'Typed by Sam' }));
    const language = block.getByText('Heron-call').closest('li') as HTMLElement;
    expect(within(language).getByText('Language')).toBeTruthy();
    const trait = block.getByText('Mud diver').closest('li') as HTMLElement;
    expect(within(trait).getByText('Bog folk backgrounds, knows the flats')).toBeTruthy();
    expect(block.getAllByRole('button', { name: 'Add to homebrew' })).toHaveLength(2);
    await user.click(within(language).getByRole('button', { name: 'Add to homebrew' }));
    await waitFor(() => expect(screen.getByText('In the campaign’s homebrew now')).toBeTruthy());
    const home = world.tables.packs.find((p) => p.campaign_id === campaign);
    expect(home).toBeTruthy();
    const row = world.tables.library_entries.find((e) => e.pack_id === home!.id && e.kind === 'rulesSet' && e.pack_entry_id === 'campaign-languages')!;
    expect(row).toBeTruthy();
    const list = (row.data as { languages: { list: { id: string; name: string }[] } }).languages.list;
    expect(list.slice(0, 4).map((l) => l.id)).toEqual(['fen-common', 'reedspeak', 'deep-croak', 'old-lantern']);
    expect(list[4]).toEqual({ id: 'heron-call', name: 'Heron-call' });
    // The setting is read again: the language is a pick now, so only the trait still offers Add to homebrew.
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Typed by Sam' })).getAllByRole('button', { name: 'Add to homebrew' })).toHaveLength(1));
  });

  it('Add to homebrew on the trait entry puts a homebrew version of its list with the entry and its note last', async () => {
    const { campaign } = waitingGuided({ languages: 'Fen common, Deep croak, Old lantern', background: 'Mud diver — knows the flats' });
    const user = await openCard();
    const block = within(await screen.findByRole('group', { name: 'Typed by Sam' }));
    await user.click(within(block.getByText('Mud diver').closest('li') as HTMLElement).getByRole('button', { name: 'Add to homebrew' }));
    await waitFor(() => expect(screen.getByText('In the campaign’s homebrew now')).toBeTruthy());
    const home = world.tables.packs.find((p) => p.campaign_id === campaign)!;
    const row = world.tables.library_entries.find((e) => e.pack_id === home.id && e.kind === 'traitList' && e.pack_entry_id === 'fen-backgrounds-bog-folk')!;
    expect(row).toBeTruthy();
    const entries = (row.data as { entries: Record<string, unknown>[] }).entries;
    expect(entries[entries.length - 1]).toEqual({ id: 'mud-diver', name: 'Mud diver', notes: 'knows the flats' });
  });

  // Purpose: the GM's approval card names every ability in full, never its short form (Francis via Design, 2026-11-06).
  it('the approval card names each ability in full', async () => {
    waitingGuided({ languages: 'Fen common, Deep croak, Old lantern', background: 'reed-cutter' });
    await openCard();
    expect((await screen.findAllByText(/Muscle 10, Nimbleness 10, Grit 9, Wit 12, Lore 10, Charm 10/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/MUS 10/)).toBeNull();
  });

  it('a character with nothing typed shows no "Typed by" block', async () => {
    waitingGuided({ languages: 'Fen common, Deep croak, Old lantern', background: 'reed-cutter' });
    await openCard();
    expect(screen.queryByText(/^Typed by/)).toBeNull();
  });

  it('a weapon typed with Other… shows as a weapon skill with Add to homebrew, and adding it puts a weapon in the campaign’s homebrew', async () => {
    const { campaign } = waitingGuided({ languages: 'Fen common, Deep croak, Old lantern', background: 'reed-cutter' }, [{ itemId: 'reed-spear' }, { itemId: 'Heron hook', other: true }]);
    const user = await openCard();
    const block = within(await screen.findByRole('group', { name: 'Typed by Sam' }));
    const weapon = block.getByText('Heron hook').closest('li') as HTMLElement;
    expect(within(weapon).getByText('Weapon skill')).toBeTruthy();
    // The pack's own weapon (Reed spear) is a pick, not typed: one row, one button.
    expect(block.queryByText('Reed spear')).toBeNull();
    expect(block.getAllByRole('button', { name: 'Add to homebrew' })).toHaveLength(1);
    await user.click(within(weapon).getByRole('button', { name: 'Add to homebrew' }));
    await waitFor(() => expect(screen.getByText('In the campaign’s homebrew now')).toBeTruthy());
    const home = world.tables.packs.find((p) => p.campaign_id === campaign)!;
    const row = world.tables.library_entries.find((e) => e.pack_id === home.id && e.kind === 'item' && e.pack_entry_id === 'heron-hook')!;
    expect(row.data).toEqual({ id: 'heron-hook', name: 'Heron hook', category: 'weapon', weapon: {} });
    // Read again: the weapon is in the setting now, so the row's button goes.
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Typed by Sam' })).queryAllByRole('button', { name: 'Add to homebrew' })).toHaveLength(0));
  });

  it('a character whose weapons all come from the pack shows no "Typed by" block', async () => {
    waitingGuided({ languages: 'Fen common, Deep croak, Old lantern', background: 'reed-cutter' }, [{ itemId: 'reed-spear', specialised: true }, { itemId: 'eel-knife' }]);
    await openCard();
    expect(screen.queryByText(/^Typed by/)).toBeNull();
  });
});

// The GM's card, exceptions first (final drafts D, mockup creation/final/07; Design 2026-11-07):
//   Each exception shows first, with the sign, the pack's reason, Allow it and (a language) Take it off.
//   Approve with one still open says what's left to settle and approves nothing; Allow it, then Approve, approves and
//   the log line names what was allowed. Take it off takes the language off the character and the exception off the
//   record, through the GM's edit.
describe('exceptions first on the approval card (final drafts D)', () => {
  const flagged = (record: Record<string, unknown>) =>
    Object.assign(record, {
      creation: {
        ...(record.creation as Record<string, unknown>),
        specialApprovals: [{ step: 'languages', entryId: 'old-lantern', name: 'Old lantern', requirement: 'Usually learnt only by stone kinds' }],
      },
    });
  const hollis = () => world.tables.actors.find((a) => a.name === 'Hollis')!;

  it('Approve asks to settle first; Allow it then Approve approves and logs what was allowed', async () => {
    waitingGuided({ languages: 'Fen common, Deep croak, Old lantern' });
    flagged(hollis());
    const user = await openCard();
    const card = within(screen.getByRole('group', { name: 'Needs your special approval: Old lantern' }));
    expect(card.getByText('Old lantern: Usually learnt only by stone kinds')).toBeTruthy();
    // The reason only in the block (Design, 2026-11-07): the Who they are row is the value with the sign inline.
    expect(screen.getAllByText(/Usually learnt only by stone kinds/)).toHaveLength(1);
    expect(screen.getByText('Old lantern', { selector: '.review__line' }).querySelector('.warning-sign')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('1 thing to settle: Allow it or Take it off first.')).toBeTruthy();
    expect(hollis().approval).toBe('pending');
    await user.click(card.getByRole('button', { name: 'Allow it' }));
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(hollis().approval).toBe('approved'));
    expect(hollis().review_note).toBe('Allowed: Old lantern');
  });

  it('Take it off removes the language and the exception', async () => {
    waitingGuided({ languages: 'Fen common, Deep croak, Old lantern' });
    flagged(hollis());
    const user = await openCard();
    await user.click(within(screen.getByRole('group', { name: 'Needs your special approval: Old lantern' })).getByRole('button', { name: 'Take it off' }));
    await waitFor(() => expect((hollis().fields as Record<string, unknown>).languages).toBe('Fen common, Deep croak'));
    expect((hollis().creation as Record<string, unknown>).specialApprovals).toBeUndefined();
  });
});
