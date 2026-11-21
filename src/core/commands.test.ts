import { describe, expect, it } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import { createRegistry, defineCommand, failed, fromWrite, isGm, ok, runCommand, STALE, type CurrentUser } from './commands.ts';
import type { Db } from './supabase.ts';

// A stand-in database that fails the test if anything touches it.
const untouchable = new Proxy({}, {
  get() {
    throw new Error('the database was touched');
  },
}) as unknown as Db;

const gm: CurrentUser = { id: 'user-gm', roles: { reedmouth: 'gm' } };
const player: CurrentUser = { id: 'user-wren', roles: { reedmouth: 'player' } };

const lightLantern = defineCommand({
  name: 'test.lightLantern',
  target: (input: { campaignId: string }) => input,
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db: Db) => {
    void db.from; // touches the database: must never happen when refused
    return ok('lit');
  },
});

const harmless = defineCommand({
  name: 'test.harmless',
  target: () => ({}),
  allowed: () => true,
  run: async () => ok('done'),
});

const explodes = defineCommand({
  name: 'test.explodes',
  target: () => ({}),
  allowed: () => true,
  run: async () => {
    throw new Error('The lantern exploded.');
  },
});

function registryWith(...commands: Parameters<ReturnType<typeof createRegistry>['register']>[0][]) {
  const registry = createRegistry();
  for (const command of commands) registry.register(command);
  return registry;
}

