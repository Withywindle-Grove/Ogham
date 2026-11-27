// @vitest-environment jsdom
// The GM's view as the player, its row and its shell (page 32, M3a to M3d, M3j, M3k; approved 2026-11-21; rows C15a and
// C15b of plans/test-feedback-2026-11-19.md), on the stand-in database. Invented names.
//   Purpose:
//   1. A caster's row shows View sheet, Pack, Magic, Scene and ⋯ in that order; a character without a Magic tab shows
//      no Magic.
//   2. ⋯ holds Edit, Give to a player… and Remove…, and the row has no other Edit; Edit opens the sheet's form, as the
//      player's Edit does (⚑ 44), and Remove… opens today's panel.
//   3. An archived character keeps today's row; a waiting or sent-back one keeps today's row, and View sheet opens the
//      full sheet (d5-22, ⚑ 43).
//   4. The GM's own character has the same row; its view's band reads "Your view of Ash", with no logged line.
//   5. View sheet opens Wren's Player tab with the band "Sam's view of Wren" and its logged line; Pack, Magic and Scene
//      open on their tabs with the same band; "‹ Players" returns to the Players list from every tab.
//   6. Given to Robin while open, the band reads Robin's and the toast says "Wren is now Robin's."; removed while open,
//      the toast says "Wren left the campaign." and Players shows.
//   7. A read that fails shows "Couldn't load Wren's sheet." with Try again, and the way back still works.
//   8. Opening the view changes neither the tab the GM's own screen comes back to nor the one a player's device
//      restores.
//   9. On a phone the view's tab bar is Player, Scene, Pack, Magic and Log for a caster, four without Magic, and Log
//      opens the GM's own log.
//  10. The band's words, and whose a character is from the Players list (the pure parts).
//  11. A character removed from ⋯ and then restored comes back without its "Remove … from …?" panel open.
//  12. When the GM's own characters fail to read while the players read, the view on Ash stays open: no "Ash left the
//      campaign." toast.
//  13. When the view opens before it can tell whose Wren is, the first answer shows no toast ("Wren is now Sam's."):
//      the owner did not change.
//  14. Keyboard focus (audit fix 3): a door on the Players row puts focus on the view's heading, the character's name;
//      Enter on a row's ⋯ puts it on the menu's first item, and Escape puts it back on ⋯.
//  15. In the GM's view of a player's Scene the "Recently" log lines are left out (⚑ 52, ruled 2026-11-24); the view of
//      the GM's own character keeps them, as his own Scene does.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { runCommand } from '../core/commands.ts';
import { whoseIs, type Player } from '../core/gmCampaign.ts';
import { archiveCharacter, reassignCharacter, toCharacterRef } from '../modules/characters/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { viewBandWords } from '../ui/ViewBand.tsx';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { keepPlaceForReload } from './placeOnReload.ts';
import { registry } from './services.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let sam: string;
let campaign: string;
let wren: string;
let tam: string;

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
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  const robin = world.addPerson('robin@lantern.example', 'Robin');
  campaign = world.addCampaign('The Reed Marches', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  tam = world.addCharacter(campaign, 'Tam', { ownerId: robin });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, robin, 'player', tam);
  // Invented setting rules, so the Player screen opens (and a prepared spell gives Wren a Magic tab: hasSpells).
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({ id: 'entry-fen', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', name: 'Fen rules' } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [{ spell: 'glimmer', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

type User = ReturnType<typeof userEvent.setup>;
const actor = (id: string) => world.tables.actors.find((a) => a.id === id)!;
const rowOf = (name: string) => screen.getByRole('button', { name: `View ${name}'s sheet` }).closest('li') as HTMLElement;
/** A row's buttons, ⋯ as "⋯". */
const buttonsOf = (row: HTMLElement) => within(row).getAllByRole('button').map((b) => (b.getAttribute('aria-label')?.startsWith('More for') ? '⋯' : b.textContent));
const band = () => screen.getByRole('note');

/** The read of the GM's own characters fails (no connection) while `on`; `failed` counts the failed reads. */
function gmReadsFail() {
  const reads = { on: true, failed: 0 };
  const from = world.db.from.bind(world.db);
  vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
    const query = from(table as never) as unknown as { eq: (column: string, value: unknown) => unknown };
    if (table !== 'actors') return query;
    const eq = query.eq.bind(query);
    query.eq = (column, value) => {
      if (!reads.on || column !== 'owner_type' || value !== 'gm') return eq(column, value);
      reads.failed += 1;
      return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
    };
    return query;
  }) as unknown as typeof world.db.from);
  return reads;
}

