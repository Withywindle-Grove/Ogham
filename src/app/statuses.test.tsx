// @vitest-environment jsdom
// Statuses and rest (M5 step 9), clicked through against the stand-in database. Invented characters and conditions.
//   + Status from the character overview: a typed name, or a condition found with the search bar; it shows in the
//   overview and beside the name in the marching order, and Undo takes it off. A condition that stacks shows "×2".
//   A condition with levels steps up and down in its sheet; down from its first level ends it.
//   A secret timer (the GM's): the GM sees the time left; a player sees it active, never how long, and their device
//   never gets it. + Status is the GM's (C1): a player has none, even on their own character, but removes their own
//   statuses. A player can't change someone else's statuses (no Remove, no + Status).
//   Rest is the shared rest flow since the M5 gate (B5): src/app/restFlow.test.tsx.
//   M5 gate B6: the durations on one chip row (Until removed by default, never None; 1 turn; Until rest); the brief
//   effect under every name (pop-up, overview); a family row opens the pack's kinds; a custom status (name, What it
//   does, Stacks) is kept in the campaign's homebrew and offered next time; a custom name the setting has is refused.
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
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  // Invented setting rules: a creeping mode that wants a turn of rest in every three, or Weary (it stacks), and a
  // condition with levels.
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
  entry('condition', 'dazed', 'Dazed', { levels: [{ id: 'dazed', name: 'Dazed' }, { id: 'reeling', name: 'Reeling' }, { id: 'out-cold', name: 'Out cold' }] });
  // B6: two kinds in one family (07 conditions[].family).
  entry('condition', 'fen-bite', 'Fen bite', { family: 'Bog rot', notes: 'Itches until dawn.' });
  entry('condition', 'reed-cut', 'Reed cut', { family: 'Bog rot', notes: 'Bleeds a little at every step.' });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    jo: { id: jo, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, jo, campaign, wren, ash, users };
}

const open = (t: ReturnType<typeof table>, who: 'gm' | 'sam' | 'jo') => ({ id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null });

function marching(t: ReturnType<typeof table>, who: 'gm' | 'sam' | 'jo') {
  world.signInAs(t[who]);
  forgetCampaignSetting();
  // In the campaign's live log, as on Scene: a change made in the overview shows in the marching order too.
  return render(
    <ToastHost>
      <CampaignLog db={world.db} user={t.users[who]} campaignId={t.campaign}>
        <MarchingOrder db={world.db} user={t.users[who]} campaign={open(t, who)} />
      </CampaignLog>
    </ToastHost>,
  );
}

const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const statusesOn = (actor: string) => world.tables.character_statuses.filter((s) => s.actor_id === actor && s.ended_at === null && !s.undone);

