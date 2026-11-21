// M5b step 6b: Safe and Hostile places (ruled 2026-10-30, ST2; supabase/migrations/20261104130000_m5b_6b_safe_places.sql).
// Since m8b-0 delivery 5 (ruled 2026-11-06) nothing in the app writes the column and the arrival card is gone; the
// command stays registered for the log, so its rules still hold. TEST project only; invented content.
//   The GM marks a place Safe: one Verbose line; Undo puts the old value back. Anything but safe, hostile or none is
//   refused. A player can't mark a place, and never reads a place's safety (places stay the GM's).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { setPlaceSafety } from '../../src/modules/expedition/placeSafety.ts';
import { loadGroupPlaces } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const eventsOf = async (type: string) =>
  must(await world.admin.from('events').select('id, level, target_table, before, after').eq('campaign_id', world.campaignId).eq('type', type).order('seq'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('Safe and Hostile places (M5b step 6b)', () => {
  it('the GM marks a place Safe (Verbose, undoable); players can neither mark nor read it', async () => {
    const started = await as(world.gm, startExpedition, { campaignId: world.campaignId, mode: 'quay', place: 'Quay Gate' });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const here = (await loadGroupPlaces(asDb(world.gm), world.campaignId, started.value.id))!.get(1)!;
    expect(here.place?.safety).toBeNull();

    const marked = await as(world.gm, setPlaceSafety, { campaignId: world.campaignId, place: here.place!, safety: 'safe' });
    expect(marked.ok).toBe(true);
    const lines = await eventsOf('place.setSafety');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'verbose', target_table: 'places', after: { safety: 'safe' } });

    // A player can't mark it, and can't read it.
    const sneaky = await as(world.playerA, setPlaceSafety, { campaignId: world.campaignId, place: marked.ok ? marked.value : here.place!, safety: 'hostile' });
    expect(sneaky.ok).toBe(false);
    const seen = await world.playerA.db.from('places').select('id, safety').eq('id', here.placeId!);
    expect(seen.data ?? []).toEqual([]);

    // Only safe, hostile or none.
    const odd = await world.admin.from('places').update({ safety: 'cosy' }).eq('id', here.placeId!);
    expect(odd.error).not.toBeNull();

    // Undo puts it back to neither.
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: lines[0]!.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    const after = must(await world.admin.from('places').select('safety').eq('id', here.placeId!).single());
    expect(after.safety).toBeNull();
  });
});
