import { describe, expect, it } from 'vitest';
import { clashLines, itemClashes, type ClashPack } from './clashes.ts';

const item = (id: string, name: string) => ({ kind: 'item', packEntryId: id, name });
const pack = (name: string, ...entries: ClashPack['entries'][number][]): ClashPack => ({ name, entries });

describe('the same item id in two packs', () => {
  // Purpose: a shared item id is one clash, naming both packs in order and the first pack's item name.
  it('gives one clash naming both packs in order, with the first pack’s item name', () => {
    const found = itemClashes([pack('Fen rules', item('marsh-pearl', 'Marsh pearl')), pack('Fen gear extras', item('marsh-pearl', 'Marsh pearl (polished)'))]);
    expect(found).toEqual([{ id: 'marsh-pearl', name: 'Marsh pearl', packs: ['Fen rules', 'Fen gear extras'] }]);
  });

  // Purpose: only items clash; a class sharing an id with an item is not a clash.
  it('does not count a non-item kind with the same id', () => {
    expect(itemClashes([pack('Fen rules', item('lantern', 'Lantern')), pack('Mire overlay', { kind: 'class', packEntryId: 'lantern', name: 'Lantern Warden' })])).toEqual([]);
  });

  // Purpose: a pack repeating its own id is not a clash with itself.
  it('counts a pack that repeats its own id once', () => {
    expect(itemClashes([pack('Fen rules', item('marsh-pearl', 'Marsh pearl'), item('marsh-pearl', 'Marsh pearl again'))])).toEqual([]);
    const found = itemClashes([pack('Fen rules', item('marsh-pearl', 'Marsh pearl'), item('marsh-pearl', 'Again')), pack('Mire overlay', item('marsh-pearl', 'Pearl'))]);
    expect(found[0]!.packs).toEqual(['Fen rules', 'Mire overlay']);
  });
});

describe('the clash lines of one pack', () => {
  // Purpose: the preview line reads "Name (id) · also in <pack>".
  it('words a clash as "Marsh pearl (marsh-pearl), also in Fen rules"', () => {
    expect(clashLines(pack('Fen gear extras', item('marsh-pearl', 'Marsh pearl')), [pack('Fen rules', item('marsh-pearl', 'Marsh pearl'))])).toEqual([
      'Marsh pearl (marsh-pearl), also in Fen rules',
    ]);
  });

  // Purpose: clashes among the other packs only are not this pack's business.
  it('lists only clashes where the pack given first has the id', () => {
    const lines = clashLines(pack('Fen gear extras', item('reed-lantern', 'Reed lantern')), [
      pack('Fen rules', item('marsh-pearl', 'Marsh pearl')),
      pack('Mire overlay', item('marsh-pearl', 'Marsh pearl')),
    ]);
    expect(lines).toEqual([]);
  });
});
