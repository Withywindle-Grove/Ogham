// @vitest-environment jsdom
// The phone's navigation outside creation (final drafts A11, slice E; mockup creation/17), against the stand-in
// database with invented names:
//   on a phone a player's campaign screen has ≡ and the character's name (the campaign's on Scene) where the back
//   link was, no ⋯ (the drawer holds its items), and a tab bar of
//   Player, Scene, Pack and Log (the current one marked); Log opens the log full screen, so the top row leaves its Log out;
//   Scene's badge counts the GM's unread messages, in its name for screen readers;
//   ≡ opens the drawer: focus moves into it, Escape closes it and focus comes back to ≡;
//   the drawer's groups: a player's This campaign, Your characters (the active one marked) and Elsewhere, no gear; the
//   GM's As the GM, never Your characters, and a gear that opens Rules; Your campaigns goes back to the list;
//   the GM's phone bar is Scene, Players, Rules, Log, the waiting count a badge on Players (in words for screen readers);
//   the GM's Players tab names what waits by kind and is lit (plan m5b-sheet-revised PR 2); Scene and Rules never are yet;
//   a tablet keeps its back link, its sections, its whole ⋯ and the top row's Log (Design on #549).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { MenuItem } from '../ui/MoreMenu.tsx';
import { SectionNav } from '../ui/SectionNav.tsx';
import { gmPhoneTabs, gmTabs, NOTHING_WAITING, phoneTabs, playersWaitWords, playerTabs, TABS } from './navTabs.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { keepAppUpdated, resetAppUpdatesForTests, type RegisterSW } from './appUpdates.ts';
import { CampaignMenuProvider, PersonProvider, ShellDrawer, ShellMenuProvider } from './shellMenu.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

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
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const LONG = 'The Lantern Marsh and the Long Causeway of the Seven Drowned Bells';

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign(LONG, gm);
  const oswin = world.addCharacter(campaign, 'Oswin Adderbald', { ownerId: sam });
  world.addCharacter(campaign, 'Tamsin Mossfoot', { ownerId: sam });
  world.addCharacter(campaign, 'Hollis Reed', { ownerId: sam, approval: 'pending' });
  world.addMember(campaign, sam, 'player', oswin);
  return { gm, sam, campaign, oswin };
}

async function openAs(who: string) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(LONG.slice(0, 20)) }));
  return user;
}

/** The GM's unread message to Oswin, as the database holds it. */
function gmWrites(t: ReturnType<typeof table>, count: number) {
  for (let n = 0; n < count; n++) {
    world.tables.messages.push({
      id: `message-${n}`,
      campaign_id: t.campaign,
      actor_id: t.oswin,
      player_user_id: t.sam,
      from_gm: true,
      sender_user_id: t.gm,
      body: `Note ${n}`,
      attachment_name: null,
      attachment_type: null,
      attachment_size: null,
      disappears: false,
      read_at: null,
      undone: false,
      created_at: new Date(Date.UTC(2026, 10, 7, 12, n)).toISOString(),
    });
  }
}

