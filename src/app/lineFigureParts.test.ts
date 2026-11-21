// A weapon line's parts for its figures (as-4, #606 review). Invented names only.
import { describe, expect, it } from 'vitest';
import { lineFigureParts } from './CarrierItems.tsx';

describe('a weapon line’s figure parts', () => {
  // Purpose: the weapon skill reaches every line's figure, not only At hand's: a line with no mode and no magic worked
  // out (a stowed weapon) still carries its pack entry id and the class verdict, so its item sheet shows the same totals.
  it('carries the entry id and the class verdict with no mode and no magic', () => {
    expect(lineFigureParts(null, undefined, 'eel-spear', true)).toEqual({ attack: null, damageSource: null, entryId: 'eel-spear', classOk: true });
    expect(lineFigureParts(null, undefined, null, undefined)).toEqual({ attack: null, damageSource: null, entryId: null });
  });

  // Purpose: the magic, when worked out, rides with them.
  it('keeps the magic beside them', () => {
    const magic = { parts: [{ label: 'Fenblade, magic', value: 1 }], hitNotes: [], damageNotes: [] };
    expect(lineFigureParts(null, magic, 'fenblade', false)).toEqual({ attack: null, damageSource: null, magic, entryId: 'fenblade', classOk: false });
  });
});
