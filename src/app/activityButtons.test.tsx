// @vitest-environment jsdom
// The players' activity buttons on the travel card (M5b step 3, build order 2; docs/05 "Activities"), clicked through
// against a stand-in database whose two activity requests are stubbed. Invented rules.
//   The pack's activities usable here, that the character may do, show by their own names; a secret one as a request
//   button with its cost, which asks the GM (one tap while it waits only explains).
//   Tapping one opens its sheet: the cost line, the roll instructions, each modifier with its source, a roll box.
//   It worked applies the cost and the yield in one request; the toast says what was done, and Undo reverses it.
//   An activity with no chance asks only for Done.
//   In an activity one character does, a player is offered only their own characters and hirelings; the GM anyone;
//   an activity several do is open to the group (ac-1).
//   A yield counting `units` (G-108) asks for single pieces and puts that many in the pack; one counting whole items of
//   a bundled item puts each one's bundle.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { readExploration } from '../modules/expedition/modes.ts';
import { campaignUnits } from '../modules/expedition/play.ts';
import type { ActorFacts } from '../modules/expedition/activities.ts';
import type { ItemCopy } from '../modules/inventory/inventory.ts';
import type { YieldItem } from './ActivityButtons.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { ActivityButtons, offeredActivities } from './ActivityButtons.tsx';
import type { TravelView } from './travelView.ts';
import { PlayerViewContext, type PlayerView } from './playerView.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => cleanup());

const rules = {
  id: 'reed-rules',
  name: 'Reedwalk rules',
  time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 },
  exploration: {
    modes: [
      {
        id: 'roam',
        name: 'Roaming',
        step: { value: 1, unit: 'day' },
        procedure: [{ id: 'course', name: 'Choose a course', icon: 'course', kind: 'note' }],
        checks: [],
        movement: { kind: 'budget', name: 'Leagues', unit: 'points', perDay: 'floor(speed / 5)' },
        terrainClasses: [{ id: 'soft', name: 'Soft going', cost: 2 }],
        terrain: [
          { id: 'marsh', name: 'Marsh', class: 'soft' },
          { id: 'meadow', name: 'Meadow', class: 'soft' },
          { id: 'fen', name: 'Fen', class: 'soft' },
        ],
        activities: [
          {
            id: 'gather-reeds',
            name: 'Gather reeds',
            icon: 'search',
            cost: { budget: 2 },
            chance: { abilityCheck: 'WIS' },
            who: 'one',
            modifiers: [
              { when: 'fullDay', add: 1 },
              { who: 'self', ifClass: 'reed-witch', add: 1 },
              { ifPartyHas: { class: 'lantern-warden' }, add: 1, onlyOnTerrain: ['meadow'] },
            ],
            yields: { item: 'reed-bundle', dice: '3' },
            onlyOnTerrain: ['marsh'],
          },
          { id: 'sing-low', name: 'Sing low', icon: 'search', cost: { budget: 1 }, chance: { abilityCheck: 'CHA' }, secret: true },
          { id: 'graze-sheep', name: 'Graze sheep', icon: 'forage', cost: { budget: 1 }, onlyOnTerrain: ['meadow'] },
          { id: 'set-snares', name: 'Set snares', icon: 'hunt', cost: { budget: 1 }, chance: { skill: 'snare' }, requires: { skill: 'snare' } },
          { id: 'sit-quietly', name: 'Sit quietly', icon: 'rest', cost: { budget: 1 }, who: 'one' },
          { id: 'dig-roots', name: 'Dig roots', icon: 'forage', cost: { budget: 1 }, who: 'one', yields: { item: 'week-rations', units: 3 }, onlyOnTerrain: ['fen'] },
          { id: 'cut-withies', name: 'Cut withies', icon: 'search', cost: { budget: 1 }, who: 'one', yields: { item: 'withy-sheaf', dice: '2' }, onlyOnTerrain: ['fen'] },
          { id: 'drag-the-punt', name: 'Drag the punt', icon: 'search', cost: { budget: 1 }, who: 'several', onlyOnTerrain: ['fen'] },
        ],
      },
    ],
  },
};

const exploration = readExploration([rules]);
const mode = exploration.modes.find((m) => m.id === 'roam')!;

