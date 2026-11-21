// @vitest-environment jsdom
// The GM's time-left stepper (follow-up to the status rings, #560; plan m5b-creation-retest-3 F), clicked through
// against the stand-in database. Invented characters and statuses.
//   The GM's status sheet has a stepper for a timed status's time left, in the status's own unit; a step acts at once
//   (the ring's arc and the words change) with an Undo toast, and Undo puts the time back.
//   At 1 the step down stays tappable and says why (ending it is End it now); nothing changes.
//   A secret timer is stepped in the GM's own table: the status row itself never gets the time.
//   A player (even the character's own) gets no stepper, only the line "Only the GM changes the time left.".
//   A status with no timer has no stepper.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { MarchingOrder } from './MarchingOrder.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
});
afterEach(() => cleanup());

const TURN = 600;

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, campaign, wren, users };
}

/** A status on Wren as the GM put it there: 3 turns left of 6 unless told otherwise. */
function status(t: ReturnType<typeof table>, id: string, extra: Record<string, unknown> = {}) {
  world.tables.character_statuses.push({
    id,
    campaign_id: t.campaign,
    actor_id: t.wren,
    name: 'Muddy boots',
    condition_id: null,
    icon: null,
    stacks: 1,
    stacking: false,
    levels: null,
    level: null,
    source: 'typed',
    note: null,
    started_at: 0,
    ends_at: 3 * TURN,
    total_seconds: 6 * TURN,
    unit: 'turn',
    secret: false,
    until_rest: false,
    ended_at: null,
    end_reason: null,
    undone: false,
    version: 1,
    created_at: '2026-11-08T09:00:00Z',
    ...extra,
  });
}

function marching(t: ReturnType<typeof table>, who: 'gm' | 'sam') {
  world.signInAs(t[who]);
  forgetCampaignSetting();
  return render(
    <ToastHost>
      <CampaignLog db={world.db} user={t.users[who]} campaignId={t.campaign}>
        <MarchingOrder db={world.db} user={t.users[who]} campaign={{ id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? 'gm' : 'player', line: null }} />
      </CampaignLog>
    </ToastHost>,
  );
}

/** Opens Wren's overview, then the status's sheet. */
async function openSheet(name: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Wren/ }));
  const card = await screen.findByRole('dialog', { name: 'Wren' });
  await user.click(await within(card).findByRole('button', { name }));
  return { user, sheet: await screen.findByRole('dialog', { name: 'Muddy boots' }) };
}

