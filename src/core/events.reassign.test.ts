// The log's line when the GM gives a character to a player or takes it back (page 13 of the December mockups,
// approved 2026-11-13).
//   Purpose: the line is worded for its reader: the GM ("You gave Ash to Sam."), the player who has it now ("Your GM
//   gave you Ash."), the player who had it ("Your GM gave Wren to Robin.", "Your GM took Wren back."), anyone else
//   by the GM's name; the active-character line the give wrote in the same request does not take over the line.
import { describe, expect, it } from 'vitest';
import { describeEntry, groupEntries, type LogEvent, type LogNames } from './events.ts';

const names = (me: string): LogNames => ({
  me,
  people: new Map([
    ['user-priya', 'Priya'],
    ['user-sam', 'Sam'],
    ['user-robin', 'Robin'],
  ]),
  characters: new Map([
    ['actor-wren', 'Wren'],
    ['actor-ash', 'Ash'],
  ]),
  companies: new Map(),
  fields: new Map(),
  packs: new Map(),
  items: new Map(),
  places: new Map(),
});

let seq = 0;
const line = (extra: Partial<LogEvent>): LogEvent => {
  seq += 1;
  return {
    id: `event-${seq}`,
    seq,
    type: 'character.reassign',
    level: 'simple',
    actorUserId: 'user-priya',
    targetTable: 'actors',
    targetId: 'actor-ash',
    before: null,
    after: null,
    fiat: false,
    reason: null,
    revertsEventId: null,
    requestId: 'request-give',
    createdAt: '2026-11-14T05:00:00Z',
    ...extra,
  };
};
const say = (me: string, ...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, names(me));

const giveAsh = line({ before: { owner_type: 'gm', owner_user_id: null }, after: { owner_type: 'user', owner_user_id: 'user-sam' } });
const wrenOn = line({ targetId: 'actor-wren', before: { owner_user_id: 'user-sam' }, after: { owner_user_id: 'user-robin' } });
const wrenBack = line({ targetId: 'actor-wren', before: { owner_type: 'user', owner_user_id: 'user-sam' }, after: { owner_type: 'gm', owner_user_id: null } });

describe('the line for a character given to a player', () => {
  it('reads to each person as page 13 says', () => {
    expect(say('user-priya', giveAsh)).toBe('You gave Ash to Sam.');
    expect(say('user-sam', giveAsh)).toBe('Your GM gave you Ash.');
    expect(say('user-robin', giveAsh)).toBe('Priya gave Ash to Sam.');
    expect(say('user-sam', wrenOn)).toBe('Your GM gave Wren to Robin.');
    expect(say('user-robin', wrenOn)).toBe('Your GM gave you Wren.');
    expect(say('user-priya', wrenOn)).toBe('You gave Wren to Robin.');
  });

  it('a take-back reads as page 13 says', () => {
    expect(say('user-priya', wrenBack)).toBe('You took Wren back from Sam.');
    expect(say('user-sam', wrenBack)).toBe('Your GM took Wren back.');
    expect(say('user-robin', wrenBack)).toBe('Priya took Wren back from Sam.');
  });

  it('the active-character line in the same request does not take over', () => {
    const member = line({ targetTable: 'members', targetId: 'member-robin', before: { active_actor_id: null }, after: { active_actor_id: 'actor-wren' } });
    expect(say('user-priya', wrenOn, member)).toBe('You gave Wren to Robin.');
  });
});
