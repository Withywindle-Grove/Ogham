// @vitest-environment jsdom
// Rest as a shared flow and the players' table view (M5b step g6; ruled 2026-11-01, M5 gate B5 and B18; plan
// docs/plans/m5b-g6-rest-and-table-view.md), clicked through against the stand-in database. Invented characters,
// mode and condition. The tests, purpose first:
//   - A player's answer appears on the GM's panel, and flips when the GM taps the row.
//   - Next turn with two resting, one pushing on and one unanswered stacks the condition on exactly two and resets
//     the timer; one log line (rest.applied) is the record, and Undo on the clock move reverses the whole application.
//   - A rest called out of turn while one is due produces one flow, not two.
//   - The pushed-on character's strip keeps "Rest due · you pushed on" until a later rest applies to them.
//   - The steady-state players' Scene has no accent button; a prompt has exactly one.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { SceneTime } from './SceneTime.tsx';

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

async function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: jo });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  // Invented setting rules: a creeping mode that wants a turn of rest in every three, or Weary (it stacks).
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    exploration: {
      modes: [
        {
          id: 'creep',
          name: 'Creeping',
          step: { value: 1, unit: 'turn' },
          procedure: [],
          checks: [],
          movement: {},
          rest: { every: { value: 3, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary', note: 'Sit a turn in every three, or grow weary.' },
        },
      ],
    },
  });
  entry('condition', 'weary', 'Weary', { stacks: true, notes: 'Slow and sore.' });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    jo: { id: jo, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  world.signInAs(gm);
  // The GM's Next turn shows only while a session runs (st-1, st-2).
  const session = await world.db.rpc('start_session', { campaign });
  if (session.error) throw new Error(session.error.message);
  const started = await world.db.rpc('start_expedition', { campaign, mode_id: 'creep' });
  if (started.error) throw new Error(started.error.message);
  return { gm, sam, jo, campaign, wren, reed, ash, moss, users };
}
type Table = Awaited<ReturnType<typeof table>>;

const open = (t: Table, who: 'gm' | 'sam' | 'jo') => ({ id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null });

/** The Scene as each person sees it: the GM's console strip, or a player's table view with the Rest button. */
function scene(t: Table, who: 'gm' | 'sam' | 'jo') {
  world.signInAs(t[who]);
  forgetCampaignSetting();
  return render(
    <ToastHost>
      <SceneTime
        db={world.db}
        user={t.users[who]}
        campaign={open(t, who)}
        tableView={who === 'gm' ? undefined : { prompts: null, body: (restButton) => <div data-testid="order">{restButton(1)}</div> }}
      />
    </ToastHost>,
  );
}

/** Moves the clock on by whole turns as the GM, outside the screen (no rest applied). */
async function turns(t: Table, n: number) {
  world.signInAs(t.gm);
  const clock = world.tables.campaign_clocks.find((c) => c.campaign_id === t.campaign)!;
  await world.db.rpc('advance_clock', { campaign: t.campaign, by_seconds: n * TURN, seen_version: clock.version as number });
}
const restOf = (id: string) => world.tables.character_rests.find((r) => r.actor_id === id)!;
const weary = (id: string) => world.tables.character_statuses.filter((s) => s.actor_id === id && s.condition_id === 'weary' && s.ended_at === null && !s.undone);
const accents = (root: HTMLElement) => root.querySelectorAll('.button-primary').length;

