// @vitest-environment jsdom
// The location view's two missing pieces (M5b step 1, build order 7; ruling design/rulings/m5b-builder-questions-
// 2026-11-03.md bq-4; 06 "Wilderness day", "Location view", S6, S7), against the stand-in database with the invented
// Mirewalk rules:
//   the empty state reads "Where are we?" with Set place (never "Somewhere unnamed"), and Set place opens Where now?;
//   on a phone (375 px) in a wilderness day the GM's place page is one open column with Move on above the tab bar (5b,
//   frame 4c, which replaced the GM's Open card); a player's place is still an Open card that opens a sheet;
//   a player's sheet holds only what the GM shows their group: no hidden piece, no hidden picture.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { forgetFileLinks } from '../core/files.ts';
import { mireRules } from '../modules/expedition/fixtures.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { PlaceCard } from './PlaceCard.tsx';
import { startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});
// jsdom has no canvas: the picture goes up as chosen.
vi.mock('./image.ts', async (actual) => ({ ...(await actual<typeof import('./image.ts')>()), shrinkImage: async (file: Blob) => file }));

let world: FakeWorld;

/** A window this many pixels wide: matchMedia answers min-width and max-width queries for it. */
function windowOf(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  // Back to the pretend browser without matchMedia (narrow, not a phone).
  delete (window as { matchMedia?: unknown }).matchMedia;
});

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash');
  world.addMember(campaign, sam, 'player', wren);
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mirewalk Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const data = { ...mireRules, encumbrance: { mode: 'coin', coin: { tiers: [{ label: 'Light', max: 450, effect: 'Nothing slows you', movement: '115 ft' }] } } };
  world.tables.library_entries.push({ id: 'entry-mire', pack_id: 'pack-mire', kind: 'rulesSet', pack_entry_id: 'mire-rules', name: 'Mirewalk rules', data });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mirewalk Rules', option_choices: {}, overrides: {}, priority: 1 });
  for (const actor of [wren, ash]) world.tables.carrier_loads.push({ actor_id: actor, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  return { gm, sam, campaign };
}

async function openScene(who: string, start: boolean, gm = start) {
  cleanup();
  world.signInAs(who);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  const nav = await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' });
  await user.click(within(nav).getByRole('button', { name: 'Scene' }));
  if (start) {
    // The GM's band reads "No session yet" before the first session (st-2).
    await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
    await startExpedition(user);
    await waitFor(() => expect(world.tables.travel_groups).toHaveLength(1));
  }
  return user;
}

/** Move… with a terrain and a place name. */
async function move(user: ReturnType<typeof userEvent.setup>, terrain: RegExp, place: string) {
  await user.click(await screen.findByRole('button', { name: 'Move…' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
  await user.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: terrain }));
  await typePlace(user, place, 'Place (optional)', dialog);
  await user.click(dialog.getByRole('button', { name: 'Move' }));
}

const gmUser = { id: 'gm', roles: { c: 'gm' } } as unknown as CurrentUser;

describe('The empty state (bq-4, S6)', () => {
  // Purpose: a place card with no place says "Where are we?" with Set place, never "Somewhere unnamed", and Set place
  // opens Where now?.
  it('reads "Where are we?" with Set place, and Set place opens Where now?', async () => {
    render(
      <ToastHost>
        <PlaceCard db={createFakeDb().db} user={gmUser} campaign={{ id: 'c', name: 'The Ash Barrows', role: 'gm', line: null }} group={1} groupLabel={null} row={null} checks={[]} recent={[]} onChanged={() => undefined} />
      </ToastHost>,
    );
    expect(screen.getByRole('heading', { name: 'Where are we?' })).toBeTruthy();
    expect(screen.queryByText(/Somewhere unnamed/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change place' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    expect(await screen.findByRole('dialog', { name: 'Where are we?' })).toBeTruthy();
  });

  // Purpose: on a phone the empty place is the Open card "Where are we?" whose one tap is Set place (Where now?).
  it("on a phone, the empty place's card is Set place", async () => {
    render(
      <ToastHost>
        <PlaceCard db={createFakeDb().db} user={gmUser} campaign={{ id: 'c', name: 'The Ash Barrows', role: 'gm', line: null }} group={1} groupLabel={null} row={null} checks={[]} recent={[]} terrain="Bog" phone onChanged={() => undefined} />
      </ToastHost>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Where are we?: Around them: Bog, Set place' }));
    expect(await screen.findByRole('dialog', { name: 'Where are we?' })).toBeTruthy();
  });
});

describe('The phone sheet (bq-4, S7)', () => {
  // Purpose (5b, page 11 frame 4c, replacing bq-4's Open card for the GM): at 375 px the GM's wilderness day shows the
  // place's page in one open column, with no Open card: the name, the ground around them, + Piece and + Picture; Move
  // on sits in its own bar above the tab bar; "Change place" is gone. A piece added there shows at once.
  it("shows the GM's place page in one column at 375 px, with Move on above the tab bar", async () => {
    windowOf(375);
    const { gm } = table();
    const user = await openScene(gm, true);
    await move(user, /Bog, 3/, 'Moss Landing');
    const card = within(await screen.findByRole('region', { name: 'Where the party is' }));
    expect(screen.queryByRole('button', { name: /^Moss Landing: Around them/ })).toBeNull();
    expect(card.getByRole('heading', { name: 'Moss Landing' })).toBeTruthy();
    expect(card.getByText('Around them: Bog')).toBeTruthy();
    expect(card.getByRole('button', { name: '+ Picture' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change place' })).toBeNull();
    // The marching order stays on the page.
    expect(screen.getByRole('list', { name: 'Marching order, front to back' })).toBeTruthy();
    expect(document.querySelector('.place-page__bar')?.textContent).toContain('Move on');

    await user.click(card.getByRole('button', { name: '+ Piece' }));
    await user.type(card.getByLabelText('What players will see'), 'A jetty, rotten');
    await user.click(card.getByRole('button', { name: 'Add' }));
    expect(await card.findByRole('button', { name: 'Edit piece: A jetty, rotten' })).toBeTruthy();
    expect(card.getByText('0 of 1 shown')).toBeTruthy();
  });

  // Purpose: Escape in Where now? (Move on's Somewhere else…) closes Where now? only; the place's page stays.
  it('Escape in Where now? from Move on closes only Where now?', async () => {
    windowOf(375);
    const { gm } = table();
    const user = await openScene(gm, true);
    await move(user, /Bog, 3/, 'Moss Landing');
    await screen.findByRole('region', { name: 'Where the party is' });
    await user.click(screen.getByRole('button', { name: 'Move on' }));
    await user.click(within(await screen.findByRole('dialog', { name: /where to\?/ })).getByRole('button', { name: /Somewhere else/ }));
    await screen.findByRole('dialog', { name: 'Where now?' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Where now?' })).toBeNull());
    expect(screen.getByRole('region', { name: 'Where the party is' })).toBeTruthy();
  });

  // Purpose: on a landscape tablet (1180 px) the place card stays on the page, in the right column, with no Open card.
  it('keeps the place card on the page on a tablet', async () => {
    windowOf(1180);
    const { gm } = table();
    const user = await openScene(gm, true);
    await move(user, /Bog, 3/, 'Moss Landing');
    expect(await screen.findByRole('region', { name: 'Where the party is' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Moss Landing:/ })).toBeNull();
  });

  // Purpose: a player's sheet at 375 px holds only what the GM shows their group: the shown piece, never the hidden
  // piece or the hidden picture; with nothing shown there is no card at all.
  it("a player's sheet shows only the shown piece: no hidden piece, no hidden picture", async () => {
    windowOf(375);
    const { gm, sam } = table();
    let user = await openScene(gm, true);
    await move(user, /Bog, 3/, 'Moss Landing');
    const sheet = within(await screen.findByRole('region', { name: 'Where the party is' }));
    for (const text of ['A jetty, rotten', 'A sunken chest under the jetty']) {
      await user.click(sheet.getByRole('button', { name: '+ Piece' }));
      await user.type(sheet.getByLabelText('What players will see'), text);
      await user.click(sheet.getByRole('button', { name: 'Add' }));
      await sheet.findByRole('button', { name: `Edit piece: ${text}` });
    }
    await user.upload(screen.getByLabelText('Choose a picture'), new File(['heron'], 'landing.jpg', { type: 'image/jpeg' }));
    await sheet.findByRole('button', { name: 'Show players the picture' });

    // Nothing shown yet: the player has no place card.
    await openScene(sam, false);
    await screen.findByRole('list', { name: 'Marching order, front to back' });
    expect(screen.queryByRole('button', { name: /^Where you are/ })).toBeNull();

    // The GM shows the jetty only.
    user = await openScene(gm, false, true);
    const again = within(await screen.findByRole('region', { name: 'Where the party is' }));
    const jetty = (await again.findByRole('button', { name: 'Edit piece: A jetty, rotten' })).closest('li') as HTMLElement;
    await user.click(within(jetty).getByRole('button', { name: 'Show players' }));
    await waitFor(() => expect(world.tables.piece_shows.some((s) => s.shown === true && !s.undone)).toBe(true));

    user = await openScene(sam, false);
    await user.click(await screen.findByRole('button', { name: 'Where you are: Moss Landing, A jetty, rotten' }));
    const mine = within(await screen.findByRole('dialog', { name: 'Where you are' }));
    expect(mine.getByRole('heading', { name: 'Moss Landing' })).toBeTruthy();
    expect(mine.getByText('A jetty, rotten')).toBeTruthy();
    expect(screen.queryByText(/sunken chest/)).toBeNull();
    expect(screen.queryByRole('button', { name: /picture/ })).toBeNull();
    expect(screen.queryByRole('img', { name: /picture/ })).toBeNull();
    await user.click(mine.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Where you are' })).toBeNull());
  });
});