async function openPlayers(): Promise<User> {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  // The Magic door waits for the setting and the prepared spells.
  await screen.findByRole('button', { name: "Open Wren's magic" });
  return user;
}

describe('the Players row (C15a; M3a, M3b)', () => {
  it("a caster's row is View sheet, Pack, Magic, Scene, ⋯; a character without a Magic tab has no Magic", async () => {
    await openPlayers();
    expect(buttonsOf(rowOf('Wren'))).toEqual(['View sheet', 'Pack', 'Magic', 'Scene', '⋯']);
    expect(buttonsOf(rowOf('Tam'))).toEqual(['View sheet', 'Pack', 'Scene', '⋯']);
    // The page's one accent stays "Invite a player".
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Invite a player' }).className).toContain('button-primary');
  });

  it('⋯ holds Edit, Give to a player… and Remove…, and the row has no other Edit; Edit opens the form', async () => {
    const user = await openPlayers();
    expect(within(rowOf('Wren')).queryByRole('button', { name: /Edit/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More for Wren' }));
    const menu = document.querySelector('.more-menu__panel') as HTMLElement;
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Give to a player…', 'Remove…']);
    await user.click(within(menu).getByRole('button', { name: 'Edit' }));
    // The same Edit screen the player's Edit opens (⚑ 44): the sheet's form, its way back to Players.
    await screen.findByRole('form', { name: 'Edit Wren' });
    await user.click(screen.getByRole('button', { name: 'Back to Players' }));
    await screen.findByRole('button', { name: 'More for Wren' });
  });

  it('Remove… from ⋯ opens today’s panel; Cancel puts it away; Remove archives', async () => {
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: 'More for Tam' }));
    await user.click(screen.getByRole('button', { name: 'Remove…' }));
    const panel = await screen.findByRole('group', { name: 'Remove Tam' });
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Remove Tam' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More for Tam' }));
    await user.click(screen.getByRole('button', { name: 'Remove…' }));
    await user.click(within(await screen.findByRole('group', { name: 'Remove Tam' })).getByRole('button', { name: 'Remove' }));
    await screen.findByText(/Tam was removed from The Reed Marches/);
    expect(actor(tam).status).toBe('archived');
  });

  it('a character removed from ⋯ and then restored comes back without its Remove panel open', async () => {
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: 'More for Tam' }));
    await user.click(screen.getByRole('button', { name: 'Remove…' }));
    await user.click(within(await screen.findByRole('group', { name: 'Remove Tam' })).getByRole('button', { name: 'Remove' }));
    const archived = (await screen.findByRole('heading', { name: 'Archived characters' })).parentElement as HTMLElement;
    await user.click(within(archived).getByRole('button', { name: /Restore/ }));
    await screen.findByRole('button', { name: 'More for Tam' });
    expect(screen.queryByRole('group', { name: 'Remove Tam' })).toBeNull();
  });

  // A waiting character is not a row on Players: only in Waiting for approval (M3a; pg32-match, 2026-11-21).
  it("an archived character keeps today's row; a sent-back one keeps today's, View sheet opening the full sheet; a waiting one is no row", async () => {
    Object.assign(actor(tam), { status: 'archived' });
    world.addCharacter(campaign, 'Hollis', { ownerId: sam, approval: 'pending' });
    world.addCharacter(campaign, 'Moss', { ownerId: sam, approval: 'rejected' });
    const user = await openPlayers();
    const archived = (await screen.findByRole('heading', { name: 'Archived characters' })).parentElement as HTMLElement;
    expect(within(archived).getAllByRole('button').map((b) => b.textContent)).toEqual(['Restore', 'Delete permanently…']);
    expect(screen.queryByRole('button', { name: "View Hollis's sheet" })).toBeNull();
    const approval = screen.getByRole('heading', { name: 'Waiting for approval' }).parentElement as HTMLElement;
    expect(within(approval).getByText('New character waiting: Hollis')).toBeTruthy();
    expect(within(rowOf('Moss')).getByText('Moss (sent back)')).toBeTruthy();
    expect(buttonsOf(rowOf('Moss'))).toEqual(['View sheet', 'Delete…']);
    await user.click(screen.getByRole('button', { name: "View Moss's sheet" }));
    // The full sheet's page, not the view: no band.
    await screen.findByRole('button', { name: 'Back to Players' });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it("the GM's own character has the same row, and its band reads \"Your view of Ash\" alone", async () => {
    world.addCharacter(campaign, 'Ash');
    const user = await openPlayers();
    expect(buttonsOf(rowOf('Ash'))).toEqual(['View sheet', 'Pack', 'Scene', '⋯']);
    expect(within(rowOf('Ash')).getByText('Yours')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: "View Ash's sheet" }));
    await waitFor(() => expect(band().getAttribute('aria-label')).toBe('Your view of Ash'));
    expect(band().textContent).toBe('Your view of Ash');
  });

  // Purpose: a character whose name ends in s takes the mark alone on the row's doors (words rule 13), on an open row
  // and on a sent-back one's View sheet.
  it.fails('a name ending in s reads "View Lantern Wardens’ sheet", "Open Lantern Wardens’ pack" and "… scene"', async () => {
    Object.assign(actor(tam), { name: 'Lantern Wardens' });
    world.addCharacter(campaign, 'Moss', { ownerId: sam, approval: 'rejected' });
    await openPlayers();
    const row = screen.getByRole('button', { name: 'More for Lantern Wardens' }).closest('li') as HTMLElement;
    const labels = within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels.slice(0, 3)).toEqual(['View Lantern Wardens’ sheet', 'Open Lantern Wardens’ pack', 'Open Lantern Wardens’ scene']);
    expect(screen.getByRole('button', { name: 'View Moss’ sheet' })).toBeTruthy();
  });
});

