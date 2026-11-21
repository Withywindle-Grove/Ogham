// A pack's link marks (pf-5, dec-pack-formats-2026-11-11): never shown raw. Invented text only.
import { describe, expect, it } from 'vitest';
import { linkParts, linksIn, plainLinks } from './linkMarks.ts';

describe('link marks', () => {
  // Purpose: a mark reads as its label wherever a link isn't a tap; text without marks is untouched.
  it('shows a mark as its label', () => {
    expect(plainLinks('Ruled by [[npc:halewyn|Warden Halewyn]], for the [[place:wardens-hall|Heron Wardens]].')).toBe('Ruled by Warden Halewyn, for the Heron Wardens.');
    expect(plainLinks('No marks here: p. 64.')).toBe('No marks here: p. 64.');
  });

  // Purpose: a mark with no label shows its id as words, never the brackets or the kind.
  it("shows a mark without a label as its id's words", () => {
    expect(plainLinks('See [[table:quay-rumours]].')).toBe('See quay rumours.');
  });

  // Purpose: each link is read whole (kind, pack, id, label), another pack's id kept apart from the id.
  it('reads each link', () => {
    expect(linksIn('[[table:quay-rumours|Rumours]] and [[statBlock:reed-port:heron-warden|Heron warden]]')).toEqual([
      { kind: 'table', packId: '', id: 'quay-rumours', label: 'Rumours' },
      { kind: 'statBlock', packId: 'reed-port', id: 'heron-warden', label: 'Heron warden' },
    ]);
    expect(linkParts('a [[place:x|X]] b').map((p) => p.text)).toEqual(['a ', 'X', ' b']);
  });

  // Purpose: a half-written mark isn't a link; it stays as written rather than vanishing.
  it('leaves a broken mark as written', () => {
    expect(plainLinks('Broken [[table:x|y and more')).toBe('Broken [[table:x|y and more');
  });
});
