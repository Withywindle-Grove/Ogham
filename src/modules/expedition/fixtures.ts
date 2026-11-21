// An invented setting's rules set for the expedition engine's tests, written in every G-07 shape (docs/07
// "Exploration"), plus a few old or broken shapes the engine must ignore without failing. No real game content.

export const fenRules: Record<string, unknown> = {
  id: 'fen-rules',
  name: 'Fenwatch rules',
  time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 },
  seasons: [
    { id: 'wet', name: 'Wet' },
    { id: 'dry', name: 'Dry' },
  ],
  specialSeasons: [
    { id: 'gloaming', name: 'The Gloaming', weatherTableId: 'gloam-weather', encounterSwap: { chance: { die: 'd6', on: [1, 2] }, tableId: 'gloam-things' }, start: { text: 'kept for later' } },
    { id: 'mistwane', name: 'Mistwane', weatherFrom: 'wet' },
    { id: 'old-swaps', name: 'Old shape', encounterSwaps: [{ tableId: 'ignored' }] },
  ],
  weather: { tables: { wet: 'weather-wet', dry: 'weather-dry', any: 'weather-any' }, rollEvery: { value: 1, unit: 'day' }, onlyWithOption: 'weather-rules', tags: { fog: { name: 'Fog', warn: 'Hard to keep your bearings' } } },
  wildEncounters: { typeTableId: 'beast-kind', commonTables: { Beast: 'common-beasts' }, regionalTables: { 'Fen Reach': 'fen-reach-beasts' }, lairChance: 30 },
  dungeonExit: {
    roll: { save: 'nerve' },
    modifiers: [
      { id: 'map', name: 'Has a map', value: 2 },
      { id: 'known-way', name: 'Knows a safe way out', value: 3 },
      { id: 'bad', name: 'No value' },
    ],
    depth: { per: 2, value: -1 },
    onFail: { table: 'lost-below' },
    safePaths: 'Short note on using safe paths.',
  },
  exploration: {
    playerReadable: true,
    notes: 'Exploration in the fens.',
    modes: [
      {
        id: 'creep',
        name: 'Creeping',
        step: { value: 1, unit: 'turn' },
        procedure: [
          { id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'creep-wander' },
          { id: 'listen', name: 'Listen at the dark', icon: 'listen', kind: 'note', notes: 'Quiet line from the notes alias.' },
          { id: 'odd', name: 'Odd step', icon: 'sparkles', kind: 'note' },
          { id: 'broken', name: 'Broken kind', kind: 'dance' },
          { id: 'tick', name: 'Lights burn', icon: 'time', kind: 'auto' },
        ],
        checks: [{ id: 'creep-wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd8', on: [1] }, onHit: { tableChoices: ['creep-shallow', 'creep-deep'], note: 'Pick by depth.' } }],
        movement: { kind: 'perStep', formula: 'speed', unit: 'ft' },
        rest: { every: { value: 5, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary', note: 'Five turns on, one off.' },
        camp: { sameAs: 'roam', note: 'Camp as in the open, quietly.' },
        activities: [
          { id: 'tap-walls', name: 'Tap the walls', icon: 'search', cost: { steps: 1 }, chance: { skill: 'tap' }, who: 'several', maxActors: 2, secret: true },
          { id: 'pry-lid', name: 'Pry a lid', icon: 'door', cost: { steps: 0 }, chance: { abilityCheck: 'STR' }, requires: { skill: 'pry', item: 'crowbar' }, who: 'one', onlyIn: ['creep'] },
          { id: 'old-search', name: 'Old search', icon: 'search', cost: 'terrain.searchCost', onSuccessTableId: 'ignored', ifFullDay: 2, classSkill: 'old', requiresItem: 'a rope' },
          { id: 'reeds-only-roaming', name: 'Not here', icon: 'forage', cost: { steps: 1 }, onlyIn: ['roam'] },
        ],
      },
      {
        id: 'roam',
        name: 'Roaming',
        step: { value: 1, unit: 'day' },
        procedure: [
          { id: 'weather', name: 'Weather', icon: 'weather', kind: 'roll', tableBySeason: { wet: 'step-weather-wet' } },
          { id: 'course', name: 'Choose a course', icon: 'course', kind: 'note' },
          { id: 'lost', name: 'Going astray', icon: 'lost', kind: 'check', checkId: 'roam-astray' },
          { id: 'wander', name: 'Wandering beasts', icon: 'monster', kind: 'check', checkId: 'roam-wander' },
          { id: 'camp', name: 'Camp', icon: 'camp', kind: 'camp' },
        ],
        checks: [
          {
            id: 'roam-astray',
            name: 'Going astray',
            every: { value: 1, unit: 'day' },
            when: 'start',
            chance: { die: 'd6', on: [1] },
            byTerrain: true,
            terrainChance: 'lostChance',
            onHit: { tableId: 'roam-astray-result' },
            modifiers: [
              { weatherTag: 'fog', add: 1 },
              { routeType: 'road', never: true },
              { routeType: 'track', chance: { die: 'd6', on: [1] } },
              { mystery: 'ignored' },
            ],
            note: 'Fog makes it worse.',
          },
          { id: 'roam-wander', name: 'Wandering beasts', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, byTerrain: true, terrainChance: 'wanderChance', onHit: { tableId: 'beast-kind', columns: ['road', 'wild'], regionTables: true } },
          { id: 'roam-night', name: 'Night prowlers', every: { value: 1, unit: 'day' }, when: 'end', chance: { die: 'd6', on: [1] }, onHit: { note: 'Something circles the fire.' } },
          { id: 'roam-heron', name: 'Heron omen', every: { value: 2, unit: 'day' }, when: 'start', chance: null, tableId: 'heron-omens', byTrack: [{ trackId: 'flood', min: 3, max: 5, chance: { die: 'd6', on: [1, 2, 3] } }] },
        ],
        movement: { kind: 'budget', name: 'Leagues', unit: 'points', perDay: 'floor(speed / 5)', costPer: { value: 4, unit: 'mile' }, mounted: 40, terrainCostPer: 'old' },
        terrainClasses: [
          { id: 'soft', name: 'Soft going', cost: 2, searchCost: 2, lostChance: [1], wanderChance: [1], mounts: 'ride', vehicles: true },
          { id: 'rough', cost: 3, searchCost: 3, lostChance: [1, 2], wanderChance: [1, 2], mounts: 'none', vehicles: false },
        ],
        terrain: [
          { id: 'meadow', name: 'Meadow', class: 'soft' },
          { id: 'marsh', name: 'Marsh', class: 'rough', encounterColumn: 'Marsh', note: 'Sucking mud.' },
          { id: 'scrub', name: 'Scrub', cost: 4, searchCost: 4, lostChance: [1, 2, 3], wanderChance: [1], encounterTableId: 'scrub-beasts' },
          { name: 'No id' },
        ],
        rest: { every: { value: 6, unit: 'day' }, length: { value: 1, unit: 'day' }, condition: 'weary' },
        camp: {
          procedure: [
            { id: 'setup', name: 'Pitch camp', icon: 'camp', kind: 'note' },
            { id: 'watches', name: 'Set watches', icon: 'watch', kind: 'watches', watchLength: { value: 2, unit: 'hour' } },
            { id: 'night', name: 'Night prowlers', icon: 'monster', kind: 'check', checkId: 'roam-night' },
            { id: 'sleep', name: 'Sleep', icon: 'rest', kind: 'roll', tableId: 'sleep-ease', checkAbility: 'CON', onGoodRest: [{ heal: 1 }], onBadRest: [{ condition: 'weary' }, { nope: true }] },
          ],
          quick: { option: 'quick-camp' },
        },
        activities: [
          {
            id: 'gather-reeds',
            name: 'Gather reeds',
            icon: 'search',
            cost: { fromTerrain: 'searchCost' },
            chance: { abilityCheck: 'WIS' },
            who: 'several',
            maxActors: 3,
            bestOf: true,
            modifiers: [{ when: 'fullDay', add: 1, note: 'A whole day at it' }],
            result: '1d4 bundles',
            onlyIn: ['roam'],
            onlyOnTerrain: ['marsh'],
          },
          { id: 'forage', name: 'Forage', icon: 'forage', cost: { budget: 0 }, who: 'party', result: '1d3 meals', bySeason: { dry: '1 meal' }, bySpecialSeason: { gloaming: 'Nothing grows' }, seasonResult: 'ignored' },
          { id: 'hunt', name: 'Hunt', icon: 'hunt', cost: { budget: 'all' }, who: 'party', tableId: 'game-plain', tableByTerrain: { marsh: 'game-marsh' } },
          { id: 'eel-run', name: 'Eel run', icon: 'hunt', cost: { time: { value: 2, unit: 'hour' } }, who: 'one', seasons: ['wet'], onlyWithOption: 'eels:on' },
        ],
      },
      { id: 'town', name: 'In town', step: { value: 1, unit: 'day' }, other: false, rest: null, procedure: [{ id: 'gossip', name: 'Gossip', icon: 'note', kind: 'note', note: 'What the town says.' }], checks: [] },
      { id: 'broken-mode', name: 'No step' },
      'not a mode',
      null,
    ],
  },
};

