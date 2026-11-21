// @vitest-environment jsdom
// Signing in from a link that carries the code (P1, 2026-11-06). Every address is invented. Purposes:
//   A link with the code and the email signs in at once (no tap), and the code leaves the address.
//   A code that fails stays filled in, with a clear line saying what to do; nothing is cleared.
//   Opened in a fresh browser (no email in the link), the email is asked first and finishes with the same code: no new
//   code is sent.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, FAKE_EMAIL_CODE, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const open = (address: string) => {
  window.history.replaceState(null, '', address);
  render(<Root db={world.db} />);
};

describe('signing in from a link with the code (P1)', () => {
  it('a link with the code and the email signs in at once, and the code leaves the address', async () => {
    open(`/?code=${FAKE_EMAIL_CODE}&email=wren%40lantern.example`);
    // A new person: signed in, the app asks their name.
    expect(await screen.findByLabelText('Your name')).toBeTruthy();
    expect(window.location.search).toBe('');
    expect(world.codesSentTo).toEqual([]);
  });

  it('a code that fails stays filled in, with a clear line', async () => {
    open('/?code=111111&email=wren%40lantern.example');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('Sign-in code') as HTMLInputElement).value).toBe('111111');
    expect(screen.getByRole('alert').textContent).toContain('The code from your email is still below: check it, or send a new one.');
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('opened in a fresh browser (no email), the email finishes it with the same code; no new code is sent', async () => {
    const user = userEvent.setup();
    open(`/?code=${FAKE_EMAIL_CODE}`);
    expect(await screen.findByText('Enter your email to finish signing in with the code from your email.')).toBeTruthy();
    await user.type(screen.getByLabelText('Email'), 'wren@lantern.example');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByLabelText('Your name')).toBeTruthy());
    expect(world.codesSentTo).toEqual([]);
  });
});