const view = {
  expeditionId: 'exp-1',
  mode,
  rules: exploration,
  travel: mode.wild.travel!,
  day: 0,
  weatherTags: [],
  tags: new Map(),
  rows: new Map(),
  lost: new Map(),
  travellers: new Map([[1, [{ id: 'reed', name: 'Reed the Ferrywarden', speed: 20 }]]]),
  gettingLost: { enabled: false },
  units: campaignUnits(null, [rules]),
  season: null,
  choices: {},
} as unknown as TravelView;

const reed: ActorFacts = { id: 'reed', name: 'Reed the Ferrywarden', skills: new Set(), items: new Set() };
const bundle: ItemCopy = { libraryEntryId: 'entry-reed-bundle', name: 'Reed bundle', category: 'goods', weightCoin: null, slots: 1, stack: 10 };
// A week's food sold as one bundle of seven days, and withies sold in sheaves of five (invented).
const items: Record<string, YieldItem> = {
  'reed-bundle': { item: bundle, bundle: 1, unitName: null },
  'week-rations': { item: { libraryEntryId: 'entry-week-rations', name: 'Fen rations (1 week)', category: 'gear', weightCoin: 70, slots: 1, stack: 1 }, bundle: 7, unitName: 'Ration day' },
  'withy-sheaf': { item: { libraryEntryId: 'entry-withy-sheaf', name: 'Withy sheaf (5)', category: 'goods', weightCoin: 10, slots: 1, stack: 1 }, bundle: 5, unitName: 'Withy' },
};
const user: CurrentUser = { id: 'sam', roles: { camp: 'player' } };
const campaign = { id: 'camp', name: 'The Ash Barrows', role: 'player' as const, line: null };
const row = { total: 5, spent: 0, pending: null, forced: 0, terrainId: 'marsh' };

let rpc: Mock<(name: string, args?: unknown) => Promise<unknown>>;
let onChanged: Mock<() => void>;
let waitingRows: Record<string, unknown>[] = [];

beforeEach(() => {
  rpc = vi.fn(async (name: string) => ({
    data: name === 'apply_activity' ? { id: 'run-1', campaign_id: 'camp', group_number: 1, activity_id: 'gather-reeds', activity_name: 'Gather reeds', spent: 2, outcome: 'worked' } : { id: 'run-1', campaign_id: 'camp', undone: true },
    error: null,
  }));
  onChanged = vi.fn<() => void>();
  waitingRows = [];
});

// A chainable stand-in for db.from('requests').select().eq()...limit(): awaiting the end of the chain gives the rows.
function requestsTable() {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: waitingRows, error: null });
  return chain;
}

function show(overrides: Partial<{ terrainId: string | null; actor: ActorFacts; view: TravelView; user: CurrentUser; playerView: PlayerView; player: string }> = {}) {
  const db = { rpc, from: () => requestsTable() } as unknown as Db;
  return render(
    <PlayerViewContext.Provider value={overrides.playerView ?? null}>
    <ToastHost>
      <ActivityButtons
        db={db}
        user={overrides.user ?? user}
        campaign={campaign}
        group={1}
        view={overrides.view ?? view}
        row={{ ...row, terrainId: overrides.terrainId === undefined ? row.terrainId : overrides.terrainId }}
        actor={overrides.actor ?? reed}
        itemOf={(id) => items[id] ?? null}
        onChanged={onChanged}
        player={overrides.player}
      />
    </ToastHost>
    </PlayerViewContext.Provider>,
  );
}

