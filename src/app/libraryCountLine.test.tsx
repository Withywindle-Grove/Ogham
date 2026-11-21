// @vitest-environment jsdom
// The count line under a pack in the Rules library counts a rules set (lr-2a, 2026-11-13; first seen in the Tester's
// walk of 2026-11-13, reproduced on fix-library-source-and-count). Every name and number is invented.
//   A pack whose only content is a rules set says "1 rules set", as the attach step counts it, not "Nothing in it yet".
//   A pack that holds nothing at all still says "Nothing in it yet".
// The counts stay in the pack's own words (lr-2, "kindreds" when the pack says so): see rulesLibrary.test.tsx.
import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeDb } from '../testing/fakeDb.ts';
import { LibraryScreen } from './LibraryScreen.tsx';
import { countsLine } from './PackPreview.tsx';

describe('the library’s count line counts a rules set (lr-2a)', () => {
  // Purpose: a pack that holds only a rules set is not empty: its row counts it, as the attach step does.
  it('a pack with only a rules set says "1 rules set", not "Nothing in it yet"', async () => {
    cleanup();
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.signInAs(gm);
    world.tables.packs.push({ id: 'pack-house', owner_user_id: gm, campaign_id: null, name: 'House Rules', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: {}, updated_at: '2026-10-20T12:00:00Z' });
    world.tables.library_entries.push({ id: 'house-rules', pack_id: 'pack-house', kind: 'rulesSet', pack_entry_id: 'house', name: 'House', data: { id: 'house', name: 'House' } });
    render(<LibraryScreen db={world.db} user={{ id: gm, roles: {} }} onBack={() => {}} />);
    const row = (await screen.findByText('House Rules')).closest('li')!;
    expect(countsLine({ rulesSet: 1 })).toBe('1 rules set');
    expect(row.querySelector('.pack-row__holds')?.textContent).toBe('1 rules set');
    cleanup();
  });

  // Purpose: "Nothing in it yet" stays for a pack that truly holds nothing.
  it('a pack with no entries at all says "Nothing in it yet"', async () => {
    cleanup();
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.signInAs(gm);
    world.tables.packs.push({ id: 'pack-blank', owner_user_id: gm, campaign_id: null, name: 'Blank Notes', version: '0.1', kind: 'homebrew', format_version: 2, source: '', notes: '', extra_meta: {}, updated_at: '2026-10-20T12:00:00Z' });
    render(<LibraryScreen db={world.db} user={{ id: gm, roles: {} }} onBack={() => {}} />);
    const row = (await screen.findByText('Blank Notes')).closest('li')!;
    expect(row.querySelector('.pack-row__holds')?.textContent).toBe('Nothing in it yet');
    cleanup();
  });
});
