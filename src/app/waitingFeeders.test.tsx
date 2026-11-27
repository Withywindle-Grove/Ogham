// @vitest-environment jsdom
// The feeders of "Waiting for you" (S8b of docs/plans/dec-9-the-whole-scene.md; st-1, wy-1; page 16, T2, T6b, T8b),
// against the stand-in database: the GM's time strip under the Scene's provider with the panel hosted, as on the GM's
// place page. Invented mode, check, light and characters. In plain words:
//   * a line of the reminder card that comes due is an item of the panel ("Due" inside it), and no card stands
//     outside it;
//   * a light that simply burns out with the move is not an item: the step's toast says so, and the log keeps its line;
//   * the rest due is an item "Rest is due" whose Answer… carries the scroll and quill (ic-4) and opens the rest panel
//     as a sheet; no rest panel stands in the page;
//   * an encounter check's hit is one item, the encounter's one card (sf-4), its Done the page's one accent;
//   * the open item's first answer is the one accent (a check's Hit);
//   * a check with a table and no chance is a roll on its table: one Roll…, the table opened in its pop-up, a tapped
//     row its answer that closes the pop-up, a toast with the row's range that never says "a hit", Undo of both, and the
//     X that records nothing (B9; sf-5, page 44 EN2);
//   * where no panel shows (a town), the strip draws today's card and rest panel, as before.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { openWaiting, waitingTitles } from '../testing/openWaiting.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { SceneTime } from './SceneTime.tsx';
import { SceneWaitingProvider, useWaitingPanel } from './sceneWaiting.tsx';
import { WaitingPanel } from './WaitingForYou.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
});
afterEach(() => cleanup());

const TURN = 600;

