// @vitest-environment jsdom
// The Rules library by kind (docs/05 "Rules library", 06 Components: Rules library list, Pack row; ruling lr-1 … lr-3,
// 2026-11-02; plan m5b-0d build order 2). Invented packs only. What it checks:
//   * packs sit under Setting rules · Adventures · Homebrew by their meta.kind, and a homebrew overlay says what it needs;
//   * sort by name is the default, and Last updated puts the newest first;
//   * a pack row has four lines: name, its description and needs, what it holds in the pack's words, who uses it;
//   * Browse and Update are on the row; Delete isn't, it's in ⋯ with the campaign that uses it, and keeps its confirm;
//   * Export as a pack file saves the pack with its own details;
//   * a library of 0, 1 and 40 packs: the empty line; no chips with one kind; the find field from 8 packs;
//   * a blocked tap explains itself instead of being greyed out;
//   * a result on the list is a toast (T1, retest 4).
// The list's pure parts are tested in src/modules/library/libraryList.test.ts.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const download = vi.hoisted(() => ({ saved: [] as { fileName: string; data: unknown }[] }));
vi.mock('./download.ts', () => ({
  downloadJson: (fileName: string, data: unknown) => {
    download.saved.push({ fileName, data });
    return true;
  },
}));

let world: FakeWorld;
let gm: string;

beforeEach(() => {
  world = createFakeDb();
  download.saved = [];
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  world.signInAs(gm);
});

afterEach(() => cleanup());

type Kind = 'setting' | 'adventure' | 'homebrew';
let made = 0;
/** One pack in Priya's library, with entries of the kinds given (how many of each). */
function addPack(name: string, kind: Kind, options: { meta?: Record<string, unknown>; updated?: string; entries?: Record<string, number>; rulesSet?: Record<string, unknown> } = {}) {
  const id = `pack-${++made}`;
  world.tables.packs.push({
    id,
    owner_user_id: gm,
    campaign_id: null,
    name,
    version: '0.1',
    kind,
    format_version: 2,
    source: '',
    notes: '',
    extra_meta: options.meta ?? {},
    updated_at: options.updated ?? '2026-10-20T12:00:00Z',
  });
  for (const [entryKind, count] of Object.entries(options.entries ?? {})) {
    for (let n = 1; n <= count; n++) {
      world.tables.library_entries.push({ id: `${id}-${entryKind}-${n}`, pack_id: id, kind: entryKind, pack_entry_id: `${entryKind.toLowerCase()}-${n}`, name: `${entryKind} ${n}`, data: { id: `${entryKind.toLowerCase()}-${n}` } });
    }
  }
  if (options.rulesSet) world.tables.library_entries.push({ id: `${id}-rules`, pack_id: id, kind: 'rulesSet', pack_entry_id: 'rules', name: 'Rules', data: { id: 'rules', ...options.rulesSet } });
  return id;
}

async function openLibrary() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await screen.findByRole('heading', { name: 'Your campaigns' });
  await user.click(screen.getByRole('button', { name: 'Account and device options' }));
  await user.click(screen.getByRole('button', { name: 'Rules library' }));
  await screen.findByRole('heading', { name: 'Rules library' });
  return user;
}

/** The packs' names as listed, group by group. */
const listed = (group: string) =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.pack-row__name')?.textContent);

