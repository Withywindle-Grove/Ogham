// Checks the app's can() against the shared permission table, with made-up ids (no database).
// The same table runs against the real database in supabase/tests/commands.test.ts.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../app/commandRegistry.ts';
import type { CurrentUser } from '../core/commands.ts';
import type { CharacterRef } from '../modules/characters/commands.ts';
import type { Request } from '../modules/requests/requests.ts';
import { permissionCases, type CaseWorld, type Who } from './permissionCases.ts';

const campaignId = 'campaign-reedmouth';

const users: Record<Who, CurrentUser> = {
  gm: { id: 'user-gm', roles: { [campaignId]: 'gm', 'campaign-fresh': 'gm' } },
  playerA: { id: 'user-a', roles: { [campaignId]: 'player' } },
  playerB: { id: 'user-b', roles: { [campaignId]: 'player' } },
  outsider: { id: 'user-outsider', roles: {} },
  newcomer: { id: 'user-newcomer', roles: {} },
};

const character = (
  id: string,
  owner: 'playerA' | 'playerB',
  approval: CharacterRef['approval'],
  archived = false,
): CharacterRef => ({
  id,
  campaignId,
  ownerType: 'user',
  ownerUserId: users[owner].id,
  approval,
  archived,
});

const carriers = {
  wren: { campaignId, actorId: 'actor-wren', locationId: null, ownerUserId: users.playerA.id, archived: false },
  ash: { campaignId, actorId: 'actor-ash', locationId: null, ownerUserId: users.playerB.id, archived: false },
  stash: { campaignId, actorId: null, locationId: 'location-stash', ownerUserId: null, archived: false },
};

const request = (id: string, requesterId: string | null, actorId: string | null, kind: Request['kind'], direction: Request['direction']): Request => ({
  id,
  campaignId,
  expeditionId: 'expedition-fresh',
  group: 1,
  requesterId,
  actorId,
  kind,
  direction,
  text: kind === 'describe' ? 'Pry the idol loose.' : '',
  costText: '',
  prompt: kind === 'escapeRoll' ? { roll: { save: 'breath' }, modifiers: [], depth: 0, levelsDown: 1 } : {},
  entry: null,
  status: 'waiting',
  answerKind: 'yesNo',
  answer: null,
  answeredAt: null,
  reply: null,
  createdAt: '2026-11-01T19:00:00Z',
  version: 1,
});

