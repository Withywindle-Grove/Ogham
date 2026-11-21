// The alignment readers (M5b step 0c, slice 1): the alignment goes back into fields when the reader may see it.
import { describe, expect, it } from 'vitest';
import { withAlignment } from './alignments.ts';

describe('withAlignment', () => {
  it('puts the alignment back into the fields when the reader may see it', () => {
    expect(withAlignment({ MUS: 12 }, 'Lantern')).toEqual({ MUS: 12, alignment: 'Lantern' });
  });

  it('leaves the fields as they are when there is none to see (hidden by the setting, or not set)', () => {
    const fields = { MUS: 12 };
    expect(withAlignment(fields, undefined)).toBe(fields);
  });

  it('makes a record out of fields that are not one', () => {
    expect(withAlignment(null, 'Reed')).toEqual({ alignment: 'Reed' });
  });
});
