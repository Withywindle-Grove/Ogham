// The sun and moon tile's command half (the whole Scene, row S6; ruled 2026-11-14, sm-1): Out and about today and
// Active tonight are one or the other, never both. Through the app's commands against the stand-in database
// (src/testing/fakeDb.ts); the real rules are checked in supabase/tests/m5b-6-0-town-switches.test.ts. Invented names.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { loadTownSwitches, setActiveNight, setOutDay } from './townPlay.ts';

const registry = createAppRegistry();

interface Table {
  world: FakeWorld;
  gm: CurrentUser;
  campaign: string;
}

/** A campaign with a GM (Priya), both switches off. */
function table(): Table {
  const world = createFakeDb();
  const gmId = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Lantern Quay', gmId);
  world.signInAs(gmId);
  return { world, gm: { id: gmId, roles: { [campaign]: 'gm' } }, campaign };
}

const row = (t: Table) => t.world.tables.campaigns.find((c) => c.id === t.campaign)!;
const switches = (t: Table) => ({ out_day: row(t).out_day, active_night: row(t).active_night });
const flip = (t: Table, command: typeof setOutDay | typeof setActiveNight, on: boolean) => runCommand(registry, t.world.db, t.gm, command, { campaignId: t.campaign, on });
const linesOf = (t: Table, type: string) => t.world.tables.events.filter((e) => e.type === type);
const undo = (t: Table, eventId: string) => runCommand(registry, t.world.db, t.gm, undoChange, { campaignId: t.campaign, eventId, authorUserId: t.gm.id });

describe('one or the other (sm-1)', () => {
  // Purpose: lighting the sun puts the moon out, and lighting the moon puts the sun out, in one change.
  it('turning one on turns the other off, as one Simple line', async () => {
    const t = table();
    expect(await flip(t, setActiveNight, true)).toMatchObject({ ok: true });
    expect(await flip(t, setOutDay, true)).toMatchObject({ ok: true });
    expect(switches(t)).toEqual({ out_day: true, active_night: false });
    expect(linesOf(t, 'town.outDay').map((e) => e.level)).toEqual(['simple']);

    expect(await flip(t, setActiveNight, true)).toMatchObject({ ok: true });
    expect(switches(t)).toEqual({ out_day: false, active_night: true });
    expect(linesOf(t, 'town.activeNight')).toHaveLength(2);
  });

  // Purpose: putting the lit half out touches only that half (the other was already off, or is old data left on).
  it('turning one off leaves the other alone', async () => {
    const t = table();
    // Old data: a campaign with both on from before the rule.
    Object.assign(row(t), { out_day: true, active_night: true });
    expect(await flip(t, setOutDay, false)).toMatchObject({ ok: true });
    expect(switches(t)).toEqual({ out_day: false, active_night: true });
    const line = linesOf(t, 'town.outDay').at(-1)!;
    expect(Object.keys(line.after as object)).not.toContain('active_night');
  });

  // Purpose: Undo of a turn-on gives back both halves as they were, the one it lit and the one it put out.
  it('Undo puts both back', async () => {
    const t = table();
    await flip(t, setActiveNight, true);
    await flip(t, setOutDay, true);
    const line = linesOf(t, 'town.outDay').at(-1)!;
    expect(await undo(t, String(line.id))).toMatchObject({ ok: true });
    expect(switches(t)).toEqual({ out_day: false, active_night: true });
  });

  // Purpose: from both off, a turn-on is one plain line with only its own half changed, and its Undo leaves the other off.
  it('a turn-on from both off logs one plain line, and its Undo leaves the other off', async () => {
    const t = table();
    expect(await flip(t, setOutDay, true)).toMatchObject({ ok: true });
    const lines = linesOf(t, 'town.outDay');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'simple', after: { out_day: true } });
    expect(await undo(t, String(lines[0]!.id))).toMatchObject({ ok: true });
    expect(switches(t)).toEqual({ out_day: false, active_night: false });
  });

  // Purpose: a campaign left with both on (from before the rule) reads as both until the GM next lights a half, which clears the other.
  it('a campaign with both on from before reads as both; the next turn-on of either clears the other', async () => {
    const t = table();
    Object.assign(row(t), { out_day: true, active_night: true });
    expect(await loadTownSwitches(t.world.db, t.campaign)).toEqual({ outDay: true, activeNight: true });
    expect(await flip(t, setActiveNight, true)).toMatchObject({ ok: true });
    expect(switches(t)).toEqual({ out_day: false, active_night: true });
  });
});
