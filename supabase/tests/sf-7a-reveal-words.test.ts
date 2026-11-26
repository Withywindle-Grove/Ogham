// What a reveal stores, and what players read (Scene feedback sf-7a, docs/plans/dec-scene-feedback.md; the critique's
// finding 1 on page 44, "Preview, then send"; sf-20, sf-22; supabase/migrations/20261126200000_sf_7a_reveal_words.sql).
// TEST project only; invented content. Written in a cloud session, where database tests can't run against Supabase:
// the migration and each rule below were rehearsed in a local Postgres with every migration applied; CI's database job
// is the first real run of this file.
//   Purpose (hidden means hidden, hard rule 5):
//   1. A player reads the words the GM confirmed and when, and no other column: the answer has three columns.
//   2. A player cannot read the check's result, its row text or its roll through the reveal: not by a direct read of
//      the reveal's table or of the check's, and not by the log. The players' line holds the words they were shown
//      and nothing of the check (sf-20): every log row a player may read is searched. The GM's line is the GM's alone.
//   3. A reveal does not set the result's `revealed`: at the next Downtime the result's own lines open as before
//      (sf-22), and the reveal's GM line and row still don't.
//   4. A reveal taken back is no longer in a player's answer; the row stays, marked. The players' line of the showing
//      keeps the words they were shown; the take-back's line holds none.
//   5. A player of another campaign, and someone in none, get nothing.
//   6. A player cannot write a reveal: not through the functions, not through the table. Nor does the GM through the table.
//   7. One reveal stands for a hit: the same request sent twice makes one; other words are refused until it is taken back.
//   8. The log's Undo is refused on a reveal's line (taking back is its own command), and changes nothing.
//   9. A reveal whose check result was undone since is no longer in a player's answer (Francis, 2026-11-26: "They
//      disappear"); the players' log keeps its line, and still nothing of the check.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { endExpedition, startDowntime, startExpedition } from '../../src/modules/expedition/play.ts';
import {
  loadCheckResults,
  loadCheckReveals,
  loadRevealedWords,
  recordCheck,
  setCheckRoll,
  showCheckWords,
  takeBackCheckWords,
  type CheckResult,
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

const WORDS = 'Two pale shapes rise from the reeds.';
// The book's row as check.setRoll keeps it: the table, then the row, with a count and a stat line players never get.
const ROW = 'Bog things: 2 Bog lurkers (HP 9 each)';
const record = { checkKey: 'gm:listen', name: 'Listen at the sluice', source: 'gm' as const, outcome: 'hit' as const, modifiers: [] };

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

/** A secret hit with its row picked, out on an expedition: the encounter the GM is about to show. */
async function hitOnExpedition(campaignId: string) {
  const expedition = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
  const result = await ok(as(world.gm, recordCheck, { campaignId, record }));
  const hit: CheckResult = await ok(as(world.gm, setCheckRoll, { campaignId, result, tableId: 'bog-things', roll: '2', rowText: ROW }));
  return { hit, expedition };
}
const freshHit = async (campaignId: string) => (await hitOnExpedition(campaignId)).hit;

/** Every log line this person may read in the campaign, as one string, to search for what must not be there. */
const everyLine = async (person: Person, campaignId: string) =>
  JSON.stringify(must(await person.db.from('events').select('*').eq('campaign_id', campaignId)));
const revealLines = async (person: Person, campaignId: string) =>
  must(await person.db.from('events').select('type, audience, after, target_id').eq('campaign_id', campaignId).eq('target_table', 'check_reveals').order('seq')) as {
    type: string;
    audience: string;
    after: Record<string, unknown>;
    target_id: string;
  }[];
const denied = (result: { error: { code?: string } | null }) => result.error?.code === '42501';

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('what a reveal stores, and what players read (sf-7a)', () => {
  it('a player reads the words the GM confirmed and when, and no other column', async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const before = Date.now();
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: `  ${WORDS}  ` }));
    expect(reveal).toMatchObject({ campaignId, checkResultId: hit.id, words: WORDS, takenBack: false });

    // The database's own answer, before the app reads it: three columns and no other.
    const answer = must(await world.playerA.db.rpc('revealed_words', { campaign: campaignId })) as Record<string, unknown>[];
    expect(answer).toHaveLength(1);
    expect(Object.keys(answer[0]!).sort()).toEqual(['id', 'shown_at', 'words']);
    expect(answer[0]).toMatchObject({ id: reveal.id, words: WORDS });
    expect(Date.parse(String(answer[0]!.shown_at))).toBeGreaterThan(before - 60_000);
    // Through the app's loader, for both players; the GM reads the same words too.
    expect((await loadRevealedWords(asDb(world.playerB), campaignId))!.map((r) => r.words)).toEqual([WORDS]);
    expect((await loadRevealedWords(asDb(world.gm), campaignId))!.map((r) => r.words)).toEqual([WORDS]);
  });

  it("a player can't read the check's result, its row or its roll through the reveal: not directly, not by the log", async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));

    // Directly: no row of the reveal's table (it names the hit), and no check result.
    expect(must(await world.playerA.db.from('check_reveals').select('*').eq('campaign_id', campaignId))).toEqual([]);
    expect(must(await world.playerA.db.from('check_reveals').select('check_result_id').eq('id', reveal.id))).toEqual([]);
    expect(await loadCheckReveals(asDb(world.playerA), campaignId)).toEqual([]);
    expect(must(await world.playerA.db.from('check_results').select('*').eq('campaign_id', campaignId))).toEqual([]);
    expect(must(await world.playerA.db.from('check_results').select('row_text, roll, table_id').eq('id', hit.id))).toEqual([]);
    expect(await loadCheckResults(asDb(world.playerA), campaignId)).toEqual([]);

    // By the log: one line of the reveal, which holds the words they were shown and which reveal, and no more (sf-20).
    const mine = await revealLines(world.playerA, campaignId);
    expect(mine).toEqual([{ type: 'check.showWords', audience: 'all', after: { shown: true, words: WORDS }, target_id: reveal.id }]);
    // Every log row a player may read, searched: the words are on that one line and no other, and nothing of the check
    // (the hit, the row as written, the table, the creature, the stat line, the check's name) is on any.
    const rows = must(await world.playerA.db.from('events').select('*').eq('campaign_id', campaignId)) as Record<string, unknown>[];
    expect(rows.filter((row) => JSON.stringify(row).includes(WORDS)).map((row) => [row.target_table, row.target_id, row.audience])).toEqual([['check_reveals', reveal.id, 'all']]);
    const everything = await everyLine(world.playerA, campaignId);
    for (const hidden of [hit.id, ROW, 'bog-things', 'Bog lurkers', 'HP 9', record.name]) expect(everything).not.toContain(hidden);
    // The check's own lines are still not theirs.
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', campaignId).eq('target_table', 'check_results'))).toEqual([]);

    // The GM reads both lines of the one action: their own names the hit and the row as it was.
    const gmLines = await revealLines(world.gm, campaignId);
    expect(gmLines.map((l) => [l.type, l.audience])).toEqual([
      ['check.showWords', 'gm'],
      ['check.showWords', 'all'],
    ]);
    expect(gmLines[0]!.after).toEqual({ words: WORDS, check_result_id: hit.id, row: ROW });
    expect((await loadCheckReveals(asDb(world.gm), campaignId))!.map((r) => [r.checkResultId, r.words])).toEqual([[hit.id, WORDS]]);
  });

  it("a reveal doesn't reveal the result: its own lines open at the next Downtime (sf-22), the reveal's GM line and row never", async () => {
    const campaignId = await freshTable();
    const { hit, expedition } = await hitOnExpedition(campaignId);
    await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));
    expect(must(await world.admin.from('check_results').select('revealed, revealed_by_hand').eq('id', hit.id))).toEqual([{ revealed: false, revealed_by_hand: false }]);

    // Into Downtime as m5-reminders.test.ts goes: the expedition ends, then Start downtime is its own tap.
    await ok(as(world.gm, endExpedition, { campaignId, expedition }));
    await ok(as(world.gm, startDowntime, { campaignId, refills: {} }));
    // As ruled 2026-10-29: the result and its own lines are the players' now.
    expect((await loadCheckResults(asDb(world.playerA), campaignId))!.map((r) => r.rowText)).toEqual([ROW]);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', campaignId).eq('target_table', 'check_results')).length).toBeGreaterThan(0);
    // The reveal's own row and its GM line stay the GM's.
    expect(must(await world.playerA.db.from('check_reveals').select('id').eq('campaign_id', campaignId))).toEqual([]);
    expect((await revealLines(world.playerA, campaignId)).map((l) => l.audience)).toEqual(['all']);
  });

  it("a reveal taken back is no longer in a player's answer; the row stays", async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));
    expect(await loadRevealedWords(asDb(world.playerA), campaignId)).toHaveLength(1);

    const back = await ok(as(world.gm, takeBackCheckWords, { campaignId, revealId: reveal.id }));
    expect(back).toMatchObject({ id: reveal.id, takenBack: true });
    expect(await loadRevealedWords(asDb(world.playerA), campaignId)).toEqual([]);
    expect(await loadRevealedWords(asDb(world.playerB), campaignId)).toEqual([]);
    expect(must(await world.playerA.db.rpc('revealed_words', { campaign: campaignId }))).toEqual([]);
    // Nothing erased (hard rule 4): the row is marked.
    expect(must(await world.admin.from('check_reveals').select('words, taken_back').eq('id', reveal.id))).toEqual([{ words: WORDS, taken_back: true }]);
    // The player's log keeps the words they were shown (sf-20) and says a reveal was taken back, in a line with no
    // words; still nothing of the check on any line they read. The GM's lines keep the words too.
    expect((await revealLines(world.playerA, campaignId)).map((l) => [l.type, l.after])).toEqual([
      ['check.showWords', { shown: true, words: WORDS }],
      ['check.takeBackWords', { shown: false }],
    ]);
    const everything = await everyLine(world.playerA, campaignId);
    for (const hidden of [hit.id, ROW, 'bog-things', 'Bog lurkers', 'HP 9', record.name]) expect(everything).not.toContain(hidden);
    expect((await revealLines(world.gm, campaignId)).filter((l) => l.audience === 'gm').map((l) => l.after.words)).toEqual([WORDS, WORDS]);

    // A second take-back changes nothing and writes no line.
    await ok(as(world.gm, takeBackCheckWords, { campaignId, revealId: reveal.id }));
    expect(await revealLines(world.gm, campaignId)).toHaveLength(4);
  });

  it('a player of another campaign, and someone in none, get nothing', async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));
    // The newcomer plays in another campaign of the same GM; the outsider is in none.
    must(await world.admin.from('members').insert({ campaign_id: world.otherCampaignId, user_id: world.newcomer.id, base_role: 'player' }).select());

    for (const person of [world.newcomer, world.outsider]) {
      expect(must(await person.db.rpc('revealed_words', { campaign: campaignId }))).toEqual([]);
      expect(await loadRevealedWords(asDb(person), campaignId)).toEqual([]);
      expect(must(await person.db.from('check_reveals').select('id').eq('id', reveal.id))).toEqual([]);
      expect(must(await person.db.from('events').select('id').eq('campaign_id', campaignId))).toEqual([]);
    }
    // And the other campaign's answer holds nothing of this one.
    expect(must(await world.newcomer.db.rpc('revealed_words', { campaign: world.otherCampaignId }))).toEqual([]);
  });

  it("a player can't write a reveal, by the functions or the table; nor does the GM through the table", async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));

    for (const person of [world.playerA, world.outsider]) {
      expect((await as(person, showCheckWords, { campaignId, resultId: hit.id, words: 'Mine' })).ok).toBe(false);
      expect(denied(await person.db.rpc('show_check_words', { result: hit.id, words: 'Mine' }))).toBe(true);
      expect((await as(person, takeBackCheckWords, { campaignId, revealId: reveal.id })).ok).toBe(false);
      expect(denied(await person.db.rpc('take_back_check_words', { reveal: reveal.id }))).toBe(true);
    }
    for (const person of [world.playerA, world.gm]) {
      const insert = await person.db.from('check_reveals').insert({ campaign_id: campaignId, check_result_id: hit.id, words: 'Mine' }).select('id');
      expect(insert.error).not.toBeNull();
      // A change or a delete through the table touches no row.
      await person.db.from('check_reveals').update({ words: 'Mine', taken_back: true }).eq('id', reveal.id);
      await person.db.from('check_reveals').delete().eq('id', reveal.id);
    }
    expect(must(await world.admin.from('check_reveals').select('words, taken_back').eq('campaign_id', campaignId))).toEqual([{ words: WORDS, taken_back: false }]);
  });

  it('one reveal stands for a hit: a repeat makes none, other words are refused until the first is taken back', async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const requestId = crypto.randomUUID();
    const first = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }, requestId));
    // The same request again (an answer lost on the way), then a new request with the same words: the same reveal.
    expect((await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }, requestId))).id).toBe(first.id);
    expect((await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }))).id).toBe(first.id);
    expect(await as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: 'Shapes in the reeds.' })).toMatchObject({
      ok: false,
      message: 'The players were shown other words for this. Take those back first.',
    });
    expect(await as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: '   ' })).toMatchObject({ ok: false, message: 'Write what the players see first.' });
    expect(must(await world.admin.from('check_reveals').select('id').eq('campaign_id', campaignId))).toHaveLength(1);
    expect(await revealLines(world.gm, campaignId)).toHaveLength(2);

    await ok(as(world.gm, takeBackCheckWords, { campaignId, revealId: first.id }));
    const second = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: 'Shapes in the reeds.' }));
    expect(second.id).not.toBe(first.id);
    expect((await loadRevealedWords(asDb(world.playerA), campaignId))!.map((r) => r.words)).toEqual(['Shapes in the reeds.']);
  });

  it("the log's Undo is refused on a reveal's line, and changes nothing", async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));
    const lines = must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('target_table', 'check_reveals').order('seq'));
    for (const line of lines) {
      expect((await as(world.gm, undoChange, { campaignId, eventId: line.id as string, authorUserId: world.gm.id })).ok).toBe(false);
    }
    expect(must(await world.admin.from('check_reveals').select('taken_back').eq('id', reveal.id))).toEqual([{ taken_back: false }]);
    expect((await loadRevealedWords(asDb(world.playerA), campaignId))!.map((r) => r.words)).toEqual([WORDS]);
  });

  it("a reveal whose check result was undone since is not in a player's answer; their log keeps its line", async () => {
    const campaignId = await freshTable();
    const hit = await freshHit(campaignId);
    const reveal = await ok(as(world.gm, showCheckWords, { campaignId, resultId: hit.id, words: WORDS }));
    expect(await loadRevealedWords(asDb(world.playerA), campaignId)).toHaveLength(1);

    // The result marked undone, as the log's Undo of the check leaves it (m5-reminders.test.ts proves that Undo).
    expect(must(await world.admin.from('check_results').update({ undone: true }).eq('id', hit.id).select('undone'))).toEqual([{ undone: true }]);
    expect(must(await world.playerA.db.rpc('revealed_words', { campaign: campaignId }))).toEqual([]);
    expect(await loadRevealedWords(asDb(world.playerB), campaignId)).toEqual([]);
    // The reveal's row stays as it was (nothing erased), and the players' log keeps the line of what they were shown.
    expect(must(await world.admin.from('check_reveals').select('words, taken_back').eq('id', reveal.id))).toEqual([{ words: WORDS, taken_back: false }]);
    expect((await revealLines(world.playerA, campaignId)).map((l) => [l.type, l.after])).toEqual([['check.showWords', { shown: true, words: WORDS }]]);
    const everything = await everyLine(world.playerA, campaignId);
    for (const hidden of [hit.id, ROW, 'bog-things', 'Bog lurkers', 'HP 9', record.name]) expect(everything).not.toContain(hidden);
  });
});
