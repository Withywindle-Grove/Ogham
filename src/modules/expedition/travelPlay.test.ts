import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import { gettingLostOf, mayActForGroup, mayEnterLostRoll, toGroupLost, toTravelGroup } from './travelPlay.ts';

const gm: CurrentUser = { id: 'user-gm', roles: { 'campaign-1': 'gm' } };
const player: CurrentUser = { id: 'user-sam', roles: { 'campaign-1': 'player' } };
const stranger: CurrentUser = { id: 'user-eve', roles: {} };

const travelRow = {
  id: 'travel-1',
  campaign_id: 'campaign-1',
  expedition_id: 'trip-1',
  group_number: 2,
  day: 3,
  pace: 'riding',
  gm_per_day: 7,
  terrain_id: 'bog',
  route_id: 'causeway',
  total: 9,
  spent: 4,
  forced: 1,
  pending_owed: 3,
  pending_place_name: 'Moss Landing',
  pending_place_id: 'place-1',
  pending_route_id: 'wild',
  pending_terrain_id: 'sedge',
  version: 5,
};

describe('toTravelGroup', () => {
  // Purpose: a travel row from the database reads into the fields the card works with, shortfall included.
  it('reads a full row, with the place the group is entering as its pending shortfall', () => {
    expect(toTravelGroup(travelRow)).toEqual({
      id: 'travel-1',
      campaignId: 'campaign-1',
      expeditionId: 'trip-1',
      group: 2,
      day: 3,
      pace: 'riding',
      gmPerDay: 7,
      terrainId: 'bog',
      routeId: 'causeway',
      total: 9,
      spent: 4,
      forced: 1,
      pending: { placeName: 'Moss Landing', placeId: 'place-1', routeId: 'wild', terrainId: 'sedge', owed: 3 },
      version: 5,
    });
  });

  // Purpose: nothing owed (null or 0) means the group is not entering anywhere, whatever the other pending columns say.
  it('has a pending shortfall only when more than 0 is owed', () => {
    expect(toTravelGroup({ ...travelRow, pending_owed: null }).pending).toBeNull();
    expect(toTravelGroup({ ...travelRow, pending_owed: 0 }).pending).toBeNull();
  });

  // Purpose: an unknown or missing pace is read as on foot, and missing numbers as the first group, day 0, version 1.
  it('falls back to on foot, group 1, day 0 and version 1', () => {
    const bare = toTravelGroup({ id: 'travel-2', campaign_id: 'campaign-1', expedition_id: 'trip-1', pace: 'swimming' });
    expect(bare).toMatchObject({ pace: 'foot', group: 1, day: 0, total: 0, spent: 0, forced: 0, version: 1, gmPerDay: null, terrainId: null, routeId: null, pending: null });
    expect(toTravelGroup({ ...travelRow, pace: 'cart' }).pace).toBe('cart');
  });

  // Purpose: an owed shortfall with no place name still reads, with an empty name, so the card never crashes on odd data.
  it('reads an owed shortfall that has no place name', () => {
    expect(toTravelGroup({ ...travelRow, pending_place_name: null, pending_place_id: null }).pending).toMatchObject({ placeName: '', placeId: null, owed: 3 });
  });
});

describe('toGroupLost', () => {
  // Purpose: a Lost row reads into its fields, including the recovery roll and who entered it.
  it('reads a lost group with its roll', () => {
    expect(
      toGroupLost({ id: 'lost-1', campaign_id: 'campaign-1', expedition_id: 'trip-1', group_number: 2, since_day: 4, found_day: null, attempts: 2, roll: '3', roll_by: 'user-sam', note: 'Fog on the flats', version: 3 }),
    ).toEqual({ id: 'lost-1', campaignId: 'campaign-1', expeditionId: 'trip-1', group: 2, sinceDay: 4, foundDay: null, attempts: 2, roll: '3', rollBy: 'user-sam', note: 'Fog on the flats', version: 3 });
  });

  // Purpose: a group that found the way keeps its day, and missing columns fall back to calm defaults.
  it('reads the day the way was found and falls back for missing columns', () => {
    expect(toGroupLost({ id: 'lost-2', campaign_id: 'c', expedition_id: 'e', found_day: 6 }).foundDay).toBe(6);
    expect(toGroupLost({ id: 'lost-3', campaign_id: 'c', expedition_id: 'e' })).toMatchObject({ group: 1, sinceDay: 0, foundDay: null, attempts: 0, roll: null, rollBy: null, note: '', version: 1 });
  });
});

describe('gettingLostOf', () => {
  // Purpose: the campaign keeps Lost secret unless the GM opened it (hard rule 5: hidden unless chosen).
  it('is secret unless the settings say open', () => {
    expect(gettingLostOf({})).toBe('secret');
    expect(gettingLostOf(null)).toBe('secret');
    expect(gettingLostOf('open')).toBe('secret');
    expect(gettingLostOf({ gettingLost: 'banana' })).toBe('secret');
    expect(gettingLostOf({ gettingLost: 'open' })).toBe('open');
  });
});

describe('who may act for a group', () => {
  // Purpose: the GM may force a march for any group; a member only for a group one of their characters is in.
  it('mayActForGroup: the GM always; a member only with a character in the group; a stranger never', () => {
    expect(mayActForGroup(gm, { campaignId: 'campaign-1', group: 2, mine: false })).toBe(true);
    expect(mayActForGroup(player, { campaignId: 'campaign-1', group: 1, mine: true })).toBe(true);
    expect(mayActForGroup(player, { campaignId: 'campaign-1', group: 2, mine: false })).toBe(false);
    expect(mayActForGroup(stranger, { campaignId: 'campaign-1', group: 1, mine: true })).toBe(false);
  });

  // Purpose: the recovery roll belongs to the GM, and to a group's members only while Getting lost is Open.
  it('mayEnterLostRoll: the GM always; a member only when it is theirs and Getting lost is open', () => {
    const mine = { campaignId: 'campaign-1', group: 1, mine: true };
    expect(mayEnterLostRoll(gm, { ...mine, mine: false, gettingLost: 'secret' })).toBe(true);
    expect(mayEnterLostRoll(player, { ...mine, gettingLost: 'open' })).toBe(true);
    expect(mayEnterLostRoll(player, { ...mine, gettingLost: 'secret' })).toBe(false);
    expect(mayEnterLostRoll(player, { ...mine, mine: false, gettingLost: 'open' })).toBe(false);
    expect(mayEnterLostRoll(stranger, { ...mine, gettingLost: 'open' })).toBe(false);
  });
});
