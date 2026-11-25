// The players' reads made as a named player (C15f; ruling a2, 2026-11-22). Purpose, in plain words: every loader of the
// players' Scene, given a player, calls its read's two-argument form naming that player (which the database answers
// only for the campaign's GM); given none, the reader's own one-argument form, as before. The town's places' pieces and
// pictures included, though no screen reads them yet.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../core/supabase.ts';
import { loadPlayersKnowledge, loadPlayersPlaceCards } from './placeKnowledge.ts';
import { loadLastShownPlaces, loadScenePlaces, loadShownPlaces } from './placePlay.ts';
import { loadPlayersCheck, loadPlayersRules } from './placeRules.ts';
import { loadSceneTownParts } from './townParts.ts';
import { loadSceneTowns } from './townPlaces.ts';

/** A stand-in database that answers every read with no rows and remembers what was asked. */
function recorder() {
  const calls: [string, unknown][] = [];
  const db = {
    rpc: (name: string, args: unknown) => {
      calls.push([name, args]);
      return Promise.resolve({ data: [], error: null });
    },
  } as unknown as Db;
  return { db, calls };
}

const LOADERS: [string, (db: Db, campaignId: string, asPlayer?: string) => Promise<unknown>][] = [
  ['loadScenePlaces', loadScenePlaces],
  ['loadShownPlaces', loadShownPlaces],
  ['loadLastShownPlaces', loadLastShownPlaces],
  ['loadPlayersPlaceCards', loadPlayersPlaceCards],
  ['loadPlayersKnowledge', loadPlayersKnowledge],
  ['loadPlayersRules', loadPlayersRules],
  ['loadPlayersCheck', loadPlayersCheck],
  ['loadSceneTowns', loadSceneTowns],
  ['loadSceneTownParts', loadSceneTownParts],
];

describe("the players' reads as a named player (C15f)", () => {
  it.each(LOADERS)('%s names the player when given one, and nobody otherwise', async (_name, load) => {
    const asSam = recorder();
    await load(asSam.db, 'camp', 'sam');
    expect(asSam.calls.length).toBeGreaterThan(0);
    for (const [, args] of asSam.calls) expect(args).toEqual({ campaign: 'camp', as_player: 'sam' });
    const own = recorder();
    await load(own.db, 'camp');
    for (const [, args] of own.calls) expect(args).toEqual({ campaign: 'camp' });
  });

  it('reads the town’s places’ pieces and pictures as the player', async () => {
    const { db, calls } = recorder();
    await loadSceneTownParts(db, 'camp', 'sam');
    expect(calls.map(([name]) => name).sort()).toEqual(['scene_town_pictures', 'scene_town_pieces']);
  });
});
