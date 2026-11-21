// The one-line description under each character field in the GM's field list (docs/05). Invented fields.
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { describeField } from './FieldsEditor.tsx';

const field = (extra: Partial<FieldDefinition>) => ({ key: 'grit', label: 'Grit', type: 'number', choices: [], group: '', showOnCard: false, hidden: false, required: false, ...extra }) as FieldDefinition;

describe('describeField()', () => {
  // M4b gate (2026-10-25): the list said "all are optional" though a sheet layout can require a field.
  it('names the type, group, card and whether the field is required', () => {
    expect(describeField(field({ group: 'Abilities', showOnCard: true, required: true }))).toBe('Number, Abilities, on the card, required');
    expect(describeField(field({}))).toBe('Number');
  });
});
