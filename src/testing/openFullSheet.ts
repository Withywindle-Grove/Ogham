// Opens the full sheet's own page from the Player tab through the campaign's menu (≡'s drawer on a phone, ⋯ on a
// tablet), its item "Full character sheet". The Player tab's own row "Full character sheet" is gone (row C10, tfr-4,
// tfr-5); the page stays while ⚑ 11 is open, and the menu's item is its way in.
import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type User = ReturnType<typeof userEvent.setup>;

export async function openFullSheetFromMenu(user: User): Promise<void> {
  await screen.findByRole('region', { name: 'Vitals' });
  await user.click(await screen.findByRole('button', { name: /^(Menu|Character options)$/ }));
  const opened = screen.getAllByRole('dialog').at(-1)!;
  await user.click(await within(opened).findByRole('button', { name: 'Full character sheet' }));
}