describe("a player's phone", () => {
  // Purpose: at 375 px the player's top row has ≡ and the character's name, no back link, no Log and no ⋯; the tab bar
  // has Player, Scene, Pack and Log, with Player current; Log opens the log full screen and closing it comes back to
  // the tab, focus on Log; on Scene the title is the campaign's name.
  it("has ≡ with the character's name, no ⋯, and four tabs with Log among them", async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.sam);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack', 'Log']);
    expect(within(nav).getByRole('button', { name: 'Player' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    expect(screen.getByText('Oswin Adderbald', { selector: '.top-row__title' })).toBeTruthy();
    expect(document.querySelector('.top-row__back')).toBeNull();
    // The drawer holds the campaign's items and the person's; this screen has no options of its own, so no ⋯.
    expect(screen.queryByRole('button', { name: 'Character options' })).toBeNull();
    // Log is a tab here, so the top row leaves its own Log out.
    expect(within(document.querySelector('.top-row') as HTMLElement).queryByRole('button', { name: 'Log' })).toBeNull();

    // Log opens the whole log full screen (06: on every device); closing it is back on Player, focus on Log.
    const logTab = within(nav).getByRole('button', { name: 'Log' });
    await user.click(logTab);
    const log = await screen.findByRole('dialog', { name: 'Log' });
    expect(within(log).getByRole('region', { name: 'Log' })).toBeTruthy();
    await user.click(within(log).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull());
    expect(within(nav).getByRole('button', { name: 'Player' }).getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(logTab);

    await user.click(within(nav).getByRole('button', { name: 'Scene' }));
    expect(within(nav).getByRole('button', { name: 'Scene' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('button', { name: 'Player' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText(LONG, { selector: '.top-row__title' })).toBeTruthy();
    // On Pack the title is the character's pack (Design on #549).
    await user.click(within(nav).getByRole('button', { name: 'Pack' }));
    expect(screen.getByText('Oswin Adderbald’s pack', { selector: '.top-row__title' })).toBeTruthy();
  });

  // Purpose: Scene's badge shows how many of the GM's messages wait unread (their card is on Scene), says so to a
  // screen reader, and isn't there when nothing waits.
  it("Scene's badge counts the GM's unread messages, and is gone at 0", async () => {
    windowOf(375);
    const t = table();
    gmWrites(t, 2);
    await openAs(t.sam);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const scene = await within(nav).findByRole('button', { name: 'Scene, 2 messages waiting' });
    expect(scene.querySelector('.section-nav__badge')?.textContent).toBe('2');
    cleanup();

    const quiet = table();
    world.signInAs(quiet.sam);
    windowOf(375);
    render(<Root db={world.db} />);
    await userEvent.click((await screen.findAllByRole('button', { name: new RegExp(LONG.slice(0, 20)) }))[0]!);
    const calm = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(calm).getByRole('button', { name: 'Scene' }).querySelector('.section-nav__badge')).toBeNull();
  });

  // Purpose: ≡ opens the drawer named after the campaign; focus moves into it; its groups are This campaign, Your
  // characters (each character, the active one marked current, then the way to the list) and Elsewhere, with no As
  // the GM; Escape closes it and focus is back on ≡.
  it('≡ opens the drawer: focus goes in, the groups, Escape brings focus back', async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.sam);
    const menu = await screen.findByRole('button', { name: 'Menu' });
    await user.click(menu);
    const drawer = await screen.findByRole('dialog', { name: LONG });
    expect(drawer.contains(document.activeElement)).toBe(true);
    const groups = within(drawer).getAllByRole('region').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['This campaign', 'Your characters', 'Elsewhere']);
    const characters = within(within(drawer).getByRole('region', { name: 'Your characters' }));
    // Each character in turn (its letter in a ring, hidden from screen readers), a line for one not yet approved, then the list.
    const rows = characters.getAllByRole('button');
    expect(rows).toEqual(['Oswin Adderbald', 'Tamsin Mossfoot', 'Hollis Reed', 'Your characters'].map((name) => characters.getByRole('button', { name })));
    expect(rows[2]!.textContent).toContain('Waiting for the GM');
    expect(characters.getByRole('button', { name: 'Oswin Adderbald' }).getAttribute('aria-current')).toBe('page');
    expect(within(within(drawer).getByRole('region', { name: 'This campaign' })).getByRole('button', { name: 'Setting rules' })).toBeTruthy();
    // A player has no gear.
    expect(within(drawer).queryByRole('button', { name: 'Campaign settings' })).toBeNull();
    // The person at the foot unfolds This device and Sign out; switching the theme leaves the drawer open.
    await user.click(within(drawer).getByRole('button', { name: /^Sam/ }));
    expect(within(drawer).getByText('This device')).toBeTruthy();
    expect(within(drawer).getByRole('button', { name: 'Sign out' })).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: LONG })).toBeNull());
    expect(document.activeElement).toBe(menu);
  });

  // Purpose: choosing a drawer item closes the drawer and does what the ⋯ item does: Your campaigns goes back to the
  // list of campaigns; Setting rules opens them.
  it('Your campaigns in the drawer goes back to the list', async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.sam);
    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    await user.click(within(await screen.findByRole('dialog', { name: LONG })).getByRole('button', { name: 'Your campaigns' }));
    expect(screen.queryByRole('dialog', { name: LONG })).toBeNull();
    expect(await screen.findByRole('button', { name: new RegExp(LONG.slice(0, 20)) })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});

