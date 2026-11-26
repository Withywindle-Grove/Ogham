// What a reveal stores, and what players read (Scene feedback sf-7a; the critique's finding 1 on page 44, "Preview,
// then send"; sf-20, sf-22; hard rule 5). The stand-in database mirrors
// supabase/migrations/20261126200000_sf_7a_reveal_words.sql, and the app's commands and loaders read through it. The
// real access rules are proved on the database (supabase/tests/sf-7a-reveal-words.test.ts). Invented content only.
import { beforeEach, describe, expect, it } from 'vitest';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../core/events.ts';
import { encodeEventTag } from '../core/eventTags.ts';
import type { Db } from '../core/supabase.ts';
import { mayUndo } from '../core/undo.ts';
import { loadCheckReveals, loadCheckResults, loadRevealedWords } from '../modules/expedition/reminderPlay.ts';
import { createFakeDb, type FakeWorld } from './fakeDb.ts';

type Row = Record<string, unknown>;
type Answer = { data: Row | null; error: { message: string; code?: string } | null };

const WORDS = 'Two pale shapes rise from the reeds.';
// The book's row, as check.setRoll keeps it: the table, then the row, with a count and a stat line players never get.
const ROW = 'Bog things: 2 Bog lurkers (HP 9 each)';

let world: FakeWorld;
let gm: string;
let sam: string;
let moss: string;
let campaign: string;
let hit: string;
let db: Db;

/**
 * One command's request, tagged as the app tags it: its own request id (or the one given, to repeat a request) and
 * which of the command's requests it is (`part`; a command's first is 0).
 */
const send = async (name: string, args: Row, type: string, requestId: string = crypto.randomUUID(), part: number = 0) => {
  const tag = encodeEventTag({ type, level: 'simple', requestId, part });
  return (await world.db.rpc(name as never, args as never).setHeader('x-grimoire-command', tag)) as unknown as Answer;
};
const show = (words: string, requestId?: string, part?: number) => send('show_check_words', { result: hit, words }, 'check.showWords', requestId, part);
const takeBack = (reveal: unknown) => send('take_back_check_words', { reveal }, 'check.takeBackWords');
/** The log as the signed-in person reads it, in the app's words, newest first. */
const logLines = async (me: string) => {
  const names = await loadLogNames(db, campaign, me);
  return groupEntries((await loadLog(db, campaign))!.events).map((entry) => describeEntry(entry, names));
};
/** Every log event the signed-in person may read, as one string, to search for what must not be there. */
const everyLine = async () => JSON.stringify((await world.db.from('events').select('*').eq('campaign_id', campaign)).data);

beforeEach(async () => {
  world = createFakeDb();
  db = world.db;
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  moss = world.addPerson('moss@lantern.example', 'Moss');
  campaign = world.addCampaign('The Reedmouth Delve', gm);
  world.addMember(campaign, sam, 'player');
  // Out on an adventure, so the hit is secret (one recorded in Downtime shows at once).
  world.tables.campaigns.find((c) => c.id === campaign)!.mode = 'adventure';
  world.signInAs(gm);
  const recorded = await send('record_check', { campaign, check_key: 'gm:listen', name: 'Listen for bog lurkers', source: 'gm', outcome: 'hit', modifiers: [], note: '', secret: true }, 'check.record');
  hit = String(recorded.data!.id);
  await send('set_check_roll', { result: hit, table_id: 'bog-things', roll: '2', row_text: ROW, seen_version: 1 }, 'check.setRoll');
});

