// "Waiting for you" draws one item whole and the others as one-line rows, past four holding the rest in "N more"
// (S8a, S8b; st-1, wy-1): a test that acts on an item opens it first, as the GM taps its row's title (or "N more").
// Nothing happens when it is already open.
import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

const matches = (title: string | RegExp, text: string) => (typeof title === 'string' ? text === title : title.test(text));

/** The titles "Waiting for you" draws now, top to bottom: the open item's and each row's ("N more" left out). */
export function waitingTitles(): string[] {
  return [...document.querySelectorAll<HTMLElement>('.waiting-card .waiting-open, .waiting-card .waiting-row:not(.waiting-row--more)')].map((el) =>
    el.classList.contains('waiting-open') ? (el.dataset.title ?? '') : (el.querySelector('.waiting-row__title')?.textContent ?? ''),
  );
}

/**
 * Opens the item titled `title` in "Waiting for you" when it is a row (a tap on its title), or held in "N more" (a tap
 * on "N more" until it shows); it is then drawn whole. Throws when no item has that title.
 */
export async function openWaiting(user: UserEvent, title: string | RegExp): Promise<void> {
  const panel = within(await screen.findByRole('region', { name: 'Waiting for you' }));
  for (let i = 0; i < 12; i++) {
    const open = document.querySelector<HTMLElement>('.waiting-card .waiting-open');
    if (open && matches(title, open.dataset.title ?? '')) return;
    const row = panel.queryAllByRole('button', { name: /^Open: / }).find((b) => matches(title, (b.getAttribute('aria-label') ?? '').slice('Open: '.length)));
    if (row) return void (await user.click(row));
    const more = panel.queryByRole('button', { name: /^\d+ more$/ });
    if (!more) break;
    await user.click(more);
  }
  throw new Error(`Nothing waiting is titled ${String(title)}`);
}

/**
 * True when nothing waiting is titled `title`, what "N more" holds included (it is walked as `openWaiting` walks it);
 * any other failure (no panel at all, say) is thrown, never read as "not waiting".
 */
export async function notWaiting(user: UserEvent, title: string | RegExp): Promise<boolean> {
  try {
    await openWaiting(user, title);
    return false;
  } catch (error) {
    if (error instanceof Error && /^Nothing waiting is titled/.test(error.message)) return true;
    throw error;
  }
}

/** Opens a reminder card's line (S8b: each line its own item) and gives its card, the region named "Due". */
export async function openDue(user: UserEvent, title: string | RegExp) {
  await openWaiting(user, title);
  return within(await screen.findByRole('region', { name: 'Due' }));
}
