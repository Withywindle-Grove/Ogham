// A test's way through the place picker (M8b slice 0, pull request 2): where a test used to type a name into Where?,
// Where now? or Move…'s Place (optional), it now opens the picker from that button, takes Other…, types the name and
// taps Set place. Shared by the screen tests so the flow lives in one place.
import { screen, within } from '@testing-library/react';

/** What a test's user needs here (a user-event instance, or the module itself). */
type Clicker = { click: (element: Element) => Promise<unknown>; type: (element: Element, text: string) => Promise<unknown> };

/**
 * Opens the picker from `opener` (a button's accessible name, found in `scope` or the whole screen), types `name`
 * under Other… and taps Set place. The picker closes; what happens next is the caller's (Start expedition, or the
 * move itself on the place card).
 */
export async function typePlace(user: Clicker, name: string, opener: string | RegExp, scope?: ReturnType<typeof within>): Promise<void> {
  const where = scope ?? screen;
  await user.click(await where.findByRole('button', { name: opener }));
  await user.click(await screen.findByRole('button', { name: /^Other…/ }));
  const field = await screen.findByRole('textbox', { name: "A place that isn't listed" });
  await user.type(field, name);
  // The picker's own Set place (the page may have the empty place card's Set place too).
  const sheet = within((field.closest('[role="dialog"]') as HTMLElement | null) ?? document.body);
  await user.click(sheet.getByRole('button', { name: 'Set place' }));
}

/** Opens the picker from `opener` and picks a listed place by its row's words (Recently visited, Near here, a pack's tree). */
export async function pickListedPlace(user: Clicker, words: string | RegExp, opener: string | RegExp, scope?: ReturnType<typeof within>): Promise<void> {
  const where = scope ?? screen;
  await user.click(await where.findByRole('button', { name: opener }));
  await user.click(await screen.findByRole('button', { name: words }));
}

/**
 * The GM's place page (5b): Move on, then its last row Somewhere else… (the free jump that took over from Change place),
 * then the name typed under Other…, as typePlace does.
 */
export async function moveSomewhereElse(user: Clicker, name: string): Promise<void> {
  // A town keeps today's card (until 5t), whose Change place opens the picker itself.
  if (screen.queryByRole('button', { name: 'Change place' })) return typePlace(user, name, 'Change place');
  await user.click(await screen.findByRole('button', { name: /^(Move on|Set place)$/ }));
  await typePlace(user, name, /Somewhere else/);
}