const world: CaseWorld = {
  campaignId,
  companyId: 'company-sluice-gate',
  userId: (who) => users[who].id,
  wren: character('actor-wren', 'playerA', 'approved'),
  ash: character('actor-ash', 'playerB', 'approved'),
  freshCompany: async () => 'company-fresh',
  freshCharacter: async (owner, approval, archived) => character('actor-fresh', owner, approval, archived),
  freshInvite: async () => ({ id: 'invite-fresh', code: 'ABCD2345' }),
  freshField: async () => ({ id: 'field-fresh', campaignId, key: 'fresh' }),
  freshChange: async (by) => ({ campaignId, eventId: 'event-fresh', authorUserId: users[by].id }),
  freshNote: async (by) => ({ id: 'note-fresh', campaignId, authorUserId: users[by].id }),
  freshPack: async (owner) => ({ packId: 'pack-fresh', ownerUserId: users[owner].id }),
  freshCampaign: async () => 'campaign-fresh',
  freshTownCampaign: async () => 'campaign-fresh',
  freshPlayersCampaign: async () => 'campaign-fresh',
  freshAttachedPack: async () => ({ campaignPackId: 'campaign-pack-fresh', packId: 'pack-fresh', ownerUserId: users.gm.id }),
  freshHomebrewEntry: async () => 'dazed',
  carrier: async (of) => carriers[of],
  freshLine: async (on) => ({ id: `line-${on}`, carrier: carriers[on] }),
  freshArmour: async (on, picked) => ({ id: `armour-${on}`, carrier: carriers[on], baseArmourId: picked ? 'reed-coat' : null }),
  freshContainer: async (on) => ({ id: `sack-${on}`, carrier: carriers[on] }),
  freshCoins: async (on) =>
    on === 'fallen'
      ? { campaignId, actorId: 'actor-fallen', locationId: null, ownerUserId: users.playerB.id, archived: false, downOrDead: true }
      : on === 'archived'
        ? { campaignId, actorId: 'actor-archived', locationId: null, ownerUserId: users.playerA.id, archived: true, downOrDead: false }
        : { ...carriers[on], downOrDead: false },
  freshCompanyInvitation: async () => 'invitation-fresh',
  clockOf: async (id) => ({ id: `clock-${id}`, campaignId: id, seconds: 0, version: 1 }),
  freshSession: async (id) => ({ id: 'session-fresh', campaignId: id, number: 1, startedAt: '2026-10-29T19:00:00Z', endedAt: null, version: 1 }),
  freshPlace: async (shown = false, picture = false) => ({
    id: 'group-place-fresh',
    campaignId,
    expeditionId: 'expedition-fresh',
    group: 1,
    placeId: 'place-fresh',
    shown,
    place: { id: 'place-fresh', campaignId, name: 'The Moth Gallery', description: '', notes: null, version: 1, notesVersion: 1 },
    pieces: [{ id: 'piece-fresh', kind: 'exit', text: 'An archway to the east', shown, shownAt: shown ? '2026-11-01T12:00:00Z' : null, gm: { value: '', trigger: '', statLine: '' }, version: 1 }],
    picture: picture ? { id: 'piece-picture-fresh', assetId: 'asset-place-fresh', shown: false, shownAt: null } : null,
  }),
  freshMap: async () => 'asset-map-fresh',
  freshReturnVisit: async () => ({
    id: 'group-place-return',
    campaignId,
    expeditionId: 'expedition-fresh',
    group: 1,
    placeId: 'place-fresh',
    shown: false,
    place: { id: 'place-fresh', campaignId, name: 'The Moth Gallery', description: '', notes: null, version: 1, notesVersion: 1 },
    pieces: [{ id: 'piece-fresh', kind: 'exit', text: 'An archway to the east', shown: false, shownAt: null, gm: { value: '', trigger: '', statLine: '' }, version: 1 }],
  }),
  freshPackPlace: async () => ({ packId: 'pack-fresh', packEntryId: 'the-reed-inn', name: 'The Reed Inn', data: { type: 'building', playerView: { text: 'Smoke and eel stew.' }, gm: { sections: [{ heading: 'The keeper', text: 'Fences stolen lanterns.' }] }, rules: [{ id: 'slick-piles', name: 'Slick piles', text: 'Footing is poor.' }], encounterCheck: { when: 'eachMove', replacesScheduled: true } } }),
  freshIdlePlace: async () => ({ campaignId: 'campaign-fresh', placeId: 'place-fresh' }),
  freshMovePlace: async () => ({ campaignId: 'campaign-fresh', placeId: 'place-fresh' }),
  freshAdventureHook: async () => ({ packId: 'pack-adventure', hookId: 'ew-bog-bounty' }),
  freshRumour: async () => ({ packId: 'pack-adventure', tableId: 'ew-quay-rumours', min: 1, max: 1 }),
  freshCallSend: async (to) => ({ id: `send-${to}`, campaignId, actorId: to === 'wren' ? 'actor-wren' : null, playerUserId: to === 'wren' ? users.playerA.id : null }),
  freshMessage: async () => 'message-fresh',
  freshRequest: async () => request('request-fresh', users.playerA.id, 'actor-wren', 'describe', 'playerAsks'),
  freshSheetChange: async () => ({
    id: 'sheet-change-fresh',
    campaignId,
    actorId: 'actor-wren',
    requesterId: users.playerA.id,
    field: 'hpMax',
    label: 'Max HP',
    from: 8,
    to: 9,
    status: 'waiting',
    reason: '',
    answeredAt: null,
    createdAt: '2026-11-08T19:00:00Z',
    version: 1,
  }),
  freshOffer: async () => ({ ...request('request-offer', users.playerA.id, 'actor-wren', 'sell', 'playerAsks'), status: 'answered' as const, answerKind: 'offer' as const, answer: { kind: 'offer' as const, price: '3 gp', note: '' } }),
  // The same facts as the database world's real purchase: a Buy… the GM answered In stock, then Player A's Buy it. The
  // line itself (bought, version 1, Player A's creating event) lives in the database only: can() reads the request alone.
  freshPurchase: async () => ({
    ...request('request-purchase', users.playerA.id, 'actor-wren', 'buy', 'playerAsks'),
    text: 'Lantern from the stall',
    prompt: { item: 'Lantern', itemId: null, shop: 'The stall', serviceId: 'buy-gear', price: '10 gp' },
    status: 'answered' as const,
    answerKind: 'hitMissChoice' as const,
    answer: { kind: 'buy' as const, result: 'inStock' as const, price: '10 gp', note: '' },
    reply: 'accept' as const,
  }),
  freshInn: async () => ({ key: 'lodging:the lantern rest', name: 'The Lantern Rest', town: 'Fenwick Market' }),
  freshTownPart: async () => ({ visitId: 'group-place-town', pieceId: 'piece-chapel' }),
  freshSecretRequest: async () => ({
    ...request('request-secret', users.playerA.id, 'actor-wren', 'secretActivity', 'playerAsks'),
    text: 'Scout ahead',
    prompt: { activityId: 'scout', group: 1, actorIds: [], spend: 2 },
  }),
  freshAsked: async (who) => (who === 'each' ? request('request-asked', users.playerA.id, 'actor-wren', 'escapeRoll', 'gmAsks') : request('request-party', null, null, 'escapeRoll', 'gmAsks')),
  freshExpedition: async (id, ended = false) => ({
    id: 'expedition-fresh',
    campaignId: id,
    mode: 'dungeon',
    startedAt: 0,
    endedAt: ended ? 600 : null,
    whoWent: ['actor-wren'],
    summary: ended ? { seconds: 600, fullRest: false } : null,
    safePaths: false,
    endedSafe: null,
    createdAt: '2026-10-29T19:00:00Z',
    version: 1,
  }),
  freshReminder: async (id) => ({
    id: 'reminder-fresh',
    campaignId: id,
    label: 'Listen for bog lurkers',
    kind: 'check',
    encounterCheck: true,
    every: { value: 2, unit: 'turn' },
    anchor: 0,
    active: true,
    isPublic: false,
    chance: { die: 'd6', on: [1] },
    tableId: null,
    note: null,
    version: 1,
  }),
  onAdventure: async () => {},
  freshWeather: async () => ({ campaignId, expeditionId: 'expedition-fresh', tableId: 'fen-sky' }),
  freshWeatherRoll: async () => ({
    id: 'weather-fresh',
    campaignId,
    expeditionId: 'expedition-fresh',
    period: 0,
    startsAt: 0,
    tableId: 'fen-sky',
    roll: '2',
    result: 'Drizzle',
    tags: ['wet'],
    enteredBy: users.playerA.id,
    enteredAt: '2026-10-30T19:00:00Z',
    correctedBy: null,
    version: 1,
  }),
  freshLight: async (on) => `light-line-${on}`,
  freshReadySpell: async (on) => ({ spell: `mire-lamp-${on}`, level: 1 }),
  freshPins: async (on) => [`Fen sight ${on}`, `Horn charge ${on}`],
  marching: async (state = {}) => ({
    target: { campaignId, group: 1, playersReorder: state.playersReorder ?? true },
    order: { id: 'marching-order', campaignId, group: 1, rows: [], presets: [{ name: 'Tunnel', rows: [['actor-ash']] }], lastPreset: null, locked: state.locked ?? false, version: 1 },
    rows: [['actor-wren'], ['actor-ash']],
  }),
  party: async (state) => (state === 'split' ? 2 : 1),
  freshStatus: async (on, levels = false, timed = false) => ({
    id: `status-${on}`,
    campaignId,
    actorId: `actor-${on}`,
    name: levels ? 'Dazed' : 'Muddy boots',
    conditionId: levels ? 'dazed' : null,
    icon: null,
    stacks: 1,
    stacking: false,
    levels: levels ? [{ id: 'dazed', name: 'Dazed' }, { id: 'reeling', name: 'Reeling' }, { id: 'out-cold', name: 'Out cold' }] : null,
    level: levels ? 0 : null,
    source: levels ? 'condition' : 'typed',
    note: null,
    startedAt: 0,
    endsAt: timed ? 1800 : null,
    totalSeconds: timed ? 1800 : null,
    unit: timed ? 'turn' : null,
    secret: false,
    endedAt: null,
    version: 1,
  }),
  freshTableCampaign: async () => 'campaign-fresh',
  freshTablePin: async (id) => ({ id: 'pin-fresh', campaignId: id, tableId: 'bog-things', pinnedAt: '2026-11-01T19:00:00Z', version: 1 }),
  freshWaitingEncounter: async (id) => ({ id: 'waiting-fresh', campaignId: id, expeditionId: null, checkResultId: 'check-fresh', watch: null, state: 'waiting', createdAt: '2026-11-03T19:00:00Z', version: 1 }),
  freshTravel: async () => ({ id: 'travel-fresh', campaignId: 'campaign-1', expeditionId: 'expedition-1', group: 1, day: 0, pace: 'foot', gmPerDay: null, terrainId: null, routeId: null, total: 8, spent: 0, forced: 0, pending: null, version: 1 }),
  freshMarch: async (by) => ({ campaignId, eventId: 'event-march', authorUserId: users[by].id }),
  freshActivityRun: async () => 'run-fresh',
  freshFind: async () => 'event-find',
  freshCamp: async () => ({ campId: 'camp-fresh', lineId: 'line-fresh' }),
  freshLost: async () => ({ id: 'lost-fresh', campaignId: 'campaign-1', expeditionId: 'expedition-1', group: 1, sinceDay: 0, foundDay: null, attempts: 0, roll: null, rollBy: null, note: '', version: 1 }),
  freshReveal: async (id) => ({ id: 'reveal-fresh', campaignId: id, checkResultId: 'check-fresh', words: 'Two pale shapes rise from the reeds.', shownAt: '2026-11-26T19:00:00Z', takenBack: false }),
  freshCheckResult: async (id) => ({
    id: 'check-fresh',
    campaignId: id,
    expeditionId: null,
    checkKey: 'gm:listen',
    name: 'Listen for bog lurkers',
    source: 'gm',
    outcome: 'hit',
    atSeconds: 0,
    modifiers: [],
    note: null,
    tableId: null,
    roll: null,
    rowText: null,
    revealed: false,
    secret: true,
    version: 1,
  }),
};

const registry = createAppRegistry();

describe("the app's permission rules (can)", () => {
  it.each(permissionCases.map((c) => [c.says, c] as const))('%s', async (_says, c) => {
    const { target } = await c.prepare(world);
    expect(registry.can(users[c.who], c.commandName, target)).toBe(c.allowed);
  });

  // W11b fix-forward: a Sell offer once stood in for a purchase and only the real database caught it.
  it("the stand-in's purchase is what undo_buy needs: a Buy the GM answered In stock and the buyer accepted", async () => {
    const bought = await world.freshPurchase();
    expect(bought).toMatchObject({ kind: 'buy', requesterId: users.playerA.id, actorId: 'actor-wren', status: 'answered', reply: 'accept' });
    expect(bought.answer).toMatchObject({ kind: 'buy', result: 'inStock' });
  });

  it('every registered command has at least one case in the table', () => {
    const covered = new Set(permissionCases.map((c) => c.commandName));
    expect(registry.names().filter((name) => !covered.has(name))).toEqual([]);
  });
});
