// character.create's starting experience (cs-13, plan dec-10 X1), on the fake database. Every name and number is invented.
//   Given an experience, the class's entry keeps it beside the level.
//   Without one, the class's entry starts at 0, as before.
//   An experience that isn't a whole number of at least 0 is refused, and nothing is written.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { createCharacter } from './commands.ts';

const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let user: CurrentUser;

beforeEach(() => {
  world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.signInAs(me);
  user = { id: me, roles: { [campaign]: 'player' } };
});

const make = (extra: { level?: number; xp?: number }) =>
  runCommand(registry, world.db, user, createCharacter, { campaignId: campaign, kind: 'pc', name: 'Tam', classRef: 'lamp-keeper', raceRef: null, draft: true, ...extra });
const tam = () => world.tables.actors.find((a) => a.name === 'Tam');

describe('character.create: the starting experience (cs-13)', () => {
  // Purpose: a character made at level 2 with its class's minimum keeps it on its class's entry.
  it('keeps the experience given on the class’s entry, beside the level', async () => {
    expect(await make({ level: 2, xp: 1500 })).toMatchObject({ ok: true });
    expect(tam()?.classes).toEqual([{ classRef: 'lamp-keeper', level: 2, xp: 1500 }]);
  });

  // Purpose: without an experience given, the class's entry starts at 0, as before.
  it('starts at 0 when none is given', async () => {
    expect(await make({ level: 2 })).toMatchObject({ ok: true });
    expect(tam()?.classes).toEqual([{ classRef: 'lamp-keeper', level: 2, xp: 0 }]);
  });

  // Purpose: a broken figure never reaches the database.
  it('refuses an experience below 0 or not whole, and writes nothing', async () => {
    expect(await make({ level: 2, xp: -1 })).toMatchObject({ ok: false, message: 'Experience must be a whole number of at least 0.' });
    expect(await make({ level: 2, xp: 1.5 })).toMatchObject({ ok: false });
    expect(tam()).toBeUndefined();
  });
});
