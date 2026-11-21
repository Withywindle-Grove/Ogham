// M5 step 6: the GM's reminders and check results (supabase/migrations/20261029180000_m5_reminders.sql). TEST project
// only; invented content.
//   Hidden means hidden: a player never receives a GM-only reminder (row or log line), and never a check result
//   (row or log line) until the campaign goes into Downtime; then the results are revealed. Outsiders read nothing.
//   Only the GM makes or changes reminders and records checks, through the functions or straight to the tables;
//   nobody reveals a result by hand.
//   A reminder counts from the clock when it's made; changing how often, or starting it again, counts from then.
//   Intents: the same request sent twice makes one reminder or one result; a change from an old copy is refused.
//   Undo: a made reminder or result is marked undone (it stays); not while a later change to it stands; a change
//   puts back what it changed. Only a hit rolls a table.
//   A note on a check's log line is hidden like the line, until the campaign goes into Downtime.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, STALE, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addNote } from '../../src/core/notes.ts';
import { undoChange } from '../../src/core/undo.ts';
import { advanceTime, endExpedition, startDowntime, startExpedition, toClock, toExpedition } from '../../src/modules/expedition/play.ts';
import {
  addReminder,
  editReminder,
  loadCheckResults,
  loadReminders,
  loadRevealedResults,
  recordCheck,
  revealCheck,
  setCheckRoll,
  type ReminderFields,
} from '../../src/modules/expedition/reminderPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), await userOf(person), command, input, { requestId });
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign with the world's GM and both players. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Lantern Crossing', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  return campaign.id as string;
}

const fields = (extra: Partial<ReminderFields> = {}): ReminderFields => ({
  label: 'Listen for bog lurkers',
  kind: 'check',
  encounterCheck: true,
  every: { value: 2, unit: 'turn' },
  isPublic: false,
  chance: { die: 'd6', on: [1] },
  tableId: 'bog-things',
  note: null,
  ...extra,
});
const record = { checkKey: 'gm:listen', name: 'Listen for bog lurkers', source: 'gm' as const, outcome: 'hit' as const, modifiers: [] };
const clockOf = async (campaignId: string) => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const linesOf = async (person: Person, campaignId: string, table: string) =>
  must(await person.db.from('events').select('id, type, reveal_at').eq('campaign_id', campaignId).eq('target_table', table).order('seq'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('hidden means hidden', () => {
  it("a player never receives a GM-only reminder, row or log line; a public one they read; an outsider reads neither", async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, addReminder, { campaignId, fields: fields() }));
    await ok(as(world.gm, addReminder, { campaignId, fields: fields({ label: 'Check the lamps', kind: 'reminder', isPublic: true }) }));
    expect((await loadReminders(asDb(world.playerA), campaignId))!.map((r) => r.label)).toEqual(['Check the lamps']);
    expect((await loadReminders(asDb(world.gm), campaignId))!.map((r) => r.label)).toEqual(['Listen for bog lurkers', 'Check the lamps']);
    expect(await linesOf(world.playerA, campaignId, 'reminders')).toHaveLength(1);
    expect(await linesOf(world.gm, campaignId, 'reminders')).toHaveLength(2);
    expect(must(await world.outsider.db.from('reminders').select('id').eq('campaign_id', campaignId))).toEqual([]);
  });

  it('making a public reminder GM-only hides it, and the change is logged for the GM only', async () => {
    const campaignId = await freshTable();
    const made = await ok(as(world.gm, addReminder, { campaignId, fields: fields({ isPublic: true }) }));
    expect(await loadReminders(asDb(world.playerB), campaignId)).toHaveLength(1);
    await ok(as(world.gm, editReminder, { campaignId, reminder: made, changes: { isPublic: false, label: 'Secret listening' } }));
    expect(await loadReminders(asDb(world.playerB), campaignId)).toEqual([]);
    const lines = must(await world.playerB.db.from('events').select('type, after').eq('campaign_id', campaignId).eq('type', 'reminder.edit'));
    expect(lines).toEqual([]);
  });

  it('gate check: players see check results only at Downtime: no row, no log line, until the campaign goes into Downtime', async () => {
    const campaignId = await freshTable();
    const expedition = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    const result = await ok(as(world.gm, recordCheck, { campaignId, record }));
    expect(result).toMatchObject({ outcome: 'hit', expeditionId: expedition.id, revealed: false });
    const rolled = await ok(as(world.gm, setCheckRoll, { campaignId, result, tableId: 'bog-things', roll: '2', rowText: 'Bog things: Bog lurkers' }));

    for (const player of [world.playerA, world.playerB]) {
      expect(await loadCheckResults(asDb(player), campaignId)).toEqual([]);
      expect(await linesOf(player, campaignId, 'check_results')).toEqual([]);
    }
    const gmLines = await linesOf(world.gm, campaignId, 'check_results');
    expect(gmLines.map((l) => [l.type, l.reveal_at])).toEqual([
      ['check.record', 'downtime'],
      ['check.setRoll', 'downtime'],
    ]);

    await ok(as(world.gm, endExpedition, { campaignId, expedition }));
    // Start downtime is its own tap (dt-2, M5b step 6a): what waits for Downtime reaches players then.
    await ok(as(world.gm, startDowntime, { campaignId, refills: {} }));
    const seen = await loadCheckResults(asDb(world.playerA), campaignId);
    expect(seen).toHaveLength(1);
    expect(seen![0]).toMatchObject({ name: 'Listen for bog lurkers', outcome: 'hit', rowText: 'Bog things: Bog lurkers', revealed: true, version: rolled.version + 1 });
    expect((await linesOf(world.playerA, campaignId, 'check_results')).map((l) => l.type)).toEqual(['check.record', 'check.setRoll']);
    expect(await loadRevealedResults(asDb(world.playerB), campaignId)).toHaveLength(1);
    expect(must(await world.outsider.db.from('check_results').select('id').eq('campaign_id', campaignId))).toEqual([]);
  });

  it('a result recorded after that Downtime waits for the next one', async () => {
    const campaignId = await freshTable();
    const first = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, endExpedition, { campaignId, expedition: first }));
    // Start downtime is its own tap (dt-2, M5b step 6a): what waits for Downtime reaches players then.
    await ok(as(world.gm, startDowntime, { campaignId, refills: {} }));
    const second = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, outcome: 'miss' } }));
    expect(await loadCheckResults(asDb(world.playerA), campaignId)).toEqual([]);
    expect(await linesOf(world.playerA, campaignId, 'check_results')).toEqual([]);
    await ok(as(world.gm, endExpedition, { campaignId, expedition: toExpedition(must(await world.admin.from('expeditions').select('*').eq('id', second.id).single())) }));
    // Start downtime is its own tap (dt-2, M5b step 6a): what waits for Downtime reaches players then.
    await ok(as(world.gm, startDowntime, { campaignId, refills: {} }));
    expect(await loadCheckResults(asDb(world.playerA), campaignId)).toHaveLength(1);
  });
});

