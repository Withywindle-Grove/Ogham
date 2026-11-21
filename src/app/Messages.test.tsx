// @vitest-environment jsdom
// Messaging (M5b g4), clicked through against the stand-in database. Invented people and words.
//   The GM's ✉ opens Messages; New message picks a character, Send lands it in that thread with an Undo toast; the
//   player's ✉ then counts "1 unread" (a number with words, never a colour alone) and their Scene shows the silent
//   card, no preview; Open shows the thread and reads the message, so the count goes; the other player sees nothing.
//   Undo on the toast takes the message back from the player.
//   Disappears once read: the player sees it with Close; after Close it is gone from their thread; the GM's keeps it.
//   A player's composer has no Attach; the GM's has Attach → A file.
//   Offline, Send keeps the message on this device ("Sends when back online") and sends it when the connection is back.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { MessageCard, MessagesButton, Messaging } from './Messages.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
});
afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    jo: { id: jo, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, jo, campaign, wren, ash, users };
}

type Table = ReturnType<typeof table>;
type Who = 'gm' | 'sam' | 'jo';

function open(t: Table, who: Who) {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <CampaignLog db={world.db} user={t.users[who]} campaignId={t.campaign}>
        <Messaging db={world.db} user={t.users[who]} campaign={campaign}>
          <MessagesButton />
          <MessageCard />
        </Messaging>
      </CampaignLog>
    </ToastHost>,
  );
}

const rows = () => world.tables.messages.filter((m) => !m.undone);

async function gmWrites(t: Table, text: string, options: { disappears?: boolean } = {}) {
  const user = userEvent.setup();
  const view = open(t, 'gm');
  await user.click(screen.getByRole('button', { name: 'Messages' }));
  await user.click(await screen.findByRole('button', { name: 'New message' }));
  await user.click(screen.getByRole('button', { name: 'Wren' }));
  await user.type(screen.getByLabelText('Message'), text);
  if (options.disappears) await user.click(screen.getByRole('switch', { name: 'Disappears once read' }));
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('Sent to Wren');
  return { user, view };
}

describe('messaging', () => {
  it('the GM writes to Wren; Sam gets the count, the silent card and the thread (read on opening); Jo sees nothing', async () => {
    const t = table();
    const { view } = await gmWrites(t, 'You alone notice the lectern has been moved.');
    expect(rows().map((m) => [m.actor_id, m.from_gm, m.body])).toEqual([[t.wren, true, 'You alone notice the lectern has been moved.']]);
    view.unmount();

    open(t, 'sam');
    const button = await screen.findByRole('button', { name: 'Messages, 1 unread' });
    expect(within(button).getByText('1')).toBeTruthy();
    const card = screen.getByRole('article', { name: 'Message from the GM' });
    expect(within(card).getByText('✉ Message from the GM')).toBeTruthy();
    // No preview of the text on Scene.
    expect(within(card).queryByText(/lectern/)).toBeNull();
    const user = userEvent.setup();
    await user.click(within(card).getByRole('button', { name: 'Open' }));
    expect(await screen.findByText('You alone notice the lectern has been moved.')).toBeTruthy();
    // The thread's field never takes focus by itself (A4).
    expect(document.activeElement?.tagName).not.toBe('TEXTAREA');
    await waitFor(() => expect(rows()[0]!.read_at).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await screen.findByRole('button', { name: 'Messages' });
    expect(screen.queryByRole('article', { name: 'Message from the GM' })).toBeNull();
    cleanup();

    open(t, 'jo');
    expect(await screen.findByRole('button', { name: 'Messages' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Message from the GM' })).toBeNull();
  });

  it('Undo on the toast takes the message back from the player', async () => {
    const t = table();
    const { user, view } = await gmWrites(t, 'You hear chanting.');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rows()).toEqual([]));
    view.unmount();
    open(t, 'sam');
    expect(await screen.findByRole('button', { name: 'Messages' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Message from the GM' })).toBeNull();
  });

  it("Disappears once read: Sam sees it with Close; after Close it is gone from Sam's thread and stays in the GM's", async () => {
    const t = table();
    const { view } = await gmWrites(t, 'The idol is hollow.', { disappears: true });
    expect(rows()[0]!.disappears).toBe(true);
    view.unmount();

    open(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    expect(await screen.findByText('The idol is hollow.')).toBeTruthy();
    expect(screen.getByText('Gone from this device once you close it.')).toBeTruthy();
    // Opening alone doesn't read a disappearing one.
    expect(rows()[0]!.read_at).toBeNull();
    const bubble = screen.getByText('The idol is hollow.').closest('li') as HTMLElement;
    await user.click(within(bubble).getByRole('button', { name: 'Close the message' }));
    await waitFor(() => expect(screen.queryByText('The idol is hollow.')).toBeNull());
    expect(rows()[0]!.read_at).not.toBeNull();
    cleanup();

    open(t, 'gm');
    await user.click(screen.getByRole('button', { name: 'Messages' }));
    await user.click(await screen.findByRole('button', { name: /^Wren/ }));
    expect(await screen.findByText('The idol is hollow.')).toBeTruthy();
    expect(screen.getByText('Disappears once read, read')).toBeTruthy();
  });

  it("a player's composer has no Attach and writes to the GM; the GM's has Attach → A file", async () => {
    const t = table();
    open(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Messages' }));
    expect(await screen.findByRole('heading', { name: 'The GM' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Attach' })).toBeNull();
    await user.type(screen.getByLabelText('Message'), 'Is the figure moving at all?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Sent to the GM');
    expect(rows().map((m) => [m.actor_id, m.from_gm, m.player_user_id])).toEqual([[t.wren, false, t.sam]]);
    cleanup();

    open(t, 'gm');
    expect(await screen.findByRole('button', { name: 'Messages, 1 unread' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Messages, 1 unread' }));
    await user.click(await screen.findByRole('button', { name: /^Wren/ }));
    expect(await screen.findByText('Is the figure moving at all?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Attach' }));
    expect(await screen.findByRole('button', { name: 'A file' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Handouts' })).toBeTruthy();
  });

  it('offline, Send keeps the message on this device and sends it when the connection is back', async () => {
    const t = table();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    open(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Messages' }));
    await user.type(await screen.findByLabelText('Message'), 'We wait by the stair.');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findAllByText('Sends when back online')).toHaveLength(2);
    expect(rows()).toEqual([]);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => {
      fireEvent(window, new Event('online'));
    });
    await waitFor(() => expect(rows().map((m) => m.body)).toEqual(['We wait by the stair.']));
    await screen.findByText('Sent to the GM');
  });
});
