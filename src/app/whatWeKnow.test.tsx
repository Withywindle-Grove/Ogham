// @vitest-environment jsdom
// What we know (M5b step 3, build order 4; S4-4): the players' card and panel of what the GM has shown. Invented
// places. A stand-in database answers the known_places call and the assets read.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../core/supabase.ts';
import { WhatWeKnow, earlierSummary, knownSummary } from './WhatWeKnow.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => cleanup());

function fakeDb(rows: Record<string, unknown>[]): Db {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order']) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return { rpc: async () => ({ data: rows, error: null }), from: () => chain } as unknown as Db;
}

describe('knownSummary', () => {
  // Purpose: the card's line counts places and pictures in plain words, with the right plurals.
  it('words the counts', () => {
    expect(knownSummary(0, 0)).toBe('Nothing shared yet');
    expect(knownSummary(1, 0)).toBe('1 place');
    expect(knownSummary(2, 1)).toBe('2 places, 1 map or handout');
    expect(knownSummary(0, 2)).toBe('2 maps and handouts');
    expect(knownSummary(2, 0, 3)).toBe('2 places, 3 earlier');
    expect(knownSummary(0, 0, 1)).toBe('1 earlier');
    expect(earlierSummary(1)).toBe('Earlier expeditions: 1 place');
  });
});

describe('the What we know card and panel', () => {
  // Purpose: with nothing shown, the card says so and the panel explains where things will gather.
  it('shows "Nothing shared yet" on the card and the panel when nothing was shown', async () => {
    render(<WhatWeKnow db={fakeDb([])} campaignId="camp" />);
    const card = await screen.findByRole('button', { name: 'What we know: Nothing shared yet' });
    await userEvent.setup().click(card);
    const panel = within(await screen.findByRole('dialog', { name: 'What we know' }));
    expect(panel.getByText(/Nothing shared yet\. Places and maps the GM shows you gather here\./)).toBeTruthy();
  });

  // Purpose: two pieces of one place and one piece of another count as two places, and the panel lists both places and every piece's text.
  it('counts each place once and lists the places with their pieces', async () => {
    const rows = [
      { current: true, place_id: 'p1', place_name: 'Moss Landing', piece_id: 'a', kind: 'read', body: 'A rotten pier.' },
      { current: true, place_id: 'p1', place_name: 'Moss Landing', piece_id: 'b', kind: 'read', body: 'Lanterns hang low.' },
      { current: true, place_id: 'p2', place_name: 'Reed Hollow', piece_id: 'c', kind: 'read', body: 'A silent ring of stones.' },
    ];
    render(<WhatWeKnow db={fakeDb(rows)} campaignId="camp" />);
    const card = await screen.findByRole('button', { name: 'What we know: 2 places' });
    await userEvent.setup().click(card);
    const panel = within(await screen.findByRole('dialog', { name: 'What we know' }));
    expect(panel.getByText('Moss Landing')).toBeTruthy();
    expect(panel.getByText('Reed Hollow')).toBeTruthy();
    expect(panel.getByText('A rotten pier.')).toBeTruthy();
    expect(panel.getByText('Lanterns hang low.')).toBeTruthy();
    expect(panel.getByText('A silent ring of stones.')).toBeTruthy();
  });

  // Purpose: an earlier expedition's place sits in a fold that starts closed, counted on the card as "earlier", and
  // a place shown again this expedition isn't repeated in the fold (ruled 2026-11-03).
  it('folds earlier expeditions\' places, closed by default', async () => {
    const rows = [
      { current: true, place_id: 'p2', place_name: 'Reed Hollow', piece_id: 'c', kind: 'read', body: 'A silent ring of stones.' },
      { current: false, place_id: 'p1', place_name: 'Moss Landing', piece_id: 'a', kind: 'read', body: 'A rotten pier.' },
      { current: false, place_id: 'p2', place_name: 'Reed Hollow', piece_id: 'd', kind: 'read', body: 'Seen before.' },
    ];
    render(<WhatWeKnow db={fakeDb(rows)} campaignId="camp" />);
    const card = await screen.findByRole('button', { name: 'What we know: 1 place, 1 earlier' });
    await userEvent.setup().click(card);
    const panel = within(await screen.findByRole('dialog', { name: 'What we know' }));
    const fold = panel.getByText('Earlier expeditions: 1 place').closest('details')!;
    expect(fold.open).toBe(false);
    expect(within(fold).getByText('Moss Landing')).toBeTruthy();
    expect(within(fold).queryByText('Reed Hollow')).toBeNull();
    expect(panel.getByText('Reed Hollow')).toBeTruthy();
  });
});