describe("the GM's phone", () => {
  // Purpose: the GM's phone bar is Scene, Players, Rules, Log; what waits (Hollis, sent for approval) is a badge on
  // Players and in its name in words; Log is not in the top row and opens the full-screen log; no ⋯ at the top level.
  it('has Scene, Players, Rules, Log, the waiting count a badge on Players', async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.gm);
    const nav = await screen.findByRole('navigation', { name: 'Campaign sections' });
    const players = await within(nav).findByRole('button', { name: 'Players: 1 to approve' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent?.replace(/^\d+/, '').replace(/\d+$/, ''))).toEqual(['Scene', 'Players', 'Rules', 'Log']);
    expect(players.querySelector('.section-nav__badge')?.textContent).toBe('1');
    expect(players.textContent).not.toContain('waiting');
    const row = document.querySelector('.top-row') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'Log' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Account and device options' })).toBeNull();
    await user.click(within(nav).getByRole('button', { name: 'Log' }));
    expect(await screen.findByRole('dialog', { name: 'Log' })).toBeTruthy();
  });

  // Purpose: the GM's drawer has As the GM (Companies) and no Your characters, and its gear, beside the campaign's name,
  // opens the campaign's settings: the Rules tab, Rules for this campaign.
  it("the GM's drawer: As the GM, no Your characters, and the gear opens Rules", async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.gm);
    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    const drawer = await screen.findByRole('dialog', { name: LONG });
    const groups = within(drawer).getAllByRole('region').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['As the GM', 'Elsewhere']);
    expect(within(drawer).getByRole('button', { name: 'Companies' })).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: 'Campaign settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: LONG })).toBeNull());
    const nav = screen.getByRole('navigation', { name: 'Campaign sections' });
    expect(within(nav).getByRole('button', { name: 'Rules' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('a tablet', () => {
  // Purpose: at 820 px nothing changes: the back link, no ≡, the player's three sections, Log and the whole ⋯ in the
  // top row; the GM's Players keeps its count in words, and its name for screen readers starts with them.
  it('keeps its back link, three sections and the top row Log', async () => {
    windowOf(820);
    const t = table();
    await openAs(t.sam);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack']);
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(document.querySelector('.top-row__back')).toBeTruthy();
    expect(within(document.querySelector('.top-row') as HTMLElement).getByRole('button', { name: 'Log' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Character options' })).toBeTruthy();
    cleanup();

    const g = table();
    windowOf(820);
    await openAs(g.gm);
    const gm = await screen.findByRole('navigation', { name: 'Campaign sections' });
    const players = await within(gm).findByRole('button', { name: 'Players, 1 waiting: 1 to approve' });
    expect(players.textContent).toContain('1 waiting');
    // A lit tablet tab's name for screen readers contains the words it shows (WCAG 2.5.3, label in name; #568 look-back).
    expect(players.getAttribute('aria-label')).toContain(players.textContent ?? '');
    expect(players.querySelector('.section-nav__badge')).toBeNull();
    expect(within(gm).queryByRole('button', { name: 'Log' })).toBeNull();
  });
});

describe('the parts', () => {
  // Purpose (plan m5b-sheet-revised PR 2): the GM's Players tab says what waits by kind ("1 to approve, 2 to answer, 1
  // base to pick"), lit on phone and tablet alike; with nothing waiting it carries no words and isn't lit; Scene and
  // Rules have nothing feeding them yet and are never lit.
  it("the GM's tabs: Players names what waits and is lit on every width; Scene and Rules aren't", () => {
    expect(playersWaitWords({ toApprove: 1, toAnswer: 0, toPick: 0 })).toBe('1 to approve');
    expect(playersWaitWords({ toApprove: 1, toAnswer: 2, toPick: 1 })).toBe('1 to approve, 2 to answer, 1 base to pick');
    expect(playersWaitWords({ toApprove: 0, toAnswer: 0, toPick: 3 })).toBe('3 bases to pick');
    expect(playersWaitWords(NOTHING_WAITING)).toBe('');
    const some = { toApprove: 2, toAnswer: 1, toPick: 0 };
    for (const tabs of [gmTabs(some), gmPhoneTabs(some)]) {
      const lit = Object.fromEntries(tabs.map((t) => [t.id, t.waits ?? '']));
      expect(lit).toMatchObject({ scene: '', players: '2 to approve, 1 to answer', rules: '' });
    }
    expect(gmTabs(some).find((t) => t.id === 'players')?.count).toBe(3);
    expect(gmPhoneTabs(some).find((t) => t.id === 'players')?.badge).toBe(3);
    expect(gmTabs(NOTHING_WAITING).every((t) => !t.waits)).toBe(true);
  });

  // Purpose: each section has the same icon on every device (06; Design on #549): the phone's bars and the tablet's
  // sections agree tab by tab, Rules is the scales and Log the open book.
  it('every section has one icon, whatever the width', () => {
    const icons = (tabs: { id: string; icon: string }[]) => Object.fromEntries(tabs.map((t) => [t.id, t.icon]));
    const player = icons(phoneTabs(0));
    for (const [id, icon] of Object.entries(icons(TABS))) expect(player[id]).toBe(icon);
    const gm = icons(gmPhoneTabs(NOTHING_WAITING));
    for (const [id, icon] of Object.entries(icons(gmTabs(NOTHING_WAITING)))) expect(gm[id]).toBe(icon);
    expect(gm.rules).toBe('scales');
    expect(gm.log).toBe('open-book');
    expect(player.log).toBe('open-book');
  });

  // Purpose: a character with spells has a Magic tab after Pack (mp-20): on a phone the bar is then five, Player,
  // Scene, Pack, Magic and Log (mm-2), Magic's icon the crescent moon with a spark; anyone else's bar is unchanged.
  it("a caster's bar adds Magic before Log; anyone else's keeps four on a phone and three on a tablet", () => {
    expect(phoneTabs(0, true).map((t) => t.name)).toEqual(['Player', 'Scene', 'Pack', 'Magic', 'Log']);
    expect(phoneTabs(0).map((t) => t.name)).toEqual(['Player', 'Scene', 'Pack', 'Log']);
    expect(playerTabs(true).map((t) => t.name)).toEqual(['Player', 'Scene', 'Pack', 'Magic']);
    expect(playerTabs(false)).toEqual(TABS);
    expect(phoneTabs(0, true).find((t) => t.id === 'magic')?.icon).toBe('magic');
    expect(playerTabs(true).find((t) => t.id === 'magic')?.icon).toBe('magic');
  });

  // Purpose: a badge shows its figure, "99+" past 99 and nothing at 0; the tab's name carries it in words.
  it('the badge: 0 shows nothing, 99 shows 99, 100 shows 99+', () => {
    const tabs = (n: number) => [{ id: 'scene' as const, name: 'Scene', icon: 'scene' as const, badge: n, badgeLabel: 'waiting' }];
    const { rerender } = render(<SectionNav label="Main" tabs={tabs(0)} current="scene" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Scene' }).querySelector('.section-nav__badge')).toBeNull();
    rerender(<SectionNav label="Main" tabs={tabs(99)} current="scene" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Scene, 99 waiting' }).querySelector('.section-nav__badge')?.textContent).toBe('99');
    rerender(<SectionNav label="Main" tabs={tabs(100)} current="scene" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Scene, 100 waiting' }).querySelector('.section-nav__badge')?.textContent).toBe('99+');
  });

  // Purpose (K19b, p45-10, FD7): the Pack's tab carries what is new as its badge, on the tablet's tabs and the phone's
  // alike: no mark at 0, 1, 12 and 99 as they are, "99+" from 100, and read aloud "Pack, 12 new".
  it("the Pack's count: none at 0, 1, 12, 99, then 99+, read as “Pack, 12 new”, on both bars", () => {
    for (const tabs of [(n: number) => playerTabs(false, n), (n: number) => phoneTabs(0, false, n), (n: number) => playerTabs(true, n), (n: number) => phoneTabs(0, true, n)]) {
      const { rerender, unmount } = render(<SectionNav label="Main" tabs={tabs(0)} current="player" onSelect={() => undefined} />);
      expect(screen.getByRole('button', { name: 'Pack' }).querySelector('.section-nav__badge')).toBeNull();
      for (const [n, shown] of [[1, '1'], [12, '12'], [99, '99'], [100, '99+']] as const) {
        rerender(<SectionNav label="Main" tabs={tabs(n)} current="player" onSelect={() => undefined} />);
        expect(screen.getByRole('button', { name: `Pack, ${n} new` }).querySelector('.section-nav__badge')?.textContent).toBe(shown);
      }
      unmount();
    }
    // Left out, the count is none: the tabs are as they were.
    expect(playerTabs(false)).toEqual(TABS);
    expect(phoneTabs(0).find((t) => t.id === 'pack')?.badge ?? 0).toBe(0);
  });

  // Purpose: a player with no characters gets a Your characters group with only the way to the list; an empty group
  // (no GM items) is left out; the foot names the person.
  it('a player with no characters: Your characters holds only the list; empty groups are left out', () => {
    render(
      <ShellMenuProvider account={<MenuItem icon="sign-out" onClick={() => undefined}>Sign out</MenuItem>}>
        <PersonProvider name="Bramble">
          <CampaignMenuProvider
            characters={<MenuItem icon="characters" onClick={() => undefined}>Your characters</MenuItem>}
            items={<MenuItem icon="scales" onClick={() => undefined}>Setting rules</MenuItem>}
            gm={false}
          >
            <ShellDrawer title="Reedmouth" onYourCampaigns={() => undefined} onClose={() => undefined} />
          </CampaignMenuProvider>
        </PersonProvider>
      </ShellMenuProvider>,
    );
    const drawer = screen.getByRole('dialog', { name: 'Reedmouth' });
    expect(within(drawer).getAllByRole('region').map((g) => g.getAttribute('aria-label'))).toEqual(['This campaign', 'Your characters', 'Elsewhere']);
    expect(within(within(drawer).getByRole('region', { name: 'Your characters' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Your characters']);
    expect(within(drawer).getByRole('button', { name: /^Bramble/ })).toBeTruthy();
    // Nothing in it is disabled.
    expect(drawer.querySelectorAll('button[disabled]')).toHaveLength(0);
  });

  // Purpose: the theme switch in the drawer's foot leaves the drawer open (a setting, not a place to go).
  it('switching a setting keeps the drawer open', async () => {
    const close = vi.fn();
    render(
      <ShellDrawer title="Reedmouth" onYourCampaigns={() => undefined} onClose={close} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /App settings/ }));
    const section = screen.getByText('This device').closest('.more-menu__section') as HTMLElement;
    const pressable = section.querySelector('button[aria-pressed]') as HTMLButtonElement;
    await user.click(pressable);
    expect(close).not.toHaveBeenCalled();
  });
});

describe('after an update reloads the app (M5b gate walk, overnight item 8)', () => {
  // Purpose: a player on their campaign's Pack tab when the app switches to a new version comes back to that campaign's
  // Pack tab after the reload, not to Your campaigns; the place is used once, so the next plain start opens Your
  // campaigns as before.
  it('a player comes back to the same campaign and tab, once', async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.sam);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('button', { name: 'Pack' }));
    await screen.findByText('Oswin Adderbald’s pack', { selector: '.top-row__title' });
    // The new version arrives while nothing is at risk: the app switches at once (appUpdates.ts).
    const pwa: { refresh?: () => void } = {};
    const updateSW = vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve());
    const registerSW: RegisterSW = (options) => {
      pwa.refresh = options.onNeedRefresh;
      return updateSW;
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    try {
      keepAppUpdated(registerSW);
      pwa.refresh?.();
      expect(updateSW).toHaveBeenCalledWith(true);
    } finally {
      resetAppUpdatesForTests();
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }

    // The reload: the page starts again from nothing but this tab's session storage.
    cleanup();
    render(<Root db={world.db} />);
    const back = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(back).getByRole('button', { name: 'Pack' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Oswin Adderbald’s pack', { selector: '.top-row__title' })).toBeTruthy();

    // A later start with no update opens Your campaigns, as it always has.
    cleanup();
    render(<Root db={world.db} />);
    expect(await screen.findByRole('button', { name: new RegExp(LONG.slice(0, 20)) })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  // Purpose: the GM on Players when the app switches comes back to Players; and a place kept for one person is never
  // opened for another: someone else signing in on the device before the reload lands on their own Your campaigns.
  it("the GM comes back to Players; someone else signing in first gets Your campaigns", async () => {
    windowOf(375);
    const t = table();
    const user = await openAs(t.gm);
    const nav = await screen.findByRole('navigation', { name: 'Campaign sections' });
    await user.click(await within(nav).findByRole('button', { name: /^Players/ }));
    expect(within(nav).getByRole('button', { name: /^Players/ }).getAttribute('aria-current')).toBe('page');
    const pwa: { refresh?: () => void } = {};
    const updateSW = vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve());
    const registerSW: RegisterSW = (options) => {
      pwa.refresh = options.onNeedRefresh;
      return updateSW;
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    try {
      keepAppUpdated(registerSW);
      pwa.refresh?.();
      expect(updateSW).toHaveBeenCalledWith(true);
      cleanup();
      render(<Root db={world.db} />);
      const back = await screen.findByRole('navigation', { name: 'Campaign sections' });
      expect(within(back).getByRole('button', { name: /^Players/ }).getAttribute('aria-current')).toBe('page');

      // Again on Players, a second update; this time Sam signs in on the device before the page starts again.
      resetAppUpdatesForTests();
      keepAppUpdated(registerSW);
      pwa.refresh?.();
      expect(updateSW).toHaveBeenCalledTimes(2);
    } finally {
      resetAppUpdatesForTests();
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
    cleanup();
    world.signInAs(t.sam);
    render(<Root db={world.db} />);
    expect(await screen.findByRole('button', { name: new RegExp(LONG.slice(0, 20)) })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Campaign sections' })).toBeNull();
  });
});
