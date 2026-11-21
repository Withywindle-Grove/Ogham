// Start expedition at a known place (M5b g2b follow-up; ruled 2026-11-02, gp-5 "any expedition"), on the stand-in
// database (invented places only):
//   Starting an expedition at a place visited before shows the pieces shown at the end of its last visit, in order,
//   and writes one "back at" line of its own (not the start's request), Verbose.
//   Starting at a place never visited shows nothing and writes no "back at" line.
//   Undo of the "back at" line hides those pieces again and leaves the expedition started, the party still there.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { startExpedition } from './play.ts';

const registry = createAppRegistry();

/** An earlier expedition, ended, whose last visit to the Moth Gallery showed the drain then the archway. */
function table() {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.signInAs(gm);
  world.tables.expeditions.push({ id: 'old-trip', campaign_id: campaign, session_id: null, mode: 'dungeon', started_at: 0, ended_at: 3600, who_went: [], summary: null, started_by: gm, undone: false, version: 2 });
  world.tables.places.push({ id: 'moth', campaign_id: campaign, name: 'The Moth Gallery', description: '', version: 1, undone: false });
  world.tables.place_notes.push({ id: 'moth', campaign_id: campaign, traps: '', puzzles: '', encounters: '', treasure: '', doors: '', version: 1 });
  world.tables.group_places.push({ id: 'old-visit', campaign_id: campaign, expedition_id: 'old-trip', group_number: 1, place_id: 'moth', shown: false, moved_on: false, undone: false, created_at: '2026-11-01T12:00:00Z' });
  const add = (id: string, body: string, position: number) =>
    world.tables.place_pieces.push({ id, campaign_id: campaign, place_id: 'moth', kind: 'exit', body, position, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false });
  add('stairs', 'Stairs up, to the north', 0);
  add('arch', 'An archway to the east', 1);
  add('drain', 'A drain gurgles underfoot', 2);
  const show = (id: string, piece: string, at: string) =>
    world.tables.piece_shows.push({ id, campaign_id: campaign, group_place_id: 'old-visit', piece_id: piece, group_number: 1, shown: true, shown_at: at, undone: false });
  show('show-drain', 'drain', '2026-11-01T12:01:00Z');
  show('show-arch', 'arch', '2026-11-01T12:02:00Z');
  const user: CurrentUser = { id: gm, roles: { [campaign]: 'gm' } };
  const start = (place: string) => runCommand(registry, world.db, user, startExpedition, { campaignId: campaign, mode: 'dungeon', place });
  const visitNow = () => world.tables.group_places.find((g) => g.expedition_id !== 'old-trip' && !g.undone && !g.moved_on);
  const shownIn = (visit: string) =>
    world.tables.piece_shows
      .filter((s) => s.group_place_id === visit && s.shown === true && !s.undone)
      .sort((a, b) => String(a.shown_at).localeCompare(String(b.shown_at)))
      .map((s) => s.piece_id);
  const lines = (type: string) => world.tables.events.filter((e) => e.campaign_id === campaign && e.type === type);
  return { world, campaign, user, start, visitNow, shownIn, lines };
}

describe('Start expedition at a known place (gp-5)', () => {
  it('starting at a place visited before shows its last visit’s shown pieces, in order, in one Verbose line of its own', async () => {
    const t = table();
    const started = await t.start('The Moth Gallery');
    expect(started.ok && started.value.backShown).toBe(2);
    const here = t.visitNow()!;
    expect(here.place_id).toBe('moth');
    expect(t.shownIn(String(here.id))).toEqual(['drain', 'arch']);
    const back = t.lines('place.backAt');
    expect(back).toHaveLength(2);
    expect(new Set(back.map((e) => e.request_id)).size).toBe(1);
    expect(new Set(back.map((e) => e.level))).toEqual(new Set(['verbose']));
    expect(t.lines('expedition.start').some((e) => e.request_id === back[0]!.request_id)).toBe(false);
  });

  it('starting at a place never visited shows nothing and writes no "back at" line', async () => {
    const t = table();
    const started = await t.start('The Bone Stair');
    expect(started.ok && started.value.backShown).toBe(0);
    expect(t.shownIn(String(t.visitNow()!.id))).toEqual([]);
    expect(t.lines('place.backAt')).toEqual([]);
  });

  it('Undo of the "back at" line hides them again and leaves the expedition started', async () => {
    const t = table();
    const started = await t.start('The Moth Gallery');
    if (!started.ok) throw new Error(started.message);
    const line = t.lines('place.backAt').at(-1)!;
    const undone = await runCommand(registry, t.world.db, t.user, undoChange, { campaignId: t.campaign, eventId: String(line.id), authorUserId: t.user.id });
    expect(undone.ok).toBe(true);
    const here = t.visitNow()!;
    expect(t.shownIn(String(here.id))).toEqual([]);
    expect(here.place_id).toBe('moth');
    const trip = t.world.tables.expeditions.find((x) => x.id === started.value.id)!;
    expect([trip.undone, trip.ended_at]).toEqual([false, null]);
    // The earlier visit keeps its own record.
    expect(t.shownIn('old-visit')).toEqual(['drain', 'arch']);
  });
});
