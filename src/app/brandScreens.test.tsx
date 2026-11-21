// @vitest-environment jsdom
// The Tome rename (2026-11-07, mockup brand/01-tome, option A): where the wordmark shows and where it never does.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRAND } from '../brand.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { LoadingScreen, Root, Wordmark } from './App.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('the wordmark (Tome, option A)', () => {
  it('is the name as written, in the wordmark style (even capitals come from the style, so a screen reader says the word)', () => {
    render(<Wordmark size="head" />);
    const mark = screen.getByText('Tome');
    expect(mark.className).toBe('wordmark wordmark--head');
  });

  it('sign-in: the wordmark, a short rule under it, then the tagline', async () => {
    render(<Root db={world.db} />);
    const header = await screen.findByRole('banner');
    const mark = within(header).getByText(BRAND.appName);
    expect(mark.classList.contains('wordmark--welcome')).toBe(true);
    const rule = header.querySelector('.shell__rule');
    const tagline = within(header).getByText('Here beginneth a tale of high adventure.');
    expect(rule).toBeTruthy();
    // In that order: the wordmark, the rule, the tagline.
    expect(mark.compareDocumentPosition(rule!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rule!.compareDocumentPosition(tagline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/old oaks/i)).toBeNull();
  });

  it('the loading screen: the wordmark and the dictionary entry, with no phonetics', () => {
    render(<LoadingScreen />);
    const status = screen.getByRole('status');
    expect(within(status).getByText(BRAND.appName).classList.contains('wordmark--loading')).toBe(true);
    expect(status.textContent).toContain('tome, noun, from the Greek tomos, one volume of a work: a large and weighty book. What the table remembers.');
    expect(within(status).getByText('tomos').tagName).toBe('I');
    expect(status.textContent).not.toMatch(/\//);
  });

  it('Your campaigns: the wordmark in the head; inside a campaign the name never appears', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Lantern Marsh', gm);
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText(BRAND.appName).classList.contains('wordmark--head')).toBe(true);
    await user.click(await screen.findByRole('button', { name: /The Lantern Marsh/ }));
    await screen.findByRole('button', { name: '‹ Your campaigns' });
    expect(screen.queryByText(BRAND.appName)).toBeNull();
    expect(document.querySelector('.wordmark')).toBeNull();
  });
});
