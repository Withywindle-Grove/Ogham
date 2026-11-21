// Which entry wins when setting rules disagree, and the order they stack in. Invented content only.
import { describe, expect, it } from 'vitest';
import { entryKey, moveInStack, placeNewPack, resolveStack, stackOrder, type StackPack } from './stack.ts';
import type { CampaignEntry } from './campaignPacks.ts';

const entry = (packId: string, kind: CampaignEntry['kind'], id: string, name = id): CampaignEntry => ({ packId, kind, packEntryId: id, name, data: { id, name } });
const pack = (packId: string, priority: number, overrides: Record<string, string> = {}, kind: StackPack['kind'] = 'setting'): StackPack => ({
  id: `link-${packId}`,
  packId,
  name: packId,
  priority,
  overrides,
  kind,
});

describe('resolving the stack', () => {
  it('the higher pack wins an entry both have; the other is listed as "also in"', () => {
    const resolved = resolveStack(
      [entry('river', 'class', 'warden', 'Warden (river)'), entry('fen', 'class', 'warden', 'Warden (fen)'), entry('fen', 'item', 'reed-mat')],
      [pack('river', 1), pack('fen', 2)],
    );
    expect(resolved.map((e) => [e.name, e.packId, e.alsoIn, e.preferred])).toEqual([
      ['Warden (fen)', 'fen', ['river'], false],
      ['reed-mat', 'fen', [], false],
    ]);
  });

  it('a GM’s exception picks a lower pack for that one entry only', () => {
    const resolved = resolveStack(
      [entry('river', 'class', 'warden'), entry('fen', 'class', 'warden'), entry('river', 'item', 'rope'), entry('fen', 'item', 'rope')],
      [pack('river', 1, { 'class:warden': 'Warden' }), pack('fen', 2)],
    );
    expect(resolved.map((e) => [e.kind, e.packId, e.alsoIn, e.preferred])).toEqual([
      ['class', 'river', ['fen'], true],
      ['item', 'fen', ['river'], false],
    ]);
  });

  it('the same id in two kinds is two different entries', () => {
    expect(resolveStack([entry('river', 'class', 'warden'), entry('fen', 'item', 'warden')], [pack('river', 1), pack('fen', 2)])).toHaveLength(2);
  });

  it('optional rules are each pack’s own and never compete', () => {
    expect(resolveStack([entry('river', 'option', 'oil'), entry('fen', 'option', 'oil')], [pack('river', 1), pack('fen', 2)])).toHaveLength(2);
  });

  it('equal priorities (after an odd undo) still give one stable answer', () => {
    const a = resolveStack([entry('river', 'class', 'w'), entry('fen', 'class', 'w')], [pack('river', 1), pack('fen', 1)]);
    const b = resolveStack([entry('fen', 'class', 'w'), entry('river', 'class', 'w')], [pack('fen', 1), pack('river', 1)]);
    expect(a[0]?.packId).toBe(b[0]?.packId);
  });

  it('keys are kind and id', () => {
    expect(entryKey({ kind: 'class', packEntryId: 'warden' })).toBe('class:warden');
  });
});

describe('the stack order', () => {
  const stack = [pack('home', 3, {}, 'homebrew'), pack('fen', 2), pack('river', 1)];

  it('moving a pack up or down swaps it with its neighbour; the ends stay put, and a pack never leaves its layer', () => {
    // Homebrew is its own layer, above every setting pack (ruled 2026-10-24).
    expect(moveInStack(stack, 'link-fen', 'up')).toEqual([]);
    expect(moveInStack(stack, 'link-fen', 'down')).toEqual([
      { id: 'link-fen', priority: 1 },
      { id: 'link-river', priority: 2 },
    ]);
    expect(moveInStack(stack, 'link-home', 'up')).toEqual([]);
    expect(moveInStack(stack, 'link-river', 'down')).toEqual([]);
  });

  it('homebrew always sorts above setting packs, whatever the numbers say', () => {
    expect(stackOrder([pack('fen', 9), pack('home', 1, {}, 'homebrew')]).map((p) => p.packId)).toEqual(['home', 'fen']);
  });

  it('ties are numbered out before moving', () => {
    expect(moveInStack([pack('a', 1), pack('b', 1)], 'link-b', 'up')).toEqual([{ id: 'link-b', priority: 2 }]);
  });

  it('new setting rules go on top, but under homebrew; new homebrew goes on top', () => {
    expect(placeNewPack(stack, 'setting')).toEqual({ priority: 3, shift: [{ id: 'link-home', priority: 4 }] });
    expect(placeNewPack(stack, 'homebrew')).toEqual({ priority: 4, shift: [] });
    expect(placeNewPack([pack('fen', 2), pack('river', 1)], 'setting')).toEqual({ priority: 3, shift: [] });
    expect(placeNewPack([], 'adventure')).toEqual({ priority: 1, shift: [] });
  });
});