/** An attached pack whose rules set has no exploration at all (the fallbacks apply). */
export const plainRules: Record<string, unknown> = { id: 'plain', name: 'Plain rules', time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 } };

/**
 * An invented rules set with the M5b wilderness shapes (rulings of 2026-10-30): a travel budget with routes and a
 * forced march, weather tags that change the budget, a check set off by leaving the causeway, sleep looked up from
 * facts, and cooking. The pack names are those in wildPack.ts (07).
 */
export const mireRules: Record<string, unknown> = {
  id: 'mire-rules',
  name: 'Mirewalk rules',
  seasons: [
    { id: 'thaw', name: 'Thaw' },
    { id: 'frost', name: 'Frost' },
  ],
  weather: {
    tables: { any: 'mire-weather' },
    tags: { mired: { name: 'Mired', budget: -2 }, murk: { name: 'Murk', warn: 'Hard to keep your bearings' }, still: { name: 'Still' } },
  },
  exploration: {
    modes: [
      {
        id: 'trek',
        name: 'Trekking',
        step: { value: 1, unit: 'day' },
        procedure: [
          { id: 'astray', name: 'Going astray', icon: 'lost', kind: 'check', checkId: 'trek-astray' },
          { id: 'prowl', name: 'Prowlers', icon: 'monster', kind: 'check', checkId: 'trek-prowl' },
          { id: 'camp', name: 'Camp', icon: 'camp', kind: 'camp' },
        ],
        checks: [
          {
            id: 'trek-astray',
            name: 'Going astray',
            every: { value: 1, unit: 'day' },
            chance: { die: 'd6', on: [1] },
            byTerrain: true,
            terrainChance: 'lostChance',
            modifiers: [{ routeType: 'causeway', never: true }, { weatherTag: 'murk', add: 1 }],
            alsoWhen: { leaveRoute: 'causeway' },
            onHit: { tableId: 'astray-result' },
          },
          { id: 'trek-prowl', name: 'Prowlers', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, byTerrain: true, terrainChance: 'wanderChance', onHit: { tableId: 'prowlers' } },
          { id: 'trek-omen', name: 'Omen', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [6] }, alsoWhen: [{ enterTerrain: 'sedge' }, { wobble: 'x' }], onHit: { note: 'A heron watches.' } },
        ],
        movement: {
          kind: 'budget',
          name: 'Strides',
          unit: 'points',
          perDay: 'floor(speed / 10)',
          mounted: 60,
          forced: { factor: 1.5, stack: 'once', note: 'Everyone is weary tomorrow.' },
          routes: [
            { id: 'wild', name: 'Wild' },
            { id: 'causeway', name: 'Causeway', cost: 1, column: 'causeway' },
            { id: 'channel-down', name: 'Channel ↓', cost: 1 },
            { name: 'No id' },
          ],
        },
        terrain: [
          { id: 'sedge', name: 'Sedge', cost: 2, lostChance: [1], wanderChance: [1], mounts: 'ride', vehicles: true },
          { id: 'bog', name: 'Bog', cost: 3, lostChance: [1, 2], wanderChance: [1, 2], mounts: 'none', vehicles: false },
          { id: 'reedbed', name: 'Reedbed', lostChance: [1, 2, 3], mounts: 'lead', vehicles: false },
        ],
        rest: { every: { value: 6, unit: 'day' }, length: { value: 1, unit: 'day' }, condition: 'weary', note: 'Rest or tire.' },
        camp: {
          procedure: [{ id: 'sleep', name: 'Sleep', icon: 'rest', kind: 'roll', checkAbility: 'GRIT' }],
          sleep: {
            difficulties: [
              { id: 'easy', name: 'Easy', result: 'good' },
              { id: 'hard', name: 'Hard', result: 'check', add: -1 },
              { id: 'grim', name: 'Grim', result: 'check', add: -3 },
              { id: 'sodden', name: 'Sodden', result: 'bad' },
              { id: 'odd', name: 'Odd', result: 'maybe' },
              { name: 'No id' },
            ],
            beddingItems: [{ id: 'fleece-roll' }, { id: 'reed-mat' }, { id: 'tent', shares: 2 }, { name: 'No id' }],
            rows: [
              { season: 'frost', fire: false, bedding: 'none', difficulty: 'grim' },
              { season: 'frost', bedding: { all: ['tent', 'fleece-roll'] }, difficulty: 'easy' },
              { season: 'frost', bedding: { any: ['fleece-roll', 'tent'] }, difficulty: 'hard' },
              { season: 'frost', difficulty: 'hard' },
              { fire: true, difficulty: 'easy' },
              { bedding: 'none', difficulty: 'hard' },
              { difficulty: 'easy' },
              { difficulty: 'missing' },
              { bedding: ['fleece-roll'], difficulty: 'easy' },
            ],
            modifiers: [{ when: 'campfire-talk', add: 1, note: 'Campfire talk' }],
            checkAbility: 'NERVE',
          },
          cooking: { ingredients: ['eel'], portions: 2, bonus: [{ heal: 1 }], note: 'A hot meal mends.' },
        },
        activities: [{ id: 'eel-trap', name: 'Set eel traps', icon: 'hunt', cost: { budget: 'all' }, who: 'one', yields: { item: 'eel', dice: '1d3' }, bySeason: { frost: '1d2', thaw: 'Eels are thick in the shallows' } }],
      },
    ],
  },
};