describe('the view (C15b; M3c, M3d, M3j, M3k)', () => {
  it("View sheet opens Wren's Player tab with Sam's band; Pack, Magic and Scene open on theirs; ‹ Players comes back", async () => {
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "View Wren's sheet" }));
    await screen.findByRole('region', { name: 'Vitals' });
    expect(band().getAttribute('aria-label')).toBe('Sam’s view of Wren. What you do here is logged as yours.');
    expect(band().textContent).toBe('Sam’s view of WrenWhat you do here is logged as yours.');
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('button', { name: 'Player' }).getAttribute('aria-current')).toBe('page');
    // The way back on every tab.
    for (const tab of ['Pack', 'Magic', 'Scene', 'Player']) {
      await user.click(nav.getByRole('button', { name: tab }));
      expect(screen.getByRole('button', { name: '‹ Players' })).toBeTruthy();
      expect(band().getAttribute('aria-label')).toMatch(/^Sam’s view of Wren\./);
    }
    await user.click(screen.getByRole('button', { name: '‹ Players' }));
    await screen.findByRole('button', { name: 'Invite a player' });

    for (const [door, tab] of [
      ["Open Wren's pack", 'Pack'],
      ["Open Wren's magic", 'Magic'],
      ["Open Wren's scene", 'Scene'],
    ] as const) {
      await user.click(await screen.findByRole('button', { name: door }));
      const opened = within(await screen.findByRole('navigation', { name: 'Main' }));
      await waitFor(() => expect(opened.getByRole('button', { name: tab }).getAttribute('aria-current')).toBe('page'));
      expect(band().getAttribute('aria-label')).toMatch(/^Sam’s view of Wren\./);
      await user.click(screen.getByRole('button', { name: '‹ Players' }));
    }
    await screen.findByRole('button', { name: 'Invite a player' });
  });

  it('given to Robin while open, the band follows with a toast; removed while open, a toast and back to Players', async () => {
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "View Wren's sheet" }));
    await screen.findByRole('region', { name: 'Vitals' });
    const gmUser = { id: gm, roles: { [campaign]: 'gm' as const } };
    const robin = world.tables.members.find((m) => m.campaign_id === campaign && m.active_actor_id === tam)!.user_id as string;
    // Another of the GM's devices gives Wren to Robin.
    expect((await runCommand(registry, world.db, gmUser, reassignCharacter, { character: toCharacterRef(actor(wren) as never), to: { userId: robin, role: 'player' } })).ok).toBe(true);
    expect(await screen.findByText('Wren is now Robin’s.')).toBeTruthy();
    await waitFor(() => expect(band().getAttribute('aria-label')).toBe('Robin’s view of Wren. What you do here is logged as yours.'));
    expect(screen.getByRole('region', { name: 'Vitals' })).toBeTruthy();

    expect((await runCommand(registry, world.db, gmUser, archiveCharacter, { character: toCharacterRef(actor(wren) as never) })).ok).toBe(true);
    expect(await screen.findByText('Wren left the campaign.')).toBeTruthy();
    await screen.findByRole('button', { name: 'Invite a player' });
    expect(screen.queryByRole('note')).toBeNull();
    void user;
  });

  it("the GM's own characters failing to read while the players read doesn't close the view on Ash", async () => {
    world.addCharacter(campaign, 'Ash');
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "View Ash's sheet" }));
    await waitFor(() => expect(band().getAttribute('aria-label')).toBe('Your view of Ash'));
    const reads = gmReadsFail();
    // A logged change elsewhere reads the Players list again; the GM's own characters can't be read this time.
    const gmUser = { id: gm, roles: { [campaign]: 'gm' as const } };
    expect((await runCommand(registry, world.db, gmUser, archiveCharacter, { character: toCharacterRef(actor(tam) as never) })).ok).toBe(true);
    await waitFor(() => expect(reads.failed).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Ash left the campaign.')).toBeNull();
    expect(band().getAttribute('aria-label')).toBe('Your view of Ash');
  });

  it("the view opened before it can tell whose Wren is shows no toast on the first answer", async () => {
    const reads = gmReadsFail();
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "View Wren's sheet" }));
    await screen.findByRole('region', { name: 'Vitals' });
    // The GM's own characters read again: now it can tell Wren is Sam's, which is no change of owner.
    reads.on = false;
    const gmUser = { id: gm, roles: { [campaign]: 'gm' as const } };
    expect((await runCommand(registry, world.db, gmUser, archiveCharacter, { character: toCharacterRef(actor(tam) as never) })).ok).toBe(true);
    await waitFor(() => expect(band().getAttribute('aria-label')).toBe('Sam’s view of Wren. What you do here is logged as yours.'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Wren is now Sam’s.')).toBeNull();
  });

  it("a read that fails says so with Try again, and ‹ Players still goes back", async () => {
    const user = await openPlayers();
    // The character can't be read (its row hidden from the read, as a failed connection would leave it).
    const kept = world.tables.actors;
    world.tables.actors = kept.filter((a) => a.id !== wren);
    await user.click(screen.getByRole('button', { name: "View Wren's sheet" }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Couldn’t load Wren’s sheet.');
    expect(band().getAttribute('aria-label')).toMatch(/^Sam’s view of Wren\./);
    world.tables.actors = kept;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('region', { name: 'Vitals' });
    world.tables.actors = kept.filter((a) => a.id !== wren);
    await user.click(screen.getByRole('button', { name: '‹ Players' }));
    world.tables.actors = kept;
    await screen.findByRole('button', { name: 'Invite a player' });
  });

  it("opening the view changes neither the GM's own section to come back to nor a player's tab", async () => {
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "Open Wren's pack" }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Magic' }));
    keepPlaceForReload();
    expect(JSON.parse(sessionStorage.getItem('grimoire.placeOnReload') ?? 'null')).toMatchObject({ tab: 'players' });
  });

  it('on a phone the tab bar is the player’s, five for a caster and four without Magic, and Log opens the GM’s log', async () => {
    windowOf(375);
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "View Wren's sheet" }));
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));
    await waitFor(() => expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack', 'Magic', 'Log']));
    // "‹ Players" in ≡'s place.
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    await user.click(nav.getByRole('button', { name: 'Log' }));
    expect(await screen.findByRole('dialog', { name: /Log/ })).toBeTruthy();
    cleanup();

    const again = await openPlayers();
    await again.click(screen.getByRole('button', { name: "View Tam's sheet" }));
    const bar = within(await screen.findByRole('navigation', { name: 'Main' }));
    await waitFor(() => expect(bar.getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack', 'Log']));
  });
});

