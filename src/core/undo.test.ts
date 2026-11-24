// Which log lines offer Undo (ruled 2026-10-25): changes, plus the deletions with a copy kept (drops and gifts
// outside the party), where a line made and removed at once (part of a stack given away) doesn't block it.
import { describe, expect, it } from 'vitest';
import { mayUndo, undoOffered } from './undo.ts';

const change = (targetId: string) => ({ targetId, before: { qty: 6 }, after: { qty: 4 } });
const made = (targetId: string) => ({ targetId, before: null, after: { qty: 2 } });
const removed = (targetId: string) => ({ targetId, before: { qty: 2 }, after: null });

describe('mayUndo', () => {
  it('a change can be undone; making something or deleting it, in general, cannot', () => {
    expect(mayUndo('inventory.equip', [change('a')])).toBe(true);
    expect(mayUndo('inventory.add', [made('a')])).toBe(false);
    expect(mayUndo('notes.delete', [removed('a')])).toBe(false);
  });

  it('a drop, a whole gift outside the party and a declined one-off can be undone', () => {
    expect(mayUndo('inventory.remove', [removed('a')])).toBe(true);
    expect(mayUndo('inventory.decline', [removed('a')])).toBe(true);
    expect(mayUndo('inventory.giveAway', [change('a'), removed('a')])).toBe(true);
  });

  it('part of a stack given away (split off, then removed) can be undone; a line made and kept cannot', () => {
    expect(mayUndo('inventory.giveAway', [change('a'), made('b'), removed('b')])).toBe(true);
    expect(mayUndo('inventory.giveAway', [change('a'), made('b')])).toBe(false);
  });

  it('part of a stack moved (split off and handed on) can be undone (ruled 2026-10-26); other makings cannot', () => {
    expect(mayUndo('inventory.move', [change('a'), made('b'), change('b')])).toBe(true);
    expect(mayUndo('inventory.add', [made('b')])).toBe(false);
  });

  it('starting a session or an expedition can be undone (the record is marked undone, M5 step 5); deleting one cannot', () => {
    expect(mayUndo('session.start', [made('s')])).toBe(true);
    expect(mayUndo('expedition.start', [made('x'), change('campaign')])).toBe(true);
    expect(mayUndo('expedition.start', [removed('x')])).toBe(false);
    expect(mayUndo('session.end', [made('s')])).toBe(false);
  });
});

// Purpose (Francis, 2026-11-24, "yes to both questions", #77's ⚑ 4): a log line the database wrote with no person on
// it (the link it empties when an account is deleted) offers no Undo, not even to the GM; a person's line still offers
// it to the GM and to that person, and to no other player.
describe('undoOffered', () => {
  it.fails('a line with no person on it offers no Undo; a person\'s line offers it to the GM and to them', () => {
    expect(undoOffered(null, { gm: true, userId: 'user-gm' })).toBe(false);
    expect(undoOffered(null, { gm: false, userId: 'user-wren' })).toBe(false);
    expect(undoOffered('user-wren', { gm: true, userId: 'user-gm' })).toBe(true);
    expect(undoOffered('user-wren', { gm: false, userId: 'user-wren' })).toBe(true);
    expect(undoOffered('user-wren', { gm: false, userId: 'user-ash' })).toBe(false);
  });
});
