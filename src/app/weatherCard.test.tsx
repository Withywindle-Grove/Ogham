// @vitest-environment jsdom
// Today's weather (M5b; ruled 2026-10-30: D1, S2-1, A8–A12), clicked through like a person would, against the
// stand-in database. Invented setting rules only.
//   A player sees the weather due on Scene and in the Player tab's notices box, with the die to roll; entering it
//   in either closes both, and everyone sees the result and each tag in plain words.
//   The entrant's toast has Undo, which makes it due again.
//   The result shows at once and stays until tapped (no automatic fold, R3 audit 15); a tap folds it into the icon
//   beside the date, and the icon opens it again.
//   The GM sees that the players roll it and can enter it instead (reading the table), and can change it any time,
//   logged as a correction.
//   Until the season is known, players read "Waiting for the GM to set the season"; the GM's Which season? ends it.
//   With "Weather rolled by: GM", players see who rolls it and get no prompt; the setting sits in Table and players.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetFileLinks } from '../core/files.ts';

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
  vi.useRealTimers();
});

/** A GM, a player with a character, invented fen rules with seasonal weather, and a wading expedition under way. */
async function table(options: { start?: boolean; rolledBy?: 'gm' } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  if (options.rolledBy) Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { ...(world.tables.campaigns.find((c) => c.id === campaign)!.settings as object), weatherRolledBy: options.rolledBy } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    seasons: [{ id: 'spring', name: 'Spring' }, { id: 'summer', name: 'Summer' }],
    weather: {
      tables: { spring: 'spring-sky', summer: 'summer-sky' },
      tags: { wet: { name: 'Wet', note: 'Lighting a campfire is hard' }, mired: { name: 'Mired', budget: -2 } },
    },
    exploration: { modes: [{ id: 'wade', name: 'Wading', step: { value: 1, unit: 'day' }, procedure: [], movement: { kind: 'budget', name: 'Travel points', unit: 'points' } }] },
  });
  entry('table', 'spring-sky', 'Spring sky', { die: 'd6', rows: [{ min: 1, max: 3, result: 'Drizzle', tags: ['wet'] }, { min: 4, max: 6, result: 'Sucking mud', tags: ['wet', 'mired'] }] });
  entry('table', 'summer-sky', 'Summer sky', { die: 'd8', rows: [{ min: 1, max: 8, result: 'Haze' }] });
  entry('calendar', 'reckoning', 'Reckoning of the river towns', {
    months: [
      { name: 'Thawmonth', days: 28, season: 'spring' },
      { name: 'Highsun', days: 31, season: 'summer' },
    ],
    ...(options.start === false ? {} : { defaultStart: { month: 1, day: 1 } }),
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.signInAs(gm);
  await world.db.rpc('start_expedition', { campaign, mode_id: 'wade' }).setHeader('x-grimoire-command', encodeEventTag({ type: 'expedition.start', level: 'simple', requestId: crypto.randomUUID() }));
  return { gm, sam, campaign };
}

async function open(as: string, tab: 'Scene' | 'Player') {
  world.signInAs(as);
  const user = userEvent.setup(vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime.bind(vi) } : {});
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  const nav = await screen.findByRole('navigation', { name: /Main|Campaign sections/ });
  await user.click(within(nav).getByRole('button', { name: tab }));
  return user;
}

const card = () => screen.findByRole('region', { name: /weather/i });
/** The GM's Weather fact (S4), which opens the Weather sheet (S10). */
const weatherFact = async () => within(await screen.findByRole('group', { name: 'Scene facts' })).findByRole('button', { name: /^Weather/ });
/** The GM's Scene with a session running (the facts row comes with the session), the Weather sheet opened from its fact. */
async function openGmSheet(gm: string) {
  const user = await open(gm, 'Scene');
  await user.click(await screen.findByRole('button', { name: 'Start session' }));
  await user.click(await weatherFact());
  return user;
}
const weatherOf = () => world.tables.weather_rolls.filter((w) => !w.undone);

