// K28 (docs/plans/dec-6-the-whole-pack-tab.md; brief docs/plans/briefs/dec-6-k28-log-lines-cloud-brief.md): the log
// lines for a find and for Take from the party stash, in pu-7's voice: characters' names, never players'; the GM is
// "Your GM". A find's command is K16b's: these tests write its events as the status file says K16b will. Invented
// names, coins and places only.
import { describe, expect, it } from 'vitest';
import { describeEntry, groupEntries, type LogEvent, type LogNames } from './events.ts';

const names: LogNames = {
  me: 'user-sam',
  people: new Map([
    ['user-sam', 'Sam'],
    ['user-priya', 'Priya'],
    ['user-tess', 'Tess'],
  ]),
  characters: new Map([
    ['actor-wren', 'Wren'],
    ['actor-moss', 'Moss'],
  ]),
  companies: new Map(),
  fields: new Map(),
  packs: new Map(),
  items: new Map([['line-lantern', 'Hooded lantern']]),
  places: new Map([
    ['place-stash', 'Party stash'],
    ['place-mill', 'Old mill'],
  ]),
  stashIds: new Set(['place-stash']),
  // The places and hoards this reader was shown (a player reads only those; the GM reads all).
  placeNames: new Map([['place-weirs', 'the Eel Weirs']]),
  hoards: new Map([['hoard-chest', 'the drowned chest']]),
  itemKinds: new Map([['line-torches', { category: 'light', details: { unitName: 'torch', pluralName: 'torches' }, stack: 1, qty: 6 }]]),
  purses: new Map([
    ['purse-wren', { actorId: 'actor-wren' }],
    ['purse-stash', { actorId: null }],
  ]),
  coinAmount: (key, n) => `${n} ${key === 'heron' ? 'herons' : key}`,
  gms: new Set(['user-priya']),
};

let seq = 0;
function event(type: string, extra: Partial<LogEvent> = {}): LogEvent {
  seq += 1;
  return {
    id: `event-${seq}`,
    seq,
    type,
    level: 'simple',
    actorUserId: 'user-priya',
    targetTable: 'inventory_lines',
    targetId: `line-${seq}`,
    before: null,
    after: null,
    fiat: false,
    reason: null,
    revertsEventId: null,
    requestId: 'request-1',
    createdAt: '2026-11-14T18:30:00Z',
    ...extra,
  };
}
const say = (events: LogEvent[], reader: LogNames = names) => describeEntry(groupEntries(events)[0]!, reader);

/** A find as K16b will log it: each event of the request carries the find's reason (where it was found, to whom). */
const found = (find: Record<string, unknown>) => JSON.stringify({ find });
const made = (after: Record<string, unknown>, reason: string) => event('find.give', { before: null, after, reason });
const coin = (targetId: string, before: Record<string, number>, after: Record<string, number>, reason: string) =>
  event('find.give', { targetTable: 'purses', targetId, before: { coins: before }, after: { coins: after }, reason });

