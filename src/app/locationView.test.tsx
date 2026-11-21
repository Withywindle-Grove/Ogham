// @vitest-environment jsdom
// The location view's follow-up (M5b step 1, build orders 7 and 8; docs/plans/m5b-1-travel.md; 06 "Wilderness day",
// "Location view"), clicked through against the stand-in database with the invented Mirewalk rules:
//   the GM's wilderness day puts the time strip and the day controls in one column and the place card and marching
//   order in the other (side by side on a landscape tablet, stacked below that);
//   the GM adds a picture to the place from the device (hidden), shows it with its own eye (ruled B), and Undo takes
//   it off again; a player's place line shows the picture only when the scene gives them one;
//   a Move… that sets off a check (alsoWhen) puts its Hit / Miss line on the time strip's card; its Undo takes it off.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { mireRules } from '../modules/expedition/fixtures.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { PlaceLine } from './PlaceCard.tsx';
import { startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});
// jsdom has no canvas: the picture goes up as chosen.
vi.mock('./image.ts', async (actual) => ({ ...(await actual<typeof import('./image.ts')>()), shrinkImage: async (file: Blob) => file }));

let world: FakeWorld;

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

async function openScene(who: string) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Scene' }));
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  await startExpedition(user);
  await waitFor(() => expect(world.tables.travel_groups).toHaveLength(1));
  return user;
}

const toastUndo = async (text: string | RegExp) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });

/** Move… with a terrain, an optional route and a place name. */
async function move(user: ReturnType<typeof userEvent.setup>, terrain: RegExp, route: RegExp | null, place: string) {
  await user.click(await screen.findByRole('button', { name: 'Move…' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
  await user.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: terrain }));
  if (route) await user.click(within(dialog.getByRole('group', { name: 'Route' })).getByRole('button', { name: route }));
  await typePlace(user, place, 'Place (optional)', dialog);
  await user.click(dialog.getByRole('button', { name: 'Move' }));
}

describe('The wilderness day layout (build order 7)', () => {
  // Purpose: on the GM's wilderness day the time strip heads the day controls (travel card) in the first column, and
  // the place card with the marching order sit in the second column; the CSS puts them side by side from 1024 px.
  it('puts the time strip and the travel card in one column, the place and the marching order in the other', async () => {
    const { gm } = table();
    await openScene(gm);
    const layout = (await screen.findByRole('region', { name: "The party's travel" })).closest('.groups-layout') as HTMLElement;
    expect(layout.className).toContain('groups-layout--day');
    const [main, side] = [layout.querySelector('.groups-layout__main') as HTMLElement, layout.querySelector('.groups-layout__side') as HTMLElement];
    expect(within(main).getByRole('region', { name: "The party's travel" })).toBeTruthy();
    // The time strip (its procedure strip, S7's "Sequence of play") leads the first column.
    expect(within(main).getByRole('group', { name: 'Sequence of play' })).toBeTruthy();
    expect(within(side).queryByRole('group', { name: 'Sequence of play' })).toBeNull();
    expect(within(side).getByRole('region', { name: 'Where the party is' }) && within(layout).getByRole('region', { name: 'The place and the marching order' })).toBeTruthy();
    expect(within(side).getByRole('list', { name: 'Marching order, front to back' })).toBeTruthy();
    expect(within(main).queryByRole('list', { name: 'Marching order, front to back' })).toBeNull();
  });
});

