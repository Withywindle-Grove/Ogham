// @vitest-environment jsdom
// The second review of the Player stack (dec-13 C8's traits): two small fixes in PlayerTraits. Invented names only.
// Purposes:
//   Undo of an unpin puts the trait back where it was among the pins, not last.
//   Two traits with the same name (a class's and a kindred's) each have their own row, and each opens its own words.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import { pinToAtHand } from '../../modules/characters/pins.ts';
import { loadCharacterPlay, type CharacterPlay } from '../../modules/characters/playState.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { ToastHost } from '../../ui/ToastHost.tsx';
import type { characterFigures } from '../fromSetting.ts';
import { registry } from '../services.ts';
import { PlayerTraits } from './PlayerTraits.tsx';

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let sam: string;
let campaign: string;
let wren: MyCharacter;
let user: CurrentUser;

beforeEach(() => {
  world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player');
  const id = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  wren = { id, campaignId: campaign, ownerUserId: sam, level: 1 } as MyCharacter;
  world.signInAs(sam);
  user = { id: sam, roles: { [campaign]: 'player' } };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ability = (name: string, note: string) => ({ name, uses: 2, refill: 'day', note });
const figuresOf = (klass: object[], race: object[] = []) =>
  ({ klass: { abilities: klass }, race: { abilities: race } }) as unknown as ReturnType<typeof characterFigures>;
const playOf = (pins: CharacterPlay['pins']) => ({ pins, prepared: [], usesSpent: {}, acOverride: null, formId: null }) as unknown as CharacterPlay;

function traits(figures: ReturnType<typeof characterFigures>, play: CharacterPlay, place: 'list' | 'atHand' = 'list') {
  render(
    <ToastHost>
      <PlayerTraits db={world.db} user={user} character={wren} figures={figures} play={play} onChanged={() => undefined} source={() => null} place={place} />
    </ToastHost>,
  );
}

describe('PlayerTraits (the second review of the Player stack)', () => {
  // Purpose: Undo of an unpin puts the trait back where it was among the pins, not last.
  it('puts an unpinned trait back in its place on Undo', async () => {
    for (const key of ['Ember ward', 'Steady flame', 'Fen sight']) await runCommand(registry, world.db, user, pinToAtHand, { character: wren, kind: 'trait', key, pinned: true });
    const play = (await loadCharacterPlay(world.db, wren.id))!;
    traits(figuresOf([ability('Ember ward', 'Wards.'), ability('Steady flame', 'Burns.'), ability('Fen sight', 'Sees.')]), play, 'atHand');
    const tap = userEvent.setup();
    await tap.click(screen.getByRole('button', { name: /^Steady flame/ }));
    await tap.click(within(await screen.findByRole('dialog', { name: 'Steady flame' })).getByRole('button', { name: 'Unpin' }));
    await waitFor(async () => expect((await loadCharacterPlay(world.db, wren.id))!.pins.map((p) => p.key)).toEqual(['Ember ward', 'Fen sight']));
    await tap.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await loadCharacterPlay(world.db, wren.id))!.pins.map((p) => p.key)).toEqual(['Ember ward', 'Steady flame', 'Fen sight']));
  });

  // Purpose: two traits with the same name each have their own row, and each opens its own words.
  it('gives two same-named traits their own rows, each opening its own words', async () => {
    const warned = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    traits(figuresOf([ability('Steady flame', 'The warden’s flame.')], [ability('Steady flame', 'The kindred’s flame.')]), playOf([]));
    const rows = screen.getAllByRole('button', { name: /^Steady flame/ });
    expect(rows).toHaveLength(2);
    expect(warned.mock.calls.some((c) => /same key/.test(String(c[0])))).toBe(false);
    const tap = userEvent.setup();
    await tap.click(rows[0]!);
    expect(within(await screen.findByRole('dialog', { name: 'Steady flame' })).getByText('The warden’s flame.')).toBeTruthy();
    await tap.click(screen.getByRole('button', { name: 'Close' }));
    await tap.click(screen.getAllByRole('button', { name: /^Steady flame/ })[1]!);
    expect(within(await screen.findByRole('dialog', { name: 'Steady flame' })).getByText('The kindred’s flame.')).toBeTruthy();
  });
});