describe("the players' weather roll (M5b)", () => {
  it('a player enters it on Scene: everyone sees the result and each tag in plain words; Undo makes it due again', async () => {
    const { campaign, sam } = await table();
    const user = await open(sam, 'Scene');
    const due = within(await card());
    expect(due.getByText('Weather due')).toBeTruthy();
    await user.type(due.getByLabelText('Roll d6 for the weather'), '5');
    await user.click(due.getByRole('button', { name: 'Enter roll' }));
    const shown = within(await screen.findByRole('region', { name: "Today's weather" }));
    expect(shown.getByText("Today's weather: Sucking mud")).toBeTruthy();
    expect(shown.getByText('Wet, Lighting a campfire is hard')).toBeTruthy();
    expect(shown.getByText('Mired, −2 travel points')).toBeTruthy();
    expect(shown.getByText('Entered by Sam')).toBeTruthy();
    expect(weatherOf()).toMatchObject([{ campaign_id: campaign, result: 'Sucking mud', tags: ['wet', 'mired'], period: 0 }]);
    // Players never get the GM's Change…, and their device never read the weather table.
    expect(shown.queryByRole('button', { name: 'Change…' })).toBeNull();
    expect((await world.db.from('library_entries').select('kind').eq('kind', 'table')).data).toEqual([]);
    // Undo from the toast: the record stays, marked undone, and it's due again.
    // The card's title and the toast now read the same words; the toast is the one inside .toast.
    const toast = (await screen.findAllByText("Today's weather: Sucking mud")).map((el) => el.closest('.toast')).find(Boolean) as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(await within(await card()).findByText('Weather due')).toBeTruthy();
    expect(weatherOf()).toEqual([]);
    expect(world.tables.weather_rolls.map((w) => w.undone)).toEqual([true]);
  });

  it("the same prompt is in the Player tab's notices box; entering there closes it, and Scene shows the result folded by the date", async () => {
    const { sam, gm, campaign } = await table();
    // The players' facts row comes with the session (S15, as the GM's, T3a).
    world.signInAs(gm);
    await world.db.rpc('start_session', { campaign });
    const user = await open(sam, 'Player');
    await user.click(await screen.findByRole('button', { name: '1 notice, open them' }));
    const notices = within(await screen.findByRole('dialog', { name: 'Notices' }));
    await user.type(await notices.findByLabelText('Weather due: roll d6'), '2');
    await user.click(notices.getByRole('button', { name: 'Enter roll' }));
    await waitFor(() => expect(screen.queryByLabelText('Weather due: roll d6')).toBeNull());
    expect(weatherOf()).toMatchObject([{ result: 'Drizzle' }]);
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    // It was in before this screen opened: folded, the Weather fact says it (S15; the icon by the date went with the
    // old head), and the fact opens it.
    const fact = await weatherFact();
    expect(fact.getAttribute('aria-label')).toMatch(/^Weather: Drizzle\./);
    expect(screen.queryByRole('region', { name: "Today's weather" })).toBeNull();
    await user.click(fact);
    expect(within(await screen.findByRole('dialog', { name: /Weather$/ })).getByText(/Lighting a campfire is hard/)).toBeTruthy();
  });

  // The weather result shows at once, with no animation: it stays open past 8 seconds until a tap folds it.
  it('the result shows at once and stays until tapped; the icon opens it again, and new weather opens and stays', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { sam, gm, campaign } = await table();
    // The players' facts row comes with the session (S15, as the GM's, T3a).
    world.signInAs(gm);
    await world.db.rpc('start_session', { campaign });
    const user = await open(sam, 'Scene');
    const due = within(await card());
    await user.type(due.getByLabelText('Roll d6 for the weather'), '1');
    await user.click(due.getByRole('button', { name: 'Enter roll' }));
    expect(await screen.findByRole('region', { name: "Today's weather" })).toBeTruthy();
    // No fold by itself: well past the old 8 seconds, it's still open.
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByRole('region', { name: "Today's weather" })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: "Fold today's weather into the icon by the date" }));
    // Folded, the Weather fact opens it again, in its sheet (S15).
    await user.click(await weatherFact());
    expect(within(await screen.findByRole('dialog', { name: /Weather$/ })).getByText('Drizzle.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    // A new weather (the GM's change) shows at once and stays too.
    world.signInAs(gm);
    const row = weatherOf()[0]!;
    await world.db.rpc('correct_weather', { weather: String(row.id), table_id: 'spring-sky', roll: '6', seen_version: Number(row.version) }).setHeader('x-grimoire-command', encodeEventTag({ type: 'weather.correct', level: 'simple', requestId: crypto.randomUUID(), fiat: true }));
    world.signInAs(sam);
    expect(await screen.findAllByText("Today's weather: Sucking mud", undefined, { timeout: 3000 })).not.toHaveLength(0);
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByRole('region', { name: "Today's weather" })).toBeTruthy();
  });

  // S10 (st-3): the GM's weather is the Weather fact's sheet, the roll entered by a tap on the table's row.
  it('the GM sees that the players roll it, can enter it instead from the table, and can change it later, logged as a correction', async () => {
    const { gm } = await table();
    const user = await openGmSheet(gm);
    const due = within(await screen.findByRole('dialog', { name: /Weather$/ }));
    expect(due.getByText('The players roll it; you can enter it instead.')).toBeTruthy();
    await user.click(due.getByRole('radio', { name: /Drizzle/ }));
    await user.click(await weatherFact());
    const shown = within(await screen.findByRole('dialog', { name: /Weather$/ }));
    expect(shown.getByText('Entered by Priya.')).toBeTruthy();
    expect(shown.getByText('Logged as a correction.')).toBeTruthy();
    await user.click(shown.getByRole('radio', { name: /Sucking mud/ }));
    expect(await screen.findByText("Changed today's weather to Sucking mud")).toBeTruthy();
    expect(weatherOf()).toMatchObject([{ result: 'Sucking mud', corrected_by: gm }]);
    expect(world.tables.events.find((e) => e.type === 'weather.correct')).toMatchObject({ fiat: true, audience: 'all' });
  });

  // Purpose (st-2, the lead's ruling on #873): a paused Scene stays as it was left, so the facts row and its Weather
  // tile stay, and the tile's tap opens the Weather sheet exactly as during play.
  it('while the session is paused, the Weather tile stays and opens the Weather sheet', async () => {
    const { gm } = await table();
    const user = await open(gm, 'Scene');
    await user.click(await screen.findByRole('button', { name: 'Start session' }));
    await weatherFact();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(await screen.findByRole('button', { name: /^End session/ }));
    expect(await screen.findByRole('button', { name: 'Resume session' })).toBeTruthy();
    await user.click(await weatherFact());
    const sheet = within(await screen.findByRole('dialog', { name: /Weather$/ }));
    expect(sheet.getByText('Roll d6, then tap the row.')).toBeTruthy();
  });

  it('until the season is known players read "Waiting for the GM to set the season"; the GM\'s Which season? ends it', async () => {
    const { gm, sam } = await table({ start: false });
    const user = await openGmSheet(gm);
    const waiting = within(await screen.findByRole('dialog', { name: /Weather$/ }));
    expect(waiting.getByText('No season yet: say which season it is, or pick the weather table for today.')).toBeTruthy();
    await user.click(waiting.getByRole('button', { name: 'Which season?' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Which season?' })).getByRole('button', { name: 'Summer' }));
    cleanup();
    forgetCampaignSetting();
    await open(sam, 'Scene');
    expect(within(await card()).getByLabelText('Roll d8 for the weather')).toBeTruthy();
  });

  it("players wait while the season is unknown, in the card and the Player tab's notices box", async () => {
    const { sam } = await table({ start: false });
    const user = await open(sam, 'Player');
    await user.click(await screen.findByRole('button', { name: '1 notice, open them' }));
    expect(within(await screen.findByRole('dialog', { name: 'Notices' })).getByText('Weather: no season set yet.')).toBeTruthy();
  });

  it('with "Weather rolled by: GM", players see who rolls it and get no prompt', async () => {
    const { sam } = await table({ rolledBy: 'gm' });
    await open(sam, 'Scene');
    expect(within(await card()).getByText("The GM rolls today's weather.")).toBeTruthy();
    expect(screen.queryByLabelText('Roll d6 for the weather')).toBeNull();
  });

  it('"Weather rolled by" sits in Table and players of Rules for this campaign, Players by default', async () => {
    const { gm, campaign } = await table();
    const user = await open(gm, 'Scene');
    await user.click(within(screen.getByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: /^Table and players/ }));
    const rule = within(await screen.findByRole('radiogroup', { name: 'Weather rolled by' }));
    expect(rule.getByRole('radio', { name: /^Players/, checked: true })).toBeTruthy();
    await user.click(rule.getByRole('radio', { name: /^GM/ }));
    await waitFor(() => expect((world.tables.campaigns.find((c) => c.id === campaign)!.settings as Record<string, unknown>).weatherRolledBy).toBe('gm'));
  });
});