describe("A place's picture (build order 7; ruled B, 2026-11-03)", () => {
  // Purpose: the GM's place card offers + Picture for a place with none; a picture from the device is uploaded as the
  // place's own (an asset of kind 'place', the GM's), made its picture piece hidden, shown on the card with its own
  // eye; the upload's Undo takes the picture off again; the eye shows it to the party.
  it('+ Picture uploads a picture, hidden, with its own eye; Undo takes it off; the eye shows it', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    await move(user, /Bog, 3/, null, 'Moss Landing');
    await screen.findByRole('heading', { name: 'Moss Landing' });
    expect(screen.getByRole('button', { name: '+ Picture' })).toBeTruthy();

    await user.upload(screen.getByLabelText('Choose a picture'), new File(['heron'], 'landing.jpg', { type: 'image/jpeg' }));
    const undo = await toastUndo('Picture added (hidden): Moss Landing');
    const landing = world.tables.places.find((p) => p.name === 'Moss Landing')!;
    const pictureOf = () => world.tables.place_pieces.find((pc) => pc.place_id === landing.id && pc.kind === 'picture' && !pc.undone);
    await waitFor(() => expect(pictureOf()).toBeTruthy());
    expect(world.tables.assets.find((a) => a.id === pictureOf()!.asset_id)).toMatchObject({ kind: 'place', visibility: 'gm' });
    // The place page (5b, page 11; TW13, ic-4): the picture is the first row of Pieces and counts with them; the row
    // is the tap that opens it, its eye says the state (closed, not pressed); no state line, no buttons on the row.
    // (Changed by TW13: the row's "Change picture" moved into the picture's pop-up.)
    expect(await screen.findByRole('button', { name: 'Picture: open it' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show players the picture' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Change picture' })).toBeNull();
    expect(screen.getByText('0 of 1 shown')).toBeTruthy();

    await user.click(undo);
    await waitFor(() => expect(pictureOf()).toBeUndefined());
    expect(await screen.findByRole('button', { name: '+ Picture' })).toBeTruthy();

    // Again, then its eye shows it to the party.
    await user.upload(screen.getByLabelText('Choose a picture'), new File(['heron'], 'landing.jpg', { type: 'image/jpeg' }));
    await user.click(await screen.findByRole('button', { name: 'Show players the picture' }));
    await toastUndo('Shown to the party: the picture');
    await waitFor(() => expect(world.tables.piece_shows.some((s) => s.piece_id === pictureOf()!.id && s.shown === true && !s.undone)).toBe(true));
    expect(await screen.findByRole('button', { name: 'Hide the picture from players' })).toBeTruthy();
  });

  // Purpose (TW13, ic-4): the picture row keeps the thumbnail, "Picture." and its eye, and no buttons of its own; a tap
  // opens it large in the standing pop-up titled "Picture", whose foot has Change and Take it off as stacked buttons
  // with their icons; Take it off happens at once, "Picture taken off." with Undo, which puts it back.
  it('opens the picture from its row; Change and Take it off in the pop-up; Undo puts it back', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    await move(user, /Bog, 3/, null, 'Moss Landing');
    await screen.findByRole('heading', { name: 'Moss Landing' });
    await user.upload(screen.getByLabelText('Choose a picture'), new File(['heron'], 'landing.jpg', { type: 'image/jpeg' }));
    await toastUndo('Picture added (hidden): Moss Landing');
    const landing = world.tables.places.find((p) => p.name === 'Moss Landing')!;
    const pictureOf = () => world.tables.place_pieces.find((pc) => pc.place_id === landing.id && pc.kind === 'picture' && !pc.undone);
    const row = (await screen.findByRole('button', { name: 'Picture: open it' })).closest('li') as HTMLElement;
    expect(within(row).getByText('Picture.')).toBeTruthy();
    expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Picture: open it', 'Show players the picture']);
    await user.click(within(row).getByRole('button', { name: 'Picture: open it' }));
    const pop = await screen.findByRole('dialog', { name: 'Picture' });
    const change = within(pop).getByRole('button', { name: 'Change the picture' });
    const takeOff = within(pop).getByRole('button', { name: 'Take the picture off' });
    for (const button of [change, takeOff]) expect(button.className).toContain('stacked-button');
    expect(change.textContent).toBe('Change');
    expect(takeOff.textContent).toBe('Take it off');
    expect(pop.querySelector('.dialog__actions .stacked-group')).not.toBeNull();
    await user.click(takeOff);
    const undo = await toastUndo('Picture taken off.');
    await waitFor(() => expect(pictureOf()).toBeUndefined());
    expect(screen.queryByRole('dialog', { name: 'Picture' })).toBeNull();
    await user.click(undo);
    await waitFor(() => expect(pictureOf()).toBeTruthy());
    expect(await screen.findByRole('button', { name: 'Picture: open it' })).toBeTruthy();
  });

  // Purpose: a player's "where you are" shows the place's picture only when the scene gives them one (the database
  // gives it only once the GM shows the picture itself); the picture alone shows the place's name with it.
  it("a player's place line shows the picture only when the scene gives one", async () => {
    const db = world.db;
    const { container, rerender } = render(<PlaceLine db={db} campaignId="c" place={{ group: 1, name: 'Moss Landing', pieces: [], pictureAssetId: null }} />);
    expect(container.innerHTML).toBe('');
    rerender(<PlaceLine db={db} campaignId="c" place={{ group: 1, name: 'Moss Landing', pieces: [{ id: 'p', kind: 'exit', text: 'A jetty, rotten' }], pictureAssetId: null }} />);
    expect(screen.queryByRole('img', { name: /picture/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /picture/ })).toBeNull();
    rerender(<PlaceLine db={db} campaignId="c" place={{ group: 1, name: 'Moss Landing', pieces: [], pictureAssetId: 'asset-1' }} />);
    expect(screen.getByRole('heading', { name: 'Moss Landing' })).toBeTruthy();
    // No such file for this reader: it says so, and never shows another picture.
    expect(await screen.findByText(/The picture couldn't be opened/)).toBeTruthy();
  });
});

describe("A Move…'s checks go on the card (build order 8)", () => {
  // Purpose: leaving the causeway sets off the lost check (alsoWhen); its Hit / Miss line lands on the time strip's
  // card, named with why, and the move's Undo takes the line off again.
  it('puts the check a move sets off on the card as Hit / Miss, and Undo takes it off', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    await move(user, /Bog, 3/, /Causeway, 1/, 'Moss Landing');
    await toastUndo(/Moved into Moss Landing/);
    expect(screen.queryByRole('button', { name: /Left the Causeway/ })).toBeNull();

    // Move… starts on the route the party is on: a tap lets go of the causeway.
    await move(user, /Bog, 3/, /Causeway, 1/, 'Reed Hollow');
    const undo = await toastUndo(/On the card: Going astray/);
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByRole('button', { name: 'Hit, Going astray, Left the Causeway' })).toBeTruthy();
    expect(due.getByRole('button', { name: 'Miss, Going astray, Left the Causeway' })).toBeTruthy();

    await user.click(undo);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hit, Going astray, Left the Causeway' })).toBeNull());
  });
});
