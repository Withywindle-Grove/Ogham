// @vitest-environment jsdom
// "About this app" (ds-6a, ds-6b; plan dec-9 piece B; pictures december/08-01 to 08-04): the menu's item above Sign
// out, the sheet's version line (the build's own), the Credits generated from the icon table, and the fonts' licences.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, FAKE_EMAIL_CODE, type FakeWorld } from '../testing/fakeDb.ts';
import { ICON_SET, SET_ICON_NAMES } from '../ui/iconSet.ts';
import { AboutThisApp } from './AboutThisApp.tsx';
import { BuildContext, STAND_IN_BUILD } from './AppUpdate.tsx';
import { Root } from './App.tsx';
import { FONT_CREDITS, OFL_1_1, aboutVersionLine, creditsLine, iconCredits, type IconCredit } from './aboutCredits.ts';

// The screens use the stand-in database passed to Root, never a real connection.
vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };

afterEach(() => cleanup());

describe('the version line', () => {
  // Purpose: the sheet names the app and this build's own version (its commit and day), never a number typed in.
  it('shows the app’s name and the build’s own id and day', () => {
    expect(aboutVersionLine({ id: 'a1b2c3d', date: '2026-01-15' }, 'Tome')).toBe('Tome, version a1b2c3d, built 15 Jan 2026');
  });

  // Purpose: a build made on a computer (no commit) still reads as one plain line.
  it('says "dev" for a build made on a computer', () => {
    expect(aboutVersionLine({ id: 'dev', date: null }, 'Tome')).toBe('Tome, version dev');
  });
});

describe('the Credits (ds-6a)', () => {
  // Purpose: every icon in the table has a plain name to show, so no row is blank.
  it('gives every icon in the table a plain name', () => {
    for (const name of SET_ICON_NAMES) expect(ICON_SET[name].plain.trim()).not.toBe('');
  });

  // Purpose: the Credits come from the icon table, one row per icon, A to Z by plain name, so an icon added to the table is credited without touching the sheet.
  it('lists every icon in the table once, A to Z', () => {
    const rows = iconCredits();
    expect(rows.map((row) => row.name).sort()).toEqual([...SET_ICON_NAMES].sort());
    const names = rows.map((row) => row.plain);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  // Purpose (B16; p2p-30): the Credits list the four pictures of the ways' buttons, each with its author, the set
  // and the licence: the oars and the fish by Delapouite, the leather boot by Lorc, the climber by Caro Asercion
  // (⚑ 11, ruled 2026-11-19).
  it('lists the ways’ four pictures with their authors', () => {
    const credited = Object.fromEntries(iconCredits().map((row) => [row.name, `${row.plain}: ${row.author.name}, ${row.source.name}, ${row.licence.name}`]));
    expect(credited.paddles).toBe('Oars: Delapouite, game-icons.net, CC BY 3.0');
    expect(credited['double-fish']).toBe('Fish: Delapouite, game-icons.net, CC BY 3.0');
    expect(credited['leather-boot']).toBe('Leather boot: Lorc, game-icons.net, CC BY 3.0');
    expect(credited['mountain-climbing']).toBe('Climber: Caro Asercion, game-icons.net, CC BY 3.0');
    render(<AboutThisApp onClose={() => undefined} preview />);
    const rows = within(screen.getByRole('list', { name: 'Icons' })).getAllByRole('listitem').map((row) => row.textContent);
    expect(rows).toContain('Oars: Delapouite, game-icons.net, CC BY 3.0');
    expect(rows).toContain('Fish: Delapouite, game-icons.net, CC BY 3.0');
    expect(rows).toContain('Leather boot: Lorc, game-icons.net, CC BY 3.0');
    expect(rows).toContain('Climber: Caro Asercion, game-icons.net, CC BY 3.0');
  });

  // Purpose: the line says "some are mirrored" only once an icon is drawn mirrored, and that icon's row says so (ds-6b).
  it('mentions mirroring only when an icon is mirrored', () => {
    expect(creditsLine(iconCredits())).toBe('Icons are shown in the app’s colours.');
    const dagger: IconCredit = { ...ICON_SET.hourglass, plain: 'Dagger', mirrored: true };
    expect(creditsLine([...iconCredits(), dagger])).toBe('Icons are shown in the app’s colours; some are mirrored.');
    render(<AboutThisApp onClose={() => undefined} preview icons={[dagger]} />);
    expect(within(screen.getByRole('list', { name: 'Icons' })).getByRole('listitem').textContent).toContain('Dagger (mirrored):');
  });

  // Purpose: every font the app bundles is credited with its licence, and no row names a font the app does not bundle.
  it('credits exactly the fonts fonts.css bundles', () => {
    const css = fs.readFileSync('./src/ui/fonts.css', 'utf8');
    const bundled = [...new Set([...css.matchAll(/@import '(@fontsource\/[a-z0-9-]+)\//g)].map((match) => match[1]))].sort();
    expect(FONT_CREDITS.map((font) => font.pkg).sort()).toEqual(bundled);
    for (const font of FONT_CREDITS) expect(font.licence).toBe(OFL_1_1);
  });

  // Purpose: the sheet shows the title, the version line, the heading and line, a row per icon with its author, the set and the licence as a link, then the fonts.
  it('draws each row with its author, the set and the licence as a link', () => {
    render(
      <BuildContext.Provider value={STAND_IN_BUILD}>
        <AboutThisApp onClose={() => undefined} preview />
      </BuildContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'About this app' })).toBeTruthy();
    expect(screen.getByText('Tome, version a1b2c3d, built 15 Jan 2026')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Credits' })).toBeTruthy();
    const icons = within(screen.getByRole('list', { name: 'Icons' })).getAllByRole('listitem');
    expect(icons).toHaveLength(SET_ICON_NAMES.length);
    const chest = icons.find((row) => row.textContent?.startsWith('Chest:'));
    expect(chest?.textContent).toBe('Chest: Lorc, game-icons.net, CC BY 3.0');
    expect(within(chest!).getByRole('link', { name: 'CC BY 3.0' }).getAttribute('href')).toBe('https://creativecommons.org/licenses/by/3.0/');
    expect(chest!.querySelector('svg')).not.toBeNull();
    const fonts = within(screen.getByRole('list', { name: 'Fonts' })).getAllByRole('listitem');
    expect(fonts.map((row) => row.textContent)).toContain('Bitter: The Bitter Project Authors, SIL Open Font License 1.1');
    expect(within(fonts[0]!).getByRole('link', { name: 'SIL Open Font License 1.1' }).getAttribute('href')).toBe(OFL_1_1.url);
  });
});

describe('the menu item (ds-6a)', () => {
  let world: FakeWorld;
  beforeEach(() => {
    world = createFakeDb();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  // Purpose: "About this app" sits just above Sign out in the menu, opens its sheet, and ✕ closes the sheet.
  it('sits just above Sign out and opens the sheet, which ✕ closes', async () => {
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.type(await screen.findByLabelText('Email'), 'wren@lantern.example');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    await user.type(await screen.findByLabelText('Sign-in code'), FAKE_EMAIL_CODE);
    await user.type(await screen.findByLabelText('Your name'), 'Wren');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    const signOut = screen.getByRole('button', { name: 'Sign out' });
    const about = screen.getByRole('button', { name: 'About this app' });
    expect(signOut.previousElementSibling).toBe(about);

    await user.click(about);
    const sheet = await screen.findByRole('dialog', { name: 'About this app' });
    // The menu closed behind it.
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(within(sheet).getByRole('heading', { name: 'Credits' })).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'About this app' })).toBeNull();
  });
});