describe('Activity buttons (M5b step 3)', () => {
  it('only the pack\'s open activities usable on this ground show by their own names, and one the character lacks the skill for does not', () => {
    show();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Gather reeds', 'Sing low, 1 point', 'Sit quietly']);
    cleanup();
    show({ terrainId: 'meadow' });
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Sing low, 1 point', 'Graze sheep', 'Sit quietly']);
    cleanup();
    const skilled = { ...reed, skills: new Set(['snare']) };
    show({ actor: skilled });
    expect(screen.getByRole('button', { name: 'Set snares' })).toBeTruthy();
    expect(offeredActivities(view, 'marsh', reed).map((u) => u.activity.id)).toEqual(['gather-reeds', 'sing-low', 'sit-quietly']);
    expect(offeredActivities(view, 'marsh', skilled).map((u) => u.activity.id)).toEqual(['gather-reeds', 'sing-low', 'set-snares', 'sit-quietly']);
  });

  // Purpose: a secret activity shows as a request button with its cost; tapping it opens a sheet whose Ask the GM sends the request (kind secretActivity, with who, group and spend) and a toast says so.
  it('a secret activity asks the GM through a request with its cost, and the toast says it was sent', async () => {
    show();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sing low, 1 point' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Sing low' }));
    await user.click(sheet.getByRole('button', { name: 'Ask the GM' }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        'send_request',
        expect.objectContaining({ kind: 'secretActivity', body: 'Sing low', cost_text: '1 point', prompt: { activityId: 'sing-low', group: 1, actorIds: ['reed'], spend: 1 } }),
      ),
    );
    expect(await screen.findByText('Sent to the GM: Sing low')).toBeTruthy();
  });

  // Purpose (C15d; page 32, M3f2): in the GM's view as the player, a secret activity's Ask the GM opens "Only Sam can send
  // this request", with "Go to Waiting for you", and sends nothing.
  it("in the GM's view, Ask the GM opens Only Sam can send this request and sends nothing", async () => {
    show({ user: { id: 'priya', roles: { camp: 'gm' } }, playerView: { player: 'Sam', character: 'Reed the Ferrywarden', goToWaiting: () => undefined } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sing low, 1 point' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Sing low' })).getByRole('button', { name: 'Ask the GM' }));
    const pop = await screen.findByRole('dialog', { name: 'Only Sam can send this request' });
    expect([...pop.querySelectorAll('.dialog__got-it button')].map((b) => b.textContent)).toEqual(['Go to Waiting for you', 'Got it']);
    expect(rpc).not.toHaveBeenCalledWith('send_request', expect.anything());
  });

  // Purpose: tfw-2 (2026-11-19; voice rule 16): a secret activity's sheet shows its cost, then Ask the GM, with no line
  // between on what the GM rolls or when the cost applies.
  it('a secret activity’s sheet shows its cost and Ask the GM, with no line about what the GM does', async () => {
    show();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sing low, 1 point' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sing low' });
    expect(dialog.querySelector('.activity__actions')!.previousElementSibling!.textContent).toBe('Cost: 1 point');
    expect(dialog.textContent).not.toMatch(/in secret|cost applies/);
    expect(within(dialog).getByRole('button', { name: 'Ask the GM' })).toBeTruthy();
  });

  // Two invented activities on the bog, for rule 16's lines (tfw-2): one read from a pack table, one whose yield names an
  // item the setting doesn't have.
  const bogView = () => {
    const bogRules = structuredClone(rules);
    const roam = bogRules.exploration.modes[0]!;
    roam.terrain.push({ id: 'bog', name: 'Bog', class: 'soft' });
    roam.activities.push(
      { id: 'sift-mud', name: 'Sift mud', icon: 'search', cost: { budget: 1 }, who: 'one', onlyOnTerrain: ['bog'], tableId: 'mud-finds' } as (typeof roam.activities)[number],
      { id: 'cut-peat', name: 'Cut peat', icon: 'search', cost: { budget: 1 }, who: 'one', yields: { item: 'peat-brick', dice: '2' }, onlyOnTerrain: ['bog'] },
    );
    const bogExploration = readExploration([bogRules]);
    const bogMode = bogExploration.modes.find((m) => m.id === 'roam')!;
    return { ...view, mode: bogMode, rules: bogExploration, travel: bogMode.wild.travel! } as unknown as TravelView;
  };

  // Purpose: rule 16 (tfw-2; the ruling's "later finds"): an activity read from the pack's table shows no line saying
  // the GM rolls on it.
  it('an activity read from a pack table has no line about the GM rolling on it', async () => {
    show({ view: bogView(), terrainId: 'bog' });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sift mud' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sift mud' });
    expect(dialog.textContent).not.toMatch(/GM rolls|pack's table/);
  });

  // Purpose: rule 16: a yield whose item isn't in the setting shows no line saying the GM adds what you find (and no
  // stepper, as before).
  it('a yield whose item is not in the setting has no line about the GM adding it', async () => {
    show({ view: bogView(), terrainId: 'bog' });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cut peat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cut peat' });
    expect(dialog.textContent).not.toMatch(/GM adds|isn't in your setting rules/);
    expect(dialog.querySelector('.activity__yield')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  // Purpose: while the GM hasn't answered, the button says so and a second tap explains instead of opening a sheet.
  it('with a request already waiting, the button says so and a tap explains', async () => {
    waitingRows = [
      { id: 'req-1', campaign_id: 'camp', requester_id: 'sam', kind: 'secretActivity', direction: 'playerAsks', status: 'waiting', prompt: { activityId: 'sing-low' }, text: 'Sing low', version: 1, created_at: '2026-11-03T10:00:00Z' },
    ];
    show();
    const button = await screen.findByRole('button', { name: 'Sing low, waiting for the GM' });
    await userEvent.setup().click(button);
    expect(await screen.findByText("Already asked: the GM hasn't answered Sing low yet.")).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tapping an activity opens its sheet with the cost, the roll instructions, each modifier with its source, and a roll box', async () => {
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gather reeds' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Gather reeds' }));
    expect(sheet.getByText('2 points')).toBeTruthy();
    expect(sheet.getByText('Roll a WIS check')).toBeTruthy();
    expect(sheet.getByText(/^\+1 .*, the rules$/)).toBeTruthy();
    expect(sheet.getByRole('textbox', { name: 'Rolled' })).toBeTruthy();
  });

  // Purpose: a modifier keyed to the party (ex-2, ga-3) shows in the sheet only when it applies: a self one for the
  // character who has the class, named; a party one only on its terrain.
  it("the sheet lists a Reed Witch's own modifier for her, named, and leaves out a party modifier for another terrain", async () => {
    show({ actor: { ...reed, classId: 'reed-witch', className: 'Reed Witch' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gather reeds' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Gather reeds' }));
    expect(sheet.getByText('+1 for Reed the Ferrywarden, a Reed Witch')).toBeTruthy();
    expect(sheet.queryByText(/Lantern Warden/)).toBeNull();
    cleanup();
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gather reeds' }));
    expect(within(await screen.findByRole('dialog', { name: 'Gather reeds' })).queryByText(/Reed Witch/)).toBeNull();
  });

  it('It worked applies the cost and the yield in one request, the toast says so, and Undo reverses it', async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Gather reeds' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Gather reeds' }));
    await user.type(sheet.getByRole('textbox', { name: 'Rolled' }), '9');
    await user.click(sheet.getByRole('button', { name: 'It worked' }));

    const text = "Gather reeds, 2 points, 3 Reed bundle → Reed the Ferrywarden's pack";
    const toast = (await screen.findByText(text)).closest('.toast') as HTMLElement;
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'apply_activity',
      expect.objectContaining({
        campaign: 'camp',
        group_no: 1,
        activity_id: 'gather-reeds',
        actors: ['reed'],
        finder: 'reed',
        rolls: [{ actorId: 'reed', roll: 9 }],
        outcome: 'worked',
        spend: 2,
        yield_entry: 'entry-reed-bundle',
        yield_name: 'Reed bundle',
        yield_qty: 3,
      }),
    );
    expect(onChanged).toHaveBeenCalled();

    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('undo_activity', { run_id: 'run-1' }));
  });

  it('an activity with no chance asks only for Done', async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sit quietly' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Sit quietly' }));
    expect(sheet.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(sheet.queryByRole('button', { name: 'It worked' })).toBeNull();
    expect(sheet.queryByRole('button', { name: "It didn't work" })).toBeNull();
    await user.click(sheet.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('apply_activity', expect.objectContaining({ activity_id: 'sit-quietly', outcome: 'worked', spend: 1, yield_qty: 0 })));
  });

  // Purpose (G-108, ga-5): foraging that counts `units` asks for single days of a week's bundled rations and puts
  // that many days in the finder's pack, as the bundled item's line (named by its single piece, as the database names
  // it); the toast names the day and the bundle.
  it('a yield counting units asks for single days and puts that many in the pack, not that many weeks', async () => {
    show({ terrainId: 'fen' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dig roots' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Dig roots' }));
    expect(sheet.getByRole('group', { name: 'How many Ration day (Fen rations (1 week))?' })).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText("Dig roots, 2 points, 3 Ration day (Fen rations (1 week)) → Reed the Ferrywarden's pack")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith('apply_activity', expect.objectContaining({ activity_id: 'dig-roots', yield_entry: 'entry-week-rations', yield_name: 'Ration day', yield_qty: 3 }));
  });

  // Purpose (G-92's rule, kept for yields): a yield counting whole items of a bundled item puts each one's bundle in
  // the pack (2 sheaves of 5 are 10 withies), as buying one does.
  it('a yield counting whole items of a bundled item puts each bundle in the pack', async () => {
    show({ terrainId: 'fen' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cut withies' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Cut withies' }));
    expect(sheet.getByRole('group', { name: 'How many Withy sheaf (5)?' })).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText("Cut withies, 2 points, 2 Withy sheaf (5) → Reed the Ferrywarden's pack")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith('apply_activity', expect.objectContaining({ activity_id: 'cut-withies', yield_name: 'Withy', yield_qty: 10 }));
  });

  // Purpose (ac-1, 2026-11-11): in an activity one character does, a player is offered only their own characters and
  // hirelings (Moss, another player's, isn't shown at all); the GM is offered everyone; an activity several do is open
  // to the whole group.
  it("a player is offered only their own characters and hirelings for an activity one does; the GM everyone; several: the group", async () => {
    const group = [
      { id: 'reed', name: 'Reed the Ferrywarden', speed: 20, ownerUserId: 'sam' },
      { id: 'moss', name: 'Moss of the Bog Lights', speed: 20, ownerUserId: 'pat' },
      { id: 'hob', name: 'Hob the Lantern-bearer', speed: 20, ownerUserId: 'sam' },
    ];
    const shared = { ...view, travellers: new Map([[1, group]]) } as TravelView;
    const chipsOf = async (activity: string, who: CurrentUser) => {
      show({ terrainId: 'fen', view: shared, user: who });
      await userEvent.setup().click(screen.getByRole('button', { name: activity }));
      const sheet = within(await screen.findByRole('dialog', { name: activity }));
      const names = within(sheet.getByRole('group', { name: "Who's acting" })).getAllByRole('button').map((b) => b.textContent?.replace('✓ ', ''));
      cleanup();
      return names;
    };
    const gm: CurrentUser = { id: 'gail', roles: { camp: 'gm' } };
    expect(await chipsOf('Dig roots', user)).toEqual(['Reed the Ferrywarden', 'Hob the Lantern-bearer']);
    expect(await chipsOf('Dig roots', gm)).toEqual(['Reed the Ferrywarden', 'Moss of the Bog Lights', 'Hob the Lantern-bearer']);
    expect(await chipsOf('Drag the punt', user)).toEqual(['Reed the Ferrywarden', 'Moss of the Bog Lights', 'Hob the Lantern-bearer']);
  });

  // Purpose (C15f; page 32, M3i): in the GM's view of Sam's screen, an activity one character does offers what Sam is
  // offered (his own Reed and Hob), never another player's Moss nor the GM's own; one several do, the whole group.
  it("in the GM's view, Who's acting offers what the player is offered", async () => {
    const group = [
      { id: 'reed', name: 'Reed the Ferrywarden', speed: 20, ownerUserId: 'sam' },
      { id: 'moss', name: 'Moss of the Bog Lights', speed: 20, ownerUserId: 'pat' },
      { id: 'ash', name: 'Ash', speed: 20, ownerUserId: 'gail' },
      { id: 'hob', name: 'Hob the Lantern-bearer', speed: 20, ownerUserId: 'sam' },
    ];
    const shared = { ...view, travellers: new Map([[1, group]]) } as TravelView;
    const gm: CurrentUser = { id: 'gail', roles: { camp: 'gm' } };
    const chipsOf = async (activity: string) => {
      show({ terrainId: 'fen', view: shared, user: gm, player: 'sam', playerView: { player: 'Sam', character: 'Reed the Ferrywarden', goToWaiting: () => undefined } });
      await userEvent.setup().click(screen.getByRole('button', { name: activity }));
      const sheet = within(await screen.findByRole('dialog', { name: activity }));
      const names = within(sheet.getByRole('group', { name: "Who's acting" })).getAllByRole('button').map((b) => b.textContent?.replace('✓ ', ''));
      cleanup();
      return names;
    };
    expect(await chipsOf('Dig roots')).toEqual(['Reed the Ferrywarden', 'Hob the Lantern-bearer']);
    expect(await chipsOf('Drag the punt')).toEqual(['Reed the Ferrywarden', 'Moss of the Bog Lights', 'Ash', 'Hob the Lantern-bearer']);
  });
});
