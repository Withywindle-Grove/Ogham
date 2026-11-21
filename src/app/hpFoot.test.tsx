// @vitest-environment jsdom
// The two small hit points pop-ups share one foot (plan test-feedback-2026-11-19, row A2; p2p-16 and ft-1): the layout
// check measures it on Hit points (tests/layout/player-popups.spec.ts); the harness has no character with no maximum,
// so here, in plain words:
//   The Max hit points pop-up (no maximum recorded, "Set max") draws the same standard foot as Hit points, Set before
//   Cancel, in the same fitted form, so its buttons sit under the box and the pop-up is no wider than its content
//   (tf-A2, Francis on the built picture, 19 Nov).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { HpInPlace, type HpCharacter } from './HpInPlace.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => cleanup());

const player: CurrentUser = { id: 'sam', roles: { reed: 'player' } };
const character: HpCharacter = { id: 'wren', campaignId: 'reed', ownerType: 'user', ownerUserId: 'sam', approval: 'approved', archived: false, name: 'Wren', hpCurrent: 6, hpMax: null };

function footOf(dialog: HTMLElement) {
  expect(dialog.querySelector(':scope > form.hp__keypad--fit'), "the fitted form, the card's own child").not.toBeNull();
  const foot = dialog.querySelector('.hp__keypad--fit > .dialog__actions.hp__foot');
  expect(foot, 'the standard foot').not.toBeNull();
  return [...foot!.querySelectorAll(':scope > button')].map((b) => b.textContent);
}

it('the Max hit points pop-up draws the Hit points pop-up’s fitted form and standard foot, Set before Cancel', async () => {
  const user = userEvent.setup();
  render(
    <ToastHost>
      <HpInPlace db={null as unknown as Db} user={player} character={character} downAt={null} />
    </ToastHost>,
  );
  await user.click(screen.getByRole('button', { name: 'Set max' }));
  expect(footOf(screen.getByRole('dialog', { name: 'Max hit points' }))).toEqual(['Set', 'Cancel']);
  await user.click(within(screen.getByRole('dialog', { name: 'Max hit points' })).getByRole('button', { name: 'Cancel' }));

  await user.click(screen.getByRole('button', { name: 'Hit points 6. Type a value' }));
  expect(footOf(screen.getByRole('dialog', { name: 'Hit points' }))).toEqual(['Set', 'Cancel']);
});
