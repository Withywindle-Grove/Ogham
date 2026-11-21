// Pins for spells and traits (December step 13, row C8; Francis's yes pin-2), on the fake database. Invented names only.
// Purposes, each a plain sentence:
//   1. The owner pins a spell and a trait; the list keeps them in the order pinned and writes one event each.
//   2. Unpinning takes the entry out of the list and removes no row; Undo from the log puts it back.
//   2c. A pin given a place (a toast's Undo of an unpin) goes back there; a place past the end puts it last.
//   3. Pinning the same thing twice changes nothing: one entry, no second event.
//   4. An empty key and a kind that isn't spell or trait are refused, and nothing is written.
//   5. A 25th pin is refused with a reason; unpinning one makes room.
//   6. Another player, an outsider and (for a draft) even the owner can't pin; the GM can; a refusal writes no event.
//   7. A pin whose spell or trait the character no longer has is ignored by the reader, never an error; a stored
//      list with stray entries reads safely.
//   8. The log line says which spell or trait was pinned or unpinned.
//   Row P2 (euf-2, euf-4; plans/test-feedback-2026-11-19):
//   12. An ability or a trait without uses can be pinned and unpinned, by its name.
//   13. Moving a pin (`character.movePin`) changes the list's order and nothing else: the same pins, one event each, in
//       the detailed log (09, 2026-10-23: a rearrangement), the list in its new order.
//   14. A move past the end lands last; a move to where it already is writes nothing; one not pinned is refused.
//   15. The 25th pin is refused with the ruled words (pg28-5), and moving a pin at the limit still works.
//   16. Another player cannot move a pin on this character, and writes nothing.
//   16b. Pinning one already pinned, even with a place, changes nothing (a move is its own command).
//   17. The list's own order is the order shown: an ability without uses and traits with uses come out in the pins' order.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { movePin, pinToAtHand } from './pins.ts';
import { livePins, loadCharacterPlay, PIN_LIMIT, pinnedTraits, readPins, type LimitedAbility } from './playState.ts';

const registry = createAppRegistry();
let world: FakeWorld;
let gm: string;
let sam: string;
let jo: string;
let campaign: string;
let wren: { id: string; campaignId: string; ownerUserId: string | null };
const as = (id: string): CurrentUser => {
  world.signInAs(id);
  return { id, roles: { [campaign]: id === gm ? 'gm' : 'player' } };
};
const pins = async () => (await loadCharacterPlay(world.db, wren.id))?.pins;
const pin = (who: string, kind: 'spell' | 'trait', key: string, pinned = true) => runCommand(registry, world.db, as(who), pinToAtHand, { character: wren, kind, key, pinned });
const eventsOf = () => world.tables.events.filter((e) => e.type === 'character.pin');

beforeEach(() => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  jo = world.addPerson('jo@lantern.example', 'Jo');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player');
  world.addMember(campaign, jo, 'player');
  wren = { id: world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' }), campaignId: campaign, ownerUserId: sam };
});

