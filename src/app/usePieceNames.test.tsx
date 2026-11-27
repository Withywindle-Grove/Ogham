// @vitest-environment jsdom
// The GM's piece names (Q7) when the campaign's entries can't be read (#109's CI review, nit 1). Invented ids.
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../core/supabase.ts';
import type { Piece } from '../modules/expedition/placePlay.ts';
import { gmFactLine, usePieceNames } from './PlaceCard.tsx';

const load = vi.hoisted(() => vi.fn());
vi.mock('./campaignSetting.ts', async (importOriginal) => ({ ...(await importOriginal<typeof import('./campaignSetting.ts')>()), loadCampaignPacksAndEntries: load }));

// Node's own process, where an unhandled rejection is reported (the app's types leave Node out).
const node = (globalThis as unknown as { process: { on(event: string, f: (reason: unknown) => void): void; off(event: string, f: (reason: unknown) => void): void } }).process;

afterEach(() => {
  cleanup();
  load.mockReset();
});

const arrows: Piece = { id: 'p-arrows', kind: 'treasure', text: 'A quiver under the bench.', shown: false, shownAt: null, gm: { value: '40 herons, Item: silver-tipped-arrows', trigger: '', statLine: '' }, version: 1 };

describe('the names of the pack entries a piece names (Q7)', () => {
  // Purpose: when the campaign's entries can't be read, the read settles with no unhandled rejection, and a pack-made
  // place keeps its value line with the unknown id left out ("Value stays yours (40 herons)."), never the id.
  it('settles with no names when the entries cannot be read', async () => {
    load.mockRejectedValue(new Error('offline'));
    const unhandled: unknown[] = [];
    const note = (reason: unknown) => unhandled.push(reason);
    node.on('unhandledRejection', note);
    try {
      const { result } = renderHook(() => usePieceNames({} as Db, 'camp-1', [arrows], 'pack-reed'));
      await waitFor(() => expect(load).toHaveBeenCalled());
      await new Promise((done) => setTimeout(done, 20));
      expect(unhandled).toEqual([]);
      expect(result.current.packId).toBe('pack-reed');
      expect(gmFactLine(arrows, result.current)).toBe('Value stays yours (40 herons).');
    } finally {
      node.off('unhandledRejection', note);
    }
  });
});