/** A creeping mode whose check comes due every turn and whose party rests a turn in every three; Wren's rushlight lit with one turn left. */
async function table({ rollOnTable = false, checkName = 'Encounters in the harbour' }: { rollOnTable?: boolean; checkName?: string } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
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
          procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
          // B9 (p2p-19): with `rollOnTable`, a check with a table and no chance, a roll on the table.
          checks: [
            rollOnTable
              ? { id: 'wander', name: checkName, every: { value: 1, unit: 'turn' }, note: 'Roll d20 for an encounter each turn on the water.', onHit: { tableId: 'harbour-encounters' } }
              : { id: 'wander', name: 'Wandering things', every: { value: 1, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { note: 'Something stirs in the reeds.' } },
          ],
          movement: {},
          rest: { every: { value: 3, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary', note: 'Sit a turn in every three, or grow weary.' },
        },
      ],
    },
  });
  entry('condition', 'weary', 'Weary', { stacks: true, notes: 'Slow and sore.' });
  entry('table', 'harbour-encounters', 'Encounters in the harbour', { die: 'd20', rows: [{ min: 1, max: 10, result: 'Nothing stirs' }, { min: 11, max: 20, result: 'Gulls, mobbing the boat' }] });
  entry('lightType', 'rushlight', 'Rushlight', { duration: 6, unit: 'turn', consumed: true });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.inventory_lines.push({ id: 'line-rushlight', campaign_id: campaign, actor_id: wren, location_id: null, name: 'Rushlight', category: 'light', qty: 1, approval: 'approved', container_line_id: null, item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
  world.tables.character_lights.push({
    id: 'light-wren', actor_id: wren, campaign_id: campaign, line_id: 'line-rushlight', type_id: 'rushlight', name: 'Rushlight', lit_at: 0, burn_seconds: TURN,
    full_seconds: 6 * TURN, warn_seconds: 0, left_seconds: null, consumed: true, fuel_item: null, keep_lit: false, out_at: null, version: 1,
  });
  world.signInAs(gm);
  const session = await world.db.rpc('start_session', { campaign });
  if (session.error) throw new Error(session.error.message);
  const started = await world.db.rpc('start_expedition', { campaign, mode_id: 'creep' });
  if (started.error) throw new Error(started.error.message);
  return { gm, campaign, user: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser };
}

/** The panel, hosted as the GM's place page hosts it. */
function Page() {
  const hosting = useWaitingPanel()?.hosting;
  return <section aria-label="The page">{hosting && <WaitingPanel />}</section>;
}

/** The GM's strip, with the panel (as on the place page) or without it (a town). */
function scene(t: Awaited<ReturnType<typeof table>>, withPanel = true) {
  render(
    <ToastHost>
      <SceneWaitingProvider>
        <SceneTime db={world.db} user={t.user} campaign={{ id: t.campaign, name: 'The Ash Barrows', role: 'gm', line: null }} />
        {withPanel && <Page />}
      </SceneWaitingProvider>
    </ToastHost>,
  );
}

const panel = () => within(screen.getByRole('region', { name: 'Waiting for you' }));
async function nextTurn(user: ReturnType<typeof userEvent.setup>, to: number) {
  await user.click(await screen.findByRole('button', { name: 'Next turn' }));
  await screen.findByRole('heading', { name: new RegExp(`turn ${to}$`) });
}

describe('the feeders of Waiting for you (S8b)', () => {
  // Purpose: a check that comes due is an item of the panel, its card inside it, and no card stands outside it; its
  // Hit, the open item's first answer, is the page's one accent.
  it('puts a due check in the panel, with its Hit the one accent, and no card outside it', async () => {
    const t = await table();
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    const due = within(await panel().findByRole('region', { name: 'Due' }));
    expect(due.getByRole('button', { name: 'Hit, Wandering things' }).className).toContain('button-primary');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    for (const card of document.querySelectorAll('section[aria-label="Due"]')) expect(card.closest('.waiting-card')).toBeTruthy();
  });

  // Purpose (st-1): a light that simply burns out with the move is a toast and a log line, never an item.
  it('says a burnt-out light in the step’s toast and the log, not in the panel', async () => {
    const t = await table();
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    expect(await screen.findByText(/^Turn 2\. Wren's rushlight burnt out\.$/)).toBeTruthy();
    expect(waitingTitles().some((title) => /burnt out/.test(title))).toBe(false);
    // One log line: the burnout is one logged change (its rows, the light and the rushlight spent, share one request).
    expect(new Set(world.tables.events.filter((e) => e.type === 'light.burnOut' && e.level === 'simple').map((e) => e.request_id))).toHaveProperty('size', 1);
  });

  // Purpose (T2, ic-4): the rest due is an item "Rest is due" whose Answer… carries the scroll and quill and opens the
  // rest panel as a sheet, where a tap flips a character's answer; no rest panel stands in the page.
  it('offers the rest as "Rest is due" with Answer… (the scroll and quill), opening the rest panel as a sheet', async () => {
    const t = await table();
    scene(t);
    const user = userEvent.setup();
    for (const to of [2, 3, 4]) await nextTurn(user, to);
    // Wait: the rest's item reaches the panel a read after turn 4's heading, so on a busy machine the walk ran first.
    await within(await screen.findByRole('region', { name: 'Waiting for you' })).findAllByRole('button', { name: 'Answer…, Rest is due' }, { timeout: 5000 });
    await openWaiting(user, 'Rest is due');
    const answer = await panel().findByRole('button', { name: 'Answer…, Rest is due' });
    expect(answer.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['scroll-quill'].d);
    expect(document.querySelector('.rest-panel')).toBeNull();
    await user.click(answer);
    const sheet = within(await screen.findByRole('dialog', { name: 'Rest is due' }));
    const rest = within(sheet.getByRole('region', { name: /^Rest due, 0 of 1 answered$/ }));
    await user.click(rest.getByRole('button', { name: /^Wren: .*Tap to change$/ }));
    expect(await sheet.findByRole('region', { name: 'Rest due, 1 of 1 answered' })).toBeTruthy();
    expect(document.querySelectorAll('.rest-panel')).toHaveLength(1);
    expect(document.querySelector('.rest-panel')!.closest('[role="dialog"]')).toBeTruthy();
  });

  // Purpose (sf-4, F5 a): an encounter check's hit is one item, the encounter's one card, with the check's note for
  // its words and its Done the one accent; the hit's own card is not a second item. Done closes it.
  it('puts a hit in the panel as the encounter’s one card, its Done the one accent', async () => {
    const t = await table();
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    await user.click(within(await panel().findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Hit, Wandering things' }));
    const hit = within(await panel().findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    expect(screen.queryByRole('region', { name: 'Wandering things: hit' })).toBeNull();
    expect(hit.getByText('Something stirs in the reeds.')).toBeTruthy();
    expect(hit.getByRole('button', { name: 'Done' }).className).toContain('button-primary');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    await user.click(hit.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /^Encounter waiting, / })).toBeNull());
  });

  // Purpose (B9; p2p-19; sf-5, page 44 EN2): a check with a table and no chance is a roll on the table: its card has the
  // pack's sentence and one Roll…, the accent, with no Hit, no Miss, no ±1 and no Modifier. Roll… opens the table in a
  // pop-up titled with the table's name ("Roll d20, then tap the row."); a tap on the rolled row records the check's
  // result and the row through today's two commands and closes the pop-up, and the toast names the row's range and
  // never says "a hit": "11–20: Gulls, …", the range, a colon and the row's words, no "Rolled:" (finding 7's form,
  // ruled 2026-11-26). Its Undo takes both back and the check waits again.
  it('a roll on its table: Roll… opens the table in a pop-up; a tapped row is the answer', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    const due = within(await panel().findByRole('region', { name: 'Due' }));
    // The pack's sentence, its die drawn as the die (DiceWords).
    await waitFor(() => expect(document.querySelector('.waiting-card .scene-card__note')?.textContent).toContain('for an encounter each turn on the water.'));
    const enter = due.getByRole('button', { name: 'Roll, Encounters in the harbour' });
    expect(enter.className).toContain('button-primary');
    for (const name of [/^Hit/, /^Miss/, /face/, /Modifier/]) expect(due.queryByRole('button', { name })).toBeNull();
    expect(due.queryByText('Roll the table')).toBeNull();
    await user.click(enter);
    const pop = within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' }));
    expect(pop.getByText('Roll d20, then tap the row.')).toBeTruthy();
    await user.click(pop.getByRole('radio', { name: /Gulls, mobbing the boat/ }));
    await waitFor(() => expect(world.tables.events.some((e) => e.type === 'check.setRoll')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Encounters in the harbour' })).toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'check.record')).toHaveLength(1);
    const toast = await screen.findByText(/^11–20: Gulls, mobbing the boat/);
    expect(toast.textContent).not.toMatch(/hit/i);
    // One encounter, one card (sf-4): the row's words, and the picked line with the table and the row's range.
    const result = within(await panel().findByRole('region', { name: /^Encounter waiting, Encounters in the harbour/ }));
    expect(result.getByText('Gulls, mobbing the boat')).toBeTruthy();
    expect(result.getByText('Encounters in the harbour, 11–20.')).toBeTruthy();
    expect(screen.queryByText(/: hit$/)).toBeNull();
    await user.click((await screen.findAllByRole('button', { name: 'Undo' })).at(-1)!);
    await waitFor(() => expect(world.tables.events.filter((e) => e.type === 'event.undo').length).toBeGreaterThanOrEqual(2));
    expect(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' })).toBeTruthy();
  });

  // Purpose (sf-4; page 44, EN1 A; #126's review, finding 3): a due check that rolls its table is one encounter's card:
  // the crossed swords, the table's name as its title and heading (not the check's name, no "Due now"), Roll… and
  // Dismiss.
  it("a due roll on its table is titled by the table's name, under the crossed swords", async () => {
    const t = await table({ rollOnTable: true, checkName: 'Wandering things' });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    const due = within(await panel().findByRole('region', { name: 'Due' }));
    const open = document.querySelector('.waiting-open') as HTMLElement;
    expect(open.dataset.kind).toBe('encounter');
    expect(open.dataset.title).toBe('Encounters in the harbour');
    expect(open.querySelector('.waiting-open__mark svg.icon--filled path')?.getAttribute('d')).toBe(ICON_SET['crossed-swords'].d);
    expect(due.getByRole('heading', { name: 'Encounters in the harbour' })).toBeTruthy();
    expect(due.queryByText('Due now')).toBeNull();
    expect(due.queryByText('Wandering things')).toBeNull();
    expect(due.getByRole('button', { name: 'Roll, Wandering things' })).toBeTruthy();
    expect(due.getByRole('button', { name: 'Dismiss, Wandering things' })).toBeTruthy();
  });

  // Purpose (sf-5, page 44 EN2; of-19): the pop-up's X closes it with nothing recorded, and the check still waits on its
  // card with Roll….
  it('a roll on its table: the X records nothing and the check waits', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    const pop = await screen.findByRole('dialog', { name: 'Encounters in the harbour' });
    await user.click(within(pop).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Encounters in the harbour' })).toBeNull());
    expect(world.tables.events.some((e) => e.type === 'check.record' || e.type === 'check.setRoll')).toBe(false);
    expect(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' })).toBeTruthy();
  });

  // Purpose (#111's review, finding 2): a tapped row closes the pop-up on the tap, before its commands are saved, and
  // it stays closed when check.record saves nothing.
  it('a roll on its table: the pop-up closes on the tap, before the commands finish, and when nothing is saved', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    const real = world.db.rpc.bind(world.db) as (name: string, args: unknown) => { setHeader(name: string, value: string): unknown; then: PromiseLike<unknown>['then'] };
    let release = () => {};
    const gate = new Promise<void>((done) => (release = done));
    let fail = false;
    const held = vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: unknown) => {
      if (name !== 'record_check') return real(name, args);
      const call = real(name, args);
      const answer = fail ? Promise.resolve({ data: null, error: { message: 'The check could not be saved.' } }) : gate.then(() => call);
      const wrapped = {
        setHeader(header: string, value: string) {
          call.setHeader(header, value);
          return wrapped;
        },
        then: (onDone?: (value: unknown) => unknown, onFail?: (reason: unknown) => unknown) => answer.then(onDone, onFail),
      };
      return wrapped;
    }) as never);
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    let pop = within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' }));
    await user.click(pop.getByRole('radio', { name: /Gulls, mobbing the boat/ }));
    expect(screen.queryByRole('dialog', { name: 'Encounters in the harbour' })).toBeNull();
    expect(world.tables.events.some((e) => e.type === 'check.record' || e.type === 'check.setRoll')).toBe(false);
    release();
    await waitFor(() => expect(world.tables.events.some((e) => e.type === 'check.setRoll')).toBe(true));
    expect(await screen.findByText(/^11–20: Gulls, mobbing the boat/)).toBeTruthy();
    // Undone, the check waits again; this time check.record saves nothing, and the pop-up still closes on the tap.
    await user.click((await screen.findAllByRole('button', { name: 'Undo' })).at(-1)!);
    await waitFor(() => expect(world.tables.events.filter((e) => e.type === 'event.undo').length).toBeGreaterThanOrEqual(2));
    fail = true;
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    pop = within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' }));
    await user.click(pop.getByRole('radio', { name: /Gulls, mobbing the boat/ }));
    expect(screen.queryByRole('dialog', { name: 'Encounters in the harbour' })).toBeNull();
    // The toast names the row that wasn't saved (the pop-up has closed, so the GM can't see it any more).
    expect(await screen.findByText("11–20: Gulls, mobbing the boat wasn't saved. The check could not be saved.")).toBeTruthy();
    expect(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' })).toBeTruthy();
    held.mockRestore();
  });

  // Purpose (#1086's review, finding 1): a check's table opened in its pop-up closes when its line leaves the card
  // unanswered (here the move is undone), so the next time that check comes due its card opens on Roll… again, not
  // straight onto the table (the line's key is the same each period).
  it('a roll on its table left unanswered: its next card opens on Roll… again', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    expect(await screen.findByText('Roll d20, then tap the row.')).toBeTruthy();
    await user.click((await screen.findAllByRole('button', { name: 'Undo' })).at(-1)!);
    await screen.findByRole('heading', { name: /turn 1$/ });
    await waitFor(() => expect(screen.queryByText('Roll d20, then tap the row.')).toBeNull());
    await nextTurn(user, 2);
    expect(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' })).toBeTruthy();
    expect(screen.queryByText('Roll d20, then tap the row.')).toBeNull();
  });

  // Purpose (sf-4; page 44, EN1 A and F): a due roll on its table has "Roll…", the accent, and "Dismiss" beside it;
  // "Dismiss" takes the card away at once with nothing recorded, and the toast's Undo brings it back.
  it('a due check: Dismiss takes it away and Undo brings it back', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    const due = within(await panel().findByRole('region', { name: 'Due' }));
    expect(due.getByRole('button', { name: 'Roll, Encounters in the harbour' }).className).toContain('button-primary');
    const dismiss = due.getByRole('button', { name: 'Dismiss, Encounters in the harbour' });
    expect(dismiss.className).toContain('button-secondary');
    expect(dismiss.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.cancel.d);
    await user.click(dismiss);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Roll, Encounters in the harbour' })).toBeNull());
    expect(world.tables.events.some((e) => e.type === 'check.record' || e.type === 'check.setRoll')).toBe(false);
    const toast = (await screen.findByText('Encounter check dismissed.')).closest('.toast') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' })).toBeTruthy();
  });

  // Purpose (sf-4, sf-5; page 44, EN1 B, EN2 B; #111's finding 1 and review): on the one card, "Change…" opens the
  // table's pop-up with the row picked before ticked and holding the focus; a tap on another row changes the result
  // through check.setRoll alone (no second check.record), the toast names the new row's range, and its Undo puts the
  // first row back. The X changes nothing.
  it('Change… opens the table with the row ticked; another row changes the result, with Undo', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' })).getByRole('radio', { name: /Gulls, mobbing the boat/ }));
    const card = within(await panel().findByRole('region', { name: /^Encounter waiting, .*Gulls, mobbing the boat$/ }));
    expect(card.getByRole('heading', { name: 'An encounter' })).toBeTruthy();
    expect(card.queryByRole('button', { name: 'Start' })).toBeNull();
    // The X: nothing changes.
    await user.click(card.getByRole('button', { name: 'Change…, Encounters in the harbour' }));
    let pop = within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' }));
    const ticked = pop.getByRole('radio', { name: /Gulls, mobbing the boat/ });
    expect(ticked.getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(ticked));
    await user.click(pop.getByRole('button', { name: 'Close' }));
    expect(world.tables.events.filter((e) => e.type === 'check.setRoll')).toHaveLength(1);
    // Another row: check.setRoll alone.
    await user.click(card.getByRole('button', { name: 'Change…, Encounters in the harbour' }));
    pop = within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' }));
    await user.click(pop.getByRole('radio', { name: /Nothing stirs/ }));
    await waitFor(() => expect(world.tables.events.filter((e) => e.type === 'check.setRoll')).toHaveLength(2));
    expect(world.tables.events.filter((e) => e.type === 'check.record')).toHaveLength(1);
    expect(world.tables.check_results.find((r) => !r.undone)).toMatchObject({ roll: '1–10', row_text: 'Encounters in the harbour: Nothing stirs' });
    const toast = (await screen.findByText('1–10: Nothing stirs')).closest('.toast') as HTMLElement;
    expect(await panel().findByText('Encounters in the harbour, 1–10.')).toBeTruthy();
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(await panel().findByText('Encounters in the harbour, 11–20.')).toBeTruthy();
  });

  // Purpose (sf-4, ⚑ 2 ruled: "Done" closes the card): Done takes the one card away, logged, and its Undo brings it
  // back.
  it('Done closes the one card, and Undo brings it back', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' })).getByRole('radio', { name: /Gulls, mobbing the boat/ }));
    const card = within(await panel().findByRole('region', { name: /^Encounter waiting, / }));
    await user.click(card.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /^Encounter waiting, / })).toBeNull());
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'started' });
    const toast = (await screen.findByText('Encounter closed.')).closest('.toast') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(await panel().findByRole('region', { name: /^Encounter waiting, / })).toBeTruthy();
  });

  /** A rolled hit whose words the GM has shown the players: the card and its standing reveal. */
  async function revealedHit(user: ReturnType<typeof userEvent.setup>) {
    await nextTurn(user, 2);
    await user.click(await panel().findByRole('button', { name: 'Roll, Encounters in the harbour' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Encounters in the harbour' })).getByRole('radio', { name: /Gulls, mobbing the boat/ }));
    const card = within(await panel().findByRole('region', { name: /^Encounter waiting, / }));
    await user.click(card.getByRole('button', { name: 'Reveal…' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'An encounter: Reveal to players' })).getByRole('button', { name: 'Show players' }));
    expect(await card.findByRole('button', { name: 'Revealed: take it back' })).toBeTruthy();
    expect(world.tables.check_reveals.filter((r) => !r.taken_back)).toHaveLength(1);
    return card;
  }

  // Purpose (Scene sitting, 27 Nov, "GM's Done ends it"): Done on a card whose words are revealed takes the reveal back
  // too, by the take-back command the "Revealed" tap uses, so no reveal is left standing that the GM can no longer reach;
  // Done's Undo brings back both the card and the reveal, with the same words.
  it('Done on a revealed card takes the reveal back too, and Undo brings back both', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    const card = await revealedHit(user);
    await user.click(card.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /^Encounter waiting, / })).toBeNull());
    await waitFor(() => expect(world.tables.check_reveals.filter((r) => !r.taken_back)).toHaveLength(0));
    expect(world.tables.events.filter((e) => e.type === 'check.takeBackWords' && e.audience === 'gm')).toHaveLength(1);
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'started' });
    const toast = (await screen.findByText('Encounter closed. Taken back from the players.')).closest('.toast') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    const back = within(await panel().findByRole('region', { name: /^Encounter waiting, / }));
    expect(await back.findByRole('button', { name: 'Revealed: take it back' })).toBeTruthy();
    expect(world.tables.check_reveals.filter((r) => !r.taken_back)).toMatchObject([{ words: 'Gulls, mobbing the boat' }]);
  });

  // Purpose (Scene sitting, 27 Nov, "End expedition ends it"): ending the expedition takes back every reveal still
  // standing, each by the take-back command, so nothing carries into the next expedition; End's Undo shows them again.
  it('End expedition takes back every standing reveal, and Undo shows them again', async () => {
    const t = await table({ rollOnTable: true });
    scene(t);
    const user = userEvent.setup();
    await revealedHit(user);
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name: 'End expedition' }));
    await screen.findByRole('region', { name: 'Expedition ended' });
    await waitFor(() => expect(world.tables.check_reveals.filter((r) => !r.taken_back)).toHaveLength(0));
    expect(world.tables.events.filter((e) => e.type === 'check.takeBackWords' && e.audience === 'gm')).toHaveLength(1);
    const toast = (await screen.findByText(/^Expedition ended\./)).closest('.toast') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.check_reveals.filter((r) => !r.taken_back)).toMatchObject([{ words: 'Gulls, mobbing the boat' }]));
    expect(world.tables.expeditions.at(-1)).toMatchObject({ ended_at: null });
  });

  // Purpose: where no panel shows (a town keeps today's screen until 5t), the strip draws today's card, as before.
  it('draws today’s card in the strip where no panel shows', async () => {
    const t = await table();
    scene(t, false);
    const user = userEvent.setup();
    await nextTurn(user, 2);
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Waiting for you' })).toBeNull();
    // Without the panel the burnt-out light stays a line on the card, as before.
    expect(due.getByText(/Rushlight burnt out/i)).toBeTruthy();
  });
});