describe('pinning a spell or a trait', () => {
  it('1. the owner pins a spell and a trait, kept in the order pinned, one event each', async () => {
    expect(await pin(sam, 'spell', 'mire-lamp')).toEqual({ ok: true, value: [{ kind: 'spell', key: 'mire-lamp' }] });
    await pin(sam, 'trait', 'night-eyes');
    expect(await pins()).toEqual([{ kind: 'spell', key: 'mire-lamp' }, { kind: 'trait', key: 'night-eyes' }]);
    expect(eventsOf()).toHaveLength(2);
  });

  it('2. unpinning takes the entry out of the list and removes no row; Undo puts it back', async () => {
    await pin(sam, 'spell', 'mire-lamp');
    await pin(sam, 'trait', 'night-eyes');
    const rows = world.tables.character_play.length;
    expect(await pin(sam, 'spell', 'mire-lamp', false)).toEqual({ ok: true, value: [{ kind: 'trait', key: 'night-eyes' }] });
    expect(world.tables.character_play).toHaveLength(rows);
    const unpin = eventsOf().at(-1)!;
    const undone = await runCommand(registry, world.db, as(sam), undoChange, { campaignId: campaign, eventId: String(unpin.id), authorUserId: sam });
    expect(undone.ok).toBe(true);
    expect(await pins()).toEqual([{ kind: 'spell', key: 'mire-lamp' }, { kind: 'trait', key: 'night-eyes' }]);
  });

  it('2b. the first pin on a character with no play row is a making: its Undo is refused in plain words, and unpinning works', async () => {
    expect(world.tables.character_play).toHaveLength(0);
    await pin(sam, 'spell', 'mire-lamp');
    const first = eventsOf().at(-1)!;
    const undone = await runCommand(registry, world.db, as(sam), undoChange, { campaignId: campaign, eventId: String(first.id), authorUserId: sam });
    expect(undone.ok).toBe(false);
    expect(!undone.ok && undone.message).toMatch(/can.?t be undone|cannot be undone/i);
    expect(world.tables.character_play).toHaveLength(1);
    expect(await pin(sam, 'spell', 'mire-lamp', false)).toEqual({ ok: true, value: [] });
  });

  it('2c. a forged non-boolean pinned never writes a pin', async () => {
    const forged = await runCommand(registry, world.db, as(sam), pinToAtHand, { character: wren, kind: 'spell', key: 'mire-lamp', pinned: 'yes' as never });
    expect(forged).toEqual({ ok: true, value: [] });
    expect(world.tables.character_play).toHaveLength(0);
  });

  // Purpose (the second review of the Player stack): a pin given a place (`at`) goes back there; a place past the end
  // puts it last, and a pin with no place goes last as before.
  it('2c. a pin with a place goes back there, and a place past the end puts it last', async () => {
    const put = (key: string, at?: number) => runCommand(registry, world.db, as(sam), pinToAtHand, { character: wren, kind: 'trait', key, pinned: true, ...(at === undefined ? {} : { at }) });
    await put('ember-ward');
    await put('fen-sight');
    await put('steady-flame', 1);
    await put('night-eyes', 99);
    expect((await pins())?.map((p) => p.key)).toEqual(['ember-ward', 'steady-flame', 'fen-sight', 'night-eyes']);
  });

  it('3. pinning the same thing twice, or unpinning what is not pinned, changes nothing and writes no event', async () => {
    await pin(sam, 'spell', 'mire-lamp');
    expect(await pin(sam, 'spell', 'mire-lamp')).toEqual({ ok: true, value: [{ kind: 'spell', key: 'mire-lamp' }] });
    expect(await pin(sam, 'trait', 'mire-lamp', false)).toMatchObject({ ok: true });
    expect(await pins()).toEqual([{ kind: 'spell', key: 'mire-lamp' }]);
    expect(eventsOf()).toHaveLength(1);
  });

  it('4. an empty key and an unknown kind are refused and nothing is written', async () => {
    expect(await pin(sam, 'spell', '   ')).toMatchObject({ ok: false, reason: 'failed' });
    expect(await runCommand(registry, world.db, as(sam), pinToAtHand, { character: wren, kind: 'item' as never, key: 'x', pinned: true })).toMatchObject({ ok: false, reason: 'failed' });
    expect(await pin(sam, 'trait', 'x'.repeat(81))).toMatchObject({ ok: false, reason: 'failed' });
    expect(world.tables.character_play).toHaveLength(0);
    expect(eventsOf()).toHaveLength(0);
  });

  it('5. a 25th pin is refused with a reason; unpinning one makes room', async () => {
    for (let n = 0; n < PIN_LIMIT; n += 1) expect((await pin(sam, 'spell', `spell-${n}`)).ok).toBe(true);
    const over = await pin(sam, 'trait', 'one-too-many');
    expect(over).toMatchObject({ ok: false, reason: 'failed' });
    expect(!over.ok && over.message).toBe('A character can have 24 pins. Unpin one to make room.');
    expect(await pin(sam, 'spell', 'spell-0', false)).toMatchObject({ ok: true });
    expect(await pin(sam, 'trait', 'one-too-many')).toMatchObject({ ok: true });
    expect(await pins()).toHaveLength(PIN_LIMIT);
  });
});

