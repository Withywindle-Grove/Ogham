// @vitest-environment jsdom
// A library entry's source line names its own pack (fix-library-source-and-count, fault 1; the Tester's walk of
// 2026-11-13). Browsing one pack outside a campaign (the Rules library's Browse, and the set-up step's Browse), the
// Rules browser had no campaign stack to read a pack's name from, so the line read "From your setting: other setting
// rules, 12". Two invented packs, each with entries; every name and number is invented.
//   In the Rules library, each pack's entry names its own pack: its short name, else its name.
//   A pack's sources map still titles a code (G-212): the book's title, without the short name before it.
//   In the new campaign's set-up step, a pack's Browse names the pack browsed.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { LibraryPack } from '../modules/library/library.ts';
import type { PackEntry } from '../modules/library/packFile.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { SetupPacksStep } from './CampaignSetupSteps.tsx';
import { LibraryScreen } from './LibraryScreen.tsx';

describe('a library entry’s source line names its own pack (fault 1)', () => {
  // Purpose: in the Rules library, each pack's entries name their own pack (short name, else name), never "other setting rules".
  it('the Rules library: each pack’s entry names its own pack', async () => {
    cleanup();
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.signInAs(gm);
    const add = (id: string, name: string, meta: Record<string, unknown>, sources: [string, string]) => {
      world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: meta, updated_at: '2026-10-20T12:00:00Z' });
      world.tables.library_entries.push({ id: `${id}-class`, pack_id: id, kind: 'class', pack_entry_id: `${id}-keeper`, name: `${name} Keeper`, data: { id: `${id}-keeper`, name: `${name} Keeper`, source: sources[0] } });
      world.tables.library_entries.push({ id: `${id}-item`, pack_id: id, kind: 'item', pack_entry_id: `${id}-lamp`, name: `${name} lamp`, data: { id: `${id}-lamp`, name: `${name} lamp`, source: sources[1] } });
    };
    add('pack-fen', 'Fen Rules', { id: 'fen-rules', shortName: 'Fen' }, ['12', '40']);
    add('pack-mire', 'Mire Zine', { id: 'mire-zine' }, ['7', '9']);
    const user = userEvent.setup();
    const line = () => screen.getByText(/^From your setting:/).textContent;
    const read = async (pack: string, group: string, entry: string) => {
      await user.click(screen.getByText(`${group}: 1`));
      await user.click(screen.getByRole('button', { name: entry }));
      await screen.findByRole('article', { name: entry });
      void pack;
    };

    render(<LibraryScreen db={world.db} user={{ id: gm, roles: {} }} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Browse Fen Rules' }));
    await screen.findByRole('heading', { name: 'Fen Rules' });
    await read('Fen Rules', 'Classes', 'Fen Rules Keeper');
    expect(line()).toBe('From your setting: Fen, 12');
    await user.click(screen.getByRole('button', { name: '‹ Back to the list' }));
    await read('Fen Rules', 'Items', 'Fen Rules lamp');
    expect(line()).toBe('From your setting: Fen, 40');
    cleanup();

    // The other pack, with no short name: its name serves.
    render(<LibraryScreen db={world.db} user={{ id: gm, roles: {} }} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Browse Mire Zine' }));
    await screen.findByRole('heading', { name: 'Mire Zine' });
    await read('Mire Zine', 'Classes', 'Mire Zine Keeper');
    expect(line()).toBe('From your setting: Mire Zine, 7');
    cleanup();
  });

  // Purpose: the pack's sources map still turns a code into its own book's title, with no short name before it (G-212).
  it('a coded source reads as the pack’s own book title', async () => {
    cleanup();
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.signInAs(gm);
    world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire Zine', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: { id: 'mire-zine', shortName: 'Mire', sourceTitles: { MZ: 'The Mire Ledger' } }, updated_at: '2026-10-20T12:00:00Z' });
    world.tables.library_entries.push({ id: 'mire-item', pack_id: 'pack-mire', kind: 'item', pack_entry_id: 'eel-lamp', name: 'Eel lamp', data: { id: 'eel-lamp', name: 'Eel lamp', source: 'MZ 4' } });
    world.tables.library_entries.push({ id: 'mire-spell', pack_id: 'pack-mire', kind: 'spell', pack_entry_id: 'glimmer', name: 'Glimmer', data: { id: 'glimmer', name: 'Glimmer', source: '30' } });
    const user = userEvent.setup();
    render(<LibraryScreen db={world.db} user={{ id: gm, roles: {} }} onBack={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Browse Mire Zine' }));
    await screen.findByRole('heading', { name: 'Mire Zine' });
    await user.click(screen.getByText('Items: 1'));
    await user.click(screen.getByRole('button', { name: 'Eel lamp' }));
    expect(screen.getByText(/^From your setting:/).textContent).toBe('From your setting: The Mire Ledger, 4');
    await user.click(screen.getByRole('button', { name: '‹ Back to the list' }));
    await user.click(screen.getByText('Spells: 1'));
    await user.click(screen.getByRole('button', { name: 'Glimmer' }));
    expect(screen.getByText(/^From your setting:/).textContent).toBe('From your setting: Mire, 30');
    cleanup();
  });

  // Purpose: the new campaign's set-up step browses a pack the same way, and its entries name the pack browsed.
  it('the set-up step’s Browse: the entry names the pack browsed', async () => {
    cleanup();
    const pack = (id: string, name: string, extraMeta: Record<string, unknown>): LibraryPack => ({
      id,
      ownerUserId: 'user-gm',
      name,
      version: '0.1',
      kind: 'setting',
      formatVersion: 2,
      source: '',
      importedAt: '2026-10-20T12:00:00Z',
      counts: { class: 1 },
      extraMeta,
      description: '',
      requires: [],
      words: {},
      usedBy: [],
    });
    const fen = pack('pack-fen', 'Fen Rules', { id: 'fen-rules', shortName: 'Fen' });
    const mire = pack('pack-mire', 'Mire Zine', { id: 'mire-zine' });
    const entriesOf = (p: LibraryPack): PackEntry[] => [{ kind: 'class', packEntryId: `${p.id}-keeper`, name: `${p.name} Keeper`, data: { id: `${p.id}-keeper`, name: `${p.name} Keeper`, source: p.id === 'pack-fen' ? '12' : '7' } }];
    const user = userEvent.setup();
    render(
      <SetupPacksStep
        library={[fen, mire]}
        picked={[]}
        hint=""
        onPick={() => {}}
        loadEntries={(p) => Promise.resolve(entriesOf(p))}
        onImport={() => {}}
        onBack={() => {}}
        onNext={() => {}}
        onCreateNow={() => {}}
        busy={false}
        counter={{ at: 2, of: 4 }}
      />,
    );
    for (const [name, line] of [['Fen Rules', 'From your setting: Fen, 12'], ['Mire Zine', 'From your setting: Mire Zine, 7']] as const) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
      const browse = within(await screen.findByRole('dialog', { name }));
      await user.click(await browse.findByText('Classes: 1'));
      await user.click(browse.getByRole('button', { name: `${name} Keeper` }));
      expect(browse.getByText(/^From your setting:/).textContent).toBe(line);
      await user.click(browse.getByRole('button', { name: /^Close/ }));
    }
    cleanup();
  });
});