describe('only the GM', () => {
  it("a player's reminder or result, straight to the table or through the functions, is refused", async () => {
    const campaignId = await freshTable();
    const asPlayer = world.playerA.db;
    expect((await asPlayer.rpc('add_reminder', { campaign: campaignId, label: 'Mine', kind: 'reminder', encounter_check: false, every_value: 1, every_unit: 'turn', is_public: true })).error?.code).toBe('42501');
    expect((await asPlayer.from('reminders').insert({ campaign_id: campaignId, label: 'Mine', every_value: 1, every_unit: 'turn' }).select()).error).not.toBeNull();
    expect((await asPlayer.rpc('record_check', { campaign: campaignId, check_key: 'x', name: 'X', source: 'gm', outcome: 'miss' })).error?.code).toBe('42501');
    expect((await asPlayer.from('check_results').insert({ campaign_id: campaignId, check_key: 'x', name: 'X', outcome: 'miss' }).select()).error).not.toBeNull();
    const made = await ok(as(world.gm, addReminder, { campaignId, fields: fields({ isPublic: true }) }));
    await asPlayer.from('reminders').update({ label: 'Changed by a player' }).eq('id', made.id);
    expect((await loadReminders(asDb(world.gm), campaignId))![0]!.label).toBe('Listen for bog lurkers');
  });

  it('nobody reveals a result by hand, not even the GM: only going into Downtime does', async () => {
    const campaignId = await freshTable();
    // In an adventure (a result recorded in Downtime shows at once).
    await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    const result = await ok(as(world.gm, recordCheck, { campaignId, record }));
    const tried = await world.gm.db.from('check_results').update({ revealed: true }).eq('id', result.id).select();
    expect(tried.error?.message).toBe('Check results are revealed when the campaign goes into Downtime.');
    expect(await loadCheckResults(asDb(world.playerA), campaignId)).toEqual([]);
  });

  it('only a hit rolls a table, and a result once recorded keeps its outcome', async () => {
    const campaignId = await freshTable();
    const miss = await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, outcome: 'miss' } }));
    const refused = await as(world.gm, setCheckRoll, { campaignId, result: miss, tableId: 'bog-things', roll: '2', rowText: 'x' });
    expect(refused).toMatchObject({ ok: false, message: 'Only a hit rolls a table.' });
    const changed = await world.gm.db.from('check_results').update({ outcome: 'hit' }).eq('id', miss.id).select();
    expect(changed.error?.message).toBe("That can't be changed.");
  });
});

