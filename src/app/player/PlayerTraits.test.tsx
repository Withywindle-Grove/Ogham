// @vitest-environment jsdom
// The second review of the Player stack (dec-13 C8's traits): two small fixes in PlayerTraits. Invented names only.
// Purposes:
//   Undo of an unpin puts the trait back where it was among the pins, not last.
//   Two traits with the same name (a class's and a kindred's) each have their own row, and each opens its own words.
// Row P3 (page 28, approved 2026-11-20; pg28-1 to pg28-8), each a plain sentence:
//   P3-1. The list is headed "Abilities and traits"; a pinned trait with uses is a block in it, led by the star, before
//         the unpinned ones, which stay rows.
//   P3-2. A pinned ability with only words is a row with no button but its own: a tap opens its pop-up.
//   P3-3. The pinned ones follow the pins' list, whatever order the sheet has them in.
//   P3-4. Move up and Move down in a pinned one's pop-up move it at once and the pop-up stays open; the first has no
//         Move up, the last no Move down.
//   P3-5. At 24 pins the star stays a button and says why: "Can't pin <name>" / the ruled line; nothing is written.
//   P3-6. The heading's ⓘ explains hold to move, while something is pinned.
//   P3-7. Past ten uses a block draws no pips, the words alone counting.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import { pinToAtHand } from '../../modules/characters/pins.ts';
import { loadCharacterPlay, PIN_LIMIT, type CharacterPlay } from '../../modules/characters/playState.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { ToastHost } from '../../ui/ToastHost.tsx';
import type { PinnableRow } from '../CharacterSheet.tsx';
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

function traits(figures: ReturnType<typeof characterFigures>, play: CharacterPlay, pinnable: PinnableRow[] = []) {
  return render(
    <ToastHost>
      <PlayerTraits db={world.db} user={user} character={wren} figures={figures} play={play} onChanged={() => undefined} source={() => null} pinnable={pinnable} />
    </ToastHost>,
  );
}

/** The list drawn again from the stored pins after each change, as the Player screen does (`onChanged`). */
function liveTraits(figures: ReturnType<typeof characterFigures>, pinnable: PinnableRow[] = []) {
  function Live() {
    const [play, setPlay] = useState<CharacterPlay | null>(null);
    const [version, setVersion] = useState(0);
    useEffect(() => {
      void loadCharacterPlay(world.db, wren.id).then(setPlay);
    }, [version]);
    return play ? <PlayerTraits db={world.db} user={user} character={wren} figures={figures} play={play} onChanged={() => setVersion((v) => v + 1)} source={() => null} pinnable={pinnable} /> : null;
  }
  render(
    <ToastHost>
      <Live />
    </ToastHost>,
  );
}

const pinAll = async (...keys: string[]) => {
  for (const key of keys) await runCommand(registry, world.db, user, pinToAtHand, { character: wren, kind: 'trait', key, pinned: true });
};
const storedOrder = async () => (await loadCharacterPlay(world.db, wren.id))!.pins.map((p) => p.key);
const boxNames = () => [...document.querySelectorAll('.pinned-box')].map((b) => b.querySelector('.list-row__title')?.textContent?.replace(', pinned', ''));