describe('a find (K28; K16b writes its events)', () => {
  // Purpose: a find to a character names the character, the thing, the hoard and the place.
  it('reads "Your GM gave <Name> <thing>, from <hoard> at <place>."', () => {
    const why = found({ to: 'actor-wren', hoardId: 'hoard-chest', placeId: 'place-weirs' });
    expect(say([made({ name: 'Glow wand', qty: 1, actor_id: 'actor-wren', location_id: null }, why)])).toBe('Your GM gave Wren Glow wand, from the drowned chest at the Eel Weirs.');
  });

  // Purpose: a whole hoard lists its things, commas between, a stack with its count in the item's own words.
  it('lists a whole hoard, commas between, a stack by its count', () => {
    const why = found({ to: 'actor-wren', hoardId: 'hoard-chest', placeId: 'place-weirs' });
    expect(
      say([
        made({ name: 'Glow wand', qty: 1, actor_id: 'actor-wren', location_id: null }, why),
        made({ name: 'Torch', qty: 3, actor_id: 'actor-wren', location_id: null, item_data: { unitName: 'torch', pluralName: 'torches' } }, why),
        made({ name: 'Reed rope', qty: 2, actor_id: 'actor-wren', location_id: null }, why),
      ]),
    ).toBe('Your GM gave Wren Glow wand, 3 torches, Reed rope ×2, from the drowned chest at the Eel Weirs.');
  });

  // Purpose: where the piece names no hoard, the line names the place only.
  it('reads "…, at <place>." with no hoard', () => {
    const why = found({ to: 'actor-wren', placeId: 'place-weirs' });
    expect(say([made({ name: 'Glow wand', qty: 1, actor_id: 'actor-wren', location_id: null }, why)])).toBe('Your GM gave Wren Glow wand, at the Eel Weirs.');
  });

  // Purpose: a find to the stash reads "Your GM put <thing> in the party stash, from <hoard> at <place>."
  it('reads "Your GM put <thing> in the party stash, …" for the stash', () => {
    const why = found({ to: null, hoardId: 'hoard-chest', placeId: 'place-weirs' });
    expect(say([made({ name: 'Reed rope', qty: 1, actor_id: null, location_id: 'place-stash' }, why)])).toBe('Your GM put Reed rope in the party stash, from the drowned chest at the Eel Weirs.');
  });

  // Purpose: coin in a find: the line the receiver's player and the GM read (they read the purse's change) names the
  // amount; the line everyone else reads (the purse's change isn't theirs) says "coin", with no amount (pu-9, rule 5).
  it('names the amount for those who read the purse, and "coin" for everyone else', () => {
    const why = found({ to: 'actor-wren', hoardId: 'hoard-chest', placeId: 'place-weirs', coin: true });
    const lantern = made({ name: 'Glow wand', qty: 1, actor_id: 'actor-wren', location_id: null }, why);
    const purse = coin('purse-wren', {}, { heron: 40 }, why);
    expect(say([purse])).toBe('Your GM gave Wren 40 herons, from the drowned chest at the Eel Weirs.');
    expect(say([lantern, purse])).toBe('Your GM gave Wren Glow wand, 40 herons, from the drowned chest at the Eel Weirs.');
    // Another player's log holds the find's other events but not the purse's change: "coin", never an amount.
    const other: LogNames = { ...names, me: 'user-tess', purses: new Map([['purse-stash', { actorId: null }]]) };
    expect(say([lantern], other)).toBe('Your GM gave Wren Glow wand, coin, from the drowned chest at the Eel Weirs.');
    const onlyCoin = event('find.give', { targetTable: 'locations', targetId: 'place-weirs', before: null, after: null, reason: why });
    expect(say([onlyCoin], other)).toBe('Your GM gave Wren coin, from the drowned chest at the Eel Weirs.');
    expect(say([onlyCoin], other)).not.toMatch(/\d/);
  });

  // Purpose: coin a find puts in the stash names its amount for everyone (every member reads the stash's purse).
  it('names the stash coin’s amount', () => {
    const why = found({ to: null, hoardId: 'hoard-chest', placeId: 'place-weirs', coin: true });
    expect(say([coin('purse-stash', { heron: 2 }, { heron: 22 }, why)])).toBe('Your GM put 20 herons in the party stash, from the drowned chest at the Eel Weirs.');
  });
});

describe('a find for a reader not shown the place (the lead, 2026-11-14)', () => {
  // Purpose: a reader whose group hasn't been shown the place reads the line without where it was found: "Your GM gave
  // Wren Glow wand." (their names hold no such place); never the place's or the hoard's name, nor their ids.
  it('drops "from <hoard> at <place>" for a reader not shown the place', () => {
    const why = found({ to: 'actor-wren', hoardId: 'hoard-chest', placeId: 'place-weirs' });
    const unshown: LogNames = { ...names, placeNames: new Map(), hoards: new Map() };
    const said = say([made({ name: 'Glow wand', qty: 1, actor_id: 'actor-wren', location_id: null }, why)], unshown);
    expect(said).toBe('Your GM gave Wren Glow wand.');
    expect(said).not.toMatch(/weirs|chest|place-|hoard-/i);
    const toStash = found({ to: null, hoardId: 'hoard-chest', placeId: 'place-weirs' });
    expect(say([made({ name: 'Reed rope', qty: 1, actor_id: null, location_id: 'place-stash' }, toStash)], unshown)).toBe('Your GM put Reed rope in the party stash.');
  });

  // Purpose: a reader shown the place but not the hoard reads the place alone: "…, at the Eel Weirs."
  it('names the place alone when the hoard isn’t the reader’s to read', () => {
    const why = found({ to: 'actor-wren', hoardId: 'hoard-chest', placeId: 'place-weirs' });
    expect(say([made({ name: 'Glow wand', qty: 1, actor_id: 'actor-wren', location_id: null }, why)], { ...names, hoards: new Map() })).toBe('Your GM gave Wren Glow wand, at the Eel Weirs.');
  });
});