const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const arcShare = (sheet: HTMLElement) => {
  const arc = sheet.querySelector('.status-sheet__head .status-ring__arc');
  const [drawn, length] = (arc?.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
  return arc ? drawn! / length! : null;
};
const row = (id: string) => world.tables.character_statuses.find((s) => s.id === id)!;

describe("the GM's time-left stepper", () => {
  it('a step up changes the ring and the words at once, with Undo; Undo puts the time back', async () => {
    const t = table();
    status(t, 'status-boots');
    marching(t, 'gm');
    const { user, sheet } = await openSheet(/^Muddy boots, 3 turns left/);
    expect(within(sheet).getByText('3 of 6 turns left')).toBeTruthy();
    expect(arcShare(sheet)).toBeCloseTo(1 / 2, 3);
    const stepper = within(sheet).getByRole('group', { name: 'turns left' });
    expect(stepper.querySelector('output')?.textContent).toBe('3');
    await user.click(within(stepper).getByRole('button', { name: 'More turns left' }));
    expect(await screen.findByText('Muddy boots on Wren: 4 turns left')).toBeTruthy();
    await waitFor(() => expect(within(sheet).getByText('4 of 6 turns left')).toBeTruthy());
    expect(arcShare(sheet)).toBeCloseTo(4 / 6, 3);
    expect([row('status-boots').ends_at, row('status-boots').total_seconds]).toEqual([4 * TURN, 6 * TURN]);
    // The log says what happened.
    expect(world.tables.events.at(-1)).toMatchObject({ type: 'status.setTime', level: 'simple', target_table: 'character_statuses' });
    await user.click(await toastUndo('Muddy boots on Wren: 4 turns left'));
    await waitFor(() => expect(row('status-boots').ends_at).toBe(3 * TURN));
    await waitFor(() => expect(within(sheet).getByText('3 of 6 turns left')).toBeTruthy());
  });

  it('two quick taps land in order: the number shows each at once, and the time ends two steps up', async () => {
    const t = table();
    status(t, 'status-boots');
    marching(t, 'gm');
    const { user, sheet } = await openSheet(/^Muddy boots, 3 turns left/);
    const more = within(sheet).getByRole('button', { name: 'More turns left' });
    await user.click(more);
    await user.click(more);
    await waitFor(() => expect(row('status-boots').ends_at).toBe(5 * TURN));
    await waitFor(() => expect(within(sheet).getByText('5 of 6 turns left')).toBeTruthy());
    expect(world.tables.events.filter((e) => e.type === 'status.setTime')).toHaveLength(2);
  });

  it('past its whole length the length grows with it, so the ring reads full ("7 of 7"), never "7 of 6"', async () => {
    const t = table();
    status(t, 'status-boots', { ends_at: 6 * TURN });
    marching(t, 'gm');
    const { user, sheet } = await openSheet(/^Muddy boots, 6 turns left/);
    await user.click(within(sheet).getByRole('button', { name: 'More turns left' }));
    await waitFor(() => expect(within(sheet).getByText('7 of 7 turns left')).toBeTruthy());
    expect(arcShare(sheet)).toBeCloseTo(1, 3);
  });

  it('at 1 the step down stays tappable and says why; nothing changes', async () => {
    const t = table();
    status(t, 'status-boots', { ends_at: TURN });
    marching(t, 'gm');
    const { user, sheet } = await openSheet(/^Muddy boots, 1 turn left/);
    const less = within(sheet).getByRole('button', { name: 'Less turns left' });
    expect(less.hasAttribute('disabled')).toBe(false);
    await user.click(less);
    expect(within(sheet).getByText("It can't go under 1 turn. To end it now, tap End it now.").getAttribute('role')).toBe('status');
    expect(row('status-boots').ends_at).toBe(TURN);
    expect(world.tables.events.some((e) => e.type === 'status.setTime')).toBe(false);
  });

  it("a secret timer is stepped in the GM's own table; the status row never gets the time", async () => {
    const t = table();
    status(t, 'status-boots', { secret: true, ends_at: null, total_seconds: null, unit: null });
    world.tables.status_secrets.push({ id: 'status-boots', campaign_id: t.campaign, ends_at: 2 * TURN, total_seconds: 4 * TURN, unit: 'turn', version: 1 });
    marching(t, 'gm');
    const { user, sheet } = await openSheet(/^Muddy boots, 2 turns left/);
    await user.click(within(sheet).getByRole('button', { name: 'More turns left' }));
    expect(await screen.findByText('Muddy boots on Wren: 3 turns left')).toBeTruthy();
    expect(world.tables.status_secrets[0]).toMatchObject({ ends_at: 3 * TURN, total_seconds: 4 * TURN });
    expect([row('status-boots').ends_at, row('status-boots').total_seconds]).toEqual([null, null]);
  });

  it('a status with no timer has no stepper', async () => {
    const t = table();
    status(t, 'status-boots', { ends_at: null, total_seconds: null, unit: null });
    marching(t, 'gm');
    const { sheet } = await openSheet(/^Muddy boots/);
    expect(within(sheet).queryByRole('group', { name: 'turns left' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'End it now' })).toBeTruthy();
  });

  it("the character's own player gets no stepper, only the line saying the GM changes the time left", async () => {
    const t = table();
    status(t, 'status-boots');
    marching(t, 'sam');
    const { sheet } = await openSheet(/^Muddy boots, 3 turns left/);
    expect(within(sheet).getByText('Only the GM changes the time left.')).toBeTruthy();
    expect(within(sheet).queryByRole('group', { name: 'turns left' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'More turns left' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Remove' })).toBeTruthy();
  });
});