describe('who may pin', () => {
  it("6. another player and an outsider can't; the GM can; a refusal writes no event; a draft can't be pinned for", async () => {
    expect(await pin(jo, 'spell', 'mire-lamp')).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(world.tables.events).toHaveLength(0);
    expect(await pin(gm, 'trait', 'night-eyes')).toMatchObject({ ok: true });
    const draft = { id: world.addCharacter(campaign, 'Ash', { ownerId: sam, approval: 'draft' }), campaignId: campaign, ownerUserId: sam };
    const refused = await runCommand(registry, world.db, as(sam), pinToAtHand, { character: draft, kind: 'spell', key: 'mire-lamp', pinned: true });
    expect(refused.ok).toBe(false);
    expect(world.tables.character_play.filter((p) => p.actor_id === draft.id)).toHaveLength(0);
  });
});

describe('reading pins', () => {
  it('7. a pin whose spell or trait is gone is ignored, never an error; stray stored entries read safely', () => {
    const stored = [
      { kind: 'spell', key: 'mire-lamp' },
      { kind: 'spell', key: 'unlearned' },
      { kind: 'trait', key: 'gone-trait' },
      { kind: 'trait', key: 'night-eyes' },
      { kind: 'item', key: 'x' },
      { kind: 'spell', key: '' },
      { kind: 'spell', key: 'mire-lamp' },
      'nonsense',
      null,
    ];
    const read = readPins(stored);
    expect(read).toHaveLength(4);
    expect(livePins(read, { spell: (k) => k === 'mire-lamp', trait: (k) => k === 'night-eyes' })).toEqual([
      { kind: 'spell', key: 'mire-lamp' },
      { kind: 'trait', key: 'night-eyes' },
    ]);
    expect(livePins(read, { spell: () => false, trait: () => false })).toEqual([]);
    expect(readPins(undefined)).toEqual([]);
    expect(readPins({ kind: 'spell', key: 'a' })).toEqual([]);
  });

  it('8. a pin command still works when the list holds a pin whose thing is gone', async () => {
    world.tables.character_play.push({ actor_id: wren.id, campaign_id: campaign, prepared: [], uses_spent: {}, pins: [{ kind: 'spell', key: 'unlearned' }] });
    expect(await pin(sam, 'trait', 'night-eyes')).toEqual({ ok: true, value: [{ kind: 'spell', key: 'unlearned' }, { kind: 'trait', key: 'night-eyes' }] });
  });
});

describe('pinned traits leave their list (C8, the screen half)', () => {
  const trait = (name: string): LimitedAbility => ({ name, uses: 2, refill: 'day', note: '', from: 'class' });

  it('9. each trait shows once: a pinned one goes to At hand in the order pinned, the rest stay in the list in their own order', () => {
    const all = [trait('Steady flame'), trait('Horn charge'), trait('Second wind')];
    const pins = readPins([
      { kind: 'trait', key: 'Second wind' },
      { kind: 'spell', key: 'Steady flame' },
      { kind: 'trait', key: 'Gone power' },
      { kind: 'trait', key: 'Steady flame' },
    ]);
    const split = pinnedTraits(all, pins);
    expect(split.pinned.map((a) => a.name)).toEqual(['Second wind', 'Steady flame']);
    expect(split.rest.map((a) => a.name)).toEqual(['Horn charge']);
  });

  it('11. two traits of one name (a class’s and a kindred’s) both go to At hand when it is pinned, and neither is lost', () => {
    const fromClass = trait('Steady flame');
    const fromKindred: LimitedAbility = { ...trait('Steady flame'), from: 'race' };
    const other = trait('Horn charge');
    const split = pinnedTraits([fromClass, other, fromKindred], readPins([{ kind: 'trait', key: 'Steady flame' }]));
    expect(split.pinned).toEqual([fromClass, fromKindred]);
    expect(split.rest).toEqual([other]);
  });

  it('10. with no trait pins, every trait stays in the list and At hand gets none', () => {
    const all = [trait('Steady flame')];
    expect(pinnedTraits(all, [])).toEqual({ pinned: [], rest: all });
  });
});