describe('running commands', () => {
  it('runs an allowed command and returns its result', async () => {
    const result = await runCommand(registryWith(harmless), untouchable, player, harmless, {});
    expect(result).toEqual({ ok: true, value: 'done' });
  });

  it("refuses a command the user isn't allowed to run, without touching the database", async () => {
    const result = await runCommand(registryWith(lightLantern), untouchable, player, lightLantern, { campaignId: 'reedmouth' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('refuses every command when nobody is signed in', async () => {
    const result = await runCommand(registryWith(harmless), untouchable, null, harmless, {});
    expect(result.ok).toBe(false);
  });

  it("refuses to run a command that isn't registered", async () => {
    const result = await runCommand(createRegistry(), untouchable, gm, harmless, {});
    expect(result.ok).toBe(false);
  });

  it('reports a command that throws as failed instead of crashing the screen', async () => {
    const result = await runCommand(registryWith(explodes), untouchable, gm, explodes, {});
    expect(result).toEqual({ ok: false, reason: 'failed', message: 'The lantern exploded.', requestId: expect.any(String) });
  });
});

describe('a retired campaign', () => {
  const retiredGm: CurrentUser = { ...gm, retired: ['reedmouth'] };
  const bringBack = defineCommand({ ...lightLantern, name: 'test.bringBack', whileRetired: true, run: async () => ok('back') });
  const registry = createRegistry();
  registry.register(lightLantern);
  registry.register(bringBack);

  it('refuses every change in it, even for the GM, with a plain message and without touching the database', async () => {
    expect(registry.can(retiredGm, 'test.lightLantern', { campaignId: 'reedmouth' })).toBe(false);
    expect(await runCommand(registry, untouchable, retiredGm, lightLantern, { campaignId: 'reedmouth' })).toEqual({
      ok: false,
      reason: 'not-allowed',
      message: 'This campaign is retired, so nothing in it can change.',
    });
  });

  it('still lets the GM bring it back, and leaves other campaigns alone', async () => {
    expect(await runCommand(registry, untouchable, retiredGm, bringBack, { campaignId: 'reedmouth' })).toEqual({ ok: true, value: 'back' });
    const alsoElsewhere: CurrentUser = { ...retiredGm, roles: { ...gm.roles, fenwick: 'gm' } };
    expect(registry.can(alsoElsewhere, 'test.lightLantern', { campaignId: 'fenwick' })).toBe(true);
  });
});

describe('the registry', () => {
  it('refuses to register two commands with the same name', () => {
    expect(() => registryWith(harmless, harmless)).toThrow(/already registered/);
  });

  it("can() says no to a command that isn't registered", () => {
    expect(createRegistry().can(gm, 'test.harmless', {})).toBe(false);
  });

  it('can() asks the command its own rule', () => {
    const registry = registryWith(lightLantern);
    expect(registry.can(gm, 'test.lightLantern', { campaignId: 'reedmouth' })).toBe(true);
    expect(registry.can(player, 'test.lightLantern', { campaignId: 'reedmouth' })).toBe(false);
    expect(registry.can(null, 'test.lightLantern', { campaignId: 'reedmouth' })).toBe(false);
  });
});

describe('reading database writes', () => {
  const error = (code: string, message: string) => ({ code, message, details: '', hint: '' }) as unknown as PostgrestError;

  it('returns the written row', () => {
    expect(fromWrite({ data: [{ id: 'row-1' }], error: null })).toEqual({ ok: true, value: { id: 'row-1' } });
  });

  it('treats a write the access rules filtered out (no rows) as not allowed', () => {
    expect(fromWrite({ data: [], error: null })).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('treats a permission error from the database as not allowed', () => {
    expect(fromWrite({ data: null, error: error('42501', 'denied') })).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('a save refused because it was made from an old copy is "stale", in the plain words the screens show (M5 step 4)', () => {
    expect(fromWrite({ data: null, error: error('GR409', 'whatever the database said') })).toEqual({ ok: false, reason: 'stale', message: STALE });
    expect(STALE).toBe("That's changed since. Here's the latest.");
  });

  it('reports other database errors as failed, with their message', () => {
    expect(fromWrite({ data: null, error: error('23514', 'name is empty') })).toEqual({
      ok: false,
      reason: 'failed',
      message: 'name is empty',
    });
  });
});

describe('fiat', () => {
  // Records the tag each request carries (see eventTags.ts), instead of talking to a database.
  function recordingDb() {
    const tags: { fiat: boolean; reason: string | null; type: string }[] = [];
    const db = {
      from: () => {
        const headers = new Headers();
        queueMicrotask(() => {
          const value = headers.get('x-grimoire-command');
          if (value) tags.push(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)))));
        });
        return { headers };
      },
    } as unknown as Db;
    return { db, tags };
  }

  const editSheet = defineCommand({
    name: 'test.editSheet',
    target: (input: { campaignId: string; ownerUserId: string }) => input,
    allowed: (user, target) => isGm(user, target.campaignId) || target.ownerUserId === user.id,
    // The GM using a player's own power on that player's character is a ruling.
    fiat: (user, target) => isGm(user, target.campaignId) && target.ownerUserId !== user.id,
    run: async (db: Db) => {
      db.from('actors');
      return ok('saved');
    },
  });
  const sheet = { campaignId: 'reedmouth', ownerUserId: 'user-wren' };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("the GM changing a player's character is tagged fiat, with the reason", async () => {
    const { db, tags } = recordingDb();
    await runCommand(registryWith(editSheet), db, gm, editSheet, sheet, { reason: '  The fever breaks. ' });
    await settle();
    expect(tags).toEqual([expect.objectContaining({ type: 'test.editSheet', fiat: true, reason: 'The fever breaks.' })]);
  });

  it("the owner doing the same isn't fiat, and a reason without fiat is dropped", async () => {
    const { db, tags } = recordingDb();
    await runCommand(registryWith(editSheet), db, player, editSheet, sheet, { reason: 'Because' });
    await settle();
    expect(tags).toEqual([expect.objectContaining({ fiat: false, reason: null })]);
  });

  it("a command that can't be fiat never is, even for the GM", async () => {
    const { db, tags } = recordingDb();
    const plain = defineCommand({ ...editSheet, name: 'test.plain', fiat: undefined });
    await runCommand(registryWith(plain), db, gm, plain, sheet, { reason: 'Because' });
    await settle();
    expect(tags).toEqual([expect.objectContaining({ fiat: false, reason: null })]);
  });
});

describe('request ids (M5 step 4: a command tried again is applied once)', () => {
  // Records each request's tag, in the order the command makes them.
  function recordingDb() {
    const tags: { requestId: string; part: number; type: string }[] = [];
    const db = {
      from: () => {
        const headers = new Headers();
        queueMicrotask(() => {
          const value = headers.get('x-grimoire-command');
          if (value) tags.push(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)))));
        });
        return { headers };
      },
    } as unknown as Db;
    return { db, tags };
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  // Two requests, then a failure (a lost connection, say).
  const twoSteps = defineCommand({
    name: 'test.twoSteps',
    target: (input: { campaignId: string }) => input,
    allowed: (user, target) => isGm(user, target.campaignId),
    run: async (db: Db) => {
      db.from('actors');
      db.from('inventory_lines');
      return failed('The connection dropped.');
    },
  });

  it("each request a command makes carries the command's one request id and its own number, in order", async () => {
    const { db, tags } = recordingDb();
    await runCommand(registryWith(twoSteps), db, gm, twoSteps, { campaignId: 'reedmouth' });
    await settle();
    expect(tags.map((t) => t.part)).toEqual([0, 1]);
    expect(new Set(tags.map((t) => t.requestId)).size).toBe(1);
  });

  it('a failed run says its request id, and trying again with it sends the same id and the same numbers', async () => {
    const first = recordingDb();
    const failedRun = await runCommand(registryWith(twoSteps), first.db, gm, twoSteps, { campaignId: 'reedmouth' });
    expect(failedRun).toMatchObject({ ok: false, requestId: expect.any(String) });
    const requestId = failedRun.ok ? '' : failedRun.requestId!;
    const again = recordingDb();
    await runCommand(registryWith(twoSteps), again.db, gm, twoSteps, { campaignId: 'reedmouth' }, { requestId });
    await settle();
    await settle();
    expect(again.tags.map((t) => [t.requestId, t.part])).toEqual(first.tags.map((t) => [t.requestId, t.part]));
    expect(again.tags.every((t) => t.requestId === requestId)).toBe(true);
  });
});
