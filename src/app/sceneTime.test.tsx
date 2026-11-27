// @vitest-environment jsdom
// The time strip on Scene (M5 step 5), clicked through like a person would, against the stand-in database.
//   Start session is one tap; End session (⋯) ends it, with Undo.
//   Start expedition is one tap plus a mode; the strip then says "Dungeon · turn 1", and Next turn moves it on.
//   Undo puts the clock back; a long press takes several turns in one step.
//   Advance by… is a normal advance; Set time… is a correction; Downtime's +1 day, +1 week and To day… move the clock.
//   End expedition has no confirm: its summary shows with Undo and Full rest; the full rest gives back the rest and
//   day uses of those who went and shows the setting's healing rule with Heal for each.
//   A player sees the strip read only, and it follows the GM's change without reloading.
//   An advance made from an old copy of the clock is refused and the latest shows.
//   The calendar start (ruled 2026-10-29): "Day N" with a quiet Set date › (GM only) until it's set; a pack's
//   defaultStart (months from 1) prefills it; the first step that needs the season asks "Which season?", and a chip
//   makes the day the advance lands on that season's first day, worked back from the clock (2026-10-30); Not now holds on every GM device
//   until the next session, and the weather then offers a table pick; players see the date; Calendar start sits in
//   the Time and calendar group of Rules for this campaign.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { openWaiting, waitingTitles } from '../testing/openWaiting.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetFileLinks } from '../core/files.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { undoChange } from '../core/undo.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { departModes, startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 2, hp_current: 5, hp_max: 11, classes: [{ classRef: 'lantern-warden', level: 2, xp: 0 }] });
  const clock = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  return { gm, sam, campaign, wren, clock };
}