describe('row P2: pins reach every ability and trait, in the player’s order', () => {
  const put = (who: string, key: string, at?: number) =>
    runCommand(registry, world.db, as(who), pinToAtHand, { character: wren, kind: 'trait', key, pinned: true, ...(at === undefined ? {} : { at }) });
  const move = (who: string, key: string, at: number) => runCommand(registry, world.db, as(who), movePin, { character: wren, key, at });
  const movesOf = () => world.tables.events.filter((e) => e.type === 'character.movePin');

  it('12. an ability or a trait without uses is pinned and unpinned by its name', async () => {
    expect(await put(sam, 'Sure-footed')).toEqual({ ok: true, value: [{ kind: 'trait', key: 'Sure-footed' }] });
    expect(await pin(sam, 'trait', 'Sure-footed', false)).toEqual({ ok: true, value: [] });
    expect(await pins()).toEqual([]);
  });

  it('13. moving a pin changes the list’s order and nothing else, with one event', async () => {
    for (const key of ['Horn charge', 'Sure-footed', 'Shield wall']) await put(sam, key);
    const before = eventsOf().length;
    expect(await move(sam, 'Shield wall', 0)).toMatchObject({ ok: true });
    expect((await pins())?.map((p) => p.key)).toEqual(['Shield wall', 'Horn charge', 'Sure-footed']);
    expect(await move(sam, 'Horn charge', 2)).toMatchObject({ ok: true });
    expect((await pins())?.map((p) => p.key)).toEqual(['Shield wall', 'Sure-footed', 'Horn charge']);
    expect(movesOf()).toHaveLength(2);
    expect(movesOf().every((e) => e.level === 'verbose')).toBe(true);
    expect(eventsOf()).toHaveLength(before);
    expect(world.tables.character_play).toHaveLength(1);
  });

  it('14. a move past the end lands last; a move to where it is writes nothing', async () => {
    for (const key of ['Horn charge', 'Sure-footed', 'Shield wall']) await put(sam, key);
    await move(sam, 'Horn charge', 99);
    expect((await pins())?.map((p) => p.key)).toEqual(['Sure-footed', 'Shield wall', 'Horn charge']);
    await move(sam, 'Horn charge', 2);
    await move(sam, 'Horn charge', 5);
    expect(movesOf()).toHaveLength(1);
    expect(await move(sam, 'Never pinned', 0)).toMatchObject({ ok: false, reason: 'failed', message: "Never pinned isn't pinned." });
    expect(movesOf()).toHaveLength(1);
  });

  it('15. the 25th pin is refused with the ruled words, and a move at the limit still works', async () => {
    for (let n = 0; n < PIN_LIMIT; n += 1) await put(sam, `Power ${n}`);
    const over = await put(sam, 'Shield wall');
    expect(over).toMatchObject({ ok: false, reason: 'failed', message: 'A character can have 24 pins. Unpin one to make room.' });
    expect(await move(sam, 'Power 23', 0)).toMatchObject({ ok: true });
    expect((await pins())?.[0]).toEqual({ kind: 'trait', key: 'Power 23' });
  });

  it('16. another player cannot move a pin on this character', async () => {
    for (const key of ['Horn charge', 'Sure-footed']) await put(sam, key);
    expect(await move(jo, 'Sure-footed', 0)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect((await pins())?.map((p) => p.key)).toEqual(['Horn charge', 'Sure-footed']);
    expect(movesOf()).toHaveLength(0);
  });

  it('16b. pinning one already pinned, even with a place, changes nothing', async () => {
    for (const key of ['Horn charge', 'Sure-footed']) await put(sam, key);
    const before = eventsOf().length;
    await put(sam, 'Sure-footed', 0);
    expect((await pins())?.map((p) => p.key)).toEqual(['Horn charge', 'Sure-footed']);
    expect(eventsOf()).toHaveLength(before);
  });

  it('17. abilities with and without uses come out in the pins’ order', () => {
    const things = [{ name: 'Horn charge', uses: 3 }, { name: 'Sure-footed' }, { name: 'Shield wall' }, { name: 'Second wind', uses: 1 }];
    const split = pinnedTraits(things, readPins([{ kind: 'trait', key: 'Shield wall' }, { kind: 'trait', key: 'Horn charge' }, { kind: 'trait', key: 'Sure-footed' }]));
    expect(split.pinned.map((t) => t.name)).toEqual(['Shield wall', 'Horn charge', 'Sure-footed']);
    expect(split.rest.map((t) => t.name)).toEqual(['Second wind']);
  });
});