describe('PlayerTraits (the second review of the Player stack)', () => {
  // Purpose: Undo of an unpin puts the trait back where it was among the pins, not last.
  it('puts an unpinned trait back in its place on Undo', async () => {
    for (const key of ['Ember ward', 'Steady flame', 'Fen sight']) await runCommand(registry, world.db, user, pinToAtHand, { character: wren, kind: 'trait', key, pinned: true });
    const play = (await loadCharacterPlay(world.db, wren.id))!;
    traits(figuresOf([ability('Ember ward', 'Wards.'), ability('Steady flame', 'Burns.'), ability('Fen sight', 'Sees.')]), play);
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

describe('PlayerTraits, the right column’s list (row P3, page 28)', () => {
  // Purpose P3-1: the list is headed "Abilities and traits"; a pinned trait with uses is a block, led by the star, before
  // the unpinned ones, which stay rows.
  it('heads the list "Abilities and traits", the pinned trait a block first, the unpinned one a row', async () => {
    await pinAll('Fen sight');
    traits(figuresOf([ability('Ember ward', 'Wards.'), ability('Fen sight', 'Sees.')]), (await loadCharacterPlay(world.db, wren.id))!);
    expect(screen.getByRole('heading', { name: 'Abilities and traits' })).toBeTruthy();
    const block = document.querySelector('.pinned-box--block')!;
    expect(within(block as HTMLElement).getByRole('button', { name: 'Use Fen sight' })).toBeTruthy();
    expect(block.textContent).toContain('Fen sight, pinned');
    const unpinned = screen.getByRole('button', { name: 'Use Ember ward' });
    expect(unpinned.closest('.pinned-box')).toBeNull();
    expect(block.compareDocumentPosition(unpinned) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Purpose P3-2: a pinned ability with only words is a row with no button but its own; a tap opens its pop-up.
  it('draws a pinned ability with only words as a row, opening its own pop-up', async () => {
    await pinAll('Sure-footed');
    const opened = vi.fn();
    traits(figuresOf([]), (await loadCharacterPlay(world.db, wren.id))!, [{ key: 'trait:sure', name: 'Sure-footed', onOpen: opened }]);
    const row = document.querySelector('.pinned-box') as HTMLElement;
    expect(row.classList.contains('pinned-box--block')).toBe(false);
    const buttons = within(row).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    await userEvent.setup().click(buttons[0]!);
    expect(opened).toHaveBeenCalledOnce();
  });

  // Purpose P3-3: the pinned ones follow the pins' list, whatever order the sheet has them in.
  it('follows the pins’ order, blocks and rows mixed', async () => {
    await pinAll('Shield wall', 'Horn charge', 'Sure-footed');
    const pinnable = [
      { key: 'a', name: 'Sure-footed', onOpen: () => undefined },
      { key: 'b', name: 'Shield wall', onOpen: () => undefined },
      { key: 'c', name: 'Horn charge', onOpen: () => undefined },
    ];
    traits(figuresOf([ability('Horn charge', 'A blow.')]), (await loadCharacterPlay(world.db, wren.id))!, pinnable);
    expect(boxNames()).toEqual(['Shield wall', 'Horn charge', 'Sure-footed']);
  });

  // Purpose P3-4: Move up and Move down move it at once and the pop-up stays open; the first has no Move up.
  it('moves a pinned one with Move up and Move down, the pop-up staying open', async () => {
    await pinAll('Horn charge', 'Fen sight');
    liveTraits(figuresOf([ability('Horn charge', 'A blow.'), ability('Fen sight', 'Sees.')]));
    const tap = userEvent.setup();
    await tap.click(await screen.findByRole('button', { name: /^Horn charge/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Horn charge' });
    expect(within(dialog).queryByRole('button', { name: 'Move up' })).toBeNull();
    await tap.click(within(dialog).getByRole('button', { name: 'Move down' }));
    await waitFor(async () => expect(await storedOrder()).toEqual(['Fen sight', 'Horn charge']));
    const still = await screen.findByRole('dialog', { name: 'Horn charge' });
    await waitFor(() => expect(within(still).getByRole('button', { name: 'Move up' })).toBeTruthy());
    expect(within(still).queryByRole('button', { name: 'Move down' })).toBeNull();
    await waitFor(() => expect(boxNames()).toEqual(['Fen sight', 'Horn charge']));
  });

  // Purpose P3-5: at 24 pins the star stays a button and says why, with the ruled words; nothing is written.
  it('explains the limit when the 25th star is tapped', async () => {
    await pinAll(...Array.from({ length: PIN_LIMIT }, (_, n) => `Power ${n}`));
    const before = world.tables.events.length;
    traits(figuresOf([ability('Shield wall', 'Holds.')]), (await loadCharacterPlay(world.db, wren.id))!);
    const tap = userEvent.setup();
    await tap.click(screen.getByRole('button', { name: /^Shield wall/ }));
    await tap.click(within(await screen.findByRole('dialog', { name: 'Shield wall' })).getByRole('button', { name: 'Pin to top' }));
    const why = await screen.findByRole('dialog', { name: "Can't pin Shield wall" });
    expect(why.textContent).toContain('A character can have 24 pins. Unpin one to make room.');
    expect(world.tables.events).toHaveLength(before);
  });

  // Purpose P3-6: the heading's ⓘ explains hold to move, while something is pinned.
  it('explains hold to move from the heading’s ⓘ, only with something pinned', async () => {
    const { unmount } = traits(figuresOf([ability('Fen sight', 'Sees.')]), playOf([]));
    expect(screen.queryByRole('button', { name: 'About moving pinned ones' })).toBeNull();
    unmount();
    traits(figuresOf([ability('Fen sight', 'Sees.')]), playOf([{ kind: 'trait', key: 'Fen sight' }]));
    await userEvent.setup().click(screen.getByRole('button', { name: 'About moving pinned ones' }));
    // Page 28's words as drawn (frame M4e; the driver's settling, rvw-13).
    const about = await screen.findByRole('dialog', { name: 'Hold to move' });
    expect(about.textContent).toContain('Hold a pinned one for half a second, then drag it up or down. The others make room.');
    expect(about.textContent).toContain('A tap opens it, as before.');
  });

  // Purpose P3-7: past ten uses a block draws no pips, the words alone counting; ten draws ten.
  it('draws no pips in a block past ten uses', () => {
    const many = { name: 'Lantern tally', uses: 999, refill: 'day', note: '' };
    const ten = { name: 'Horn charge', uses: 10, refill: 'day', note: '' };
    traits(figuresOf([many, ten]), playOf([{ kind: 'trait', key: 'Lantern tally' }, { kind: 'trait', key: 'Horn charge' }]));
    const [first, second] = [...document.querySelectorAll('.pinned-box')];
    expect(first!.querySelector('.use-pips')).toBeNull();
    expect(first!.textContent).toContain('999 of 999 left');
    expect(second!.querySelector('.use-pips')!.textContent!.trim()).toBe('●'.repeat(10));
  });
});