describe('what a reveal stores, and what players read (sf-7a)', () => {
  // Purpose: a player is sent the words the GM confirmed and when, and nothing else of the check.
  it('a player reads the words the GM confirmed, and nothing of the check', async () => {
    const shown = await show(`  ${WORDS}  `);
    expect(shown.error).toBeNull();
    expect(shown.data).toMatchObject({ check_result_id: hit, words: WORDS, taken_back: false });

    world.signInAs(sam);
    const words = await loadRevealedWords(db, campaign);
    expect(words).toHaveLength(1);
    // Three things and no other: the reveal's own id, the words, when.
    expect(Object.keys(words![0]!).sort()).toEqual(['id', 'shownAt', 'words']);
    expect(words![0]).toMatchObject({ id: shown.data!.id, words: WORDS });
    // No row of the reveal, and no check result: the result itself stays unrevealed (sf-22).
    expect(await loadCheckReveals(db, campaign)).toEqual([]);
    expect(await loadCheckResults(db, campaign)).toEqual([]);
    expect(world.tables.check_results.find((r) => r.id === hit)).toMatchObject({ revealed: false });
  });

  // Purpose: the log must not hand a player the roll, the row, the table or the hit through the reveal's line (sf-20).
  it("the players' log line carries the words shown and nothing of the check; the GM's names the row", async () => {
    await show(WORDS);

    world.signInAs(sam);
    expect(await logLines(sam)).toContain(`Priya showed the players “${WORDS}”.`);
    const mine = await everyLine();
    for (const hidden of [hit, ROW, 'bog-things', 'Bog lurkers', 'HP 9', 'Listen for bog lurkers']) expect(mine).not.toContain(hidden);
    // The one line a player reads holds the words they were shown, and nothing else (sf-20).
    const lines = (await world.db.from('events').select('*').eq('campaign_id', campaign).eq('target_table', 'check_reveals')).data as Row[];
    expect(lines.map((l) => [l.audience, l.after])).toEqual([['all', { shown: true, words: WORDS }]]);

    world.signInAs(gm);
    expect(await logLines(gm)).toContain(`You showed the players “${WORDS}” (${ROW}).`);
    // And the GM alone reads the reveal's row, which names the hit.
    expect(await loadCheckReveals(db, campaign)).toMatchObject([{ checkResultId: hit, words: WORDS, takenBack: false }]);
  });

  // Purpose: taking a reveal back takes the words out of what players are sent now (the read); their log still says
  // what they were shown (sf-20: the line carries the words), and that it was taken back.
  it("a reveal taken back is no longer in a player's answer; their log keeps the words they were shown", async () => {
    const shown = await show(WORDS);
    const back = await takeBack(shown.data!.id);
    expect(back.data).toMatchObject({ id: shown.data!.id, taken_back: true });
    // The row stays, marked (hard rule 4); a second take-back changes nothing and writes no line.
    expect(world.tables.check_reveals).toHaveLength(1);
    const lines = world.tables.events.length;
    expect((await takeBack(shown.data!.id)).data).toMatchObject({ taken_back: true });
    expect(world.tables.events).toHaveLength(lines);

    world.signInAs(sam);
    expect(await loadRevealedWords(db, campaign)).toEqual([]);
    const said = await logLines(sam);
    expect(said).toContain('Priya took back what the players were shown.');
    expect(said).toContain(`Priya showed the players “${WORDS}”.`);
    // The line of the showing keeps its words; the take-back's line holds none, and neither holds anything of the check.
    const kept = (await world.db.from('events').select('*').eq('campaign_id', campaign).eq('target_table', 'check_reveals').order('seq')).data as Row[];
    expect(kept.map((l) => [l.type, l.audience, l.after])).toEqual([
      ['check.showWords', 'all', { shown: true, words: WORDS }],
      ['check.takeBackWords', 'all', { shown: false }],
    ]);
    const mine = await everyLine();
    for (const hidden of [hit, ROW, 'bog-things', 'Bog lurkers', 'HP 9', 'Listen for bog lurkers']) expect(mine).not.toContain(hidden);

    // The GM's log keeps what was shown and taken back.
    world.signInAs(gm);
    const gmSaid = await logLines(gm);
    expect(gmSaid).toContain(`You took back what the players were shown: “${WORDS}”.`);
    expect(gmSaid).toContain(`You showed the players “${WORDS}” (${ROW}).`);
    expect(await loadCheckReveals(db, campaign)).toEqual([]);
  });

  // Purpose: only the GM shows or takes back, and nobody writes a reveal through the table.
  it("a player can't show, take back or write a reveal; someone outside reads nothing", async () => {
    const shown = await show(WORDS);

    world.signInAs(sam);
    expect((await send('show_check_words', { result: hit, words: 'Mine' }, 'check.showWords')).error?.code).toBe('42501');
    expect((await takeBack(shown.data!.id)).error?.code).toBe('42501');
    const insert = await world.db.from('check_reveals').insert({ campaign_id: campaign, check_result_id: hit, words: 'Mine' } as never).select('id');
    expect(insert.error).not.toBeNull();
    const update = await world.db.from('check_reveals').update({ taken_back: true } as never).eq('id', String(shown.data!.id)).select('id');
    expect(update.error).not.toBeNull();
    expect(world.tables.check_reveals).toMatchObject([{ words: WORDS, taken_back: false }]);

    world.signInAs(moss);
    expect(await loadRevealedWords(db, campaign)).toEqual([]);
    expect(await loadCheckReveals(db, campaign)).toEqual([]);
    expect((await show('Mine')).error?.code).toBe('42501');
  });

  // Purpose: one reveal stands for a hit at a time, so players never read two sets of words for one encounter.
  it('one reveal stands for a hit: a repeat makes none, other words are refused until the first is taken back', async () => {
    const request = crypto.randomUUID();
    const first = await show(WORDS, request);
    expect((await show(WORDS, request)).data).toMatchObject({ id: first.data!.id });
    expect((await show(WORDS)).data).toMatchObject({ id: first.data!.id });
    expect((await show('Shapes in the reeds.')).error?.message).toBe('The players were shown other words for this. Take those back first.');
    expect((await show('   ')).error?.message).toBe('Write what the players see first.');
    expect(world.tables.check_reveals).toHaveLength(1);
    // One action, two lines: the GM's and the players'.
    expect(world.tables.events.filter((e) => e.type === 'check.showWords').map((e) => e.audience)).toEqual(['gm', 'all']);

    await takeBack(first.data!.id);
    const second = await show('Shapes in the reeds.');
    expect(second.data).toMatchObject({ words: 'Shapes in the reeds.', taken_back: false });
    expect(second.data!.id).not.toBe(first.data!.id);
    world.signInAs(sam);
    expect((await loadRevealedWords(db, campaign))!.map((r) => r.words)).toEqual(['Shapes in the reeds.']);
  });

  // Purpose: a repeat is the same request and the same part, as the database tells one (private.made_by_request); the
  // same request id with another part is a request of its own, so the stand-in must not answer it with the first's reveal.
  it('the same request with another part is not a repeat', async () => {
    const request = crypto.randomUUID();
    const first = await show(WORDS, request, 0);
    await takeBack(first.data!.id);
    // The same request and part again (an answer lost on the way): what the first made, as it is now, and no new line.
    const lines = world.tables.events.length;
    expect((await show(WORDS, request, 0)).data).toMatchObject({ id: first.data!.id, taken_back: true });
    expect(world.tables.events).toHaveLength(lines);
    // Another part of that request: nothing stands for the hit, so it makes a new reveal, with its own two lines.
    const second = await show(WORDS, request, 1);
    expect(second.data).toMatchObject({ words: WORDS, taken_back: false });
    expect(second.data!.id).not.toBe(first.data!.id);
    expect(world.tables.events.filter((e) => e.type === 'check.showWords').map((e) => [e.target_id, e.request_part])).toEqual([
      [first.data!.id, 0],
      [first.data!.id, 0],
      [second.data!.id, 1],
      [second.data!.id, 1],
    ]);
  });

  // Purpose: a check the GM undid has no card left to take a reveal back from, so its words leave the players' answer
  // (Francis, 2026-11-26: "They disappear"); their log keeps its line.
  it("a reveal of a check result that was undone is not in a player's answer; their log keeps its line", async () => {
    await show(WORDS);
    world.tables.check_results.find((r) => r.id === hit)!.undone = true;
    world.signInAs(sam);
    expect(await loadRevealedWords(db, campaign)).toEqual([]);
    expect(await logLines(sam)).toContain(`Priya showed the players “${WORDS}”.`);
  });

  // Purpose: the log offers no Undo on these lines (the database would refuse it): taking back is its own command.
  it('neither line is offered an Undo in the log', async () => {
    const shown = await show(WORDS);
    await takeBack(shown.data!.id);
    for (const entry of groupEntries((await loadLog(db, campaign))!.events).filter((e) => e.main.type.startsWith('check.showWords') || e.main.type === 'check.takeBackWords')) {
      expect(mayUndo(entry.main.type, entry.events)).toBe(false);
    }
  });
});