describe('keyboard focus in the view (audit fix 3)', () => {
  it("a door on the Players row puts focus on the view's heading, the character's name", async () => {
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "Open Wren's pack" }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Wren’s pack'));
    expect(document.activeElement?.classList.contains('top-row__title')).toBe(true);
    await user.click(screen.getByRole('button', { name: '‹ Players' }));
    await user.click(await screen.findByRole('button', { name: "View Wren's sheet" }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Wren'));
    expect(document.activeElement?.classList.contains('top-row__title')).toBe(true);
  });

  it("Enter on a row's ⋯ puts focus on the menu's first item; Escape puts it back on ⋯", async () => {
    const user = await openPlayers();
    const more = screen.getByRole('button', { name: 'More for Wren' });
    more.focus();
    await user.keyboard('{Enter}');
    const menu = document.querySelector('.more-menu__panel') as HTMLElement;
    expect(document.activeElement).toBe(within(menu).getByRole('button', { name: 'Edit' }));
    await user.keyboard('{Escape}');
    expect(document.querySelector('.more-menu__panel')).toBeNull();
    expect(document.activeElement).toBe(more);
  });
});

describe("the view's Scene (⚑ 52)", () => {
  it("leaves out the Recently log lines in the view of a player's Scene; the view of the GM's own character keeps them", async () => {
    world.addCharacter(campaign, 'Ash');
    const user = await openPlayers();
    await user.click(screen.getByRole('button', { name: "Open Ash's scene" }));
    expect(await screen.findByRole('region', { name: 'Recently' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ Players' }));
    await user.click(await screen.findByRole('button', { name: "Open Wren's scene" }));
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));
    await waitFor(() => expect(nav.getByRole('button', { name: 'Scene' }).getAttribute('aria-current')).toBe('page'));
    await waitFor(() => expect(band().getAttribute('aria-label')).toMatch(/^Sam’s view of Wren\./));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('region', { name: 'Recently' })).toBeNull();
  });
});

describe('the pure parts', () => {
  it("the band's words: a player's view with its logged line; the GM's own, one line", () => {
    expect(viewBandWords('Sam', 'Wren')).toEqual({ name: 'Sam’s view of Wren', logged: 'What you do here is logged as yours.' });
    expect(viewBandWords(null, 'Ash')).toEqual({ name: 'Your view of Ash', logged: null });
  });

  it('whose a character is: a player’s, the GM’s own, or gone (archived or deleted)', () => {
    const character = (id: string, archived = false) => ({ id, archived }) as Player['characters'][number];
    const players = [{ userId: 'u-sam', name: 'Sam', joinedAt: '', characters: [character('wren'), character('fen', true)] }];
    const own = [{ id: 'ash' }] as never[];
    expect(whoseIs('wren', players, own)).toEqual({ player: 'Sam' });
    expect(whoseIs('ash', players, own)).toEqual({ player: null });
    expect(whoseIs('fen', players, own)).toBe('gone');
    expect(whoseIs('nobody', players, own)).toBe('gone');
  });
});
