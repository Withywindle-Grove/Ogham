// @vitest-environment jsdom
// Review of #634 (December step 4a): the Rules browser leaves routes out until the Move on sheet (piece b) gives them
// words, so the GM never sees a "Routes" group listing raw ids. Invented entries only.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RulesBrowser, type BrowsedEntry } from './RulesBrowser.tsx';

afterEach(cleanup);

describe('the Rules browser and routes', () => {
  // Purpose: a pack with a class and two routes shows the GM a Classes group and no Routes group.
  it('shows the GM no Routes group, while the pack’s other kinds still show', () => {
    const entries: BrowsedEntry[] = [
      { kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden' }, packId: 'pack-mire' },
      { kind: 'route', packEntryId: 'mt-jetty-islet', name: 'mt-jetty-islet', data: { from: 'mt-jetty', to: 'mt-islet', travel: { value: 1, unit: 'turn' } }, packId: 'pack-mire' },
      { kind: 'route', packEntryId: 'mt-islet-sluice', name: 'mt-islet-sluice', data: { from: 'mt-islet', to: 'mt-sluice', travel: { value: 2, unit: 'turn' } }, packId: 'pack-mire' },
    ];
    render(<RulesBrowser entries={entries} gm />);
    expect(screen.getByText(/Classes: 1/)).toBeTruthy();
    expect(screen.queryByText(/Routes/)).toBeNull();
    expect(screen.queryByText(/mt-jetty-islet/)).toBeNull();
  });

  // Purpose: a pack's people (dec-3) are the town's, never a rules entry: the GM sees no People group and no name.
  it('shows the GM no People group', () => {
    const entries: BrowsedEntry[] = [
      { kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden' }, packId: 'pack-mire' },
      { kind: 'npc', packEntryId: 'mt-npc-hobb', name: 'Hobb of the weir', data: { id: 'mt-npc-hobb', role: 'eel-catcher' }, packId: 'pack-mire' },
    ];
    render(<RulesBrowser entries={entries} gm />);
    expect(screen.getByText(/Classes: 1/)).toBeTruthy();
    expect(screen.queryByText(/People/)).toBeNull();
    expect(screen.queryByText(/Hobb of the weir/)).toBeNull();
  });

  // Purpose: a pack's shops (dec-3, W9) are a place's, never a rules entry: the GM sees no Shops group and no name.
  it('shows the GM no Shops group', () => {
    const entries: BrowsedEntry[] = [
      { kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden' }, packId: 'pack-mire' },
      { kind: 'shop', packEntryId: 'mt-shop-stall', name: 'Lantern Warden’s stall', data: { id: 'mt-shop-stall', stock: [] }, packId: 'pack-mire' },
    ];
    render(<RulesBrowser entries={entries} gm />);
    expect(screen.getByText(/Classes: 1/)).toBeTruthy();
    expect(screen.queryByText(/Shops/)).toBeNull();
    expect(screen.queryByText(/stall/)).toBeNull();
  });
});