describe('reminders on the clock', () => {
  it('counts from the clock when made; a new interval, or starting it again, counts from then', async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 1800 }));
    const made = await ok(as(world.gm, addReminder, { campaignId, fields: fields() }));
    expect(made.anchor).toBe(1800);
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 600 }));
    const stopped = await ok(as(world.gm, editReminder, { campaignId, reminder: made, changes: { active: false } }));
    expect(stopped).toMatchObject({ active: false, anchor: 1800 });
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 600 }));
    const again = await ok(as(world.gm, editReminder, { campaignId, reminder: stopped, changes: { active: true } }));
    expect(again).toMatchObject({ active: true, anchor: 3000 });
  });

  it('a reminder (not a check) keeps no chance, table or encounter mark', async () => {
    const campaignId = await freshTable();
    const made = await ok(as(world.gm, addReminder, { campaignId, fields: fields({ kind: 'reminder' }) }));
    expect(made).toMatchObject({ kind: 'reminder', encounterCheck: false, chance: null, tableId: null });
  });
});

describe('intents', () => {
  it('the same request twice makes one reminder and one result', async () => {
    const campaignId = await freshTable();
    const id = crypto.randomUUID();
    const a = await ok(as(world.gm, addReminder, { campaignId, fields: fields() }, id));
    const b = await ok(as(world.gm, addReminder, { campaignId, fields: fields() }, id));
    expect(b.id).toBe(a.id);
    const rid = crypto.randomUUID();
    const r1 = await ok(as(world.gm, recordCheck, { campaignId, record }, rid));
    const r2 = await ok(as(world.gm, recordCheck, { campaignId, record }, rid));
    expect(r2.id).toBe(r1.id);
    expect(must(await world.admin.from('check_results').select('id').eq('campaign_id', campaignId))).toHaveLength(1);
  });

  it('a change from an old copy is refused, and the newer change stands', async () => {
    const campaignId = await freshTable();
    const made = await ok(as(world.gm, addReminder, { campaignId, fields: fields() }));
    await ok(as(world.gm, editReminder, { campaignId, reminder: made, changes: { label: 'First device' } }));
    const late = await as(world.gm, editReminder, { campaignId, reminder: made, changes: { label: 'Second device' } });
    expect(late).toMatchObject({ ok: false, message: STALE });
    expect((await loadReminders(asDb(world.gm), campaignId))![0]!.label).toBe('First device');
  });
});

describe('undo', () => {
  it('undoing a made reminder or result marks it undone; it stays, and players no longer read it', async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, addReminder, { campaignId, fields: fields({ isPublic: true }) }));
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'reminder.add')));
    expect(must(await world.admin.from('reminders').select('undone').eq('campaign_id', campaignId))).toEqual([{ undone: true }]);
    expect(await loadReminders(asDb(world.playerA), campaignId)).toEqual([]);

    await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, outcome: 'miss' } }));
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'check.record')));
    expect(must(await world.admin.from('check_results').select('undone').eq('campaign_id', campaignId))).toEqual([{ undone: true }]);
  });

  it("a result with its roll entered can't be undone until the roll is; the roll's undo puts back what it changed", async () => {
    const campaignId = await freshTable();
    const result = await ok(as(world.gm, recordCheck, { campaignId, record }));
    await ok(as(world.gm, setCheckRoll, { campaignId, result, tableId: 'bog-things', roll: '5', rowText: 'Bog things: Reed wraith' }));
    const early = await undo(world.gm, campaignId, await latestEvent(campaignId, 'check.record'));
    expect(early).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'check.setRoll')));
    expect(must(await world.admin.from('check_results').select('roll, row_text, undone').eq('id', result.id))).toEqual([{ roll: null, row_text: null, undone: false }]);
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'check.record')));
    expect(must(await world.admin.from('check_results').select('undone').eq('id', result.id))).toEqual([{ undone: true }]);
  });

  it("undoing a reminder's change puts back what it changed, its count included", async () => {
    const campaignId = await freshTable();
    const made = await ok(as(world.gm, addReminder, { campaignId, fields: fields() }));
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 600 }));
    await ok(as(world.gm, editReminder, { campaignId, reminder: made, changes: { every: { value: 3, unit: 'turn' } } }));
    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'reminder.edit')));
    expect((await loadReminders(asDb(world.gm), campaignId))![0]).toMatchObject({ every: { value: 2, unit: 'turn' }, anchor: 0 });
  });
});

