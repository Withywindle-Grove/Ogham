// A character's magic as state (December step 8, piece A), on the fake database and as pure rules. Invented names only.
// Purposes, each a plain sentence:
//   1. Choosing spells changes what is chosen for the next rest and leaves what is ready today alone.
//   2. A choice that doesn't fit the slots is refused with the level that is full, and nothing is saved.
//   3. Same as yesterday makes today's ready spells the choice for the next rest in one step, and gives back the choice
//      before it for Undo.
//   4. Casting marks one casting of a spell ready twice, not both; undoing the cast gives that one back.
//   5. Casting the last casting twice (two devices) succeeds once; the second is refused in the spell's name.
//   6. A spell that isn't ready can't be cast, and one never cast can't be given back.
//   7. A player can't cast or choose another player's spells; the GM can; every allowed change writes an event and a
//      refused one writes none.
//   8. Only the GM sets anyone's spells; a new ready set keeps the casts of the spells still ready; it gives back all
//      three as they were, so running it again with them is the Undo.
//   9. The rules B, C and D read: a row a ready spell with its castings (never more cast than ready), what the next
//      rest makes ready (the chosen set, or today's when nothing new is chosen), and the state after a rest.
//  10. The first spells (fsr-1 to fsr-7): a caster who has never rested and has cast nothing has what they choose ready at
//      once, tap after tap; a cast, a rest or the GM's set closes them and a choice waits again; Undo of the cast or of
//      the set opens them again; a list that doesn't fit is refused as before; a clear changes nothing ready; a
//      character with no row yet reads as open.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { undoChange } from '../../core/undo.ts';
import { afterRest, castSpell, chooseSpells, firstSpellsOpen, nextReady, readySpells, sameAsYesterday, setSpells, trimCasts, uncastSpell } from './magicState.ts';
import { loadCharacterPlay } from './playState.ts';

const registry = createAppRegistry();
let world: FakeWorld;
let gm: string;
let sam: string;
let jo: string;
let campaign: string;
let wren: { id: string; campaignId: string; ownerUserId: string | null };
let ash: { id: string; campaignId: string; ownerUserId: string | null };
const as = (id: string): CurrentUser => {
  world.signInAs(id);
  return { id, roles: { [campaign]: id === gm ? 'gm' : 'player' } };
};
const play = () => loadCharacterPlay(world.db, wren.id);
const ready = (spells: { spell: string; level: number }[], spellsCast: Record<string, number> = {}) => {
  world.tables.character_play = world.tables.character_play.filter((p) => p.actor_id !== wren.id);
  world.tables.character_play.push({ actor_id: wren.id, campaign_id: campaign, prepared: spells, uses_spent: {}, chosen: null, spells_cast: spellsCast });
};
const eventsOf = (type: string) => world.tables.events.filter((e) => e.type === type);

beforeEach(() => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  jo = world.addPerson('jo@lantern.example', 'Jo');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player');
  world.addMember(campaign, jo, 'player');
  wren = { id: world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' }), campaignId: campaign, ownerUserId: sam };
  ash = { id: world.addCharacter(campaign, 'Ash', { ownerId: jo, approval: 'approved' }), campaignId: campaign, ownerUserId: jo };
});

describe('choosing for the next rest', () => {
  it('1. changes what is chosen and leaves what is ready today alone', async () => {
    ready([{ spell: 'mire-lamp', level: 1 }]);
    const chosen = [{ spell: 'fog-ring', level: 1 }, { spell: 'fog-ring', level: 1 }];
    expect(await runCommand(registry, world.db, as(sam), chooseSpells, { character: wren, chosen, slots: [2] })).toMatchObject({ ok: true });
    expect(await play()).toMatchObject({ prepared: [{ spell: 'mire-lamp', level: 1 }], chosen });
    expect(eventsOf('character.chooseSpells')).toHaveLength(1);
    // Undo: the same command with the choice before (none).
    expect(await runCommand(registry, world.db, as(sam), chooseSpells, { character: wren, chosen: null, slots: [2] })).toMatchObject({ ok: true });
    expect((await play())?.chosen).toBeNull();
  });

  it('2. a choice that overfills a level is refused, and nothing is saved', async () => {
    ready([]);
    const result = await runCommand(registry, world.db, as(sam), chooseSpells, { character: wren, chosen: [{ spell: 'a', level: 1 }, { spell: 'b', level: 1 }], slots: [1] });
    expect(result).toMatchObject({ ok: false, reason: 'failed' });
    expect(!result.ok && result.message).toMatch(/^Level 1 has 1 slot/);
    expect((await play())?.chosen).toBeNull();
    expect(eventsOf('character.chooseSpells')).toHaveLength(0);
  });

  it('3. Same as yesterday chooses today’s ready spells in one step and gives back the choice before', async () => {
    const today = [{ spell: 'mire-lamp', level: 1 }, { spell: 'fog-ring', level: 2 }];
    ready(today);
    await runCommand(registry, world.db, as(sam), chooseSpells, { character: wren, chosen: [{ spell: 'reed-song', level: 1 }], slots: [1, 1] });
    const picked = await runCommand(registry, world.db, as(sam), sameAsYesterday, { character: wren });
    expect(picked).toEqual({ ok: true, value: { chosen: today, before: [{ spell: 'reed-song', level: 1 }] } });
    expect(await play()).toMatchObject({ prepared: today, chosen: today });
    expect(eventsOf('character.sameAsYesterday')).toHaveLength(1);
  });
});

