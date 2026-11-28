// @vitest-environment jsdom
// The pinned spell's block At hand (ticket #168; spec docs/specs/player-sitting.md, piece 2; pss-5, psb-5, psb-6,
// pg28-2; frame M4g of page 28, approved 2026-11-20). Brannoch as the layout page's ?p1=spells makes him: Marsh light
// ready twice (one cast), a long-named spell with none left, Hush with no roll, Reed whisper in the book but not ready,
// and a pin whose spell has left the book. Invented names only (hard rule 2). Purposes:
//   The pinned spells come first in At hand, one block each in the pins' order, then the items, then the light; the
//   weapon in hand's block stays above At hand; a pin whose spell has left the book shows nothing.
//   A block reads the star and the name, the state ("Memorized, 1 of 2 left"), the roll ("d6 +2 turns") and the range
//   ("30 paces range"), with Cast; a spell with no roll and no range has neither line.
//   Cast spends a casting with the Magic tab's toast and Undo, and the state follows; Undo gives it back.
//   With no casting left, Cast stays a button and opens a pop-up that says why; nothing is spent.
//   A spell in the book but not ready today keeps its block, "Not memorized", and Cast says why in a pop-up.
//   The name opens the spell's sheet, its Pin star filled.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../../core/files.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN, P1_LONG_SPELL } from '../../testing/layoutP1Character.ts';
import { Root } from '../App.tsx';
import { forgetCampaignSetting } from '../campaignSetting.ts';

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** Brannoch with his pinned spells (?p1=spells), on the Player tab. */
async function caster() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  await addP1Character(world, { gm, sam, fenPack, head: 'spells' });
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  const atHand = await screen.findByRole('region', { name: 'At hand' });
  await within(atHand).findByRole('button', { name: /^Marsh light/ });
  return { user, atHand };
}

const order = (el: Element) => [...document.querySelectorAll('*')].indexOf(el);
/** A spell's block: the list item its name's button sits in. */
const block = (name: string | RegExp) => screen.getByRole('button', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name }).closest('li')!;
const lines = (li: Element) => [...li.querySelectorAll('.weapon-in-hand__roll')].map((r) => r.textContent);
const cast = () => world.tables.character_play[0]!.spells_cast as Record<string, number>;

describe('the pinned spell At hand (Player sitting piece 2)', () => {
  it('comes first in At hand, one block a pin in order, then the items and the light; a gone spell shows nothing', async () => {
    const { atHand } = await caster();
    const names = within(atHand)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
      .filter((n) => /^(Marsh light|The Lady|Hush|Reed whisper)/.test(n));
    expect(names.map((n) => n.split(',')[0]!.trim())).toEqual(['Marsh light', P1_LONG_SPELL, 'Hush', 'Reed whisper']);
    expect(order(block('Reed whisper'))).toBeLessThan(order(within(atHand).getByRole('button', { name: /^Eel knife/ })));
    expect(order(within(atHand).getByRole('button', { name: /^Eel knife/ }))).toBeLessThan(order(within(atHand).getAllByRole('button', { name: /Storm lantern/ })[0]!));
    expect(order(screen.getByRole('region', { name: 'Weapon in hand' }))).toBeLessThan(order(atHand));
    expect(within(atHand).queryByText(/gone-spell/)).toBeNull();
  });

  it('reads the star and name, the state, the roll and the range, with Cast; no roll and no range, no lines', async () => {
    await caster();
    const marsh = block('Marsh light');
    expect(within(marsh).getByRole('button', { name: /^Marsh light, pinned/ })).toBeTruthy();
    expect(marsh.textContent).toContain('Memorized, 1 of 2 left');
    expect(lines(marsh)).toEqual(['d6 +2 turns', '30 paces range']);
    expect(within(marsh).getByRole('button', { name: 'Cast Marsh light' })).toBeTruthy();
    const hush = block('Hush');
    expect(hush.textContent).toContain('Memorized, 1 of 1 left');
    expect(lines(hush)).toEqual([]);
  });

  it('casts with the Magic tab’s toast and Undo, the state following', async () => {
    const { user } = await caster();
    await user.click(within(block('Marsh light')).getByRole('button', { name: 'Cast Marsh light' }));
    const toast = await screen.findByText('Marsh light cast');
    expect(cast()['1:marsh-light']).toBe(2);
    await waitFor(() => expect(block('Marsh light').textContent).toContain('Memorized, 0 of 2 left'));
    await user.click(within(toast.closest('[role="status"]') ?? document.body).getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(cast()['1:marsh-light']).toBe(1));
    await waitFor(() => expect(block('Marsh light').textContent).toContain('Memorized, 1 of 2 left'));
  });

  it('with none left, Cast stays a button and says why; nothing is spent', async () => {
    const { user } = await caster();
    const long = block(/^The Lady of the Lanterns/);
    expect(long.textContent).toContain('Memorized, 0 of 2 left');
    await user.click(within(long).getByRole('button', { name: `Cast ${P1_LONG_SPELL}` }));
    const why = await screen.findByRole('dialog', { name: `Can't cast ${P1_LONG_SPELL}` });
    expect(why.textContent).toMatch(/no castings of it left today/i);
    expect(cast()['1:lady-lanterns']).toBe(2);
  });

  it('keeps a spell in the book but not ready: "Not memorized", and Cast says why', async () => {
    const { user } = await caster();
    const reed = block('Reed whisper');
    expect(reed.textContent).toContain('Not memorized');
    expect(lines(reed)).toEqual(['60 paces range']);
    await user.click(within(reed).getByRole('button', { name: 'Cast Reed whisper' }));
    const why = await screen.findByRole('dialog', { name: "Can't cast Reed whisper" });
    expect(why.textContent).toMatch(/isn't ready today/);
    expect(Object.keys(cast())).not.toContain('1:reed-whisper');
  });

  it('opens the spell’s sheet from its name, the star filled', async () => {
    const { user } = await caster();
    await user.click(within(block('Marsh light')).getByRole('button', { name: /^Marsh light, pinned/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Marsh light' });
    expect(within(sheet).getByRole('button', { name: 'Unpin' }).getAttribute('aria-pressed')).toBe('true');
  });
});