describe('Take from the party stash (K28, pk-3)', () => {
  // Purpose: taking a whole thing from the stash reads "<Name> took <thing> from the party stash.", the character's
  // name, never the player's.
  it('reads "<Name> took <thing> from the party stash."', () => {
    const take = event('inventory.move', { actorUserId: 'user-sam', targetId: 'line-lantern', before: { actor_id: null, location_id: 'place-stash' }, after: { actor_id: 'actor-wren', location_id: null } });
    expect(say([take])).toBe('Wren took Hooded lantern from the party stash.');
  });

  // Purpose: part of a stack reads with its count in the item's own words: "Wren took 2 torches from the party stash."
  it('reads a stack’s count', () => {
    const split = { actorUserId: 'user-sam', requestId: 'request-split' };
    const events = [
      event('inventory.move', { ...split, targetId: 'line-torch', before: { qty: 6 }, after: { qty: 4 } }),
      event('inventory.move', { ...split, targetId: 'line-new', before: null, after: { name: 'Torch', qty: 2, actor_id: null, location_id: 'place-stash', item_data: { unitName: 'torch', pluralName: 'torches' } } }),
      event('inventory.move', { ...split, targetId: 'line-new', before: { actor_id: null, location_id: 'place-stash' }, after: { actor_id: 'actor-wren', location_id: null } }),
    ];
    expect(say(events)).toBe('Wren took 2 torches from the party stash.');
    const plain = events.map((e) => (e.after?.item_data ? { ...e, after: { ...e.after, item_data: {} } } : e));
    expect(say(plain)).toBe('Wren took Torch ×2 from the party stash.');
  });

  // Purpose: other moves read as before: into the stash, between characters, into a container.
  it('leaves every other move as it was', () => {
    expect(say([event('inventory.move', { targetId: 'line-lantern', before: { actor_id: 'actor-wren', location_id: null }, after: { actor_id: null, location_id: 'place-stash' } })])).toBe('Priya moved Hooded lantern to the Party stash.');
    expect(say([event('inventory.move', { targetId: 'line-lantern', before: { actor_id: 'actor-wren' }, after: { actor_id: 'actor-moss' } })])).toBe('Priya moved Hooded lantern to Moss.');
  });

  // Purpose (review rv-3, Important 1): a move out of another place (not the party stash) onto a character is never
  // read as a take from the stash: it reads as today's move line.
  it('never calls a move from another place a take from the stash', () => {
    const fromMill = event('inventory.move', { actorUserId: 'user-sam', targetId: 'line-lantern', before: { actor_id: null, location_id: 'place-mill' }, after: { actor_id: 'actor-wren', location_id: null } });
    expect(say([fromMill])).toBe('You moved Hooded lantern to Wren.');
    // Without the stash's kind in the names, nothing is called a take.
    const fromStash = event('inventory.move', { actorUserId: 'user-sam', targetId: 'line-lantern', before: { actor_id: null, location_id: 'place-stash' }, after: { actor_id: 'actor-wren', location_id: null } });
    expect(say([fromStash], { ...names, stashIds: undefined })).toBe('You moved Hooded lantern to Wren.');
  });

  // Purpose (review rv-3, Important 2; the lead, 2026-11-14): a whole stack taken at once names its count like a part
  // of one, "Wren took 6 torches from the party stash.", never "torch"; without a count to read, the item's name.
  it('names a whole stack’s count', () => {
    const whole = (targetId: string) => event('inventory.move', { actorUserId: 'user-sam', targetId, before: { actor_id: null, location_id: 'place-stash' }, after: { actor_id: 'actor-wren', location_id: null } });
    expect(say([whole('line-torches')], { ...names, items: new Map([['line-torches', 'Torch']]) })).toBe('Wren took 6 torches from the party stash.');
    expect(say([whole('line-lantern')])).toBe('Wren took Hooded lantern from the party stash.');
  });

  // Purpose (the lead, 2026-11-14): the GM's own take reads "Your GM took <thing> from the party stash.", never the
  // GM's own name and never "gave".
  it('reads the GM’s take as "Your GM took …"', () => {
    const gmTake = event('inventory.move', { actorUserId: 'user-priya', targetId: 'line-lantern', before: { actor_id: null, location_id: 'place-stash' }, after: { actor_id: 'actor-wren', location_id: null } });
    expect(say([gmTake])).toBe('Your GM took Hooded lantern from the party stash.');
  });
});