/** Invented setting rules: a warden whose ward comes back on a rest, and a healing rule. */
function withSetting(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', { healing: 'A night in a safe place heals 1 hit point per level.' });
  entry('class', 'lantern-warden', 'Lantern Warden', {
    abilities: [
      { name: 'Lantern ward', uses: { count: 2, per: 'rest' } },
      { name: 'Fen fury', uses: { count: 1, per: 'fight' } },
    ],
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

const MARSH = { spell: 'marsh-light', level: 1 };
const REED = { spell: 'reed-whisper', level: 1 };
const playOf = (id: string) => world.tables.character_play.find((p) => p.actor_id === id)!;

/**
 * The rest prompt's table (dec-8 piece D): Wren and Ash, both wardens whose ward comes back on a rest and whose Tide
 * call comes back each day; Wren has chosen a new spell for the next rest and cast both of today's, Ash cast one.
 */
function restTable() {
  const { gm, sam, campaign, wren } = table();
  withSetting(campaign, gm);
  const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!.data as { abilities: unknown[] };
  warden.abilities.push({ name: 'Tide call', uses: { count: 1, per: 'day' } });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: sam });
  Object.assign(world.tables.actors.find((a) => a.id === ash)!, { level: 2, classes: [{ classRef: 'lantern-warden', level: 2, xp: 0 }] });
  world.tables.character_play.push(
    { actor_id: wren, campaign_id: campaign, prepared: [MARSH, MARSH], chosen: [REED], spells_cast: { '1:marsh-light': 2 }, uses_spent: { 'Lantern ward': 2, 'Tide call': 1 } },
    { actor_id: ash, campaign_id: campaign, prepared: [REED], chosen: null, spells_cast: { '1:reed-whisper': 1 }, uses_spent: { 'Lantern ward': 1, 'Tide call': 1 } },
  );
  return { gm, campaign, wren, ash };
}

/** Start an expedition, end it and tap Full rest, as the GM. */
async function openRestPrompt(gm: string) {
  const user = await openGmScene(gm);
  // The turn count needs a running session (st-1, st-2).
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  await user.click(await screen.findByRole('button', { name: 'Full rest' }));
  return user;
}

async function openGmScene(gm: string) {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Scene' }));
  // A campaign with no session yet: the band says so (st-2, page 16 T3a).
  await screen.findByRole('heading', { name: 'No session yet' });
  return user;
}

const strip = () => within(screen.getByRole('region', { name: 'Time' }));
/** The Undo on the toast that says this. */
const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const loggedTypes = () => world.tables.events.filter((e) => e.target_table === 'campaign_clocks').map((e) => e.type);

describe('the time strip (M5 step 5)', () => {
  // Purpose (S4, page 16 T5; the lead 2026-11-14): in downtime there is no fact the app can state (it keeps no weather
  // outside an expedition), so no facts row is drawn at all, while "Next day" is the band's one button.
  it('draws no facts row in downtime', async () => {
    const { gm } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    expect(await screen.findByRole('button', { name: 'Next day' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Scene facts' })).toBeNull();
    expect(document.querySelector('.scene-facts')).toBeNull();
  });

  it('Start session is one tap; End session in ⋯ ends it, with Undo', async () => {
    const { gm, campaign } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    // The session line above the heading and the date line (st-1): no clock time, no ", Session 1" suffix.
    expect(await screen.findByText('Session 1.')).toBeTruthy();
    expect(screen.getByText('Day 1')).toBeTruthy();
    expect(screen.getByText('Started session 1')).toBeTruthy();
    expect(world.tables.sessions).toHaveLength(1);
    // Sessions mark play, never the clock.
    expect(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Time options' }));
    // B7: End session says what it does under its label (the words describe the item).
    const end = screen.getByRole('button', { name: 'End session' });
    expect(end.getAttribute('aria-describedby')).toBeTruthy();
    expect(end.textContent).toContain('Stop playing for today; the clock keeps its place');
    await user.click(end);
    const undo = await toastUndo('Ended session 1');
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeTruthy();
    await user.click(undo);
    expect(await screen.findByText('Session 1.')).toBeTruthy();
  });

  // Purpose (st-2, superseding the B7 fold): a session ended leaves the band whole, with Resume session the one accent
  // in Next turn's place and alone there (no Depart while paused, p2p-4); nothing folds (no Show details for the GM),
  // and Resume starts the next session.
  it('after End session nothing folds: Resume session is the accent and stands alone, and Resume starts the next session', async () => {
    const { gm } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await screen.findByText('Started session 1');
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End session' }));
    const resume = await screen.findByRole('button', { name: 'Resume session' });
    expect(resume.className).toContain('button-primary');
    expect(screen.queryByRole('button', { name: 'Show details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Depart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Resume session' }));
    expect(await screen.findByText('Session 2.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resume session' })).toBeNull();
  });

  it('Start expedition is one tap plus a mode; Next turn moves the clock on a turn, and Undo puts it back', async () => {
    const { gm, wren, clock } = table();
    const user = await openGmScene(gm);
    // Next turn and its count need a running session (st-1, st-2), and so does Depart (p2p-4).
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    // The fallbacks, Dungeon (first, chosen once Where? is picked) and Wilderness, then the app's Point to point (B7).
    expect((await departModes(user)).getAllByRole('button').map((b) => b.textContent)).toEqual(['Dungeon', 'Wilderness', 'Point to point']);
    await startExpedition(user);
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeTruthy();
    expect(world.tables.expeditions[0]!.mode).toBe('dungeon');
    // Who went: the approved, active characters, a snapshot (E36).
    expect(world.tables.expeditions[0]!.who_went).toEqual([wren]);
    expect(world.tables.campaigns[0]!.mode).toBe('adventure');

    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeTruthy();
    expect(clock().seconds).toBe(600);
    // Nothing falls due in a fallback mode: the step's toast says so; no line stands on the Scene (sf-3, ⚑ 4).
    expect(screen.queryByText('Next turn, nothing due')).toBeNull();
    expect(loggedTypes()).toEqual(['time.advance']);

    // The strip has no Undo of its own (st-1): the toast of the step reached carries it.
    await user.click(await toastUndo('Turn 2, nothing due.'));
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeTruthy();
    expect(clock().seconds).toBe(0);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  // A6 (M5 gate): tapping Next turn again is how several turns pass; there's no long press and no +N.
  it('holding the main advance does nothing more than a tap: one turn, and no "How many?"', async () => {
    const { gm, clock } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    const next = await screen.findByRole('button', { name: 'Next turn' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.pointerDown(next);
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(next);
    fireEvent.click(next);
    vi.useRealTimers();
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /How many/ })).toBeNull();
    expect(clock().seconds).toBe(600);
  });

  it('Advance by… is a normal advance; its To a time (Set time…, folded in, B12) is logged as a correction', async () => {
    const { gm, clock } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });

    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'Advance by…' }));
    const by = within(screen.getByRole('dialog', { name: 'Advance by…' }));
    await user.click(by.getByRole('button', { name: 'Advance' }));
    expect(by.getByRole('alert').textContent).toBe('Type a whole number above 0, like 40.');
    await user.type(by.getByLabelText('How much'), '40');
    await user.click(by.getByRole('button', { name: 'Advance 40 minutes' }));
    // The date line shows no clock time now (st-1): the clock itself says it moved.
    await waitFor(() => expect(clock().seconds).toBe(2400));

    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(screen.queryByRole('button', { name: 'Set time…' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Advance by…' }));
    const set = within(screen.getByRole('dialog', { name: 'Advance by…' }));
    await user.click(set.getByRole('button', { name: 'To a time' }));
    await user.clear(set.getByLabelText('Hour'));
    await user.type(set.getByLabelText('Hour'), '30');
    await user.click(set.getByRole('button', { name: 'Set the time' }));
    expect(set.getByRole('alert').textContent).toBe('The hour is a whole number from 0 to 23.');
    await user.clear(set.getByLabelText('Hour'));
    await user.type(set.getByLabelText('Hour'), '6');
    // Forwards: the sheet says timers and lights move with the clock, and nothing about going back.
    expect(set.getByText(/Timers and lights move with the clock\./)).toBeTruthy();
    expect(set.queryByText(/stay gone/)).toBeNull();
    await user.click(set.getByRole('button', { name: 'Set the time' }));
    await waitFor(() => expect(clock().seconds).toBe(6 * 3600 + 40 * 60));
    expect(loggedTypes()).toEqual(['time.advanceBy', 'time.set']);
  });

  it('To a time backwards (in Downtime, the only way Advance by… offers) says burnt-out lights and ended statuses stay gone; it is logged Simple and its Undo puts the clock back', async () => {
    const { gm, clock } = table();
    const user = await openGmScene(gm);
    // Downtime's one band button is Next day (st-1), which does what "+1 day" did; it needs a running session.
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    expect(await screen.findByText('Day 2')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'Advance by…' }));
    const set = within(screen.getByRole('dialog', { name: 'Advance by…' }));
    expect(set.queryByRole('button', { name: 'Forward by…' })).toBeNull();
    await user.clear(set.getByLabelText('Day'));
    await user.type(set.getByLabelText('Day'), '1');
    await user.clear(set.getByLabelText('Hour'));
    await user.type(set.getByLabelText('Hour'), '8');
    expect(set.getByText('Burnt-out lights and ended statuses stay gone. Use Undo to reverse a move exactly.')).toBeTruthy();
    await user.click(set.getByRole('button', { name: 'Set the time' }));
    expect(await screen.findByText('Day 1')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'time.set').map((e) => e.level)).toEqual(['simple']);
    await user.click(await toastUndo('Set the time to Day 1, Month 1, 08:00'));
    expect(await screen.findByText('Day 2')).toBeTruthy();
    expect(clock().seconds).toBe(86400);
  });

  // Purpose (st-1): Downtime's Next day (the band's one button, once "+1 day"), and +1 week and To day… (now items in
  // the ⋯ menu) move the clock; To day… only goes forward.
  it("Downtime's Next day, and +1 week and To day… in ⋯, move the clock; To day… only goes forward", async () => {
    const { gm, clock } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    expect(screen.queryByRole('button', { name: '+1 day' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    expect(await screen.findByText('Day 2')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: '+1 week' }));
    expect(await screen.findByText('Day 9')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'To day…' }));
    const to = within(screen.getByRole('dialog', { name: 'To day…' }));
    await user.clear(to.getByLabelText('Day'));
    await user.type(to.getByLabelText('Day'), '3');
    await user.click(to.getByRole('button', { name: 'Go to day 3' }));
    expect(to.getByRole('alert').textContent).toBe("It's day 9 now: pick a later day.");
    await user.clear(to.getByLabelText('Day'));
    await user.type(to.getByLabelText('Day'), '14');
    await user.click(to.getByRole('button', { name: 'Go to day 14' }));
    expect(await screen.findByText('Day 14')).toBeTruthy();
    expect(clock().seconds).toBe(13 * 86400);
    expect(loggedTypes()).toEqual(['time.downtime', 'time.downtime', 'time.downtime']);
  });

  it('End expedition has no confirm: the summary with Undo, then Full rest gives back rest uses and offers Heal', async () => {
    const { gm, campaign, wren } = table();
    withSetting(campaign, gm);
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [], uses_spent: { 'Lantern ward': 2, 'Fen fury': 1 } });
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' });

    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End expedition' }));
    expect(await screen.findByText('Took 10 minutes.')).toBeTruthy();
    // M5b step 6a (dt-2): the party stays in Adventure, in the expedition's mode, with no expedition running.
    expect(screen.getByRole('heading', { name: 'Dungeon' })).toBeTruthy();
    expect(world.tables.campaigns[0]!.mode).toBe('adventure');

    await user.click(screen.getByRole('button', { name: 'Full rest' }));
    // Wren's ward comes back on a rest, so the rest prompt asks first (dec-8 piece D); her mark starts on ✓.
    const prompt = within(await screen.findByRole('dialog', { name: "A night's rest" }));
    expect(prompt.getByRole('switch', { name: 'Wren' }).getAttribute('aria-checked')).toBe('true');
    await user.click(prompt.getByRole('button', { name: 'Apply rest' }));
    expect(await screen.findByText('Rest and day abilities are back.')).toBeTruthy();
    expect(screen.getByText('A night in a safe place heals 1 hit point per level.')).toBeTruthy();
    // The rest use came back; the fight one didn't.
    expect(world.tables.character_play[0]!.uses_spent).toEqual({ 'Fen fury': 1 });

    await user.click(await screen.findByRole('button', { name: 'Heal Wren' }));
    const pad = within(screen.getByRole('dialog', { name: 'Damage or heal' }));
    await user.click(pad.getByRole('button', { name: '+1' }));
    await user.click(pad.getByRole('button', { name: 'Heal 2' }));
    expect(await screen.findByText('Healed 2, HP 7')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === wren)!.hp_current).toBe(7);
  });

  // Purpose (dec-8 piece D, mp-5): Full rest asks who gets their magic back; a caster left on ✓ gets the spells chosen
  // for the next rest ready with no casts and their once-a-rest uses back, in one log line for the spells; a caster the
  // GM switches off keeps today's spells, casts and once-a-rest uses as they were, but still gets once-a-day uses back
  // (#790 review: a UI test for the day uses of someone switched off).
  it("Full rest asks who gets their magic back: on makes the chosen spells ready; off leaves a caster's spells but gives day uses", async () => {
    const { gm, wren, ash } = restTable();
    const user = await openRestPrompt(gm);

    const prompt = within(await screen.findByRole('dialog', { name: "A night's rest" }));
    expect(prompt.getByText('Who gets their magic back?')).toBeTruthy();
    expect(prompt.getByText('Once-a-day uses come back to everyone with the new day.')).toBeTruthy();
    expect(prompt.getAllByText('Lantern ward, 2 a rest')).toHaveLength(2);
    await user.click(prompt.getByRole('switch', { name: 'Ash' }));
    expect(prompt.getByRole('switch', { name: 'Ash' }).getAttribute('aria-checked')).toBe('false');
    expect(prompt.getByRole('switch', { name: 'Wren' }).getAttribute('aria-checked')).toBe('true');
    await user.click(prompt.getByRole('button', { name: 'Apply rest' }));
    // mm-8: the line names who was left out.
    await screen.findByText('Rest and day abilities are back, except for Ash.');

    await waitFor(() => expect(playOf(wren).prepared).toEqual([REED]));
    expect(playOf(wren)).toMatchObject({ chosen: null, spells_cast: {}, uses_spent: {} });
    expect(playOf(ash)).toMatchObject({ prepared: [REED], chosen: null, spells_cast: { '1:reed-whisper': 1 }, uses_spent: { 'Lantern ward': 1 } });
    expect(world.tables.events.filter((e) => e.type === 'character.setSpells')).toHaveLength(1);
  });

  // Purpose (#790 review, item 1): a change to a caster's spells made while the sheet is open (here a new choice for
  // the next rest, as a player's Prepare would make it) is what Apply rest makes ready, not the copy read at Full rest.
  it('Apply rest reads the characters again: a choice made while the sheet was open is the one made ready', async () => {
    const { gm, wren } = restTable();
    const user = await openRestPrompt(gm);
    const prompt = within(await screen.findByRole('dialog', { name: "A night's rest" }));
    playOf(wren).chosen = [MARSH];
    await user.click(prompt.getByRole('button', { name: 'Apply rest' }));
    await screen.findByText('Rest and day abilities are back.');
    await waitFor(() => expect(playOf(wren).prepared).toEqual([MARSH]));
    expect(playOf(wren)).toMatchObject({ chosen: null, spells_cast: {} });
  });

  // Purpose (#790 review, item 6): when the full rest is refused, no caster's spells are written and the summary
  // doesn't claim a rest.
  it('a refused full rest writes no spells', async () => {
    const { gm, wren } = restTable();
    const user = await openRestPrompt(gm);
    const prompt = within(await screen.findByRole('dialog', { name: "A night's rest" }));
    // Another device gave the full rest meanwhile: this one is refused.
    world.tables.expeditions[0]!.summary = { ...((world.tables.expeditions[0]!.summary as Record<string, unknown> | null) ?? {}), fullRest: true };
    await user.click(prompt.getByRole('button', { name: 'Apply rest' }));
    expect(await screen.findByText('The party has had its full rest.')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'character.setSpells')).toHaveLength(0);
    expect(playOf(wren)).toMatchObject({ prepared: [MARSH, MARSH], chosen: [REED] });
    expect(screen.queryByText(/Rest and day abilities are back/)).toBeNull();
  });

  // Purpose (#790 review, item 4): when the characters can't be read, Full rest says so and applies nothing, rather
  // than giving the old rest without its prompt.
  it("Full rest says so when it can't read who went, and applies nothing", async () => {
    const { gm, wren } = restTable();
    const user = await openGmScene(gm);
    // The turn count needs a running session (st-1, st-2).
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End expedition' }));
    const full = await screen.findByRole('button', { name: 'Full rest' });
    const from = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { select: (c: string) => unknown };
      if (table !== 'character_play') return query;
      const select = query.select.bind(query);
      query.select = (c: string) => (c.startsWith('actor_id, prepared') ? { in: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) } : select(c));
      return query;
    }) as typeof world.db.from);
    await user.click(full);
    expect(await screen.findByText("Couldn't read who went. Check your connection and try again.")).toBeTruthy();
    vi.restoreAllMocks();
    expect(screen.queryByRole('dialog', { name: "A night's rest" })).toBeNull();
    expect(world.tables.expeditions[0]!.summary).not.toMatchObject({ fullRest: true });
    expect(playOf(wren).uses_spent).toEqual({ 'Lantern ward': 2, 'Tide call': 1 });
  });

  // Purpose: with nobody who went having magic or a once-a-rest power, Full rest applies at once, as before (D23).
  it('Full rest with no caster and no once-a-rest power asks nothing', async () => {
    const { gm } = table();
    const user = await openGmScene(gm);
    // The turn count needs a running session (st-1, st-2).
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End expedition' }));
    await user.click(await screen.findByRole('button', { name: 'Full rest' }));
    expect(await screen.findByText('Rest and day abilities are back.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: "A night's rest" })).toBeNull();
  });

  it('End expedition undoes from its summary: the expedition is under way again', async () => {
    const { gm } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End expedition' }));
    const summary = await screen.findByText('Expedition ended');
    await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Undo ending the expedition' }));
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeTruthy();
    expect(world.tables.expeditions[0]!.ended_at).toBeNull();
    expect(world.tables.campaigns[0]!.mode).toBe('adventure');
  });

  it('starting an expedition undoes from its toast: the record stays, marked undone', async () => {
    const { gm } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(await toastUndo('Started an expedition: Dungeon, The Mustering Field'));
    expect(await screen.findByRole('heading', { name: 'Downtime' })).toBeTruthy();
    expect(world.tables.expeditions).toHaveLength(1);
    expect(world.tables.expeditions[0]!.undone).toBe(true);
  });

  it("a player sees the strip read only, and it follows the GM's turn without reloading", async () => {
    const { gm, sam, campaign, clock } = table();
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    // The players' top is the GM's band (S15): before the first session its heading says so (T3a).
    expect(await screen.findByRole('heading', { name: 'No session yet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Depart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Time options' })).toBeNull();

    // The GM, on another device: an expedition, then a turn.
    world.signInAs(gm);
    const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
    // The band counts turns while a session runs (st-2, S15): the GM starts one first.
    await world.db.rpc('start_session', { campaign });
    await world.db.rpc('start_expedition', { campaign, mode_id: 'dungeon' }).setHeader('x-grimoire-command', tag('expedition.start'));
    await world.db.rpc('advance_clock', { campaign, by_seconds: 600, seen_version: clock().version as number }).setHeader('x-grimoire-command', tag('time.advance'));
    world.signInAs(sam);
    expect(await screen.findByRole('heading', { name: 'Dungeon, turn 2' }, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next turn' })).toBeNull();
  });

  it('an advance from an old copy of the clock is refused, and the latest shows', async () => {
    const { gm, clock } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    // Another device moved it on meanwhile (quietly, as far as this screen knows).
    Object.assign(clock(), { seconds: 1200, version: 5 });
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    expect(await screen.findByText("That's changed since. Here's the latest.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'The Mustering Field, turn 3' })).toBeTruthy());
    expect(clock().seconds).toBe(1200);
  });
});

// fix-toast-undo-stale-lines: a toast is made during its advance, before that advance's lines are kept as "the last
// advance's", so its Undo must take off the card what its own advance put there, not what the screen held when drawn.
// Purpose: on the compact strip, the toast's Undo after an advance takes that advance's line off the shared card
// and leaves the line an earlier advance put there.
it("the compact strip's toast Undo takes this advance's line off the card and keeps the earlier advance's", async () => {
  const { gm, campaign, clock } = table();
  // Invented setting rules: a creeping turn mode with two wandering checks, one every 2 turns and one every 3.
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [
          {
            id: 'creep',
            name: 'Creeping',
            step: { value: 1, unit: 'turn' },
            procedure: [
              { id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' },
              { id: 'drip', name: 'Dripping things', icon: 'monster', kind: 'check', checkId: 'drip' },
            ],
            checks: [
              { id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } },
              { id: 'drip', name: 'Dripping things', every: { value: 3, unit: 'turn' }, chance: { die: 'd6', on: [1] } },
            ],
          },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const sections = () => within(screen.getByRole('navigation', { name: 'Campaign sections' }));
  const user = await openGmScene(gm);
  // The turn count needs a running session (st-1, st-2).
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(sections().getByRole('button', { name: 'Players' }));
  const nextTurn = async () => user.click(await within(await screen.findByRole('region', { name: 'Time' })).findByRole('button', { name: 'Next turn' }));
  await nextTurn();
  await waitFor(() => expect(clock().seconds).toBe(600));
  // Turn 2 brings the every-2 check; turn 3 the every-3 check.
  await nextTurn();
  await waitFor(() => expect(clock().seconds).toBe(1200));
  await nextTurn();
  await waitFor(() => expect(clock().seconds).toBe(1800));
  await user.click(await toastUndo('Next turn, 1 thing on the card'));
  await waitFor(() => expect(clock().seconds).toBe(1200));
  await user.click(sections().getByRole('button', { name: 'Scene' }));
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' });
  const due = within(screen.getByRole('region', { name: 'Due' }));
  expect(due.queryByRole('button', { name: 'Hit, Dripping things' })).toBeNull();
  expect(due.getByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
});

// Purpose: in town (no expedition), the step's toast Undo puts the clock back and takes nothing off the card,
// because the step put nothing there; the line an earlier advance left on the card stays.
it("the town step's toast Undo puts the clock back and leaves the card's earlier line alone", async () => {
  const { gm, campaign, clock } = table();
  // The GM's own wandering check, every 2 turns (a GM's reminder stays on the card when the expedition ends).
  world.signInAs(gm);
  await world.db
    .rpc('add_reminder', { campaign, label: 'Wandering things', kind: 'check', encounter_check: true, every_value: 2, every_unit: 'turn', is_public: false, chance: { die: 'd6', on: [1] } })
    .setHeader('x-grimoire-command', encodeEventTag({ type: 'reminder.add', level: 'simple', requestId: crypto.randomUUID() }));
  const user = await openGmScene(gm);
  // The turn count needs a running session (st-1, st-2).
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(1200));
  const due = () => within(screen.getByRole('region', { name: 'Due' }));
  expect(await due().findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  // In town, the GM's check from the last advance is still on the card.
  expect(await due().findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  // The mode's step moves the clock, with a toast whose Undo puts it back.
  await user.click(await screen.findByRole('button', { name: 'Advance time' }));
  await waitFor(() => expect(clock().seconds).toBe(1800));
  // The toast says the time it moved to, as the strip's clock does.
  const toast = (await screen.findByText('Day 1, Month 1, 00:30', { selector: '.toast__text' })).closest('.toast') as HTMLElement;
  await user.click(within(toast).getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(clock().seconds).toBe(1200));
  expect(screen.queryByRole('button', { name: 'Hit, Wandering things' })).not.toBeNull();
});

// Purpose: End expedition takes no GM line off the card: the expedition's lines leave with it, and the GM's own
// reminder an earlier advance brought stays; End's own toast (S19) carries its Undo.
it("after End expedition the GM's reminder stays on the card, and End's toast Undo brings the expedition back", async () => {
  const { gm, campaign, clock } = table();
  // The GM's own wandering check, every 2 turns (a GM's reminder stays on the card when the expedition ends).
  world.signInAs(gm);
  await world.db
    .rpc('add_reminder', { campaign, label: 'Wandering things', kind: 'check', encounter_check: true, every_value: 2, every_unit: 'turn', is_public: false, chance: { die: 'd6', on: [1] } })
    .setHeader('x-grimoire-command', encodeEventTag({ type: 'reminder.add', level: 'simple', requestId: crypto.randomUUID() }));
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(1200));
  const due = () => within(screen.getByRole('region', { name: 'Due' }));
  expect(await due().findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  expect(await due().findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  // S19 (T11): End expedition has its own toast now, which takes the second turn's ("Turn 3.") place, so that turn's
  // undo is no longer one tap away after the end (the town step's toast undo is the test above). End's toast Undo
  // brings the expedition back with the clock where it was.
  await user.click(await toastUndo('Expedition ended. Took 20 minutes.'));
  await waitFor(() => expect(world.tables.expeditions.at(-1)!.ended_at).toBeNull());
  expect(clock().seconds).toBe(1200);
});

// Purpose: after End expedition the card says nothing about the expedition's last turn: no "<title>, nothing due"
// line once the summary closes, nor after a Next turn in town (T11, ap-11, the lead's rule, 2026-11-14).
it('after End expedition, and after a town Next turn, the card shows no "nothing due" line about the last turn', async () => {
  const { gm, campaign, clock } = table();
  // Invented setting rules: a creeping turn mode whose wandering check falls every 2 turns.
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [
          {
            id: 'creep',
            name: 'Creeping',
            step: { value: 1, unit: 'turn' },
            procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
            checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } }],
          },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  // The first turn brings nothing: its toast says so, and no line stands on the Scene (sf-3, ⚑ 4).
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  expect(await screen.findByText('Turn 2, nothing due.')).toBeTruthy();
  expect(screen.queryByText(/, nothing due$/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByText(/, nothing due$/)).toBeNull());
  // In town, the mode's step moves the clock; the card still says nothing about the expedition's last turn.
  await user.click(await screen.findByRole('button', { name: 'Advance time' }));
  await waitFor(() => expect(clock().seconds).toBe(1200));
  await waitFor(() => expect(screen.queryByText(/, nothing due$/)).toBeNull());
});

// Purpose: after End expedition and its Undo (the expedition back in play), the card shows no "<title>, nothing due"
// line: the last turn did bring something, which End expedition took off the card (#836 review).
it("after End expedition and its Undo, the card shows no 'nothing due' line", async () => {
  const { gm, campaign, clock } = table();
  // Invented setting rules: a creeping turn mode whose wandering check falls every 2 turns.
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [
          {
            id: 'creep',
            name: 'Creeping',
            step: { value: 1, unit: 'turn' },
            procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
            checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } }],
          },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  // The second turn brings the wandering check onto the card.
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  expect(await screen.findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Undo ending the expedition' }));
  expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' })).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(/, nothing due$/)).toBeNull());
});

// Purpose: once a new expedition starts after an end, before its first advance the Scene shows no "<title>, nothing
// due" line about the last expedition's turn (#836 second review; since sf-3, ⚑ 4, no such line stands during an
// expedition at all).
it("after End expedition after a turn that brought nothing, a new expedition before its first advance shows no '<title>, nothing due' line", async () => {
  const { gm, clock } = table();
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  // Nothing falls due in a fallback mode: the step's toast says so (sf-3, ⚑ 4: no line stands on the Scene).
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  expect(await screen.findByText('Turn 2, nothing due.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  // A new expedition, before its first advance.
  await startExpedition(user);
  expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeTruthy();
  // During an expedition no "<title>, nothing due" line stands on the Scene (sf-3, ⚑ 4; it was on main before).
  expect(screen.queryByText(/, nothing due$/)).toBeNull();
});

// Purpose: after End expedition, a town Next turn, then a new expedition, before the new expedition's first advance
// the Scene shows no "<title>, nothing due" line (#836 third review; sf-3, ⚑ 4: none stands during an expedition).
it("after End expedition, a town Next turn, then a new expedition, the Scene shows no '<title>, nothing due' line", async () => {
  const { gm, campaign, clock } = table();
  // Invented setting rules: a creeping turn mode whose wandering check falls every 2 turns.
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [
          {
            id: 'creep',
            name: 'Creeping',
            step: { value: 1, unit: 'turn' },
            procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
            checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } }],
          },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  // The second turn brings the wandering check onto the card.
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  expect(await screen.findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  // In town, the mode's step moves the clock.
  await user.click(await screen.findByRole('button', { name: 'Advance time' }));
  await waitFor(() => expect(clock().seconds).toBe(1800));
  // A new expedition, before its first advance.
  await startExpedition(user);
  expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeTruthy();
  // During an expedition no "<title>, nothing due" line stands on the Scene (sf-3, ⚑ 4; it was on main before).
  expect(screen.queryByText(/, nothing due$/)).toBeNull();
});

// Still-works guards for #836 (they pass before and after it): End expedition changes nothing on the card but the
// stale "<title>, nothing due" line while an expedition stays ended (T11, ap-11).

// Purpose: after End expedition with a GM line still on the card, the card's heading reads "Due now", as before.
it('after End expedition with a GM line on the card, the card heading still reads "Due now"', async () => {
  const { gm, campaign, clock } = table();
  // The GM's own wandering check, every 2 turns (a GM's reminder stays on the card when the expedition ends).
  world.signInAs(gm);
  await world.db
    .rpc('add_reminder', { campaign, label: 'Wandering things', kind: 'check', encounter_check: true, every_value: 2, every_unit: 'turn', is_public: false, chance: { die: 'd6', on: [1] } })
    .setHeader('x-grimoire-command', encodeEventTag({ type: 'reminder.add', level: 'simple', requestId: crypto.randomUUID() }));
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(1200));
  const due = () => within(screen.getByRole('region', { name: 'Due' }));
  expect(await due().findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  expect(due().getByRole('heading', { name: 'Due now' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  expect(await due().findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  expect(due().getByRole('heading', { name: 'Due now' })).toBeTruthy();
});

// Purpose: after Undo of End expedition, following a turn that brought nothing, the expedition is back in play and the
// Scene shows no "<title>, nothing due" line, as during any expedition (sf-3, ⚑ 4).
it("after Undo of End expedition after a turn that brought nothing, the Scene shows no '<title>, nothing due' line", async () => {
  const { gm, clock } = table();
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  // Nothing falls due in a fallback mode: the step's toast says so (sf-3, ⚑ 4: no line stands on the Scene).
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  expect(await screen.findByText('Turn 2, nothing due.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Undo ending the expedition' }));
  expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' })).toBeTruthy();
  // During an expedition no "<title>, nothing due" line stands on the Scene (sf-3, ⚑ 4; it was on main before).
  expect(screen.queryByText(/, nothing due$/)).toBeNull();
});

// Purpose: End expedition undone another way (the log's Undo) after a turn that brought nothing puts the expedition
// back in play, with no "<title>, nothing due" line on the Scene, as during any expedition (sf-3, ⚑ 4).
it('End expedition undone from the log after a turn that brought nothing: no nothing-due line, as before the end', async () => {
  const { gm, campaign, clock } = table();
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  // A turn that brings nothing: its toast says so (sf-3, ⚑ 4).
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  expect(await screen.findByText('Turn 2, nothing due.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  await screen.findByText('Expedition ended');
  // The log's Undo of the end: the same undo command, run outside the summary.
  const end = [...world.tables.events].reverse().find((e) => e.type === 'expedition.end')!;
  const done = await runCommand(createAppRegistry(), world.db, { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser, undoChange, { campaignId: campaign, eventId: end.id as string, authorUserId: gm });
  expect(done.ok).toBe(true);
  expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' }, { timeout: 3000 })).toBeTruthy();
  // During an expedition no "<title>, nothing due" line stands on the Scene (sf-3, ⚑ 4; it was on main before).
  expect(screen.queryByText(/, nothing due$/)).toBeNull();
});

// Purpose: after a last turn that brought lines, a new expedition before its first advance shows no "nothing due"
// line, as before.
it("after End expedition after a turn that brought lines, a new expedition before its first advance shows no 'nothing due' line", async () => {
  const { gm, campaign, clock } = table();
  // Invented setting rules: a creeping turn mode whose wandering check falls every 2 turns.
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [
          {
            id: 'creep',
            name: 'Creeping',
            step: { value: 1, unit: 'turn' },
            procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
            checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } }],
          },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const user = await openGmScene(gm);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await waitFor(() => expect(clock().seconds).toBe(600));
  // The second turn brings the wandering check onto the card.
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  expect(await screen.findByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(screen.getByRole('button', { name: 'End expedition' }));
  const summary = await screen.findByText('Expedition ended');
  await user.click(within(summary.closest<HTMLElement>('.end-card')!).getByRole('button', { name: 'Done' }));
  await startExpedition(user);
  expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' })).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(/, nothing due$/)).toBeNull());
});

/** Invented setting rules with a calendar and a day-by-day mode whose sky roll reads a table by season. */
function withCalendar(campaign: string, gm: string, defaultStart?: { month: number; day: number }) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    seasons: [{ id: 'spring', name: 'Spring' }, { id: 'summer', name: 'Summer' }],
    exploration: {
      modes: [
        {
          id: 'wade',
          name: 'Wading',
          step: { value: 1, unit: 'day' },
          procedure: [{ id: 'sky', name: 'Sky', icon: 'weather', kind: 'roll', tableBySeason: { spring: 'spring-sky', summer: 'summer-sky' } }],
        },
      ],
    },
  });
  entry('table', 'spring-sky', 'Spring sky', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Drizzle' }] });
  entry('table', 'summer-sky', 'Summer sky', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Haze' }] });
  entry('calendar', 'reckoning', 'Reckoning of the river towns', {
    months: [
      { name: 'Thawmonth', days: 28, season: 'spring' },
      { name: 'Reedmonth', days: 30, season: 'spring' },
      { name: 'Highsun', days: 31, season: 'summer' },
    ],
    ...(defaultStart ? { defaultStart } : {}),
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

describe('the calendar start (ruled 2026-10-29)', () => {
  const settingsOf = (campaign: string) => world.tables.campaigns.find((c) => c.id === campaign)!.settings as Record<string, unknown>;

  // Purpose (st-2): until it is set the date line reads "Day N" and is itself the tap ("Day 1. Set the date", no
  // "Set date ›" link); the first step needing the season asks "Which season?", and a chip sets the start.
  it('until it is set the date line reads "Day N. Set the date"; the first step needing the season asks "Which season?", and a chip sets the start', async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm);
    const user = await openGmScene(gm);
    expect(await strip().findByRole('button', { name: 'Day 1. Set the date' })).toBeTruthy();
    expect(strip().queryByRole('button', { name: 'Set date ›' })).toBeNull();
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    const ask = within(await screen.findByRole('dialog', { name: 'Which season?' }));
    expect(ask.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Spring', 'Summer', 'Not now']);
    await user.click(ask.getByRole('button', { name: 'Summer' }));
    // The day the advance lands on (day 2 of the clock) is the season's first day, so the start is the day before.
    await waitFor(() => expect(settingsOf(campaign).calendarStart).toEqual({ month: 2, day: 30 }));
    expect(await strip().findByText(/^1 Highsun, summer$/)).toBeTruthy();
    expect(strip().queryByRole('button', { name: /Set the date/ })).toBeNull();
    // The step ran with the season: the sky roll reads the summer table.
    await user.click(await screen.findByRole('button', { name: 'Enter roll, Weather' }));
    // The Weather sheet (S10) draws the table the roll reads, to tap its row.
    expect(within(await screen.findByRole('dialog', { name: /Weather$/ })).getByRole('group', { name: 'Summer sky' })).toBeTruthy();
  });

  // Purpose (st-2): Not now goes on without a season, and the date line (still "Day N. Set the date") sets the date by hand.
  it('Not now goes on without a season, and the date line still offers "Set the date", which sets the date by hand', async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm);
    const user = await openGmScene(gm);
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    // Wait for the band to settle on the new expedition (its Next day button is replaced while it loads).
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which season?' })).getByRole('button', { name: 'Not now' }));
    expect(await strip().findByText('Day 2')).toBeTruthy();
    // Not asked again on this device.
    await user.click(strip().getByRole('button', { name: 'Next day' }));
    expect(await strip().findByText('Day 3')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Which season?' })).toBeNull();
    await user.click(strip().getByRole('button', { name: 'Day 3. Set the date' }));
    // Set the date (S10, T6): the month is a field that opens the sheet of months.
    const form = within(await screen.findByRole('dialog', { name: /Set the date$/ }));
    await user.click(form.getByRole('button', { name: /^Month: / }));
    await user.click(within(await screen.findByRole('dialog', { name: /Month$/ })).getByRole('radio', { name: /^Reedmonth/ }));
    await user.clear(form.getByLabelText('Day'));
    await user.type(form.getByLabelText('Day'), '31');
    await user.click(form.getByRole('button', { name: 'Set the date' }));
    expect(form.getByRole('alert').textContent).toBe('Reedmonth has days 1 to 30.');
    await user.clear(form.getByLabelText('Day'));
    await user.type(form.getByLabelText('Day'), '10');
    await user.click(form.getByRole('button', { name: 'Set the date' }));
    expect(await strip().findByText(/^12 Reedmonth, spring$/i)).toBeTruthy();
    expect(world.tables.events.some((e) => e.type === 'campaign.update' && e.level === 'simple')).toBe(true);
  });

  // Purpose: asked during an advance, "Which season?" makes the day the advance lands on (the day whose steps run)
  // the season's first day, not the day the clock showed before the advance (ruled 2026-10-30).
  it('"Which season?" during an advance makes the day it lands on the first day of the chosen season (ruled 2026-10-30)', async () => {
    const { gm, campaign, clock } = table();
    withCalendar(campaign, gm);
    // Ten days have passed on the clock before the question comes.
    Object.assign(clock(), { seconds: 10 * 86400 });
    const user = await openGmScene(gm);
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    // Wait for the band to settle on the new expedition (its Next day button is replaced while it loads).
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which season?' })).getByRole('button', { name: 'Summer' }));
    // Next day lands on day 12 of the clock: that is 1 Highsun, so the start is eleven days earlier, 20 Reedmonth.
    await waitFor(() => expect(settingsOf(campaign).calendarStart).toEqual({ month: 2, day: 20 }));
    // The step's toast says the start first ("Today is 1 Highsun (summer). …"), so its Undo stays reachable (#807 review).
    const said = await screen.findByText(/^Today is 1 Highsun \(summer\)\./);
    // After the advance the strip reads the season's first day, not its second.
    expect(await strip().findByText(/^1 Highsun, summer$/)).toBeTruthy();
    // Its one Undo takes back both: the step, then the calendar start.
    await user.click(within(said.closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(settingsOf(campaign)?.calendarStart).toBeUndefined());
    expect(clock().seconds).toBe(10 * 86400);
  });

  it('"Not now" holds on every GM device until the next session, and is logged Verbose; the next session asks again (ruled 2026-10-30)', async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm);
    let user = await openGmScene(gm);
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    // Wait for the band to settle on the new expedition (its Next day button is replaced while it loads).
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which season?' })).getByRole('button', { name: 'Not now' }));
    expect(await strip().findByText('Day 2')).toBeTruthy();
    expect(strip().getByText('Session 1.')).toBeTruthy();
    const row = world.tables.campaigns.find((c) => c.id === campaign)!;
    await waitFor(() => expect(row.season_not_now_at).toBeTruthy());
    expect(world.tables.events.filter((e) => e.type === 'calendar.seasonNotNow').map((e) => e.level)).toEqual(['verbose']);
    // Said a moment ago (the stand-in's clock can't tell two taps in the same millisecond apart).
    world.tables.sessions[0]!.started_at = new Date(Date.now() - 60_000).toISOString();
    row.season_not_now_at = new Date(Date.now() - 30_000).toISOString();

    // Another GM device: it doesn't ask either.
    cleanup();
    forgetCampaignSetting();
    user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Scene' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, day 2' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    expect(await strip().findByText('Day 3')).toBeTruthy();
    expect(strip().getByText('Session 1.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Which season?' })).toBeNull();

    // The next session asks again.
    await user.click(strip().getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End session' }));
    await user.click(await strip().findByRole('button', { name: 'Resume session' }));
    await strip().findByText('Session 2.');
    await user.click(strip().getByRole('button', { name: 'Next day' }));
    expect(await screen.findByRole('dialog', { name: 'Which season?' })).toBeTruthy();
  });

  // Purpose (S8b, T2; S10): the weather's roll is an item of "Waiting for you", "Weather: to roll", and its line opens
  // the Weather sheet.
  it('puts the weather to roll in Waiting for you as "Weather: to roll", opening the Weather sheet', async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm);
    const user = await openGmScene(gm);
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which season?' })).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(waitingTitles()).toContain('Weather: to roll'));
    await openWaiting(user, 'Weather: to roll');
    expect(document.querySelector('.waiting-open')!.getAttribute('data-kind')).toBe('weather');
    await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Enter roll, Weather' }));
    expect(await screen.findByRole('dialog', { name: /Weather$/ })).toBeTruthy();
  });

  it('without a season, the weather step offers the setting\'s weather tables to pick from (ruled 2026-10-30)', async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm);
    const user = await openGmScene(gm);
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    // Wait for the band to settle on the new expedition (its Next day button is replaced while it loads).
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which season?' })).getByRole('button', { name: 'Not now' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByText('No season yet: pick the weather table.')).toBeTruthy();
    // The weather line opens the Weather sheet (S10): the row the GM taps there is entered as today's weather.
    await user.click(due.getByRole('button', { name: 'Enter roll, Weather' }));
    // The weather card and its table dialog are one sheet now (S10): its words offer Which season? too.
    const pick = within(await screen.findByRole('dialog', { name: /Weather$/ }));
    expect(pick.getByText('No season yet: say which season it is, or pick the weather table for today.')).toBeTruthy();
    const which = within(pick.getByRole('group', { name: 'Which table' }));
    expect(which.getAllByRole('button').map((b) => b.textContent)).toEqual(['Spring sky', 'Summer sky']);
    await user.click(which.getByRole('button', { name: 'Summer sky' }));
    expect(pick.getByRole('group', { name: 'Summer sky' })).toBeTruthy();
  });

  it('players see the date and season on their strip once a start is known (05, S17-11; ruled 2026-10-30)', async () => {
    const { gm, sam, campaign } = table();
    withCalendar(campaign, gm, { month: 2, day: 14 });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    // The players' band's date line (S15, frame TB): the date and its season; never the tap that sets it.
    expect(await strip().findByText('14 Reedmonth, spring')).toBeTruthy();
    expect(strip().queryByRole('button', { name: 'Set date ›' })).toBeNull();
    expect(strip().queryByRole('button', { name: /Set the date/ })).toBeNull();
    // The calendar came through the members' reading, not the setting rules a player can't read.
    expect((await world.db.from('library_entries').select('kind').eq('kind', 'calendar')).data).toEqual([]);
  });

  it('Calendar start sits in the Time and calendar group of Rules for this campaign (ruled 2026-10-30)', async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm);
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Rules' }));
    const group = await screen.findByRole('button', { name: /^Time and calendar, Starts at 06:00 \(the default\), Calendar start not set/ });
    expect(screen.queryByRole('button', { name: /^Calendar start/ })).toBeNull();
    await user.click(group);
    await user.selectOptions(screen.getByLabelText('Month'), 'Highsun (summer)');
    await user.clear(screen.getByLabelText('Day'));
    await user.type(screen.getByLabelText('Day'), '3');
    await user.click(screen.getByRole('button', { name: 'Set the date' }));
    await waitFor(() => expect(settingsOf(campaign).calendarStart).toEqual({ month: 3, day: 3 }));
    expect(await screen.findByRole('button', { name: /^Time and calendar, Starts at 06:00 \(the default\), Calendar starts 3 Highsun/ })).toBeTruthy();
  });

  it("a pack's defaultStart (months counted from 1) prefills the start: the strip shows the date, with no Set date ›", async () => {
    const { gm, campaign } = table();
    withCalendar(campaign, gm, { month: 2, day: 14 });
    const user = await openGmScene(gm);
    expect(await strip().findByText(/^14 Reedmonth, spring$/i)).toBeTruthy();
    // The date is known, so the date line is not the calendar start's tap: the tap offers only the first day's start time.
    await user.click(strip().getByRole('button', { name: /^14 Reedmonth, spring/i }));
    // Set the date (S10) asks only what isn't known: the hour, not the day and month.
    const sheet = within(await screen.findByRole('dialog', { name: /Set the date$/ }));
    expect(sheet.getByLabelText('Hour')).toBeTruthy();
    expect(sheet.queryByLabelText('Day')).toBeNull();
  });

  // Purpose (S10, st-3, T6): Set the date is one sheet for the day, the month and the hour play starts; the month is a
  // field that opens the calendar's months in order, a tap picks one and closes; the sheet's one accent is its "Set the
  // date"; saving the date and the hour together gives one toast whose Undo puts back both.
  it('Set the date asks the day, the month from a sheet of months, and the hour; one accent; one Undo puts back both', async () => {
    const { gm, campaign, clock } = table();
    withCalendar(campaign, gm);
    const user = await openGmScene(gm);
    await user.click(await strip().findByRole('button', { name: 'Day 1. Set the date' }));
    const form = within(await screen.findByRole('dialog', { name: /Set the date$/ }));
    expect(form.getByLabelText('Day')).toBeTruthy();
    expect(form.getByLabelText('Hour')).toBeTruthy();
    expect(form.getAllByRole('button').filter((b) => b.classList.contains('button-primary')).map((b) => b.textContent)).toEqual(['Set the date']);
    await user.click(form.getByRole('button', { name: 'Month: Thawmonth. Change' }));
    const months = within(await screen.findByRole('dialog', { name: /Month$/ }));
    expect(months.getAllByRole('radio').map((r) => r.textContent)).toEqual([expect.stringMatching(/^Thawmonth/), expect.stringMatching(/^Reedmonth/), expect.stringMatching(/^Highsun/)]);
    await user.click(months.getByRole('radio', { name: /^Highsun/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Month$/ })).toBeNull());
    expect(form.getByRole('button', { name: 'Month: Highsun. Change' })).toBeTruthy();
    await user.clear(form.getByLabelText('Day'));
    await user.type(form.getByLabelText('Day'), '3');
    await user.clear(form.getByLabelText('Hour'));
    await user.type(form.getByLabelText('Hour'), '7');
    await user.click(form.getByRole('button', { name: 'Set the date' }));
    await waitFor(() => expect(settingsOf(campaign).calendarStart).toEqual({ month: 3, day: 3 }));
    expect(settingsOf(campaign).startTime).toEqual({ hour: 7, minute: 0 });
    expect(clock().seconds).toBe(7 * 3600);
    await user.click(await toastUndo('The calendar starts on 3 Highsun; the first day starts at 07:00'));
    await waitFor(() => expect(settingsOf(campaign)?.calendarStart).toBeUndefined());
    await waitFor(() => expect(clock().seconds).toBe(0));
  });
});

// The first day's start time (B13; g1's scope check, ruled 2026-11-01, option A): the GM sets it in Rules for this
// campaign; it moves a clock that hasn't moved yet (Day 1, no expedition, no advances), logged; once the clock has
// moved, it only shows, and the time changes with Advance by… → To a time. No display offset.
describe('the start time (B13, ruled 2026-11-01)', () => {
  const settingsOf = (campaign: string) => world.tables.campaigns.find((c) => c.id === campaign)!.settings as Record<string, unknown>;

  async function openTimeGroup(gm: string) {
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: /^Time and calendar, Starts at 06:00 \(the default\)$/ }));
    return user;
  }

  it('without a calendar the Time and calendar group still shows, offering the default 06:00; setting it moves the unmoved clock there, in one Simple log line', async () => {
    const { gm, campaign, clock } = table();
    const user = await openTimeGroup(gm);
    expect(screen.queryByRole('heading', { name: 'Calendar start' })).toBeNull();
    expect((screen.getByLabelText('Hour') as HTMLInputElement).value).toBe('6');
    await user.clear(screen.getByLabelText('Hour'));
    await user.type(screen.getByLabelText('Hour'), '7');
    await user.clear(screen.getByLabelText('Minute'));
    await user.type(screen.getByLabelText('Minute'), '30');
    await user.click(screen.getByRole('button', { name: 'Set start time' }));
    await waitFor(() => expect(clock().seconds).toBe(7 * 3600 + 30 * 60));
    expect(settingsOf(campaign).startTime).toEqual({ hour: 7, minute: 30 });
    expect(await screen.findByRole('button', { name: /^Time and calendar, Starts at 07:30$/ })).toBeTruthy();
    // One change: the setting and the clock under the one command, logged Simple.
    const logged = world.tables.events.filter((e) => e.type === 'time.start');
    expect(logged.map((e) => e.target_table).sort()).toEqual(['campaign_clocks', 'campaigns']);
    expect(logged.every((e) => e.level === 'simple')).toBe(true);
  });

  // The scope check (ruled 2026-11-01, A): the GM's strip offers a quiet Set start time › while the clock hasn't moved.
  // Purpose (st-2, superseding the quiet "Set start time ›" link): with no calendar, while the clock hasn't moved the
  // date line "Day 1. Set the date" is itself the tap that opens the same start-time form and command, with Undo; it
  // goes once the clock moves.
  it("the GM's date line offers the start time while the clock hasn't moved: the same form and command, with Undo; it goes once the clock moves", async () => {
    const { gm, campaign, clock } = table();
    const user = await openGmScene(gm);
    expect(strip().queryByRole('button', { name: 'Set start time ›' })).toBeNull();
    await user.click(await strip().findByRole('button', { name: 'Day 1. Set the date' }));
    const form = within(await screen.findByRole('dialog', { name: /Set the date$/ }));
    expect((form.getByLabelText('Hour') as HTMLInputElement).value).toBe('6');
    await user.clear(form.getByLabelText('Minute'));
    await user.type(form.getByLabelText('Minute'), '30');
    await user.click(form.getByRole('button', { name: 'Set the date' }));
    await waitFor(() => expect(clock().seconds).toBe(6 * 3600 + 30 * 60));
    expect(settingsOf(campaign).startTime).toEqual({ hour: 6, minute: 30 });
    expect(world.tables.events.filter((e) => e.type === 'time.start').map((e) => e.target_table).sort()).toEqual(['campaign_clocks', 'campaigns']);
    // Undo from the toast puts the clock back.
    await user.click(await toastUndo('The first day starts at 06:30'));
    await waitFor(() => expect(clock().seconds).toBe(0));
    // Once the clock moves, the tap goes.
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(clock().seconds).toBe(86400));
    await waitFor(() => expect(strip().queryByRole('button', { name: /Set the date/ })).toBeNull());
  });

  // Purpose (#873's review): with no start time saved, the sheet shows the default 06:00 while the clock stands at
  // 00:00; saving the sheet untouched saves that hour and puts the clock there.
  it('Set the date saved untouched, with no start time saved, puts the clock at the default 06:00', async () => {
    const { gm, campaign, clock } = table();
    const user = await openGmScene(gm);
    await user.click(await strip().findByRole('button', { name: 'Day 1. Set the date' }));
    const form = within(await screen.findByRole('dialog', { name: /Set the date$/ }));
    expect((form.getByLabelText('Hour') as HTMLInputElement).value).toBe('6');
    await user.click(form.getByRole('button', { name: 'Set the date' }));
    await waitFor(() => expect(clock().seconds).toBe(6 * 3600));
    expect(settingsOf(campaign).startTime).toEqual({ hour: 6, minute: 0 });
  });

  it("players never see Set start time ›", async () => {
    const { sam } = table();
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    expect(await screen.findByRole('heading', { name: 'No session yet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set start time ›' })).toBeNull();
  });

  it('says what is wrong with a time that does not fit the day, and moves nothing', async () => {
    const { gm, clock } = table();
    const user = await openTimeGroup(gm);
    await user.clear(screen.getByLabelText('Hour'));
    await user.type(screen.getByLabelText('Hour'), '24');
    await user.click(screen.getByRole('button', { name: 'Set start time' }));
    expect(await screen.findByText('The hour is a whole number from 0 to 23.')).toBeTruthy();
    expect(clock().seconds).toBe(0);
  });

  it('once the clock has moved (an expedition started), the start time only shows and points to Advance by… → To a time', async () => {
    const { gm, campaign } = table();
    const user = await openGmScene(gm);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    cleanup();
    await openTimeGroup(gm);
    expect(await screen.findByText('The first day started at 06:00.')).toBeTruthy();
    expect(screen.getByText(/To change the time, use Advance by… → To a time on Scene\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set start time' })).toBeNull();
    expect(screen.queryByLabelText('Hour')).toBeNull();
    expect(settingsOf(campaign)?.startTime).toBeUndefined();

  });

  it('an advance of the clock in Downtime counts as a move too, and its undo makes the clock unmoved again', async () => {
    const { gm, clock } = table();
    const user = await openGmScene(gm);
    await user.click(strip().getByRole('button', { name: 'Start session' }));
    await user.click(await strip().findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(clock().seconds).toBe(86400));
    // The strip has no Undo of its own (st-1): the toast of the day passed carries it.
    await user.click(await toastUndo('1 day passed'));
    await waitFor(() => expect(clock().seconds).toBe(0));
    cleanup();
    await openTimeGroup(gm);
    expect(await screen.findByRole('button', { name: 'Set start time' })).toBeTruthy();
  });
});
