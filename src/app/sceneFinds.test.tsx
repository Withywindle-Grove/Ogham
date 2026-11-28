// @vitest-environment jsdom
// The find card in the Scene's prompt slot (K18d of docs/plans/dec-6-the-whole-pack-tab.md; page 45's FD1c C, approved
// 2026-11-26; p45-3 and p45-23, "After rest, before call"). Invented names and coins only (hard rule 2). Purposes:
//   1. The calls' place holds one live region, and a find card and a call card share it, one at a time: with both due
//      the find card shows and the call waits; once the find card goes, the call card shows in the same region, and
//      focus, fallen to the page with the find's "Got it", moves to the call's "Got it".
//   2. With a find card alone the place names no "Calls to adventure" group; a call already seen stays folded under it.
//   3. On a player's Scene a find the GM sent shows the card in the prompt slot, after the slot's other prompts (the
//      rest and light prompts among them), and nowhere else on the tab.
//   4. With a call due too, the Scene shows the find card and not the call; after the find's "Got it" (the mark
//      written once) the call card shows.
//   5. "Got it" on the Scene clears what the Pack reads as new: the Pack's read finds nothing new afterwards.
//   6. Offline, the Scene's "Got it" writes nothing and shows the box under the card.
//   7. Hidden means hidden: another player's Scene, and the GM's view of this player's Scene, draw no find card.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { giveFind } from '../modules/expedition/findSend.ts';
import { sendHook } from '../modules/library/callsToAdventure.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CallsInPromptSlot } from './CallCard.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { loadPackFinds } from './packFinds.ts';
import { loadInventory } from '../modules/inventory/inventory.ts';
import { SceneTime } from './SceneTime.tsx';
import type { CallSend } from '../modules/library/callCards.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry: registryOf } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: registryOf() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

const registry = createAppRegistry();

/** Wren (Sam's) and Moss (Tess's), a place for the GM's sends, and one call to adventure in the campaign's pack. */
function table() {
  const gm = world.addPerson('priya@weirs.example', 'Priya');
  const sam = world.addPerson('sam@weirs.example', 'Sam');
  const tess = world.addPerson('tess@weirs.example', 'Tess');
  const campaign = world.addCampaign('The Eel Weirs', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: tess });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, tess, 'player', moss);
  world.tables.places.push({ id: 'place-stair', campaign_id: campaign, name: 'The Reed Stair', players_name: 'A stair', undone: false, version: 1 });
  world.tables.packs.push({ id: 'weirs', owner_user_id: gm, campaign_id: null, name: 'The eel weirs', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'cp-weirs', campaign_id: campaign, pack_id: 'weirs', option_choices: {}, priority: 1 });
  world.tables.library_entries.push({ id: 'e1', pack_id: 'weirs', kind: 'adventureHook', pack_entry_id: 'bounty', name: 'Bounty on the Bog lurker', data: { text: 'Nailed to the quay post.', pays: '', giver: null, order: 0 } });
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    tess: { id: tess, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, tess, campaign, wren, moss, users };
}
type Table = ReturnType<typeof table>;

/** The GM sends Wren a thing (K16b's send, one of p45-21's roads). */
async function sendFind(t: Table, name: string) {
  world.signInAs(t.gm);
  const done = await runCommand(registry, world.db, t.users.gm, giveFind, { campaignId: t.campaign, to: t.wren, placeId: 'place-stair', things: [{ name, qty: 1 }], coins: {}, rows: [] });
  expect(done.ok).toBe(true);
}

/** The GM sends the party a call to adventure. */
async function sendCall(t: Table) {
  world.signInAs(t.gm);
  const sent = await runCommand(registry, world.db, t.users.gm, sendHook, { campaignId: t.campaign, packId: 'weirs', hookId: 'bounty', actorId: null, body: 'A bounty on the Bog lurker.', pays: '' });
  expect(sent.ok).toBe(true);
}

/** The Scene as one person sees it, with a stand-in rest prompt and light prompt in the slot; `player` is the GM's view. */
function scene(t: Table, who: 'gm' | 'sam' | 'tess', player?: string) {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Eel Weirs', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <CampaignLog db={world.db} user={t.users[who]} campaignId={t.campaign}>
        <SceneTime
          db={world.db}
          user={t.users[who]}
          campaign={campaign}
          player={player}
          tableView={{
            prompts: [
              <p key="rest" data-testid="rest-prompt">
                Rest is due
              </p>,
              <p key="dark" data-testid="light-prompt">
                No light
              </p>,
            ],
            body: () => null,
          }}
        />
      </CampaignLog>
    </ToastHost>,
  );
}

const marks = () => world.tables.events.filter((e) => e.target_table === 'finds_seen');
const callSend: CallSend = { id: 'send-1', kind: 'hook', body: 'A bounty on the Bog lurker.', pays: '', actorId: null } as unknown as CallSend;
const findStandIn = (
  <div className="find-card-live">
    <section className="find-card">
      <h3>New in your pack</h3>
      <button type="button">Got it: New in your pack</button>
    </section>
  </div>
);

