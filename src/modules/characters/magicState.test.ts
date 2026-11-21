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
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { afterRest, castSpell, chooseSpells, nextReady, readySpells, sameAsYesterday, setSpells, trimCasts, uncastSpell } from './magicState.ts';
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
