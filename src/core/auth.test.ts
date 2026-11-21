import { describe, expect, it, vi } from 'vitest';
import { codeFromAddress, friendlyAuthError, isCompleteCode, isValidEmail, normalizeCode, normalizeEmail, signOut, watchSession } from './auth.ts';
import { createFakeDb } from '../testing/fakeDb.ts';

describe('email addresses', () => {
  it('ignores spaces and capital letters around an email', () => {
    expect(normalizeEmail('  Wren@Lantern.Example ')).toBe('wren@lantern.example');
  });

  it('accepts an ordinary email and rejects ones that are clearly incomplete', () => {
    expect(isValidEmail('wren@lantern.example')).toBe(true);
    for (const bad of ['', 'wren', 'wren@', '@lantern.example', 'wren@lantern', 'wren @lantern.example']) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

describe('sign-in codes', () => {
  it('keeps only the digits, so pasted codes with spaces or dashes still work', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('123-456')).toBe('123456');
    expect(normalizeCode(' 1a2b3c4d5e6f ')).toBe('123456');
  });

  it('never keeps more than six digits', () => {
    expect(normalizeCode('12345678')).toBe('123456');
  });

  it('knows when all six digits are in', () => {
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('123456')).toBe(true);
  });
});

// The sign-in link's email keeps a "+" (P1, 2026-11-07): an address like wren+table@… arrives whole, whether the email
// template writes it as it is or percent-encoded.
describe('the sign-in link', () => {
  it('keeps a "+" in the email, written as it is or encoded', () => {
    expect(codeFromAddress('?code=123456&email=wren+table@lantern.example')).toEqual({ code: '123456', email: 'wren+table@lantern.example' });
    expect(codeFromAddress('?code=123456&email=wren%2Btable%40lantern.example')).toEqual({ code: '123456', email: 'wren+table@lantern.example' });
  });

  it('gives no email when the link has none or a broken one, and nothing without a whole code', () => {
    expect(codeFromAddress('?code=123456')).toEqual({ code: '123456', email: null });
    expect(codeFromAddress('?code=123456&email=%E0%A4%A')).toEqual({ code: '123456', email: null });
    expect(codeFromAddress('?code=123&email=wren@lantern.example')).toBeNull();
  });
});

describe('sign-in error messages', () => {
  it('explains a wrong or expired code in plain words', () => {
    expect(friendlyAuthError({ code: 'otp_expired' })).toMatch(/didn't work/);
  });

  it('asks people to wait when they ask for too many codes', () => {
    expect(friendlyAuthError({ code: 'over_email_send_rate_limit' })).toMatch(/Wait a minute/);
    expect(friendlyAuthError({ status: 429 })).toMatch(/Wait a minute/);
  });

  it('says when the app is offline', () => {
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError' })).toMatch(/connection/);
  });

  it('never shows raw technical errors', () => {
    expect(friendlyAuthError({ code: 'unexpected_failure', message: 'pq: relation does not exist' })).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

function signedInWorld() {
  const world = createFakeDb();
  const userId = world.addPerson('wren@example.com', 'Wren');
  world.signInAs(userId);
  return { world, userId };
}

/** Lets queued microtasks and the zero-delay second look run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('signing out', () => {
  // Purpose: signing out on one device asks Supabase to end only this device's session (scope local).
  it("ends only this device's session", async () => {
    const { world } = signedInWorld();
    await signOut(world.db);
    expect(world.signOutCalls).toEqual([{ scope: 'local' }]);
  });

  // Purpose: a real sign-out (Sign out tapped) shows the sign-in screen at once.
  it('shows the sign-in screen at once when Sign out is tapped', async () => {
    const { world, userId } = signedInWorld();
    const seen: Array<string | null> = [];
    const stop = watchSession(world.db, (id) => seen.push(id));
    await settle();
    expect(seen).toEqual([userId]);
    const getSession = vi.spyOn(world.db.auth, 'getSession');
    await signOut(world.db);
    expect(seen).toEqual([userId, null]);
    expect(getSession).not.toHaveBeenCalled();
    stop();
  });

  // Purpose: a sign-out event this device didn't ask for, followed by a valid session on a second look, keeps the person signed in.
  it('keeps the person signed in when the stored session is still there', async () => {
    const { world, userId } = signedInWorld();
    const seen: Array<string | null> = [];
    const stop = watchSession(world.db, (id) => seen.push(id));
    await settle();
    world.emitAuthEvent('SIGNED_OUT', null);
    await settle();
    expect(seen.at(-1)).toBe(userId);
    expect(seen).not.toContain(null);
    stop();
  });

  // Purpose: a sign-out the device didn't ask for, with no session left on the second look, shows the sign-in screen.
  it('shows sign-in when the second look finds no session', async () => {
    const { world, userId } = signedInWorld();
    const seen: Array<string | null> = [];
    const stop = watchSession(world.db, (id) => seen.push(id));
    await settle();
    world.loseStoredSession();
    world.emitAuthEvent('SIGNED_OUT', null);
    await settle();
    expect(seen).toEqual([userId, null]);
    stop();
  });

  // Purpose: once the app stops watching, a second look that lands late changes nothing.
  it('ignores a second look that lands after watching stopped', async () => {
    const { world, userId } = signedInWorld();
    const seen: Array<string | null> = [];
    const stop = watchSession(world.db, (id) => seen.push(id));
    await settle();
    world.loseStoredSession();
    world.emitAuthEvent('SIGNED_OUT', null);
    stop();
    await settle();
    expect(seen).toEqual([userId]);
  });
});