describe('casting', () => {
  it('4. a cast marks one casting of a spell ready twice; its undo gives that one back', async () => {
    ready([{ spell: 'mire-lamp', level: 1 }, { spell: 'mire-lamp', level: 1 }]);
    const spell = { character: wren, spell: 'mire-lamp', level: 1, name: 'Mire lamp' };
    expect(await runCommand(registry, world.db, as(sam), castSpell, spell)).toEqual({ ok: true, value: { '1:mire-lamp': 1 } });
    expect(readySpells((await play())!)).toEqual([{ spell: 'mire-lamp', level: 1, times: 2, cast: 1 }]);
    expect(await runCommand(registry, world.db, as(sam), uncastSpell, spell)).toEqual({ ok: true, value: {} });
    expect(readySpells((await play())!)).toEqual([{ spell: 'mire-lamp', level: 1, times: 2, cast: 0 }]);
    expect(eventsOf('character.castSpell')).toHaveLength(1);
    expect(eventsOf('character.uncastSpell')).toHaveLength(1);
  });

  it('5. the last casting cast twice: the first succeeds, the second is refused in the spell’s name', async () => {
    ready([{ spell: 'mire-lamp', level: 1 }]);
    const spell = { character: wren, spell: 'mire-lamp', level: 1, name: 'Mire lamp' };
    const [first, second] = [await runCommand(registry, world.db, as(sam), castSpell, spell), await runCommand(registry, world.db, as(gm), castSpell, spell)];
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, reason: 'failed', message: 'Every casting of Mire lamp is spent.' });
    expect(eventsOf('character.castSpell')).toHaveLength(1);
  });

  it("6. a spell that isn't ready can't be cast; one never cast can't be given back", async () => {
    ready([{ spell: 'mire-lamp', level: 1 }]);
    expect(await runCommand(registry, world.db, as(sam), castSpell, { character: wren, spell: 'mire-lamp', level: 2 })).toMatchObject({ ok: false, message: "That spell isn't ready." });
    expect(await runCommand(registry, world.db, as(sam), uncastSpell, { character: wren, spell: 'mire-lamp', level: 1, name: 'Mire lamp' })).toMatchObject({
      ok: false,
      message: "Mire lamp hasn't been cast.",
    });
  });

  it("7. another player can't cast or choose Wren's spells; the GM can; a refusal writes no event", async () => {
    ready([{ spell: 'mire-lamp', level: 1 }]);
    expect(await runCommand(registry, world.db, as(jo), castSpell, { character: wren, spell: 'mire-lamp', level: 1 })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await runCommand(registry, world.db, as(jo), chooseSpells, { character: wren, chosen: [], slots: [1] })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(world.tables.events).toHaveLength(0);
    expect(await runCommand(registry, world.db, as(gm), castSpell, { character: wren, spell: 'mire-lamp', level: 1 })).toMatchObject({ ok: true });
    expect(registry.can(as(gm), 'character.chooseSpells', ash)).toBe(true);
    expect(registry.can(as(jo), 'character.chooseSpells', ash)).toBe(true);
  });
});

