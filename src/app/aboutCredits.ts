// What "About this app" says (ds-6a, ds-6b; plan dec-9 piece B; pictures december/08-01 to 08-04): the app's name and
// the build's own version on one line, then the Credits: one line, a row for each icon taken from the set (generated
// from the icon table, src/ui/iconSet.ts), and the fonts the app bundles with their licence. Pure, for the tests.
import { BRAND } from '../brand.ts';
import { ICON_SET, SET_ICON_NAMES, type SetIconEntry } from '../ui/iconSet.ts';
import { versionWords, type BuildInfo } from './appUpdates.ts';

/** The quiet line under the title: "Tome, version a1b2c3d, built 15 Jan 2026" (the build's own, never a number typed in). */
export function aboutVersionLine(build: BuildInfo, appName: string = BRAND.appName): string {
  const words = versionWords(build);
  return `${appName}, ${words.charAt(0).toLowerCase()}${words.slice(1)}`;
}

/** One icon's row in the Credits. `mirrored` is drawn flipped (ds-6b); no icon in the table is, yet. */
export type IconCredit = Pick<SetIconEntry, 'name' | 'plain' | 'author' | 'source' | 'licence'> & { mirrored?: boolean };

/** The Credits' icon rows: every icon in the table, by its plain name A to Z (as the pictures list them). */
export function iconCredits(entries: readonly IconCredit[] = SET_ICON_NAMES.map((name) => ICON_SET[name])): IconCredit[] {
  return [...entries].sort((a, b) => a.plain.localeCompare(b.plain, 'en'));
}

/** The words before the icon's author: its plain name, "(mirrored)" after it when it is drawn flipped. */
export function iconCreditName(icon: IconCredit): string {
  return icon.mirrored ? `${icon.plain} (mirrored)` : icon.plain;
}

/** The Credits' one line (ds-6a; ds-6b adds "some are mirrored", said only once an icon is). */
export function creditsLine(icons: readonly IconCredit[]): string {
  return icons.some((icon) => icon.mirrored) ? 'Icons are shown in the app’s colours; some are mirrored.' : 'Icons are shown in the app’s colours.';
}

/** The fonts' licence (each font's own LICENSE file: "SIL Open Font License, Version 1.1"). */
export const OFL_1_1 = { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' } as const;

export interface FontCredit {
  /** The font's name, as the Credits show it. */
  family: string;
  /** The package it comes from (fonts.css imports it); the test checks every one imported has its row. */
  pkg: string;
  /** As its LICENSE file names them. */
  authors: string;
  licence: typeof OFL_1_1;
}

/**
 * The fonts the app bundles (src/ui/fonts.css), in the order the Credits list them: the book's two (Bitter, Alegreya
 * Sans SC, as the pictures show) and, until the sweep moves the whole app to them, the three the rest of it uses.
 */
export const FONT_CREDITS: readonly FontCredit[] = [
  { family: 'Bitter', pkg: '@fontsource/bitter', authors: 'The Bitter Project Authors', licence: OFL_1_1 },
  { family: 'Alegreya Sans SC', pkg: '@fontsource/alegreya-sans-sc', authors: 'The Alegreya Sans Project Authors', licence: OFL_1_1 },
  { family: 'EB Garamond', pkg: '@fontsource/eb-garamond', authors: 'The EB Garamond Project Authors', licence: OFL_1_1 },
  { family: 'Atkinson Hyperlegible', pkg: '@fontsource/atkinson-hyperlegible', authors: 'Braille Institute of America, Inc.', licence: OFL_1_1 },
  { family: 'Caveat', pkg: '@fontsource/caveat', authors: 'The Caveat Project Authors', licence: OFL_1_1 },
];
