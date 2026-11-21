// Requests (M5 step 12): the escape roll's prompt and total, pure. Invented rules only.
import { describe, expect, it } from 'vitest';
import type { RolledExit } from '../expedition/dungeonExit.ts';
import { escapePromptOf, escapeTotal, readEscapePrompt, readSecretActivityPrompt } from './requests.ts';

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
