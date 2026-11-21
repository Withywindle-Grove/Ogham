// Who reads a patch (look-back reviews of #437, approved by Francis 2026-11-10; hard rule 5): the app's mirror of
// private.player_facing_entry and private.patch_open_to_me, used by the fake database. Invented content only.
import { describe, expect, it } from 'vitest';
import { playerFacingEntry } from './packFile.ts';

describe('who reads a patch (hard rule 5)', () => {
  // Purpose: a patch that changes a rules set's GM-only section (its monsters, magic items, procedures or GM
  // reference) is the GM's alone, while a patch on an open section of a rules set still reaches players.
  it("a patch on a rules set's monsters is the GM's; one on its encumbrance is everyone's", () => {
    expect(playerFacingEntry('patch', { byOption: 'mire-depth=deep', match: { kind: 'rulesSet' }, change: { 'encumbrance.maxLoadCoin': { delta: 100 } } })).toBe(true);
    for (const head of ['monsters', 'magicItems', 'procedures', 'gmReference']) {
      expect(playerFacingEntry('patch', { byOption: 'mire-depth=deep', match: { kind: 'rulesSet' }, change: { [`${head}.bog-lurker.hd`]: { delta: 1 } } }), head).toBe(false);
    }
    // Written with stray spaces, as the app trims them before applying it.
    expect(playerFacingEntry('patch', { byOption: 'mire-depth=deep', match: { kind: 'rulesSet' }, change: { ' monsters.bog-lurker.hd ': { delta: 1 } } })).toBe(false);
  });

  // Purpose: a patch that rewrites an entry's own list of GM-only fields is the GM's alone.
  it("a patch that changes an entry's gmOnly list is the GM's", () => {
    expect(playerFacingEntry('patch', { byOption: 'mire-depth=deep', match: { kind: 'item', category: 'gear' }, change: { gmOnly: ['cost'] } })).toBe(false);
  });

  // Purpose: a patch naming items reaches a player only when the player may read every one of them; a patch on a
  // whole category names no item and stays the players'.
  it('a patch naming an item the reader may not read is the GM’s; a category patch is everyone’s', () => {
    const facing = playerFacingEntry as (kind: string, data: unknown, targets?: unknown) => boolean;
    const targets = { itemReadable: (id: string) => id !== 'cursed-blade', hiddenKeys: () => [] as string[] };
    expect(facing('patch', { byOption: 'mire-metals=bronze', match: { kind: 'item', ids: ['bog-lantern'] }, change: { cost: { delta: 1 } } }, targets)).toBe(true);
    expect(facing('patch', { byOption: 'mire-metals=bronze', match: { kind: 'item', ids: ['bog-lantern', 'cursed-blade'] }, change: { cost: { delta: 1 } } }, targets)).toBe(false);
    expect(facing('patch', { byOption: 'mire-metals=bronze', match: { kind: 'item', ids: ['cursed-blade'] }, option: null }, targets)).toBe(false);
    expect(facing('patch', { byOption: 'mire-metals=bronze', match: { kind: 'item', category: 'weapon' }, change: { cost: { delta: 1 } } }, targets)).toBe(true);
  });

  // Purpose: a patch that changes a field an entry it matches keeps GM-only is the GM's alone (the safe reading: the
  // patch's figure would tell players the hidden field is there), while one on an open field reaches players.
  it('a patch on a field a matched entry keeps GM-only is the GM’s; one on an open field is everyone’s', () => {
    const facing = playerFacingEntry as (kind: string, data: unknown, targets?: unknown) => boolean;
    const targets = { itemReadable: () => true, hiddenKeys: () => ['curse'] };
    expect(facing('patch', { byOption: 'mire-metals=bronze', match: { kind: 'item', ids: ['eel-lamp'] }, change: { 'curse.words': 'Smells of mud' } }, targets)).toBe(false);
    expect(facing('patch', { byOption: 'mire-metals=bronze', match: { kind: 'item', ids: ['eel-lamp'] }, change: { cost: { delta: 1 } } }, targets)).toBe(true);
  });
});