describe('statuses on characters', () => {
  it("a custom status (B6): a name, What it does and Stacks; kept in the homebrew and offered next time; its effect shows under its name; Undo takes it off", async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Wren. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Wren' });
    expect(await within(card).findByText('No statuses')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Add a status to Wren' }));
    let add = await screen.findByRole('dialog', { name: 'Add a status to Wren' });
    // C2: with no duration chosen, it reads "Until removed" (never "None"); the search never takes focus (A4).
    expect(within(add).getByRole('button', { name: 'Until removed' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(add).queryByRole('button', { name: 'None' })).toBeNull();
    expect(document.activeElement).not.toBe(within(add).getByRole('searchbox'));
    await user.type(within(add).getByRole('searchbox'), 'Muddy boots');
    expect(within(add).getByText('No status called “Muddy boots”. Make it a custom status below.')).toBeTruthy();
    await user.click(within(add).getByRole('button', { name: /Custom status…/ }));
    expect((within(add).getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Muddy boots');
    await user.type(within(add).getByRole('textbox', { name: 'What it does' }), 'Squelches with every step.');
    await user.click(within(add).getByRole('button', { name: 'Stacks' }));
    await user.click(within(add).getByRole('button', { name: 'Add to Wren' }));
    expect(await screen.findByText('Added Muddy boots to Wren')).toBeTruthy();
    expect(statusesOn(t.wren).map((s) => [s.name, s.source, s.condition_id, s.stacking, s.note])).toEqual([['Muddy boots', 'condition', 'muddy-boots', true, 'Squelches with every step.']]);
    // Kept in the campaign's homebrew as a condition.
    const kept = world.tables.library_entries.find((e) => e.kind === 'condition' && e.pack_entry_id === 'muddy-boots');
    expect(kept?.data).toMatchObject({ name: 'Muddy boots', notes: 'Squelches with every step.', stacks: true });
    expect(await within(card).findByText('Squelches with every step.')).toBeTruthy();
    expect(within(card).getByText('Lasts until removed.')).toBeTruthy();
    // Offered next time, with its effect, like a pack condition.
    await user.click(within(card).getByRole('button', { name: 'Add a status to Wren' }));
    add = await screen.findByRole('dialog', { name: 'Add a status to Wren' });
    await user.type(within(add).getByRole('searchbox'), 'muddy');
    expect(await within(add).findByRole('button', { name: 'Add Muddy boots' })).toBeTruthy();
    await user.click(within(add).getByRole('button', { name: 'Cancel' }));
    await user.click(within(card).getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('button', { name: 'Wren, Muddy boots. Details' })).toBeTruthy();
    await user.click(await toastUndo('Added Muddy boots to Wren'));
    await waitFor(() => expect(statusesOn(t.wren)).toEqual([]));
    expect(await screen.findByRole('button', { name: 'Wren. Details' })).toBeTruthy();
  });

  it("a custom status can't take a name the setting has: it says to add it from the list", async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Wren. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Wren' });
    await user.click(within(card).getByRole('button', { name: 'Add a status to Wren' }));
    const add = await screen.findByRole('dialog', { name: 'Add a status to Wren' });
    await user.click(within(add).getByRole('button', { name: /Custom status…/ }));
    await user.click(within(add).getByRole('button', { name: 'Add to Wren' }));
    expect(within(add).getByRole('alert').textContent).toBe('Give the status a name.');
    await user.type(within(add).getByRole('textbox', { name: 'Name' }), 'weary');
    await user.click(within(add).getByRole('button', { name: 'Add to Wren' }));
    expect(within(add).getByRole('alert').textContent).toBe('Weary is in the list already: add it from there.');
    expect(statusesOn(t.wren)).toEqual([]);
  });

  it('a family row opens the pack\'s kinds, each with its effect and Add; the duration chosen first carries over; the card shows the kind\'s name', async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Wren. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Wren' });
    await user.click(within(card).getByRole('button', { name: 'Add a status to Wren' }));
    const add = await screen.findByRole('dialog', { name: 'Add a status to Wren' });
    // The kinds aren't rows of their own on the first screen: one family row stands for them.
    expect(within(add).queryByRole('button', { name: 'Add Reed cut' })).toBeNull();
    await user.click(within(within(add).getByRole('group', { name: 'How long' })).getByRole('button', { name: '1 turn' }));
    await user.click(within(add).getByRole('button', { name: 'Bog rot, 2 kinds' }));
    const kinds = within(add).getByRole('list', { name: 'Kinds of Bog rot' });
    expect(within(kinds).getAllByRole('listitem')).toHaveLength(2);
    expect(within(kinds).getByText('Bleeds a little at every step.')).toBeTruthy();
    await user.click(within(kinds).getByRole('button', { name: 'Add Reed cut' }));
    expect(await screen.findByText('Added Reed cut to Wren')).toBeTruthy();
    expect(statusesOn(t.wren).map((s) => [s.name, s.condition_id, s.total_seconds, s.unit])).toEqual([['Reed cut', 'reed-cut', TURN, 'turn']]);
    expect(await within(card).findByText('Bleeds a little at every step.')).toBeTruthy();
  });

  it('Until rest: the status is kept until they rest, and says so', async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ash. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Ash' });
    await user.click(within(card).getByRole('button', { name: 'Add a status to Ash' }));
    const add = await screen.findByRole('dialog', { name: 'Add a status to Ash' });
    await user.click(within(add).getByRole('button', { name: 'Until rest' }));
    await user.click(within(add).getByRole('button', { name: 'Add Weary' }));
    expect(await within(card).findByText('Ends when they rest.')).toBeTruthy();
    expect(statusesOn(t.ash).map((s) => [s.until_rest, s.ends_at])).toEqual([[true, null]]);
  });

  it('a condition found with the search bar; one that stacks shows ×2 the second time; the GM’s End it now ends it, with Undo', async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    for (const time of [1, 2]) {
      await user.click(await screen.findByRole('button', { name: time === 1 ? 'Wren. Details' : /^Wren, Weary/ }));
      const card = await screen.findByRole('dialog', { name: 'Wren' });
      await user.click(within(card).getByRole('button', { name: 'Add a status to Wren' }));
      const add = await screen.findByRole('dialog', { name: 'Add a status to Wren' });
      await user.type(within(add).getByRole('searchbox'), 'wea');
      // B6: the brief effect under the name in the pop-up.
      expect(within(add).getByText('Weary, stacks')).toBeTruthy();
      expect(within(add).getByText('Slow and sore.')).toBeTruthy();
      await user.click(within(add).getByRole('button', { name: 'Add Weary' }));
      expect(await screen.findByText(time === 1 ? 'Added Weary to Wren' : 'Weary ×2 on Wren')).toBeTruthy();
      await user.click(within(card).getByRole('button', { name: 'Close' }));
    }
    expect(statusesOn(t.wren).map((s) => s.stacks)).toEqual([2]);
    await user.click(await screen.findByRole('button', { name: 'Wren, Weary ×2. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Wren' });
    await user.click(within(card).getByRole('button', { name: /^Weary, 2 stacks/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Weary' });
    // The title is the status's word; whose it is reads on the sheet's first line (Design on #553).
    expect(sheet.querySelector('.status-sheet__line')?.textContent).toBe('Wren');
    expect(within(sheet).getByText('2 stacks')).toBeTruthy();
    expect(within(sheet).getByText("From the setting's conditions")).toBeTruthy();
    // The ring's sheet (plan m5b-creation-retest-3 F): who set it and its newest log line, from its own history;
    // no chevron here (the marching order has no log to open). The GM's line about the time is not shown to the GM.
    expect(await within(sheet).findByText('Set by')).toBeTruthy();
    expect(within(sheet).getByText('You')).toBeTruthy();
    expect(within(sheet).getByText('Log')).toBeTruthy();
    // Source, Set by and Log are field labels, marked as the List row's label variant, so the book's type keeps them at
    // 16 px (the lead's ruling, pq-1 sizes, 2026-11-14).
    for (const word of ['Source', 'Set by', 'Log']) expect(within(sheet).getByText(word).closest('.list-row')?.classList.contains('list-row--label')).toBe(true);
    expect(within(sheet).queryByText('Only the GM changes the time left.')).toBeNull();
    // The GM's End it now ends it at once, with Undo in the toast (no confirm).
    expect(within(sheet).queryByRole('button', { name: 'Remove' })).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'End it now' }));
    expect(statusesOn(t.wren)).toEqual([]);
    await user.click(await toastUndo('Ended Weary on Wren'));
    await waitFor(() => expect(statusesOn(t.wren).map((s) => s.stacks)).toEqual([2]));
  });

  it('levels step up and down in the sheet; down from the first ends it', async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ash. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Ash' });
    await user.click(within(card).getByRole('button', { name: 'Add a status to Ash' }));
    const add = await screen.findByRole('dialog', { name: 'Add a status to Ash' });
    expect(within(add).getByText('Dazed → Reeling → Out cold, 3 levels')).toBeTruthy();
    await user.click(within(add).getByRole('button', { name: 'Add Dazed' }));
    await user.click(await within(card).findByRole('button', { name: /^Dazed/ }));
    let sheet = await screen.findByRole('dialog', { name: 'Dazed' });
    expect(within(sheet).getByText('Dazed, level 1 of 3')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Step up' }));
    expect(await screen.findByText('Ash is Reeling now')).toBeTruthy();
    sheet = await screen.findByRole('dialog', { name: 'Reeling' });
    expect(within(sheet).getByText('Reeling (now)')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Step down' }));
    sheet = await screen.findByRole('dialog', { name: 'Dazed' });
    await user.click(within(sheet).getByRole('button', { name: 'Step down (ends it)' }));
    expect(await screen.findByText('Dazed ended on Ash')).toBeTruthy();
    expect(statusesOn(t.ash)).toEqual([]);
  });

  it("a secret timer: the GM sees the time left; a player sees it active, and their device never gets it", async () => {
    const t = table();
    marching(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Wren. Details' }));
    let card = await screen.findByRole('dialog', { name: 'Wren' });
    await user.click(within(card).getByRole('button', { name: 'Add a status to Wren' }));
    const add = await screen.findByRole('dialog', { name: 'Add a status to Wren' });
    await user.click(within(add).getByRole('button', { name: /Custom status…/ }));
    await user.type(within(add).getByRole('textbox', { name: 'Name' }), 'Fen-sight');
    await user.click(within(add).getByRole('button', { name: 'Other…' }));
    await user.click(within(within(add).getByRole('group', { name: 'Timer' })).getByRole('button', { name: 'Turns' }));
    await user.type(within(add).getByRole('textbox', { name: 'How many turns' }), '3');
    await user.click(within(add).getByRole('switch', { name: /Hide time left/ }));
    await user.click(within(add).getByRole('button', { name: 'Add to Wren' }));
    expect(await within(card).findByText('3 turns left, hidden from players')).toBeTruthy();
    const made = world.tables.character_statuses[0]!;
    expect(made).toMatchObject({ secret: true, ends_at: null, total_seconds: null });
    expect(world.tables.status_secrets).toEqual([expect.objectContaining({ id: made.id, ends_at: 3 * TURN })]);
    cleanup();

    // Sam (Wren's player): the symbol, active, with no time; nothing secret reaches the device.
    marching(t, 'sam');
    await user.click(await screen.findByRole('button', { name: 'Wren, Fen-sight. Details' }));
    card = await screen.findByRole('dialog', { name: 'Wren' });
    expect(await within(card).findByText("Time left is the GM's")).toBeTruthy();
    expect(within(card).getByRole('img', { name: 'Fen-sight, active' })).toBeTruthy();
    expect((await world.db.from('status_secrets').select('*').eq('campaign_id', t.campaign)).data).toEqual([]);
  });

  it("a player has no + Status, even on their own character (C1); Remove stays theirs", async () => {
    const t = table();
    world.signInAs(t.gm);
    await world.db.rpc('add_status', { campaign: t.campaign, actors: [t.wren], status_name: 'Soaked' });
    marching(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Wren, Soaked. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Wren' });
    expect(within(card).queryByRole('button', { name: 'Add a status to Wren' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: /^Soaked/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Soaked' });
    expect(within(sheet).getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it("a player can't change someone else's statuses: no Remove, no + Status", async () => {
    const t = table();
    world.signInAs(t.gm);
    await world.db.rpc('add_status', { campaign: t.campaign, actors: [t.ash], status_name: 'Soaked' });
    marching(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ash, Soaked. Details' }));
    const card = await screen.findByRole('dialog', { name: 'Ash' });
    expect(within(card).queryByRole('button', { name: 'Add a status to Ash' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: /^Soaked/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Soaked' });
    expect(within(sheet).queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});

// Rest (DG5) became the shared rest flow at the M5 gate (B5): src/app/restFlow.test.tsx.