describe('the Rules library by kind', () => {
  it('groups packs by their kind, and a homebrew overlay sits under Homebrew saying what it needs', async () => {
    addPack('Fen Rules', 'setting', { meta: { id: 'fen-rules', description: 'The rules for a fen-and-marsh campaign.' } });
    addPack('The Drowned Abbey', 'adventure');
    addPack('Marsh Extras', 'homebrew', { meta: { requires: [{ packId: 'fen-rules', minVersion: '0.1' }], description: 'Extra poisons from the marsh.' } });
    await openLibrary();
    expect(await screen.findByRole('heading', { name: 'Setting rules: 1' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Setting rules: 1', 'Adventures: 1', 'Homebrew: 1']);
    expect(listed('Homebrew')).toEqual(['Marsh Extras']);
    const overlay = within(screen.getByRole('region', { name: 'Homebrew' }));
    expect(overlay.getByText('Needs: Fen Rules.')).toBeTruthy();
    expect(overlay.getByText('Extra poisons from the marsh.')).toBeTruthy();
  });

  it('sorts by name by default, and by last updated on a tap', async () => {
    addPack('marsh lights', 'setting', { updated: '2026-10-01T12:00:00Z' });
    addPack('Ash Rules', 'setting', { updated: '2026-10-02T12:00:00Z' });
    addPack('Bog Rules', 'setting', { updated: '2026-11-01T12:00:00Z' });
    const user = await openLibrary();
    await screen.findByText('Bog Rules');
    expect(listed('Setting rules')).toEqual(['Ash Rules', 'Bog Rules', 'marsh lights']);
    await user.click(screen.getByRole('button', { name: 'Sort: name' }));
    expect(listed('Setting rules')).toEqual(['Bog Rules', 'Ash Rules', 'marsh lights']);
    expect(screen.getByRole('button', { name: 'Sort: last updated' })).toBeTruthy();
  });

  it("a row says what the pack holds in its own words, and who uses it; Browse and Update are on it, Delete isn't", async () => {
    const id = addPack('Woodland Kindreds', 'setting', { entries: { class: 2, race: 8, item: 1 }, rulesSet: { creationGuide: { race: { why: 'Choose your kindred.', title: 'Kindred' } } } });
    for (const name of ['Fenmoor', 'Ash Hollow']) {
      const campaign = world.addCampaign(name, gm);
      world.tables.campaign_packs.push({ id: `link-${name}`, campaign_id: campaign, pack_id: id, pack_name: 'Woodland Kindreds', option_choices: {}, priority: 1 });
    }
    await openLibrary();
    const row = within((await screen.findByText('Woodland Kindreds')).closest('li')!);
    // The pack's rules set is counted too, last (lr-2a, 2026-11-13).
    expect(row.getByText('2 classes, 8 kindreds, 1 item, 1 rules set')).toBeTruthy();
    expect(row.getByText('Ash Hollow').tagName).toBe('STRONG');
    expect(row.getByText(/and 1 more, version 0\.1, updated/)).toBeTruthy();
    expect(row.getByRole('button', { name: 'Browse Woodland Kindreds' })).toBeTruthy();
    expect(row.getByLabelText('Update Woodland Kindreds from a file')).toBeTruthy();
    expect(row.queryByRole('button', { name: /Delete/ })).toBeNull();
    expect(row.queryByText('About this file')).toBeNull();
  });

  it('⋯ holds Export and Delete (with the campaign using it), and Delete still asks before anything goes', async () => {
    const id = addPack('Fen Rules', 'setting', { meta: { id: 'fen-rules', description: 'Fen things.' }, entries: { item: 1 } });
    const campaign = world.addCampaign('Fenmoor', gm);
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: id, pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
    const user = await openLibrary();
    await user.click(await screen.findByRole('button', { name: 'More for Fen Rules' }));
    expect(screen.queryByRole('button', { name: /^Edit pack/ })).toBeNull();
    const del = screen.getByRole('button', { name: /^Delete from your library…/ });
    expect(del.textContent).toContain('Fenmoor uses it');
    await user.click(del);
    const confirm = within(await screen.findByRole('group', { name: 'Delete Fen Rules' }));
    expect(confirm.getByText(/is used by a campaign: Fenmoor\./)).toBeTruthy();
    await user.click(confirm.getByRole('button', { name: 'Cancel' }));
    expect(world.tables.packs).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'More for Fen Rules' }));
    await user.click(screen.getByRole('button', { name: /^Export as a pack file/ }));
    expect(await screen.findByText('Fen Rules was saved as fen-rules.pack.json.')).toBeTruthy();
    expect(download.saved[0]?.data).toMatchObject({ format: 'tabletop-pack', meta: { name: 'Fen Rules', id: 'fen-rules', kind: 'setting', description: 'Fen things.' }, items: [{ id: 'item-1' }] });
  });

  // Purpose (T1, retest 4): a result on the list (updated, added, deleted, saved) shows as a toast where the eye is,
  // never as a line at the top of a list the GM has scrolled down to reach the pack's row.
  it('a result on the list is a toast, not a line at the top of the list', async () => {
    addPack('Fen Rules', 'setting', { meta: { id: 'fen-rules' }, entries: { item: 1 } });
    const user = await openLibrary();
    await user.click(await screen.findByRole('button', { name: 'More for Fen Rules' }));
    await user.click(screen.getByRole('button', { name: /^Export as a pack file/ }));
    const said = await screen.findByText('Fen Rules was saved as fen-rules.pack.json.');
    expect(said.closest('.toast-host')).not.toBeNull();
    expect(document.querySelector('.library > .library__notice')).toBeNull();
  });

  it('a homebrew pack has Edit pack in its ⋯', async () => {
    addPack('Marsh Extras', 'homebrew');
    const user = await openLibrary();
    await user.click(await screen.findByRole('button', { name: 'More for Marsh Extras' }));
    expect(screen.getByRole('button', { name: /^Edit pack/ })).toBeTruthy();
  });

  it('About this file is behind Browse', async () => {
    addPack('Fen Rules', 'setting', { meta: { author: 'Priya' } });
    const user = await openLibrary();
    await user.click(await screen.findByRole('button', { name: 'Browse Fen Rules' }));
    await user.click(await screen.findByText('About this file'));
    expect(screen.getByText('Made by')).toBeTruthy();
  });

  it('an empty library says so, with the import and the AI converter', async () => {
    await openLibrary();
    expect(await screen.findByText('Nothing in your library yet.')).toBeTruthy();
    expect(screen.getByLabelText('Import a file')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Convert a book with an AI…' })).toBeTruthy();
  });

  it('one pack (one kind): no chips and no find field', async () => {
    addPack('Fen Rules', 'setting');
    await openLibrary();
    await screen.findByText('Fen Rules');
    expect(screen.getByText(/Your own: 1 pack\./)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
    expect(screen.queryByRole('searchbox', { name: 'Find a pack' })).toBeNull();
  });

  it('forty packs: chips with counts filter to one kind, and the find field narrows by name', async () => {
    for (let n = 1; n <= 30; n++) addPack(`Setting ${String(n).padStart(2, '0')}`, 'setting');
    for (let n = 1; n <= 7; n++) addPack(`Adventure ${n}`, 'adventure');
    for (let n = 1; n <= 3; n++) addPack(`Brew ${n}`, 'homebrew');
    const user = await openLibrary();
    await screen.findByText('Setting 01');
    const chips = within(screen.getByRole('group', { name: 'Show' }));
    expect(chips.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['All: 40', 'Setting rules: 30', 'Adventures: 7', 'Homebrew: 3']);
    await user.click(chips.getByRole('button', { name: 'Homebrew: 3' }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Homebrew: 3']);
    await user.click(chips.getByRole('button', { name: 'All: 40' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a pack' }), 'adventure 7');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Adventures: 1']);
    await user.clear(screen.getByRole('searchbox', { name: 'Find a pack' }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a pack' }), 'lurker');
    expect(screen.getByText(/No pack matches “lurker”\./)).toBeTruthy();
  });

  it('the find field shows from 8 packs, not at 7', async () => {
    for (let n = 1; n <= 7; n++) addPack(`Setting ${n}`, 'setting');
    await openLibrary();
    await screen.findByText('Setting 7');
    expect(screen.queryByRole('searchbox', { name: 'Find a pack' })).toBeNull();
    cleanup();
    addPack('Setting 8', 'setting');
    await openLibrary();
    await screen.findByText('Setting 8');
    expect(screen.getByRole('searchbox', { name: 'Find a pack' })).toBeTruthy();
  });

  it('while a file waits in the preview, a pack button explains instead of being greyed out', async () => {
    addPack('Fen Rules', 'setting');
    const user = await openLibrary();
    const file = new File([JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Bog Rules', version: '1', kind: 'setting' }, items: [{ id: 'rope', name: 'Rope' }] })], 'bog.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import a file'), file);
    await screen.findByRole('heading', { name: 'Import Bog Rules?' });
    const browse = screen.getByRole('button', { name: 'Browse Fen Rules' });
    expect(browse.hasAttribute('disabled')).toBe(false);
    await user.click(browse);
    expect(await screen.findByText('Save or cancel the file above first.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Fen Rules' })).toBeNull();
  });
});
