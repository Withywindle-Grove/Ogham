// Requests (M5 step 12): the escape roll's prompt and total, pure. Invented rules only.
import { describe, expect, it } from 'vitest';
import type { RolledExit } from '../expedition/dungeonExit.ts';
import { escapePromptOf, escapeTotal, mine, readEscapePrompt, readSecretActivityPrompt, type Request } from './requests.ts';

const rule: RolledExit = {
  roll: { save: 'nerve' },
  modifiers: [{ id: 'map', name: 'Has a map', value: 2 }],
  depth: { per: 1, value: -1 },
  onFailTable: 'lost-below',
  safePaths: 'Follow the chalk marks back.',
  who: 'each',
};

describe('the escape roll prompt', () => {
  it("carries only what the player needs: never the pack's doom table or safe paths (hidden means hidden)", () => {
    const prompt = escapePromptOf(rule, 2);
    expect(prompt).toEqual({ roll: { save: 'nerve' }, modifiers: [{ id: 'map', name: 'Has a map', value: 2 }], depth: -2, levelsDown: 2 });
    expect(Object.keys(prompt)).not.toContain('onFailTable');
    expect(JSON.stringify(prompt)).not.toContain('lost-below');
    expect(JSON.stringify(prompt)).not.toContain('chalk');
  });

  it('reads back from the stored row, and the total counts the switches on and the depth', () => {
    const read = readEscapePrompt(escapePromptOf(rule, 1) as unknown as Record<string, unknown>)!;
    expect(escapeTotal(read, { roll: 14, on: ['map'] })).toEqual({ total: 15, parts: ['+2 (Has a map)', '−1 (1 level below the first)'] });
    expect(escapeTotal(read, { roll: 14, on: [] }).total).toBe(13);
  });
});

describe('reading a secret activity prompt', () => {
  // Purpose: a full prompt reads back as it was sent.
  it('reads a full prompt', () => {
    expect(readSecretActivityPrompt({ activityId: 'scout', group: 2, actorIds: ['reed', 'sam'], spend: 3 })).toEqual({ activityId: 'scout', group: 2, actorIds: ['reed', 'sam'], spend: 3 });
  });

  // Purpose: a prompt that doesn't say which activity it is for can't be a secret activity.
  it('a prompt without an activity id is null', () => {
    expect(readSecretActivityPrompt({ group: 1, spend: 2 })).toBeNull();
    expect(readSecretActivityPrompt({ activityId: '', spend: 2 })).toBeNull();
  });

  // Purpose: odd values are made safe: 'all' stays, a bad spend is 0, the group defaults to 1, non-text actor ids are dropped.
  it("keeps 'all', zeroes a bad spend, defaults the group and drops non-text actor ids", () => {
    expect(readSecretActivityPrompt({ activityId: 'scout', spend: 'all' })?.spend).toBe('all');
    expect(readSecretActivityPrompt({ activityId: 'scout', spend: -4 })?.spend).toBe(0);
    expect(readSecretActivityPrompt({ activityId: 'scout' })?.spend).toBe(0);
    expect(readSecretActivityPrompt({ activityId: 'scout' })?.group).toBe(1);
    expect(readSecretActivityPrompt({ activityId: 'scout', actorIds: ['reed', 7, null] })?.actorIds).toEqual(['reed']);
  });
});

// A request with no player shows as the party's only when it has no character either (as the database reads it,
// 20261125150000_account_deletion_orphaned_requests_stay_hidden.sql): the GM's question to a player whose account was
// deleted stays the GM's.
describe("a player's own requests and the party's", () => {
  const ask = (id: string, extra: Partial<Request>): Request => ({
    id, campaignId: 'c', expeditionId: null, group: null, requesterId: null, actorId: null, kind: 'escapeRoll', direction: 'gmAsks',
    text: '', costText: '', prompt: {}, entry: null, status: 'waiting', answerKind: 'yesNo', answer: null, answeredAt: null,
    reply: null, createdAt: '', version: 1, ...extra,
  });

  it("shows the party's request (no player, no character) to every player", () => {
    expect(mine([ask('party', {})], 'u-bryn').map((r) => r.id)).toEqual(['party']);
  });

  it.fails("doesn't show another player a question whose player was deleted (no player, but a character)", () => {
    expect(mine([ask('orphan', { actorId: 'wren', kind: 'askGm' })], 'u-bryn')).toEqual([]);
  });
});
