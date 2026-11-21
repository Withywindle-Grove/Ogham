// A campaign that doesn't track alignment (no visible alignment field, so no alignment names) closes no patron
// (local review of #665, Important 1, 2026-11-12). Invented names only.
import { describe, expect, it } from 'vitest';
import { patronFit } from './patrons.ts';

describe('patronFit without the campaign alignment names', () => {
  // Purpose: when the campaign has no alignment names (no alignment field, or its field list is still loading),
  // a class's hard limit closes nothing, so a patron whose followers don't share the limit stays open.
  it('keeps a hard-limited patron open when the campaign has no alignments', () => {
    const fit = patronFit({ alignments: ['Mire'] }, { names: ['Lantern', 'Reed'], soft: false }, []);
    expect(fit).toBe('ok');
  });
});