describe('rest as a shared flow (B5)', () => {
  it("a player's answer shows on the GM's panel, and the GM's tap flips it", async () => {
    const t = await table();
    await turns(t, 3);
    const player = scene(t, 'sam');
    const user = userEvent.setup();
    const prompt = await screen.findByRole('region', { name: 'Rest due' });
    await user.click(within(prompt).getByRole('button', { name: 'Rest, Wren' }));
    await waitFor(() => expect(restOf(t.wren).chosen_at).toBe(3 * TURN));
    expect(await within(prompt).findByText('Wren: Resting this turn')).toBeTruthy();
    player.unmount();

    scene(t, 'gm');
    const panel = await screen.findByRole('region', { name: 'Rest due, 1 of 4 answered' });
    const row = within(panel).getByRole('button', { name: 'Wren: Resting. Tap to change' });
    await user.click(row);
    await waitFor(() => expect(restOf(t.wren)).toMatchObject({ chosen_at: null, pushing_at: 3 * TURN }));
    expect(await within(panel).findByRole('button', { name: 'Wren: Pushing on. Tap to change' })).toBeTruthy();
  });

  it("a player's answer reaches the GM's open panel live (the campaign log's realtime update), without a reload", async () => {
    const t = await table();
    await turns(t, 3);
    world.signInAs(t.gm);
    render(
      <ToastHost>
        <CampaignLog db={world.db} user={t.users.gm} campaignId={t.campaign}>
          <SceneTime db={world.db} user={t.users.gm} campaign={open(t, 'gm')} />
        </CampaignLog>
      </ToastHost>,
    );
    expect(await screen.findByRole('region', { name: 'Rest due, 0 of 4 answered' })).toBeTruthy();
    world.signInAs(t.jo);
    await world.db.rpc('answer_rest', { actors: [t.ash], answer: 'push' });
    world.signInAs(t.gm);
    expect(await screen.findByRole('button', { name: 'Ash: Pushing on. Tap to change' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Rest due, 1 of 4 answered' })).toBeTruthy();
  });

  it('Next turn with two resting, one pushing on and one unanswered stacks Weary on exactly two and restarts the countdown; Undo reverses it', async () => {
    const t = await table();
    await turns(t, 3);
    world.signInAs(t.sam);
    await world.db.rpc('answer_rest', { actors: [t.wren, t.reed], answer: 'rest' });
    world.signInAs(t.jo);
    await world.db.rpc('answer_rest', { actors: [t.ash], answer: 'push' });
    // Moss already carries Weary from earlier: it stacks.
    world.signInAs(t.gm);
    await world.db.rpc('add_status', { campaign: t.campaign, actors: [t.moss], status_name: 'Weary', condition_id: 'weary', stacking: true, source: 'rest' });

    scene(t, 'gm');
    const user = userEvent.setup();
    expect(await screen.findByRole('region', { name: 'Rest due, 3 of 4 answered' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await waitFor(() => expect(restOf(t.wren).rested_at).toBe(3 * TURN));
    expect(restOf(t.reed).rested_at).toBe(3 * TURN);
    expect(weary(t.wren)).toEqual([]);
    expect(weary(t.reed)).toEqual([]);
    expect(weary(t.ash).map((s) => s.stacks)).toEqual([1]);
    expect(weary(t.moss).map((s) => s.stacks)).toEqual([2]);
    expect([t.wren, t.reed, t.ash, t.moss].map((id) => restOf(id).period_from)).toEqual([3 * TURN, 3 * TURN, 3 * TURN, 3 * TURN]);
    expect([t.ash, t.moss].map((id) => restOf(id).pushed_on_at)).toEqual([3 * TURN, 3 * TURN]);
    // The countdown restarted: the next rest is three turns after this one.
    // The GM's head has no rest marker now (st-1): the Rest fact in the facts row counts it ("Rest, In 2 turns").
    expect(await screen.findByRole('button', { name: /^Rest:\s*In 2 turns/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Rest due/ })).toBeNull();
    expect(world.tables.events.filter((e) => e.type === 'rest.applied' && e.target_table === 'character_rests')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(restOf(t.wren).rested_at).toBeNull());
    expect(weary(t.ash)).toEqual([]);
    expect(weary(t.moss).map((s) => s.stacks)).toEqual([1]);
    expect(restOf(t.wren).chosen_at).toBe(3 * TURN);
  });

  // SC-g6-3 (ruled B, 2026-11-03): Next turn sends when the next rest falls due, counted as the strip counts; the
  // rest.applied rows carry it for the log line ("next rest due turn 7").
  it('Next turn sends the next rest due turn with the answers, and the applied rest keeps it for the log line', async () => {
    const t = await table();
    await turns(t, 3);
    scene(t, 'gm');
    const user = userEvent.setup();
    // Due on the strip's turn 4 (clock 3 turns in); every 3 turns, so next due on turn 7.
    expect(await screen.findByRole('region', { name: 'Rest due, 0 of 4 answered' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await waitFor(() => expect(restOf(t.wren).period_from).toBe(3 * TURN));
    const applied = world.tables.events.filter((e) => e.type === 'rest.applied' && e.target_table === 'character_rests');
    expect(applied.map((e) => (e.after as Record<string, unknown>).next_due)).toEqual(Array(4).fill({ at: 6 * TURN, unit: 'turn', number: 7 }));
    // Three more turns: the strip reads turn 7 and the rest is due, as the line said.
    await turns(t, 2);
    cleanup();
    scene(t, 'gm');
    expect(await screen.findByRole('heading', { name: /turn 7/ })).toBeTruthy();
    expect(await screen.findByRole('region', { name: /^Rest due, \d of 4 answered$/ })).toBeTruthy();
  });

  it('a rest called out of turn while one is due is the same flow, not two', async () => {
    const t = await table();
    scene(t, 'sam');
    const user = userEvent.setup();
    // Not due yet: the Rest button calls one for the whole group. (The players' Rest fact counts it, S15.)
    expect(await screen.findByRole('button', { name: /^Rest: In 3 turns\./ })).toBeTruthy();
    await user.click(within(screen.getByTestId('order')).getByRole('button', { name: 'Rest' }));
    expect(await screen.findByText('You called a rest for the group. Everyone answers Rest or Push on.')).toBeTruthy();
    await waitFor(() => expect([t.wren, t.reed, t.ash, t.moss].every((id) => restOf(id).called_at === 0)).toBe(true));
    // The caller (the first of Sam's characters by name) answers Rest.
    expect(restOf(t.reed).chosen_at).toBe(0);
    cleanup();
    // It falls due as well: still one panel.
    await turns(t, 3);
    world.signInAs(t.jo);
    await world.db.rpc('call_rest', { actor: t.ash });
    scene(t, 'gm');
    expect(await screen.findAllByRole('region', { name: /^Rest due, \d of 4 answered$/ })).toHaveLength(1);
  });

  it('the pushed-on character keeps "Rest due, you pushed on" until a later rest applies to them', async () => {
    const t = await table();
    await turns(t, 3);
    scene(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Everyone rests' }));
    await waitFor(() => expect(restOf(t.ash).chosen_at).toBe(3 * TURN));
    // Ash pushes on after all (the GM flips the row).
    await user.click(await screen.findByRole('button', { name: 'Ash: Resting. Tap to change' }));
    await waitFor(() => expect(restOf(t.ash).pushing_at).toBe(3 * TURN));
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await waitFor(() => expect(restOf(t.ash).pushed_on_at).toBe(3 * TURN));
    cleanup();

    scene(t, 'jo');
    // The players' Rest fact (S15) says it, where the strip's rest marker did.
    expect(await screen.findByRole('button', { name: 'Rest: Rest due. You pushed on.' })).toBeTruthy();
    cleanup();
    scene(t, 'sam');
    expect(await screen.findByRole('button', { name: /^Rest: In 2 turns\./ })).toBeTruthy();
    cleanup();

    // The next rest: everyone rests (Ash answers on Jo's device, the GM fills the rest), and the mark goes.
    await turns(t, 2);
    world.signInAs(t.jo);
    await world.db.rpc('answer_rest', { actors: [t.ash], answer: 'rest' });
    scene(t, 'gm');
    await user.click(await screen.findByRole('button', { name: 'Everyone rests' }));
    await waitFor(() => expect(restOf(t.moss).chosen_at).toBe(6 * TURN));
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await waitFor(() => expect(restOf(t.ash).pushed_on_at).toBeNull());
    expect(weary(t.ash)).toEqual([]);
    cleanup();
    scene(t, 'jo');
    expect(await screen.findByRole('button', { name: /^Rest: In 2 turns\./ })).toBeTruthy();
  });
});

describe("the players' table view (B18)", () => {
  it('the steady state has no accent button; the rest prompt has exactly one', async () => {
    const t = await table();
    const steady = scene(t, 'sam');
    expect(await screen.findByRole('button', { name: /^Rest: In 3 turns\./ })).toBeTruthy();
    expect(accents(steady.container)).toBe(0);
    steady.unmount();
    await turns(t, 3);
    const due = scene(t, 'sam');
    const prompt = await screen.findByRole('region', { name: 'Rest due' });
    expect(within(prompt).getAllByRole('button', { name: /^Rest, / })).toHaveLength(2);
    expect(accents(due.container)).toBe(1);
  });
});
