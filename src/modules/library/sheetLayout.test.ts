// A pack's sheet layouts as "Use this sheet layout" adds them (docs/07 fieldTemplates). Invented setting.
import { describe, expect, it } from 'vitest';
import type { PackEntry } from './packFile.ts';
import { layoutFields } from './sheetLayout.ts';

const layout = (fields: unknown[], appliesTo = 'pc') => ({ kind: 'fieldTemplate', id: 'river-sheet', name: 'river-sheet', data: { id: 'river-sheet', appliesTo, fields } }) as unknown as PackEntry;

describe('layoutFields()', () => {
  // M4b gate (2026-10-25): the layout's Race field sat beside the character's own race.
  it("leaves out ref fields (the race the character already has) and NPC layouts; keeps the rest in order", () => {
    const fields = [
      { key: 'GRIT', label: 'Grit', type: 'number' },
      { key: 'kin', label: 'Kin', type: 'ref' },
      { key: 'motto', label: 'Motto', type: 'text' },
    ];
    expect(layoutFields([layout(fields), layout([{ key: 'bite', label: 'Bite' }], 'npc')]).map((f) => f.label)).toEqual(['Grit', 'Motto']);
  });
});