describe('open checks, Downtime checks and the GM\'s reveal (rulings 2026-10-29 night, 3 and 5; 20261029200000_m5_check_reveal.sql)', () => {
  const resultsFor = async (person: Person, campaignId: string) => (await loadCheckResults(asDb(person), campaignId))!.map((r) => r.name);
  const recordLines = async (person: Person, campaignId: string) =>
    must(await person.db.from('events').select('id').eq('campaign_id', campaignId).eq('target_table', 'check_results'));

  it('an open check (secret false) shows to players at once, row and log line; a secret one beside it does not', async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    const open = await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, name: 'Open roll', outcome: 'miss', secret: false } }));
    await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, name: 'Secret roll' } }));
    expect(open).toMatchObject({ secret: false, revealed: true });
    expect(await resultsFor(world.playerA, campaignId)).toEqual(['Open roll']);
    expect(await recordLines(world.playerA, campaignId)).toHaveLength(1);
  });

  it('a result recorded while the campaign is in Downtime shows to players at once', async () => {
    const campaignId = await freshTable();
    must(await world.admin.from('campaigns').update({ mode: 'downtime' }).eq('id', campaignId).select());
    await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, name: 'Rumours check' } }));
    expect(await resultsFor(world.playerB, campaignId)).toEqual(['Rumours check']);
    expect(await recordLines(world.playerB, campaignId)).toHaveLength(1);
  });

  it("the GM reveals one secret result by hand: players then read it and all its lines; it's logged; undo hides it again", async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    const result = await ok(as(world.gm, recordCheck, { campaignId, record }));
    await ok(as(world.gm, setCheckRoll, { campaignId, result, tableId: 'bog-things', roll: '2', rowText: 'Bog things: Bog lurkers' }));
    const other = await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, name: 'Still secret' } }));
    expect(await resultsFor(world.playerA, campaignId)).toEqual([]);

    const fresh = (await loadCheckResults(asDb(world.gm), campaignId))!.find((r) => r.id === result.id)!;
    const refused = await as(world.playerA, revealCheck, { campaignId, result: fresh });
    expect(refused.ok).toBe(false);
    expect((await world.playerA.db.rpc('reveal_check', { result: result.id })).error?.code).toBe('42501');
    await ok(as(world.gm, revealCheck, { campaignId, result: fresh }));
    expect(await resultsFor(world.playerA, campaignId)).toEqual(['Listen for bog lurkers']);
    // Its record, its roll and the reveal itself; nothing of the other result.
    expect(await recordLines(world.playerA, campaignId)).toHaveLength(3);
    expect(must(await world.admin.from('events').select('type').eq('target_id', result.id).eq('type', 'check.reveal'))).toHaveLength(1);

    await ok(undo(world.gm, campaignId, await latestEvent(campaignId, 'check.reveal')));
    expect(await resultsFor(world.playerA, campaignId)).toEqual([]);
    expect(await recordLines(world.playerA, campaignId)).toEqual([]);
    expect(other.revealed).toBe(false);
  });
});

describe("a note on a check's log line (fix forward: 20261029190000_m5_note_reveal.sql)", () => {
  it("a player can't read the GM's note on a check line, or its log line, until the campaign goes into Downtime", async () => {
    const campaignId = await freshTable();
    const expedition = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, recordCheck, { campaignId, record }));
    const line = await latestEvent(campaignId, 'check.record');
    const note = await ok(as(world.gm, addNote, { campaignId, text: 'The lurkers are the ones from the lower sluice.', annotatesEventId: line }));
    expect(must(await world.admin.from('notes').select('reveal_at').eq('id', note.id))).toEqual([{ reveal_at: 'downtime' }]);
    const notesFor = async (person: Person) => must(await person.db.from('notes').select('id').eq('campaign_id', campaignId));
    const noteLines = async (person: Person) => must(await person.db.from('events').select('id').eq('campaign_id', campaignId).eq('target_table', 'notes'));
    expect(await notesFor(world.playerA)).toEqual([]);
    expect(await noteLines(world.playerA)).toEqual([]);
    expect(await notesFor(world.gm)).toHaveLength(1);

    await ok(as(world.gm, endExpedition, { campaignId, expedition }));
    // Start downtime is its own tap (dt-2, M5b step 6a): what waits for Downtime reaches players then.
    await ok(as(world.gm, startDowntime, { campaignId, refills: {} }));
    expect(await notesFor(world.playerA)).toHaveLength(1);
    expect(await noteLines(world.playerA)).toHaveLength(1);
    // A note added after the reveal reaches players at once.
    await ok(as(world.gm, addNote, { campaignId, text: 'And they followed the lanterns.', annotatesEventId: line }));
    expect(await notesFor(world.playerB)).toHaveLength(2);
    expect(await noteLines(world.playerB)).toHaveLength(2);
  });

  it('a note on an ordinary line is read as before', async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, addReminder, { campaignId, fields: fields({ isPublic: true }) }));
    await ok(as(world.gm, addNote, { campaignId, text: 'Lamps first.', annotatesEventId: await latestEvent(campaignId, 'reminder.add') }));
    expect(must(await world.playerA.db.from('notes').select('reveal_at').eq('campaign_id', campaignId))).toEqual([{ reveal_at: 'now' }]);
  });
});