describe('the calls’ one place, shared with a find card (K18d, p45-23)', () => {
  it('shows the find card in the one live region while it is there, then the call card in the same region', () => {
    const calls = { card: callSend, count: null, folded: [] };
    const { container, rerender } = render(<CallsInPromptSlot calls={calls} onGotIt={() => undefined} find={findStandIn} />);
    const live = container.querySelectorAll('[role="status"]');
    expect(live).toHaveLength(1);
    expect(live[0]!.querySelector('.find-card')).toBeTruthy();
    expect(container.querySelector('.call-card')).toBeNull();
    // The find's "Got it" went with its card: focus fell to the page.
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(<CallsInPromptSlot calls={calls} onGotIt={() => undefined} find={null} />);
    const after = container.querySelectorAll('[role="status"]');
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(live[0]);
    expect(after[0]!.querySelector('.call-card')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Got it: A call to adventure/ }));
  });

  it('names no calls group for a find card alone, and keeps a seen call folded under it', () => {
    const { container, rerender } = render(<CallsInPromptSlot calls={null} onGotIt={() => undefined} find={findStandIn} />);
    expect(screen.queryByRole('group', { name: 'Calls to adventure' })).toBeNull();
    expect(container.querySelector('.calls-slot--empty')).toBeNull();
    rerender(<CallsInPromptSlot calls={{ card: null, count: null, folded: [callSend] }} onGotIt={() => undefined} find={findStandIn} />);
    const place = screen.getByRole('group', { name: 'Calls to adventure' });
    expect(place.querySelector('[role="status"] .find-card')).toBeTruthy();
    expect(within(place).getByRole('button', { name: 'A call to adventure, for the party' })).toBeTruthy();
  });
});

describe('the find card on the Scene (K18d)', () => {
  it('stands in the prompt slot after the rest and light prompts, and nowhere else on the tab', async () => {
    const t = table();
    await sendFind(t, 'Bronze ring');
    const { container } = scene(t, 'sam');
    await waitFor(() => expect(container.querySelector('.find-card')).toBeTruthy());
    expect(container.querySelectorAll('.find-card')).toHaveLength(1);
    const slot = container.querySelector('.prompt-slot')!;
    const items = [...slot.children];
    const findAt = items.findIndex((i) => i.querySelector('.find-card'));
    expect(findAt).toBe(items.length - 1);
    expect(items.findIndex((i) => i.querySelector('[data-testid="rest-prompt"]'))).toBeLessThan(findAt);
    expect(items.findIndex((i) => i.querySelector('[data-testid="light-prompt"]'))).toBeLessThan(findAt);
    expect(within(slot as HTMLElement).getByText('Bronze ring')).toBeTruthy();
    // Inside the slot's one live region: the card adds none of its own.
    expect(slot.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('shows the find card before a call, and the call after its Got it', async () => {
    const t = table();
    await sendCall(t);
    await sendFind(t, 'Bronze ring');
    const { container } = scene(t, 'sam');
    const got = await screen.findByRole('button', { name: 'Got it: New in your pack' });
    expect(container.querySelector('.call-card')).toBeNull();
    await userEvent.setup().click(got);
    expect(await screen.findByRole('heading', { name: 'A call to adventure, for the party' })).toBeTruthy();
    expect(container.querySelector('.find-card')).toBeNull();
    expect(marks()).toHaveLength(1);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('clears what the Pack reads as new once Got it is tapped on the Scene', async () => {
    const t = table();
    await sendFind(t, 'Bronze ring');
    world.signInAs(t.sam);
    const before = await loadPackFinds(world.db, t.users.sam, t.campaign, t.wren, (await loadInventory(world.db, t.campaign))!.lines, []);
    expect(before!.entries).toHaveLength(1);
    scene(t, 'sam');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Got it: New in your pack' }));
    await waitFor(() => expect(marks()).toHaveLength(1));
    world.signInAs(t.sam);
    const inventory = await loadInventory(world.db, t.campaign);
    const finds = await loadPackFinds(world.db, t.users.sam, t.campaign, t.wren, inventory!.lines, []);
    expect(finds).not.toBeNull();
    expect(finds!.entries).toEqual([]);
  });

  it('offline, Got it writes nothing and the box explains under the card', async () => {
    const t = table();
    await sendFind(t, 'Bronze ring');
    scene(t, 'sam');
    const got = await screen.findByRole('button', { name: 'Got it: New in your pack' });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    act(() => void window.dispatchEvent(new Event('offline')));
    await userEvent.setup().click(got);
    expect(await screen.findByText(/You’re offline\. Got it waits until you’re back\./)).toBeTruthy();
    expect(marks()).toHaveLength(0);
  });

  it('draws no find card on another player’s Scene, nor in the GM’s view of this player’s', async () => {
    const t = table();
    await sendFind(t, 'Bronze ring');
    const tess = scene(t, 'tess');
    expect(await screen.findByTestId('rest-prompt')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(tess.container.querySelector('.find-card')).toBeNull();
    expect(tess.container.textContent).not.toContain('Bronze ring');
    tess.unmount();
    const gmView = scene(t, 'gm', t.sam);
    expect(await screen.findByTestId('rest-prompt')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(gmView.container.querySelector('.find-card')).toBeNull();
  });
});
