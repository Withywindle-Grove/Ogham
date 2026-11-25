// Keeping a map's picture with a pack (B14, library.addPicture). Invented pack and map only. In plain words:
//   * the pack's owner keeps the picture at <pack id>/<map id>;
//   * when the storage rules refuse the write (someone else's pack), the command says it isn't allowed, not "check
//     your connection" (the database test of every command checks a refusal comes from the access rules).
import { beforeEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addPackPicture } from './packPictures.ts';

const chart = () => new Blob(['a chart'], { type: 'image/png' });

describe("a map's picture kept with its pack", () => {
  let world: FakeWorld;
  let owner: string;
  let other: string;

  beforeEach(() => {
    world = createFakeDb();
    owner = world.addPerson('priya@lantern.example', 'Priya');
    other = world.addPerson('sam@lantern.example', 'Sam');
    world.tables.packs.push({ id: 'pack-marsh', owner_user_id: owner, campaign_id: null, name: 'The Marsh', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' });
  });

  // Purpose: the owner's picture is kept at <pack id>/<map id>.
  it("the pack's owner keeps it", async () => {
    world.signInAs(owner);
    const done = await addPackPicture.run(world.db, { id: owner, roles: {} } as CurrentUser, { packId: 'pack-marsh', ownerUserId: owner, mapId: 'harbour-chart', image: chart() });
    expect(done.ok).toBe(true);
    expect(world.files.has('pack-files/pack-marsh/harbour-chart')).toBe(true);
  });

  // Purpose: a write the storage rules refuse is reported as not allowed, so it reads as a refusal, not a lost connection.
  it('a write the storage rules refuse is not allowed, not a connection failure', async () => {
    world.signInAs(other);
    const done = await addPackPicture.run(world.db, { id: other, roles: {} } as CurrentUser, { packId: 'pack-marsh', ownerUserId: owner, mapId: 'harbour-chart', image: chart() });
    expect(done).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(world.files.has('pack-files/pack-marsh/harbour-chart')).toBe(false);
  });
});
