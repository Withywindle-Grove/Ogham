// @vitest-environment jsdom
// The full sheet's parts on the Player screen in one column (dec-13 C1; the review of #894, its Important 1). Purposes:
//   While the hosted sheet is still being read, "Opening…" stands where the saves will be (under hit points and armour
//   class), so the screen never silently lacks its parts.
//   When the read fails, the error and Try again stand there, and Try again reads the sheet again.
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { PlayerSheetParts, type PlayerSlots } from './PlayerSheetParts.tsx';

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => cleanup());

const user: CurrentUser = { id: 'person-1', roles: {} };

/** The screen's places, as the Player screen draws them in one column. */
function slotsIn(): { slots: PlayerSlots; saves: HTMLElement } {
  const make = () => document.body.appendChild(document.createElement('div'));
  const saves = make();
  return { saves, slots: { saves, level: make(), details: make(), top: make(), more: make() } };
}

/** A database whose read of the character never answers (a slow connection). */
function slowDb(db: Db): Db {
  return new Proxy(db, {
    get(target, key, receiver) {
      if (key !== 'from') return Reflect.get(target, key, receiver);
      return (table: string) => {
        if (table !== 'actors') return target.from(table as never);
        const chain: Record<string, unknown> = {};
        for (const step of ['select', 'eq', 'in', 'order']) chain[step] = () => chain;
        chain.maybeSingle = () => new Promise(() => undefined);
        return chain;
      };
    },
  }) as Db;
}

describe('the hosted sheet in one column, before its parts arrive', () => {
  it('says Opening… under hit points and armour class while the sheet is read', async () => {
    const world = createFakeDb();
    const { slots, saves } = slotsIn();
    render(<PlayerSheetParts db={slowDb(world.db)} user={user} characterId="actor-missing" refreshKey={0} beside={false} slots={slots} />);
    expect(await within(saves).findByRole('status')).toHaveProperty('textContent', 'Opening…');
  });

  it('says it could not load, with Try again, when the read fails; Try again reads again', async () => {
    const world = createFakeDb();
    const { slots, saves } = slotsIn();
    const read = vi.spyOn(world.db, 'from');
    render(<PlayerSheetParts db={world.db} user={user} characterId="actor-missing" refreshKey={0} beside={false} slots={slots} />);
    expect(await within(saves).findByText("Couldn't load this character. Check your connection and try again.")).toBeTruthy();
    const before = read.mock.calls.filter(([table]) => table === 'actors').length;
    await act(async () => {
      await userEvent.setup().click(within(saves).getByRole('button', { name: 'Try again' }));
    });
    expect(read.mock.calls.filter(([table]) => table === 'actors').length).toBeGreaterThan(before);
    expect(screen.queryAllByText('Opening…').length + screen.queryAllByText(/Couldn't load this character/).length).toBeGreaterThan(0);
  });
});