describe("the GM's set", () => {
  it('8. only the GM sets spells; casts of spells still ready stay; it gives back what was, for Undo', async () => {
    ready([{ spell: 'mire-lamp', level: 1 }, { spell: 'mire-lamp', level: 1 }, { spell: 'fog-ring', level: 2 }], { '1:mire-lamp': 2, '2:fog-ring': 1 });
    expect(await runCommand(registry, world.db, as(sam), setSpells, { character: wren, ready: [] })).toMatchObject({ ok: false, reason: 'not-allowed' });
    const now = [{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-song', level: 1 }];
    const set = await runCommand(registry, world.db, as(gm), setSpells, { character: wren, ready: now });
    expect(set).toEqual({
      ok: true,
      value: { ready: [{ spell: 'mire-lamp', level: 1 }, { spell: 'mire-lamp', level: 1 }, { spell: 'fog-ring', level: 2 }], chosen: null, spellsCast: { '1:mire-lamp': 2, '2:fog-ring': 1 } },
    });
    expect(await play()).toMatchObject({ prepared: now, chosen: null, spellsCast: { '1:mire-lamp': 1 } });
    // Undo: the set again with all three as they were.
    if (!set.ok) throw new Error('set failed');
    expect(await runCommand(registry, world.db, as(gm), setSpells, { character: wren, ...set.value })).toMatchObject({ ok: true });
    expect(await play()).toMatchObject({ prepared: set.value.ready, spellsCast: { '1:mire-lamp': 2, '2:fog-ring': 1 } });
    expect(eventsOf('character.setSpells')).toHaveLength(2);
  });
});

describe('the rules the screens read', () => {
  it('9. a row a ready spell, castings never above it; the next rest makes the chosen set ready, or today’s; a rest clears the casts', () => {
    const today = [{ spell: 'mire-lamp', level: 2 }, { spell: 'fog-ring', level: 1 }, { spell: 'mire-lamp', level: 2 }];
    expect(readySpells({ prepared: today, spellsCast: { '2:mire-lamp': 5, '1:gone': 1 } })).toEqual([
      { spell: 'fog-ring', level: 1, times: 1, cast: 0 },
      { spell: 'mire-lamp', level: 2, times: 2, cast: 2 },
    ]);
    expect(readySpells({ prepared: [], spellsCast: {} })).toEqual([]);
    const chosen = [{ spell: 'reed-song', level: 1 }];
    expect(nextReady({ prepared: today, chosen: null })).toBe(today);
    expect(nextReady({ prepared: today, chosen })).toBe(chosen);
    expect(nextReady({ prepared: today, chosen: [] })).toEqual([]);
    expect(afterRest({ prepared: today, chosen })).toEqual({ prepared: chosen, chosen: null, spellsCast: {} });
    expect(afterRest({ prepared: today, chosen: null })).toEqual({ prepared: today, chosen: null, spellsCast: {} });
    expect(trimCasts({ '2:mire-lamp': 3, '1:fog-ring': 1, '1:gone': 2 }, today)).toEqual({ '2:mire-lamp': 2, '1:fog-ring': 1 });
  });
});

describe('the first spells (fsr-1 to fsr-7; page 46)', () => {
  const lamp = [{ spell: 'mire-lamp', level: 1 }];
  const fog = [{ spell: 'fog-ring', level: 1 }];
  const two = [{ spell: 'mire-lamp', level: 1 }, { spell: 'fog-ring', level: 1 }];
  // A row that says it has never rested (a row made from now on), with what is ready and cast.
  const unrested = (spells: { spell: string; level: number }[] = [], spellsCast: Record<string, number> = {}) => {
    world.tables.character_play = world.tables.character_play.filter((p) => p.actor_id !== wren.id);
    world.tables.character_play.push({ actor_id: wren.id, campaign_id: campaign, prepared: spells, uses_spent: {}, chosen: null, spells_cast: spellsCast, rested_once: false });
  };
  const choose = (chosen: { spell: string; level: number }[] | null, who = sam) => runCommand(registry, world.db, as(who), chooseSpells, { character: wren, chosen, slots: [2] });
  const spell = () => ({ character: wren, spell: 'mire-lamp', level: 1, name: 'Mire lamp' });
  const undoLast = async (type: string) => {
    const line = eventsOf(type).at(-1)!;
    return runCommand(registry, world.db, as(gm), undoChange, { campaignId: campaign, eventId: String(line.id), authorUserId: (line.actor_user_id as string | null) ?? null });
  };

  // Purpose: a character with no row yet reads as open, and their first choice is ready at once, nothing left chosen.
  it('10a. no row yet: open, and a choice becomes what is ready, with nothing left chosen for a rest', async () => {
    expect(firstSpellsOpen((await play())!)).toBe(true);
    expect(await choose(two)).toMatchObject({ ok: true });
    expect(await play()).toMatchObject({ prepared: two, chosen: null, restedOnce: false });
    expect(eventsOf('character.chooseSpells')).toHaveLength(1);
  });

  // Purpose: the next tap does the same: the state outlasts one save, and a second choice replaces what is ready.
  it('10b. the next choice replaces what is ready again', async () => {
    await choose(lamp);
    await choose(two);
    expect(await play()).toMatchObject({ prepared: two, chosen: null });
  });

  // Purpose: after a cast, a choice waits for the rest and what is ready stays (fsr-7); the cast's Undo opens them again.
  it('10c. after a cast a choice waits; undoing the cast makes the next choice ready at once', async () => {
    unrested(lamp);
    await runCommand(registry, world.db, as(sam), castSpell, spell());
    expect(firstSpellsOpen((await play())!)).toBe(false);
    await choose(fog);
    expect(await play()).toMatchObject({ prepared: lamp, chosen: fog });
    await runCommand(registry, world.db, as(sam), uncastSpell, spell());
    expect(firstSpellsOpen((await play())!)).toBe(true);
    await choose(two);
    expect(await play()).toMatchObject({ prepared: two, chosen: null });
  });

  // Purpose: cast, Undo, cast again follows the casts as they stand: open, closed, open, closed (finding 6).
  it('10d. cast, Undo, cast again: open, closed, open, closed', async () => {
    unrested(lamp);
    const seen = [firstSpellsOpen((await play())!)];
    await runCommand(registry, world.db, as(sam), castSpell, spell());
    seen.push(firstSpellsOpen((await play())!));
    await runCommand(registry, world.db, as(sam), uncastSpell, spell());
    seen.push(firstSpellsOpen((await play())!));
    await runCommand(registry, world.db, as(sam), castSpell, spell());
    seen.push(firstSpellsOpen((await play())!));
    expect(seen).toEqual([true, false, true, false]);
  });

  // Purpose: after a rest (the GM's set, which the rest is), a choice waits as today.
  it('10e. after a rest a choice waits', async () => {
    unrested(lamp);
    await runCommand(registry, world.db, as(gm), setSpells, { character: wren, ready: lamp, chosen: null, spellsCast: {} });
    expect(await play()).toMatchObject({ restedOnce: true });
    await choose(fog);
    expect(await play()).toMatchObject({ prepared: lamp, chosen: fog });
  });

  // Purpose: the GM's set by hand closes them (fsr-5), and its Undo from the log opens them again.
  it("10f. the GM's set closes them; its Undo opens them", async () => {
    unrested(lamp);
    await runCommand(registry, world.db, as(gm), setSpells, { character: wren, ready: fog });
    expect(firstSpellsOpen((await play())!)).toBe(false);
    expect(await undoLast('character.setSpells')).toMatchObject({ ok: true });
    expect(await play()).toMatchObject({ prepared: lamp, restedOnce: false });
    expect(firstSpellsOpen((await play())!)).toBe(true);
  });

  // Purpose: a list that doesn't fit the slots is refused while open, with today's words, and nothing is written.
  it("10g. a list that doesn't fit is refused while open, and nothing is written", async () => {
    const result = await runCommand(registry, world.db, as(sam), chooseSpells, { character: wren, chosen: two, slots: [1] });
    expect(!result.ok && result.message).toMatch(/^Level 1 has 1 slot/);
    expect(world.tables.character_play.filter((p) => p.actor_id === wren.id)).toHaveLength(0);
    expect(eventsOf('character.chooseSpells')).toHaveLength(0);
  });

  // Purpose: clearing a choice while open changes nothing that is ready.
  it('10h. clearing a choice while open changes nothing ready', async () => {
    unrested(lamp);
    expect(await choose(null)).toMatchObject({ ok: true });
    expect(await play()).toMatchObject({ prepared: lamp, chosen: null });
  });

  // Purpose: another player still can't choose for a character whose first spells are open; nothing is written.
  it("10i. another player can't choose an open character's first spells", async () => {
    expect(await choose(lamp, jo)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(world.tables.character_play.filter((p) => p.actor_id === wren.id)).toHaveLength(0);
  });

  // Purpose: the rule itself: open only while never rested and nothing cast (a count of 0 is nothing cast).
  it('10j. open only while never rested and nothing cast', () => {
    expect(firstSpellsOpen({ restedOnce: false, spellsCast: {} })).toBe(true);
    expect(firstSpellsOpen({ restedOnce: false, spellsCast: { '1:mire-lamp': 0 } })).toBe(true);
    expect(firstSpellsOpen({ restedOnce: false, spellsCast: { '1:mire-lamp': 1 } })).toBe(false);
    expect(firstSpellsOpen({ restedOnce: true, spellsCast: {} })).toBe(false);
  });
});
