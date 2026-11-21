// A test's way to start an expedition (plan dec-9-the-whole-scene S5; page 16, T4 and T6; plan scene-point-to-point B7,
// page 24, DP1): the band's "Depart" opens the Depart sheet, which holds Where? (first, and required before Start),
// "Exploration method" and the stacked Start. Where a test used to tap Start expedition, or the Mode row or Where? on
// the strip, it opens the sheet first (once: it stays open until Start). Shared by the screen tests so the flow lives
// in one place.
import { screen, within, type BoundFunctions, type queries } from '@testing-library/react';
import { typePlace } from './pickPlace.ts';

type Scope = BoundFunctions<typeof queries>;

type Clicker = { click: (element: Element) => Promise<unknown>; type: (element: Element, text: string) => Promise<unknown> };

/** The place a test's expedition starts at when the test gives none (Where? is required before Start, ⚑ 4 of B7). */
export const ANY_PLACE = 'The Mustering Field';

/**
 * The Depart sheet, open (the band's Depart is tapped if it isn't). Its name is "<the band's heading>: Depart". Depart
 * shows only while a session runs (p2p-4; B6): with none, or a paused one, the band's Start or Resume is tapped first,
 * as the GM would.
 */
export async function openDepart(user: Pick<Clicker, 'click'>): Promise<Scope> {
  const open = screen.queryByRole('dialog', { name: /(^|: )Depart$/ });
  if (open) return within(open);
  const shown = await screen.findAllByRole('button', { name: /^(Depart|Start session|Resume session)$/ });
  const session = shown.find((b) => b.textContent !== 'Depart');
  if (session && !shown.some((b) => b.textContent === 'Depart')) await user.click(session);
  await user.click(await screen.findByRole('button', { name: 'Depart' }));
  return within(await screen.findByRole('dialog', { name: /(^|: )Depart$/ }));
}

/** The sheet's Where? row (B7: its name reads "Where?: " and the picked place, or "Pick a Location"). */
export const WHERE = /^Where\?:/;

/**
 * Start expedition: the Depart sheet's Start (opening the sheet first if it isn't open). Where nothing is picked yet,
 * `where` is typed under Other… first (`ANY_PLACE` unless given), as Where? is required before Start.
 */
export async function startExpedition(user: Clicker, where: string = ANY_PLACE): Promise<void> {
  const sheet = await openDepart(user);
  if (sheet.queryByRole('button', { name: 'Where?: Pick a Location' })) await typePlace(user, where, WHERE, sheet);
  await user.click(await sheet.findByRole('button', { name: 'Start' }));
}

/** The sheet's "Exploration method" row (the campaign's modes and Point to point), opening the sheet first. */
export async function departModes(user: Pick<Clicker, 'click'>): Promise<Scope> {
  const sheet = await openDepart(user);
  return within(sheet.getByRole('group', { name: 'Exploration method' }));
}
